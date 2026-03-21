import { PrismaClient, AutomationTriggerType } from '@prisma/client'
import { logger } from '../../shared/utils/logger'

export class TriggerRegistry {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Retrieve all enabled automations that match the given event type for a tenant.
   */
  async getAutomationsForEvent(tenantId: string, eventType: AutomationTriggerType | string) {
    const automations = await this.prisma.automation.findMany({
      where: {
        tenantId,
        isEnabled: true,
        triggerType: eventType as AutomationTriggerType,
        deletedAt: null,
      },
      include: {
        conditionGroups: {
          where: { deletedAt: null },
          include: {
            conditions: {
              where: { deletedAt: null },
            },
            childGroups: {
              where: { deletedAt: null },
              include: {
                conditions: {
                  where: { deletedAt: null },
                },
              },
            },
          },
        },
        actions: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
        },
      },
    })

    logger.debug(`Found ${automations.length} automations for event ${eventType}`, { tenantId })

    return automations
  }
}
