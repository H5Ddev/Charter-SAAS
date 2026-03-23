import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type TripStatus =
  | 'INQUIRY'
  | 'QUOTED'
  | 'CONFIRMED'
  | 'MANIFEST_LOCKED'
  | 'DEPARTED'
  | 'COMPLETED'
  | 'CANCELLED'

export interface TripLeg {
  id: string
  sequence: number
  originIcao: string
  destinationIcao: string
  scheduledDeparture: string
  scheduledArrival: string
  actualDeparture: string | null
  actualArrival: string | null
}

export interface TripPassenger {
  id: string
  contactId: string
  contact: {
    id: string
    firstName: string
    lastName: string
    email: string | null
  }
  isSupervisor: boolean
}

export interface Trip {
  id: string
  reference: string
  status: TripStatus
  aircraftId: string
  aircraft: {
    id: string
    registration: string
    make: string
    model: string
  }
  legs: TripLeg[]
  passengers: TripPassenger[]
  departureAirport: string
  arrivalAirport: string
  departureTime: string
  arrivalTime: string
  isDelayed: boolean
  delayReason: string | null
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
  aircraftId: string
  departureAirport: string
  arrivalAirport: string
  departureTime: string
  arrivalTime: string
  notes?: string
  legs?: Array<{
    sequence: number
    originIcao: string
    destinationIcao: string
    scheduledDeparture: string
    scheduledArrival: string
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
      const response = await apiClient.get<{ data: Trip }>(`/trips/${id}`)
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
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.post<Trip>(`/trips/${id}/delay`, { reason })
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
      isSupervisor,
    }: {
      tripId: string
      contactId: string
      isSupervisor?: boolean
    }) => {
      const response = await apiClient.post<TripPassenger>(
        `/trips/${tripId}/passengers`,
        { contactId, isSupervisor }
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
