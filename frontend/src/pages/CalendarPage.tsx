import { useState, useMemo } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, isToday,
  format, addMonths, subMonths, parseISO, isValid,
} from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { clsx } from 'clsx'
import { useTrips, type Trip } from '@/api/trips.api'
import { useMaintenance, type MaintenanceRecord } from '@/api/maintenance.api'
import { useCrew, type CrewMember } from '@/api/crew.api'

// ---------- Event types ----------

type EventKind = 'trip' | 'maintenance' | 'crew_expiry'

interface CalendarEvent {
  id: string
  kind: EventKind
  title: string
  subtitle?: string
  date: Date
  endDate?: Date
  colorClass: string
  dotClass: string
  raw: Trip | MaintenanceRecord | { member: CrewMember; field: 'medical' | 'license' }
}

const TRIP_STATUS_COLORS: Record<string, string> = {
  INQUIRY:         'bg-gray-100 text-gray-700',
  QUOTED:          'bg-purple-100 text-purple-700',
  CONFIRMED:       'bg-blue-100 text-blue-800',
  MANIFEST_LOCKED: 'bg-indigo-100 text-indigo-800',
  DEPARTED:        'bg-sky-100 text-sky-800',
  COMPLETED:       'bg-green-100 text-green-800',
  CANCELLED:       'bg-gray-100 text-gray-400 line-through',
}

const TRIP_DOT_COLORS: Record<string, string> = {
  INQUIRY:         'bg-gray-400',
  QUOTED:          'bg-purple-400',
  CONFIRMED:       'bg-blue-500',
  MANIFEST_LOCKED: 'bg-indigo-500',
  DEPARTED:        'bg-sky-500',
  COMPLETED:       'bg-green-500',
  CANCELLED:       'bg-gray-300',
}

const MAINT_STATUS_COLORS: Record<string, string> = {
  SCHEDULED:   'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-orange-100 text-orange-800',
  COMPLETED:   'bg-green-100 text-green-800',
  DEFERRED:    'bg-gray-100 text-gray-600',
  CANCELLED:   'bg-gray-100 text-gray-400',
}

function safeParseISO(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = parseISO(s)
  return isValid(d) ? d : null
}

// ---------- Build events from API data ----------

function buildEvents(
  trips: Trip[],
  maintenance: MaintenanceRecord[],
  crew: CrewMember[],
  calStart: Date,
  calEnd: Date,
): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (const trip of trips) {
    const date = safeParseISO(trip.departureTime)
    if (!date) continue
    events.push({
      id: `trip-${trip.id}`,
      kind: 'trip',
      title: `${trip.departureAirport} → ${trip.arrivalAirport}`,
      subtitle: trip.aircraft?.registration ?? trip.reference,
      date,
      colorClass: TRIP_STATUS_COLORS[trip.status] ?? 'bg-blue-100 text-blue-800',
      dotClass: TRIP_DOT_COLORS[trip.status] ?? 'bg-blue-500',
      raw: trip,
    })
  }

  for (const rec of maintenance) {
    const date = safeParseISO(rec.scheduledAt) ?? safeParseISO(rec.nextDueDate)
    if (!date) continue
    events.push({
      id: `maint-${rec.id}`,
      kind: 'maintenance',
      title: rec.title,
      subtitle: rec.aircraft?.tailNumber ?? undefined,
      date,
      colorClass: MAINT_STATUS_COLORS[rec.status] ?? 'bg-amber-100 text-amber-800',
      dotClass: 'bg-amber-500',
      raw: rec,
    })
  }

  for (const member of crew) {
    const fullName = `${member.firstName} ${member.lastName}`

    const medDate = safeParseISO(member.medicalExpiry)
    if (medDate && medDate >= calStart && medDate <= calEnd) {
      const isPast = medDate < new Date()
      events.push({
        id: `crew-med-${member.id}`,
        kind: 'crew_expiry',
        title: `${fullName} — Medical`,
        subtitle: isPast ? 'Expired' : 'Expires',
        date: medDate,
        colorClass: isPast ? 'bg-red-100 text-red-700' : 'bg-rose-100 text-rose-700',
        dotClass: isPast ? 'bg-red-500' : 'bg-rose-400',
        raw: { member, field: 'medical' as const },
      })
    }

    const licDate = safeParseISO(member.licenseExpiry)
    if (licDate && licDate >= calStart && licDate <= calEnd) {
      const isPast = licDate < new Date()
      events.push({
        id: `crew-lic-${member.id}`,
        kind: 'crew_expiry',
        title: `${fullName} — License`,
        subtitle: isPast ? 'Expired' : 'Expires',
        date: licDate,
        colorClass: isPast ? 'bg-red-100 text-red-700' : 'bg-rose-100 text-rose-700',
        dotClass: isPast ? 'bg-red-500' : 'bg-rose-400',
        raw: { member, field: 'license' as const },
      })
    }
  }

  return events
}

// ---------- Day Detail Panel ----------

interface DayPanelProps {
  date: Date
  events: CalendarEvent[]
  onClose: () => void
}

function DayPanel({ date, events, onClose }: DayPanelProps) {
  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-40 flex flex-col border-l border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
        <div>
          <p className="text-sm text-gray-500">{format(date, 'EEEE')}</p>
          <p className="text-lg font-semibold text-gray-900">{format(date, 'MMMM d, yyyy')}</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {events.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No events on this day</p>
        )}
        {events.map((ev) => (
          <div key={ev.id} className={clsx('rounded-lg px-3 py-2.5', ev.colorClass)}>
            <p className="text-sm font-medium leading-tight">{ev.title}</p>
            {ev.subtitle && <p className="text-xs mt-0.5 opacity-75">{ev.subtitle}</p>}
            {ev.kind === 'trip' && (
              <p className="text-xs mt-0.5 opacity-60">{format(ev.date, 'h:mm a')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- Calendar Day Cell ----------

interface DayCellProps {
  day: Date
  currentMonth: Date
  events: CalendarEvent[]
  isSelected: boolean
  onClick: () => void
}

const MAX_VISIBLE = 3

function DayCell({ day, currentMonth, events, isSelected, onClick }: DayCellProps) {
  const inMonth = isSameMonth(day, currentMonth)
  const todayDay = isToday(day)
  const visible = events.slice(0, MAX_VISIBLE)
  const overflow = events.length - MAX_VISIBLE

  return (
    <div
      onClick={onClick}
      className={clsx(
        'min-h-[100px] p-1.5 border-b border-r border-gray-100 cursor-pointer transition-colors',
        inMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100/50',
        isSelected && 'ring-2 ring-inset ring-primary-500',
      )}
    >
      <div className="flex items-center justify-end mb-1">
        <span
          className={clsx(
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
            todayDay ? 'bg-primary-600 text-white' : inMonth ? 'text-gray-900' : 'text-gray-400',
          )}
        >
          {format(day, 'd')}
        </span>
      </div>

      <div className="space-y-0.5">
        {visible.map((ev) => (
          <div key={ev.id} className={clsx('flex items-center gap-1 rounded px-1 py-0.5 truncate', ev.colorClass)}>
            <span className={clsx('h-1.5 w-1.5 rounded-full shrink-0', ev.dotClass)} />
            <span className="text-xs truncate leading-tight">{ev.title}</span>
          </div>
        ))}
        {overflow > 0 && (
          <p className="text-xs text-gray-400 px-1">+{overflow} more</p>
        )}
      </div>
    </div>
  )
}

// ---------- Main Page ----------

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const calStart = startOfWeek(startOfMonth(currentMonth))
  const calEnd = endOfWeek(endOfMonth(currentMonth))
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const fromStr = format(calStart, "yyyy-MM-dd'T'HH:mm:ss")
  const toStr = format(calEnd, "yyyy-MM-dd'T'HH:mm:ss")

  const { data: tripsData } = useTrips({ from: fromStr, to: toStr, pageSize: 200 })
  const { data: maintData } = useMaintenance({ pageSize: 200 })
  const { data: crewData } = useCrew({ isActive: true, pageSize: 200 })

  const events = useMemo(() => buildEvents(
    tripsData?.data ?? [],
    maintData?.data ?? [],
    crewData?.data ?? [],
    calStart,
    calEnd,
  ), [tripsData, maintData, crewData, calStart.getTime(), calEnd.getTime()])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const key = format(ev.date, 'yyyy-MM-dd')
      const arr = map.get(key) ?? []
      arr.push(ev)
      map.set(key, arr)
    }
    return map
  }, [events])

  function eventsForDay(day: Date) {
    return eventsByDay.get(format(day, 'yyyy-MM-dd')) ?? []
  }

  function goToday() {
    setCurrentMonth(startOfMonth(new Date()))
    setSelectedDay(null)
  }

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : []

  return (
    <div className="flex flex-col h-full space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(currentMonth, 'MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 mr-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />Trips</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Maintenance</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" />Crew Expiry</span>
          </div>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Today
          </button>
          <div className="flex">
            <button
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-l-lg border border-gray-300 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-r-lg border border-gray-300 border-l-0 transition-colors"
              aria-label="Next month"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day) => (
            <DayCell
              key={day.toISOString()}
              day={day}
              currentMonth={currentMonth}
              events={eventsForDay(day)}
              isSelected={selectedDay ? isSameDay(day, selectedDay) : false}
              onClick={() => setSelectedDay((prev) => prev && isSameDay(prev, day) ? null : day)}
            />
          ))}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setSelectedDay(null)} />
          <DayPanel
            date={selectedDay}
            events={selectedEvents}
            onClose={() => setSelectedDay(null)}
          />
        </>
      )}
    </div>
  )
}
