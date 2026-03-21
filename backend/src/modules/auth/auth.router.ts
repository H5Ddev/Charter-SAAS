import { Router } from 'express'
import { AuthController } from './auth.controller'
import { authRateLimiter } from '../../shared/middleware/rateLimiter'
import { requireAuth } from '../../shared/middleware/auth'

export const authRouter = Router()
const controller = new AuthController()

// Apply strict rate limiting to all auth endpoints
authRouter.use(authRateLimiter)

authRouter.post('/register', controller.register.bind(controller))
authRouter.post('/login', controller.login.bind(controller))
authRouter.post('/mfa/verify', controller.mfaVerify.bind(controller))
authRouter.post('/mfa/setup', requireAuth, controller.mfaSetup.bind(controller))
authRouter.post('/refresh', controller.refresh.bind(controller))
authRouter.post('/logout', requireAuth, controller.logout.bind(controller))
