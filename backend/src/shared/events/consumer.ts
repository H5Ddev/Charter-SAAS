import type { Job } from 'pg-boss'
import { getBoss } from '../queue/boss'
import { BaseEvent } from './types'
import { logger } from '../utils/logger'

export abstract class BaseConsumer {
  protected queueName: string

  constructor(queueName: string) {
    this.queueName = queueName
  }

  /**
   * Process a single event. Implement in subclasses.
   */
  abstract processMessage(event: BaseEvent): Promise<void>

  /**
   * Register this consumer as a pg-boss worker for the queue.
   */
  async start(): Promise<void> {
    try {
      const boss = await getBoss()

      await boss.work(this.queueName, async (jobs: Job<object>[]) => {
        for (const job of jobs) {
          const startTime = Date.now()
          const event = job.data as BaseEvent

          logger.debug(`Processing job from ${this.queueName}`, {
            jobId: job.id,
            eventType: event.eventType,
            tenantId: event.tenantId,
          })

          await this.processMessage(event)

          logger.info(`Job processed successfully`, {
            jobId: job.id,
            eventType: event.eventType,
            duration: Date.now() - startTime,
          })
        }
      })

      logger.info(`Worker registered for queue: ${this.queueName}`)
    } catch (err) {
      logger.warn(`Could not register worker for ${this.queueName}`, {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
