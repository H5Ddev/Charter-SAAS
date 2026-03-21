import { MsTeamsIntegration } from '../../../integrations/msteams'
import { logger } from '../../../shared/utils/logger'

export class TeamsSender {
  /**
   * Send a message to an MS Teams webhook URL via adaptive card.
   * @param webhookUrl - The Teams incoming webhook URL
   * @param body - Message body (plain text or JSON Adaptive Card string)
   * @param subject - Optional card title
   */
  async send(webhookUrl: string, body: string, subject?: string): Promise<void> {
    try {
      const integration = new MsTeamsIntegration()
      await integration.connect({
        webhookUrl,
        hmacSecret: '',
      })

      await integration.sendMessage({
        to: webhookUrl,
        body,
        subject,
      })

      logger.info('MS Teams message sent')
    } catch (err) {
      logger.error('Failed to send MS Teams message', { error: err })
      throw err
    }
  }
}

export const teamsSender = new TeamsSender()
