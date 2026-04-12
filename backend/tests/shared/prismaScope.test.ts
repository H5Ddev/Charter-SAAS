/**
 * Unit tests for tenantScope — the shared where-clause helper used by
 * every tenant-scoped service to build `{ tenantId, deletedAt: null, ... }`.
 *
 * These tests must be pure (no DB, no env) so they run on any host.
 */

export {}

import { tenantScope } from '../../src/shared/utils/prismaScope'

describe('tenantScope', () => {
  it('returns { tenantId, deletedAt: null } when no extras are provided', () => {
    const scope = tenantScope('tenant_abc')
    expect(scope).toEqual({ tenantId: 'tenant_abc', deletedAt: null })
  })

  it('merges extra fields alongside tenantId and deletedAt', () => {
    const scope = tenantScope('tenant_abc', { id: 'trip_123' })
    expect(scope).toEqual({
      tenantId: 'tenant_abc',
      deletedAt: null,
      id: 'trip_123',
    })
  })

  it('supports Prisma operator objects in extras (id: { in: [...] })', () => {
    const scope = tenantScope('tenant_abc', { id: { in: ['a', 'b', 'c'] } })
    expect(scope).toEqual({
      tenantId: 'tenant_abc',
      deletedAt: null,
      id: { in: ['a', 'b', 'c'] },
    })
  })

  it('supports multiple extra fields including booleans and nested filters', () => {
    const scope = tenantScope('tenant_abc', {
      isActive: true,
      status: 'OPEN',
      createdAt: { gte: new Date('2024-01-01') },
    })
    expect(scope.isActive).toBe(true)
    expect(scope.status).toBe('OPEN')
    expect(scope.createdAt).toEqual({ gte: new Date('2024-01-01') })
    expect(scope.tenantId).toBe('tenant_abc')
    expect(scope.deletedAt).toBeNull()
  })

  it('always sets deletedAt: null even if extras tries to override it', () => {
    // The helper spreads extras FIRST and sets tenantId + deletedAt LAST so
    // that the soft-delete filter cannot be defeated by passing a different
    // `deletedAt` in extras. Admin restore flows must not use this helper.
    // Cast through unknown because TS correctly rejects the mismatched type;
    // the runtime guarantee is what matters here.
    const scope = tenantScope(
      'tenant_abc',
      { deletedAt: { not: null } } as unknown as Record<string, unknown>,
    )
    expect(scope.deletedAt).toBeNull()
  })

  it('always keeps the caller-provided tenantId (extras cannot override it)', () => {
    const scope = tenantScope(
      'tenant_real',
      { tenantId: 'tenant_evil' } as unknown as Record<string, unknown>,
    )
    expect(scope.tenantId).toBe('tenant_real')
  })

  it('does not mutate the extras object', () => {
    const extras = { id: 'trip_123' }
    const scope = tenantScope('tenant_abc', extras)
    expect(extras).toEqual({ id: 'trip_123' }) // unchanged
    expect(scope).not.toBe(extras)
  })
})
