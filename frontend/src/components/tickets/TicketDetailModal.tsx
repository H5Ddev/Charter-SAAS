import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { XMarkIcon, LockClosedIcon, PaperAirplaneIcon } from '@heroicons/react/20/solid'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Badge, ticketStatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { apiClient } from '@/api/client'
import { useUsers } from '@/api/users.api'

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_CUSTOMER' | 'RESOLVED' | 'CLOSED'
type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

interface TicketMessage {
  id: string
  content: string
  isInternal: boolean
  channel: string
  userId: string | null
  createdAt: string
}

interface TicketDetail {
  id: string
  reference: string
  title: string
  body: string | null
  status: TicketStatus
  priority: TicketPriority
  source: string
  assignedTo: string | null
  slaBreach: boolean
  slaBreachAt: string | null
  resolvedAt: string | null
  createdAt: string
  contact: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null } | null
  trip: { id: string; originIcao: string; destinationIcao: string; departureAt: string } | null
  messages: TicketMessage[]
}

interface Props {
  ticketId: string | null
  onClose: () => void
}

const PRIORITY_BG: Record<TicketPriority, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  NORMAL: 'bg-blue-50 text-blue-700',
  HIGH: 'bg-amber-50 text-amber-700',
  URGENT: 'bg-red-50 text-red-700',
}

const STATUSES: { value: TicketStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PENDING_CUSTOMER', label: 'Pending Customer' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
]

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(d: string) {
  return new Date(d).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function useTicketDetail(id: string | null) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const res = await apiClient.get<TicketDetail>(`/tickets/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

function useUpdateTicket(id: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { status?: TicketStatus; priority?: TicketPriority; assignedTo?: string | null }) => {
      const res = await apiClient.patch<TicketDetail>(`/tickets/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

function useAddMessage(id: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { content: string; isInternal: boolean }) => {
      const res = await apiClient.post(`/tickets/${id}/messages`, data)
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', id] })
    },
  })
}

export function TicketDetailModal({ ticketId, onClose }: Props) {
  const { data: ticket, isLoading } = useTicketDetail(ticketId)
  const update = useUpdateTicket(ticketId)
  const addMessage = useAddMessage(ticketId)
  const { data: usersData } = useUsers({ pageSize: 100 })
  const users = usersData?.data ?? []

  const [reply, setReply] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ticket?.messages.length])

  if (!ticketId) return null

  async function handleSendReply() {
    if (!reply.trim()) return
    await addMessage.mutateAsync({ content: reply.trim(), isInternal })
    setReply('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {isLoading ? (
              <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
            ) : ticket ? (
              <>
                <span className="font-mono text-xs text-gray-400 shrink-0">{ticket.reference}</span>
                {ticket.slaBreach && (
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 shrink-0">
                    <ExclamationTriangleIcon className="h-3 w-3" />
                    SLA Breach
                  </span>
                )}
                <h2 className="text-base font-bold text-gray-900 truncate">{ticket.title}</h2>
              </>
            ) : null}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 ml-3 shrink-0">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : ticket ? (
          <div className="flex flex-1 min-h-0">

            {/* Left: messages + reply */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-gray-100">

              {/* Body */}
              {ticket.body && (
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.body}</p>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {ticket.messages.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No messages yet.</p>
                )}
                {ticket.messages.map((msg) => {
                  const author = users.find((u) => u.id === msg.userId)
                  return (
                    <div key={msg.id} className={clsx(
                      'rounded-xl px-4 py-3 text-sm',
                      msg.isInternal
                        ? 'bg-amber-50 border border-amber-200'
                        : 'bg-white border border-gray-200',
                    )}>
                      <div className="flex items-center gap-2 mb-1.5">
                        {msg.isInternal && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                            <LockClosedIcon className="h-3 w-3" />
                            Internal note
                          </span>
                        )}
                        <span className="text-xs font-medium text-gray-600">
                          {author ? `${author.firstName} ${author.lastName}` : 'System'}
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">{fmtTime(msg.createdAt)}</span>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply box */}
              <div className="px-6 py-4 border-t border-gray-100 space-y-2 shrink-0">
                <textarea
                  rows={3}
                  placeholder={isInternal ? 'Internal note (not visible to client)…' : 'Reply…'}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSendReply() }}
                  className={clsx(
                    'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none',
                    isInternal ? 'border-amber-300 bg-amber-50' : 'border-gray-300',
                  )}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                    />
                    <span className="text-xs text-gray-600 flex items-center gap-1">
                      <LockClosedIcon className="h-3 w-3" />
                      Internal note
                    </span>
                  </label>
                  <Button
                    size="sm"
                    onClick={handleSendReply}
                    loading={addMessage.isPending}
                    disabled={!reply.trim()}
                  >
                    <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                    Send
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: sidebar */}
            <div className="w-64 shrink-0 overflow-y-auto px-5 py-5 space-y-5">

              {/* Status */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Status</p>
                <div className="space-y-1">
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => update.mutate({ status: s.value })}
                      disabled={update.isPending}
                      className={clsx(
                        'w-full text-left px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        ticket.status === s.value
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-100',
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Priority</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => update.mutate({ priority: p.value })}
                      disabled={update.isPending}
                      className={clsx(
                        'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                        ticket.priority === p.value
                          ? PRIORITY_BG[p.value] + ' border-transparent ring-2 ring-offset-1 ring-gray-400'
                          : PRIORITY_BG[p.value] + ' border-transparent opacity-50 hover:opacity-100',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignee */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Assignee</p>
                <select
                  value={ticket.assignedTo ?? ''}
                  onChange={(e) => update.mutate({ assignedTo: e.target.value || null })}
                  disabled={update.isPending}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Unassigned</option>
                  {users.filter((u) => u.isActive).map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>

              {/* Contact */}
              {ticket.contact && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contact</p>
                  <p className="text-sm font-medium text-gray-900">{ticket.contact.firstName} {ticket.contact.lastName}</p>
                  {ticket.contact.email && <p className="text-xs text-gray-500 mt-0.5">{ticket.contact.email}</p>}
                  {ticket.contact.phone && <p className="text-xs text-gray-500">{ticket.contact.phone}</p>}
                </div>
              )}

              {/* Trip */}
              {ticket.trip && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Trip</p>
                  <p className="text-sm font-mono font-bold text-gray-900">
                    {ticket.trip.originIcao} → {ticket.trip.destinationIcao}
                  </p>
                  <p className="text-xs text-gray-500">{fmtDate(ticket.trip.departureAt)}</p>
                </div>
              )}

              {/* Meta */}
              <div className="space-y-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
                <div className="flex justify-between">
                  <span>Opened</span>
                  <span>{fmtDate(ticket.createdAt)}</span>
                </div>
                {ticket.resolvedAt && (
                  <div className="flex justify-between">
                    <span>Resolved</span>
                    <span>{fmtDate(ticket.resolvedAt)}</span>
                  </div>
                )}
                {ticket.slaBreachAt && !ticket.resolvedAt && (
                  <div className={clsx('flex justify-between', ticket.slaBreach ? 'text-red-500' : '')}>
                    <span>SLA due</span>
                    <span>{fmtTime(ticket.slaBreachAt)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Source</span>
                  <span className="capitalize">{ticket.source.replace('_', ' ').toLowerCase()}</span>
                </div>
              </div>

              {/* Current badge */}
              <div>
                <Badge variant={ticketStatusBadge(ticket.status)} size="sm">
                  {ticket.status.replace('_', ' ')}
                </Badge>
              </div>

            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
