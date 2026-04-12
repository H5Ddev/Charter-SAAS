/**
 * Prisma where-clause helper for tenant-scoped, soft-delete-aware queries.
 *
 * Services across every module repeat `where: { tenantId, deletedAt: null, ... }`
 * which is both noisy and a hazard — forgetting the `deletedAt: null` filter is
 * a silent way to leak soft-deleted rows. This helper centralises the pattern:
 *
 *   await prisma.trip.findFirst({ where: tenantScope(tenantId, { id }) })
 *
 * Which desugars to:
 *
 *   { tenantId, deletedAt: null, id }
 *
 * Intentional bypasses (admin restore flows, hard-delete cleanup scripts) should
 * NOT use this helper and should carry a comment explaining why the soft-delete
 * filter is being skipped.
 */
export const tenantScope = <T extends Record<string, unknown>>(
  tenantId: string,
  extra: T = {} as T,
  // Spread extras FIRST so tenantId and deletedAt always win. This guarantees
  // the invariant "tenantScope always scopes to tenantId and always filters
  // out soft-deleted rows" — a caller passing `deletedAt` in extras cannot
  // defeat the soft-delete filter. Admin restore flows that need to see
  // deleted rows must NOT use this helper and should carry a comment.
) => ({ ...extra, tenantId, deletedAt: null })
