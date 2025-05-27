import { Product, ProductCategory, ProductStatus } from '../types/product';

const productNames = {
  Clothing: [
    'Silk Evening Dress', 'Cashmere Sweater', 'Linen Button-Up Shirt', 'Wool Blazer',
    'Cotton T-Shirt', 'Denim Jacket', 'Pleated Midi Skirt', 'Tailored Trousers',
    'Maxi Dress', 'Cropped Cardigan', 'Wrap Blouse', 'Jumpsuit',
  ],
  Accessories: [
    'Leather Belt', 'Silk Scarf', 'Wool Beanie', 'Canvas Tote Bag',
    'Straw Hat', 'Cashmere Gloves', 'Cotton Socks Set', 'Umbrella',
  ],
  Footwear: [
    'Leather Ankle Boots', 'Canvas Sneakers', 'Suede Loafers', 'Strappy Sandals',
    'Running Shoes', 'High Heels', 'Chelsea Boots', 'Espadrilles',
  ],
  Bags: [
    'Leather Crossbody Bag', 'Canvas Backpack', 'Clutch Purse', 'Weekend Duffle',
    'Laptop Bag', 'Evening Clutch', 'Bucket Bag', 'Messenger Bag',
  ],
  Jewelry: [
    'Gold Hoop Earrings', 'Silver Chain Necklace', 'Pearl Bracelet', 'Diamond Stud Earrings',
    'Vintage Ring Set', 'Charm Bracelet', 'Pendant Necklace', 'Cuff Bracelet',
  ],
};

const brands = [
  'Luxe Label', 'Urban Chic', 'Eco Threads', 'Vintage Revival', 
  'Modern Muse', 'Classic Collection', 'Avant Garde', 'Timeless Trends',
];

const colors = ['Black', 'White', 'Navy', 'Red', 'Beige', 'Grey', 'Brown', 'Green', 'Blue', 'Pink'];
const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function generateProductVariants(category: ProductCategory, basePrice: number): any[] {
  if (category === 'Clothing' || category === 'Footwear') {
    const colorOptions = colors.slice(0, 3 + Math.floor(Math.random() * 3));
    const sizeOptions = category === 'Footwear' 
      ? ['36', '37', '38', '39', '40', '41', '42', '43', '44']
      : sizes;
    
    const variants: any[] = [];
    let variantId = 1;
    
    colorOptions.forEach(color => {
      sizeOptions.forEach(size => {
        variants.push({
          id: `variant-${variantId++}`,
          name: `${color} - ${category === 'Footwear' ? 'Size' : ''} ${size}`,
          sku: `VAR-${variantId}`,
          options: [
            { name: 'Color', value: color },
            { name: 'Size', value: size }
          ],
          price: {
            regular: basePrice + (Math.random() * 10 - 5),
            currency: 'USD'
          },
          inventory: {
            inStock: Math.floor(Math.random() * 50),
            reserved: Math.floor(Math.random() * 5),
            available: Math.floor(Math.random() * 45),
            lowStockThreshold: 5,
            outOfStock: Math.random() > 0.9
          }
        });
      });
    });
    
    return variants;
  }
  
  return [];
}

function generateProduct(id: number, category: ProductCategory, name: string): Product {
  const basePrice = 50 + Math.random() * 200;
  const hasDiscount = Math.random() > 0.7;
  const rating = 3.5 + Math.random() * 1.5;
  const reviewCount = Math.floor(Math.random() * 200);
  
  const product: Product = {
    id: `prod-${id}`,
    sku: `SKU-${category.toUpperCase().substring(0, 3)}-${id.toString().padStart(4, '0')}`,
    name: name,
    description: `Premium quality ${name.toLowerCase()} crafted with attention to detail. Perfect for any occasion.`,
    category: category,
    subcategory: category === 'Clothing' ? (Math.random() > 0.5 ? 'Casual' : 'Formal') : undefined,
    price: {
      regular: basePrice,
      sale: hasDiscount ? basePrice * (0.7 + Math.random() * 0.2) : undefined,
      currency: 'USD',
      discount: hasDiscount ? {
        amount: 20 + Math.floor(Math.random() * 30),
        type: 'percentage' as const,
        validFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      } : undefined,
    },
    inventory: {
      inStock: Math.floor(Math.random() * 100),
      reserved: Math.floor(Math.random() * 10),
      available: Math.floor(Math.random() * 90),
      lowStockThreshold: 10,
      outOfStock: false,
    },
    images: [
      {
        url: `https://placeholder.com/products/${id}-primary.jpg`,
        alt: `${name} - Primary Image`,
        isPrimary: true,
        order: 1,
      },
      {
        url: `https://placeholder.com/products/${id}-secondary.jpg`,
        alt: `${name} - Secondary Image`,
        isPrimary: false,
        order: 2,
      },
    ],
    tags: [
      category.toLowerCase(),
      brands[Math.floor(Math.random() * brands.length)].toLowerCase(),
      hasDiscount ? 'sale' : 'regular',
      Math.random() > 0.5 ? 'bestseller' : 'new-arrival',
    ],
    brand: brands[Math.floor(Math.random() * brands.length)],
    status: 'active' as ProductStatus,
    createdAt: new Date(Date.now() - Math.floor(Math.random() * 180) * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
    ratings: {
      average: rating,
      count: reviewCount,
      distribution: {
        5: Math.floor(reviewCount * 0.6),
        4: Math.floor(reviewCount * 0.25),
        3: Math.floor(reviewCount * 0.1),
        2: Math.floor(reviewCount * 0.03),
        1: Math.floor(reviewCount * 0.02),
      },
    },
    variants: generateProductVariants(category, basePrice),
  };
  
  return product;
}

export function generateProducts(): Product[] {
  const products: Product[] = [];
  let productId = 1;
  
  // Generate products for each category
  Object.entries(productNames).forEach(([category, names]) => {
    names.forEach((name) => {
      products.push(generateProduct(productId++, category as ProductCategory, name));
    });
  });
  
  // Mark some products as out of stock or archived
  products.forEach((product, index) => {
    if (index % 15 === 0) {
      product.inventory.outOfStock = true;
      product.inventory.available = 0;
      product.inventory.inStock = 0;
      product.status = 'out_of_stock';
    } else if (index % 20 === 0) {
      product.status = 'archived';
    }
  });
  
  return products;
}

// Export consistent mock products
export const mockProducts = generateProducts();

// Helper functions for filtering
export function getProductsByCategory(category: ProductCategory): Product[] {
  return mockProducts.filter(p => p.category === category);
}

export function getActiveProducts(): Product[] {
  return mockProducts.filter(p => p.status === 'active');
}

export function getProductsOnSale(): Product[] {
  return mockProducts.filter(p => p.price.sale !== undefined);
}

export function getBestsellers(): Product[] {
  return mockProducts.filter(p => p.tags.includes('bestseller'));
}