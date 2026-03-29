import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  HomeIcon,
  UsersIcon,
  PaperAirplaneIcon,
  TicketIcon,
  DocumentTextIcon,
  BoltIcon,
  BellIcon,
  WrenchScrewdriverIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  UsersIcon as UsersManageIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/store/auth.store'
import { SidebarLogo } from '@/components/ui/AeroPulseLogo'

interface NavItem {
  label: string
  to: string
  icon: React.ElementType
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: HomeIcon },
  { label: 'Contacts', to: '/contacts', icon: UsersIcon },
  { label: 'Trips', to: '/trips', icon: PaperAirplaneIcon },
  { label: 'Calendar', to: '/calendar', icon: CalendarDaysIcon },
  { label: 'Quotes', to: '/quotes', icon: DocumentTextIcon },
  { label: 'Tickets', to: '/tickets', icon: TicketIcon },
  { label: 'Aircraft', to: '/aircraft', icon: WrenchScrewdriverIcon },
  { label: 'Crew', to: '/crew', icon: UserGroupIcon },
  { label: 'Maintenance', to: '/maintenance', icon: ClipboardDocumentListIcon },
  { label: 'Automations', to: '/automations', icon: BoltIcon },
  { label: 'Templates', to: '/notifications/templates', icon: BellIcon },
  { label: 'Users', to: '/users', icon: UsersManageIcon },
  { label: 'Settings', to: '/settings', icon: Cog6ToothIcon },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onMobileClose?: () => void
}

export function Sidebar({ collapsed, onToggle, onMobileClose }: SidebarProps) {
  const user = useAuthStore((s) => s.user)

  return (
    <aside
      className={clsx(
        'flex flex-col bg-sidebar text-sidebar-text h-screen transition-all duration-200 shrink-0',
        collapsed ? 'w-64 lg:w-16' : 'w-64 lg:w-60',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/10">
        <SidebarLogo collapsed={collapsed} />
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="ml-auto rounded p-1 text-sidebar-text hover:text-white hover:bg-sidebar-hover transition-colors lg:hidden"
          aria-label="Close menu"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        {/* Desktop collapse toggle */}
        <button
          onClick={onToggle}
          className={clsx(
            'hidden lg:block rounded p-1 text-sidebar-text hover:text-white hover:bg-sidebar-hover transition-colors',
            collapsed ? 'mx-auto' : 'ml-auto',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <ChevronLeftIcon className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onMobileClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-active text-sidebar-text-active'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={clsx('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Copyright */}
      {!collapsed && (
        <p className="px-3 pb-1 text-center text-[10px] text-white/25 leading-tight">
          © {new Date().getFullYear()} H5 Enterprises
        </p>
      )}

      {/* User */}
      {user && (
        <div
          className={clsx(
            'flex items-center gap-3 px-3 py-3 border-t border-white/10',
            collapsed && 'justify-center'
          )}
        >
          <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {user.firstName?.[0]}
            {user.lastName?.[0]}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-sidebar-text truncate">{user.role}</p>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

export default Sidebar
