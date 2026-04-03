import { Router, Request, Response, NextFunction } from 'express'
import { ContactsController } from './contacts.controller'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'
import { optInService } from '../notifications/optin.service'
import { successResponse } from '../../shared/utils/response'
import { AppError } from '../../shared/middleware/errorHandler'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

/**
 * POST /api/contacts/:id/send-optin
 * Sends a WhatsApp (and/or SMS) opt-in solicitation to the contact.
 * Body: { channel: 'WHATSAPP' | 'SMS' | 'BOTH' }
 */
contactsRouter.post('/:id/send-optin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId!, deletedAt: null },
      select: { id: true, phone: true, whatsappPhone: true, doNotContact: true },
    })

    if (!contact) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found')
    if (contact.doNotContact) throw new AppError(400, 'DO_NOT_CONTACT', 'Contact is marked do-not-contact')

    const channel = (req.body as { channel?: string }).channel ?? 'BOTH'

    // Re-use the solicitation service but send regardless of opt-in state
    // (operator is manually triggering this as a test/re-solicitation)
    await optInService.solicitOnPassengerAdd(req.tenantId!, contact.id, '')

    res.json(successResponse({ sent: true, contactId: contact.id, channel }))
  } catch (err) { next(err) }
})
