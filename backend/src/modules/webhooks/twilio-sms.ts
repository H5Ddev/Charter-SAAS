import { Request, Response, NextFunction } from 'express'
import twilio from 'twilio'
import { PrismaClient } from '@prisma/client'
import { env } from '../../config/env'
import { logger } from '../../shared/utils/logger'

const prisma = new PrismaClient()

function buildTwimlResponse(message?: string): string {
  if (message) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message}</Message>
</Response>`
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`
}

// Keywords Twilio requires per CTIA / carrier compliance
const STOP_KEYWORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']
const START_KEYWORDS = ['START', 'UNSTOP', 'YES']
const HELP_KEYWORDS = ['HELP', 'INFO']

function classifyKeyword(body: string): 'STOP' | 'START' | 'HELP' | null {
  const normalized = body.trim().toUpperCase()
  if (STOP_KEYWORDS.includes(normalized)) return 'STOP'
  if (START_KEYWORDS.includes(normalized)) return 'START'
  if (HELP_KEYWORDS.includes(normalized)) return 'HELP'
  return null
}

export async function twilioInboundSmsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as Record<string, string>
    const { From, Body: messageBody, MessageSid, To } = body

    // Verify Twilio signature
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      const twilioSignature = req.headers['x-twilio-signature'] as string | undefined
      if (twilioSignature) {
        const protocol = req.headers['x-forwarded-proto'] ?? 'https'
        const host = req.headers.host ?? ''
        const url = `${protocol}://${host}${req.originalUrl}`

        const isValid = twilio.validateRequest(
          env.TWILIO_AUTH_TOKEN,
          twilioSignature,
          url,
          body,
        )

        if (!isValid) {
          logger.warn('Twilio inbound SMS: signature verification failed', { from: From })
          res.status(401).send(buildTwimlResponse())
          return
        }
      }
    }

    logger.info(`Inbound SMS received from ${From}`, { messageSid: MessageSid })

    // Find tenant by DB integration record, or fall back to env-var config
    const integration = await prisma.integration.findFirst({
      where: { type: 'TWILIO', isActive: true, deletedAt: null },
      include: { config: true },
    })

    let tenantId: string

    if (integration) {
      tenantId = integration.tenantId
    } else {
      // Fallback: find the first tenant (single-tenant / env-var config mode)
      const tenant = await prisma.tenant.findFirst({
        where: { deletedAt: null },
        select: { id: true },
      })
      if (!tenant) {
        logger.warn('No tenant found for inbound SMS', { to: To })
        res.type('text/xml').send(buildTwimlResponse())
        return
      }
      tenantId = tenant.id
      logger.info('Using fallback tenant for inbound SMS (no integration record found)', { tenantId })
    }

    // Find or create contact
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        OR: [{ phone: From }, { whatsappPhone: From }],
        deletedAt: null,
      },
    })

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          firstName: 'Unknown',
          lastName: 'Caller',
          phone: From,
          type: 'PASSENGER',
          preferredChannel: 'SMS',
          tags: '[]',
        },
      })
      logger.info(`Created new contact from inbound SMS: ${contact.id}`)
    }

    // ── Opt-in / opt-out keyword handling ────────────────────────────────────
    const keyword = classifyKeyword(messageBody)
    const isWhatsApp = From.startsWith('whatsapp:')
    const now = new Date()

    if (keyword === 'STOP') {
      if (isWhatsApp) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { whatsappOptIn: false, whatsappOptOutAt: now },
        })
      } else {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { smsOptIn: false, smsOptOutAt: now },
        })
      }
      logger.info(`Contact ${contact.id} opted out of ${isWhatsApp ? 'WhatsApp' : 'SMS'}`)
      // Twilio sends its own STOP confirmation automatically; we return empty TwiML
      // so we don't double-reply. Carrier compliance is handled by Twilio.
      res.type('text/xml').send(buildTwimlResponse())
      return
    }

    if (keyword === 'START') {
      if (isWhatsApp) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { whatsappOptIn: true, whatsappOptInAt: now, whatsappOptOutAt: null },
        })
      } else {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { smsOptIn: true, smsOptInAt: now, smsOptOutAt: null },
        })
      }
      logger.info(`Contact ${contact.id} opted in to ${isWhatsApp ? 'WhatsApp' : 'SMS'}`)
      const confirmMsg = isWhatsApp
        ? `You're now subscribed to flight notifications from AeroComm. Reply STOP at any time to unsubscribe.`
        : `You're now subscribed to flight notifications from AeroComm. Msg & data rates may apply. Reply STOP to unsubscribe, HELP for help.`
      res.type('text/xml').send(buildTwimlResponse(confirmMsg))
      return
    }

    if (keyword === 'HELP') {
      const helpMsg = `AeroComm flight notifications. Reply STOP to unsubscribe. For support contact your charter operator. Msg & data rates may apply.`
      res.type('text/xml').send(buildTwimlResponse(helpMsg))
      return
    }

    // ── Regular inbound message → create support ticket ───────────────────────
    const ticket = await prisma.ticket.create({
      data: {
        tenantId,
        contactId: contact.id,
        source: 'SMS_INBOUND',
        status: 'OPEN',
        priority: 'NORMAL',
        title: `Inbound SMS from ${From}`,
        body: messageBody,
      },
    })

    await prisma.ticketMessage.create({
      data: {
        tenantId,
        ticketId: ticket.id,
        contactId: contact.id,
        content: messageBody,
        channel: 'SMS',
        isInternal: false,
      },
    })

    logger.info(`Ticket created from inbound SMS`, {
      ticketId: ticket.id,
      contactId: contact.id,
      messageSid: MessageSid,
    })

    // Auto-reply template if configured
    const autoReplyTemplate = await prisma.notificationTemplate.findFirst({
      where: {
        tenantId,
        name: { contains: 'Auto-Reply' },
        channel: 'SMS',
        deletedAt: null,
      },
    })

    let replyMessage: string | undefined
    if (autoReplyTemplate) {
      replyMessage = autoReplyTemplate.body
        .replace('{{contact.firstName}}', contact.firstName)
        .replace('{{ticket.id}}', ticket.id)
    }

    res.type('text/xml').send(buildTwimlResponse(replyMessage))
  } catch (err) {
    next(err)
  }
}
