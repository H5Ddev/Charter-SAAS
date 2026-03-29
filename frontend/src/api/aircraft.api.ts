import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export interface CreateAircraftInput {
  tailNumber: string
  make: string
  model: string
  year?: number
  seats: number
  rangeNm?: number
  homeBaseIcao?: string
  ownerId?: string
  isActive?: boolean
  costPerHour?: number
  hourlyRate?: number
  basePrice?: number
  aircraftClassId?: string | null
}

// Backend returns tailNumber/seats; AircraftPage expects registration/seatingCapacity
interface BackendAircraft {
  id: string
  tailNumber: string
  make: string
  model: string
  year: number | null
  seats: number
  rangeNm: number | null
  isActive: boolean
  homeBaseIcao: string | null
  costPerHour: number | string | null
  hourlyRate: number | string | null
  basePrice: number | string | null
  aircraftClassId: string | null
  createdAt: string
}

export interface Aircraft {
  id: string
  registration: string
  make: string
  model: string
  year: number | null
  seatingCapacity: number
  rangeNm: number | null
  isActive: boolean
  homeBaseIcao: string | null
  costPerHour: number | null
  hourlyRate: number | null
  basePrice: number | null
  aircraftClassId: string | null
  createdAt: string
}

export function normalizeAircraft(raw: BackendAircraft): Aircraft {
  return {
    id: raw.id,
    registration: raw.tailNumber,
    make: raw.make,
    model: raw.model,
    year: raw.year,
    seatingCapacity: raw.seats,
    rangeNm: raw.rangeNm,
    isActive: raw.isActive,
    homeBaseIcao: raw.homeBaseIcao,
    costPerHour: raw.costPerHour != null ? Number(raw.costPerHour) : null,
    hourlyRate: raw.hourlyRate != null ? Number(raw.hourlyRate) : null,
    basePrice: raw.basePrice != null ? Number(raw.basePrice) : null,
    aircraftClassId: raw.aircraftClassId ?? null,
    createdAt: raw.createdAt,
  }
}

export interface BackendAircraftDetail extends BackendAircraft {
  airframeHours: number | null
  engineHours: number | null
  ownerId: string | null
  owner: { id: string; firstName: string; lastName: string } | null
}

export interface AircraftDetail extends Aircraft {
  airframeHours: number | null
  engineHours: number | null
  ownerId: string | null
  owner: { id: string; firstName: string; lastName: string } | null
}

export function normalizeAircraftDetail(raw: BackendAircraftDetail): AircraftDetail {
  return {
    ...normalizeAircraft(raw),
    airframeHours: raw.airframeHours,
    engineHours: raw.engineHours,
    ownerId: raw.ownerId,
    owner: raw.owner,
  }
}

const AIRCRAFT_KEY = 'aircraft'

export function useAircraftList(filters?: { page?: number; pageSize?: number; isActive?: boolean }) {
  return useQuery({
    queryKey: [AIRCRAFT_KEY, filters],
    enabled: !!filters,
    queryFn: async () => {
      const response = await apiClient.get<{ data: BackendAircraft[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>('/aircraft', { params: filters })
      const raw = response.data as { data: BackendAircraft[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }
      return { ...raw, data: raw.data.map(normalizeAircraft) }
    },
  })
}

export function useAircraft(id: string | null) {
  return useQuery({
    queryKey: [AIRCRAFT_KEY, id],
    enabled: !!id,
    queryFn: async () => {
      const response = await apiClient.get<BackendAircraftDetail>(`/aircraft/${id}`)
      return normalizeAircraftDetail(response.data as BackendAircraftDetail)
    },
  })
}

export function useUpdateAircraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateAircraftInput> }) => {
      const response = await apiClient.patch<BackendAircraft>(`/aircraft/${id}`, data)
      return normalizeAircraft(response.data as BackendAircraft)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [AIRCRAFT_KEY] })
    },
  })
}

export function useCreateAircraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateAircraftInput) => {
      const response = await apiClient.post<BackendAircraft>('/aircraft', data)
      return normalizeAircraft(response.data as BackendAircraft)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [AIRCRAFT_KEY] })
    },
  })
}
