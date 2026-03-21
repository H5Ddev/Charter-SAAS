import type { Request } from 'express'

export interface MessagePayload {
  to: string
  subject?: string
  body: string
  templateId?: string
  templateData?: Record<string, unknown>
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType: string
  }>
}

export interface MessageResult {
  messageId: string
  status: 'sent' | 'queued' | 'failed'
  providerResponse?: unknown
}

export interface WebhookEvent {
  eventId: string
  eventType: string
  payload: Record<string, unknown>
  rawBody: unknown
  receivedAt: Date
}

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'unconfigured'

export interface Integration {
  name: string
  connect(config: Record<string, string>): Promise<void>
  disconnect(): Promise<void>
  sendMessage?(payload: MessagePayload): Promise<MessageResult>
  receiveWebhook(req: Request): Promise<WebhookEvent>
  verifySignature(req: Request): boolean
  getStatus(): IntegrationStatus
}
