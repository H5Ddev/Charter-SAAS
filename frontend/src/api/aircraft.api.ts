import { useMutation, useQueryClient } from '@tanstack/react-query'
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
    createdAt: raw.createdAt,
  }
}

const AIRCRAFT_KEY = 'aircraft'

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
