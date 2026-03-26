import { useState } from 'react'
import { clsx } from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { Table, type Column } from '@/components/ui/Table'
import { Badge, quoteStatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { PlusIcon } from '@heroicons/react/20/solid'
import { NewQuoteModal } from '@/components/quotes/NewQuoteModal'
import { QuoteDetailModal } from '@/components/quotes/QuoteDetailModal'

type QuoteStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'

interface Quote {
  id: string
  reference: string | null
  status: QuoteStatus
  totalPrice: number
  currency: string
  contact: { firstName: string; lastName: string }
  validUntil: string | null
  createdAt: string
}

const STATUSES: { value: QuoteStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'VIEWED', label: 'Viewed' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'EXPIRED', label: 'Expired' },
]

function useQuotes(filters: { status?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['quotes', filters],
    queryFn: async () => {
      const response = await apiClient.get<{
        data: Quote[]
        meta: { total: number; page: number; pageSize: number; totalPages: number }
      }>('/quotes', { params: filters })
      return response.data
    },
  })
}

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false
  const diff = new Date(dateStr).getTime() - Date.now()
  return diff > 0 && diff < 48 * 60 * 60 * 1000
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr).getTime() < Date.now()
}

export default function QuotesPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | ''>('')
  const [newQuoteOpen, setNewQuoteOpen] = useState(false)
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)

  const { data, isLoading } = useQuotes({
    page,
    pageSize: 20,
    status: statusFilter || undefined,
  })

  const columns: Column<Quote>[] = [
    {
      key: 'reference',
      header: 'Quote',
      render: (q) => (
        <div>
          <p className="font-mono font-semibold text-gray-900 text-sm">
            {q.reference ?? q.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(q.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Client',
      render: (q) => (
        <span className="text-sm font-medium text-gray-900">
          {q.contact.firstName} {q.contact.lastName}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (q) => (
        <span className="font-semibold text-gray-900 tabular-nums">
          {formatCurrency(q.totalPrice, q.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (q) => (
        <Badge variant={quoteStatusBadge(q.status)} size="sm">
          {q.status.charAt(0) + q.status.slice(1).toLowerCase()}
        </Badge>
      ),
    },
    {
      key: 'validUntil',
      header: 'Valid Until',
      render: (q) => {
        if (!q.validUntil) return <span className="text-gray-400 text-sm">—</span>
        const expired = isExpired(q.validUntil)
        const soon = isExpiringSoon(q.validUntil)
        return (
          <span className={clsx(
            'text-sm',
            expired ? 'text-red-500 font-medium' : soon ? 'text-amber-600 font-medium' : 'text-gray-700'
          )}>
            {new Date(q.validUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            {soon && !expired && <span className="ml-1 text-xs">(soon)</span>}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.meta.total ?? 0} total</p>
        </div>
        <Button size="md" onClick={() => setNewQuoteOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-1.5" />
          New Quote
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
        keyExtractor={(q) => q.id}
        loading={isLoading}
        emptyMessage="No quotes found. Create your first quote to get started."
        pagination={data?.meta}
        onPageChange={setPage}
        onRowClick={(q) => setSelectedQuoteId(q.id)}
      />

      <NewQuoteModal
        isOpen={newQuoteOpen}
        onClose={() => setNewQuoteOpen(false)}
      />

      <QuoteDetailModal
        quoteId={selectedQuoteId}
        onClose={() => setSelectedQuoteId(null)}
      />
    </div>
  )
}
