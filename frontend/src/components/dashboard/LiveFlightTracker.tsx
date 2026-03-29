import { useLiveFlights, type LiveFlight } from '@/api/flight-tracking.api'

function formatAlt(ft: number | null): string {
  if (ft == null) return '—'
  return `${ft.toLocaleString()} ft`
}

function formatSpeed(kts: number | null): string {
  if (kts == null) return '—'
  return `${kts} kts`
}

function formatRemaining(arrivalAt: string | null): string {
  if (!arrivalAt) return '—'
  const ms = new Date(arrivalAt).getTime() - Date.now()
  if (ms <= 0) return 'Landing soon'
  const totalMins = Math.round(ms / 60_000)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h === 0) return `${m}m remaining`
  return `${h}h ${m}m remaining`
}

function flightProgress(departureAt: string | null, arrivalAt: string | null): number {
  if (!departureAt || !arrivalAt) return 0
  const dep = new Date(departureAt).getTime()
  const arr = new Date(arrivalAt).getTime()
  const now = Date.now()
  const total = arr - dep
  if (total <= 0) return 0
  return Math.min(1, Math.max(0, (now - dep) / total))
}

function FlightCard({ flight }: { flight: LiveFlight }) {
  const dep = flight.depIcao ?? '???'
  const arr = flight.arrIcao ?? '???'
  const progress = flightProgress(flight.departureAt, flight.arrivalAt)
  const progressPct = Math.round(progress * 100)

  return (
    <div className="border border-sky-100 rounded-xl bg-gradient-to-r from-sky-50 to-white overflow-hidden">

      {/* Header row */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        {/* Aircraft info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-gray-900 text-sm">{flight.tailNumber}</span>
            <span className="text-gray-300 text-xs">·</span>
            <span className="text-sm text-gray-500">{flight.make} {flight.model}</span>
            {flight.flightIcao && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">{flight.flightIcao}</span>
            )}
          </div>
        </div>

        {/* Telemetry */}
        <div className="hidden sm:flex items-center gap-4 text-right shrink-0">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Alt</p>
            <p className="text-sm font-semibold text-gray-800">{formatAlt(flight.altFt)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Speed</p>
            <p className="text-sm font-semibold text-gray-800">{formatSpeed(flight.speedKts)}</p>
          </div>
        </div>

        {/* Live pulse */}
        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
          </span>
          <span className="text-xs text-sky-600 font-medium">Live</span>
        </div>
      </div>

      {/* Route progress track */}
      <div className="px-5 pb-4">
        {/* Airport labels */}
        <div className="flex justify-between text-xs font-mono font-bold text-gray-500 mb-1.5">
          <span>{dep}</span>
          <span>{arr}</span>
        </div>

        {/* Track */}
        <div className="relative h-6 flex items-center">
          {/* Dashed background line */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px border-t-2 border-dashed border-gray-200" />

          {/* Filled progress line */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-sky-400 transition-all duration-1000"
            style={{ width: `${progressPct}%` }}
          />

          {/* Airplane icon at progress position */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-1000"
            style={{ left: `${progressPct}%` }}
          >
            <div className="h-7 w-7 rounded-full bg-sky-500 shadow-md flex items-center justify-center text-white">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0011.5 2 1.5 1.5 0 0010 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
              </svg>
            </div>
          </div>

          {/* Destination dot */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border-2 border-gray-300 bg-white" />
        </div>

        {/* Remaining time */}
        <div className="flex justify-between items-center mt-1.5">
          <span className="text-[10px] text-gray-400">{progressPct}% complete</span>
          <span className="text-xs font-medium text-sky-700">{formatRemaining(flight.arrivalAt)}</span>
        </div>
      </div>
    </div>
  )
}

interface Props {
  enabled: boolean
}

export function LiveFlightTracker({ enabled }: Props) {
  const { data: flights, isLoading, isError } = useLiveFlights(enabled)

  if (!isLoading && !isError && (!flights || flights.length === 0)) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">Live Fleet Tracking</h2>
          {!isLoading && flights && flights.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">
              {flights.length} airborne
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">Updates every 60s · AirLabs ADS-B</span>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          <>
            {[0, 1].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </>
        ) : isError ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            Flight tracking unavailable — check AirLabs API key.
          </p>
        ) : (
          (flights ?? []).map((f) => <FlightCard key={f.aircraftId} flight={f} />)
        )}
      </div>
    </div>
  )
}
