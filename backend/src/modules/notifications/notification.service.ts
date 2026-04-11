import { PrismaClient } from '@prisma/client'
import { NotificationChannel } from '../../shared/types/appEnums'
import { z } from 'zod'
import { render } from './template.engine'
import { smsSender } from './channels/sms.sender'
import { emailSender } from './channels/email.sender'
import { whatsappSender } from './channels/whatsapp.sender'
import { slackSender } from './channels/slack.sender'
import { teamsSender } from './channels/teams.sender'
import { AppError } from '../../shared/middleware/errorHandler'
import { logger } from '../../shared/utils/logger'
import { paginationMeta } from '../../shared/utils/response'
import { tenantScope } from '../../shared/utils/prismaScope'

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  channel: z.string(),
  subject: z.string().optional().nullable(),
  body: z.string().min(1),
  isSystem: z.boolean().default(false),
})

export const UpdateTemplateSchema = CreateTemplateSchema.partial()

export type CreateTemplateDto = z.infer<typeof CreateTemplateSchema>
export type UpdateTemplateDto = z.infer<typeof UpdateTemplateSchema>

export class NotificationService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Send a notification using a stored template.
   * Renders template variables and dispatches via the appropriate channel.
   */
  async sendFromTemplate(
    tenantId: string,
    templateId: string,
    recipientContactId: string,
    variables: Record<string, unknown>,
  ): Promise<void> {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: tenantScope(tenantId, { id: templateId }),
    })

    if (!template) {
      throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Notification template not found')
    }

    const contact = await this.prisma.contact.findFirst({
      where: tenantScope(tenantId, { id: recipientContactId }),
    })

    if (!contact) {
      throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found')
    }

    if (contact.doNotContact) {
      logger.warn(`Contact ${recipientContactId} has doNotContact=true — notification skipped`)
      return
    }

    const mergedVars = { ...variables, contact }
    const renderedBody = render(template.body, mergedVars)
    const renderedSubject = template.subject ? render(template.subject, mergedVars) : undefined

    await this.dispatch(
      tenantId,
      template.channel as NotificationChannel,
      contact,
      renderedSubject,
      renderedBody,
    )
  }

  /**
   * Send a direct notification without a template.
   */
  async sendDirect(
    tenantId: string,
    channel: NotificationChannel,
    to: string,
    subject: string | undefined,
    body: string,
  ): Promise<void> {
    const contactLike = { email: to, phone: to, whatsappPhone: to } as {
      email?: string | null
      phone?: string | null
      whatsappPhone?: string | null
    }
    await this.dispatch(tenantId, channel, contactLike, subject, body)
  }

  private async dispatch(
    tenantId: string,
    channel: NotificationChannel,
    contact: { email?: string | null; phone?: string | null; whatsappPhone?: string | null },
    subject: string | undefined,
    body: string,
  ): Promise<void> {
    switch (channel) {
      case 'SMS':
        if (!contact.phone) throw new AppError(400, 'NO_PHONE', 'Contact has no phone number')
        await smsSender.send(contact.phone, body, tenantId)
        break
      case 'EMAIL':
        if (!contact.email) throw new AppError(400, 'NO_EMAIL', 'Contact has no email address')
        await emailSender.send(contact.email, subject ?? '(No subject)', body)
        break
      case 'WHATSAPP':
        if (!contact.whatsappPhone && !contact.phone) {
          throw new AppError(400, 'NO_WHATSAPP', 'Contact has no WhatsApp number')
        }
        await whatsappSender.send(contact.whatsappPhone ?? contact.phone!, body, tenantId)
        break
      case 'SLACK':
        // For Slack, 'to' should be the webhook URL
        logger.warn('SLACK channel dispatch requires webhookUrl in contact.phone field')
        if (contact.phone) await slackSender.send(contact.phone, body, subject)
        break
      case 'TEAMS':
        // For Teams, 'to' should be the webhook URL
        logger.warn('TEAMS channel dispatch requires webhookUrl in contact.phone field')
        if (contact.phone) await teamsSender.send(contact.phone, body, subject)
        break
      default:
        throw new AppError(400, 'INVALID_CHANNEL', `Unknown notification channel: ${channel as string}`)
    }
  }

  async getTemplates(tenantId: string, page = 1, pageSize = 20) {
    const where = tenantScope(tenantId)
    const [total, templates] = await Promise.all([
      this.prisma.notificationTemplate.count({ where }),
      this.prisma.notificationTemplate.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    return { templates, meta: paginationMeta(total, page, pageSize) }
  }

  async createTemplate(tenantId: string, data: CreateTemplateDto) {
    return this.prisma.notificationTemplate.create({
      data: { tenantId, ...data },
    })
  }

  async updateTemplate(tenantId: string, id: string, data: UpdateTemplateDto) {
    const existing = await this.prisma.notificationTemplate.findFirst({
      where: tenantScope(tenantId, { id }),
    })
    if (!existing) throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Template not found')
    if (existing.isSystem) throw new AppError(403, 'SYSTEM_TEMPLATE', 'System templates cannot be modified')

    return this.prisma.notificationTemplate.update({ where: { id }, data })
  }

  async previewTemplate(
    templateId: string,
    tenantId: string,
    variables: Record<string, unknown>,
  ): Promise<{ subject: string | null; body: string }> {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: tenantScope(tenantId, { id: templateId }),
    })
    if (!template) throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Template not found')

    return {
      subject: template.subject ? render(template.subject, variables) : null,
      body: render(template.body, variables),
    }
  }
}
