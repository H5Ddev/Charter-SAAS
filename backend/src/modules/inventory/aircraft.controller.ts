import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import {
  AircraftService,
  CreateAircraftSchema,
  UpdateAircraftSchema,
  AddAvailabilitySchema,
} from './aircraft.service'
import { successResponse } from '../../shared/utils/response'

const prisma = new PrismaClient()
const service = new AircraftService(prisma)

export class AircraftController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Number(req.query['page']) || 1
      const pageSize = Number(req.query['pageSize']) || 20
      const isActive = req.query['isActive'] !== undefined
        ? req.query['isActive'] === 'true'
        : undefined
      const result = await service.list(req.tenantId!, page, pageSize, isActive)
      res.json(successResponse(result.aircraft, result.meta as Record<string, unknown>))
    } catch (err) { next(err) }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const aircraft = await service.findById(req.tenantId!, req.params.id!)
      res.json(successResponse(aircraft))
    } catch (err) { next(err) }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = CreateAircraftSchema.parse(req.body)
      const aircraft = await service.create(req.tenantId!, data)
      res.status(201).json(successResponse(aircraft))
    } catch (err) { next(err) }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = UpdateAircraftSchema.parse(req.body)
      const aircraft = await service.update(req.tenantId!, req.params.id!, data)
      res.json(successResponse(aircraft))
    } catch (err) { next(err) }
  }

  async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.softDelete(req.tenantId!, req.params.id!)
      res.json(successResponse({ deleted: true }))
    } catch (err) { next(err) }
  }

  async addAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = AddAvailabilitySchema.parse(req.body)
      const availability = await service.addAvailability(req.tenantId!, req.params.id!, data)
      res.status(201).json(successResponse(availability))
    } catch (err) { next(err) }
  }

  async checkAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startAt, endAt } = req.query as { startAt: string; endAt: string }
      const isAvailable = await service.checkAvailability(
        req.tenantId!,
        req.params.id!,
        new Date(startAt),
        new Date(endAt),
      )
      res.json(successResponse({ available: isAvailable }))
    } catch (err) { next(err) }
  }
}
