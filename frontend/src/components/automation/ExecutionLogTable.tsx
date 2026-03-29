import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import type { ExecutionLog } from '@/api/automations.api';

interface ExecutionLogTableProps {
  automationId?: string;
}

type StatusFilter = 'ALL' | 'SUCCESS' | 'FAILED' | 'RUNNING' | 'SKIPPED';

const STATUS_BADGE: Record<string, BadgeVariant> = {
  SUCCESS: 'success',
  FAILED: 'danger',
  RUNNING: 'warning',
  SKIPPED: 'default',
  PENDING: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: 'Success',
  FAILED: 'Failed',
  RUNNING: 'Running',
  SKIPPED: 'Skipped',
  PENDING: 'Pending',
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function calcDurationMs(log: ExecutionLog): string {
  if (!log.duration) return '—';
  return `${log.duration.toLocaleString()} ms`;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

function useExecutionLogsPaged(automationId: string | undefined, page: number, status: StatusFilter) {
  return useQuery({
    queryKey: ['execution-logs', automationId, page, status],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, pageSize: 20 };
      if (status !== 'ALL') params.status = status;
      const url = automationId
        ? `/automations/${automationId}/logs`
        : '/automations/logs';
      const response = await apiClient.get<PaginatedResponse<ExecutionLog>>(url, { params });
      return response.data;
    },
    refetchInterval: 30_000,
  });
}

function TruncatedCell({ text }: { text: string | null }) {
  if (!text) return <span className="text-gray-300">—</span>;
  return (
    <span title={text} className="block max-w-[200px] truncate text-sm text-gray-600 cursor-help">
      {text}
    </span>
  );
}

export function ExecutionLogTable({ automationId }: ExecutionLogTableProps) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const { data, isLoading, isFetching } = useExecutionLogsPaged(automationId, page, statusFilter);

  const logs = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600">Status:</label>
        <select
          value={statusFilter}
          onChange={e => {
            setStatusFilter(e.target.value as StatusFilter);
            setPage(1);
          }}
          className="form-input text-sm w-40"
        >
          <option value="ALL">All</option>
          <option value="COMPLETED">Success</option>
          <option value="FAILED">Failed</option>
          <option value="RUNNING">Running</option>
        </select>
        {isFetching && (
          <span className="text-xs text-gray-400 animate-pulse">Refreshing...</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Triggered At
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Entity
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Actions Run
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Error
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Duration
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  Loading execution logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  No execution logs found.
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                    {formatDateTime(log.triggeredAt)}
                  </td>
                  <td className="px-4 py-3">
                    {log.entityId ? (
                      <div>
                        <span className="text-xs text-gray-400 uppercase">
                          {log.entityType ?? '—'}
                        </span>
                        <div>
                          <span className="text-sm text-primary-600 font-mono">
                            {log.entityId.slice(0, 12)}...
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[log.status] ?? 'default'} size="sm">
                      {STATUS_LABEL[log.status] ?? log.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-center">
                    {log.actionsRun}
                  </td>
                  <td className="px-4 py-3">
                    <TruncatedCell text={log.errorMessage} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {calcDurationMs(log)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, meta.total)} of{' '}
            {meta.total} logs
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {meta.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExecutionLogTable;
