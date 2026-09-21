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
  firebaseAuth = firebase.auth();
  firebaseDB = firebase.firestore();
  firebaseStorage = firebase.storage();
  
  // Set auth persistence to LOCAL so it survives page redirects
  firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function() {});
  
  console.log('✅ Firebase initialized successfully');
  console.log('📦 Project:', firebaseConfig.projectId);
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  // Fallback: try to use existing Firebase app
  try {
    firebaseAuth = firebase.auth();
    firebaseDB = firebase.firestore();
    firebaseStorage = firebase.storage();
    console.log('✅ Firebase recovered from existing app');
  } catch (e) {
    console.error('❌ Firebase recovery failed:', e);
  }
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
