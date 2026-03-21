import { clsx } from 'clsx'

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'

export type BadgeSize = 'sm' | 'md'

export interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  primary: 'bg-primary-100 text-primary-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-accent-100 text-accent-700',
  purple: 'bg-purple-100 text-purple-700',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-sm',
}

export function Badge({ children, variant = 'default', size = 'md', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  )
}

// Convenience helpers for common status types
export function tripStatusBadge(status: string) {
  const map: Record<string, BadgeVariant> = {
    INQUIRY: 'default',
    QUOTED: 'info',
    CONFIRMED: 'primary',
    MANIFEST_LOCKED: 'purple',
    DEPARTED: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger',
  }
  return map[status] ?? 'default'
}

export function ticketStatusBadge(status: string) {
  const map: Record<string, BadgeVariant> = {
    OPEN: 'warning',
    IN_PROGRESS: 'primary',
    PENDING_CUSTOMER: 'info',
    RESOLVED: 'success',
    CLOSED: 'default',
  }
  return map[status] ?? 'default'
}

export function quoteStatusBadge(status: string) {
  const map: Record<string, BadgeVariant> = {
    DRAFT: 'default',
    SENT: 'info',
    VIEWED: 'primary',
    ACCEPTED: 'success',
    DECLINED: 'danger',
    EXPIRED: 'warning',
  }
  return map[status] ?? 'default'
}

export default Badge
