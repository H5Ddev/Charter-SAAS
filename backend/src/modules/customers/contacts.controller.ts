import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { ContactsService } from './contacts.service'
import {
  CreateContactSchema,
  UpdateContactSchema,
  ContactFiltersSchema,
  AddNoteSchema,
  MergeContactsSchema,
} from './contacts.types'
import { successResponse } from '../../shared/utils/response'

const prisma = new PrismaClient()
const service = new ContactsService(prisma)

export class ContactsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = ContactFiltersSchema.parse(req.query)
      const result = await service.list(req.tenantId!, filters)
      res.json(successResponse(result.contacts, result.meta as Record<string, unknown>))
    } catch (err) {
      next(err)
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contact = await service.findById(req.tenantId!, req.params.id!)
      res.json(successResponse(contact))
    } catch (err) {
      next(err)
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = CreateContactSchema.parse(req.body)
      const contact = await service.create(req.tenantId!, req.user!.id, data)
      res.status(201).json(successResponse(contact))
    } catch (err) {
      next(err)
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = UpdateContactSchema.parse(req.body)
      const contact = await service.update(req.tenantId!, req.params.id!, req.user!.id, data)
      res.json(successResponse(contact))
    } catch (err) {
      next(err)
    }
  }

  async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.softDelete(req.tenantId!, req.params.id!)
      res.json(successResponse({ deleted: true }))
    } catch (err) {
      next(err)
    }
  }

  async addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = AddNoteSchema.parse(req.body)
      const note = await service.addNote(req.tenantId!, req.params.id!, req.user!.id, data)
      res.status(201).json(successResponse(note))
    } catch (err) {
      next(err)
    }
  }

  async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!(req as Request & { file?: unknown }).file) {
        res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } })
        return
      }
      const doc = await service.uploadDocument(
        req.tenantId!,
        req.params.id!,
        req.user!.id,
        (req as Request & { file?: unknown }).file as never,
      )
      res.status(201).json(successResponse(doc))
    } catch (err) {
      next(err)
    }
  }

  async merge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = MergeContactsSchema.parse(req.body)
      const contact = await service.merge(req.tenantId!, data.primaryId, data.duplicateId)
      res.json(successResponse(contact))
    } catch (err) {
      next(err)
    }
  }

  async detectDuplicates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, phone } = req.query as { email?: string; phone?: string }
      const duplicates = await service.detectDuplicates(req.tenantId!, email, phone)
      res.json(successResponse(duplicates))
    } catch (err) {
      next(err)
    }
  }
}
