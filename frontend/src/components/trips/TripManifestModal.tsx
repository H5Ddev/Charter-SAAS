import { useRef } from 'react'
import { PrinterIcon, LockClosedIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { XMarkIcon } from '@heroicons/react/20/solid'
import Button from '@/components/ui/Button'
import { useUpdateTripStatus, type Trip } from '@/api/trips.api'
import { clsx } from 'clsx'

interface Props {
  trip: Trip
  onClose: () => void
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function TripManifestModal({ trip, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const updateStatus = useUpdateTripStatus()

  const passengers = trip.passengers ?? []
  const crewAssignments = (trip as unknown as {
    crewAssignments?: { crewMember: { firstName: string; lastName: string; role: string } }[]
  }).crewAssignments ?? []

  const missingContact = passengers.filter(p => !p.contact.phone && !p.contact.email)
  const canLock = ['CONFIRMED'].includes(trip.status)
  const isLocked = ['BOARDING', 'IN_FLIGHT', 'COMPLETED'].includes(trip.status)

  function handlePrint() {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Manifest — ${trip.reference}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #111; padding: 32px; }
          h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
          h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin: 20px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
          .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 8px; }
          .meta-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; display: block; margin-bottom: 2px; }
          .meta-item span { font-size: 13px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; padding: 6px 8px; border-bottom: 2px solid #e5e7eb; }
          td { padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
          tr:last-child td { border-bottom: none; }
          .badge { display: inline-block; background: #eff6ff; color: #1d4ed8; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 9999px; }
          .warn { background: #fefce8; border: 1px solid #fde047; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #713f12; margin-bottom: 12px; }
          .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 250)
  }

  async function handleLockManifest() {
    await updateStatus.mutateAsync({ id: trip.id, status: 'BOARDING', notes: 'Manifest locked pre-departure' })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-0.5">Final Manifest</p>
            <h2 className="text-lg font-bold text-gray-900 font-mono">{trip.reference}</h2>
          </div>
          <div className="flex items-center gap-2">
            {canLock && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleLockManifest}
                loading={updateStatus.isPending}
              >
                <LockClosedIcon className="h-4 w-4 mr-1.5" />
                Lock Manifest
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={handlePrint}>
              <PrinterIcon className="h-4 w-4 mr-1.5" />
              Print
            </Button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 ml-1">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* Missing contact warning */}
          {missingContact.length > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Missing contact info</p>
                <p className="text-xs mt-0.5">
                  {missingContact.map(p => `${p.contact.firstName} ${p.contact.lastName}`).join(', ')}{' '}
                  {missingContact.length === 1 ? 'has' : 'have'} no phone or email on record. Update their contact before departure.
                </p>
              </div>
            </div>
          )}

          {isLocked && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-800">
              <LockClosedIcon className="h-4 w-4 text-green-600 shrink-0" />
              <span className="font-medium">Manifest locked</span>
              <span className="text-green-600">— status is {trip.status.replace('_', ' ')}</span>
            </div>
          )}

          {/* Printable area */}
          <div ref={printRef}>

            {/* Trip meta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
              {[
                { label: 'Route', value: `${trip.originIcao} → ${trip.destinationIcao}` },
                { label: 'Departure', value: fmt(trip.departureAt) },
                { label: 'Aircraft', value: trip.aircraft ? `${trip.aircraft.tailNumber} · ${trip.aircraft.make} ${trip.aircraft.model}` : '—' },
                { label: 'Status', value: trip.status.replace('_', ' ') },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-900 font-mono">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Crew */}
            {crewAssignments.length > 0 && (
              <section className="mb-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 pb-1.5 border-b border-gray-100">
                  Crew ({crewAssignments.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {crewAssignments.map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                      {a.crewMember.firstName} {a.crewMember.lastName}
                      <span className="text-gray-400">· {a.crewMember.role.replace('_', ' ')}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Passenger manifest */}
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 pb-1.5 border-b border-gray-100">
                Passenger Manifest ({passengers.length})
              </h3>

              {passengers.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-4 text-center">No passengers on manifest</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4 w-8">#</th>
                        <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4">Name</th>
                        <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4">Phone</th>
                        <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4">Email</th>
                        <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pb-2 w-16">Seat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {passengers.map((p, i) => {
                        const missingPhone = !p.contact.phone
                        const missingEmail = !p.contact.email
                        return (
                          <tr key={p.id} className="group">
                            <td className="py-3 pr-4 text-gray-400 text-xs">{i + 1}</td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-semibold shrink-0">
                                  {p.contact.firstName[0]}{p.contact.lastName[0]}
                                </div>
                                <div>
                                  <span className="font-medium text-gray-900">
                                    {p.contact.firstName} {p.contact.lastName}
                                  </span>
                                  {p.isPrimary && (
                                    <span className="ml-1.5 text-[10px] font-semibold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full">
                                      Primary
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              {p.contact.phone ? (
                                <span className="font-mono text-gray-700">{p.contact.phone}</span>
                              ) : (
                                <span className={clsx('text-xs italic', missingPhone && 'text-amber-600 font-medium')}>
                                  {missingPhone ? '⚠ missing' : '—'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              {p.contact.email ? (
                                <span className="text-gray-700">{p.contact.email}</span>
                              ) : (
                                <span className={clsx('text-xs italic', missingEmail && 'text-amber-600 font-medium')}>
                                  {missingEmail ? '⚠ missing' : '—'}
                                </span>
                              )}
                            </td>
                            <td className="py-3">
                              <span className="text-gray-500 font-mono">{p.seatNumber ?? '—'}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Print footer */}
            <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between text-[11px] text-gray-400 print-only">
              <span>AeroComm · Generated {new Date().toLocaleString()}</span>
              <span>{trip.reference}</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
