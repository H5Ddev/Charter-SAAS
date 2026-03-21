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

    // Find tenant by the Twilio phone number (To)
    const integration = await prisma.integration.findFirst({
      where: {
        type: 'TWILIO',
        isActive: true,
        deletedAt: null,
      },
      include: { config: true },
    })

    if (!integration) {
      logger.warn('No active Twilio integration found for inbound SMS', { to: To })
      res.type('text/xml').send(buildTwimlResponse())
      return
    }

    const tenantId = integration.tenantId

    // Find existing contact by phone number
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        OR: [{ phone: From }, { whatsappPhone: From }],
        deletedAt: null,
      },
    })

    // If no contact found, create one
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

    // Create a support ticket from the inbound SMS
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

    // Create the first message on the ticket
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

    // Check if an auto-reply template is configured
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

    // Respond with TwiML
    res.type('text/xml').send(buildTwimlResponse(replyMessage))
  } catch (err) {
    next(err)
  }
}
