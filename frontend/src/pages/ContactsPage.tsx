import { useState } from 'react'
import { clsx } from 'clsx'
import { useContacts, useDeleteContact, type Contact } from '@/api/contacts.api'
import { Table, type Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateContact, useUpdateContact } from '@/api/contacts.api'
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline'

// ── Avatar helpers ───────────────────────────────────────────────────────────

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-teal-500',
]

function avatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

// ── Form schema ──────────────────────────────────────────────────────────────

const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  whatsappPhone: z.string().optional(),
  type: z.enum(['OWNER', 'PASSENGER', 'BOTH']),
  preferredChannel: z.string().min(1, 'Preferred channel is required'),
})

type ContactForm = z.infer<typeof contactSchema>

const TYPE_BADGE: Record<string, 'primary' | 'success' | 'purple'> = {
  OWNER: 'primary',
  PASSENGER: 'success',
  BOTH: 'purple',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Contact | null>(null)

  const { data, isLoading } = useContacts({
    page,
    pageSize: 20,
    search: search || undefined,
    type: typeFilter || undefined,
  })

  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { type: 'PASSENGER', preferredChannel: 'SMS' },
  })

  function openCreate() {
    setEditing(null)
    reset({ type: 'PASSENGER', preferredChannel: 'SMS' })
    setModalOpen(true)
  }

  function openEdit(contact: Contact) {
    setEditing(contact)
    reset({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      whatsappPhone: contact.whatsappPhone ?? '',
      type: contact.type,
      preferredChannel: contact.preferredChannel,
    })
    setModalOpen(true)
  }

  async function onSubmit(values: ContactForm) {
    const payload = {
      ...values,
      email: values.email || null,
      phone: values.phone || null,
      whatsappPhone: values.whatsappPhone || null,
    }
    if (editing) {
      await updateContact.mutateAsync({ id: editing.id, data: payload })
    } else {
      await createContact.mutateAsync(payload)
    }
    setModalOpen(false)
    reset()
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    await deleteContact.mutateAsync(deleteConfirm.id)
    setDeleteConfirm(null)
  }

  const columns: Column<Contact>[] = [
    {
      key: 'name',
      header: 'Contact',
      render: (c) => (
        <div className="flex items-center gap-3">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(c.firstName)}`}
          >
            {initials(c.firstName, c.lastName)}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">
              {c.firstName} {c.lastName}
            </p>
            {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (c) => (
        <Badge variant={TYPE_BADGE[c.type] ?? 'default'}>
          {c.type.charAt(0) + c.type.slice(1).toLowerCase()}
        </Badge>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (c) => c.phone ?? <span className="text-gray-400">—</span>,
    },
    {
      key: 'channel',
      header: 'Preferred Channel',
      render: (c) => (
        <Badge variant="info" size="sm">
          {c.preferredChannel}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (c) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              openEdit(c)
            }}
            className="rounded p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
            aria-label="Edit contact"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDeleteConfirm(c)
            }}
            className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            aria-label="Delete contact"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.meta.total ?? 0} total</p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="h-4 w-4 mr-1.5" />
          Add Contact
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative max-w-xs flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="form-input pl-9"
          />
        </div>

        {/* Type toggle pills */}
        <div className="flex items-center gap-2">
          {(['', 'OWNER', 'PASSENGER', 'BOTH'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTypeFilter(t)
                setPage(1)
              }}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                typeFilter === t
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
              )}
            >
              {t === '' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <Table
        columns={columns}
        data={data?.data ?? []}
        keyExtractor={(c) => c.id}
        loading={isLoading}
        emptyMessage="No contacts found. Add your first contact to get started."
        pagination={data?.meta}
        onPageChange={setPage}
        onRowClick={(c) => openEdit(c)}
        renderMobileCard={(c) => (
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${avatarColor(c.firstName)}`}
            >
              {initials(c.firstName, c.lastName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm">{c.firstName} {c.lastName}</p>
              {c.email && <p className="text-xs text-gray-500 truncate">{c.email}</p>}
              {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant={TYPE_BADGE[c.type] ?? 'default'} size="sm">
                {c.type.charAt(0) + c.type.slice(1).toLowerCase()}
              </Badge>
              <Badge variant="info" size="sm">{c.preferredChannel}</Badge>
            </div>
          </div>
        )}
      />

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Contact' : 'Add Contact'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
              {editing ? 'Save Changes' : 'Create Contact'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              required
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <Input
              label="Last Name"
              required
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>
          <Input
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" type="tel" {...register('phone')} />
            <Input label="WhatsApp Phone" type="tel" {...register('whatsappPhone')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              required
              error={errors.type?.message}
              options={[
                { value: 'OWNER', label: 'Owner' },
                { value: 'PASSENGER', label: 'Passenger' },
                { value: 'BOTH', label: 'Both' },
              ]}
              {...register('type')}
            />
            <Select
              label="Preferred Channel"
              required
              error={errors.preferredChannel?.message}
              options={[
                { value: 'SMS', label: 'SMS' },
                { value: 'EMAIL', label: 'Email' },
                { value: 'WHATSAPP', label: 'WhatsApp' },
                { value: 'IN_APP', label: 'In-App' },
              ]}
              {...register('preferredChannel')}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Contact"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteContact.isPending}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete{' '}
          <span className="font-semibold">
            {deleteConfirm?.firstName} {deleteConfirm?.lastName}
          </span>
          ? This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
