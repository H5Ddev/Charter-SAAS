import { XMarkIcon, BellIcon } from '@heroicons/react/24/outline'
import { useNotificationsStore } from '@/store/notifications.store'
import { useNavigate } from 'react-router-dom'

export function ToastContainer() {
  const toasts = useNotificationsStore((s) => s.toasts)
  const dismissToast = useNotificationsStore((s) => s.dismissToast)
  const markRead = useNotificationsStore((s) => s.markRead)
  const navigate = useNavigate()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto w-80 bg-white border border-gray-200 rounded-xl shadow-xl flex items-start gap-3 px-4 py-3 animate-fade-in"
        >
          <div className="mt-0.5 shrink-0 h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center">
            <BellIcon className="h-4 w-4 text-primary-600" />
          </div>
          <button
            className="flex-1 min-w-0 text-left"
            onClick={() => {
              markRead(t.id)
              dismissToast(t.id)
              if (t.link) navigate(t.link)
            }}
          >
            <p className="text-sm font-semibold text-gray-900 truncate">{t.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.body}</p>
          </button>
          <button
            onClick={() => dismissToast(t.id)}
            className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
