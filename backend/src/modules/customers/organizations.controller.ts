import { Request, Response, NextFunction } from 'express'
import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import {
  OrganizationsService,
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  OrgFiltersSchema,
} from './organizations.service'
import { successResponse } from '../../shared/utils/response'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'

const prisma = new PrismaClient()
const service = new OrganizationsService(prisma)

class OrganizationsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = OrgFiltersSchema.parse(req.query)
      const result = await service.list(req.tenantId!, filters)
      res.json(successResponse(result.organizations, result.meta as Record<string, unknown>))
    } catch (err) { next(err) }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const org = await service.findById(req.tenantId!, req.params.id!)
      res.json(successResponse(org))
    } catch (err) { next(err) }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = CreateOrganizationSchema.parse(req.body)
      const org = await service.create(req.tenantId!, data)
      res.status(201).json(successResponse(org))
    } catch (err) { next(err) }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = UpdateOrganizationSchema.parse(req.body)
      const org = await service.update(req.tenantId!, req.params.id!, data)
      res.json(successResponse(org))
    } catch (err) { next(err) }
  }

  async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await service.softDelete(req.tenantId!, req.params.id!)
      res.json(successResponse({ deleted: true }))
    } catch (err) { next(err) }
  }
}

const controller = new OrganizationsController()

export const organizationsRouter = Router()
organizationsRouter.use(requireAuth)
organizationsRouter.use(tenantScope)

organizationsRouter.get('/', controller.list.bind(controller))
organizationsRouter.get('/:id', controller.findById.bind(controller))
organizationsRouter.post('/', controller.create.bind(controller))
organizationsRouter.patch('/:id', controller.update.bind(controller))
organizationsRouter.delete('/:id', controller.softDelete.bind(controller))
