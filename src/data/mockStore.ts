import { StoreMetrics, StorePerformance } from '../types/store';

function generateStoreMetrics(date: Date, multiplier: number = 1): StoreMetrics {
  const baseVisitors = 1000 + Math.floor(Math.random() * 500);
  const conversionRate = 0.02 + Math.random() * 0.03; // 2-5% conversion rate
  const orders = Math.floor(baseVisitors * conversionRate * multiplier);
  
  return {
    id: `metrics-${date.toISOString().split('T')[0]}`,
    storeName: 'Vogue Boutique',
    date: date,
    sales: {
      totalOrders: orders,
      totalItems: orders * (2 + Math.floor(Math.random() * 3)),
      averageOrderValue: 75 + Math.random() * 50,
      returnsCount: Math.floor(orders * 0.05),
      refundsCount: Math.floor(orders * 0.02),
    },
    revenue: {
      gross: orders * (75 + Math.random() * 50),
      net: orders * (65 + Math.random() * 45),
      tax: orders * (7 + Math.random() * 3),
      shipping: orders * (5 + Math.random() * 5),
      discounts: orders * (5 + Math.random() * 10),
      currency: 'USD',
    },
    traffic: {
      visitors: baseVisitors * multiplier,
      uniqueVisitors: Math.floor(baseVisitors * 0.85 * multiplier),
      pageViews: baseVisitors * multiplier * (3 + Math.random() * 2),
      bounceRate: 0.3 + Math.random() * 0.2,
      averageSessionDuration: 180 + Math.random() * 120,
      topReferrers: [
        { source: 'Google', visitors: Math.floor(baseVisitors * 0.4), percentage: 40 },
        { source: 'Instagram', visitors: Math.floor(baseVisitors * 0.25), percentage: 25 },
        { source: 'Facebook', visitors: Math.floor(baseVisitors * 0.15), percentage: 15 },
        { source: 'Direct', visitors: Math.floor(baseVisitors * 0.12), percentage: 12 },
        { source: 'Email', visitors: Math.floor(baseVisitors * 0.08), percentage: 8 },
      ],
    },
    conversion: {
      conversionRate: conversionRate,
      cartAbandonmentRate: 0.65 + Math.random() * 0.1,
      checkoutCompletionRate: 0.85 + Math.random() * 0.1,
      averageItemsPerOrder: 2 + Math.random() * 2,
    },
  };
}

export function generateDailyMetrics(days: number = 30): StoreMetrics[] {
  const metrics: StoreMetrics[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Weekend boost
    const dayOfWeek = date.getDay();
    const multiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.3 : 1;
    
    metrics.push(generateStoreMetrics(date, multiplier));
  }
  
  return metrics;
}

export function generateWeeklyMetrics(weeks: number = 12): StoreMetrics[] {
  const metrics: StoreMetrics[] = [];
  const today = new Date();
  
  for (let i = weeks - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - (i * 7));
    
    // Seasonal variations
    const month = date.getMonth();
    const multiplier = (month === 11 || month === 0) ? 1.5 : // Holiday season
                      (month >= 5 && month <= 7) ? 1.2 : // Summer
                      1;
    
    metrics.push(generateStoreMetrics(date, multiplier * 7));
  }
  
  return metrics;
}

export function generateMonthlyMetrics(months: number = 12): StoreMetrics[] {
  const metrics: StoreMetrics[] = [];
  const today = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setMonth(date.getMonth() - i);
    
    // Seasonal variations
    const month = date.getMonth();
    const multiplier = (month === 11) ? 2.0 : // December
                      (month === 10) ? 1.8 : // November
                      (month === 0) ? 1.4 :  // January (sales)
                      1;
    
    metrics.push(generateStoreMetrics(date, multiplier * 30));
  }
  
  return metrics;
}

export function generateYearlyMetrics(years: number = 3): StoreMetrics[] {
  const metrics: StoreMetrics[] = [];
  const today = new Date();
  
  for (let i = years - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setFullYear(date.getFullYear() - i);
    
    // Growth over years
    const growthMultiplier = Math.pow(1.15, years - i - 1);
    
    metrics.push(generateStoreMetrics(date, growthMultiplier * 365));
  }
  
  return metrics;
}

export function generateStorePerformance(): StorePerformance {
  return {
    daily: generateDailyMetrics(30),
    weekly: generateWeeklyMetrics(12),
    monthly: generateMonthlyMetrics(12),
    yearly: generateYearlyMetrics(3),
  };
}

// Export a consistent mock store performance dataset
export const mockStorePerformance = generateStorePerformance();