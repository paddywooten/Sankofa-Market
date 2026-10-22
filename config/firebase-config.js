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
  
  // App Check must be activated BEFORE any other Firebase service is used,
  // otherwise the first Firestore/Storage call is made without an App Check token.
  // Provider: reCAPTCHA Enterprise (SCORE key), registered in Firebase App Check.
  try {
    if (typeof firebase.appCheck !== 'undefined') {
      // Never ship a debug token to production. On localhost, opt in explicitly in
      // the browser console with: localStorage.setItem('sm_appcheck_debug','1')
      // (then register the printed token in Firebase Console → App Check → Debug tokens).
      if ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') &&
          localStorage.getItem('sm_appcheck_debug') === '1') {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      var APP_CHECK_SITE_KEY = '6LfagPstAAAAANhFltIMEPyj9hd-qKaW3l249nf4';
      var appCheckProvider = (firebase.appCheck.ReCaptchaEnterpriseProvider)
        ? new firebase.appCheck.ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY)
        : APP_CHECK_SITE_KEY;
      firebase.appCheck().activate(appCheckProvider, true);
    } else {
      console.warn('App Check SDK not loaded — add firebase-app-check-compat.js');
    }
  } catch (e) { console.warn('App Check init failed:', e.message); }

  // Initialize each service separately so one failure doesn't break others
  try { firebaseAuth = firebase.auth(); } catch(e) { console.error('Auth init failed:', e); }
  // Some lightweight pages (e.g. founding.html) intentionally load only the Auth SDK.
  if (typeof firebase.firestore === 'function') try {
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

  // Keep the console clean in production; opt in with localStorage sm_debug=1
  if (localStorage.getItem('sm_debug') === '1') {
    console.log('Firebase ready:', { auth: !!firebaseAuth, firestore: !!firebaseDB, storage: !!firebaseStorage });
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  // Fallback: try to recover individual services
  try { firebaseAuth = firebase.auth(); } catch(e) {}
  try { firebaseDB = firebase.firestore(); } catch(e) {}
  try { firebaseStorage = firebase.storage(); } catch(e) {}
  if (localStorage.getItem('sm_debug') === '1') console.log('Firebase recovery:', { auth: !!firebaseAuth, firestore: !!firebaseDB, storage: !!firebaseStorage });
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
