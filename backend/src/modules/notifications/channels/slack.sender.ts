import { SlackIntegration } from '../../../integrations/slack'
import { logger } from '../../../shared/utils/logger'

export class SlackSender {
  /**
   * Send a message to a Slack webhook URL.
   * @param webhookUrl - The Slack incoming webhook URL
   * @param body - Message text (supports Slack mrkdwn)
   * @param subject - Optional subject/title
   */
  async send(webhookUrl: string, body: string, subject?: string): Promise<void> {
    try {
      const integration = new SlackIntegration()
      await integration.connect({
        webhookUrl,
        signingSecret: '',
      })

      await integration.sendMessage({
        to: webhookUrl,
        body,
        subject,
      })

      logger.info('Slack message sent')
    } catch (err) {
      logger.error('Failed to send Slack message', { error: err })
      throw err
    }
  }
}

export const slackSender = new SlackSender()
