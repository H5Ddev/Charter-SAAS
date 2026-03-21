import { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../../shared/middleware/errorHandler'
import { paginationMeta } from '../../shared/utils/response'
import { AutomationEngine } from './engine'
import { createEvent } from '../../shared/events/types'
import { logger } from '../../shared/utils/logger'

export const CreateAutomationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  isEnabled: z.boolean().default(true),
  isDryRun: z.boolean().default(false),
  triggerType: z.string(),
  triggerConfig: z.record(z.unknown()).default({}),
  conditions: z.array(z.unknown()).default([]),
})

export const UpdateAutomationSchema = CreateAutomationSchema.partial()
export type CreateAutomationDto = z.infer<typeof CreateAutomationSchema>
export type UpdateAutomationDto = z.infer<typeof UpdateAutomationSchema>

export class AutomationService {
  private readonly engine: AutomationEngine

  constructor(private readonly prisma: PrismaClient) {
    this.engine = new AutomationEngine(prisma)
  }

  async list(tenantId: string, page = 1, pageSize = 20) {
    const where: Prisma.AutomationWhereInput = { tenantId, deletedAt: null }
    const [total, automations] = await Promise.all([
      this.prisma.automation.count({ where }),
      this.prisma.automation.findMany({
        where,
        include: {
          _count: { select: { actions: true, executionLogs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    return { automations, meta: paginationMeta(total, page, pageSize) }
  }

  async findById(tenantId: string, id: string) {
    const automation = await this.prisma.automation.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        conditionGroups: {
          where: { deletedAt: null },
          include: { conditions: { where: { deletedAt: null } } },
        },
        actions: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
        executionLogs: {
          orderBy: { triggeredAt: 'desc' },
          take: 10,
        },
      },
    })
    if (!automation) throw new AppError(404, 'AUTOMATION_NOT_FOUND', 'Automation not found')
    return automation
  }

  async create(tenantId: string, data: CreateAutomationDto) {
    return this.prisma.automation.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description ?? undefined,
        isEnabled: data.isEnabled,
        isDryRun: data.isDryRun,
        triggerType: data.triggerType as never,
        triggerConfig: data.triggerConfig as Prisma.InputJsonValue,
        conditions: data.conditions as Prisma.InputJsonValue,
      },
    })
  }

  async update(tenantId: string, id: string, data: UpdateAutomationDto) {
    const existing = await this.prisma.automation.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new AppError(404, 'AUTOMATION_NOT_FOUND', 'Automation not found')

    return this.prisma.automation.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        ...(data.isDryRun !== undefined && { isDryRun: data.isDryRun }),
        ...(data.triggerType && { triggerType: data.triggerType as never }),
        ...(data.triggerConfig && { triggerConfig: data.triggerConfig as Prisma.InputJsonValue }),
      },
    })
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.automation.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new AppError(404, 'AUTOMATION_NOT_FOUND', 'Automation not found')
    await this.prisma.automation.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async toggle(tenantId: string, id: string, isEnabled: boolean) {
    const existing = await this.prisma.automation.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new AppError(404, 'AUTOMATION_NOT_FOUND', 'Automation not found')
    return this.prisma.automation.update({ where: { id }, data: { isEnabled } })
  }

  async dryRun(tenantId: string, id: string, entityId: string, entityType: string) {
    const automation = await this.findById(tenantId, id)

    // Temporarily set isDryRun
    const originalIsDryRun = automation.isDryRun
    await this.prisma.automation.update({ where: { id }, data: { isDryRun: true } })

    try {
      const event = createEvent(tenantId, automation.triggerType as never, {
        [`${entityType.toLowerCase()}Id`]: entityId,
      })

      await this.engine.processEvent(event)
      logger.info(`Dry run completed for automation ${id}`)

      return { success: true, automationId: id, entityId, entityType }
    } finally {
      // Restore original isDryRun setting
      await this.prisma.automation.update({ where: { id }, data: { isDryRun: originalIsDryRun } })
    }
  }

  async getExecutionLogs(tenantId: string, automationId: string, page = 1, pageSize = 20) {
    const where = { tenantId, automationId, deletedAt: null }
    const [total, logs] = await Promise.all([
      this.prisma.automationExecutionLog.count({ where }),
      this.prisma.automationExecutionLog.findMany({
        where,
        orderBy: { triggeredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    return { logs, meta: paginationMeta(total, page, pageSize) }
  }
}
