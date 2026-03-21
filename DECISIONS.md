# Architecture Decision Records (ADRs)

## ADR-001: Monorepo Structure

**Status**: Accepted
**Date**: 2024-01-01

### Context
AeroComm consists of a backend API, a frontend SPA, infrastructure-as-code, and shared tooling. We need to decide whether to manage these as separate repositories or a single monorepo.

### Decision
We will use a **monorepo** structure with `backend/`, `frontend/`, `infra/`, and root-level tooling.

### Consequences
- **Positive**: Atomic commits span backend + frontend changes. Shared types can be extracted to a `packages/shared` directory in future. Single CI/CD pipeline. Easier to enforce consistent tooling (ESLint, TypeScript, Prettier).
- **Negative**: Repository grows large over time. Git history is shared across all components. Requires disciplined module boundaries to prevent coupling.
- **Mitigation**: CI jobs are scoped per workspace (backend tests run only when `backend/**` changes). If scale demands it, migration to Nx or Turborepo is straightforward from this structure.

---

## ADR-002: Prisma over Raw SQL / TypeORM

**Status**: Accepted
**Date**: 2024-01-01

### Context
We need a data access layer for Azure SQL. Options considered: raw SQL with `mssql` driver, TypeORM, Drizzle, Prisma.

### Decision
We will use **Prisma ORM** with the SQL Server provider.

### Consequences
- **Positive**: Auto-generated type-safe client eliminates an entire category of runtime errors. Prisma Migrate provides declarative schema management with version-controlled migration files. Introspection allows syncing from existing databases. Excellent developer experience with `prisma studio`.
- **Negative**: Prisma's query engine is a separate binary (increases Docker image size ~30 MB). Complex queries requiring window functions or CTEs require `$queryRaw`. The Prisma DSL is not SQL, requiring team members to learn it.
- **Trade-off vs TypeORM**: TypeORM uses class decorators and is more familiar to developers from Java/Spring backgrounds, but has historically had more bugs in its SQL Server support. Prisma's SQL Server support is more mature and actively maintained.
- **Trade-off vs Drizzle**: Drizzle is lighter-weight but has a smaller ecosystem and less mature migration tooling as of the decision date.

---

## ADR-003: Azure Service Bus for Async Events (not RabbitMQ/SQS)

**Status**: Accepted
**Date**: 2024-01-01

### Context
The automation engine requires reliable async event processing. Events must survive application restarts and be processed at-least-once. Options considered: RabbitMQ, AWS SQS, Azure Service Bus, Redis Streams, in-process EventEmitter.

### Decision
We will use **Azure Service Bus** Standard tier with two named queues: `automation-events` and `notification-events`.

### Consequences
- **Positive**: Fully managed, SLA-backed reliable messaging. Native scheduled message delivery (critical for WAIT_DELAY automation actions — we set `scheduledEnqueueTimeUtc` on the message rather than running a cron job). Dead-letter queues for failed messages. Azure-native: integrates with Managed Identity, Key Vault, and Azure Monitor. No additional infrastructure to manage.
- **Negative**: Azure-specific; migrating to another cloud requires replacing the messaging layer. Standard tier does not support topics/subscriptions (Basic: queues only). Cost at scale is higher than self-hosted RabbitMQ.
- **Trade-off vs RabbitMQ**: RabbitMQ is cloud-agnostic but requires managing a cluster (HA, upgrades, storage). On Azure, running RabbitMQ in AKS or on a VM adds operational overhead.
- **Trade-off vs AWS SQS**: SQS requires AWS; since we are committed to Azure, Service Bus is the natural choice.
- **Trade-off vs Redis Streams**: Redis Streams are fast but Redis is not a durable message broker by design. Scheduled message delivery would require a separate scheduler process.

---

## ADR-004: Azure AD B2C for Enterprise SSO

**Status**: Accepted
**Date**: 2024-01-01

### Context
Enterprise aviation companies require SSO via their existing Active Directory. We also need a hosted identity solution for non-enterprise tenants (email/password + MFA) without building our own identity provider.

### Decision
We will use **Azure AD B2C** as the external identity provider for enterprise SSO, while maintaining our own JWT-based auth for standard email/password flows.

### Consequences
- **Positive**: Azure AD B2C supports SAML 2.0, OpenID Connect, and custom policies for complex auth flows. Enterprise tenants can bring their own Azure AD tenant (B2B federation). Handles MFA, password policies, and token issuance. Reduces compliance burden (GDPR, SOC 2) for authentication data.
- **Negative**: B2C pricing is per-monthly-active-user. Custom policies (IEF) have a steep learning curve. Debugging B2C policy errors is complex.
- **Alternative considered**: Auth0 — excellent developer experience but higher per-MAU cost and not Azure-native. Keycloak — open-source but requires self-hosting and management overhead.

---

## ADR-005: Argon2 for Password Hashing

**Status**: Accepted
**Date**: 2024-01-01

### Context
We need to choose a password hashing algorithm for users who register with email/password (not SSO).

### Decision
We will use **Argon2id** via the `argon2` npm package.

### Consequences
- **Positive**: Argon2id won the Password Hashing Competition (2015). Memory-hard: resistant to GPU brute-force attacks. Combines Argon2i (side-channel resistance) and Argon2d (GPU resistance). OWASP recommends Argon2id as the first choice.
- **Negative**: Slower than bcrypt (by design). Requires native bindings (prebuilt binaries available for all major platforms via `argon2` package). Docker build must use the correct platform.
- **Trade-off vs bcrypt**: bcrypt is more universally supported (pure JS implementations) but has a 72-character password limit and is less resistant to modern GPU attacks.
- **Trade-off vs scrypt**: Argon2id offers finer control over memory/time/parallelism parameters and has a cleaner security model.
- **Parameters used**: memory cost 65536 KB, time cost 3, parallelism 4 (OWASP recommended minimums).

---

## ADR-006: CUID for Primary Keys

**Status**: Accepted
**Date**: 2024-01-01

### Context
We need to choose a primary key strategy. Options: auto-increment integers, UUID v4, UUID v7, CUID, CUID2, ULID.

### Decision
We will use **CUID** (Collision-resistant Unique Identifiers) generated by Prisma's `@default(cuid())`.

### Consequences
- **Positive**: URL-safe (no hyphens). Time-sortable (prefix encodes timestamp). No sequential ID enumeration vulnerability (unlike auto-increment). Prisma has first-class CUID support. Globally unique without coordination.
- **Negative**: Longer than auto-increment (25 chars vs ~8 digits). Not as widely recognised as UUID. CUID2 is the newer standard but Prisma's `@default(cuid())` generates CUID v1.
- **Trade-off vs UUID v4**: UUIDs have hyphens, are not time-sortable, and are slightly longer. UUID v7 (time-ordered) is not yet in Prisma's built-in functions.
- **Trade-off vs auto-increment**: Sequential IDs are guessable and expose record counts. CUIDs prevent enumeration attacks on REST APIs.

---

## ADR-007: Soft Deletes Everywhere

**Status**: Accepted
**Date**: 2024-01-01

### Context
Aviation companies need audit trails and the ability to recover accidentally deleted data. Hard deletes permanently destroy records.

### Decision
Every model will include `deletedAt DateTime?`. All queries will filter `deletedAt: null`. There will be no hard-delete endpoints in the initial version.

### Consequences
- **Positive**: Full audit trail preserved. Accidental deletes are recoverable. Referential integrity maintained (no orphaned foreign keys). Supports GDPR right-to-erasure via a separate anonymisation process rather than deletion.
- **Negative**: Queries must always include `deletedAt: null` filter. Unique constraints must account for soft-deleted records (e.g., email uniqueness). Database grows over time (mitigated by archival strategy).
- **Implementation**: The `tenantScope` helper automatically injects `deletedAt: null` in all where clauses. Unique constraints use conditional unique indexes where supported.
- **GDPR note**: For right-to-erasure requests, a separate `anonymise(userId)` function will null-out PII fields while keeping the record shell for referential integrity.

---

## ADR-008: Multi-Tenant via tenantId Column (not Schema-per-Tenant)

**Status**: Accepted
**Date**: 2024-01-01

### Context
Multi-tenancy can be implemented as: (a) separate database per tenant, (b) separate schema per tenant, (c) shared schema with tenantId column on every table.

### Decision
We will use **shared schema with tenantId column** on every table.

### Consequences
- **Positive**: Single migration applied to all tenants simultaneously. Simpler connection pooling (one connection pool, not N pools for N tenants). Lower infrastructure cost. Easier cross-tenant analytics for super admins.
- **Negative**: A bug in tenant isolation logic could expose one tenant's data to another (mitigated by tenantScope middleware + review process). No physical isolation between tenants (no database-level guarantee). Noisy neighbour risk (one large tenant's queries affect others — mitigated by Azure SQL elastic pools and query timeouts).
- **Trade-off vs schema-per-tenant**: Schema-per-tenant provides stronger isolation but requires N migrations for N tenants, N connection strings, and complex deployment orchestration. Viable for <100 tenants but not for SaaS scale.
- **Future**: If a tenant requires schema-level isolation (enterprise compliance requirement), we can provision a dedicated database for that tenant and update their connection string in Key Vault.

---

## ADR-009: React Query for Server State

**Status**: Accepted
**Date**: 2024-01-01

### Context
The frontend needs to manage server state: fetching, caching, background refetching, optimistic updates, and pagination.

### Decision
We will use **TanStack Query (React Query) v5** for all server state management. Zustand is used only for pure client-side state (auth tokens, socket connection).

### Consequences
- **Positive**: Eliminates boilerplate for loading/error/data states. Automatic background refetching keeps data fresh. Built-in cache invalidation. Optimistic updates with rollback. Excellent DevTools. Works seamlessly with our Axios client.
- **Negative**: Learning curve for developers unfamiliar with the query key pattern. Large bundle size (~13 KB gzipped, mitigated by tree-shaking). Requires disciplined query key design for correct cache invalidation.
- **Trade-off vs Redux Toolkit Query**: RTK Query is excellent but couples server state to Redux, adding boilerplate. React Query's separation of concerns is cleaner for a React-first application.
- **Trade-off vs SWR**: SWR is lighter but has fewer features (no mutations, no optimistic updates built-in, no DevTools).

---

## ADR-010: Bicep over Terraform for Azure IaC

**Status**: Accepted
**Date**: 2024-01-01

### Context
Infrastructure-as-code is required for consistent, repeatable deployments across dev/staging/prod. Options: Azure Bicep, Terraform (azurerm provider), Pulumi, ARM templates.

### Decision
We will use **Azure Bicep** for all infrastructure definitions.

### Consequences
- **Positive**: First-class Azure support; Bicep compiles to ARM and is maintained by the Azure team. No state file to manage (ARM handles state via the Azure Resource Manager). Native integration with Azure CLI (`az deployment group create`). Modular via Bicep modules. Type-safe with IDE support (VS Code Bicep extension). No Terraform Cloud or HashiCorp licensing concerns.
- **Negative**: Azure-only (not portable to AWS/GCP). Smaller community than Terraform. Less mature module ecosystem (no equivalent to Terraform Registry). Bicep has less expressive looping and conditional logic compared to Terraform HCL.
- **Trade-off vs Terraform**: Terraform is cloud-agnostic and has a large ecosystem, but requires state management (Terraform Cloud or Azure Storage backend), licensing considerations post-BSL change, and an additional tool in the stack. Since AeroComm is committed to Azure, Bicep's tight integration outweighs Terraform's portability.
- **Trade-off vs ARM**: ARM JSON templates are verbose and hard to read/write directly. Bicep is a domain-specific abstraction over ARM that compiles 1:1 to ARM templates.
