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
      throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.')
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

export class SmsSender {
  async send(to: string, body: string, tenantId: string): Promise<void> {
    try {
      // Compliance guard: skip if contact has opted out
      const contact = await prisma.contact.findFirst({
        where: { tenantId, phone: to, deletedAt: null },
        select: { id: true, smsOptIn: true, doNotContact: true },
      })

      if (contact && (!contact.smsOptIn || contact.doNotContact)) {
        logger.info(`SMS skipped for ${to} — opted out or do-not-contact`, { tenantId, contactId: contact.id })
        return
      }

      const integration = await getTwilioIntegration()
      await integration.sendMessage({ to, body })
      logger.info(`SMS sent to ${to}`, { tenantId })
    } catch (err) {
      logger.error(`Failed to send SMS to ${to}`, { error: err, tenantId })
      throw err
    }
  }
}

export const smsSender = new SmsSender()
