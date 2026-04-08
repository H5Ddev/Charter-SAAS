import { create } from 'zustand'

export interface AppNotification {
  id: string
  title: string
  body: string
  link?: string
  createdAt: Date
  read: boolean
}

interface NotificationsState {
  notifications: AppNotification[]
  toasts: AppNotification[]
  add: (n: Omit<AppNotification, 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  dismissToast: (id: string) => void
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  toasts: [],

  add: (n) => {
    const notification: AppNotification = { ...n, read: false }
    set((s) => ({
      notifications: [notification, ...s.notifications].slice(0, 50),
      toasts: [notification, ...s.toasts],
    }))
    // Auto-dismiss toast after 4 seconds
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== n.id) }))
    }, 4000)
  },

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
