import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

export interface Airport {
  icaoCode: string
  iataCode: string | null
  name: string
  municipality: string | null
  isoCountry: string
  type: string
  latitudeDeg: number | null
  longitudeDeg: number | null
}

export function useAirportSearch(q: string, enabled = true) {
  return useQuery<Airport[]>({
    queryKey: ['airports', 'search', q],
    queryFn: async () => {
      const res = await apiClient.get<Airport[]>('/airports/search', { params: { q, limit: 8 } })
      return res.data
    },
    enabled: enabled && q.length >= 2,
    staleTime: 5 * 60 * 1000, // airport data doesn't change
    placeholderData: [],
  })
}

/** Great-circle distance in nautical miles between two lat/lon points */
export function distanceNm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 3440.065 // Earth radius in nautical miles
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Estimated block time in decimal hours given distance (nm) and typical charter cruise speed */
export function estimatedHours(nm: number, cruiseKtas = 460): number {
  // Add ~30 min for taxi/climb/descent
  return nm / cruiseKtas + 0.5
}

/** Format decimal hours as "Xh Ym" */
export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
