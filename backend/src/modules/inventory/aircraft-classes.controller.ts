import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { AircraftClassesService, CreateAircraftClassSchema, UpdateAircraftClassSchema } from './aircraft-classes.service'
import { successResponse } from '../../shared/utils/response'

const prisma = new PrismaClient()
const service = new AircraftClassesService(prisma)

export class AircraftClassesController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const classes = await service.list(req.tenantId!)
      res.json(successResponse(classes))
    } catch (err) { next(err) }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cls = await service.findById(req.tenantId!, req.params.id!)
      res.json(successResponse(cls))
    } catch (err) { next(err) }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = CreateAircraftClassSchema.parse(req.body)
      const cls = await service.create(req.tenantId!, data)
      res.status(201).json(successResponse(cls))
    } catch (err) { next(err) }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = UpdateAircraftClassSchema.parse(req.body)
      const cls = await service.update(req.tenantId!, req.params.id!, data)
      res.json(successResponse(cls))
    } catch (err) { next(err) }
  }

  async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.softDelete(req.tenantId!, req.params.id!)
      res.status(204).send()
    } catch (err) { next(err) }
  }
}
