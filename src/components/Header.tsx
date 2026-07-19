import React, { useState, useEffect, useRef } from "react";
import { Search, LayoutDashboard, Sparkles, LogOut, CheckCircle2, ArrowLeft, Star, ShoppingBag, Smartphone, Home, Watch, Grid, ShoppingCart, LogIn, User as UserIcon, Heart, Clock, MessageCircle, ChevronDown, AlertCircle, Menu, X } from "lucide-react";
import { Category, Product } from "../types";
import { User as FirebaseUser } from "firebase/auth";
import { optimizeImageUrl } from "../lib/imageOptimizer";
// @ts-ignore
import appLogo from "../assets/images/happiness_market_logo_1784306993608.jpg";

// @ts-ignore
import catAll from "../assets/images/cat_all_1784284023379.jpg";
// @ts-ignore
import catElectronics from "../assets/images/cat_electronics_1784284036580.jpg";
// @ts-ignore
import catHome from "../assets/images/cat_home_1784284049425.jpg";
// @ts-ignore
import catBeauty from "../assets/images/cat_beauty_1784284065096.jpg";
// @ts-ignore
import catAccessories from "../assets/images/cat_accessories_1784284080232.jpg";
// @ts-ignore
import catGames from "../assets/images/cat_games_1784290000001_1784284348172.jpg";
// @ts-ignore
import catCars from "../assets/images/cat_cars_1784290000002_1784284363195.jpg";
// @ts-ignore
import catTools from "../assets/images/cat_tools_1784290000003_1784284374522.jpg";
// @ts-ignore
import catKitchen from "../assets/images/cat_kitchen_1784290000004_1784284385763.jpg";
// @ts-ignore
import catLighting from "../assets/images/cat_lighting_1784290000005_1784284398695.jpg";
// @ts-ignore
import catSports from "../assets/images/cat_sports_1784284743674.jpg";
// @ts-ignore
import catFurniture from "../assets/images/cat_furniture_1784284756246.jpg";

interface HeaderProps {
  categories: Category[];
  activeCategory: number | null;
  setActiveCategory: (id: number | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isAdminMode: boolean;
  onToggleAdmin: (admin: boolean) => void;
  showAdminButton: boolean;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  cartCount?: number;
  onOpenCart?: () => void;
  currentUser: FirebaseUser | null;
  onLogin: () => void;
  isLoggingIn?: boolean;
  onLogout: () => void;
  onToggleFavorites: () => void;
  showFavoritesOnly: boolean;
  onToggleOrders: () => void;
  showUserOrders: boolean;
}

function getCategoryImage(cat: Category | null): string {
  if (!cat) return catAll;
  const name = cat.name.toLowerCase();
  
  // 1. Check highly specific terms first to prevent overlaps with "ادوات"
  if (name.includes("سيار") || name.includes("موتور") || name.includes("دراج") || name.includes("مركب") || cat.icon === "Car") {
    return catCars;
  }
  if (name.includes("رياض") || name.includes("سبورت") || name.includes("جيم") || cat.icon === "Activity") {
    return catSports;
  }
  if (name.includes("مطبخ") || name.includes("طبخ") || name.includes("طعام") || cat.icon === "UtensilsCrossed") {
    return catKitchen;
  }
  if (name.includes("منزل") || name.includes("بيت") || cat.icon === "Home") {
    return catHome;
  }
  if (name.includes("اثاث") || name.includes("كنب") || name.includes("غرفة") || cat.icon === "Sofa") {
    return catFurniture;
  }
  if (name.includes("العاب") || name.includes("لعب") || name.includes("طفل") || name.includes("اطفال") || cat.icon === "Gamepad2") {
    return catGames;
  }
  if (name.includes("انار") || name.includes("اضاء") || name.includes("كهربا") || cat.icon === "Lightbulb") {
    return catLighting;
  }
  if (name.includes("عدد") || name.includes("صيانة") || cat.icon === "Wrench") {
    return catTools;
  }
  if (name.includes("إلكترونيات") || name.includes("الكترونيات") || name.includes("جوال") || name.includes("هاتف") || cat.icon === "Smartphone") {
    return catElectronics;
  }
  if (name.includes("العناية") || name.includes("جمال") || name.includes("تجميل") || name.includes("عطر") || name.includes("مكياج") || cat.icon === "Sparkles") {
    return catBeauty;
  }
  if (name.includes("إكسسوارات") || name.includes("اكسسوارات") || name.includes("ساعات") || name.includes("ساعة") || name.includes("حقيب") || name.includes("حقائب") || cat.icon === "Watch") {
    return catAccessories;
  }
  
  // 2. Generic fallback for "ادوات"
  if (name.includes("ادوات") || name.includes("أدوات")) {
    return catTools;
  }
  
  return catAll; // fallback
}

export default function Header({
  categories,
  activeCategory,
  setActiveCategory,
  searchQuery,
  setSearchQuery,
  isAdminMode,
  onToggleAdmin,
  showAdminButton,
  products,
  onSelectProduct,
  cartCount = 0,
  onOpenCart,
  currentUser,
  onLogin,
  isLoggingIn = false,
  onLogout,
  onToggleFavorites,
  showFavoritesOnly,
  onToggleOrders,
  showUserOrders
}: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Filter products for the live dropdown
  const matchedProducts = searchQuery.trim()
    ? products.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.raw_description && p.raw_description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  // Click outside to close search dropdowns and profile menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) &&
        (mobileSearchContainerRef.current && !mobileSearchContainerRef.current.contains(event.target as Node))
      ) {
        setIsDropdownOpen(false);
      }
      
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
        setShowLogoutConfirm(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogoClick = () => {
    setActiveCategory(null);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#171b26] border-b border-[#2a2e39] text-white backdrop-blur-md bg-opacity-90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Slogan */}
          <div className="flex items-center gap-4 cursor-pointer group" onClick={handleLogoClick}>
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-[#ff9800]/30 shadow-[0_0_20px_rgba(255,152,0,0.15)] flex items-center justify-center bg-[#131722] p-1 shrink-0 transition-all duration-300 group-hover:border-[#ff9800]/50 group-hover:shadow-[0_0_25px_rgba(255,152,0,0.3)]">
              <img 
                src={appLogo} 
                alt="شعار سوق السعادة" 
                className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col justify-center">
              <span className="block text-xl sm:text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#ff9800] to-[#ffa726] leading-none mb-1">
                سوق السعادة
              </span>
              <p className="text-[10px] sm:text-xs text-[#787b86] font-bold leading-none tracking-wide">
                تسوق بسعادة • شحن فوري خلال 24 ساعة
              </p>
            </div>
          </div>

          {/* Search bar - hidden in admin mode */}
          {!isAdminMode && (
            <div ref={searchContainerRef} className="hidden md:flex flex-1 max-w-md mx-8 relative z-50">
              <input
                type="text"
                placeholder="ابحث عن منتجك السعيد اليوم..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full bg-[#2a2e39] text-white border border-[#2a2e39] focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2.5 px-11 text-right text-sm placeholder-[#787b86] transition-all outline-none"
              />
              <Search className="w-5 h-5 text-[#787b86] absolute left-3.5 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-black"
                >
                  ✕
                </button>
              )}

              {/* Advanced Search Live Dropdown Menu */}
              {isDropdownOpen && searchQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1e222d] border border-[#2a2e39] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden text-right [direction:rtl]">
                  <div className="px-4 py-2.5 bg-[#171b26] border-b border-[#2a2e39] text-xs text-[#787b86] font-bold flex justify-between items-center flex-row-reverse">
                    <span>المنتجات المقترحة ({matchedProducts.length})</span>
                    <span className="text-[10px] text-[#ff9800]">بحث فوري فائق السرعة</span>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#2a2e39]/40">
                    {matchedProducts.length > 0 ? (
                      matchedProducts.map((prod) => {
                        const discPercent = prod.discount || 30;
                        const originalPrice = Math.round(prod.price / (1 - discPercent / 100));
                        return (
                          <div
                            key={prod.id}
                            onClick={() => {
                              onSelectProduct(prod);
                              setIsDropdownOpen(false);
                            }}
                            className="flex items-center gap-3 p-3 hover:bg-[#2a2e39]/70 transition-colors cursor-pointer group flex-row-reverse"
                          >
                            {/* Product Thumbnail */}
                            <div className="w-10 h-10 rounded-lg bg-white overflow-hidden p-1 shrink-0 flex items-center justify-center border border-[#2a2e39]">
                              <img
                                src={optimizeImageUrl(prod.image, 80)}
                                alt={prod.title}
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            
                            {/* Product Info */}
                            <div className="flex-1 min-w-0 text-right [direction:rtl]">
                              <h5 className="text-xs sm:text-sm font-black text-white group-hover:text-[#ff9800] transition-colors truncate">
                                <bdi>{prod.title}</bdi>
                              </h5>
                              <span className="text-[10px] text-[#787b86]">
                                <bdi>{categories.find((c) => c.id === prod.category_id)?.name || "عام"}</bdi>
                              </span>
                            </div>

                            {/* Price details */}
                            <div className="text-left shrink-0">
                              <div className="text-xs sm:text-sm font-black text-[#ff9800]">
                                <bdi>{prod.price.toLocaleString("ar-IQ")} د.ع</bdi>
                              </div>
                              {prod.discount && (
                                <div className="text-[9px] text-gray-500 line-through">
                                  <bdi>{originalPrice.toLocaleString("ar-IQ")} د.ع</bdi>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-xs text-[#787b86]">
                        لا توجد نتائج مطابقة لبحثك عن "{searchQuery}". جرب كلمة أخرى!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

            {/* Controls Container */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile Hamburger Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex md:hidden items-center justify-center p-2 rounded-xl bg-[#2a2e39] text-white hover:bg-[#ff9800] transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* User Profile & Account Controls */}
              {currentUser ? (
                <div className="relative" ref={profileMenuRef}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsProfileMenuOpen(!isProfileMenuOpen);
                    }}
                    className={`flex items-center gap-3 bg-[#2a2e39]/50 border px-2 py-1.5 rounded-2xl transition-all cursor-pointer group ${
                      isProfileMenuOpen ? "border-[#ff9800] bg-[#2a2e39]" : "border-[#2a2e39] hover:border-[#ff9800]/50"
                    }`}
                  >
                    <ChevronDown className={`w-3.5 h-3.5 text-[#787b86] transition-transform duration-300 ${isProfileMenuOpen ? "rotate-180" : ""}`} />
                    <div className="hidden sm:flex flex-col items-end text-right">
                      <span className="text-[10px] font-bold text-[#ff9800]">حسابي</span>
                      <span className="text-xs font-black text-white truncate max-w-[100px]">
                        {currentUser.displayName?.split(' ')[0] || "المستخدم"}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#2a2e39] group-hover:border-[#ff9800]/30 transition-all">
                      {currentUser.photoURL ? (
                        <img src={currentUser.photoURL} alt={currentUser.displayName || ""} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2a2e39] to-[#1e222d]">
                          <UserIcon className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {isProfileMenuOpen && (
                    <div className="absolute top-full left-0 mt-3 w-64 bg-[#1e222d] border border-[#2a2e39] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-4 bg-[#171b26] border-b border-[#2a2e39] text-right">
                        <p className="text-xs font-black text-white">{currentUser.displayName || "مستخدم السعادة"}</p>
                        <p className="text-[10px] text-[#787b86] mt-0.5 truncate">{currentUser.email}</p>
                      </div>

                      <div className="p-2 space-y-1">
                        {/* Favorites */}
                        <button
                          onClick={() => {
                            onToggleFavorites();
                            setIsProfileMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                            showFavoritesOnly 
                              ? "bg-rose-500/10 text-rose-400" 
                              : "text-gray-300 hover:bg-[#2a2e39] hover:text-white"
                          }`}
                        >
                          <Heart className={`w-4.5 h-4.5 ${showFavoritesOnly ? "fill-current" : ""}`} />
                          <span className="text-xs font-bold">منتجاتي المفضلة</span>
                        </button>

                        {/* Order History */}
                        <button
                          onClick={() => {
                            onToggleOrders();
                            setIsProfileMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                            showUserOrders 
                              ? "bg-[#ff9800]/10 text-[#ff9800]" 
                              : "text-gray-300 hover:bg-[#2a2e39] hover:text-white"
                          }`}
                        >
                          <Clock className="w-4.5 h-4.5" />
                          <span className="text-xs font-bold">سجل الطلبات</span>
                        </button>

                        {/* WhatsApp Support */}
                        <a
                          href="https://wa.me/9647866400289"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-between p-3 rounded-xl text-gray-300 hover:bg-[#2a2e39] hover:text-emerald-400 transition-all"
                        >
                          <MessageCircle className="w-4.5 h-4.5" />
                          <span className="text-xs font-bold">تواصل مع الدعم</span>
                        </a>

                        <div className="h-px bg-[#2a2e39] my-2 mx-2" />

                        {/* Logout Section */}
                        {showLogoutConfirm ? (
                          <div className="m-1 p-3 bg-rose-500/5 rounded-xl border border-rose-500/20 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-center gap-2 text-rose-400 mb-3">
                              <AlertCircle className="w-4 h-4" />
                              <p className="text-[10px] font-black">هل تريد الخروج؟</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLogout();
                                }}
                                className="flex-1 bg-rose-500 text-white text-[10px] font-black py-2 rounded-lg hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
                              >
                                نعم، خروج
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowLogoutConfirm(false);
                                }}
                                className="flex-1 bg-[#2a2e39] text-gray-300 text-[10px] font-black py-2 rounded-lg hover:text-white transition-colors"
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowLogoutConfirm(true);
                            }}
                            className="w-full flex items-center justify-between p-3 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all group"
                          >
                            <LogOut className="w-4.5 h-4.5 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-xs font-bold">تسجيل الخروج</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={onLogin}
                  disabled={isLoggingIn}
                  className={`hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 border bg-gradient-to-r from-[#ff9800] to-[#ffa726] text-[#131722] border-transparent hover:shadow-[0_0_20px_rgba(255,152,0,0.4)] hover:scale-105 active:scale-95 ${isLoggingIn ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {isLoggingIn ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : (
                    <LogIn className="w-4 h-4 shrink-0" />
                  )}
                  <span className="hidden sm:inline">{isLoggingIn ? 'جاري...' : 'دخول / تسجيل'}</span>
                </button>
              )}
            </div>

            {!isAdminMode && onOpenCart && (
              <button
                id="cart-toggle-btn"
                onClick={onOpenCart}
                className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 border bg-[#2a2e39] text-gray-300 border-transparent hover:border-[#ff9800]/50 hover:text-white hover:scale-105 active:scale-95 cursor-pointer"
              >
                <div className="relative">
                  <ShoppingCart className="w-4 h-4 text-current" />
                  {cartCount > 0 && (
                    <span className="absolute -top-2.5 -right-2.5 bg-rose-500 text-white font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#171b26] animate-pulse">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline">سلة المشتريات</span>
              </button>
            )}

            {(showAdminButton || isAdminMode) && (
              <button
                id="admin-toggle-btn"
                onClick={() => onToggleAdmin(!isAdminMode)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 border ${
                  isAdminMode
                    ? "bg-[#ff9800] text-[#131722] border-[#ff9800] shadow-[0_0_15px_rgba(255,152,0,0.3)] hover:bg-[#ffa726]"
                    : "bg-[#2a2e39] text-gray-300 border-transparent hover:border-[#ff9800]/50 hover:text-white"
                }`}
              >
                {isAdminMode ? (
                  <>
                    <span>الخروج من لوحة التحكم</span>
                    <LogOut className="w-4 h-4 shrink-0 text-current" />
                  </>
                ) : (
                  <>
                    <span>لوحة التحكم (التاجر)</span>
                    <LayoutDashboard className="w-4 h-4 shrink-0 text-current" />
                  </>
                )}
              </button>
            )}
          </div>

        {/* Categories Bar & Mobile Search - hidden in admin mode */}
        {!isAdminMode && (
          <div className="border-t border-[#2a2e39] py-4.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Horizontal Categories with styled 3D Icons */}
            <div className="flex-1 overflow-hidden relative py-1">
              {/* Fade masks for indicating horizontal scroll in RTL */}
              <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#131722] to-transparent pointer-events-none z-10" />
              <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#131722] to-transparent pointer-events-none z-10" />
              
              <div className="flex items-center justify-start md:justify-center gap-4 sm:gap-6 overflow-x-auto pb-3 pt-1 px-4 scrollbar-thin scrollbar-thumb-[#ff9800]/20 scrollbar-track-transparent [direction:rtl] -mx-3 w-full">
                {/* ALL CATEGORIES */}
                <button
                  id="cat-all"
                  onClick={() => setActiveCategory(null)}
                  className="flex flex-col items-center justify-center gap-2 shrink-0 group select-none cursor-pointer outline-none w-20 sm:w-24 text-center"
                >
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 p-0.5 relative overflow-hidden ${
                    activeCategory === null
                      ? "border-[#ff9800] bg-gradient-to-br from-[#ff9800]/10 to-[#ff9800]/25 shadow-[0_8px_20px_rgba(255,152,0,0.25)] scale-105"
                      : "border-[#2a2e39] bg-[#1e222d] hover:border-[#ff9800]/50 hover:bg-[#2a2e39]/60"
                  }`}>
                    <img 
                      src={catAll} 
                      alt="كل المعروضات" 
                      className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-115"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0e1118]/80 via-transparent to-transparent opacity-40" />
                  </div>
                  <span className={`text-[11px] sm:text-xs font-black transition-colors duration-200 text-center truncate w-full ${
                    activeCategory === null ? "text-[#ff9800]" : "text-gray-400 group-hover:text-white"
                  }`}>
                    كل المعروضات
                  </span>
                </button>

                {/* EACH CATEGORY */}
                {categories.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  const catImg = getCategoryImage(cat);
                  return (
                    <button
                      id={`cat-${cat.id}`}
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className="flex flex-col items-center justify-center gap-2 shrink-0 group select-none cursor-pointer outline-none w-20 sm:w-24 text-center"
                    >
                      <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 p-0.5 relative overflow-hidden ${
                        isActive
                          ? "border-[#ff9800] bg-gradient-to-br from-[#ff9800]/10 to-[#ff9800]/25 shadow-[0_8px_20px_rgba(255,152,0,0.25)] scale-105"
                          : "border-[#2a2e39] bg-[#1e222d] hover:border-[#ff9800]/50 hover:bg-[#2a2e39]/60"
                      }`}>
                        <img 
                          src={catImg} 
                          alt={cat.name} 
                          className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-115"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1118]/80 via-transparent to-transparent opacity-40" />
                      </div>
                      <span className={`text-[11px] sm:text-xs font-black transition-colors duration-200 text-center truncate w-full ${
                        isActive ? "text-[#ff9800]" : "text-gray-400 group-hover:text-white"
                      }`}>
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile Search Input */}
            <div ref={mobileSearchContainerRef} className="flex md:hidden relative w-full z-50">
              <input
                type="text"
                placeholder="ابحث عن منتجك السعيد اليوم..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full bg-[#2a2e39] text-white border border-[#2a2e39] focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2 px-10 text-right text-xs placeholder-[#787b86] transition-all outline-none"
              />
              <Search className="w-4 h-4 text-[#787b86] absolute left-3 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-black px-1"
                >
                  ✕
                </button>
              )}

              {/* Advanced Mobile Search Live Dropdown Menu */}
              {isDropdownOpen && searchQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-[0_15px_35px_rgba(0,0,0,0.5)] z-50 overflow-hidden text-right [direction:rtl]">
                  <div className="px-3 py-2 bg-[#171b26] border-b border-[#2a2e39] text-[10px] text-[#787b86] font-bold flex justify-between items-center flex-row-reverse">
                    <span>نتائج مقترحة ({matchedProducts.length})</span>
                    <span className="text-[9px] text-[#ff9800]">بحث فوري</span>
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto divide-y divide-[#2a2e39]/30">
                    {matchedProducts.length > 0 ? (
                      matchedProducts.map((prod) => {
                        const discPercent = prod.discount || 30;
                        const originalPrice = Math.round(prod.price / (1 - discPercent / 100));
                        return (
                          <div
                            key={prod.id}
                            onClick={() => {
                              onSelectProduct(prod);
                              setIsDropdownOpen(false);
                            }}
                            className="flex items-center gap-2 p-2.5 hover:bg-[#2a2e39]/70 transition-colors cursor-pointer group flex-row-reverse"
                          >
                            {/* Product Thumbnail */}
                            <div className="w-9 h-9 rounded-lg bg-white overflow-hidden p-1 shrink-0 flex items-center justify-center border border-[#2a2e39]">
                              <img
                                src={optimizeImageUrl(prod.image, 60)}
                                alt={prod.title}
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            
                            {/* Product Info */}
                            <div className="flex-1 min-w-0 text-right [direction:rtl]">
                              <h5 className="text-[11px] font-black text-white group-hover:text-[#ff9800] transition-colors truncate">
                                {prod.title}
                              </h5>
                              <span className="text-[9px] text-[#787b86]">
                                {categories.find((c) => c.id === prod.category_id)?.name || "عام"}
                              </span>
                            </div>

                            {/* Price details */}
                            <div className="text-left shrink-0">
                              <div className="text-[11px] font-black text-[#ff9800]">
                                {prod.price.toLocaleString("ar-IQ")} د.ع
                              </div>
                              {prod.discount && (
                                <div className="text-[9px] text-gray-500 line-through">
                                  {originalPrice.toLocaleString("ar-IQ")} د.ع
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-[10px] text-[#787b86]">
                        لا توجد نتائج مطابقة لبحثك.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Sidebar Menu (Drawer) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Drawer */}
          <div className="absolute top-0 right-0 bottom-0 w-[80%] max-w-sm bg-[#1e222d] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-[#2a2e39] flex items-center justify-between">
              <span className="font-black text-[#ff9800] text-lg">سوق السعادة</span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 bg-[#2a2e39] text-gray-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!currentUser && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onLogin();
                  }}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#ff9800] to-[#ffa726] text-[#131722] py-3.5 rounded-xl font-black text-sm"
                >
                  <LogIn className="w-5 h-5" />
                  <span>{isLoggingIn ? "جاري تسجيل الدخول..." : "تسجيل الدخول / إنشاء حساب"}</span>
                </button>
              )}

              {/* Menu Links */}
              <div className="space-y-2 mt-4">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onToggleFavorites();
                  }}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-bold text-sm transition-all ${
                    showFavoritesOnly 
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                      : "bg-[#2a2e39]/50 text-gray-300 border border-transparent hover:border-[#ff9800]/50 hover:text-white"
                  }`}
                >
                  <Heart className={`w-5 h-5 ${showFavoritesOnly ? "fill-current" : ""}`} />
                  <span>المفضلات</span>
                </button>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onToggleOrders();
                  }}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-bold text-sm transition-all ${
                    showUserOrders 
                      ? "bg-[#ff9800]/10 text-[#ff9800] border border-[#ff9800]/20" 
                      : "bg-[#2a2e39]/50 text-gray-300 border border-transparent hover:border-[#ff9800]/50 hover:text-white"
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  <span>سجل الطلبات السابقة</span>
                </button>

                <a
                  href="https://wa.me/9647866400289"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl font-bold text-sm bg-[#2a2e39]/50 text-emerald-400 border border-emerald-500/20"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>تواصل مع الدعم الفني</span>
                </a>
              </div>
            </div>
            
            {/* Logout at bottom if logged in */}
            {currentUser && (
              <div className="p-4 border-t border-[#2a2e39]">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm bg-rose-500/10 text-rose-400 border border-rose-500/20"
                >
                  <LogOut className="w-5 h-5" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
