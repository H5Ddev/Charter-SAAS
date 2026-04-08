import { PrismaClient } from '@prisma/client'
import { BaseConsumer } from '../../shared/events/consumer'
import { BaseEvent } from '../../shared/events/types'
import { AutomationEngine } from './engine'
import { env } from '../../config/env'
import { logger } from '../../shared/utils/logger'

const prisma = new PrismaClient()

export class AutomationEngineConsumer extends BaseConsumer {
  private readonly engine: AutomationEngine

  constructor() {
    super(env.AUTOMATION_QUEUE)
    this.engine = new AutomationEngine(prisma)
  }

  async processMessage(event: BaseEvent): Promise<void> {
    logger.info(`AutomationEngineConsumer: processing ${event.eventType}`, {
      eventId: event.eventId,
      tenantId: event.tenantId,
    })

    await this.engine.processEvent(event)
  }
}
