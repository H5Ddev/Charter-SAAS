import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { createHash, randomInt } from 'crypto'
import { z } from 'zod'
import { env } from '../../config/env'
import { AppError } from '../../shared/middleware/errorHandler'
import { smsSender } from '../notifications/channels/sms.sender'
import { emailSender } from '../notifications/channels/email.sender'

// Two derived secrets — neither can be confused with access/refresh tokens
const PORTAL_SECRET = env.JWT_REFRESH_SECRET + '_portal'
const PORTAL_OTP_SECRET = env.JWT_REFRESH_SECRET + '_portal_otp'
const PORTAL_SESSION_SECRET = env.JWT_REFRESH_SECRET + '_portal_session'

// ─── Portal link token (URL entry key, 365 days) ─────────────────────────────

export interface PortalTokenPayload {
  contactId: string
  tenantId: string
  type: 'portal'
}

export function generatePortalToken(contactId: string, tenantId: string): string {
  return jwt.sign(
    { contactId, tenantId, type: 'portal' } satisfies PortalTokenPayload,
    PORTAL_SECRET,
    { expiresIn: '365d' },
  )
}

export function verifyPortalToken(token: string): PortalTokenPayload {
  try {
    const payload = jwt.verify(token, PORTAL_SECRET) as PortalTokenPayload
    if (payload.type !== 'portal') {
      throw new AppError(401, 'INVALID_PORTAL_TOKEN', 'Invalid portal token')
    }
    return payload
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError(401, 'INVALID_PORTAL_TOKEN', 'This portal link is invalid or has expired')
  }
}

// ─── OTP challenge (stateless — hash embedded in JWT, 10 min) ────────────────

interface OtpChallengePayload {
  contactId: string
  tenantId: string
  otpHash: string   // sha256 of the code — never the code itself
  type: 'portal-otp'
}

function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export function generateOtp(): string {
  return String(randomInt(100000, 999999)) // 6-digit code
}

export function generateOtpChallenge(contactId: string, tenantId: string, code: string): string {
  return jwt.sign(
    { contactId, tenantId, otpHash: hashOtp(code), type: 'portal-otp' } satisfies OtpChallengePayload,
    PORTAL_OTP_SECRET,
    { expiresIn: '10m' },
  )
}

/**
 * Verifies an OTP challenge + user-entered code.
 * Returns the contactId/tenantId if valid.
 * Throws 401 on any mismatch or expiry.
 */
export function verifyOtpChallenge(
  challengeToken: string,
  enteredCode: string,
  expectedContactId: string,
  expectedTenantId: string,
): void {
  let payload: OtpChallengePayload
  try {
    payload = jwt.verify(challengeToken, PORTAL_OTP_SECRET) as OtpChallengePayload
  } catch {
    throw new AppError(401, 'OTP_EXPIRED', 'Verification code has expired. Please request a new one.')
  }

  if (payload.type !== 'portal-otp') {
    throw new AppError(401, 'INVALID_OTP', 'Invalid verification token')
  }
  if (payload.contactId !== expectedContactId || payload.tenantId !== expectedTenantId) {
    throw new AppError(401, 'OTP_MISMATCH', 'Verification token does not match this portal')
  }
  if (payload.otpHash !== hashOtp(enteredCode)) {
    throw new AppError(401, 'OTP_INVALID', 'Incorrect verification code')
  }
}

// ─── Portal session (30 min, passed as X-Portal-Session header) ───────────────

export interface PortalSessionPayload {
  contactId: string
  tenantId: string
  type: 'portal-session'
}

export function generatePortalSession(contactId: string, tenantId: string): string {
  return jwt.sign(
    { contactId, tenantId, type: 'portal-session' } satisfies PortalSessionPayload,
    PORTAL_SESSION_SECRET,
    { expiresIn: '30m' },
  )
}

export function verifyPortalSession(token: string): PortalSessionPayload {
  try {
    const payload = jwt.verify(token, PORTAL_SESSION_SECRET) as PortalSessionPayload
    if (payload.type !== 'portal-session') {
      throw new AppError(401, 'INVALID_SESSION', 'Invalid portal session')
    }
    return payload
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError(401, 'SESSION_EXPIRED', 'Your verification session has expired. Please verify again.')
  }
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

export const RespondToQuoteSchema = z.object({
  response: z.enum(['ACCEPTED', 'DECLINED']),
  notes: z.string().optional(),
})

export const PortalRequestSchema = z.object({
  requestType: z.enum(['NEW_QUOTE', 'TRIP_CHANGE', 'GENERAL']).default('GENERAL'),
  title: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
})

// ─── Service ──────────────────────────────────────────────────────────────────

export class PortalService {
  constructor(private prisma: PrismaClient) {}

  async getContact(contactId: string, tenantId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    })
    if (!contact) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found')
    return contact
  }

  async getTenant(tenantId: string) {
    return this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { id: true, name: true },
    })
  }

  /**
   * Sends a 6-digit OTP to the contact via SMS (preferred) or email.
   * Returns a signed OTP challenge token for the client to hold.
   */
  async sendOtp(contactId: string, tenantId: string): Promise<string> {
    const contact = await this.getContact(contactId, tenantId)

    if (!contact.phone && !contact.email) {
      throw new AppError(
        400,
        'NO_CONTACT_METHOD',
        'No phone or email on file. Contact your charter operator to update your details.',
      )
    }

    const code = generateOtp()
    const challengeToken = generateOtpChallenge(contactId, tenantId, code)
    const message = `Your AeroComm verification code is: ${code}. It expires in 10 minutes. Do not share this code.`

    // Prefer SMS; fall back to email
    if (contact.phone) {
      await smsSender.send(contact.phone, message, tenantId)
    } else {
      await emailSender.send(
        contact.email!,
        'Your AeroComm verification code',
        message,
      )
    }

    // Return which method was used (for the UI hint) alongside the challenge
    return challengeToken
  }

  /**
   * Returns a masked hint showing where the OTP was sent, without exposing the full value.
   */
  async getOtpDeliveryHint(contactId: string, tenantId: string): Promise<{ method: 'sms' | 'email'; hint: string }> {
    const contact = await this.getContact(contactId, tenantId)

    if (contact.phone) {
      // Mask: +1 (***) ***-1234
      const last4 = contact.phone.slice(-4)
      return { method: 'sms', hint: `•••• •••• ${last4}` }
    }
    if (contact.email) {
      // Mask: j***@example.com
      const [local, domain] = contact.email.split('@')
      const maskedLocal = local[0] + '•'.repeat(Math.min(local.length - 1, 4))
      return { method: 'email', hint: `${maskedLocal}@${domain}` }
    }
    throw new AppError(400, 'NO_CONTACT_METHOD', 'No phone or email on file.')
  }

  async getQuotes(contactId: string, tenantId: string) {
    return this.prisma.quote.findMany({
      where: { contactId, tenantId, deletedAt: null },
      include: {
        lineItems: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getQuoteById(quoteId: string, contactId: string, tenantId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, contactId, tenantId, deletedAt: null },
      include: {
        lineItems: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      },
    })
    if (!quote) throw new AppError(404, 'QUOTE_NOT_FOUND', 'Quote not found')
    return quote
  }

  async respondToQuote(
    quoteId: string,
    contactId: string,
    tenantId: string,
    response: 'ACCEPTED' | 'DECLINED',
    notes?: string,
  ) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, contactId, tenantId, deletedAt: null },
    })
    if (!quote) throw new AppError(404, 'QUOTE_NOT_FOUND', 'Quote not found')
    if (quote.status !== 'SENT' && quote.status !== 'VIEWED') {
      throw new AppError(400, 'INVALID_STATUS', 'This quote can no longer be responded to')
    }

    const appendedNotes = notes
      ? (quote.notes ? `${quote.notes}\n\nClient note: ${notes}` : `Client note: ${notes}`)
      : quote.notes

    return this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: response, notes: appendedNotes },
    })
  }

  async getTrips(contactId: string, tenantId: string) {
    return this.prisma.trip.findMany({
      where: {
        tenantId,
        deletedAt: null,
        passengers: { some: { contactId } },
      },
      include: {
        aircraft: { select: { id: true, tailNumber: true, make: true, model: true } },
      },
      orderBy: { departureAt: 'asc' },
    })
  }

  async createRequest(
    contactId: string,
    tenantId: string,
    data: { requestType: string; title: string; message: string },
  ) {
    return this.prisma.ticket.create({
      data: {
        tenantId,
        contactId,
        source: 'WEB',
        status: 'OPEN',
        priority: 'NORMAL',
        title: `[${data.requestType.replace('_', ' ')}] ${data.title}`,
        body: data.message,
      },
    })
  }
}
