# Firebase Setup Guide for Sankofa Market

This guide will walk you through setting up Firebase for Sankofa Market.

## 📋 Prerequisites

- Google Account
- Firebase Account (free at https://console.firebase.google.com)
- Node.js installed (for Cloud Functions)

## 🚀 Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add project"**
3. Enter project name: `sankofa-market`
4. Enable Google Analytics (optional but recommended)
5. Click **"Create project"**
6. Wait for project to be created
7. Click **"Continue"**

## 🔧 Step 2: Enable Firebase Services

### 2.1 Enable Authentication

1. In Firebase Console, go to **Authentication** (left sidebar)
2. Click **"Get started"**
3. Go to **"Sign-in method"** tab
4. Enable the following providers:
   - ✅ **Email/Password** (enable)
   - ✅ **Google** (enable, add your email as support)
   - ✅ **Phone** (enable for phone verification)
5. Click **"Save"**

### 2.2 Enable Firestore Database

1. Go to **Firestore Database** (left sidebar)
2. Click **"Create database"**
3. Choose **"Start in production mode"**
4. Select location: **europe-west1** (or closest to Ghana)
5. Click **"Enable"**

### 2.3 Enable Storage

1. Go to **Storage** (left sidebar)
2. Click **"Get started"**
3. Choose **"Start in production mode"**
4. Select same location as Firestore
5. Click **"Done"**

### 2.4 Enable Cloud Functions

1. Go to **Functions** (left sidebar)
2. Click **"Get started"**
3. Follow setup instructions (requires Node.js)

## 🔑 Step 3: Get Firebase Configuration

1. Go to **Project Settings** (gear icon ⚙️)
2. Scroll down to **"Your apps"** section
3. Click the **Web icon** `</>`
4. Register app name: `sankofa-market-web`
5. Click **"Register app"**
6. **Copy the configuration** (you'll need this)

The config will look like this:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "sankofa-market.firebaseapp.com",
  projectId: "sankofa-market",
  storageBucket: "sankofa-market.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## 📝 Step 4: Update Firebase Config File

1. Open `config/firebase-config.js`
2. Replace the placeholder config with your actual config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "sankofa-market.firebaseapp.com",
  projectId: "sankofa-market",
  storageBucket: "sankofa-market.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

3. Save the file

## 🔒 Step 5: Set Up Firestore Security Rules

1. Go to **Firestore Database** → **Rules** tab
2. Replace the rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin();
    }
    
    // Products collection
    match /products/{productId} {
      allow read: if true; // Anyone can read
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.sellerId;
      allow update: if isAuthenticated() && 
        (request.auth.uid == resource.data.sellerId || isAdmin());
      allow delete: if isAuthenticated() && 
        (request.auth.uid == resource.data.sellerId || isAdmin());
    }
    
    // Orders collection
    match /orders/{orderId} {
      allow read: if isAuthenticated() && 
        (request.auth.uid == resource.data.buyerId || 
         request.auth.uid == resource.data.sellerId || 
         isAdmin());
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.buyerId;
      allow update: if isAuthenticated() && 
        (request.auth.uid == resource.data.buyerId || 
         request.auth.uid == resource.data.sellerId || 
         isAdmin());
      allow delete: if isAdmin();
    }
    
    // Messages collection
    match /messages/{messageId} {
      allow read: if isAuthenticated() && 
        (request.auth.uid == resource.data.senderId || 
         request.auth.uid == resource.data.receiverId || 
         isAdmin());
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.senderId;
      allow update: if isAuthenticated() && 
        (request.auth.uid == resource.data.senderId || 
         request.auth.uid == resource.data.receiverId || 
         isAdmin());
      allow delete: if isAdmin();
    }
    
    // Conversations collection
    match /conversations/{conversationId} {
      allow read: if isAuthenticated() && 
        (request.auth.uid in resource.data.participants || isAdmin());
      allow create: if isAuthenticated() && request.auth.uid in request.resource.data.participants;
      allow update: if isAuthenticated() && 
        (request.auth.uid in resource.data.participants || isAdmin());
      allow delete: if isAdmin();
    }
    
    // Reviews collection
    match /reviews/{reviewId} {
      allow read: if true; // Anyone can read reviews
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.userId;
      allow update: if isAuthenticated() && request.auth.uid == resource.data.userId;
      allow delete: if isAdmin();
    }
    
    // Categories collection
    match /categories/{categoryId} {
      allow read: if true; // Anyone can read
      allow write: if isAdmin();
    }
    
    // Reports collection
    match /reports/{reportId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }
    
    // Disputes collection
    match /disputes/{disputeId} {
      allow read: if isAuthenticated() && 
        (request.auth.uid == resource.data.buyerId || 
         request.auth.uid == resource.data.sellerId || 
         isAdmin());
      allow create: if isAuthenticated();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }
  }
}
```

3. Click **"Publish"**

## 🔒 Step 6: Set Up Storage Security Rules

1. Go to **Storage** → **Rules** tab
2. Replace the rules with the following:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // User profile images
    match /users/{userId}/{allPaths=**} {
      allow read: if true; // Anyone can read profile images
      allow write: if isOwner(userId);
    }
    
    // Product images
    match /products/{productId}/{allPaths=**} {
      allow read: if true; // Anyone can read product images
      allow write: if isAuthenticated();
    }
    
    // Message attachments
    match /messages/{messageId}/{allPaths=**} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }
    
    // Review images
    match /reviews/{reviewId}/{allPaths=**} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
    
    // Verification documents
    match /verification/{userId}/{allPaths=**} {
      allow read: if isAuthenticated() && (request.auth.uid == userId || isAdmin());
      allow write: if isOwner(userId);
    }
  }
}
```

3. Click **"Publish"**

## ☁️ Step 7: Set Up Cloud Functions

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Cloud Functions:
```bash
cd /path/to/sankofa-market
firebase init functions
```

4. Select options:
   - Use existing project: `sankofa-market`
   - Language: **JavaScript**
   - ESLint: **No**
   - Install dependencies: **Yes**

5. Replace `functions/index.js` with the Cloud Functions code (provided in `functions/index.js`)

6. Deploy functions:
```bash
firebase deploy --only functions
```

## 🚀 Step 8: Deploy to Firebase Hosting

1. Initialize hosting:
```bash
firebase init hosting
```

2. Select options:
   - Use existing project: `sankofa-market`
   - Public directory: `.` (current directory)
   - Single-page app: **No**
   - GitHub auto-deploy: **No** (optional)

3. Deploy:
```bash
firebase deploy --only hosting
```

4. Your site will be live at: `https://sankofa-market.web.app`

## 🌐 Step 9: Set Up Custom Domain (Optional)

1. Go to **Hosting** in Firebase Console
2. Click **"Add custom domain"**
3. Enter: `sankofamarket.com.gh`
4. Follow DNS instructions
5. Wait for SSL certificate (automatic)

## ✅ Step 10: Test Your Setup

1. Open your deployed site
2. Test user registration
3. Test user login
4. Test product creation
5. Test search functionality
6. Test admin login

## 🔧 Troubleshooting

### Issue: Firebase config not working
**Solution:** Double-check your config values in `config/firebase-config.js`

### Issue: Firestore permission denied
**Solution:** Check your Firestore security rules

### Issue: Storage upload fails
**Solution:** Check your Storage security rules

### Issue: Functions deployment fails
**Solution:** Check `firebase-debug.log` for errors

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)

## 🎉 You're Done!

Your Firebase setup is complete! Your Sankofa Market is now ready to use Firebase for:
- ✅ User authentication
- ✅ Database (Firestore)
- ✅ File storage
- ✅ Cloud Functions
- ✅ Hosting

**Next Steps:**
1. Set up Paystack payment integration
2. Implement user-to-user chat
3. Create missing user pages
4. Set up email service
