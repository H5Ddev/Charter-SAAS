import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from './auth.store'

interface SocketState {
  socket: Socket | null
  isConnected: boolean
  connect: (accessToken: string) => void
  disconnect: () => void
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,

  connect: (accessToken: string) => {
    const existing = get().socket
    if (existing?.connected) return

    const apiUrl = import.meta.env.VITE_API_BASE_URL as string || ''

    const socket = io(apiUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })

    socket.on('connect', () => {
      set({ isConnected: true })
    })

    socket.on('disconnect', () => {
      set({ isConnected: false })
    })

    socket.on('connect_error', (err) => {
      console.warn('Socket.io connection error:', err.message)
    })

    // Listen for in-app notifications
    socket.on('notification:new', (notification: {
      id: string
      title: string
      body: string
      link?: string
    }) => {
      // Dispatch to a notifications store or show a toast
      console.info('New notification:', notification.title)
    })

    // Listen for real-time trip status updates
    socket.on('trip:status_changed', (data: { tripId: string; status: string }) => {
      console.info('Trip status changed:', data)
    })

    set({ socket })
  },

  disconnect: () => {
    const socket = get().socket
    if (socket) {
      socket.disconnect()
      set({ socket: null, isConnected: false })
    }
  },
}))

// Auto-connect when auth store updates
useAuthStore.subscribe((state) => {
  const { isConnected, connect, disconnect } = useSocketStore.getState()

  if (state.isAuthenticated && state.accessToken && !isConnected) {
    connect(state.accessToken)
  } else if (!state.isAuthenticated) {
    disconnect()
  }
})
