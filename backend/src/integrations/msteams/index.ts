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

interface MsTeamsConfig {
  webhookUrl: string
  hmacSecret?: string
}

export class MsTeamsIntegration implements Integration {
  name = 'msteams'
  private config: MsTeamsConfig | null = null
  private status: IntegrationStatus = 'unconfigured'

  async connect(config: Record<string, string>): Promise<void> {
    this.config = {
      webhookUrl: config.webhookUrl,
      hmacSecret: config.hmacSecret,
    }
    this.status = 'connected'
    logger.info('MS Teams integration connected')
  }

  async disconnect(): Promise<void> {
    this.config = null
    this.status = 'disconnected'
  }

  getStatus(): IntegrationStatus {
    return this.status
  }

  /**
   * Send a message to MS Teams using an Adaptive Card.
   * The body can be a JSON string of an Adaptive Card or plain text.
   */
  async sendMessage(payload: MessagePayload): Promise<MessageResult> {
    if (!this.config) {
      throw new Error('MS Teams not connected. Call connect() first.')
    }

    let adaptiveCard: Record<string, unknown>

    // Try to parse body as JSON Adaptive Card, otherwise create a simple text card
    try {
      adaptiveCard = JSON.parse(payload.body) as Record<string, unknown>
    } catch {
      adaptiveCard = {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          {
            type: 'TextBlock',
            size: 'Medium',
            weight: 'Bolder',
            text: payload.subject ?? 'AeroComm Notification',
          },
          {
            type: 'TextBlock',
            text: payload.body,
            wrap: true,
          },
        ],
      }
    }

    const teamsPayload = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          contentUrl: null,
          content: adaptiveCard,
        },
      ],
    }

    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamsPayload),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`MS Teams webhook failed: ${response.status} ${text}`)
    }

    const messageId = uuidv4()
    logger.info('MS Teams message sent', { to: payload.to })

    return {
      messageId,
      status: 'sent',
      providerResponse: { statusCode: response.status },
    }
  }

  /**
   * Verify HMAC signature if configured.
   * MS Teams outgoing webhooks include an HMAC signature.
   */
  verifySignature(req: Request): boolean {
    if (!this.config?.hmacSecret) return true

    const authHeader = req.headers.authorization as string | undefined
    if (!authHeader?.startsWith('HMAC ')) return false

    const providedHmac = authHeader.substring(5)

    const rawBody = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body)

    const secretBuffer = Buffer.from(this.config.hmacSecret, 'base64')
    const hmac = crypto
      .createHmac('sha256', secretBuffer)
      .update(rawBody, 'utf8')
      .digest('base64')

    return crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(providedHmac),
    )
  }

  // Teams webhooks are primarily outbound (we POST to Teams).
  // Incoming webhooks are limited to outgoing webhooks from Teams bots.
  async receiveWebhook(req: Request): Promise<WebhookEvent> {
    const body = req.body as Record<string, unknown>

    return {
      eventId: uuidv4(),
      eventType: 'MSTEAMS_INCOMING',
      payload: {
        type: body.type,
        text: body.text,
        from: body.from,
        conversation: body.conversation,
      },
      rawBody: body,
      receivedAt: new Date(),
    }
  }
}
