import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type TripStatus =
  | 'INQUIRY'
  | 'QUOTED'
  | 'CONFIRMED'
  | 'BOARDING'
  | 'IN_FLIGHT'
  | 'COMPLETED'
  | 'CANCELLED'

export interface TripPassenger {
  id: string
  contactId: string
  contact: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
  }
  isPrimary: boolean
  seatNumber: string | null
}

export interface AirportSummary {
  id: number
  icaoCode: string
  iataCode: string | null
  name: string
  municipality: string | null
}

export interface Trip {
  id: string
  reference: string
  status: TripStatus
  aircraftId: string | null
  aircraft: {
    id: string
    tailNumber: string
    make: string
    model: string
  } | null
  passengers: TripPassenger[]
  originIcao: string
  destinationIcao: string
  originAirportId: number | null
  destinationAirportId: number | null
  origin: AirportSummary | null
  destination: AirportSummary | null
  departureAt: string
  arrivalAt: string | null
  returnTripId: string | null
  returnTrip: {
    id: string
    departureAt: string
    arrivalAt: string | null
    originIcao: string
    destinationIcao: string
    status: TripStatus
  } | null
  isDelayed: boolean
  delayNotes: string | null
  paxCount: number
  notes: string | null
  tenantId: string
  createdAt: string
  updatedAt: string
}

export interface TripFilters {
  status?: TripStatus
  search?: string
  aircraftId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface CreateTripInput {
  aircraftId?: string
  crewIds?: string[]
  originIcao: string
  destinationIcao: string
  departureAt: string
  arrivalAt?: string
  returnTrip?: {
    departureAt: string
    arrivalAt?: string
  }
  paxCount: number
  notes?: string
  distanceNm?: number
  estimatedHours?: number
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

const TRIPS_KEY = 'trips'

export function useTrips(filters?: TripFilters) {
  return useQuery({
    queryKey: [TRIPS_KEY, filters],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<Trip>>('/trips', {
        params: filters,
      })
      return response.data
    },
  })
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: [TRIPS_KEY, id],
    queryFn: async () => {
      const response = await apiClient.get<Trip>(`/trips/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateTrip() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateTripInput) => {
      const response = await apiClient.post<Trip>('/trips', data)
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TRIPS_KEY] })
    },
  })
}

export function useUpdateTripStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: TripStatus; notes?: string }) => {
      const response = await apiClient.patch<Trip>(`/trips/${id}/status`, { status, notes })
      return response.data
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [TRIPS_KEY] })
      void queryClient.invalidateQueries({ queryKey: [TRIPS_KEY, id] })
    },
  })
}

export function useFlagDelay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, delayNotes }: { id: string; delayNotes: string }) => {
      const response = await apiClient.post<Trip>(`/trips/${id}/delay`, { delayNotes })
      return response.data
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [TRIPS_KEY] })
      void queryClient.invalidateQueries({ queryKey: [TRIPS_KEY, id] })
    },
  })
}

export function useAddTripPassenger() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      tripId,
      contactId,
      isPrimary,
    }: {
      tripId: string
      contactId: string
      isPrimary?: boolean
    }) => {
      const response = await apiClient.post<TripPassenger>(
        `/trips/${tripId}/passengers`,
        { contactId, isPrimary }
      )
      return response.data
    },
    onSuccess: (_data, { tripId }) => {
      void queryClient.invalidateQueries({ queryKey: [TRIPS_KEY, tripId] })
    },
  })
}

export function useRemoveTripPassenger() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tripId, passengerId }: { tripId: string; passengerId: string }) => {
      await apiClient.delete(`/trips/${tripId}/passengers/${passengerId}`)
    },
    onSuccess: (_data, { tripId }) => {
      void queryClient.invalidateQueries({ queryKey: [TRIPS_KEY, tripId] })
    },
  })
}
