export interface StoreMetrics {
  id: string;
  storeName: string;
  date: Date;
  sales: SalesMetrics;
  revenue: RevenueMetrics;
  traffic: TrafficMetrics;
  conversion: ConversionMetrics;
}

export interface SalesMetrics {
  totalOrders: number;
  totalItems: number;
  averageOrderValue: number;
  returnsCount: number;
  refundsCount: number;
}

export interface RevenueMetrics {
  gross: number;
  net: number;
  tax: number;
  shipping: number;
  discounts: number;
  currency: string;
}

export interface TrafficMetrics {
  visitors: number;
  uniqueVisitors: number;
  pageViews: number;
  bounceRate: number;
  averageSessionDuration: number; // in seconds
  topReferrers: Referrer[];
}

export interface Referrer {
  source: string;
  visitors: number;
  percentage: number;
}

export interface ConversionMetrics {
  conversionRate: number;
  cartAbandonmentRate: number;
  checkoutCompletionRate: number;
  averageItemsPerOrder: number;
}

export interface StorePerformance {
  daily: StoreMetrics[];
  weekly: StoreMetrics[];
  monthly: StoreMetrics[];
  yearly: StoreMetrics[];
}