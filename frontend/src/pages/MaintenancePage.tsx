import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { Table, type Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { PlusIcon, XMarkIcon } from '@heroicons/react/20/solid'
import {
  useMaintenance,
  useCreateMaintenance,
  useUpdateMaintenance,
  useDeleteMaintenance,
  type MaintenanceRecord,
  type MaintenanceType,
  type MaintenanceStatus,
} from '@/api/maintenance.api'
import { useAircraftList } from '@/api/aircraft.api'

const TYPE_LABELS: Record<MaintenanceType, string> = {
  SCHEDULED: 'Scheduled',
  UNSCHEDULED: 'Unscheduled',
  INSPECTION: 'Inspection',
  REPAIR: 'Repair',
  AOG: 'AOG',
  AD_COMPLIANCE: 'AD Compliance',
}

const STATUS_VARIANTS: Record<MaintenanceStatus, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  SCHEDULED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  DEFERRED: 'default',
  CANCELLED: 'danger',
}

const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  DEFERRED: 'Deferred',
  CANCELLED: 'Cancelled',
}

type StatusFilter = 'all' | MaintenanceStatus

function formatDate(s: string | null) {
  if (!s) return null
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ---------- Add Modal ----------

interface AddMaintenanceModalProps {
  isOpen: boolean
  onClose: () => void
  editingRecord?: MaintenanceRecord
}

const EMPTY_FORM = {
  aircraftId: '',
  type: 'SCHEDULED' as MaintenanceType,
  title: '',
  description: '',
  status: 'SCHEDULED' as MaintenanceStatus,
  scheduledAt: '',
  completedAt: '',
  vendor: '',
  cost: '',
  airframeHoursAtService: '',
  nextDueHours: '',
  nextDueDate: '',
  notes: '',
}

function AddMaintenanceModal({ isOpen, onClose, editingRecord }: AddMaintenanceModalProps) {
  const createMaintenance = useCreateMaintenance()
  const updateMaintenance = useUpdateMaintenance()
  const { data: aircraftData } = useAircraftList({ pageSize: 100 })

  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    if (editingRecord) {
      setForm({
        aircraftId: editingRecord.aircraftId,
        type: editingRecord.type,
        title: editingRecord.title,
        description: editingRecord.description ?? '',
        status: editingRecord.status,
        scheduledAt: editingRecord.scheduledAt ? editingRecord.scheduledAt.split('T')[0] : '',
        completedAt: editingRecord.completedAt ? editingRecord.completedAt.split('T')[0] : '',
        vendor: editingRecord.vendor ?? '',
        cost: editingRecord.cost != null ? String(editingRecord.cost) : '',
        airframeHoursAtService: editingRecord.airframeHoursAtService != null ? String(editingRecord.airframeHoursAtService) : '',
        nextDueHours: editingRecord.nextDueHours != null ? String(editingRecord.nextDueHours) : '',
        nextDueDate: editingRecord.nextDueDate ? editingRecord.nextDueDate.split('T')[0] : '',
        notes: editingRecord.notes ?? '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setError(null)
  }, [isOpen, editingRecord])

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.aircraftId) { setError('Please select an aircraft.'); return }
    if (!form.title.trim()) { setError('Title is required.'); return }

    const payload = {
      aircraftId: form.aircraftId,
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      scheduledAt: form.scheduledAt || undefined,
      completedAt: form.completedAt || undefined,
      vendor: form.vendor.trim() || undefined,
      cost: form.cost ? Number(form.cost) : undefined,
      airframeHoursAtService: form.airframeHoursAtService ? Number(form.airframeHoursAtService) : undefined,
      nextDueHours: form.nextDueHours ? Number(form.nextDueHours) : undefined,
      nextDueDate: form.nextDueDate || undefined,
      notes: form.notes.trim() || undefined,
    }

    try {
      if (editingRecord) {
        await updateMaintenance.mutateAsync({ id: editingRecord.id, data: payload })
      } else {
        await createMaintenance.mutateAsync(payload)
      }
      onClose()
    } catch {
      setError(editingRecord ? 'Failed to update maintenance record.' : 'Failed to create maintenance record.')
    }
  }

  const isPending = createMaintenance.isPending || updateMaintenance.isPending

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500/75 transition-opacity" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl text-left w-full max-w-lg z-10 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{editingRecord ? 'Edit Maintenance Record' : 'Add Maintenance Record'}</h2>
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <form id="add-maintenance-form" onSubmit={handleSubmit} className="px-6 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

            {/* Aircraft */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aircraft <span className="text-red-500">*</span></label>
              <select
                value={form.aircraftId}
                onChange={(e) => set('aircraftId', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select aircraft…</option>
                {aircraftData?.data.map((a) => (
                  <option key={a.id} value={a.id}>{a.registration} — {a.make} {a.model}</option>
                ))}
              </select>
            </div>

            {/* Type & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => set('type', e.target.value as MaintenanceType)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as MaintenanceStatus)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. 100-hour inspection"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>

            {/* Scheduled / Completed dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                <input
                  type="date"
                  value={form.scheduledAt}
                  onChange={(e) => set('scheduledAt', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Completed Date</label>
                <input
                  type="date"
                  value={form.completedAt}
                  onChange={(e) => set('completedAt', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Vendor & Cost */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor / Shop</label>
                <input
                  type="text"
                  value={form.vendor}
                  onChange={(e) => set('vendor', e.target.value)}
                  placeholder="e.g. Avitech MRO"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => set('cost', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Hours tracking */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Airframe Hrs at Service</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.airframeHoursAtService}
                  onChange={(e) => set('airframeHoursAtService', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Due Hrs</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.nextDueHours}
                  onChange={(e) => set('nextDueHours', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Due Date</label>
                <input
                  type="date"
                  value={form.nextDueDate}
                  onChange={(e) => set('nextDueDate', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
          </form>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
            <Button size="sm" type="submit" form="add-maintenance-form" disabled={isPending}>
              {isPending ? 'Saving…' : editingRecord ? 'Save Changes' : 'Save Record'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Main Page ----------

export default function MaintenancePage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<MaintenanceRecord | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const deleteMaintenance = useDeleteMaintenance()

  const { data, isLoading } = useMaintenance({
    status: statusFilter === 'all' ? undefined : statusFilter,
    page,
    pageSize: 20,
  })

  const columns: Column<MaintenanceRecord>[] = [
    {
      key: 'aircraft',
      header: 'Aircraft',
      render: (r) => (
        <span className="font-mono font-semibold text-gray-900 text-sm">{r.aircraft?.tailNumber ?? '—'}</span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (r) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{r.title}</p>
          {r.vendor && <p className="text-xs text-gray-400">{r.vendor}</p>}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => <span className="text-sm text-gray-700">{TYPE_LABELS[r.type]}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge variant={STATUS_VARIANTS[r.status]} size="sm">{STATUS_LABELS[r.status]}</Badge>
      ),
    },
    {
      key: 'scheduledAt',
      header: 'Scheduled',
      render: (r) => r.scheduledAt
        ? <span className="text-sm text-gray-700 tabular-nums">{formatDate(r.scheduledAt)}</span>
        : <span className="text-gray-400 text-sm">—</span>,
    },
    {
      key: 'nextDue',
      header: 'Next Due',
      render: (r) => {
        const byDate = r.nextDueDate ? formatDate(r.nextDueDate) : null
        const byHours = r.nextDueHours != null ? `${r.nextDueHours.toLocaleString()} hrs` : null
        if (!byDate && !byHours) return <span className="text-gray-400 text-sm">—</span>
        return (
          <div className="text-sm text-gray-700">
            {byDate && <div>{byDate}</div>}
            {byHours && <div className="text-xs text-gray-400">{byHours}</div>}
          </div>
        )
      },
    },
    {
      key: 'cost',
      header: 'Cost',
      render: (r) => r.cost != null
        ? <span className="text-sm text-gray-700 tabular-nums">${Number(r.cost).toLocaleString()}</span>
        : <span className="text-gray-400 text-sm">—</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); setDeleteId(r.id) }}
          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
        >
          Delete
        </button>
      ),
    },
  ]

  const filterOptions: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Scheduled', value: 'SCHEDULED' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Deferred', value: 'DEFERRED' },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.meta.total ?? 0} records</p>
        </div>
        <Button size="md" onClick={() => setAddOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-1.5" />
          Add Record
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterOptions.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1) }}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              statusFilter === f.value
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
        keyExtractor={(r) => r.id}
        loading={isLoading}
        emptyMessage="No maintenance records found. Add your first record to get started."
        pagination={data?.meta}
        onPageChange={setPage}
        onRowClick={(r) => setEditTarget(r)}
        renderMobileCard={(r) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-900 text-sm">{r.aircraft?.tailNumber ?? '—'}</span>
                  <span className="text-xs text-gray-500">{TYPE_LABELS[r.type]}</span>
                </div>
                <p className="text-sm text-gray-700 font-medium mt-0.5 truncate">{r.title}</p>
                {r.vendor && <p className="text-xs text-gray-400">{r.vendor}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant={STATUS_VARIANTS[r.status]} size="sm">{STATUS_LABELS[r.status]}</Badge>
                {r.cost != null && (
                  <span className="text-xs text-gray-600 tabular-nums">${Number(r.cost).toLocaleString()}</span>
                )}
              </div>
            </div>
            {r.scheduledAt && (
              <p className="text-xs text-gray-400 mt-1">{formatDate(r.scheduledAt)}</p>
            )}
          </div>
        )}
      />

      <AddMaintenanceModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <AddMaintenanceModal isOpen={!!editTarget} onClose={() => setEditTarget(null)} editingRecord={editTarget ?? undefined} />

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-gray-500/75" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 z-10">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Record</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this maintenance record? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteMaintenance.isPending}
                onClick={async () => {
                  await deleteMaintenance.mutateAsync(deleteId)
                  setDeleteId(null)
                }}
              >
                {deleteMaintenance.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
