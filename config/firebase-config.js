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
  firebaseApp = firebase.initializeApp(firebaseConfig);
  firebaseAuth = firebase.auth();
  firebaseDB = firebase.firestore();
  firebaseStorage = firebase.storage();
  
  console.log('✅ Firebase initialized successfully');
  console.log('📦 Project:', firebaseConfig.projectId);
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
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
