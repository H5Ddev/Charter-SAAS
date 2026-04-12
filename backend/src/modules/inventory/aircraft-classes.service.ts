import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../../shared/middleware/errorHandler'
import { tenantScope } from '../../shared/utils/prismaScope'

export const CrewReqSchema = z.object({
  role: z.enum(['CAPTAIN', 'FIRST_OFFICER', 'FLIGHT_ATTENDANT', 'DISPATCHER', 'MECHANIC', 'OTHER']),
  minCount: z.number().int().min(1).default(1),
  perPax: z.number().int().min(1).optional().nullable(),
})

export const CreateAircraftClassSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  regulatoryCategory: z.string().optional().nullable(),
  minSeats: z.number().int().min(1).optional().nullable(),
  maxSeats: z.number().int().min(1).optional().nullable(),
  minRangeNm: z.number().int().min(0).optional().nullable(),
  maxRangeNm: z.number().int().min(0).optional().nullable(),
  crewReqs: z.array(CrewReqSchema).optional().default([]),
})

export const UpdateAircraftClassSchema = CreateAircraftClassSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export type CreateAircraftClassDto = z.infer<typeof CreateAircraftClassSchema>
export type UpdateAircraftClassDto = z.infer<typeof UpdateAircraftClassSchema>

const INCLUDE = {
  crewReqs: true,
  _count: { select: { aircraft: true } },
}

export class AircraftClassesService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string) {
    return this.prisma.aircraftClass.findMany({
      where: tenantScope(tenantId),
      include: INCLUDE,
      orderBy: { name: 'asc' },
    })
  }

  async findById(tenantId: string, id: string) {
    const cls = await this.prisma.aircraftClass.findFirst({
      where: tenantScope(tenantId, { id }),
      include: INCLUDE,
    })
    if (!cls) throw new AppError(404, 'AIRCRAFT_CLASS_NOT_FOUND', 'Aircraft class not found')
    return cls
  }

  async create(tenantId: string, data: CreateAircraftClassDto) {
    return this.prisma.aircraftClass.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description ?? undefined,
        regulatoryCategory: data.regulatoryCategory ?? undefined,
        minSeats: data.minSeats ?? undefined,
        maxSeats: data.maxSeats ?? undefined,
        minRangeNm: data.minRangeNm ?? undefined,
        maxRangeNm: data.maxRangeNm ?? undefined,
        crewReqs: {
          create: (data.crewReqs ?? []).map((r) => ({
            role: r.role,
            minCount: r.minCount,
            perPax: r.perPax ?? undefined,
          })),
        },
      },
      include: INCLUDE,
    })
  }

  async update(tenantId: string, id: string, data: UpdateAircraftClassDto) {
    const existing = await this.prisma.aircraftClass.findFirst({ where: tenantScope(tenantId, { id }) })
    if (!existing) throw new AppError(404, 'AIRCRAFT_CLASS_NOT_FOUND', 'Aircraft class not found')

    // Replace crew reqs if provided
    if (data.crewReqs !== undefined) {
      await this.prisma.aircraftClassCrewReq.deleteMany({ where: { classId: id } })
      if (data.crewReqs.length > 0) {
        await this.prisma.aircraftClassCrewReq.createMany({
          data: data.crewReqs.map((r) => ({
            classId: id,
            role: r.role,
            minCount: r.minCount,
            perPax: r.perPax ?? undefined,
          })),
        })
      }
    }

    return this.prisma.aircraftClass.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.regulatoryCategory !== undefined && { regulatoryCategory: data.regulatoryCategory }),
        ...(data.minSeats !== undefined && { minSeats: data.minSeats }),
        ...(data.maxSeats !== undefined && { maxSeats: data.maxSeats }),
        ...(data.minRangeNm !== undefined && { minRangeNm: data.minRangeNm }),
        ...(data.maxRangeNm !== undefined && { maxRangeNm: data.maxRangeNm }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: INCLUDE,
    })
  }

  async softDelete(tenantId: string, id: string) {
    const existing = await this.prisma.aircraftClass.findFirst({ where: tenantScope(tenantId, { id }) })
    if (!existing) throw new AppError(404, 'AIRCRAFT_CLASS_NOT_FOUND', 'Aircraft class not found')
    await this.prisma.aircraftClass.update({ where: { id }, data: { deletedAt: new Date() } })
  }
}
