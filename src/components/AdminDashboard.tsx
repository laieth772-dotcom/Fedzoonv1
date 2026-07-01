import React, { useState, useEffect, useRef } from "react";
import { 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Tag, 
  Sliders, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Volume2, 
  VolumeX, 
  LogOut, 
  Phone, 
  Send, 
  Bell, 
  Upload, 
  X, 
  Search, 
  Eye, 
  EyeOff,
  Lock,
  Filter,
  Check,
  Package,
  Settings as SettingsIcon,
  ChevronLeft,
  Copy,
  Users
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy
} from "firebase/firestore";
import { signOut, updatePassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { Product, Order, Coupon, Settings, OrderStatus } from "../types";
import { compressImage } from "../utils/image";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

// Local audio synthesizer for notification chime (zero dependencies, 100% reliable)
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playNote = (freq: number, start: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    playNote(523.25, audioCtx.currentTime, 0.15); // C5
    playNote(659.25, audioCtx.currentTime + 0.12, 0.35); // E5
  } catch (err) {
    console.error("Audio playback blocked or failed:", err);
  }
}

interface AdminDashboardProps {
  darkMode: boolean;
  onLogout?: () => void;
}

export default function AdminDashboard({ darkMode, onLogout }: AdminDashboardProps) {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"orders" | "products" | "coupons" | "settings" | "customers">("orders");

  // Real-time Collections Data
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [settings, setSettings] = useState<Settings>({
    whatsappNumber: "+9647700000000",
    tiktokLink: "https://www.tiktok.com",
    enableCart: true,
    enableWhatsApp: true,
    enableTikTok: true,
    updatedAt: new Date().toISOString()
  });

  // Filters & Search
  const [orderFilter, setOrderFilter] = useState<"All" | OrderStatus>("All");
  const [productSearch, setProductSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);

  // Derived Customers list based on orders
  const customersList = React.useMemo(() => {
    const map = new Map<string, {
      name: string;
      phone: string;
      address: string;
      ordersCount: number;
      totalSpend: number;
      orders: Order[];
    }>();

    orders.forEach((order) => {
      const phone = order.customerPhone ? order.customerPhone.trim() : "";
      if (!phone) return;
      const existing = map.get(phone);
      if (existing) {
        existing.ordersCount += 1;
        existing.totalSpend += order.totalAmount;
        existing.orders.push(order);
      } else {
        map.set(phone, {
          name: order.customerName || "زبون مجهول",
          phone: phone,
          address: order.customerAddress || "لا يوجد عنوان",
          ordersCount: 1,
          totalSpend: order.totalAmount,
          orders: [order]
        });
      }
    });

    const list = Array.from(map.values());
    
    // Apply search filter
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      return list.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.phone.includes(q) || 
        c.address.toLowerCase().includes(q)
      );
    }

    return list;
  }, [orders, customerSearch]);

  // Analytics States
  const [analyticsDays, setAnalyticsDays] = useState<7 | 14 | 30>(7);
  const [analyticsType, setAnalyticsType] = useState<"revenue" | "volume">("revenue");

  // Notification states
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevOrdersCountRef = useRef<number | null>(null);

  // Forms / Modals States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodTitle, setProdTitle] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodCompareAtPrice, setProdCompareAtPrice] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodCategory, setProdCategory] = useState("ملابس");
  const [prodStock, setProdStock] = useState("");
  const [prodIsFeatured, setProdIsFeatured] = useState(false);
  const [prodIsDisabled, setProdIsDisabled] = useState(false);
  const [prodImages, setProdImages] = useState<string[]>([]);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  // Coupon Form States
  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState<"percentage" | "fixed">("percentage");
  const [couponValue, setCouponValue] = useState("");
  const [isSubmittingCoupon, setIsSubmittingCoupon] = useState(false);

  // Change Password States
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState("");
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [showDashboardPassword, setShowDashboardPassword] = useState(false);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError("");
    setPasswordChangeSuccess("");

    if (newPassword.length < 6) {
      setPasswordChangeError("يجب أن تكون كلمة المرور 6 أحرف على الأقل.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError("كلمات المرور غير متطابقة.");
      return;
    }

    setPasswordChangeLoading(true);
    try {
      localStorage.setItem("fad_zone_admin_custom_password", newPassword);
      setPasswordChangeSuccess("تم تحديث كلمة المرور المحلية للإدارة بنجاح!");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      console.error("Error updating local password: ", err);
      setPasswordChangeError("حدث خطأ أثناء حفظ كلمة المرور المحلية.");
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  // Detailed view of an order
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // 15-Minute Inactivity Auto-Logout
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 15 minutes = 900,000 milliseconds
      timeoutId = setTimeout(() => {
        handleLogout();
        alert("تم تسجيل الخروج تلقائياً للمحافظة على أمان الجلسة بسبب عدم النشاط لـ 15 دقيقة.");
      }, 900000);
    };

    // Tracking activity listeners
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer);

    // Initial trigger
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("scroll", resetTimer);
    };
  }, []);

  // Realtime Listeners with Firestore
  useEffect(() => {
    // 1. Listen to Orders (Order descending by createdAt)
    const ordersQuery = query(collection(db, "orders"));
    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Order);
      });
      // Sort manually because of potential complex indices in Firestore query
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Real-time sound trigger when a new order is received
      if (prevOrdersCountRef.current !== null && list.length > prevOrdersCountRef.current) {
        // Find if there are indeed more "Pending" orders
        const pendingCount = list.filter(o => o.status === "Pending").length;
        if (soundEnabled) {
          playNotificationSound();
        }
        // Update unread count
        setUnreadCount(prev => prev + (list.length - (prevOrdersCountRef.current || 0)));
      }
      
      prevOrdersCountRef.current = list.length;
      setOrders(list);
    });

    // 2. Listen to Products
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const list: Product[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });
      setProducts(list);
    });

    // 3. Listen to Coupons
    const unsubCoupons = onSnapshot(collection(db, "coupons"), (snapshot) => {
      const list: Coupon[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Coupon);
      });
      setCoupons(list);
    });

    // 4. Fetch general Settings
    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, "settings", "general"));
      if (docSnap.exists()) {
        setSettings(docSnap.data() as Settings);
      }
    };
    fetchSettings();

    return () => {
      unsubOrders();
      unsubProducts();
      unsubCoupons();
    };
  }, [soundEnabled]);

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await signOut(auth);
    }
  };

  // Sound manual trigger test
  const triggerTestSound = () => {
    playNotificationSound();
  };

  // Filtered orders list
  const filteredOrders = orders.filter(order => {
    const matchesFilter = orderFilter === "All" ? true : order.status === orderFilter;
    const matchesSearch = orderSearch.trim() === "" ? true : (
      order.customerName.toLowerCase().includes(orderSearch.toLowerCase()) ||
      order.customerPhone.includes(orderSearch) ||
      order.id.toLowerCase().includes(orderSearch.toLowerCase())
    );
    return matchesFilter && matchesSearch;
  });

  // Filtered products list
  const filteredProducts = products.filter(product => {
    return productSearch.trim() === "" ? true : (
      product.title.toLowerCase().includes(productSearch.toLowerCase()) ||
      product.category.toLowerCase().includes(productSearch.toLowerCase())
    );
  });

  // Metrics computation
  const totalSales = orders
    .filter(o => o.status === "Delivered" || o.status === "Shipped" || o.status === "Processing")
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const pendingOrdersCount = orders.filter(o => o.status === "Pending").length;

  // Compute daily sales trend data for the store owner
  const trendData = React.useMemo(() => {
    const result: { date: string; formattedDate: string; revenue: number; volume: number }[] = [];
    
    // Generate the last N days with zero defaults to maintain continuity
    for (let i = analyticsDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD
      
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const formattedDate = `${month}/${day}`;
      
      result.push({
        date: dateStr,
        formattedDate,
        revenue: 0,
        volume: 0
      });
    }
    
    // Aggregate revenue and volume
    orders.forEach(order => {
      if (!order.createdAt) return;
      // Extract date string YYYY-MM-DD
      const orderDate = order.createdAt.split("T")[0];
      
      // We count processing, shipped, and delivered orders as valid completed/ongoing revenue
      const isValidForRevenue = order.status === "Delivered" || order.status === "Shipped" || order.status === "Processing" || order.status === "Pending";
      
      const dayBucket = result.find(r => r.date === orderDate);
      if (dayBucket) {
        dayBucket.volume += 1;
        if (isValidForRevenue) {
          dayBucket.revenue += order.totalAmount;
        }
      }
    });
    
    return result;
  }, [orders, analyticsDays]);

  // Custom styling for Tooltip matching our dashboard aesthetic
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`p-3.5 rounded-xl border text-xs shadow-xl leading-relaxed ${
          darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-100 text-gray-900"
        }`} dir="rtl">
          <p className="font-extrabold mb-1.5 opacity-80">{payload[0].payload.date}</p>
          {payload.map((pld: any) => (
            <div key={pld.name} className="flex items-center justify-between gap-4 mt-1">
              <div className="flex items-center gap-1.5 text-gray-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pld.color || pld.fill }} />
                <span>{pld.name}:</span>
              </div>
              <span className="font-black text-rose-500 dark:text-rose-400">
                {pld.name === "الإيرادات" 
                  ? `${pld.value.toLocaleString()} د.ع` 
                  : `${pld.value} طلب`}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Change order status action
  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const ordersQuery = query(collection(db, "orders"));
      const querySnap = await getDocs(ordersQuery);
      let firestoreDocId = "";
      
      querySnap.forEach((docSnap) => {
        if (docSnap.data().id === orderId) {
          firestoreDocId = docSnap.id;
        }
      });

      if (firestoreDocId) {
        await updateDoc(doc(db, "orders", firestoreDocId), {
          status: newStatus
        });
        
        // Update selected order view if open
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
        }
      }
    } catch (err) {
      console.error("Error updating order status: ", err);
      alert("حدث خطأ أثناء تعديل حالة الطلب.");
    }
  };

  // Settings Save action
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, "settings", "general"), {
        ...settings,
        updatedAt: new Date().toISOString()
      });
      alert("تم حفظ إعدادات الطلبات وقنوات التواصل الإدارية بنجاح!");
    } catch (err) {
      console.error("Error saving settings: ", err);
      alert("حدث خطأ أثناء حفظ الإعدادات.");
    }
  };

  // Coupon actions
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim() || !couponValue) return;

    setIsSubmittingCoupon(true);
    const codeUpper = couponCode.trim().toUpperCase();

    try {
      const couponData: Coupon = {
        id: codeUpper,
        code: codeUpper,
        type: couponType,
        value: Number(couponValue),
        isActive: true,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "coupons", codeUpper), couponData);
      setCouponCode("");
      setCouponValue("");
      alert("تم إنشاء كوبون الخصم بنجاح!");
    } catch (err) {
      console.error("Error creating coupon: ", err);
      alert("حدث خطأ أثناء إنشاء الكوبون.");
    } finally {
      setIsSubmittingCoupon(false);
    }
  };

  const toggleCouponStatus = async (couponId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "coupons", couponId), {
        isActive: !currentStatus
      });
    } catch (err) {
      console.error("Error toggling coupon status: ", err);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا الكوبون نهائياً؟")) return;
    try {
      await deleteDoc(doc(db, "coupons", couponId));
    } catch (err) {
      console.error("Error deleting coupon: ", err);
    }
  };

  // Image addition helper (Local File to Base64 with compression)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === "string") {
          try {
            const compressed = await compressImage(reader.result, 800, 800, 0.75);
            setProdImages(prev => [...prev, compressed]);
          } catch (err) {
            console.error("Image compression failed, using original: ", err);
            setProdImages(prev => [...prev, reader.result as string]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeSelectedImage = (index: number) => {
    setProdImages(prev => prev.filter((_, i) => i !== index));
  };

  // Product Add/Edit actions
  const handleOpenProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProdTitle(product.title);
      setProdPrice(product.price.toString());
      setProdCompareAtPrice(product.compareAtPrice ? product.compareAtPrice.toString() : "");
      setProdDesc(product.description);
      setProdCategory(product.category);
      setProdStock(product.stock.toString());
      setProdIsFeatured(!!product.isFeatured);
      setProdIsDisabled(!!product.isDisabled);
      setProdImages(product.images);
    } else {
      setEditingProduct(null);
      setProdTitle("");
      setProdPrice("");
      setProdCompareAtPrice("");
      setProdDesc("");
      setProdCategory("ملابس");
      setProdStock("");
      setProdIsFeatured(false);
      setProdIsDisabled(false);
      setProdImages([]);
    }
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodTitle.trim() || !prodPrice || !prodDesc.trim() || !prodStock || prodImages.length === 0) {
      alert("يرجى ملء جميع الحقول المطلوبة وإضافة صورة واحدة على الأقل!");
      return;
    }

    setIsSubmittingProduct(true);
    const id = editingProduct ? editingProduct.id : `prod-${Date.now()}`;
    const productData: Product = {
      id,
      title: prodTitle.trim(),
      price: Number(prodPrice),
      compareAtPrice: prodCompareAtPrice ? Number(prodCompareAtPrice) : undefined,
      description: prodDesc.trim(),
      category: prodCategory,
      stock: Number(prodStock),
      images: prodImages,
      isFeatured: prodIsFeatured,
      isDisabled: prodIsDisabled,
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "products", id), productData);
      setIsProductModalOpen(false);
      alert(editingProduct ? "تم تحديث المنتج بنجاح!" : "تمت إضافة المنتج الجديد للمتجر بنجاح!");
    } catch (err) {
      console.error("Error saving product: ", err);
      alert("حدث خطأ أثناء حفظ المنتج.");
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const handleDuplicateProduct = async (product: Product) => {
    try {
      const newId = `prod-${Date.now()}`;
      const duplicatedProduct: Product = {
        ...product,
        id: newId,
        title: `${product.title} (نسخة)`,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, "products", newId), duplicatedProduct);
      alert(`تم تكرار المنتج "${product.title}" بنجاح!`);
    } catch (err) {
      console.error("Error duplicating product: ", err);
      alert("حدث خطأ أثناء تكرار المنتج.");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا المنتج من المتجر نهائياً؟")) return;
    try {
      await deleteDoc(doc(db, "products", productId));
      alert("تم حذف المنتج من المتجر بنجاح.");
    } catch (err) {
      console.error("Error deleting product: ", err);
      alert("حدث خطأ أثناء حذف المنتج.");
    }
  };

  return (
    <div className={`min-h-screen pb-20 ${darkMode ? "dark-mode" : "bg-[#fcfcfd]"}`} dir="rtl">
      {/* Admin Navbar */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md ${
        darkMode ? "bg-gray-950/90 border-gray-800 text-white" : "bg-white/90 border-gray-100 text-gray-900"
      }`}>
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          
          {/* Logo & Status */}
          <div className="flex items-center gap-2">
            <span className="p-2 bg-rose-500 text-white rounded-xl shadow-md">
              <Sliders className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-black bg-gradient-to-l from-rose-500 to-amber-500 bg-clip-text text-transparent">لوحة إدارة Fad Zone</h2>
              <p className="text-[10px] text-gray-400 font-bold -mt-1">نظام إدارة ومتابعة الطلبات المباشر</p>
            </div>
          </div>

          {/* Quick Notification Settings and Logout */}
          <div className="flex items-center gap-3">
            {/* Sound alert configuration toggle */}
            <button 
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if(!soundEnabled) triggerTestSound();
              }}
              className={`p-2 rounded-lg border transition ${
                soundEnabled 
                  ? "bg-rose-50 border-rose-200 text-rose-500 dark:bg-rose-950/20 dark:border-rose-900/30" 
                  : "bg-gray-100 border-gray-200 text-gray-400 dark:bg-gray-900 dark:border-gray-800"
              }`}
              title={soundEnabled ? "التنبيهات الصوتية مفعلة" : "التنبيهات الصوتية معطلة"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Visual orders alert badge */}
            <button 
              onClick={() => { setUnreadCount(0); setActiveTab("orders"); }}
              className="relative p-2 rounded-lg border border-gray-200 dark:border-gray-800"
            >
              <Bell className="w-4 h-4 text-gray-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center pulse-red">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Logout */}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition-colors duration-150"
            >
              <LogOut className="w-3.5 h-3.5" />
              خروج
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6">
        
        {/* TOP LEVEL METRICS SUMMARY */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Sales Card */}
          <div className={`p-4 rounded-2xl border transition-colors ${darkMode ? "bg-gray-900/40 border-gray-800" : "bg-white border-gray-100 shadow-sm"}`}>
            <div className="flex justify-between items-center text-gray-400 mb-1">
              <span className="text-[11px] font-bold">المبيعات الإجمالية</span>
              <DollarSign className="w-4.5 h-4.5 text-emerald-500" />
            </div>
            <h4 className="text-lg sm:text-2xl font-black text-emerald-500">
              {totalSales.toLocaleString()} <span className="text-xs font-normal text-gray-400">د.ع</span>
            </h4>
            <p className="text-[10px] text-gray-400 mt-1">من الطلبات المقبولة والمشحونة</p>
          </div>

          {/* Pending Orders Card */}
          <div className={`p-4 rounded-2xl border transition-colors ${darkMode ? "bg-gray-900/40 border-gray-800" : "bg-white border-gray-100 shadow-sm"}`}>
            <div className="flex justify-between items-center text-gray-400 mb-1">
              <span className="text-[11px] font-bold">طلبات بانتظار الموافقة</span>
              <AlertCircle className="w-4.5 h-4.5 text-rose-500" />
            </div>
            <h4 className={`text-lg sm:text-2xl font-black ${pendingOrdersCount > 0 ? "text-rose-500" : "text-gray-400"}`}>
              {pendingOrdersCount} <span className="text-xs font-normal text-gray-400">طلب</span>
            </h4>
            <p className="text-[10px] text-gray-400 mt-1">تتطلب مراجعة وتأكيد عاجل</p>
          </div>

          {/* Products Count Card */}
          <div className={`p-4 rounded-2xl border transition-colors ${darkMode ? "bg-gray-900/40 border-gray-800" : "bg-white border-gray-100 shadow-sm"}`}>
            <div className="flex justify-between items-center text-gray-400 mb-1">
              <span className="text-[11px] font-bold">إجمالي المنتجات بالمعرض</span>
              <ShoppingBag className="w-4.5 h-4.5 text-amber-500" />
            </div>
            <h4 className="text-lg sm:text-2xl font-black text-amber-500">
              {products.length} <span className="text-xs font-normal text-gray-400">صنف</span>
            </h4>
            <p className="text-[10px] text-gray-400 mt-1">منتجات معروضة على الزوار</p>
          </div>

          {/* Coupons Count Card */}
          <div className={`p-4 rounded-2xl border transition-colors ${darkMode ? "bg-gray-900/40 border-gray-800" : "bg-white border-gray-100 shadow-sm"}`}>
            <div className="flex justify-between items-center text-gray-400 mb-1">
              <span className="text-[11px] font-bold">كوبونات الخصم النشطة</span>
              <Tag className="w-4.5 h-4.5 text-indigo-500" />
            </div>
            <h4 className="text-lg sm:text-2xl font-black text-indigo-500">
              {coupons.filter(c => c.isActive).length} <span className="text-xs font-normal text-gray-400">نشط</span>
            </h4>
            <p className="text-[10px] text-gray-400 mt-1">من أصل {coupons.length} كوبون كلي</p>
          </div>
        </section>

        {/* ANALYTICS CHART WIDGET */}
        <section className={`p-6 rounded-3xl border mb-8 transition-all duration-300 ${
          darkMode ? "bg-gray-950/60 border-gray-800" : "bg-white border-gray-100 shadow-xs"
        }`}>
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6" dir="rtl">
            <div className="flex items-center gap-2">
              <span className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black">مؤشرات الأداء وتحليل المبيعات والنشاط</h3>
                <p className="text-[10px] text-gray-400 font-bold">متابعة بيانية لحظية للمبيعات وحجم الطلبات الواردة للمتجر</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              {/* Metric Toggle */}
              <div className="flex rounded-xl bg-gray-100 dark:bg-gray-900/80 p-1 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setAnalyticsType("revenue")}
                  className={`px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                    analyticsType === "revenue"
                      ? "bg-rose-500 text-white shadow-xs"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  }`}
                >
                  الإيرادات اليومية
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsType("volume")}
                  className={`px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                    analyticsType === "volume"
                      ? "bg-rose-500 text-white shadow-xs"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  }`}
                >
                  حجم الطلبات
                </button>
              </div>

              {/* Days Range Toggle */}
              <div className="flex rounded-xl bg-gray-100 dark:bg-gray-900/80 p-1 text-[11px] font-bold">
                {([7, 14, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setAnalyticsDays(days)}
                    className={`px-2.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                      analyticsDays === days
                        ? "bg-gray-900 text-white dark:bg-gray-800"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    }`}
                  >
                    {days === 7 ? "آخر 7 أيام" : days === 14 ? "آخر 14 يوم" : "آخر 30 يوم"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart Display Area */}
          <div className="w-full h-72 sm:h-80" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              {analyticsType === "revenue" ? (
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#f1f5f9"} vertical={false} />
                  <XAxis 
                    dataKey="formattedDate" 
                    stroke={darkMode ? "#64748b" : "#94a3b8"} 
                    fontSize={10} 
                    fontWeight="bold"
                    tickLine={false}
                  />
                  <YAxis 
                    stroke={darkMode ? "#64748b" : "#94a3b8"} 
                    fontSize={10} 
                    fontWeight="bold"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toLocaleString()}k` : val}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: darkMode ? "#334155" : "#cbd5e1", strokeWidth: 1 }} />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    name="الإيرادات" 
                    stroke="#e11d48" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              ) : (
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#f1f5f9"} vertical={false} />
                  <XAxis 
                    dataKey="formattedDate" 
                    stroke={darkMode ? "#64748b" : "#94a3b8"} 
                    fontSize={10} 
                    fontWeight="bold"
                    tickLine={false}
                  />
                  <YAxis 
                    stroke={darkMode ? "#64748b" : "#94a3b8"} 
                    fontSize={10} 
                    fontWeight="bold"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }} />
                  <Bar 
                    dataKey="volume" 
                    name="حجم الطلبات" 
                    fill="#f59e0b" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={45}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        {/* SIDEBAR TABS LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Navigation panel */}
          <nav className="lg:col-span-3 flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
            <button
              onClick={() => setActiveTab("orders")}
              className={`w-full text-right px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-2.5 whitespace-nowrap ${
                activeTab === "orders"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/10"
                  : darkMode ? "bg-gray-900/50 hover:bg-gray-800 text-gray-300" : "bg-white border border-gray-100 hover:bg-gray-50"
              }`}
            >
              <Package className="w-4.5 h-4.5" />
              إدارة الطلبات الواردة
              {pendingOrdersCount > 0 && (
                <span className={`mr-auto px-2 py-0.5 rounded-full text-[9px] font-black ${
                  activeTab === "orders" ? "bg-white text-rose-500" : "bg-rose-500 text-white"
                }`}>
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("products")}
              className={`w-full text-right px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-2.5 whitespace-nowrap ${
                activeTab === "products"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/10"
                  : darkMode ? "bg-gray-900/50 hover:bg-gray-800 text-gray-300" : "bg-white border border-gray-100 hover:bg-gray-50"
              }`}
            >
              <ShoppingBag className="w-4.5 h-4.5" />
              إدارة منتجات المعرض
            </button>

            <button
              onClick={() => setActiveTab("coupons")}
              className={`w-full text-right px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-2.5 whitespace-nowrap ${
                activeTab === "coupons"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/10"
                  : darkMode ? "bg-gray-900/50 hover:bg-gray-800 text-gray-300" : "bg-white border border-gray-100 hover:bg-gray-50"
              }`}
            >
              <Tag className="w-4.5 h-4.5" />
              نظام كوبونات الخصم
            </button>

            <button
              onClick={() => setActiveTab("customers")}
              className={`w-full text-right px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-2.5 whitespace-nowrap ${
                activeTab === "customers"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/10"
                  : darkMode ? "bg-gray-900/50 hover:bg-gray-800 text-gray-300" : "bg-white border border-gray-100 hover:bg-gray-50"
              }`}
            >
              <Users className="w-4.5 h-4.5" />
              قاعدة بيانات الزبائن
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full text-right px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-2.5 whitespace-nowrap ${
                activeTab === "settings"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/10"
                  : darkMode ? "bg-gray-900/50 hover:bg-gray-800 text-gray-300" : "bg-white border border-gray-100 hover:bg-gray-50"
              }`}
            >
              <SettingsIcon className="w-4.5 h-4.5" />
              إعدادات طرق الطلب والتواصل
            </button>
          </nav>

          {/* MAIN CONFIGURATION SCREEN AREA */}
          <section className="lg:col-span-9 space-y-6">
            
            {/* 1. ORDERS CONFIGURATION SECTION */}
            {activeTab === "orders" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                
                {/* Search & Filter Row */}
                <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  darkMode ? "bg-gray-950 border-gray-800" : "bg-white border-gray-100 shadow-sm"
                }`}>
                  {/* Search input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="ابحث باسم الزبون، هاتفه، أو رمز التتبع..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className={`w-full text-xs pr-9 pl-4 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                        darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                      }`}
                    />
                  </div>

                  {/* Filter tabs */}
                  <div className="flex gap-1 overflow-x-auto">
                    {([
                      { id: "All", label: "الكل" },
                      { id: "Pending", label: "قيد الانتظار" },
                      { id: "Processing", label: "قيد التجهيز" },
                      { id: "Shipped", label: "تم الشحن" },
                      { id: "Delivered", label: "تم التوصيل" }
                    ] as const).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setOrderFilter(tab.id)}
                        className={`px-3.5 py-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition duration-150 ${
                          orderFilter === tab.id
                            ? "bg-rose-500 text-white shadow"
                            : darkMode ? "bg-gray-900 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orders Grid / Table */}
                <div className={`border rounded-2xl overflow-hidden ${darkMode ? "border-gray-800 bg-gray-950/40" : "border-gray-100 bg-white shadow-sm"}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className={`font-black ${darkMode ? "bg-gray-900 text-gray-300" : "bg-gray-50 text-gray-500"}`}>
                        <tr>
                          <th className="p-3">رقم التتبع</th>
                          <th className="p-3">الزبون</th>
                          <th className="p-3">الهاتف والمدينة</th>
                          <th className="p-3">قناة الشراء</th>
                          <th className="p-3">القيمة الكلية</th>
                          <th className="p-3">حالة الطلب</th>
                          <th className="p-3 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-gray-400 font-bold">لا يوجد أي طلبات واردة في هذا التصنيف حالياً.</td>
                          </tr>
                        ) : (
                          filteredOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition">
                              <td className="p-3 font-mono font-bold text-rose-500">{order.id}</td>
                              <td className="p-3 font-bold">{order.customerName}</td>
                              <td className="p-3">
                                <div>{order.customerPhone}</div>
                                <div className="text-[10px] text-gray-400 line-clamp-1">{order.customerAddress}</div>
                              </td>
                              <td className="p-3">
                                {order.orderMethod === "Cart" ? (
                                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">سلة المتجر</span>
                                ) : order.orderMethod === "WhatsApp" ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">واتساب المباشر</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-bold">تيك توك</span>
                                )}
                              </td>
                              <td className="p-3 font-extrabold text-rose-500">{order.totalAmount.toLocaleString()} د.ع</td>
                              <td className="p-3">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                  order.status === "Pending" ? "bg-rose-500/10 text-rose-500" :
                                  order.status === "Processing" ? "bg-amber-500/10 text-amber-500" :
                                  order.status === "Shipped" ? "bg-blue-500/10 text-blue-500" :
                                  "bg-emerald-500/10 text-emerald-500"
                                }`}>
                                  {order.status === "Pending" ? "قيد الانتظار" :
                                   order.status === "Processing" ? "قيد التجهيز" :
                                   order.status === "Shipped" ? "تم الشحن" : "تم التوصيل"}
                                </span>
                              </td>
                              <td className="p-3 flex items-center justify-center gap-1">
                                <button 
                                  onClick={() => setSelectedOrder(order)}
                                  className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 transition"
                                  title="عرض التفاصيل"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                
                                {/* Status update wheels */}
                                <select 
                                  value={order.status}
                                  onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                                  className={`text-[10px] font-bold py-1 px-1.5 rounded border focus:outline-none ${
                                    darkMode ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200"
                                  }`}
                                >
                                  <option value="Pending">قيد الانتظار</option>
                                  <option value="Processing">قيد التجهيز</option>
                                  <option value="Shipped">تم الشحن</option>
                                  <option value="Delivered">تم التوصيل</option>
                                </select>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </motion.div>
            )}

            {/* 2. PRODUCTS CONFIGURATION SECTION */}
            {activeTab === "products" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                
                {/* Search & Add product row */}
                <div className="flex flex-col sm:flex-row justify-between gap-4 items-stretch sm:items-center">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="ابحث عن منتج بالاسم أو الفئة..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className={`w-full text-xs pr-9 pl-4 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                        darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200"
                      }`}
                    />
                  </div>

                  <button
                    onClick={() => handleOpenProductModal()}
                    className="px-4 py-2.5 bg-gradient-to-l from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white text-xs font-black rounded-xl transition shadow flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    إضافة منتج جديد للمتجر
                  </button>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.map((product) => (
                    <div 
                      key={product.id}
                      className={`p-3 rounded-2xl border flex flex-col gap-3 justify-between transition-colors ${
                        darkMode ? "bg-gray-900/50 border-gray-800/80" : "bg-white border-gray-100 shadow-sm"
                      } ${product.isDisabled ? "opacity-60" : ""}`}
                    >
                      <div className="flex gap-3 items-center justify-between">
                        {/* Product details preview */}
                        <div className="flex gap-3 items-center flex-1">
                          <img 
                            src={product.images[0]} 
                            alt={product.title}
                            className="w-12 h-12 object-cover rounded-xl shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="text-right">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-extrabold text-xs line-clamp-1">{product.title}</h4>
                              {product.isFeatured && (
                                <span className="bg-amber-500/10 text-amber-500 text-[8px] px-1 rounded font-black">مميز</span>
                              )}
                              {product.isDisabled ? (
                                <span className="bg-gray-500/10 text-gray-500 text-[8px] px-1 rounded font-black">معطل</span>
                              ) : (
                                <span className="bg-emerald-500/10 text-emerald-500 text-[8px] px-1 rounded font-black">نشط</span>
                              )}
                            </div>
                            <span className="text-[10px] text-amber-500 block font-bold mt-0.5">{product.category}</span>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              <span className="text-xs font-extrabold text-rose-500">
                                {product.price.toLocaleString()} د.ع
                              </span>
                              {product.compareAtPrice && product.compareAtPrice > product.price && (
                                <span className="text-[10px] text-gray-400 line-through">
                                  {product.compareAtPrice.toLocaleString()} د.ع
                                </span>
                              )}
                              <span className="text-[9px] text-gray-400 font-medium">| مخزون: {product.stock}</span>
                            </div>
                          </div>
                        </div>

                        {/* Edit / Duplicate / Delete actions */}
                        <div className="flex gap-1 shrink-0">
                          <button 
                            onClick={() => handleOpenProductModal(product)}
                            className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition cursor-pointer"
                            title="تعديل المنتج"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDuplicateProduct(product)}
                            className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition cursor-pointer"
                            title="نسخ وتكرار"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(product.id)}
                            className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition cursor-pointer"
                            title="حذف المنتج"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </motion.div>
            )}

            {/* 3. COUPONS CONFIGURATION SECTION */}
            {activeTab === "coupons" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Coupon addition form */}
                <div className={`md:col-span-5 p-5 rounded-2xl border transition-colors ${
                  darkMode ? "bg-gray-950 border-gray-800" : "bg-white border-gray-100 shadow-sm"
                }`}>
                  <h3 className="text-sm font-black mb-1">إنشاء كوبون خصم جديد</h3>
                  <p className="text-[10px] text-gray-400 mb-4">أضف رمز خصم جديد لتفعيل الخصومات للعملاء في عربة التسوق</p>

                  <form onSubmit={handleCreateCoupon} className="space-y-4 text-xs">
                    <div>
                      <label className="text-[10px] font-bold block mb-1">رمز الكوبون (كود الخصم) *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="مثال: FAD20"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className={`w-full uppercase text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                          darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold block mb-1">نوع الخصم *</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCouponType("percentage")}
                          className={`py-2 rounded-lg text-[10px] font-black border transition ${
                            couponType === "percentage"
                              ? "bg-rose-500 border-rose-500 text-white"
                              : darkMode ? "bg-gray-900 border-gray-800 text-gray-300" : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          خصم مئوي (%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCouponType("fixed")}
                          className={`py-2 rounded-lg text-[10px] font-black border transition ${
                            couponType === "fixed"
                              ? "bg-rose-500 border-rose-500 text-white"
                              : darkMode ? "bg-gray-900 border-gray-800 text-gray-300" : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          مبلغ ثابت (د.ع)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold block mb-1">قيمة الخصم المطلوبة *</label>
                      <input 
                        type="number" 
                        required
                        placeholder={couponType === "percentage" ? "مثال: 15 (يعني 15%)" : "مثال: 5000 (يعني 5,000 د.ع)"}
                        value={couponValue}
                        onChange={(e) => setCouponValue(e.target.value)}
                        className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                          darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                        }`}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingCoupon}
                      className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-xl shadow transition"
                    >
                      {isSubmittingCoupon ? "جاري الإنشاء..." : "حفظ وإنشاء الكوبون"}
                    </button>
                  </form>
                </div>

                {/* Coupons listing view */}
                <div className="md:col-span-7 space-y-3">
                  <h3 className="text-sm font-black">كوبونات الخصم المسجلة</h3>
                  
                  {coupons.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 font-bold text-xs bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                      لا يوجد أي كوبونات خصم مسجلة حالياً.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {coupons.map((coupon) => (
                        <div 
                          key={coupon.id}
                          className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
                            darkMode ? "bg-gray-900/60 border-gray-800" : "bg-white border-gray-100 shadow-sm"
                          }`}
                        >
                          <div>
                            <span className="font-mono font-black text-sm text-rose-500 bg-rose-500/5 px-2 py-1 rounded border border-rose-500/20">{coupon.code}</span>
                            <span className="text-[10px] text-gray-400 font-medium mr-3">
                              الخصم: <span className="font-extrabold text-gray-700 dark:text-gray-200">{
                                coupon.type === "percentage" ? `${coupon.value}%` : `${coupon.value.toLocaleString()} د.ع`
                              }</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Toggle switch */}
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={coupon.isActive} 
                                onChange={() => toggleCouponStatus(coupon.id, coupon.isActive)}
                                className="sr-only peer" 
                              />
                              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500" />
                              <span className="mr-2 text-[10px] font-bold text-gray-400">{coupon.isActive ? "نشط" : "معطل"}</span>
                            </label>

                            <button 
                              onClick={() => handleDeleteCoupon(coupon.id)}
                              className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition"
                              title="حذف الكوبون"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </motion.div>
            )}

            {/* 4. SETTINGS CONFIGURATION SECTION */}
            {activeTab === "settings" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl">
                <div className={`p-6 rounded-2xl border transition-colors ${
                  darkMode ? "bg-gray-950 border-gray-800" : "bg-white border-gray-100 shadow-md"
                }`}>
                  <div className="flex items-center gap-2 mb-6 border-b pb-3 border-gray-200 dark:border-gray-800">
                    <SettingsIcon className="w-5.5 h-5.5 text-rose-500" />
                    <div>
                      <h3 className="text-base font-black">إعدادات طرق الطلب والروابط</h3>
                      <p className="text-[10px] text-gray-400 -mt-0.5">قم بضبط رقم واتساب وقناة تيك توك وتفعيل قنوات الطلب النشطة</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
                    {/* Channel Toggles */}
                    <div className="space-y-3">
                      <label className="text-[11px] font-bold text-gray-400 block">تفعيل وتعطيل قنوات الشراء للزبائن:</label>
                      
                      {/* Direct Cart checkout toggle */}
                      <label className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                        settings.enableCart ? "bg-rose-500/5 border-rose-500/20" : darkMode ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-200"
                      }`}>
                        <div>
                          <span className="font-extrabold block text-xs">تفعيل الطلب والتشيك آوت الداخلي</span>
                          <span className="text-[10px] text-gray-400 mt-0.5 block">يسمح للزبون بملء معلوماته والشراء مباشرة في الموقع لتسجيل الطلب بقاعدة البيانات.</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.enableCart}
                          onChange={(e) => setSettings({ ...settings, enableCart: e.target.checked })}
                          className="w-4.5 h-4.5 accent-rose-500"
                        />
                      </label>

                      {/* WhatsApp Checkout Toggle */}
                      <label className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                        settings.enableWhatsApp ? "bg-emerald-500/5 border-emerald-500/20" : darkMode ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-200"
                      }`}>
                        <div>
                          <span className="font-extrabold block text-xs flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <Phone className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                            تفعيل تأكيد وإرسال الطلبات عبر واتساب
                          </span>
                          <span className="text-[10px] text-gray-400 mt-0.5 block">يقوم بتحويل الزبون إلى رقم الواتساب الخاص بك مع رسالة مجهزة بالتفاصيل والمنتجات للشراء.</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.enableWhatsApp}
                          onChange={(e) => setSettings({ ...settings, enableWhatsApp: e.target.checked })}
                          className="w-4.5 h-4.5 accent-emerald-500"
                        />
                      </label>

                      {/* TikTok Checkout Toggle */}
                      <label className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                        settings.enableTikTok ? "bg-sky-500/5 border-sky-500/20" : darkMode ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-200"
                      }`}>
                        <div>
                          <span className="font-extrabold block text-xs flex items-center gap-1 text-sky-600 dark:text-sky-400">
                            <Send className="w-3.5 h-3.5 text-sky-500" />
                            تفعيل الطلب عبر صفحة تيك توك
                          </span>
                          <span className="text-[10px] text-gray-400 mt-0.5 block">يعرض زراً مخصصاً في عربة التسوق يحيل الزبون للتواصل والطلب عبر حساب تيك توك الخاص بك.</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.enableTikTok}
                          onChange={(e) => setSettings({ ...settings, enableTikTok: e.target.checked })}
                          className="w-4.5 h-4.5 accent-sky-500"
                        />
                      </label>
                    </div>

                     {/* Inputs for Links */}
                    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                      
                      {/* Section: Store Identity */}
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 space-y-3">
                        <span className="font-extrabold text-[11px] block text-rose-500">الهوية البصرية للمتجر</span>
                        
                        <div>
                          <label className="text-[10px] font-bold block mb-1 text-gray-500 dark:text-gray-400">اسم المتجر العام</label>
                          <input 
                            type="text" 
                            placeholder="مثال: متجر فاد زون"
                            value={settings.storeName || ""}
                            onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                            className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                              darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold block mb-1 text-gray-500 dark:text-gray-400">لوغو أو أيقونة المتجر</label>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="text" 
                              placeholder="رابط لوجو المتجر (URL)"
                              value={settings.storeLogo || ""}
                              onChange={(e) => setSettings({ ...settings, storeLogo: e.target.value })}
                              className={`flex-1 text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                                darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                              }`}
                            />
                            <label className="px-3.5 py-2.5 bg-rose-500 text-white font-black rounded-xl hover:bg-rose-600 transition cursor-pointer text-[10px] shrink-0">
                              تحميل اللوجو
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = async () => {
                                      if (typeof reader.result === "string") {
                                        try {
                                          const compressed = await compressImage(reader.result, 400, 400, 0.8);
                                          setSettings({ ...settings, storeLogo: compressed });
                                        } catch (err) {
                                          setSettings({ ...settings, storeLogo: reader.result });
                                        }
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Section: Hero Banner */}
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 space-y-3">
                        <span className="font-extrabold text-[11px] block text-amber-500">لافتة العرض الرئيسية (Hero Banner)</span>
                        
                        <div>
                          <label className="text-[10px] font-bold block mb-1 text-gray-500 dark:text-gray-400">العنوان الترويجي الصغير (Tagline)</label>
                          <input 
                            type="text" 
                            placeholder="مثال: أفضل تشكيلة أزياء لعام 2026"
                            value={settings.heroTagline || ""}
                            onChange={(e) => setSettings({ ...settings, heroTagline: e.target.value })}
                            className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                              darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold block mb-1 text-gray-500 dark:text-gray-400">العنوان الرئيسي الكبير</label>
                          <input 
                            type="text" 
                            placeholder="مثال: تأنق بأحدث خطوط موضة العصر مع فاد زون"
                            value={settings.heroTitle || ""}
                            onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
                            className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                              darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold block mb-1 text-gray-500 dark:text-gray-400">الوصف الفرعي لافتة العرض</label>
                          <textarea 
                            rows={2}
                            placeholder="مثال: تصفح تشكيلة حصرية من الهوديات الفاخرة، الساعات الرياضية الذكية..."
                            value={settings.heroSubtitle || ""}
                            onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
                            className={`w-full text-xs px-3.5 py-2 rounded-xl border focus:outline-none focus:border-rose-500 ${
                              darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold block mb-1 text-gray-500 dark:text-gray-400">صورة لافتة العرض (Hero Image)</label>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="text" 
                              placeholder="رابط الصورة الرئيسي (URL)"
                              value={settings.heroImage || ""}
                              onChange={(e) => setSettings({ ...settings, heroImage: e.target.value })}
                              className={`flex-1 text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                                darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                              }`}
                            />
                            <label className="px-3.5 py-2.5 bg-rose-500 text-white font-black rounded-xl hover:bg-rose-600 transition cursor-pointer text-[10px] shrink-0">
                              تحميل صورة العرض
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = async () => {
                                      if (typeof reader.result === "string") {
                                        try {
                                          const compressed = await compressImage(reader.result, 1200, 800, 0.75);
                                          setSettings({ ...settings, heroImage: compressed });
                                        } catch (err) {
                                          setSettings({ ...settings, heroImage: reader.result });
                                        }
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Section: Channels Addresses */}
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 space-y-3">
                        <span className="font-extrabold text-[11px] block text-emerald-500">قنوات الطلب والتواصل</span>

                        <div>
                          <label className="text-[10px] font-bold block mb-1 text-emerald-600 dark:text-emerald-400">رقم هاتف واتساب المستلم للطلبات *</label>
                          <input 
                            type="text" 
                            required
                            placeholder="مثال: +9647700000000"
                            value={settings.whatsappNumber}
                            onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                            className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-emerald-500 text-left ${
                              darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                            }`}
                          />
                          <span className="text-[9px] text-gray-400 block mt-1">يجب كتابة الرقم بالصيغة الدولية الكاملة (مثال: +9647700000000) ليعمل الرابط بنجاح.</span>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold block mb-1 text-sky-600 dark:text-sky-400">رابط بروفايل تيك توك الرسمي للشركة *</label>
                          <input 
                            type="url" 
                            required
                            placeholder="مثال: https://www.tiktok.com/@youraccount"
                            value={settings.tiktokLink}
                            onChange={(e) => setSettings({ ...settings, tiktokLink: e.target.value })}
                            className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-sky-500 text-left ${
                              darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Section: Contact Details */}
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 space-y-3">
                        <span className="font-extrabold text-[11px] block text-indigo-500">معلومات الاتصال والدعم الفني</span>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold block mb-1 text-gray-500 dark:text-gray-400">هاتف خدمة الزبائن</label>
                            <input 
                              type="text" 
                              placeholder="مثال: 07700000000"
                              value={settings.contactPhone || ""}
                              onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                              className={`w-full text-xs px-3 py-2 rounded-xl border focus:outline-none focus:border-rose-500 ${
                                darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                              }`}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold block mb-1 text-gray-500 dark:text-gray-400">البريد الإلكتروني</label>
                            <input 
                              type="email" 
                              placeholder="مثال: support@fadzone.com"
                              value={settings.contactEmail || ""}
                              onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                              className={`w-full text-xs px-3 py-2 rounded-xl border focus:outline-none focus:border-rose-500 ${
                                darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                              }`}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold block mb-1 text-gray-500 dark:text-gray-400">عنوان المستودع أو المكتب الرئيسي</label>
                          <input 
                            type="text" 
                            placeholder="مثال: العراق - بغداد - الكرادة"
                            value={settings.contactAddress || ""}
                            onChange={(e) => setSettings({ ...settings, contactAddress: e.target.value })}
                            className={`w-full text-xs px-3 py-2 rounded-xl border focus:outline-none focus:border-rose-500 ${
                              darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Section: Social Links */}
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 space-y-3">
                        <span className="font-extrabold text-[11px] block text-purple-500">روابط شبكات التواصل الاجتماعي</span>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[9px] font-black block mb-1 text-pink-500">إنستغرام</label>
                            <input 
                              type="url" 
                              placeholder="رابط Instagram"
                              value={settings.instagramLink || ""}
                              onChange={(e) => setSettings({ ...settings, instagramLink: e.target.value })}
                              className={`w-full text-xs px-2 py-2 rounded-lg border focus:outline-none focus:border-rose-500 ${
                                darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                              }`}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black block mb-1 text-blue-500">فيسبوك</label>
                            <input 
                              type="url" 
                              placeholder="رابط Facebook"
                              value={settings.facebookLink || ""}
                              onChange={(e) => setSettings({ ...settings, facebookLink: e.target.value })}
                              className={`w-full text-xs px-2 py-2 rounded-lg border focus:outline-none focus:border-rose-500 ${
                                darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                              }`}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black block mb-1 text-amber-500">سناب شات</label>
                            <input 
                              type="url" 
                              placeholder="رابط Snapchat"
                              value={settings.snapchatLink || ""}
                              onChange={(e) => setSettings({ ...settings, snapchatLink: e.target.value })}
                              className={`w-full text-xs px-2 py-2 rounded-lg border focus:outline-none focus:border-rose-500 ${
                                darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Shop Policies */}
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 space-y-3">
                        <span className="font-extrabold text-[11px] block text-rose-500">سياسات وشروط المتجر</span>
                        
                        <div>
                          <label className="text-[10px] font-bold block mb-1 text-gray-500 dark:text-gray-400">سياسة الشحن والتوصيل ومناطق التغطية</label>
                          <textarea 
                            rows={2}
                            placeholder="اكتب أسعار ومناطق وسرعة توصيل الطلبات للزبائن..."
                            value={settings.shippingInfo || ""}
                            onChange={(e) => setSettings({ ...settings, shippingInfo: e.target.value })}
                            className={`w-full text-xs px-3 py-2 rounded-xl border focus:outline-none focus:border-rose-500 ${
                              darkMode ? "bg-gray-955 border-gray-800 text-white" : "bg-white border-gray-200"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold block mb-1 text-gray-500 dark:text-gray-400">سياسة الاستبدال والترجيع</label>
                          <textarea 
                            rows={2}
                            placeholder="اكتب شروط الاسترجاع والاستبدال والمدة المتاحة للزبون..."
                            value={settings.returnPolicy || ""}
                            onChange={(e) => setSettings({ ...settings, returnPolicy: e.target.value })}
                            className={`w-full text-xs px-3 py-2 rounded-xl border focus:outline-none focus:border-rose-500 ${
                              darkMode ? "bg-gray-955 border-gray-800 text-white" : "bg-white border-gray-200"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold block mb-1 text-gray-500 dark:text-gray-400">سياسة الخصوصية وسرية البيانات</label>
                          <textarea 
                            rows={2}
                            placeholder="اكتب كيف يتم تأمين والحفاظ على سرية بيانات زبائن المتجر..."
                            value={settings.privacyPolicy || ""}
                            onChange={(e) => setSettings({ ...settings, privacyPolicy: e.target.value })}
                            className={`w-full text-xs px-3 py-2 rounded-xl border focus:outline-none focus:border-rose-500 ${
                              darkMode ? "bg-gray-955 border-gray-800 text-white" : "bg-white border-gray-200"
                            }`}
                          />
                        </div>
                      </div>

                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 bg-gradient-to-l from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-extrabold text-xs rounded-xl shadow-lg transition duration-200"
                    >
                      حفظ وتحديث الإعدادات العامة للمتجر
                    </button>
                  </form>

                  {/* Change Admin Password Card */}
                  <div className={`p-6 rounded-2xl border transition-colors mt-6 ${
                    darkMode ? "bg-gray-950 border-gray-850" : "bg-white border-gray-100 shadow-md"
                  }`}>
                    <div className="flex items-center gap-2 mb-6 border-b pb-3 border-gray-200 dark:border-gray-800">
                      <Lock className="w-5.5 h-5.5 text-rose-500" />
                      <div>
                        <h3 className="text-base font-black">تغيير كلمة مرور الإدارة</h3>
                        <p className="text-[10px] text-gray-400 -mt-0.5">تحديث كلمة المرور لحساب المسؤول الرسمي للمتجر</p>
                      </div>
                    </div>

                    <form onSubmit={handleChangePasswordSubmit} className="space-y-4 text-xs">
                      <div>
                        <label className="text-[11px] font-bold block mb-1.5">كلمة المرور الجديدة *</label>
                        <div className="relative">
                          <input 
                            type={showDashboardPassword ? "text" : "password"} 
                            required
                            placeholder="6 خانات على الأقل"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className={`w-full text-xs pr-4 pl-11 py-3 rounded-xl border focus:outline-none focus:border-rose-500 ${
                              darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                            }`}
                          />
                          <button 
                            type="button"
                            onClick={() => setShowDashboardPassword(!showDashboardPassword)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                          >
                            {showDashboardPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold block mb-1.5">تأكيد كلمة المرور الجديدة *</label>
                        <input 
                          type={showDashboardPassword ? "text" : "password"} 
                          required
                          placeholder="أعد كتابة كلمة المرور الجديدة"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          className={`w-full text-xs px-3.5 py-3 rounded-xl border focus:outline-none focus:border-rose-500 ${
                            darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                          }`}
                        />
                      </div>

                      {passwordChangeError && (
                        <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20 text-xs font-bold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          <p>{passwordChangeError}</p>
                        </div>
                      )}

                      {passwordChangeSuccess && (
                        <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 text-xs font-bold flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                          <p>{passwordChangeSuccess}</p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={passwordChangeLoading}
                        className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-extrabold text-xs rounded-xl hover:opacity-90 transition duration-200 disabled:opacity-50 cursor-pointer"
                      >
                        {passwordChangeLoading ? "جاري تحديث كلمة المرور..." : "حفظ وتحديث كلمة مرور المسؤول"}
                      </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 5. CUSTOMERS MANAGEMENT SECTION */}
            {activeTab === "customers" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {/* Search Customer Row */}
                <div className="flex flex-col sm:flex-row justify-between gap-4 items-stretch sm:items-center">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="ابحث عن زبون بالاسم، الهاتف، أو العنوان..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className={`w-full text-xs pr-9 pl-4 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                        darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200"
                      }`}
                    />
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold">
                    إجمالي الزبائن المسجلين: {customersList.length}
                  </div>
                </div>

                {/* Customers Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customersList.length === 0 ? (
                    <div className={`col-span-full p-8 text-center rounded-2xl border ${
                      darkMode ? "bg-gray-950/50 border-gray-800/80" : "bg-white border-gray-100 shadow-sm"
                    }`}>
                      <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-gray-400">لا يوجد زبائن مطابقين للبحث أو لم يتم تسجيل أي طلبات بعد.</p>
                    </div>
                  ) : (
                    customersList.map((customer) => (
                      <div 
                        key={customer.phone}
                        className={`p-4 rounded-2xl border flex flex-col justify-between transition-colors ${
                          darkMode ? "bg-gray-900/50 border-gray-800/80 text-white" : "bg-white border-gray-100 shadow-sm text-gray-900"
                        } ${selectedCustomerPhone === customer.phone ? "ring-2 ring-rose-500 border-transparent" : ""}`}
                      >
                        <div className="space-y-2 text-right">
                          <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-xs flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-rose-500" />
                              {customer.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[9px] font-black">
                              {customer.ordersCount} {customer.ordersCount === 1 ? "طلب" : "طلبات"}
                            </span>
                          </div>

                          <div className="text-[11px] space-y-1">
                            <p className="flex items-center gap-1 text-gray-400 font-medium">
                              <span className="font-bold text-gray-500 dark:text-gray-300">رقم الهاتف:</span>
                              <span dir="ltr">{customer.phone}</span>
                            </p>
                            <p className="text-gray-400 font-medium leading-relaxed">
                              <span className="font-bold text-gray-500 dark:text-gray-300">العنوان الرئيسي:</span> {customer.address}
                            </p>
                            <p className="flex items-center gap-1 text-gray-400 font-medium">
                              <span className="font-bold text-gray-500 dark:text-gray-300">إجمالي المشتريات:</span>
                              <span className="text-rose-500 font-extrabold">{customer.totalSpend.toLocaleString()} د.ع</span>
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                          <button
                            onClick={() => setSelectedCustomerPhone(selectedCustomerPhone === customer.phone ? null : customer.phone)}
                            className={`w-full py-2 rounded-xl text-[10px] font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              selectedCustomerPhone === customer.phone
                                ? "bg-gray-100 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-850 text-gray-600 dark:text-gray-300"
                                : "bg-rose-500 hover:bg-rose-600 text-white shadow-md"
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {selectedCustomerPhone === customer.phone ? "إخفاء تاريخ الطلبات" : "عرض تاريخ الطلبات المشتراة"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Customer Orders History Sub-Section */}
                {selectedCustomerPhone && (() => {
                  const customer = customersList.find(c => c.phone === selectedCustomerPhone);
                  if (!customer) return null;
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 15 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-6 rounded-3xl border transition-colors ${
                        darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-100 shadow-md text-gray-900"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-800">
                        <div className="text-right">
                          <h3 className="text-sm font-black flex items-center gap-1.5">
                            سجل طلبات الزبون: <span className="text-rose-500">{customer.name}</span>
                          </h3>
                          <p className="text-[10px] text-gray-400 -mt-0.5">يعرض كافة الطلبات التي تم إجراؤها برقم الهاتف {customer.phone}</p>
                        </div>
                        <button 
                          onClick={() => setSelectedCustomerPhone(null)}
                          className="px-2.5 py-1 text-[9px] font-black rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800 text-gray-500 transition cursor-pointer"
                        >
                          إغلاق السجل
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse text-[11px]">
                          <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400">
                              <th className="p-2">رقم الطلب</th>
                              <th className="p-2">التاريخ</th>
                              <th className="p-2">طريقة الطلب</th>
                              <th className="p-2">المجموع</th>
                              <th className="p-2">حالة الطلب</th>
                              <th className="p-2 text-center">الإجراء</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customer.orders.map((order) => (
                              <tr key={order.id} className="border-b border-gray-50 dark:border-gray-900 hover:bg-gray-50/50 dark:hover:bg-gray-900/50">
                                <td className="p-2 font-mono font-bold text-gray-500">{order.id}</td>
                                <td className="p-2">{new Date(order.createdAt).toLocaleDateString("ar-EG")}</td>
                                <td className="p-2">
                                  {order.orderMethod === "Direct" ? (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[9px] font-bold">شراء مباشر</span>
                                  ) : order.orderMethod === "WhatsApp" ? (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-bold">واتساب</span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 text-[9px] font-bold">تيك توك</span>
                                  )}
                                </td>
                                <td className="p-2 font-extrabold text-rose-500">{order.totalAmount.toLocaleString()} د.ع</td>
                                <td className="p-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                    order.status === "Pending" ? "bg-rose-500/10 text-rose-500" :
                                    order.status === "Processing" ? "bg-amber-500/10 text-amber-500" :
                                    order.status === "Shipped" ? "bg-blue-500/10 text-blue-500" :
                                    "bg-emerald-500/10 text-emerald-500"
                                  }`}>
                                    {order.status === "Pending" ? "قيد الانتظار" :
                                     order.status === "Processing" ? "تجهيز" :
                                     order.status === "Shipped" ? "تم الشحن" : "تم التوصيل"}
                                  </span>
                                </td>
                                <td className="p-2 text-center">
                                  <button 
                                    onClick={() => setSelectedOrder(order)}
                                    className="p-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 transition cursor-pointer inline-flex items-center justify-center"
                                    title="تفاصيل الطلب الكاملة"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  );
                })()}
              </motion.div>
            )}

          </section>

        </div>
      </main>

      {/* ----------------- MODAL: DETAILED ORDER DIALOG ----------------- */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border p-6 sm:p-8 relative ${
                darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-100 text-gray-900"
              }`}
            >
              {/* Close button */}
              <button 
                onClick={() => setSelectedOrder(null)}
                className="absolute top-4 left-4 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-black mb-1 border-b pb-3 border-gray-200 dark:border-gray-800">تفاصيل الطلب بالكامل</h3>

              {/* Order summary info */}
              <div className="grid grid-cols-2 gap-4 my-4 text-xs">
                <div>
                  <span className="text-gray-400 block">رقم التتبع</span>
                  <span className="font-mono font-black text-rose-500 text-sm">{selectedOrder.id}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-left">تاريخ الطلب</span>
                  <span className="font-bold block text-left">{new Date(selectedOrder.createdAt).toLocaleString("ar-IQ")}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">الاسم للزبون</span>
                  <span className="font-extrabold">{selectedOrder.customerName}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-left">رقم الهاتف</span>
                  <span className="font-extrabold block text-left text-rose-500">{selectedOrder.customerPhone}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 block">عنوان الشحن والتوصيل بالتفصيل</span>
                  <p className="font-bold bg-gray-50 dark:bg-gray-950 p-2.5 rounded-xl border mt-1">{selectedOrder.customerAddress}</p>
                </div>
              </div>

              {/* Order items purchased */}
              <div className="space-y-2 mt-6">
                <span className="text-xs font-bold text-gray-400 block">المنتجات المطلوبة في السلة:</span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className={`p-2 rounded-xl border flex items-center justify-between text-xs ${
                      darkMode ? "bg-gray-950 border-gray-850" : "bg-gray-50 border-gray-100"
                    }`}>
                      <div className="flex gap-2 items-center">
                        <img 
                          src={item.image} 
                          alt={item.title}
                          className="w-10 h-10 object-cover rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="font-bold line-clamp-1">{item.title}</h4>
                          <span className="text-[10px] text-gray-400">الكمية: {item.quantity}</span>
                        </div>
                      </div>
                      <span className="font-extrabold text-rose-500">{(item.price * item.quantity).toLocaleString()} د.ع</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order subtotal calculations */}
              <div className={`p-4 rounded-xl border text-xs space-y-1.5 mt-6 ${
                darkMode ? "bg-gray-950 border-gray-800" : "bg-gray-50 border-gray-100"
              }`}>
                {selectedOrder.couponApplied && (
                  <div className="flex justify-between text-emerald-500">
                    <span>الكوبون المطبق:</span>
                    <span className="font-black">{selectedOrder.couponApplied} (خصم بقيمة {selectedOrder.discountAmount.toLocaleString()} د.ع)</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black border-t pt-2 border-gray-200 dark:border-gray-800">
                  <span>المجموع النهائي للطلب:</span>
                  <span className="text-rose-500 text-base">{selectedOrder.totalAmount.toLocaleString()} د.ع</span>
                </div>
              </div>

              {/* Fast Status update dropdown in modal */}
              <div className="mt-6 flex items-center justify-between border-t pt-4 border-gray-200 dark:border-gray-800">
                <span className="text-xs font-bold">تغيير حالة الطلب الحالية:</span>
                <div className="flex gap-1.5">
                  {(["Pending", "Processing", "Shipped", "Delivered"] as OrderStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => updateOrderStatus(selectedOrder.id, st)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition ${
                        selectedOrder.status === st
                          ? "bg-rose-500 text-white shadow"
                          : darkMode ? "bg-gray-900 hover:bg-gray-850 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                      }`}
                    >
                      {st === "Pending" ? "قيد الانتظار" :
                       st === "Processing" ? "تجهيز" :
                       st === "Shipped" ? "شحن" : "توصيل"}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- MODAL: PRODUCT ADD / EDIT FORM ----------------- */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border p-6 sm:p-8 relative ${
                darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-100 text-gray-900"
              }`}
            >
              {/* Close Button */}
              <button 
                onClick={() => setIsProductModalOpen(false)}
                className="absolute top-4 left-4 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-black mb-1 border-b pb-3 border-gray-200 dark:border-gray-800">
                {editingProduct ? "تعديل بيانات المنتج المعروض" : "إضافة منتج جديد لمعرض المبيعات"}
              </h3>

              <form onSubmit={handleSaveProduct} className="space-y-4 text-xs mt-4">
                {/* Product Title */}
                <div>
                  <label className="text-[10px] font-bold block mb-1">اسم/عنوان المنتج الفعال *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="مثال: ساعة هيدرا رياضية فاخرة"
                    value={prodTitle}
                    onChange={(e) => setProdTitle(e.target.value)}
                    className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                      darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                    }`}
                  />
                </div>

                 {/* Price & Original Price Row */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Price */}
                  <div>
                    <label className="text-[10px] font-bold block mb-1">السعر الفعلي الحالي (د.ع) *</label>
                    <input 
                      type="number" 
                      required
                      placeholder="مثال: 35000"
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                        darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                      }`}
                    />
                  </div>

                  {/* Compare at Price */}
                  <div>
                    <label className="text-[10px] font-bold block mb-1">السعر الأصلي قبل الخصم (د.ع) - اختياري</label>
                    <input 
                      type="number" 
                      placeholder="مثال: 45000"
                      value={prodCompareAtPrice}
                      onChange={(e) => setProdCompareAtPrice(e.target.value)}
                      className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                        darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                      }`}
                    />
                  </div>
                </div>

                {/* Stock & Category Row */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Stock */}
                  <div>
                    <label className="text-[10px] font-bold block mb-1">المخزون المتوفر *</label>
                    <input 
                      type="number" 
                      required
                      placeholder="مثال: 15"
                      value={prodStock}
                      onChange={(e) => setProdStock(e.target.value)}
                      className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                        darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                      }`}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-[10px] font-bold block mb-1">تصنيف المنتج *</label>
                    <select 
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value)}
                      className={`w-full text-xs px-3 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                        darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <option value="ملابس">ملابس</option>
                      <option value="أحذية">أحذية</option>
                      <option value="إكسسوارات">إكسسوارات</option>
                    </select>
                  </div>
                </div>

                {/* Toggles for Featured & Disabled status */}
                <div className="grid grid-cols-2 gap-4">
                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    prodIsFeatured ? "bg-amber-500/5 border-amber-500/20" : darkMode ? "bg-gray-950 border-gray-850" : "bg-gray-50 border-gray-200"
                  }`}>
                    <div>
                      <span className="font-bold block text-[11px]">تمييز المنتج (تميز)</span>
                      <span className="text-[9px] text-gray-400 block mt-0.5">يعرض في الأقسام المميزة وبانر البداية.</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={prodIsFeatured}
                      onChange={(e) => setProdIsFeatured(e.target.checked)}
                      className="w-4.5 h-4.5 accent-amber-500"
                    />
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    prodIsDisabled ? "bg-red-500/5 border-red-500/20" : darkMode ? "bg-gray-950 border-gray-850" : "bg-gray-50 border-gray-200"
                  }`}>
                    <div>
                      <span className="font-bold block text-[11px] text-rose-500">تعطيل المنتج مؤقتاً</span>
                      <span className="text-[9px] text-gray-400 block mt-0.5">يخفي هذا المنتج من المعرض العام للمتجر.</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={prodIsDisabled}
                      onChange={(e) => setProdIsDisabled(e.target.checked)}
                      className="w-4.5 h-4.5 accent-rose-500"
                    />
                  </label>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[10px] font-bold block mb-1">وصف تفصيلي للمنتج ومزاياه *</label>
                  <textarea 
                    required
                    rows={3}
                    placeholder="اكتب تفاصيل ومقاسات وميزات المنتج..."
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-rose-500 ${
                      darkMode ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                    }`}
                  />
                </div>

                {/* Image upload area */}
                <div>
                  <label className="text-[10px] font-bold block mb-1.5">صور المعرض للمنتج * (صورة واحدة على الأقل)</label>
                  
                  {/* File inputs */}
                  <div className="flex gap-2 items-center flex-wrap">
                    <label className={`w-20 h-20 rounded-xl border border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-rose-500 transition-colors ${
                      darkMode ? "bg-gray-950 border-gray-850" : "bg-gray-50 border-gray-200"
                    }`}>
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-[9px] text-gray-400 mt-1">رفع صورة</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        onChange={handleImageFileChange} 
                        className="hidden" 
                      />
                    </label>

                    {/* Render existing / uploaded images preview */}
                    {prodImages.map((img, index) => (
                      <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden border">
                        <img 
                          src={img} 
                          alt="preview" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          type="button"
                          onClick={() => removeSelectedImage(index)}
                          className="absolute top-1 left-1 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <span className="text-[9px] text-gray-400 block mt-1.5">يمكنك رفع صور بصيغة JPG أو PNG. سيتم ضغطها وتخزينها محلياً بقاعدة البيانات للمتجر فوراً.</span>
                </div>

                {/* Save button */}
                <button
                  type="submit"
                  disabled={isSubmittingProduct}
                  className="w-full py-4 bg-gradient-to-l from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-xs rounded-xl shadow-lg transition"
                >
                  {isSubmittingProduct ? "جاري الحفظ والرفع..." : "تأكيد وحفظ بيانات المنتج"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
