import { Router, Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { PrismaClient } from '@prisma/client'
import {
  PortalService,
  verifyPortalToken,
  generatePortalToken,
  generatePortalSession,
  verifyPortalSession,
  verifyOtpChallenge,
  RespondToQuoteSchema,
  PortalRequestSchema,
} from './portal.service'
import { successResponse } from '../../shared/utils/response'
import { AppError } from '../../shared/middleware/errorHandler'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'
import { env } from '../../config/env'

const prisma = new PrismaClient()
const service = new PortalService(prisma)

export const portalRouter: import('express').Router = Router()

// ── Rate limiter: max 5 OTP send attempts per IP per 15 min ──────────────────

const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many verification attempts. Please wait 15 minutes.' } },
})

// ── Portal token middleware (URL entry key) ───────────────────────────────────

function portalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = req.params['token']
    if (!token) throw new AppError(401, 'UNAUTHORIZED', 'Portal token required')
    const payload = verifyPortalToken(token)
    req.portalContactId = payload.contactId
    req.portalTenantId = payload.tenantId
    next()
  } catch (err) {
    next(err)
  }
}

// ── Portal session middleware (required for state-changing actions) ───────────
// Reads session JWT from X-Portal-Session header.
// Must run after portalAuth so we can validate the session matches the portal identity.

function requirePortalSession(req: Request, res: Response, next: NextFunction): void {
  try {
    const sessionToken = req.headers['x-portal-session'] as string | undefined
    if (!sessionToken) {
      throw new AppError(401, 'VERIFICATION_REQUIRED', 'Identity verification required to perform this action')
    }
    const session = verifyPortalSession(sessionToken)
    if (session.contactId !== req.portalContactId || session.tenantId !== req.portalTenantId) {
      throw new AppError(401, 'SESSION_MISMATCH', 'Verification session does not match this portal')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// ── Admin: generate portal link for a contact ─────────────────────────────────
// POST /api/portal/link   body: { contactId }

portalRouter.post('/link', requireAuth, tenantScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contactId } = req.body as { contactId: string }
    if (!contactId) throw new AppError(400, 'MISSING_CONTACT', 'contactId is required')

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId: req.tenantId!, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    })
    if (!contact) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found')

    const token = generatePortalToken(contactId, req.tenantId!)
    const url = `${env.FRONTEND_URL}/portal/${token}`

    res.json(successResponse({ token, url, contact }))
  } catch (err) { next(err) }
})

// ── Public read-only portal routes (portal token only) ───────────────────────

// GET /api/portal/:token — verify + return contact + OTP delivery hint
portalRouter.get('/:token', portalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [contact, tenant, otpHint] = await Promise.all([
      service.getContact(req.portalContactId!, req.portalTenantId!),
      service.getTenant(req.portalTenantId!),
      service.getOtpDeliveryHint(req.portalContactId!, req.portalTenantId!),
    ])
    res.json(successResponse({ contact, tenant, otpHint }))
  } catch (err) { next(err) }
})

// GET /api/portal/:token/quotes
portalRouter.get('/:token/quotes', portalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quotes = await service.getQuotes(req.portalContactId!, req.portalTenantId!)
    res.json(successResponse(quotes))
  } catch (err) { next(err) }
})

// GET /api/portal/:token/quotes/:id
portalRouter.get('/:token/quotes/:id', portalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await service.getQuoteById(req.params['id']!, req.portalContactId!, req.portalTenantId!)
    res.json(successResponse(quote))
  } catch (err) { next(err) }
})

// GET /api/portal/:token/trips
portalRouter.get('/:token/trips', portalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trips = await service.getTrips(req.portalContactId!, req.portalTenantId!)
    res.json(successResponse(trips))
  } catch (err) { next(err) }
})

// ── OTP flow ──────────────────────────────────────────────────────────────────

// POST /api/portal/:token/otp/send — sends OTP, returns challengeToken
portalRouter.post('/:token/otp/send', otpRateLimiter, portalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const challengeToken = await service.sendOtp(req.portalContactId!, req.portalTenantId!)
    res.json(successResponse({ challengeToken }))
  } catch (err) { next(err) }
})

// POST /api/portal/:token/otp/verify — verifies code, returns sessionToken (30 min)
portalRouter.post('/:token/otp/verify', otpRateLimiter, portalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { challengeToken, code } = req.body as { challengeToken?: string; code?: string }
    if (!challengeToken || !code) {
      throw new AppError(400, 'MISSING_FIELDS', 'challengeToken and code are required')
    }
    verifyOtpChallenge(challengeToken, code, req.portalContactId!, req.portalTenantId!)
    const sessionToken = generatePortalSession(req.portalContactId!, req.portalTenantId!)
    res.json(successResponse({ sessionToken }))
  } catch (err) { next(err) }
})

// ── Protected routes (require portal token + verified session) ────────────────

// PATCH /api/portal/:token/quotes/:id/respond
portalRouter.patch(
  '/:token/quotes/:id/respond',
  portalAuth,
  requirePortalSession,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { response, notes } = RespondToQuoteSchema.parse(req.body)
      const quote = await service.respondToQuote(
        req.params['id']!,
        req.portalContactId!,
        req.portalTenantId!,
        response,
        notes,
      )
      res.json(successResponse(quote))
    } catch (err) { next(err) }
  },
)

// POST /api/portal/:token/requests
portalRouter.post(
  '/:token/requests',
  portalAuth,
  requirePortalSession,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = PortalRequestSchema.parse(req.body)
      const ticket = await service.createRequest(req.portalContactId!, req.portalTenantId!, data)
      res.status(201).json(successResponse(ticket))
    } catch (err) { next(err) }
  },
)
