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

interface SlackConfig {
  webhookUrl: string
  signingSecret: string
}

export class SlackIntegration implements Integration {
  name = 'slack'
  private config: SlackConfig | null = null
  private status: IntegrationStatus = 'unconfigured'

  async connect(config: Record<string, string>): Promise<void> {
    this.config = {
      webhookUrl: config.webhookUrl,
      signingSecret: config.signingSecret,
    }
    this.status = 'connected'
    logger.info('Slack integration connected')
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
      throw new Error('Slack not connected. Call connect() first.')
    }

    const slackPayload = {
      text: payload.subject ?? payload.body,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: payload.body,
          },
        },
      ],
    }

    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Slack webhook failed: ${response.status} ${text}`)
    }

    const messageId = uuidv4()
    logger.info('Slack message sent', { to: payload.to })

    return {
      messageId,
      status: 'sent',
      providerResponse: { statusCode: response.status },
    }
  }

  /**
   * Verify Slack request signature using X-Slack-Signature header.
   * https://api.slack.com/authentication/verifying-requests-from-slack
   */
  verifySignature(req: Request): boolean {
    if (!this.config?.signingSecret) return true

    const slackSignature = req.headers['x-slack-signature'] as string | undefined
    const timestamp = req.headers['x-slack-request-timestamp'] as string | undefined

    if (!slackSignature || !timestamp) return false

    // Prevent replay attacks: reject if request is older than 5 minutes
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
      logger.warn('Slack signature timestamp too old')
      return false
    }

    const rawBody = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body)

    const sigBasestring = `v0:${timestamp}:${rawBody}`
    const hmac = crypto
      .createHmac('sha256', this.config.signingSecret)
      .update(sigBasestring)
      .digest('hex')
    const computedSig = `v0=${hmac}`

    return crypto.timingSafeEqual(
      Buffer.from(computedSig),
      Buffer.from(slackSignature),
    )
  }

  async receiveWebhook(req: Request): Promise<WebhookEvent> {
    const body = req.body as Record<string, unknown>

    return {
      eventId: uuidv4(),
      eventType: `SLACK_${String(body.type ?? 'EVENT').toUpperCase()}`,
      payload: {
        type: body.type,
        event: body.event,
        teamId: body.team_id,
        apiAppId: body.api_app_id,
        challenge: body.challenge,
      },
      rawBody: body,
      receivedAt: new Date(),
    }
  }
}
