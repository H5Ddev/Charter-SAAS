import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import {
  AutomationService,
  CreateAutomationSchema,
  UpdateAutomationSchema,
} from './automation.service'
import { successResponse } from '../../shared/utils/response'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'

const prisma = new PrismaClient()
const service = new AutomationService(prisma)

export const automationRouter: Router = Router()
automationRouter.use(requireAuth)
automationRouter.use(tenantScope)

automationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query['page']) || 1
    const pageSize = Number(req.query['pageSize']) || 20
    const result = await service.list(req.tenantId!, page, pageSize)
    res.json(successResponse(result.automations, result.meta as Record<string, unknown>))
  } catch (err) { next(err) }
})

automationRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const automation = await service.findById(req.tenantId!, req.params.id!)
    res.json(successResponse(automation))
  } catch (err) { next(err) }
})

automationRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreateAutomationSchema.parse(req.body)
    const automation = await service.create(req.tenantId!, data)
    res.status(201).json(successResponse(automation))
  } catch (err) { next(err) }
})

automationRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = UpdateAutomationSchema.parse(req.body)
    const automation = await service.update(req.tenantId!, req.params.id!, data)
    res.json(successResponse(automation))
  } catch (err) { next(err) }
})

automationRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.softDelete(req.tenantId!, req.params.id!)
    res.json(successResponse({ deleted: true }))
  } catch (err) { next(err) }
})

automationRouter.patch('/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isEnabled } = req.body as { isEnabled: boolean }
    const automation = await service.toggle(req.tenantId!, req.params.id!, isEnabled)
    res.json(successResponse(automation))
  } catch (err) { next(err) }
})

automationRouter.post('/:id/dry-run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityId, entityType } = req.body as { entityId: string; entityType: string }
    const result = await service.dryRun(req.tenantId!, req.params.id!, entityId, entityType)
    res.json(successResponse(result))
  } catch (err) { next(err) }
})

automationRouter.get('/:id/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query['page']) || 1
    const pageSize = Number(req.query['pageSize']) || 20
    const result = await service.getExecutionLogs(req.tenantId!, req.params.id!, page, pageSize)
    res.json(successResponse(result.logs, result.meta as Record<string, unknown>))
  } catch (err) { next(err) }
})
