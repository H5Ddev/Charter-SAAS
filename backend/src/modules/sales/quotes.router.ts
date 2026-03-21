import { Router } from 'express'
import { QuotesController } from './quotes.controller'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'

export const quotesRouter: Router = Router()
const controller = new QuotesController()

quotesRouter.use(requireAuth)
quotesRouter.use(tenantScope)

quotesRouter.get('/', controller.list.bind(controller))
quotesRouter.get('/:id', controller.findById.bind(controller))
quotesRouter.post('/', controller.create.bind(controller))
quotesRouter.patch('/:id', controller.update.bind(controller))
quotesRouter.post('/:id/line-items', controller.addLineItem.bind(controller))
quotesRouter.post('/:id/signature', controller.recordSignature.bind(controller))
quotesRouter.post('/:id/convert-to-trip', controller.convertToTrip.bind(controller))
