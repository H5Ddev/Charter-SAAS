import { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../../shared/middleware/errorHandler'
import { paginationMeta } from '../../shared/utils/response'
import { tenantScope } from '../../shared/utils/prismaScope'

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  industry: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  phone: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
})

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial()

export const OrgFiltersSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>
export type UpdateOrganizationDto = z.infer<typeof UpdateOrganizationSchema>
export type OrgFiltersDto = z.infer<typeof OrgFiltersSchema>

export class OrganizationsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string, filters: OrgFiltersDto) {
    const where: Prisma.OrganizationWhereInput = tenantScope(tenantId)

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { industry: { contains: filters.search } },
      ]
    }

    const [total, orgs] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        include: {
          _count: { select: { contacts: true } },
        },
        orderBy: { name: 'asc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
    ])

    return {
      organizations: orgs,
      meta: paginationMeta(total, filters.page, filters.pageSize),
    }
  }

  async findById(tenantId: string, id: string) {
    const org = await this.prisma.organization.findFirst({
      where: tenantScope(tenantId, { id }),
      include: {
        contacts: {
          where: { deletedAt: null },
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
    })

    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found')
    return org
  }

  async create(tenantId: string, data: CreateOrganizationDto) {
    return this.prisma.organization.create({
      data: { tenantId, ...data },
    })
  }

  async update(tenantId: string, id: string, data: UpdateOrganizationDto) {
    const existing = await this.prisma.organization.findFirst({
      where: tenantScope(tenantId, { id }),
    })

    if (!existing) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found')

    return this.prisma.organization.update({ where: { id }, data })
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.organization.findFirst({
      where: tenantScope(tenantId, { id }),
    })

    if (!existing) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found')

    await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
}
