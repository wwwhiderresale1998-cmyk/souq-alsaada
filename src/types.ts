export interface Product {
  id: number;
  title: string;
  description: string;
  raw_description?: string; // Original unenhanced description
  category_id: number;
  wholesale_price: number; // Price of wholesale (internal)
  price: number; // Displayed sale price
  image: string;
  images?: string[]; // ALL image URLs of the product
  rating?: number;
  sales_count?: number;
  stock?: number; // Real available quantity
  discount?: number; // Random fake discount percentage
}

export interface Category {
  id: number;
  name: string;
  icon: string; // Lucide icon name
  imageUrl?: string; // Generated exclusive 3D icon
}

export interface Order {
  id: string;
  cus_name: string;
  cus_num1: string;
  capetel: string; // Province (e.g. بغداد)
  city: string;
  address: string;
  item_id: number;
  item_title: string;
  all_price: number; // product price per item
  delivery_price: number; // shipping cost (3,000 for Baghdad, 5,000 elsewhere)
  total_price: number; // (all_price * count) + delivery_price
  count: number;
  note: string;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled' | 'completed' | 'failed';
  created_at: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface CartItem {
  product: Product;
  count: number;
}

