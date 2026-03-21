import morgan from 'morgan'
import { morganStream } from '../utils/logger'

// Skip logging for health check endpoint to reduce noise
export const requestLogger = morgan('combined', {
  stream: morganStream,
  skip: (req) => (req as { path?: string }).path === '/health' || (req as { path?: string }).path === '/favicon.ico',
})
