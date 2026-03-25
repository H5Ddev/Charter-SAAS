@description('Resource name prefix')
param prefix string

@description('Azure region')
param location string

@description('Environment: dev, staging, prod')
param environment string

@description('Resource tags')
param tags object

@description('SQL administrator login')
@secure()
param adminLogin string = 'aerocommadmin'

@description('SQL administrator password')
@secure()
param adminPassword string

// SKU locked to Basic — do not upgrade via Bicep, change manually in Portal if needed
var skuName = 'Basic'
var skuTier = 'Basic'

// ─────────────────────────────────────────────────────────────────────────────
// SQL Server
// ─────────────────────────────────────────────────────────────────────────────

resource sqlServer 'Microsoft.Sql/servers@2023-02-01-preview' = {
  name: '${prefix}-sql'
  location: location
  tags: tags
  properties: {
    administratorLogin: adminLogin
    administratorLoginPassword: adminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Firewall Rules
// ─────────────────────────────────────────────────────────────────────────────

resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2023-02-01-preview' = {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL Database
// ─────────────────────────────────────────────────────────────────────────────

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-02-01-preview' = {
  parent: sqlServer
  name: 'aerocomm'
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: environment == 'prod' ? 536870912000 : 107374182400
    zoneRedundant: environment == 'prod'
    readScale: environment == 'prod' ? 'Enabled' : 'Disabled'
    requestedBackupStorageRedundancy: environment == 'prod' ? 'Geo' : 'Local'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────────

output serverFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = sqlDatabase.name
output connectionString string = 'sqlserver://${sqlServer.properties.fullyQualifiedDomainName}:1433;database=${sqlDatabase.name};user=${adminLogin};password=${adminPassword};encrypt=true;trustServerCertificate=false'
