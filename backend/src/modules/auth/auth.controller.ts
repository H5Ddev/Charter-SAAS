import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthService } from './auth.service'
import { RegisterSchema, LoginSchema, MfaVerifySchema } from './auth.types'
import { successResponse, errorResponse } from '../../shared/utils/response'
import { requireAuth } from '../../shared/middleware/auth'
import { recordAudit, requestMeta } from '../../shared/utils/auditLog'
import { AppError } from '../../shared/middleware/errorHandler'
import { env } from '../../config/env'

const prisma = new PrismaClient()
const authService = new AuthService(prisma)

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

      recordAudit(prisma, {
        tenantId: result.user.tenantId,
        userId: result.user.id,
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: result.user.id,
        diff: { email: result.user.email, role: result.user.role },
        ...requestMeta(req),
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
    let attemptedTenantId: string | undefined
    let attemptedEmail: string | undefined
    try {
      const data = LoginSchema.parse(req.body)
      attemptedTenantId = data.tenantId
      attemptedEmail = data.email
      const result = await authService.login(data.tenantId, data.email, data.password)

      if ('mfaRequired' in result && result.mfaRequired) {
        recordAudit(prisma, {
          tenantId: data.tenantId,
          userId: result.userId,
          action: 'LOGIN_MFA_REQUIRED',
          entityType: 'User',
          entityId: result.userId,
          ...requestMeta(req),
        })
        res.status(202).json(successResponse({
          mfaRequired: true,
          mfaSessionToken: result.mfaSessionToken,
          userId: result.userId,
        }))
        return
      }

      const loginResult = result as import('./auth.types').LoginResponse

      res.cookie('refreshToken', loginResult.tokens.refreshToken, COOKIE_OPTIONS)
      res.cookie('accessToken', loginResult.tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      })

      recordAudit(prisma, {
        tenantId: loginResult.user.tenantId,
        userId: loginResult.user.id,
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: loginResult.user.id,
        ...requestMeta(req),
      })

      res.status(200).json(successResponse({
        user: loginResult.user,
        accessToken: loginResult.tokens.accessToken,
        expiresIn: loginResult.tokens.expiresIn,
      }))
    } catch (err) {
      // Audit auth failures so brute-force / credential-stuffing attempts are visible.
      // Only audit when we have a tenantId (i.e. validation passed).
      if (
        err instanceof AppError &&
        attemptedTenantId &&
        attemptedEmail &&
        ['INVALID_CREDENTIALS', 'ACCOUNT_DISABLED'].includes(err.code)
      ) {
        recordAudit(prisma, {
          tenantId: attemptedTenantId,
          userId: null,
          action: 'LOGIN_FAILED',
          entityType: 'User',
          entityId: attemptedEmail,
          diff: { reason: err.code },
          ...requestMeta(req),
        })
      }
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

      recordAudit(prisma, {
        tenantId: result.user.tenantId,
        userId: result.user.id,
        action: 'MFA_VERIFIED',
        entityType: 'User',
        entityId: result.user.id,
        ...requestMeta(req),
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
   * POST /api/auth/mfa/setup/verify
   * Confirms TOTP setup by verifying a code from the authenticator app.
   * Flips totpEnabled = true on first successful verification.
   */
  async mfaSetupVerify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireAuth(req, res, async () => {
        const body = req.body as { token?: string }
        if (!body.token || !/^\d{6}$/.test(body.token)) {
          res.status(400).json(errorResponse('INVALID_TOKEN_FORMAT', 'Token must be a 6-digit code'))
          return
        }
        const result = await authService.verifyTotp(req.user!.id, body.token)
        res.json(successResponse(result))
      })
    } catch (err) {
      next(err)
    }
  }

  /**
   * POST /api/auth/mfa/disable
   * Disables TOTP. Requires current password AND a valid TOTP code.
   */
  async mfaDisable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireAuth(req, res, async () => {
        const body = req.body as { password?: string; token?: string }
        if (!body.password || !body.token) {
          res.status(400).json(errorResponse('MISSING_FIELDS', 'password and token are required'))
          return
        }
        if (!/^\d{6}$/.test(body.token)) {
          res.status(400).json(errorResponse('INVALID_TOKEN_FORMAT', 'Token must be a 6-digit code'))
          return
        }
        const result = await authService.disableMfa(req.user!.id, body.password, body.token)
        res.json(successResponse(result))
      })
    } catch (err) {
      next(err)
    }
  }

  /**
   * POST /api/auth/password-reset/request
   * Public. Always returns 200, even for unknown emails, to prevent enumeration.
   */
  async passwordResetRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as { tenantId?: string; email?: string }
      if (!body.tenantId || !body.email) {
        res.status(400).json(errorResponse('MISSING_FIELDS', 'tenantId and email are required'))
        return
      }
      await authService.requestPasswordReset(body.tenantId, body.email)
      res.json(successResponse({
        message: 'If an account exists for that email, a reset link has been sent.',
      }))
    } catch (err) {
      next(err)
    }
  }

  /**
   * POST /api/auth/password-reset/confirm
   * Public. Accepts the raw token from the emailed link plus the new password.
   */
  async passwordResetConfirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as { token?: string; newPassword?: string }
      if (!body.token || !body.newPassword) {
        res.status(400).json(errorResponse('MISSING_FIELDS', 'token and newPassword are required'))
        return
      }
      await authService.confirmPasswordReset(body.token, body.newPassword)
      res.json(successResponse({ message: 'Password updated. Please sign in with your new password.' }))
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

        recordAudit(prisma, {
          tenantId: req.user!.tenantId,
          userId: req.user!.id,
          action: 'USER_LOGOUT',
          entityType: 'User',
          entityId: req.user!.id,
          ...requestMeta(req),
        })

        res.clearCookie('refreshToken')
        res.clearCookie('accessToken')

        res.json(successResponse({ message: 'Logged out successfully' }))
      })
    } catch (err) {
      next(err)
    }
  }
}
