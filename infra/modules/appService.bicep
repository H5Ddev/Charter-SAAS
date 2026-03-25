@description('Resource name prefix')
param prefix string

@description('Azure region')
param location string

@description('Environment: dev, staging, prod')
param environment string

@description('Resource tags')
param tags object

@description('SQL connection string')
param sqlConnectionString string

@description('Redis connection string')
param redisConnectionString string

@description('Service Bus connection string')
param serviceBusConnectionString string

@description('Storage connection string')
param storageConnectionString string

@description('Key Vault URL')
param keyVaultUrl string

@description('ACR login server')
param acrLoginServer string

@description('JWT access token secret (min 32 chars)')
@secure()
param jwtAccessSecret string

@description('JWT refresh token secret (min 32 chars)')
@secure()
param jwtRefreshSecret string

@description('Allowed CORS origins (comma-separated)')
param corsOrigins string

// SKU locked to Basic B2 — do not upgrade via Bicep, change manually in Portal if needed
var appServiceSkuName = 'B2'
var appServiceSkuTier = 'Basic'
var appServiceCapacity = 1

// ─────────────────────────────────────────────────────────────────────────────
// App Service Plan
// ─────────────────────────────────────────────────────────────────────────────

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${prefix}-asp'
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: appServiceSkuName
    tier: appServiceSkuTier
    capacity: appServiceCapacity
  }
  properties: {
    reserved: true
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend App Service
// ─────────────────────────────────────────────────────────────────────────────

resource backendApp 'Microsoft.Web/sites@2023-01-01' = {
  name: '${prefix}-backend'
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/${prefix}-backend:latest'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          name: 'NODE_ENV'
          value: environment == 'dev' ? 'development' : 'production'
        }
        {
          name: 'PORT'
          value: '3000'
        }
        {
          name: 'DATABASE_URL'
          value: sqlConnectionString
        }
        {
          name: 'REDIS_URL'
          value: redisConnectionString
        }
        {
          name: 'AZURE_SERVICE_BUS_CONNECTION_STRING'
          value: serviceBusConnectionString
        }
        {
          name: 'AZURE_STORAGE_CONNECTION_STRING'
          value: storageConnectionString
        }
        {
          name: 'AZURE_KEY_VAULT_URL'
          value: keyVaultUrl
        }
        {
          name: 'WEBSITES_PORT'
          value: '3000'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acrLoginServer}'
        }
        {
          name: 'JWT_ACCESS_SECRET'
          value: jwtAccessSecret
        }
        {
          name: 'JWT_REFRESH_SECRET'
          value: jwtRefreshSecret
        }
        {
          name: 'CORS_ORIGINS'
          value: corsOrigins
        }
      ]
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontend App Service
// ─────────────────────────────────────────────────────────────────────────────

resource frontendApp 'Microsoft.Web/sites@2023-01-01' = {
  name: '${prefix}-frontend'
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/${prefix}-frontend:latest'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          name: 'VITE_API_BASE_URL'
          value: 'https://${prefix}-backend.azurewebsites.net'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acrLoginServer}'
        }
        {
          name: 'WEBSITES_PORT'
          value: '80'
        }
      ]
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-scale settings (prod only)
// ─────────────────────────────────────────────────────────────────────────────

resource autoScaleSettings 'Microsoft.Insights/autoscalesettings@2022-10-01' = if (environment == 'prod') {
  name: '${prefix}-autoscale'
  location: location
  tags: tags
  properties: {
    enabled: true
    targetResourceUri: appServicePlan.id
    profiles: [
      {
        name: 'Default'
        capacity: {
          minimum: '2'
          maximum: '10'
          default: '2'
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 70
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: 30
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT10M'
            }
          }
        ]
      }
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────────

output backendUrl string = 'https://${backendApp.properties.defaultHostName}'
output frontendUrl string = 'https://${frontendApp.properties.defaultHostName}'
output principalId string = backendApp.identity.principalId
output backendAppName string = backendApp.name
output frontendAppName string = frontendApp.name
