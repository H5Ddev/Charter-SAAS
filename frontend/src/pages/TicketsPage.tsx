import { useState } from 'react'
import { clsx } from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { Table, type Column } from '@/components/ui/Table'
import { Badge, ticketStatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { PlusIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid'
import { NewTicketModal } from '@/components/tickets/NewTicketModal'

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_CUSTOMER' | 'RESOLVED' | 'CLOSED'
type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

interface Ticket {
  id: string
  reference: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  contact: { firstName: string; lastName: string }
  assigneeId: string | null
  slaBreach: boolean
  source: string
  createdAt: string
}

const STATUSES: { value: TicketStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PENDING_CUSTOMER', label: 'Pending' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
]

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  LOW: 'text-gray-400',
  NORMAL: 'text-blue-500',
  HIGH: 'text-amber-500',
  URGENT: 'text-red-500',
}

const PRIORITY_BG: Record<TicketPriority, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  NORMAL: 'bg-blue-50 text-blue-700',
  HIGH: 'bg-amber-50 text-amber-700',
  URGENT: 'bg-red-50 text-red-700',
}

function useTickets(filters: { status?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: async () => {
      const response = await apiClient.get<{
        data: Ticket[]
        meta: { total: number; page: number; pageSize: number; totalPages: number }
      }>('/tickets', { params: filters })
      return response.data
    },
  })
}

export default function TicketsPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('')
  const [newTicketOpen, setNewTicketOpen] = useState(false)

  const { data, isLoading } = useTickets({
    page,
    pageSize: 20,
    status: statusFilter || undefined,
  })

  const columns: Column<Ticket>[] = [
    {
      key: 'subject',
      header: 'Ticket',
      render: (t) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 text-sm">{t.subject}</span>
            {t.slaBreach && (
              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700">
                <ExclamationTriangleIcon className="h-3 w-3" />
                SLA
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{t.reference}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (t) => (
        <span className="text-sm text-gray-700">
          {t.contact.firstName} {t.contact.lastName}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (t) => (
        <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_BG[t.priority])}>
          {t.priority.charAt(0) + t.priority.slice(1).toLowerCase()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => (
        <Badge variant={ticketStatusBadge(t.status)} size="sm">
          {t.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (t) => (
        <span className="text-xs text-gray-500 capitalize">{t.source.replace('_', ' ').toLowerCase()}</span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (t) => (
        <span className="text-sm text-gray-500">
          {new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.meta.total ?? 0} total</p>
        </div>
        <Button size="md" onClick={() => setNewTicketOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-1.5" />
          New Ticket
        </Button>
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => { setStatusFilter(s.value); setPage(1) }}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
              statusFilter === s.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Table
        columns={columns}
        data={data?.data ?? []}
        keyExtractor={(t) => t.id}
        loading={isLoading}
        emptyMessage="No tickets found."
        pagination={data?.meta}
        onPageChange={setPage}
        rowClassName={(t) => t.slaBreach ? 'bg-red-50/40' : ''}
      />

      <NewTicketModal
        isOpen={newTicketOpen}
        onClose={() => setNewTicketOpen(false)}
      />
    </div>
  )
}
