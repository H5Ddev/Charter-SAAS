import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { AuthService } from './auth.service'
import { RegisterSchema, LoginSchema, MfaVerifySchema } from './auth.types'
import { successResponse, errorResponse } from '../../shared/utils/response'
import { requireAuth } from '../../shared/middleware/auth'
import { env } from '../../config/env'

const prisma = new PrismaClient()
const redis = new Redis(env.REDIS_URL)
const authService = new AuthService(prisma, redis)

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
}

export class AuthController {
  /**
   * POST /api/auth/register
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = RegisterSchema.parse(req.body)
      const result = await authService.register(
        data.tenantId,
        data.email,
        data.password,
        data.firstName,
        data.lastName,
        data.role,
      )

      res.cookie('refreshToken', result.tokens.refreshToken, COOKIE_OPTIONS)
      res.cookie('accessToken', result.tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000, // 15 minutes
      })

      res.status(201).json(successResponse({
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      }))
    } catch (err) {
      next(err)
    }
  }

  /**
   * POST /api/auth/login
   * Returns 200 with tokens on success, or 202 with mfaRequired flag if MFA needed.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = LoginSchema.parse(req.body)
      const result = await authService.login(data.tenantId, data.email, data.password)

      if ('mfaRequired' in result && result.mfaRequired) {
        res.status(202).json(successResponse({
          mfaRequired: true,
          mfaSessionToken: result.mfaSessionToken,
          userId: result.userId,
        }))
        return
      }

      const loginResult = result as Awaited<ReturnType<AuthService['login']>> & { tokens: { accessToken: string; refreshToken: string; expiresIn: number } }

      res.cookie('refreshToken', loginResult.tokens.refreshToken, COOKIE_OPTIONS)
      res.cookie('accessToken', loginResult.tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      })

      res.status(200).json(successResponse({
        user: loginResult.user,
        accessToken: loginResult.tokens.accessToken,
        expiresIn: loginResult.tokens.expiresIn,
      }))
    } catch (err) {
      next(err)
    }
  }

  /**
   * POST /api/auth/mfa/verify
   * Completes MFA login, issues final tokens.
   */
  async mfaVerify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = MfaVerifySchema.parse(req.body)
      const result = await authService.completeMfaLogin(data.mfaSessionToken, data.token)

      res.cookie('refreshToken', result.tokens.refreshToken, COOKIE_OPTIONS)
      res.cookie('accessToken', result.tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      })

      res.status(200).json(successResponse({
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      }))
    } catch (err) {
      next(err)
    }
  }

  /**
   * POST /api/auth/mfa/setup
   * Returns QR code for TOTP setup.
   */
  async mfaSetup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireAuth(req, res, async () => {
        const result = await authService.setupTotp(req.user!.id)
        res.json(successResponse(result))
      })
    } catch (err) {
      next(err)
    }
  }

  /**
   * POST /api/auth/refresh
   * Reads refreshToken from HttpOnly cookie or request body.
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken =
        (req.cookies as Record<string, string>)['refreshToken'] ||
        (req.body as Record<string, string>)['refreshToken']

      if (!refreshToken) {
        res.status(401).json(errorResponse('MISSING_REFRESH_TOKEN', 'Refresh token is required'))
        return
      }

      const tokens = await authService.refreshToken(refreshToken)

      res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS)
      res.cookie('accessToken', tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      })

      res.json(successResponse({
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      }))
    } catch (err) {
      next(err)
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireAuth(req, res, async () => {
        await authService.logout(req.user!.id)

        res.clearCookie('refreshToken')
        res.clearCookie('accessToken')

        res.json(successResponse({ message: 'Logged out successfully' }))
      })
    } catch (err) {
      next(err)
    }
  }
}
