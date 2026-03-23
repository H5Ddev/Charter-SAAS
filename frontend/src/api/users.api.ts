import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type UserRole = 'ADMIN' | 'MANAGER' | 'AGENT' | 'READ_ONLY'

export interface AppUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  isActive: boolean
  lastLoginAt: string | null
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateUserInput {
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
}

export interface UpdateUserInput {
  role?: UserRole
  isActive?: boolean
  firstName?: string
  lastName?: string
}

interface PaginatedResponse<T> {
  data: T[]
  meta: { total: number; page: number; pageSize: number; totalPages: number }
}

const USERS_KEY = 'users'

export function useUsers(filters?: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: [USERS_KEY, filters],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<AppUser>>('/users', { params: filters })
      return response.data as PaginatedResponse<AppUser>
    },
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateUserInput) => {
      const response = await apiClient.post<AppUser>('/users', data)
      return response.data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserInput }) => {
      const response = await apiClient.patch<AppUser>(`/users/${id}`, data)
      return response.data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  })
}

export function useDeactivateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/users/${id}`)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  })
}
