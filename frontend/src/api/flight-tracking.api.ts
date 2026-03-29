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
}

export function useLiveFlights() {
  return useQuery({
    queryKey: ['live-flights'],
    queryFn: async () => {
      const response = await apiClient.get<LiveFlight[]>('/integrations/airlabs/live')
      return response.data as LiveFlight[]
    },
    // Poll every 60 seconds — AirLabs updates roughly every 15–30s on paid tiers
    refetchInterval: 60_000,
    // Keep stale data visible while refetching
    staleTime: 30_000,
  })
}
