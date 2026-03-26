import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { env } from '../../config/env'
import { smsSender } from '../notifications/channels/sms.sender'
import { successResponse } from '../../shared/utils/response'
import { requireAuth } from '../../shared/middleware/auth'
import { AppError } from '../../shared/middleware/errorHandler'

export const integrationsRouter: Router = Router()
integrationsRouter.use(requireAuth)

/**
 * GET /api/integrations/status
 * Returns which integrations are configured (no secrets exposed).
 */
integrationsRouter.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const webhookBase = env.API_BASE_URL

    res.json(successResponse({
      twilio: {
        configured: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER),
        phoneNumber: env.TWILIO_PHONE_NUMBER ?? null,
        whatsappFrom: env.TWILIO_WHATSAPP_FROM ?? null,
        inboundWebhookUrl: `${webhookBase}/api/webhooks/twilio/inbound-sms`,
      },
      sendgrid: {
        configured: !!(env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL),
        fromEmail: env.SENDGRID_FROM_EMAIL ?? null,
        fromName: env.SENDGRID_FROM_NAME,
      },
    }))
  } catch (err) { next(err) }
})

/**
 * POST /api/integrations/twilio/test
 * Sends a test SMS to a given phone number.
 */
const TestSmsSchema = z.object({
  to: z.string().min(10, 'Phone number is required'),
})

integrationsRouter.post('/twilio/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
      throw new AppError(400, 'TWILIO_NOT_CONFIGURED', 'Twilio credentials are not set. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to the environment.')
    }

    const { to } = TestSmsSchema.parse(req.body)
    await smsSender.send(to, 'AeroComm: Twilio integration test successful ✓', req.user!.tenantId)

    res.json(successResponse({ sent: true, to }))
  } catch (err) {
    if (err instanceof AppError) return next(err)
    // Surface Twilio API errors with their actual message instead of the generic 500
    const twilioErr = err as { message?: string; status?: number; code?: number }
    const message = twilioErr.message ?? 'Failed to send SMS'
    const hint = twilioErr.code ? ` (Twilio code ${twilioErr.code})` : ''
    next(new AppError(twilioErr.status ?? 400, 'TWILIO_ERROR', message + hint))
  }
})
