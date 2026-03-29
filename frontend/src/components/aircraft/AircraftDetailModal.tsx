import { useState, useEffect } from 'react'
import { XMarkIcon, PencilIcon, CheckIcon } from '@heroicons/react/20/solid'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useAircraft, useUpdateAircraft } from '@/api/aircraft.api'
import { useContacts } from '@/api/contacts.api'
import { AirportSearch } from '@/components/ui/AirportSearch'
import { useAircraftClasses } from '@/api/aircraft-classes.api'

interface Props {
  aircraftId: string | null
  onClose: () => void
}

interface EditState {
  make: string
  model: string
  year: string
  seats: string
  rangeNm: string
  homeBaseIcao: string
  hourlyRate: string
  basePrice: string
  costPerHour: string
  airframeHours: string
  engineHours: string
  ownerId: string | null
  aircraftClassId: string
}

export function AircraftDetailModal({ aircraftId, onClose }: Props) {
  const { data: aircraft, isLoading } = useAircraft(aircraftId)
  const update = useUpdateAircraft()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditState | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [ownerSearch, setOwnerSearch] = useState('')

  const { data: classesData } = useAircraftClasses()
  const allClasses = classesData ?? []

  const { data: ownerResults } = useContacts(
    editing && ownerSearch ? { type: 'OWNER', search: ownerSearch, pageSize: 20 } : undefined
  )

  useEffect(() => {
    if (aircraft && !editing) {
      setForm({
        make: aircraft.make,
        model: aircraft.model,
        year: aircraft.year?.toString() ?? '',
        seats: aircraft.seatingCapacity?.toString() ?? '',
        rangeNm: aircraft.rangeNm?.toString() ?? '',
        homeBaseIcao: aircraft.homeBaseIcao ?? '',
        hourlyRate: aircraft.hourlyRate?.toString() ?? '',
        basePrice: aircraft.basePrice?.toString() ?? '',
        costPerHour: aircraft.costPerHour?.toString() ?? '',
        airframeHours: aircraft.airframeHours?.toString() ?? '',
        engineHours: aircraft.engineHours?.toString() ?? '',
        ownerId: aircraft.ownerId ?? null,
        aircraftClassId: aircraft.aircraftClassId ?? '',
      })
      setOwnerSearch('')
    }
  }, [aircraft, editing])

  if (!aircraftId) return null

  const selectedOwner = form?.ownerId
    ? ownerResults?.data.find((c) => c.id === form.ownerId) ?? aircraft?.owner
    : null

  async function handleSave() {
    if (!form || !aircraftId) return
    await update.mutateAsync({
      id: aircraftId,
      data: {
        make: form.make,
        model: form.model,
        year: form.year ? parseInt(form.year) : undefined,
        seats: parseInt(form.seats),
        rangeNm: form.rangeNm ? parseFloat(form.rangeNm) : undefined,
        homeBaseIcao: form.homeBaseIcao || undefined,
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
        basePrice: form.basePrice ? parseFloat(form.basePrice) : undefined,
        costPerHour: form.costPerHour ? parseFloat(form.costPerHour) : undefined,
        ownerId: form.ownerId ?? undefined,
        aircraftClassId: form.aircraftClassId || null,
      },
    })
    setEditing(false)
  }

  async function handleToggleCharter() {
    if (!aircraftId || !aircraft) return
    await update.mutateAsync({ id: aircraftId, data: { isActive: !aircraft.isActive } })
    setConfirmRemove(false)
  }

  const field = (label: string, value: string, key: keyof Omit<EditState, 'ownerId'>, type: 'text' | 'number' = 'text') => (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      {editing ? (
        <input
          type={type}
          value={form?.[key] ?? ''}
          onChange={(e) => setForm((f) => f ? { ...f, [key]: e.target.value } : f)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      ) : (
        <p className="text-sm text-gray-900">{value || <span className="text-gray-400">—</span>}</p>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
              <svg className="h-5 w-5 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </div>
            <div>
              {isLoading ? (
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
              ) : (
                <>
                  <h2 className="text-lg font-bold text-gray-900 font-mono tracking-wide">{aircraft?.registration}</h2>
                  <p className="text-sm text-gray-500">{aircraft?.make} {aircraft?.model}{aircraft?.year ? ` · ${aircraft.year}` : ''}</p>
                </>
              )}
            </div>
            {aircraft && (
              <Badge variant={aircraft.isActive ? 'success' : 'default'} size="sm">
                {aircraft.isActive ? 'In Charter' : 'Out of Charter'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={update.isPending}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} loading={update.isPending}>
                  <CheckIcon className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <PencilIcon className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : aircraft ? (
          <div className="p-6 space-y-6">

            {/* Specs */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Specifications</h3>
              <div className="grid grid-cols-2 gap-4">
                {field('Make', aircraft.make, 'make')}
                {field('Model', aircraft.model, 'model')}
                {field('Year', aircraft.year?.toString() ?? '', 'year', 'number')}
                {field('Seats', aircraft.seatingCapacity?.toString() ?? '', 'seats', 'number')}
                {field('Range (nm)', aircraft.rangeNm?.toString() ?? '', 'rangeNm', 'number')}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Home Base</p>
                  {editing ? (
                    <AirportSearch
                      label=""
                      value={form?.homeBaseIcao ?? ''}
                      placeholder="KTEB"
                      onChange={(icao) => setForm((f) => f ? { ...f, homeBaseIcao: icao } : f)}
                    />
                  ) : (
                    <p className="text-sm text-gray-900 font-mono">{aircraft.homeBaseIcao || <span className="text-gray-400 font-sans">—</span>}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Aircraft Class */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Classification</h3>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Aircraft Class</p>
                {editing ? (
                  <select
                    value={form?.aircraftClassId ?? ''}
                    onChange={(e) => setForm((f) => f ? { ...f, aircraftClassId: e.target.value } : f)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">— None —</option>
                    {allClasses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.regulatoryCategory ? ` (${c.regulatoryCategory})` : ''}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-900">
                    {allClasses.find((c) => c.id === aircraft.aircraftClassId)?.name ?? <span className="text-gray-400">—</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Financials */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Financials</h3>
              <div className="grid grid-cols-3 gap-4">
                {field('Base Price ($)', aircraft.basePrice?.toString() ?? '', 'basePrice', 'number')}
                {field('Client Rate ($/hr)', aircraft.hourlyRate?.toString() ?? '', 'hourlyRate', 'number')}
                {field('Cost/Hr ($)', aircraft.costPerHour?.toString() ?? '', 'costPerHour', 'number')}
              </div>
            </div>

            {/* Maintenance */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Maintenance</h3>
              <div className="grid grid-cols-2 gap-4">
                {field('Airframe Hours', aircraft.airframeHours?.toString() ?? '', 'airframeHours', 'number')}
                {field('Engine Hours', aircraft.engineHours?.toString() ?? '', 'engineHours', 'number')}
              </div>
            </div>

            {/* Owner */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Owner</h3>
              {editing ? (
                <div className="space-y-2">
                  {/* Current selection */}
                  {selectedOwner && (
                    <div className="flex items-center justify-between rounded-lg bg-primary-50 border border-primary-200 px-3 py-2">
                      <span className="text-sm font-medium text-primary-900">
                        {selectedOwner.firstName} {selectedOwner.lastName}
                      </span>
                      <button
                        onClick={() => { setForm((f) => f ? { ...f, ownerId: null } : f); setOwnerSearch('') }}
                        className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Search owners by name…"
                    value={ownerSearch}
                    onChange={(e) => setOwnerSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  {/* Results */}
                  {ownerResults?.data && ownerResults.data.length > 0 && (
                    <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-40 overflow-y-auto">
                      {ownerResults.data.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => {
                            setForm((f) => f ? { ...f, ownerId: contact.id } : f)
                            setOwnerSearch('')
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                        >
                          <span className="font-medium text-gray-900">{contact.firstName} {contact.lastName}</span>
                          {contact.email && <span className="text-gray-400 ml-2">{contact.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {ownerSearch && ownerResults?.data.length === 0 && (
                    <p className="text-sm text-gray-400 px-1">No owners found matching "{ownerSearch}"</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-900">
                  {aircraft.owner
                    ? `${aircraft.owner.firstName} ${aircraft.owner.lastName}`
                    : <span className="text-gray-400">No owner assigned</span>
                  }
                </p>
              )}
            </div>

            {/* Charter status action */}
            <div className="border-t border-gray-100 pt-5">
              {aircraft.isActive ? (
                confirmRemove ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                    <p className="text-sm font-medium text-amber-900 mb-1">Remove from charter?</p>
                    <p className="text-xs text-amber-700 mb-3">
                      This aircraft will no longer appear as available for new quotes. All trip history is retained.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>Cancel</Button>
                      <button
                        onClick={handleToggleCharter}
                        disabled={update.isPending}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                      >
                        {update.isPending ? 'Updating…' : 'Confirm Remove'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemove(true)}
                    className="text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors"
                  >
                    Remove from Charter
                  </button>
                )
              ) : (
                <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Out of Charter</p>
                    <p className="text-xs text-gray-500">This aircraft is not available for new quotes.</p>
                  </div>
                  <Button size="sm" onClick={handleToggleCharter} loading={update.isPending}>
                    Restore to Charter
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
