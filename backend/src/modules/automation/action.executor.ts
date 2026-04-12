import { PrismaClient } from '@prisma/client'
import { AutomationActionType } from '../../shared/types/appEnums'
import { render } from '../notifications/template.engine'
import { smsSender } from '../notifications/channels/sms.sender'
import { emailSender } from '../notifications/channels/email.sender'
import { whatsappSender } from '../notifications/channels/whatsapp.sender'
import { slackSender } from '../notifications/channels/slack.sender'
import { teamsSender } from '../notifications/channels/teams.sender'
import { eventPublisher } from '../../shared/events/publisher'
import { createEvent } from '../../shared/events/types'
import { env } from '../../config/env'
import { logger } from '../../shared/utils/logger'
import { AppError } from '../../shared/middleware/errorHandler'
import type { DelayScheduler } from './delay.scheduler'

const MAX_CHAIN_HOPS = 5

export interface ActionConfig {
  // SEND_SMS
  templateId?: string
  toPath?: string
  to?: string
  body?: string
  // 'TRIP_PASSENGERS' — send to each passenger's contact phone/email
  recipientType?: string

  // SEND_EMAIL
  subject?: string
  fromEmail?: string

  // SEND_WHATSAPP (same as SMS)

  // SEND_SLACK / SEND_TEAMS
  webhookUrl?: string

  // CREATE_TICKET
  title?: string
  priority?: string
  assignedTo?: string

  // UPDATE_TRIP_FIELD / UPDATE_CONTACT_FIELD
  field?: string
  value?: unknown

  // FIRE_WEBHOOK
  url?: string
  method?: string
  headers?: Record<string, string>

  // CHAIN_AUTOMATION
  targetAutomationId?: string
  hopCount?: number

  // WAIT_DELAY
  duration?: string // ISO 8601 duration: PT24H, P2D, etc.

  // ADD_NOTE
  content?: string
  isPrivate?: boolean
  noteTarget?: 'contact' | 'ticket'
}

export class ActionExecutor {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly delayScheduler: DelayScheduler,
  ) {}

  async execute(
    action: { type: AutomationActionType; config: ActionConfig; order: number },
    context: Record<string, unknown>,
    tenantId: string,
    executionLogId: string,
    nextAction?: { type: AutomationActionType; config: ActionConfig; order: number },
  ): Promise<void> {
    logger.debug(`Executing action ${action.type}`, { order: action.order, tenantId })

    switch (action.type) {
      case AutomationActionType.SEND_SMS:
        await this.executeSendSms(action.config, context, tenantId)
        break

      case AutomationActionType.SEND_EMAIL:
        await this.executeSendEmail(action.config, context, tenantId)
        break

      case AutomationActionType.SEND_WHATSAPP:
        await this.executeSendWhatsApp(action.config, context, tenantId)
        break

      case AutomationActionType.SEND_SLACK:
        await this.executeSendSlack(action.config, context)
        break

      case AutomationActionType.SEND_TEAMS:
        await this.executeSendTeams(action.config, context)
        break

      case AutomationActionType.CREATE_TICKET:
        await this.executeCreateTicket(action.config, context, tenantId)
        break

      case AutomationActionType.ASSIGN_TICKET:
        await this.executeAssignTicket(action.config, context, tenantId)
        break

      case AutomationActionType.UPDATE_TRIP_FIELD:
        await this.executeUpdateTripField(action.config, context, tenantId)
        break

      case AutomationActionType.UPDATE_CONTACT_FIELD:
        await this.executeUpdateContactField(action.config, context, tenantId)
        break

      case AutomationActionType.FIRE_WEBHOOK:
        await this.executeFireWebhook(action.config, context)
        break

      case AutomationActionType.CHAIN_AUTOMATION:
        await this.executeChainAutomation(action.config, context, tenantId)
        break

      case AutomationActionType.WAIT_DELAY:
        await this.executeWaitDelay(action.config, context, tenantId, executionLogId, nextAction)
        break

      case AutomationActionType.ADD_NOTE:
        await this.executeAddNote(action.config, context, tenantId)
        break

      default:
        throw new Error(`Unknown automation action type: ${action.type as string}`)
    }
  }

  private async getTemplate(
    templateId: string,
    tenantId: string,
  ): Promise<{ body: string; subject: string | null }> {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { id: templateId, tenantId, deletedAt: null },
    })
    if (!template) {
      throw new AppError(404, 'TEMPLATE_NOT_FOUND', `Template ${templateId} not found`)
    }
    return template
  }

  private resolveRecipient(config: ActionConfig, context: Record<string, unknown>): string {
    if (config.to) return render(config.to, context)
    if (config.toPath) {
      const value = require('../notifications/template.engine').resolvePath(context, config.toPath) as string
      if (!value) throw new AppError(400, 'NO_RECIPIENT', `Recipient path ${config.toPath} resolved to empty value`)
      return value
    }
    throw new AppError(400, 'NO_RECIPIENT', 'Action config missing "to" or "toPath"')
  }

  /**
   * Resolve one or more recipients and their per-recipient context.
   * Returns an array of { address, context } — one per recipient.
   *
   * Supported recipientType values:
   *   'TRIP_PASSENGERS' — iterates context.passengers[], uses contact.phone / contact.email
   */
  private resolveRecipients(
    config: ActionConfig,
    context: Record<string, unknown>,
    field: 'phone' | 'email',
  ): Array<{ address: string; ctx: Record<string, unknown> }> {
    if (config.recipientType === 'TRIP_PASSENGERS') {
      const passengers = context['passengers'] as Array<{
        contact: { phone?: string | null; email?: string | null; firstName?: string; lastName?: string }
      }> | undefined

      if (!passengers?.length) {
        logger.warn('TRIP_PASSENGERS recipientType: no passengers in context')
        return []
      }

      const results: Array<{ address: string; ctx: Record<string, unknown> }> = []
      for (const p of passengers) {
        const address = field === 'phone' ? p.contact.phone : p.contact.email
        if (address) results.push({ address, ctx: { ...context, passenger: p.contact } })
      }
      return results
    }

    // Fall back to single-recipient resolution
    const address = this.resolveRecipient(config, context)
    return [{ address, ctx: context }]
  }

  private async executeSendSms(config: ActionConfig, context: Record<string, unknown>, tenantId: string): Promise<void> {
    if (!config.templateId && !config.body) {
      throw new AppError(400, 'NO_SMS_BODY', 'SEND_SMS action requires templateId or body')
    }

    const recipients = this.resolveRecipients(config, context, 'phone')
    if (recipients.length === 0) {
      logger.warn('SEND_SMS: no recipients resolved, skipping', { tenantId })
      return
    }

    for (const { address, ctx } of recipients) {
      const body = config.templateId
        ? render((await this.getTemplate(config.templateId, tenantId)).body, ctx)
        : render(config.body!, ctx)
      await smsSender.send(address, body, tenantId)
    }
  }

  private async executeSendEmail(config: ActionConfig, context: Record<string, unknown>, tenantId: string): Promise<void> {
    if (!config.templateId && !config.body) {
      throw new AppError(400, 'NO_EMAIL_BODY', 'SEND_EMAIL action requires templateId or body')
    }

    const recipients = this.resolveRecipients(config, context, 'email')
    if (recipients.length === 0) {
      logger.warn('SEND_EMAIL: no recipients resolved, skipping', { tenantId })
      return
    }

    for (const { address, ctx } of recipients) {
      let subject: string
      let body: string
      if (config.templateId) {
        const template = await this.getTemplate(config.templateId, tenantId)
        body = render(template.body, ctx)
        subject = template.subject ? render(template.subject, ctx) : config.subject ?? '(No subject)'
      } else {
        body = render(config.body!, ctx)
        subject = config.subject ? render(config.subject, ctx) : '(No subject)'
      }
      await emailSender.send(address, subject, body)
    }
  }

  private async executeSendWhatsApp(config: ActionConfig, context: Record<string, unknown>, tenantId: string): Promise<void> {
    if (!config.templateId && !config.body) {
      throw new AppError(400, 'NO_WHATSAPP_BODY', 'SEND_WHATSAPP action requires templateId or body')
    }

    const recipients = this.resolveRecipients(config, context, 'phone')
    if (recipients.length === 0) {
      logger.warn('SEND_WHATSAPP: no recipients resolved, skipping', { tenantId })
      return
    }

    for (const { address, ctx } of recipients) {
      const body = config.templateId
        ? render((await this.getTemplate(config.templateId, tenantId)).body, ctx)
        : render(config.body!, ctx)
      await whatsappSender.send(address, body, tenantId)
    }
  }

  private async executeSendSlack(config: ActionConfig, context: Record<string, unknown>): Promise<void> {
    const webhookUrl = config.webhookUrl ?? ''
    if (!webhookUrl) throw new AppError(400, 'NO_SLACK_WEBHOOK', 'SEND_SLACK action requires webhookUrl')
    const body = render(config.body ?? '', context)
    await slackSender.send(webhookUrl, body, config.subject ? render(config.subject, context) : undefined)
  }

  private async executeSendTeams(config: ActionConfig, context: Record<string, unknown>): Promise<void> {
    const webhookUrl = config.webhookUrl ?? ''
    if (!webhookUrl) throw new AppError(400, 'NO_TEAMS_WEBHOOK', 'SEND_TEAMS action requires webhookUrl')
    const body = render(config.body ?? '', context)
    await teamsSender.send(webhookUrl, body, config.subject ? render(config.subject, context) : undefined)
  }

  private async executeAssignTicket(config: ActionConfig, context: Record<string, unknown>, tenantId: string): Promise<void> {
    const ticket = context['ticket'] as { id?: string } | undefined
    if (!ticket?.id) throw new AppError(400, 'NO_TICKET', 'ASSIGN_TICKET requires ticket in context')
    if (!config.assignedTo) throw new AppError(400, 'NO_ASSIGNEE', 'ASSIGN_TICKET requires assignedTo in config')

    await this.prisma.ticket.updateMany({
      where: { id: ticket.id, tenantId },
      data: { assignedTo: config.assignedTo },
    })
  }

  private async executeCreateTicket(config: ActionConfig, context: Record<string, unknown>, tenantId: string): Promise<void> {
    const trip = context['trip'] as { id?: string } | undefined
    const contact = context['contact'] as { id?: string } | undefined

    await this.prisma.ticket.create({
      data: {
        tenantId,
        contactId: contact?.id ?? undefined,
        tripId: trip?.id ?? undefined,
        source: 'MANUAL',
        status: 'OPEN',
        priority: (config.priority as never) ?? 'NORMAL',
        title: config.title ? render(config.title, context) : 'Auto-generated ticket',
        body: config.body ? render(config.body, context) : undefined,
        assignedTo: config.assignedTo,
      },
    })
  }

  private async executeUpdateTripField(config: ActionConfig, context: Record<string, unknown>, tenantId: string): Promise<void> {
    const trip = context['trip'] as { id?: string } | undefined
    if (!trip?.id) throw new AppError(400, 'NO_TRIP', 'UPDATE_TRIP_FIELD requires trip in context')
    if (!config.field) throw new AppError(400, 'NO_FIELD', 'UPDATE_TRIP_FIELD requires field')

    await this.prisma.trip.updateMany({
      where: { id: trip.id, tenantId },
      data: { [config.field]: config.value },
    })
  }

  private async executeUpdateContactField(config: ActionConfig, context: Record<string, unknown>, tenantId: string): Promise<void> {
    const contact = context['contact'] as { id?: string } | undefined
    if (!contact?.id) throw new AppError(400, 'NO_CONTACT', 'UPDATE_CONTACT_FIELD requires contact in context')
    if (!config.field) throw new AppError(400, 'NO_FIELD', 'UPDATE_CONTACT_FIELD requires field')

    await this.prisma.contact.updateMany({
      where: { id: contact.id, tenantId },
      data: { [config.field]: config.value },
    })

    // Publish field updated event
    try {
      await eventPublisher.publish(
        env.AZURE_SERVICE_BUS_QUEUE_AUTOMATION,
        createEvent(tenantId, 'CONTACT_FIELD_UPDATED', {
          contactId: contact.id,
          field: config.field,
          oldValue: null,
          newValue: config.value,
          updatedBy: 'automation',
        }),
      )
    } catch { /* ignore */ }
  }

  private async executeFireWebhook(config: ActionConfig, context: Record<string, unknown>): Promise<void> {
    const url = config.url ? render(config.url, context) : undefined
    if (!url) throw new AppError(400, 'NO_WEBHOOK_URL', 'FIRE_WEBHOOK action requires url')

    const body = config.body ? render(config.body, context) : JSON.stringify(context)
    const method = config.method ?? 'POST'

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: method !== 'GET' ? body : undefined,
    })

    if (!response.ok) {
      throw new AppError(502, 'WEBHOOK_FAILED', `FIRE_WEBHOOK: ${url} returned ${response.status}`)
    }
  }

  private async executeChainAutomation(config: ActionConfig, context: Record<string, unknown>, tenantId: string): Promise<void> {
    const hopCount = (config.hopCount ?? 0) + 1

    if (hopCount > MAX_CHAIN_HOPS) {
      logger.warn(`CHAIN_AUTOMATION hop limit (${MAX_CHAIN_HOPS}) reached`, { tenantId })
      return
    }

    const targetId = config.targetAutomationId
    if (!targetId) throw new AppError(400, 'NO_TARGET_AUTOMATION', 'CHAIN_AUTOMATION requires targetAutomationId')

    // Publish a new trigger event for the chained automation
    await eventPublisher.publish(
      env.AZURE_SERVICE_BUS_QUEUE_AUTOMATION,
      createEvent(tenantId, 'INBOUND_WEBHOOK', {
        integrationName: 'chain',
        integrationId: targetId,
        webhookEventId: targetId,
        rawEventType: 'CHAIN_AUTOMATION',
        ...context,
        chainedFromAutomationId: targetId,
        hopCount,
      }),
    )
  }

  private async executeWaitDelay(
    config: ActionConfig,
    context: Record<string, unknown>,
    tenantId: string,
    executionLogId: string,
    nextAction?: { type: AutomationActionType; config: ActionConfig; order: number },
  ): Promise<void> {
    const duration = config.duration
    if (!duration) throw new AppError(400, 'NO_DURATION', 'WAIT_DELAY action requires duration (ISO 8601)')
    if (!nextAction) {
      logger.warn('WAIT_DELAY has no following action — nothing will be scheduled', { tenantId })
      return
    }

    const deliverAt = parseDuration(duration)
    const trip = context['trip'] as { id?: string } | undefined
    const contact = context['contact'] as { id?: string } | undefined

    const refEntityType = trip?.id ? 'Trip' : contact?.id ? 'Contact' : 'Unknown'
    const refEntityId = trip?.id ?? contact?.id ?? 'unknown'

    await this.delayScheduler.scheduleDelayedAction(
      (context['automationId'] as string) ?? '',
      executionLogId,
      tenantId,
      nextAction.type,
      nextAction.config as never,
      context,
      deliverAt,
      refEntityType,
      refEntityId,
    )
  }

  private async executeAddNote(config: ActionConfig, context: Record<string, unknown>, tenantId: string): Promise<void> {
    const content = config.content ? render(config.content, context) : 'Automated note'
    const contact = context['contact'] as { id?: string } | undefined
    const ticket = context['ticket'] as { id?: string } | undefined

    if (config.noteTarget === 'ticket' && ticket?.id) {
      await this.prisma.ticketMessage.create({
        data: {
          tenantId,
          ticketId: ticket.id,
          content,
          isInternal: config.isPrivate ?? true,
          channel: 'AUTOMATION',
        },
      })
    } else if (contact?.id) {
      await this.prisma.contactNote.create({
        data: {
          tenantId,
          contactId: contact.id,
          userId: 'automation',
          content,
          isPrivate: config.isPrivate ?? false,
        },
      })
    }
  }
}

/**
 * Parse an ISO 8601 duration string and return the future Date.
 * Supports: PT1H, PT24H, P1D, P2D, P7D
 */
function parseDuration(duration: string): Date {
  const now = new Date()
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(duration)

  if (!match) {
    // Default: 1 hour if unparseable
    logger.warn(`Could not parse duration: ${duration} — defaulting to 1 hour`)
    return new Date(now.getTime() + 60 * 60 * 1000)
  }

  const days = parseInt(match[1] ?? '0', 10)
  const hours = parseInt(match[2] ?? '0', 10)
  const minutes = parseInt(match[3] ?? '0', 10)
  const seconds = parseInt(match[4] ?? '0', 10)

  const ms = (days * 86400 + hours * 3600 + minutes * 60 + seconds) * 1000
  return new Date(now.getTime() + ms)
}
