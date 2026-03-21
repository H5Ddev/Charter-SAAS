import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import {
  TicketsService,
  CreateTicketSchema,
  UpdateTicketSchema,
  AddMessageSchema,
  TicketFiltersSchema,
} from './tickets.service'
import { successResponse } from '../../shared/utils/response'

const prisma = new PrismaClient()
const service = new TicketsService(prisma)

export class TicketsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = TicketFiltersSchema.parse(req.query)
      const result = await service.list(req.tenantId!, filters)
      res.json(successResponse(result.tickets, result.meta as Record<string, unknown>))
    } catch (err) { next(err) }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticket = await service.findById(req.tenantId!, req.params.id!)
      res.json(successResponse(ticket))
    } catch (err) { next(err) }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = CreateTicketSchema.parse(req.body)
      const ticket = await service.create(req.tenantId!, data)
      res.status(201).json(successResponse(ticket))
    } catch (err) { next(err) }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = UpdateTicketSchema.parse(req.body)
      const ticket = await service.updateStatus(req.tenantId!, req.params.id!, req.user!.id, data)
      res.json(successResponse(ticket))
    } catch (err) { next(err) }
  }

  async addMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = AddMessageSchema.parse(req.body)
      const message = await service.addMessage(req.tenantId!, req.params.id!, req.user!.id, data)
      res.status(201).json(successResponse(message))
    } catch (err) { next(err) }
  }
}
