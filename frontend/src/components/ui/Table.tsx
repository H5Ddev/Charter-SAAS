import { ReactNode, useState } from 'react'
import { clsx } from 'clsx'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import Button from './Button'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T, index: number) => ReactNode
  sortable?: boolean
  className?: string
  headerClassName?: string
}

export interface PaginationMeta {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  loading?: boolean
  emptyMessage?: string
  pagination?: PaginationMeta
  onPageChange?: (page: number) => void
  onSort?: (key: string, direction: 'asc' | 'desc') => void
  className?: string
  rowClassName?: (row: T) => string
  onRowClick?: (row: T) => void
  renderMobileCard?: (row: T) => ReactNode
}

interface SortState {
  key: string
  direction: 'asc' | 'desc'
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyMessage = 'No results found.',
  pagination,
  onPageChange,
  onSort,
  className,
  rowClassName,
  onRowClick,
  renderMobileCard,
}: TableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null)

  function handleSort(key: string) {
    const next: SortState =
      sort?.key === key
        ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    setSort(next)
    onSort?.(next.key, next.direction)
  }

  return (
    <div className={clsx('flex flex-col gap-4', className)}>
      {/* Mobile card list — shown only when renderMobileCard is provided */}
      {renderMobileCard && (
        <div className="sm:hidden">
          {loading ? (
            <div className="flex justify-center py-10">
              <svg className="h-6 w-6 animate-spin text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : data.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-10">{emptyMessage}</p>
          ) : (
            <div className="space-y-2">
              {data.map((row) => (
                <div
                  key={keyExtractor(row)}
                  className={clsx(
                    'bg-white rounded-lg border border-gray-200 px-4 py-3',
                    onRowClick && 'cursor-pointer active:bg-gray-50',
                    rowClassName?.(row)
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  <div className={clsx('flex items-center gap-2', onRowClick && '')}>
                    <div className="flex-1 min-w-0">{renderMobileCard(row)}</div>
                    {onRowClick && <ChevronRightIcon className="h-4 w-4 text-gray-300 shrink-0" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Desktop table */}
      <div className={clsx('overflow-x-auto rounded-lg border border-gray-200', renderMobileCard && 'hidden sm:block')}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={clsx(
                    'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider',
                    col.sortable && 'cursor-pointer select-none hover:text-gray-900',
                    col.headerClassName
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="flex flex-col">
                        <ChevronUpIcon
                          className={clsx(
                            'h-3 w-3',
                            sort?.key === col.key && sort.direction === 'asc'
                              ? 'text-primary-600'
                              : 'text-gray-300'
                          )}
                        />
                        <ChevronDownIcon
                          className={clsx(
                            'h-3 w-3 -mt-1',
                            sort?.key === col.key && sort.direction === 'desc'
                              ? 'text-primary-600'
                              : 'text-gray-300'
                          )}
                        />
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center">
                  <div className="flex justify-center">
                    <svg
                      className="h-6 w-6 animate-spin text-primary-600"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={keyExtractor(row)}
                  className={clsx(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-gray-50',
                    rowClassName?.(row)
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx('px-4 py-3 text-sm text-gray-700', col.className)}
                    >
                      {col.render(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-gray-600">
            Showing{' '}
            <span className="font-medium">
              {(pagination.page - 1) * pagination.pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-medium">
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            </span>{' '}
            of <span className="font-medium">{pagination.total}</span> results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              aria-label="Next page"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Table
