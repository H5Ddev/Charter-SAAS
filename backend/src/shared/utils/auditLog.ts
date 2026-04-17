import { Request } from 'express'
import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

export interface AuditEntry {
  tenantId: string
  userId?: string | null
  action: string
  entityType: string
  entityId: string
  diff?: unknown
  ip?: string | null
  userAgent?: string | null
}

/**
 * Persist an audit log entry. Fire-and-forget: failures never propagate to
 * the caller, since security forensics shouldn't block the user flow. Failures
 * are logged at warn level so missing audit entries are still observable.
 */
export function recordAudit(prisma: PrismaClient, entry: AuditEntry): void {
  prisma.auditLog
    .create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        diff: entry.diff === undefined ? null : JSON.stringify(entry.diff),
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    })
    .catch((err: unknown) => {
      logger.warn('Failed to write audit log entry', {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        error: err instanceof Error ? err.message : String(err),
      })
    })
}

/**
 * Extract the client IP and user-agent from an Express request, suitable for
 * spreading into an AuditEntry. Express trusts the proxy chain when configured,
 * so req.ip already accounts for X-Forwarded-For when trust proxy is enabled.
 */
export function requestMeta(req: Request): { ip: string | null; userAgent: string | null } {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  }
}
