import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ChevronDownIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/store/auth.store'
import { useLogout } from '@/api/auth.api'
import { NotificationBell } from './NotificationBell'

const PAGE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/contacts': 'Contacts',
  '/trips': 'Trips',
  '/quotes': 'Quotes',
  '/tickets': 'Tickets',
  '/aircraft': 'Aircraft',
  '/automations': 'Automations',
  '/notifications/templates': 'Templates',
  '/settings': 'Settings',
}

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const location = useLocation()
  const pageLabel = PAGE_LABELS[location.pathname] ?? ''
  const [dropdownOpen, setDropdownOpen] = useState(false)

  async function handleLogout() {
    await logout.mutateAsync()
    setDropdownOpen(false)
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 sm:px-6 gap-3 shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Open menu"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-gray-900 truncate">{pageLabel}</span>
      </div>

      <NotificationBell />

      {/* User Dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
        >
          <div className="h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold">
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </div>
          <span className="hidden sm:block font-medium">
            {user?.firstName} {user?.lastName}
          </span>
          <ChevronDownIcon className="h-4 w-4 text-gray-400" />
        </button>

        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setDropdownOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-card-hover z-20 animate-fade-in">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <ul className="py-1">
                <li>
                  <Link
                    to="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Cog6ToothIcon className="h-4 w-4" />
                    Settings
                  </Link>
                </li>
                <li>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    Sign out
                  </button>
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

export default Header
