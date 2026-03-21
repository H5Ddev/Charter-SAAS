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

interface StripeConfig {
  secretKey: string
  webhookSecret: string
}

// Minimal Stripe types to avoid requiring the SDK in type defs
interface StripeEvent {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
  created: number
}

function mapStripeEventType(stripeType: string): string {
  const map: Record<string, string> = {
    'payment_intent.succeeded': 'PAYMENT_STATUS_CHANGED',
    'payment_intent.payment_failed': 'PAYMENT_STATUS_CHANGED',
    'payment_intent.canceled': 'PAYMENT_STATUS_CHANGED',
    'invoice.paid': 'PAYMENT_STATUS_CHANGED',
    'invoice.payment_failed': 'PAYMENT_STATUS_CHANGED',
    'checkout.session.completed': 'PAYMENT_STATUS_CHANGED',
  }
  return map[stripeType] ?? `STRIPE_${stripeType.toUpperCase().replace(/\./g, '_')}`
}

export class StripeIntegration implements Integration {
  name = 'stripe'
  private config: StripeConfig | null = null
  private status: IntegrationStatus = 'unconfigured'

  async connect(config: Record<string, string>): Promise<void> {
    this.config = {
      secretKey: config.secretKey,
      webhookSecret: config.webhookSecret,
    }
    this.status = 'connected'
    logger.info('Stripe integration connected')
  }

  async disconnect(): Promise<void> {
    this.config = null
    this.status = 'disconnected'
  }

  getStatus(): IntegrationStatus {
    return this.status
  }

  /**
   * TODO STUB: Create a Stripe payment session.
   * Requires stripe npm package and full checkout session implementation.
   */
  async sendMessage(_payload: MessagePayload): Promise<MessageResult> {
    throw new Error(
      'Stripe payment session creation not yet implemented. ' +
      'TODO: Install stripe package, implement checkout session creation.',
    )
  }

  /**
   * Verify Stripe webhook signature using Stripe-Signature header.
   * Uses timestamp-based HMAC verification to prevent replay attacks.
   */
  verifySignature(req: Request): boolean {
    if (!this.config) return false

    const stripeSignature = req.headers['stripe-signature'] as string | undefined
    if (!stripeSignature) {
      logger.warn('Stripe: Missing Stripe-Signature header')
      return false
    }

    try {
      const rawBody = typeof req.body === 'string'
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : JSON.stringify(req.body)

      // Parse Stripe signature header: t=timestamp,v1=hash
      const elements = stripeSignature.split(',')
      const timestamp = elements
        .find((e) => e.startsWith('t='))
        ?.substring(2)
      const signatures = elements
        .filter((e) => e.startsWith('v1='))
        .map((e) => e.substring(3))

      if (!timestamp || signatures.length === 0) return false

      // Check timestamp is within 5 minutes
      const now = Math.floor(Date.now() / 1000)
      if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
        logger.warn('Stripe signature timestamp too old (possible replay attack)')
        return false
      }

      const signedPayload = `${timestamp}.${rawBody}`
      const expectedSig = require('crypto')
        .createHmac('sha256', this.config.webhookSecret)
        .update(signedPayload, 'utf8')
        .digest('hex')

      return signatures.some((sig) => {
        try {
          return require('crypto').timingSafeEqual(
            Buffer.from(sig, 'hex'),
            Buffer.from(expectedSig, 'hex'),
          )
        } catch {
          return false
        }
      })
    } catch (err) {
      logger.error('Stripe signature verification error', { error: err })
      return false
    }
  }

  /**
   * Parse Stripe webhook event and normalise to internal WebhookEvent.
   */
  async receiveWebhook(req: Request): Promise<WebhookEvent> {
    const stripeEvent = req.body as StripeEvent
    const eventType = mapStripeEventType(stripeEvent.type)
    const obj = stripeEvent.data.object

    return {
      eventId: uuidv4(),
      eventType,
      payload: {
        stripeEventId: stripeEvent.id,
        stripeEventType: stripeEvent.type,
        status: (obj['status'] as string) ?? 'unknown',
        amount: (obj['amount'] as number) ?? (obj['amount_paid'] as number) ?? 0,
        currency: (obj['currency'] as string) ?? 'usd',
        customerId: obj['customer'] as string | undefined,
        paymentIntentId: stripeEvent.type.startsWith('payment_intent')
          ? (obj['id'] as string)
          : (obj['payment_intent'] as string | undefined),
        object: obj,
      },
      rawBody: req.body,
      receivedAt: new Date(),
    }
  }
}
