import { getBoss } from '../queue/boss'
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
   * Publish an event to the specified queue.
   * @param queueName - Target queue name (e.g. 'automation-events')
   * @param event - The event to publish
   * @param scheduledEnqueueTime - Optional future delivery time (for WAIT_DELAY actions)
   * @returns The pg-boss job ID, or null
   */
  async publish(
    queueName: string,
    event: BaseEvent,
    scheduledEnqueueTime?: Date,
  ): Promise<string | null> {
    try {
      const boss = await getBoss()

      const options = scheduledEnqueueTime
        ? { startAfter: scheduledEnqueueTime, retryLimit: 5, retryBackoff: true }
        : { retryLimit: 5, retryBackoff: true }

      const jobId = await boss.send(queueName, event as object, options)

      if (scheduledEnqueueTime) {
        logger.info(`Event scheduled for ${scheduledEnqueueTime.toISOString()}`, {
          jobId,
          eventType: event.eventType,
          queueName,
        })
      } else {
        logger.debug(`Event published to ${queueName}`, {
          jobId,
          eventType: event.eventType,
          tenantId: event.tenantId,
        })
      }

      return jobId
    } catch (err) {
      logger.error('Failed to publish event', {
        queueName,
        eventType: event.eventType,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  /**
   * Cancel a previously scheduled job by its pg-boss job ID.
   */
  async cancelScheduledMessage(queueName: string, jobId: string): Promise<void> {
    try {
      const boss = await getBoss()
      await boss.cancel(queueName, jobId)
      logger.info(`Cancelled scheduled job`, { queueName, jobId })
    } catch (err) {
      logger.error('Failed to cancel scheduled job', {
        queueName,
        jobId,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }
}

export const eventPublisher = EventPublisher.getInstance()
