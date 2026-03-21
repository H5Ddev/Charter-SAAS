import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import {
  NotificationService,
  CreateTemplateSchema,
  UpdateTemplateSchema,
} from './notification.service'
import { successResponse } from '../../shared/utils/response'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'
import { z } from 'zod'

const prisma = new PrismaClient()
const service = new NotificationService(prisma)

export const notificationsRouter: Router = Router()
notificationsRouter.use(requireAuth)
notificationsRouter.use(tenantScope)

// GET /api/notifications/templates
notificationsRouter.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query['page']) || 1
    const pageSize = Number(req.query['pageSize']) || 20
    const result = await service.getTemplates(req.tenantId!, page, pageSize)
    res.json(successResponse(result.templates, result.meta as Record<string, unknown>))
  } catch (err) { next(err) }
})

// GET /api/notifications/templates/:id
notificationsRouter.get('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.notificationTemplate.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId!, deletedAt: null },
      include: {},
    })
    if (!template) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } })
      return
    }
    res.json(successResponse(template))
  } catch (err) { next(err) }
})

// POST /api/notifications/templates
notificationsRouter.post('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreateTemplateSchema.parse(req.body)
    const template = await service.createTemplate(req.tenantId!, data)
    res.status(201).json(successResponse(template))
  } catch (err) { next(err) }
})

// PATCH /api/notifications/templates/:id
notificationsRouter.patch('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = UpdateTemplateSchema.parse(req.body)
    const template = await service.updateTemplate(req.tenantId!, req.params.id!, data)
    res.json(successResponse(template))
  } catch (err) { next(err) }
})

// DELETE /api/notifications/templates/:id
notificationsRouter.delete('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notificationTemplate.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    })
    res.json(successResponse({ deleted: true }))
  } catch (err) { next(err) }
})

// POST /api/notifications/templates/:id/preview
notificationsRouter.post('/templates/:id/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const variables = z.record(z.unknown()).parse(req.body)
    const result = await service.previewTemplate(req.params.id!, req.tenantId!, variables)
    res.json(successResponse(result))
  } catch (err) { next(err) }
})

// POST /api/notifications/send
notificationsRouter.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId, contactId, variables } = req.body as {
      templateId: string
      contactId: string
      variables: Record<string, unknown>
    }
    await service.sendFromTemplate(req.tenantId!, templateId, contactId, variables)
    res.json(successResponse({ sent: true }))
  } catch (err) { next(err) }
})
