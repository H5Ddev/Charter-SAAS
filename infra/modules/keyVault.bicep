@description('Resource name prefix')
param prefix string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Principal ID of the App Service managed identity')
param appServicePrincipalId string

// ─────────────────────────────────────────────────────────────────────────────
// Key Vault
// ─────────────────────────────────────────────────────────────────────────────

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${prefix}-kv'
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RBAC: Key Vault Secrets User role for App Service
// ─────────────────────────────────────────────────────────────────────────────

var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource appServiceKeyVaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appServicePrincipalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: appServicePrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────────

output vaultUri string = keyVault.properties.vaultUri
output keyVaultName string = keyVault.name
