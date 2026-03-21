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

interface DocuSignConfig {
  hmacKey: string
  accountId: string
  integrationKey: string
}

interface DocuSignEnvelopePayload {
  envelopeId: string
  status: string
  emailSubject: string
  created?: string
  sent?: string
  delivered?: string
  signed?: string
  completed?: string
  declined?: string
  recipients?: {
    signers?: Array<{
      name: string
      email: string
      status: string
      signedDateTime?: string
    }>
  }
}

function mapDocuSignStatus(status: string): string {
  const map: Record<string, string> = {
    completed: 'SIGNATURE_COMPLETED',
    declined: 'SIGNATURE_DECLINED',
    voided: 'SIGNATURE_VOIDED',
    sent: 'SIGNATURE_SENT',
    delivered: 'SIGNATURE_DELIVERED',
    signed: 'SIGNATURE_SIGNED',
  }
  return map[status.toLowerCase()] ?? `DOCUSIGN_${status.toUpperCase()}`
}

export class DocuSignIntegration implements Integration {
  name = 'docusign'
  private config: DocuSignConfig | null = null
  private status: IntegrationStatus = 'unconfigured'

  async connect(config: Record<string, string>): Promise<void> {
    this.config = {
      hmacKey: config.hmacKey,
      accountId: config.accountId,
      integrationKey: config.integrationKey,
    }
    this.status = 'connected'
    logger.info('DocuSign integration connected')
  }

  async disconnect(): Promise<void> {
    this.config = null
    this.status = 'disconnected'
  }

  getStatus(): IntegrationStatus {
    return this.status
  }

  /**
   * TODO STUB: Create a DocuSign signing ceremony.
   * Requires DocuSign eSignature REST API v2.1 implementation.
   * See: https://developers.docusign.com/docs/esign-rest-api/
   */
  async sendMessage(_payload: MessagePayload): Promise<MessageResult> {
    throw new Error(
      'DocuSign outbound signing ceremony not yet implemented. ' +
      'TODO: Implement using DocuSign eSignature REST API v2.1. ' +
      'Requires: integrationKey, accountId, private key for JWT authentication.',
    )
  }

  /**
   * Verify DocuSign webhook signature using HMAC.
   * DocuSign sends X-DocuSign-Signature-1 header with HMAC-SHA256.
   */
  verifySignature(req: Request): boolean {
    if (!this.config) return false

    const signature = req.headers['x-docusign-signature-1'] as string | undefined
    if (!signature) {
      logger.warn('DocuSign: Missing X-DocuSign-Signature-1 header')
      return false
    }

    try {
      const rawBody = typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body)

      const hmac = crypto
        .createHmac('sha256', this.config.hmacKey)
        .update(rawBody, 'utf8')
        .digest('base64')

      const isValid = crypto.timingSafeEqual(
        Buffer.from(hmac),
        Buffer.from(signature),
      )

      if (!isValid) {
        logger.warn('DocuSign signature verification failed')
      }

      return isValid
    } catch (err) {
      logger.error('DocuSign signature verification error', { error: err })
      return false
    }
  }

  /**
   * Parse DocuSign Connect webhook event.
   * Normalises envelope status change events to internal WebhookEvent format.
   */
  async receiveWebhook(req: Request): Promise<WebhookEvent> {
    const body = req.body as { envelopeSummary?: DocuSignEnvelopePayload } | DocuSignEnvelopePayload

    const envelope = 'envelopeSummary' in body && body.envelopeSummary
      ? body.envelopeSummary
      : body as DocuSignEnvelopePayload

    const eventType = mapDocuSignStatus(envelope.status ?? 'unknown')

    return {
      eventId: uuidv4(),
      eventType,
      payload: {
        envelopeId: envelope.envelopeId,
        status: envelope.status,
        emailSubject: envelope.emailSubject,
        completedAt: envelope.completed,
        declinedAt: envelope.declined,
        signers: envelope.recipients?.signers?.map((s) => ({
          name: s.name,
          email: s.email,
          status: s.status,
          signedAt: s.signedDateTime,
        })),
      },
      rawBody: req.body,
      receivedAt: new Date(),
    }
  }
}
