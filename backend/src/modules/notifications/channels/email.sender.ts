import { env } from '../../../config/env'
import { SendGridIntegration } from '../../../integrations/sendgrid'
import { logger } from '../../../shared/utils/logger'

let sendGridIntegration: SendGridIntegration | null = null

async function getSendGridIntegration(): Promise<SendGridIntegration> {
  if (!sendGridIntegration) {
    sendGridIntegration = new SendGridIntegration()
    if (!env.SENDGRID_API_KEY) {
      throw new Error('SendGrid not configured. Set SENDGRID_API_KEY.')
    }
    await sendGridIntegration.connect({
      apiKey: env.SENDGRID_API_KEY,
      fromEmail: env.SENDGRID_FROM_EMAIL ?? '',
      fromName: env.SENDGRID_FROM_NAME,
    })
  }
  return sendGridIntegration
}

export class EmailSender {
  async send(
    to: string,
    subject: string,
    body: string,
    templateId?: string,
    templateData?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const integration = await getSendGridIntegration()
      await integration.sendMessage({
        to,
        subject,
        body,
        templateId,
        templateData,
      })
      logger.info(`Email sent to ${to}`)
    } catch (err) {
      logger.error(`Failed to send email to ${to}`, { error: err })
      throw err
    }
  }
}

export const emailSender = new EmailSender()
