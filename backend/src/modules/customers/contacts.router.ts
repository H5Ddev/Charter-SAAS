import { Router, Request, Response, NextFunction } from 'express'
import { ContactsController } from './contacts.controller'
import { requireAuth } from '../../shared/middleware/auth'
import { tenantScope } from '../../shared/middleware/tenantScope'
import { successResponse } from '../../shared/utils/response'
import { AppError } from '../../shared/middleware/errorHandler'
import { PrismaClient } from '@prisma/client'
import { env } from '../../config/env'
import { TwilioIntegration } from '../../integrations/twilio'
import { logger } from '../../shared/utils/logger'

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

    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      throw new AppError(400, 'TWILIO_NOT_CONFIGURED', 'Twilio credentials are not set.')
    }
    if ((channel === 'WHATSAPP' || channel === 'BOTH') && !env.TWILIO_WHATSAPP_FROM) {
      throw new AppError(400, 'WHATSAPP_NOT_CONFIGURED', 'TWILIO_WHATSAPP_FROM is not set.')
    }

    const twilio = new TwilioIntegration()
    await twilio.connect({
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      fromPhone: env.TWILIO_PHONE_NUMBER ?? '',
      whatsappFrom: env.TWILIO_WHATSAPP_FROM ?? '',
    })

    const msg = `AeroComm: Reply YES to receive flight notifications (reminders, boarding, delays). Reply STOP to decline. Msg & data rates may apply.`

    if ((channel === 'WHATSAPP' || channel === 'BOTH') && contact.whatsappPhone) {
      const to = contact.whatsappPhone.startsWith('whatsapp:') ? contact.whatsappPhone : `whatsapp:${contact.whatsappPhone}`
      const result = await twilio.sendMessage({ to, body: msg })
      logger.info(`WhatsApp opt-in solicitation sent`, { contactId: contact.id, messageSid: result.messageId })
    }

    if ((channel === 'SMS' || channel === 'BOTH') && contact.phone && env.TWILIO_PHONE_NUMBER) {
      const result = await twilio.sendMessage({ to: contact.phone, body: msg })
      logger.info(`SMS opt-in solicitation sent`, { contactId: contact.id, messageSid: result.messageId })
    }

    res.json(successResponse({ sent: true, contactId: contact.id, channel }))
  } catch (err) { next(err) }
})
