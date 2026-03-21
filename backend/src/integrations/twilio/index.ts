import twilio, { Twilio } from 'twilio'
import type { Request } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  Integration,
  IntegrationStatus,
  MessagePayload,
  MessageResult,
  WebhookEvent,
} from '../types'
import { logger } from '../../shared/utils/logger'

interface TwilioConfig {
  accountSid: string
  authToken: string
  fromPhone: string
  whatsappFrom?: string
}

export class TwilioIntegration implements Integration {
  name = 'twilio'
  private client: Twilio | null = null
  private config: TwilioConfig | null = null
  private status: IntegrationStatus = 'unconfigured'

  async connect(config: Record<string, string>): Promise<void> {
    this.config = {
      accountSid: config.accountSid,
      authToken: config.authToken,
      fromPhone: config.fromPhone,
      whatsappFrom: config.whatsappFrom,
    }
    this.client = twilio(this.config.accountSid, this.config.authToken)
    this.status = 'connected'
    logger.info('Twilio integration connected')
  }

  async disconnect(): Promise<void> {
    this.client = null
    this.config = null
    this.status = 'disconnected'
  }

  getStatus(): IntegrationStatus {
    return this.status
  }

  /**
   * Send an SMS or WhatsApp message.
   * For WhatsApp: set payload.to as 'whatsapp:+1234567890'
   */
  async sendMessage(payload: MessagePayload): Promise<MessageResult> {
    if (!this.client || !this.config) {
      throw new Error('Twilio not connected. Call connect() first.')
    }

    const isWhatsApp = payload.to.startsWith('whatsapp:')
    const from = isWhatsApp
      ? (this.config.whatsappFrom ?? `whatsapp:${this.config.fromPhone}`)
      : this.config.fromPhone

    try {
      const message = await this.client.messages.create({
        to: payload.to,
        from,
        body: payload.body,
      })

      logger.info(`Twilio message sent`, {
        messageSid: message.sid,
        to: payload.to,
        status: message.status,
      })

      return {
        messageId: message.sid,
        status: message.status === 'failed' ? 'failed' : 'sent',
        providerResponse: { sid: message.sid, status: message.status },
      }
    } catch (err) {
      logger.error('Twilio sendMessage error', { error: err, to: payload.to })
      throw err
    }
  }

  /**
   * Verify Twilio webhook signature using X-Twilio-Signature header.
   */
  verifySignature(req: Request): boolean {
    if (!this.config) return false

    const twilioSignature = req.headers['x-twilio-signature'] as string | undefined
    if (!twilioSignature) return false

    try {
      // Build the full URL as Twilio expects
      const protocol = req.headers['x-forwarded-proto'] ?? 'https'
      const host = req.headers.host ?? ''
      const url = `${protocol}://${host}${req.originalUrl}`

      const params = req.body as Record<string, string>

      const isValid = twilio.validateRequest(
        this.config.authToken,
        twilioSignature,
        url,
        params,
      )

      if (!isValid) {
        logger.warn('Twilio signature verification failed', { url })
      }

      return isValid
    } catch (err) {
      logger.error('Twilio signature verification error', { error: err })
      return false
    }
  }

  /**
   * Parse an incoming Twilio webhook (SMS or WhatsApp).
   */
  async receiveWebhook(req: Request): Promise<WebhookEvent> {
    const body = req.body as Record<string, string>

    return {
      eventId: uuidv4(),
      eventType: body.MessageSid ? 'INBOUND_SMS' : 'TWILIO_EVENT',
      payload: {
        messageSid: body.MessageSid,
        from: body.From,
        to: body.To,
        body: body.Body,
        numMedia: body.NumMedia,
        accountSid: body.AccountSid,
        messagingServiceSid: body.MessagingServiceSid,
      },
      rawBody: body,
      receivedAt: new Date(),
    }
  }
}
