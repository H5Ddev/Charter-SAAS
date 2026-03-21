@description('Resource name prefix')
param prefix string

@description('Azure region')
param location string

@description('Environment: dev, staging, prod')
param environment string

@description('Resource tags')
param tags object

// SKU based on environment
var skuName = environment == 'dev' ? 'Basic' : 'Standard'
var skuFamily = 'C'
var skuCapacity = environment == 'dev' ? 0 : 2

// ─────────────────────────────────────────────────────────────────────────────
// Azure Cache for Redis
// ─────────────────────────────────────────────────────────────────────────────

resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: '${prefix}-redis'
  location: location
  tags: tags
  properties: {
    sku: {
      name: skuName
      family: skuFamily
      capacity: skuCapacity
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────────

output hostName string = redisCache.properties.hostName
output sslPort int = redisCache.properties.sslPort
output connectionString string = '${redisCache.properties.hostName}:${redisCache.properties.sslPort},password=${redisCache.listKeys().primaryKey},ssl=True,abortConnect=False'
