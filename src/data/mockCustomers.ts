import { 
  Customer, 
  CustomerSegment, 
  CustomerStatus, 
  Gender,
  OrderStatus,
  OrderSummary,
  Address 
} from '../types/customer';

const firstNames = {
  male: ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles'],
  female: ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen'],
};

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
];

const cities = [
  { city: 'New York', state: 'NY' },
  { city: 'Los Angeles', state: 'CA' },
  { city: 'Chicago', state: 'IL' },
  { city: 'Houston', state: 'TX' },
  { city: 'Phoenix', state: 'AZ' },
  { city: 'Philadelphia', state: 'PA' },
  { city: 'San Antonio', state: 'TX' },
  { city: 'San Diego', state: 'CA' },
  { city: 'Dallas', state: 'TX' },
  { city: 'San Francisco', state: 'CA' },
];

const streetNames = ['Main', 'Oak', 'Maple', 'Elm', 'Park', 'Pine', 'Cedar', 'Birch', 'Walnut', 'Cherry'];
const streetTypes = ['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Way', 'Ct', 'Pl'];

function generateAddress(isPrimary: boolean = false): Address {
  const city = cities[Math.floor(Math.random() * cities.length)];
  const streetNumber = Math.floor(Math.random() * 9999) + 1;
  const streetName = streetNames[Math.floor(Math.random() * streetNames.length)];
  const streetType = streetTypes[Math.floor(Math.random() * streetTypes.length)];
  
  return {
    id: `addr-${Math.random().toString(36).substr(2, 9)}`,
    type: Math.random() > 0.7 ? 'both' : (Math.random() > 0.5 ? 'shipping' : 'billing'),
    firstName: firstNames.male[Math.floor(Math.random() * firstNames.male.length)],
    lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
    company: Math.random() > 0.8 ? 'Acme Corp' : undefined,
    addressLine1: `${streetNumber} ${streetName} ${streetType}`,
    addressLine2: Math.random() > 0.7 ? `Apt ${Math.floor(Math.random() * 99) + 1}` : undefined,
    city: city.city,
    state: city.state,
    postalCode: `${Math.floor(Math.random() * 90000) + 10000}`,
    country: 'USA',
    phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    isDefault: isPrimary,
  };
}

function generateOrderHistory(customerId: string, segment: CustomerSegment): OrderSummary[] {
  const orderCount = segment === 'vip' ? 20 + Math.floor(Math.random() * 30) :
                    segment === 'loyal' ? 10 + Math.floor(Math.random() * 10) :
                    segment === 'returning' ? 3 + Math.floor(Math.random() * 5) :
                    segment === 'new' ? 1 :
                    0;
  
  const orders: OrderSummary[] = [];
  const now = Date.now();
  
  for (let i = 0; i < orderCount; i++) {
    const daysAgo = Math.floor(Math.random() * 365);
    const orderDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    
    const statuses: OrderStatus[] = ['delivered', 'delivered', 'delivered', 'shipped', 'processing', 'cancelled', 'returned'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    orders.push({
      id: `order-${customerId}-${i + 1}`,
      orderNumber: `ORD-${Date.now()}-${i + 1}`,
      date: orderDate,
      status: status,
      total: 50 + Math.random() * 300,
      itemCount: 1 + Math.floor(Math.random() * 5),
      currency: 'USD',
    });
  }
  
  return orders.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function determineSegment(totalOrders: number, lastOrderDays: number): CustomerSegment {
  if (totalOrders === 0 || lastOrderDays > 365) return 'dormant';
  if (lastOrderDays > 180) return 'at_risk';
  if (totalOrders === 1) return 'new';
  if (totalOrders >= 10) return 'vip';
  if (totalOrders >= 5) return 'loyal';
  return 'returning';
}

function generateCustomer(id: number): Customer {
  const gender: Gender = Math.random() > 0.5 ? 'male' : 'female';
  const firstName = firstNames[gender][Math.floor(Math.random() * firstNames[gender].length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${id}@email.com`;
  
  // Generate initial segment randomly
  const segments: CustomerSegment[] = ['new', 'returning', 'loyal', 'vip', 'at_risk', 'dormant'];
  const initialSegment = segments[Math.floor(Math.random() * segments.length)];
  
  const orders = generateOrderHistory(`cust-${id}`, initialSegment);
  const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
  const lastOrderDate = orders.length > 0 ? orders[0].date : undefined;
  const firstOrderDate = orders.length > 0 ? orders[orders.length - 1].date : undefined;
  
  // Recalculate segment based on actual order history
  const daysSinceLastOrder = lastOrderDate ? 
    Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)) : 999;
  const actualSegment = determineSegment(orders.length, daysSinceLastOrder);
  
  const addresses = [
    generateAddress(true),
    ...(Math.random() > 0.5 ? [generateAddress(false)] : []),
  ];
  
  const customer: Customer = {
    id: `cust-${id}`,
    email: email,
    firstName: firstName,
    lastName: lastName,
    fullName: `${firstName} ${lastName}`,
    phone: Math.random() > 0.3 ? `+1${Math.floor(Math.random() * 9000000000) + 1000000000}` : undefined,
    dateOfBirth: Math.random() > 0.6 ? 
      new Date(1960 + Math.floor(Math.random() * 40), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)) : 
      undefined,
    gender: gender,
    status: actualSegment === 'vip' ? 'vip' : 
            actualSegment === 'dormant' ? 'inactive' : 'active',
    segment: actualSegment,
    addresses: addresses,
    defaultShippingAddressId: addresses.find(a => a.type === 'shipping' || a.type === 'both')?.id,
    defaultBillingAddressId: addresses.find(a => a.type === 'billing' || a.type === 'both')?.id,
    orders: orders,
    metrics: {
      lifetimeValue: totalSpent,
      totalOrders: orders.length,
      totalSpent: totalSpent,
      averageOrderValue: orders.length > 0 ? totalSpent / orders.length : 0,
      lastOrderDate: lastOrderDate,
      firstOrderDate: firstOrderDate,
      returnsCount: orders.filter(o => o.status === 'returned').length,
      reviewsCount: Math.floor(orders.length * 0.3),
      referralCount: actualSegment === 'vip' ? Math.floor(Math.random() * 5) : 0,
    },
    preferences: {
      emailOptIn: Math.random() > 0.3,
      smsOptIn: Math.random() > 0.5,
      pushNotifications: Math.random() > 0.6,
      preferredCategories: ['Clothing', 'Accessories', 'Footwear'].filter(() => Math.random() > 0.5),
      preferredBrands: ['Luxe Label', 'Urban Chic', 'Modern Muse'].filter(() => Math.random() > 0.6),
      sizePreferences: {
        clothing: ['S', 'M', 'L', 'XL'][Math.floor(Math.random() * 4)],
        footwear: ['7', '8', '9', '10', '11'][Math.floor(Math.random() * 5)],
      },
      communicationLanguage: 'en',
    },
    tags: [
      actualSegment,
      ...(Math.random() > 0.7 ? ['newsletter'] : []),
      ...(actualSegment === 'vip' ? ['priority-support'] : []),
      ...(Math.random() > 0.8 ? ['influencer'] : []),
    ],
    createdAt: firstOrderDate || new Date(Date.now() - Math.floor(Math.random() * 730) * 24 * 60 * 60 * 1000),
    lastActiveAt: lastOrderDate || new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
    notes: actualSegment === 'vip' ? 'VIP customer - provide priority support' : undefined,
  };
  
  return customer;
}

export function generateCustomers(count: number = 100): Customer[] {
  const customers: Customer[] = [];
  
  for (let i = 1; i <= count; i++) {
    customers.push(generateCustomer(i));
  }
  
  return customers;
}

// Export consistent mock customers
export const mockCustomers = generateCustomers(100);

// Helper functions
export function getCustomersBySegment(segment: CustomerSegment): Customer[] {
  return mockCustomers.filter(c => c.segment === segment);
}

export function getVIPCustomers(): Customer[] {
  return mockCustomers.filter(c => c.status === 'vip');
}

export function getActiveCustomers(): Customer[] {
  return mockCustomers.filter(c => c.status === 'active' || c.status === 'vip');
}

export function getCustomersWithHighLifetimeValue(threshold: number = 1000): Customer[] {
  return mockCustomers.filter(c => c.metrics.lifetimeValue >= threshold);
}

export function getRecentCustomers(days: number = 30): Customer[] {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return mockCustomers.filter(c => c.lastActiveAt >= cutoffDate);
}