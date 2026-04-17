import * as argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import * as OTPAuth from 'otpauth'
import qrcode from 'qrcode'
import { PrismaClient } from '@prisma/client'
import { UserRole } from '../../shared/types/appEnums'
import { env } from '../../config/env'
import { logger } from '../../shared/utils/logger'
import { recordAudit } from '../../shared/utils/auditLog'
import { AppError } from '../../shared/middleware/errorHandler'
import type { TokenPair, AuthUser, LoginResponse, MfaRequiredResponse } from './auth.types'

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
}

const REFRESH_TTL_DAYS = 7

// Account lockout: after N consecutive failed password attempts, lock the
// account for LOCKOUT_DURATION_MINUTES. Counters reset on successful login.
// Defends against distributed brute-force where IP-based rate limiting fails.
const MAX_FAILED_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MINUTES = 15

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async register(
    tenantId: string,
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: string = UserRole.READ_ONLY,
  ): Promise<LoginResponse> {
    // Check tenant exists
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, isActive: true, deletedAt: null },
    })
    if (!tenant) {
      throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant not found or inactive')
    }

    // Check email uniqueness within tenant
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email, deletedAt: null },
    })
    if (existing) {
      throw new AppError(409, 'EMAIL_IN_USE', 'Email address is already registered')
    }

    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS as argon2.Options & { raw?: false })

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        isActive: true,
      },
    })

    const tokens = await this.generateTokenPair(user)

    return {
      user: this.toAuthUser(user),
      tokens,
    }
  }

  async login(
    tenantId: string,
    email: string,
    password: string,
  ): Promise<LoginResponse | MfaRequiredResponse> {
    const user = await this.prisma.user.findFirst({
      where: { tenantId, email, deletedAt: null },
      include: { mfaSettings: true },
    })

    if (!user) {
      // Use same error message to prevent user enumeration
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }

    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account has been disabled')
    }

    // Reject if account is currently locked from prior failed attempts.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(
        423,
        'ACCOUNT_LOCKED',
        `Account locked due to too many failed login attempts. Try again after ${user.lockedUntil.toISOString()}.`,
      )
    }

    const passwordValid = await argon2.verify(user.passwordHash, password)
    if (!passwordValid) {
      const nextAttempts = user.failedLoginAttempts + 1
      const reachedThreshold = nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
      const lockedUntil = reachedThreshold
        ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
        : null

      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: nextAttempts, lockedUntil },
      })

      if (reachedThreshold) {
        recordAudit(this.prisma, {
          tenantId: user.tenantId,
          userId: user.id,
          action: 'ACCOUNT_LOCKED',
          entityType: 'User',
          entityId: user.id,
          diff: { failedLoginAttempts: nextAttempts, lockedUntil: lockedUntil?.toISOString() },
        })
        throw new AppError(
          423,
          'ACCOUNT_LOCKED',
          `Too many failed login attempts. Account locked until ${lockedUntil!.toISOString()}.`,
        )
      }

      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }

    // Successful auth: reset the failed-attempt counter and update last-login.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    })

    // Check if MFA is required
    const mfaEnabled = user.mfaSettings?.totpEnabled || user.mfaSettings?.smsEnabled
    if (mfaEnabled) {
      // Issue a short-lived MFA session token
      const mfaSessionToken = jwt.sign(
        { userId: user.id, tenantId: user.tenantId, mfaPending: true },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '10m' },
      )

      logger.info(`MFA required for user ${user.id}`)

      return {
        mfaRequired: true,
        mfaSessionToken,
        userId: user.id,
      }
    }

    const tokens = await this.generateTokenPair(user)

    return {
      user: this.toAuthUser(user),
      tokens,
    }
  }

  async completeMfaLogin(mfaSessionToken: string, totpToken: string): Promise<LoginResponse> {
    let payload: { userId: string; tenantId: string; mfaPending: boolean }

    try {
      payload = jwt.verify(mfaSessionToken, env.JWT_ACCESS_SECRET) as typeof payload
    } catch {
      throw new AppError(401, 'INVALID_MFA_SESSION', 'Invalid or expired MFA session token')
    }

    if (!payload.mfaPending) {
      throw new AppError(400, 'INVALID_MFA_SESSION', 'Invalid MFA session')
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.userId, deletedAt: null },
      include: { mfaSettings: true },
    })

    if (!user?.mfaSettings?.totpSecret) {
      throw new AppError(400, 'MFA_NOT_CONFIGURED', 'MFA is not configured for this user')
    }

    const isValid = this.verifyTotpToken(user.mfaSettings.totpSecret, totpToken)
    if (!isValid) {
      throw new AppError(401, 'INVALID_TOTP_TOKEN', 'Invalid authenticator code')
    }

    const tokens = await this.generateTokenPair(user)

    return {
      user: this.toAuthUser(user),
      tokens,
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    let payload: { id: string; email: string; tenantId: string; role: string }

    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as typeof payload
    } catch {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token')
    }

    // Check refresh token exists in DB (not revoked) and belongs to this user.
    // RefreshToken is not tenant-scoped — tokens are globally-unique opaque strings.
    // eslint-disable-next-line no-restricted-syntax
    const stored = await this.prisma.refreshToken.findUnique({ where: { token: refreshToken } })
    if (!stored || stored.userId !== payload.id || stored.expiresAt < new Date()) {
      throw new AppError(401, 'REFRESH_TOKEN_REVOKED', 'Refresh token has been revoked')
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.id, deletedAt: null },
    })

    if (!user || !user.isActive) {
      throw new AppError(401, 'USER_NOT_FOUND', 'User not found or inactive')
    }

    return this.generateTokenPair(user)
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } })
    logger.info(`User ${userId} logged out`)
  }

  async setupTotp(userId: string): Promise<{ secret: string; qrCodeDataUrl: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    })

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found')
    }

    const totp = new OTPAuth.TOTP({
      issuer: env.TOTP_ISSUER,
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    })

    const secret = totp.secret.base32

    // Store the secret (not yet enabled — user must verify first)
    await this.prisma.userMfaSettings.upsert({
      where: { userId },
      create: {
        tenantId: user.tenantId,
        userId,
        totpSecret: secret,
        totpEnabled: false,
      },
      update: {
        totpSecret: secret,
      },
    })

    const otpAuthUrl = totp.toString()
    const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl)

    return { secret, qrCodeDataUrl }
  }

  async verifyTotp(
    userId: string,
    token: string,
  ): Promise<{ enabled: boolean }> {
    // UserMfaSettings is not tenant-scoped — keyed on userId which is globally unique.
    // eslint-disable-next-line no-restricted-syntax
    const mfaSettings = await this.prisma.userMfaSettings.findUnique({
      where: { userId },
    })

    if (!mfaSettings?.totpSecret) {
      throw new AppError(400, 'TOTP_NOT_SETUP', 'TOTP is not set up. Call /mfa/setup first.')
    }

    const isValid = this.verifyTotpToken(mfaSettings.totpSecret, token)

    if (!isValid) {
      throw new AppError(401, 'INVALID_TOTP_TOKEN', 'Invalid authenticator code')
    }

    // Enable TOTP if not yet enabled
    if (!mfaSettings.totpEnabled) {
      await this.prisma.userMfaSettings.update({
        where: { userId },
        data: { totpEnabled: true },
      })
      logger.info(`TOTP enabled for user ${userId}`)
      recordAudit(this.prisma, {
        tenantId: mfaSettings.tenantId,
        userId,
        action: 'MFA_ENABLED',
        entityType: 'User',
        entityId: userId,
        diff: { totpEnabled: true },
      })
    }

    return { enabled: true }
  }

  async generateTokenPair(
    user: { id: string; email: string; tenantId: string; role: string },
  ): Promise<TokenPair> {
    const payload = {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    })

    // Store refresh token in DB. Replace any prior token for this user
    // (one active session per user — same semantics as the old Redis SET).
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } })
    await this.prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } })

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    }
  }

  verifyAccessToken(token: string): { id: string; email: string; tenantId: string; role: string } {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as ReturnType<typeof this.verifyAccessToken>
  }

  private verifyTotpToken(secret: string, token: string): boolean {
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    })

    const delta = totp.validate({ token, window: 1 })
    return delta !== null
  }

  private toAuthUser(user: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
    tenantId: string
    mfaSettings?: { totpEnabled: boolean; smsEnabled: boolean } | null
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      mfaEnabled: user.mfaSettings?.totpEnabled || user.mfaSettings?.smsEnabled || false,
    }
  }
}
