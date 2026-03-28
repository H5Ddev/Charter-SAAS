import { Router, IRouter } from 'express'
import { CrewGroupsController } from './crew-groups.controller'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'

export const crewGroupsRouter: IRouter = Router()
const controller = new CrewGroupsController()

crewGroupsRouter.use(requireAuth)
crewGroupsRouter.use(tenantScope)

crewGroupsRouter.get('/', controller.list.bind(controller))
crewGroupsRouter.get('/:id', controller.findById.bind(controller))
crewGroupsRouter.post('/', controller.create.bind(controller))
crewGroupsRouter.patch('/:id', controller.update.bind(controller))
crewGroupsRouter.delete('/:id', controller.softDelete.bind(controller))
crewGroupsRouter.put('/:id/members', controller.setMembers.bind(controller))
crewGroupsRouter.post('/:id/assign-to-trip', controller.assignToTrip.bind(controller))
