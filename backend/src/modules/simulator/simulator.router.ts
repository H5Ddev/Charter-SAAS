import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../../shared/middleware/auth'
import { SimulatorService } from './simulator.service'
import { successResponse } from '../../shared/utils/response'
import { AppError } from '../../shared/middleware/errorHandler'

const prisma = new PrismaClient()
const simulator = new SimulatorService(prisma)

export const simulatorRouter: Router = Router()

// Admin-only — require ADMIN role
simulatorRouter.use(requireAuth)
simulatorRouter.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'Only admins can run simulations')
  }
  next()
})

/**
 * POST /api/admin/simulate
 *
 * Runs a simulation scenario against an ephemeral test tenant.
 * All notification senders are intercepted — nothing is actually delivered.
 * Returns a diagnostic JSON report.
 *
 * Body (optional):
 *   { "scenario": "trip-lifecycle" }   // default and currently only scenario
 */
simulatorRouter.post('/simulate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenario = (req.body?.scenario as string) ?? 'trip-lifecycle'

    if (scenario !== 'trip-lifecycle') {
      throw new AppError(400, 'UNKNOWN_SCENARIO', `Unknown simulation scenario: ${scenario}. Available: trip-lifecycle`)
    }

    const report = await simulator.runTripLifecycle()
    res.json(successResponse(report))
  } catch (err) {
    next(err)
  }
})
