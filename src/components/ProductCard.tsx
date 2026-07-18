import React from "react";
import { Star, Truck, Sparkles, MessageCircleCode, ShieldCheck, ShoppingCart, Heart, ZoomIn } from "lucide-react";
import { Product } from "../types";
import { optimizeImageUrl, getLqipImageUrl } from "../lib/imageOptimizer";

interface ProductCardProps {
  key?: number;
  product: Product;
  onSelect: (product: Product) => void;
  onOrder: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  onZoomImage?: (imageUrl: string) => void;
  isAdminAuthenticated?: boolean;
  onEnhanceDescription?: (productId: number) => void;
  isEnhancing?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (product: Product) => void;
}

export default function ProductCard({ 
  product, 
  onSelect, 
  onOrder,
  onAddToCart,
  onZoomImage,
  isAdminAuthenticated = false,
  onEnhanceDescription,
  isEnhancing = false,
  isFavorite = false,
  onToggleFavorite
}: ProductCardProps) {
  const [imgLoaded, setImgLoaded] = React.useState(false);

  // Check if description is AI-enhanced (contain emojis or styled layout)
  const isAiEnhanced = product.description.includes("🔥") || product.description.includes("✨") || product.description.includes("•");

  // Prefetch optimized images on mouse hover for instant load when clicked
  const handleMouseEnter = () => {
    if (product.images && product.images.length > 0) {
      product.images.forEach((src) => {
        const img = new Image();
        img.src = optimizeImageUrl(src, 600);
      });
    } else {
      const img = new Image();
      img.src = optimizeImageUrl(product.image, 600);
    }
  };

  const optimizedSrc = optimizeImageUrl(product.image, 400);
  const lqipSrc = getLqipImageUrl(product.image);

  return (
    <div 
      id={`product-card-${product.id}`}
      onMouseEnter={handleMouseEnter}
      className="group bg-[#1e222d] border border-[#2a2e39] hover:border-[#ff9800]/50 rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-[0_10px_30px_rgba(255,152,0,0.12)] hover:-translate-y-1.5"
    >
      {/* Product Image & Badges */}
      <div className="relative aspect-square overflow-hidden bg-white cursor-pointer" onClick={() => onSelect(product)}>
        {/* 1. Low Quality Image Placeholder (LQIP) as background, instantly visible */}
        <img
          src={lqipSrc}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-contain p-2.5 blur-md scale-105 transition-opacity duration-500 ${
            imgLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        />

        {/* 2. Loading Spinner Overlay */}
        {!imgLoaded && (
          <div className="absolute inset-0 bg-transparent flex items-center justify-center z-10">
            <div className="w-5 h-5 border-2 border-[#ff9800] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* 3. Main Next-Gen WebP High-Quality Image with Smart Lazy Loading */}
        <img
          src={optimizedSrc}
          alt={product.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setImgLoaded(true)}
          className={`w-full h-full object-contain p-2.5 transition-all duration-500 group-hover:scale-105 ${
            imgLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        />
        
        {/* Rapid Shipping & Refund Guarantee Badges */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-10">
          <div className="bg-gradient-to-r from-[#ff9800] to-[#ffa726] text-[#131722] text-[9px] sm:text-[10px] font-black px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg shadow-md flex items-center gap-1">
            <Truck className="w-3.5 h-3.5 animate-bounce" />
            <span>خلال 24 ساعة</span>
          </div>
          <div className="bg-[#131722]/85 border border-emerald-500/30 text-emerald-400 text-[9px] sm:text-[10px] font-black px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg shadow-md flex items-center gap-1 backdrop-blur-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>ضمان استرجاع أسبوع</span>
          </div>
        </div>

        {/* Discount Badge */}
        {product.discount && (
          <div className="absolute top-3 left-3 bg-red-500/90 border border-red-400/20 text-white text-[9px] sm:text-[10px] font-black px-2 py-1 rounded-lg shadow-md z-10 animate-pulse">
            خصم {product.discount}%
          </div>
        )}

        {/* Photo Album Badge */}
        {product.images && product.images.length > 1 && (
          <div className={`absolute ${product.discount ? "top-14" : "top-3"} left-3 bg-[#131722]/80 border border-[#2a2e39] text-[#d1d4dc] text-[9px] font-bold px-2 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1 z-10`}>
            <span className="w-1.5 h-1.5 bg-[#ff9800] rounded-full animate-pulse" />
            <span>{product.images.length} صور</span>
          </div>
        )}

        {/* Zoom Image Button */}
        {onZoomImage && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onZoomImage(optimizedSrc);
            }}
            className="absolute bottom-3 left-3 bg-[#131722]/60 hover:bg-[#ff9800] text-white hover:text-[#131722] p-2 rounded-xl backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 z-20 cursor-pointer shadow-md"
            title="تكبير الصورة"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        )}

        {/* Admin AI Enhancer Button */}
        {isAdminAuthenticated && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation(); // Avoid opening product details modal
              if (onEnhanceDescription) {
                onEnhanceDescription(product.id);
              }
            }}
            disabled={isEnhancing}
            className="absolute bottom-3 right-3 bg-[#ff9800] text-[#131722] hover:bg-[#ffa726] border border-transparent disabled:opacity-50 text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer transition-all z-20"
          >
            {isEnhancing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-[#131722] border-t-transparent rounded-full animate-spin" />
                <span>جاري التحسين...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#131722] animate-pulse" />
                <span>تحسين الوصف بالـ AI</span>
              </>
            )}
          </button>
        )}

        {/* Favorite Toggle Button */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(product);
            }}
            className={`absolute bottom-3 left-3 w-8 h-8 rounded-full flex items-center justify-center transition-all z-20 cursor-pointer border ${
              isFavorite 
                ? "bg-rose-500 border-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]" 
                : "bg-black/40 border-white/20 text-white hover:bg-rose-500/80 hover:border-rose-500"
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
          </button>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 text-right">
        {/* Rating, Sales, and Stock */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] sm:text-xs text-[#787b86] font-medium">
            <bdi>المبيعات: {product.sales_count || 12}+ قطع</bdi>
          </span>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[#787b86] font-bold"><bdi>({product.rating || 4.8})</bdi></span>
            <div className="flex text-amber-400">
              <Star className="w-3 h-3 fill-current" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h3 
          className="text-sm sm:text-base font-bold text-gray-100 hover:text-[#ff9800] cursor-pointer transition-colors duration-200 line-clamp-1 mb-2 text-right"
          onClick={() => onSelect(product)}
        >
          <bdi>{product.title}</bdi>
        </h3>

        {/* Short Description */}
        <p className="text-xs text-[#787b86] line-clamp-2 mb-4 leading-relaxed h-8 text-right">
          <bdi>{product.raw_description || product.description.replace(/🔥|✨|•|⚡/g, "").slice(0, 70) + "..."}</bdi>
        </p>

        {/* Price and Order Button */}
        <div className="mt-auto pt-3 border-t border-[#2a2e39] flex items-center justify-between gap-3">
          <div className="text-right">
            <div className="text-[10px] text-[#787b86]"><bdi>سعر البيع المعتمد</bdi></div>
            <div className="flex flex-col items-end">
              <span className="text-base sm:text-lg font-black text-[#ff9800] tracking-tight leading-tight">
                <bdi>{product.price.toLocaleString("ar-IQ")} د.ع</bdi>
              </span>
              {product.discount && (
                <span className="text-[10px] text-gray-500 line-through leading-tight">
                  <bdi>{Math.round(product.price / (1 - product.discount / 100)).toLocaleString("ar-IQ")} د.ع</bdi>
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-1.5 shrink-0">
            {onAddToCart && (
              <button
                id={`add-to-cart-btn-${product.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(product);
                }}
                className="bg-[#2a2e39] text-white hover:text-[#ff9800] hover:bg-[#ff9800]/10 border border-[#2a2e39] hover:border-[#ff9800]/40 p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95"
                title="أضف إلى السلة"
              >
                <ShoppingCart className="w-4 h-4" />
              </button>
            )}
            <button
              id={`order-btn-${product.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onOrder(product);
              }}
              className="bg-[#ff9800] text-[#131722] hover:bg-[#ffa726] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 hover:shadow-[0_0_12px_rgba(255,152,0,0.35)] cursor-pointer hover:scale-105 active:scale-95 transform"
            >
              اطلب الآن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
