import { ServiceBusMessage } from '@azure/service-bus'
import { getServiceBusClient } from '../../config/azure'
import { BaseEvent } from './types'
import { logger } from '../utils/logger'

export class EventPublisher {
  private static instance: EventPublisher

  static getInstance(): EventPublisher {
    if (!EventPublisher.instance) {
      EventPublisher.instance = new EventPublisher()
    }
    return EventPublisher.instance
  }

  /**
   * Publish an event to the specified Service Bus queue.
   * @param queueName - Target queue name (e.g. 'automation-events')
   * @param event - The event to publish
   * @param scheduledEnqueueTime - Optional future delivery time (for WAIT_DELAY actions)
   * @returns The sequence number of the scheduled message (if scheduled), or undefined
   */
  async publish(
    queueName: string,
    event: BaseEvent,
    scheduledEnqueueTime?: Date,
  ): Promise<bigint | undefined> {
    try {
      const client = getServiceBusClient()
      const sender = client.createSender(queueName)

      const message: ServiceBusMessage = {
        body: event,
        messageId: event.eventId,
        contentType: 'application/json',
        subject: event.eventType,
        applicationProperties: {
          tenantId: event.tenantId,
          eventType: event.eventType,
        },
      }

      if (scheduledEnqueueTime) {
        const [sequenceNumber] = await sender.scheduleMessages(message, scheduledEnqueueTime)
        logger.info(`Event scheduled for ${scheduledEnqueueTime.toISOString()}`, {
          eventId: event.eventId,
          eventType: event.eventType,
          queueName,
          sequenceNumber: sequenceNumber.toString(),
        })
        await sender.close()
        return sequenceNumber as unknown as bigint
      } else {
        await sender.sendMessages(message)
        logger.debug(`Event published to ${queueName}`, {
          eventId: event.eventId,
          eventType: event.eventType,
          tenantId: event.tenantId,
        })
        await sender.close()
        return undefined
      }
    } catch (err) {
      logger.error('Failed to publish event to Service Bus', {
        queueName,
        eventId: event.eventId,
        eventType: event.eventType,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  /**
   * Cancel a previously scheduled message by its sequence number.
   */
  async cancelScheduledMessage(queueName: string, sequenceNumber: bigint): Promise<void> {
    try {
      const client = getServiceBusClient()
      const sender = client.createSender(queueName)
      await sender.cancelScheduledMessages(sequenceNumber as unknown as Parameters<typeof sender.cancelScheduledMessages>[0])
      await sender.close()
      logger.info(`Cancelled scheduled message`, {
        queueName,
        sequenceNumber: sequenceNumber.toString(),
      })
    } catch (err) {
      logger.error('Failed to cancel scheduled message', {
        queueName,
        sequenceNumber: sequenceNumber.toString(),
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }
}

export const eventPublisher = EventPublisher.getInstance()
