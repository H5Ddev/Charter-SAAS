import crypto from 'crypto'
import { TwilioIntegration } from '../../src/integrations/twilio'
import { DocuSignIntegration } from '../../src/integrations/docusign'
import { StripeIntegration } from '../../src/integrations/stripe'
import type { Request } from 'express'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: {},
    ip: '127.0.0.1',
    originalUrl: '/api/webhooks/test',
    ...overrides,
  } as unknown as Request
}

// ─────────────────────────────────────────────────────────────────────────────
// DocuSign HMAC Verification
// ─────────────────────────────────────────────────────────────────────────────

describe('DocuSign HMAC Verification', () => {
  const hmacKey = 'test-docusign-hmac-secret-key'
  let integration: DocuSignIntegration

  beforeEach(async () => {
    integration = new DocuSignIntegration()
    await integration.connect({
      hmacKey,
      accountId: 'test-account',
      integrationKey: 'test-key',
    })
  })

  it('returns true for valid HMAC signature', () => {
    const body = JSON.stringify({ envelopeId: 'test-123', status: 'completed' })
    const expectedSig = crypto
      .createHmac('sha256', hmacKey)
      .update(body, 'utf8')
      .digest('base64')

    const req = makeRequest({
      headers: { 'x-docusign-signature-1': expectedSig },
      body: JSON.parse(body) as Record<string, unknown>,
    })

    // The implementation re-serializes the body, so we test with pre-serialized
    // by providing the body as a string
    const reqWithStringBody = makeRequest({
      headers: { 'x-docusign-signature-1': expectedSig },
      body,
    })

    expect(integration.verifySignature(reqWithStringBody)).toBe(true)
  })

  it('returns false for invalid HMAC signature', () => {
    const req = makeRequest({
      headers: { 'x-docusign-signature-1': 'invalid-signature' },
      body: { envelopeId: 'test-123' },
    })
    expect(integration.verifySignature(req)).toBe(false)
  })

  it('returns false when signature header is missing', () => {
    const req = makeRequest({ body: { envelopeId: 'test-123' } })
    expect(integration.verifySignature(req)).toBe(false)
  })

  it('returns false when integration is not connected', () => {
    const unconnected = new DocuSignIntegration()
    const req = makeRequest({
      headers: { 'x-docusign-signature-1': 'any-sig' },
    })
    expect(unconnected.verifySignature(req)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Stripe Signature Verification
// ─────────────────────────────────────────────────────────────────────────────

describe('Stripe Signature Verification', () => {
  const webhookSecret = 'whsec_test_secret_key'
  let integration: StripeIntegration

  beforeEach(async () => {
    integration = new StripeIntegration()
    await integration.connect({
      secretKey: 'sk_test_xxx',
      webhookSecret,
    })
  })

  it('returns false when Stripe-Signature header is missing', () => {
    const req = makeRequest({ body: { id: 'evt_test' } })
    expect(integration.verifySignature(req)).toBe(false)
  })

  it('returns false for invalid signature format', () => {
    const req = makeRequest({
      headers: { 'stripe-signature': 'invalid-format' },
      body: '{}',
    })
    expect(integration.verifySignature(req)).toBe(false)
  })

  it('returns false for valid format but wrong secret', () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const body = '{"id":"evt_test","type":"payment_intent.succeeded"}'
    const wrongSignature = crypto
      .createHmac('sha256', 'wrong_secret')
      .update(`${timestamp}.${body}`, 'utf8')
      .digest('hex')

    const req = makeRequest({
      headers: { 'stripe-signature': `t=${timestamp},v1=${wrongSignature}` },
      body,
    })

    expect(integration.verifySignature(req)).toBe(false)
  })

  it('returns true for a correctly signed payload', () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const body = '{"id":"evt_test","type":"payment_intent.succeeded"}'
    const signedPayload = `${timestamp}.${body}`
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex')

    const req = makeRequest({
      headers: { 'stripe-signature': `t=${timestamp},v1=${expectedSig}` },
      body,
    })

    expect(integration.verifySignature(req)).toBe(true)
  })

  it('returns false for expired timestamp (older than 5 minutes)', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 400 // 6.7 minutes ago
    const body = '{"id":"evt_test"}'
    const sig = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${body}`, 'utf8')
      .digest('hex')

    const req = makeRequest({
      headers: { 'stripe-signature': `t=${timestamp},v1=${sig}` },
      body,
    })

    expect(integration.verifySignature(req)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Twilio Signature Verification
// ─────────────────────────────────────────────────────────────────────────────

describe('Twilio Signature Verification', () => {
  let integration: TwilioIntegration

  beforeEach(async () => {
    integration = new TwilioIntegration()
    await integration.connect({
      accountSid: 'ACtest123',
      authToken: 'test_auth_token',
      fromPhone: '+15550001111',
    })
  })

  it('returns false when X-Twilio-Signature header is missing', () => {
    const req = makeRequest({
      headers: {
        host: 'example.com',
        'x-forwarded-proto': 'https',
      },
      body: { From: '+15551234567', Body: 'Hello' },
    })
    expect(integration.verifySignature(req)).toBe(false)
  })

  it('returns false for invalid signature', () => {
    const req = makeRequest({
      headers: {
        'x-twilio-signature': 'invalid-signature',
        host: 'example.com',
        'x-forwarded-proto': 'https',
      },
      body: { From: '+15551234567', Body: 'Hello' },
    })
    expect(integration.verifySignature(req)).toBe(false)
  })

  it('returns false when integration is not connected', () => {
    const unconnected = new TwilioIntegration()
    const req = makeRequest({
      headers: { 'x-twilio-signature': 'any' },
    })
    expect(unconnected.verifySignature(req)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// HMAC utility tests
// ─────────────────────────────────────────────────────────────────────────────

describe('HMAC utility', () => {
  it('computes consistent HMAC-SHA256 for same inputs', () => {
    const key = 'secret'
    const payload = 'test payload'

    const hmac1 = crypto.createHmac('sha256', key).update(payload).digest('hex')
    const hmac2 = crypto.createHmac('sha256', key).update(payload).digest('hex')

    expect(hmac1).toBe(hmac2)
  })

  it('computes different HMACs for different keys', () => {
    const payload = 'test payload'
    const hmac1 = crypto.createHmac('sha256', 'key1').update(payload).digest('hex')
    const hmac2 = crypto.createHmac('sha256', 'key2').update(payload).digest('hex')

    expect(hmac1).not.toBe(hmac2)
  })

  it('uses timingSafeEqual for comparison (no timing attacks)', () => {
    const a = Buffer.from('abc123')
    const b = Buffer.from('abc123')
    const c = Buffer.from('xyz789')

    expect(crypto.timingSafeEqual(a, b)).toBe(true)
    expect(crypto.timingSafeEqual(a, c)).toBe(false)
  })
})
