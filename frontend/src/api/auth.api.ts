import { useMutation, useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import { useAuthStore, type AuthUser } from '../store/auth.store'

interface LoginPayload {
  email: string
  password: string
  tenantId: string
}

interface LoginResponse {
  user: AuthUser
  accessToken: string
  expiresIn: number
}

interface MfaRequiredResponse {
  mfaRequired: true
  mfaSessionToken: string
  userId: string
}

interface MfaVerifyPayload {
  token: string
  mfaSessionToken: string
}

interface MfaSetupResponse {
  secret: string
  qrCodeDataUrl: string
}

interface RegisterPayload {
  email: string
  password: string
  firstName: string
  lastName: string
  tenantId: string
}

export function useLogin() {
  const { login } = useAuthStore()

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const response = await apiClient.post<{
        data: LoginResponse | MfaRequiredResponse
      }>('/auth/login', payload)
      return response.data.data
    },
    onSuccess: (data) => {
      if (!('mfaRequired' in data)) {
        login(data.user, data.accessToken)
      }
    },
  })
}

export function useMfaVerify() {
  const { login } = useAuthStore()

  return useMutation({
    mutationFn: async (payload: MfaVerifyPayload) => {
      const response = await apiClient.post<{ data: LoginResponse }>('/auth/mfa/verify', payload)
      return response.data.data
    },
    onSuccess: (data) => {
      login(data.user, data.accessToken)
    },
  })
}

export function useMfaSetup() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ data: MfaSetupResponse }>('/auth/mfa/setup')
      return response.data.data
    },
  })
}

export function useRefreshToken() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ data: { accessToken: string; expiresIn: number } }>(
        '/auth/refresh',
      )
      return response.data.data
    },
    onSuccess: (data) => {
      useAuthStore.getState().setAccessToken(data.accessToken)
    },
  })
}

export function useLogout() {
  const { logout } = useAuthStore()

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout')
    },
    onSuccess: () => {
      logout()
    },
    onError: () => {
      // Force logout even if the API call fails
      logout()
    },
  })
}

export function useRegister() {
  const { login } = useAuthStore()

  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const response = await apiClient.post<{ data: LoginResponse }>('/auth/register', payload)
      return response.data.data
    },
    onSuccess: (data) => {
      login(data.user, data.accessToken)
    },
  })
}
