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
import { PlusIcon, FlagIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AirportSearch } from '@/components/ui/AirportSearch'
import { type Airport, distanceNm, estimatedHours, formatHours } from '@/api/airports.api'
import { useCrew, type CrewMember } from '@/api/crew.api'
import { useAircraftList } from '@/api/aircraft.api'

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
  tripType: z.enum(['ONE_WAY', 'ROUND_TRIP']).default('ONE_WAY'),
  departureAt: z.string().min(1, 'Departure date/time is required'),
  arrivalAt: z.string().optional(),
  returnDepartureAt: z.string().optional(),
  returnArrivalAt: z.string().optional(),
  paxCount: z.coerce.number().int().min(1, 'At least 1 passenger').max(999),
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
  const [originAirport, setOriginAirport] = useState<Airport | null>(null)
  const [destinationAirport, setDestinationAirport] = useState<Airport | null>(null)

  // Aircraft picker state
  const [aircraftSearch, setAircraftSearch] = useState('')
  const [selectedAircraftId, setSelectedAircraftId] = useState('')
  const [selectedAircraftLabel, setSelectedAircraftLabel] = useState('')
  const [showAircraftDropdown, setShowAircraftDropdown] = useState(false)

  // Crew picker state
  const [crewSearch, setCrewSearch] = useState('')
  const [selectedCrew, setSelectedCrew] = useState<Pick<CrewMember, 'id' | 'firstName' | 'lastName' | 'role'>[]>([])

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
    defaultValues: { paxCount: 1, tripType: 'ONE_WAY' },
  })

  const watchTripType = newTripForm.watch('tripType')

  // Aircraft search query (only when modal is open)
  const { data: aircraftListData } = useAircraftList(
    newTripOpen ? { isActive: true, pageSize: 50 } : undefined
  )
  const aircraftList = aircraftListData?.data ?? []

  // Crew search query (only when modal is open)
  const { data: crewData } = useCrew(
    newTripOpen ? { isActive: true, pageSize: 50 } : undefined
  )
  const allCrew = crewData?.data ?? []
  const filteredCrew = allCrew.filter((m) =>
    !selectedCrew.find((s) => s.id === m.id) &&
    (crewSearch === '' || `${m.firstName} ${m.lastName} ${m.role}`.toLowerCase().includes(crewSearch.toLowerCase()))
  )

  async function handleFlagDelay(values: DelayForm) {
    if (!delayTrip) return
    await flagDelay.mutateAsync({ id: delayTrip.id, delayNotes: values.reason })
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

  function resetNewTripForm() {
    setNewTripOpen(false)
    newTripForm.reset()
    setOriginAirport(null)
    setDestinationAirport(null)
    setSelectedAircraftId('')
    setSelectedAircraftLabel('')
    setAircraftSearch('')
    setSelectedCrew([])
    setCrewSearch('')
  }

  async function handleCreateTrip(values: NewTripForm) {
    const isRoundTrip = values.tripType === 'ROUND_TRIP'
    const nm = (originAirport?.latitudeDeg != null && destinationAirport?.latitudeDeg != null)
      ? distanceNm(originAirport.latitudeDeg, originAirport.longitudeDeg!, destinationAirport.latitudeDeg, destinationAirport.longitudeDeg!)
      : undefined
    await createTrip.mutateAsync({
      originIcao: values.originIcao,
      destinationIcao: values.destinationIcao,
      departureAt: new Date(values.departureAt).toISOString(),
      arrivalAt: values.arrivalAt ? new Date(values.arrivalAt).toISOString() : undefined,
      returnDepartureAt: isRoundTrip && values.returnDepartureAt
        ? new Date(values.returnDepartureAt).toISOString()
        : undefined,
      returnArrivalAt: isRoundTrip && values.returnArrivalAt
        ? new Date(values.returnArrivalAt).toISOString()
        : undefined,
      paxCount: values.paxCount,
      notes: values.notes || undefined,
      aircraftId: selectedAircraftId || undefined,
      crewIds: selectedCrew.map((c) => c.id),
      distanceNm: nm ? Math.round(nm) : undefined,
      estimatedHours: nm ? Math.round(estimatedHours(nm) * 10) / 10 : undefined,
    })
    resetNewTripForm()
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
        const origin = t.legs?.[0]?.originIcao ?? t.originIcao
        const destination = t.legs?.[0]?.destinationIcao ?? t.destinationIcao
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-gray-900 text-sm tracking-wide">
              {origin}
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
              {destination}
            </span>
            {t.returnDepartureAt && (
              <span className="ml-1 text-xs text-primary-600 font-medium">↩ RT</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'aircraft',
      header: 'Aircraft',
      render: (t) => (
        <span className="text-sm">{t.aircraft?.tailNumber ?? '—'}</span>
      ),
    },
    {
      key: 'departure',
      header: 'Departure',
      render: (t) => {
        const dep = new Date(t.departureAt)
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
      key: 'pax',
      header: 'PAX',
      render: (t) => <span className="text-sm text-gray-700">{t.paxCount}</span>,
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
        onClose={resetNewTripForm}
        title="New Trip"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={resetNewTripForm}>
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
          {/* Route */}
          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="originIcao"
              control={newTripForm.control}
              render={({ field, fieldState }) => (
                <AirportSearch
                  label="Origin"
                  required
                  value={field.value ?? ''}
                  placeholder="KTEB"
                  error={fieldState.error?.message}
                  onChange={(icao, airport) => { field.onChange(icao); setOriginAirport(airport) }}
                />
              )}
            />
            <Controller
              name="destinationIcao"
              control={newTripForm.control}
              render={({ field, fieldState }) => (
                <AirportSearch
                  label="Destination"
                  required
                  value={field.value ?? ''}
                  placeholder="KFLL"
                  error={fieldState.error?.message}
                  onChange={(icao, airport) => { field.onChange(icao); setDestinationAirport(airport) }}
                />
              )}
            />
          </div>
          {originAirport?.latitudeDeg != null && destinationAirport?.latitudeDeg != null && (() => {
            const nm = distanceNm(originAirport.latitudeDeg!, originAirport.longitudeDeg!, destinationAirport.latitudeDeg!, destinationAirport.longitudeDeg!)
            const hrs = estimatedHours(nm)
            return (
              <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-1.5">
                ✈ Est. <span className="font-medium text-gray-700">{Math.round(nm).toLocaleString()} nm</span>
                {' · '}
                <span className="font-medium text-gray-700">{formatHours(hrs)}</span> flight time
              </p>
            )
          })()}

          {/* Trip type toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trip Type</label>
            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              {(['ONE_WAY', 'ROUND_TRIP'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => newTripForm.setValue('tripType', type)}
                  className={clsx(
                    'flex-1 py-2 text-sm font-medium transition-colors',
                    watchTripType === type
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {type === 'ONE_WAY' ? 'One Way' : 'Round Trip'}
                </button>
              ))}
            </div>
          </div>

          {/* Outbound departure / arrival */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departure <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                className="form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                className="form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...newTripForm.register('arrivalAt')}
              />
            </div>
          </div>

          {/* Return leg (round trip only) */}
          {watchTripType === 'ROUND_TRIP' && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Departure
                </label>
                <input
                  type="datetime-local"
                  className="form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  {...newTripForm.register('returnDepartureAt')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Arrival
                </label>
                <input
                  type="datetime-local"
                  className="form-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  {...newTripForm.register('returnArrivalAt')}
                />
              </div>
            </div>
          )}

          <Input
            label="PAX Count"
            type="number"
            required
            min={1}
            error={newTripForm.formState.errors.paxCount?.message}
            {...newTripForm.register('paxCount')}
          />

          {/* Aircraft picker */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Aircraft</label>
            <input
              type="text"
              placeholder="Search by tail number or make/model…"
              value={selectedAircraftLabel || aircraftSearch}
              onChange={(e) => {
                setAircraftSearch(e.target.value)
                setSelectedAircraftId('')
                setSelectedAircraftLabel('')
                setShowAircraftDropdown(true)
              }}
              onFocus={() => setShowAircraftDropdown(true)}
              onBlur={() => setTimeout(() => setShowAircraftDropdown(false), 150)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {showAircraftDropdown && aircraftList.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full bg-white rounded-md border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                {aircraftList
                  .filter((a) => !aircraftSearch || `${a.registration} ${a.make} ${a.model}`.toLowerCase().includes(aircraftSearch.toLowerCase()))
                  .map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onMouseDown={() => {
                          setSelectedAircraftId(a.id)
                          setSelectedAircraftLabel(`${a.registration} — ${a.make} ${a.model}`)
                          setAircraftSearch('')
                          setShowAircraftDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 flex items-center gap-3"
                      >
                        <span className="font-mono font-bold text-gray-900 w-16 shrink-0">{a.registration}</span>
                        <span className="text-gray-600">{a.make} {a.model}</span>
                        {a.seatingCapacity && <span className="ml-auto text-xs text-gray-400">{a.seatingCapacity} seats</span>}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            {selectedAircraftId && (
              <button
                type="button"
                onClick={() => { setSelectedAircraftId(''); setSelectedAircraftLabel(''); setAircraftSearch('') }}
                className="absolute right-2 top-8 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Crew picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Crew</label>
            {selectedCrew.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedCrew.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-medium">
                    {m.firstName} {m.lastName}
                    <span className="text-primary-400">· {m.role.replace('_', ' ')}</span>
                    <button type="button" onClick={() => setSelectedCrew((prev) => prev.filter((c) => c.id !== m.id))}>
                      <XMarkIcon className="h-3 w-3 ml-0.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="Search crew by name or role…"
              value={crewSearch}
              onChange={(e) => setCrewSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {filteredCrew.length > 0 && crewSearch.length > 0 && (
              <ul className="mt-1 w-full bg-white rounded-md border border-gray-200 shadow-sm max-h-36 overflow-y-auto">
                {filteredCrew.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCrew((prev) => [...prev, { id: m.id, firstName: m.firstName, lastName: m.lastName, role: m.role }])
                        setCrewSearch('')
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 flex items-center gap-2"
                    >
                      <span className="font-medium text-gray-900">{m.firstName} {m.lastName}</span>
                      <span className="text-xs text-gray-400 ml-auto">{m.role.replace('_', ' ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              rows={3}
              placeholder="Any special instructions or notes..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              {...newTripForm.register('notes')}
            />
          </div>

          {createTrip.isError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              Failed to create trip. Please try again.
            </p>
          )}
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
