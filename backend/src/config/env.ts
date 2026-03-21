import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug', 'silent']).default('info'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Azure AD B2C (optional — only required for SSO flows)
  AZURE_AD_B2C_TENANT_NAME: z.string().optional(),
  AZURE_AD_B2C_CLIENT_ID: z.string().optional(),
  AZURE_AD_B2C_CLIENT_SECRET: z.string().optional(),
  AZURE_AD_B2C_POLICY_SIGNIN: z.string().default('B2C_1_signin'),
  AZURE_AD_B2C_POLICY_SIGNUP: z.string().default('B2C_1_signup'),

  // Azure Key Vault (optional in development)
  AZURE_KEY_VAULT_URL: z.string().url().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  AZURE_TENANT_ID: z.string().optional(),

  // Azure Service Bus
  AZURE_SERVICE_BUS_CONNECTION_STRING: z.string().optional(),
  AZURE_SERVICE_BUS_QUEUE_AUTOMATION: z.string().default('automation-events'),
  AZURE_SERVICE_BUS_QUEUE_NOTIFICATIONS: z.string().default('notification-events'),

  // Azure Blob Storage
  AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),
  AZURE_STORAGE_CONTAINER_DOCUMENTS: z.string().default('documents'),
  AZURE_STORAGE_CONTAINER_PHOTOS: z.string().default('photos'),

  // Azure Container Registry
  ACR_LOGIN_SERVER: z.string().optional(),
  ACR_USERNAME: z.string().optional(),
  ACR_PASSWORD: z.string().optional(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TWILIO_WEBHOOK_SECRET: z.string().optional(),

  // SendGrid
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  SENDGRID_FROM_NAME: z.string().default('AeroComm'),

  // Slack
  SLACK_SIGNING_SECRET: z.string().optional(),

  // MS Teams
  MSTEAMS_WEBHOOK_SECRET: z.string().optional(),

  // DocuSign
  DOCUSIGN_HMAC_KEY: z.string().optional(),
  DOCUSIGN_ACCOUNT_ID: z.string().optional(),
  DOCUSIGN_INTEGRATION_KEY: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // ForeFlight (stub)
  FOREFLIGHT_API_KEY: z.string().optional(),
  FOREFLIGHT_BASE_URL: z.string().url().default('https://plan.foreflight.com/api'),

  // Weather API (stub)
  WEATHER_API_KEY: z.string().optional(),
  WEATHER_API_BASE_URL: z.string().url().default('https://api.weather.gov'),

  // MFA / TOTP
  TOTP_APP_NAME: z.string().default('AeroComm'),
  TOTP_ISSUER: z.string().default('AeroComm'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX: z.string().default('100').transform(Number),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),

  // Session / CSRF
  CSRF_SECRET: z.string().min(16).optional(),
  SESSION_SECRET: z.string().min(16).optional(),
})

function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n')

    throw new Error(`Environment validation failed:\n${errors}`)
  }

  return result.data
}

export const env = validateEnv()

export type Env = z.infer<typeof envSchema>
