import { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../../shared/middleware/errorHandler'
import { paginationMeta } from '../../shared/utils/response'

export const CreateAircraftSchema = z.object({
  tailNumber: z.string().min(1).max(20).toUpperCase(),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
  seats: z.number().min(1).max(500),
  rangeNm: z.number().min(0).optional().nullable(),
  homeBaseIcao: z.string().length(4).toUpperCase().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  amenities: z.record(z.unknown()).optional().nullable(),
})

export const UpdateAircraftSchema = CreateAircraftSchema.partial()

export const AddAvailabilitySchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  type: z.enum(['MAINTENANCE', 'CHARTER_BLOCK', 'OTHER']).default('OTHER'),
  notes: z.string().optional().nullable(),
})

export type CreateAircraftDto = z.infer<typeof CreateAircraftSchema>
export type UpdateAircraftDto = z.infer<typeof UpdateAircraftSchema>
export type AddAvailabilityDto = z.infer<typeof AddAvailabilitySchema>

export class AircraftService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string, page = 1, pageSize = 20, isActive?: boolean) {
    const where: Prisma.AircraftWhereInput = { tenantId, deletedAt: null }
    if (isActive !== undefined) where.isActive = isActive

    const [total, aircraft] = await Promise.all([
      this.prisma.aircraft.count({ where }),
      this.prisma.aircraft.findMany({
        where,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
          photos: { where: { isPrimary: true, deletedAt: null }, take: 1 },
          _count: { select: { trips: true } },
        },
        orderBy: { tailNumber: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return { aircraft, meta: paginationMeta(total, page, pageSize) }
  }

  async findById(tenantId: string, id: string) {
    const aircraft = await this.prisma.aircraft.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        owner: true,
        photos: { where: { deletedAt: null } },
        availabilities: {
          where: { deletedAt: null, endAt: { gte: new Date() } },
          orderBy: { startAt: 'asc' },
        },
      },
    })
    if (!aircraft) throw new AppError(404, 'AIRCRAFT_NOT_FOUND', 'Aircraft not found')
    return aircraft
  }

  async create(tenantId: string, data: CreateAircraftDto) {
    return this.prisma.aircraft.create({
      data: {
        tenantId,
        tailNumber: data.tailNumber,
        make: data.make,
        model: data.model,
        year: data.year ?? undefined,
        seats: data.seats,
        rangeNm: data.rangeNm ?? undefined,
        homeBaseIcao: data.homeBaseIcao ?? undefined,
        ownerId: data.ownerId ?? undefined,
        isActive: data.isActive,
        amenities: data.amenities != null ? JSON.stringify(data.amenities) : null,
      },
    })
  }

  async update(tenantId: string, id: string, data: UpdateAircraftDto) {
    const existing = await this.prisma.aircraft.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new AppError(404, 'AIRCRAFT_NOT_FOUND', 'Aircraft not found')

    return this.prisma.aircraft.update({ where: { id }, data: data as Prisma.AircraftUpdateInput })
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.aircraft.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new AppError(404, 'AIRCRAFT_NOT_FOUND', 'Aircraft not found')
    await this.prisma.aircraft.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async addAvailability(tenantId: string, aircraftId: string, data: AddAvailabilityDto) {
    const aircraft = await this.prisma.aircraft.findFirst({ where: { id: aircraftId, tenantId, deletedAt: null } })
    if (!aircraft) throw new AppError(404, 'AIRCRAFT_NOT_FOUND', 'Aircraft not found')

    // Check for conflicts
    const conflict = await this.prisma.aircraftAvailability.findFirst({
      where: {
        aircraftId,
        tenantId,
        deletedAt: null,
        AND: [
          { startAt: { lte: new Date(data.endAt) } },
          { endAt: { gte: new Date(data.startAt) } },
        ],
      },
    })

    if (conflict) {
      throw new AppError(409, 'AVAILABILITY_CONFLICT', 'Aircraft has a conflicting availability block in this time range')
    }

    return this.prisma.aircraftAvailability.create({
      data: {
        tenantId,
        aircraftId,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        type: data.type as never,
        notes: data.notes ?? undefined,
      },
    })
  }

  async checkAvailability(tenantId: string, aircraftId: string, startAt: Date, endAt: Date): Promise<boolean> {
    const conflict = await this.prisma.aircraftAvailability.findFirst({
      where: {
        aircraftId,
        tenantId,
        deletedAt: null,
        AND: [
          { startAt: { lte: endAt } },
          { endAt: { gte: startAt } },
        ],
      },
    })

    return !conflict
  }

  async assignOwner(tenantId: string, aircraftId: string, ownerId: string | null) {
    const aircraft = await this.prisma.aircraft.findFirst({ where: { id: aircraftId, tenantId, deletedAt: null } })
    if (!aircraft) throw new AppError(404, 'AIRCRAFT_NOT_FOUND', 'Aircraft not found')

    if (ownerId) {
      const owner = await this.prisma.contact.findFirst({ where: { id: ownerId, tenantId, deletedAt: null } })
      if (!owner) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Owner contact not found')
    }

    return this.prisma.aircraft.update({ where: { id: aircraftId }, data: { ownerId } })
  }
}
