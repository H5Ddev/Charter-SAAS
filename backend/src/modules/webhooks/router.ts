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

export const webhooksRouter: Router = Router()

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
// POST /api/webhooks/:tenantId/:integrationName
//
// Tenant identifier is REQUIRED in the URL so inbound events route to the
// correct tenant's integration record. Previously the handler used findFirst
// by integration type only, which sent every tenant's events to whichever
// tenant happened to be first in the table — a cross-tenant data-routing bug.
// Signature verification still gates every request, but routing is now
// unambiguous.
// ─────────────────────────────────────────────────────────────────────────────

webhooksRouter.use(webhookRateLimiter)

// Raw body needed for Stripe signature verification — must be mounted on the
// path segment Stripe actually posts to. Any tenant.
webhooksRouter.use(
  '/:tenantId/stripe',
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  require('express').raw({ type: 'application/json' }),
)

// Reject any webhook call that does not carry the tenant prefix. The old
// path `/api/webhooks/:integrationName` is no longer accepted; external
// providers must reconfigure to the new URL exposed by /api/integrations/status.
webhooksRouter.post(
  '/:integrationName',
  (req: Request, res: Response) => {
    logger.warn(`Rejected legacy tenant-less webhook call: /${req.params.integrationName}`, {
      ip: req.ip,
    })
    res.status(410).json(
      errorResponse(
        'WEBHOOK_URL_DEPRECATED',
        'Webhook URLs must now include a tenant identifier: /api/webhooks/{tenantId}/{integrationName}. Reconfigure the URL in your provider dashboard.',
      ),
    )
  },
)

webhooksRouter.post(
  '/:tenantId/:integrationName',
  async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId, integrationName } = req.params as { tenantId: string; integrationName: string }

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
          tenantId,
        })
        res.status(401).json(
          errorResponse('INVALID_SIGNATURE', 'Webhook signature verification failed'),
        )
        return
      }

      // Parse webhook event
      const webhookEvent = await integration.receiveWebhook(req)

      // Look up the integration record for THIS tenant only.
      const dbIntegration = await prisma.integration.findFirst({
        where: {
          tenantId,
          type: integrationName.toUpperCase() as never,
          isActive: true,
          deletedAt: null,
        },
      })

      if (!dbIntegration) {
        logger.warn(`No active ${integrationName} integration for tenant`, { tenantId })
        res.status(404).json(
          errorResponse(
            'INTEGRATION_NOT_CONFIGURED',
            `No active ${integrationName} integration for tenant ${tenantId}`,
          ),
        )
        return
      }

      // Persist webhook event
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

      // Publish to Service Bus for automation processing
      try {
        await eventPublisher.publish(
          env.AZURE_SERVICE_BUS_QUEUE_AUTOMATION,
          createEvent(tenantId, 'INBOUND_WEBHOOK', {
            integrationName,
            integrationId: dbIntegration.id,
            webhookEventId: webhookEvent.eventId,
            rawEventType: webhookEvent.eventType,
          }),
        )
      } catch {
        // Service Bus not configured — log and continue
        logger.warn(`Service Bus not available — webhook event not published to queue`)
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
import { twilioStatusCallbackHandler } from './twilio-status'

webhooksRouter.post('/:tenantId/twilio/inbound-sms', twilioInboundSmsHandler)
webhooksRouter.post('/:tenantId/twilio/status', twilioStatusCallbackHandler)
