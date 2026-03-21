import { useState } from 'react'
import { clsx } from 'clsx'
import {
  useTrips,
  useUpdateTripStatus,
  useFlagDelay,
  useCreateTrip,
  type Trip,
  type TripStatus,
} from '@/api/trips.api'
import { Table, type Column } from '@/components/ui/Table'
import { Badge, tripStatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import { PlusIcon, FlagIcon } from '@heroicons/react/20/solid'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// ── Constants ────────────────────────────────────────────────────────────────

const STATUSES: TripStatus[] = [
  'INQUIRY',
  'QUOTED',
  'CONFIRMED',
  'MANIFEST_LOCKED',
  'DEPARTED',
  'COMPLETED',
  'CANCELLED',
]

// ── Schemas ──────────────────────────────────────────────────────────────────

const delaySchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
})

const statusSchema = z.object({
  status: z.enum([
    'INQUIRY',
    'QUOTED',
    'CONFIRMED',
    'MANIFEST_LOCKED',
    'DEPARTED',
    'COMPLETED',
    'CANCELLED',
  ]),
  notes: z.string().optional(),
})

const newTripSchema = z.object({
  originIcao: z.string().length(4, 'Must be 4 characters').toUpperCase(),
  destinationIcao: z.string().length(4, 'Must be 4 characters').toUpperCase(),
  departureAt: z.string().min(1, 'Departure date/time is required'),
  arrivalAt: z.string().optional(),
  pax: z.coerce.number().int().min(1, 'At least 1 passenger').max(999),
  notes: z.string().optional(),
})

type DelayForm = z.infer<typeof delaySchema>
type StatusForm = z.infer<typeof statusSchema>
type NewTripForm = z.infer<typeof newTripSchema>

// ── Status pipeline bar ──────────────────────────────────────────────────────

interface PipelineBarProps {
  trips: Trip[]
  activeStatus: string
  onSelect: (status: string) => void
}

const STATUS_LABELS: Record<TripStatus, string> = {
  INQUIRY: 'Inquiry',
  QUOTED: 'Quoted',
  CONFIRMED: 'Confirmed',
  MANIFEST_LOCKED: 'Manifest',
  DEPARTED: 'Departed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

function PipelineBar({ trips, activeStatus, onSelect }: PipelineBarProps) {
  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = trips.filter((t) => t.status === s).length
    return acc
  }, {})
  const total = trips.length

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <button
        onClick={() => onSelect('')}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors shrink-0',
          activeStatus === ''
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
        )}
      >
        All
        <span
          className={clsx(
            'inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-semibold',
            activeStatus === '' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600',
          )}
        >
          {total}
        </span>
      </button>

      {STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors shrink-0',
            activeStatus === s
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
          )}
        >
          {STATUS_LABELS[s]}
          {counts[s] > 0 && (
            <span
              className={clsx(
                'inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-semibold',
                activeStatus === s ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600',
              )}
            >
              {counts[s]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TripsPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [delayTrip, setDelayTrip] = useState<Trip | null>(null)
  const [statusTrip, setStatusTrip] = useState<Trip | null>(null)
  const [newTripOpen, setNewTripOpen] = useState(false)

  const { data, isLoading } = useTrips({
    page,
    pageSize: 20,
    status: (statusFilter as TripStatus) || undefined,
  })

  const updateStatus = useUpdateTripStatus()
  const flagDelay = useFlagDelay()
  const createTrip = useCreateTrip()

  const delayForm = useForm<DelayForm>({ resolver: zodResolver(delaySchema) })
  const statusForm = useForm<StatusForm>({ resolver: zodResolver(statusSchema) })
  const newTripForm = useForm<NewTripForm>({
    resolver: zodResolver(newTripSchema),
    defaultValues: { pax: 1 },
  })

  async function handleFlagDelay(values: DelayForm) {
    if (!delayTrip) return
    await flagDelay.mutateAsync({ id: delayTrip.id, reason: values.reason })
    setDelayTrip(null)
    delayForm.reset()
  }

  async function handleStatusUpdate(values: StatusForm) {
    if (!statusTrip) return
    await updateStatus.mutateAsync({ id: statusTrip.id, status: values.status, notes: values.notes })
    setStatusTrip(null)
    statusForm.reset()
  }

  function openStatusModal(trip: Trip) {
    setStatusTrip(trip)
    statusForm.reset({ status: trip.status })
  }

  async function handleCreateTrip(values: NewTripForm) {
    await createTrip.mutateAsync({
      departureAirport: values.originIcao,
      arrivalAirport: values.destinationIcao,
      departureTime: new Date(values.departureAt).toISOString(),
      arrivalTime: values.arrivalAt
        ? new Date(values.arrivalAt).toISOString()
        : new Date(values.departureAt).toISOString(),
      notes: values.notes || undefined,
      aircraftId: '',
      legs: [
        {
          sequence: 1,
          originIcao: values.originIcao,
          destinationIcao: values.destinationIcao,
          scheduledDeparture: new Date(values.departureAt).toISOString(),
          scheduledArrival: values.arrivalAt
            ? new Date(values.arrivalAt).toISOString()
            : new Date(values.departureAt).toISOString(),
        },
      ],
    })
    setNewTripOpen(false)
    newTripForm.reset()
  }

  const columns: Column<Trip>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (t) => <span className="font-mono font-medium text-gray-900">{t.reference}</span>,
    },
    {
      key: 'route',
      header: 'Route',
      render: (t) => {
        const originIcao = t.legs?.[0]?.originIcao ?? t.departureAirport
        const destinationIcao = t.legs?.[0]?.destinationIcao ?? t.arrivalAirport
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-gray-900 text-sm tracking-wide">
              {originIcao}
            </span>
            <svg
              className="h-3.5 w-3.5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
              />
            </svg>
            <span className="font-mono font-bold text-gray-900 text-sm tracking-wide">
              {destinationIcao}
            </span>
          </div>
        )
      },
    },
    {
      key: 'aircraft',
      header: 'Aircraft',
      render: (t) => (
        <span className="text-sm">{t.aircraft?.registration ?? '—'}</span>
      ),
    },
    {
      key: 'departure',
      header: 'Departure',
      render: (t) => {
        const dep = new Date(t.departureTime)
        const now = new Date()
        const diffH = (dep.getTime() - now.getTime()) / 3600000
        const formatted =
          dep.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
          ' · ' +
          dep.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        const isUrgent = diffH > 0 && diffH < 24
        const isPast = diffH < 0
        return (
          <div>
            <p
              className={`text-sm ${
                isPast ? 'text-gray-400' : isUrgent ? 'text-amber-600 font-medium' : 'text-gray-900'
              }`}
            >
              {formatted}
            </p>
            {isUrgent && (
              <p className="text-xs text-amber-500 mt-0.5">In {Math.round(diffH)}h</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => (
        <div className="flex items-center gap-2">
          <Badge variant={tripStatusBadge(t.status)} size="sm">
            {t.status.replace('_', ' ')}
          </Badge>
          {t.isDelayed && (
            <Badge variant="danger" size="sm">
              Delayed
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-32',
      render: (t) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              openStatusModal(t)
            }}
            className="rounded px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors"
          >
            Status
          </button>
          {!t.isDelayed && t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDelayTrip(t)
                delayForm.reset()
              }}
              className="rounded p-1 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
              aria-label="Flag delay"
            >
              <FlagIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Trips</h1>
        <Button size="md" onClick={() => setNewTripOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-1.5" />
          New Trip
        </Button>
      </div>

      {/* Pipeline status bar */}
      <PipelineBar
        trips={data?.data ?? []}
        activeStatus={statusFilter}
        onSelect={(s) => {
          setStatusFilter(s)
          setPage(1)
        }}
      />

      <Table
        columns={columns}
        data={data?.data ?? []}
        keyExtractor={(t) => t.id}
        loading={isLoading}
        emptyMessage="No trips found."
        pagination={data?.meta}
        onPageChange={setPage}
      />

      {/* New Trip Modal */}
      <Modal
        isOpen={newTripOpen}
        onClose={() => setNewTripOpen(false)}
        title="New Trip"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewTripOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={newTripForm.formState.isSubmitting}
              onClick={newTripForm.handleSubmit(handleCreateTrip)}
            >
              Create Trip
            </Button>
          </>
        }
      >
        <form className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Origin ICAO"
              required
              placeholder="KTEB"
              maxLength={4}
              error={newTripForm.formState.errors.originIcao?.message}
              {...newTripForm.register('originIcao')}
            />
            <Input
              label="Destination ICAO"
              required
              placeholder="KFLL"
              maxLength={4}
              error={newTripForm.formState.errors.destinationIcao?.message}
              {...newTripForm.register('destinationIcao')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departure <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                className="form-input"
                {...newTripForm.register('departureAt')}
              />
              {newTripForm.formState.errors.departureAt && (
                <p className="mt-1 text-xs text-red-600">
                  {newTripForm.formState.errors.departureAt.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Arrival</label>
              <input
                type="datetime-local"
                className="form-input"
                {...newTripForm.register('arrivalAt')}
              />
            </div>
          </div>
          <Input
            label="PAX Count"
            type="number"
            required
            min={1}
            error={newTripForm.formState.errors.pax?.message}
            {...newTripForm.register('pax')}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              rows={3}
              placeholder="Any special instructions or notes..."
              className="form-input resize-none"
              {...newTripForm.register('notes')}
            />
          </div>
        </form>
      </Modal>

      {/* Flag Delay Modal */}
      <Modal
        isOpen={!!delayTrip}
        onClose={() => setDelayTrip(null)}
        title="Flag Trip Delay"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDelayTrip(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={delayForm.formState.isSubmitting}
              onClick={delayForm.handleSubmit(handleFlagDelay)}
            >
              Flag Delay
            </Button>
          </>
        }
      >
        <form className="space-y-4" noValidate>
          <p className="text-sm text-gray-600">
            Flagging a delay will notify passengers and trigger any configured automations.
          </p>
          <Input
            label="Delay Reason"
            required
            error={delayForm.formState.errors.reason?.message}
            placeholder="e.g. Mechanical inspection required"
            {...delayForm.register('reason')}
          />
        </form>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        isOpen={!!statusTrip}
        onClose={() => setStatusTrip(null)}
        title="Update Trip Status"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusTrip(null)}>
              Cancel
            </Button>
            <Button
              loading={statusForm.formState.isSubmitting}
              onClick={statusForm.handleSubmit(handleStatusUpdate)}
            >
              Update
            </Button>
          </>
        }
      >
        <form className="space-y-4" noValidate>
          <Select
            label="New Status"
            required
            options={STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
            error={statusForm.formState.errors.status?.message}
            {...statusForm.register('status')}
          />
          <Input
            label="Notes (optional)"
            placeholder="Reason for status change"
            {...statusForm.register('notes')}
          />
        </form>
      </Modal>
    </div>
  )
}
