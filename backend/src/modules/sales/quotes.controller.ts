import { Request, Response, NextFunction } from 'express'
import { PrismaClient, QuoteStatus } from '@prisma/client'
import {
  QuotesService,
  CreateQuoteSchema,
  UpdateQuoteSchema,
  AddLineItemSchema,
} from './quotes.service'
import { successResponse } from '../../shared/utils/response'

const prisma = new PrismaClient()
const service = new QuotesService(prisma)

export class QuotesController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Number(req.query['page']) || 1
      const pageSize = Number(req.query['pageSize']) || 20
      const status = req.query['status'] as QuoteStatus | undefined
      const result = await service.list(req.tenantId!, page, pageSize, status)
      res.json(successResponse(result.quotes, result.meta as Record<string, unknown>))
    } catch (err) { next(err) }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quote = await service.findById(req.tenantId!, req.params.id!)
      res.json(successResponse(quote))
    } catch (err) { next(err) }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = CreateQuoteSchema.parse(req.body)
      const quote = await service.create(req.tenantId!, req.user!.id, data)
      res.status(201).json(successResponse(quote))
    } catch (err) { next(err) }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = UpdateQuoteSchema.parse(req.body)
      const quote = await service.update(req.tenantId!, req.params.id!, req.user!.id, data)
      res.json(successResponse(quote))
    } catch (err) { next(err) }
  }

  async addLineItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = AddLineItemSchema.parse(req.body)
      const lineItem = await service.addLineItem(req.tenantId!, req.params.id!, data)
      res.status(201).json(successResponse(lineItem))
    } catch (err) { next(err) }
  }

  async recordSignature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { signatureUrl } = req.body as { signatureUrl: string }
      const quote = await service.recordSignature(req.tenantId!, req.params.id!, signatureUrl)
      res.json(successResponse(quote))
    } catch (err) { next(err) }
  }

  async convertToTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trip = await service.convertToTrip(req.tenantId!, req.params.id!, req.user!.id)
      res.status(201).json(successResponse(trip))
    } catch (err) { next(err) }
  }
}
