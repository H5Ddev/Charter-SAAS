import { useLiveFlights, type LiveFlight } from '@/api/flight-tracking.api'

function formatAlt(ft: number | null): string {
  if (ft == null) return '—'
  return `${ft.toLocaleString()} ft`
}

function formatSpeed(kts: number | null): string {
  if (kts == null) return '—'
  return `${kts} kts`
}

// Rotate the airplane icon to match heading
function AirplaneIcon({ heading }: { heading: number | null }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
      style={{ transform: `rotate(${(heading ?? 0) - 45}deg)`, transition: 'transform 1s ease' }}
    >
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0011.5 2 1.5 1.5 0 0010 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  )
}

function FlightCard({ flight }: { flight: LiveFlight }) {
  const route = flight.depIcao && flight.arrIcao
    ? `${flight.depIcao} → ${flight.arrIcao}`
    : flight.depIcao ?? flight.arrIcao ?? 'Route unknown'

  return (
    <div className="flex items-center gap-4 px-5 py-4 border border-sky-100 rounded-xl bg-gradient-to-r from-sky-50 to-white">
      {/* Animated airplane icon */}
      <div className="h-10 w-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm">
        <AirplaneIcon heading={flight.heading} />
      </div>

      {/* Aircraft + route */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-gray-900 text-sm">{flight.tailNumber}</span>
          <span className="text-gray-300 text-xs">·</span>
          <span className="text-sm text-gray-600">{flight.make} {flight.model}</span>
          {flight.flightIcao && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">{flight.flightIcao}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 font-mono">{route}</p>
      </div>

      {/* Telemetry */}
      <div className="hidden sm:flex items-center gap-5 text-right shrink-0">
        <div>
          <p className="text-xs text-gray-400">Altitude</p>
          <p className="text-sm font-semibold text-gray-800">{formatAlt(flight.altFt)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Speed</p>
          <p className="text-sm font-semibold text-gray-800">{formatSpeed(flight.speedKts)}</p>
        </div>
      </div>

      {/* Live pulse */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
        </span>
        <span className="text-xs text-sky-600 font-medium">Live</span>
      </div>
    </div>
  )
}

interface Props {
  enabled: boolean
}

export function LiveFlightTracker({ enabled }: Props) {
  const { data: flights, isLoading, isError } = useLiveFlights(enabled)

  // Don't render the section at all if no aircraft are airborne and not loading
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
              <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
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
