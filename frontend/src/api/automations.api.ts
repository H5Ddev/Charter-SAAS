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
  | 'TICKET_SLA_BREACHED'
  | 'TICKET_ESCALATED'
  | 'PAYMENT_STATUS_CHANGED'
  | 'INBOUND_WEBHOOK'
  | 'SCHEDULE_CRON'

export type AutomationActionType =
  | 'SEND_SMS'
  | 'SEND_EMAIL'
  | 'SEND_WHATSAPP'
  | 'SEND_SLACK'
  | 'SEND_TEAMS'
  | 'SEND_INAPP'
  | 'UPDATE_TRIP_FIELD'
  | 'UPDATE_CONTACT_FIELD'
  | 'CREATE_TICKET'
  | 'ASSIGN_TICKET'
  | 'WAIT_DELAY'
  | 'CHAIN_AUTOMATION'
  | 'FIRE_WEBHOOK'
  | 'ADD_NOTE'

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
  tenantId: string
  entityType: string | null
  entityId: string | null
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'
  actionsRun: number
  errorMessage: string | null
  duration: number | null
  triggeredAt: string
  createdAt: string
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

// Backend returns a flat shape; normalize it to the Automation interface
interface BackendAutomation {
  id: string
  name: string
  description: string | null
  enabled?: boolean
  isActive?: boolean
  triggerType?: string
  triggerConfig?: string
  trigger?: { id: string; eventType: string; filters?: string }
  triggers?: AutomationTrigger[]
  _count?: { actions?: number; executionLogs?: number }
  executionCount?: number
  lastExecutedAt?: string | null
  conditionGroups?: AutomationConditionGroup[]
  actions?: AutomationAction[]
  tenantId: string
  createdAt: string
  updatedAt: string
}

function parseJson(s: string | null | undefined): Record<string, unknown> {
  try { return s ? (JSON.parse(s) as Record<string, unknown>) : {} } catch { return {} }
}

function normalizeAutomation(raw: BackendAutomation): Automation {
  const triggers: AutomationTrigger[] = raw.triggers?.length
    ? raw.triggers
    : raw.trigger
      ? [{
          id: raw.trigger.id,
          eventType: raw.trigger.eventType as AutomationTriggerType,
          config: parseJson(raw.trigger.filters),
        }]
      : raw.triggerType
        ? [{ id: raw.id, eventType: raw.triggerType as AutomationTriggerType, config: parseJson(raw.triggerConfig) }]
        : []

  // Normalize condition groups: DB uses `operator`, frontend expects `logicOperator`
  const conditionGroups: AutomationConditionGroup[] = (raw.conditionGroups ?? []).map((g) => ({
    ...g,
    logicOperator: (g.logicOperator ?? (g as unknown as { operator: string }).operator ?? 'AND') as 'AND' | 'OR',
  }))

  // Normalize actions: DB uses `actionType`/`sequence`, frontend expects `type`/`order`
  const actions: AutomationAction[] = (raw.actions ?? []).map((a) => {
    const raw_a = a as unknown as { actionType?: string; sequence?: number; type?: string; order?: number; config?: Record<string, unknown> | string }
    return {
      ...a,
      type: (raw_a.type ?? raw_a.actionType ?? '') as AutomationActionType,
      order: raw_a.order ?? raw_a.sequence ?? 0,
      config: typeof raw_a.config === 'string' ? parseJson(raw_a.config) : (raw_a.config ?? {}),
      templateId: (a as unknown as { templateId?: string }).templateId ?? null,
    }
  })

  // lastExecutedAt: prefer direct field, else derive from included executionLogs
  const rawAny = raw as unknown as { executionLogs?: Array<{ triggeredAt: string }> }
  const lastExecutedAt =
    raw.lastExecutedAt ??
    rawAny.executionLogs?.[0]?.triggeredAt ??
    null

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    isActive: raw.isActive ?? raw.enabled ?? false,
    triggers,
    conditionGroups,
    actions,
    executionCount: raw.executionCount ?? raw._count?.executionLogs ?? 0,
    lastExecutedAt,
    tenantId: raw.tenantId,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

const AUTOMATIONS_KEY = 'automations'

export function useAutomations(filters?: AutomationFilters) {
  return useQuery({
    queryKey: [AUTOMATIONS_KEY, filters],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<BackendAutomation>>('/automations', {
        params: filters,
      })
      const raw = response.data as PaginatedResponse<BackendAutomation>
      return { ...raw, data: raw.data.map(normalizeAutomation) } as PaginatedResponse<Automation>
    },
  })
}

export function useAutomation(id: string) {
  return useQuery({
    queryKey: [AUTOMATIONS_KEY, id],
    queryFn: async () => {
      const response = await apiClient.get<BackendAutomation>(`/automations/${id}`)
      return normalizeAutomation(response.data as BackendAutomation)
    },
    enabled: !!id,
  })
}

export function useCreateAutomation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateAutomationInput) => {
      const response = await apiClient.post<Automation>('/automations', data)
      return response.data
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
      const response = await apiClient.patch<Automation>(`/automations/${id}`, data)
      return response.data
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
      const response = await apiClient.post<Automation>(`/automations/${id}/toggle`)
      return response.data
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
      const response = await apiClient.post<DryRunResult>(
        `/automations/${id}/dry-run`,
        { context }
      )
      return response.data
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
