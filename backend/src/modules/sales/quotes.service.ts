import { PrismaClient, Prisma } from '@prisma/client'
import { QuoteStatus } from '../../shared/types/appEnums'
import { z } from 'zod'
import { AppError } from '../../shared/middleware/errorHandler'
import { eventPublisher } from '../../shared/events/publisher'
import { createEvent } from '../../shared/events/types'
import { env } from '../../config/env'
import { logger } from '../../shared/utils/logger'
import { paginationMeta } from '../../shared/utils/response'
import { tenantScope } from '../../shared/utils/prismaScope'
import { generatePortalToken } from '../portal/portal.service'
import { smsSender } from '../notifications/channels/sms.sender'
import { emailSender } from '../notifications/channels/email.sender'

export const CreateQuoteSchema = z.object({
  contactId: z.string().min(1),
  tripId: z.string().optional().nullable(),
  originIcao: z.string().length(4).toUpperCase().optional().nullable(),
  destinationIcao: z.string().length(4).toUpperCase().optional().nullable(),
  tripType: z.enum(['ONE_WAY', 'ROUND_TRIP']).optional().nullable(),
  departureDate: z.string().datetime().optional().nullable(),
  returnDate: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  basePrice: z.number().min(0),
  currency: z.string().default('USD'),
  passengers: z.number().int().min(1).optional().nullable(),
  notes: z.string().optional().nullable(),
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0),
    category: z.string().optional().nullable(),
  })).default([]),
})

export const UpdateQuoteSchema = z.object({
  // Status transition (always allowed)
  status: z.string().optional(),
  // Content edits — only permitted while status is DRAFT
  originIcao: z.string().length(4).toUpperCase().optional().nullable(),
  destinationIcao: z.string().length(4).toUpperCase().optional().nullable(),
  tripType: z.enum(['ONE_WAY', 'ROUND_TRIP']).optional().nullable(),
  departureDate: z.string().datetime().optional().nullable(),
  returnDate: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  basePrice: z.number().min(0).optional(),
  currency: z.string().optional(),
  passengers: z.number().int().min(1).optional().nullable(),
  notes: z.string().optional().nullable(),
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0),
    category: z.string().optional().nullable(),
  })).optional(),
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

function generateReference(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `Q-${yy}${mm}${dd}-${suffix}`
}

export class QuotesService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string, page = 1, pageSize = 20, status?: QuoteStatus, contactId?: string) {
    const where: Prisma.QuoteWhereInput = tenantScope(tenantId)
    if (status) where.status = status
    if (contactId) where.contactId = contactId

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
      where: tenantScope(tenantId, { id }),
      include: {
        contact: true,
        lineItems: { where: { deletedAt: null } },
        versions: { orderBy: { versionNumber: 'desc' }, take: 5 },
        trips: { select: { id: true, status: true, originIcao: true, destinationIcao: true } },
      },
    })
    if (!quote) throw new AppError(404, 'QUOTE_NOT_FOUND', 'Quote not found')

    // Enrich with airport details for display
    const icaos = [quote.originIcao, quote.destinationIcao].filter(Boolean) as string[]
    const airports = icaos.length > 0
      ? await this.prisma.airport.findMany({
          where: { icaoCode: { in: icaos } },
          select: { icaoCode: true, name: true, municipality: true, isoCountry: true },
        })
      : []
    const airportMap = Object.fromEntries(airports.map((a: { icaoCode: string; name: string; municipality: string | null; isoCountry: string }) => [a.icaoCode, a]))

    return {
      ...quote,
      originAirport: quote.originIcao ? (airportMap[quote.originIcao] ?? null) : null,
      destinationAirport: quote.destinationIcao ? (airportMap[quote.destinationIcao] ?? null) : null,
    }
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
        reference: generateReference(),
        status: QuoteStatus.DRAFT,
        originIcao: data.originIcao ?? undefined,
        destinationIcao: data.destinationIcao ?? undefined,
        tripType: data.tripType ?? undefined,
        departureDate: data.departureDate ? new Date(data.departureDate) : undefined,
        returnDate: data.returnDate ? new Date(data.returnDate) : undefined,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        basePrice: data.basePrice,
        totalPrice,
        currency: data.currency,
        passengers: data.passengers ?? undefined,
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
            snapshotData: JSON.stringify(data),
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
    const existing = await this.prisma.quote.findFirst({ where: tenantScope(tenantId, { id }) })
    if (!existing) throw new AppError(404, 'QUOTE_NOT_FOUND', 'Quote not found')

    // Content edits require DRAFT status
    const contentFields = ['originIcao', 'destinationIcao', 'tripType', 'departureDate', 'returnDate',
      'basePrice', 'currency', 'passengers', 'notes', 'validUntil', 'lineItems'] as const
    const hasContentChange = contentFields.some((k) => data[k] !== undefined)
    if (hasContentChange && existing.status !== QuoteStatus.DRAFT) {
      throw new AppError(409, 'QUOTE_LOCKED', 'This quote is locked. Only draft quotes can be edited.')
    }

    // If line items are being replaced, soft-delete existing and recalculate total
    if (data.lineItems !== undefined) {
      await this.prisma.quoteLineItem.updateMany({
        where: { quoteId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      })
    }

    const basePrice = data.basePrice ?? Number(existing.basePrice)
    const lineItemsTotal = (data.lineItems ?? []).reduce(
      (sum, item) => sum + item.quantity * item.unitPrice, 0
    )
    const totalPrice = data.lineItems !== undefined
      ? basePrice + lineItemsTotal
      : undefined

    const updated = await this.prisma.quote.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.originIcao !== undefined && { originIcao: data.originIcao }),
        ...(data.destinationIcao !== undefined && { destinationIcao: data.destinationIcao }),
        ...(data.tripType !== undefined && { tripType: data.tripType }),
        ...(data.departureDate !== undefined && { departureDate: data.departureDate ? new Date(data.departureDate) : null }),
        ...(data.returnDate !== undefined && { returnDate: data.returnDate ? new Date(data.returnDate) : null }),
        ...(data.validUntil !== undefined && { validUntil: data.validUntil ? new Date(data.validUntil) : null }),
        ...(data.basePrice !== undefined && { basePrice: data.basePrice }),
        ...(totalPrice !== undefined && { totalPrice }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.passengers !== undefined && { passengers: data.passengers }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.lineItems !== undefined && {
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
        }),
      },
    })

    // Send portal link to client when quote is first sent
    if (data.status === QuoteStatus.SENT && existing.status !== QuoteStatus.SENT) {
      try {
        const [contact, tenant] = await Promise.all([
          this.prisma.contact.findFirst({
            where: { id: existing.contactId, tenantId },
            select: { firstName: true, phone: true, email: true },
          }),
          this.prisma.tenant.findFirst({
            where: { id: tenantId },
            select: { name: true },
          }),
        ])

        if (contact && (contact.phone || contact.email)) {
          const portalToken = generatePortalToken(existing.contactId, tenantId)
          const portalUrl = `${env.FRONTEND_URL}/portal/${portalToken}`
          const company = tenant?.name ?? 'Your charter operator'
          const validUntilStr = updated.validUntil
            ? ` Valid until ${new Date(updated.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`
            : ''

          if (env.NODE_ENV !== 'production') {
            logger.info(`[DEV] Quote portal link for ${contact.email ?? contact.phone}: ${portalUrl}`)
          } else if (contact.phone) {
            const body = `✈️ ${company} has sent you a quote for your upcoming flight. Review and respond here: ${portalUrl}${validUntilStr}`
            await smsSender.send(contact.phone, body, tenantId)
          } else if (contact.email) {
            const subject = `Your charter quote from ${company}`
            const body = `Hi ${contact.firstName},\n\n${company} has prepared a quote for your upcoming flight.\n\nReview, accept, or decline here:\n${portalUrl}${validUntilStr}\n\nThank you,\n${company}`
            await emailSender.send(contact.email, subject, body)
          }
        }
      } catch (err) {
        logger.warn('Failed to send quote notification', { error: err, quoteId: id })
      }
    }

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
    const quote = await this.prisma.quote.findFirst({ where: tenantScope(tenantId, { id: quoteId }) })
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
    const quote = await this.prisma.quote.findFirst({ where: tenantScope(tenantId, { id }) })
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
      where: tenantScope(tenantId, { id: quoteId }),
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
