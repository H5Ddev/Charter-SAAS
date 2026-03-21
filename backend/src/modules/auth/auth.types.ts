import { z } from 'zod'
import { UserRole } from '../../shared/types/appEnums'

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.string().optional().default(UserRole.READ_ONLY),
  tenantId: z.string().min(1),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().min(1),
})

export const MfaVerifySchema = z.object({
  token: z.string().length(6, 'TOTP token must be 6 digits').regex(/^\d+$/, 'Token must be numeric'),
  mfaSessionToken: z.string().min(1, 'MFA session token is required'),
})

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
})

export type RegisterDto = z.infer<typeof RegisterSchema>
export type LoginDto = z.infer<typeof LoginSchema>
export type MfaVerifyDto = z.infer<typeof MfaVerifySchema>

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  tenantId: string
  mfaEnabled: boolean
}

export interface LoginResponse {
  user: AuthUser
  tokens: TokenPair
}

export interface MfaRequiredResponse {
  mfaRequired: true
  mfaSessionToken: string
  userId: string
}
