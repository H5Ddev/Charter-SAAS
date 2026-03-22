@description('Environment name: dev, staging, or prod')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Application name used for resource naming')
param appName string = 'aerocomm'

@description('SQL administrator password — pass from GitHub secret SQL_ADMIN_PASSWORD')
@secure()
param sqlAdminPassword string

var prefix = '${appName}-${environment}'
// Computed ahead of time to break the appService <-> keyVault circular dependency
var keyVaultUri = 'https://${prefix}-kv${az.environment().suffixes.keyvaultDns}/'
var tags = {
  environment: environment
  application: appName
  managedBy: 'bicep'
}

// ─────────────────────────────────────────────────────────────────────────────
// Modules
// ─────────────────────────────────────────────────────────────────────────────

module sqlDatabase 'modules/sqlDatabase.bicep' = {
  name: 'sqlDatabase'
  params: {
    prefix: prefix
    location: location
    environment: environment
    tags: tags
    adminPassword: sqlAdminPassword
  }
}

module redis 'modules/redis.bicep' = {
  name: 'redis'
  params: {
    prefix: prefix
    location: location
    environment: environment
    tags: tags
  }
}

module serviceBus 'modules/serviceBus.bicep' = {
  name: 'serviceBus'
  params: {
    prefix: prefix
    location: location
    environment: environment
    tags: tags
  }
}

module blobStorage 'modules/blobStorage.bicep' = {
  name: 'blobStorage'
  params: {
    prefix: prefix
    location: location
    tags: tags
  }
}

module keyVault 'modules/keyVault.bicep' = {
  name: 'keyVault'
  params: {
    prefix: prefix
    location: location
    tags: tags
    appServicePrincipalId: appService.outputs.principalId
  }
}

module containerRegistry 'modules/containerRegistry.bicep' = {
  name: 'containerRegistry'
  params: {
    prefix: appName
    location: location
    tags: tags
  }
}

module appService 'modules/appService.bicep' = {
  name: 'appService'
  params: {
    prefix: prefix
    location: location
    environment: environment
    tags: tags
    sqlConnectionString: sqlDatabase.outputs.connectionString
    redisConnectionString: redis.outputs.connectionString
    serviceBusConnectionString: serviceBus.outputs.connectionString
    storageConnectionString: blobStorage.outputs.connectionString
    keyVaultUrl: keyVaultUri
    acrLoginServer: containerRegistry.outputs.loginServer
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────────

output backendUrl string = appService.outputs.backendUrl
output frontendUrl string = appService.outputs.frontendUrl
output sqlServerFqdn string = sqlDatabase.outputs.serverFqdn
output keyVaultUri string = keyVault.outputs.vaultUri
output acrLoginServer string = containerRegistry.outputs.loginServer
