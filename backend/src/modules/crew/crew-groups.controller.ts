import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { CrewGroupsService, CreateCrewGroupSchema, UpdateCrewGroupSchema } from './crew-groups.service'
import { successResponse } from '../../shared/utils/response'

const prisma = new PrismaClient()
const service = new CrewGroupsService(prisma)

export class CrewGroupsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const groups = await service.list(req.tenantId!)
      res.json(successResponse(groups))
    } catch (err) { next(err) }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await service.findById(req.tenantId!, req.params.id!)
      res.json(successResponse(group))
    } catch (err) { next(err) }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = CreateCrewGroupSchema.parse(req.body)
      const group = await service.create(req.tenantId!, data)
      res.status(201).json(successResponse(group))
    } catch (err) { next(err) }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = UpdateCrewGroupSchema.parse(req.body)
      const group = await service.update(req.tenantId!, req.params.id!, data)
      res.json(successResponse(group))
    } catch (err) { next(err) }
  }

  async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.softDelete(req.tenantId!, req.params.id!)
      res.status(204).send()
    } catch (err) { next(err) }
  }

  async setMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { crewMemberIds } = req.body as { crewMemberIds: string[] }
      const group = await service.setMembers(req.tenantId!, req.params.id!, crewMemberIds ?? [])
      res.json(successResponse(group))
    } catch (err) { next(err) }
  }

  async assignToTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tripId } = req.body as { tripId: string }
      const group = await service.assignGroupToTrip(req.tenantId!, req.params.id!, tripId)
      res.json(successResponse(group))
    } catch (err) { next(err) }
  }
}
