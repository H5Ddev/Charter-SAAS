import { useState, useCallback, useEffect } from 'react'
import { clsx } from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useContacts } from '@/api/contacts.api'
import { useCreateQuote, type QuoteLineItemInput } from '@/api/quotes.api'
import { normalizeAircraft } from '@/api/aircraft.api'
import { apiClient, getErrorMessage } from '@/api/client'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { AirportSearch } from '@/components/ui/AirportSearch'
import { type Airport, distanceNm, estimatedHours as calcEstimatedHours, formatHours } from '@/api/airports.api'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD']

const LINE_ITEM_CATEGORIES = [
  'Charter Fee',
  'Landing Fee',
  'FBO Handling',
  'Fuel Surcharge',
  'Catering',
  'Ground Transport',
  'International Fee',
  'Other',
]

function emptyLineItem(): QuoteLineItemInput {
  return { description: '', quantity: 1, unitPrice: 0, category: '' }
}

export function NewQuoteModal({ isOpen, onClose, onCreated }: Props) {
  const [contactSearch, setContactSearch] = useState('')
  const [contactId, setContactId] = useState('')
  const [contactName, setContactName] = useState('')
  const [showContactDropdown, setShowContactDropdown] = useState(false)

  const [originIcao, setOriginIcao] = useState('')
  const [originAirport, setOriginAirport] = useState<Airport | null>(null)
  const [destinationIcao, setDestinationIcao] = useState('')
  const [destinationAirport, setDestinationAirport] = useState<Airport | null>(null)

  const [tripType, setTripType] = useState<'ONE_WAY' | 'ROUND_TRIP'>('ONE_WAY')
  const [departureDate, setDepartureDate] = useState('')
  const [returnDate, setReturnDate] = useState('')

  const [basePrice, setBasePrice] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<QuoteLineItemInput[]>([])

  // Aircraft selection for rate-based pricing
  const [aircraftSearch, setAircraftSearch] = useState('')
  const [aircraftId, setAircraftId] = useState('')
  const [selectedHourlyRate, setSelectedHourlyRate] = useState<number | null>(null)
  const [showAircraftDropdown, setShowAircraftDropdown] = useState(false)
  const [estimatedHours, setEstimatedHours] = useState('')
  const [passengers, setPassengers] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Auto-fill estimated hours when both airports are selected
  useEffect(() => {
    if (
      originAirport?.latitudeDeg != null && originAirport?.longitudeDeg != null &&
      destinationAirport?.latitudeDeg != null && destinationAirport?.longitudeDeg != null
    ) {
      const nm = distanceNm(originAirport.latitudeDeg, originAirport.longitudeDeg, destinationAirport.latitudeDeg, destinationAirport.longitudeDeg)
      const hrs = calcEstimatedHours(nm)
      const hoursStr = hrs.toFixed(1)
      setEstimatedHours(hoursStr)
      setSelectedHourlyRate((rate) => {
        if (rate) setBasePrice((rate * hrs).toFixed(2))
        return rate
      })
    }
  }, [originAirport, destinationAirport])

  const { data: contactsData } = useContacts({
    search: contactSearch || undefined,
    pageSize: 10,
  })
  const contacts = contactsData?.data ?? []

  const { data: aircraftListData } = useQuery({
    queryKey: ['aircraft-picker', aircraftSearch],
    queryFn: async () => {
      const response = await apiClient.get<{ data: unknown[] }>('/aircraft', {
        params: { isActive: true, pageSize: 10, search: aircraftSearch || undefined },
      })
      const raw = response.data as { data: unknown[] }
      return (raw.data as Parameters<typeof normalizeAircraft>[0][]).map(normalizeAircraft)
    },
    enabled: showAircraftDropdown,
  })
  const aircraftList = aircraftListData ?? []

  const createQuote = useCreateQuote()

  const routeStats = (originAirport?.latitudeDeg != null && originAirport?.longitudeDeg != null &&
    destinationAirport?.latitudeDeg != null && destinationAirport?.longitudeDeg != null)
    ? (() => {
        const nm = distanceNm(originAirport.latitudeDeg!, originAirport.longitudeDeg!, destinationAirport.latitudeDeg!, destinationAirport.longitudeDeg!)
        return { nm: Math.round(nm), hours: formatHours(calcEstimatedHours(nm)) }
      })()
    : null

  const lineItemsTotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  )
  const grandTotal = (parseFloat(basePrice) || 0) + lineItemsTotal

  function selectAircraft(id: string, label: string, rate: number | null, flat: number | null) {
    setAircraftId(id)
    setAircraftSearch(label)
    setSelectedHourlyRate(rate)
    setShowAircraftDropdown(false)
    // Flat base price takes priority; otherwise compute from hourly rate × estimated hours
    if (flat) {
      setBasePrice(flat.toFixed(2))
    } else if (rate && estimatedHours) {
      setBasePrice((rate * parseFloat(estimatedHours)).toFixed(2))
    }
  }

  function handleHoursChange(val: string) {
    setEstimatedHours(val)
    if (selectedHourlyRate && val) {
      setBasePrice((selectedHourlyRate * parseFloat(val)).toFixed(2))
    }
  }

  function selectContact(id: string, name: string) {
    setContactId(id)
    setContactName(name)
    setContactSearch(name)
    setShowContactDropdown(false)
    setErrors((e) => ({ ...e, contactId: '' }))
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, emptyLineItem()])
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateLineItem(index: number, field: keyof QuoteLineItemInput, value: string | number) {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!contactId) errs.contactId = 'Client is required'
    if (!basePrice || isNaN(parseFloat(basePrice)) || parseFloat(basePrice) < 0)
      errs.basePrice = 'Valid base price is required'
    lineItems.forEach((item, i) => {
      if (!item.description.trim()) errs[`li_desc_${i}`] = 'Description required'
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    const result = await createQuote.mutateAsync({
      contactId,
      originIcao: originIcao.trim().toUpperCase() || undefined,
      destinationIcao: destinationIcao.trim().toUpperCase() || undefined,
      tripType,
      departureDate: departureDate ? new Date(departureDate).toISOString() : undefined,
      returnDate: tripType === 'ROUND_TRIP' && returnDate
        ? new Date(returnDate).toISOString()
        : undefined,
      basePrice: parseFloat(basePrice),
      currency,
      validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
      passengers: passengers ? parseInt(passengers) : undefined,
      notes: notes.trim() || undefined,
      lineItems: lineItems.filter((item) => item.description.trim()),
    })

    onCreated?.(result.id)
    handleClose()
  }

  const handleClose = useCallback(() => {
    setContactSearch('')
    setContactId('')
    setContactName('')
    setShowContactDropdown(false)
    setOriginIcao('')
    setOriginAirport(null)
    setDestinationIcao('')
    setDestinationAirport(null)
    setTripType('ONE_WAY')
    setDepartureDate('')
    setReturnDate('')
    setBasePrice('')
    setCurrency('USD')
    setValidUntil('')
    setNotes('')
    setLineItems([])
    setAircraftSearch('')
    setAircraftId('')
    setSelectedHourlyRate(null)
    setShowAircraftDropdown(false)
    setEstimatedHours('')
    setPassengers('')
    setErrors({})
    onClose()
  }, [onClose])

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Quote"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={createQuote.isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={createQuote.isPending}>
            Create Quote
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Client */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Search contacts…"
            value={contactSearch}
            onChange={(e) => {
              setContactSearch(e.target.value)
              setContactId('')
              setContactName('')
              setShowContactDropdown(true)
            }}
            onFocus={() => setShowContactDropdown(true)}
            onBlur={() => setTimeout(() => setShowContactDropdown(false), 150)}
            className={clsx(
              'w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
              errors.contactId ? 'border-red-400' : 'border-gray-300',
            )}
          />
          {errors.contactId && (
            <p className="mt-1 text-xs text-red-500">{errors.contactId}</p>
          )}
          {showContactDropdown && contacts.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full bg-white rounded-md border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
              {contacts.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={() => selectContact(c.id, `${c.firstName} ${c.lastName}`)}
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
          {showContactDropdown && contactSearch && contacts.length === 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white rounded-md border border-gray-200 shadow-lg px-3 py-2 text-sm text-gray-400">
              No contacts found
            </div>
          )}
        </div>

        {/* Route */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <AirportSearch
              label="Origin"
              value={originIcao}
              placeholder="KTEB"
              onChange={(icao, airport) => { setOriginIcao(icao); setOriginAirport(airport) }}
            />
            <AirportSearch
              label="Destination"
              value={destinationIcao}
              placeholder="KFLL"
              onChange={(icao, airport) => { setDestinationIcao(icao); setDestinationAirport(airport) }}
            />
          </div>
          {routeStats && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-1.5">
              ✈ Est. <span className="font-medium text-gray-700">{routeStats.nm.toLocaleString()} nm</span>
              {' · '}
              <span className="font-medium text-gray-700">{routeStats.hours}</span> flight time
            </p>
          )}

          {/* Trip type toggle */}
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {(['ONE_WAY', 'ROUND_TRIP'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTripType(type)}
                className={clsx(
                  'flex-1 py-2 text-sm font-medium transition-colors',
                  tripType === type
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50',
                )}
              >
                {type === 'ONE_WAY' ? 'One Way' : 'Round Trip'}
              </button>
            ))}
          </div>

          <div className={clsx('grid gap-3', tripType === 'ROUND_TRIP' ? 'grid-cols-2' : 'grid-cols-1')}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date</label>
              <input
                type="date"
                value={departureDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            {tripType === 'ROUND_TRIP' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Date</label>
                <input
                  type="date"
                  value={returnDate}
                  min={departureDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Passengers */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Passengers</label>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 4"
            value={passengers}
            onChange={(e) => setPassengers(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Aircraft + estimated hours (optional, auto-fills base price) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aircraft
              <span className="ml-1.5 text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Search aircraft…"
              value={aircraftSearch}
              onChange={(e) => {
                setAircraftSearch(e.target.value)
                setAircraftId('')
                setSelectedHourlyRate(null)
                setShowAircraftDropdown(true)
              }}
              onFocus={() => setShowAircraftDropdown(true)}
              onBlur={() => setTimeout(() => setShowAircraftDropdown(false), 150)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {showAircraftDropdown && aircraftList.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white rounded-md border border-gray-200 shadow-lg max-h-40 overflow-y-auto">
                {aircraftList.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onMouseDown={() => selectAircraft(
                        a.id,
                        `${a.registration} — ${a.make} ${a.model}`,
                        a.hourlyRate,
                        a.basePrice,
                      )}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors"
                    >
                      <span className="font-mono font-semibold text-gray-900">{a.registration}</span>
                      <span className="ml-2 text-gray-500">{a.make} {a.model}</span>
                      {a.hourlyRate != null && (
                        <span className="ml-auto float-right text-xs text-primary-600 font-medium">
                          ${a.hourlyRate.toLocaleString()}/hr
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedHourlyRate != null && (
              <p className="mt-1 text-xs text-primary-600 font-medium">
                Rate: ${selectedHourlyRate.toLocaleString()}/hr
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Est. Flight Hours
              <span className="ml-1.5 text-xs text-gray-400 font-normal">(auto-fills price)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="e.g. 3.5"
              value={estimatedHours}
              onChange={(e) => handleHoursChange(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Base price + currency + valid until */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base Price <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={basePrice}
              onChange={(e) => {
                setBasePrice(e.target.value)
                setErrors((err) => ({ ...err, basePrice: '' }))
              }}
              className={clsx(
                'w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
                errors.basePrice ? 'border-red-400' : 'border-gray-300',
              )}
            />
            {errors.basePrice && (
              <p className="mt-1 text-xs text-red-500">{errors.basePrice}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
            <input
              type="date"
              value={validUntil}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Line Items</label>
            <button
              type="button"
              onClick={addLineItem}
              className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add item
            </button>
          </div>

          {lineItems.length > 0 && (
            <div className="space-y-2">
              {lineItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  {/* Description */}
                  <div className="col-span-5">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                      className={clsx(
                        'w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
                        errors[`li_desc_${i}`] ? 'border-red-400' : 'border-gray-300',
                      )}
                    />
                  </div>
                  {/* Category */}
                  <div className="col-span-3">
                    <select
                      value={item.category ?? ''}
                      onChange={(e) => updateLineItem(i, 'category', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Category</option>
                      {LINE_ITEM_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  {/* Qty */}
                  <div className="col-span-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                    />
                  </div>
                  {/* Unit price */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Unit $"
                      value={item.unitPrice || ''}
                      onChange={(e) => updateLineItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                    />
                  </div>
                  {/* Delete */}
                  <div className="col-span-1 flex justify-center pt-1.5">
                    <button
                      type="button"
                      onClick={() => removeLineItem(i)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {lineItems.length === 0 && (
            <p className="text-xs text-gray-400 italic">No line items — add fees, surcharges, or extras.</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            rows={3}
            placeholder="Internal notes or client-facing terms…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        {/* Total summary */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-500 space-y-0.5">
            <div className="flex gap-6">
              <span>Base: <span className="font-medium text-gray-700">{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(parseFloat(basePrice) || 0)}</span></span>
              {lineItems.length > 0 && (
                <span>Line items: <span className="font-medium text-gray-700">{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(lineItemsTotal)}</span></span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Total</p>
            <p className="text-xl font-bold text-gray-900 tabular-nums">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(grandTotal)}
            </p>
          </div>
        </div>

        {createQuote.isError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {getErrorMessage(createQuote.error)}
          </p>
        )}
      </div>
    </Modal>
  )
}
