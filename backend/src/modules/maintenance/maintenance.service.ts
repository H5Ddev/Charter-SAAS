import { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../../shared/middleware/errorHandler'
import { paginationMeta } from '../../shared/utils/response'

export const CreateMaintenanceSchema = z.object({
  aircraftId: z.string(),
  type: z.enum(['SCHEDULED', 'UNSCHEDULED', 'INSPECTION', 'REPAIR', 'AOG', 'AD_COMPLIANCE']),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED', 'CANCELLED']).default('SCHEDULED'),
  scheduledAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  vendor: z.string().optional().nullable(),
  cost: z.number().min(0).optional().nullable(),
  airframeHoursAtService: z.number().min(0).optional().nullable(),
  nextDueHours: z.number().min(0).optional().nullable(),
  nextDueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const UpdateMaintenanceSchema = CreateMaintenanceSchema.omit({ aircraftId: true }).partial()

export type CreateMaintenanceDto = z.infer<typeof CreateMaintenanceSchema>
export type UpdateMaintenanceDto = z.infer<typeof UpdateMaintenanceSchema>

export class MaintenanceService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string, page = 1, pageSize = 20, aircraftId?: string, status?: string) {
    const where: Prisma.MaintenanceRecordWhereInput = { tenantId, deletedAt: null }
    if (aircraftId) where.aircraftId = aircraftId
    if (status) where.status = status

    const [total, records] = await Promise.all([
      this.prisma.maintenanceRecord.count({ where }),
      this.prisma.maintenanceRecord.findMany({
        where,
        include: {
          aircraft: { select: { id: true, tailNumber: true, make: true, model: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return { records, meta: paginationMeta(total, page, pageSize) }
  }

  async findById(tenantId: string, id: string) {
    const record = await this.prisma.maintenanceRecord.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { aircraft: true },
    })
    if (!record) throw new AppError(404, 'MAINTENANCE_NOT_FOUND', 'Maintenance record not found')
    return record
  }

  async create(tenantId: string, data: CreateMaintenanceDto) {
    const aircraft = await this.prisma.aircraft.findFirst({ where: { id: data.aircraftId, tenantId, deletedAt: null } })
    if (!aircraft) throw new AppError(404, 'AIRCRAFT_NOT_FOUND', 'Aircraft not found')

    const record = await this.prisma.maintenanceRecord.create({
      data: {
        tenantId,
        aircraftId: data.aircraftId,
        type: data.type,
        title: data.title,
        description: data.description ?? undefined,
        status: data.status,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
        vendor: data.vendor ?? undefined,
        cost: data.cost ?? undefined,
        airframeHoursAtService: data.airframeHoursAtService ?? undefined,
        nextDueHours: data.nextDueHours ?? undefined,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined,
        notes: data.notes ?? undefined,
      },
    })

    // Block aircraft availability for SCHEDULED/IN_PROGRESS maintenance with a date
    if (data.scheduledAt && data.status !== 'COMPLETED' && data.status !== 'CANCELLED') {
      const endAt = data.completedAt
        ? new Date(data.completedAt)
        : new Date(new Date(data.scheduledAt).getTime() + 8 * 60 * 60 * 1000) // default 8hr block

      await this.prisma.aircraftAvailability.create({
        data: {
          tenantId,
          aircraftId: data.aircraftId,
          startAt: new Date(data.scheduledAt),
          endAt,
          type: 'MAINTENANCE',
          notes: data.title,
        },
      }).catch(() => { /* ignore conflicts */ })
    }

    return record
  }

  async update(tenantId: string, id: string, data: UpdateMaintenanceDto) {
    const existing = await this.prisma.maintenanceRecord.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new AppError(404, 'MAINTENANCE_NOT_FOUND', 'Maintenance record not found')

    const updated = await this.prisma.maintenanceRecord.update({
      where: { id },
      data: {
        ...(data.type && { type: data.type }),
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status && { status: data.status }),
        ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }),
        ...(data.completedAt !== undefined && { completedAt: data.completedAt ? new Date(data.completedAt) : null }),
        ...(data.vendor !== undefined && { vendor: data.vendor }),
        ...(data.cost !== undefined && { cost: data.cost }),
        ...(data.airframeHoursAtService !== undefined && { airframeHoursAtService: data.airframeHoursAtService }),
        ...(data.nextDueHours !== undefined && { nextDueHours: data.nextDueHours }),
        ...(data.nextDueDate !== undefined && { nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })

    // If completed, update aircraft airframe hours
    if (data.status === 'COMPLETED' && data.airframeHoursAtService) {
      await this.prisma.aircraft.update({
        where: { id: existing.aircraftId },
        data: { airframeHours: data.airframeHoursAtService },
      })
    }

    return updated
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.maintenanceRecord.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new AppError(404, 'MAINTENANCE_NOT_FOUND', 'Maintenance record not found')
    await this.prisma.maintenanceRecord.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async getDue(tenantId: string, daysAhead = 30) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + daysAhead)

    return this.prisma.maintenanceRecord.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        OR: [
          { scheduledAt: { lte: cutoff } },
          { nextDueDate: { lte: cutoff } },
        ],
      },
      include: { aircraft: { select: { id: true, tailNumber: true, make: true, model: true } } },
      orderBy: { scheduledAt: 'asc' },
    })
  }
}
