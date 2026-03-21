import React from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';

export type ConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'GT'
  | 'LT'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY';

export interface Condition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: string;
}

export interface ConditionGroup {
  id: string;
  operator: 'AND' | 'OR';
  conditions: Condition[];
}

interface ConditionBuilderProps {
  conditionGroups: ConditionGroup[];
  onChange: (groups: ConditionGroup[]) => void;
}

const OPERATOR_OPTIONS: { value: ConditionOperator; label: string; hasValue: boolean }[] = [
  { value: 'EQUALS', label: 'equals', hasValue: true },
  { value: 'NOT_EQUALS', label: 'does not equal', hasValue: true },
  { value: 'CONTAINS', label: 'contains', hasValue: true },
  { value: 'GT', label: 'greater than', hasValue: true },
  { value: 'LT', label: 'less than', hasValue: true },
  { value: 'IS_EMPTY', label: 'is empty', hasValue: false },
  { value: 'IS_NOT_EMPTY', label: 'is not empty', hasValue: false },
];

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function newCondition(): Condition {
  return { id: generateId(), field: '', operator: 'EQUALS', value: '' };
}

function newGroup(): ConditionGroup {
  return { id: generateId(), operator: 'AND', conditions: [newCondition()] };
}

function ConditionRow({
  condition,
  onChange,
  onRemove,
  canRemove,
}: {
  condition: Condition;
  onChange: (updated: Condition) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const operatorDef = OPERATOR_OPTIONS.find(o => o.value === condition.operator);
  const hasValue = operatorDef?.hasValue ?? true;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        placeholder="field.path"
        value={condition.field}
        onChange={e => onChange({ ...condition, field: e.target.value })}
        className="form-input w-40 text-sm"
      />
      <select
        value={condition.operator}
        onChange={e =>
          onChange({ ...condition, operator: e.target.value as ConditionOperator, value: '' })
        }
        className="form-input w-40 text-sm"
      >
        {OPERATOR_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hasValue ? (
        <input
          type="text"
          placeholder="value"
          value={condition.value}
          onChange={e => onChange({ ...condition, value: e.target.value })}
          className="form-input w-36 text-sm"
        />
      ) : (
        <span className="w-36 text-sm text-gray-400 italic">(no value needed)</span>
      )}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          aria-label="Remove condition"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function ConditionGroupPanel({
  group,
  onChange,
  onRemove,
  canRemove,
}: {
  group: ConditionGroup;
  onChange: (updated: ConditionGroup) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function setOperator(op: 'AND' | 'OR') {
    onChange({ ...group, operator: op });
  }

  function updateCondition(idx: number, updated: Condition) {
    const conditions = group.conditions.map((c, i) => (i === idx ? updated : c));
    onChange({ ...group, conditions });
  }

  function addCondition() {
    onChange({ ...group, conditions: [...group.conditions, newCondition()] });
  }

  function removeCondition(idx: number) {
    const conditions = group.conditions.filter((_, i) => i !== idx);
    onChange({ ...group, conditions });
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Match
          </span>
          <div className="flex rounded-md overflow-hidden border border-gray-300">
            {(['AND', 'OR'] as const).map(op => (
              <button
                key={op}
                type="button"
                onClick={() => setOperator(op)}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  group.operator === op
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {op}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500">of the following conditions</span>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Remove group
          </button>
        )}
      </div>

      <div className="space-y-2 pl-2">
        {group.conditions.map((cond, idx) => (
          <React.Fragment key={cond.id}>
            {idx > 0 && (
              <div className="text-xs font-semibold text-primary-600 pl-1">
                {group.operator}
              </div>
            )}
            <ConditionRow
              condition={cond}
              onChange={updated => updateCondition(idx, updated)}
              onRemove={() => removeCondition(idx)}
              canRemove={group.conditions.length > 1}
            />
          </React.Fragment>
        ))}
      </div>

      <button
        type="button"
        onClick={addCondition}
        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add Condition
      </button>
    </div>
  );
}

export function ConditionBuilder({ conditionGroups, onChange }: ConditionBuilderProps) {
  function updateGroup(idx: number, updated: ConditionGroup) {
    onChange(conditionGroups.map((g, i) => (i === idx ? updated : g)));
  }

  function removeGroup(idx: number) {
    onChange(conditionGroups.filter((_, i) => i !== idx));
  }

  function addGroup() {
    onChange([...conditionGroups, newGroup()]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Conditions</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Leave empty to always run. Multiple groups are combined with OR logic.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={addGroup}>
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Group
        </Button>
      </div>

      {conditionGroups.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-400">No conditions — automation will always run.</p>
          <button
            type="button"
            onClick={addGroup}
            className="mt-2 text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            Add a condition group
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {conditionGroups.map((group, idx) => (
            <React.Fragment key={group.id}>
              {idx > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-xs font-semibold text-gray-400 uppercase">OR</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
              )}
              <ConditionGroupPanel
                group={group}
                onChange={updated => updateGroup(idx, updated)}
                onRemove={() => removeGroup(idx)}
                canRemove={conditionGroups.length > 1}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

export default ConditionBuilder;
