import { useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { Modal } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useContacts } from '@/api/contacts.api'
import { useCreateAircraft } from '@/api/aircraft.api'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

const COMMON_MAKES = [
  'Beechcraft', 'Bombardier', 'Cessna', 'Cirrus', 'Dassault',
  'Embraer', 'Gulfstream', 'HondaJet', 'Learjet', 'Piper', 'Pilatus', 'Textron',
]

export function AddAircraftModal({ isOpen, onClose, onCreated }: Props) {
  const [tailNumber, setTailNumber] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [seats, setSeats] = useState('')
  const [rangeNm, setRangeNm] = useState('')
  const [homeBaseIcao, setHomeBaseIcao] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [costPerHour, setCostPerHour] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')

  const [ownerSearch, setOwnerSearch] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: contactsData } = useContacts({
    search: ownerSearch || undefined,
    pageSize: 10,
  })
  const contacts = contactsData?.data ?? []

  const createAircraft = useCreateAircraft()

  function selectOwner(id: string, name: string) {
    setOwnerId(id)
    setOwnerSearch(name)
    setShowOwnerDropdown(false)
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!tailNumber.trim()) errs.tailNumber = 'Tail number is required'
    if (!make.trim()) errs.make = 'Make is required'
    if (!model.trim()) errs.model = 'Model is required'
    if (!seats || isNaN(parseInt(seats)) || parseInt(seats) < 1)
      errs.seats = 'Valid seat count is required'
    if (homeBaseIcao && homeBaseIcao.trim().length !== 4)
      errs.homeBaseIcao = 'ICAO code must be 4 characters'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    const result = await createAircraft.mutateAsync({
      tailNumber: tailNumber.trim().toUpperCase(),
      make: make.trim(),
      model: model.trim(),
      year: year ? parseInt(year) : undefined,
      seats: parseInt(seats),
      rangeNm: rangeNm ? parseInt(rangeNm) : undefined,
      homeBaseIcao: homeBaseIcao.trim().toUpperCase() || undefined,
      ownerId: ownerId || undefined,
      isActive,
      costPerHour: costPerHour ? parseFloat(costPerHour) : undefined,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
    })

    onCreated?.(result.id)
    handleClose()
  }

  const handleClose = useCallback(() => {
    setTailNumber('')
    setMake('')
    setModel('')
    setYear('')
    setSeats('')
    setRangeNm('')
    setHomeBaseIcao('')
    setIsActive(true)
    setCostPerHour('')
    setHourlyRate('')
    setOwnerSearch('')
    setOwnerId('')
    setShowOwnerDropdown(false)
    setErrors({})
    onClose()
  }, [onClose])

  const currentYear = new Date().getFullYear()

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Aircraft"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={createAircraft.isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={createAircraft.isPending}>
            Add Aircraft
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Tail number + active toggle */}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tail Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="N12345"
              value={tailNumber}
              onChange={(e) => {
                setTailNumber(e.target.value.toUpperCase())
                setErrors((err) => ({ ...err, tailNumber: '' }))
              }}
              className={clsx(
                'w-full rounded-md border px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase',
                errors.tailNumber ? 'border-red-400' : 'border-gray-300',
              )}
            />
            {errors.tailNumber && <p className="mt-1 text-xs text-red-500">{errors.tailNumber}</p>}
          </div>
          <div className="pt-7">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive(!isActive)}
                className={clsx(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                  isActive ? 'bg-primary-600' : 'bg-gray-300',
                )}
              >
                <span className={clsx(
                  'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform',
                  isActive ? 'translate-x-4' : 'translate-x-0.5',
                )} />
              </button>
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>
        </div>

        {/* Make + Model */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Make <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              list="makes-list"
              placeholder="e.g. Gulfstream"
              value={make}
              onChange={(e) => {
                setMake(e.target.value)
                setErrors((err) => ({ ...err, make: '' }))
              }}
              className={clsx(
                'w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
                errors.make ? 'border-red-400' : 'border-gray-300',
              )}
            />
            <datalist id="makes-list">
              {COMMON_MAKES.map((m) => <option key={m} value={m} />)}
            </datalist>
            {errors.make && <p className="mt-1 text-xs text-red-500">{errors.make}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. G650ER"
              value={model}
              onChange={(e) => {
                setModel(e.target.value)
                setErrors((err) => ({ ...err, model: '' }))
              }}
              className={clsx(
                'w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
                errors.model ? 'border-red-400' : 'border-gray-300',
              )}
            />
            {errors.model && <p className="mt-1 text-xs text-red-500">{errors.model}</p>}
          </div>
        </div>

        {/* Year + Seats + Range */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input
              type="number"
              min="1900"
              max={currentYear + 1}
              placeholder={String(currentYear)}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seats <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="500"
              placeholder="8"
              value={seats}
              onChange={(e) => {
                setSeats(e.target.value)
                setErrors((err) => ({ ...err, seats: '' }))
              }}
              className={clsx(
                'w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
                errors.seats ? 'border-red-400' : 'border-gray-300',
              )}
            />
            {errors.seats && <p className="mt-1 text-xs text-red-500">{errors.seats}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Range (nm)</label>
            <input
              type="number"
              min="0"
              placeholder="7000"
              value={rangeNm}
              onChange={(e) => setRangeNm(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Cost per hour + Hourly rate */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cost / Hour
              <span className="ml-1.5 text-xs text-gray-400 font-normal">(internal)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={costPerHour}
                onChange={(e) => setCostPerHour(e.target.value)}
                className="w-full rounded-md border border-gray-300 pl-6 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hourly Rate
              <span className="ml-1.5 text-xs text-gray-400 font-normal">(charged to client)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="w-full rounded-md border border-gray-300 pl-6 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Home base + Owner */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Home Base (ICAO)</label>
            <input
              type="text"
              maxLength={4}
              placeholder="KTEB"
              value={homeBaseIcao}
              onChange={(e) => {
                setHomeBaseIcao(e.target.value.toUpperCase())
                setErrors((err) => ({ ...err, homeBaseIcao: '' }))
              }}
              className={clsx(
                'w-full rounded-md border px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase',
                errors.homeBaseIcao ? 'border-red-400' : 'border-gray-300',
              )}
            />
            {errors.homeBaseIcao && <p className="mt-1 text-xs text-red-500">{errors.homeBaseIcao}</p>}
          </div>

          {/* Owner contact search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
            <input
              type="text"
              placeholder="Search contacts…"
              value={ownerSearch}
              onChange={(e) => {
                setOwnerSearch(e.target.value)
                setOwnerId('')
                setShowOwnerDropdown(true)
              }}
              onFocus={() => setShowOwnerDropdown(true)}
              onBlur={() => setTimeout(() => setShowOwnerDropdown(false), 150)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {showOwnerDropdown && contacts.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white rounded-md border border-gray-200 shadow-lg max-h-40 overflow-y-auto">
                {contacts.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseDown={() => selectOwner(c.id, `${c.firstName} ${c.lastName}`)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors"
                    >
                      <span className="font-medium text-gray-900">
                        {c.firstName} {c.lastName}
                      </span>
                      {c.email && (
                        <span className="ml-2 text-gray-400 text-xs">{c.email}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showOwnerDropdown && ownerSearch && contacts.length === 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-md border border-gray-200 shadow-lg px-3 py-2 text-sm text-gray-400">
                No contacts found
              </div>
            )}
          </div>
        </div>

        {createAircraft.isError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            Failed to add aircraft. Please try again.
          </p>
        )}
      </div>
    </Modal>
  )
}
