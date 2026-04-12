import { PrismaClient } from '@prisma/client'
import { smsSender } from './channels/sms.sender'
import { whatsappSender } from './channels/whatsapp.sender'
import { logger } from '../../shared/utils/logger'
import { tenantScope } from '../../shared/utils/prismaScope'

const prisma = new PrismaClient()

/**
 * Sends a CTIA-compliant opt-in solicitation to a contact when they are
 * added to a trip, if they have not already opted in.
 *
 * SMS:   fires if contact.phone exists and smsOptIn is false
 * WhatsApp: fires if contact.whatsappPhone exists and whatsappOptIn is false
 *
 * The senders themselves also guard against opted-out contacts, but we
 * bypass that guard here by sending directly via Twilio — the solicitation
 * message is exempt from the opt-in requirement because it IS the opt-in ask.
 */
export class OptInService {
  async solicitOnPassengerAdd(
    tenantId: string,
    contactId: string,
    tripId: string,
  ): Promise<void> {
    const contact = await prisma.contact.findFirst({
      where: tenantScope(tenantId, { id: contactId }),
      select: {
        id: true,
        firstName: true,
        phone: true,
        whatsappPhone: true,
        smsOptIn: true,
        whatsappOptIn: true,
        doNotContact: true,
      },
    })

    if (!contact || contact.doNotContact) return

    const trip = await prisma.trip.findFirst({
      where: tenantScope(tenantId, { id: tripId }),
      select: { originIcao: true, destinationIcao: true, departureAt: true },
    })

    const route = trip
      ? `${trip.originIcao} → ${trip.destinationIcao}`
      : 'an upcoming flight'

    const depDate = trip
      ? new Date(trip.departureAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : ''

    // SMS solicitation
    if (contact.phone && !contact.smsOptIn) {
      const msg = [
        `AeroComm: You've been added as a passenger on ${route}${depDate ? ` on ${depDate}` : ''}.`,
        `Reply YES to receive flight notifications (reminders, boarding, delays).`,
        `Reply STOP to decline. Msg & data rates may apply.`,
      ].join(' ')

      try {
        // Send directly via smsSender — the opt-in guard in smsSender checks
        // smsOptIn, which is false here, so we use the raw Twilio integration.
        // We import and call the underlying integration directly to bypass the guard
        // only for solicitation messages.
        await sendSolicitationSms(contact.phone, msg, tenantId)
        logger.info(`SMS opt-in solicitation sent to contact ${contact.id}`)
      } catch (err) {
        logger.warn(`Failed to send SMS opt-in solicitation to ${contact.id}`, { error: err })
        // Non-fatal — don't block the passenger add
      }
    }

    // WhatsApp solicitation
    if (contact.whatsappPhone && !contact.whatsappOptIn) {
      const msg = [
        `AeroComm: You've been added as a passenger on ${route}${depDate ? ` on ${depDate}` : ''}.`,
        `Reply YES to receive flight notifications via WhatsApp (reminders, boarding, delays).`,
        `Reply STOP to decline.`,
      ].join(' ')

      try {
        await sendSolicitationWhatsApp(contact.whatsappPhone, msg, tenantId)
        logger.info(`WhatsApp opt-in solicitation sent to contact ${contact.id}`)
      } catch (err) {
        logger.warn(`Failed to send WhatsApp opt-in solicitation to ${contact.id}`, { error: err })
      }
    }
  }
}

/**
 * Send SMS bypassing the opt-in guard — used only for solicitation messages.
 * These are the one case where we're allowed to message an unenrolled number.
 */
async function sendSolicitationSms(to: string, body: string, tenantId: string): Promise<void> {
  // Reuse the smsSender internals but skip the opt-in check by calling the
  // underlying integration directly. We access smsSender's integration via
  // a thin wrapper that doesn't check opt-in status.
  const { env } = await import('../../config/env')
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    logger.warn('Twilio not configured — skipping SMS opt-in solicitation')
    return
  }
  const { TwilioIntegration } = await import('../../integrations/twilio')
  const twilio = new TwilioIntegration()
  await twilio.connect({
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    fromPhone: env.TWILIO_PHONE_NUMBER,
    whatsappFrom: env.TWILIO_WHATSAPP_FROM ?? '',
  })
  await twilio.sendMessage({ to, body })
}

async function sendSolicitationWhatsApp(to: string, body: string, tenantId: string): Promise<void> {
  const { env } = await import('../../config/env')
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    logger.warn('Twilio WhatsApp not configured — skipping WhatsApp opt-in solicitation')
    return
  }
  const { TwilioIntegration } = await import('../../integrations/twilio')
  const twilio = new TwilioIntegration()
  await twilio.connect({
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    fromPhone: env.TWILIO_PHONE_NUMBER ?? '',
    whatsappFrom: env.TWILIO_WHATSAPP_FROM,
  })
  const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  await twilio.sendMessage({ to: whatsappTo, body })
}

export const optInService = new OptInService()
