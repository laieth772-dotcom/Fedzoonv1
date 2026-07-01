import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  writeBatch,
  query,
  limit
} from "firebase/firestore";

// Firebase credentials from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyAA1x8Rb9CwKkqIfHdZdIYSRb842AhgBNU",
  authDomain: "project-b23a6963-710e-432a-b73.firebaseapp.com",
  projectId: "project-b23a6963-710e-432a-b73",
  storageBucket: "project-b23a6963-710e-432a-b73.firebasestorage.app",
  messagingSenderId: "1057064202676",
  appId: "1:1057064202676:web:f5eb5fcfad6b94f60782e1",
  firestoreDatabaseId: "ai-studio-3fa40fdd-74e0-4004-a973-aeb0b765fdff"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Default store data definitions (also used as fallbacks)
export const DEFAULT_SETTINGS = {
  whatsappNumber: "+9647700000000",
  tiktokLink: "https://www.tiktok.com/@fadzone",
  enableCart: true,
  enableWhatsApp: true,
  enableTikTok: true,
  updatedAt: new Date().toISOString()
};

export const DEFAULT_COUPONS = [
  { id: "FAD10", code: "FAD10", type: "percentage", value: 10, isActive: true, createdAt: new Date().toISOString() },
  { id: "WELCOME5", code: "WELCOME5", type: "fixed", value: 5000, isActive: true, createdAt: new Date().toISOString() }
];

export const DEFAULT_PRODUCTS = [
  {
    id: "prod-1",
    title: "ساعة رياضية فاخرة - كحلي وأسود",
    price: 35000,
    description: "ساعة رياضية ذكية مقاومة للماء مع تتبع نبضات القلب والأنشطة اليومية، تصميم عصري يناسب جميع الأوقات.",
    category: "إكسسوارات",
    stock: 15,
    images: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=600&auto=format&fit=crop&q=80"
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-2",
    title: "حذاء ركض الترا سبورتس - أحمر رياضي",
    price: 49000,
    description: "حذاء رياضي خفيف الوزن ومصمم لتوفير أقصى درجات الراحة أثناء الجري والمشي الطويل. نعل مرن مقاوم للصدمات.",
    category: "أحذية",
    stock: 22,
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80"
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-3",
    title: "نظارات شمسية عصرية - عدسات داكنة",
    price: 18000,
    description: "نظارات شمسية راقية بتصميم إيطالي فريد توفر حماية 100% من الأشعة فوق البنفسجية UV400 ومريحة للعين.",
    category: "إكسسوارات",
    stock: 30,
    images: [
      "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=80"
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-4",
    title: "هودي فاد زون الكلاسيكي - رمادي دافئ",
    price: 25000,
    description: "هودي مصنوع من القطن الطبيعي الفاخر 100%، بطانة ناعمة ومريحة تضمن الدفء في الأيام الباردة بتصميم عصري فضفاض.",
    category: "ملابس",
    stock: 12,
    images: [
      "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80"
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-5",
    title: "حقيبة كتف جلدية كلاسيكية - بني غامق",
    price: 32000,
    description: "حقيبة مصنوعة من الجلد الطبيعي المعالج بتصميم عملي كلاسيكي يتسع لجميع مستلزماتك اليومية مع جيوب تنظيمية متعددة.",
    category: "إكسسوارات",
    stock: 8,
    images: [
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80"
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-6",
    title: "تي شيرت قطني مريح - أبيض ناصع",
    price: 15000,
    description: "تي شيرت كاجوال مريح للغاية، مثالي للاستخدام اليومي، مصنوع من القطن عالي الجودة والمسامي.",
    category: "ملابس",
    stock: 40,
    images: [
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80"
    ],
    createdAt: new Date().toISOString()
  }
];

// Seeding function to populate initial store data if empty
export async function seedDatabaseIfEmpty() {
  try {
    // 1. Check & Seed Settings
    const settingsRef = collection(db, "settings");
    const settingsSnap = await getDocs(query(settingsRef, limit(1)));
    
    if (settingsSnap.empty) {
      console.log("Seeding default settings...");
      await setDoc(doc(db, "settings", "general"), DEFAULT_SETTINGS);
    }

    // 2. Check & Seed Coupons
    const couponsRef = collection(db, "coupons");
    const couponsSnap = await getDocs(query(couponsRef, limit(1)));
    
    if (couponsSnap.empty) {
      console.log("Seeding default coupons...");
      const batch = writeBatch(db);
      DEFAULT_COUPONS.forEach((coupon) => {
        batch.set(doc(db, "coupons", coupon.id), coupon);
      });
      await batch.commit();
    }

    // 3. Check & Seed Products
    const productsRef = collection(db, "products");
    const productsSnap = await getDocs(query(productsRef, limit(1)));
    
    if (productsSnap.empty) {
      console.log("Seeding default products...");
      const batch = writeBatch(db);
      DEFAULT_PRODUCTS.forEach((prod) => {
        batch.set(doc(db, "products", prod.id), prod);
      });
      await batch.commit();
    }
  } catch (error) {
    console.error("Error seeding database: ", error);
  }
}

export { auth, db };
