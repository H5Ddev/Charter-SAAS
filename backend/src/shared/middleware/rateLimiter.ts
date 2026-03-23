import rateLimit from 'express-rate-limit'
import { Request } from 'express'
import { env } from '../../config/env'
import { errorResponse } from '../utils/response'

// Azure App Service forwards X-Forwarded-For as "ip:port" — strip the port
const keyGenerator = (req: Request): string => {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
  return ip.includes(':') && !ip.startsWith('[') ? ip.split(':')[0] : ip
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard API rate limiter: 100 requests per 15 minutes
// ─────────────────────────────────────────────────────────────────────────────
export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (_req, res) => {
    res.status(429).json(
      errorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Too many requests. Please try again later.',
        {
          retryAfter: Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000),
        },
      ),
    )
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// Auth endpoints: stricter — 10 requests per 15 minutes
// Prevents brute-force login attacks
// ─────────────────────────────────────────────────────────────────────────────
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: errorResponse(
    'AUTH_RATE_LIMIT_EXCEEDED',
    'Too many authentication attempts. Please try again in 15 minutes.',
  ),
  handler: (_req, res) => {
    res.status(429).json(
      errorResponse(
        'AUTH_RATE_LIMIT_EXCEEDED',
        'Too many authentication attempts. Please try again in 15 minutes.',
      ),
    )
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// Webhook endpoints: more permissive — 200 requests per minute
// External providers may send bursts
// ─────────────────────────────────────────────────────────────────────────────
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (_req, res) => {
    res.status(429).json(
      errorResponse('WEBHOOK_RATE_LIMIT_EXCEEDED', 'Too many webhook requests'),
    )
  },
})
