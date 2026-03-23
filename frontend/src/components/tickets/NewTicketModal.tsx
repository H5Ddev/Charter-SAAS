import { useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { Modal } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useContacts } from '@/api/contacts.api'
import { useCreateTicket, type CreateTicketInput } from '@/api/tickets.api'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

type Priority = CreateTicketInput['priority']

const PRIORITIES: { value: Priority; label: string; className: string }[] = [
  { value: 'LOW', label: 'Low', className: 'bg-gray-100 text-gray-600 border-gray-300' },
  { value: 'NORMAL', label: 'Normal', className: 'bg-blue-50 text-blue-700 border-blue-300' },
  { value: 'HIGH', label: 'High', className: 'bg-amber-50 text-amber-700 border-amber-300' },
  { value: 'URGENT', label: 'Urgent', className: 'bg-red-50 text-red-700 border-red-300' },
]

const SOURCES = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'SMS', label: 'SMS' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'WEB', label: 'Web' },
]

export function NewTicketModal({ isOpen, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<Priority>('NORMAL')
  const [source, setSource] = useState('MANUAL')
  const [contactSearch, setContactSearch] = useState('')
  const [contactId, setContactId] = useState('')
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: contactsData } = useContacts({
    search: contactSearch || undefined,
    pageSize: 10,
  })
  const contacts = contactsData?.data ?? []

  const createTicket = useCreateTicket()

  function selectContact(id: string, name: string) {
    setContactId(id)
    setContactSearch(name)
    setShowContactDropdown(false)
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Subject is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    const result = await createTicket.mutateAsync({
      title: title.trim(),
      body: body.trim() || undefined,
      priority,
      source,
      contactId: contactId || undefined,
    })

    onCreated?.(result.id)
    handleClose()
  }

  const handleClose = useCallback(() => {
    setTitle('')
    setBody('')
    setPriority('NORMAL')
    setSource('MANUAL')
    setContactSearch('')
    setContactId('')
    setShowContactDropdown(false)
    setErrors({})
    onClose()
  }, [onClose])

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Ticket"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={createTicket.isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={createTicket.isPending}>
            Create Ticket
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Brief description of the issue…"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setErrors((err) => ({ ...err, title: '' }))
            }}
            className={clsx(
              'w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
              errors.title ? 'border-red-400' : 'border-gray-300',
            )}
          />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={4}
            placeholder="Provide additional details…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={clsx(
                  'flex-1 py-1.5 rounded-md border text-xs font-semibold transition-all',
                  priority === p.value
                    ? p.className + ' ring-2 ring-offset-1 ring-current'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contact + Source row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Contact */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
            <input
              type="text"
              placeholder="Search contacts…"
              value={contactSearch}
              onChange={(e) => {
                setContactSearch(e.target.value)
                setContactId('')
                setShowContactDropdown(true)
              }}
              onFocus={() => setShowContactDropdown(true)}
              onBlur={() => setTimeout(() => setShowContactDropdown(false), 150)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {showContactDropdown && contacts.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white rounded-md border border-gray-200 shadow-lg max-h-40 overflow-y-auto">
                {contacts.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseDown={() => selectContact(c.id, `${c.firstName} ${c.lastName}`)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors"
                    >
                      <span className="font-medium text-gray-900">
                        {c.firstName} {c.lastName}
                      </span>
                      {c.email && (
                        <span className="ml-2 text-gray-400 text-xs">{c.email}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showContactDropdown && contactSearch && contacts.length === 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-md border border-gray-200 shadow-lg px-3 py-2 text-sm text-gray-400">
                No contacts found
              </div>
            )}
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {createTicket.isError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            Failed to create ticket. Please try again.
          </p>
        )}
      </div>
    </Modal>
  )
}
