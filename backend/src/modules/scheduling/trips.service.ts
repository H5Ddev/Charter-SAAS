import { PrismaClient, Prisma } from '@prisma/client'
import { TripStatus } from '../../shared/types/appEnums'
import { z } from 'zod'
import { AppError } from '../../shared/middleware/errorHandler'
import { eventPublisher } from '../../shared/events/publisher'
import { createEvent } from '../../shared/events/types'
import { env } from '../../config/env'
import { logger } from '../../shared/utils/logger'
import { paginationMeta } from '../../shared/utils/response'
import { optInService } from '../notifications/optin.service'

export const CreateTripSchema = z.object({
  aircraftId: z.string().optional().nullable(),
  originIcao: z.string().length(4).toUpperCase(),
  destinationIcao: z.string().length(4).toUpperCase(),
  departureAt: z.string().datetime(),
  arrivalAt: z.string().datetime().optional().nullable(),
  returnDepartureAt: z.string().datetime().optional().nullable(),
  returnArrivalAt: z.string().datetime().optional().nullable(),
  fboName: z.string().optional().nullable(),
  fboAddress: z.string().optional().nullable(),
  boardingTime: z.string().datetime().optional().nullable(),
  pilots: z.string().optional().nullable(),
  paxCount: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  quoteId: z.string().optional().nullable(),
  passengerIds: z.array(z.string()).default([]),
  crewIds: z.array(z.string()).default([]),
  distanceNm: z.number().optional().nullable(),
  estimatedHours: z.number().optional().nullable(),
})

export const UpdateTripSchema = z.object({
  aircraftId: z.string().optional().nullable(),
  originIcao: z.string().length(4).toUpperCase().optional(),
  destinationIcao: z.string().length(4).toUpperCase().optional(),
  departureAt: z.string().datetime().optional(),
  arrivalAt: z.string().datetime().optional().nullable(),
  returnDepartureAt: z.string().datetime().optional().nullable(),
  returnArrivalAt: z.string().datetime().optional().nullable(),
  paxCount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  fboName: z.string().optional().nullable(),
  boardingTime: z.string().datetime().optional().nullable(),
  crewIds: z.array(z.string()).optional(),
})

export type UpdateTripDto = z.infer<typeof UpdateTripSchema>

export const UpdateTripStatusSchema = z.object({
  status: z.string(),
  notes: z.string().optional().nullable(),
})

export const FlagDelaySchema = z.object({
  delayNotes: z.string().min(1),
})

export type CreateTripDto = z.infer<typeof CreateTripSchema>
export type UpdateTripStatusDto = z.infer<typeof UpdateTripStatusSchema>
export type FlagDelayDto = z.infer<typeof FlagDelaySchema>

export class TripsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string, filters: {
    status?: TripStatus
    page?: number
    pageSize?: number
  } = {}) {
    const { status, page = 1, pageSize = 20 } = filters
    const where: Prisma.TripWhereInput = { tenantId, deletedAt: null }
    if (status) where.status = status

    const [total, trips] = await Promise.all([
      this.prisma.trip.count({ where }),
      this.prisma.trip.findMany({
        where,
        include: {
          aircraft: { select: { id: true, tailNumber: true, make: true, model: true } },
          passengers: {
            include: { contact: { select: { id: true, firstName: true, lastName: true } } },
          },
          _count: { select: { tickets: true } },
        },
        orderBy: { departureAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return { trips, meta: paginationMeta(total, page, pageSize) }
  }

  async findById(tenantId: string, id: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        aircraft: true,
        passengers: {
          include: { contact: true },
        },
        statusHistory: { orderBy: { changedAt: 'desc' } },
        legs: { orderBy: { legNumber: 'asc' } },
        tickets: { where: { deletedAt: null }, take: 5 },
      },
    })
    if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found')
    return trip
  }

  async update(tenantId: string, id: string, data: UpdateTripDto) {
    const existing = await this.prisma.trip.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found')

    const trip = await this.prisma.trip.update({
      where: { id },
      data: {
        ...(data.aircraftId !== undefined && { aircraftId: data.aircraftId ?? undefined }),
        ...(data.originIcao && { originIcao: data.originIcao }),
        ...(data.destinationIcao && { destinationIcao: data.destinationIcao }),
        ...(data.departureAt && { departureAt: new Date(data.departureAt) }),
        ...(data.arrivalAt !== undefined && { arrivalAt: data.arrivalAt ? new Date(data.arrivalAt) : null }),
        ...(data.returnDepartureAt !== undefined && { returnDepartureAt: data.returnDepartureAt ? new Date(data.returnDepartureAt) : null }),
        ...(data.returnArrivalAt !== undefined && { returnArrivalAt: data.returnArrivalAt ? new Date(data.returnArrivalAt) : null }),
        ...(data.paxCount !== undefined && { paxCount: data.paxCount }),
        ...(data.notes !== undefined && { notes: data.notes ?? undefined }),
        ...(data.fboName !== undefined && { fboName: data.fboName ?? undefined }),
        ...(data.boardingTime !== undefined && { boardingTime: data.boardingTime ? new Date(data.boardingTime) : null }),
      },
      include: {
        aircraft: { select: { id: true, tailNumber: true, make: true, model: true } },
        crewAssignments: {
          include: { crewMember: { select: { id: true, firstName: true, lastName: true, role: true } } },
        },
        passengers: { include: { contact: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      },
    })

    // Replace crew assignments if provided
    if (data.crewIds !== undefined) {
      await this.prisma.tripCrewAssignment.deleteMany({ where: { tripId: id } })
      if (data.crewIds.length > 0) {
        await this.prisma.tripCrewAssignment.createMany({
          data: data.crewIds.map((crewMemberId) => ({ tenantId, tripId: id, crewMemberId, role: 'ASSIGNED' })),
        })
      }
    }

    return trip
  }

  async create(tenantId: string, userId: string, data: CreateTripDto) {
    // Check aircraft availability if provided
    if (data.aircraftId) {
      const conflict = await this.prisma.aircraftAvailability.findFirst({
        where: {
          aircraftId: data.aircraftId,
          tenantId,
          deletedAt: null,
          AND: [
            { startAt: { lte: new Date(data.arrivalAt ?? data.departureAt) } },
            { endAt: { gte: new Date(data.departureAt) } },
          ],
        },
      })
      if (conflict) {
        throw new AppError(409, 'AIRCRAFT_UNAVAILABLE', 'Aircraft has a conflicting availability block in this time range')
      }
    }

    const trip = await this.prisma.trip.create({
      data: {
        tenantId,
        aircraftId: data.aircraftId ?? undefined,
        status: TripStatus.INQUIRY,
        originIcao: data.originIcao,
        destinationIcao: data.destinationIcao,
        departureAt: new Date(data.departureAt),
        arrivalAt: data.arrivalAt ? new Date(data.arrivalAt) : undefined,
        returnDepartureAt: data.returnDepartureAt ? new Date(data.returnDepartureAt) : undefined,
        returnArrivalAt: data.returnArrivalAt ? new Date(data.returnArrivalAt) : undefined,
        fboName: data.fboName ?? undefined,
        fboAddress: data.fboAddress ?? undefined,
        boardingTime: data.boardingTime ? new Date(data.boardingTime) : undefined,
        pilots: data.pilots ?? undefined,
        paxCount: data.paxCount,
        notes: data.notes ?? undefined,
        quoteId: data.quoteId ?? undefined,
        statusHistory: {
          create: [{
            tenantId,
            fromStatus: null,
            toStatus: TripStatus.INQUIRY,
            changedBy: userId,
            changedAt: new Date(),
          }],
        },
        ...(data.passengerIds.length > 0 && {
          passengers: {
            create: data.passengerIds.map((contactId, i) => ({
              tenantId,
              contactId,
              isPrimary: i === 0,
            })),
          },
        }),
        ...(data.crewIds.length > 0 && {
          crewAssignments: {
            create: data.crewIds.map((crewMemberId) => ({
              tenantId,
              crewMemberId,
              role: 'ASSIGNED', // actual role is on the CrewMember record itself
            })),
          },
        }),
      },
      include: {
        aircraft: { select: { id: true, tailNumber: true, make: true, model: true } },
        crewAssignments: {
          include: { crewMember: { select: { id: true, firstName: true, lastName: true, role: true } } },
        },
      },
    })

    return trip
  }

  async updateStatus(tenantId: string, id: string, userId: string, data: UpdateTripStatusDto) {
    const existing = await this.prisma.trip.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        aircraft: true,
        passengers: { include: { contact: true }, where: { isPrimary: true } },
      },
    })

    if (!existing) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found')

    const fromStatus = existing.status
    const toStatus = data.status

    const updated = await this.prisma.trip.update({
      where: { id },
      data: {
        status: toStatus,
        statusHistory: {
          create: [{
            tenantId,
            fromStatus,
            toStatus,
            changedBy: userId,
            notes: data.notes ?? undefined,
            changedAt: new Date(),
          }],
        },
      },
    })

    // Publish TRIP_STATUS_CHANGED event
    const primaryPassenger = existing.passengers[0]?.contact
    try {
      await eventPublisher.publish(
        env.AZURE_SERVICE_BUS_QUEUE_AUTOMATION,
        createEvent(tenantId, 'TRIP_STATUS_CHANGED', {
          tripId: id,
          fromStatus,
          toStatus,
          changedBy: userId,
          aircraftId: existing.aircraftId ?? undefined,
          contactId: primaryPassenger?.id ?? undefined,
        }),
      )
    } catch {
      logger.warn('Failed to publish TRIP_STATUS_CHANGED event')
    }

    return updated
  }

  async flagDelay(tenantId: string, id: string, userId: string, data: FlagDelayDto) {
    const existing = await this.prisma.trip.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found')

    const updated = await this.prisma.trip.update({
      where: { id },
      data: { isDelayed: true, delayNotes: data.delayNotes },
    })

    try {
      await eventPublisher.publish(
        env.AZURE_SERVICE_BUS_QUEUE_AUTOMATION,
        createEvent(tenantId, 'TRIP_DELAY_FLAGGED', {
          tripId: id,
          delayNotes: data.delayNotes,
          flaggedBy: userId,
        }),
      )
    } catch {
      logger.warn('Failed to publish TRIP_DELAY_FLAGGED event')
    }

    return updated
  }

  async addPassenger(tenantId: string, tripId: string, contactId: string, isPrimary = false) {
    const [trip, contact] = await Promise.all([
      this.prisma.trip.findFirst({ where: { id: tripId, tenantId, deletedAt: null } }),
      this.prisma.contact.findFirst({ where: { id: contactId, tenantId, deletedAt: null } }),
    ])

    if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found')
    if (!contact) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found')

    const result = await this.prisma.tripPassenger.upsert({
      where: { tripId_contactId: { tripId, contactId } },
      create: { tenantId, tripId, contactId, isPrimary },
      update: { isPrimary },
    })

    // Fire opt-in solicitation asynchronously — non-blocking, won't fail the request
    optInService.solicitOnPassengerAdd(tenantId, contactId, tripId).catch((err) => {
      logger.warn('Opt-in solicitation failed silently', { contactId, tripId, error: err })
    })

    return result
  }

  async removePassenger(tenantId: string, tripId: string, passengerId: string) {
    const record = await this.prisma.tripPassenger.findFirst({
      where: { id: passengerId, tripId, tenantId },
    })
    if (!record) throw new AppError(404, 'PASSENGER_NOT_FOUND', 'Passenger not found on this trip')
    await this.prisma.tripPassenger.delete({ where: { id: passengerId } })
  }

  async getPaxManifest(tenantId: string, tripId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, tenantId, deletedAt: null },
      include: {
        passengers: {
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                type: true,
              },
            },
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    })

    if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found')

    return trip.passengers.map((p) => ({
      ...p.contact,
      isPrimary: p.isPrimary,
      seatNumber: p.seatNumber,
    }))
  }
}
