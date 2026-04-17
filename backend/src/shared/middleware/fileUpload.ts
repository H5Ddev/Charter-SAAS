import multer from 'multer'
import { Request, RequestHandler } from 'express'
import { AppError } from './errorHandler'

const DOCUMENT_MIME_WHITELIST = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
])

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024 // 10 MB

function documentFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (DOCUMENT_MIME_WHITELIST.has(file.mimetype)) {
    cb(null, true)
    return
  }
  cb(new AppError(400, 'UNSUPPORTED_FILE_TYPE', `File type not allowed: ${file.mimetype}`))
}

export const uploadDocument: RequestHandler = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
  fileFilter: documentFileFilter,
}).single('file')
