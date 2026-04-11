import { PrismaClient, Prisma } from '@prisma/client'
import { TicketStatus, TicketSource, TicketPriority } from '../../shared/types/appEnums'
import { z } from 'zod'
import { AppError } from '../../shared/middleware/errorHandler'
import { eventPublisher } from '../../shared/events/publisher'
import { createEvent } from '../../shared/events/types'
import { env } from '../../config/env'
import { logger } from '../../shared/utils/logger'
import { paginationMeta } from '../../shared/utils/response'

export const CreateTicketSchema = z.object({
  contactId: z.string().optional().nullable(),
  tripId: z.string().optional().nullable(),
  quoteId: z.string().optional().nullable(),
  source: z.string().default(TicketSource.MANUAL),
  priority: z.string().default(TicketPriority.NORMAL),
  title: z.string().min(1).max(255),
  body: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
})

export const UpdateTicketSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().optional().nullable(),
  title: z.string().optional(),
  body: z.string().optional().nullable(),
})

export const AddMessageSchema = z.object({
  content: z.string().min(1),
  isInternal: z.boolean().default(false),
  channel: z.string().optional(),
})

export const TicketFiltersSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  source: z.string().optional(),
  contactId: z.string().optional(),
  tripId: z.string().optional(),
  assignedTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export type CreateTicketDto = z.infer<typeof CreateTicketSchema>
export type UpdateTicketDto = z.infer<typeof UpdateTicketSchema>
export type AddMessageDto = z.infer<typeof AddMessageSchema>
export type TicketFiltersDto = z.infer<typeof TicketFiltersSchema>

export class TicketsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string, filters: TicketFiltersDto) {
    const where: Prisma.TicketWhereInput = { tenantId, deletedAt: null }
    if (filters.status) where.status = filters.status
    if (filters.priority) where.priority = filters.priority
    if (filters.source) where.source = filters.source
    if (filters.contactId) where.contactId = filters.contactId
    if (filters.tripId) where.tripId = filters.tripId
    if (filters.assignedTo) where.assignedTo = filters.assignedTo
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { body: { contains: filters.search } },
      ]
    }

    const [total, tickets] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          trip: { select: { id: true, status: true, originIcao: true, destinationIcao: true } },
          _count: { select: { messages: true, attachments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
    ])

    return { tickets, meta: paginationMeta(total, filters.page, filters.pageSize) }
  }

  async findById(tenantId: string, id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        contact: true,
        trip: { select: { id: true, status: true, originIcao: true, destinationIcao: true, departureAt: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
            contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        attachments: { where: { deletedAt: null } },
      },
    })
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found')
    return ticket
  }

  async create(tenantId: string, data: CreateTicketDto) {
    const ticket = await this.prisma.ticket.create({
      data: {
        tenantId,
        contactId: data.contactId ?? undefined,
        tripId: data.tripId ?? undefined,
        quoteId: data.quoteId ?? undefined,
        source: data.source,
        status: TicketStatus.OPEN,
        priority: data.priority,
        title: data.title,
        body: data.body ?? undefined,
        assignedTo: data.assignedTo ?? undefined,
        // SLA: URGENT = 1h, HIGH = 4h, NORMAL = 24h, LOW = 72h
        slaBreachAt: this.calcSlaBreachAt(data.priority),
      },
    })

    try {
      await eventPublisher.publish(
        env.AZURE_SERVICE_BUS_QUEUE_AUTOMATION,
        createEvent(tenantId, 'TICKET_OPENED', {
          ticketId: ticket.id,
          contactId: ticket.contactId ?? undefined,
          tripId: ticket.tripId ?? undefined,
          source: ticket.source,
          priority: ticket.priority,
          title: ticket.title,
        }),
      )
    } catch {
      logger.warn('Failed to publish TICKET_OPENED event')
    }

    return ticket
  }

  async updateStatus(tenantId: string, id: string, userId: string, update: UpdateTicketDto) {
    const existing = await this.prisma.ticket.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found')

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        ...(update.status && { status: update.status }),
        ...(update.priority && { priority: update.priority }),
        ...(update.assignedTo !== undefined && { assignedTo: update.assignedTo }),
        ...(update.status === 'RESOLVED' && { resolvedAt: new Date() }),
      },
    })

    return updated
  }

  async addMessage(tenantId: string, ticketId: string, userId: string, data: AddMessageDto) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, tenantId, deletedAt: null } })
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found')

    return this.prisma.ticketMessage.create({
      data: {
        tenantId,
        ticketId,
        userId,
        content: data.content,
        isInternal: data.isInternal,
        channel: data.channel ?? 'MANUAL',
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })
  }

  async getByContact(tenantId: string, contactId: string) {
    return this.prisma.ticket.findMany({
      where: { tenantId, contactId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  }

  async getByTrip(tenantId: string, tripId: string) {
    return this.prisma.ticket.findMany({
      where: { tenantId, tripId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
  }

  private calcSlaBreachAt(priority: string): Date {
    const hours: Record<TicketPriority, number> = {
      URGENT: 1,
      HIGH: 4,
      NORMAL: 24,
      LOW: 72,
    }
    const now = new Date()
    return new Date(now.getTime() + (hours[priority as TicketPriority] ?? 24) * 60 * 60 * 1000)
  }
}
