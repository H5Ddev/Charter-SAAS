import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import jwt from 'jsonwebtoken'

import { env } from './config/env'
import { requestLogger } from './shared/middleware/requestLogger'
import { apiRateLimiter } from './shared/middleware/rateLimiter'
import { errorHandler } from './shared/middleware/errorHandler'
import { successResponse } from './shared/utils/response'
import { logger } from './shared/utils/logger'
import { JwtPayload } from './shared/middleware/auth'
import { inAppSender } from './modules/notifications/channels/inapp.sender'

// Route imports
import { authRouter } from './modules/auth/auth.router'
import { contactsRouter } from './modules/customers/contacts.router'
import { organizationsRouter } from './modules/customers/organizations.router'
import { aircraftRouter } from './modules/inventory/aircraft.router'
import { tripsRouter } from './modules/scheduling/trips.router'
import { quotesRouter } from './modules/sales/quotes.router'
import { ticketsRouter } from './modules/ticketing/tickets.router'
import { automationRouter } from './modules/automation/automation.router'
import { notificationsRouter } from './modules/notifications/notifications.router'
import { webhooksRouter } from './modules/webhooks/router'
import { crewRouter } from './modules/crew/crew.router'
import { crewGroupsRouter } from './modules/crew/crew-groups.router'
import { aircraftClassesRouter } from './modules/inventory/aircraft-classes.router'
import { maintenanceRouter } from './modules/maintenance/maintenance.router'
import { usersRouter } from './modules/users/users.router'
import { integrationsRouter } from './modules/integrations/integrations.router'
import { portalRouter } from './modules/portal/portal.router'
import { airportsRouter } from './modules/airports/airports.router'
import { simulatorRouter } from './modules/simulator/simulator.router'

// ─────────────────────────────────────────────────────────────────────────────
// Express App
// ─────────────────────────────────────────────────────────────────────────────

export const app: express.Application = express()
export const httpServer = createServer(app)

// Trust Azure App Service / load balancer proxy (fixes X-Forwarded-For for rate limiting)
app.set('trust proxy', 1)

// ─────────────────────────────────────────────────────────────────────────────
// Socket.io
// ─────────────────────────────────────────────────────────────────────────────

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CORS_ORIGINS.split(','),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})

io.use((socket, next) => {
  const token = socket.handshake.auth.token as string | undefined
  if (!token) {
    return next(new Error('Authentication token required'))
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload
    socket.data.user = payload
    next()
  } catch {
    next(new Error('Invalid authentication token'))
  }
})

io.on('connection', (socket) => {
  const user = socket.data.user as JwtPayload
  logger.debug(`Socket connected: ${user.id}`, { tenantId: user.tenantId })

  // Join tenant and user rooms
  void socket.join(`tenant:${user.tenantId}`)
  void socket.join(`user:${user.id}`)

  socket.on('disconnect', () => {
    logger.debug(`Socket disconnected: ${user.id}`)
  })
})

// Give the in-app sender access to the Socket.io server
inAppSender.setIo(io)

// ─────────────────────────────────────────────────────────────────────────────
// Security Middleware
//
// CSRF strategy: we intentionally do NOT use a CSRF token middleware. Defense
// against cross-site request forgery relies on:
//   1. SameSite=strict on all auth cookies (refreshToken, accessToken) —
//      browsers refuse to send them on cross-site requests.
//   2. CORS allowlist (env.CORS_ORIGINS) — unknown origins fail the
//      credentialed-request preflight.
//   3. Bearer-token API auth — the frontend attaches Authorization headers,
//      which a third-party origin cannot add to a forged request.
// The csurf package was previously declared but never applied; it has since
// been archived/deprecated upstream, so introducing it would add a maintenance
// burden without meaningful defense-in-depth on top of the controls above.
// ─────────────────────────────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}))

app.use(cors({
  origin: (origin, callback) => {
    const allowed = env.CORS_ORIGINS.split(',').map((o) => o.trim())
    if (!origin || allowed.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}))

app.use(compression())
app.use(cookieParser())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ─────────────────────────────────────────────────────────────────────────────
// Request Logging
// ─────────────────────────────────────────────────────────────────────────────

app.use(requestLogger)

// ─────────────────────────────────────────────────────────────────────────────
// Health Check (before rate limiter)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json(successResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: env.NODE_ENV,
  }))
})

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api', apiRateLimiter)

// ─────────────────────────────────────────────────────────────────────────────
// Swagger Documentation
// ─────────────────────────────────────────────────────────────────────────────

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AeroComm API',
      version: '1.0.0',
      description: 'Multi-tenant SaaS API for aviation charter companies',
    },
    servers: [{ url: env.API_BASE_URL + '/api' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/*.ts'],
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// ─────────────────────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter)
app.use('/api/contacts', contactsRouter)
app.use('/api/organizations', organizationsRouter)
app.use('/api/aircraft', aircraftRouter)
app.use('/api/trips', tripsRouter)
app.use('/api/quotes', quotesRouter)
app.use('/api/tickets', ticketsRouter)
app.use('/api/automations', automationRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/webhooks', webhooksRouter)
app.use('/api/crew', crewRouter)
app.use('/api/crew-groups', crewGroupsRouter)
app.use('/api/aircraft-classes', aircraftClassesRouter)
app.use('/api/maintenance', maintenanceRouter)
app.use('/api/users', usersRouter)
app.use('/api/integrations', integrationsRouter)
app.use('/api/portal', portalRouter)
app.use('/api/airports', airportsRouter)
app.use('/api/admin', simulatorRouter)

// ─────────────────────────────────────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
})

// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler (must be last)
// ─────────────────────────────────────────────────────────────────────────────

app.use(errorHandler)
