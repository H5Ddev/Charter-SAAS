import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  usePortalIdentity,
  usePortalQuotes,
  usePortalTrips,
  useRespondToQuote,
  useSubmitPortalRequest,
  useSendPortalOtp,
  useVerifyPortalOtp,
  type PortalQuote,
  type PortalTrip,
  type PortalOtpHint,
} from '@/api/portal.api'
import { Badge, quoteStatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import {
  CheckCircleIcon,
  XCircleIcon,
  PaperAirplaneIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ShieldCheckIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline'
import { PortalWordmark } from '@/components/ui/AeroCommLogo'

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmt(amount: number | string, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount))
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

// ─── OTP Verification modal ───────────────────────────────────────────────────

interface OtpVerifyProps {
  token: string
  otpHint: PortalOtpHint
  onVerified: (sessionToken: string) => void
  onCancel: () => void
}

function OtpVerify({ token, otpHint, onVerified, onCancel }: OtpVerifyProps) {
  const [step, setStep] = useState<'prompt' | 'enter'>('prompt')
  const [challengeToken, setChallengeToken] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sendOtp = useSendPortalOtp(token)
  const verifyOtp = useVerifyPortalOtp(token)

  async function handleSend() {
    setError(null)
    try {
      const result = await sendOtp.mutateAsync()
      setChallengeToken(result.challengeToken)
      setStep('enter')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message
      setError(msg ?? 'Failed to send code. Please try again.')
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const result = await verifyOtp.mutateAsync({ challengeToken, code })
      onVerified(result.sessionToken)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message
      setError(msg ?? 'Incorrect code. Please try again.')
      setCode('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">

        {/* Icon + title */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mx-auto">
            <ShieldCheckIcon className="h-6 w-6 text-primary-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Verify your identity</h2>
          <p className="text-sm text-gray-500">
            To protect your account, we need to confirm it's you before processing this action.
          </p>
        </div>

        {step === 'prompt' && (
          <div className="space-y-4">
            {/* Delivery method hint */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 flex items-center gap-3">
              {otpHint.method === 'sms'
                ? <DevicePhoneMobileIcon className="h-5 w-5 text-gray-400 shrink-0" />
                : <EnvelopeIcon className="h-5 w-5 text-gray-400 shrink-0" />
              }
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {otpHint.method === 'sms' ? 'Text message' : 'Email'}
                </p>
                <p className="text-xs text-gray-500">{otpHint.hint}</p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <Button fullWidth onClick={handleSend} loading={sendOtp.isPending}>
              Send verification code
            </Button>
            <Button fullWidth variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        )}

        {step === 'enter' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Enter the 6-digit code sent to <span className="font-medium">{otpHint.hint}</span>.
              It expires in 10 minutes.
            </p>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-2xl font-mono tracking-[0.5em] rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <Button type="submit" fullWidth loading={verifyOtp.isPending} disabled={code.length < 6}>
              Verify
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 text-xs"
                onClick={() => { setStep('prompt'); setCode(''); setError(null) }}
              >
                Resend code
              </Button>
              <Button type="button" variant="ghost" className="flex-1 text-xs" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Quote card ───────────────────────────────────────────────────────────────

interface QuoteCardProps {
  quote: PortalQuote
  token: string
  sessionToken: string | null
  onNeedVerification: () => void
}

function QuoteCard({ quote, token, sessionToken, onNeedVerification }: QuoteCardProps) {
  const [open, setOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'ACCEPTED' | 'DECLINED' | null>(null)
  const [clientNote, setClientNote] = useState('')
  const respond = useRespondToQuote(token, sessionToken ?? '')

  const canRespond = quote.status === 'SENT' || quote.status === 'VIEWED'
  const isRound = quote.tripType === 'ROUND_TRIP'

  function handleActionClick(action: 'ACCEPTED' | 'DECLINED') {
    if (!sessionToken) {
      onNeedVerification()
      return
    }
    setConfirmAction(action)
  }

  async function handleRespond() {
    if (!confirmAction || !sessionToken) return
    try {
      await respond.mutateAsync({ quoteId: quote.id, response: confirmAction, notes: clientNote || undefined })
      setConfirmAction(null)
      setClientNote('')
    } catch (err: unknown) {
      // Session may have expired
      const code = (err as { response?: { data?: { error?: { code?: string } } } })
        ?.response?.data?.error?.code
      if (code === 'SESSION_EXPIRED' || code === 'VERIFICATION_REQUIRED') {
        onNeedVerification()
      }
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Summary row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-gray-900 text-sm">{quote.reference}</span>
            <Badge variant={quoteStatusBadge(quote.status)} size="sm">
              {quote.status.charAt(0) + quote.status.slice(1).toLowerCase()}
            </Badge>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {quote.originIcao && quote.destinationIcao
              ? `${quote.originIcao} ${isRound ? '⇄' : '→'} ${quote.destinationIcao}`
              : 'Charter quote'}
            {quote.departureDate && ` · ${fmtDate(quote.departureDate)}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-gray-900 tabular-nums">{fmt(quote.totalPrice, quote.currency)}</p>
          {quote.validUntil && (
            <p className="text-xs text-gray-400">Valid to {fmtDate(quote.validUntil)}</p>
          )}
        </div>
        {open
          ? <ChevronUpIcon className="h-4 w-4 text-gray-400 shrink-0" />
          : <ChevronDownIcon className="h-4 w-4 text-gray-400 shrink-0" />
        }
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-5 space-y-5">

          {/* Route + dates */}
          {(quote.originIcao || quote.destinationIcao || quote.departureDate) && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {quote.originIcao && quote.destinationIcao && (
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Route</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-900 text-xl">{quote.originIcao}</span>
                    <span className="text-gray-400 text-lg">{isRound ? '⇄' : '→'}</span>
                    <span className="font-mono font-bold text-gray-900 text-xl">{quote.destinationIcao}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{isRound ? 'Round Trip' : 'One Way'}</p>
                </div>
              )}
              {quote.departureDate && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Departure</p>
                  <p className="text-sm font-medium text-gray-900">{fmtDate(quote.departureDate)}</p>
                </div>
              )}
              {isRound && quote.returnDate && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Return</p>
                  <p className="text-sm font-medium text-gray-900">{fmtDate(quote.returnDate)}</p>
                </div>
              )}
            </div>
          )}

          {/* Validity warning */}
          {quote.validUntil && (
            (() => {
              const validDate = new Date(quote.validUntil)
              const now = new Date()
              const diffMs = validDate.getTime() - now.getTime()
              const expired = diffMs < 0
              const soon = !expired && diffMs < 48 * 60 * 60 * 1000
              if (!expired && !soon) return null
              return (
                <div className={clsx(
                  'rounded-lg px-4 py-2.5 text-sm',
                  expired
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : 'bg-amber-50 border border-amber-200 text-amber-800',
                )}>
                  {expired
                    ? <>This quote expired on <span className="font-medium">{fmtDate(quote.validUntil)}</span>.</>
                    : <>This quote expires soon — <span className="font-medium">{fmtDate(quote.validUntil)}</span>.</>
                  }
                </div>
              )
            })()
          )}

          {/* Issued */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Issued {fmtDate(quote.createdAt)}</span>
            {quote.validUntil && new Date(quote.validUntil) >= new Date() && (
              <span>Valid until {fmtDate(quote.validUntil)}</span>
            )}
          </div>

          {/* Pricing table */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pricing</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left pb-2 font-medium text-gray-500">Description</th>
                  <th className="text-right pb-2 font-medium text-gray-500">Qty</th>
                  <th className="text-right pb-2 font-medium text-gray-500">Unit</th>
                  <th className="text-right pb-2 font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr>
                  <td className="py-2.5 text-gray-800">Charter Fee</td>
                  <td className="py-2.5 text-right text-gray-500">1</td>
                  <td className="py-2.5 text-right text-gray-500">{fmt(quote.basePrice, quote.currency)}</td>
                  <td className="py-2.5 text-right font-medium text-gray-900">{fmt(quote.basePrice, quote.currency)}</td>
                </tr>
                {quote.lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 text-gray-800">
                      {item.description}
                      {item.category && <span className="ml-2 text-xs text-gray-400">{item.category}</span>}
                    </td>
                    <td className="py-2.5 text-right text-gray-500">{Number(item.quantity)}</td>
                    <td className="py-2.5 text-right text-gray-500">{fmt(item.unitPrice, quote.currency)}</td>
                    <td className="py-2.5 text-right font-medium text-gray-900">{fmt(item.total, quote.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300">
                  <td colSpan={3} className="pt-3 text-right font-semibold text-gray-900">Total</td>
                  <td className="pt-3 text-right font-bold text-lg text-gray-900 tabular-nums">
                    {fmt(quote.totalPrice, quote.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          {/* Accept / Decline */}
          {canRespond && !confirmAction && (
            <div className="flex gap-3 pt-2">
              <Button variant="primary" onClick={() => handleActionClick('ACCEPTED')} className="flex-1">
                <CheckCircleIcon className="h-4 w-4 mr-1.5" />
                Accept Quote
              </Button>
              <Button variant="danger" onClick={() => handleActionClick('DECLINED')} className="flex-1">
                <XCircleIcon className="h-4 w-4 mr-1.5" />
                Decline
              </Button>
            </div>
          )}

          {/* Confirmation panel */}
          {confirmAction && (
            <div className={clsx(
              'rounded-lg p-4 space-y-3 border',
              confirmAction === 'ACCEPTED' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200',
            )}>
              <p className={clsx(
                'font-medium text-sm',
                confirmAction === 'ACCEPTED' ? 'text-green-800' : 'text-red-800',
              )}>
                {confirmAction === 'ACCEPTED'
                  ? 'Confirm acceptance of this quote?'
                  : 'Confirm declining this quote?'}
              </p>
              <textarea
                placeholder="Optional note to the team…"
                value={clientNote}
                onChange={(e) => setClientNote(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              <div className="flex gap-2">
                <Button
                  variant={confirmAction === 'ACCEPTED' ? 'primary' : 'danger'}
                  onClick={handleRespond}
                  loading={respond.isPending}
                  className="flex-1"
                >
                  {confirmAction === 'ACCEPTED' ? 'Yes, Accept' : 'Yes, Decline'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => { setConfirmAction(null); setClientNote('') }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Already responded */}
          {!canRespond && (quote.status === 'ACCEPTED' || quote.status === 'DECLINED') && (
            <div className={clsx(
              'rounded-lg px-4 py-3 text-sm font-medium',
              quote.status === 'ACCEPTED' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800',
            )}>
              {quote.status === 'ACCEPTED'
                ? 'You accepted this quote. Our team will be in touch shortly.'
                : 'You declined this quote.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Trip card ────────────────────────────────────────────────────────────────

function TripCard({ trip }: { trip: PortalTrip }) {
  const isUpcoming = new Date(trip.departureAt) > new Date()

  return (
    <div className={clsx(
      'rounded-xl border bg-white shadow-sm overflow-hidden',
      trip.isDelayed ? 'border-amber-300' : 'border-gray-200',
    )}>
      {trip.isDelayed && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center gap-2 text-sm text-amber-800 font-medium">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          Delay notice
          {trip.delayNotes && <span className="font-normal text-amber-700 ml-1">— {trip.delayNotes}</span>}
        </div>
      )}

      <div className="px-5 py-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-gray-900 text-sm">{trip.reference}</span>
              <Badge variant={isUpcoming ? 'primary' : 'default'} size="sm">
                {trip.status.replace('_', ' ').charAt(0) + trip.status.replace('_', ' ').slice(1).toLowerCase()}
              </Badge>
            </div>
            {trip.aircraft && (
              <p className="text-xs text-gray-400 mt-0.5">
                {trip.aircraft.make} {trip.aircraft.model} · {trip.aircraft.tailNumber}
              </p>
            )}
          </div>
          {isUpcoming && (
            <div className="flex items-center gap-1 text-xs text-primary-600 font-medium shrink-0">
              <ClockIcon className="h-3.5 w-3.5" />
              Upcoming
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Departure</p>
            <p className="font-mono font-bold text-gray-900 text-lg">{trip.originIcao}</p>
            <p className="text-xs text-gray-600">{fmtDateTime(trip.departureAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Arrival</p>
            <p className="font-mono font-bold text-gray-900 text-lg">{trip.destinationIcao}</p>
            <p className="text-xs text-gray-600">{trip.arrivalAt ? fmtDateTime(trip.arrivalAt) : '—'}</p>
          </div>
          {trip.returnTrip && (
            <>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Return Departure</p>
                <p className="font-mono font-bold text-gray-900 text-lg">{trip.returnTrip.originIcao}</p>
                <p className="text-xs text-gray-600">{fmtDateTime(trip.returnTrip.departureAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Return Arrival</p>
                <p className="font-mono font-bold text-gray-900 text-lg">{trip.returnTrip.destinationIcao}</p>
                <p className="text-xs text-gray-600">{trip.returnTrip.arrivalAt ? fmtDateTime(trip.returnTrip.arrivalAt) : '—'}</p>
              </div>
            </>
          )}
        </div>

        {(trip.fboName || trip.boardingTime) && (
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm space-y-1">
            {trip.boardingTime && (
              <p className="text-gray-700">
                <span className="font-medium">Boarding:</span> {fmtDateTime(trip.boardingTime)}
              </p>
            )}
            {trip.fboName && (
              <p className="text-gray-700">
                <span className="font-medium">FBO:</span> {trip.fboName}
                {trip.fboAddress && ` · ${trip.fboAddress}`}
              </p>
            )}
          </div>
        )}

        {trip.notes && (
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{trip.notes}</p>
        )}
      </div>
    </div>
  )
}

// ─── Request form ─────────────────────────────────────────────────────────────

const REQUEST_TYPES = [
  { value: 'NEW_QUOTE', label: 'Request a New Quote' },
  { value: 'TRIP_CHANGE', label: 'Change to Existing Trip' },
  { value: 'GENERAL', label: 'General Inquiry' },
] as const

interface RequestFormProps {
  token: string
  sessionToken: string | null
  onNeedVerification: () => void
}

function RequestForm({ token, sessionToken, onNeedVerification }: RequestFormProps) {
  const [requestType, setRequestType] = useState<'NEW_QUOTE' | 'TRIP_CHANGE' | 'GENERAL'>('NEW_QUOTE')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const submit = useSubmitPortalRequest(token, sessionToken ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sessionToken) {
      onNeedVerification()
      return
    }
    try {
      await submit.mutateAsync({ requestType, title, message })
      setSubmitted(true)
      setTitle('')
      setMessage('')
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })
        ?.response?.data?.error?.code
      if (code === 'SESSION_EXPIRED' || code === 'VERIFICATION_REQUIRED') {
        onNeedVerification()
      }
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center space-y-3">
        <CheckCircleIcon className="h-10 w-10 text-green-500 mx-auto" />
        <p className="font-semibold text-green-800">Request sent!</p>
        <p className="text-sm text-green-700">Our team will follow up with you shortly.</p>
        <Button variant="secondary" size="sm" onClick={() => setSubmitted(false)}>
          Send another request
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Request Type</label>
        <div className="flex flex-wrap gap-2">
          {REQUEST_TYPES.map((rt) => (
            <button
              key={rt.value}
              type="button"
              onClick={() => setRequestType(rt.value)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                requestType === rt.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
              )}
            >
              {rt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Quote for NYC → MIA, June 15"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="Please include any relevant details — dates, passengers, destinations, special requests…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={submit.isPending}>
          <PaperAirplaneIcon className="h-4 w-4 mr-1.5" />
          Send Request
        </Button>
        {!sessionToken && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            Identity verification required to submit
          </p>
        )}
      </div>
    </form>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'quotes' | 'trips' | 'request'

const TABS: { id: Tab; label: string }[] = [
  { id: 'quotes', label: 'Quotes' },
  { id: 'trips', label: 'My Trips' },
  { id: 'request', label: 'New Request' },
]

export default function PortalPage() {
  const { token = '' } = useParams<{ token: string }>()
  const [tab, setTab] = useState<Tab>('quotes')

  // Session state — obtained after OTP verification, valid 30 min
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [showVerify, setShowVerify] = useState(false)

  const { data: identity, isLoading: loadingId, isError } = usePortalIdentity(token)
  const { data: quotes = [], isLoading: loadingQuotes } = usePortalQuotes(token)
  const { data: trips = [], isLoading: loadingTrips } = usePortalTrips(token)

  const handleVerified = useCallback((token: string) => {
    setSessionToken(token)
    setShowVerify(false)
  }, [])

  const requestVerification = useCallback(() => {
    setShowVerify(true)
  }, [])

  // ── Invalid / expired token ──────────────────────────────────────────────
  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <XCircleIcon className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Link invalid or expired</h1>
          <p className="text-sm text-gray-500">
            This portal link is no longer valid. Please contact your charter operator for a new link.
          </p>
        </div>
      </div>
    )
  }

  if (loadingId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const contact = identity?.contact
  const tenant = identity?.tenant
  const otpHint = identity?.otpHint

  return (
    <div className="min-h-screen bg-gray-50">

      {/* OTP verification overlay */}
      {showVerify && otpHint && (
        <OtpVerify
          token={token}
          otpHint={otpHint}
          onVerified={handleVerified}
          onCancel={() => setShowVerify(false)}
        />
      )}

      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{tenant?.name}</p>
            <h1 className="text-xl font-bold text-gray-900">
              Welcome, {contact?.firstName}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {sessionToken && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                <ShieldCheckIcon className="h-3.5 w-3.5" />
                Verified
              </div>
            )}
            <div className="text-right text-sm text-gray-500">
              {contact?.email && <p>{contact.email}</p>}
              {contact?.phone && <p>{contact.phone}</p>}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto flex gap-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6 space-y-4">

        {tab === 'quotes' && (
          <>
            {loadingQuotes && (
              <div className="py-12 text-center text-sm text-gray-400">Loading quotes…</div>
            )}
            {!loadingQuotes && quotes.length === 0 && (
              <div className="py-12 text-center text-sm text-gray-400">
                No quotes yet. Use the <strong>New Request</strong> tab to request a quote.
              </div>
            )}
            {quotes.map((q) => (
              <QuoteCard
                key={q.id}
                quote={q}
                token={token}
                sessionToken={sessionToken}
                onNeedVerification={requestVerification}
              />
            ))}
          </>
        )}

        {tab === 'trips' && (
          <>
            {loadingTrips && (
              <div className="py-12 text-center text-sm text-gray-400">Loading trips…</div>
            )}
            {!loadingTrips && trips.length === 0 && (
              <div className="py-12 text-center text-sm text-gray-400">
                No trips found for your account yet.
              </div>
            )}
            {trips.map((t) => (
              <TripCard key={t.id} trip={t} />
            ))}
          </>
        )}

        {tab === 'request' && (
          <RequestForm
            token={token}
            sessionToken={sessionToken}
            onNeedVerification={requestVerification}
          />
        )}

      </main>

      <footer className="text-center py-8 text-xs text-gray-400">
        {tenant?.name} · Powered by <PortalWordmark />
      </footer>
    </div>
  )
}
