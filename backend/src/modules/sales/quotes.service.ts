import { PrismaClient, Prisma } from '@prisma/client'
import { QuoteStatus } from '../../shared/types/appEnums'
import { z } from 'zod'
import { AppError } from '../../shared/middleware/errorHandler'
import { eventPublisher } from '../../shared/events/publisher'
import { createEvent } from '../../shared/events/types'
import { env } from '../../config/env'
import { logger } from '../../shared/utils/logger'
import { paginationMeta } from '../../shared/utils/response'

export const CreateQuoteSchema = z.object({
  contactId: z.string().min(1),
  tripId: z.string().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  basePrice: z.number().min(0),
  currency: z.string().default('USD'),
  notes: z.string().optional().nullable(),
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0),
    category: z.string().optional().nullable(),
  })).default([]),
})

export const UpdateQuoteSchema = z.object({
  status: z.string().optional(),
  validUntil: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const AddLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  category: z.string().optional().nullable(),
})

export type CreateQuoteDto = z.infer<typeof CreateQuoteSchema>
export type UpdateQuoteDto = z.infer<typeof UpdateQuoteSchema>
export type AddLineItemDto = z.infer<typeof AddLineItemSchema>

export class QuotesService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string, page = 1, pageSize = 20, status?: QuoteStatus) {
    const where: Prisma.QuoteWhereInput = { tenantId, deletedAt: null }
    if (status) where.status = status

    const [total, quotes] = await Promise.all([
      this.prisma.quote.count({ where }),
      this.prisma.quote.findMany({
        where,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { lineItems: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return { quotes, meta: paginationMeta(total, page, pageSize) }
  }

  async findById(tenantId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        contact: true,
        lineItems: { where: { deletedAt: null } },
        versions: { orderBy: { versionNumber: 'desc' }, take: 5 },
        trips: { select: { id: true, status: true, originIcao: true, destinationIcao: true } },
      },
    })
    if (!quote) throw new AppError(404, 'QUOTE_NOT_FOUND', 'Quote not found')
    return quote
  }

  async create(tenantId: string, userId: string, data: CreateQuoteDto) {
    const totalPrice = data.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      data.basePrice,
    )

    const quote = await this.prisma.quote.create({
      data: {
        tenantId,
        contactId: data.contactId,
        status: QuoteStatus.DRAFT,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        basePrice: data.basePrice,
        totalPrice,
        currency: data.currency,
        notes: data.notes ?? undefined,
        lineItems: {
          create: data.lineItems.map((item) => ({
            tenantId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            category: item.category ?? undefined,
          })),
        },
        versions: {
          create: [{
            tenantId,
            versionNumber: 1,
            snapshotData: data as never,
            createdBy: userId,
          }],
        },
      },
    })

    try {
      await eventPublisher.publish(
        env.AZURE_SERVICE_BUS_QUEUE_AUTOMATION,
        createEvent(tenantId, 'QUOTE_CREATED', {
          quoteId: quote.id,
          contactId: data.contactId,
          basePrice: data.basePrice,
          totalPrice,
          currency: data.currency,
        }),
      )
    } catch {
      logger.warn('Failed to publish QUOTE_CREATED event')
    }

    return quote
  }

  async update(tenantId: string, id: string, userId: string, data: UpdateQuoteDto) {
    const existing = await this.prisma.quote.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new AppError(404, 'QUOTE_NOT_FOUND', 'Quote not found')

    const updated = await this.prisma.quote.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.validUntil !== undefined && {
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })

    // Publish events for status changes
    if (data.status && data.status !== existing.status) {
      const eventTypeMap: Partial<Record<QuoteStatus, 'QUOTE_ACCEPTED' | 'QUOTE_DECLINED' | 'QUOTE_EXPIRED'>> = {
        ACCEPTED: 'QUOTE_ACCEPTED',
        DECLINED: 'QUOTE_DECLINED',
        EXPIRED: 'QUOTE_EXPIRED',
      }
      const eventType = eventTypeMap[data.status as QuoteStatus]
      if (eventType) {
        try {
          await eventPublisher.publish(
            env.AZURE_SERVICE_BUS_QUEUE_AUTOMATION,
            createEvent(tenantId, eventType, {
              quoteId: id,
              contactId: existing.contactId,
            }),
          )
        } catch {
          logger.warn(`Failed to publish ${eventType} event`)
        }
      }
    }

    return updated
  }

  async addLineItem(tenantId: string, quoteId: string, data: AddLineItemDto) {
    const quote = await this.prisma.quote.findFirst({ where: { id: quoteId, tenantId, deletedAt: null } })
    if (!quote) throw new AppError(404, 'QUOTE_NOT_FOUND', 'Quote not found')

    const lineItem = await this.prisma.quoteLineItem.create({
      data: {
        tenantId,
        quoteId,
        description: data.description,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        total: data.quantity * data.unitPrice,
        category: data.category ?? undefined,
      },
    })

    // Recalculate total
    const allItems = await this.prisma.quoteLineItem.findMany({
      where: { quoteId, deletedAt: null },
    })
    const newTotal = allItems.reduce((sum, item) => sum + Number(item.total), Number(quote.basePrice))
    await this.prisma.quote.update({ where: { id: quoteId }, data: { totalPrice: newTotal } })

    return lineItem
  }

  async recordSignature(tenantId: string, id: string, signatureUrl: string) {
    const quote = await this.prisma.quote.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!quote) throw new AppError(404, 'QUOTE_NOT_FOUND', 'Quote not found')

    return this.prisma.quote.update({
      where: { id },
      data: {
        status: QuoteStatus.ACCEPTED,
        signatureUrl,
        signedAt: new Date(),
      },
    })
  }

  async convertToTrip(tenantId: string, quoteId: string, userId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenantId, deletedAt: null },
      include: { trips: true },
    })

    if (!quote) throw new AppError(404, 'QUOTE_NOT_FOUND', 'Quote not found')
    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new AppError(400, 'QUOTE_NOT_ACCEPTED', 'Quote must be accepted before converting to a trip')
    }
    if (quote.trips.length > 0) {
      throw new AppError(400, 'TRIP_ALREADY_EXISTS', 'This quote already has an associated trip')
    }

    const trip = await this.prisma.trip.create({
      data: {
        tenantId,
        status: 'BOOKED',
        quoteId,
        originIcao: 'KTBD', // Placeholder — should come from quote data
        destinationIcao: 'KTBD',
        departureAt: new Date(),
        paxCount: 0,
        statusHistory: {
          create: [{
            tenantId,
            fromStatus: null,
            toStatus: 'BOOKED',
            changedBy: userId,
            changedAt: new Date(),
            notes: `Created from quote ${quoteId}`,
          }],
        },
      },
    })

    return trip
  }
}
