# 🇬🇭 SANKOFA MARKET - PROJECT PLAN

## Ghana's Premier C2C Marketplace Platform

**"Give Your Items New Life - Buy & Sell with Confidence"** 🦅💛

---

## 📋 TABLE OF CONTENTS

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Database Schema](#database-schema)
5. [Project Structure](#project-structure)
6. [Development Phases](#development-phases)
7. [Firebase Setup](#firebase-setup)
8. [Deployment](#deployment)

---

## 🎯 PROJECT OVERVIEW

### **What is Sankofa Market?**

Sankofa Market is Ghana's premier **C2C (Consumer-to-Consumer) marketplace** platform, inspired by Xianyu/Goofish, where:

- **Anyone can sell** their pre-loved items
- **Anyone can buy** second-hand items with confidence
- **Direct communication** between buyers and sellers
- **Secure transactions** with payment protection
- **Trust and safety** through verification and reviews

### **Why "Sankofa"?**

The name comes from the Adinkra symbol "Sankofa" which means **"go back and get it"** - representing the philosophy of retrieving value from the past and giving it new life. Perfect for a second-hand marketplace!

### **Target Market**

- **Primary:** Ghanaians (Accra, Kumasi, Takoradi, Tamale, etc.)
- **Secondary:** West Africa (Nigeria, Côte d'Ivoire, etc.)
- **Future:** Pan-African expansion

### **Business Model**

1. **Transaction Fees:** 5-10% commission on successful transactions
2. **Featured Listings:** Sellers pay to promote their items
3. **Premium Memberships:** Monthly subscription for power sellers
4. **Advertising:** Banner ads and sponsored listings

---

## ✨ FEATURES

### **Core Features (MVP)**

#### **1. User Management**
- ✅ User registration (email, phone, social login)
- ✅ User profiles (buyer/seller)
- ✅ User verification (ID, phone, email)
- ✅ User ratings and reviews
- ✅ User dashboard (buyer/seller)
- ✅ Transaction history
- ✅ Wishlist/favorites

#### **2. Product Management**
- ✅ Create product listings (up to 10 images)
- ✅ Edit/delete listings
- ✅ Product categories (30+ categories)
- ✅ Product search and filtering
- ✅ Product detail pages
- ✅ Product condition (New, Like New, Good, Fair)
- ✅ Price negotiation
- ✅ Location-based listings

#### **3. Search & Discovery**
- ✅ Keyword search
- ✅ Category browsing
- ✅ Advanced filters (price, location, condition, etc.)
- ✅ Sort by (Latest, Price, Distance, Rating)
- ✅ Featured/trending items
- ✅ Recently viewed items
- ✅ Recommended items

#### **4. Communication**
- ✅ Real-time chat between buyers and sellers
- ✅ Message notifications
- ✅ Chat history
- ✅ Image sharing in chat
- ✅ Report users/messages

#### **5. Transactions**
- ✅ Shopping cart
- ✅ Checkout flow
- ✅ Payment integration (Paystack - Mobile Money, Cards)
- ✅ **Escrow payment protection** (funds held until delivery confirmed)
- ✅ Order management
- ✅ **Dispute resolution system** (admin-managed with evidence collection)
- ✅ **Buyer confirmation flow** (48-hour inspection period)
- ✅ Transaction history

#### **6. Trust & Safety**
- ✅ Seller verification badges
- ✅ User ratings and reviews
- ✅ Report listings/users
- ✅ Secure payment processing
- ✅ Dispute resolution system
- ✅ Admin moderation

### **Advanced Features (Phase 2)**

- ✅ Push notifications
- ✅ Mobile app (PWA)
- ✅ Advanced analytics
- ✅ Seller tools (bulk listing, analytics)
- ✅ Promoted listings
- ✅ Coupon codes
- ✅ Referral system
- ✅ Multi-language support (English, Twi, Ga)
- ✅ AI-powered recommendations
- ✅ Image recognition for auto-categorization

---

## 🛠️ TECH STACK

### **Frontend**
- **HTML5** - Semantic markup
- **CSS3** - Modern styling (CSS Grid, Flexbox, CSS Variables)
- **JavaScript (ES6+)** - Client-side logic
- **Font Awesome 6** - Icons
- **Google Fonts** - Typography (Poppins, Inter)

### **Backend (Firebase)**
- **Firebase Authentication** - User login/registration
- **Cloud Firestore** - NoSQL database
- **Firebase Storage** - File uploads (images)
- **Firebase Hosting** - Web hosting
- **Firebase Cloud Functions** - Server-side logic (optional)
- **Firebase Cloud Messaging** - Push notifications

### **Payment Gateway**
- **Paystack** - Mobile Money (MTN, Vodafone, AirtelTigo), Cards, Bank Transfers

### **Additional Tools**
- **Git** - Version control
- **npm** - Package management (optional)

---

## 🗄️ DATABASE SCHEMA

### **Firestore Collections**

#### **1. users**
```javascript
{
  uid: "user_uid",
  email: "user@example.com",
  phone: "+233201234567",
  userType: "buyer" | "seller" | "admin",
  firstName: "Kwame",
  lastName: "Asante",
  profilePhoto: "https://...",
  city: "Accra",
  region: "Greater Accra",
  bio: "Passionate about...",
  isVerified: true,
  verificationDocuments: {
    idCard: "https://...",
    selfie: "https://..."
  },
  rating: 4.8,
  totalReviews: 45,
  totalSales: 23,
  totalPurchases: 15,
  wishlist: ["product_id_1", "product_id_2"],
  createdAt: timestamp,
  isActive: true
}
```

#### **2. products**
```javascript
{
  productId: "product_uid",
  sellerId: "user_uid",
  title: "iPhone 12 Pro Max",
  description: "Excellent condition, 1 year old...",
  category: "Electronics",
  subcategory: "Phones",
  price: 5500,
  condition: "Like New",
  images: ["url1", "url2", "url3"],
  location: {
    city: "Accra",
    region: "Greater Accra",
    coordinates: { lat: 5.6037, lng: -0.1870 }
  },
  isFeatured: false,
  isSold: false,
  views: 234,
  favorites: 45,
  createdAt: timestamp,
  updatedAt: timestamp,
  isActive: true
}
```

#### **3. categories**
```javascript
{
  categoryId: "category_uid",
  name: "Electronics",
  icon: "fas fa-mobile-alt",
  subcategories: [
    { id: "phones", name: "Phones", icon: "fas fa-mobile" },
    { id: "laptops", name: "Laptops", icon: "fas fa-laptop" },
    { id: "tablets", name: "Tablets", icon: "fas fa-tablet-alt" }
  ],
  isActive: true
}
```

#### **4. orders**
```javascript
{
  orderId: "order_uid",
  productId: "product_uid",
  buyerId: "user_uid",
  sellerId: "user_uid",
  status: "pending" | "paid" | "shipped" | "completed" | "cancelled" | "disputed",
  price: 5500,
  paymentMethod: "mobile_money" | "card" | "bank_transfer",
  paymentStatus: "pending" | "paid" | "refunded",
  paymentReference: "paystack_ref",
  shippingAddress: {
    name: "Kwame Asante",
    phone: "+233201234567",
    address: "123 Independence Ave",
    city: "Accra",
    region: "Greater Accra"
  },
  createdAt: timestamp,
  paidAt: timestamp,
  shippedAt: timestamp,
  completedAt: timestamp
}
```

#### **5. messages**
```javascript
{
  messageId: "message_uid",
  conversationId: "conversation_uid",
  senderId: "user_uid",
  receiverId: "user_uid",
  productId: "product_uid",
  message: "Is this still available?",
  imageUrl: "https://...",
  isRead: false,
  createdAt: timestamp
}
```

#### **6. reviews**
```javascript
{
  reviewId: "review_uid",
  orderId: "order_uid",
  reviewerId: "user_uid",
  reviewedUserId: "user_uid",
  rating: 5,
  comment: "Excellent seller, fast shipping!",
  createdAt: timestamp
}
```

#### **7. conversations**
```javascript
{
  conversationId: "conversation_uid",
  participants: ["user_uid_1", "user_uid_2"],
  productId: "product_uid",
  lastMessage: "Is this still available?",
  lastMessageAt: timestamp,
  unreadCount: {
    "user_uid_1": 0,
    "user_uid_2": 1
  }
}
```

#### **8. transactions** (Escrow System)
```javascript
{
  transactionId: "txn_uid",
  orderId: "order_uid",
  buyerId: "user_uid",
  sellerId: "user_uid",
  amount: 5500,
  commission: 275, // 5% of amount
  netAmount: 5225, // amount - commission
  status: "pending" | "held" | "released" | "refunded" | "cancelled",
  paymentMethod: "card" | "momo_mtn" | "momo_vodafone" | "momo_airteltigo",
  paymentReference: "paystack_ref",
  momoPhone: "0241234567", // if MoMo payment
  escrowHeldAt: timestamp,
  escrowReleasedAt: timestamp,
  autoReleaseAt: timestamp, // 48 hours after delivery
  disputeId: "dispute_uid", // if disputed
  createdAt: timestamp
}
```

#### **9. disputes** (Dispute Resolution)
```javascript
{
  disputeId: "dispute_uid",
  transactionId: "txn_uid",
  orderId: "order_uid",
  raisedBy: "buyer" | "seller",
  reason: "item_not_received" | "item_not_as_described" | "defective" | "wrong_item" | "other",
  description: "The item arrived damaged...",
  status: "open" | "under_review" | "resolved",
  buyerEvidence: ["image_url_1", "image_url_2"],
  sellerEvidence: ["image_url_1", "image_url_2"],
  resolution: "refund_buyer" | "release_to_seller" | "split_50_50",
  adminNotes: "After reviewing evidence...",
  resolvedBy: "admin_uid",
  resolvedAt: timestamp,
  createdAt: timestamp
}
```

---

## 📁 PROJECT STRUCTURE

```
sankofa-market/
├── index.html                          # Landing page (like Goofish homepage)
├── search.html                         # Search results page
├── product-detail.html                 # Product detail page
├── publish.html                        # Create/edit listing
├── confirm-delivery.html               # Buyer delivery confirmation (escrow)
├── ESCROW_TERMS.md                     # Escrow legal terms
├── css/
│   ├── main.css                       # Main stylesheet
│   ├── auth.css                       # Authentication styles
│   ├── product.css                    # Product pages styles
│   ├── chat.css                       # Chat styles
│   ├── confirm-delivery.css           # Delivery confirmation styles
│   └── disputes.css                   # Dispute resolution styles
├── js/
│   ├── main.js                        # Main JavaScript
│   ├── auth.js                        # Authentication logic
│   ├── product.js                     # Product logic
│   ├── search.js                      # Search logic
│   ├── chat.js                        # Chat logic
│   ├── payment.js                     # Payment + escrow logic
│   ├── confirm-delivery.js            # Buyer confirmation logic
│   └── disputes-admin.js              # Admin dispute resolution
├── images/
│   ├── logos/                         # Brand logos
│   ├── products/                      # Product images
│   ├── categories/                    # Category icons
│   └── users/                         # User avatars
├── pages/
│   ├── auth/
│   │   ├── login.html                # Login page
│   │   ├── register.html             # Registration page
│   │   ├── forgot-password.html      # Password reset
│   │   └── verify.html               # Email/phone verification
│   ├── user/
│   │   ├── dashboard.html            # User dashboard
│   │   ├── profile.html              # User profile
│   │   ├── my-listings.html          # My listings (seller)
│   │   ├── my-orders.html            # My orders (buyer)
│   │   ├── wishlist.html             # Wishlist/favorites
│   │   └── settings.html             # Account settings
│   ├── product/
│   │   ├── browse.html               # Browse by category
│   │   ├── detail.html               # Product detail
│   │   ├── create.html               # Create listing
│   │   └── edit.html                 # Edit listing
│   ├── chat/
│   │   ├── inbox.html                # Chat inbox
│   │   └── conversation.html         # Chat conversation
│   └── admin/
│       ├── dashboard.html            # Admin dashboard
│       ├── users.html                # User management
│       ├── products.html             # Product moderation
│       ├── orders.html               # Order management
│       ├── disputes.html             # Dispute resolution
│       └── reports.html              # Reports/analytics
├── config/
│   └── firebase-config.js            # Firebase configuration
├── data/
│   └── categories.json               # Categories data
└── README.md                          # This file
```

---

## 🚀 DEVELOPMENT PHASES

### **Phase 1: Foundation (Weeks 1-2)**

#### **Week 1: Setup & Authentication**
- ✅ Project structure
- ✅ Firebase setup
- ✅ User authentication (login/register)
- ✅ User profiles
- ✅ User verification
- ✅ Basic UI/UX

#### **Week 2: Product Management**
- ✅ Create product listings
- ✅ Product categories
- ✅ Product detail pages
- ✅ Image upload
- ✅ Search functionality
- ✅ Basic filtering

### **Phase 2: Core Features (Weeks 3-4)**

#### **Week 3: Communication & Transactions**
- ✅ Real-time chat
- ✅ Shopping cart
- ✅ Checkout flow
- ✅ Payment integration (Paystack)
- ✅ Order management

#### **Week 4: Trust & Safety**
- ✅ User ratings and reviews
- ✅ Report system
- ✅ Admin dashboard
- ✅ Product moderation
- ✅ Dispute resolution

### **Phase 3: Payments & Escrow (Weeks 5-6)** ✅ COMPLETED

#### **Week 5: Payment Integration**
- ✅ Paystack integration (cards + Mobile Money)
- ✅ Payment validation and error handling
- ✅ Transaction logging
- ✅ Payment success/failure pages

#### **Week 6: Escrow Protection System**
- ✅ Escrow payment flow (hold funds until delivery confirmed)
- ✅ 48-hour auto-release timer
- ✅ Buyer confirmation page with photo evidence
- ✅ Dispute resolution system (admin dashboard)
- ✅ Dispute evidence collection (photos from both parties)
- ✅ Admin decision workflow (refund/release/split)
- ✅ Escrow terms of service (legal documentation)

### **Phase 4: Advanced Features (Weeks 7-8)**

#### **Week 5: Advanced Features**
- ✅ Push notifications
- ✅ PWA support
- ✅ Advanced search
- ✅ Recommendations
- ✅ Analytics

#### **Week 6: Polish & Launch**
- ✅ Testing
- ✅ Bug fixes
- ✅ Performance optimization
- ✅ Deployment
- ✅ Launch

---

## 🔥 FIREBASE SETUP

### **Step 1: Create Firebase Project**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Name: `sankofa-market`
4. Enable Google Analytics (optional)
5. Click "Create Project"

### **Step 2: Enable Services**

**Authentication:**
1. Go to **Authentication** → **Get Started**
2. Enable **Email/Password**
3. Enable **Phone Authentication** (optional)
4. Enable **Google Sign-In** (optional)

**Firestore Database:**
1. Go to **Firestore Database** → **Create Database**
2. Choose **"Start in production mode"**
3. Select location (e.g., `eur3`)
4. Click **Enable**

**Storage:**
1. Go to **Storage** → **Get Started**
2. Choose **"Start in production mode"**
3. Select same location as Firestore
4. Click **Done**

### **Step 3: Get Firebase Config**
1. Go to **Project Settings** (⚙️)
2. Scroll to **"Your apps"**
3. Click **web icon** `</>`
4. Register app: `sankofa-market-web`
5. Copy config object

### **Step 4: Update Config File**
Open `config/firebase-config.js` and replace placeholder config.

### **Step 5: Security Rules**

**Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Products
    match /products/{productId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
                             request.auth.uid == resource.data.sellerId;
    }
    
    // Orders
    match /orders/{orderId} {
      allow read: if request.auth != null && 
                    (request.auth.uid == resource.data.buyerId ||
                     request.auth.uid == resource.data.sellerId);
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
    
    // Messages
    match /messages/{messageId} {
      allow read: if request.auth != null && 
                    (request.auth.uid == resource.data.senderId ||
                     request.auth.uid == resource.data.receiverId);
      allow create: if request.auth != null;
    }
    
    // Reviews
    match /reviews/{reviewId} {
      allow read: if true;
      allow create: if request.auth != null;
    }
  }
}
```

**Storage Rules:**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /products/{productId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 🌐 DEPLOYMENT

### **Deploy to Firebase Hosting**

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Initialize Firebase**
   ```bash
   firebase init
   ```
   - Select **Hosting**
   - Choose your project
   - Public directory: `.`
   - Single-page app: **No**

4. **Deploy**
   ```bash
   firebase deploy
   ```

5. **Access your site**
   - URL: `https://sankofa-market.web.app`

### **Custom Domain**
1. Go to **Firebase Console** → **Hosting**
2. Click **Add custom domain**
3. Enter: `sankofamarket.com`
4. Follow DNS instructions
5. Wait for SSL certificate

---

## 🎯 NEXT STEPS

### **Immediate (This Week)**
1. ✅ Set up Firebase
2. ✅ Build authentication system
3. ✅ Create product listing system
4. ✅ Build search functionality

### **This Month**
1. ✅ Implement chat system
2. ✅ Add payment integration (Paystack)
3. ✅ Build admin dashboard
4. ✅ **Implement escrow payment protection**
5. ✅ **Build dispute resolution system**
6. ✅ **Create buyer confirmation flow**
7. ✅ Test all features

### **Next Month**
1. Deploy to production
2. Set up custom domain
3. Launch marketing campaign
4. Acquire first users
5. Monitor escrow transactions
6. Optimize dispute resolution process

---

## 📊 SUCCESS METRICS

### **Launch Goals (First 3 Months)**
- **1,000 registered users**
- **500 product listings**
- **100 successful transactions**
- **4.5+ average rating**
- **GHS 50,000 GMV (Gross Merchandise Value)**

### **Growth Goals (First Year)**
- **10,000 registered users**
- **5,000 product listings**
- **1,000 successful transactions**
- **GHS 500,000 GMV**
- **Expand to 5 cities in Ghana**

---

## 🇬🇭 MADE IN GHANA

**Sankofa Market** - Give Your Items New Life! 🦅💛

**Questions?** Contact support@sankofamarket.com

**Website:** https://sankofamarket.com

**GitHub:** https://github.com/your-username/sankofa-market

---

**Let's build Ghana's premier marketplace together!** 🚀
