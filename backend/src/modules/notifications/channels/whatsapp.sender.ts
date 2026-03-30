import { env } from '../../../config/env'
import { TwilioIntegration } from '../../../integrations/twilio'
import { logger } from '../../../shared/utils/logger'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let twilioIntegration: TwilioIntegration | null = null

async function getTwilioIntegration(): Promise<TwilioIntegration> {
  if (!twilioIntegration) {
    twilioIntegration = new TwilioIntegration()
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured for WhatsApp sender.')
    }
    await twilioIntegration.connect({
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      fromPhone: env.TWILIO_PHONE_NUMBER ?? '',
      whatsappFrom: env.TWILIO_WHATSAPP_FROM ?? '',
    })
  }
  return twilioIntegration
}

export class WhatsAppSender {
  async send(to: string, body: string, tenantId: string): Promise<void> {
    try {
      // Compliance guard: skip if contact has opted out
      const normalizedTo = to.replace(/^whatsapp:/, '')
      const contact = await prisma.contact.findFirst({
        where: {
          tenantId,
          OR: [{ whatsappPhone: normalizedTo }, { phone: normalizedTo }],
          deletedAt: null,
        },
        select: { id: true, whatsappOptIn: true, doNotContact: true },
      })

      if (contact && (!contact.whatsappOptIn || contact.doNotContact)) {
        logger.info(`WhatsApp skipped for ${to} — opted out or do-not-contact`, { tenantId, contactId: contact.id })
        return
      }

      const integration = await getTwilioIntegration()
      const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
      await integration.sendMessage({ to: whatsappTo, body })
      logger.info(`WhatsApp message sent to ${to}`, { tenantId })
    } catch (err) {
      logger.error(`Failed to send WhatsApp message to ${to}`, { error: err, tenantId })
      throw err
    }
  }
}

export const whatsappSender = new WhatsAppSender()
