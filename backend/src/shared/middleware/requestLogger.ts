import morgan from 'morgan'
import { morganStream } from '../utils/logger'

// Skip logging for health check endpoint to reduce noise
export const requestLogger = morgan('combined', {
  stream: morganStream,
  skip: (req) => req.path === '/health' || req.path === '/favicon.ico',
})
