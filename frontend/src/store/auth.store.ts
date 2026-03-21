import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  tenantId: string
  mfaEnabled: boolean
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean

  login: (user: AuthUser, accessToken: string) => void
  logout: () => void
  setUser: (user: AuthUser) => void
  setAccessToken: (token: string) => void
}

const DEMO_USER: AuthUser = {
  id: 'user_admin_demo',
  email: 'admin@demo.aerocomm.io',
  firstName: 'Alex',
  lastName: 'Admin',
  role: 'ADMIN',
  tenantId: 'tenant_aerocomm_demo',
  mfaEnabled: false,
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: DEMO_USER,
      accessToken: 'demo',
      isAuthenticated: true,

      login: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),

      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),

      setUser: (user) => set({ user }),

      setAccessToken: (accessToken) => set({ accessToken }),
    }),
    {
      name: 'aerocomm-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Note: accessToken is NOT persisted to localStorage for security.
        // On page refresh, the app will attempt a silent token refresh.
      }),
    },
  ),
)
