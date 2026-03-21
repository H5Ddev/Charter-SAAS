import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity'
import { SecretClient } from '@azure/keyvault-secrets'
import { ServiceBusClient } from '@azure/service-bus'
import { BlobServiceClient } from '@azure/storage-blob'
import { env } from './env'
import { logger } from '../shared/utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// Azure Credential
// In production: DefaultAzureCredential uses Managed Identity automatically.
// In development: falls back to env vars (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID).
// ─────────────────────────────────────────────────────────────────────────────

function getAzureCredential() {
  if (
    env.NODE_ENV !== 'production' &&
    env.AZURE_CLIENT_ID &&
    env.AZURE_CLIENT_SECRET &&
    env.AZURE_TENANT_ID
  ) {
    return new ClientSecretCredential(
      env.AZURE_TENANT_ID,
      env.AZURE_CLIENT_ID,
      env.AZURE_CLIENT_SECRET,
    )
  }
  return new DefaultAzureCredential()
}

// ─────────────────────────────────────────────────────────────────────────────
// Key Vault Client
// ─────────────────────────────────────────────────────────────────────────────

let keyVaultClient: SecretClient | null = null

export function getKeyVaultClient(): SecretClient {
  if (!keyVaultClient) {
    if (!env.AZURE_KEY_VAULT_URL) {
      throw new Error('AZURE_KEY_VAULT_URL is not configured')
    }
    const credential = getAzureCredential()
    keyVaultClient = new SecretClient(env.AZURE_KEY_VAULT_URL, credential)
    logger.info('Azure Key Vault client initialised')
  }
  return keyVaultClient
}

export async function getSecret(secretName: string): Promise<string> {
  const client = getKeyVaultClient()
  const secret = await client.getSecret(secretName)
  if (!secret.value) {
    throw new Error(`Secret '${secretName}' has no value in Key Vault`)
  }
  return secret.value
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Bus Client
// ─────────────────────────────────────────────────────────────────────────────

let serviceBusClient: ServiceBusClient | null = null

export function getServiceBusClient(): ServiceBusClient {
  if (!serviceBusClient) {
    if (!env.AZURE_SERVICE_BUS_CONNECTION_STRING) {
      logger.warn('AZURE_SERVICE_BUS_CONNECTION_STRING not configured — Service Bus disabled')
      throw new Error('Service Bus is not configured')
    }
    serviceBusClient = new ServiceBusClient(env.AZURE_SERVICE_BUS_CONNECTION_STRING)
    logger.info('Azure Service Bus client initialised')
  }
  return serviceBusClient
}

export async function closeServiceBusClient(): Promise<void> {
  if (serviceBusClient) {
    await serviceBusClient.close()
    serviceBusClient = null
    logger.info('Azure Service Bus client closed')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Blob Storage Client
// ─────────────────────────────────────────────────────────────────────────────

let blobServiceClient: BlobServiceClient | null = null

export function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    if (!env.AZURE_STORAGE_CONNECTION_STRING) {
      logger.warn('AZURE_STORAGE_CONNECTION_STRING not configured — Blob Storage disabled')
      throw new Error('Azure Blob Storage is not configured')
    }
    blobServiceClient = BlobServiceClient.fromConnectionString(env.AZURE_STORAGE_CONNECTION_STRING)
    logger.info('Azure Blob Storage client initialised')
  }
  return blobServiceClient
}

export async function uploadBlob(
  containerName: string,
  blobName: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const client = getBlobServiceClient()
  const containerClient = client.getContainerClient(containerName)
  await containerClient.createIfNotExists()
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)
  await blockBlobClient.upload(data, data.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  })
  return blockBlobClient.url
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialise all Azure clients on startup
// ─────────────────────────────────────────────────────────────────────────────

export async function initAzureClients(): Promise<void> {
  if (env.AZURE_KEY_VAULT_URL) {
    try {
      getKeyVaultClient()
    } catch (err) {
      logger.warn('Key Vault client initialisation skipped:', err)
    }
  }

  if (env.AZURE_SERVICE_BUS_CONNECTION_STRING) {
    try {
      getServiceBusClient()
    } catch (err) {
      logger.warn('Service Bus client initialisation skipped:', err)
    }
  }

  if (env.AZURE_STORAGE_CONNECTION_STRING) {
    try {
      getBlobServiceClient()
    } catch (err) {
      logger.warn('Blob Storage client initialisation skipped:', err)
    }
  }
}
