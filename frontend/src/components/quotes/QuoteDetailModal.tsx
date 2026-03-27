import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Modal } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Badge, quoteStatusBadge } from '@/components/ui/Badge'
import { apiClient } from '@/api/client'
import { useGeneratePortalLink } from '@/api/portal.api'
import { PrinterIcon, LinkIcon, CheckIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'

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
  validUntil: string | null
  notes: string | null
  createdAt: string
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

export function QuoteDetailModal({ quoteId, onClose }: Props) {
  const { data: quote, isLoading } = useQuoteDetail(quoteId)
  const generateLink = useGeneratePortalLink()
  const sendQuote = useSendQuote(quoteId)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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

  const currency = quote?.currency ?? 'USD'
  const isRoundTrip = quote?.tripType === 'ROUND_TRIP'

  return (
    <Modal
      isOpen={!!quoteId}
      onClose={onClose}
      title="Quote Detail"
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button
            variant="secondary"
            onClick={() => window.print()}
          >
            <PrinterIcon className="h-4 w-4 mr-1.5" />
            Print
          </Button>
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
            <Badge variant={quoteStatusBadge(quote.status as never)} size="sm">
              {quote.status.charAt(0) + quote.status.slice(1).toLowerCase()}
            </Badge>
          </div>

          {/* Client + Route */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Client</p>
              <p className="font-semibold text-gray-900">{quote.contact.firstName} {quote.contact.lastName}</p>
              {quote.contact.email && <p className="text-sm text-gray-500">{quote.contact.email}</p>}
              {quote.contact.phone && <p className="text-sm text-gray-500">{quote.contact.phone}</p>}
            </div>

            {(quote.originIcao || quote.destinationIcao) && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Route</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-900 text-lg">{quote.originIcao}</span>
                  <span className="text-gray-400">{isRoundTrip ? '⇄' : '→'}</span>
                  <span className="font-mono font-bold text-gray-900 text-lg">{quote.destinationIcao}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {isRoundTrip ? 'Round Trip' : 'One Way'}
                  {quote.departureDate && ` · Depart ${fmtDate(quote.departureDate)}`}
                  {isRoundTrip && quote.returnDate && ` · Return ${fmtDate(quote.returnDate)}`}
                </p>
              </div>
            )}
          </div>

          {/* Validity */}
          {quote.validUntil && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
              Valid until <span className="font-medium">{fmtDate(quote.validUntil)}</span>
            </div>
          )}

          {/* Send to client */}
          {quote.status === 'DRAFT' && (
            <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-blue-900">Ready to send?</p>
                <p className="text-xs text-blue-700">This will mark the quote as Sent so the client can accept or decline.</p>
              </div>
              <Button size="sm" onClick={() => sendQuote.mutate()} loading={sendQuote.isPending}>
                <PaperAirplaneIcon className="h-4 w-4 mr-1.5" />
                Send to Client
              </Button>
            </div>
          )}

          {/* Line Items */}
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
                {/* Base charter fee */}
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
                      {item.category && (
                        <span className="ml-2 text-xs text-gray-400">{item.category}</span>
                      )}
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

          {/* Notes */}
          {quote.notes && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          {/* Portal link — hidden from print */}
          <div className="print:hidden border-t border-gray-200 pt-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Client Portal Link
            </p>
            {!portalUrl ? (
              <Button
                variant="secondary"
                onClick={handleGenerateLink}
                loading={generateLink.isPending}
              >
                <LinkIcon className="h-4 w-4 mr-1.5" />
                Generate Portal Link
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={portalUrl}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-700 bg-gray-50 focus:outline-none"
                />
                <button
                  onClick={handleCopy}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    copied
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
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
        </div>
      )}
    </Modal>
  )
}
