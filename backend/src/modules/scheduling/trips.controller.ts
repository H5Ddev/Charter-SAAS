import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { TripStatus } from '../../shared/types/appEnums'
import {
  TripsService,
  CreateTripSchema,
  UpdateTripSchema,
  UpdateTripStatusSchema,
  FlagDelaySchema,
} from './trips.service'
import { successResponse } from '../../shared/utils/response'

const prisma = new PrismaClient()
const service = new TripsService(prisma)

export class TripsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query['status'] as TripStatus | undefined
      const page = Number(req.query['page']) || 1
      const pageSize = Number(req.query['pageSize']) || 20
      const result = await service.list(req.tenantId!, { status, page, pageSize })
      res.json(successResponse(result.trips, result.meta as Record<string, unknown>))
    } catch (err) { next(err) }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trip = await service.findById(req.tenantId!, req.params.id!)
      res.json(successResponse(trip))
    } catch (err) { next(err) }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = CreateTripSchema.parse(req.body)
      const trip = await service.create(req.tenantId!, req.user!.id, data)
      res.status(201).json(successResponse(trip))
    } catch (err) { next(err) }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = UpdateTripSchema.parse(req.body)
      const trip = await service.update(req.tenantId!, req.params.id!, data)
      res.json(successResponse(trip))
    } catch (err) { next(err) }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = UpdateTripStatusSchema.parse(req.body)
      const trip = await service.updateStatus(req.tenantId!, req.params.id!, req.user!.id, data)
      res.json(successResponse(trip))
    } catch (err) { next(err) }
  }

  async flagDelay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = FlagDelaySchema.parse(req.body)
      const trip = await service.flagDelay(req.tenantId!, req.params.id!, req.user!.id, data)
      res.json(successResponse(trip))
    } catch (err) { next(err) }
  }

  async addPassenger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contactId, isPrimary } = req.body as { contactId: string; isPrimary?: boolean }
      const result = await service.addPassenger(req.tenantId!, req.params.id!, contactId, isPrimary)
      res.status(201).json(successResponse(result))
    } catch (err) { next(err) }
  }

  async removePassenger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.removePassenger(req.tenantId!, req.params.id!, req.params.passengerId!)
      res.status(204).send()
    } catch (err) { next(err) }
  }

  async getPaxManifest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const manifest = await service.getPaxManifest(req.tenantId!, req.params.id!)
      res.json(successResponse(manifest))
    } catch (err) { next(err) }
  }
}
