export interface Integration {
  id: string;
  platform: IntegrationPlatform;
  name: string;
  description: string;
  status: IntegrationStatus;
  category: IntegrationCategory;
  config: IntegrationConfig;
  metrics: IntegrationMetrics;
  lastSync?: Date;
  nextSync?: Date;
  createdAt: Date;
  updatedAt: Date;
  errors?: IntegrationError[];
}

export interface IntegrationConfig {
  apiKey?: string;
  apiSecret?: string;
  webhookUrl?: string;
  storeUrl?: string;
  accountId?: string;
  settings: Record<string, any>;
  syncFrequency: SyncFrequency;
  syncDirection: SyncDirection;
  dataTypes: DataType[];
}

export interface IntegrationMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastSyncDuration?: number; // in seconds
  averageSyncDuration: number;
  itemsSynced: {
    products?: number;
    orders?: number;
    customers?: number;
    inventory?: number;
  };
}

export interface IntegrationError {
  code: string;
  message: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

export type IntegrationPlatform = 
  | 'shopify'
  | 'woocommerce'
  | 'magento'
  | 'bigcommerce'
  | 'stripe'
  | 'paypal'
  | 'square'
  | 'mailchimp'
  | 'klaviyo'
  | 'google_analytics'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'amazon'
  | 'ebay'
  | 'quickbooks'
  | 'xero'
  | 'shipstation'
  | 'ups'
  | 'fedex';

export type IntegrationStatus = 
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'syncing'
  | 'pending'
  | 'paused';

export type IntegrationCategory = 
  | 'ecommerce'
  | 'payment'
  | 'marketing'
  | 'analytics'
  | 'social'
  | 'marketplace'
  | 'accounting'
  | 'shipping'
  | 'inventory';

export type SyncFrequency = 
  | 'realtime'
  | 'every_5_minutes'
  | 'every_15_minutes'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'manual';

export type SyncDirection = 
  | 'import'
  | 'export'
  | 'bidirectional';

export type DataType = 
  | 'products'
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'payments'
  | 'shipping'
  | 'taxes'
  | 'analytics';

export interface IntegrationSummary {
  total: number;
  connected: number;
  errors: number;
  byCategory: Record<IntegrationCategory, number>;
  recentActivity: IntegrationActivity[];
}

export interface IntegrationActivity {
  integrationId: string;
  platform: IntegrationPlatform;
  action: 'connected' | 'disconnected' | 'synced' | 'error';
  timestamp: Date;
  details?: string;
}