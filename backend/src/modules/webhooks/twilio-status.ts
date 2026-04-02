import { Request, Response, NextFunction } from 'express'
import twilio from 'twilio'
import { PrismaClient } from '@prisma/client'
import { env } from '../../config/env'
import { logger } from '../../shared/utils/logger'

const prisma = new PrismaClient()

/**
 * Twilio Delivery Status Callback
 * POST /api/webhooks/twilio/status
 *
 * Twilio calls this for every outbound message status transition:
 *   queued → sent → delivered
 *   queued → sent → undelivered
 *   queued → failed
 *
 * We log each update and, on terminal failure, mark the contact's opt-in
 * as potentially unreachable for operator awareness.
 */
export async function twilioStatusCallbackHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as Record<string, string>
    const {
      MessageSid,
      MessageStatus,
      To,
      From,
      ErrorCode,
      ErrorMessage,
    } = body

    // Verify Twilio signature
    if (env.TWILIO_AUTH_TOKEN) {
      const twilioSignature = req.headers['x-twilio-signature'] as string | undefined
      if (twilioSignature) {
        const protocol = req.headers['x-forwarded-proto'] ?? 'https'
        const host = req.headers.host ?? ''
        const url = `${protocol}://${host}${req.originalUrl}`
        const isValid = twilio.validateRequest(env.TWILIO_AUTH_TOKEN, twilioSignature, url, body)
        if (!isValid) {
          logger.warn('Twilio status callback: signature verification failed', { messageSid: MessageSid })
          res.sendStatus(401)
          return
        }
      }
    }

    logger.info(`Twilio status: ${MessageSid} → ${MessageStatus}`, {
      to: To,
      from: From,
      errorCode: ErrorCode ?? null,
    })

    // On terminal failure, find the contact and flag for operator review
    const isTerminalFailure = MessageStatus === 'failed' || MessageStatus === 'undelivered'

    if (isTerminalFailure && To) {
      const normalizedTo = To.replace(/^whatsapp:/, '')
      const isWhatsApp = To.startsWith('whatsapp:')

      const contact = await prisma.contact.findFirst({
        where: {
          OR: isWhatsApp
            ? [{ whatsappPhone: normalizedTo }]
            : [{ phone: normalizedTo }],
          deletedAt: null,
        },
        select: { id: true, tenantId: true, firstName: true, lastName: true },
      })

      if (contact) {
        logger.warn(
          `Message ${MessageStatus} for contact ${contact.id} (${contact.firstName} ${contact.lastName})`,
          { messageSid: MessageSid, errorCode: ErrorCode, errorMessage: ErrorMessage },
        )

        // Error code 30003 = unreachable, 30004 = do not contact, 30006 = landline
        // Automatically opt out if carrier permanently rejects
        const hardFailCodes = ['30003', '30004', '30005', '30006']
        if (ErrorCode && hardFailCodes.includes(ErrorCode)) {
          const now = new Date()
          await prisma.contact.update({
            where: { id: contact.id },
            data: isWhatsApp
              ? { whatsappOptIn: false, whatsappOptOutAt: now }
              : { smsOptIn: false, smsOptOutAt: now },
          })
          logger.info(
            `Auto opted-out contact ${contact.id} due to hard failure (error ${ErrorCode})`,
          )
        }
      }
    }

    // Twilio expects a 200 response — no body needed
    res.sendStatus(200)
  } catch (err) {
    next(err)
  }
}
