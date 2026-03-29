/**
 * CrewPicker — reusable crew selector used on Trip and Quote forms.
 *
 * Shows two tabs:
 *   Groups   — select a named crew group; expands all its members into selectedCrew
 *   Individual — search and add individual crew members one at a time
 *
 * Props:
 *   selectedCrew  — controlled array of currently selected members
 *   onChange      — called whenever the selection changes
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import { XMarkIcon } from '@heroicons/react/20/solid'
import { UserGroupIcon, UserIcon } from '@heroicons/react/24/outline'
import { useCrew, type CrewMember } from '@/api/crew.api'
import { useCrewGroups } from '@/api/crew-groups.api'

export type SelectedCrewMember = Pick<CrewMember, 'id' | 'firstName' | 'lastName' | 'role'>

const ROLE_LABELS: Record<string, string> = {
  CAPTAIN: 'Captain',
  FIRST_OFFICER: 'First Officer',
  FLIGHT_ATTENDANT: 'Flight Attendant',
  DISPATCHER: 'Dispatcher',
  MECHANIC: 'Mechanic',
  OTHER: 'Other',
}

interface Props {
  selectedCrew: SelectedCrewMember[]
  onChange: (crew: SelectedCrewMember[]) => void
}

type Tab = 'groups' | 'individual'

export function CrewPicker({ selectedCrew, onChange }: Props) {
  const [tab, setTab] = useState<Tab>('groups')
  const [crewSearch, setCrewSearch] = useState('')
  const [groupSearch, setGroupSearch] = useState('')

  const { data: crewData } = useCrew({ isActive: true, pageSize: 200 })
  const allCrew = crewData?.data ?? []

  const { data: groups } = useCrewGroups()
  const allGroups = groups ?? []

  function removeMember(id: string) {
    onChange(selectedCrew.filter((c) => c.id !== id))
  }

  function addMember(m: CrewMember) {
    if (selectedCrew.find((c) => c.id === m.id)) return
    onChange([...selectedCrew, { id: m.id, firstName: m.firstName, lastName: m.lastName, role: m.role }])
    setCrewSearch('')
  }

  function applyGroup(groupId: string) {
    const group = allGroups.find((g) => g.id === groupId)
    if (!group) return
    const newMembers: SelectedCrewMember[] = group.members
      .filter((m) => !selectedCrew.find((s) => s.id === m.crewMemberId))
      .map((m) => ({
        id: m.crewMemberId,
        firstName: m.crewMember.firstName,
        lastName: m.crewMember.lastName,
        role: m.crewMember.role,
      }))
    onChange([...selectedCrew, ...newMembers])
    setGroupSearch('')
  }

  const filteredCrew = allCrew.filter((m) =>
    !selectedCrew.find((s) => s.id === m.id) &&
    (crewSearch === '' || `${m.firstName} ${m.lastName} ${m.role}`.toLowerCase().includes(crewSearch.toLowerCase()))
  )

  const filteredGroups = allGroups.filter((g) =>
    groupSearch === '' || g.name.toLowerCase().includes(groupSearch.toLowerCase())
  )

  return (
    <div className="space-y-3">
      {/* Selected crew chips */}
      {selectedCrew.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCrew.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-medium border border-primary-200">
              {m.firstName} {m.lastName}
              <span className="text-primary-400">· {ROLE_LABELS[m.role] ?? m.role.replace('_', ' ')}</span>
              <button type="button" onClick={() => removeMember(m.id)} className="ml-0.5 text-primary-400 hover:text-primary-700">
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setTab('groups')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'groups' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <UserGroupIcon className="h-3.5 w-3.5" />
          Groups
        </button>
        <button
          type="button"
          onClick={() => setTab('individual')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'individual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <UserIcon className="h-3.5 w-3.5" />
          Individual
        </button>
      </div>

      {/* Groups tab */}
      {tab === 'groups' && (
        <div>
          <input
            type="text"
            placeholder="Search groups…"
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {allGroups.length === 0 ? (
            <p className="text-xs text-gray-400 mt-2 px-1">No crew groups defined yet. Create groups in the Crew section.</p>
          ) : (
            <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {filteredGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => applyGroup(group.id)}
                  className="w-full text-left px-3 py-2.5 hover:bg-primary-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{group.name}</p>
                    <span className="text-xs text-gray-400">{group.members.length} members</span>
                  </div>
                  {group.members.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {group.members.map((m) => `${m.crewMember.firstName} ${m.crewMember.lastName}`).join(', ')}
                    </p>
                  )}
                </button>
              ))}
              {filteredGroups.length === 0 && (
                <p className="px-3 py-3 text-sm text-gray-400">No groups match "{groupSearch}"</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Individual tab */}
      {tab === 'individual' && (
        <div>
          <input
            type="text"
            placeholder="Search crew by name or role…"
            value={crewSearch}
            onChange={(e) => setCrewSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {crewSearch.length > 0 && filteredCrew.length > 0 && (
            <ul className="mt-1 bg-white rounded-lg border border-gray-200 shadow-sm max-h-48 overflow-y-auto">
              {filteredCrew.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => addMember(m)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 flex items-center gap-2 transition-colors"
                  >
                    <span className="font-medium text-gray-900">{m.firstName} {m.lastName}</span>
                    <span className="text-xs text-gray-400 ml-auto">{ROLE_LABELS[m.role] ?? m.role.replace('_', ' ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {crewSearch.length > 0 && filteredCrew.length === 0 && (
            <p className="text-xs text-gray-400 mt-2 px-1">No crew found matching "{crewSearch}"</p>
          )}
        </div>
      )}
    </div>
  )
}
