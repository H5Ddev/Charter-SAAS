# AeroComm Architecture

## System Overview

AeroComm is a multi-tenant SaaS platform built for aviation charter companies. It centralises operations across customer relationship management, trip scheduling, quote management, ticketing, and automated communications into a single cohesive platform. Each customer (aviation company) is a **tenant**; their data is isolated by a `tenantId` column on every record.

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client Layer                                 │
│  Browser SPA (React/Vite/Tailwind)   Mobile Browser (PWA-ready)    │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ HTTPS / WSS
┌───────────────────────▼─────────────────────────────────────────────┐
│                    Azure App Service                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Backend API (Express + TypeScript)                          │   │
│  │  - REST routes (/api/**)                                     │   │
│  │  - WebSocket server (Socket.io)                              │   │
│  │  - Swagger UI (/api/docs)                                    │   │
│  │  - Health check (/health)                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Frontend SPA (served as static files from nginx container)  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
        ┌───────────────┼────────────────────┐
        ▼               ▼                    ▼
┌──────────────┐  ┌──────────────┐   ┌──────────────────┐
│ Azure SQL DB │  │ Azure Cache  │   │  Azure Service   │
│  (Prisma)    │  │  for Redis   │   │  Bus (queues)    │
└──────────────┘  └──────────────┘   └──────────────────┘
        │                                    │
        │                          ┌─────────▼──────────┐
        │                          │  Automation Engine  │
        │                          │  Consumer process   │
        │                          └─────────────────────┘
        │
┌───────▼─────────────────────────────────────────────────┐
│  External Services                                       │
│  Twilio · SendGrid · Slack · MS Teams · DocuSign        │
│  Stripe · AirLabs (flight tracking)                     │
└──────────────────────────────────────────────────────────┘
        │
┌───────▼──────────────┐  ┌────────────────────┐
│  Azure Blob Storage  │  │  Azure Key Vault   │
│  (documents, photos) │  │  (secrets)         │
└──────────────────────┘  └────────────────────┘
        │
┌───────▼────────────────────┐
│  Azure AD B2C              │
│  (enterprise SSO / MFA)    │
└────────────────────────────┘
```

---

## Data Flow

### Authenticated REST Request

```
Client Request
  │
  ├─► Helmet / CORS / Compression middleware
  ├─► Morgan request logger
  ├─► express.json() body parser
  ├─► Rate limiter (Redis-backed)
  ├─► auth middleware
  │     reads Bearer token from Authorization header OR httpOnly cookie
  │     verifies JWT_ACCESS_SECRET
  │     attaches req.user = { id, email, tenantId, role }
  ├─► tenantScope middleware
  │     reads req.user.tenantId → attaches req.tenantId
  │     provides withTenantScope(prisma, tenantId) helper
  ├─► Route handler
  │     validates request body with Zod schema
  │     calls Service layer
  │     Service layer uses Prisma with tenantId always in where clause
  │     Service may publish events to Service Bus
  └─► Response
        successResponse({ data }) or errorResponse(code, message)
```

### Inbound Webhook Flow

```
External Provider (Twilio / Stripe / DocuSign / ...)
  │  POST /api/webhooks/:integrationName
  │
  ├─► Load Integration by name from registry
  ├─► integration.verifySignature(req)  ← 401 if fails
  ├─► integration.receiveWebhook(req)   ← normalise to WebhookEvent
  ├─► Persist WebhookEvent to DB
  ├─► Publish to Service Bus automation-events queue
  └─► 200 OK
```

---

## Automation Engine Pipeline

```
Domain Event occurs (e.g. trip status → BOOKED)
  │
  ▼
EventPublisher.publish('automation-events', BaseEvent)
  │
  ▼
Azure Service Bus queue: automation-events
  │
  ▼
AutomationEngineConsumer.processMessage(event)
  │
  ├─► TriggerRegistry.getAutomationsForEvent(tenantId, eventType)
  │     → loads all enabled Automations matching trigger type
  │
  ├─► For each Automation:
  │     ├─► Build execution context from event payload
  │     │     fetch Trip / Contact / Quote / Ticket as needed from DB
  │     │
  │     ├─► ConditionEvaluator.evaluate(conditionGroups, context)
  │     │     AND/OR group logic, all operators
  │     │     Returns true/false
  │     │
  │     └─► If conditions pass:
  │           ActionExecutor.execute(actions, context)
  │             ├─► SEND_SMS → SmsSender → Twilio
  │             ├─► SEND_EMAIL → EmailSender → SendGrid
  │             ├─► SEND_WHATSAPP → Twilio WhatsApp
  │             ├─► SEND_SLACK → Slack webhook
  │             ├─► SEND_TEAMS → Teams adaptive card
  │             ├─► CREATE_TICKET → TicketsService
  │             ├─► UPDATE_TRIP_FIELD → TripsService
  │             ├─► UPDATE_CONTACT_FIELD → ContactsService
  │             ├─► FIRE_WEBHOOK → HTTP POST
  │             ├─► CHAIN_AUTOMATION → publish new event (max 5 hops)
  │             ├─► WAIT_DELAY → DelayScheduler
  │             │     creates ScheduledMessage + schedules Service Bus msg
  │             └─► ADD_NOTE → ContactNote / TicketMessage
  │
  └─► ExecutionLogger.log(result)
        creates AutomationExecutionLog record
```

---

## Database Schema Design Decisions

1. **Single-database multi-tenancy**: All tables include a `tenantId` column. Every Prisma query is scoped by `tenantId`. This approach simplifies migrations (one schema for all tenants) while providing good isolation at the application layer. Row-level security can be added at the database layer in future.

2. **Soft deletes everywhere**: All records include `deletedAt DateTime?`. Queries filter `deletedAt: null`. This preserves audit history, supports undo, and allows safe cascade behaviour.

3. **CUID primary keys**: Globally unique, URL-safe, time-sortable, collision-resistant. No sequential ID leakage.

4. **Optimistic locking**: `updatedAt` is managed by Prisma `@updatedAt`. For concurrent trip updates, the service layer checks `updatedAt` before writes.

5. **Composite indexes**: Every foreign key column is indexed together with `tenantId` for efficient scoped queries.

6. **JSON columns for flexible data**: `settings`, `customFields`, `amenities`, `conditions`, `triggerConfig`, `actionConfig` stored as JSON. Typed at the application layer with Zod schemas.

7. **Enum-per-domain**: Each status, type, channel, and role has its own Prisma enum for type safety and database constraint enforcement.

---

## Domain Models

**User vs Contact vs CrewMember** — these three "person" models are intentionally separate:

- **User** — an operator-side login (admin, dispatcher, sales agent). Has `passwordHash`, JWT auth, MFA, RBAC role. Belongs to a tenant.
- **Contact** — a client-side entity (passenger, broker, aircraft owner). Has phone/email for notifications, opt-in tracking, portal access via OTP. No password. Belongs to a tenant.
- **CrewMember** — an aviation professional assigned to trips. Tracks FAA/regulatory lifecycle data: license number/type/expiry, medical class/expiry, type ratings, airframe-hours-at-service. May never log in. Not a passenger (no TripPassenger junction). Belongs to a tenant.

Do not merge these models. They have different authentication, authorization, and lifecycle semantics.

---

## Security Architecture

### Authentication
- **JWT**: Short-lived access tokens (15 min) + long-lived refresh tokens (7 days) stored in HttpOnly cookies. Refresh tokens stored in Redis; invalidated on logout.
- **Argon2**: Password hashing with Argon2id (memory-hard, side-channel resistant). Parameters: memory 65536, time cost 3, parallelism 4.
- **MFA**: TOTP (RFC 6238) via `otpauth` library. QR code generated for authenticator apps. Backup codes (one-time use) stored hashed.
- **Azure AD B2C**: Enterprise SSO for tenants requiring Active Directory integration. OAuth2 PKCE flow.

### Authorization
- **RBAC**: Roles: SUPER_ADMIN, COMPANY_ADMIN, DISPATCHER, SALES_AGENT, OWNER, PASSENGER, READ_ONLY.
- **Permission model**: Each role has a set of `Permission` records (resource + action). Middleware checks `req.user.role` against required permission for each endpoint.
- **Tenant isolation**: `tenantScope` middleware ensures users can only access their own tenant's data. SUPER_ADMIN can access all tenants.

### Transport Security
- Helmet sets security headers: HSTS, CSP, X-Frame-Options, etc.
- CORS restricted to configured origins.
- All cookies: HttpOnly, Secure, SameSite=Strict.
- CSRF protection via `csurf` for state-changing endpoints.

### Secret Management
- All secrets stored in Azure Key Vault.
- Application uses Managed Identity (DefaultAzureCredential) to access Key Vault at runtime.
- No secrets in environment variables in production (env vars hold Key Vault references).
- Secrets rotated via Key Vault versioning.

---

## Deployment Architecture

### Development
- Local Docker Compose: SQL Server 2022, Redis 7, Azurite (Azure Storage emulator).
- Backend: `ts-node-dev` with hot reload.
- Frontend: Vite dev server with HMR, proxies `/api` to localhost:3000.
- No external Azure services required (stubs/emulators used).

### Staging
- Azure App Service Plan P2v3 (auto-scale 1-3 instances).
- Azure SQL S4 tier.
- Azure Cache for Redis C2.
- Azure Service Bus Standard namespace.
- Continuous deployment from `staging` branch via GitHub Actions.
- Smoke tests run post-deploy before traffic shifted.

### Production
- Azure App Service Plan P2v3 (auto-scale 2-10 instances) with zone redundancy.
- Azure SQL P2 tier with geo-replication.
- Azure Cache for Redis C2 with geo-replication.
- Azure Service Bus Standard with duplicate detection.
- Blue/green deployment via deployment slots.
- Manual approval gate in GitHub Actions `production` environment.
- Azure Front Door for CDN + WAF.
- Azure Monitor + Application Insights for observability.

---

## Real-Time Architecture

Socket.io is initialised on the same HTTP server as Express. The frontend connects via the Socket.io client on successful authentication, passing the JWT as a query parameter. The server verifies the JWT on connection.

**Rooms**: Each authenticated connection joins room `tenant:{tenantId}` and `user:{userId}`.

**Events emitted to clients**:
- `notification:new` — in-app notification
- `trip:status_changed` — real-time trip status update
- `ticket:new_message` — new ticket message
- `automation:execution_complete` — dry-run results

The `InAppSender` uses `io.to('user:{userId}').emit(...)` for user-specific notifications and `io.to('tenant:{tenantId}').emit(...)` for tenant-wide broadcasts.

---

## Integration Plugin Architecture

Each integration implements the `Integration` interface:

```
interface Integration {
  name: string
  connect(config): Promise<void>
  disconnect(): Promise<void>
  sendMessage?(payload): Promise<MessageResult>
  receiveWebhook(req): Promise<WebhookEvent>
  verifySignature(req): boolean
  getStatus(): IntegrationStatus
}
```

Integrations are registered in a central registry. The webhook router looks up integrations by name from the URL path (`/api/webhooks/:integrationName`). The `IntegrationConfig` table stores encrypted configuration (Key Vault secret references) per tenant per integration. This allows each tenant to have their own Twilio/SendGrid credentials.

New integrations can be added by:
1. Creating a new directory under `src/integrations/`
2. Implementing the `Integration` interface
3. Registering in `IntegrationRegistry`
4. Adding the integration type to the `IntegrationType` enum in the Prisma schema
5. Adding webhook route if inbound webhooks are required
