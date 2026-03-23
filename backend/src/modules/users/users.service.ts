import * as argon2 from 'argon2'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../../shared/middleware/errorHandler'

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
}

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'AGENT', 'READ_ONLY']).default('AGENT'),
})

export const UpdateUserSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'AGENT', 'READ_ONLY']).optional(),
  isActive: z.boolean().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>

export class UsersService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string, page = 1, pageSize = 50) {
    const skip = (page - 1) * pageSize
    const where = { tenantId, deletedAt: null }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ])

    return {
      users,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    }
  }

  async create(tenantId: string, data: CreateUserInput) {
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: data.email, deletedAt: null },
    })
    if (existing) {
      throw new AppError(409, 'EMAIL_IN_USE', 'A user with this email already exists')
    }

    const passwordHash = await argon2.hash(data.password, ARGON2_OPTIONS as argon2.Options & { raw?: false })

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return user
  }

  async update(tenantId: string, id: string, data: UpdateUserInput) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async deactivate(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    })
  }
}
