export interface StoreLocation {
  id: string;
  name: string;
  city: 'Jakarta' | 'Bandung' | 'Surabaya' | 'Bali' | 'Yogyakarta' | 'Medan';
  address: string;
  district: string;
  postalCode: string;
  phone: string;
  hours: string;
  isFlagship?: boolean;
  manager: string;
  establishedYear: number;
  amenities: string[];
  coordinates: {
    lat: number;
    lng: number;
  };
  pickupAvailable: boolean;
}

export interface Milestone {
  year: number;
  title: string;
  subtitle: string;
  description: string;
  metric?: string;
}

export type ProductCategory = 
  | 'produce'
  | 'bakery'
  | 'dairy_eggs'
  | 'meat_seafood'
  | 'pantry_coffee';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  categoryLabel: string;
  price: number; // in IDR
  unit: string;
  origin: string;
  farmPartner?: string;
  isOrganic?: boolean;
  isFarmDirect?: boolean;
  rating: number;
  reviewCount: number;
  stock: number;
  description: string;
  image: string;
  fallbackGradient: string;
  storageTip?: string;
  nutritionHighlights?: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

export type OrderStatus = 'placed' | 'paid' | 'packing' | 'in_transit' | 'delivered';

export interface OrderTimelineStep {
  status: OrderStatus;
  label: string;
  description: string;
  timestamp: string;
  completed: boolean;
}

export interface Order {
  id: string;
  userId?: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryMethod: 'instant' | 'scheduled' | 'pickup';
  deliveryAddress?: {
    label: string;
    recipient: string;
    phone: string;
    addressLine: string;
    city: string;
    notes?: string;
  };
  pickupStore?: StoreLocation;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  voucherApplied?: string;
  total: number;
  paymentMethod: 'qris' | 'bank_transfer' | 'card';
  paymentStatus: 'unpaid' | 'paid';
  qrisRef?: string;
  qrisNmid?: string;
  qrisPaidAt?: string;
  status: OrderStatus;
  courierName?: string;
  courierPhone?: string;
  vehiclePlate?: string;
  estimatedArrival?: string;
  timeline: OrderTimelineStep[];
}

export interface SavedAddress {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  addressLine: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
}

export interface CustomerAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
  memberTier: 'Silver Member' | 'Gold Member' | 'Platinum Member';
  grocePoints: number;
  memberSince: string;
  savedAddresses: SavedAddress[];
}
