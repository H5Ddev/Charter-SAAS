import { useState, useCallback, useEffect } from 'react'
import { clsx } from 'clsx'
import { Table, type Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import {
  useCrew, useCreateCrewMember, useUpdateCrewMember, useDeleteCrewMember,
  type CrewMember, type CrewRole, type MedicalClass, type CreateCrewMemberInput,
} from '@/api/crew.api'
import { PlusIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

const ROLES: { value: CrewRole; label: string }[] = [
  { value: 'CAPTAIN', label: 'Captain' },
  { value: 'FIRST_OFFICER', label: 'First Officer' },
  { value: 'FLIGHT_ATTENDANT', label: 'Flight Attendant' },
  { value: 'DISPATCHER', label: 'Dispatcher' },
  { value: 'MECHANIC', label: 'Mechanic' },
  { value: 'OTHER', label: 'Other' },
]

const ROLE_BADGE: Record<CrewRole, string> = {
  CAPTAIN: 'bg-primary-100 text-primary-800',
  FIRST_OFFICER: 'bg-blue-100 text-blue-800',
  FLIGHT_ATTENDANT: 'bg-purple-100 text-purple-800',
  DISPATCHER: 'bg-amber-100 text-amber-800',
  MECHANIC: 'bg-orange-100 text-orange-800',
  OTHER: 'bg-gray-100 text-gray-700',
}

const LICENSE_TYPES = ['ATP', 'CPL', 'PPL', 'A&P', 'IA', 'AME', 'Other']
const MEDICAL_CLASSES: { value: MedicalClass; label: string }[] = [
  { value: 'CLASS_1', label: 'Class 1' },
  { value: 'CLASS_2', label: 'Class 2' },
  { value: 'CLASS_3', label: 'Class 3' },
]

// Which field sections are relevant per role
const ROLE_FIELDS: Record<CrewRole, { license: boolean; medical: boolean; typeRatings: boolean }> = {
  CAPTAIN:          { license: true,  medical: true,  typeRatings: true  },
  FIRST_OFFICER:    { license: true,  medical: true,  typeRatings: true  },
  FLIGHT_ATTENDANT: { license: false, medical: true,  typeRatings: false },
  MECHANIC:         { license: true,  medical: false, typeRatings: false },
  DISPATCHER:       { license: false, medical: false, typeRatings: false },
  OTHER:            { license: false, medical: false, typeRatings: false },
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function ExpiryCell({ date, label }: { date: string | null; label: string }) {
  if (!date) return <span className="text-gray-400 text-sm">—</span>
  const days = daysUntil(date)
  const expired = days !== null && days < 0
  const soon = days !== null && days >= 0 && days <= 60
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={clsx(
        'text-sm font-medium',
        expired ? 'text-red-600' : soon ? 'text-amber-600' : 'text-gray-700',
      )}>
        {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        {expired && ' (expired)'}
        {!expired && soon && ` (${days}d)`}
      </p>
    </div>
  )
}

function DuplicateWarning({ label, name, confirmed, onConfirm }: {
  label: string; name: string; confirmed: boolean; onConfirm: (v: boolean) => void
}) {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-300 px-3 py-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">
          This {label} is already in use by <span className="font-semibold">{name}</span>.
        </p>
      </div>
      <label className="flex items-center gap-2 cursor-pointer pl-6">
        <input type="checkbox" checked={confirmed} onChange={(e) => onConfirm(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500" />
        <span className="text-xs text-amber-700">I understand and want to proceed anyway</span>
      </label>
    </div>
  )
}

function AddCrewModal({ isOpen, onClose, editingMember }: { isOpen: boolean; onClose: () => void; editingMember?: CrewMember }) {
  const [form, setForm] = useState<Partial<CreateCrewMemberInput>>({ role: 'CAPTAIN', isActive: true })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [typeRatingInput, setTypeRatingInput] = useState('')
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const createCrew = useCreateCrewMember()
  const updateCrew = useUpdateCrewMember()

  useEffect(() => {
    if (!isOpen) return
    if (editingMember) {
      setForm({
        firstName: editingMember.firstName,
        lastName: editingMember.lastName,
        email: editingMember.email ?? undefined,
        phone: editingMember.phone ?? undefined,
        role: editingMember.role,
        licenseNumber: editingMember.licenseNumber ?? undefined,
        licenseType: editingMember.licenseType ?? undefined,
        licenseExpiry: editingMember.licenseExpiry ?? undefined,
        medicalClass: editingMember.medicalClass ?? undefined,
        medicalExpiry: editingMember.medicalExpiry ?? undefined,
        isActive: editingMember.isActive,
        notes: editingMember.notes ?? undefined,
      })
      if (editingMember.typeRatings) {
        try {
          const parsed = JSON.parse(editingMember.typeRatings)
          setTypeRatingInput(Array.isArray(parsed) ? parsed.join(', ') : '')
        } catch { setTypeRatingInput('') }
      } else {
        setTypeRatingInput('')
      }
    } else {
      setForm({ role: 'CAPTAIN', isActive: true })
      setTypeRatingInput('')
    }
    setErrors({})
    setConfirmed({})
  }, [isOpen, editingMember])

  // Fetch all crew for duplicate detection
  const { data: allCrewData } = useCrew({ pageSize: 500 })
  const allCrew = allCrewData?.data ?? []

  const role = (form.role ?? 'CAPTAIN') as CrewRole
  const fields = ROLE_FIELDS[role]

  function set<K extends keyof CreateCrewMemberInput>(key: K, value: CreateCrewMemberInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
    setConfirmed((c) => ({ ...c, [key]: false }))
  }

  function handleRoleChange(newRole: CrewRole) {
    const newFields = ROLE_FIELDS[newRole]
    setForm((f) => ({
      ...f,
      role: newRole,
      // Clear fields not relevant to the new role
      licenseNumber: newFields.license ? f.licenseNumber : undefined,
      licenseType: newFields.license ? f.licenseType : undefined,
      licenseExpiry: newFields.license ? f.licenseExpiry : undefined,
      medicalClass: newFields.medical ? f.medicalClass : undefined,
      medicalExpiry: newFields.medical ? f.medicalExpiry : undefined,
    }))
    if (!newFields.typeRatings) setTypeRatingInput('')
    setConfirmed({})
  }

  // Duplicate checks (exclude the member being edited)
  function findDuplicate(field: 'email' | 'phone' | 'licenseNumber', value: string | undefined) {
    if (!value?.trim()) return null
    return allCrew.find((m) => {
      if (editingMember && m.id === editingMember.id) return false
      const mv = m[field]
      return mv && mv.toLowerCase() === value.trim().toLowerCase()
    }) ?? null
  }

  const emailDup = findDuplicate('email', form.email)
  const phoneDup = findDuplicate('phone', form.phone)
  const licenseDup = fields.license ? findDuplicate('licenseNumber', form.licenseNumber) : null

  const hasPendingConflicts =
    (emailDup && !confirmed.email) ||
    (phoneDup && !confirmed.phone) ||
    (licenseDup && !confirmed.licenseNumber)

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.firstName?.trim()) errs.firstName = 'Required'
    if (!form.lastName?.trim()) errs.lastName = 'Required'
    if (!form.role) errs.role = 'Required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleClose = useCallback(() => {
    setForm({ role: 'CAPTAIN', isActive: true })
    setErrors({})
    setTypeRatingInput('')
    setConfirmed({})
    onClose()
  }, [onClose])

  async function handleSubmit() {
    if (!validate() || hasPendingConflicts) return
    const typeRatings = typeRatingInput.trim()
      ? typeRatingInput.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined
    if (editingMember) {
      await updateCrew.mutateAsync({ id: editingMember.id, data: { ...form as CreateCrewMemberInput, typeRatings } })
    } else {
      await createCrew.mutateAsync({ ...form as CreateCrewMemberInput, typeRatings })
    }
    handleClose()
  }

  const inputCls = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  const isPending = createCrew.isPending || updateCrew.isPending

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={editingMember ? 'Edit Crew Member' : 'Add Crew Member'} size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isPending}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={isPending}
            disabled={!!hasPendingConflicts}>
            {editingMember ? 'Save Changes' : 'Add Member'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Name + Role */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
            <input value={form.firstName ?? ''} onChange={(e) => set('firstName', e.target.value)}
              className={clsx('w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500', errors.firstName ? 'border-red-400' : 'border-gray-300')} />
            {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
            <input value={form.lastName ?? ''} onChange={(e) => set('lastName', e.target.value)}
              className={clsx('w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500', errors.lastName ? 'border-red-400' : 'border-gray-300')} />
            {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
            <select value={form.role ?? ''} onChange={(e) => handleRoleChange(e.target.value as CrewRole)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} className={inputCls} />
            {emailDup && (
              <div className="mt-1.5">
                <DuplicateWarning label="email" name={`${emailDup.firstName} ${emailDup.lastName}`}
                  confirmed={!!confirmed.email} onConfirm={(v) => setConfirmed((c) => ({ ...c, email: v }))} />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
            {phoneDup && (
              <div className="mt-1.5">
                <DuplicateWarning label="phone number" name={`${phoneDup.firstName} ${phoneDup.lastName}`}
                  confirmed={!!confirmed.phone} onConfirm={(v) => setConfirmed((c) => ({ ...c, phone: v }))} />
              </div>
            )}
          </div>
        </div>

        {/* License — pilots and mechanics only */}
        {fields.license && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
              <input value={form.licenseNumber ?? ''} onChange={(e) => set('licenseNumber', e.target.value)} className={inputCls} />
              {licenseDup && (
                <div className="mt-1.5">
                  <DuplicateWarning label="license number" name={`${licenseDup.firstName} ${licenseDup.lastName}`}
                    confirmed={!!confirmed.licenseNumber} onConfirm={(v) => setConfirmed((c) => ({ ...c, licenseNumber: v }))} />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Type</label>
              <input list="license-types" value={form.licenseType ?? ''} onChange={(e) => set('licenseType', e.target.value)}
                placeholder="ATP, CPL…" className={inputCls} />
              <datalist id="license-types">{LICENSE_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry</label>
              <input type="date" value={form.licenseExpiry ? form.licenseExpiry.split('T')[0] : ''}
                onChange={(e) => set('licenseExpiry', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                className={inputCls} />
            </div>
          </div>
        )}

        {/* Medical — pilots and flight attendants only */}
        {fields.medical && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical Class</label>
              <select value={form.medicalClass ?? ''} onChange={(e) => set('medicalClass', (e.target.value || undefined) as MedicalClass | undefined)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">— None —</option>
                {MEDICAL_CLASSES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical Expiry</label>
              <input type="date" value={form.medicalExpiry ? form.medicalExpiry.split('T')[0] : ''}
                onChange={(e) => set('medicalExpiry', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                className={inputCls} />
            </div>
          </div>
        )}

        {/* Type ratings — pilots only */}
        {fields.typeRatings && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type Ratings
              <span className="ml-1.5 text-xs text-gray-400 font-normal">(comma-separated, e.g. G650, B737)</span>
            </label>
            <input value={typeRatingInput} onChange={(e) => setTypeRatingInput(e.target.value)}
              placeholder="G650, CL-604…" className={inputCls} />
          </div>
        )}

        {/* Notes + active */}
        <div className="grid grid-cols-3 gap-3 items-start">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div className="pt-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button type="button" role="switch" aria-checked={form.isActive}
                onClick={() => set('isActive', !form.isActive)}
                className={clsx('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', form.isActive ? 'bg-primary-600' : 'bg-gray-300')}>
                <span className={clsx('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform', form.isActive ? 'translate-x-4' : 'translate-x-0.5')} />
              </button>
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>
        </div>

        {createCrew.isError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">Failed to add crew member.</p>
        )}
      </div>
    </Modal>
  )
}

export default function CrewPage() {
  const [page, setPage] = useState(1)
  const [roleFilter, setRoleFilter] = useState<CrewRole | ''>('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CrewMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CrewMember | null>(null)

  const { data, isLoading } = useCrew({ role: roleFilter || undefined, page, pageSize: 20 })
  const deleteCrew = useDeleteCrewMember()

  const crew = data?.data ?? []

  const columns: Column<CrewMember>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (m) => (
        <div>
          <p className="font-semibold text-gray-900 text-sm">{m.firstName} {m.lastName}</p>
          {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (m) => (
        <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', ROLE_BADGE[m.role])}>
          {ROLES.find((r) => r.value === m.role)?.label ?? m.role}
        </span>
      ),
    },
    {
      key: 'license',
      header: 'License',
      render: (m) => m.licenseNumber ? (
        <div>
          <p className="text-sm font-mono text-gray-900">{m.licenseNumber}</p>
          {m.licenseType && <p className="text-xs text-gray-400">{m.licenseType}</p>}
        </div>
      ) : <span className="text-gray-400 text-sm">—</span>,
    },
    {
      key: 'medical',
      header: 'Medical',
      render: (m) => <ExpiryCell date={m.medicalExpiry} label={m.medicalClass?.replace('_', ' ') ?? 'Medical'} />,
    },
    {
      key: 'licenseExpiry',
      header: 'License Expiry',
      render: (m) => <ExpiryCell date={m.licenseExpiry} label="License" />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (m) => {
        const expiring = [m.medicalExpiry, m.licenseExpiry].some((d) => {
          const days = daysUntil(d)
          return days !== null && days <= 60
        })
        return (
          <div className="flex items-center gap-2">
            <Badge variant={m.isActive ? 'success' : 'default'} size="sm">
              {m.isActive ? 'Active' : 'Inactive'}
            </Badge>
            {expiring && (
              <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" title="Expiring soon" />
            )}
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      render: (m) => (
        <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTarget(m) }}
          className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors">
          <TrashIcon className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Crew</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.meta?.total ?? 0} members</p>
        </div>
        <Button size="md" onClick={() => setAddOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-1.5" />
          Add Crew Member
        </Button>
      </div>

      {/* Role filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => { setRoleFilter(''); setPage(1) }}
          className={clsx('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
            !roleFilter ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400')}>
          All
        </button>
        {ROLES.map((r) => (
          <button key={r.value} onClick={() => { setRoleFilter(r.value); setPage(1) }}
            className={clsx('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              roleFilter === r.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400')}>
            {r.label}
          </button>
        ))}
      </div>

      <Table
        columns={columns}
        data={crew}
        keyExtractor={(m) => m.id}
        loading={isLoading}
        emptyMessage="No crew members yet. Add your first crew member to get started."
        pagination={data?.meta}
        onPageChange={setPage}
        rowClassName={(m) => {
          const expiring = [m.medicalExpiry, m.licenseExpiry].some((d) => {
            const days = daysUntil(d)
            return days !== null && days < 0
          })
          return expiring ? 'bg-red-50/40' : ''
        }}
        onRowClick={(m) => setEditTarget(m)}
        renderMobileCard={(m) => {
          const expiring = [m.medicalExpiry, m.licenseExpiry].some((d) => {
            const days = daysUntil(d)
            return days !== null && days <= 60
          })
          return (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 text-sm">{m.firstName} {m.lastName}</p>
                  {expiring && <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 shrink-0" />}
                </div>
                {m.email && <p className="text-xs text-gray-400 truncate">{m.email}</p>}
                {m.licenseNumber && (
                  <p className="text-xs text-gray-500 font-mono">
                    {m.licenseNumber}{m.licenseType ? ` (${m.licenseType})` : ''}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', ROLE_BADGE[m.role])}>
                  {ROLES.find((r) => r.value === m.role)?.label ?? m.role}
                </span>
                <Badge variant={m.isActive ? 'success' : 'default'} size="sm">
                  {m.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          )
        }}
      />

      <AddCrewModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <AddCrewModal isOpen={!!editTarget} onClose={() => setEditTarget(null)} editingMember={editTarget ?? undefined} />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Crew Member" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteCrew.isPending}
              onClick={async () => {
                if (!deleteTarget) return
                await deleteCrew.mutateAsync(deleteTarget.id)
                setDeleteTarget(null)
              }}>
              Remove
            </Button>
          </>
        }>
        <p className="text-sm text-gray-700">
          Remove <span className="font-semibold">{deleteTarget?.firstName} {deleteTarget?.lastName}</span> from the crew roster?
        </p>
      </Modal>
    </div>
  )
}
