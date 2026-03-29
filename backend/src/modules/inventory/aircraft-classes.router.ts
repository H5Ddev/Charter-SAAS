import { Router, IRouter } from 'express'
import { AircraftClassesController } from './aircraft-classes.controller'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'

export const aircraftClassesRouter: IRouter = Router()
const controller = new AircraftClassesController()

aircraftClassesRouter.use(requireAuth)
aircraftClassesRouter.use(tenantScope)

aircraftClassesRouter.get('/', controller.list.bind(controller))
aircraftClassesRouter.get('/:id', controller.findById.bind(controller))
aircraftClassesRouter.post('/', controller.create.bind(controller))
aircraftClassesRouter.patch('/:id', controller.update.bind(controller))
aircraftClassesRouter.delete('/:id', controller.softDelete.bind(controller))
