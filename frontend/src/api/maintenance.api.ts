import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type MaintenanceType = 'SCHEDULED' | 'UNSCHEDULED' | 'INSPECTION' | 'REPAIR' | 'AOG' | 'AD_COMPLIANCE'
export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED' | 'CANCELLED'

export interface MaintenanceRecord {
  id: string
  aircraftId: string
  aircraft: { id: string; tailNumber: string; make: string; model: string }
  type: MaintenanceType
  title: string
  description: string | null
  status: MaintenanceStatus
  scheduledAt: string | null
  completedAt: string | null
  vendor: string | null
  cost: number | string | null
  airframeHoursAtService: number | null
  nextDueHours: number | null
  nextDueDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateMaintenanceInput {
  aircraftId: string
  type: MaintenanceType
  title: string
  description?: string
  status?: MaintenanceStatus
  scheduledAt?: string
  completedAt?: string
  vendor?: string
  cost?: number
  airframeHoursAtService?: number
  nextDueHours?: number
  nextDueDate?: string
  notes?: string
}

interface PaginatedResponse<T> {
  data: T[]
  meta: { total: number; page: number; pageSize: number; totalPages: number }
}

const MAINT_KEY = 'maintenance'

export function useMaintenance(filters?: { aircraftId?: string; status?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: [MAINT_KEY, filters],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<MaintenanceRecord>>('/maintenance', { params: filters })
      return response.data as PaginatedResponse<MaintenanceRecord>
    },
  })
}

export function useCreateMaintenance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateMaintenanceInput) => {
      const response = await apiClient.post<MaintenanceRecord>('/maintenance', data)
      return response.data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [MAINT_KEY] }),
  })
}

export function useUpdateMaintenance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateMaintenanceInput> & { status?: MaintenanceStatus } }) => {
      const response = await apiClient.patch<MaintenanceRecord>(`/maintenance/${id}`, data)
      return response.data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [MAINT_KEY] }),
  })
}

export function useDeleteMaintenance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/maintenance/${id}`) },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [MAINT_KEY] }),
  })
}
