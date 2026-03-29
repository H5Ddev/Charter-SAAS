import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export interface AircraftClassCrewReq {
  id: string
  classId: string
  role: string
  minCount: number
  perPax: number | null
}

export interface AircraftClass {
  id: string
  name: string
  description: string | null
  regulatoryCategory: string | null
  minSeats: number | null
  maxSeats: number | null
  minRangeNm: number | null
  maxRangeNm: number | null
  isActive: boolean
  crewReqs: AircraftClassCrewReq[]
  _count: { aircraft: number }
}

export interface CreateAircraftClassInput {
  name: string
  description?: string | null
  regulatoryCategory?: string | null
  minSeats?: number | null
  maxSeats?: number | null
  minRangeNm?: number | null
  maxRangeNm?: number | null
  crewReqs?: Array<{ role: string; minCount: number; perPax?: number | null }>
}

const KEY = 'aircraft-classes'

export function useAircraftClasses() {
  return useQuery<AircraftClass[]>({
    queryKey: [KEY],
    queryFn: async () => {
      const res = await apiClient.get<AircraftClass[]>('/aircraft-classes')
      return res.data as AircraftClass[]
    },
  })
}

export function useCreateAircraftClass() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateAircraftClassInput) => {
      const res = await apiClient.post<AircraftClass>('/aircraft-classes', data)
      return res.data as AircraftClass
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpdateAircraftClass() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateAircraftClassInput> & { isActive?: boolean } }) => {
      const res = await apiClient.patch<AircraftClass>(`/aircraft-classes/${id}`, data)
      return res.data as AircraftClass
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteAircraftClass() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/aircraft-classes/${id}`)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}
