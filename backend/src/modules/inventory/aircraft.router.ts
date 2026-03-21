import { Router } from 'express'
import { AircraftController } from './aircraft.controller'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'

export const aircraftRouter = Router()
const controller = new AircraftController()

aircraftRouter.use(requireAuth)
aircraftRouter.use(tenantScope)

aircraftRouter.get('/', controller.list.bind(controller))
aircraftRouter.get('/:id', controller.findById.bind(controller))
aircraftRouter.post('/', controller.create.bind(controller))
aircraftRouter.patch('/:id', controller.update.bind(controller))
aircraftRouter.delete('/:id', controller.softDelete.bind(controller))
aircraftRouter.post('/:id/availability', controller.addAvailability.bind(controller))
aircraftRouter.get('/:id/availability/check', controller.checkAvailability.bind(controller))
