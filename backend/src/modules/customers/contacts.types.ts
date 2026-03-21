import { z } from 'zod'
import { ContactType, PreferredChannel } from '@prisma/client'

export const CreateContactSchema = z.object({
  type: z.nativeEnum(ContactType).default(ContactType.PASSENGER),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsappPhone: z.string().optional().nullable(),
  secondaryPhone: z.string().optional().nullable(),
  organizationId: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).optional().nullable(),
  preferredChannel: z.nativeEnum(PreferredChannel).default(PreferredChannel.EMAIL),
  doNotContact: z.boolean().default(false),
})

export const UpdateContactSchema = CreateContactSchema.partial()

export const ContactFiltersSchema = z.object({
  type: z.nativeEnum(ContactType).optional(),
  search: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  organizationId: z.string().optional(),
  doNotContact: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['firstName', 'lastName', 'email', 'createdAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})

export const AddNoteSchema = z.object({
  content: z.string().min(1).max(5000),
  isPrivate: z.boolean().default(false),
})

export const MergeContactsSchema = z.object({
  primaryId: z.string().min(1),
  duplicateId: z.string().min(1),
})

export type CreateContactDto = z.infer<typeof CreateContactSchema>
export type UpdateContactDto = z.infer<typeof UpdateContactSchema>
export type ContactFiltersDto = z.infer<typeof ContactFiltersSchema>
export type AddNoteDto = z.infer<typeof AddNoteSchema>
export type MergeContactsDto = z.infer<typeof MergeContactsSchema>
