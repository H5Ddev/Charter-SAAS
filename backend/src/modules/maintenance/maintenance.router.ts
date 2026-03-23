import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { MaintenanceService, CreateMaintenanceSchema, UpdateMaintenanceSchema } from './maintenance.service'
import { successResponse } from '../../shared/utils/response'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'

const prisma = new PrismaClient()
const service = new MaintenanceService(prisma)

export const maintenanceRouter: Router = Router()
maintenanceRouter.use(requireAuth)
maintenanceRouter.use(tenantScope)

maintenanceRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query['page']) || 1
    const pageSize = Number(req.query['pageSize']) || 20
    const aircraftId = req.query['aircraftId'] as string | undefined
    const status = req.query['status'] as string | undefined
    const result = await service.list(req.tenantId!, page, pageSize, aircraftId, status)
    res.json(successResponse(result.records, result.meta as Record<string, unknown>))
  } catch (err) { next(err) }
})

maintenanceRouter.get('/due', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Number(req.query['days']) || 30
    const result = await service.getDue(req.tenantId!, days)
    res.json(successResponse(result))
  } catch (err) { next(err) }
})

maintenanceRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await service.findById(req.tenantId!, req.params.id!)
    res.json(successResponse(record))
  } catch (err) { next(err) }
})

maintenanceRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreateMaintenanceSchema.parse(req.body)
    const record = await service.create(req.tenantId!, data)
    res.status(201).json(successResponse(record))
  } catch (err) { next(err) }
})

maintenanceRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = UpdateMaintenanceSchema.parse(req.body)
    const record = await service.update(req.tenantId!, req.params.id!, data)
    res.json(successResponse(record))
  } catch (err) { next(err) }
})

maintenanceRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.softDelete(req.tenantId!, req.params.id!)
    res.json(successResponse({ deleted: true }))
  } catch (err) { next(err) }
})
