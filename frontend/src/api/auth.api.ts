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
      const response = await apiClient.post<LoginResponse | MfaRequiredResponse>('/auth/login', payload)
      return response.data
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
      const response = await apiClient.post<LoginResponse>('/auth/mfa/verify', payload)
      return response.data
    },
    onSuccess: (data) => {
      login(data.user, data.accessToken)
    },
  })
}

export function useMfaSetup() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<MfaSetupResponse>('/auth/mfa/setup')
      return response.data
    },
  })
}

export function useMfaSetupVerify() {
  const { user, setUser } = useAuthStore()
  return useMutation({
    mutationFn: async (token: string) => {
      const response = await apiClient.post<{ enabled: boolean }>('/auth/mfa/setup/verify', { token })
      return response.data
    },
    onSuccess: () => {
      if (user) setUser({ ...user, mfaEnabled: true })
    },
  })
}

export function useMfaDisable() {
  const { user, setUser } = useAuthStore()
  return useMutation({
    mutationFn: async (payload: { password: string; token: string }) => {
      const response = await apiClient.post<{ enabled: boolean }>('/auth/mfa/disable', payload)
      return response.data
    },
    onSuccess: () => {
      if (user) setUser({ ...user, mfaEnabled: false })
    },
  })
}

export function useRefreshToken() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ accessToken: string; expiresIn: number }>(
        '/auth/refresh',
      )
      return response.data
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
      const response = await apiClient.post<LoginResponse>('/auth/register', payload)
      return response.data
    },
    onSuccess: (data) => {
      login(data.user, data.accessToken)
    },
  })
}
