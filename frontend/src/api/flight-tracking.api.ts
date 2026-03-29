import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

export interface LiveFlight {
  aircraftId: string
  tailNumber: string
  make: string
  model: string
  flightIcao: string | null
  depIcao: string | null
  arrIcao: string | null
  lat: number | null
  lng: number | null
  altFt: number | null
  heading: number | null
  speedKts: number | null
  status: string | null
  updatedAt: string | null
  departureAt: string | null
  arrivalAt: string | null
}

export function useLiveFlights(enabled: boolean) {
  return useQuery({
    queryKey: ['live-flights'],
    queryFn: async () => {
      const response = await apiClient.get<LiveFlight[]>('/integrations/airlabs/live')
      return response.data as LiveFlight[]
    },
    enabled,
    refetchInterval: enabled ? 60_000 : false,
    staleTime: 30_000,
  })
}
