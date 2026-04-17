import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { env } from '../../config/env'
import { smsSender } from '../notifications/channels/sms.sender'
import { successResponse } from '../../shared/utils/response'
import { requireAuth } from '../../shared/middleware/auth'
import { AppError } from '../../shared/middleware/errorHandler'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const integrationsRouter: Router = Router()
integrationsRouter.use(requireAuth)

/**
 * GET /api/integrations/status
 * Returns which integrations are configured (no secrets exposed).
 */
integrationsRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhookBase = env.API_BASE_URL
    const tenantId = req.user!.tenantId

    res.json(successResponse({
      twilio: {
        configured: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER),
        phoneNumber: env.TWILIO_PHONE_NUMBER ?? null,
        whatsappFrom: env.TWILIO_WHATSAPP_FROM ?? null,
        inboundWebhookUrl: `${webhookBase}/api/webhooks/${tenantId}/twilio/inbound-sms`,
        statusCallbackUrl: `${webhookBase}/api/webhooks/${tenantId}/twilio/status`,
      },
      sendgrid: {
        configured: !!(env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL),
        fromEmail: env.SENDGRID_FROM_EMAIL ?? null,
        fromName: env.SENDGRID_FROM_NAME,
      },
      airlabs: {
        configured: !!env.AIRLABS_API_KEY,
      },
    }))
  } catch (err) { next(err) }
})

/**
 * GET /api/integrations/airlabs/live
 * Returns live ADS-B positions for tenant aircraft that are currently airborne.
 * Queries AirLabs by tail number (reg parameter).
 * Results are keyed by tail number, containing position + flight data.
 */
integrationsRouter.get('/airlabs/live', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId

    // Fetch all active tenant aircraft tail numbers
    const aircraft = await prisma.aircraft.findMany({
      where: { tenantId, deletedAt: null, isActive: true },
      select: { id: true, tailNumber: true, make: true, model: true },
    })

    // Demo mode: no API key → return mock live flights so the tracker is visible
    if (!env.AIRLABS_API_KEY) {
      const demoAircraft = aircraft.length > 0 ? aircraft : [
        { id: 'demo-1', tailNumber: 'N123AB', make: 'Bombardier', model: 'Challenger 350' },
        { id: 'demo-2', tailNumber: 'N456CD', make: 'Gulfstream', model: 'G550' },
      ]
      const now = Date.now()
      // Flight 1: KLAS → KLAX, 2.5 hr flight, 40% complete
      const dep1 = new Date(now - 60 * 60 * 1000)         // departed 1 hr ago
      const arr1 = new Date(now + 90 * 60 * 1000)         // arrives in 1.5 hr
      // Flight 2: KMIA → KTEB, 3 hr flight, 60% complete
      const dep2 = new Date(now - 108 * 60 * 1000)        // departed 1h48 ago
      const arr2 = new Date(now + 72 * 60 * 1000)         // arrives in 1h12
      const demos = [
        { aircraftId: demoAircraft[0].id, tailNumber: demoAircraft[0].tailNumber, make: demoAircraft[0].make, model: demoAircraft[0].model, flightIcao: 'AEX1', depIcao: 'KLAS', arrIcao: 'KLAX', lat: 35.9, lng: -115.2, altFt: 41000, heading: 270, speedKts: 480, status: 'en-route', updatedAt: new Date().toISOString(), departureAt: dep1.toISOString(), arrivalAt: arr1.toISOString() },
        ...(demoAircraft.length > 1 ? [{ aircraftId: demoAircraft[1].id, tailNumber: demoAircraft[1].tailNumber, make: demoAircraft[1].make, model: demoAircraft[1].model, flightIcao: 'AEX2', depIcao: 'KMIA', arrIcao: 'KTEB', lat: 32.1, lng: -81.4, altFt: 45000, heading: 15, speedKts: 510, status: 'en-route', updatedAt: new Date().toISOString(), departureAt: dep2.toISOString(), arrivalAt: arr2.toISOString() }] : []),
      ]
      return res.json(successResponse(demos))
    }

    if (aircraft.length === 0) {
      return res.json(successResponse([]))
    }

    // Query AirLabs flights endpoint — one call returns all airborne flights,
    // we filter by our tail numbers client-side to avoid N+1 API calls.
    // AirLabs free tier: use reg_number filter to limit response size.
    const tailNumbers = aircraft.map((a) => a.tailNumber.replace(/^N/, 'N').toUpperCase())

    const url = new URL(`${env.AIRLABS_BASE_URL}/flights`)
    url.searchParams.set('api_key', env.AIRLABS_API_KEY)
    // Filter by registration prefix if all share one (best-effort size reduction)
    // Full filter not available on free tier; we post-filter below.

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      throw new AppError(502, 'AIRLABS_ERROR', `AirLabs returned ${response.status}`)
    }

    interface AirlabsFlight {
      reg_number?: string
      hex?: string
      flight_icao?: string
      flight_iata?: string
      dep_icao?: string
      arr_icao?: string
      lat?: number
      lng?: number
      alt?: number
      dir?: number
      speed?: number
      status?: string
      updated?: number
    }

    const data = await response.json() as { response?: AirlabsFlight[]; error?: { message: string } }

    if (data.error) {
      throw new AppError(502, 'AIRLABS_ERROR', data.error.message)
    }

    const flights = data.response ?? []

    // Build tail → aircraft map for fast lookup
    const tailMap = new Map(aircraft.map((a) => [a.tailNumber.toUpperCase(), a]))
    const aircraftIds = aircraft.map((a) => a.id)

    // Cross-reference active trips to get departure/arrival times
    const activeTrips = await prisma.trip.findMany({
      where: {
        tenantId,
        aircraftId: { in: aircraftIds },
        status: { in: ['IN_FLIGHT', 'BOARDING'] },
        deletedAt: null,
      },
      select: { aircraftId: true, departureAt: true, arrivalAt: true },
    })
    const tripByAircraftId = new Map(activeTrips.map((t) => [t.aircraftId!, t]))

    const live = flights
      .filter((f) => f.reg_number && tailMap.has(f.reg_number.toUpperCase()))
      .map((f) => {
        const ac = tailMap.get(f.reg_number!.toUpperCase())!
        const trip = tripByAircraftId.get(ac.id)
        return {
          aircraftId: ac.id,
          tailNumber: ac.tailNumber,
          make: ac.make,
          model: ac.model,
          flightIcao: f.flight_icao ?? null,
          depIcao: f.dep_icao ?? null,
          arrIcao: f.arr_icao ?? null,
          lat: f.lat ?? null,
          lng: f.lng ?? null,
          altFt: f.alt ?? null,
          heading: f.dir ?? null,
          speedKts: f.speed ?? null,
          status: f.status ?? null,
          updatedAt: f.updated ? new Date(f.updated * 1000).toISOString() : null,
          departureAt: trip?.departureAt?.toISOString() ?? null,
          arrivalAt: trip?.arrivalAt?.toISOString() ?? null,
        }
      })

    res.json(successResponse(live))
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
