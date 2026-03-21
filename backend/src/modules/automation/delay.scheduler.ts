import { PrismaClient, AutomationActionType, ScheduledMessageStatus } from '@prisma/client'
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

  /**
   * Schedule a delayed automation action.
   * Creates a ScheduledMessage record and publishes to Service Bus with scheduledEnqueueTime.
   *
   * @param automationId - The automation this action belongs to
   * @param executionLogId - The current execution log ID
   * @param tenantId - Tenant ID
   * @param actionType - The action type to execute when the delay expires
   * @param actionConfig - Configuration for the delayed action
   * @param context - Execution context (for variable resolution in delayed action)
   * @param deliverAt - When to deliver the message
   * @param referenceEntityType - Entity type (e.g. 'Trip', 'Contact')
   * @param referenceEntityId - Entity ID
   */
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
    // Create the scheduled message record first
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
      eventType: 'TRIP_STATUS_CHANGED', // placeholder — consumer checks isDelayedAction
      occurredAt: new Date().toISOString(),
      payload: { ...context, scheduledMessageId: scheduled.id },
      isDelayedAction: true,
      automationId,
      executionLogId: executionLogId ?? '',
      actionType,
      actionConfig,
    }

    try {
      const sequenceNumber = await eventPublisher.publish(
        env.AZURE_SERVICE_BUS_QUEUE_AUTOMATION,
        event,
        deliverAt,
      )

      // Store the Service Bus sequence number for potential cancellation
      if (sequenceNumber !== undefined) {
        await this.prisma.scheduledMessage.update({
          where: { id: scheduled.id },
          data: { serviceBusSequenceNumber: sequenceNumber.toString() },
        })
      }

      logger.info(`Delayed action scheduled`, {
        scheduledMessageId: scheduled.id,
        deliverAt: deliverAt.toISOString(),
        actionType,
        tenantId,
      })
    } catch (err) {
      // If Service Bus is not available, mark as failed
      await this.prisma.scheduledMessage.update({
        where: { id: scheduled.id },
        data: { status: ScheduledMessageStatus.FAILED },
      })
      logger.error('Failed to schedule delayed action', { error: err, scheduledMessageId: scheduled.id })
      throw err
    }
  }

  /**
   * Cancel all pending scheduled messages for a given entity (e.g. when a trip is cancelled).
   */
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
        if (msg.serviceBusSequenceNumber) {
          await eventPublisher.cancelScheduledMessage(
            env.AZURE_SERVICE_BUS_QUEUE_AUTOMATION,
            BigInt(msg.serviceBusSequenceNumber),
          )
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
