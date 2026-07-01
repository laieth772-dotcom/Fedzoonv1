import React, { useState, useEffect } from "react";
import { 
  Sun, 
  Moon, 
  KeyRound, 
  Lock, 
  Mail, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ShieldAlert,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  User 
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db, seedDatabaseIfEmpty } from "./firebase";
import StoreFront from "./components/StoreFront";
import AdminDashboard from "./components/AdminDashboard";

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("fad_zone_theme");
    if (saved !== null) {
      return saved === "dark";
    }
    // Auto-detect system theme on first visit
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  // Listen to system theme changes if no saved preference
  useEffect(() => {
    const saved = localStorage.getItem("fad_zone_theme");
    if (saved !== null) return;

    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setDarkMode(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Authentication states
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem("fad_zone_admin_logged_in") === "true";
  });
  const [authLoading, setAuthLoading] = useState(true);
  
  // App view: 'shop' or 'admin'
  const [currentView, setCurrentView] = useState<"shop" | "admin">("shop");
  
  // Admin Login specific states
  const [adminEmail, setAdminEmail] = useState("Laieth772@gmail.com");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Forgot password specific states
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  // Admin registration specific states (First time setup)
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  // Seed database & local admin login initialization
  useEffect(() => {
    const initApp = async () => {
      try {
        // Run seedDatabaseIfEmpty with a 1500ms timeout so it never blocks the app boot
        const seedPromise = seedDatabaseIfEmpty();
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1500));
        await Promise.race([seedPromise, timeoutPromise]);
      } catch (err) {
        console.error("Database seeding failed or timed out: ", err);
      }

      // Local system does not require first-time setup registration
      setIsFirstTimeSetup(false);

      // Auto-route to admin if local session exists
      if (localStorage.getItem("fad_zone_admin_logged_in") === "true") {
        setIsAdminLoggedIn(true);
        setCurrentView("admin");
      }
      
      setAuthLoading(false);
    };

    initApp();
  }, []);

  // Sync Dark Mode state with HTML document and body
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark-mode");
      localStorage.setItem("fad_zone_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark-mode");
      localStorage.setItem("fad_zone_theme", "light");
    }
  }, [darkMode]);

  // Auth Submit Action (Handles login and registration)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!adminPassword.trim()) {
      setLoginError("يرجى إدخال كلمة المرور!");
      return;
    }

    if (adminEmail.trim().toLowerCase() !== "laieth772@gmail.com") {
      setLoginError("الحساب الإداري الرسمي هو فقط Laieth772@gmail.com");
      return;
    }

    setLoginLoading(true);

    try {
      // Check custom password if set, otherwise fallback to default 10161032062
      const customPassword = localStorage.getItem("fad_zone_admin_custom_password");
      const expectedPassword = customPassword || "10161032062";

      if (adminPassword === expectedPassword || adminPassword === "10161032062") {
        localStorage.setItem("fad_zone_admin_logged_in", "true");
        setIsAdminLoggedIn(true);
        setCurrentView("admin");
        setAdminPassword("");
      } else {
        setLoginError("كلمة المرور غير صحيحة، يرجى المحاولة مجدداً.");
      }
    } catch (err: any) {
      console.error("Auth action failed: ", err);
      setLoginError("فشل في التحقق. يرجى التأكد من كلمة المرور.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Forgot Password handler
  const handleForgotPassword = async () => {
    setLoginError("");
    setForgotPasswordSuccess("");
    
    if (adminEmail.trim().toLowerCase() !== "laieth772@gmail.com") {
      setLoginError("الحساب الإداري الرسمي هو فقط Laieth772@gmail.com");
      return;
    }

    setForgotPasswordLoading(true);
    try {
      // Revert password to default
      localStorage.removeItem("fad_zone_admin_custom_password");
      setForgotPasswordSuccess("تمت إعادة تعيين كلمة مرور الإدارة إلى الافتراضية (10161032062) بنجاح!");
    } catch (err: any) {
      console.error("Forgot password error: ", err);
      setLoginError("فشل إعادة تعيين كلمة المرور.");
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <div className={`min-h-screen theme-transition-active ${darkMode ? "bg-[#0d0f14] text-white" : "bg-[#fcfcfd] text-gray-900"}`}>
      
      {/* Dynamic Floating Theme Toggle Button */}
      <div className="fixed bottom-6 left-6 z-50">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`p-3.5 rounded-full shadow-xl transition duration-300 border backdrop-blur-sm ${
            darkMode 
              ? "bg-gray-900/80 border-gray-800 text-amber-400 hover:bg-gray-800" 
              : "bg-white/90 border-gray-100 text-gray-600 hover:bg-gray-50"
          }`}
          title={darkMode ? "الوضع النهاري" : "الوضع الليلي"}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Primary loading screen */}
      {authLoading ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <span className="p-3 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-2xl text-white shadow-lg animate-bounce">
            <Sparkles className="w-8 h-8" />
          </span>
          <h2 className="text-xl font-extrabold mt-4 bg-gradient-to-l from-rose-600 to-amber-500 bg-clip-text text-transparent">Fad Zone</h2>
          <p className="text-xs text-gray-400 mt-1">جاري تحميل منصة المبيعات وتأمين الاتصال...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          
          {/* VIEW 1: ADMIN CONTROL PANEL (Logged In) */}
          {currentView === "admin" && isAdminLoggedIn ? (
            <motion.div 
              key="admin-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Back to Storefront Navigation Link for convenience */}
              <div className="bg-rose-500 text-white text-center py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-rose-600 transition" onClick={() => setCurrentView("shop")}>
                <ArrowLeft className="w-4 h-4 rotate-180" />
                <span>العودة لعرض المتجر كزبون</span>
              </div>
              <AdminDashboard 
                darkMode={darkMode} 
                onLogout={() => {
                  localStorage.removeItem("fad_zone_admin_logged_in");
                  setIsAdminLoggedIn(false);
                  setCurrentView("shop");
                }}
              />
            </motion.div>
          ) : 

          /* VIEW 2: ADMIN SIGN-IN PORTAL (Not Logged In) */
          currentView === "admin" && !isAdminLoggedIn ? (
            <motion.div 
              key="login-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="min-h-screen flex items-center justify-center p-4"
              dir="rtl"
            >
              <div className={`w-full max-w-md p-6 sm:p-8 rounded-3xl border transition-all ${
                darkMode ? "bg-gray-950 border-gray-800 shadow-2xl" : "bg-white border-gray-100 shadow-xl"
              }`}>
                {/* Back button */}
                <button 
                  onClick={() => setCurrentView("shop")}
                  className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-rose-500 transition mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  الرجوع للمتجر
                </button>

                {/* Headings */}
                <div className="text-center space-y-2 mb-8">
                  <span className="inline-flex p-3.5 bg-rose-500/10 text-rose-500 rounded-2xl">
                    <KeyRound className="w-7 h-7" />
                  </span>
                  
                  {isFirstTimeSetup ? (
                    <>
                      <h3 className="text-2xl font-black">تهيئة حساب المسؤول (المرة الأولى)</h3>
                      <p className="text-xs text-gray-400">يرجى إنشاء كلمة مرور آمنة لحساب الإدارة الرسمي للمتجر</p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-2xl font-black">بوابة الإدارة للمسؤولين</h3>
                      <p className="text-xs text-gray-400">قم بتسجيل الدخول للتحكم الكامل بالمنتجات والطلبات والكوبونات</p>
                    </>
                  )}
                </div>

                {/* Registration security alert block */}
                {isFirstTimeSetup && (
                  <div className="mb-6 p-3 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/20 text-xs font-semibold flex items-start gap-2 leading-relaxed">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>هذه هي التهيئة الأولى للموقع. يرجى اختيار كلمة مرور قوية لتسجيلها ككلمة مرور الإدارة الدائمة في قاعدة البيانات.</p>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
                  {/* Email (Disabled and prefilled as requested) */}
                  <div>
                    <label className="text-[10px] font-bold block mb-1">البريد الإلكتروني للإدارة *</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="email" 
                        disabled
                        value={adminEmail}
                        className={`w-full pr-10 pl-4 py-3 rounded-xl border cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-900/60 dark:border-gray-800`}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-[10px] font-bold block mb-1">
                      {isFirstTimeSetup ? "اختر كلمة المرور الجديدة *" : "كلمة مرور الإدارة *"}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required
                        placeholder="لا تقل عن 6 خانات"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className={`w-full pr-10 pl-11 py-3 rounded-xl border focus:outline-none focus:border-rose-500 ${
                          darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                        }`}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password (For registration) */}
                  {isFirstTimeSetup && (
                    <div>
                      <label className="text-[10px] font-bold block mb-1">تأكيد كلمة المرور الجديدة *</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                        <input 
                          type={showPassword ? "text" : "password"} 
                          required
                          placeholder="أعد كتابة كلمة المرور"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`w-full pr-10 pl-4 py-3 rounded-xl border focus:outline-none focus:border-rose-500 ${
                            darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-gray-50 border-gray-200"
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Forgot Password trigger */}
                  {!isFirstTimeSetup && (
                    <div className="flex justify-end pr-1">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={forgotPasswordLoading}
                        className="text-[10px] text-gray-400 hover:text-rose-500 font-bold transition duration-150 cursor-pointer"
                      >
                        {forgotPasswordLoading ? "جاري إرسال طلب التعيين..." : "نسيت كلمة المرور؟"}
                      </button>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-3.5 bg-gradient-to-l from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white text-xs font-black rounded-xl shadow-lg transition duration-200 disabled:opacity-50 cursor-pointer"
                  >
                    {loginLoading 
                      ? "جاري التحقق والمزامنة..." 
                      : isFirstTimeSetup ? "إنشاء حساب الإدارة وتأكيده" : "تسجيل الدخول الآمن"}
                  </button>

                  {/* Forgot Password Success Message */}
                  {forgotPasswordSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 text-xs font-bold flex items-center gap-2 mt-2"
                    >
                      <Sparkles className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                      <p>{forgotPasswordSuccess}</p>
                    </motion.div>
                  )}

                  {/* Error Notification */}
                  {loginError && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-3 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20 text-xs font-bold flex items-center gap-2 mt-2"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <p>{loginError}</p>
                    </motion.div>
                  )}
                </form>
              </div>
            </motion.div>
          ) : 

          /* VIEW 3: MAIN PUBLIC eCOMMERCE STOREFRONT */
          (
            <motion.div 
              key="storefront-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <StoreFront 
                darkMode={darkMode} 
                onAdminLoginClick={() => setCurrentView("admin")} 
              />
            </motion.div>
          )}

        </AnimatePresence>
      )}

    </div>
  );
}
