import React, { useState, useEffect, useRef } from "react";
import { X, MapPin, Phone, User, ShoppingBag, Truck, Calendar, ShieldCheck, ZoomIn } from "lucide-react";
import { Product, Order } from "../types";
import { IRAQI_PROVINCES } from "../initialData";
import { createOrder } from "../lib/firebase";
import { ConfirmModal } from "./ConfirmModal";

interface CheckoutModalProps {
  product?: Product;
  cartItems?: { product: Product; count: number }[];
  onClose: () => void;
  onOrderSuccess: (order: Order) => void;
  onClearCart?: () => void;
  onZoomImage?: (imageUrl: string) => void;
  userId?: string;
  userEmail?: string;
  initialPhone?: string;
  initialAddress?: string;
  initialCapetel?: string;
  initialName?: string;
}

export default function CheckoutModal({ product, cartItems, onClose, onOrderSuccess, onClearCart, onZoomImage, userId, userEmail, initialPhone, initialAddress, initialCapetel, initialName }: CheckoutModalProps) {
  const [cusName, setCusName] = useState(() => initialName || localStorage.getItem("saved_cus_name") || "");
  const [cusNum, setCusNum] = useState(() => initialPhone || localStorage.getItem("saved_cus_num") || "");
  const [province, setProvince] = useState(() => initialCapetel || localStorage.getItem("saved_province") || "بغداد");
  const [city, setCity] = useState(() => localStorage.getItem("saved_city") || "");
  const [address, setAddress] = useState(() => initialAddress || localStorage.getItem("saved_address") || "");
  const [count, setCount] = useState(1);
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const isConfirmed = useRef(false);

  const isCartMode = !!cartItems && cartItems.length > 0;

  // Get shipping fee based on current province selection
  const shippingFee = 5000;
  
  // Calculate totals
  const productTotal = isCartMode
    ? cartItems.reduce((sum, item) => sum + item.product.price * item.count, 0)
    : (product ? product.price * count : 0);
    
  const grandTotal = productTotal + shippingFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Simple validations
    if (cusName.trim().length < 3) {
      setErrorMsg("الرجاء إدخال الاسم الثلاثي الكامل للزبون.");
      return;
    }

    const cleanedPhone = cusNum.trim();
    if (!cleanedPhone.match(/^(07\d{9})$/)) {
      setErrorMsg("الرجاء إدخال رقم هاتف عراقي صالح يبدأ بـ 07 ويتكون من 11 رقماً (مثال: 07701234567).");
      return;
    }

    if (address.trim().length < 5) {
      setErrorMsg("الرجاء كتابة العنوان الكامل بالتفصيل لتسهيل التوصيل السريع.");
      return;
    }

    setIsLoading(true);

    const savedPhone = localStorage.getItem("saved_cus_num");
    const lastOrderDate = localStorage.getItem("saved_order_date");
    const todayStr = new Date().toISOString().split('T')[0];

    if (savedPhone && savedPhone === cleanedPhone && lastOrderDate === todayStr && !isConfirmed.current) {
      setShowConfirmModal(true);
      setIsLoading(false);
      return;
    }

    processCheckout(cleanedPhone);
  };

  const processCheckout = async (cleanedPhone: string) => {
    setIsLoading(true);
    try {
      if (isCartMode) {
        // Submit cart order
        const orderItems = cartItems.map(item => ({
          item_id: item.product.id,
          all_price: item.product.price,
          count: item.count
        }));

        const response = await fetch("/api/add-cart-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cus_name: cusName,
            cus_num1: cleanedPhone,
            capetel: province,
            city: city,
            address: address,
            items: orderItems,
            note: note,
            ip: "127.0.0.1",
            user_email: userEmail
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "فشل تسجيل طلب السلة");
        }

        // Create a consolidated order for the success toast presentation
        const consolidatedTitle = cartItems
          .map(item => `${item.product.title} (عدد ${item.count})`)
          .join(" + ");

        const unifiedOrder: Order = {
          id: data.orders[0]?.id || `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
          cus_name: cusName,
          cus_num1: cleanedPhone,
          capetel: province,
          city: city,
          address: address,
          item_id: 0,
          item_title: consolidatedTitle,
          all_price: productTotal,
          delivery_price: shippingFee,
          total_price: grandTotal,
          count: cartItems.reduce((sum, item) => sum + item.count, 0),
          note: note,
          status: "pending",
          created_at: new Date().toISOString()
        };

        if (onClearCart) {
          onClearCart();
        }
        
        // Save to Firestore if logged in
        if (userId) {
          await createOrder(userId, unifiedOrder);
        }

        // Save info locally
        localStorage.setItem("saved_cus_name", cusName);
        localStorage.setItem("saved_cus_num", cleanedPhone);
        localStorage.setItem("saved_province", province);
        localStorage.setItem("saved_city", city);
        localStorage.setItem("saved_address", address);
        localStorage.setItem("saved_order_date", new Date().toISOString().split('T')[0]);

        onOrderSuccess(unifiedOrder);
      } else if (product) {
        // Submit simple single order
        const response = await fetch("/api/add-simple-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cus_name: cusName,
            cus_num1: cleanedPhone,
            capetel: province,
            city: city,
            address: address,
            item_id: product.id,
            all_price: product.price,
            count: count,
            note: note,
            ip: "127.0.0.1",
            user_email: userEmail
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "فشل تسجيل الطلب");
        }

        // Save to Firestore if logged in
        if (userId) {
          await createOrder(userId, data.order);
        }

        // Save info locally
        localStorage.setItem("saved_cus_name", cusName);
        localStorage.setItem("saved_cus_num", cleanedPhone);
        localStorage.setItem("saved_province", province);
        localStorage.setItem("saved_city", city);
        localStorage.setItem("saved_address", address);
        localStorage.setItem("saved_order_date", new Date().toISOString().split('T')[0]);

        onOrderSuccess(data.order);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal Content */}
      <div className="relative bg-[#1e222d] border border-[#2a2e39] rounded-3xl max-w-lg w-full overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-white text-right z-10 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2a2e39]">
          <button 
            id="close-checkout-btn"
            onClick={onClose} 
            className="text-gray-400 hover:text-[#ff9800] hover:bg-[#2a2e39] p-2 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2 space-x-reverse">
            <ShoppingBag className="w-5 h-5 text-[#ff9800]" />
            <h2 className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-[#ff9800] to-[#ffa726]">
              {isCartMode ? "إكمال طلب السلة - شحن 24 ساعة" : "شراء سريع وتوصيل بـ 24 ساعة"}
            </h2>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto p-5 space-y-5">
          
          {/* Selected Product Summary card */}
          {isCartMode ? (
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#787b86]">المنتجات في السلة ({cartItems.length}):</span>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {cartItems.map((item, idx) => (
                  <div key={idx} className="bg-[#171b26] border border-[#2a2e39]/60 rounded-xl p-2.5 flex items-center gap-3 flex-row-reverse group/coImg">
                    <div className="relative">
                      <img 
                        src={item.product.image} 
                        alt={item.product.title} 
                        className="w-10 h-10 object-contain p-0.5 bg-white rounded-lg border border-[#2a2e39]"
                      />
                      {onZoomImage && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onZoomImage(item.product.image); }}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover/coImg:opacity-100 transition-opacity rounded-lg cursor-pointer"
                          title="تكبير الصورة"
                        >
                          <ZoomIn className="w-3 h-3 text-white" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1 text-right min-w-0">
                      <h4 className="text-xs font-bold text-gray-100 truncate"><bdi>{item.product.title}</bdi></h4>
                      <p className="text-[10px] text-[#787b86] mt-0.5">
                        <bdi>{item.product.price.toLocaleString("ar-IQ")} د.ع × {item.count} قطع</bdi>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            product && (
              <div className="bg-[#171b26] border border-[#2a2e39] rounded-2xl p-4 flex items-center gap-4 flex-row-reverse group/coImgSingle">
                <div className="relative">
                  <img 
                    src={product.image} 
                    alt={product.title} 
                    className="w-16 h-16 object-contain p-1 bg-white rounded-xl border border-[#2a2e39]"
                  />
                  {onZoomImage && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onZoomImage(product.image); }}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover/coImgSingle:opacity-100 transition-opacity rounded-xl cursor-pointer"
                      title="تكبير الصورة"
                    >
                      <ZoomIn className="w-5 h-5 text-white" />
                    </button>
                  )}
                </div>
                <div className="flex-1 text-right">
                  <span className="text-[10px] text-[#ff9800] font-bold bg-[#ff9800]/10 px-2 py-0.5 rounded">منتج أصلي مضمون</span>
                  <h4 className="text-sm font-bold text-gray-100 line-clamp-1 mt-1"><bdi>{product.title}</bdi></h4>
                  <p className="text-xs text-[#787b86] mt-1">
                    سعر القطعة: <bdi>{product.price.toLocaleString("ar-IQ")} د.ع</bdi>
                  </p>
                </div>
              </div>
            )
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-3 rounded-xl text-xs font-semibold text-right">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Customer Name */}
            <div>
              <label className="block text-xs font-bold text-[#787b86] mb-1.5">الاسم الثلاثي للزبون *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="مثال: علي محمد جعفر"
                  value={cusName}
                  onChange={(e) => setCusName(e.target.value)}
                  className="w-full bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2.5 px-4 text-right text-sm outline-none transition-all"
                />
                <User className="w-4 h-4 text-[#787b86] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Customer Phone */}
            <div>
              <label className="block text-xs font-bold text-[#787b86] mb-1.5">رقم الهاتف العراقي *</label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  placeholder="077XXXXXXXX أو 078XXXXXXXX"
                  value={cusNum}
                  onChange={(e) => setCusNum(e.target.value)}
                  className="w-full bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2.5 px-4 text-right text-sm outline-none transition-all [direction:ltr] pr-10"
                />
                <Phone className="w-4 h-4 text-[#787b86] absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Governorate (capital) Selector */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#787b86] mb-1.5">المحلة أو القضاء</label>
                <input
                  type="text"
                  placeholder="مثال: الكرادة / المنصور"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2.5 px-4 text-right text-sm outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#787b86] mb-1.5">المحافظة للزبون *</label>
                <div className="relative">
                  <select
                    id="province-select"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2.5 px-4 text-right text-sm outline-none transition-all appearance-none cursor-pointer"
                  >
                    {IRAQI_PROVINCES.map((p) => (
                      <option key={p.name} value={p.name} className="bg-[#1e222d]">
                        {p.name} (شحن 5,000 د.ع)
                      </option>
                    ))}
                  </select>
                  <MapPin className="w-4 h-4 text-[#787b86] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Full detailed Address */}
            <div>
              <label className="block text-xs font-bold text-[#787b86] mb-1.5">العنوان بالتفصيل *</label>
              <textarea
                required
                rows={2}
                placeholder="اسم الشارع، أقرب نقطة دالة، رقم الفرع أو المنزل"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2 px-4 text-right text-sm outline-none transition-all resize-none"
              />
            </div>

            {/* Quantity Counter (only for single product mode) */}
            {!isCartMode && product && (
              <div className="flex items-center justify-between p-3.5 bg-[#171b26] border border-[#2a2e39] rounded-2xl">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <button
                    type="button"
                    onClick={() => setCount(Math.max(1, count - 1))}
                    className="w-8 h-8 rounded-lg bg-[#2a2e39] hover:bg-[#ff9800]/15 hover:text-[#ff9800] border border-transparent hover:border-[#ff9800]/30 text-gray-300 font-black flex items-center justify-center transition-all"
                  >
                    -
                  </button>
                  <span className="text-sm font-black w-6 text-center">{count}</span>
                  <button
                    type="button"
                    onClick={() => setCount(count + 1)}
                    className="w-8 h-8 rounded-lg bg-[#2a2e39] hover:bg-[#ff9800]/15 hover:text-[#ff9800] border border-transparent hover:border-[#ff9800]/30 text-gray-300 font-black flex items-center justify-center transition-all"
                  >
                    +
                  </button>
                </div>
                <span className="text-xs font-bold text-[#787b86]">الكمية المطلوبة</span>
              </div>
            )}

            {/* Note */}
            <div>
              <label className="block text-xs font-bold text-[#787b86] mb-1.5">ملاحظات خاصة بالتوصيل (اختياري)</label>
              <input
                type="text"
                placeholder="مثال: التوصيل بعد الساعة 4 عصراً"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2.5 px-4 text-right text-sm outline-none transition-all"
              />
            </div>

            {/* Invoice Summary Breakout */}
            <div className="bg-[#171b26] border border-[#2a2e39] rounded-2xl p-4 space-y-2.5 text-xs text-[#787b86]">
              <div className="flex justify-between items-center flex-row-reverse">
                <span>سعر السلع:</span>
                <span className="text-gray-100 font-medium">
                  <bdi>
                    {isCartMode 
                      ? `${productTotal.toLocaleString("ar-IQ")} د.ع`
                      : `(${count} قطع) × ${product?.price.toLocaleString("ar-IQ")} د.ع`
                    }
                  </bdi>
                </span>
              </div>
              <div className="flex justify-between items-center flex-row-reverse">
                <span>أجور التوصيل الفوري:</span>
                <span className="text-gray-100 font-medium">
                  <bdi>
                    5,000 د.ع (لكل المحافظات)
                  </bdi>
                </span>
              </div>
              <div className="border-t border-[#2a2e39] pt-2 flex justify-between items-center flex-row-reverse">
                <span className="text-sm font-bold text-white">المبلغ الإجمالي الكلي:</span>
                <span className="text-[#ff9800] text-base font-black">
                  <bdi>{grandTotal.toLocaleString("ar-IQ")} دينار عراقي</bdi>
                </span>
              </div>
            </div>

            {/* Shipping Info Banners */}
            <div className="grid grid-cols-3 gap-2 text-[9px] sm:text-[10px] text-[#787b86]">
              <div className="bg-[#171b26] p-2 rounded-xl border border-emerald-500/15 flex flex-col items-center text-center justify-center">
                <ShieldCheck className="w-4 h-4 text-emerald-400 mb-1" />
                <div className="font-bold text-emerald-400">ضمان استرجاع</div>
                <span className="text-[8px] sm:text-[9px]">لمدة أسبوع كامل</span>
              </div>
              <div className="bg-[#171b26] p-2 rounded-xl border border-[#2a2e39] flex flex-col items-center text-center justify-center">
                <Truck className="w-4 h-4 text-[#ff9800] mb-1" />
                <div className="font-bold text-gray-200">توصيل 24 ساعة</div>
                <span className="text-[8px] sm:text-[9px]">شحن فوري مخصص</span>
              </div>
              <div className="bg-[#171b26] p-2 rounded-xl border border-[#2a2e39] flex flex-col items-center text-center justify-center">
                <ShieldCheck className="w-4 h-4 text-emerald-500 mb-1" />
                <div className="font-bold text-gray-200">دفع عند الاستلام</div>
                <span className="text-[8px] sm:text-[9px]">افحص قبل الدفع</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="submit-order-btn"
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-[#ff9800] text-[#131722] hover:bg-[#ffa726] disabled:opacity-50 py-3.5 rounded-xl text-sm font-black transition-all duration-300 shadow-[0_4px_20px_rgba(255,152,0,0.3)] hover:shadow-[0_4px_25px_rgba(255,152,0,0.45)] cursor-pointer flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transform"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-[#131722] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Truck className="w-5 h-5 animate-pulse" />
                  <span>تأكيد طلب التوصيل الفوري الآن</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        title="تنبيه: طلب متكرر"
        message="لقد قمت بتسجيل طلب سابق بنفس هذا الرقم اليوم. هل أنت متأكد أنك تريد إضافة هذا الطلب كقطعة إضافية منفصلة؟"
        confirmText="نعم، أضف الطلب"
        cancelText="تراجع"
        onConfirm={() => {
          setShowConfirmModal(false);
          isConfirmed.current = true;
          const cleanedPhone = cusNum.trim();
          processCheckout(cleanedPhone);
        }}
        onCancel={() => {
          setShowConfirmModal(false);
          isConfirmed.current = false;
        }}
      />
    </div>
  );
}
