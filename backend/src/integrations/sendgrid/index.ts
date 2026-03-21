import sgMail from '@sendgrid/mail'
import crypto from 'crypto'
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

interface SendGridConfig {
  apiKey: string
  fromEmail: string
  fromName: string
  webhookVerificationKey?: string
}

interface SendGridWebhookEvent {
  email: string
  event: string
  sg_event_id: string
  sg_message_id?: string
  timestamp: number
  [key: string]: unknown
}

export class SendGridIntegration implements Integration {
  name = 'sendgrid'
  private config: SendGridConfig | null = null
  private status: IntegrationStatus = 'unconfigured'

  async connect(config: Record<string, string>): Promise<void> {
    this.config = {
      apiKey: config.apiKey,
      fromEmail: config.fromEmail,
      fromName: config.fromName || 'AeroComm',
      webhookVerificationKey: config.webhookVerificationKey,
    }
    sgMail.setApiKey(this.config.apiKey)
    this.status = 'connected'
    logger.info('SendGrid integration connected')
  }

  async disconnect(): Promise<void> {
    this.config = null
    this.status = 'disconnected'
  }

  getStatus(): IntegrationStatus {
    return this.status
  }

  async sendMessage(payload: MessagePayload): Promise<MessageResult> {
    if (!this.config) {
      throw new Error('SendGrid not connected. Call connect() first.')
    }

    try {
      const msg: sgMail.MailDataRequired = {
        to: payload.to,
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        subject: payload.subject || '(No subject)',
        html: payload.body,
        text: payload.body.replace(/<[^>]*>/g, ''), // strip HTML for plain text
        ...(payload.templateId && {
          templateId: payload.templateId,
          dynamicTemplateData: payload.templateData,
        }),
        ...(payload.attachments && {
          attachments: payload.attachments.map((att) => ({
            filename: att.filename,
            content: att.content.toString('base64'),
            type: att.contentType,
            disposition: 'attachment',
          })),
        }),
      }

      const [response] = await sgMail.send(msg)

      logger.info('SendGrid email sent', {
        to: payload.to,
        statusCode: response.statusCode,
        messageId: response.headers['x-message-id'],
      })

      return {
        messageId: (response.headers['x-message-id'] as string) ?? uuidv4(),
        status: response.statusCode === 202 ? 'queued' : 'sent',
        providerResponse: {
          statusCode: response.statusCode,
          headers: response.headers,
        },
      }
    } catch (err) {
      logger.error('SendGrid sendMessage error', { error: err, to: payload.to })
      throw err
    }
  }

  /**
   * Verify SendGrid event webhook signature.
   * Uses ECDSA signature verification with the public key from SendGrid.
   */
  verifySignature(req: Request): boolean {
    if (!this.config?.webhookVerificationKey) {
      // If no key configured, skip verification (development mode)
      return true
    }

    const signature = req.headers['x-twilio-email-event-webhook-signature'] as string
    const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string

    if (!signature || !timestamp) return false

    try {
      const payload = timestamp + (req.body as string)
      const verify = crypto.createVerify('SHA256')
      verify.update(payload)
      return verify.verify(this.config.webhookVerificationKey, signature, 'base64')
    } catch {
      return false
    }
  }

  async receiveWebhook(req: Request): Promise<WebhookEvent> {
    const events = req.body as SendGridWebhookEvent[]
    const firstEvent = Array.isArray(events) ? events[0] : events

    return {
      eventId: uuidv4(),
      eventType: `SENDGRID_${(firstEvent?.event ?? 'UNKNOWN').toUpperCase()}`,
      payload: {
        events: Array.isArray(events) ? events : [events],
        email: firstEvent?.email,
        event: firstEvent?.event,
        timestamp: firstEvent?.timestamp,
      },
      rawBody: req.body,
      receivedAt: new Date(),
    }
  }
}
