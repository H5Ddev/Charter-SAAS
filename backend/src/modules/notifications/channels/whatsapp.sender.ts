import { env } from '../../../config/env'
import { TwilioIntegration } from '../../../integrations/twilio'
import { logger } from '../../../shared/utils/logger'

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
  /**
   * Send a WhatsApp message via Twilio.
   * @param to - Phone number in E.164 format (e.g. +15551234567)
   * @param body - Message body
   * @param tenantId - Tenant ID for logging
   */
  async send(to: string, body: string, tenantId: string): Promise<void> {
    try {
      const integration = await getTwilioIntegration()

      // Prefix with whatsapp: for Twilio WhatsApp API
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
