import { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../../shared/middleware/errorHandler'
import { paginationMeta } from '../../shared/utils/response'
import { tenantScope } from '../../shared/utils/prismaScope'

export const CreateCrewMemberSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  role: z.enum(['CAPTAIN', 'FIRST_OFFICER', 'FLIGHT_ATTENDANT', 'DISPATCHER', 'MECHANIC', 'OTHER']),
  licenseNumber: z.string().optional().nullable(),
  licenseType: z.string().optional().nullable(),
  typeRatings: z.array(z.string()).optional().nullable(),
  medicalClass: z.enum(['CLASS_1', 'CLASS_2', 'CLASS_3']).optional().nullable(),
  medicalExpiry: z.string().datetime().optional().nullable(),
  licenseExpiry: z.string().datetime().optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
})

export const UpdateCrewMemberSchema = CreateCrewMemberSchema.partial()

export const AddCrewDocumentSchema = z.object({
  type: z.enum(['LICENSE', 'MEDICAL', 'TYPE_RATING', 'PASSPORT', 'TRAINING', 'OTHER']),
  name: z.string().min(1),
  expiryDate: z.string().datetime().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const AssignTripCrewSchema = z.object({
  crewMemberId: z.string(),
  role: z.enum(['CAPTAIN', 'FIRST_OFFICER', 'FLIGHT_ATTENDANT', 'OTHER']),
})

export type CreateCrewMemberDto = z.infer<typeof CreateCrewMemberSchema>
export type UpdateCrewMemberDto = z.infer<typeof UpdateCrewMemberSchema>
export type AddCrewDocumentDto = z.infer<typeof AddCrewDocumentSchema>
export type AssignTripCrewDto = z.infer<typeof AssignTripCrewSchema>

export class CrewService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string, page = 1, pageSize = 50, role?: string, isActive?: boolean) {
    const where: Prisma.CrewMemberWhereInput = tenantScope(tenantId)
    if (role) where.role = role
    if (isActive !== undefined) where.isActive = isActive

    const [total, crew] = await Promise.all([
      this.prisma.crewMember.count({ where }),
      this.prisma.crewMember.findMany({
        where,
        include: { documents: { where: { deletedAt: null } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return { crew, meta: paginationMeta(total, page, pageSize) }
  }

  async findById(tenantId: string, id: string) {
    const member = await this.prisma.crewMember.findFirst({
      where: tenantScope(tenantId, { id }),
      include: {
        documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        tripAssignments: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { trip: { select: { id: true, status: true, originIcao: true, destinationIcao: true, departureAt: true } } },
        },
      },
    })
    if (!member) throw new AppError(404, 'CREW_NOT_FOUND', 'Crew member not found')
    return member
  }

  async create(tenantId: string, data: CreateCrewMemberDto) {
    return this.prisma.crewMember.create({
      data: {
        tenantId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        role: data.role,
        licenseNumber: data.licenseNumber ?? undefined,
        licenseType: data.licenseType ?? undefined,
        typeRatings: data.typeRatings ? JSON.stringify(data.typeRatings) : undefined,
        medicalClass: data.medicalClass ?? undefined,
        medicalExpiry: data.medicalExpiry ? new Date(data.medicalExpiry) : undefined,
        licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : undefined,
        isActive: data.isActive,
        notes: data.notes ?? undefined,
      },
    })
  }

  async update(tenantId: string, id: string, data: UpdateCrewMemberDto) {
    const existing = await this.prisma.crewMember.findFirst({ where: tenantScope(tenantId, { id }) })
    if (!existing) throw new AppError(404, 'CREW_NOT_FOUND', 'Crew member not found')

    return this.prisma.crewMember.update({
      where: { id },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.role && { role: data.role }),
        ...(data.licenseNumber !== undefined && { licenseNumber: data.licenseNumber }),
        ...(data.licenseType !== undefined && { licenseType: data.licenseType }),
        ...(data.typeRatings !== undefined && { typeRatings: data.typeRatings ? JSON.stringify(data.typeRatings) : null }),
        ...(data.medicalClass !== undefined && { medicalClass: data.medicalClass }),
        ...(data.medicalExpiry !== undefined && { medicalExpiry: data.medicalExpiry ? new Date(data.medicalExpiry) : null }),
        ...(data.licenseExpiry !== undefined && { licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.crewMember.findFirst({ where: tenantScope(tenantId, { id }) })
    if (!existing) throw new AppError(404, 'CREW_NOT_FOUND', 'Crew member not found')
    await this.prisma.crewMember.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async addDocument(tenantId: string, crewMemberId: string, data: AddCrewDocumentDto) {
    const member = await this.prisma.crewMember.findFirst({ where: tenantScope(tenantId, { id: crewMemberId }) })
    if (!member) throw new AppError(404, 'CREW_NOT_FOUND', 'Crew member not found')

    return this.prisma.crewDocument.create({
      data: {
        tenantId,
        crewMemberId,
        type: data.type,
        name: data.name,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        fileUrl: data.fileUrl ?? undefined,
        notes: data.notes ?? undefined,
      },
    })
  }

  async deleteDocument(tenantId: string, documentId: string): Promise<void> {
    const doc = await this.prisma.crewDocument.findFirst({ where: tenantScope(tenantId, { id: documentId }) })
    if (!doc) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found')
    await this.prisma.crewDocument.update({ where: { id: documentId }, data: { deletedAt: new Date() } })
  }

  async assignToTrip(tenantId: string, tripId: string, data: AssignTripCrewDto) {
    const [trip, member] = await Promise.all([
      this.prisma.trip.findFirst({ where: tenantScope(tenantId, { id: tripId }) }),
      this.prisma.crewMember.findFirst({ where: tenantScope(tenantId, { id: data.crewMemberId }) }),
    ])
    if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND', 'Trip not found')
    if (!member) throw new AppError(404, 'CREW_NOT_FOUND', 'Crew member not found')

    return this.prisma.tripCrewAssignment.upsert({
      where: { tripId_crewMemberId: { tripId, crewMemberId: data.crewMemberId } },
      create: { tenantId, tripId, crewMemberId: data.crewMemberId, role: data.role },
      update: { role: data.role },
    })
  }

  async removeFromTrip(tenantId: string, tripId: string, crewMemberId: string): Promise<void> {
    await this.prisma.tripCrewAssignment.deleteMany({ where: { tripId, crewMemberId, tenantId } })
  }

  async getExpiringDocuments(tenantId: string, daysAhead = 90) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + daysAhead)

    return this.prisma.crewMember.findMany({
      where: tenantScope(tenantId, {
        isActive: true,
        OR: [
          { medicalExpiry: { lte: cutoff } },
          { licenseExpiry: { lte: cutoff } },
          { documents: { some: { deletedAt: null, expiryDate: { lte: cutoff } } } },
        ],
      }),
      include: { documents: { where: { deletedAt: null, expiryDate: { lte: cutoff } } } },
    })
  }
}
