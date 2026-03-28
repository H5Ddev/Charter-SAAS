import { useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'
import { useAirportSearch, type Airport } from '@/api/airports.api'

interface Props {
  label: string
  value: string           // ICAO code (the stored value)
  onChange: (icao: string, airport: Airport | null) => void
  placeholder?: string
  required?: boolean
  error?: string
  className?: string
}

export function AirportSearch({ label, value, onChange, placeholder = 'KTEB', required, error, className }: Props) {
  const [inputText, setInputText] = useState(value)
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: results = [] } = useAirportSearch(dirty ? inputText : '', open)

  // Sync display text when value changes externally (e.g. form reset)
  useEffect(() => {
    if (!dirty) setInputText(value)
  }, [value, dirty])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        // If user typed something that didn't resolve, keep the raw value
        if (!results.find((a) => a.icaoCode === inputText.toUpperCase())) {
          const upper = inputText.toUpperCase()
          if (upper.length === 4) onChange(upper, null)
        }
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [inputText, results, onChange])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.toUpperCase()
    setInputText(v)
    setDirty(true)
    setOpen(true)
    // If cleared, reset parent
    if (!v) onChange('', null)
  }

  function select(airport: Airport) {
    setInputText(airport.icaoCode)
    setDirty(false)
    setOpen(false)
    onChange(airport.icaoCode, airport)
  }

  function typeLabel(type: string) {
    if (type === 'large_airport') return 'Large'
    if (type === 'medium_airport') return 'Medium'
    if (type === 'small_airport') return 'Small'
    if (type === 'heliport') return 'Heliport'
    return type
  }

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={inputText}
        onChange={handleInput}
        onFocus={() => { if (inputText.length >= 2) setOpen(true) }}
        placeholder={placeholder}
        maxLength={10}
        autoComplete="off"
        className={clsx(
          'w-full rounded-md border px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase',
          error ? 'border-red-400' : 'border-gray-300',
        )}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white rounded-md border border-gray-200 shadow-lg max-h-56 overflow-y-auto">
          {results.map((a) => (
            <li key={a.icaoCode}>
              <button
                type="button"
                onMouseDown={() => select(a)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors flex items-start gap-3"
              >
                <span className="font-mono font-bold text-gray-900 w-12 shrink-0">{a.icaoCode}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-gray-900 truncate">{a.name}</span>
                  {(a.municipality || a.isoCountry) && (
                    <span className="text-xs text-gray-400">
                      {[a.municipality, a.isoCountry].filter(Boolean).join(', ')}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{typeLabel(a.type)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && dirty && inputText.length >= 2 && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-md border border-gray-200 shadow-lg px-3 py-2 text-sm text-gray-400">
          No airports found
        </div>
      )}
    </div>
  )
}
