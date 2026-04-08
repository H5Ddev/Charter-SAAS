import { PrismaClient } from '@prisma/client'
import { AutomationActionType, ScheduledMessageStatus } from '../../shared/types/appEnums'
import { eventPublisher } from '../../shared/events/publisher'
import { BaseEvent } from '../../shared/events/types'
import { env } from '../../config/env'
import { logger } from '../../shared/utils/logger'

interface DelayedActionPayload extends BaseEvent {
  isDelayedAction: true
  automationId: string
  executionLogId: string
  actionType: AutomationActionType
  actionConfig: Record<string, unknown>
}

export class DelayScheduler {
  constructor(private readonly prisma: PrismaClient) {}

  async scheduleDelayedAction(
    automationId: string,
    executionLogId: string | null,
    tenantId: string,
    actionType: AutomationActionType,
    actionConfig: Record<string, unknown>,
    context: Record<string, unknown>,
    deliverAt: Date,
    referenceEntityType: string,
    referenceEntityId: string,
  ): Promise<void> {
    const scheduled = await this.prisma.scheduledMessage.create({
      data: {
        tenantId,
        automationId,
        automationExecutionLogId: executionLogId ?? undefined,
        scheduledFor: deliverAt,
        status: ScheduledMessageStatus.PENDING,
        actionType,
        actionConfig: actionConfig as never,
        referenceEntityType,
        referenceEntityId,
      },
    })

    const event: DelayedActionPayload = {
      eventId: scheduled.id,
      tenantId,
      eventType: 'TRIP_STATUS_CHANGED',
      occurredAt: new Date().toISOString(),
      payload: { ...context, scheduledMessageId: scheduled.id },
      isDelayedAction: true,
      automationId,
      executionLogId: executionLogId ?? '',
      actionType,
      actionConfig,
    }

    try {
      const jobId = await eventPublisher.publish(
        env.AUTOMATION_QUEUE,
        event,
        deliverAt,
      )

      if (jobId) {
        await this.prisma.scheduledMessage.update({
          where: { id: scheduled.id },
          data: { jobId },
        })
      }

      logger.info(`Delayed action scheduled`, {
        scheduledMessageId: scheduled.id,
        deliverAt: deliverAt.toISOString(),
        actionType,
        tenantId,
      })
    } catch (err) {
      await this.prisma.scheduledMessage.update({
        where: { id: scheduled.id },
        data: { status: ScheduledMessageStatus.FAILED },
      })
      logger.error('Failed to schedule delayed action', { error: err, scheduledMessageId: scheduled.id })
      throw err
    }
  }

  async cancelScheduledMessages(
    tenantId: string,
    referenceEntityType: string,
    referenceEntityId: string,
  ): Promise<number> {
    const pendingMessages = await this.prisma.scheduledMessage.findMany({
      where: {
        tenantId,
        referenceEntityType,
        referenceEntityId,
        status: ScheduledMessageStatus.PENDING,
        deletedAt: null,
      },
    })

    let cancelledCount = 0

    for (const msg of pendingMessages) {
      try {
        if (msg.jobId) {
          await eventPublisher.cancelScheduledMessage(env.AUTOMATION_QUEUE, msg.jobId)
        }

        await this.prisma.scheduledMessage.update({
          where: { id: msg.id },
          data: { status: ScheduledMessageStatus.CANCELLED },
        })

        cancelledCount++
      } catch (err) {
        logger.error(`Failed to cancel scheduled message ${msg.id}`, { error: err })
      }
    }

    logger.info(`Cancelled ${cancelledCount} scheduled messages for ${referenceEntityType} ${referenceEntityId}`)
    return cancelledCount
  }
}
