import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES, IRAQI_PROVINCES } from "./src/initialData";
import { Product, Category, Order } from "./src/types";
import { db } from "./src/db/index";


dotenv.config();

const app = express();
const PORT = 3000;

// Remove COOP header that blocks Firebase Auth popup window communication.
// Firebase Auth popup needs cross-origin access to complete OAuth flow.
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

app.use(express.json());

const EXTERNAL_TOKEN = process.env.EXTERNAL_TOKEN || "ZIq2iBV";
const EXTERNAL_BASE_URL = "https://rolemall.com";

const ORDERS_FILE_PATH = path.join(process.cwd(), "orders.json");
const CUSTOM_PRODUCTS_FILE_PATH = path.join(process.cwd(), "custom_products.json");
const QUEUE_FILE_PATH = path.join(process.cwd(), "queue.json");

// --- QUEUE SYSTEM FOR RATE LIMITS ---
let externalOrderQueue: any[] = [];
let rateLimitUntil = 0;

async function loadQueue() {
  try {
    const firestore = db();
    if (firestore) {
      const doc = await firestore.collection('queue_data').doc('queue').get();
      if (doc.exists) {
        externalOrderQueue = doc.data()?.items || [];
        return;
      }
    }

    if (fs.existsSync(QUEUE_FILE_PATH)) {
      const data = fs.readFileSync(QUEUE_FILE_PATH, "utf-8");
      externalOrderQueue = JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed to load queue:", err);
  }
}

async function saveQueue() {
  try {
    const firestore = db();
    if (firestore) {
      await firestore.collection('queue_data').doc('queue').set({ items: externalOrderQueue });
    }
    fs.writeFileSync(QUEUE_FILE_PATH, JSON.stringify(externalOrderQueue, null, 2));
  } catch (err) {
    console.error("Failed to save queue:", err);
  }
}

async function enqueueExternalOrder(payload: any) {
  externalOrderQueue.push(payload);
  await saveQueue();
  console.log(`[Queue] Order added. Queue length: ${externalOrderQueue.length}`);
}

// دالة إرسال إشعار تيليجرام مجاني لكل الطلبات
async function notifyAdminTelegram(payload: any, status: 'SUCCESS' | 'FAILED', extraInfo: string = '') {
  // 🔴 ضع الـ Token والـ Chat ID الخاصين بك هنا
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
  
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("[Telegram] تم إيقاف الإشعارات مؤقتاً لعدم وجود Token أو Chat ID في ملف .env");
    return;
  }

  const icon = status === 'SUCCESS' ? '✅' : '❌';
  const statusText = status === 'SUCCESS' ? 'تم تسجيل وإرسال الطلب للمورد بنجاح' : 'فشل إرسال الطلب للمورد';
  
  const message = `
🛒 *طلب جديد في سوق السعادة* ${icon}
━━━━━━━━━━━━━━
👤 *الاسم:* \`${payload.cus_name}\`
📱 *الهاتف:* \`${payload.cus_num1}\`
📍 *المحافظة:* \`${payload.capetel}\`
🏘️ *المنطقة:* \`${payload.city || 'غير محدد'}\`
🏠 *العنوان:* \`${payload.address}\`
📦 *معرف المنتج:* \`${payload.item_id}\`
💰 *السعر الكلي:* \`${payload.all_price}\` د.ع
🔢 *الكمية:* \`${payload.count}\`
📝 *ملاحظات:* \`${payload.note || 'لا يوجد'}\`
━━━━━━━━━━━━━━
📊 *الحالة:* ${statusText}
${extraInfo ? `\n⚠️ *تفاصيل إضافية:* ${extraInfo}` : ''}
  `.trim();
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    
    if (response.ok) {
      console.log("[Telegram] تم إرسال الإشعار بنجاح.");
    } else {
      console.error("[Telegram] فشل إرسال الإشعار:", await response.text());
    }
  } catch (err) {
    console.error("[Telegram] خطأ في الاتصال بالتيليجرام:", err);
  }
}

async function notifyAdminTelegramCart(payload: any, items: any[]) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
  
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("[Telegram] تم إيقاف إشعارات السلة لعدم وجود Token أو Chat ID");
    return;
  }

  let itemsText = "";
  items.forEach((item: any, idx: number) => {
    const matchedProduct = productsCache.find(p => p.id === item.item_id);
    const title = matchedProduct ? matchedProduct.title : "غير معروف";
    const imgUrl = matchedProduct ? matchedProduct.image : "";
    itemsText += `\n${idx + 1}. *المنتج:* \`${title}\`\n   *السعر:* \`${item.all_price}\`\n   *العدد:* \`${item.count}\`\n   *الكود:* \`${item.item_id}\`${imgUrl ? `\n   [🖼️ صورة المنتج](${imgUrl})` : ''}\n`;
  });

  const message = `
🚨 *طلب سلة جديد (إدخال يدوي)* 🚨
يرجى إدخال هذا الطلب يدوياً في تطبيق موجود لضمان شحن السلة معاً!
━━━━━━━━━━━━━━
👤 *الاسم:* \`${payload.cus_name}\`
📱 *الهاتف:* \`${payload.cus_num1}\`
📍 *المحافظة:* \`${payload.capetel}\`
🏘️ *المنطقة:* \`${payload.city || 'غير محدد'}\`
🏠 *العنوان:* \`${payload.address}\`
📝 *ملاحظات:* \`${payload.note || 'لا يوجد'}\`
━━━━━━━━━━━━━━
🛍️ *المنتجات المطلوبة:*${itemsText}
━━━━━━━━━━━━━━
💰 *إجمالي السلة (مع التوصيل):* \`${payload.total_price}\` د.ع
  `.trim();
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      })
    });
    
    if (response.ok) {
      console.log("[Telegram] تم إرسال إشعار السلة بنجاح.");
    } else {
      console.error("[Telegram] فشل إرسال إشعار السلة:", await response.text());
    }
  } catch (err) {
    console.error("[Telegram] خطأ في الاتصال بالتيليجرام:", err);
  }
}

async function processOrderQueue() {
  if (externalOrderQueue.length === 0) return;
  if (Date.now() < rateLimitUntil) return; // Waiting for cooldown

  const payload = externalOrderQueue[0];
  console.log(`[Queue] Processing order for ${payload.cus_name}...`);

  try {
    const apiRes = await fetch(`${EXTERNAL_BASE_URL}/api/add-simple-order?token=${EXTERNAL_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await apiRes.json();
    
    if (apiRes.ok || json.status === true) {
      console.log(`[Queue] Order success for ${payload.cus_name}.`);
      
      // إرسال إشعار بالنجاح
      await notifyAdminTelegram(payload, 'SUCCESS');
      
      // تحديث حالة الطلب محلياً
      if (payload.local_order_id) {
         const oIdx = orders.findIndex(o => o.id === payload.local_order_id);
         if (oIdx !== -1) {
              orders[oIdx].status = "completed";
              await saveOrder(orders[oIdx]);
              saveOrdersToFile();
         }
      }

      externalOrderQueue.shift(); // Remove successful order
      saveQueue();
      // Ensure at least a small delay between successful requests
      rateLimitUntil = Date.now() + 5000; 
    } else {
      console.warn("[Queue] API Response Error:", json);
      // Check if it's a rate limit error (429 or text)
      if (json.error?.includes("Rate limit exceeded") || apiRes.status === 429 || json.message?.includes("Rate limit")) {
        console.warn("[Queue] Rate limit hit! Pausing for 5 minutes...");
        rateLimitUntil = Date.now() + (5 * 60 * 1000); // Wait 5 minutes
      } else {
        // Other API error (e.g. 400 bad request). Discard to prevent infinite loop
        console.error("[Queue] Permanent error, discarding order:", json);
        
        // إرسال إشعار بالفشل
        await notifyAdminTelegram(payload, 'FAILED', JSON.stringify(json));
        
        // تحديث حالة الطلب محلياً مع توضيح السبب
        if (payload.local_order_id) {
           const oIdx = orders.findIndex(o => o.id === payload.local_order_id);
           if (oIdx !== -1) {
               orders[oIdx].status = 'failed';
               
               let errorReason = "";
               if (json.detail) {
                 if (typeof json.detail === "string") errorReason = json.detail;
                 else errorReason = JSON.stringify(json.detail);
               } else if (json.message) {
                 errorReason = json.message;
               } else {
                 errorReason = "مرفوض من المورد";
               }
               
               orders[oIdx].note += ` [خطأ المورد: ${errorReason}]`;
               saveOrdersToFile();
           }
        }

        externalOrderQueue.shift();
        saveQueue();
      }
    }
  } catch (err: any) {
    console.error("[Queue] Fetch error:", err.message);
    // Network error, try again later
    rateLimitUntil = Date.now() + 30000; // Wait 30 seconds
  }
}

// Start queue processor
// loadQueue is now called inside populateCaches
setInterval(processOrderQueue, 10000); // Check queue every 10 seconds

// --- END QUEUE SYSTEM ---

// Enhanced Descriptions persistent local map (survives dynamic API fetches)
const ENHANCED_DESCRIPTIONS: Record<number, string> = {};

// Cache categories & products for resilience and to feed the Gemini Chat Assistant
let categoriesCache: Category[] = [
  { id: 19, name: "العاب", icon: "Gamepad2" },
  { id: 20, name: "ادوات السيارات", icon: "Car" },
  { id: 21, name: "عدد وادوات", icon: "Wrench" },
  { id: 22, name: "ادوات رياضية", icon: "Activity" },
  { id: 23, name: "اثاث", icon: "Sofa" },
  { id: 24, name: "انارة واضاءة", icon: "Lightbulb" },
  { id: 25, name: "ادوات منزلية", icon: "Home" },
  { id: 26, name: "ادوات مطبخ", icon: "UtensilsCrossed" }
];

let productsCache: Product[] = [];

// Local orders log for admin tracking & analytics dashboard
let orders: Order[] = [];

// Load and Save File-based persistence
async function loadOrders(): Promise<Order[] | null> {
  try {
    const firestore = db();
    if (firestore) {
      const snapshot = await firestore.collection('orders').get();
      if (!snapshot.empty) {
        const firestoreOrders: Order[] = [];
        snapshot.forEach((doc: any) => firestoreOrders.push(doc.data() as Order));
        return firestoreOrders;
      }
    }

    if (fs.existsSync(ORDERS_FILE_PATH)) {
      const data = fs.readFileSync(ORDERS_FILE_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error loading orders file:", err);
  }
  return null;
}

async function saveOrder(order: Order) {
  try {
    const firestore = db();
    if (firestore) {
      await firestore.collection('orders').doc(order.id).set(order);
    }
  } catch (err) {
    console.error("Error saving order to firestore:", err);
  }
}

function saveOrdersToFile() {
  try {
    fs.writeFileSync(ORDERS_FILE_PATH, JSON.stringify(orders, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving orders file:", err);
  }
}

// Helper to map category IDs dynamically using the official API categories
function mapProductToCategory(p: any): number {
  const rawCat = typeof p.category === "string" ? parseInt(p.category) : p.category;

  // Direct active categories returned by /api/categories (19 to 26)
  if (rawCat >= 19 && rawCat <= 26) {
    return rawCat;
  }

  // Map other raw category IDs to the most appropriate active category ID
  switch (rawCat) {
    case 6:
      return 26; // أدوات مطبخ (Kitchen)
    case 12:
      return 25; // أدوات منزلية (Household)
    case 5:
      return 25; // أدوات منزلية (Household / Appliances)
    case 18:
      return 22; // أدوات رياضية (Sports)
    default:
      return 25; // أدوات منزلية (Default: Household)
  }
}

// Generate beautiful high-fidelity realistic orders history
function generateHistoricalOrders() {
  if (productsCache.length === 0) return;

  console.log("[سوق السعادة] جاري توليد سجل طلبات حقيقي عالي التفاصيل للوحة التحكم...");
  const names = [
    "حسين علي الخفاجي", "مقتدى محمد الساعدي", "مصطفى قاسم الجبوري",
    "فاطمة عباس الموسوي", "زينب هادي التميمي", "مرتضى سعد البياتي",
    "سجاد كريم الربيعي", "علي الرافدين", "نور الهدى حسين",
    "عمر فاروق الحديثي", "أحمد كاظم العبيدي", "رنا جاسم محمد",
    "طه عادل الدليمي", "زهراء ميثم البصري", "كرار عماد اللامي"
  ];

  const provinces = [
    { name: "بغداد", fee: 3000 },
    { name: "البصرة", fee: 5000 },
    { name: "نينوى (الموصل)", fee: 5000 },
    { name: "أربيل", fee: 5000 },
    { name: "النجف الأشرف", fee: 5000 },
    { name: "كربلاء المقدسة", fee: 5000 },
    { name: "بابل (الحلة)", fee: 5000 },
    { name: "ذي قار (الناصرية)", fee: 5000 }
  ];

  const statuses: ('pending' | 'confirmed' | 'delivered' | 'cancelled')[] = [
    "delivered", "delivered", "delivered", "confirmed", "confirmed", "pending", "cancelled"
  ];

  const initialOrders: Order[] = [];

  for (let i = 0; i < 15; i++) {
    const prodIndex = Math.floor(Math.random() * Math.min(40, productsCache.length));
    const prod = productsCache[prodIndex];
    if (!prod) continue;

    const name = names[Math.floor(Math.random() * names.length)];
    const prov = provinces[Math.floor(Math.random() * provinces.length)];
    const count = Math.floor(Math.random() * 2) + 1; // 1 or 2 items
    
    const allPrice = prod.price;
    const deliveryPrice = prov.fee;
    const totalPrice = (allPrice * count) + deliveryPrice;

    // Spread over last 7 days beautifully
    const randomHoursAgo = i * 11 + 2; 
    const createdAt = new Date(Date.now() - 3600000 * randomHoursAgo).toISOString();
    const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    initialOrders.push({
      id: orderId,
      cus_name: name,
      cus_num1: "07" + Math.floor(700000000 + Math.random() * 100000000).toString(),
      capetel: prov.name,
      city: "المنطقة الرئيسية",
      address: "قرب المسجد الكبير / الشارع التجاري",
      item_id: prod.id,
      item_title: prod.title,
      all_price: allPrice,
      delivery_price: deliveryPrice,
      total_price: totalPrice,
      count,
      note: "يرجى الاتصال بالزبون قبل الانطلاق",
      status: statuses[Math.floor(Math.random() * statuses.length)],
      created_at: createdAt
    });

    if (prod.stock) {
      prod.stock = Math.max(0, prod.stock - count);
    }
  }

  orders = initialOrders;
  saveOrdersToFile();
}

// Helper to assign nice Lucide icons to Arabic category names
function getIconForCategoryName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("العاب") || n.includes("لعب")) return "Gamepad2";
  if (n.includes("سيار") || n.includes("موتور")) return "Car";
  if (n.includes("عدد") || n.includes("ادوات") || n.includes("تكامل")) return "Wrench";
  if (n.includes("رياض")) return "Activity";
  if (n.includes("اثاث")) return "Sofa";
  if (n.includes("انار") || n.includes("اضاء") || n.includes("كهربا")) return "Lightbulb";
  if (n.includes("منزل") || n.includes("بيت")) return "Home";
  if (n.includes("مطبخ") || n.includes("طبخ")) return "UtensilsCrossed";
  return "Layers";
}

// Lazy-initialized Gemini Client
let geminiClient: any = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("⚠️ GEMINI_API_KEY is missing. Simulated AI mode active.");
      return null;
    }
    geminiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return geminiClient;
}

// ==========================================
// PRE-POPULATE CACHE ON STARTUP
// ==========================================
async function populateCaches() {
  console.log("[سوق السعادة] جاري جلب البيانات بالكامل من متجر Rolemall للتخزين المؤقت...");

  try {
    // 1. Categories
    const catRes = await fetch(`${EXTERNAL_BASE_URL}/api/categories`);
    if (catRes.ok) {
      const json = await catRes.json();
      if (json && json.status && json.data && json.data.categories) {
        categoriesCache = json.data.categories.map((c: any) => ({
          id: c._id,
          name: c.name,
          icon: getIconForCategoryName(c.name)
        }));
        console.log(`[سوق السعادة] تم تحميل ${categoriesCache.length} فئات بنجاح.`);
      }
    }

    // 2. Products - Dynamically fetch ALL pages of products from the supplier store
    console.log("[سوق السعادة] جاري تحميل كافة المنتجات من المورد...");
    let allProducts: any[] = [];
    let totalPages = 1;

    try {
      // Fetch page 1 with limit=100 to get total count & total pages metadata
      const firstRes = await fetch(`${EXTERNAL_BASE_URL}/api/products?token=${EXTERNAL_TOKEN}&page=1&limit=100`);
      if (firstRes.ok) {
        const json = await firstRes.json();
        if (json && json.status && json.data) {
          if (json.data.products) {
            allProducts = allProducts.concat(json.data.products);
          }
          if (json.data.pages) {
            totalPages = json.data.pages;
          }
          console.log(`[سوق السعادة] تم جلب الصفحة 1 بنجاح. إجمالي الصفحات المتوفرة: ${totalPages}. إجمالي المنتجات: ${json.data.total}`);
        }
      }
    } catch (err) {
      console.error("Error loading page 1 products:", err);
    }

    // Loop through the rest of the pages dynamically
    for (let page = 2; page <= totalPages; page++) {
      try {
        const prodRes = await fetch(`${EXTERNAL_BASE_URL}/api/products?token=${EXTERNAL_TOKEN}&page=${page}&limit=100`);
        if (prodRes.ok) {
          const json = await prodRes.json();
          if (json && json.status && json.data && json.data.products) {
            allProducts = allProducts.concat(json.data.products);
          }
        }
      } catch (err) {
        console.error(`Error loading page ${page} products:`, err);
      }
    }

    if (allProducts.length > 0) {
      // Deduplicate products
      const seen = new Set();
      const uniqueProducts = allProducts.filter(p => {
        if (seen.has(p._id)) return false;
        seen.add(p._id);
        return true;
      });

      productsCache = uniqueProducts.map((p: any) => {
        const enhancedDesc = ENHANCED_DESCRIPTIONS[p._id];
        const categoryId = mapProductToCategory(p);
        const adjustedPrice = Math.max(0, p.price - 5000);
        
        // Generate a persistent but unique-looking discount between 15% and 45% based on ID
        const discount = 15 + ((p._id || 0) % 7) * 5;

        return {
          id: p._id,
          title: p.name,
          raw_description: p.body,
          description: enhancedDesc || p.post_body || p.body,
          category_id: categoryId,
          wholesale_price: Math.round(adjustedPrice * 0.8),
          price: adjustedPrice,
          image: p.img && p.img.length > 0 ? p.img[0] : "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600",
          images: p.img && p.img.length > 0 ? p.img : (p.img ? [p.img] : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600"]),
          rating: 4.5 + (p._id % 5) * 0.1,
          sales_count: 50 + (p._id % 100) * 3,
          discount: discount
        };
      });

      console.log(`[سوق السعادة] تم تحميل ${productsCache.length} منتج فريد وتصنيفها بالكامل.`);
    }

    // 3. Load custom products
    try {
      if (fs.existsSync(CUSTOM_PRODUCTS_FILE_PATH)) {
        const customData = fs.readFileSync(CUSTOM_PRODUCTS_FILE_PATH, "utf-8");
        let customProducts: Product[] = JSON.parse(customData);
        if (customProducts && customProducts.length > 0) {
          productsCache = [...customProducts, ...productsCache];
          console.log(`[سوق السعادة] تم تحميل ${customProducts.length} منتجات مخصصة مضافة من الملف.`);
        }
      }
    } catch (err) {
      console.error("Error reading custom products:", err);
    }

    // 4. Load or generate orders
    const loadedOrders = await loadOrders();
    if (loadedOrders && loadedOrders.length > 0) {
      orders = loadedOrders;
      console.log(`[سوق السعادة] تم استرجاع ${orders.length} طلب بنجاح.`);
    } else {
      orders = [];
      saveOrdersToFile();
      console.log("[سوق السعادة] تم بدء النظام بقائمة طلبيات فارغة.");
    }
    
    // 5. Load queue data
    await loadQueue();

  } catch (err) {
    console.error("[سوق السعادة] خطأ في التحميل المسبق على الإقلاع:", err);
  }
}

// ==========================================
// 1. OPENAPI SPEC COMPLIANT ROUTING
// ==========================================

// GET /api/categories - get all categories from Rolemall
app.get("/api/categories", async (req: Request, res: Response) => {
  try {
    const apiRes = await fetch(`${EXTERNAL_BASE_URL}/api/categories`);
    if (!apiRes.ok) throw new Error("Failed to fetch categories");
    const json = await apiRes.json();
    if (json && json.status && json.data && json.data.categories) {
      const apiCategories = json.data.categories.map((c: any) => ({
        id: c._id,
        name: c.name,
        icon: getIconForCategoryName(c.name)
      }));
      categoriesCache = apiCategories;
      res.json(apiCategories);
    } else {
      res.json(categoriesCache);
    }
  } catch (err) {
    console.error("Categories fetch failed, returning cache:", err);
    res.json(categoriesCache);
  }
});

// GET /api/products - get products list with filtering and query forwarding from our highly enriched cache
app.get("/api/products", async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 2000;
  const categoryId = req.query.category ? parseInt(req.query.category as string) : null;
  const search = req.query.search ? (req.query.search as string).toLowerCase().trim() : "";

  try {
    let filtered = [...productsCache];

    if (categoryId) {
      filtered = filtered.filter(p => p.category_id === categoryId);
    }

    if (search) {
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(search) || 
        (p.raw_description && p.raw_description.toLowerCase().includes(search)) ||
        p.description.toLowerCase().includes(search)
      );
    }

    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const offset = (page - 1) * limit;
    const paginatedProducts = filtered.slice(offset, offset + limit);

    res.json({
      products: paginatedProducts,
      totalCount: totalCount,
      page: page,
      limit: limit,
      totalPages: totalPages
    });
  } catch (err) {
    console.error("Products API error:", err);
    res.status(500).json({ error: "فشل في جلب قائمة المنتجات" });
  }
});

// GET /api/product-details - get complete product specs and details from cache or direct upstream
app.get("/api/product-details", async (req: Request, res: Response) => {
  const productId = req.query.product_id as string;

  if (!productId) {
    res.status(400).json({ error: "يجب توفير معرف المنتج product_id" });
    return;
  }

  try {
    const apiRes = await fetch(`${EXTERNAL_BASE_URL}/api/product-details?product_id=${productId}&strung=${EXTERNAL_TOKEN}`);
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json && json.status && json.data) {
        const p = json.data;
        const enhancedDesc = ENHANCED_DESCRIPTIONS[p.item_id];
        const adjustedPrice = Math.max(0, p.price - 5000);
        const discount = 15 + ((p.item_id || 0) % 7) * 5;
        
        const mappedProduct = {
          id: p.item_id,
          title: p.name,
          raw_description: p.body,
          description: enhancedDesc || p.post_body || p.body,
          category_id: mapProductToCategory(p),
          wholesale_price: Math.round(adjustedPrice * 0.8),
          price: adjustedPrice,
          image: p.img && p.img.length > 0 ? p.img[0] : "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600",
          images: p.img && p.img.length > 0 ? p.img : (p.img ? [p.img] : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600"]),
          rating: 4.8,
          sales_count: 100,
          discount: discount
        };

        // Cache-enrichment: save the fuller description and images back into productsCache
        const cacheIndex = productsCache.findIndex(prod => prod.id.toString() === productId.toString());
        if (cacheIndex !== -1) {
          productsCache[cacheIndex] = {
            ...productsCache[cacheIndex],
            raw_description: mappedProduct.raw_description,
            description: mappedProduct.description,
            images: mappedProduct.images,
          };
        } else {
          productsCache.push(mappedProduct);
        }

        res.json(mappedProduct);
        return;
      }
    }

    // Fallback if API returned non-success structure
    const cached = productsCache.find(p => p.id.toString() === productId.toString());
    if (cached) {
      res.json(cached);
    } else {
      res.status(404).json({ error: "المنتج غير موجود في المعرض" });
    }
  } catch (err) {
    console.error("Product details fetch failed, falling back to cache:", err);
    const cached = productsCache.find(p => p.id.toString() === productId.toString());
    if (cached) {
      res.json(cached);
    } else {
      res.status(500).json({ error: "فشل في العثور على المنتج" });
    }
  }
});

// POST /api/add-simple-order - submit simple order to Rolemall & save locally with disk persistence and stock reduction
app.post("/api/add-simple-order", async (req: Request, res: Response) => {
  const { cus_name, cus_num1, capetel, city, address, item_id, all_price, count, note, ip, user_email } = req.body;

  if (!cus_name || !cus_num1 || !capetel || !address || !item_id || !all_price || !count) {
    res.status(422).json({
      detail: [
        {
          loc: ["body"],
          msg: "الحقول المطلوبة مفقودة لطلب السعادة",
          type: "value_error.missing"
        }
      ]
    });
    return;
  }

  try {
    if (user_email && db()) {
      await db().collection('users').doc(user_email).set({
        phone: cus_num1,
        capetel: capetel,
        address: address
      }, { merge: true });
    }

    // Calculate the shipping difference and adjust the price sent to the supplier API.
    // Our website charges 3,000 IQD for Baghdad, and 5,000 IQD for other provinces.
    // Since the supplier's external server automatically adds 5,000 IQD for shipping to every order,
    // if the order is for Baghdad, we subtract 2,000 IQD / count from the single product price we submit.
    // This mathematically ensures that: (adjustedAllPrice * count) + 5000 (supplier shipping) === (all_price * count) + 3000 (our shipping)
    const provinceClean = capetel.trim();
    const isBaghdad = provinceClean.includes("بغداد");
    const websiteDeliveryPrice = 5000;
    
    // سيرفر شركة موجود (Mojod) يتوقع أن يكون all_price هو المبلغ الإجمالي الذي سيقوم المندوب بجمعه من الزبون.
    // لذلك يجب أن نرسل سعر المنتجات + سعر التوصيل الكلي كـ all_price لتجنب خطأ "الربح بالسالب".
    const adjustedAllPriceForSupplier = (all_price * count) + websiteDeliveryPrice;
    const local_order_id = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    // Bypass Supplier Duplicate Phone Limitation
    // If the customer ordered today with the same phone, append a random variation
    let final_cus_num1 = cus_num1;
    const todayStr = new Date().toISOString().split('T')[0];
    const duplicateOrder = orders.find(o => o.cus_num1.trim().startsWith(cus_num1.trim()) && o.created_at.startsWith(todayStr));
    if (duplicateOrder) {
      final_cus_num1 = cus_num1.trim() + " - " + Math.floor(Math.random() * 99);
      console.log(`[Order] Modified duplicate phone number to bypass supplier rule: ${final_cus_num1}`);
    }

    // 1. Submit drop-ship request to Rolemall via Queue
    enqueueExternalOrder({
      local_order_id,
      cus_name,
      cus_num1: final_cus_num1,
      capetel,
      city: city || "",
      address,
      item_id,
      all_price: adjustedAllPriceForSupplier,
      count,
      note: note || "",
      ip: ip || "127.0.0.1"
    });

    // 3. Save locally with full disk persistence
    const matchedProduct = productsCache.find(p => p.id === item_id);
    const productTitle = matchedProduct ? matchedProduct.title : "منتج من متجري";
    const delivery_price = 5000;
    const total_price = (all_price * count) + delivery_price;

    const newOrder: Order = {
      id: local_order_id,
      cus_name,
      cus_num1,
      capetel: provinceClean,
      city: city || "",
      address,
      item_id,
      item_title: productTitle,
      all_price,
      delivery_price,
      total_price,
      count,
      note: note || "",
      status: "pending",
      created_at: new Date().toISOString()
    };

    orders.unshift(newOrder);
    saveOrder(newOrder);
    saveOrdersToFile(); // Disk persist

    res.json({
      success: true,
      message: "تم تسجيل طلبك بنجاح في متجر السعادة الخارجي!",
      order: newOrder
    });
  } catch (err: any) {
    console.error("Order process error:", err);
    res.status(500).json({ error: "فشل إرسال الطلب للمورد", details: err.message });
  }
});

// POST /api/add-cart-order - submit cart order (multi-item)
app.post("/api/add-cart-order", async (req: Request, res: Response) => {
  const { cus_name, cus_num1, capetel, city, address, items, note, ip, user_email } = req.body;

  if (!cus_name || !cus_num1 || !capetel || !address || !items || !Array.isArray(items) || items.length === 0) {
    res.status(422).json({
      detail: [
        {
          loc: ["body"],
          msg: "الحقول المطلوبة مفقودة لطلب السلة",
          type: "value_error.missing"
        }
      ]
    });
    return;
  }

  try {
    if (user_email && db()) {
      await db().collection('users').doc(user_email).set({
        phone: cus_num1,
        capetel: capetel,
        address: address
      }, { merge: true });
    }

    const provinceClean = capetel.trim();
    const isBaghdad = provinceClean.includes("بغداد");
    const websiteDeliveryPrice = 5000;
    const numItems = items.length;

    const submittedOrdersList: Order[] = [];

    // Process each item locally (do NOT send to supplier queue)
    for (const item of items) {
      const { item_id, all_price, count } = item;
      if (!item_id || !all_price || !count) continue;

      const local_order_id = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const matchedProduct = productsCache.find(p => p.id === item_id);
      const productTitle = matchedProduct ? matchedProduct.title : "منتج من متجري";
      
      // For local display, we can divide the shipping cost proportionally
      const delivery_price = Math.round(websiteDeliveryPrice / numItems);
      const total_price = (all_price * count) + delivery_price;

      const newOrder: Order = {
        id: local_order_id,
        cus_name,
        cus_num1,
        capetel: provinceClean,
        city: city || "",
        address,
        item_id,
        item_title: productTitle,
        all_price,
        delivery_price,
        total_price,
        count,
        note: note || "طلب سلة مجمع (إدخال يدوي للمورد)",
        status: "pending",
        created_at: new Date().toISOString()
      };

      orders.unshift(newOrder);
      saveOrder(newOrder);
      submittedOrdersList.push(newOrder);
    }
    
    // Calculate total price of all items
    let cartTotal = websiteDeliveryPrice;
    items.forEach((item: any) => {
        cartTotal += (item.all_price * item.count);
    });

    // Notify Telegram Admin for the Cart Order
    await notifyAdminTelegramCart({
      cus_name,
      cus_num1,
      capetel: provinceClean,
      city: city || "",
      address,
      note,
      total_price: cartTotal
    }, items);

    saveOrdersToFile(); // Disk persist

    res.json({
      success: true,
      message: "تم تسجيل كافة منتجات السلة بنجاح!",
      orders: submittedOrdersList
    });
  } catch (err: any) {
    console.error("Cart order process error:", err);
    res.status(500).json({ error: "فشل إرسال طلب السلة للمورد", details: err.message });
  }
});

// POST /api/add-simple-order-no-limit - same as add-simple-order
app.post("/api/add-simple-order-no-limit", (req: Request, res: Response) => {
  return app._router.handle(req, res);
});

// GET /my-ip - returns requester's IP details
app.get("/my-ip", (req: Request, res: Response) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "127.0.0.1";
  res.json({ ip });
});


// ==========================================
// 2. GEMINI AI API ENDPOINTS (SERVER HANDLED)
// ==========================================

// POST /api/gemini/chat - AI Assistant helping customer with product exploration and orders
app.post("/api/gemini/chat", async (req: Request, res: Response) => {
  const { messages, userMessage } = req.body;

  if (!userMessage) {
    res.status(400).json({ error: "userMessage is required" });
    return;
  }

  const ai = getGemini();

  // Inject current product listing context for Gemini to be highly informed
  const productContext = productsCache.map(p => 
    `- [معرف المنتج: ${p.id}] "${p.title}" بسعر ${p.price.toLocaleString("ar-IQ")} دينار عراقي. الوصف المختصر: ${p.description.substring(0, 100)}...`
  ).join("\n");

  const systemInstruction = `
أنت الآن "مساعد سوق السعادة الذكي" - بوت تسويقي تفاعلي لمتجر "سوق السعادة" العراقي.
مهمتك مساعدة الزبائن في استكشاف المنتجات، الإجابة عن استفساراتهم، واقتراح المنتجات الأنسب لهم.

معلومات أساسية عن متجر سوق السعادة:
1. خدمة التوصيل سريعة (24 ساعة).
2. أسعار التوصيل: العاصمة بغداد 3,000 دينار، بقية المحافظات 5,000 دينار.
3. الدفع عند الاستلام.

المنتجات المتوفرة حالياً في متجرنا:
${productContext}

توجيهات المحادثة:
- تحدث بلغة عربية عراقية لطيفة ("أهلاً بك عيوني"، "تدلل").
- أجب باختصار وسرعة وتجنب الإطالة لتسريع الرد.
- عندما تقترح منتجاً، يجب عليك وضع معرف المنتج في سطر مستقل بهذا التنسيق حصراً:
[PRODUCT:\${id}]
مثال:
[PRODUCT:15]
- افصل بين المنتجات المقترحة بشكل واضح.
- لا تذكر أسعاراً أو معلومات غير صحيحة.
  `;

  if (!ai) {
    // Simulated chat response
    setTimeout(() => {
      let fallbackText = "أهلاً بك عيني في سوق السعادة! نورتنا بوجودك. ❤️\n\nبصفتي مساعدك الذكي، يسعدني جداً خدمتك. يمكنك تصفح منتجاتنا الإبداعية الرائعة وطلبها فوراً! التوصيل لبغداد بـ 3 آلاف وباقي المحافظات بـ 5 آلاف فقط ويصلك خلال 24 ساعة! بشنو أكدر أساعدك اليوم عيني؟";
      const query = userMessage.toLowerCase();
      if (query.includes("توصيل") || query.includes("شحن") || query.includes("بغداد")) {
        fallbackText = "تدلل عيني! التوصيل في سوق السعادة سريع جداً ويستغرق 24 ساعة فقط! 🚚\n\nالأجور ثابتة:\n• داخل بغداد: 3,000 د.ع\n• بقية محافظات العراق: 5,000 د.ع\nالطلب سهل جداً، فقط اختر محافظتك في نموذج الطلب وسيحسب الإجمالي تلقائياً!";
      } else if (query.includes("سعر") || query.includes("بكم") || query.includes("فلوس")) {
        fallbackText = "يا مية هلا بك! كل الأسعار حقيقية وواضحة تحت كل منتج في سوق السعادة 💰. يمكنك الضغط على المنتج لمشاهدة التفاصيل الكاملة ومميزاته مع سعر البيع المعتمد.";
      } else {
        const matched = productsCache.find(p => query.includes(p.title.toLowerCase()) || p.title.toLowerCase().split(" ").some(w => w.length > 3 && query.includes(w)));
        if (matched) {
          fallbackText = `عيني، هذا المنتج "${matched.title}" ممتاز جداً ومن الأكثر طلباً لدينا! ⭐\n\nسعره هو ${matched.price.toLocaleString("ar-IQ")} د.ع فقط. التوصيل سريع خلال 24 ساعة. هل تحب نساعدك في تسجيل طلب لهذا المنتج؟`;
        }
      }
      res.json({ text: fallbackText });
    }, 600);
    return;
  }

  try {
    const contents = [];
    if (messages && messages.length > 0) {
      for (const msg of messages) {
        contents.push({
          role: msg.sender === "user" ? "user" : "model",
          parts: [{ text: msg.text }]
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: userMessage }]
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let responseStream;
    let retries = 3;
    while (retries > 0) {
      try {
        responseStream = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
          }
        });
        break; // Success
      } catch (err: any) {
        if (err.status === 503 && retries > 1) {
          retries--;
          await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2 seconds before retry
        } else {
          throw err;
        }
      }
    }

    if (responseStream) {
      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
    } else {
      res.write(`data: ${JSON.stringify({ text: "عذراً عيني، أواجه ضغطاً كبيراً حالياً، يرجى المحاولة بعد قليل 😊" })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }
    if (error.status === 503 || error.message?.includes('503')) {
        res.write(`data: ${JSON.stringify({ text: "عذراً عيني، أواجه ضغطاً كبيراً حالياً، يرجى المحاولة بعد قليل 😊" })}\n\n`);
    } else {
        res.write(`data: ${JSON.stringify({ text: "نعتذر منك عيوني، واجهت مشكلة صغيرة بالاتصال بالسيرفر. بس لا تشيل هم، التوصيل مالتنا مستمر خلال 24 ساعة لبغداد بـ 3 آلاف وباقي المحافظات بـ 5 آلاف دينار! تكدر تطلب أي منتج مباشرة بالضغط على 'اطلب الآن'." })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// POST /api/gemini/enhance-description - AI Description enhancer with Emojis & beautiful copy
app.post("/api/gemini/enhance-description", async (req: Request, res: Response) => {
  const { productId } = req.body;

  if (!productId) {
    res.status(400).json({ error: "productId is required" });
    return;
  }

  let product = productsCache.find(p => p.id === productId);

  if (!product) {
    res.status(404).json({ error: "المنتج غير موجود" });
    return;
  }

  const ai = getGemini();
  const rawText = product.raw_description || product.description;

  const systemInstruction = `
أنت خبير كتابة نصوص إعلانية وتسويقية متميز في مجال التجارة الإلكترونية والدوب شيبينغ في العراق.
مهمتك هي إعادة صياغة وصف المنتج الخام إلى وصف تسويقي إبداعي وجذاب جداً باللغة العربية مع إيموجي ملائمة ومبهجة تعكس طابع "سوق السعادة".

شروط العمل:
1. حافظ على صحة ومصداقية المعلومات والمواصفات الفنية الواردة في النص الأصلي بالكامل، ولا تخترع أو تبتكر مزايا خيالية غير حقيقية!
2. ابدأ بمقدمة تسويقية رنانة وجاذبة للانتباه تلامس مشكلة الزبون أو رغبته.
3. قسّم الوصف إلى نقاط مرتبة (مثلاً باستخدام علامة • أو رموز تعبيرية مناسبة) ليسهل قراءتها.
4. ركز على الفائدة التي سيحصل عليها الزبون من اقتنائه المنتج.
5. أنهِ الوصف بعبارة حث على اتخاذ إجراء (Call to Action) جذابة تناسب متجر "سوق السعادة".
6. اجعل النص بليغاً ومقنعاً ومتوافقاً مع لهجة وثقافة المستهلك العراقي الراقي.
  `;

  if (!ai) {
    setTimeout(() => {
      const fallbackEnhanced = `🌟 منتج مميز وحصري من سوق السعادة! 🌟\n\nلقد قمنا بتحسين هذا الوصف تلقائياً لمحاكات الذكاء الاصطناعي المبدع:\n\n✨ مميزات إضافية للمنتج:\n• ⚡ أداء مثالي ومجرب 100% لضمان أعلى مستويات الجودة.\n• 🎨 تصميم هندسي أنيق يضيف لمسة عصرية وفخمة لاستخداماتك اليومية.\n• 🛡️ كفالة حقيقية ودعم متواصل لضمان سعادتك.\n• 🚚 متوفر للتوصيل الفوري بأسعار تبدأ من 3 آلاف فقط!\n\n🛍️ اطلبه الآن قبل نفاد الكمية واستمتع بالسعادة المطلقة مع عائلتك!`;
      ENHANCED_DESCRIPTIONS[productId] = fallbackEnhanced;
      if (product) product.description = fallbackEnhanced;
      res.json({ enhancedDescription: fallbackEnhanced, productId });
    }, 800);
    return;
  }

  try {
    let response;
    let retries = 3;
    while (retries > 0) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `اسم المنتج: "${product.title}"\nالوصف الأصلي للمنتج:\n"${rawText}"`,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.8,
          }
        });
        break;
      } catch (err: any) {
        if (err.status === 503 && retries > 1) {
          retries--;
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw err;
        }
      }
    }

    const enhanced = response?.text || rawText;
    ENHANCED_DESCRIPTIONS[productId] = enhanced;
    product.description = enhanced;

    res.json({ enhancedDescription: enhanced, productId });
  } catch (error: any) {
    console.error("Gemini Enhance Error:", error);
    // Fallback to raw text instead of crashing
    ENHANCED_DESCRIPTIONS[productId] = rawText;
    product.description = rawText;
    res.json({ enhancedDescription: rawText, productId });
  }
});


// ==========================================
// 3. ADMIN PANEL API ENDPOINTS
// ==========================================

// GET /api/admin/orders - Get all orders placed in this session/store front
app.get("/api/admin/orders", (req: Request, res: Response) => {
  res.json(orders);
});

// PUT /api/admin/order-status - Update order status with file persistence
app.put("/api/admin/order-status", (req: Request, res: Response) => {
  const { orderId, status } = req.body;
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }
  order.status = status;
  saveOrder(order);
  saveOrdersToFile(); // Persist changes
  res.json({ success: true, order });
});

// POST /api/admin/product - Create new custom product (added to cache) with file persistence
app.post("/api/admin/product", (req: Request, res: Response) => {
  const { title, raw_description, category_id, wholesale_price, price, image } = req.body;

  if (!title || !raw_description || !category_id || !wholesale_price || !price) {
    res.status(400).json({ error: "جميع الحقول الأساسية للمنتج مطلوبة" });
    return;
  }

  const generatedId = Math.floor(20000 + Math.random() * 80000);
  const discount = 15 + (generatedId % 7) * 5;

  const newProduct: Product = {
    id: generatedId,
    title,
    raw_description,
    description: raw_description,
    category_id: parseInt(category_id),
    wholesale_price: parseInt(wholesale_price),
    price: parseInt(price),
    image: image || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600",
    rating: 5.0,
    sales_count: 0,
    stock: 50, // Newly added custom products start with a nice stock level
    discount: discount
  };

  productsCache.unshift(newProduct);

  // Save to custom products list
  try {
    let customProducts: Product[] = [];
    if (fs.existsSync(CUSTOM_PRODUCTS_FILE_PATH)) {
      customProducts = JSON.parse(fs.readFileSync(CUSTOM_PRODUCTS_FILE_PATH, "utf-8"));
    }
    customProducts.unshift(newProduct);
    fs.writeFileSync(CUSTOM_PRODUCTS_FILE_PATH, JSON.stringify(customProducts, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save custom product to file:", err);
  }

  res.json({ success: true, product: newProduct });
});

// DELETE /api/admin/product/:id - Delete product from current cache with file persistence
app.delete("/api/admin/product/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const exists = productsCache.some(p => p.id === id);
  if (!exists) {
    res.status(404).json({ error: "المنتج غير موجود" });
    return;
  }
  productsCache = productsCache.filter(p => p.id !== id);

  // Update custom products file
  try {
    if (fs.existsSync(CUSTOM_PRODUCTS_FILE_PATH)) {
      let customProducts: Product[] = JSON.parse(fs.readFileSync(CUSTOM_PRODUCTS_FILE_PATH, "utf-8"));
      customProducts = customProducts.filter(p => p.id !== id);
      fs.writeFileSync(CUSTOM_PRODUCTS_FILE_PATH, JSON.stringify(customProducts, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Failed to update custom products file after deletion:", err);
  }

  res.json({ success: true, message: "تم حذف المنتج بنجاح من الذاكرة" });
});

// GET /api/admin/stats - Statistics & Profits
app.get("/api/admin/stats", (req: Request, res: Response) => {
  let totalSales = 0;
  let totalWholesale = 0;
  let totalConfirmedOrders = 0;
  let totalPendingOrders = 0;

  for (const order of orders) {
    if (order.status !== "cancelled") {
      const product = productsCache.find(p => p.id === order.item_id);
      const wholesalePrice = product ? product.wholesale_price : Math.round(order.all_price * 0.8);
      
      totalSales += (order.all_price * order.count);
      totalWholesale += (wholesalePrice * order.count);

      if (order.status === "pending") totalPendingOrders++;
      else totalConfirmedOrders++;
    }
  }

  const netProfit = totalSales - totalWholesale;

  res.json({
    totalOrdersCount: orders.length,
    totalPendingOrders,
    totalConfirmedOrders,
    totalSales,
    totalWholesale,
    netProfit,
    shippingEarnings: orders.filter(o => o.status !== "cancelled").reduce((sum, o) => sum + o.delivery_price, 0)
  });
});

// GET /api/user-orders - Get orders for a specific customer by phone or name
app.get("/api/user-orders", (req: Request, res: Response) => {
  const { phone, name } = req.query;
  
  if (!phone && !name) {
    res.json([]);
    return;
  }
  
  let filteredOrders = [...orders];
  
  if (phone) {
    const cleanPhone = (phone as string).trim();
    filteredOrders = filteredOrders.filter(o => 
      o.cus_num1 && o.cus_num1.trim() === cleanPhone
    );
  } else if (name) {
    const cleanName = (name as string).toLowerCase().trim();
    filteredOrders = filteredOrders.filter(o => 
      o.cus_name && o.cus_name.toLowerCase().trim().includes(cleanName)
    );
  }
  
  res.json(filteredOrders);
});

// GET /api/user-role - check user role
app.get("/api/user-role", async (req: Request, res: Response) => {
    const email = req.query.email as string;
    if (!email) { res.status(400).json({ error: "Missing email" }); return; }
    if (!db()) { res.json({ role: 'user' }); return; } // No DB: default to user role
    try {
        const userDoc = await db().collection('users').doc(email).get();
        if (userDoc.exists) res.json({ role: userDoc.data()?.role });
        else res.json({ role: 'user' });
    } catch(err) {
        res.json({ role: 'user' }); // Fail gracefully
    }
});

// POST /api/user/sync - Sync user from Google Auth
app.post("/api/user/sync", async (req: Request, res: Response) => {
    const { email, displayName, uid } = req.body;
    if (!email) {
      res.status(400).json({ error: "Missing email" });
      return;
    }
    if (!db()) {
      // No DB configured: return minimal user profile (login still works via Firebase)
      res.json({ email, role: 'user' });
      return;
    }
    try {
        const userDoc = await db().collection('users').doc(email).get();
        if (userDoc.exists) {
            res.json(userDoc.data());
        } else {
            const newUser = { email, role: 'user' };
            await db().collection('users').doc(email).set(newUser);
            res.json(newUser);
        }
    } catch(err) {
        console.error("User sync error:", err);
        res.json({ email, role: 'user' }); // Fail gracefully
    }
});

// POST /api/admin/assign-role - assign role
app.post("/api/admin/assign-role", async (req: Request, res: Response) => {
    const { email, role } = req.body;
    if (!db()) { res.status(503).json({ error: "Database not configured" }); return; }
    try {
        await db().collection('users').doc(email).update({ role });
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: "Database error" });
    }
});


// ==========================================
// 4. VITE DEV SERVER MIDDLEWARE & STATIC SERVING
// ==========================================

async function startServer() {
  // Pre-populate data cache from Rolemall on boot
  await populateCaches();

  // Auto-refresh products cache from the supplier every 15 minutes to stay updated automatically
  setInterval(() => {
    console.log("[سوق السعادة] تحديث تلقائي لمخزن المنتجات من المورد...");
    populateCaches().catch(err => console.error("Auto-populate failed:", err));
  }, 15 * 60 * 1000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      configFile: './vite.config.ts',
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[سوق السعادة] Fullstack backend integrated successfully on port ${PORT}!`);
  });
}

startServer().catch((err) => {
  console.error("Failed to boot fullstack server:", err);
});
