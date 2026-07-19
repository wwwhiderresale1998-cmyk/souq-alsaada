import React from "react";
import { X, Heart, ShoppingBag, ZoomIn, ArrowRight } from "lucide-react";
import { Product } from "../types";
import ProductCard from "./ProductCard";

interface FavoritesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: Product[];
  onSelectProduct: (product: Product) => void;
  onOrderProduct: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  onZoomImage?: (imageUrl: string) => void;
  onToggleFavorite: (product: Product) => void;
  favoriteIds: number[];
}

export default function FavoritesDrawer({
  isOpen,
  onClose,
  favorites,
  onSelectProduct,
  onOrderProduct,
  onAddToCart,
  onZoomImage,
  onToggleFavorite,
  favoriteIds
}: FavoritesDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans [direction:rtl]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300" 
        onClick={onClose}
      />

      {/* Panel Wrapper */}
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        {/* Sliding Panel */}
        <div className="w-screen max-w-md bg-[#1e222d] border-l border-[#2a2e39] text-white flex flex-col shadow-[-25px_0_60px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="p-6 border-b border-[#2a2e39] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-center text-rose-500">
                <Heart className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h3 className="font-black text-base text-white">المنتجات المفضلة</h3>
                <p className="text-[10px] text-[#787b86] font-bold">لديك {favorites.length} منتج مفضل</p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white bg-[#131722]/50 hover:bg-[#2a2e39] p-2.5 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Favorites List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {favorites.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                <div className="w-16 h-16 bg-[#2a2e39]/30 border border-[#2a2e39] text-gray-500 rounded-3xl flex items-center justify-center">
                  <Heart className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-gray-300">قائمة المفضلة فارغة</h4>
                  <p className="text-xs text-[#787b86] max-w-xs leading-relaxed">
                    لم تقم بإضافة أي منتج للمفضلة بعد. تصفح المنتجات واضغط على القلب لإضافتها هنا!
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer mt-4"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  <span>تصفح المنتجات الآن</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {favorites.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={(p) => {
                      onSelectProduct(p);
                      onClose(); // Optional: close drawer when opening product details
                    }}
                    onOrder={(p) => {
                      onOrderProduct(p);
                      onClose(); // Close drawer when opening checkout
                    }}
                    onAddToCart={onAddToCart}
                    onZoomImage={onZoomImage}
                    isAdminAuthenticated={false}
                    isFavorite={favoriteIds.includes(product.id)}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
