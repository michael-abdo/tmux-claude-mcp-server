export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: ProductCategory;
  subcategory?: string;
  price: Price;
  inventory: Inventory;
  images: ProductImage[];
  tags: string[];
  brand: string;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  ratings: ProductRating;
  variants?: ProductVariant[];
}

export interface Price {
  regular: number;
  sale?: number;
  currency: string;
  discount?: Discount;
}

export interface Discount {
  amount: number;
  type: 'percentage' | 'fixed';
  validFrom: Date;
  validTo: Date;
}

export interface Inventory {
  inStock: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  outOfStock: boolean;
}

export interface ProductImage {
  url: string;
  alt: string;
  isPrimary: boolean;
  order: number;
}

export interface ProductRating {
  average: number;
  count: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  options: VariantOption[];
  price: Price;
  inventory: Inventory;
  images?: ProductImage[];
}

export interface VariantOption {
  name: string; // e.g., "Color", "Size"
  value: string; // e.g., "Red", "Large"
}

export type ProductCategory = 
  | 'Clothing'
  | 'Accessories'
  | 'Footwear'
  | 'Bags'
  | 'Jewelry'
  | 'Beauty'
  | 'Home';

export type ProductStatus = 
  | 'active'
  | 'draft'
  | 'archived'
  | 'out_of_stock';

export interface ProductFilter {
  categories?: ProductCategory[];
  priceRange?: {
    min: number;
    max: number;
  };
  inStock?: boolean;
  tags?: string[];
  brands?: string[];
  rating?: number;
}