import React from "react";
import { X, ShoppingBag, Trash2, Plus, Minus, Truck, ArrowRight, ZoomIn } from "lucide-react";
import { CartItem, Product } from "../types";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateCount: (productId: number, count: number) => void;
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  onZoomImage?: (imageUrl: string) => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateCount,
  onRemoveItem,
  onClearCart,
  onCheckout,
  onZoomImage
}: CartDrawerProps) {
  if (!isOpen) return null;

  const totalItems = cartItems.reduce((sum, item) => sum + item.count, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.count, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans [direction:rtl]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300" 
        onClick={onClose}
      />

      {/* Panel Wrapper */}
      <div className="absolute inset-y-0 left-0 max-w-full flex">
        {/* Sliding Panel */}
        <div className="w-screen max-w-md bg-[#1e222d] border-r border-[#2a2e39] text-white flex flex-col shadow-[25px_0_60px_rgba(0,0,0,0.5)] animate-in slide-in-from-left duration-300">
          
          {/* Header */}
          <div className="p-6 border-b border-[#2a2e39] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#ff9800]/10 border border-[#ff9800]/20 rounded-xl flex items-center justify-center text-[#ff9800]">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-white">سلة المشتريات</h3>
                <p className="text-[10px] text-[#787b86] font-bold">لديك {totalItems} قطع في السلة</p>
              </div>
            </div>
            
            <button 
              id="close-cart-btn"
              onClick={onClose}
              className="text-gray-400 hover:text-white bg-[#131722]/50 hover:bg-[#2a2e39] p-2.5 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart items list */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-[#2a2e39]/30 border border-[#2a2e39] text-gray-500 rounded-3xl flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-gray-300">سلة المشتريات فارغة</h4>
                  <p className="text-xs text-[#787b86] max-w-xs leading-relaxed">
                    تصفح معارض المنتجات المميزة اليوم، وأضف ما ينقصك لتبدأ رحلة السعادة معنا!
                  </p>
                </div>
                <button
                  id="start-shopping-btn"
                  onClick={onClose}
                  className="bg-[#ff9800]/10 border border-[#ff9800]/30 hover:bg-[#ff9800]/20 text-[#ff9800] px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  <span>ابدأ التسوق الآن</span>
                </button>
              </div>
            ) : (
              cartItems.map((item, idx) => (
                <div 
                  key={idx} 
                  className="bg-[#171b26] border border-[#2a2e39] rounded-2xl p-4 flex items-center gap-4 hover:border-[#ff9800]/20 transition-all group"
                >
                  {/* Product Image */}
                  <div className="relative group/cartImg">
                    <img 
                      src={item.product.image} 
                      alt={item.product.title} 
                      className="w-16 h-16 object-contain p-1.5 bg-white rounded-xl border border-[#2a2e39]"
                    />
                    {onZoomImage && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onZoomImage(item.product.image); }}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover/cartImg:opacity-100 transition-opacity rounded-xl cursor-pointer"
                        title="تكبير الصورة"
                      >
                        <ZoomIn className="w-4 h-4 text-white" />
                      </button>
                    )}
                  </div>

                  {/* Info details */}
                  <div className="flex-1 min-w-0 text-right">
                    <h4 className="text-xs sm:text-sm font-bold text-gray-100 group-hover:text-[#ff9800] transition-colors truncate">
                      <bdi>{item.product.title}</bdi>
                    </h4>
                    
                    <div className="text-xs font-black text-[#ff9800] mt-1.5">
                      <bdi>{(item.product.price * item.count).toLocaleString("ar-IQ")} د.ع</bdi>
                    </div>

                    {/* Quantity adjuster & Remove Button */}
                    <div className="flex items-center justify-between mt-3 flex-row-reverse">
                      {/* Counter */}
                      <div className="flex items-center bg-[#2a2e39] rounded-lg p-1 gap-1 flex-row-reverse">
                        <button
                          onClick={() => onUpdateCount(item.product.id, item.count + 1)}
                          className="w-6 h-6 rounded-md hover:bg-[#ff9800]/10 hover:text-[#ff9800] flex items-center justify-center text-xs font-black transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold w-5 text-center text-gray-200">
                          {item.count}
                        </span>
                        <button
                          onClick={() => onUpdateCount(item.product.id, Math.max(1, item.count - 1))}
                          className="w-6 h-6 rounded-md hover:bg-[#ff9800]/10 hover:text-[#ff9800] flex items-center justify-center text-xs font-black transition"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => onRemoveItem(item.product.id)}
                        className="text-gray-500 hover:text-rose-400 p-1.5 hover:bg-rose-500/10 rounded-lg transition-all"
                        title="حذف من السلة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer controls */}
          {cartItems.length > 0 && (
            <div className="p-6 border-t border-[#2a2e39] bg-[#171b26] space-y-4">
              {/* Summary prices */}
              <div className="space-y-2.5 text-xs text-[#787b86]">
                <div className="flex justify-between items-center flex-row-reverse">
                  <span>سعر المنتجات:</span>
                  <span className="text-white font-bold">
                    <bdi>{subtotal.toLocaleString("ar-IQ")} د.ع</bdi>
                  </span>
                </div>
                <div className="flex justify-between items-center flex-row-reverse">
                  <span>خدمة التوصيل:</span>
                  <span className="text-emerald-400 font-bold">
                    <bdi>5,000 د.ع</bdi>
                  </span>
                </div>
                <div className="border-t border-[#2a2e39] pt-3.5 flex justify-between items-center flex-row-reverse">
                  <span className="text-sm font-black text-white">المجموع الإجمالي:</span>
                  <span className="text-[#ff9800] text-base font-black">
                    <bdi>{(subtotal + 5000).toLocaleString("ar-IQ")} د.ع</bdi>
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 space-y-2.5">
                <button
                  id="checkout-cart-btn"
                  onClick={onCheckout}
                  className="w-full bg-[#ff9800] text-[#131722] hover:bg-[#ffa726] py-3 rounded-xl text-xs sm:text-sm font-black transition-all shadow-[0_4px_15px_rgba(255,152,0,0.3)] hover:shadow-[0_4px_20px_rgba(255,152,0,0.45)] cursor-pointer flex items-center justify-center gap-2 hover:scale-102 active:scale-98 transform"
                >
                  <Truck className="w-4 h-4 animate-pulse" />
                  <span>تأكيد وإكمال الطلب الآن</span>
                </button>

                <button
                  id="clear-cart-btn"
                  onClick={onClearCart}
                  className="w-full hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 py-2.5 rounded-xl text-xs font-bold transition-all border border-transparent hover:border-rose-500/20 cursor-pointer text-center"
                >
                  تفريغ السلة بالكامل
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
