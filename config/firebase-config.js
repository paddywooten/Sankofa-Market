/**
 * Sankofa Market - Firebase Configuration
 * 
 * IMPORTANT: Replace the placeholder values below with your actual Firebase config
 * Get your config from Firebase Console:
 * 1. Go to https://console.firebase.google.com
 * 2. Select your project
 * 3. Go to Project Settings (gear icon)
 * 4. Scroll to "Your apps" section
 * 5. Click the Web icon </>
 * 6. Copy the config and replace below
 */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "sankofa-market.firebaseapp.com",
  projectId: "sankofa-market",
  storageBucket: "sankofa-market.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID" // Optional, for Analytics
};

// Initialize Firebase
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDB = null;
let firebaseStorage = null;

// Only initialize if config is set
if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
  try {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    firebaseAuth = firebase.auth();
    firebaseDB = firebase.firestore();
    firebaseStorage = firebase.storage();
    
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
  }
} else {
  console.warn('⚠️ Firebase config not set. Please update config/firebase-config.js with your actual Firebase config.');
  console.warn('⚠️ Get your config from: https://console.firebase.google.com');
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
