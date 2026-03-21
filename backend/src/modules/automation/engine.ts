import { PrismaClient, AutomationExecutionStatus } from '@prisma/client'
import { BaseEvent } from '../../shared/events/types'
import { TriggerRegistry } from './trigger.registry'
import { conditionEvaluator, ConditionGroup } from './condition.evaluator'
import { ActionExecutor } from './action.executor'
import { DelayScheduler } from './delay.scheduler'
import { ExecutionLogger } from './execution.logger'
import { logger } from '../../shared/utils/logger'

export class AutomationEngine {
  private readonly triggerRegistry: TriggerRegistry
  private readonly actionExecutor: ActionExecutor
  private readonly delayScheduler: DelayScheduler
  private readonly executionLogger: ExecutionLogger

  constructor(private readonly prisma: PrismaClient) {
    this.triggerRegistry = new TriggerRegistry(prisma)
    this.delayScheduler = new DelayScheduler(prisma)
    this.actionExecutor = new ActionExecutor(prisma, this.delayScheduler)
    this.executionLogger = new ExecutionLogger(prisma)
  }

  /**
   * Main entry point for the automation engine.
   * Called by the Service Bus consumer for each event.
   */
  async processEvent(event: BaseEvent): Promise<void> {
    const { tenantId, eventType, payload } = event
    const startTime = Date.now()

    logger.info(`Processing automation event: ${eventType}`, { tenantId, eventId: event.eventId })

    // Get automations matching this trigger type
    const automations = await this.triggerRegistry.getAutomationsForEvent(tenantId, eventType)

    if (automations.length === 0) {
      logger.debug(`No automations found for event ${eventType}`, { tenantId })
      return
    }

    // Build execution context from event payload
    const context = await this.buildContext(tenantId, payload)

    for (const automation of automations) {
      await this.executeAutomation(automation, context, tenantId, startTime)
    }
  }

  private async executeAutomation(
    automation: {
      id: string
      name: string
      isDryRun: boolean
      conditionGroups: ConditionGroup[]
      actions: Array<{
        type: import('@prisma/client').AutomationActionType
        config: Record<string, unknown>
        order: number
      }>
    },
    context: Record<string, unknown>,
    tenantId: string,
    startTime: number,
  ): Promise<void> {
    const automationContext = { ...context, automationId: automation.id }

    // Create execution log
    const entityType = this.resolveEntityType(context)
    const entityId = this.resolveEntityId(context)
    const logId = await this.executionLogger.create(tenantId, automation.id, entityType, entityId)

    try {
      // Evaluate conditions
      const conditionsPass = conditionEvaluator.evaluate(
        automation.conditionGroups as ConditionGroup[],
        automationContext,
      )

      if (!conditionsPass) {
        logger.debug(`Conditions not met for automation ${automation.name}`, {
          automationId: automation.id,
          tenantId,
        })
        await this.executionLogger.complete(logId, AutomationExecutionStatus.SKIPPED, 0, Date.now() - startTime)
        return
      }

      logger.info(`Executing automation: ${automation.name}`, {
        automationId: automation.id,
        isDryRun: automation.isDryRun,
        actionCount: automation.actions.length,
        tenantId,
      })

      let actionsRun = 0

      if (!automation.isDryRun) {
        for (const action of automation.actions) {
          // Stop if WAIT_DELAY is encountered — remaining actions are scheduled
          if (action.type === 'WAIT_DELAY') {
            await this.actionExecutor.execute(
              action as never,
              automationContext,
              tenantId,
              logId,
            )
            break
          }

          await this.actionExecutor.execute(
            action as never,
            automationContext,
            tenantId,
            logId,
          )
          actionsRun++
        }
      } else {
        logger.info(`[DRY RUN] Would execute ${automation.actions.length} actions`, {
          automationId: automation.id,
          actions: automation.actions.map((a) => a.type),
        })
        actionsRun = 0
      }

      const duration = Date.now() - startTime
      await this.executionLogger.complete(logId, AutomationExecutionStatus.SUCCESS, actionsRun, duration)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(`Automation ${automation.name} failed`, {
        automationId: automation.id,
        error: error.message,
        tenantId,
      })
      await this.executionLogger.markFailed(logId, error.message, 0)
    }
  }

  /**
   * Build execution context from event payload.
   * Fetches related entities (trip, contact, quote, etc.) from the database.
   */
  private async buildContext(
    tenantId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const context: Record<string, unknown> = { ...payload }

    // Fetch trip if tripId in payload
    if (payload['tripId']) {
      const trip = await this.prisma.trip.findFirst({
        where: { id: payload['tripId'] as string, tenantId, deletedAt: null },
        include: { aircraft: true },
      })
      if (trip) {
        context['trip'] = trip
        context['aircraft'] = trip.aircraft
      }
    }

    // Fetch contact if contactId in payload
    if (payload['contactId']) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: payload['contactId'] as string, tenantId, deletedAt: null },
      })
      if (contact) context['contact'] = contact
    }

    // Fetch quote if quoteId in payload
    if (payload['quoteId']) {
      const quote = await this.prisma.quote.findFirst({
        where: { id: payload['quoteId'] as string, tenantId, deletedAt: null },
      })
      if (quote) context['quote'] = quote
    }

    // Fetch ticket if ticketId in payload
    if (payload['ticketId']) {
      const ticket = await this.prisma.ticket.findFirst({
        where: { id: payload['ticketId'] as string, tenantId, deletedAt: null },
      })
      if (ticket) context['ticket'] = ticket
    }

    // Add tenant info
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
    })
    if (tenant) context['tenant'] = tenant

    return context
  }

  private resolveEntityType(context: Record<string, unknown>): string {
    if (context['trip']) return 'Trip'
    if (context['contact']) return 'Contact'
    if (context['quote']) return 'Quote'
    if (context['ticket']) return 'Ticket'
    return 'Unknown'
  }

  private resolveEntityId(context: Record<string, unknown>): string {
    const trip = context['trip'] as { id?: string } | undefined
    const contact = context['contact'] as { id?: string } | undefined
    const quote = context['quote'] as { id?: string } | undefined
    const ticket = context['ticket'] as { id?: string } | undefined
    return trip?.id ?? contact?.id ?? quote?.id ?? ticket?.id ?? 'unknown'
  }
}
