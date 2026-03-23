import { useState } from 'react'
import { clsx } from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { Table, type Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { PlusIcon } from '@heroicons/react/20/solid'
import { AddAircraftModal } from '@/components/aircraft/AddAircraftModal'
import { normalizeAircraft, type Aircraft } from '@/api/aircraft.api'

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

export default function AircraftPage() {
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [addOpen, setAddOpen] = useState(false)

  const { data, isLoading } = useAircraft({
    page,
    pageSize: 20,
    isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
  })

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
          {a.isActive ? 'Active' : 'Inactive'}
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
          <p className="text-sm text-gray-500 mt-0.5">{data?.meta.total ?? 0} in fleet</p>
        </div>
        <Button size="md" onClick={() => setAddOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-1.5" />
          Add Aircraft
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2">
        {(['all', 'active', 'inactive'] as ActiveFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => { setActiveFilter(f); setPage(1) }}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize',
              activeFilter === f
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
            )}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
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
      />

      <AddAircraftModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </div>
  )
}
