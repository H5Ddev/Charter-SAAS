import { useRef, useState, useEffect } from 'react'
import { BellIcon, CheckIcon } from '@heroicons/react/24/outline'
import { BellAlertIcon } from '@heroicons/react/24/solid'
import { useNotificationsStore, AppNotification } from '@/store/notifications.store'
import { useNavigate } from 'react-router-dom'

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function NotificationItem({ n, onClose }: { n: AppNotification; onClose: () => void }) {
  const markRead = useNotificationsStore((s) => s.markRead)
  const navigate = useNavigate()

  function handleClick() {
    markRead(n.id)
    if (n.link) {
      navigate(n.link)
      onClose()
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${n.read ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-2">
        {!n.read && (
          <span className="mt-1.5 h-2 w-2 rounded-full bg-primary-500 shrink-0" />
        )}
        <div className={`min-w-0 ${n.read ? 'pl-4' : ''}`}>
          <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
          <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
        </div>
      </div>
    </button>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const notifications = useNotificationsStore((s) => s.notifications)
  const markAllRead = useNotificationsStore((s) => s.markAllRead)
  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        {unreadCount > 0
          ? <BellAlertIcon className="h-5 w-5 text-primary-600" />
          : <BellIcon className="h-5 w-5" />
        }
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-20 animate-fade-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-900">
                Notifications {unreadCount > 0 && <span className="text-primary-600">({unreadCount})</span>}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium"
                >
                  <CheckIcon className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <BellIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <NotificationItem key={n.id} n={n} onClose={() => setOpen(false)} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
