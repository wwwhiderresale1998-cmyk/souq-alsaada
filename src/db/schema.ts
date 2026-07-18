import { pgTable, serial, text, integer, doublePrecision, timestamp } from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  imageUrl: text('image_url'),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  raw_description: text('raw_description'),
  category_id: integer('category_id').references(() => categories.id),
  wholesale_price: integer('wholesale_price').notNull(),
  price: integer('price').notNull(),
  image: text('image').notNull(),
  rating: doublePrecision('rating'),
  sales_count: integer('sales_count'),
  stock: integer('stock'),
  discount: integer('discount'),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  cus_name: text('cus_name').notNull(),
  cus_num1: text('cus_num1').notNull(),
  capetel: text('capetel').notNull(),
  city: text('city').notNull(),
  address: text('address').notNull(),
  item_id: integer('item_id').references(() => products.id),
  item_title: text('item_title').notNull(),
  all_price: integer('all_price').notNull(),
  delivery_price: integer('delivery_price').notNull(),
  total_price: integer('total_price').notNull(),
  count: integer('count').notNull(),
  note: text('note'),
  status: text('status').notNull().default('pending'),
  created_at: timestamp('created_at').defaultNow(),
});

export const users = pgTable('users', {
  email: text('email').primaryKey(),
  role: text('role').notNull().default('user'),
  phone: text('phone'),
  capetel: text('capetel'),
  address: text('address'),
});
