import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type AutomationTriggerType =
  | 'CONTACT_CREATED'
  | 'CONTACT_FIELD_UPDATED'
  | 'TRIP_STATUS_CHANGED'
  | 'TRIP_DELAY_FLAGGED'
  | 'QUOTE_CREATED'
  | 'QUOTE_ACCEPTED'
  | 'QUOTE_DECLINED'
  | 'QUOTE_EXPIRED'
  | 'TICKET_OPENED'
  | 'TICKET_STATUS_CHANGED'
  | 'PAYMENT_RECEIVED'
  | 'DOCUMENT_SIGNED'
  | 'SCHEDULED'
  | 'MANUAL'

export type AutomationActionType =
  | 'SEND_SMS'
  | 'SEND_EMAIL'
  | 'SEND_WHATSAPP'
  | 'SEND_SLACK'
  | 'SEND_TEAMS'
  | 'SEND_IN_APP'
  | 'UPDATE_CONTACT_FIELD'
  | 'CREATE_TICKET'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'WAIT_DELAY'
  | 'TRIGGER_AUTOMATION'
  | 'WEBHOOK'

export type ConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'GT'
  | 'LT'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY'
  | 'IN'
  | 'NOT_IN'

export interface AutomationCondition {
  id: string
  field: string
  operator: ConditionOperator
  value: string | null
}

export interface AutomationConditionGroup {
  id: string
  logicOperator: 'AND' | 'OR'
  conditions: AutomationCondition[]
  childGroups?: AutomationConditionGroup[]
}

export interface AutomationAction {
  id: string
  type: AutomationActionType
  order: number
  config: Record<string, unknown>
  templateId: string | null
}

export interface AutomationTrigger {
  id: string
  eventType: AutomationTriggerType
  config: Record<string, unknown>
}

export interface Automation {
  id: string
  name: string
  description: string | null
  isActive: boolean
  triggers: AutomationTrigger[]
  conditionGroups: AutomationConditionGroup[]
  actions: AutomationAction[]
  executionCount: number
  lastExecutedAt: string | null
  tenantId: string
  createdAt: string
  updatedAt: string
}

export interface AutomationFilters {
  search?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}

export interface CreateAutomationInput {
  name: string
  description?: string
  isActive?: boolean
  triggers: Array<{
    eventType: AutomationTriggerType
    config?: Record<string, unknown>
  }>
  conditionGroups?: Array<{
    logicOperator: 'AND' | 'OR'
    conditions: Array<{
      field: string
      operator: ConditionOperator
      value?: string
    }>
  }>
  actions: Array<{
    type: AutomationActionType
    order: number
    config: Record<string, unknown>
    templateId?: string
  }>
}

export interface ExecutionLog {
  id: string
  automationId: string
  triggerEventType: string
  referenceEntityId: string | null
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  actionsExecuted: number
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
  context: Record<string, unknown>
}

export interface DryRunResult {
  conditionsMet: boolean
  conditionResults: Array<{
    groupId: string
    result: boolean
    conditions: Array<{
      field: string
      operator: string
      value: string | null
      actual: unknown
      result: boolean
    }>
  }>
  actionsToExecute: Array<{
    type: AutomationActionType
    order: number
    config: Record<string, unknown>
  }>
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

const AUTOMATIONS_KEY = 'automations'

export function useAutomations(filters?: AutomationFilters) {
  return useQuery({
    queryKey: [AUTOMATIONS_KEY, filters],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<Automation>>('/automations', {
        params: filters,
      })
      return response.data
    },
  })
}

export function useAutomation(id: string) {
  return useQuery({
    queryKey: [AUTOMATIONS_KEY, id],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Automation }>(`/automations/${id}`)
      return response.data.data
    },
    enabled: !!id,
  })
}

export function useCreateAutomation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateAutomationInput) => {
      const response = await apiClient.post<{ data: Automation }>('/automations', data)
      return response.data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_KEY] })
    },
  })
}

export function useUpdateAutomation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: Partial<CreateAutomationInput>
    }) => {
      const response = await apiClient.patch<{ data: Automation }>(`/automations/${id}`, data)
      return response.data.data
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_KEY] })
      void queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_KEY, id] })
    },
  })
}

export function useDeleteAutomation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/automations/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_KEY] })
    },
  })
}

export function useToggleAutomation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<{ data: Automation }>(`/automations/${id}/toggle`)
      return response.data.data
    },
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_KEY] })
      void queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_KEY, id] })
    },
  })
}

export function useDryRunAutomation() {
  return useMutation({
    mutationFn: async ({ id, context }: { id: string; context: Record<string, unknown> }) => {
      const response = await apiClient.post<{ data: DryRunResult }>(
        `/automations/${id}/dry-run`,
        { context }
      )
      return response.data.data
    },
  })
}

export function useExecutionLogs(automationId: string, page = 1) {
  return useQuery({
    queryKey: [AUTOMATIONS_KEY, automationId, 'logs', page],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<ExecutionLog>>(
        `/automations/${automationId}/logs`,
        { params: { page, pageSize: 20 } }
      )
      return response.data
    },
    enabled: !!automationId,
  })
}
