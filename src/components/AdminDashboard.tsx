import React, { useState, useEffect } from "react";
import { 
  TrendingUp, Coins, ShoppingBag, Truck, Calendar, Sparkles, CheckCircle2, 
  Trash2, Plus, Clock, FileText, AlertTriangle, RefreshCw, Layers, LogOut
} from "lucide-react";
import { Product, Order, Category } from "../types";

import { saveProductEnhancement, db } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore";

interface AdminDashboardProps {
  categories: Category[];
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  onLogout: () => void;
  onBackToStore: () => void;
}

export default function AdminDashboard({ 
  categories, 
  products, 
  setProducts,
  onLogout,
  onBackToStore
}: AdminDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [cloudOrders, setCloudOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalOrdersCount: 0,
    totalPendingOrders: 0,
    totalConfirmedOrders: 0,
    totalSales: 0,
    totalWholesale: 0,
    netProfit: 0,
    shippingEarnings: 0
  });

  // Add Product Form State
  const [newTitle, setNewTitle] = useState("");
  const [newRawDesc, setNewRawDesc] = useState("");
  const [newCat, setNewCat] = useState("1");
  const [newWholesale, setNewWholesale] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newImage, setNewImage] = useState("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // Status and loading states
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [enhancingProductId, setEnhancingProductId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Pagination State for Products List
  const [currentProductPage, setCurrentProductPage] = useState(1);
  const productsPerPage = 5;

  const fetchOrdersAndStats = async () => {
    setIsLoadingOrders(true);
    try {
      // Fetch Orders
      const ordRes = await fetch("/api/admin/orders");
      const ordData = await ordRes.json();
      if (ordRes.ok) setOrders(ordData);

      // Fetch Stats
      const statRes = await fetch("/api/admin/stats");
      const statData = await statRes.json();
      if (statRes.ok) setStats(statData);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrdersAndStats();
  }, [products]);

  // Firestore Orders Listener
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCloudOrders(docs);
    }, (err) => {
      console.error("Firestore onSnapshot orders error:", err);
    });
    return () => unsubscribe();
  }, []);

  // Handle Order Status Update
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      if (activeOrderTab === "cloud") {
        const { doc, updateDoc } = await import("firebase/firestore");
        const orderRef = doc(db!, "orders", orderId);
        await updateDoc(orderRef, { status: newStatus });
        setSuccessMessage(`تم تحديث حالة الطلب السحابي ${orderId} بنجاح!`);
      } else {
        const response = await fetch("/api/admin/order-status", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, status: newStatus })
        });
        if (response.ok) {
          setSuccessMessage(`تم تحديث حالة الطلب ${orderId} بنجاح!`);
          fetchOrdersAndStats();
        } else {
          throw new Error("فشل التحديث");
        }
      }
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setErrorMessage("فشل تحديث حالة الطلب");
      setTimeout(() => setErrorMessage(""), 3000);
    }
  };

  // Handle Add Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!newTitle || !newRawDesc || !newWholesale || !newPrice) {
      setErrorMessage("الرجاء ملء كافة الحقول الأساسية للمنتج.");
      return;
    }

    if (parseInt(newPrice) < parseInt(newWholesale)) {
      setErrorMessage("سعر البيع لا يمكن أن يكون أقل من سعر الجملة الداخلي!");
      return;
    }

    setIsAddingProduct(true);
    try {
      const response = await fetch("/api/admin/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          raw_description: newRawDesc,
          category_id: parseInt(newCat),
          wholesale_price: parseInt(newWholesale),
          price: parseInt(newPrice),
          image: newImage || undefined
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSuccessMessage(`تمت إضافة منتج "${newTitle}" بنجاح إلى المعرض!`);
        setProducts((prev) => [data.product, ...prev]);
        
        // Reset Form
        setNewTitle("");
        setNewRawDesc("");
        setNewWholesale("");
        setNewPrice("");
        setNewImage("");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ أثناء إضافة المنتج");
    } finally {
      setIsAddingProduct(false);
    }
  };

  // Handle Product Delete
  const handleDeleteProduct = async (id: number) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا المنتج من سوق السعادة نهائياً؟")) return;

    try {
      const response = await fetch(`/api/admin/product/${id}`, {
        method: "DELETE"
      });
      if (response.ok) {
        setProducts((prev) => prev.filter(p => p.id !== id));
        setSuccessMessage("تم حذف المنتج بنجاح.");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (err) {
      setErrorMessage("فشل حذف المنتج.");
    }
  };

  // Trigger Gemini AI Description Enhancer
  const handleEnhanceDescription = async (productId: number) => {
    setEnhancingProductId(productId);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/gemini/enhance-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "خطأ في تحسين الوصف");
      }

      // Save to Firestore
      await saveProductEnhancement(productId, data.enhancedDescription);

      // Update local state
      setProducts((prev) => 
        prev.map(p => p.id === productId ? { ...p, description: data.enhancedDescription } : p)
      );

      setSuccessMessage("✨ تم تحسين الوصف بنجاح بإضافة إيموجي وصياغة تسويقية رائعة عبر الذكاء الاصطناعي!");
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err: any) {
      console.error("Enhancement error:", err);
      let message = "عذراً، فشل الاتصال بخدمة الذكاء الاصطناعي لتحسين الوصف.";
      if (err.message.includes("503") || err.message.includes("high demand")) {
        message = "الذكاء الاصطناعي مشغول حالياً بسبب الضغط، يرجى المحاولة بعد قليل.";
      }
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(""), 6000);
    } finally {
      setEnhancingProductId(null);
    }
  };

  const [activeOrderTab, setActiveOrderTab] = useState<"local" | "cloud">("cloud"); // Default to cloud as it's more persistent

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-right text-white">
      
      {/* Messages */}
      {successMessage && (
        <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-end gap-2">
          <span>{successMessage}</span>
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-end gap-2">
          <span>{errorMessage}</span>
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
        </div>
      )}

      {/* Dashboard Headline */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="flex flex-wrap items-center gap-3 justify-start">
          <button 
            onClick={fetchOrdersAndStats}
            className="bg-[#2a2e39] hover:bg-[#2a2e39]/80 text-[#d1d4dc] border border-transparent px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingOrders ? "animate-spin" : ""}`} />
            تحديث البيانات
          </button>
          
          <button 
            onClick={onBackToStore}
            className="bg-[#ff9800]/10 hover:bg-[#ff9800]/20 text-[#ff9800] border border-[#ff9800]/25 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span>العودة للمتجر</span>
            <ShoppingBag className="w-4 h-4" />
          </button>

          <button 
            onClick={() => {
              if (confirm("هل أنت متأكد من رغبتك في تسجيل الخروج من لوحة التحكم؟")) {
                onLogout();
              }
            }}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span>تسجيل الخروج</span>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        
        <div className="text-right">
          <h1 className="text-2xl sm:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[#ff9800] to-[#ffa726]">
            لوحة إدارة أعمال سوق السعادة
          </h1>
          <p className="text-[#787b86] text-xs sm:text-sm mt-1">تتبع أرباحك، طلبات الزبائن، والمنتجات بالذكاء الاصطناعي</p>
        </div>
      </div>

      {/* Financial Analytics Grid (TradingView Style) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        {/* Metric 1 */}
        <div className="bg-[#1e222d] border border-[#2a2e39] p-4 sm:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs text-[#ff9800] font-black bg-[#ff9800]/10 px-2 py-0.5 rounded">صافي الأرباح</span>
            <div className="bg-[#ff9800]/10 p-2 rounded-xl text-[#ff9800]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <span className="text-xs text-[#787b86] block">أرباح المبيعات الفعلية</span>
          <span className="text-lg sm:text-2xl font-black text-white tracking-tight">
            {stats.netProfit.toLocaleString("ar-IQ")} <span className="text-xs text-[#787b86]">د.ع</span>
          </span>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#1e222d] border border-[#2a2e39] p-4 sm:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs text-emerald-400 font-black bg-emerald-500/10 px-2 py-0.5 rounded">المبيعات الكلية</span>
            <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-400">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <span className="text-xs text-[#787b86] block">إجمالي مبالغ الطلبات</span>
          <span className="text-lg sm:text-2xl font-black text-white tracking-tight">
            {stats.totalSales.toLocaleString("ar-IQ")} <span className="text-xs text-[#787b86]">د.ع</span>
          </span>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#1e222d] border border-[#2a2e39] p-4 sm:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs text-blue-400 font-black bg-blue-500/10 px-2 py-0.5 rounded">التكلفة الإجمالية</span>
            <div className="bg-blue-500/10 p-2 rounded-xl text-blue-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <span className="text-xs text-[#787b86] block">إجمالي سعر الجملة للمنتجات</span>
          <span className="text-lg sm:text-2xl font-black text-white tracking-tight">
            {stats.totalWholesale.toLocaleString("ar-IQ")} <span className="text-xs text-[#787b86]">د.ع</span>
          </span>
        </div>

        {/* Metric 4 */}
        <div className="bg-[#1e222d] border border-[#2a2e39] p-4 sm:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs text-[#ff9800] font-black bg-[#ff9800]/10 px-2 py-0.5 rounded">مجموع الطلبيات</span>
            <div className="bg-[#ff9800]/10 p-2 rounded-xl text-[#ff9800]">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <span className="text-xs text-[#787b86] block">قيد الانتظار: {stats.totalPendingOrders}</span>
          <span className="text-lg sm:text-2xl font-black text-white tracking-tight">
            {stats.totalOrdersCount} <span className="text-xs text-[#787b86]">طلبات</span>
          </span>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Add product & Inventory view */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* Add Product Form */}
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center space-x-2 space-x-reverse mb-5 pb-3 border-b border-[#2a2e39]">
              <Plus className="w-5 h-5 text-[#ff9800]" />
              <h3 className="font-bold text-base text-gray-100">إضافة منتج معروض جديد</h3>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#787b86] mb-1.5">عنوان المنتج (مثلاً: جهاز تدليك..)</label>
                <input
                  type="text"
                  required
                  placeholder="عنوان جذاب للمنتج"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2.5 px-4 text-right text-xs sm:text-sm outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#787b86] mb-1.5">الوصف الأساسي (الخام)</label>
                <textarea
                  required
                  rows={3}
                  placeholder="مواصفات وتفاصيل المنتج الفنية قبل تحسينها بالذكاء الاصطناعي"
                  value={newRawDesc}
                  onChange={(e) => setNewRawDesc(e.target.value)}
                  className="w-full bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2 px-4 text-right text-xs sm:text-sm outline-none resize-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#787b86] mb-1.5">سعر البيع المعتمد *</label>
                  <input
                    type="number"
                    required
                    placeholder="مثال: 49000"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2.5 px-4 text-right text-xs sm:text-sm outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#787b86] mb-1.5">سعر الجملة الداخلي *</label>
                  <input
                    type="number"
                    required
                    placeholder="مثال: 45000"
                    value={newWholesale}
                    onChange={(e) => setNewWholesale(e.target.value)}
                    className="w-full bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2.5 px-4 text-right text-xs sm:text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#787b86] mb-1.5">الفئة المعنية بالمنتج</label>
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  className="w-full bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2.5 px-4 text-right text-xs sm:text-sm outline-none cursor-pointer transition-all"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#1e222d]">{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#787b86] mb-1.5">رابط صورة المنتج (Unsplash أو غيره)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newImage}
                  onChange={(e) => setNewImage(e.target.value)}
                  className="w-full bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2.5 px-4 text-right text-xs sm:text-sm outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isAddingProduct}
                className="w-full bg-[#ff9800] text-[#131722] hover:bg-[#ffa726] font-black py-2.5 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98] transform"
              >
                {isAddingProduct ? (
                  <div className="w-4 h-4 border-2 border-[#131722] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>إضافة المنتج للمعرض</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Orders & Product List manager */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Active Orders Tracker */}
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-2xl p-5 sm:p-6 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#2a2e39] mb-5">
              <span className="text-[10px] bg-[#ff9800]/10 text-[#ff9800] px-2 py-0.5 rounded font-black">
                تحديث تلقائي
              </span>
              <div className="flex items-center space-x-2 space-x-reverse">
                <FileText className="w-5 h-5 text-[#ff9800]" />
                <h3 className="font-bold text-base text-gray-100">سجل طلبات الزبائن</h3>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-6 p-1 bg-[#171b26] rounded-xl self-start w-fit">
              <button
                onClick={() => setActiveOrderTab("cloud")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeOrderTab === "cloud" ? "bg-[#ff9800] text-[#131722]" : "text-gray-400 hover:text-white"
                }`}
              >
                الطلبات السحابية ({cloudOrders.length})
              </button>
              <button
                onClick={() => setActiveOrderTab("local")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeOrderTab === "local" ? "bg-[#ff9800] text-[#131722]" : "text-gray-400 hover:text-white"
                }`}
              >
                الطلبات المحلية ({orders.length})
              </button>
            </div>

            {isLoadingOrders ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-8 h-8 border-4 border-[#ff9800] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-[#787b86]">جاري تحميل أحدث الطلبات...</span>
              </div>
            ) : (activeOrderTab === "local" ? orders : cloudOrders).length === 0 ? (
              <div className="text-center py-12 text-[#787b86] text-xs sm:text-sm">
                لا توجد طلبات في هذا القسم حالياً.
              </div>
            ) : (
              <div className="space-y-4">
                {(activeOrderTab === "local" ? orders : cloudOrders).map((order) => {
                  const profit = order.total_price - (order.delivery_price + (products.find(p => p.id === order.item_id)?.wholesale_price || Math.round(order.all_price * 0.8)) * order.count);
                  return (
                    <div 
                      id={`order-row-${order.id}`}
                      key={order.id} 
                      className="bg-[#2a2e39] border border-transparent rounded-2xl p-4 space-y-3 text-xs sm:text-sm hover:border-[#ff9800]/30 transition-all duration-200"
                    >
                      {/* ID and Status selector */}
                      <div className="flex items-center justify-between gap-4">
                        <select
                          id={`status-select-${order.id}`}
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer outline-none ${
                            order.status === "delivered" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                            order.status === "completed" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                            order.status === "failed" ? "bg-red-500/20 text-red-300 border border-red-500/30" :
                            order.status === "cancelled" ? "bg-red-500/20 text-red-300 border border-red-500/30" :
                            order.status === "confirmed" ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" :
                            "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                          }`}
                        >
                          <option value="pending" className="bg-[#1e222d] text-white">قيد الانتظار ⏳</option>
                          <option value="confirmed" className="bg-[#1e222d] text-white">تم التأكيد 📞</option>
                          <option value="completed" className="bg-[#1e222d] text-white">مقبول من المورد ✅</option>
                          <option value="delivered" className="bg-[#1e222d] text-white">تم التوصيل 🚚</option>
                          <option value="failed" className="bg-[#1e222d] text-white">فشل الإرسال ❌</option>
                          <option value="cancelled" className="bg-[#1e222d] text-white">ملغي 🚫</option>
                        </select>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#787b86] text-[10px]">
                            {new Date(order.created_at).toLocaleString("ar-IQ")}
                          </span>
                          <span className="font-black text-[#ff9800]">{order.id}</span>
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-[#171b26] p-3 rounded-xl border border-[#2a2e39]">
                        <div>
                          <span className="block text-[10px] text-[#787b86]">اسم الزبون</span>
                          <span className="font-bold text-gray-200">{order.cus_name}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#787b86]">رقم الهاتف</span>
                          <span className="font-bold text-gray-200 [direction:ltr] inline-block">{order.cus_num1}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#787b86]">المحافظة والعنوان</span>
                          <span className="font-bold text-gray-200">{order.capetel} - {order.city || order.address.slice(0, 15)}</span>
                        </div>
                      </div>

                      {/* Item and Price breakdown */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <div className="text-right">
                            <span className="text-[#787b86]">السلعة:</span>{" "}
                            <span className="font-bold text-[#ff9800]">{order.item_title}</span>
                            <span className="text-[#787b86] mr-2">({order.count} قطعة)</span>
                          </div>
                          <div className="text-left font-semibold text-gray-200">
                            الإجمالي: <span className="text-white font-black">{order.total_price.toLocaleString("ar-IQ")} د.ع</span>
                            <span className="block text-[9px] text-emerald-400 text-left">
                              ربحك الصافي: +{profit.toLocaleString("ar-IQ")} د.ع
                            </span>
                          </div>
                        </div>
                        
                        {/* Notes and Failure Reason */}
                        {order.note && (
                          <div className={`p-2 rounded-lg text-xs border ${order.status === 'failed' ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-[#2a2e39] border-[#787b86]/30 text-gray-300'}`}>
                            <span className="font-bold">{order.status === 'failed' ? 'تفاصيل الخطأ:' : 'ملاحظات:'} </span>
                            {order.note}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Inventory & AI Enhancer Manager */}
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-2xl p-5 sm:p-6 shadow-sm overflow-hidden">
            <div className="flex items-center space-x-2 space-x-reverse mb-5 pb-3 border-b border-[#2a2e39]">
              <Sparkles className="w-5 h-5 text-[#ff9800]" />
              <h3 className="font-bold text-base text-gray-100">إدارة المعرض والتحسين التلقائي بالذكاء الاصطناعي</h3>
            </div>
            <div className="space-y-4">
              {(() => {
                const totalProductPages = Math.ceil(products.length / productsPerPage);
                const safeCurrentPage = Math.min(currentProductPage, Math.max(1, totalProductPages));
                const indexOfLastProduct = safeCurrentPage * productsPerPage;
                const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
                const currentProducts = products.slice(indexOfFirstProduct, indexOfLastProduct);

                if (products.length === 0) {
                  return <div className="text-center py-6 text-gray-400 text-xs">لا توجد منتجات في المعرض حالياً.</div>;
                }

                return (
                  <>
                    {currentProducts.map((prod) => {
                      const margin = prod.price - prod.wholesale_price;
                      return (
                        <div 
                          id={`inventory-row-${prod.id}`}
                          key={prod.id} 
                          className="flex flex-col sm:flex-row-reverse sm:items-center justify-between p-4 bg-[#2a2e39] border border-transparent rounded-2xl gap-4 hover:border-[#ff9800]/30 transition-all duration-200"
                        >
                          {/* Product Preview */}
                          <div className="flex items-center space-x-3 space-x-reverse flex-row-reverse text-right">
                            <img 
                              src={prod.image} 
                              alt={prod.title} 
                              className="w-12 h-12 object-cover rounded-xl border border-[#2a2e39]"
                            />
                            <div>
                              <h4 className="font-bold text-xs sm:text-sm text-gray-200">{prod.title}</h4>
                              <div className="flex items-center gap-2 mt-1 flex-row-reverse text-[10px]">
                                <span className="text-[#787b86]">الجملة: {prod.wholesale_price.toLocaleString("ar-IQ")} د.ع</span>
                                <span className="text-[#ff9800] font-bold">البيع: {prod.price.toLocaleString("ar-IQ")} د.ع</span>
                                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  الربح: +{margin.toLocaleString("ar-IQ")} د.ع
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* AI & Operations Controls */}
                          <div className="flex items-center gap-2.5 justify-start">
                            {/* Rewrite description button with AI */}
                            <button
                              id={`enhance-btn-${prod.id}`}
                              onClick={() => handleEnhanceDescription(prod.id)}
                              disabled={enhancingProductId !== null}
                              className="bg-[#ff9800]/10 hover:bg-[#ff9800]/25 text-[#ff9800] border border-[#ff9800]/20 disabled:opacity-40 px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              {enhancingProductId === prod.id ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-[#ff9800] border-t-transparent rounded-full animate-spin" />
                                  <span>جاري الصياغة...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 animate-pulse text-[#ff9800]" />
                                  <span>تحسين الوصف بالـ AI</span>
                                </>
                              )}
                            </button>

                            {/* Delete button */}
                            <button
                              id={`delete-btn-${prod.id}`}
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                              title="حذف المنتج من المتجر"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Numbered Pagination Controls */}
                    {totalProductPages > 1 && (() => {
                      // Generate truncated pagination range
                      const maxVisible = 5;
                      const range: (number | string)[] = [];
                      
                      if (totalProductPages <= 7) {
                        for (let i = 1; i <= totalProductPages; i++) {
                          range.push(i);
                        }
                      } else {
                        range.push(1);
                        
                        let start = Math.max(2, safeCurrentPage - 1);
                        let end = Math.min(totalProductPages - 1, safeCurrentPage + 1);
                        
                        if (safeCurrentPage <= 3) {
                          end = 4;
                        } else if (safeCurrentPage >= totalProductPages - 2) {
                          start = totalProductPages - 3;
                        }
                        
                        if (start > 2) {
                          range.push("...");
                        }
                        
                        for (let i = start; i <= end; i++) {
                          range.push(i);
                        }
                        
                        if (end < totalProductPages - 1) {
                          range.push("...");
                        }
                        
                        range.push(totalProductPages);
                      }

                      return (
                        <div className="flex items-center justify-between gap-2 mt-6 pt-4 border-t border-[#2a2e39] w-full">
                          <button
                            type="button"
                            disabled={safeCurrentPage === 1}
                            onClick={() => setCurrentProductPage(prev => Math.max(prev - 1, 1))}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2a2e39] text-gray-300 hover:bg-[#ff9800] hover:text-[#131722] disabled:opacity-40 disabled:hover:bg-[#2a2e39] disabled:hover:text-gray-300 transition-all cursor-pointer shrink-0"
                          >
                            السابق
                          </button>
                          
                          {/* Scrollable pages container to prevent any overflow */}
                          <div className="flex items-center gap-1.5 overflow-x-auto px-2 max-w-full no-scrollbar justify-center py-1">
                            {range.map((page, idx) => {
                              if (page === "...") {
                                return (
                                  <span key={`dots-${idx}`} className="px-2 text-gray-500 font-bold text-xs select-none">
                                    ...
                                  </span>
                                );
                              }
                              
                              const pageNum = page as number;
                              return (
                                <button
                                  type="button"
                                  key={`page-${pageNum}`}
                                  onClick={() => setCurrentProductPage(pageNum)}
                                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                                    safeCurrentPage === pageNum
                                      ? "bg-[#ff9800] text-[#131722] shadow-[0_0_10px_rgba(255,152,0,0.3)]"
                                      : "bg-[#2a2e39] text-gray-300 hover:bg-[#2a2e39]/80"
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            disabled={safeCurrentPage === totalProductPages}
                            onClick={() => setCurrentProductPage(prev => Math.min(prev + 1, totalProductPages))}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2a2e39] text-gray-300 hover:bg-[#ff9800] hover:text-[#131722] disabled:opacity-40 disabled:hover:bg-[#2a2e39] disabled:hover:text-gray-300 transition-all cursor-pointer shrink-0"
                          >
                            التالي
                          </button>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
          </div>
          
          {/* Admin User Management */}
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-2xl p-5 sm:p-6 shadow-sm overflow-hidden">
              <div className="flex items-center space-x-2 space-x-reverse mb-5 pb-3 border-b border-[#2a2e39]">
                <Layers className="w-5 h-5 text-[#ff9800]" />
                <h3 className="font-bold text-base text-gray-100">إدارة المشرفين</h3>
              </div>
              <div className="space-y-4">
                  <input type="email" placeholder="بريد المشرف الجديد" id="new-mod-email" className="w-full bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] rounded-xl py-2.5 px-4 text-right text-xs sm:text-sm outline-none transition-all" />
                  <button 
                    onClick={async () => {
                        const email = (document.getElementById('new-mod-email') as HTMLInputElement).value;
                        if (!email) return;
                        const res = await fetch('/api/admin/assign-role', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ email, role: 'moderator' })
                        });
                        if (res.ok) setSuccessMessage(`تم تعيين ${email} كمشرف!`);
                        else setErrorMessage("فشل التعيين");
                    }}
                    className="w-full bg-[#ff9800] text-[#131722] font-black py-2.5 rounded-xl text-xs sm:text-sm"
                  >
                      تعيين كمشرف
                  </button>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
