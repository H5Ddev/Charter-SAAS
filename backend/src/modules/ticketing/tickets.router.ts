import { Router } from 'express'
import { TicketsController } from './tickets.controller'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'

export const ticketsRouter = Router()
const controller = new TicketsController()

ticketsRouter.use(requireAuth)
ticketsRouter.use(tenantScope)

ticketsRouter.get('/', controller.list.bind(controller))
ticketsRouter.get('/:id', controller.findById.bind(controller))
ticketsRouter.post('/', controller.create.bind(controller))
ticketsRouter.patch('/:id', controller.update.bind(controller))
ticketsRouter.post('/:id/messages', controller.addMessage.bind(controller))
