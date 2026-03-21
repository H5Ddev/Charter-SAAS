# AeroComm

> Aviation charter communication management platform — multi-tenant SaaS

## Overview

AeroComm is a multi-tenant SaaS platform built for private aviation charter operators. It centralizes customer management, trip scheduling, quoting, ticketing, and all passenger communications into a single pane of glass. The automation engine lets operators define no-code rules that fire SMS, email, WhatsApp, Slack, and Teams messages based on flight events — without writing a single line of code.

See [ARCHITECTURE.md](ARCHITECTURE.md) for full system design and [DECISIONS.md](DECISIONS.md) for architecture decision records (ADRs).

---

## Prerequisites

- **Node.js 20+**
- **Docker Desktop** (for local SQL Server, Redis, and Azure Storage emulator)
- **Azure CLI** — `az login`
- **GitHub CLI** — `gh auth login`

---

## Local Development

### 1. Clone and install

```bash
git clone <repo-url> && cd charter-saas

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### 2. Environment setup

```bash
cp .env.example .env
# Edit .env — at minimum set JWT secrets for local dev
# All Azure services use local emulators in dev (see docker-compose.yml)
```

### 3. Start infrastructure

```bash
docker-compose up db redis azurite -d
# Wait for db healthcheck to pass (~30s)
```

### 4. Database setup

```bash
cd backend
npx prisma migrate dev --name init
npx prisma db seed
# Creates: demo tenant, admin@skycharter.com / Demo1234!, S01-S08 automations
```

### 5. Run the full stack

```bash
# Option A: Docker Compose (recommended)
docker-compose up

# Option B: Native
cd backend && npm run dev      # :3000
cd frontend && npm run dev     # :5173
```

### 6. Access

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000 |
| API Docs (Swagger) | http://localhost:3000/api/docs |
| Prisma Studio | `cd backend && npx prisma studio` |

### Default credentials

- **Email:** `admin@skycharter.com`
- **Password:** `Demo1234!`

---

## Running Tests

```bash
cd backend
npm test                                          # All tests with coverage
npm test -- --testPathPattern=unit                # Unit tests only
npm test -- --testPathPattern=integration         # Integration tests only
```

---

## Azure Deployment

### Prerequisites

- Azure subscription
- Resource groups created per environment: `aerocomm-dev`, `aerocomm-staging`, `aerocomm-prod`
- Azure Container Registry created (shared across environments)
- Service principals per environment with Contributor role on the respective resource group

### Deploy Infrastructure (Bicep)

```bash
# Dev environment
az deployment group create \
  --resource-group aerocomm-dev \
  --template-file infra/main.bicep \
  --parameters environment=dev appName=aerocomm location=eastus

# Staging
az deployment group create \
  --resource-group aerocomm-staging \
  --template-file infra/main.bicep \
  --parameters environment=staging appName=aerocomm location=eastus

# Production
az deployment group create \
  --resource-group aerocomm-prod \
  --template-file infra/main.bicep \
  --parameters environment=prod appName=aerocomm location=eastus
```

### GitHub Environments Setup

Create three GitHub Environments: `dev`, `staging`, `production`

For each environment, add these secrets:

```
AZURE_CLIENT_ID                — Service principal client ID
AZURE_CLIENT_SECRET            — Service principal secret
AZURE_TENANT_ID                — Azure tenant ID
AZURE_SUBSCRIPTION_ID          — Azure subscription ID
ACR_LOGIN_SERVER               — e.g. aerocommacr.azurecr.io
ACR_USERNAME
ACR_PASSWORD
AZURE_KEY_VAULT_URL            — e.g. https://aerocomm-dev-kv.vault.azure.net/
DATABASE_URL                   — Azure SQL connection string
REDIS_URL                      — Azure Cache for Redis connection string
AZURE_SERVICE_BUS_CONNECTION_STRING
AZURE_STORAGE_CONNECTION_STRING
JWT_ACCESS_SECRET              — Generate: openssl rand -hex 32
JWT_REFRESH_SECRET             — Generate: openssl rand -hex 32
CSRF_SECRET
SESSION_SECRET
TWILIO_ACCOUNT_SID             — (when configured)
TWILIO_AUTH_TOKEN
SENDGRID_API_KEY
```

For the `production` environment: set **Required reviewers** (approval gate) in Environment settings.

### CI/CD Workflow Overview

| Workflow | Trigger | Target |
|---|---|---|
| `ci.yml` | PR to any branch | Lint, type-check, test, Docker build |
| `deploy-dev.yml` | Push to `dev` | Auto-deploy to dev environment |
| `deploy-staging.yml` | Push to `staging` | Auto-deploy to staging environment |
| `deploy-prod.yml` | Push to `main` | Manual approval required → deploy to prod |
| `db-migrate.yml` | Called post-deploy | Run `prisma migrate deploy` per environment |

### Branch Strategy

```
main       → production  (manual approval gate)
staging    → pre-production / UAT
dev        → integration branch
feature/*  → individual features → PR → dev
```

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for full system design and [DECISIONS.md](DECISIONS.md) for ADRs.

---

## Module Overview

| # | Module | Description |
|---|---|---|
| 1 | **Customer Management** | Contacts (Owner/Passenger/Both), organizations, document vault, duplicate detection |
| 2 | **Ticketing** | Multi-source tickets (email/SMS/web/manual), SLA timers, internal/client replies |
| 3 | **Inventory** | Aircraft registry, availability calendar, maintenance windows |
| 4 | **Scheduling & Trips** | Trip builder, multi-leg, PAX manifest, status workflow |
| 5 | **Sales & Quoting** | Quote builder, pricing, versioning, e-signature integration |
| 6 | **Notifications** | SMS/WhatsApp/Email/In-app/Slack/Teams with template engine |
| 7 | **Automation Engine** | No-code visual rule builder, event-driven, scheduled actions |

---

## Contributing

- Branch from `dev`, name as `feature/your-feature`
- PR to `dev` — CI must pass
- Squash and merge
