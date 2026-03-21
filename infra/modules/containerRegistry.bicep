@description('Resource name prefix (without environment — ACR is shared)')
param prefix string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

// ─────────────────────────────────────────────────────────────────────────────
// Azure Container Registry
// ─────────────────────────────────────────────────────────────────────────────

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${replace(prefix, '-', '')}acr'
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
    zoneRedundancy: 'Disabled'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────────

output loginServer string = containerRegistry.properties.loginServer
output registryName string = containerRegistry.name
output adminUsername string = containerRegistry.listCredentials().username
