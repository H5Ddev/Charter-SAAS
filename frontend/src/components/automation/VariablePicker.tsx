import React, { useState, useRef, useEffect } from 'react';

interface VariablePickerProps {
  onSelect: (variable: string) => void;
  className?: string;
}

const VARIABLES = [
  { path: 'passenger.firstName', type: 'STRING', description: 'Passenger first name', example: 'John' },
  { path: 'passenger.lastName', type: 'STRING', description: 'Passenger last name', example: 'Smith' },
  { path: 'passenger.phone', type: 'PHONE', description: 'Passenger phone number', example: '+1 555-555-5555' },
  { path: 'trip.departureDate', type: 'DATE', description: 'Trip departure date', example: 'March 25, 2025' },
  { path: 'trip.departureTime', type: 'DATETIME', description: 'Trip departure time', example: '10:00 AM' },
  { path: 'trip.boardingTime', type: 'DATETIME', description: 'Boarding time', example: '9:30 AM' },
  { path: 'trip.fboName', type: 'STRING', description: 'FBO name', example: 'Signature Flight Support' },
  { path: 'trip.fboAddress', type: 'STRING', description: 'FBO address', example: '1234 Airport Blvd, Miami, FL' },
  { path: 'trip.surveyLink', type: 'URL', description: 'Post-trip survey URL', example: 'https://survey.aerocomm.io/abc123' },
  { path: 'tenant.companyName', type: 'STRING', description: 'Charter company name', example: 'SkyCharter Inc.' },
  { path: 'tenant.supportPhone', type: 'PHONE', description: 'Company support phone', example: '+1 800-SKY-CHART' },
  { path: 'tenant.supportEmail', type: 'STRING', description: 'Company support email', example: 'support@skycharter.com' },
];

const TYPE_COLORS: Record<string, string> = {
  STRING: 'bg-blue-100 text-blue-700',
  DATE: 'bg-green-100 text-green-700',
  DATETIME: 'bg-green-100 text-green-700',
  PHONE: 'bg-purple-100 text-purple-700',
  URL: 'bg-orange-100 text-orange-700',
};

export function VariablePicker({ onSelect, className }: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = VARIABLES.filter(
    v =>
      v.path.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className={`relative ${className ?? ''}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 flex items-center gap-1"
      >
        <span>{'{ }'}</span>
        <span>Insert Variable</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              placeholder="Search variables..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="text-xs text-gray-400 px-3 py-2">No variables found</li>
            )}
            {filtered.map(v => (
              <li key={v.path}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-start gap-2 group"
                  onClick={() => {
                    onSelect(`{{${v.path}}}`);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <span
                    className={`mt-0.5 text-xs font-mono px-1 rounded shrink-0 ${TYPE_COLORS[v.type] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {v.type}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-gray-800 group-hover:text-blue-700">
                      {'{{' + v.path + '}}'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{v.description}</div>
                    <div className="text-xs text-gray-400 italic truncate">e.g. {v.example}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default VariablePicker;
