import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  Search, 
  X, 
  Plus, 
  Minus, 
  Check, 
  Percent, 
  Phone, 
  Truck, 
  Send, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  SearchIcon,
  ShoppingBagIcon,
  Heart
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  addDoc, 
  updateDoc, 
  increment 
} from "firebase/firestore";
import { db } from "../firebase";
import { Product, Order, Coupon, Settings, CartItem, OrderStatus } from "../types";

interface StoreFrontProps {
  darkMode: boolean;
  onAdminLoginClick: () => void;
}

export default function StoreFront({ darkMode, onAdminLoginClick }: StoreFrontProps) {
  // States
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings>({
    whatsappNumber: "+9647700000000",
    tiktokLink: "https://www.tiktok.com",
    enableCart: true,
    enableWhatsApp: true,
    enableTikTok: true,
    updatedAt: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "price-asc" | "price-desc" | "title-asc">("newest");

  // Cart State (Persisted in localStorage)
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("fad_zone_cart");
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Coupon State
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");

  // Product Details Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailImageIdx, setDetailImageIdx] = useState(0);
  const [detailQuantity, setDetailQuantity] = useState(1);

  // Checkout State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [selectedOrderMethod, setSelectedOrderMethod] = useState<"Cart" | "WhatsApp" | "TikTok">("Cart");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Tracking State
  const [trackOrderId, setTrackOrderId] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [trackError, setTrackError] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);

  // Policies Modal state
  const [policyModalTitle, setPolicyModalTitle] = useState("");
  const [policyModalContent, setPolicyModalContent] = useState("");
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  const openPolicyModal = (title: string, content: string) => {
    setPolicyModalTitle(title);
    setPolicyModalContent(content);
    setIsPolicyModalOpen(true);
  };

  // Notification state
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem("fad_zone_favorites");
    return saved ? JSON.parse(saved) : [];
  });

  // Fetch initial data
  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        setLoading(true);
        // Products
        const prodSnap = await getDocs(collection(db, "products"));
        const prodList: Product[] = [];
        prodSnap.forEach((docSnap) => {
          prodList.push({ id: docSnap.id, ...docSnap.data() } as Product);
        });
        setProducts(prodList);
        setFilteredProducts(prodList);

        // Settings
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        if (settingsDoc.exists()) {
          const fetchedSettings = settingsDoc.data() as Settings;
          setSettings(fetchedSettings);
          // Set default selected method based on what is enabled
          if (fetchedSettings.enableCart) {
            setSelectedOrderMethod("Cart");
          } else if (fetchedSettings.enableWhatsApp) {
            setSelectedOrderMethod("WhatsApp");
          } else if (fetchedSettings.enableTikTok) {
            setSelectedOrderMethod("TikTok");
          }
        }
      } catch (err) {
        console.error("Error loading storefront data: ", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStoreData();
  }, []);

  // Save Cart to LocalStorage
  useEffect(() => {
    localStorage.setItem("fad_zone_cart", JSON.stringify(cart));
  }, [cart]);

  // Save Favorites to LocalStorage
  useEffect(() => {
    localStorage.setItem("fad_zone_favorites", JSON.stringify(favorites));
  }, [favorites]);

  // Handle Search, Category Filter, and Sorting
  useEffect(() => {
    let result = products.filter(p => !p.isDisabled);
    if (selectedCategory !== "الكل") {
      result = result.filter(p => p.category === selectedCategory);
    }
    if (searchQuery.trim() !== "") {
      const queryLower = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.title.toLowerCase().includes(queryLower) || 
        p.description.toLowerCase().includes(queryLower)
      );
    }
    
    // Apply Sorting
    if (sortBy === "newest") {
      result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else if (sortBy === "price-asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "title-asc") {
      result.sort((a, b) => a.title.localeCompare(b.title, "ar"));
    }

    setFilteredProducts(result);
  }, [selectedCategory, searchQuery, sortBy, products]);

  // Cart Actions
  const addToCart = (product: Product, quantity: number = 1) => {
    if (product.stock <= 0) return;
    
    setCart((prev) => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, product.stock);
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      return [...prev, { product, quantity: Math.min(quantity, product.stock) }];
    });
    
    // Open cart sidebar on add
    setIsCartOpen(true);
    // Reset quantities
    setDetailQuantity(1);
    setSelectedProduct(null);
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return { ...item, quantity: Math.min(newQty, item.product.stock) };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  };

  const getDiscountAmount = () => {
    if (!appliedCoupon) return 0;
    const subtotal = getSubtotal();
    if (appliedCoupon.type === "percentage") {
      return Math.round((subtotal * appliedCoupon.value) / 100);
    } else {
      return Math.min(appliedCoupon.value, subtotal);
    }
  };

  const getTotalAmount = () => {
    const subtotal = getSubtotal();
    const discount = getDiscountAmount();
    return Math.max(0, subtotal - discount);
  };

  // Toggle Favorite
  const toggleFavorite = (productId: string) => {
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Coupon Engine
  const handleApplyCoupon = async () => {
    setCouponError("");
    setCouponSuccess("");
    if (!couponCode.trim()) return;

    try {
      const codeUpper = couponCode.trim().toUpperCase();
      const docRef = doc(db, "coupons", codeUpper);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const couponData = docSnap.data() as Coupon;
        if (!couponData.isActive) {
          setCouponError("هذا الكوبون غير فعال حالياً");
          setAppliedCoupon(null);
        } else {
          setAppliedCoupon(couponData);
          setCouponSuccess(`تم تطبيق كوبون خصم بقيمة ${
            couponData.type === "percentage" ? `${couponData.value}%` : `${couponData.value.toLocaleString()} د.ع`
          }`);
        }
      } else {
        setCouponError("كوبون غير صحيح، يرجى المحاولة مرة أخرى");
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError("خطأ في التحقق من الكوبون");
      console.error(err);
    }
  };

  // Create Unique Order ID
  const generateOrderID = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`;
    const randomStr = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    return `FZ-${dateStr}-${randomStr}`;
  };

  // Standard checkout action
  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      alert("يرجى ملء جميع الحقول المطلوبة!");
      return;
    }

    setCheckoutLoading(true);
    const orderId = generateOrderID();
    const subtotal = getSubtotal();
    const discount = getDiscountAmount();
    const total = getTotalAmount();

    const orderData: Order = {
      id: orderId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      items: cart.map(item => ({
        productId: item.product.id,
        title: item.product.title,
        price: item.product.price,
        quantity: item.quantity,
        image: item.product.images[0]
      })),
      totalAmount: total,
      status: "Pending",
      couponApplied: appliedCoupon ? appliedCoupon.code : null,
      discountAmount: discount,
      orderMethod: selectedOrderMethod,
      createdAt: new Date().toISOString()
    };

    try {
      if (selectedOrderMethod === "Cart") {
        // Save to Firestore
        await addDoc(collection(db, "orders"), orderData);

        // Update product stocks in Firestore
        for (const item of cart) {
          const prodRef = doc(db, "products", item.product.id);
          await updateDoc(prodRef, {
            stock: increment(-item.quantity)
          });
        }

        // Set state for success page
        setPlacedOrder(orderData);
        // Clear cart
        setCart([]);
        setAppliedCoupon(null);
        setCouponCode("");
      } else if (selectedOrderMethod === "WhatsApp") {
        // Prepare WhatsApp message
        let msg = `*طلب جديد من Fad Zone*\n\n`;
        msg += `*الاسم:* ${customerName}\n`;
        msg += `*الهاتف:* ${customerPhone}\n`;
        msg += `*العنوان:* ${customerAddress}\n\n`;
        msg += `*المنتجات:*\n`;
        cart.forEach((item, index) => {
          msg += `${index + 1}. ${item.product.title} (الكمية: ${item.quantity}) - ${(item.product.price * item.quantity).toLocaleString()} د.ع\n`;
        });
        msg += `\n*المجموع الفرعي:* ${subtotal.toLocaleString()} د.ع\n`;
        if (discount > 0) {
          msg += `*الخصم:* ${discount.toLocaleString()} د.ع (${appliedCoupon?.code})\n`;
        }
        msg += `*المجموع الكلي:* ${total.toLocaleString()} د.ع\n`;

        // Save to Firestore for order logs/realtime alert
        await addDoc(collection(db, "orders"), orderData);

        // Build WhatsApp link
        const cleanPhone = settings.whatsappNumber.replace(/[+\s-]/g, "");
        const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
        
        // Open WA Link
        window.open(waLink, "_blank");

        // Clear cart and success state
        setPlacedOrder(orderData);
        setCart([]);
        setAppliedCoupon(null);
        setCouponCode("");
      } else if (selectedOrderMethod === "TikTok") {
        // Direct order via TikTok
        await addDoc(collection(db, "orders"), orderData);
        window.open(settings.tiktokLink, "_blank");
        setPlacedOrder(orderData);
        setCart([]);
        setAppliedCoupon(null);
        setCouponCode("");
      }
    } catch (err) {
      console.error("Error creating order: ", err);
      alert("حدث خطأ أثناء إتمام الطلب، يرجى المحاولة مجدداً.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Order Tracking
  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError("");
    setTrackedOrder(null);
    if (!trackOrderId.trim()) return;

    setTrackLoading(true);
    try {
      const formattedId = trackOrderId.trim().toUpperCase();
      const ordersRef = collection(db, "orders");
      const ordersSnap = await getDocs(ordersRef);
      
      let foundOrder: Order | null = null;
      ordersSnap.forEach((docSnap) => {
        const data = docSnap.data() as Order;
        if (data.id === formattedId) {
          foundOrder = data;
        }
      });

      if (foundOrder) {
        setTrackedOrder(foundOrder);
      } else {
        setTrackError("لم نتمكن من العثور على طلب بهذا الرمز. يرجى التأكد من الرمز والمحاولة مرة أخرى.");
      }
    } catch (err) {
      console.error("Error tracking order: ", err);
      setTrackError("حدث خطأ أثناء تتبع الطلب، يرجى المحاولة لاحقاً.");
    } finally {
      setTrackLoading(false);
    }
  };

  const getStatusStep = (status: OrderStatus) => {
    const steps: OrderStatus[] = ["Pending", "Processing", "Shipped", "Delivered"];
    return steps.indexOf(status);
  };

  const getStatusTextArabic = (status: OrderStatus) => {
    switch (status) {
      case "Pending": return "قيد الانتظار";
      case "Processing": return "قيد التجهيز";
      case "Shipped": return "تم الشحن";
      case "Delivered": return "تم التوصيل";
    }
  };

  // Categories list with dynamic categories from products
  const baseCategories = ["الكل", "ملابس", "أحذية", "إكسسوارات"];
  const categories = [
    "الكل",
    ...Array.from(
      new Set([
        ...baseCategories.filter(c => c !== "الكل"),
        ...products.map(p => p.category).filter(Boolean)
      ])
    )
  ];

  return (
    <div className={`min-h-screen pb-16 transition-colors duration-300 ${darkMode ? "dark-mode" : "bg-[#fcfcfd]"}`} dir="rtl">
      {/* Top Banner / Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-300 ${
        darkMode ? "bg-[#0d0f14]/90 border-gray-800 text-white" : "bg-white/95 border-gray-100 text-gray-900"
      }`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            {settings.storeLogo ? (
              <img 
                src={settings.storeLogo} 
                alt={settings.storeName || "Fad Zone"} 
                className="w-10 h-10 object-cover rounded-xl shadow-md border border-gray-100 dark:border-gray-800 shrink-0" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="p-2 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-xl text-white shadow-md shrink-0">
                <Sparkles className="w-6 h-6" />
              </span>
            )}
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-l from-rose-600 to-amber-500 bg-clip-text text-transparent">
                {settings.storeName || "Fad Zone"}
              </h1>
              <p className="text-[9px] -mt-1 text-gray-400 font-medium">موضة عصرية بلمسة عراقية</p>
            </div>
          </div>

          {/* Quick Links / Actions */}
          <div className="flex items-center gap-3">
            {/* Tracking Toggle Button */}
            <a href="#track-section" className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300">
              <Truck className="w-3.5 h-3.5" />
              تتبع طلبك
            </a>

            {/* Admin Access Portal Button */}
            <button 
              onClick={onAdminLoginClick} 
              id="admin-portal-btn"
              className="text-xs font-bold px-3.5 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 shadow transition-colors duration-200"
            >
              بوابة الإدارة
            </button>

            {/* Cart Button */}
            <button 
              onClick={() => setIsCartOpen(true)}
              id="floating-cart-btn"
              className="relative p-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 transition duration-200 dark:border-gray-800 dark:hover:bg-gray-800"
            >
              <ShoppingBag className="w-5.5 h-5.5" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center pulse-red">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-6 pb-12 sm:py-20">
        <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/5 via-amber-500/5 to-transparent rounded-3xl -z-10" />
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-7 space-y-6 text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold dark:text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              {settings.heroTagline || "أفضل تشكيلة أزياء لعام 2026"}
            </span>
            <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">
              {settings.heroTitle ? (
                settings.heroTitle
              ) : (
                <>
                  تأنق بأحدث خطوط <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-l from-rose-500 to-amber-500">موضة العصر</span> مع {settings.storeName || "فاد زون"}
                </>
              )}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-xl text-sm sm:text-base leading-relaxed">
              {settings.heroSubtitle || "تصفح تشكيلة حصرية من الهوديات الفاخرة، الساعات الرياضية الذكية، والأحذية الرياضية المبتكرة. شحن سريع لكافة محافظات العراق ودعم متواصل على مدار الساعة."}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a 
                href="#products-section" 
                className="px-6 py-3.5 bg-gradient-to-l from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-extrabold rounded-xl shadow-lg shadow-rose-500/20 text-sm transition duration-300 flex items-center gap-2"
              >
                تسوق التشكيلة الآن
                <ChevronLeft className="w-4 h-4" />
              </a>
              <a 
                href="#track-section" 
                className="px-6 py-3.5 bg-transparent border-2 border-gray-300 hover:border-gray-900 text-gray-700 dark:text-gray-200 dark:border-gray-700 dark:hover:border-gray-500 font-extrabold rounded-xl text-sm transition duration-300 flex items-center gap-2"
              >
                تتبع طلبي النشط
              </a>
            </div>
          </div>

          {/* Hero Banner Images */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-72 h-80 sm:w-96 sm:h-[400px] rounded-3xl overflow-hidden shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-500">
              <img 
                src={settings.heroImage || "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80"} 
                alt={settings.storeName || "Fad Zone"} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-6 text-white text-right">
                <p className="text-xs text-amber-400 font-bold">{settings.storeName || "فاد زون"}</p>
                <h3 className="text-lg font-black">{settings.heroTagline || "دفء وفخامة لا تضاهى لعام 2026"}</h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Shop Container */}
      <main className="max-w-7xl mx-auto px-4 py-8" id="products-section">
        
        {/* Section Heading & Category / Search Row */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8 p-6 rounded-3xl border transition-colors bg-gray-50/50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-800">
          <div className="space-y-1">
            <h3 className="text-2xl font-black flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-rose-500" />
              <span>تشكيلة منتجاتنا المميزة</span>
            </h3>
            <p className="text-gray-400 text-xs">تصفح المنتجات المتوفرة، أضف للسلة واطلب بسهولة</p>
            {/* Results count badge */}
            <div className="flex flex-wrap items-center gap-2 pt-1.5">
              <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/10">
                إجمالي المنتجات: {products.length}
              </span>
              {filteredProducts.length !== products.length && (
                <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/10 animate-pulse">
                  نتائج الفرز: {filteredProducts.length}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 w-full xl:w-auto">
            {/* Search Input, Clear and Sort Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Field */}
              <div className="relative flex-1 sm:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="ابحث بالاسم أو الوصف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full text-xs pr-10 pl-10 py-3 rounded-xl border focus:outline-none transition-all duration-300 ${
                    darkMode 
                      ? "bg-gray-950 border-gray-800 text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30" 
                      : "bg-white border-gray-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 shadow-xs"
                  }`}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-rose-500 transition-colors"
                    title="مسح البحث"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sorting Select */}
              <div className="relative sm:w-56">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className={`w-full text-xs pr-4 pl-8 py-3 rounded-xl border focus:outline-none cursor-pointer appearance-none transition-all duration-300 ${
                    darkMode 
                      ? "bg-gray-950 border-gray-800 text-white focus:border-rose-500" 
                      : "bg-white border-gray-200 focus:border-rose-500 shadow-xs"
                  }`}
                >
                  <option value="newest">الأحدث أولاً</option>
                  <option value="price-asc">السعر: من الأقل للأعلى</option>
                  <option value="price-desc">السعر: من الأعلى للأقل</option>
                  <option value="title-asc">الاسم: أ - ي</option>
                </select>
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <ChevronLeft className="w-4 h-4 -rotate-90" />
                </div>
              </div>
            </div>

            {/* Categories scroll area */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 whitespace-nowrap hidden sm:inline">الأقسام:</span>
              <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
                {categories.map((cat) => {
                  // count items for this category
                  const count = cat === "الكل" 
                    ? products.length 
                    : products.filter(p => p.category === cat).length;
                  
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all duration-300 flex items-center gap-1.5 ${
                        selectedCategory === cat
                          ? "bg-gradient-to-l from-rose-600 to-amber-500 text-white shadow-md shadow-rose-500/20"
                          : darkMode 
                            ? "bg-gray-950 text-gray-300 border border-gray-800 hover:border-gray-700"
                            : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 shadow-xs"
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                        selectedCategory === cat
                          ? "bg-white/20 text-white"
                          : darkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Filters Summary (Visible when filtered) */}
            {(selectedCategory !== "الكل" || searchQuery) && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-dashed border-gray-200 dark:border-gray-800 animate-fadeIn">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-gray-400">الفلاتر النشطة:</span>
                  {selectedCategory !== "الكل" && (
                    <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                      القسم: {selectedCategory}
                      <button onClick={() => setSelectedCategory("الكل")} className="hover:text-rose-700"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                      بحث: "{searchQuery}"
                      <button onClick={() => setSearchQuery("")} className="hover:text-amber-700"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedCategory("الكل");
                    setSearchQuery("");
                    setSortBy("newest");
                  }}
                  className="text-[11px] text-gray-400 hover:text-rose-500 font-bold underline cursor-pointer transition-colors"
                >
                  إعادة تعيين الكل
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-rose-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="text-gray-400 text-xs mt-3">جاري تحميل المنتجات الرائعة...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold">عذراً، لم نجد أي منتجات تطابق بحثك حالياً.</p>
            <button 
              onClick={() => { setSelectedCategory("الكل"); setSearchQuery(""); setSortBy("newest"); }}
              className="mt-4 px-4 py-2 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-xl text-xs font-bold"
            >
              عرض جميع المنتجات
            </button>
          </div>
        ) : (
          /* Products Grid */
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product) => {
              const isFavorite = favorites.includes(product.id);
              return (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`group rounded-2xl border overflow-hidden flex flex-col justify-between transition-all duration-300 ${
                    darkMode ? "bg-gray-900/50 border-gray-800/80 hover:border-gray-700" : "bg-white border-gray-100 shadow-sm hover:shadow-md"
                  }`}
                >
                  {/* Image and badges */}
                  <div className="relative aspect-square overflow-hidden bg-gray-100">
                    <img 
                      src={product.images[0]} 
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />

                    {/* Stock Alert Badge */}
                    {product.stock <= 0 ? (
                      <span className="absolute top-2.5 right-2.5 text-[9px] font-black bg-rose-600 text-white px-2 py-1 rounded-md shadow">
                        نفذت الكمية
                      </span>
                    ) : product.stock <= 5 ? (
                      <span className="absolute top-2.5 right-2.5 text-[9px] font-black bg-amber-500 text-white px-2 py-1 rounded-md shadow">
                        تبقت {product.stock} قطع فقط!
                      </span>
                    ) : null}

                    {/* Category Label */}
                    <span className="absolute bottom-2.5 right-2.5 text-[9px] font-bold bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-md">
                      {product.category}
                    </span>

                    {/* Favorite Heart Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(product.id);
                      }}
                      className="absolute top-2.5 left-2.5 p-2 rounded-full bg-white/80 dark:bg-gray-900/80 hover:bg-white dark:hover:bg-gray-900 transition backdrop-blur-sm shadow-sm"
                    >
                      <Heart className={`w-4 h-4 ${isFavorite ? "fill-rose-500 text-rose-500" : "text-gray-400 hover:text-rose-500"}`} />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm sm:text-base line-clamp-1 group-hover:text-rose-500 transition-colors">
                        {product.title}
                      </h4>
                      <p className="text-gray-400 text-[11px] sm:text-xs mt-1 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                        {product.description}
                      </p>
                    </div>

                    <div className="mt-3">
                      {/* Price & Action Row */}
                      <div className="flex items-center justify-between mt-1">
                        <div>
                          <span className="text-[10px] text-gray-400 block -mb-1">السعر</span>
                          <span className="text-sm sm:text-base font-black text-rose-500">
                            {product.price.toLocaleString()} <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">د.ع</span>
                          </span>
                        </div>

                        {/* View & Buy Button */}
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setDetailImageIdx(0);
                            setDetailQuantity(1);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-200 flex items-center gap-1 ${
                            product.stock <= 0
                              ? "bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800"
                              : "bg-rose-500 hover:bg-rose-600 text-white"
                          }`}
                        >
                          تفاصيل
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Trust Badges */}
      <section className={`py-8 max-w-7xl mx-auto px-4 border-y my-12 transition-colors ${darkMode ? "border-gray-800" : "border-gray-100"}`}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="space-y-2">
            <div className="p-3 bg-rose-500/10 text-rose-500 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
              <Truck className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-sm">شحن لكافة محافظات العراق</h4>
            <p className="text-xs text-gray-400">توصيل سريع وباب المنزل بأسعار تنافسية</p>
          </div>
          <div className="space-y-2">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
              <Phone className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-sm">طلب مباشر عبر واتساب</h4>
            <p className="text-xs text-gray-400">تواصل مباشر مع الإدارة لتأكيد طلبك فورا</p>
          </div>
          <div className="space-y-2">
            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-sm">جودة مضمونة 100%</h4>
            <p className="text-xs text-gray-400">منتجاتنا خاضعة لفحص الجودة قبل الشحن</p>
          </div>
        </div>
      </section>

      {/* Tracking Section */}
      <section className="max-w-xl mx-auto px-4 py-8" id="track-section">
        <div className={`p-6 rounded-2xl border transition-colors ${darkMode ? "bg-gray-950 border-gray-800" : "bg-white border-gray-100 shadow-md"}`}>
          <div className="flex items-center gap-2 mb-4 justify-center">
            <Truck className="w-6 h-6 text-rose-500" />
            <h3 className="text-xl font-black">نظام تتبع الطلبات المباشر</h3>
          </div>
          <p className="text-center text-xs text-gray-400 mb-6">أدخل كود تتبع الطلب الخاص بك (مثل: FZ-260701-1234) لمشاهدة حالة طلبك في الوقت الفعلي</p>
          
          <form onSubmit={handleTrackOrder} className="flex gap-2 mb-4">
            <input 
              type="text" 
              placeholder="مثال: FZ-260701-1234"
              value={trackOrderId}
              onChange={(e) => setTrackOrderId(e.target.value)}
              className={`flex-1 text-sm text-center px-4 py-3 rounded-xl border focus:outline-none focus:border-rose-500 uppercase tracking-wider font-semibold ${
                darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
              }`}
            />
            <button 
              type="submit" 
              disabled={trackLoading}
              className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition duration-200 shadow-lg shadow-rose-500/20 disabled:bg-gray-400"
            >
              {trackLoading ? "جاري البحث..." : "تتبع"}
            </button>
          </form>

          {/* Tracking Result */}
          {trackError && (
            <p className="text-rose-500 text-center text-xs mt-2 font-semibold bg-rose-500/5 p-3 rounded-xl border border-rose-500/20">
              {trackError}
            </p>
          )}

          {trackedOrder && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-6 p-4 rounded-xl border ${darkMode ? "bg-gray-900/60 border-gray-800" : "bg-gray-50 border-gray-100"}`}
            >
              <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800 mb-4">
                <div>
                  <span className="text-[10px] text-gray-400 block">رقم التتبع</span>
                  <span className="text-sm font-black font-mono text-rose-500">{trackedOrder.id}</span>
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-gray-400 block">الزبون</span>
                  <span className="text-xs font-bold">{trackedOrder.customerName}</span>
                </div>
              </div>

              {/* Realtime visual stepper */}
              <div className="relative flex justify-between items-center py-6">
                {/* Horizontal line */}
                <div className="absolute left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 -z-10" />
                <div 
                  className="absolute left-0 h-1 bg-gradient-to-r from-amber-500 to-rose-500 -z-10 transition-all duration-500" 
                  style={{ 
                    right: `${100 - (getStatusStep(trackedOrder.status) / 3) * 100}%` 
                  }} 
                />

                {/* Steps */}
                {["Pending", "Processing", "Shipped", "Delivered"].map((statusStep, idx) => {
                  const currentIdx = getStatusStep(trackedOrder.status);
                  const isCompleted = idx <= currentIdx;
                  const isActive = idx === currentIdx;

                  return (
                    <div key={statusStep} className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 transition duration-300 ${
                        isCompleted 
                          ? "bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-500/20" 
                          : darkMode ? "bg-gray-900 border-gray-700 text-gray-500" : "bg-white border-gray-200 text-gray-400"
                      } ${isActive ? "ring-4 ring-rose-500/20 scale-110" : ""}`}>
                        {idx + 1}
                      </div>
                      <span className={`text-[10px] font-bold mt-2 ${
                        isCompleted ? "text-rose-500" : "text-gray-400"
                      }`}>
                        {getStatusTextArabic(statusStep as OrderStatus)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Details breakdown */}
              <div className="text-right mt-4 space-y-1.5 pt-3 border-t border-gray-200 dark:border-gray-800">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">حالة الطلب:</span>
                  <span className="font-bold text-rose-500">{getStatusTextArabic(trackedOrder.status)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">طريقة الدفع/الطلب:</span>
                  <span className="font-bold text-gray-600 dark:text-gray-300">
                    {trackedOrder.orderMethod === "Cart" ? "طلب داخلي مباشر" : trackedOrder.orderMethod === "WhatsApp" ? "طلب عبر واتساب" : "عبر تيك توك"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">العنوان:</span>
                  <span className="font-bold text-gray-600 dark:text-gray-300">{trackedOrder.customerAddress}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">المجموع الكلي:</span>
                  <span className="font-extrabold text-rose-500">{trackedOrder.totalAmount.toLocaleString()} د.ع</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className={`py-12 border-t text-xs text-gray-400 transition-colors ${darkMode ? "border-gray-900 bg-gray-950 text-gray-400" : "border-gray-100 bg-white text-gray-600"}`}>
        <div className="max-w-7xl mx-auto px-4 space-y-6">
          <div className="flex flex-col items-center justify-center gap-2">
            <h4 className="text-sm font-black bg-gradient-to-l from-rose-600 to-amber-500 bg-clip-text text-transparent">
              {settings.storeName || "Fad Zone"}
            </h4>
            <p className="max-w-md mx-auto px-4 leading-relaxed text-[10px] text-gray-400">
              موقع فاشن متكامل يخدم العراق بالكامل. تسوق بكل راحة مع طرق الدفع والتوصيل السهلة والمضمونة.
            </p>
          </div>

          {/* Contact Details & Policies */}
          <div className="flex flex-col items-center gap-4 border-y border-gray-150 dark:border-gray-900 py-6 max-w-2xl mx-auto text-[11px] text-gray-500 dark:text-gray-400">
            {(settings.contactPhone || settings.contactEmail || settings.contactAddress) && (
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-2 font-medium">
                {settings.contactPhone && <p className="flex items-center gap-1"><span>📞 هاتف:</span> <span dir="ltr">{settings.contactPhone}</span></p>}
                {settings.contactEmail && <p className="flex items-center gap-1"><span>📧 البريد:</span> <span>{settings.contactEmail}</span></p>}
                {settings.contactAddress && <p className="flex items-center gap-1"><span>📍 العنوان:</span> <span>{settings.contactAddress}</span></p>}
              </div>
            )}

            {/* Policy Buttons */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-rose-500 font-bold">
              {settings.shippingInfo && (
                <button type="button" onClick={() => openPolicyModal("معلومات الشحن والتوصيل", settings.shippingInfo || "")} className="hover:underline hover:text-rose-600 cursor-pointer transition">سياسة الشحن</button>
              )}
              {settings.returnPolicy && (
                <button type="button" onClick={() => openPolicyModal("سياسة الاستبدال والاسترجاع", settings.returnPolicy || "")} className="hover:underline hover:text-rose-600 cursor-pointer transition">سياسة الاسترجاع</button>
              )}
              {settings.privacyPolicy && (
                <button type="button" onClick={() => openPolicyModal("سياسة الخصوصية وسرية المعلومات", settings.privacyPolicy || "")} className="hover:underline hover:text-rose-600 cursor-pointer transition">سياسة الخصوصية</button>
              )}
            </div>

            {/* Social Media Links */}
            {(settings.instagramLink || settings.facebookLink || settings.snapchatLink || settings.tiktokLink) && (
              <div className="flex justify-center gap-4 mt-1">
                {settings.instagramLink && (
                  <a href={settings.instagramLink} target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded bg-rose-500/10 text-rose-500 font-bold hover:bg-rose-500/20 transition">إنستغرام</a>
                )}
                {settings.facebookLink && (
                  <a href={settings.facebookLink} target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-500 font-bold hover:bg-blue-500/20 transition">فيسبوك</a>
                )}
                {settings.snapchatLink && (
                  <a href={settings.snapchatLink} target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-500 font-bold hover:bg-amber-500/20 transition">سناب شات</a>
                )}
                {settings.tiktokLink && (
                  <a href={settings.tiktokLink} target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded bg-gray-500/10 text-gray-500 dark:text-gray-300 font-bold hover:bg-gray-500/20 transition">تيك توك</a>
                )}
              </div>
            )}
          </div>

          <p className="font-bold text-gray-500 text-[10px]">{settings.storeName || "Fad Zone"} © {new Date().getFullYear()} - جميع الحقوق محفوظة</p>
        </div>
      </footer>

      {/* ----------------- MODAL: PRODUCT DETAILS ----------------- */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border ${
                darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-100 text-gray-900"
              }`}
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 left-4 z-10 p-2.5 rounded-xl bg-black/40 hover:bg-black/60 text-white transition backdrop-blur-sm shadow-md"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Product Images Slider */}
                <div className="relative aspect-square bg-gray-50 dark:bg-gray-950 flex items-center justify-center overflow-hidden">
                  <img 
                    src={selectedProduct.images[detailImageIdx]} 
                    alt={selectedProduct.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />

                  {/* Slider controls if there are multiple images */}
                  {selectedProduct.images.length > 1 && (
                    <>
                      <button 
                        onClick={() => setDetailImageIdx(prev => (prev === 0 ? selectedProduct.images.length - 1 : prev - 1))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/75 dark:bg-gray-900/75 hover:bg-white text-gray-800 dark:text-white transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDetailImageIdx(prev => (prev === selectedProduct.images.length - 1 ? 0 : prev + 1))}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/75 dark:bg-gray-900/75 hover:bg-white text-gray-800 dark:text-white transition"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {/* Dots */}
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                        {selectedProduct.images.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setDetailImageIdx(idx)}
                            className={`w-2 h-2 rounded-full transition-all duration-200 ${
                              detailImageIdx === idx ? "bg-rose-500 w-4" : "bg-gray-300 dark:bg-gray-700"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-6 sm:p-8 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-rose-500 mb-1 block">{selectedProduct.category}</span>
                    <h3 className="text-xl sm:text-2xl font-black">{selectedProduct.title}</h3>
                    
                    {/* Price */}
                    <div className="my-4">
                      <span className="text-2xl font-extrabold text-rose-500">
                        {selectedProduct.price.toLocaleString()} <span className="text-sm font-medium text-gray-500 dark:text-gray-400">د.ع</span>
                      </span>
                    </div>

                    <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed mb-6">
                      {selectedProduct.description}
                    </p>

                    {/* Stock Status */}
                    <div className="flex items-center gap-2 mb-6">
                      <span className="text-xs font-semibold">حالة التوفر:</span>
                      {selectedProduct.stock <= 0 ? (
                        <span className="text-xs font-bold text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-full">نفذ من المخزن</span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full">متوفر في المخزن ({selectedProduct.stock})</span>
                      )}
                    </div>
                  </div>

                  {/* Add to Cart Actions */}
                  {selectedProduct.stock > 0 && (
                    <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                      {/* Quantity Selector */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">الكمية المطلوبة:</span>
                        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                          <button 
                            onClick={() => setDetailQuantity(q => Math.max(1, q - 1))}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="px-4 text-sm font-extrabold font-mono w-10 text-center">{detailQuantity}</span>
                          <button 
                            onClick={() => setDetailQuantity(q => Math.min(selectedProduct.stock, q + 1))}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Add Button */}
                      <button
                        onClick={() => addToCart(selectedProduct, detailQuantity)}
                        className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-xl shadow-lg shadow-rose-500/25 transition duration-200 flex items-center justify-center gap-2 text-sm"
                      >
                        <ShoppingBag className="w-4.5 h-4.5" />
                        إضافة إلى سلة التسوق
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- DRAWER: CART SIDEBAR (RTL) ----------------- */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={() => setIsCartOpen(false)} />

            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`relative w-full max-w-md h-full flex flex-col justify-between shadow-2xl border-r ${
                darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-100 text-gray-900"
              }`}
            >
              {/* Cart Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5.5 h-5.5 text-rose-500" />
                  <h3 className="font-extrabold text-base">سلة التسوق</h3>
                  <span className="text-xs bg-rose-500/10 text-rose-500 px-2.5 py-1 rounded-full font-bold">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)} قطع
                  </span>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cart Items Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-20">
                    <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-sm font-bold text-gray-500">سلتك فارغة تماماً حالياً</p>
                    <p className="text-xs text-gray-400 mt-1">تصفح المنتجات وأضف ما يعجبك إليها لتطلبها بسهولة!</p>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="mt-6 px-5 py-2.5 bg-rose-500 text-white rounded-xl text-xs font-bold transition duration-200"
                    >
                      مواصلة التسوق
                    </button>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div 
                      key={item.product.id}
                      className={`p-3 rounded-xl border flex gap-3 items-center justify-between ${
                        darkMode ? "bg-gray-900/50 border-gray-800" : "bg-gray-50 border-gray-200/50"
                      }`}
                    >
                      {/* Product details */}
                      <div className="flex gap-3 items-center flex-1">
                        <img 
                          src={item.product.images[0]} 
                          alt={item.product.title}
                          className="w-14 h-14 object-cover rounded-xl"
                          referrerPolicy="no-referrer"
                        />
                        <div className="text-right">
                          <h4 className="font-extrabold text-xs line-clamp-1">{item.product.title}</h4>
                          <span className="text-[10px] text-gray-400 block mt-0.5">{item.product.category}</span>
                          <span className="text-xs font-extrabold text-rose-500 block mt-1">
                            {item.product.price.toLocaleString()} د.ع
                          </span>
                        </div>
                      </div>

                      {/* Quantity Actions */}
                      <div className="flex flex-col items-end gap-2">
                        {/* Remove button */}
                        <button 
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-gray-400 hover:text-rose-500 transition p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>

                        {/* Adjuster */}
                        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-950">
                          <button 
                            onClick={() => updateCartQuantity(item.product.id, -1)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-black font-mono w-6 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateCartQuantity(item.product.id, 1)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Footer Summary */}
              {cart.length > 0 && (
                <div className={`p-4 border-t ${darkMode ? "bg-gray-950 border-gray-800" : "bg-gray-50 border-gray-200"}`}>
                  {/* Coupon section */}
                  <div className="mb-4">
                    <label className="text-[10px] font-bold text-gray-400 block mb-1.5">هل لديك كوبون خصم؟</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="مثال: FAD10"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className={`flex-1 text-xs px-3 py-2 rounded-lg border focus:outline-none uppercase ${
                          darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200"
                        }`}
                      />
                      <button 
                        onClick={handleApplyCoupon}
                        className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 rounded-lg text-xs font-bold transition duration-200"
                      >
                        تطبيق
                      </button>
                    </div>
                    {couponError && <p className="text-rose-500 text-[10px] mt-1 font-bold">{couponError}</p>}
                    {couponSuccess && <p className="text-emerald-500 text-[10px] mt-1 font-bold">{couponSuccess}</p>}
                  </div>

                  {/* Pricing lines */}
                  <div className="space-y-2 border-t pt-3 border-gray-200 dark:border-gray-800 text-xs text-right">
                    <div className="flex justify-between">
                      <span className="text-gray-400">المجموع الفرعي:</span>
                      <span className="font-extrabold">{getSubtotal().toLocaleString()} د.ع</span>
                    </div>
                    {appliedCoupon && (
                      <div className="flex justify-between text-emerald-500">
                        <span>الخصم ({appliedCoupon.code}):</span>
                        <span className="font-extrabold">- {getDiscountAmount().toLocaleString()} د.ع</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-2 border-t border-dashed border-gray-200 dark:border-gray-800">
                      <span className="font-black">المجموع الكلي:</span>
                      <span className="font-black text-rose-500 text-base">{getTotalAmount().toLocaleString()} د.ع</span>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <button 
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsCheckoutOpen(true);
                      setPlacedOrder(null);
                    }}
                    className="w-full mt-4 py-3.5 bg-gradient-to-l from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-extrabold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
                  >
                    متابعة الطلب والشحن
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- MODAL: CHECKOUT & SUCCESS SCREEN ----------------- */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border p-6 sm:p-8 relative ${
                darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-100 text-gray-900"
              }`}
            >
              {/* Close button */}
              <button 
                onClick={() => setIsCheckoutOpen(false)}
                className="absolute top-4 left-4 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X className="w-5 h-5" />
              </button>

              {placedOrder ? (
                /* Success Screen */
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/15 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>
                  <h3 className="text-2xl font-black text-emerald-500">تم تسجيل طلبك بنجاح!</h3>
                  <p className="text-xs text-gray-400">شكراً لتسوقك من Fad Zone. تم إرسال معلومات طلبك وتفاصيله بنجاح.</p>
                  
                  <div className={`p-4 rounded-xl border max-w-xs mx-auto text-center ${
                    darkMode ? "bg-gray-950 border-gray-800" : "bg-gray-50 border-gray-100"
                  }`}>
                    <span className="text-[10px] text-gray-400 block uppercase">رقم تتبع طلبك</span>
                    <span className="text-lg font-black text-rose-500 font-mono tracking-wide">{placedOrder.id}</span>
                  </div>

                  <p className="text-xs text-gray-400">يرجى حفظ كود التتبع أعلاه لتتمكن من تتبع حالة طلبك في الشحن لاحقاً.</p>

                  <div className="pt-4 flex flex-col gap-2">
                    <button 
                      onClick={() => setIsCheckoutOpen(false)}
                      className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-xs rounded-xl hover:opacity-90"
                    >
                      العودة للمتجر
                    </button>
                  </div>
                </div>
              ) : (
                /* Form Screen */
                <div>
                  <h3 className="text-xl font-black mb-1">معلومات الشحن وتأكيد الطلب</h3>
                  <p className="text-xs text-gray-400 mb-6">يرجى إدخال معلومات التوصيل الصحيحة لضمان وصول طلبك بأسرع وقت.</p>

                  <form onSubmit={handleConfirmOrder} className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="text-xs font-bold block mb-1">الاسم الكامل للزبون *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="الاسم الثلاثي واللقب"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className={`w-full text-xs px-4 py-3 rounded-xl border focus:outline-none focus:border-rose-500 ${
                          darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                        }`}
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="text-xs font-bold block mb-1">رقم الهاتف الفعال للتوصيل *</label>
                      <input 
                        type="tel" 
                        required
                        placeholder="مثال: 077XXXXXXXX"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className={`w-full text-xs px-4 py-3 rounded-xl border focus:outline-none focus:border-rose-500 text-right ${
                          darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                        }`}
                      />
                    </div>

                    {/* Address */}
                    <div>
                      <label className="text-xs font-bold block mb-1">عنوان التوصيل بالتفصيل *</label>
                      <textarea 
                        required
                        rows={3}
                        placeholder="المحافظة، المنطقة، أقرب نقطة دالة..."
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        className={`w-full text-xs px-4 py-3 rounded-xl border focus:outline-none focus:border-rose-500 ${
                          darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                        }`}
                      />
                    </div>

                    {/* Order Method Options */}
                    <div>
                      <label className="text-xs font-bold block mb-2">طريقة تأكيد وإرسال الطلب:</label>
                      <div className="grid grid-cols-1 gap-2">
                        {settings.enableCart && (
                          <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                            selectedOrderMethod === "Cart"
                              ? "border-rose-500 bg-rose-500/5 text-rose-500"
                              : darkMode ? "bg-gray-950 border-gray-800" : "bg-gray-50 border-gray-200"
                          }`}>
                            <div className="flex items-center gap-2">
                              <input 
                                type="radio" 
                                name="method" 
                                checked={selectedOrderMethod === "Cart"}
                                onChange={() => setSelectedOrderMethod("Cart")}
                                className="accent-rose-500"
                              />
                              <span className="text-xs font-bold">تأكيد داخلي مباشر في المتجر</span>
                            </div>
                            <span className="text-[10px] text-gray-400">تتبع الطلب بالمتجر</span>
                          </label>
                        )}

                        {settings.enableWhatsApp && (
                          <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                            selectedOrderMethod === "WhatsApp"
                              ? "border-emerald-500 bg-emerald-500/5 text-emerald-500"
                              : darkMode ? "bg-gray-950 border-gray-800" : "bg-gray-50 border-gray-200"
                          }`}>
                            <div className="flex items-center gap-2">
                              <input 
                                type="radio" 
                                name="method" 
                                checked={selectedOrderMethod === "WhatsApp"}
                                onChange={() => setSelectedOrderMethod("WhatsApp")}
                                className="accent-emerald-500"
                              />
                              <span className="text-xs font-bold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <Phone className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                                إرسال وتأكيد عبر واتساب
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400">رابط مباشر للمسؤول</span>
                          </label>
                        )}

                        {settings.enableTikTok && (
                          <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                            selectedOrderMethod === "TikTok"
                              ? "border-sky-500 bg-sky-500/5 text-sky-500"
                              : darkMode ? "bg-gray-950 border-gray-800" : "bg-gray-50 border-gray-200"
                          }`}>
                            <div className="flex items-center gap-2">
                              <input 
                                type="radio" 
                                name="method" 
                                checked={selectedOrderMethod === "TikTok"}
                                onChange={() => setSelectedOrderMethod("TikTok")}
                                className="accent-sky-500"
                              />
                              <span className="text-xs font-bold flex items-center gap-1 text-sky-600 dark:text-sky-400">
                                <Send className="w-3.5 h-3.5 text-sky-500" />
                                الطلب والتواصل عبر تيك توك
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400">صفحة تيك توك الرسمية</span>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Order summary display */}
                    <div className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                      darkMode ? "bg-gray-950 border-gray-800" : "bg-gray-50 border-gray-100"
                    }`}>
                      <div className="flex justify-between">
                        <span className="text-gray-400">مجموع سلة التسوق:</span>
                        <span className="font-extrabold">{getTotalAmount().toLocaleString()} د.ع</span>
                      </div>
                      <div className="flex justify-between text-rose-500 font-bold">
                        <span>سعر خدمة التوصيل:</span>
                        <span>مجااااني</span>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button 
                      type="submit" 
                      disabled={checkoutLoading}
                      id="checkout-confirm-btn"
                      className="w-full py-4 bg-gradient-to-l from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white text-sm font-extrabold rounded-xl shadow-lg transition duration-200 disabled:opacity-50"
                    >
                      {checkoutLoading ? "جاري تسجيل طلبك..." : "تأكيد الطلب نهائياً"}
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- MODAL: POLICY DIALOG ----------------- */}
      <AnimatePresence>
        {isPolicyModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border p-6 sm:p-8 relative ${
                darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-100 text-gray-900"
              }`}
            >
              {/* Close Button */}
              <button 
                onClick={() => setIsPolicyModalOpen(false)}
                className="absolute top-4 left-4 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-black mb-1 border-b pb-3 border-gray-200 dark:border-gray-800 text-right">
                {policyModalTitle}
              </h3>

              <div className="mt-4 text-xs leading-relaxed text-right whitespace-pre-line max-h-96 overflow-y-auto pr-1">
                {policyModalContent}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
