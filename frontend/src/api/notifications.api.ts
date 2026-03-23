import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type NotificationChannel = 'SMS' | 'EMAIL' | 'WHATSAPP' | 'SLACK' | 'TEAMS' | 'IN_APP'

export interface TemplateVariable {
  id: string
  key: string
  description: string
  defaultValue: string | null
  required: boolean
}

export interface NotificationTemplate {
  id: string
  name: string
  channel: NotificationChannel
  subject: string | null
  body: string
  isSystem: boolean
  variables: TemplateVariable[]
  tenantId: string
  createdAt: string
  updatedAt: string
}

export interface TemplateFilters {
  channel?: NotificationChannel
  search?: string
  isSystem?: boolean
  page?: number
  pageSize?: number
}

export interface CreateTemplateInput {
  name: string
  channel: NotificationChannel
  subject?: string
  body: string
  variables?: Array<{
    key: string
    description: string
    defaultValue?: string
    required?: boolean
  }>
}

export interface PreviewTemplateInput {
  body: string
  subject?: string
  variables: Record<string, string>
}

export interface PreviewResult {
  subject: string | null
  body: string
  extractedVariables: string[]
  missingVariables: string[]
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

const TEMPLATES_KEY = 'notification-templates'

export function useNotificationTemplates(filters?: TemplateFilters) {
  return useQuery({
    queryKey: [TEMPLATES_KEY, filters],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<NotificationTemplate>>(
        '/notifications/templates',
        { params: filters }
      )
      return response.data
    },
  })
}

export function useNotificationTemplate(id: string) {
  return useQuery({
    queryKey: [TEMPLATES_KEY, id],
    queryFn: async () => {
      const response = await apiClient.get<{ data: NotificationTemplate }>(
        `/notifications/templates/${id}`
      )
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateTemplateInput) => {
      const response = await apiClient.post<NotificationTemplate>(
        '/notifications/templates',
        data
      )
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] })
    },
  })
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: Partial<CreateTemplateInput>
    }) => {
      const response = await apiClient.patch<NotificationTemplate>(
        `/notifications/templates/${id}`,
        data
      )
      return response.data
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] })
      void queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, id] })
    },
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/notifications/templates/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] })
    },
  })
}

export function usePreviewTemplate() {
  return useMutation({
    mutationFn: async (input: PreviewTemplateInput) => {
      const response = await apiClient.post<PreviewResult>(
        '/notifications/templates/preview',
        input
      )
      return response.data
    },
  })
}

export function useSendNotification() {
  return useMutation({
    mutationFn: async ({
      templateId,
      recipientId,
      variables,
    }: {
      templateId: string
      recipientId: string
      variables?: Record<string, string>
    }) => {
      const response = await apiClient.post<{ data: { messageId: string; status: string } }>(
        '/notifications/send',
        { templateId, recipientId, variables }
      )
      return response.data
    },
  })
}
