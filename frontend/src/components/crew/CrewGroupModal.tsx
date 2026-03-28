import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { Modal } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { XMarkIcon } from '@heroicons/react/20/solid'
import { useCrew } from '@/api/crew.api'
import { useAircraftList } from '@/api/aircraft.api'
import {
  useCreateCrewGroup, useUpdateCrewGroup, useSetCrewGroupMembers, type CrewGroup,
} from '@/api/crew-groups.api'

const ROLE_LABELS: Record<string, string> = {
  CAPTAIN: 'Captain', FIRST_OFFICER: 'First Officer',
  FLIGHT_ATTENDANT: 'Flight Attendant', DISPATCHER: 'Dispatcher',
  MECHANIC: 'Mechanic', OTHER: 'Other',
}

interface Props {
  isOpen: boolean
  group?: CrewGroup | null   // if provided, editing; else creating
  onClose: () => void
}

export function CrewGroupModal({ isOpen, group, onClose }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [aircraftId, setAircraftId] = useState('')
  const [minPax, setMinPax] = useState('')
  const [maxPax, setMaxPax] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [memberSearch, setMemberSearch] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: crewData } = useCrew({ isActive: true, pageSize: 200 })
  const allCrew = crewData?.data ?? []
  const { data: aircraftData } = useAircraftList({ isActive: true })
  const allAircraft = aircraftData?.data ?? []

  const createGroup = useCreateCrewGroup()
  const updateGroup = useUpdateCrewGroup()
  const setMembers = useSetCrewGroupMembers()

  const isEditing = !!group

  useEffect(() => {
    if (isOpen && group) {
      setName(group.name)
      setDescription(group.description ?? '')
      setAircraftId(group.aircraftId ?? '')
      setMinPax(group.minPax?.toString() ?? '')
      setMaxPax(group.maxPax?.toString() ?? '')
      setSelectedIds(new Set(group.members.map((m) => m.crewMemberId)))
    } else if (isOpen && !group) {
      setName('')
      setDescription('')
      setAircraftId('')
      setMinPax('')
      setMaxPax('')
      setSelectedIds(new Set())
    }
    setMemberSearch('')
    setErrors({})
  }, [isOpen, group])

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      aircraftId: aircraftId || null,
      minPax: minPax ? parseInt(minPax) : null,
      maxPax: maxPax ? parseInt(maxPax) : null,
    }
    let savedId: string
    if (isEditing) {
      const updated = await updateGroup.mutateAsync({ id: group!.id, data: payload })
      savedId = updated.id
    } else {
      const created = await createGroup.mutateAsync(payload)
      savedId = created.id
    }
    await setMembers.mutateAsync({ id: savedId, crewMemberIds: Array.from(selectedIds) })
    onClose()
  }

  const isPending = createGroup.isPending || updateGroup.isPending || setMembers.isPending

  const filteredCrew = allCrew.filter((c) => {
    const q = memberSearch.toLowerCase()
    return !q || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
  })

  // Group selected members by role for display
  const selectedCrew = allCrew.filter((c) => selectedIds.has(c.id))
  const roleOrder = ['CAPTAIN', 'FIRST_OFFICER', 'FLIGHT_ATTENDANT', 'DISPATCHER', 'MECHANIC', 'OTHER']

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Crew Group' : 'New Crew Group'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={isPending}>
            {isEditing ? 'Save Changes' : 'Create Group'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Group Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. G650 Standard Crew"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })) }}
            className={clsx(
              'w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
              errors.name ? 'border-red-400' : 'border-gray-300',
            )}
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            type="text"
            placeholder="e.g. Standard 2-pilot crew for transcon routes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Aircraft + Pax range */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Aircraft</label>
            <select
              value={aircraftId}
              onChange={(e) => setAircraftId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Any</option>
              {allAircraft.map((a) => (
                <option key={a.id} value={a.id}>{a.registration} — {a.make} {a.model}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Pax</label>
            <input
              type="number" min="1" placeholder="—"
              value={minPax}
              onChange={(e) => setMinPax(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Pax</label>
            <input
              type="number" min="1" placeholder="—"
              value={maxPax}
              onChange={(e) => setMaxPax(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Member selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Crew Members
              {selectedIds.size > 0 && (
                <span className="ml-2 text-xs text-primary-600 font-normal">{selectedIds.size} selected</span>
              )}
            </label>
          </div>

          {/* Selected summary chips */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {roleOrder.flatMap((role) =>
                selectedCrew
                  .filter((c) => c.role === role)
                  .map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-primary-50 border border-primary-200 text-primary-800 text-xs px-2.5 py-1 font-medium">
                      {c.firstName} {c.lastName}
                      <span className="text-primary-400">·</span>
                      <span className="text-primary-500 font-normal">{ROLE_LABELS[c.role] ?? c.role}</span>
                      <button type="button" onClick={() => toggle(c.id)} className="ml-0.5 text-primary-400 hover:text-primary-700">
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))
              )}
            </div>
          )}

          {/* Search + list */}
          <input
            type="text"
            placeholder="Search crew…"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
          />
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-52 overflow-y-auto">
            {filteredCrew.length === 0 && (
              <p className="px-3 py-3 text-sm text-gray-400">No active crew members found.</p>
            )}
            {filteredCrew.map((c) => (
              <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900">{c.firstName} {c.lastName}</span>
                  <span className="ml-2 text-xs text-gray-400">{ROLE_LABELS[c.role] ?? c.role}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
