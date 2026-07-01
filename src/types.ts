export interface Product {
  id: string;
  title: string;
  price: number; // in IQD
  description: string;
  category: string;
  stock: number;
  images: string[];
  createdAt: string;
  compareAtPrice?: number; // Discount / Original higher price to compare at
  isFeatured?: boolean;    // Marked as a featured product
  isDisabled?: boolean;    // Soft-disable status (draft/active)
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
}

export type OrderStatus = "Pending" | "Processing" | "Shipped" | "Delivered";

export interface Order {
  id: string; // Unique tracking ID
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  couponApplied: string | null;
  discountAmount: number;
  orderMethod: "Cart" | "WhatsApp" | "TikTok";
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  isActive: boolean;
  createdAt: string;
}

export interface HeroBanner {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  link: string;
}

export interface Settings {
  whatsappNumber: string;
  tiktokLink: string;
  enableCart: boolean;
  enableWhatsApp: boolean;
  enableTikTok: boolean;
  updatedAt: string;
  storeName?: string;
  storeLogo?: string;
  storeFavicon?: string;
  heroBanners?: HeroBanner[];
  homepageSections?: string[];
  contactPhone?: string;
  contactEmail?: string;
  contactAddress?: string;
  instagramLink?: string;
  facebookLink?: string;
  snapchatLink?: string;
  shippingInfo?: string;
  returnPolicy?: string;
  privacyPolicy?: string;
  adminRegistered?: boolean;
  heroTitle?: string;
  heroSubtitle?: string;
  heroImage?: string;
  heroTagline?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
