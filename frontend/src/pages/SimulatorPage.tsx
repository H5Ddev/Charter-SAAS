import { useState } from 'react'
import {
  PlayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  BellIcon,
  BoltIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import { apiClient } from '@/api/client'
import Button from '@/components/ui/Button'

// ── Types matching the backend SimulationReport ──────────────────────────────

interface CapturedNotification {
  timestamp: string
  channel: string
  to: string
  body: string
  subject?: string
}

interface TimelineEntry {
  t: number
  action: string
  details: Record<string, unknown>
}

interface AutomationExecution {
  automationName: string
  status: string
  entityType: string
  createdAt: string
  errorMessage?: string
}

interface SimulationReport {
  scenario: string
  tenantId: string
  duration: number
  timeline: TimelineEntry[]
  notifications: CapturedNotification[]
  automationExecutions: AutomationExecution[]
  errors: Array<{ action: string; message: string; t: number }>
  summary: {
    stepsCompleted: number
    automationsMatched: number
    notificationsCaptured: number
    errorCount: number
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  SMS: 'bg-blue-100 text-blue-700',
  EMAIL: 'bg-purple-100 text-purple-700',
  WHATSAPP: 'bg-green-100 text-green-700',
  SLACK: 'bg-yellow-100 text-yellow-700',
  TEAMS: 'bg-indigo-100 text-indigo-700',
  IN_APP: 'bg-orange-100 text-orange-700',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  SUCCESS: <CheckCircleIcon className="h-4 w-4 text-green-500" />,
  SKIPPED: <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />,
  FAILED: <XCircleIcon className="h-4 w-4 text-red-500" />,
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SimulatorPage() {
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<SimulationReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runSimulation() {
    setRunning(true)
    setReport(null)
    setError(null)

    try {
      const res = await apiClient.post<SimulationReport>('/admin/simulate', {
        scenario: 'trip-lifecycle',
      })
      setReport(res.data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Simulation failed'
      setError(msg)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Automation Simulator</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Run a trip lifecycle simulation to verify automations, templates, and notification routing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {report && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadJson(report, `simulation-${new Date().toISOString().slice(0, 10)}.json`)}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
              Download Report
            </Button>
          )}
          <Button onClick={runSimulation} disabled={running}>
            {running ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Running...
              </>
            ) : (
              <>
                <PlayIcon className="h-4 w-4 mr-1" />
                Run Simulation
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-700">
            <XCircleIcon className="h-5 w-5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!report && !running && !error && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <BoltIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Click "Run Simulation" to start a trip lifecycle test.</p>
          <p className="text-xs text-gray-400 mt-1">
            Creates an ephemeral test tenant, runs all status transitions, captures notifications.
          </p>
        </div>
      )}

      {/* Loading */}
      {running && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Simulation running...</p>
          <p className="text-xs text-gray-400 mt-1">Creating test tenant, cycling trip statuses, capturing notifications.</p>
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Status Changes"
              value={report.summary.stepsCompleted}
              icon={<ClockIcon className="h-5 w-5 text-primary-600" />}
            />
            <SummaryCard
              label="Automations Matched"
              value={report.summary.automationsMatched}
              icon={<BoltIcon className="h-5 w-5 text-primary-600" />}
            />
            <SummaryCard
              label="Notifications Captured"
              value={report.summary.notificationsCaptured}
              icon={<BellIcon className="h-5 w-5 text-primary-600" />}
            />
            <SummaryCard
              label="Errors"
              value={report.summary.errorCount}
              icon={report.summary.errorCount > 0
                ? <XCircleIcon className="h-5 w-5 text-red-500" />
                : <CheckCircleIcon className="h-5 w-5 text-green-500" />
              }
              danger={report.summary.errorCount > 0}
            />
          </div>

          {/* Duration badge */}
          <p className="text-xs text-gray-400">
            Completed in {formatMs(report.duration)} &middot; Tenant {report.tenantId} (cleaned up)
          </p>

          {/* Automation Executions */}
          {report.automationExecutions.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Automation Executions</h2>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2 text-left">Automation</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Error</th>
                      <th className="px-4 py-2 text-left">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.automationExecutions.map((exec, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">{exec.automationName}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1">
                            {STATUS_ICONS[exec.status] ?? null}
                            {exec.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-red-600 truncate max-w-sm">{exec.errorMessage ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">
                          {new Date(exec.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Captured Notifications */}
          {report.notifications.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">
                Captured Notifications ({report.notifications.length})
              </h2>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-2 text-left">Channel</th>
                      <th className="px-4 py-2 text-left">To</th>
                      <th className="px-4 py-2 text-left">Subject</th>
                      <th className="px-4 py-2 text-left">Body</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.notifications.map((n, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${CHANNEL_COLORS[n.channel] ?? 'bg-gray-100 text-gray-600'}`}>
                            {n.channel}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-700">{n.to}</td>
                        <td className="px-4 py-2 text-gray-700 truncate max-w-[200px]">{n.subject ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-500 truncate max-w-[300px]">{n.body}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Errors */}
          {report.errors.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-red-700 mb-2">Errors ({report.errors.length})</h2>
              <div className="space-y-2">
                {report.errors.map((e, i) => (
                  <div key={i} className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-800 font-medium">{e.action}</p>
                    <p className="text-xs text-red-600 mt-0.5">{e.message}</p>
                    <p className="text-[10px] text-red-400 mt-0.5">at +{formatMs(e.t)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Timeline */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Timeline ({report.timeline.length} events)</h2>
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-20">Time</th>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-mono">
                  {report.timeline.map((entry, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-400">+{formatMs(entry.t)}</td>
                      <td className="px-3 py-1.5 text-gray-800 font-medium">{entry.action}</td>
                      <td className="px-3 py-1.5 text-gray-500 truncate max-w-md">
                        {Object.keys(entry.details).length > 0
                          ? JSON.stringify(entry.details)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, danger }: {
  label: string
  value: number
  icon: React.ReactNode
  danger?: boolean
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${danger ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  )
}
