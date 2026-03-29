import { useAuthStore } from '@/store/auth.store'
import { useTrips } from '@/api/trips.api'
import { useContacts } from '@/api/contacts.api'
import { Badge, tripStatusBadge } from '@/components/ui/Badge'
import { useNavigate } from 'react-router-dom'
import { LiveFlightTracker } from '@/components/dashboard/LiveFlightTracker'

// ── Greeting ────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Stat card skeleton ───────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-3.5 w-24 bg-gray-200 rounded" />
          <div className="h-8 w-16 bg-gray-200 rounded mt-3" />
          <div className="h-3 w-32 bg-gray-100 rounded" />
        </div>
        <div className="h-10 w-10 rounded-lg bg-gray-200 shrink-0" />
      </div>
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  iconBg: string
  icon: React.ReactNode
}

function StatCard({ label, value, sub, iconBg, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
      </div>
      <div className={`rounded-lg p-2.5 ${iconBg}`}>
        {icon}
      </div>
    </div>
  )
}

// ── Quick action card ────────────────────────────────────────────────────────

interface QuickActionProps {
  label: string
  onClick: () => void
  icon: React.ReactNode
}

function QuickAction({ label, onClick, icon }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-center group"
    >
      <div className="h-9 w-9 rounded-lg bg-primary-50 group-hover:bg-primary-100 flex items-center justify-center transition-colors text-primary-600">
        {icon}
      </div>
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </button>
  )
}

// ── Icons (heroicons 20/solid inline) ────────────────────────────────────────

const PaperAirplaneIcon20 = () => (
  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
  </svg>
)

const UsersIcon20 = () => (
  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 17a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.575c.186.462-.41.898-.924.808A4.448 4.448 0 0114.5 16z" />
  </svg>
)

const ClockIcon20 = () => (
  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
  </svg>
)

const ExclamationTriangleIcon20 = () => (
  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
  </svg>
)

const PlusIcon20 = () => (
  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
  </svg>
)

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { data: tripsData, isLoading: tripsLoading } = useTrips({ pageSize: 8 })
  const { data: contactsData } = useContacts({ pageSize: 1 })

  const trips = tripsData?.data ?? []

  // Only poll AirLabs when at least one trip is actively airborne
  const hasAirborneTrips = trips.some((t) => t.status === 'DEPARTED')

  const activeCount = trips.filter(
    (t) => t.status === 'CONFIRMED' || t.status === 'MANIFEST_LOCKED',
  ).length

  const departuresTodayCount = trips.filter((t) => {
    const dep = new Date(t.departureAt)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    return dep >= now && dep <= tomorrow && t.status !== 'CANCELLED'
  }).length

  const delayedCount = trips.filter((t) => t.isDelayed).length

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {getGreeting()}, {user?.firstName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here&apos;s what&apos;s happening across your fleet today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tripsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Active Trips"
              value={activeCount}
              sub="Confirmed or manifest locked"
              iconBg="bg-blue-50 text-blue-600"
              icon={<PaperAirplaneIcon20 />}
            />
            <StatCard
              label="Total Contacts"
              value={contactsData?.meta?.total ?? '—'}
              sub="Owners & passengers"
              iconBg="bg-green-50 text-green-600"
              icon={<UsersIcon20 />}
            />
            <StatCard
              label="Departures Today"
              value={departuresTodayCount}
              sub="Next 24 hours"
              iconBg="bg-amber-50 text-amber-600"
              icon={<ClockIcon20 />}
            />
            <StatCard
              label="Delayed"
              value={delayedCount}
              sub="Currently flagged"
              iconBg="bg-red-50 text-red-600"
              icon={<ExclamationTriangleIcon20 />}
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickAction
          label="New Trip"
          onClick={() => navigate('/trips')}
          icon={<PaperAirplaneIcon20 />}
        />
        <QuickAction
          label="New Contact"
          onClick={() => navigate('/contacts')}
          icon={<UsersIcon20 />}
        />
        <QuickAction
          label="New Quote"
          onClick={() => navigate('/quotes')}
          icon={
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0-6a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" clipRule="evenodd" />
            </svg>
          }
        />
        <QuickAction
          label="New Ticket"
          onClick={() => navigate('/tickets')}
          icon={
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
            </svg>
          }
        />
      </div>

      {/* Live flight tracker — only polls AirLabs when a trip is IN_FLIGHT or BOARDING */}
      <LiveFlightTracker enabled={hasAirborneTrips} />

      {/* Recent Trips */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Recent Trips</h2>
          <button
            onClick={() => navigate('/trips')}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
          >
            View all
          </button>
        </div>

        {tripsLoading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-12 bg-gray-200 rounded" />
                    <div className="h-3 w-3 bg-gray-100 rounded" />
                    <div className="h-4 w-12 bg-gray-200 rounded" />
                  </div>
                  <div className="h-3 w-36 bg-gray-100 rounded" />
                </div>
                <div className="h-5 w-20 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-gray-400">
              <PaperAirplaneIcon20 />
            </div>
            <p className="text-sm font-medium text-gray-900">No trips yet</p>
            <p className="text-xs text-gray-500 mt-1">Create your first trip to get started.</p>
            <button
              onClick={() => navigate('/trips')}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 transition-colors"
            >
              <PlusIcon20 />
              New Trip
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {trips.map((trip) => {
              const originIcao = trip.legs?.[0]?.originIcao ?? trip.originIcao
              const destIcao = trip.legs?.[0]?.destinationIcao ?? trip.destinationIcao
              const dep = new Date(trip.departureAt)
              const departureFormatted =
                dep.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
                ' · ' +
                dep.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

              return (
                <li
                  key={trip.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/trips')}
                >
                  {/* Route */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-gray-900 text-sm">{originIcao}</span>
                      <span className="text-gray-300">→</span>
                      <span className="font-mono font-semibold text-gray-900 text-sm">{destIcao}</span>
                      {trip.isDelayed && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                          Delayed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {departureFormatted}
                      {trip.aircraft?.tailNumber ? ` · ${trip.aircraft.tailNumber}` : ''}
                    </p>
                  </div>
                  <Badge variant={tripStatusBadge(trip.status)} size="sm">
                    {trip.status.replace('_', ' ')}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Today's Schedule empty state (shown when no departures today) */}
      {!tripsLoading && departuresTodayCount === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-center">
          <div className="mx-auto h-9 w-9 rounded-full bg-amber-50 flex items-center justify-center mb-3 text-amber-500">
            <ClockIcon20 />
          </div>
          <p className="text-sm font-medium text-gray-700">No departures today</p>
          <p className="text-xs text-gray-400 mt-0.5">Your schedule is clear for the next 24 hours.</p>
        </div>
      )}
    </div>
  )
}
