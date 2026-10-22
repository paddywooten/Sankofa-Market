/**
 * Sankofa Market - Firebase Configuration
 * Ghana's #1 Online Marketplace
 * 
 * Firebase Project: sankofa-market
 * Last updated: September 2026
 */

const firebaseConfig = {
  apiKey: "AIzaSyALwyEU6XYgumx989vgt58QxdQSx0Txghg",
  authDomain: "sankofa-market.firebaseapp.com",
  projectId: "sankofa-market",
  storageBucket: "sankofa-market.firebasestorage.app",
  messagingSenderId: "98342667835",
  appId: "1:98342667835:web:f9ca761128eaa0b5c27e1e",
  measurementId: "G-KX92END1TJ"
};

// Initialize Firebase
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDB = null;
let firebaseStorage = null;

try {
  // Check if Firebase app already initialized (e.g., from another script)
  if (firebase.apps.length === 0) {
    firebaseApp = firebase.initializeApp(firebaseConfig);
  } else {
    firebaseApp = firebase.app();
  }
  
  // Initialize each service separately so one failure doesn't break others
  try { firebaseAuth = firebase.auth(); } catch(e) { console.error('Auth init failed:', e); }
  try {
    firebaseDB = firebase.firestore();
    // Enable offline persistence - prevents "client is offline" errors
    // by caching data locally and syncing when back online
    firebaseDB.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence: multiple tabs open, using default');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence: not supported by this browser');
      }
    });
  } catch(e) { console.error('Firestore init failed:', e); }
  try { firebaseStorage = firebase.storage(); } catch(e) { console.warn('Storage init failed (SDK may not be loaded):', e.message); }
  
  // Set auth persistence to LOCAL so it survives page redirects
  if (firebaseAuth) {
    firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function() {});
  }

  // App Check — prevents abuse of API key (requires SDK: firebase-app-check-compat.js)
  // Enable in Firebase Console → App Check → Apps → reCAPTCHA v3 → add site key below
  // For local dev, debug token is auto-generated in console
  try {
    if (typeof firebase.appCheck !== 'undefined') {
      // Debug token for localhost — see console for token, add to Firebase Console → App Check → Debug tokens
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      const appCheck = firebase.appCheck();
      // TODO: Replace with your reCAPTCHA v3 site key
      // appCheck.activate('6Lf_YOUR_SITE_KEY', true);
      console.log('App Check ready — add reCAPTCHA v3 key to activate');
    }
  } catch (e) { console.warn('App Check init failed (add firebase-app-check-compat.js):', e.message); }
  
  console.log('✅ Firebase initialized successfully');
  console.log('📦 Project:', firebaseConfig.projectId);
  console.log('Auth:', !!firebaseAuth, '| Firestore:', !!firebaseDB, '| Storage:', !!firebaseStorage);
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  // Fallback: try to recover individual services
  try { firebaseAuth = firebase.auth(); } catch(e) {}
  try { firebaseDB = firebase.firestore(); } catch(e) {}
  try { firebaseStorage = firebase.storage(); } catch(e) {}
  console.log('Firebase recovery - Auth:', !!firebaseAuth, '| Firestore:', !!firebaseDB, '| Storage:', !!firebaseStorage);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    firebaseApp,
    firebaseAuth,
    firebaseDB,
    firebaseStorage,
    firebaseConfig
  };
}
