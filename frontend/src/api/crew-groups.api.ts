import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export interface CrewGroupMemberSummary {
  id: string
  crewMemberId: string
  crewMember: {
    id: string
    firstName: string
    lastName: string
    role: string
    isActive: boolean
  }
}

export interface CrewGroupAircraft {
  id: string
  tailNumber: string
  make: string
  model: string
}

export interface CrewGroup {
  id: string
  name: string
  description: string | null
  aircraftId: string | null
  aircraft: CrewGroupAircraft | null
  minPax: number | null
  maxPax: number | null
  isActive: boolean
  createdAt: string
  members: CrewGroupMemberSummary[]
}

export interface CreateCrewGroupInput {
  name: string
  description?: string | null
  aircraftId?: string | null
  minPax?: number | null
  maxPax?: number | null
}

const KEY = 'crew-groups'

export function useCrewGroups() {
  return useQuery<CrewGroup[]>({
    queryKey: [KEY],
    queryFn: async () => {
      const res = await apiClient.get<{ data: CrewGroup[] }>('/crew-groups')
      return (res.data as unknown as { data: CrewGroup[] }).data
    },
  })
}

export function useCrewGroup(id: string | null) {
  return useQuery<CrewGroup>({
    queryKey: [KEY, id],
    queryFn: async () => {
      const res = await apiClient.get<{ data: CrewGroup }>(`/crew-groups/${id}`)
      return (res.data as unknown as { data: CrewGroup }).data
    },
    enabled: !!id,
  })
}

export function useCreateCrewGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateCrewGroupInput) => {
      const res = await apiClient.post<{ data: CrewGroup }>('/crew-groups', data)
      return (res.data as unknown as { data: CrewGroup }).data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpdateCrewGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateCrewGroupInput> & { isActive?: boolean } }) => {
      const res = await apiClient.patch<{ data: CrewGroup }>(`/crew-groups/${id}`, data)
      return (res.data as unknown as { data: CrewGroup }).data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteCrewGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/crew-groups/${id}`)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useSetCrewGroupMembers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, crewMemberIds }: { id: string; crewMemberIds: string[] }) => {
      const res = await apiClient.put<{ data: CrewGroup }>(`/crew-groups/${id}/members`, { crewMemberIds })
      return (res.data as unknown as { data: CrewGroup }).data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useAssignCrewGroupToTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, tripId }: { groupId: string; tripId: string }) => {
      const res = await apiClient.post<{ data: CrewGroup }>(`/crew-groups/${groupId}/assign-to-trip`, { tripId })
      return (res.data as unknown as { data: CrewGroup }).data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY] })
      void queryClient.invalidateQueries({ queryKey: ['trips'] })
    },
  })
}
