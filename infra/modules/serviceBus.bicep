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

// ─────────────────────────────────────────────────────────────────────────────
// Service Bus Namespace
// ─────────────────────────────────────────────────────────────────────────────

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: '${prefix}-sb'
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuName
  }
  properties: {
    minimumTlsVersion: '1.2'
    disableLocalAuth: false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Queues
// ─────────────────────────────────────────────────────────────────────────────

resource automationQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'automation-events'
  properties: {
    lockDuration: 'PT5M'
    maxSizeInMegabytes: 1024
    requiresDuplicateDetection: skuName == 'Standard'
    deadLetteringOnMessageExpiration: true
    maxDeliveryCount: 10
    defaultMessageTimeToLive: 'P14D'
  }
}

resource notificationQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'notification-events'
  properties: {
    lockDuration: 'PT5M'
    maxSizeInMegabytes: 1024
    requiresDuplicateDetection: skuName == 'Standard'
    deadLetteringOnMessageExpiration: true
    maxDeliveryCount: 10
    defaultMessageTimeToLive: 'P14D'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Authorization Rule for app access
// ─────────────────────────────────────────────────────────────────────────────

resource authRule 'Microsoft.ServiceBus/namespaces/authorizationRules@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'aerocomm-app'
  properties: {
    rights: [
      'Send'
      'Listen'
      'Manage'
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────────

output namespaceName string = serviceBusNamespace.name
output connectionString string = authRule.listKeys().primaryConnectionString
output automationQueueName string = automationQueue.name
output notificationQueueName string = notificationQueue.name
