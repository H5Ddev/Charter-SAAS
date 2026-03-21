import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { TwilioIntegration } from '../../integrations/twilio'
import { SendGridIntegration } from '../../integrations/sendgrid'
import { SlackIntegration } from '../../integrations/slack'
import { MsTeamsIntegration } from '../../integrations/msteams'
import { DocuSignIntegration } from '../../integrations/docusign'
import { StripeIntegration } from '../../integrations/stripe'
import { Integration } from '../../integrations/types'
import { eventPublisher } from '../../shared/events/publisher'
import { createEvent } from '../../shared/events/types'
import { errorResponse, successResponse } from '../../shared/utils/response'
import { logger } from '../../shared/utils/logger'
import { env } from '../../config/env'
import { webhookRateLimiter } from '../../shared/middleware/rateLimiter'

export const webhooksRouter = Router()

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────────
// Integration Registry
// We instantiate one integration per type. In production, each tenant
// would have their own configured instance loaded from IntegrationConfig.
// For webhooks, we instantiate with env-var based config.
// ─────────────────────────────────────────────────────────────────────────────

const integrationRegistry: Record<string, Integration> = {}

function getOrCreateIntegration(name: string): Integration | null {
  if (integrationRegistry[name]) return integrationRegistry[name]

  switch (name) {
    case 'twilio': {
      const i = new TwilioIntegration()
      if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
        void i.connect({
          accountSid: env.TWILIO_ACCOUNT_SID,
          authToken: env.TWILIO_AUTH_TOKEN,
          fromPhone: env.TWILIO_PHONE_NUMBER ?? '',
          whatsappFrom: env.TWILIO_WHATSAPP_FROM ?? '',
        })
      }
      integrationRegistry[name] = i
      return i
    }
    case 'sendgrid': {
      const i = new SendGridIntegration()
      if (env.SENDGRID_API_KEY) {
        void i.connect({
          apiKey: env.SENDGRID_API_KEY,
          fromEmail: env.SENDGRID_FROM_EMAIL ?? '',
          fromName: env.SENDGRID_FROM_NAME,
        })
      }
      integrationRegistry[name] = i
      return i
    }
    case 'slack': {
      const i = new SlackIntegration()
      if (env.SLACK_SIGNING_SECRET) {
        void i.connect({
          webhookUrl: '',
          signingSecret: env.SLACK_SIGNING_SECRET,
        })
      }
      integrationRegistry[name] = i
      return i
    }
    case 'msteams': {
      const i = new MsTeamsIntegration()
      if (env.MSTEAMS_WEBHOOK_SECRET) {
        void i.connect({
          webhookUrl: '',
          hmacSecret: env.MSTEAMS_WEBHOOK_SECRET,
        })
      }
      integrationRegistry[name] = i
      return i
    }
    case 'docusign': {
      const i = new DocuSignIntegration()
      if (env.DOCUSIGN_HMAC_KEY) {
        void i.connect({
          hmacKey: env.DOCUSIGN_HMAC_KEY,
          accountId: env.DOCUSIGN_ACCOUNT_ID ?? '',
          integrationKey: env.DOCUSIGN_INTEGRATION_KEY ?? '',
        })
      }
      integrationRegistry[name] = i
      return i
    }
    case 'stripe': {
      const i = new StripeIntegration()
      if (env.STRIPE_SECRET_KEY) {
        void i.connect({
          secretKey: env.STRIPE_SECRET_KEY,
          webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
        })
      }
      integrationRegistry[name] = i
      return i
    }
    default:
      return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic webhook handler
// POST /api/webhooks/:integrationName
// ─────────────────────────────────────────────────────────────────────────────

webhooksRouter.use(webhookRateLimiter)

// Raw body needed for signature verification
webhooksRouter.use(
  '/stripe',
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  require('express').raw({ type: 'application/json' }),
)

webhooksRouter.post(
  '/:integrationName',
  async (req: Request, res: Response, next: NextFunction) => {
    const { integrationName } = req.params as { integrationName: string }

    try {
      const integration = getOrCreateIntegration(integrationName)

      if (!integration) {
        res.status(404).json(
          errorResponse('INTEGRATION_NOT_FOUND', `Integration '${integrationName}' not found`),
        )
        return
      }

      // Verify signature
      const isValid = integration.verifySignature(req)
      if (!isValid) {
        logger.warn(`Webhook signature verification failed for ${integrationName}`, {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        })
        res.status(401).json(
          errorResponse('INVALID_SIGNATURE', 'Webhook signature verification failed'),
        )
        return
      }

      // Parse webhook event
      const webhookEvent = await integration.receiveWebhook(req)

      // Look up integration record in DB to find tenantId
      // For multi-tenant, each tenant registers their own webhook URL with a tenant token
      // Here we look up by integration type to find the first matching tenant
      const dbIntegration = await prisma.integration.findFirst({
        where: {
          type: integrationName.toUpperCase() as never,
          isActive: true,
          deletedAt: null,
        },
      })

      const tenantId = dbIntegration?.tenantId ?? 'unknown'

      // Persist webhook event
      if (dbIntegration) {
        await prisma.webhookEvent.create({
          data: {
            id: uuidv4(),
            tenantId,
            integrationId: dbIntegration.id,
            eventType: webhookEvent.eventType,
            rawBody: webhookEvent.rawBody as never,
            status: 'PENDING',
          },
        })
      }

      // Publish to Service Bus for automation processing
      if (tenantId !== 'unknown') {
        try {
          await eventPublisher.publish(
            env.AZURE_SERVICE_BUS_QUEUE_AUTOMATION,
            createEvent(tenantId, 'INBOUND_WEBHOOK', {
              integrationName,
              integrationId: dbIntegration?.id ?? '',
              webhookEventId: webhookEvent.eventId,
              rawEventType: webhookEvent.eventType,
            }),
          )
        } catch {
          // Service Bus not configured — log and continue
          logger.warn(`Service Bus not available — webhook event not published to queue`)
        }
      }

      logger.info(`Webhook processed: ${integrationName}/${webhookEvent.eventType}`, {
        eventId: webhookEvent.eventId,
        tenantId,
      })

      res.status(200).json(successResponse({ received: true }))
    } catch (err) {
      next(err)
    }
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Twilio-specific TwiML inbound SMS handler (see twilio-sms.ts)
// ─────────────────────────────────────────────────────────────────────────────

import { twilioInboundSmsHandler } from './twilio-sms'

webhooksRouter.post('/twilio/inbound-sms', twilioInboundSmsHandler)
