import { PrismaClient, Prisma } from '@prisma/client'
import { eventPublisher } from '../../shared/events/publisher'
import { createEvent } from '../../shared/events/types'
import { AppError } from '../../shared/middleware/errorHandler'
import { uploadBlob } from '../../config/azure'
import { env } from '../../config/env'
import { logger } from '../../shared/utils/logger'
import { paginationMeta } from '../../shared/utils/response'
import type {
  CreateContactDto,
  UpdateContactDto,
  ContactFiltersDto,
  AddNoteDto,
} from './contacts.types'

export class ContactsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string, filters: ContactFiltersDto) {
    const where: Prisma.ContactWhereInput = {
      tenantId,
      deletedAt: null,
    }

    if (filters.type) where.type = filters.type
    if (filters.doNotContact !== undefined) where.doNotContact = filters.doNotContact
    if (filters.organizationId) where.organizationId = filters.organizationId

    if (filters.search) {
      const s = filters.search
      where.OR = [
        { firstName: { contains: s } },
        { lastName: { contains: s } },
        { email: { contains: s } },
        { phone: { contains: s } },
      ]
    }

    if (filters.tags) {
      const tagList = filters.tags.split(',').map((t) => t.trim())
      where.tagMaps = {
        some: {
          tag: { name: { in: tagList } },
        },
      }
    }

    const [total, contacts] = await Promise.all([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
        include: {
          organization: { select: { id: true, name: true } },
          tagMaps: { include: { tag: true } },
          _count: { select: { tickets: true, trips: true, quotes: true } },
        },
        orderBy: { [filters.sortBy]: filters.sortDir },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
    ])

    return {
      contacts: contacts.map((c) => ({
        ...c,
        tags: c.tagMaps.map((tm) => tm.tag.name),
      })),
      meta: paginationMeta(total, filters.page, filters.pageSize),
    }
  }

  async findById(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        organization: true,
        notes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        tagMaps: { include: { tag: true } },
        trips: {
          include: {
            trip: {
              select: {
                id: true,
                status: true,
                originIcao: true,
                destinationIcao: true,
                departureAt: true,
              },
            },
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        quotes: {
          where: { deletedAt: null },
          select: { id: true, status: true, totalPrice: true, currency: true, createdAt: true },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        tickets: {
          where: { deletedAt: null },
          select: { id: true, status: true, title: true, createdAt: true },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!contact) {
      throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found')
    }

    return {
      ...contact,
      tags: contact.tagMaps.map((tm) => tm.tag.name),
    }
  }

  async create(tenantId: string, userId: string, data: CreateContactDto) {
    const contact = await this.prisma.contact.create({
      data: {
        tenantId,
        type: data.type,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        whatsappPhone: data.whatsappPhone ?? undefined,
        secondaryPhone: data.secondaryPhone ?? undefined,
        organizationId: data.organizationId ?? undefined,
        addressLine1: data.addressLine1 ?? undefined,
        city: data.city ?? undefined,
        state: data.state ?? undefined,
        country: data.country ?? undefined,
        zipCode: data.zipCode ?? undefined,
        tags: JSON.stringify(data.tags),
        customFields: data.customFields as Prisma.InputJsonValue,
        preferredChannel: data.preferredChannel,
        doNotContact: data.doNotContact,
      },
    })

    // Publish event for automation engine
    try {
      await eventPublisher.publish(
        env.AZURE_SERVICE_BUS_QUEUE_AUTOMATION,
        createEvent(tenantId, 'CONTACT_CREATED', {
          contactId: contact.id,
          type: contact.type,
          email: contact.email ?? undefined,
          phone: contact.phone ?? undefined,
        }),
      )
    } catch {
      logger.warn('Failed to publish CONTACT_CREATED event')
    }

    return contact
  }

  async update(tenantId: string, id: string, userId: string, data: UpdateContactDto) {
    const existing = await this.prisma.contact.findFirst({
      where: { id, tenantId, deletedAt: null },
    })

    if (!existing) {
      throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found')
    }

    const updated = await this.prisma.contact.update({
      where: { id },
      data: {
        ...(data.type && { type: data.type }),
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.whatsappPhone !== undefined && { whatsappPhone: data.whatsappPhone }),
        ...(data.preferredChannel && { preferredChannel: data.preferredChannel }),
        ...(data.doNotContact !== undefined && { doNotContact: data.doNotContact }),
        ...(data.city && { city: data.city }),
        ...(data.state && { state: data.state }),
        ...(data.country && { country: data.country }),
        ...(data.tags && { tags: JSON.stringify(data.tags) }),
        ...(data.customFields !== undefined && {
          customFields: data.customFields as Prisma.InputJsonValue,
        }),
      },
    })

    // Publish CONTACT_FIELD_UPDATED for each changed field
    const changedFields = Object.keys(data).filter(
      (key) => data[key as keyof UpdateContactDto] !== existing[key as keyof typeof existing],
    )

    for (const field of changedFields) {
      try {
        await eventPublisher.publish(
          env.AZURE_SERVICE_BUS_QUEUE_AUTOMATION,
          createEvent(tenantId, 'CONTACT_FIELD_UPDATED', {
            contactId: id,
            field,
            oldValue: existing[field as keyof typeof existing],
            newValue: data[field as keyof UpdateContactDto],
            updatedBy: userId,
          }),
        )
      } catch {
        logger.warn(`Failed to publish CONTACT_FIELD_UPDATED for field ${field}`)
      }
    }

    return updated
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.contact.findFirst({
      where: { id, tenantId, deletedAt: null },
    })

    if (!existing) {
      throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found')
    }

    await this.prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  async merge(tenantId: string, primaryId: string, duplicateId: string) {
    if (primaryId === duplicateId) {
      throw new AppError(400, 'SAME_CONTACT', 'Cannot merge a contact with itself')
    }

    const [primary, duplicate] = await Promise.all([
      this.prisma.contact.findFirst({ where: { id: primaryId, tenantId, deletedAt: null } }),
      this.prisma.contact.findFirst({ where: { id: duplicateId, tenantId, deletedAt: null } }),
    ])

    if (!primary) throw new AppError(404, 'PRIMARY_NOT_FOUND', 'Primary contact not found')
    if (!duplicate) throw new AppError(404, 'DUPLICATE_NOT_FOUND', 'Duplicate contact not found')

    // Reassign all relations from duplicate to primary
    await this.prisma.$transaction([
      this.prisma.tripPassenger.updateMany({
        where: { contactId: duplicateId },
        data: { contactId: primaryId },
      }),
      this.prisma.ticket.updateMany({
        where: { contactId: duplicateId },
        data: { contactId: primaryId },
      }),
      this.prisma.quote.updateMany({
        where: { contactId: duplicateId },
        data: { contactId: primaryId },
      }),
      this.prisma.contactNote.updateMany({
        where: { contactId: duplicateId },
        data: { contactId: primaryId },
      }),
      this.prisma.contactDocument.updateMany({
        where: { contactId: duplicateId },
        data: { contactId: primaryId },
      }),
      // Soft delete the duplicate
      this.prisma.contact.update({
        where: { id: duplicateId },
        data: { deletedAt: new Date() },
      }),
    ])

    logger.info(`Contacts merged: ${duplicateId} → ${primaryId}`, { tenantId })

    return this.findById(tenantId, primaryId)
  }

  async addNote(
    tenantId: string,
    contactId: string,
    userId: string,
    data: AddNoteDto,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId, deletedAt: null },
    })

    if (!contact) {
      throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found')
    }

    return this.prisma.contactNote.create({
      data: {
        tenantId,
        contactId,
        userId,
        content: data.content,
        isPrivate: data.isPrivate,
      },
    })
  }

  async uploadDocument(
    tenantId: string,
    contactId: string,
    userId: string,
    file: {
      originalname: string
      mimetype: string
      buffer: Buffer
    },
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId, deletedAt: null },
    })

    if (!contact) {
      throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found')
    }

    const blobName = `contacts/${tenantId}/${contactId}/${Date.now()}-${file.originalname}`
    const blobUrl = await uploadBlob(
      env.AZURE_STORAGE_CONTAINER_DOCUMENTS,
      blobName,
      file.buffer,
      file.mimetype,
    )

    return this.prisma.contactDocument.create({
      data: {
        tenantId,
        contactId,
        fileName: file.originalname,
        fileType: file.mimetype,
        blobUrl,
        uploadedBy: userId,
      },
    })
  }

  async detectDuplicates(tenantId: string, email?: string, phone?: string) {
    if (!email && !phone) return []

    const orClauses: Prisma.ContactWhereInput[] = []
    if (email) orClauses.push({ email })
    if (phone) orClauses.push({ phone })

    return this.prisma.contact.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: orClauses,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    })
  }
}
