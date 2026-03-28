import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../../shared/middleware/errorHandler'

export const CreateCrewGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  aircraftId: z.string().optional().nullable(),
  minPax: z.number().int().min(1).optional().nullable(),
  maxPax: z.number().int().min(1).optional().nullable(),
})

export const UpdateCrewGroupSchema = CreateCrewGroupSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export type CreateCrewGroupDto = z.infer<typeof CreateCrewGroupSchema>
export type UpdateCrewGroupDto = z.infer<typeof UpdateCrewGroupSchema>

export class CrewGroupsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string) {
    return this.prisma.crewGroup.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        aircraft: { select: { id: true, tailNumber: true, make: true, model: true } },
        members: {
          include: {
            crewMember: {
              select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  async findById(tenantId: string, id: string) {
    const group = await this.prisma.crewGroup.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        aircraft: { select: { id: true, tailNumber: true, make: true, model: true } },
        members: {
          include: {
            crewMember: {
              select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
            },
          },
        },
      },
    })
    if (!group) throw new AppError(404, 'CREW_GROUP_NOT_FOUND', 'Crew group not found')
    return group
  }

  async create(tenantId: string, data: CreateCrewGroupDto) {
    return this.prisma.crewGroup.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description ?? undefined,
        aircraftId: data.aircraftId ?? undefined,
        minPax: data.minPax ?? undefined,
        maxPax: data.maxPax ?? undefined,
      },
      include: {
        aircraft: { select: { id: true, tailNumber: true, make: true, model: true } },
        members: { include: { crewMember: { select: { id: true, firstName: true, lastName: true, role: true, isActive: true } } } },
      },
    })
  }

  async update(tenantId: string, id: string, data: UpdateCrewGroupDto) {
    const existing = await this.prisma.crewGroup.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new AppError(404, 'CREW_GROUP_NOT_FOUND', 'Crew group not found')
    return this.prisma.crewGroup.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.aircraftId !== undefined && { aircraftId: data.aircraftId }),
        ...(data.minPax !== undefined && { minPax: data.minPax }),
        ...(data.maxPax !== undefined && { maxPax: data.maxPax }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        aircraft: { select: { id: true, tailNumber: true, make: true, model: true } },
        members: { include: { crewMember: { select: { id: true, firstName: true, lastName: true, role: true, isActive: true } } } },
      },
    })
  }

  async softDelete(tenantId: string, id: string) {
    const existing = await this.prisma.crewGroup.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new AppError(404, 'CREW_GROUP_NOT_FOUND', 'Crew group not found')
    await this.prisma.crewGroup.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async setMembers(tenantId: string, groupId: string, crewMemberIds: string[]) {
    const group = await this.prisma.crewGroup.findFirst({ where: { id: groupId, tenantId, deletedAt: null } })
    if (!group) throw new AppError(404, 'CREW_GROUP_NOT_FOUND', 'Crew group not found')

    // Verify all crew members belong to tenant
    if (crewMemberIds.length > 0) {
      const valid = await this.prisma.crewMember.findMany({
        where: { id: { in: crewMemberIds }, tenantId, deletedAt: null },
        select: { id: true },
      })
      if (valid.length !== crewMemberIds.length) {
        throw new AppError(400, 'INVALID_CREW_MEMBER', 'One or more crew members not found')
      }
    }

    // Replace all members
    await this.prisma.crewGroupMember.deleteMany({ where: { groupId } })
    if (crewMemberIds.length > 0) {
      await this.prisma.crewGroupMember.createMany({
        data: crewMemberIds.map((crewMemberId) => ({ tenantId, groupId, crewMemberId })),
      })
    }

    return this.findById(tenantId, groupId)
  }

  async assignGroupToTrip(tenantId: string, groupId: string, tripId: string) {
    const group = await this.findById(tenantId, groupId)

    // Remove existing crew assignments for this trip
    await this.prisma.tripCrewAssignment.deleteMany({ where: { tripId, tenantId } })

    // Assign all group members
    if (group.members.length > 0) {
      await this.prisma.tripCrewAssignment.createMany({
        data: group.members.map((m) => ({
          tenantId,
          tripId,
          crewMemberId: m.crewMemberId,
          role: m.crewMember.role,
        })),
      })
    }

    return group
  }
}
