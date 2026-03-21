import { Router } from 'express'
import { ContactsController } from './contacts.controller'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'

export const contactsRouter: Router = Router()
const controller = new ContactsController()

// All routes require authentication and tenant scoping
contactsRouter.use(requireAuth)
contactsRouter.use(tenantScope)

contactsRouter.get('/', controller.list.bind(controller))
contactsRouter.get('/duplicates', controller.detectDuplicates.bind(controller))
contactsRouter.get('/:id', controller.findById.bind(controller))
contactsRouter.post('/', controller.create.bind(controller))
contactsRouter.patch('/:id', controller.update.bind(controller))
contactsRouter.delete('/:id', controller.softDelete.bind(controller))
contactsRouter.post('/:id/notes', controller.addNote.bind(controller))
contactsRouter.post('/:id/documents', controller.uploadDocument.bind(controller))
contactsRouter.post('/merge', controller.merge.bind(controller))
