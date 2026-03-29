import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { Modal } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { PlusIcon, TrashIcon } from '@heroicons/react/20/solid'
import {
  useCreateAircraftClass, useUpdateAircraftClass,
  type AircraftClass, type CreateAircraftClassInput,
} from '@/api/aircraft-classes.api'

const ROLES = [
  { value: 'CAPTAIN', label: 'Captain' },
  { value: 'FIRST_OFFICER', label: 'First Officer' },
  { value: 'FLIGHT_ATTENDANT', label: 'Flight Attendant' },
  { value: 'DISPATCHER', label: 'Dispatcher' },
  { value: 'MECHANIC', label: 'Mechanic' },
  { value: 'OTHER', label: 'Other' },
]

const REG_CATS = ['Part 91', 'Part 135', 'Part 121', 'EASA', 'AOC', 'Other']

interface CrewReqRow {
  role: string
  minCount: number
  perPax: string // string for input, parsed on save
}

function emptyReq(): CrewReqRow {
  return { role: 'CAPTAIN', minCount: 1, perPax: '' }
}

interface Props {
  isOpen: boolean
  aircraftClass?: AircraftClass | null
  onClose: () => void
}

export function AircraftClassModal({ isOpen, aircraftClass, onClose }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [regulatoryCategory, setRegulatoryCategory] = useState('')
  const [minSeats, setMinSeats] = useState('')
  const [maxSeats, setMaxSeats] = useState('')
  const [minRangeNm, setMinRangeNm] = useState('')
  const [maxRangeNm, setMaxRangeNm] = useState('')
  const [crewReqs, setCrewReqs] = useState<CrewReqRow[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const createClass = useCreateAircraftClass()
  const updateClass = useUpdateAircraftClass()
  const isEditing = !!aircraftClass
  const isPending = createClass.isPending || updateClass.isPending

  useEffect(() => {
    if (isOpen && aircraftClass) {
      setName(aircraftClass.name)
      setDescription(aircraftClass.description ?? '')
      setRegulatoryCategory(aircraftClass.regulatoryCategory ?? '')
      setMinSeats(aircraftClass.minSeats?.toString() ?? '')
      setMaxSeats(aircraftClass.maxSeats?.toString() ?? '')
      setMinRangeNm(aircraftClass.minRangeNm?.toString() ?? '')
      setMaxRangeNm(aircraftClass.maxRangeNm?.toString() ?? '')
      setCrewReqs(aircraftClass.crewReqs.map((r) => ({
        role: r.role,
        minCount: r.minCount,
        perPax: r.perPax?.toString() ?? '',
      })))
    } else if (isOpen && !aircraftClass) {
      setName('')
      setDescription('')
      setRegulatoryCategory('')
      setMinSeats('')
      setMaxSeats('')
      setMinRangeNm('')
      setMaxRangeNm('')
      setCrewReqs([])
    }
    setErrors({})
  }, [isOpen, aircraftClass])

  function validate() {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function updateReq(index: number, field: keyof CrewReqRow, value: string | number) {
    setCrewReqs((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  function removeReq(index: number) {
    setCrewReqs((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!validate()) return
    const payload: CreateAircraftClassInput = {
      name: name.trim(),
      description: description.trim() || null,
      regulatoryCategory: regulatoryCategory || null,
      minSeats: minSeats ? parseInt(minSeats) : null,
      maxSeats: maxSeats ? parseInt(maxSeats) : null,
      minRangeNm: minRangeNm ? parseInt(minRangeNm) : null,
      maxRangeNm: maxRangeNm ? parseInt(maxRangeNm) : null,
      crewReqs: crewReqs.map((r) => ({
        role: r.role,
        minCount: r.minCount,
        perPax: r.perPax ? parseInt(r.perPax) : null,
      })),
    }
    if (isEditing) {
      await updateClass.mutateAsync({ id: aircraftClass!.id, data: payload })
    } else {
      await createClass.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Aircraft Class' : 'New Aircraft Class'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={isPending}>
            {isEditing ? 'Save Changes' : 'Create Class'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Class Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Heavy Jet, Light Jet, Turboprop"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })) }}
            className={clsx(
              'w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
              errors.name ? 'border-red-400' : 'border-gray-300',
            )}
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
        </div>

        {/* Description + Regulatory */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. Ultra-long range, 13+ passengers"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Regulatory Category</label>
            <select
              value={regulatoryCategory}
              onChange={(e) => setRegulatoryCategory(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">None</option>
              {REG_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Seat & Range bands */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Aircraft Bands <span className="text-xs text-gray-400 font-normal">(optional — for reference)</span></p>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Min Seats</label>
              <input type="number" min="1" placeholder="—" value={minSeats} onChange={(e) => setMinSeats(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max Seats</label>
              <input type="number" min="1" placeholder="—" value={maxSeats} onChange={(e) => setMaxSeats(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Min Range (nm)</label>
              <input type="number" min="0" placeholder="—" value={minRangeNm} onChange={(e) => setMinRangeNm(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max Range (nm)</label>
              <input type="number" min="0" placeholder="—" value={maxRangeNm} onChange={(e) => setMaxRangeNm(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
        </div>

        {/* Crew Requirements */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Crew Requirements</p>
            <button
              type="button"
              onClick={() => setCrewReqs((p) => [...p, emptyReq()])}
              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              <PlusIcon className="h-4 w-4" /> Add role
            </button>
          </div>

          {crewReqs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
              No crew requirements — click "Add role" to define minimums.
            </p>
          )}

          {crewReqs.length > 0 && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 rounded-t-lg">
                <span className="col-span-5 text-xs font-medium text-gray-500">Role</span>
                <span className="col-span-3 text-xs font-medium text-gray-500">Min Count</span>
                <span className="col-span-3 text-xs font-medium text-gray-500">Per Pax <span className="font-normal text-gray-400">(1 per N)</span></span>
                <span className="col-span-1" />
              </div>
              {crewReqs.map((req, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                  <div className="col-span-5">
                    <select
                      value={req.role}
                      onChange={(e) => updateReq(i, 'role', e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number" min="1"
                      value={req.minCount}
                      onChange={(e) => updateReq(i, 'minCount', parseInt(e.target.value) || 1)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number" min="1" placeholder="—"
                      value={req.perPax}
                      onChange={(e) => updateReq(i, 'perPax', e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button type="button" onClick={() => removeReq(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-xs text-gray-400">
            "Per Pax" adds 1 additional crew member for every N passengers (e.g. 1 FA per 15 pax).
          </p>
        </div>

      </div>
    </Modal>
  )
}
