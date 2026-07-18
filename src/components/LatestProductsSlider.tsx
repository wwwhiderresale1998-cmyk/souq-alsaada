import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, ShoppingBag, ChevronRight, ChevronLeft, Star } from "lucide-react";
import { Product } from "../types";
import { optimizeImageUrl, getLqipImageUrl } from "../lib/imageOptimizer";

interface LatestProductsSliderProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onOrderProduct: (product: Product) => void;
}

export default function LatestProductsSlider({
  products,
  onSelectProduct,
  onOrderProduct
}: LatestProductsSliderProps) {
  // Take the latest 6 products (newest first from the API list)
  const latestProducts = products.slice(0, 6);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (latestProducts.length <= 1) return;

    if (!isHovered) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % latestProducts.length);
      }, 4000); // Auto scroll every 4 seconds
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isHovered, latestProducts.length]);

  if (latestProducts.length === 0) return null;

  const activeProduct = latestProducts[currentIndex];
  const isImgLoaded = loadedImages[activeProduct.id] || false;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + latestProducts.length) % latestProducts.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % latestProducts.length);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 mb-8">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-[#2a2e39] pb-4 mb-6">
        <div className="flex items-center gap-2 flex-row-reverse text-right w-full justify-between">
          <div className="text-right">
            <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 justify-end">
              <span>أحدث المنتجات المضافة حديثاً</span>
              <span className="bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                جديد
              </span>
            </h3>
            <p className="text-xs text-[#787b86] mt-1">تصفح التشكيلة الجديدة الحصرية التي وصلت للتو إلى مستودعاتنا</p>
          </div>
          <Sparkles className="w-5 h-5 text-[#ff9800] animate-spin-slow shrink-0 hidden sm:block" />
        </div>
      </div>

      {/* Main Slider Display Card */}
      <div 
        id="latest-products-carousel"
        className="relative overflow-hidden bg-gradient-to-br from-[#1e222d] to-[#171b26] border border-[#2a2e39] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row-reverse gap-8 items-center cursor-pointer min-h-[340px] shadow-2xl transition-all duration-300 hover:border-[#ff9800]/30"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onSelectProduct(activeProduct)}
      >
        {/* Navigation Arrows */}
        {latestProducts.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#131722]/80 hover:bg-[#ff9800] text-gray-300 hover:text-[#131722] border border-[#2a2e39] flex items-center justify-center transition-all z-20 cursor-pointer shadow-lg hover:scale-105 active:scale-95"
              aria-label="المنتج السابق"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#131722]/80 hover:bg-[#ff9800] text-gray-300 hover:text-[#131722] border border-[#2a2e39] flex items-center justify-center transition-all z-20 cursor-pointer shadow-lg hover:scale-105 active:scale-95"
              aria-label="المنتج التالي"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Product Image Side with pure white background as requested */}
        <div className="w-full md:w-2/5 aspect-square max-w-[280px] sm:max-w-[320px] bg-white rounded-2xl overflow-hidden border border-[#2a2e39] p-4 flex items-center justify-center shrink-0 relative shadow-inner group">
          
          {/* Low Quality Image Placeholder (LQIP) */}
          <AnimatePresence mode="wait">
            {!isImgLoaded && (
              <motion.img
                key={`lqip-${activeProduct.id}`}
                src={getLqipImageUrl(activeProduct.image)}
                alt=""
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 w-full h-full object-contain p-4 blur-md scale-105 transition-opacity"
              />
            )}
          </AnimatePresence>

          {/* Loading Spinner */}
          {!isImgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-transparent">
              <div className="w-5 h-5 border-2 border-[#ff9800] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Optimized high-quality slider image */}
          <AnimatePresence mode="wait">
            <motion.img
              key={`high-res-${activeProduct.id}`}
              src={optimizeImageUrl(activeProduct.image, 600)}
              alt={activeProduct.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={() => setLoadedImages(prev => ({ ...prev, [activeProduct.id]: true }))}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: isImgLoaded ? 1 : 0, scale: isImgLoaded ? 1 : 0.95 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full object-contain transition-all duration-500 group-hover:scale-105"
            />
          </AnimatePresence>
          
          {/* Quick Rating badge */}
          {activeProduct.rating && (
            <div className="absolute top-3 right-3 bg-[#131722]/90 border border-amber-500/35 text-amber-400 text-[10px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-md">
              <Star className="w-3 h-3 fill-amber-400" />
              <span>{activeProduct.rating} / 5</span>
            </div>
          )}
        </div>

        {/* Product Details Side */}
        <div className="flex-1 text-right flex flex-col justify-between h-full w-full [direction:rtl]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeProduct.id}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <span className="text-[10px] bg-[#ff9800]/10 text-[#ff9800] border border-[#ff9800]/25 px-2.5 py-1 rounded-full font-black">
                  منتج أصلي 100%
                </span>
                <h4 className="text-xl sm:text-2xl font-black text-white hover:text-[#ff9800] transition-colors leading-snug">
                  {activeProduct.title}
                </h4>
              </div>

              <p className="text-[#787b86] text-xs sm:text-sm leading-relaxed line-clamp-3">
                {activeProduct.description || "لا يوجد وصف متوفر لهذا المنتج المثير للاهتمام حالياً."}
              </p>

              {(() => {
                const discPercent = activeProduct.discount || 30;
                const originalPrice = Math.round(activeProduct.price / (1 - discPercent / 100));
                return (
                  <div className="pt-2 flex flex-wrap items-baseline gap-2.5">
                    <span className="text-2xl sm:text-3xl font-black text-[#ff9800]">
                      {activeProduct.price.toLocaleString("ar-IQ")} د.ع
                    </span>
                    <span className="text-xs text-gray-500 line-through font-medium">
                      {originalPrice.toLocaleString("ar-IQ")} د.ع
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 animate-pulse">
                      توفير {discPercent}%
                    </span>
                  </div>
                );
              })()}
            </motion.div>
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-6 mt-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOrderProduct(activeProduct);
              }}
              className="flex-1 min-w-[140px] bg-gradient-to-r from-[#ff9800] to-[#f57c00] hover:from-[#ffa726] hover:to-[#ff9800] text-[#131722] font-black text-xs sm:text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(255,152,0,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>اطلب الآن (الدفع عند الاستلام)</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectProduct(activeProduct);
              }}
              className="px-5 py-3.5 rounded-xl border border-[#2a2e39] bg-[#1a1c24] hover:bg-[#2a2e39] text-[#d1d4dc] text-xs font-bold hover:text-white transition-all cursor-pointer"
            >
              تفاصيل المنتج
            </button>
          </div>
        </div>
      </div>

      {/* Pagination Indicator Dots */}
      {latestProducts.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {latestProducts.map((_, index) => (
            <button
              type="button"
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                currentIndex === index ? "w-6 bg-[#ff9800]" : "w-2 bg-[#2a2e39] hover:bg-[#787b86]"
              }`}
              aria-label={`الذهاب إلى الشريحة ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
