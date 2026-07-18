CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"cus_name" text NOT NULL,
	"cus_num1" text NOT NULL,
	"capetel" text NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"item_id" integer,
	"item_title" text NOT NULL,
	"all_price" integer NOT NULL,
	"delivery_price" integer NOT NULL,
	"total_price" integer NOT NULL,
	"count" integer NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"raw_description" text,
	"category_id" integer,
	"wholesale_price" integer NOT NULL,
	"price" integer NOT NULL,
	"image" text NOT NULL,
	"rating" double precision,
	"sales_count" integer,
	"stock" integer,
	"discount" integer
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_item_id_products_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;