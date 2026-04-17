import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import { errorResponse } from '../utils/response'
import { logger } from '../utils/logger'
import { env } from '../../config/env'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // AppError — our own structured errors
  if (err instanceof AppError) {
    logger.warn(`AppError [${err.code}]: ${err.message}`, {
      path: req.path,
      method: req.method,
      statusCode: err.statusCode,
    })
    res.status(err.statusCode).json(errorResponse(err.code, err.message, err.details))
    return
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }))
    res.status(400).json(
      errorResponse('VALIDATION_ERROR', 'Request validation failed', details),
    )
    return
  }

  // JWT errors
  if (err instanceof jwt.TokenExpiredError) {
    res.status(401).json(errorResponse('TOKEN_EXPIRED', 'Access token has expired'))
    return
  }

  if (err instanceof jwt.JsonWebTokenError) {
    res.status(401).json(errorResponse('INVALID_TOKEN', 'Invalid authentication token'))
    return
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const fields = err.meta?.target as string[] | undefined
        res.status(409).json(
          errorResponse(
            'CONFLICT',
            `A record with this ${fields?.join(', ') || 'value'} already exists`,
          ),
        )
        return
      }
      case 'P2025': {
        res.status(404).json(errorResponse('NOT_FOUND', 'Record not found'))
        return
      }
      case 'P2003': {
        res.status(400).json(errorResponse('FOREIGN_KEY_VIOLATION', 'Referenced record does not exist'))
        return
      }
      default: {
        logger.error(`Prisma error [${err.code}]:`, {
          message: err.message,
          meta: err.meta,
          path: req.path,
        })
        res.status(500).json(errorResponse('DATABASE_ERROR', 'A database error occurred'))
        return
      }
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json(errorResponse('DATABASE_VALIDATION_ERROR', 'Invalid database query'))
    return
  }

  // Multer errors (file upload)
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    res.status(status).json(errorResponse(`UPLOAD_${err.code}`, err.message))
    return
  }

  // Unknown errors — log fully, never expose stack in production
  const error = err instanceof Error ? err : new Error(String(err))

  logger.error('Unhandled error:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  })

  if (env.NODE_ENV === 'production') {
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'))
  } else {
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', error.message, {
        stack: error.stack,
      }),
    )
  }
}
