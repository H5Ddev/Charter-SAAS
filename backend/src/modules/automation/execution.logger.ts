import { PrismaClient, AutomationExecutionStatus } from '@prisma/client'
import { logger } from '../../shared/utils/logger'

export class ExecutionLogger {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    tenantId: string,
    automationId: string,
    entityType: string,
    entityId: string,
  ): Promise<string> {
    const log = await this.prisma.automationExecutionLog.create({
      data: {
        tenantId,
        automationId,
        entityType,
        entityId,
        status: AutomationExecutionStatus.SUCCESS,
        actionsRun: 0,
        triggeredAt: new Date(),
      },
    })
    return log.id
  }

  async complete(
    logId: string,
    status: AutomationExecutionStatus,
    actionsRun: number,
    duration: number,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.automationExecutionLog.update({
      where: { id: logId },
      data: {
        status,
        actionsRun,
        duration,
        errorMessage: errorMessage ?? null,
      },
    })

    logger.info(`Automation execution ${logId} completed`, {
      status,
      actionsRun,
      duration,
    })
  }

  async markFailed(logId: string, errorMessage: string, actionsRun: number): Promise<void> {
    await this.prisma.automationExecutionLog.update({
      where: { id: logId },
      data: {
        status: AutomationExecutionStatus.FAILED,
        errorMessage,
        actionsRun,
        duration: 0,
      },
    })
  }
}
