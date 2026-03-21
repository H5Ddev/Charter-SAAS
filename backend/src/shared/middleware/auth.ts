import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'
import { errorResponse } from '../utils/response'
import { UserRole } from '@prisma/client'

export interface JwtPayload {
  id: string
  email: string
  tenantId: string
  role: UserRole
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
      tenantId?: string
    }
  }
}

function extractToken(req: Request): string | null {
  // Try Authorization header first
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Fall back to httpOnly cookie
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken as string
  }

  return null
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req)

  if (!token) {
    res.status(401).json(errorResponse('UNAUTHORIZED', 'Authentication token is required'))
    return
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload
    req.user = payload
    req.tenantId = payload.tenantId
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json(errorResponse('TOKEN_EXPIRED', 'Access token has expired'))
      return
    }
    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json(errorResponse('INVALID_TOKEN', 'Invalid authentication token'))
      return
    }
    res.status(401).json(errorResponse('UNAUTHORIZED', 'Authentication failed'))
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(errorResponse('UNAUTHORIZED', 'Authentication required'))
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json(
        errorResponse('FORBIDDEN', `Required role: ${roles.join(' or ')}`),
      )
      return
    }

    next()
  }
}
