import { Router } from 'express'
import { TripsController } from './trips.controller'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'

export const tripsRouter = Router()
const controller = new TripsController()

tripsRouter.use(requireAuth)
tripsRouter.use(tenantScope)

tripsRouter.get('/', controller.list.bind(controller))
tripsRouter.get('/:id', controller.findById.bind(controller))
tripsRouter.post('/', controller.create.bind(controller))
tripsRouter.patch('/:id/status', controller.updateStatus.bind(controller))
tripsRouter.post('/:id/delay', controller.flagDelay.bind(controller))
tripsRouter.post('/:id/passengers', controller.addPassenger.bind(controller))
tripsRouter.get('/:id/pax-manifest', controller.getPaxManifest.bind(controller))
