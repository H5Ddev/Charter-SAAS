import { useState } from 'react'
import { clsx } from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { Table, type Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/20/solid'
import { AddAircraftModal } from '@/components/aircraft/AddAircraftModal'
import { AircraftDetailModal } from '@/components/aircraft/AircraftDetailModal'
import { AircraftClassModal } from '@/components/aircraft/AircraftClassModal'
import { normalizeAircraft, type Aircraft } from '@/api/aircraft.api'
import { useAircraftClasses, useDeleteAircraftClass, type AircraftClass } from '@/api/aircraft-classes.api'

function useAircraft(filters: { page?: number; pageSize?: number; isActive?: boolean }) {
  return useQuery({
    queryKey: ['aircraft', filters],
    queryFn: async () => {
      const response = await apiClient.get<{
        data: Array<{ id: string; tailNumber: string; make: string; model: string; year: number | null; seats: number; rangeNm: number | null; isActive: boolean; homeBaseIcao: string | null; costPerHour: number | string | null; hourlyRate: number | string | null; createdAt: string }>
        meta: { total: number; page: number; pageSize: number; totalPages: number }
      }>('/aircraft', { params: filters })
      const raw = response.data
      return {
        ...raw,
        data: raw.data.map((a) => normalizeAircraft(a as Parameters<typeof normalizeAircraft>[0])) as Aircraft[],
      }
    },
  })
}

type ActiveFilter = 'all' | 'active' | 'inactive'
type Tab = 'fleet' | 'classes'

const ROLE_LABELS: Record<string, string> = {
  CAPTAIN: 'Captain', FIRST_OFFICER: 'First Officer',
  FLIGHT_ATTENDANT: 'Flight Attendant', DISPATCHER: 'Dispatcher',
  MECHANIC: 'Mechanic', OTHER: 'Other',
}

export default function AircraftPage() {
  const [tab, setTab] = useState<Tab>('fleet')

  // Fleet tab state
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Classes tab state
  const [classModalOpen, setClassModalOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<AircraftClass | null>(null)

  const { data, isLoading } = useAircraft({
    page,
    pageSize: 20,
    isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
  })

  const { data: classes, isLoading: classesLoading } = useAircraftClasses()
  const deleteClass = useDeleteAircraftClass()

  const columns: Column<Aircraft>[] = [
    {
      key: 'registration',
      header: 'Aircraft',
      render: (a) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
            <svg className="h-4 w-4 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </div>
          <div>
            <p className="font-mono font-bold text-gray-900 text-sm tracking-wide">{a.registration}</p>
            <p className="text-xs text-gray-400">{a.make} {a.model}{a.year ? ` · ${a.year}` : ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'seats',
      header: 'Seats',
      render: (a) => (
        <div className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
          </svg>
          <span className="text-sm text-gray-700">{a.seatingCapacity}</span>
        </div>
      ),
    },
    {
      key: 'range',
      header: 'Range',
      render: (a) => a.rangeNm != null
        ? <span className="text-sm text-gray-700 tabular-nums">{a.rangeNm.toLocaleString()} nm</span>
        : <span className="text-gray-400 text-sm">—</span>,
    },
    {
      key: 'homeBase',
      header: 'Home Base',
      render: (a) => a.homeBaseIcao
        ? <span className="font-mono font-medium text-gray-900 text-sm">{a.homeBaseIcao}</span>
        : <span className="text-gray-400 text-sm">—</span>,
    },
    {
      key: 'hourlyRate',
      header: 'Client Rate',
      render: (a) => a.hourlyRate != null
        ? <span className="text-sm font-medium text-gray-900 tabular-nums">${a.hourlyRate.toLocaleString()}<span className="text-gray-400 font-normal">/hr</span></span>
        : <span className="text-gray-400 text-sm">—</span>,
    },
    {
      key: 'costPerHour',
      header: 'Cost/Hr',
      render: (a) => a.costPerHour != null
        ? <span className="text-sm text-gray-600 tabular-nums">${a.costPerHour.toLocaleString()}</span>
        : <span className="text-gray-400 text-sm">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        <Badge variant={a.isActive ? 'success' : 'default'} size="sm">
          {a.isActive ? 'In Charter' : 'Out of Charter'}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aircraft</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tab === 'fleet' ? `${data?.meta.total ?? 0} in fleet` : `${classes?.length ?? 0} classes defined`}
          </p>
        </div>
        {tab === 'fleet' ? (
          <Button size="md" onClick={() => setAddOpen(true)}>
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Add Aircraft
          </Button>
        ) : (
          <Button size="md" onClick={() => { setEditingClass(null); setClassModalOpen(true) }}>
            <PlusIcon className="h-4 w-4 mr-1.5" />
            New Class
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { value: 'fleet', label: 'Fleet' },
          { value: 'classes', label: 'Aircraft Classes' },
        ] as { value: Tab; label: string }[]).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t.value
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Fleet tab */}
      {tab === 'fleet' && (
        <>
          <div className="flex items-center gap-2">
            {([
              { value: 'all', label: 'All' },
              { value: 'active', label: 'In Charter' },
              { value: 'inactive', label: 'Out of Charter' },
            ] as { value: ActiveFilter; label: string }[]).map((f) => (
              <button
                key={f.value}
                onClick={() => { setActiveFilter(f.value); setPage(1) }}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  activeFilter === f.value
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Table
            columns={columns}
            data={data?.data ?? []}
            keyExtractor={(a) => a.id}
            loading={isLoading}
            emptyMessage="No aircraft found. Add your first aircraft to get started."
            pagination={data?.meta}
            onPageChange={setPage}
            onRowClick={(a) => setSelectedId(a.id)}
            renderMobileCard={(a) => (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                  <svg className="h-5 w-5 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-gray-900 text-sm tracking-wide">{a.registration}</p>
                  <p className="text-xs text-gray-500">{a.make} {a.model}{a.year ? ` · ${a.year}` : ''}</p>
                  {a.homeBaseIcao && (
                    <p className="text-xs text-gray-400 font-mono">{a.homeBaseIcao} · {a.seatingCapacity} seats</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant={a.isActive ? 'success' : 'default'} size="sm">
                    {a.isActive ? 'In Charter' : 'Out'}
                  </Badge>
                  {a.hourlyRate != null && (
                    <span className="text-xs text-gray-600 tabular-nums">${a.hourlyRate.toLocaleString()}/hr</span>
                  )}
                </div>
              </div>
            )}
          />
        </>
      )}

      {/* Classes tab */}
      {tab === 'classes' && (
        <div>
          {classesLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!classesLoading && (!classes || classes.length === 0) && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">No aircraft classes yet.</p>
              <p className="text-xs mt-1">Create a class to define crew requirements by aircraft type.</p>
            </div>
          )}

          {!classesLoading && classes && classes.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {classes.map((cls) => (
                <div key={cls.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
                  {/* Class header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{cls.name}</p>
                      {cls.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{cls.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingClass(cls); setClassModalOpen(true) }}
                        className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete "${cls.name}"?`)) deleteClass.mutate(cls.id) }}
                        className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {cls.regulatoryCategory && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs px-2 py-0.5 font-medium">
                        {cls.regulatoryCategory}
                      </span>
                    )}
                    {(cls.minSeats != null || cls.maxSeats != null) && (
                      <span className="inline-flex items-center rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-xs px-2 py-0.5">
                        {cls.minSeats ?? '?'}–{cls.maxSeats ?? '?'} seats
                      </span>
                    )}
                    {(cls.minRangeNm != null || cls.maxRangeNm != null) && (
                      <span className="inline-flex items-center rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-xs px-2 py-0.5">
                        {cls.minRangeNm != null ? `${cls.minRangeNm.toLocaleString()}` : '?'}–{cls.maxRangeNm != null ? `${cls.maxRangeNm.toLocaleString()}` : '?'} nm
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-gray-50 border border-gray-200 text-gray-500 text-xs px-2 py-0.5">
                      {cls._count.aircraft} aircraft
                    </span>
                  </div>

                  {/* Crew requirements */}
                  {cls.crewReqs.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No crew requirements defined</p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Crew Requirements</p>
                      {cls.crewReqs.map((req) => (
                        <div key={req.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700">{ROLE_LABELS[req.role] ?? req.role}</span>
                          <span className="text-gray-500 tabular-nums">
                            {req.minCount} min
                            {req.perPax != null && <span className="text-gray-400"> + 1 per {req.perPax} pax</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AddAircraftModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <AircraftDetailModal aircraftId={selectedId} onClose={() => setSelectedId(null)} />
      <AircraftClassModal
        isOpen={classModalOpen}
        aircraftClass={editingClass}
        onClose={() => { setClassModalOpen(false); setEditingClass(null) }}
      />
    </div>
  )
}
