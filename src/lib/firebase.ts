import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAknBI2_QREL30D2NhCfnk_yj9f4-E0Lto",
  authDomain: "souq-saada.firebaseapp.com",
  projectId: "souq-saada",
  storageBucket: "souq-saada.firebasestorage.app",
  messagingSenderId: "343127984297",
  appId: "1:343127984297:web:428ee6744fdeab071b01b8",
  measurementId: "G-KEECM1KN39"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

export const signInWithGoogle = async () => {
  // Use popup on localhost (faster UX), redirect on production.
  // COOP headers are set to unsafe-none in vite.config.ts to allow popup communication.
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } else {
    await signInWithRedirect(auth, googleProvider);
    return null;
  }
};

export { getRedirectResult };

export const syncUserToFirestore = async (user: any) => {};
export const saveSearchQuery = async (userId: string, queryText: string) => {};
export const addFavorite = async (userId: string, productId: number) => {};
export const removeFavorite = async (userId: string, productId: number) => {};
export const getFavorites = async (userId: string) => { return []; };
export const createOrder = async (userId: string, orderData: any) => {};
export const getProductEnhancements = async () => { return {}; };
export const saveProductEnhancement = async (productId: number, enhancedDescription: string) => {};
