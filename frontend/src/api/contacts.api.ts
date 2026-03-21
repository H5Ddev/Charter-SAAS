import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  whatsappPhone: string | null
  type: 'OWNER' | 'PASSENGER' | 'BOTH'
  preferredChannel: string
  doNotContact: boolean
  tags: string[]
  city: string | null
  state: string | null
  country: string | null
  organizationId: string | null
  createdAt: string
}

export interface ContactFilters {
  type?: string
  search?: string
  tags?: string
  page?: number
  pageSize?: number
}

interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

const CONTACTS_KEY = 'contacts'

export function useContacts(filters?: ContactFilters) {
  return useQuery({
    queryKey: [CONTACTS_KEY, filters],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<Contact>>('/contacts', {
        params: filters,
      })
      return response.data
    },
  })
}

export function useContact(id: string) {
  return useQuery({
    queryKey: [CONTACTS_KEY, id],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Contact }>(`/contacts/${id}`)
      return response.data.data
    },
    enabled: !!id,
  })
}

export function useCreateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Contact>) => {
      const response = await apiClient.post<{ data: Contact }>('/contacts', data)
      return response.data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] })
    },
  })
}

export function useUpdateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Contact> }) => {
      const response = await apiClient.patch<{ data: Contact }>(`/contacts/${id}`, data)
      return response.data.data
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] })
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY, id] })
    },
  })
}

export function useDeleteContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/contacts/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] })
    },
  })
}

export function useAddNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ contactId, content, isPrivate }: { contactId: string; content: string; isPrivate?: boolean }) => {
      const response = await apiClient.post(`/contacts/${contactId}/notes`, { content, isPrivate })
      return response.data
    },
    onSuccess: (_data, { contactId }) => {
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY, contactId] })
    },
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ contactId, file }: { contactId: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      const response = await apiClient.post(`/contacts/${contactId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data
    },
    onSuccess: (_data, { contactId }) => {
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY, contactId] })
    },
  })
}
