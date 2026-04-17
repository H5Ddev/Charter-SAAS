import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { UsersService, CreateUserSchema, UpdateUserSchema } from './users.service'
import { successResponse } from '../../shared/utils/response'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'
import { recordAudit, requestMeta } from '../../shared/utils/auditLog'
import { AppError } from '../../shared/middleware/errorHandler'

const prisma = new PrismaClient()
const service = new UsersService(prisma)

export const usersRouter: Router = Router()
usersRouter.use(requireAuth)
usersRouter.use(tenantScope)

// Only ADMIN and MANAGER can manage users
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'COMPANY_ADMIN'].includes(req.user!.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions'))
  }
  next()
}

usersRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query['page']) || 1
    const pageSize = Number(req.query['pageSize']) || 50
    const result = await service.list(req.tenantId!, page, pageSize)
    res.json(successResponse(result.users, result.meta as Record<string, unknown>))
  } catch (err) { next(err) }
})

usersRouter.post('/', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreateUserSchema.parse(req.body)
    const user = await service.create(req.tenantId!, data)
    recordAudit(prisma, {
      tenantId: req.tenantId!,
      userId: req.user!.id,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      diff: { email: user.email, role: user.role },
      ...requestMeta(req),
    })
    res.status(201).json(successResponse(user))
  } catch (err) { next(err) }
})

usersRouter.patch('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Prevent self-demotion/deactivation
    if (req.params.id === req.user!.id && req.body.isActive === false) {
      return next(new AppError(400, 'CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own account'))
    }
    const data = UpdateUserSchema.parse(req.body)
    const user = await service.update(req.tenantId!, req.params.id!, data)
    // Surface role changes as a distinct action — highest-impact admin operation.
    const action = data.role !== undefined ? 'USER_ROLE_CHANGED' : 'USER_UPDATED'
    recordAudit(prisma, {
      tenantId: req.tenantId!,
      userId: req.user!.id,
      action,
      entityType: 'User',
      entityId: user.id,
      diff: data,
      ...requestMeta(req),
    })
    res.json(successResponse(user))
  } catch (err) { next(err) }
})

usersRouter.delete('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.user!.id) {
      return next(new AppError(400, 'CANNOT_DELETE_SELF', 'You cannot delete your own account'))
    }
    await service.deactivate(req.tenantId!, req.params.id!)
    recordAudit(prisma, {
      tenantId: req.tenantId!,
      userId: req.user!.id,
      action: 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: req.params.id!,
      ...requestMeta(req),
    })
    res.json(successResponse({ deleted: true }))
  } catch (err) { next(err) }
})
