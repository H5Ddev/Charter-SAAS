import { evaluate, conditionEvaluator, type Condition, type ConditionGroup } from '../../src/modules/automation/condition.evaluator'

const ctx = {
  trip: {
    status: 'BOOKED',
    paxCount: 4,
    isDelayed: false,
    fboName: 'Signature TEB',
    originIcao: 'KTEB',
    tags: ['vip', 'return-client'],
  },
  contact: {
    firstName: 'John',
    phone: '+15551234567',
    doNotContact: false,
  },
  quote: {
    totalPrice: 45000,
  },
}

function makeGroup(
  operator: 'AND' | 'OR',
  conditions: Condition[],
  childGroups?: ConditionGroup[],
): ConditionGroup {
  return {
    operator,
    conditions,
    childGroups,
  }
}

describe('ConditionEvaluator', () => {
  describe('EQUALS operator', () => {
    it('returns true when value matches', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.status', operator: 'EQUALS', value: 'BOOKED' }])],
        ctx,
      )
      expect(result).toBe(true)
    })

    it('returns false when value does not match', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.status', operator: 'EQUALS', value: 'CANCELLED' }])],
        ctx,
      )
      expect(result).toBe(false)
    })
  })

  describe('NOT_EQUALS operator', () => {
    it('returns true when value differs', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.status', operator: 'NOT_EQUALS', value: 'CANCELLED' }])],
        ctx,
      )
      expect(result).toBe(true)
    })

    it('returns false when value matches', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.status', operator: 'NOT_EQUALS', value: 'BOOKED' }])],
        ctx,
      )
      expect(result).toBe(false)
    })
  })

  describe('CONTAINS operator', () => {
    it('returns true when string contains substring', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.fboName', operator: 'CONTAINS', value: 'Signature' }])],
        ctx,
      )
      expect(result).toBe(true)
    })

    it('is case-insensitive for strings', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.fboName', operator: 'CONTAINS', value: 'signature' }])],
        ctx,
      )
      expect(result).toBe(true)
    })

    it('returns false when string does not contain substring', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.fboName', operator: 'CONTAINS', value: 'Landmark' }])],
        ctx,
      )
      expect(result).toBe(false)
    })

    it('returns true when array contains value', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.tags', operator: 'CONTAINS', value: 'vip' }])],
        ctx,
      )
      expect(result).toBe(true)
    })
  })

  describe('GT operator', () => {
    it('returns true when actual > expected', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'quote.totalPrice', operator: 'GT', value: 40000 }])],
        ctx,
      )
      expect(result).toBe(true)
    })

    it('returns false when actual === expected', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'quote.totalPrice', operator: 'GT', value: 45000 }])],
        ctx,
      )
      expect(result).toBe(false)
    })

    it('returns false when actual < expected', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'quote.totalPrice', operator: 'GT', value: 50000 }])],
        ctx,
      )
      expect(result).toBe(false)
    })
  })

  describe('LT operator', () => {
    it('returns true when actual < expected', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.paxCount', operator: 'LT', value: 10 }])],
        ctx,
      )
      expect(result).toBe(true)
    })

    it('returns false when actual >= expected', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.paxCount', operator: 'LT', value: 4 }])],
        ctx,
      )
      expect(result).toBe(false)
    })
  })

  describe('IS_EMPTY operator', () => {
    it('returns true for null', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.missing', operator: 'IS_EMPTY', value: null }])],
        ctx,
      )
      expect(result).toBe(true)
    })

    it('returns true for empty string', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'empty', operator: 'IS_EMPTY', value: null }])],
        { empty: '' },
      )
      expect(result).toBe(true)
    })

    it('returns false for non-empty value', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.status', operator: 'IS_EMPTY', value: null }])],
        ctx,
      )
      expect(result).toBe(false)
    })
  })

  describe('IS_NOT_EMPTY operator', () => {
    it('returns true for non-empty value', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.status', operator: 'IS_NOT_EMPTY', value: null }])],
        ctx,
      )
      expect(result).toBe(true)
    })

    it('returns false for null', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.missing', operator: 'IS_NOT_EMPTY', value: null }])],
        ctx,
      )
      expect(result).toBe(false)
    })
  })

  describe('IN operator', () => {
    it('returns true when value is in list', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.status', operator: 'IN', value: ['BOOKED', 'CONFIRMED', 'DEPARTED'] }])],
        ctx,
      )
      expect(result).toBe(true)
    })

    it('returns false when value is not in list', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.status', operator: 'IN', value: ['CANCELLED', 'COMPLETED'] }])],
        ctx,
      )
      expect(result).toBe(false)
    })
  })

  describe('NOT_IN operator', () => {
    it('returns true when value is not in list', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.status', operator: 'NOT_IN', value: ['CANCELLED', 'COMPLETED'] }])],
        ctx,
      )
      expect(result).toBe(true)
    })

    it('returns false when value is in list', () => {
      const result = evaluate(
        [makeGroup('AND', [{ field: 'trip.status', operator: 'NOT_IN', value: ['BOOKED', 'CONFIRMED'] }])],
        ctx,
      )
      expect(result).toBe(false)
    })
  })

  describe('AND group', () => {
    it('returns true when ALL conditions pass', () => {
      const result = evaluate([
        makeGroup('AND', [
          { field: 'trip.status', operator: 'EQUALS', value: 'BOOKED' },
          { field: 'contact.doNotContact', operator: 'EQUALS', value: false },
        ]),
      ], ctx)
      expect(result).toBe(true)
    })

    it('returns false when ANY condition fails', () => {
      const result = evaluate([
        makeGroup('AND', [
          { field: 'trip.status', operator: 'EQUALS', value: 'BOOKED' },
          { field: 'trip.isDelayed', operator: 'EQUALS', value: true }, // fails
        ]),
      ], ctx)
      expect(result).toBe(false)
    })
  })

  describe('OR group', () => {
    it('returns true when ANY condition passes', () => {
      const result = evaluate([
        makeGroup('OR', [
          { field: 'trip.status', operator: 'EQUALS', value: 'CANCELLED' }, // fails
          { field: 'trip.status', operator: 'EQUALS', value: 'BOOKED' }, // passes
        ]),
      ], ctx)
      expect(result).toBe(true)
    })

    it('returns false when ALL conditions fail', () => {
      const result = evaluate([
        makeGroup('OR', [
          { field: 'trip.status', operator: 'EQUALS', value: 'CANCELLED' }, // fails
          { field: 'trip.status', operator: 'EQUALS', value: 'COMPLETED' }, // fails
        ]),
      ], ctx)
      expect(result).toBe(false)
    })
  })

  describe('Nested AND inside OR', () => {
    it('evaluates nested groups correctly', () => {
      // (status=BOOKED AND paxCount>3) OR (status=CONFIRMED)
      const outerGroup = makeGroup('OR', [], [
        makeGroup('AND', [
          { field: 'trip.status', operator: 'EQUALS', value: 'BOOKED' },
          { field: 'trip.paxCount', operator: 'GT', value: 3 },
        ]),
        makeGroup('AND', [
          { field: 'trip.status', operator: 'EQUALS', value: 'CONFIRMED' }, // fails
        ]),
      ])

      const result = evaluate([outerGroup], ctx)
      expect(result).toBe(true)
    })

    it('returns false when nested groups all fail', () => {
      // (status=CANCELLED) OR (status=COMPLETED)
      const outerGroup = makeGroup('OR', [], [
        makeGroup('AND', [{ field: 'trip.status', operator: 'EQUALS', value: 'CANCELLED' }]),
        makeGroup('AND', [{ field: 'trip.status', operator: 'EQUALS', value: 'COMPLETED' }]),
      ])

      const result = evaluate([outerGroup], ctx)
      expect(result).toBe(false)
    })
  })

  describe('Empty conditions', () => {
    it('returns true when condition groups is empty (no conditions = always pass)', () => {
      expect(evaluate([], ctx)).toBe(true)
    })

    it('returns true for group with no conditions and no child groups', () => {
      expect(evaluate([makeGroup('AND', [])], ctx)).toBe(true)
    })
  })

  describe('evaluateCondition()', () => {
    it('is exported and testable directly', () => {
      const condition: Condition = { field: 'trip.status', operator: 'EQUALS', value: 'BOOKED' }
      expect(conditionEvaluator.evaluateCondition(condition, ctx)).toBe(true)
    })
  })
})
