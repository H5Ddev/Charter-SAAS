import {
  ServiceBusReceivedMessage,
  ProcessErrorArgs,
} from '@azure/service-bus'
import { getServiceBusClient } from '../../config/azure'
import { BaseEvent } from './types'
import { logger } from '../utils/logger'

export abstract class BaseConsumer {
  protected queueName: string
  private isRunning = false

  constructor(queueName: string) {
    this.queueName = queueName
  }

  /**
   * Process a single event. Implement in subclasses.
   */
  abstract processMessage(event: BaseEvent): Promise<void>

  /**
   * Start consuming messages from the queue.
   */
  start(): void {
    if (this.isRunning) {
      logger.warn(`Consumer for ${this.queueName} is already running`)
      return
    }

    try {
      const client = getServiceBusClient()
      const receiver = client.createReceiver(this.queueName, {
        receiveMode: 'peekLock',
      })

      receiver.subscribe({
        processMessage: async (message: ServiceBusReceivedMessage) => {
          const startTime = Date.now()
          const event = message.body as BaseEvent

          logger.debug(`Processing message from ${this.queueName}`, {
            eventId: event.eventId,
            eventType: event.eventType,
            tenantId: event.tenantId,
          })

          try {
            await this.processMessage(event)
            await receiver.completeMessage(message)

            logger.info(`Message processed successfully`, {
              eventId: event.eventId,
              eventType: event.eventType,
              duration: Date.now() - startTime,
            })
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            const deliveryCount = message.deliveryCount ?? 0

            logger.error(`Failed to process message`, {
              eventId: event.eventId,
              eventType: event.eventType,
              error: error.message,
              deliveryCount,
            })

            if (deliveryCount >= 9) {
              // Dead letter after max retries
              await receiver.deadLetterMessage(message, {
                deadLetterReason: 'MaxDeliveryCountExceeded',
                deadLetterErrorDescription: error.message,
              })
              logger.warn(`Message dead-lettered after ${deliveryCount + 1} attempts`, {
                eventId: event.eventId,
              })
            } else {
              // Abandon to retry with backoff
              await receiver.abandonMessage(message)
            }
          }
        },

        processError: async (args: ProcessErrorArgs) => {
          logger.error(`Service Bus error on ${this.queueName}`, {
            error: args.error.message,
            errorSource: args.errorSource,
            entityPath: args.entityPath,
          })
        },
      })

      this.isRunning = true
      logger.info(`Consumer started for queue: ${this.queueName}`)
    } catch (err) {
      logger.warn(`Could not start consumer for ${this.queueName} — Service Bus may not be configured`, {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  stop(): void {
    this.isRunning = false
    logger.info(`Consumer stopped for queue: ${this.queueName}`)
  }
}
