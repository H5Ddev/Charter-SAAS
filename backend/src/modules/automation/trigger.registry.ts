import { PrismaClient } from '@prisma/client'
import { AutomationTriggerType } from '../../shared/types/appEnums'
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
        enabled: true,
        triggerType: eventType as string,
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
          orderBy: { sequence: 'asc' },
        },
      },
    })

    logger.debug(`Found ${automations.length} automations for event ${eventType}`, { tenantId })

    return automations
  }
}
