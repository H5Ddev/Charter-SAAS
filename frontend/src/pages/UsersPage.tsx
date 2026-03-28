import { useState } from 'react'
import { clsx } from 'clsx'
import { Table, type Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { PlusIcon, XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/20/solid'
import { useUsers, useCreateUser, useUpdateUser, useDeactivateUser, type AppUser, type UserRole } from '@/api/users.api'
import { useAuthStore } from '@/store/auth.store'

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  AGENT: 'Agent',
  READ_ONLY: 'Read Only',
}

const ROLE_VARIANTS: Record<UserRole, 'danger' | 'warning' | 'info' | 'default'> = {
  ADMIN: 'danger',
  MANAGER: 'warning',
  AGENT: 'info',
  READ_ONLY: 'default',
}

function formatLastLogin(s: string | null) {
  if (!s) return 'Never'
  const d = new Date(s)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function initials(u: AppUser) {
  return `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase()
}

// ---------- Add User Modal ----------

function AddUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const createUser = useCreateUser()
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'AGENT' as UserRole,
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('First and last name are required.'); return }
    if (!form.email.trim()) { setError('Email is required.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }

    try {
      await createUser.mutateAsync({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        password: form.password,
      })
      onClose()
      setForm({ firstName: '', lastName: '', email: '', role: 'AGENT', password: '', confirmPassword: '' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setError(msg ?? 'Failed to create user.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500/75" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl text-left w-full max-w-md z-10 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Add User</h2>
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  autoComplete="given-name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  autoComplete="family-name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['ADMIN', 'MANAGER', 'AGENT', 'READ_ONLY'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set('role', r)}
                    className={clsx(
                      'py-1.5 text-xs font-medium rounded-lg border transition-colors',
                      form.role === r
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
                    )}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password <span className="text-red-500">*</span></label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => set('confirmPassword', e.target.value)}
                autoComplete="new-password"
                className={clsx(
                  'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
                  form.confirmPassword && form.password !== form.confirmPassword
                    ? 'border-red-400'
                    : 'border-gray-300',
                )}
              />
            </div>
          </form>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={createUser.isPending}>
              {createUser.isPending ? 'Creating…' : 'Create User'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Edit Role Modal ----------

function EditRoleModal({
  user,
  onClose,
}: {
  user: AppUser
  onClose: () => void
}) {
  const updateUser = useUpdateUser()
  const [role, setRole] = useState<UserRole>(user.role)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    try {
      await updateUser.mutateAsync({ id: user.id, data: { role } })
      onClose()
    } catch {
      setError('Failed to update role.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-gray-500/75" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 z-10">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Change Role</h3>
        <p className="text-sm text-gray-500 mb-4">{user.firstName} {user.lastName}</p>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2 mb-3">{error}</p>}

        <div className="grid grid-cols-2 gap-2 mb-5">
          {(['ADMIN', 'MANAGER', 'AGENT', 'READ_ONLY'] as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={clsx(
                'py-2 text-sm font-medium rounded-lg border transition-colors',
                role === r
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
              )}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={updateUser.isPending}>
            {updateUser.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------- Main Page ----------

export default function UsersPage() {
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<AppUser | null>(null)

  const currentUser = useAuthStore((s) => s.user)
  const deactivateUser = useDeactivateUser()
  const updateUser = useUpdateUser()

  const { data, isLoading } = useUsers({ page, pageSize: 50 })

  const columns: Column<AppUser>[] = [
    {
      key: 'name',
      header: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary-700">{initials(u)}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</p>
            <p className="text-xs text-gray-400">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => <Badge variant={ROLE_VARIANTS[u.role]} size="sm">{ROLE_LABELS[u.role]}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <Badge variant={u.isActive ? 'success' : 'default'} size="sm">
          {u.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      render: (u) => <span className="text-sm text-gray-600">{formatLastLogin(u.lastLoginAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (u) => {
        const isSelf = u.id === currentUser?.id
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditUser(u)}
              className="text-xs text-primary-600 hover:text-primary-800 px-2 py-1 rounded hover:bg-primary-50 transition-colors"
            >
              Role
            </button>
            {u.isActive ? (
              <button
                disabled={isSelf}
                onClick={() => setDeactivateTarget(u)}
                className={clsx(
                  'text-xs px-2 py-1 rounded transition-colors',
                  isSelf
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-red-500 hover:text-red-700 hover:bg-red-50',
                )}
              >
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => updateUser.mutate({ id: u.id, data: { isActive: true } })}
                className="text-xs text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 transition-colors"
              >
                Reactivate
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.meta.total ?? 0} team members</p>
        </div>
        <Button size="md" onClick={() => setAddOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-1.5" />
          Add User
        </Button>
      </div>

      <Table
        columns={columns}
        data={data?.data ?? []}
        keyExtractor={(u) => u.id}
        loading={isLoading}
        emptyMessage="No users found."
        pagination={data?.meta}
        onPageChange={setPage}
        onRowClick={(u) => setEditUser(u)}
        renderMobileCard={(u) => (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-primary-700">{initials(u)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</p>
              <p className="text-xs text-gray-400 truncate">{u.email}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant={ROLE_VARIANTS[u.role]} size="sm">{ROLE_LABELS[u.role]}</Badge>
              <Badge variant={u.isActive ? 'success' : 'default'} size="sm">
                {u.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        )}
      />

      <AddUserModal isOpen={addOpen} onClose={() => setAddOpen(false)} />

      {editUser && (
        <EditRoleModal user={editUser} onClose={() => setEditUser(null)} />
      )}

      {/* Deactivate confirmation */}
      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-gray-500/75" onClick={() => setDeactivateTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 z-10">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Deactivate User</h3>
            <p className="text-sm text-gray-600 mb-6">
              Deactivate <span className="font-medium">{deactivateTarget.firstName} {deactivateTarget.lastName}</span>? They will lose access immediately.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700"
                disabled={deactivateUser.isPending}
                onClick={async () => {
                  await deactivateUser.mutateAsync(deactivateTarget.id)
                  setDeactivateTarget(null)
                }}
              >
                {deactivateUser.isPending ? 'Deactivating…' : 'Deactivate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
