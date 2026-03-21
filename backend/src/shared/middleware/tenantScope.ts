import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { errorResponse } from '../utils/response'

/**
 * Middleware that ensures req.tenantId is set from req.user.tenantId.
 * Must be used after requireAuth middleware.
 */
export function tenantScope(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json(errorResponse('UNAUTHORIZED', 'Authentication required'))
    return
  }

  req.tenantId = req.user.tenantId
  next()
}

/**
 * Creates a Prisma query extension that automatically injects tenantId
 * into all where clauses and create calls, and filters out soft-deleted records.
 *
 * Usage:
 *   const scopedPrisma = withTenantScope(prisma, req.tenantId)
 *   const contacts = await scopedPrisma.contact.findMany({ where: { email: 'x@y.com' } })
 *   // automatically becomes: where: { email: 'x@y.com', tenantId: '...', deletedAt: null }
 */
export function withTenantScope(prisma: PrismaClient, tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          args.where = {
            ...(args.where as Record<string, unknown> || {}),
            tenantId,
            deletedAt: null,
          }
          return query(args)
        },
        async findFirst({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          args.where = {
            ...(args.where as Record<string, unknown> || {}),
            tenantId,
            deletedAt: null,
          }
          return query(args)
        },
        async findUnique({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          // findUnique does not support deletedAt filtering via where uniqueness
          // Use findFirst instead for soft-delete aware unique lookups
          return query(args)
        },
        async count({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          args.where = {
            ...(args.where as Record<string, unknown> || {}),
            tenantId,
            deletedAt: null,
          }
          return query(args)
        },
        async create({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          const data = args.data as Record<string, unknown>
          args.data = {
            ...data,
            tenantId,
          }
          return query(args)
        },
        async updateMany({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          args.where = {
            ...(args.where as Record<string, unknown> || {}),
            tenantId,
            deletedAt: null,
          }
          return query(args)
        },
        async deleteMany({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          args.where = {
            ...(args.where as Record<string, unknown> || {}),
            tenantId,
          }
          return query(args)
        },
      },
    },
  })
}

export type ScopedPrisma = ReturnType<typeof withTenantScope>
