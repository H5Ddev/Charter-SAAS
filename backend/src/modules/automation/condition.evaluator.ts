import { ConditionGroupOperator, ConditionOperator } from '../../shared/types/appEnums'
import { resolvePath } from '../notifications/template.engine'
import { logger } from '../../shared/utils/logger'

export interface Condition {
  field: string
  operator: ConditionOperator
  value: unknown
}

export interface ConditionGroup {
  operator: ConditionGroupOperator
  conditions: Condition[]
  childGroups?: ConditionGroup[]
}

/**
 * Evaluate a single condition against a context object.
 */
function evaluateCondition(
  condition: Condition,
  context: Record<string, unknown>,
): boolean {
  const actualValue = resolvePath(context, condition.field)
  const expectedValue = condition.value

  switch (condition.operator) {
    case 'EQUALS':
      // eslint-disable-next-line eqeqeq
      return actualValue == expectedValue || String(actualValue) === String(expectedValue)

    case 'NOT_EQUALS':
      // eslint-disable-next-line eqeqeq
      return actualValue != expectedValue && String(actualValue) !== String(expectedValue)

    case 'CONTAINS': {
      if (typeof actualValue === 'string' && typeof expectedValue === 'string') {
        return actualValue.toLowerCase().includes(expectedValue.toLowerCase())
      }
      if (Array.isArray(actualValue)) {
        return actualValue.includes(expectedValue)
      }
      return false
    }

    case 'GT': {
      const numActual = Number(actualValue)
      const numExpected = Number(expectedValue)
      if (isNaN(numActual) || isNaN(numExpected)) return false
      return numActual > numExpected
    }

    case 'LT': {
      const numActual = Number(actualValue)
      const numExpected = Number(expectedValue)
      if (isNaN(numActual) || isNaN(numExpected)) return false
      return numActual < numExpected
    }

    case 'IS_EMPTY':
      return (
        actualValue === null ||
        actualValue === undefined ||
        actualValue === '' ||
        (Array.isArray(actualValue) && actualValue.length === 0)
      )

    case 'IS_NOT_EMPTY':
      return !(
        actualValue === null ||
        actualValue === undefined ||
        actualValue === '' ||
        (Array.isArray(actualValue) && actualValue.length === 0)
      )

    case 'IN': {
      const list = Array.isArray(expectedValue) ? expectedValue : [expectedValue]
      return list.some(
        (item) => item === actualValue || String(item) === String(actualValue),
      )
    }

    case 'NOT_IN': {
      const list = Array.isArray(expectedValue) ? expectedValue : [expectedValue]
      return !list.some(
        (item) => item === actualValue || String(item) === String(actualValue),
      )
    }

    default:
      logger.warn(`Unknown condition operator: ${condition.operator as string}`)
      return false
  }
}

/**
 * Evaluate a condition group (AND/OR) against a context.
 * Supports nested groups via childGroups.
 */
function evaluateGroup(
  group: ConditionGroup,
  context: Record<string, unknown>,
): boolean {
  const conditionResults = group.conditions.map((c) => evaluateCondition(c, context))
  const childGroupResults = (group.childGroups ?? []).map((g) => evaluateGroup(g, context))
  const allResults = [...conditionResults, ...childGroupResults]

  if (allResults.length === 0) return true

  if (group.operator === 'AND') {
    return allResults.every(Boolean)
  } else {
    return allResults.some(Boolean)
  }
}

/**
 * Evaluate an array of condition groups against a context.
 * Top-level groups are ANDed together.
 *
 * @param conditionGroups - Array of condition groups (fetched from DB)
 * @param context - The execution context (trip, contact, quote, etc.)
 * @returns true if all conditions pass, false otherwise
 */
export function evaluate(
  conditionGroups: ConditionGroup[],
  context: Record<string, unknown>,
): boolean {
  if (conditionGroups.length === 0) {
    // No conditions → always pass
    return true
  }

  // Top-level groups are ANDed
  return conditionGroups.every((group) => evaluateGroup(group, context))
}

export const conditionEvaluator = { evaluate, evaluateCondition, evaluateGroup }
