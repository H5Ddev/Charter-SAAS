import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type CrewRole = 'CAPTAIN' | 'FIRST_OFFICER' | 'FLIGHT_ATTENDANT' | 'DISPATCHER' | 'MECHANIC' | 'OTHER'
export type MedicalClass = 'CLASS_1' | 'CLASS_2' | 'CLASS_3'
export type DocType = 'LICENSE' | 'MEDICAL' | 'TYPE_RATING' | 'PASSPORT' | 'TRAINING' | 'OTHER'

export interface CrewDocument {
  id: string
  type: DocType
  name: string
  expiryDate: string | null
  fileUrl: string | null
  notes: string | null
  createdAt: string
}

export interface CrewMember {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  role: CrewRole
  licenseNumber: string | null
  licenseType: string | null
  typeRatings: string | null  // JSON string
  medicalClass: MedicalClass | null
  medicalExpiry: string | null
  licenseExpiry: string | null
  isActive: boolean
  notes: string | null
  documents: CrewDocument[]
  createdAt: string
  updatedAt: string
}

export interface CreateCrewMemberInput {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  role: CrewRole
  licenseNumber?: string
  licenseType?: string
  typeRatings?: string[]
  medicalClass?: MedicalClass
  medicalExpiry?: string
  licenseExpiry?: string
  isActive?: boolean
  notes?: string
}

export interface AddCrewDocumentInput {
  type: DocType
  name: string
  expiryDate?: string
  notes?: string
}

interface PaginatedResponse<T> {
  data: T[]
  meta: { total: number; page: number; pageSize: number; totalPages: number }
}

const CREW_KEY = 'crew'

export function useCrew(filters?: { role?: string; isActive?: boolean; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: [CREW_KEY, filters],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<CrewMember>>('/crew', { params: filters })
      const raw = response.data as PaginatedResponse<CrewMember>
      return {
        ...raw,
        data: raw.data.map((m) => ({
          ...m,
          documents: m.documents ?? [],
        })),
      }
    },
  })
}

export function useCrewMember(id: string) {
  return useQuery({
    queryKey: [CREW_KEY, id],
    queryFn: async () => {
      const response = await apiClient.get<CrewMember>(`/crew/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateCrewMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateCrewMemberInput) => {
      const response = await apiClient.post<CrewMember>('/crew', data)
      return response.data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [CREW_KEY] }),
  })
}

export function useUpdateCrewMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateCrewMemberInput> }) => {
      const response = await apiClient.patch<CrewMember>(`/crew/${id}`, data)
      return response.data
    },
    onSuccess: (_d, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [CREW_KEY] })
      void queryClient.invalidateQueries({ queryKey: [CREW_KEY, id] })
    },
  })
}

export function useDeleteCrewMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/crew/${id}`) },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [CREW_KEY] }),
  })
}

export function useAddCrewDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ crewId, data }: { crewId: string; data: AddCrewDocumentInput }) => {
      const response = await apiClient.post<CrewDocument>(`/crew/${crewId}/documents`, data)
      return response.data
    },
    onSuccess: (_d, { crewId }) => void queryClient.invalidateQueries({ queryKey: [CREW_KEY, crewId] }),
  })
}

export function useDeleteCrewDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ crewId, docId }: { crewId: string; docId: string }) => {
      await apiClient.delete(`/crew/${crewId}/documents/${docId}`)
    },
    onSuccess: (_d, { crewId }) => void queryClient.invalidateQueries({ queryKey: [CREW_KEY, crewId] }),
  })
}
