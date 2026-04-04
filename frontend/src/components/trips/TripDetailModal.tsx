import { useState, useEffect, useRef } from 'react'
import { XMarkIcon, PencilIcon, CheckIcon, UserPlusIcon, XCircleIcon } from '@heroicons/react/20/solid'
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline'
import { Badge, tripStatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useTrip, useAddTripPassenger, useRemoveTripPassenger } from '@/api/trips.api'
import { TripManifestModal } from './TripManifestModal'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { AirportSearch } from '@/components/ui/AirportSearch'
import { type Airport, distanceNm, estimatedHours, formatHours } from '@/api/airports.api'
import { useAircraftList } from '@/api/aircraft.api'
import { CrewPicker, type SelectedCrewMember } from '@/components/crew/CrewPicker'
import { useContacts, type Contact } from '@/api/contacts.api'

interface Props {
  tripId: string | null
  onClose: () => void
}

interface EditState {
  originIcao: string
  destinationIcao: string
  departureAt: string
  arrivalAt: string
  paxCount: string
  fboName: string
  notes: string
  aircraftId: string
  aircraftLabel: string
}

function toLocalDatetime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TripDetailModal({ tripId, onClose }: Props) {
  const { data: trip, isLoading } = useTrip(tripId ?? '')
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [manifestOpen, setManifestOpen] = useState(false)
  const [form, setForm] = useState<EditState | null>(null)
  const [originAirport, setOriginAirport] = useState<Airport | null>(null)
  const [destinationAirport, setDestinationAirport] = useState<Airport | null>(null)
  const [showAircraftDropdown, setShowAircraftDropdown] = useState(false)
  const [aircraftSearch, setAircraftSearch] = useState('')
  const [selectedCrew, setSelectedCrew] = useState<SelectedCrewMember[]>([])

  const { data: aircraftListData } = useAircraftList(editing ? { isActive: true, pageSize: 50 } : undefined)
  const aircraftList = aircraftListData?.data ?? []

  // PAX manifest
  const [paxSearch, setPaxSearch] = useState('')
  const [showPaxDropdown, setShowPaxDropdown] = useState(false)
  const paxSearchRef = useRef<HTMLInputElement>(null)
  const { data: contactResults } = useContacts(
    paxSearch.length >= 2 ? { search: paxSearch, pageSize: 8 } : undefined
  )
  const addPassenger = useAddTripPassenger()
  const removePassenger = useRemoveTripPassenger()


  const update = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiClient.patch(`/trips/${tripId}`, data)
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] })
      setEditing(false)
    },
  })

  useEffect(() => {
    if (trip && !editing) {
      setForm({
        originIcao: trip.originIcao,
        destinationIcao: trip.destinationIcao,
        departureAt: toLocalDatetime(trip.departureAt),
        arrivalAt: toLocalDatetime(trip.arrivalAt),
        paxCount: String(trip.paxCount),
        fboName: (trip as unknown as { fboName?: string }).fboName ?? '',
        notes: trip.notes ?? '',
        aircraftId: trip.aircraft?.id ?? '',
        aircraftLabel: trip.aircraft ? `${trip.aircraft.tailNumber} — ${trip.aircraft.make} ${trip.aircraft.model}` : '',
      })
      const crewAssignments = (trip as unknown as { crewAssignments?: { crewMember: SelectedCrewMember }[] }).crewAssignments ?? []
      setSelectedCrew(crewAssignments.map((a) => a.crewMember))
      setOriginAirport(null)
      setDestinationAirport(null)
    }
  }, [trip, editing])

  if (!tripId) return null

  const routeStats = (originAirport?.latitudeDeg != null && originAirport?.longitudeDeg != null &&
    destinationAirport?.latitudeDeg != null && destinationAirport?.longitudeDeg != null)
    ? (() => {
        const nm = distanceNm(originAirport.latitudeDeg!, originAirport.longitudeDeg!, destinationAirport.latitudeDeg!, destinationAirport.longitudeDeg!)
        return { nm: Math.round(nm), hours: formatHours(estimatedHours(nm)) }
      })()
    : null

  async function handleSave() {
    if (!form || !tripId) return
    await update.mutateAsync({
      originIcao: form.originIcao,
      destinationIcao: form.destinationIcao,
      departureAt: form.departureAt ? new Date(form.departureAt).toISOString() : undefined,
      arrivalAt: form.arrivalAt ? new Date(form.arrivalAt).toISOString() : null,
      paxCount: parseInt(form.paxCount) || 0,
      fboName: form.fboName || null,
      notes: form.notes || null,
      aircraftId: form.aircraftId || null,
      crewIds: selectedCrew.map((c) => c.id),
    })
  }

  const fmt = (iso: string | null | undefined) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            {isLoading ? (
              <div className="h-6 w-40 bg-gray-100 rounded animate-pulse" />
            ) : (
              <>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-0.5">Trip</p>
                <h2 className="text-lg font-bold text-gray-900 font-mono">{trip?.reference}</h2>
                {trip && <Badge variant={tripStatusBadge(trip.status)} size="sm" className="mt-1">{trip.status.replace('_', ' ')}</Badge>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && (
              editing ? (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button size="sm" loading={update.isPending} onClick={handleSave}>
                    <CheckIcon className="h-4 w-4 mr-1" /> Save
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setManifestOpen(true)}>
                    <ClipboardDocumentListIcon className="h-4 w-4 mr-1" /> Manifest
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                    <PencilIcon className="h-4 w-4 mr-1" /> Edit
                  </Button>
                </>
              )
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
        ) : trip && form ? (
          <div className="p-6 space-y-6">

            {/* Route */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Route</h3>
              <div className="grid grid-cols-2 gap-4">
                {editing ? (
                  <>
                    <AirportSearch
                      label="Origin"
                      value={form.originIcao}
                      onChange={(icao, airport) => { setForm((f) => f ? { ...f, originIcao: icao } : f); setOriginAirport(airport) }}
                    />
                    <AirportSearch
                      label="Destination"
                      value={form.destinationIcao}
                      onChange={(icao, airport) => { setForm((f) => f ? { ...f, destinationIcao: icao } : f); setDestinationAirport(airport) }}
                    />
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Origin</p>
                      <p className="text-sm font-mono font-bold text-gray-900">{trip.originIcao}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Destination</p>
                      <p className="text-sm font-mono font-bold text-gray-900">{trip.destinationIcao}</p>
                    </div>
                  </>
                )}
              </div>
              {routeStats && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-1.5 mt-3">
                  ✈ Est. <span className="font-medium text-gray-700">{routeStats.nm.toLocaleString()} nm</span>
                  {' · '}
                  <span className="font-medium text-gray-700">{routeStats.hours}</span> flight time
                </p>
              )}
            </div>

            {/* Schedule */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Schedule</h3>
              <div className="grid grid-cols-2 gap-4">
                {editing ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Departure</label>
                      <input type="datetime-local" value={form.departureAt} onChange={(e) => setForm((f) => f ? { ...f, departureAt: e.target.value } : f)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Arrival</label>
                      <input type="datetime-local" value={form.arrivalAt} onChange={(e) => setForm((f) => f ? { ...f, arrivalAt: e.target.value } : f)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Departure</p>
                      <p className="text-sm text-gray-900">{fmt(trip.departureAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Arrival</p>
                      <p className="text-sm text-gray-900">{fmt(trip.arrivalAt)}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Aircraft + PAX */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Aircraft & Passengers</h3>
              <div className="grid grid-cols-2 gap-4">
                {editing ? (
                  <>
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Aircraft</label>
                      <input
                        type="text"
                        placeholder="Search…"
                        value={form.aircraftLabel || aircraftSearch}
                        onChange={(e) => { setAircraftSearch(e.target.value); setForm((f) => f ? { ...f, aircraftId: '', aircraftLabel: '' } : f); setShowAircraftDropdown(true) }}
                        onFocus={() => setShowAircraftDropdown(true)}
                        onBlur={() => setTimeout(() => setShowAircraftDropdown(false), 150)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      {showAircraftDropdown && (
                        <ul className="absolute z-20 mt-1 w-full bg-white rounded-md border border-gray-200 shadow-lg max-h-40 overflow-y-auto">
                          {aircraftList
                            .filter((a) => !aircraftSearch || `${a.registration} ${a.make} ${a.model}`.toLowerCase().includes(aircraftSearch.toLowerCase()))
                            .map((a) => (
                              <li key={a.id}>
                                <button type="button" onMouseDown={() => {
                                  setForm((f) => f ? { ...f, aircraftId: a.id, aircraftLabel: `${a.registration} — ${a.make} ${a.model}` } : f)
                                  setAircraftSearch('')
                                  setShowAircraftDropdown(false)
                                }} className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 flex gap-2">
                                  <span className="font-mono font-bold w-14 shrink-0">{a.registration}</span>
                                  <span className="text-gray-600">{a.make} {a.model}</span>
                                </button>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">PAX Count</label>
                      <input type="number" min={0} value={form.paxCount}
                        onChange={(e) => setForm((f) => f ? { ...f, paxCount: e.target.value } : f)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Aircraft</p>
                      <p className="text-sm text-gray-900 font-mono">{trip.aircraft ? `${trip.aircraft.tailNumber} — ${trip.aircraft.make} ${trip.aircraft.model}` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">PAX Count</p>
                      <p className="text-sm text-gray-900">{trip.paxCount}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Passengers */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Passengers
                {(() => {
                  const manifestCount = (trip.passengers ?? []).length
                  const declared = trip.paxCount
                  if (manifestCount === declared) return null
                  return (
                    <span className="ml-2 normal-case font-normal text-amber-600">
                      ({manifestCount} on manifest, {declared} declared)
                    </span>
                  )
                })()}
              </h3>

              {/* Reconciliation banner */}
              {(() => {
                const manifestCount = (trip.passengers ?? []).length
                const declared = trip.paxCount
                if (manifestCount === declared) return null
                const short = declared > manifestCount
                return (
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-3 text-sm">
                    <span className="text-amber-500 text-base shrink-0">⚠</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-amber-800">
                        PAX count mismatch — manifest has {manifestCount}, trip declares {declared}
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        {short
                          ? `${declared - manifestCount} passenger${declared - manifestCount !== 1 ? 's' : ''} still need to be added to the manifest, or reduce the PAX count.`
                          : `The manifest has ${manifestCount - declared} more passenger${manifestCount - declared !== 1 ? 's' : ''} than declared. Update the PAX count or remove a passenger.`}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => update.mutate({ paxCount: manifestCount })}
                          disabled={update.isPending}
                          className="text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                        >
                          Set PAX count to {manifestCount}
                        </button>
                        {short && (
                          <span className="text-xs text-amber-600 self-center">
                            — or add {declared - manifestCount} more passenger{declared - manifestCount !== 1 ? 's' : ''} below
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="space-y-2">
                {(trip.passengers ?? []).length > 0 ? (
                  <ul className="space-y-1">
                    {(trip.passengers ?? []).map((p) => (
                      <li key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-semibold shrink-0">
                            {p.contact.firstName[0]}{p.contact.lastName[0]}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-900">{p.contact.firstName} {p.contact.lastName}</span>
                            {p.isPrimary && <span className="ml-1.5 text-xs text-primary-600 font-medium">Primary</span>}
                            <p className="text-xs text-gray-400">
                              {p.contact.phone ?? <span className="text-amber-500">⚠ no phone</span>}
                              {p.contact.email && <span className="ml-2">{p.contact.email}</span>}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePassenger.mutate({ tripId: trip.id, passengerId: p.id })}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          aria-label="Remove passenger"
                        >
                          <XCircleIcon className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">No passengers on manifest</p>
                )}

                {/* Contact search to add passenger */}
                <div className="relative mt-2">
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 focus-within:border-primary-400 focus-within:bg-primary-50/30 transition-colors">
                    <UserPlusIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    <input
                      ref={paxSearchRef}
                      type="text"
                      placeholder="Search contacts to add…"
                      value={paxSearch}
                      onChange={(e) => { setPaxSearch(e.target.value); setShowPaxDropdown(true) }}
                      onFocus={() => setShowPaxDropdown(true)}
                      onBlur={() => setTimeout(() => setShowPaxDropdown(false), 150)}
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                    />
                  </div>
                  {showPaxDropdown && paxSearch.length >= 2 && (contactResults?.data ?? []).length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                      {(contactResults?.data ?? [])
                        .filter((c) => !(trip.passengers ?? []).some((p) => p.contactId === c.id))
                        .map((c: Contact) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onMouseDown={async () => {
                                await addPassenger.mutateAsync({ tripId: trip.id, contactId: c.id })
                                setPaxSearch('')
                                setShowPaxDropdown(false)
                                paxSearchRef.current?.blur()
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 flex items-center gap-3"
                            >
                              <div className="h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-semibold shrink-0">
                                {c.firstName[0]}{c.lastName[0]}
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">{c.firstName} {c.lastName}</span>
                                {c.email && <span className="ml-2 text-xs text-gray-400">{c.email}</span>}
                              </div>
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Crew */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Crew</h3>
              {editing ? (
                <CrewPicker selectedCrew={selectedCrew} onChange={setSelectedCrew} />
              ) : selectedCrew.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCrew.map((m) => (
                    <span key={m.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                      {m.firstName} {m.lastName}
                      <span className="text-gray-400">· {m.role.replace('_', ' ')}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No crew assigned</p>
              )}
            </div>

            {/* FBO + Notes */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Details</h3>
              <div className="space-y-3">
                {editing ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">FBO Name</label>
                      <input type="text" value={form.fboName} onChange={(e) => setForm((f) => f ? { ...f, fboName: e.target.value } : f)}
                        placeholder="FBO or handling agent"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</label>
                      <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => f ? { ...f, notes: e.target.value } : f)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">FBO</p>
                      <p className="text-sm text-gray-900">{(trip as unknown as { fboName?: string }).fboName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{trip.notes || '—'}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {update.isError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">Failed to save. Please try again.</p>
            )}
          </div>
        ) : null}
      </div>

      {manifestOpen && trip && (
        <TripManifestModal trip={trip} onClose={() => setManifestOpen(false)} />
      )}
    </div>
  )
}
