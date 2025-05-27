import { 
  Integration, 
  IntegrationPlatform, 
  IntegrationStatus, 
  IntegrationCategory,
  SyncFrequency,
  IntegrationSummary,
  IntegrationActivity
} from '../types/integration';

const integrationConfigs: Array<{
  platform: IntegrationPlatform;
  name: string;
  description: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  syncFrequency: SyncFrequency;
}> = [
  {
    platform: 'shopify',
    name: 'Shopify Store',
    description: 'Main e-commerce platform for product catalog and order management',
    category: 'ecommerce',
    status: 'connected',
    syncFrequency: 'realtime',
  },
  {
    platform: 'stripe',
    name: 'Stripe Payments',
    description: 'Primary payment processor for credit card transactions',
    category: 'payment',
    status: 'connected',
    syncFrequency: 'realtime',
  },
  {
    platform: 'paypal',
    name: 'PayPal Checkout',
    description: 'Alternative payment method for customer convenience',
    category: 'payment',
    status: 'connected',
    syncFrequency: 'realtime',
  },
  {
    platform: 'mailchimp',
    name: 'Mailchimp Marketing',
    description: 'Email marketing campaigns and newsletter management',
    category: 'marketing',
    status: 'connected',
    syncFrequency: 'daily',
  },
  {
    platform: 'google_analytics',
    name: 'Google Analytics 4',
    description: 'Website traffic and conversion tracking',
    category: 'analytics',
    status: 'connected',
    syncFrequency: 'realtime',
  },
  {
    platform: 'facebook',
    name: 'Facebook Shop',
    description: 'Social commerce integration for Facebook marketplace',
    category: 'social',
    status: 'syncing',
    syncFrequency: 'hourly',
  },
  {
    platform: 'instagram',
    name: 'Instagram Shopping',
    description: 'Product tagging and shopping on Instagram',
    category: 'social',
    status: 'connected',
    syncFrequency: 'hourly',
  },
  {
    platform: 'klaviyo',
    name: 'Klaviyo Email',
    description: 'Advanced email marketing and segmentation',
    category: 'marketing',
    status: 'pending',
    syncFrequency: 'every_15_minutes',
  },
  {
    platform: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Accounting and financial reporting',
    category: 'accounting',
    status: 'connected',
    syncFrequency: 'daily',
  },
  {
    platform: 'shipstation',
    name: 'ShipStation',
    description: 'Multi-carrier shipping and fulfillment management',
    category: 'shipping',
    status: 'connected',
    syncFrequency: 'every_5_minutes',
  },
  {
    platform: 'amazon',
    name: 'Amazon Marketplace',
    description: 'Sell products on Amazon marketplace',
    category: 'marketplace',
    status: 'error',
    syncFrequency: 'every_15_minutes',
  },
  {
    platform: 'fedex',
    name: 'FedEx Shipping',
    description: 'FedEx shipping rates and label generation',
    category: 'shipping',
    status: 'paused',
    syncFrequency: 'realtime',
  },
];

function generateIntegration(config: typeof integrationConfigs[0], index: number): Integration {
  const createdDate = new Date(Date.now() - (180 - index * 10) * 24 * 60 * 60 * 1000);
  const lastSyncDate = config.status === 'connected' || config.status === 'syncing' 
    ? new Date(Date.now() - Math.floor(Math.random() * 3600000)) // Within last hour
    : config.status === 'error'
    ? new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
    : undefined;
    
  const nextSyncDate = config.status === 'connected'
    ? new Date(Date.now() + getSyncInterval(config.syncFrequency))
    : undefined;
  
  const totalSyncs = Math.floor(Math.random() * 1000) + 100;
  const failedSyncs = config.status === 'error' ? Math.floor(totalSyncs * 0.1) : Math.floor(totalSyncs * 0.01);
  
  return {
    id: `int-${config.platform}-${index}`,
    platform: config.platform,
    name: config.name,
    description: config.description,
    status: config.status,
    category: config.category,
    config: {
      apiKey: config.status !== 'pending' ? `****${Math.random().toString(36).substr(2, 4)}` : undefined,
      apiSecret: config.status !== 'pending' ? `****${Math.random().toString(36).substr(2, 4)}` : undefined,
      webhookUrl: `https://api.vogueboutique.com/webhooks/${config.platform}`,
      storeUrl: config.category === 'ecommerce' ? 'https://vogueboutique.com' : undefined,
      accountId: `ACC-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      settings: {
        autoSync: true,
        syncProducts: true,
        syncOrders: true,
        syncCustomers: config.category === 'marketing' || config.category === 'ecommerce',
        syncInventory: config.category === 'ecommerce' || config.category === 'marketplace',
      },
      syncFrequency: config.syncFrequency,
      syncDirection: config.category === 'analytics' ? 'export' : 
                     config.category === 'accounting' ? 'export' : 'bidirectional',
      dataTypes: getDataTypes(config.category),
    },
    metrics: {
      totalSyncs: totalSyncs,
      successfulSyncs: totalSyncs - failedSyncs,
      failedSyncs: failedSyncs,
      lastSyncDuration: config.status === 'connected' ? Math.floor(Math.random() * 300) + 10 : undefined,
      averageSyncDuration: Math.floor(Math.random() * 180) + 30,
      itemsSynced: {
        products: config.category === 'ecommerce' || config.category === 'marketplace' ? Math.floor(Math.random() * 500) + 100 : undefined,
        orders: config.category === 'ecommerce' || config.category === 'payment' ? Math.floor(Math.random() * 1000) + 200 : undefined,
        customers: config.category === 'marketing' || config.category === 'ecommerce' ? Math.floor(Math.random() * 2000) + 500 : undefined,
        inventory: config.category === 'ecommerce' ? Math.floor(Math.random() * 1000) + 200 : undefined,
      },
    },
    lastSync: lastSyncDate,
    nextSync: nextSyncDate,
    createdAt: createdDate,
    updatedAt: lastSyncDate || createdDate,
    errors: config.status === 'error' ? [
      {
        code: 'AUTH_FAILED',
        message: 'Authentication failed. Please check your API credentials.',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        severity: 'high',
        resolved: false,
      },
      {
        code: 'RATE_LIMIT',
        message: 'API rate limit exceeded. Sync will retry in 1 hour.',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        severity: 'medium',
        resolved: false,
      },
    ] : undefined,
  };
}

function getSyncInterval(frequency: SyncFrequency): number {
  switch (frequency) {
    case 'realtime': return 0;
    case 'every_5_minutes': return 5 * 60 * 1000;
    case 'every_15_minutes': return 15 * 60 * 1000;
    case 'hourly': return 60 * 60 * 1000;
    case 'daily': return 24 * 60 * 60 * 1000;
    case 'weekly': return 7 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

function getDataTypes(category: IntegrationCategory): Array<'products' | 'orders' | 'customers' | 'inventory' | 'payments' | 'shipping' | 'taxes' | 'analytics'> {
  switch (category) {
    case 'ecommerce':
      return ['products', 'orders', 'customers', 'inventory'];
    case 'payment':
      return ['payments', 'orders'];
    case 'marketing':
      return ['customers', 'analytics'];
    case 'analytics':
      return ['analytics'];
    case 'marketplace':
      return ['products', 'orders', 'inventory'];
    case 'accounting':
      return ['orders', 'payments', 'taxes'];
    case 'shipping':
      return ['shipping', 'orders'];
    default:
      return [];
  }
}

export function generateIntegrations(): Integration[] {
  return integrationConfigs.map((config, index) => generateIntegration(config, index));
}

export function generateIntegrationSummary(integrations: Integration[]): IntegrationSummary {
  const summary: IntegrationSummary = {
    total: integrations.length,
    connected: integrations.filter(i => i.status === 'connected').length,
    errors: integrations.filter(i => i.status === 'error').length,
    byCategory: {} as Record<IntegrationCategory, number>,
    recentActivity: [],
  };
  
  // Count by category
  const categories: IntegrationCategory[] = [
    'ecommerce', 'payment', 'marketing', 'analytics', 
    'social', 'marketplace', 'accounting', 'shipping', 'inventory'
  ];
  
  categories.forEach(category => {
    summary.byCategory[category] = integrations.filter(i => i.category === category).length;
  });
  
  // Generate recent activity
  const activities: IntegrationActivity[] = [
    {
      integrationId: 'int-shopify-0',
      platform: 'shopify',
      action: 'synced',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      details: 'Synced 45 new orders',
    },
    {
      integrationId: 'int-stripe-1',
      platform: 'stripe',
      action: 'synced',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      details: 'Processed 12 payments',
    },
    {
      integrationId: 'int-amazon-10',
      platform: 'amazon',
      action: 'error',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      details: 'Authentication failed',
    },
    {
      integrationId: 'int-klaviyo-7',
      platform: 'klaviyo',
      action: 'connected',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      details: 'Successfully connected',
    },
    {
      integrationId: 'int-fedex-11',
      platform: 'fedex',
      action: 'disconnected',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      details: 'Paused by user',
    },
  ];
  
  summary.recentActivity = activities;
  
  return summary;
}

// Export consistent mock data
export const mockIntegrations = generateIntegrations();
export const mockIntegrationSummary = generateIntegrationSummary(mockIntegrations);

// Helper functions
export function getConnectedIntegrations(): Integration[] {
  return mockIntegrations.filter(i => i.status === 'connected');
}

export function getIntegrationsByCategory(category: IntegrationCategory): Integration[] {
  return mockIntegrations.filter(i => i.category === category);
}

export function getIntegrationsWithErrors(): Integration[] {
  return mockIntegrations.filter(i => i.status === 'error');
}

export function getRealtimeIntegrations(): Integration[] {
  return mockIntegrations.filter(i => i.config.syncFrequency === 'realtime');
}