import React, { useState, useEffect, useRef } from "react";
import { 
  Truck, ShieldCheck, Clock, Sparkles, Star, ShoppingBag, X, 
  ChevronLeft, Bot, HelpCircle, MessageCircle, AlertCircle, ShoppingCart,
  Lock, Key, ShieldAlert, RotateCcw, Heart, ZoomIn
} from "lucide-react";
import { Product, Category, Order, CartItem } from "./types";
import { 
  auth, signInWithGoogle, syncUserToFirestore, saveSearchQuery, db, 
  addFavorite, removeFavorite, getProductEnhancements, saveProductEnhancement 
} from "./lib/firebase";
import { onAuthStateChanged, signOut, getRedirectResult, User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";
import Header from "./components/Header";
import ProductCard from "./components/ProductCard";
import CheckoutModal from "./components/CheckoutModal";
import ChatAssistant from "./components/ChatAssistant";
import AdminDashboard from "./components/AdminDashboard";
import LatestProductsSlider from "./components/LatestProductsSlider";
import CartDrawer from "./components/CartDrawer";
import FavoritesDrawer from "./components/FavoritesDrawer";
import OrdersDrawer from "./components/OrdersDrawer";

const ADMIN_EMAIL = 'www.hiderresale1998@gmail.com';

export default function App() {
  // Products & Categories States
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Navigation & Control States
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<Product | null>(null);
  
  // Admin State & Security Gate
  const [showAdminButton, setShowAdminButton] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Status and Confirmation States
  const [isLoading, setIsLoading] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);

  // Firebase Auth State
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const savedUser = localStorage.getItem("souq_saada_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [userProfile, setUserProfile] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Favorites state
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [showFavoritesDrawer, setShowFavoritesDrawer] = useState(false);
  const [showOrdersDrawer, setShowOrdersDrawer] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setFavoriteIds([]);
      return;
    }
    
    if (db) {
      // Listen to user's favorites from Firestore
      const q = query(collection(db, "favorites"), where("userId", "==", currentUser.uid));
      const unsubscribe = onSnapshot(q, (snap) => {
        const ids = snap.docs.map(doc => doc.data().productId);
        setFavoriteIds(ids);
      }, (err) => {
        console.error("Firestore favorites error:", err);
      });
      return () => unsubscribe();
    } else {
      // Load local favorites fallback
      try {
        const savedFavs = localStorage.getItem(`souq_saada_favorites_${currentUser.uid}`);
        setFavoriteIds(savedFavs ? JSON.parse(savedFavs) : []);
      } catch (err) {
        console.error("Failed to load local favorites:", err);
      }
    }
  }, [currentUser]);

  const handleToggleFavorite = async (product: Product) => {
    if (!currentUser) {
      handleLogin();
      return;
    }
    
    const isFav = favoriteIds.includes(product.id);
    const nextFavs = isFav 
      ? favoriteIds.filter(id => id !== product.id)
      : [...favoriteIds, product.id];
    
    setFavoriteIds(nextFavs);
    
    try {
      localStorage.setItem(`souq_saada_favorites_${currentUser.uid}`, JSON.stringify(nextFavs));
      
      if (db) {
        if (isFav) {
          await removeFavorite(currentUser.uid, product.id);
        } else {
          await addFavorite(currentUser.uid, product.id);
        }
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  // Shopping Cart States
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("souq_saada_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartCheckoutOpen, setIsCartCheckoutOpen] = useState(false);
  
  // Pagination state for mobile performance
  const [visibleCount, setVisibleCount] = useState(24);

  useEffect(() => {
    setVisibleCount(24);
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.email === ADMIN_EMAIL) {
        setIsAdminAuthenticated(true);
        setShowAdminButton(true);
      } else {
        // Check roles in our Cloud SQL DB
        fetch(`/api/user-role?email=${currentUser.email}`)
          .then(res => {
            if (res.ok) return res.json();
            throw new Error();
          })
          .then(data => {
            if (data.role === 'admin' || data.role === 'moderator') {
              setIsAdminAuthenticated(true);
              setShowAdminButton(true);
            }
          })
          .catch(() => {});
      }
    } else {
      setIsAdminAuthenticated(false);
      setShowAdminButton(false);
    }
  }, [currentUser]);

  useEffect(() => {
    // Sync Google user with backend and update state
    const handleAuth = async (gUser: FirebaseUser) => {
      // Always set user from Firebase data first (instant login feel)
      const baseUser = {
        uid: gUser.uid,
        email: gUser.email,
        displayName: gUser.displayName,
        photoURL: gUser.photoURL,
      };
      setCurrentUser(baseUser);
      localStorage.setItem("souq_saada_user", JSON.stringify(baseUser));

      // Then try to sync with backend (optional - failure doesn't block login)
      try {
        const res = await fetch('/api/user/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: gUser.email,
            displayName: gUser.displayName,
            photoURL: gUser.photoURL,
            uid: gUser.uid
          })
        });
        
        if (res.ok) {
          const dbProfile = await res.json();
          const mergedUser = { ...baseUser, ...dbProfile };
          setCurrentUser(mergedUser);
          localStorage.setItem("souq_saada_user", JSON.stringify(mergedUser));
        }
      } catch (err: any) {
        // Server sync failed but user is still logged in via Firebase
        console.warn("Server sync failed (non-fatal):", err.message);
      }
    };

    // 1. Listen to persistent auth state changes (Standard Firebase approach)
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // If logged in via Firebase, sync it with our app state
        await handleAuth(user);
      } else {
        setCurrentUser(null);
        localStorage.removeItem("souq_saada_user");
      }
    });

    // 2. Also check redirect result just in case there are specific errors to handle
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          await handleAuth(result.user);
        }
      } catch (err: any) {
        console.error("Redirect login error:", err);
        setAuthError(err.message || "فشل تسجيل الدخول عبر جوجل");
      }
    };
    
    checkRedirect();

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    // Prevent opening multiple OAuth popups simultaneously
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      // cancelled-popup-request happens when user opens multiple popups - it's expected, not an error
      if (err.code === 'auth/cancelled-popup-request') {
        // Silently ignore - another popup is already handling auth
      } else if (err.code === 'auth/popup-blocked') {
        setAuthError('يرجى السماح بالنوافذ المنبثقة في متصفحك لتسجيل الدخول بجوجل');
      } else {
        console.error("Google Login failed:", err);
        setAuthError(err.message || "فشل بدء تسجيل الدخول");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
      setCurrentUser(null);
      setIsAdminAuthenticated(false);
      setIsAdminMode(false);
      localStorage.removeItem("souq_saada_user");
      localStorage.removeItem("admin_authenticated");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Debounced search query saving to Firestore
  useEffect(() => {
    if (!currentUser || !searchQuery.trim()) return;
    const timer = setTimeout(() => {
      saveSearchQuery(currentUser.uid, searchQuery);
    }, 2000); // Wait 2 seconds of inactivity before saving
    return () => clearTimeout(timer);
  }, [searchQuery, currentUser]);

  // Save cart to localStorage dynamically
  useEffect(() => {
    localStorage.setItem("souq_saada_cart", JSON.stringify(cart));
  }, [cart]);

  // ===================================================
  // Browser Back Button Handler
  // When any modal/drawer is open, push a history entry
  // so pressing Back closes the overlay instead of leaving the site
  // ===================================================
  const anyOverlayOpen =
    !!selectedProductDetails ||
    !!zoomedImage ||
    !!selectedProductForOrder ||
    isCartOpen ||
    isCartCheckoutOpen ||
    showFavoritesDrawer ||
    showOrdersDrawer ||
    isAdminMode;

  useEffect(() => {
    if (anyOverlayOpen) {
      // Push a "modal open" state into browser history
      window.history.pushState({ modal: true }, "");
    }
  }, [anyOverlayOpen]);

  useEffect(() => {
    const handlePopState = () => {
      // Close overlays in priority order (innermost first)
      if (zoomedImage) {
        setZoomedImage(null);
      } else if (isCartCheckoutOpen) {
        setIsCartCheckoutOpen(false);
      } else if (selectedProductForOrder) {
        setSelectedProductForOrder(null);
      } else if (selectedProductDetails) {
        setSelectedProductDetails(null);
      } else if (isCartOpen) {
        setIsCartOpen(false);
      } else if (showFavoritesDrawer) {
        setShowFavoritesDrawer(false);
      } else if (showOrdersDrawer) {
        setShowOrdersDrawer(false);
      } else if (isAdminMode) {
        setIsAdminMode(false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [
    zoomedImage,
    isCartCheckoutOpen,
    selectedProductForOrder,
    selectedProductDetails,
    isCartOpen,
    showFavoritesDrawer,
    showOrdersDrawer,
    isAdminMode,
  ]);

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const exists = prev.find((item) => item.product.id === product.id);
      if (exists) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, count: item.count + 1 } : item
        );
      }
      return [...prev, { product, count: 1 }];
    });
    // Open the drawer to give beautiful instant feedback
    setIsCartOpen(true);
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleUpdateCartCount = (productId: number, count: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, count: Math.max(1, count) } : item
      )
    );
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const isFirstRender = React.useRef(true);

  // Smoothly scroll down to products listing when category is selected
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const section = document.getElementById("products-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeCategory]);

  // Check URL query params for admin activation or existing session on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get("admin") === "1" || 
      params.get("manage") === "1" || 
      params.get("panel") === "1" || 
      localStorage.getItem("admin_authenticated") === "true"
    ) {
      setShowAdminButton(true);
    }
  }, []);

  const handleToggleAdmin = (nextState: boolean) => {
    setIsAdminMode(nextState);
  };

  // Image Gallery & Fast Load States
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isModalImgLoaded, setIsModalImgLoaded] = useState(false);
  const thumbnailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thumbnailsRef.current && thumbnailsRef.current.children[activeImageIndex]) {
      const selectedThumbnail = thumbnailsRef.current.children[activeImageIndex] as HTMLElement;
      selectedThumbnail.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [activeImageIndex]);

  const [enhancingProductId, setEnhancingProductId] = useState<number | null>(null);


  const handleEnhanceDescription = async (productId: number) => {
    setEnhancingProductId(productId);
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
      
      // Also update selected product details if it happens to be open
      if (selectedProductDetails && selectedProductDetails.id === productId) {
        setSelectedProductDetails(p => p ? { ...p, description: data.enhancedDescription } : null);
      }
    } catch (err: any) {
      console.error("AI enhancement failed:", err);
    } finally {
      setEnhancingProductId(null);
    }
  };

  const handleSelectProduct = async (product: Product) => {
    // 1. Immediately open with current cached info so user gets zero lag
    setSelectedProductDetails(product);
    
    // 2. Fetch full specifications, long description (post_body) and extra images from API
    try {
      const res = await fetch(`/api/product-details?product_id=${product.id}`);
      if (res.ok) {
        const fullProduct = await res.json();
        
        // Update product cache in state
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? fullProduct : p))
        );

        // Update selected product details state if modal is still open for this product
        setSelectedProductDetails((cur) => {
          if (cur && cur.id === product.id) {
            return fullProduct;
          }
          return cur;
        });
      }
    } catch (err) {
      console.error("Failed to fetch full product details from API:", err);
    }
  };

  // Fetch initial products and categories from our Full-Stack Server
  const fetchProductsAndCategories = async () => {
    setIsLoading(true);
    try {
      // Categories
      const catRes = await fetch("/api/categories");
      const catData = await catRes.json();
      if (catRes.ok) setCategories(catData);

      // Products (we fetch all products initially and filter on the client, or fetch dynamically)
      const prodRes = await fetch("/api/products");
      const prodData = await prodRes.json();
      if (prodRes.ok) setProducts(prodData.products);
    } catch (err) {
      console.error("Failed to load catalog data from fullstack server:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsAndCategories();
  }, []);

  // On initial load, merge local products with Firestore enhancements
  useEffect(() => {
    const applyEnhancements = async () => {
      const enhancements = await getProductEnhancements();
      setProducts(prev => prev.map(p => {
        const enhanced = enhancements[p.id.toString()];
        return enhanced ? { ...p, description: enhanced } : p;
      }));
    };
    if (products.length > 0) {
      applyEnhancements();
    }
  }, [products.length]); // Only run when initial products are loaded
  useEffect(() => {
    if (products.length > 0) {
      // Preload first 16 products' primary and alternative images
      products.slice(0, 16).forEach((prod) => {
        if (prod.image) {
          const img = new Image();
          img.src = prod.image;
        }
        if (prod.images && prod.images.length > 0) {
          prod.images.slice(0, 3).forEach((src) => {
            const img = new Image();
            img.src = src;
          });
        }
      });
    }
  }, [products]);

  // Preload all high-res images for the selected product as soon as the modal is opened
  useEffect(() => {
    if (selectedProductDetails) {
      setActiveImageIndex(0);
      setIsModalImgLoaded(false);
      const imagesToLoad = selectedProductDetails.images && selectedProductDetails.images.length > 0
        ? selectedProductDetails.images
        : [selectedProductDetails.image];
      
      imagesToLoad.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    }
  }, [selectedProductDetails]);

  // Filtered products list based on search and selected category
  const filteredProducts = products.filter((prod) => {
    const matchesCategory = activeCategory === null || prod.category_id === activeCategory;
    const matchesSearch = 
      prod.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (prod.raw_description && prod.raw_description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      prod.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const favoritedProducts = products.filter(p => favoriteIds.includes(p.id));

  const handleOrderSuccess = (order: Order) => {
    setSelectedProductForOrder(null);
    setSelectedProductDetails(null);
    setSubmittedOrder(order);

    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        phone: order.cus_num1,
        capetel: order.capetel,
        address: order.address,
      };
      setCurrentUser(updatedUser);
      localStorage.setItem("souq_saada_user", JSON.stringify(updatedUser));
    }
  };

  return (
    <div className="min-h-screen bg-[#131722] text-[#d1d4dc] font-sans selection:bg-[#ff9800]/30 selection:text-white flex flex-col">
      
      {/* 1. STICKY HEADER */}
      <Header
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isAdminMode={isAdminMode}
        onToggleAdmin={handleToggleAdmin}
        showAdminButton={showAdminButton}
        products={products}
        onSelectProduct={(p) => handleSelectProduct(p)}
        cartCount={cart.reduce((sum, item) => sum + item.count, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        currentUser={currentUser}
        onLogin={handleLogin}
        isLoggingIn={isLoggingIn}
        onLogout={handleLogout}
        onToggleFavorites={() => setShowFavoritesDrawer(true)}
        onToggleOrders={() => setShowOrdersDrawer(true)}
      />

      {/* Auth/DB Error Toast */}
      {(authError || dbError) && (
        <div className="fixed bottom-24 right-6 z-[100] animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="bg-rose-500/10 border border-rose-500/50 backdrop-blur-md p-4 rounded-2xl flex items-center gap-3 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-rose-400">{authError ? "خطأ في تسجيل الدخول" : "خطأ في قاعدة البيانات"}</p>
              <p className="text-[10px] text-gray-300 mt-0.5">{authError || dbError}</p>
            </div>
            <button 
              onClick={() => { setAuthError(null); setDbError(null); }}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors mr-2"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* 2. DYNAMIC CONTENT MAIN AREA */}
      <main className="flex-grow">
        {isAdminMode ? (
          /* ==========================================
             A. MERCHANT/ADMIN CONSOLE VIEW
             ========================================== */
          <AdminDashboard 
            categories={categories}
            products={products}
            setProducts={setProducts}
            onLogout={handleLogout}
            onBackToStore={() => setIsAdminMode(false)}
          />
        ) : (
          /* ==========================================
             B. CUSTOMER/VISITOR STOREFRONT VIEW
             ========================================== */
          <div className="space-y-8 pb-16">
            
            {/* Glowing Hero Showcase Banner */}
            <div className="relative overflow-hidden bg-gradient-to-l from-[#1e222d] to-[#131722] border-b border-[#2a2e39] py-12 sm:py-16">
              {/* Decorative Blur Backgrounds */}
              <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-64 h-64 bg-[#ff9800]/5 rounded-full blur-[80px]" />
              <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-80 h-80 bg-amber-500/5 rounded-full blur-[100px]" />

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#ff9800]/10 border border-[#ff9800]/25 rounded-full text-xs font-black text-[#ff9800]">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse text-[#ff9800]" />
                  شحن فوري مخصص إلى كافة محافظات العراق
                </span>
                
                <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl mx-auto text-white">
                  تسوّق بأمان وسعادة مع <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#ff9800] to-[#f57c00]">سوق السعادة</span>
                </h2>
                
                <p className="text-[#787b86] text-xs sm:text-base max-w-xl mx-auto font-medium leading-relaxed">
                  نحن نوفر لك أفضل المنتجات المبتكرة بأسعار الجملة الحقيقية والتوصيل سريع كبرق خلال 24 ساعة فقط! ادفع عند استلام بضاعتك وافحصها براحتك.
                </p>

                {/* Features Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl mx-auto pt-6">
                  <div className="bg-[#1e222d] border border-[#2a2e39] p-3.5 rounded-2xl flex items-center gap-3 justify-end text-right hover:border-[#ff9800]/40 transition-colors">
                    <div>
                      <h4 className="font-bold text-xs text-white">ضمان استرجاع أسبوع كامل</h4>
                      <p className="text-[10px] text-[#787b86]">استرجع فلوسك أو استبدل بكل سهولة وبساطة</p>
                    </div>
                    <div className="bg-amber-500/10 p-2 rounded-xl text-amber-400">
                      <RotateCcw className="w-5 h-5 animate-spin-slow" />
                    </div>
                  </div>

                  <div className="bg-[#1e222d] border border-[#2a2e39] p-3.5 rounded-2xl flex items-center gap-3 justify-end text-right hover:border-[#ff9800]/40 transition-colors">
                    <div>
                      <h4 className="font-bold text-xs text-white">الدفع عند الاستلام</h4>
                      <p className="text-[10px] text-[#787b86]">افحص طلبك بالكامل قبل الدفع عيني</p>
                    </div>
                    <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-400">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-[#1e222d] border border-[#2a2e39] p-3.5 rounded-2xl flex items-center gap-3 justify-end text-right hover:border-[#ff9800]/40 transition-colors">
                    <div>
                      <h4 className="font-bold text-xs text-white"><bdi>توصيل عراقي بـ 24 ساعة</bdi></h4>
                      <p className="text-[10px] text-[#787b86]">
                        <bdi>بغداد 3,000 د.ع</bdi> • <bdi>باقي المحافظات 5,000 د.ع</bdi>
                      </p>
                    </div>
                    <div className="bg-[#ff9800]/10 p-2 rounded-xl text-[#ff9800]">
                      <Truck className="w-5 h-5 animate-pulse" />
                    </div>
                  </div>

                  <div className="bg-[#1e222d] border border-[#2a2e39] p-3.5 rounded-2xl flex items-center gap-3 justify-end text-right hover:border-[#ff9800]/40 transition-colors">
                    <div>
                      <h4 className="font-bold text-xs text-gray-200">دعم متواصل بالذكاء الاصطناعي</h4>
                      <p className="text-[10px] text-gray-500">مساعدنا التفاعلي جاهز للإجابة فوراً</p>
                    </div>
                    <div className="bg-blue-500/10 p-2 rounded-xl text-blue-400">
                      <Bot className="w-5 h-5" />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Latest Featured Products Auto-Scrolling Slider */}
            {!searchQuery && activeCategory === null && products.length > 0 && (
              <LatestProductsSlider
                products={products}
                onSelectProduct={(p) => handleSelectProduct(p)}
                onOrderProduct={(p) => setSelectedProductForOrder(p)}
              />
            )}

            {/* Category Tags header / Search Results subtitle */}
            <div id="products-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
              <div className="flex flex-col sm:flex-row-reverse sm:items-center sm:justify-between border-b border-[#2a2e39] pb-4 gap-4">
                <div className="text-right">
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 justify-end">
                    <span>{activeCategory === null ? "كافة المنتجات المتاحة" : categories.find(c => c.id === activeCategory)?.name}</span>
                    <span className="text-[#ff9800] font-black text-sm">({filteredProducts.length})</span>
                  </h3>
                  <p className="text-xs text-[#787b86] mt-1">تصفح منتجاتنا الممتازة وحولها إلى طلب شراء سريع بلمسة واحدة</p>
                </div>
                
                <div className="flex items-center gap-3 justify-end sm:justify-start">
                  {/* Floating Action Buttons */}
                  <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-3">
                    <button
                      onClick={() => setIsCartOpen(true)}
                      className="relative flex items-center gap-2 px-5 py-3 rounded-full border text-sm font-bold transition-all shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:-translate-y-1 bg-[#1e222d] border-[#2a2e39] text-[#ff9800] hover:border-[#ff9800]/50 hover:text-white"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      {cart.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border border-[#171b26] animate-pulse">
                          {cart.reduce((sum, item) => sum + item.count, 0)}
                        </span>
                      )}
                      <span className="hidden sm:inline">سلة المشتريات</span>
                    </button>

                    {currentUser && (
                      <button
                        onClick={() => setShowFavoritesDrawer(true)}
                        className="relative flex items-center gap-2 px-5 py-3 rounded-full border text-sm font-bold transition-all shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:-translate-y-1 bg-[#1e222d] border-[#2a2e39] text-rose-400 hover:border-rose-500/50 hover:text-white"
                      >
                        <Heart className="w-5 h-5" />
                        {favoriteIds.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border border-[#171b26]">
                            {favoriteIds.length}
                          </span>
                        )}
                        <span className="hidden sm:inline">المفضلات</span>
                      </button>
                    )}
                  </div>

                  {searchQuery && (
                    <span className="text-xs bg-[#2a2e39] text-[#d1d4dc] px-3 py-1.5 rounded-xl border border-transparent text-right">
                      نتائج البحث عن: <strong className="text-[#ff9800]">"{searchQuery}"</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Catalog Grid View */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-12 h-12 border-4 border-[#ff9800] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-[#787b86]">جاري تحميل المعرض الإبداعي لسوق السعادة...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-20 bg-[#1e222d] rounded-3xl border border-[#2a2e39] space-y-4 max-w-xl mx-auto p-6">
                  <ShoppingBag className="w-12 h-12 text-[#787b86] mx-auto" />
                  <h4 className="text-lg font-bold text-white">لم نجد أي منتجات مطابقة!</h4>
                  <p className="text-xs sm:text-sm text-[#787b86]">
                    جرب البحث بكلمة مختلفة أو اختر تصنيفاً آخر من الأعلى لتستكشف منتجات سوق السعادة الساحرة.
                  </p>
                  <button
                    onClick={() => { setSearchQuery(""); setActiveCategory(null); }}
                    className="px-4 py-2 bg-[#ff9800] text-[#131722] rounded-xl text-xs font-black hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                  >
                    إعادة عرض كل المعروضات
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.slice(0, visibleCount).map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onSelect={(p) => handleSelectProduct(p)}
                        onOrder={(p) => setSelectedProductForOrder(p)}
                        onAddToCart={handleAddToCart}
                        onZoomImage={setZoomedImage}
                        isAdminAuthenticated={isAdminAuthenticated}
                        onEnhanceDescription={handleEnhanceDescription}
                        isEnhancing={enhancingProductId === product.id}
                        isFavorite={favoriteIds.includes(product.id)}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </div>
                  
                  {visibleCount < filteredProducts.length && (
                    <div className="mt-8 flex justify-center">
                      <button
                        onClick={() => setVisibleCount(prev => prev + 24)}
                        className="bg-[#1e222d] border border-[#2a2e39] hover:border-[#ff9800] text-[#d1d4dc] hover:text-[#ff9800] font-bold py-3 px-8 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        عرض المزيد
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Iraqi Guarantee & FAQ Banner */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
              <div className="bg-[#1e222d] border border-[#2a2e39] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row-reverse gap-6 items-center">
                <div className="flex-1 text-right space-y-3">
                  <h3 className="text-lg sm:text-2xl font-black text-[#ff9800]">
                    ضمان سوق السعادة وثقة الزبائن في العراق
                  </h3>
                  <p className="text-xs sm:text-sm text-[#787b86] leading-relaxed">
                    نحن نعلم مدى أهمية الثقة بالتسوق الإلكتروني. لذلك، عندما تقدم طلبك في سوق السعادة، فإننا لا نطلب منك أي بطاقات ائتمانية أو دفع مسبق!
                  </p>
                  <ul className="space-y-2 text-xs text-[#d1d4dc] pt-2 [direction:rtl]">
                    <li className="flex items-center gap-2 justify-start">
                      <div className="w-1.5 h-1.5 bg-[#ff9800] rounded-full" />
                      <span><strong>الدفع عند الاستلام:</strong> لن تدفع فلساً واحداً حتى تمسك السلعة بيدك.</span>
                    </li>
                    <li className="flex items-center gap-2 justify-start">
                      <div className="w-1.5 h-1.5 bg-[#ff9800] rounded-full" />
                      <span><strong>حق فحص البضاعة:</strong> افتح الكارتون وافحص المنتج مع المندوب قبل التسليم للتأكد التام!</span>
                    </li>
                    <li className="flex items-center gap-2 justify-start">
                      <div className="w-1.5 h-1.5 bg-[#ff9800] rounded-full" />
                      <span><strong>التوصيل الفوري السريع:</strong> مندوبونا يتحركون فوراً لتوصيل الطلب خلال 24 ساعة فقط!</span>
                    </li>
                  </ul>
                </div>
                <div className="shrink-0 bg-[#171b26] border border-[#2a2e39] p-5 rounded-2xl text-center space-y-2 w-full md:w-64">
                  <Bot className="w-10 h-10 text-[#ff9800] mx-auto animate-bounce" />
                  <h4 className="font-bold text-sm text-white">هل تحتاج مساعدة عاجلة؟</h4>
                  <p className="text-[10px] text-[#787b86]">
                    مساعدنا بالذكاء الاصطناعي في الزاوية السفلى جاهز لمساعدتك في أي وقت وبكل حب عراقي!
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* 3. FLOATING AI ASSISTANT WIDGET */}
      <ChatAssistant 
        products={products}
        onSelectProduct={handleSelectProduct}
        onOrderProduct={(p) => setSelectedProductForOrder(p)}
        onZoomImage={setZoomedImage}
        currentUser={currentUser}
      />

      {/* 4. DIALOG MODAL: PRODUCT DETAILS */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedProductDetails(null)} />
          
          <div className="relative bg-[#1e222d] border border-[#2a2e39] rounded-3xl max-w-2xl w-full overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-white text-right z-10 flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#2a2e39]">
              <button 
                id="close-details-btn"
                onClick={() => setSelectedProductDetails(null)} 
                className="text-gray-400 hover:text-[#ff9800] hover:bg-[#2a2e39] p-2 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-base sm:text-lg font-black text-gray-200">تفاصيل ومميزات المنتج</h3>
            </div>

            {/* Scrollable details body */}
            <div className="overflow-y-auto p-5 sm:p-6 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Right side: Title & specs */}
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 justify-end">
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md font-bold flex items-center gap-1">
                      <span>ضمان استرجاع لمدة أسبوع</span>
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                    </span>
                    <span className="text-[10px] text-[#ff9800] bg-[#ff9800]/10 border border-[#ff9800]/20 px-2.5 py-1 rounded-md font-bold">
                      توصيل فوري خلال 24 ساعة ⚡
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white leading-relaxed">
                    <bdi>{selectedProductDetails.title}</bdi>
                  </h2>
                  
                  {/* Dynamic price card */}
                  <div className="bg-[#171b26] border border-[#2a2e39] p-3.5 rounded-2xl flex justify-between items-center flex-row-reverse">
                    <div>
                      <span className="text-[10px] text-[#787b86] block">سعر التوصيل الفوري المعتمد</span>
                      <span className="text-xl sm:text-2xl font-black text-[#ff9800]">
                        <bdi>{selectedProductDetails.price.toLocaleString("ar-IQ")} دينار عراقي</bdi>
                      </span>
                    </div>
                    {selectedProductDetails.discount && (
                      <div className="text-left">
                        <span className="text-xs text-gray-500 line-through block leading-tight">
                          <bdi>{Math.round(selectedProductDetails.price / (1 - selectedProductDetails.discount / 100)).toLocaleString("ar-IQ")} د.ع</bdi>
                        </span>
                        <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-black mt-1 inline-block">
                          <bdi>خصم {selectedProductDetails.discount}%</bdi>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Iraqi Province fees info card */}
                  <div className="bg-[#2a2e39] p-3.5 rounded-2xl space-y-1.5 text-xs text-[#787b86]">
                    <div className="flex justify-between items-center flex-row-reverse">
                      <span>بغداد (العاصمة):</span>
                      <strong className="text-gray-200"><bdi>3,000 د.ع فقط</bdi></strong>
                    </div>
                    <div className="flex justify-between items-center flex-row-reverse">
                      <span>بقية المحافظات العراقية:</span>
                      <strong className="text-gray-200"><bdi>5,000 د.ع فقط</bdi></strong>
                    </div>
                  </div>
                </div>

                {/* Left side: Image Gallery & Thumbnails */}
                <div className="flex flex-col space-y-3">
                  {(() => {
                    const modalImages = selectedProductDetails.images && selectedProductDetails.images.length > 0
                      ? selectedProductDetails.images
                      : [selectedProductDetails.image];

                    const handleNextImage = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setIsModalImgLoaded(false);
                      setActiveImageIndex((prev) => (prev + 1) % modalImages.length);
                    };

                    const handlePrevImage = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setIsModalImgLoaded(false);
                      setActiveImageIndex((prev) => (prev - 1 + modalImages.length) % modalImages.length);
                    };

                    return (
                      <>
                        {/* Main Image Container with loading state */}
                        <div className="relative aspect-square overflow-hidden bg-white rounded-2xl border border-[#2a2e39] group/gallery">
                          {/* Visual Shimmer & Spinning Loader */}
                          {!isModalImgLoaded && (
                            <div className="absolute inset-0 bg-white animate-pulse flex items-center justify-center pointer-events-none z-10">
                              <div className="w-8 h-8 border-4 border-[#ff9800] border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}

                          <img 
                            key={activeImageIndex} // force re-render transition
                            src={modalImages[activeImageIndex]} 
                            alt={selectedProductDetails.title}
                            referrerPolicy="no-referrer"
                            onLoad={() => setIsModalImgLoaded(true)}
                            className={`w-full h-full object-contain p-4 transition-all duration-300 ${isModalImgLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
                          />

                          {/* Favorite Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(selectedProductDetails);
                            }}
                            className={`absolute bottom-3 left-3 w-10 h-10 rounded-full flex items-center justify-center transition-all z-20 cursor-pointer border shadow-md backdrop-blur-sm ${
                              favoriteIds.includes(selectedProductDetails.id)
                                ? "bg-rose-500 border-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]" 
                                : "bg-black/40 border-white/20 text-white hover:bg-rose-500/80 hover:border-rose-500"
                            }`}
                            title="إضافة للمفضلة"
                          >
                            <Heart className={`w-5 h-5 ${favoriteIds.includes(selectedProductDetails.id) ? "fill-current" : ""}`} />
                          </button>

                          {/* Zoom Image Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoomedImage(modalImages[activeImageIndex]);
                            }}
                            className="absolute bottom-3 left-16 w-10 h-10 rounded-full flex items-center justify-center bg-black/40 border border-white/20 text-white hover:bg-[#ff9800] hover:border-[#ff9800] hover:text-[#131722] transition-all sm:opacity-0 sm:group-hover/gallery:opacity-100 opacity-100 z-20 cursor-pointer shadow-md backdrop-blur-sm"
                            title="تكبير الصورة"
                          >
                            <ZoomIn className="w-5 h-5" />
                          </button>

                          {/* Navigation Arrows for Multiple Images */}
                          {modalImages.length > 1 && (
                            <>
                              <button
                                onClick={handlePrevImage}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#131722]/85 hover:bg-[#ff9800] hover:text-[#131722] text-white p-2 rounded-xl backdrop-blur-sm transition-all opacity-100 sm:opacity-0 group-hover/gallery:opacity-100 shadow-lg cursor-pointer border border-[#2a2e39] hover:scale-110 active:scale-95"
                                title="الصورة السابقة"
                              >
                                <ChevronLeft className="w-5 h-5 rotate-180" />
                              </button>
                              <button
                                onClick={handleNextImage}
                                className="absolute left-3 top-1/2 -translate-y-1/2 bg-[#131722]/85 hover:bg-[#ff9800] hover:text-[#131722] text-white p-2 rounded-xl backdrop-blur-sm transition-all opacity-100 sm:opacity-0 group-hover/gallery:opacity-100 shadow-lg cursor-pointer border border-[#2a2e39] hover:scale-110 active:scale-95"
                                title="الصورة التالية"
                              >
                                <ChevronLeft className="w-5 h-5" />
                              </button>

                              {/* Image Counter Badge */}
                              <div className="absolute bottom-3 left-3 bg-[#131722]/90 border border-[#2a2e39] px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#ff9800] backdrop-blur-sm shadow-md">
                                {activeImageIndex + 1} / {modalImages.length}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Thumbnails Row */}
                        {modalImages.length > 1 && (
                          <div 
                            ref={thumbnailsRef}
                            className="flex gap-2 overflow-x-auto pb-1 [direction:rtl] scrollbar-none scroll-smooth"
                          >
                            {modalImages.map((imgSrc, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (activeImageIndex !== idx) {
                                    setIsModalImgLoaded(false);
                                    setActiveImageIndex(idx);
                                  }
                                }}
                                className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                                  activeImageIndex === idx 
                                    ? "border-[#ff9800] scale-105 shadow-[0_0_8px_rgba(255,152,0,0.4)]" 
                                    : "border-[#2a2e39] opacity-60 hover:opacity-100"
                                }`}
                              >
                                <img 
                                  src={imgSrc} 
                                  alt={`صورة ${idx + 1}`} 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover" 
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Enhanced Description Content */}
              <div className="border-t border-[#2a2e39] pt-5 space-y-3">
                <h4 className="font-bold text-sm text-gray-300 flex items-center justify-end gap-1.5">
                  <span>وصف مميزات المنتج بالكامل</span>
                  <Sparkles className="w-4 h-4 text-[#ff9800]" />
                </h4>
                
                <div 
                  className="bg-[#131722] p-4 sm:p-5 rounded-2xl border border-[#2a2e39] text-xs sm:text-sm text-gray-300 leading-relaxed rich-description"
                  dir="auto"
                >
                  {(() => {
                    const desc = selectedProductDetails.description || "";
                    const containsHtml = /<[a-z][\s\S]*>/i.test(desc);
                    if (containsHtml) {
                      return <div dangerouslySetInnerHTML={{ __html: desc }} />;
                    }
                    return <div style={{ whiteSpace: "pre-wrap" }}>{desc}</div>;
                  })()}
                </div>
              </div>

            </div>

            {/* Bottom Order trigger */}
            <div className="p-5 border-t border-[#2a2e39] bg-[#171b26] flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-[#787b86] block">المجموع للقطعة</span>
                <span className="text-base sm:text-lg font-black text-white">
                  {selectedProductDetails.price.toLocaleString("ar-IQ")} د.ع
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleAddToCart(selectedProductDetails);
                    setSelectedProductDetails(null);
                  }}
                  className="bg-[#2a2e39] text-[#d1d4dc] hover:bg-[#3a3f50] hover:text-white px-4 py-3 rounded-xl text-xs sm:text-sm hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="hidden sm:inline">أضف للسلة</span>
                </button>
                <button
                  id="details-order-btn"
                  onClick={() => setSelectedProductForOrder(selectedProductDetails)}
                  className="bg-[#ff9800] text-[#131722] hover:bg-[#ffa726] font-black px-6 py-3 rounded-xl text-xs sm:text-sm hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Truck className="w-4 h-4" />
                  <span>اطلب السلعة الآن</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4.5. SHOPPING CART DRAWER */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onUpdateCount={handleUpdateCartCount}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onCheckout={() => {
          setIsCartOpen(false);
          setIsCartCheckoutOpen(true);
        }}
        onZoomImage={setZoomedImage}
      />

      {/* 4.6. FAVORITES DRAWER */}
      <FavoritesDrawer
        isOpen={showFavoritesDrawer}
        onClose={() => setShowFavoritesDrawer(false)}
        favorites={favoritedProducts}
        onSelectProduct={setSelectedProductDetails}
        onOrderProduct={setSelectedProductForOrder}
        onAddToCart={handleAddToCart}
        onZoomImage={setZoomedImage}
        onToggleFavorite={handleToggleFavorite}
        favoriteIds={favoriteIds}
      />

      {/* 4.7. ORDERS HISTORY DRAWER */}
      <OrdersDrawer
        isOpen={showOrdersDrawer}
        onClose={() => setShowOrdersDrawer(false)}
        currentUser={currentUser}
        products={products}
      />



      {/* 5. DIALOG MODAL: CHECKOUT ENGINE */}
      {selectedProductForOrder && (
        <CheckoutModal
          product={selectedProductForOrder}
          onClose={() => setSelectedProductForOrder(null)}
          onOrderSuccess={handleOrderSuccess}
          onZoomImage={setZoomedImage}
          userId={currentUser?.uid}
          userEmail={currentUser?.email}
          initialName={currentUser?.displayName}
          initialPhone={currentUser?.phone}
          initialAddress={currentUser?.address}
          initialCapetel={currentUser?.capetel}
        />
      )}

      {/* 5.1. DIALOG MODAL: CART CHECKOUT ENGINE */}
      {isCartCheckoutOpen && (
        <CheckoutModal
          cartItems={cart}
          onClose={() => setIsCartCheckoutOpen(false)}
          onOrderSuccess={(order) => {
            setIsCartCheckoutOpen(false);
            handleOrderSuccess(order);
          }}
          onClearCart={handleClearCart}
          onZoomImage={setZoomedImage}
          userId={currentUser?.uid}
          userEmail={currentUser?.email}
          initialName={currentUser?.displayName}
          initialPhone={currentUser?.phone}
          initialAddress={currentUser?.address}
          initialCapetel={currentUser?.capetel}
        />
      )}


      {/* 6. TOAST MODAL: ORDER CREATED CONFIRMATION */}
      {submittedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSubmittedOrder(null)} />
          
          <div className="relative bg-[#1e222d] border border-[#2a2e39] rounded-3xl max-w-md w-full overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-white text-center p-6 sm:p-8 z-10 space-y-6">
            
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <ShieldCheck className="w-9 h-9 stroke-[2.5]" />
            </div>

            <div className="space-y-2 text-center">
              <span className="text-emerald-400 text-xs font-black bg-emerald-500/10 px-3 py-1 rounded-full">
                تم استلام طلبك بنجاح في سوق السعادة
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-relaxed">
                شكراً لثقتك بنا يا {submittedOrder.cus_name}!
              </h2>
              <p className="text-xs sm:text-sm text-[#787b86] max-w-xs mx-auto leading-relaxed">
                رقم طلبك هو <strong className="text-[#ff9800]">{submittedOrder.id}</strong>. لقد قمنا بتسجيل طلبك بنجاح لمندوب التوصيل وسيتواصل معك المندوب هاتفياً لتسليم الشحنة في غضون 24 ساعة فقط!
              </p>
            </div>

            {/* Bill Summary */}
            <div className="bg-[#171b26] border border-[#2a2e39] p-4 rounded-2xl text-xs sm:text-sm text-gray-300 space-y-2 text-right">
              <div className="flex justify-between flex-row-reverse">
                <span className="text-[#787b86]">المنتج المطلوب:</span>
                <span className="font-bold text-white text-right">{submittedOrder.item_title} (عدد {submittedOrder.count})</span>
              </div>
              <div className="flex justify-between flex-row-reverse">
                <span className="text-[#787b86]">عنوان التوصيل:</span>
                <span className="font-bold text-white">{submittedOrder.capetel} - {submittedOrder.city || submittedOrder.address}</span>
              </div>
              <div className="flex justify-between flex-row-reverse border-t border-[#2a2e39] pt-2">
                <span className="text-gray-100 font-bold">المبلغ الكلي المستحق:</span>
                <span className="font-black text-[#ff9800]">{submittedOrder.total_price.toLocaleString("ar-IQ")} دينار عراقي</span>
              </div>
            </div>

            <button
              id="confirm-ok-btn"
              onClick={() => setSubmittedOrder(null)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-[#131722] font-black py-3 rounded-xl text-xs sm:text-sm transition-all shadow-md cursor-pointer"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}

      {/* 6.5. ZOOMED IMAGE MODAL */}
      {zoomedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 cursor-zoom-out" onClick={() => setZoomedImage(null)}>
          <button
            onClick={(e) => { e.stopPropagation(); setZoomedImage(null); }}
            className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-md transition-all cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={zoomedImage} 
            alt="تكبير" 
            referrerPolicy="no-referrer"
            className="max-w-full max-h-full object-contain cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 7. REVOLVING FOOTER */}
      <footer className="bg-[#1e222d] border-t border-[#2a2e39] py-8 text-center text-xs text-[#787b86]">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <div className="flex items-center justify-center space-x-2 space-x-reverse text-gray-400 font-semibold text-sm">
            <span>سوق السعادة</span>
            <div className="w-1.5 h-1.5 bg-[#ff9800] rounded-full" />
            <span>تسوق آمن وثقة 100%</span>
          </div>
          <p className="max-w-md mx-auto leading-relaxed text-[#787b86]">
            جميع الحقوق محفوظة © {new Date().getFullYear()}. تم تطوير سوق السعادة بأعلى معايير الإتقان مع ذكاء اصطناعي مدمج لمساعدة عملاء المتجر والمسوقين في العراق.
          </p>
        </div>
      </footer>

    </div>
  );
}
