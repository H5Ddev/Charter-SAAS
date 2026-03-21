import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/auth.store'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || ''

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true, // Include httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
})

// Request interceptor: inject access token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = useAuthStore.getState().accessToken
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// Response interceptor: handle 401 with token refresh
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else if (token) {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`
          }
          return apiClient(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Attempt silent refresh using httpOnly refresh token cookie
        const response = await axios.post<{
          data: { accessToken: string }
        }>(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true },
        )

        const newToken = response.data.data.accessToken
        useAuthStore.getState().setAccessToken(newToken)

        processQueue(null, newToken)
        isRefreshing = false

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
        }
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        isRefreshing = false

        // Clear auth state and redirect to login
        useAuthStore.getState().logout()
        window.location.href = '/login'

        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: ApiError } | undefined
    return data?.error?.message ?? error.message
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred'
}
