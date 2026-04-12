import { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../../shared/middleware/errorHandler'
import { paginationMeta } from '../../shared/utils/response'
import { tenantScope } from '../../shared/utils/prismaScope'
import { AutomationEngine } from './engine'
import { createEvent } from '../../shared/events/types'
import { logger } from '../../shared/utils/logger'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const TriggerInputSchema = z.object({
  eventType: z.string(),
  config: z.record(z.unknown()).default({}),
})

const ConditionInputSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.string().optional().nullable(),
})

const ConditionGroupInputSchema = z.object({
  logicOperator: z.enum(['AND', 'OR']).default('AND'),
  conditions: z.array(ConditionInputSchema).default([]),
})

const ActionInputSchema = z.object({
  type: z.string(),
  order: z.number().int(),
  config: z.record(z.unknown()).default({}),
})

export const CreateAutomationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  triggers: z.array(TriggerInputSchema).min(1),
  conditionGroups: z.array(ConditionGroupInputSchema).default([]),
  actions: z.array(ActionInputSchema).default([]),
})

export const UpdateAutomationSchema = CreateAutomationSchema.partial()

export type CreateAutomationDto = z.infer<typeof CreateAutomationSchema>
export type UpdateAutomationDto = z.infer<typeof UpdateAutomationSchema>

// ─── Service ─────────────────────────────────────────────────────────────────

export class AutomationService {
  private readonly engine: AutomationEngine

  constructor(private readonly prisma: PrismaClient) {
    this.engine = new AutomationEngine(prisma)
  }

  async list(tenantId: string, page = 1, pageSize = 20) {
    const where: Prisma.AutomationWhereInput = tenantScope(tenantId)
    const [total, automations] = await Promise.all([
      this.prisma.automation.count({ where }),
      this.prisma.automation.findMany({
        where,
        include: {
          trigger: true,
          _count: { select: { actions: true, executionLogs: true } },
          executionLogs: {
            orderBy: { triggeredAt: 'desc' },
            take: 1,
            select: { triggeredAt: true },
          },
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
      where: tenantScope(tenantId, { id }),
      include: {
        trigger: true,
        conditionGroups: {
          where: { deletedAt: null },
          include: { conditions: { where: { deletedAt: null } } },
        },
        actions: { where: { deletedAt: null }, orderBy: { sequence: 'asc' } },
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
    const firstTrigger = data.triggers[0]

    return this.prisma.$transaction(async (tx) => {
      const automation = await tx.automation.create({
        data: {
          tenantId,
          name: data.name,
          description: data.description ?? undefined,
          enabled: data.isActive,
          triggerType: firstTrigger.eventType,
          triggerConfig: JSON.stringify(firstTrigger.config ?? {}),
          conditions: '[]',
        },
      })

      await tx.automationTrigger.create({
        data: {
          automationId: automation.id,
          eventType: firstTrigger.eventType,
          filters: JSON.stringify(firstTrigger.config ?? {}),
        },
      })

      for (const group of data.conditionGroups) {
        const condGroup = await tx.automationConditionGroup.create({
          data: { automationId: automation.id, operator: group.logicOperator },
        })
        for (const cond of group.conditions) {
          await tx.automationCondition.create({
            data: {
              conditionGroupId: condGroup.id,
              field: cond.field,
              operator: cond.operator,
              value: cond.value ?? null,
            },
          })
        }
      }

      for (const action of data.actions) {
        await tx.automationAction.create({
          data: {
            automationId: automation.id,
            sequence: action.order,
            actionType: action.type,
            config: JSON.stringify(action.config ?? {}),
          },
        })
      }

      return this.findById(tenantId, automation.id)
    })
  }

  async update(tenantId: string, id: string, data: UpdateAutomationDto) {
    const existing = await this.prisma.automation.findFirst({ where: tenantScope(tenantId, { id }) })
    if (!existing) throw new AppError(404, 'AUTOMATION_NOT_FOUND', 'Automation not found')

    return this.prisma.$transaction(async (tx) => {
      const firstTrigger = data.triggers?.[0]

      // Update Automation flat fields
      await tx.automation.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.isActive !== undefined && { enabled: data.isActive }),
          ...(firstTrigger && { triggerType: firstTrigger.eventType }),
          ...(firstTrigger && { triggerConfig: JSON.stringify(firstTrigger.config ?? {}) }),
        },
      })

      // Update trigger
      if (firstTrigger) {
        await tx.automationTrigger.upsert({
          where: { automationId: id },
          update: {
            eventType: firstTrigger.eventType,
            filters: JSON.stringify(firstTrigger.config ?? {}),
          },
          create: {
            automationId: id,
            eventType: firstTrigger.eventType,
            filters: JSON.stringify(firstTrigger.config ?? {}),
          },
        })
      }

      // Replace condition groups (soft-delete existing, create new)
      if (data.conditionGroups !== undefined) {
        const existingGroups = await tx.automationConditionGroup.findMany({
          where: { automationId: id, deletedAt: null },
          select: { id: true },
        })
        if (existingGroups.length > 0) {
          await tx.automationCondition.updateMany({
            where: { conditionGroupId: { in: existingGroups.map((g) => g.id) } },
            data: { deletedAt: new Date() },
          })
        }
        await tx.automationConditionGroup.updateMany({
          where: { automationId: id },
          data: { deletedAt: new Date() },
        })
        for (const group of data.conditionGroups) {
          const condGroup = await tx.automationConditionGroup.create({
            data: { automationId: id, operator: group.logicOperator },
          })
          for (const cond of group.conditions) {
            await tx.automationCondition.create({
              data: {
                conditionGroupId: condGroup.id,
                field: cond.field,
                operator: cond.operator,
                value: cond.value ?? null,
              },
            })
          }
        }
      }

      // Replace actions (soft-delete existing, create new)
      if (data.actions !== undefined) {
        await tx.automationAction.updateMany({
          where: { automationId: id, deletedAt: null },
          data: { deletedAt: new Date() },
        })
        for (const action of data.actions) {
          await tx.automationAction.create({
            data: {
              automationId: id,
              sequence: action.order,
              actionType: action.type,
              config: JSON.stringify(action.config ?? {}),
            },
          })
        }
      }

      return this.findById(tenantId, id)
    })
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.automation.findFirst({ where: tenantScope(tenantId, { id }) })
    if (!existing) throw new AppError(404, 'AUTOMATION_NOT_FOUND', 'Automation not found')
    await this.prisma.automation.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async toggle(tenantId: string, id: string, isEnabled: boolean) {
    const existing = await this.prisma.automation.findFirst({ where: tenantScope(tenantId, { id }) })
    if (!existing) throw new AppError(404, 'AUTOMATION_NOT_FOUND', 'Automation not found')
    return this.prisma.automation.update({ where: { id }, data: { enabled: isEnabled } })
  }

  async dryRun(tenantId: string, id: string, entityId: string, entityType: string) {
    const automation = await this.findById(tenantId, id)
    const originalIsDryRun = automation.isDryRun
    await this.prisma.automation.update({ where: { id }, data: { isDryRun: true } })

    try {
      const event = createEvent(tenantId, automation.triggerType as import('../../shared/events/types').TriggerEventType, {
        [`${entityType.toLowerCase()}Id`]: entityId,
      } as import('../../shared/events/types').AeroCommEvent['payload'])

      await this.engine.processEvent(event)
      logger.info(`Dry run completed for automation ${id}`)
      return { success: true, automationId: id, entityId, entityType }
    } finally {
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
