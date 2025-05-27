export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  status: CustomerStatus;
  segment: CustomerSegment;
  addresses: Address[];
  defaultShippingAddressId?: string;
  defaultBillingAddressId?: string;
  orders: OrderSummary[];
  metrics: CustomerMetrics;
  preferences: CustomerPreferences;
  tags: string[];
  createdAt: Date;
  lastActiveAt: Date;
  notes?: string;
}

export interface Address {
  id: string;
  type: 'shipping' | 'billing' | 'both';
  firstName: string;
  lastName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  date: Date;
  status: OrderStatus;
  total: number;
  itemCount: number;
  currency: string;
}

export interface CustomerMetrics {
  lifetimeValue: number;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
  returnsCount: number;
  reviewsCount: number;
  referralCount: number;
}

export interface CustomerPreferences {
  emailOptIn: boolean;
  smsOptIn: boolean;
  pushNotifications: boolean;
  preferredCategories: string[];
  preferredBrands: string[];
  sizePreferences?: SizePreferences;
  communicationLanguage: string;
}

export interface SizePreferences {
  clothing?: string;
  footwear?: string;
  accessories?: string;
}

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type CustomerStatus = 
  | 'active'
  | 'inactive'
  | 'blocked'
  | 'vip';

export type CustomerSegment = 
  | 'new'
  | 'returning'
  | 'loyal'
  | 'vip'
  | 'at_risk'
  | 'dormant';

export type OrderStatus = 
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'returned';

export interface CustomerFilter {
  segments?: CustomerSegment[];
  status?: CustomerStatus[];
  lifetimeValueRange?: {
    min: number;
    max: number;
  };
  orderCountRange?: {
    min: number;
    max: number;
  };
  lastActiveRange?: {
    from: Date;
    to: Date;
  };
  tags?: string[];
}