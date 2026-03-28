import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Modal } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Badge, quoteStatusBadge } from '@/components/ui/Badge'
import { apiClient } from '@/api/client'
import { useGeneratePortalLink } from '@/api/portal.api'
import { AirportSearch } from '@/components/ui/AirportSearch'
import { type Airport, distanceNm, estimatedHours as calcEstimatedHours, formatHours } from '@/api/airports.api'
import {
  PrinterIcon, LinkIcon, CheckIcon, PaperAirplaneIcon,
  PencilIcon, PlusIcon, TrashIcon, LockClosedIcon,
} from '@heroicons/react/24/outline'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
const LINE_ITEM_CATEGORIES = [
  'Charter Fee', 'Landing Fee', 'FBO Handling', 'Fuel Surcharge',
  'Catering', 'Ground Transport', 'International Fee', 'Other',
]

interface AirportInfo {
  icaoCode: string
  name: string
  municipality: string | null
  isoCountry: string
}

interface LineItemDraft {
  description: string
  quantity: number
  unitPrice: number
  category: string
}

interface QuoteDetail {
  id: string
  reference: string | null
  status: string
  originIcao: string | null
  destinationIcao: string | null
  tripType: string | null
  departureDate: string | null
  returnDate: string | null
  basePrice: number
  totalPrice: number
  currency: string
  passengers: number | null
  validUntil: string | null
  notes: string | null
  createdAt: string
  originAirport: AirportInfo | null
  destinationAirport: AirportInfo | null
  contact: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
  }
  lineItems: Array<{
    id: string
    description: string
    quantity: number
    unitPrice: number
    total: number
    category: string | null
  }>
}

interface Props {
  quoteId: string | null
  onClose: () => void
}

function fmt(amount: number | string, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount))
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function toDateInput(d: string | null): string {
  if (!d) return ''
  return new Date(d).toISOString().split('T')[0]
}

function emptyLineItem(): LineItemDraft {
  return { description: '', quantity: 1, unitPrice: 0, category: '' }
}

function useQuoteDetail(id: string | null) {
  return useQuery({
    queryKey: ['quote-detail', id],
    queryFn: async () => {
      const res = await apiClient.get<QuoteDetail>(`/quotes/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

function useSendQuote(quoteId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch<QuoteDetail>(`/quotes/${quoteId}`, { status: 'SENT' })
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] })
      void queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

function useUpdateQuote(quoteId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiClient.patch<QuoteDetail>(`/quotes/${quoteId}`, data)
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] })
      void queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function QuoteDetailModal({ quoteId, onClose }: Props) {
  const { data: quote, isLoading } = useQuoteDetail(quoteId)
  const generateLink = useGeneratePortalLink()
  const sendQuote = useSendQuote(quoteId)
  const updateQuote = useUpdateQuote(quoteId)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Edit mode state
  const [editing, setEditing] = useState(false)
  const [editOriginIcao, setEditOriginIcao] = useState('')
  const [editOriginAirport, setEditOriginAirport] = useState<Airport | null>(null)
  const [editDestIcao, setEditDestIcao] = useState('')
  const [editDestAirport, setEditDestAirport] = useState<Airport | null>(null)
  const [editTripType, setEditTripType] = useState<'ONE_WAY' | 'ROUND_TRIP'>('ONE_WAY')
  const [editDeparture, setEditDeparture] = useState('')
  const [editReturn, setEditReturn] = useState('')
  const [editPassengers, setEditPassengers] = useState('')
  const [editBasePrice, setEditBasePrice] = useState('')
  const [editCurrency, setEditCurrency] = useState('USD')
  const [editValidUntil, setEditValidUntil] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editLineItems, setEditLineItems] = useState<LineItemDraft[]>([])

  // Reset edit state whenever we open edit mode
  useEffect(() => {
    if (editing && quote) {
      setEditOriginIcao(quote.originIcao ?? '')
      setEditOriginAirport(null)
      setEditDestIcao(quote.destinationIcao ?? '')
      setEditDestAirport(null)
      setEditTripType((quote.tripType as 'ONE_WAY' | 'ROUND_TRIP') ?? 'ONE_WAY')
      setEditDeparture(toDateInput(quote.departureDate))
      setEditReturn(toDateInput(quote.returnDate))
      setEditPassengers(quote.passengers?.toString() ?? '')
      setEditBasePrice(Number(quote.basePrice).toFixed(2))
      setEditCurrency(quote.currency)
      setEditValidUntil(toDateInput(quote.validUntil))
      setEditNotes(quote.notes ?? '')
      setEditLineItems(
        quote.lineItems.map((li) => ({
          description: li.description,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          category: li.category ?? '',
        }))
      )
    }
  }, [editing, quote])

  // Route stats in edit mode (only when airports selected from dropdown)
  const editRouteStats = (
    editOriginAirport?.latitudeDeg != null && editOriginAirport?.longitudeDeg != null &&
    editDestAirport?.latitudeDeg != null && editDestAirport?.longitudeDeg != null
  ) ? (() => {
    const nm = distanceNm(editOriginAirport.latitudeDeg!, editOriginAirport.longitudeDeg!, editDestAirport.latitudeDeg!, editDestAirport.longitudeDeg!)
    return { nm: Math.round(nm), hours: formatHours(calcEstimatedHours(nm)) }
  })() : null

  async function handleSave() {
    await updateQuote.mutateAsync({
      originIcao: editOriginIcao.toUpperCase() || undefined,
      destinationIcao: editDestIcao.toUpperCase() || undefined,
      tripType: editTripType,
      departureDate: editDeparture ? new Date(editDeparture).toISOString() : null,
      returnDate: editTripType === 'ROUND_TRIP' && editReturn ? new Date(editReturn).toISOString() : null,
      passengers: editPassengers ? parseInt(editPassengers) : null,
      basePrice: parseFloat(editBasePrice) || 0,
      currency: editCurrency,
      validUntil: editValidUntil ? new Date(editValidUntil).toISOString() : null,
      notes: editNotes.trim() || null,
      lineItems: editLineItems.filter((li) => li.description.trim()),
    })
    setEditing(false)
  }

  async function handleGenerateLink() {
    if (!quote) return
    const result = await generateLink.mutateAsync(quote.contact.id)
    setPortalUrl(result.url)
  }

  async function handleCopy() {
    if (!portalUrl) return
    await navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function updateLineItem(i: number, field: keyof LineItemDraft, value: string | number) {
    setEditLineItems((prev) => prev.map((li, idx) => idx === i ? { ...li, [field]: value } : li))
  }

  const currency = editing ? editCurrency : (quote?.currency ?? 'USD')
  const isRoundTrip = editing ? editTripType === 'ROUND_TRIP' : quote?.tripType === 'ROUND_TRIP'
  const isDraft = quote?.status === 'DRAFT'
  const isLocked = !!quote && !isDraft

  const editLineTotal = editLineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0)
  const editGrandTotal = (parseFloat(editBasePrice) || 0) + editLineTotal

  return (
    <Modal
      isOpen={!!quoteId}
      onClose={() => { setEditing(false); onClose() }}
      title="Quote Detail"
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          {editing ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(false)} disabled={updateQuote.isPending}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} loading={updateQuote.isPending}>
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => { setEditing(false); onClose() }}>Close</Button>
              <Button variant="secondary" onClick={() => window.print()}>
                <PrinterIcon className="h-4 w-4 mr-1.5" />
                Print
              </Button>
            </>
          )}
        </div>
      }
    >
      {isLoading && (
        <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
      )}

      {quote && (
        <div className="space-y-6 print:text-black" id="quote-print-area">

          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-gray-200">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Quote</p>
              <p className="text-2xl font-bold font-mono text-gray-900">
                {quote.reference ?? quote.id.slice(0, 8).toUpperCase()}
              </p>
              <p className="text-sm text-gray-500 mt-1">Issued {fmtDate(quote.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              {isLocked && (
                <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                  <LockClosedIcon className="h-3.5 w-3.5" />
                  Locked
                </span>
              )}
              <Badge variant={quoteStatusBadge(quote.status as never)} size="sm">
                {quote.status.charAt(0) + quote.status.slice(1).toLowerCase()}
              </Badge>
              {isDraft && !editing && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          {/* Locked notice */}
          {isLocked && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm text-gray-500">
              <LockClosedIcon className="h-4 w-4 shrink-0 text-gray-400" />
              This quote has been sent and can no longer be edited.
            </div>
          )}

          {/* Client + Route */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Client</p>
              <p className="font-semibold text-gray-900">{quote.contact.firstName} {quote.contact.lastName}</p>
              {quote.contact.email && <p className="text-sm text-gray-500">{quote.contact.email}</p>}
              {quote.contact.phone && <p className="text-sm text-gray-500">{quote.contact.phone}</p>}
              {!editing && quote.passengers && (
                <p className="text-sm text-gray-500 mt-1">
                  {quote.passengers} passenger{quote.passengers !== 1 ? 's' : ''}
                </p>
              )}
              {editing && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Passengers</label>
                  <input
                    type="number" min="1" step="1" placeholder="e.g. 4"
                    value={editPassengers}
                    onChange={(e) => setEditPassengers(e.target.value)}
                    className="w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Route</p>

              {editing ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <AirportSearch
                      label="Origin"
                      value={editOriginIcao}
                      placeholder="KTEB"
                      onChange={(icao, airport) => { setEditOriginIcao(icao); setEditOriginAirport(airport) }}
                    />
                    <AirportSearch
                      label="Destination"
                      value={editDestIcao}
                      placeholder="KFLL"
                      onChange={(icao, airport) => { setEditDestIcao(icao); setEditDestAirport(airport) }}
                    />
                  </div>
                  {editRouteStats && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                      ✈ <span className="font-medium">{editRouteStats.nm.toLocaleString()} nm</span>
                      {' · '}
                      <span className="font-medium">{editRouteStats.hours}</span> est. flight time
                    </p>
                  )}
                  <div className="flex rounded-md border border-gray-300 overflow-hidden">
                    {(['ONE_WAY', 'ROUND_TRIP'] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setEditTripType(t)}
                        className={clsx('flex-1 py-1.5 text-xs font-medium transition-colors',
                          editTripType === t ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {t === 'ONE_WAY' ? 'One Way' : 'Round Trip'}
                      </button>
                    ))}
                  </div>
                  <div className={clsx('grid gap-2', isRoundTrip ? 'grid-cols-2' : 'grid-cols-1')}>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Departure</label>
                      <input type="date" value={editDeparture} onChange={(e) => setEditDeparture(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    {isRoundTrip && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Return</label>
                        <input type="date" value={editReturn} onChange={(e) => setEditReturn(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {(quote.originIcao || quote.destinationIcao) ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="text-center">
                          <span className="font-mono font-bold text-gray-900 text-lg">{quote.originIcao}</span>
                          {quote.originAirport?.municipality && (
                            <p className="text-xs text-gray-400 leading-tight">{quote.originAirport.municipality}</p>
                          )}
                        </div>
                        <span className="text-gray-400 text-lg">{isRoundTrip ? '⇄' : '→'}</span>
                        <div className="text-center">
                          <span className="font-mono font-bold text-gray-900 text-lg">{quote.destinationIcao}</span>
                          {quote.destinationAirport?.municipality && (
                            <p className="text-xs text-gray-400 leading-tight">{quote.destinationAirport.municipality}</p>
                          )}
                        </div>
                      </div>
                      {(quote.originAirport || quote.destinationAirport) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[quote.originAirport?.name, quote.destinationAirport?.name].filter(Boolean).join(' → ')}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        {isRoundTrip ? 'Round Trip' : 'One Way'}
                        {quote.departureDate && ` · Depart ${fmtDate(quote.departureDate)}`}
                        {isRoundTrip && quote.returnDate && ` · Return ${fmtDate(quote.returnDate)}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">No route specified</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Validity */}
          {editing ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Valid Until</label>
              <input type="date" value={editValidUntil} onChange={(e) => setEditValidUntil(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          ) : quote.validUntil ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
              Valid until <span className="font-medium">{fmtDate(quote.validUntil)}</span>
            </div>
          ) : null}

          {/* Send to client (view mode, DRAFT only) */}
          {!editing && isDraft && (
            <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-blue-900">Ready to send?</p>
                <p className="text-xs text-blue-700">This will lock the quote and send it to the client.</p>
              </div>
              <Button size="sm" onClick={() => sendQuote.mutate()} loading={sendQuote.isPending}>
                <PaperAirplaneIcon className="h-4 w-4 mr-1.5" />
                Send to Client
              </Button>
            </div>
          )}

          {/* Pricing */}
          {editing ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Pricing</p>
                <button type="button" onClick={() => setEditLineItems((p) => [...p, emptyLineItem()])}
                  className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Add line item
                </button>
              </div>

              {/* Base price + currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Base Price</label>
                  <input type="number" min="0" step="0.01" value={editBasePrice}
                    onChange={(e) => setEditBasePrice(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Currency</label>
                  <select value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Line items */}
              {editLineItems.map((li, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <input type="text" placeholder="Description" value={li.description}
                      onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="col-span-3">
                    <select value={li.category} onChange={(e) => updateLineItem(i, 'category', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Category</option>
                      {LINE_ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <input type="number" min="0" step="1" value={li.quantity}
                      onChange={(e) => updateLineItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" value={li.unitPrice || ''}
                      onChange={(e) => updateLineItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center pt-1.5">
                    <button type="button" onClick={() => setEditLineItems((p) => p.filter((_, idx) => idx !== i))}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Edit total */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">Estimated Total</span>
                <span className="text-lg font-bold text-gray-900 tabular-nums">
                  {fmt(editGrandTotal, editCurrency)}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Pricing</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left pb-2 font-medium text-gray-600">Description</th>
                    <th className="text-right pb-2 font-medium text-gray-600">Qty</th>
                    <th className="text-right pb-2 font-medium text-gray-600">Unit Price</th>
                    <th className="text-right pb-2 font-medium text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-2.5 text-gray-900">Charter Fee</td>
                    <td className="py-2.5 text-right text-gray-600">1</td>
                    <td className="py-2.5 text-right text-gray-600">{fmt(quote.basePrice, currency)}</td>
                    <td className="py-2.5 text-right font-medium text-gray-900">{fmt(quote.basePrice, currency)}</td>
                  </tr>
                  {quote.lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 text-gray-900">
                        {item.description}
                        {item.category && <span className="ml-2 text-xs text-gray-400">{item.category}</span>}
                      </td>
                      <td className="py-2.5 text-right text-gray-600">{Number(item.quantity)}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(item.unitPrice, currency)}</td>
                      <td className="py-2.5 text-right font-medium text-gray-900">{fmt(item.total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300">
                    <td colSpan={3} className="pt-3 text-right font-semibold text-gray-900">Total</td>
                    <td className="pt-3 text-right font-bold text-xl text-gray-900 tabular-nums">
                      {fmt(quote.totalPrice, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Notes */}
          {editing ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Internal notes or client-facing terms…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
          ) : quote.notes ? (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          ) : null}

          {/* Portal link — hidden from print, hidden in edit mode */}
          {!editing && (
            <div className="print:hidden border-t border-gray-200 pt-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Client Portal Link
              </p>
              {!portalUrl ? (
                <Button variant="secondary" onClick={handleGenerateLink} loading={generateLink.isPending}>
                  <LinkIcon className="h-4 w-4 mr-1.5" />
                  Generate Portal Link
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <input readOnly value={portalUrl}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-700 bg-gray-50 focus:outline-none"
                  />
                  <button onClick={handleCopy}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                    )}
                  >
                    {copied ? <CheckIcon className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
              <p className="mt-1.5 text-xs text-gray-400">
                Share this link with the client. They can view, accept, or decline the quote without logging in.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
