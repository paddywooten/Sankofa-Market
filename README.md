# 🇬🇭 Sankofa Market

**Ghana's #1 Online Marketplace** — A C2C marketplace platform inspired by eBay and Xianyu/Goofish.

![Sankofa Market](images/logos/sankofa-market-logo-full-color.png)

## ✨ Features

- **🎠 Hero Carousel** — Auto-swiping promotional carousel with 5 slides, touch/swipe support, and progress indicators
- **🛒 13+ Categories** — Electronics, Fashion, Home & Garden, Vehicles, Services, Sports, Books & Media, Baby & Kids, Beauty & Health, Food & Groceries, Pets, Jobs & Skills, Real Estate
- **🏪 Sankofa Store** — Official in-house store with verified products and badges
- **🔍 Smart Search** — Full search with filters (category, price range, condition, location, seller type, delivery options)
- **🛡️ Escrow Payment Protection** — Secure payment system that holds funds until buyer confirms delivery
- **💳 Paystack Integration** — Card payments + Mobile Money (MTN, Vodafone, AirtelTigo)
- **⚖️ Dispute Resolution** — Admin-managed dispute system with evidence collection and fair resolution
- **📦 Buyer Confirmation Flow** — Post-delivery inspection with photo evidence and 48-hour auto-release
- **🆔 User Verification System** — Ghana Card and passport photo verification with admin approval workflow
- **🚚 Delivery Options** — Sellers specify free delivery, paid delivery, or pickup only; buyers filter by preference
- **🔒 Payment Safety Warnings** — Comprehensive warnings about platform-only payments and secure communication
- **📱 Fully Responsive** — Works on mobile, tablet, and desktop
- **🎨 eBay-Inspired Design** — Clean, professional marketplace UI with eBay blue (#0064d2) and orange (#f5af02) color scheme
- **🖼️ Real Product Images** — High-quality product photography from Unsplash
- **🔥 Firebase Ready** — Pre-configured for Firebase Auth, Firestore, and Storage

## 🚀 Quick Start

### Option 1: Python (Simple)
```bash
cd sankofa-market
python3 -m http.server 8080
# Open http://localhost:8080
```

### Option 2: Node.js (Live Server)
```bash
npm install -g live-server
live-server --port=8080
```

### Option 3: VS Code
Open the project in VS Code and use the **Live Server** extension.

## 🔧 Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication** (Email/Password, Google)
4. Create a **Firestore** database
5. Enable **Storage**
6. Copy your config into `config/firebase-config.js`:

```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

Without Firebase configured, the site runs in **demo mode** with sample products and real images.

## 🛡️ Escrow Payment Protection System

Sankofa Market includes a complete escrow system that protects both buyers and sellers:

### How It Works:
1. **Buyer pays** → Funds held in escrow (not sent to seller)
2. **Seller ships** → Buyer receives item
3. **Buyer inspects** (48 hours) → Confirms item matches listing
4. **Funds released** → Seller receives payment (minus 5% commission)

### Key Features:
- **Mobile Money Support** — MTN, Vodafone, AirtelTigo via Paystack
- **Card Payments** — Visa, Mastercard via Paystack
- **Auto-Release Timer** — 48-hour countdown with visual indicator
- **Dispute Resolution** — Admin reviews evidence and makes fair decisions
- **Photo Evidence** — Both parties upload photos for comparison
- **5% Commission** — Automatically deducted from seller payout

### Files:
- `js/payment.js` — Paystack integration and escrow logic
- `confirm-delivery.html` — Buyer confirmation page
- `pages/admin/disputes.html` — Admin dispute resolution dashboard
- `ESCROW_TERMS.md` — Complete legal terms of service

### Usage:
```javascript
// Initialize payment
PaymentSystem.initializePayment(orderData, 'card');
PaymentSystem.initializeMomoPayment(orderData, 'mtn', '0241234567');

// Release escrow (after buyer confirms)
PaymentSystem.releaseEscrow(transactionId, confirmedBy);

// Refund escrow (after dispute resolution)
PaymentSystem.refundEscrow(transactionId, reason, adminId);
```

See [ESCROW_TERMS.md](ESCROW_TERMS.md) for complete legal documentation.

## 🆔 User Verification System

Sankofa Market implements a robust identity verification system to ensure a safe marketplace:

### Registration Requirements:
- **Ghana Card Upload** — Front and back photos (required)
- **Passport Photo** — Clear photo of the user (required)
- **Admin Approval** — All new accounts require admin review before publishing

### Verification Workflow:
1. **User registers** → Uploads Ghana Card + passport photo
2. **Account status: Pending** → User cannot publish listings
3. **Admin reviews** → Checks documents in approval dashboard
4. **Admin approves/rejects** → User receives notification
5. **Approved users** → Can publish listings and transact

### Admin Approval Dashboard:
- View pending registrations with document previews
- Approve or reject with optional reason
- Track approval history and timestamps
- Filter by status (pending/approved/rejected)

### Security Benefits:
- ✅ Prevents fake accounts and scams
- ✅ Ensures all sellers are verified Ghanaians
- ✅ Creates accountability for transactions
- ✅ Builds trust in the marketplace

## 🚚 Delivery Options

Sellers can specify how buyers receive items:

### Seller Options:
- 🚚 **Free Delivery** — Seller delivers at no extra cost
- 💰 **Paid Delivery** — Buyer pays delivery fee (seller sets amount)
- 🏪 **Pickup Only** — Buyer picks up from seller's location

### Buyer Filters:
- Filter products by preferred delivery method
- See delivery badges on product cards
- View delivery fees upfront

### Product Card Badges:
- 🟢 **Green**: Free Delivery
- 🔵 **Blue**: Paid Delivery (shows fee)
- 🟠 **Orange**: Pickup Only

## 🔒 Payment Safety System

Comprehensive warnings protect users from fraud:

### Payment Page Warnings:
- ⚠️ Only pay through Sankofa Market platform
- ⚠️ Never send money directly to sellers
- ⚠️ Escrow protection only works for platform payments
- ⚠️ Red flags to watch for (off-platform payment requests)

### Delivery Charge Warnings:
- 📦 Only delivery fees are paid during delivery
- 📦 Item price already paid through platform
- 📦 Never pay sellers additional amounts

### Communication Safety:
- 💬 Only communicate through platform messaging
- 💬 Never share personal contact details
- 💬 All conversations recorded for disputes
- 💬 Report sellers who request off-platform communication

### Warning Types:
- **Standard** (Yellow) — General payment safety
- **Critical** (Red) — Suspicious activity detected
- **Info** (Blue) — Communication guidelines
- **Delivery** (Blue border) — Delivery charge reminders

## 📁 Project Structure

```
sankofa-market/
├── index.html              # Homepage with carousel
├── search.html             # Search & browse page
├── confirm-delivery.html   # Buyer delivery confirmation (escrow)
├── ESCROW_TERMS.md         # Escrow terms of service
├── config/
│   └── firebase-config.js  # Firebase configuration
├── css/
│   ├── main.css            # Main styles (eBay-inspired)
│   ├── search.css          # Search page styles
│   ├── confirm-delivery.css # Delivery confirmation styles
│   └── disputes.css        # Dispute resolution styles
├── js/
│   ├── main.js             # Core utilities & auth
│   ├── carousel.js         # Hero carousel logic
│   ├── home.js             # Homepage product rendering
│   ├── search.js           # Search & filtering
│   ├── payment.js          # Paystack + escrow system
│   ├── confirm-delivery.js # Buyer confirmation logic
│   ├── disputes-admin.js   # Admin dispute resolution
│   ├── user-approvals.js   # Admin user approval workflow
│   ├── payment-warnings.js # Reusable safety warning components
│   └── auth.js             # Registration with verification
├── css/
│   ├── main.css            # Main styles
│   ├── search.css          # Search page styles
│   ├── publish.css         # Publish form styles
│   ├── admin.css           # Admin dashboard styles
│   ├── payment-warnings.css # Safety warning styles
│   └── auth.css            # Authentication styles
├── pages/
│   ├── admin/
│   │   ├── dashboard.html      # Admin overview
│   │   ├── disputes.html       # Dispute management
│   │   └── user-approvals.html # User verification approvals
│   ├── auth/
│   │   ├── login.html          # User login
│   │   └── register.html       # User registration with verification
│   └── user/
│       └── dashboard.html      # User account
├── data/
│   └── categories.json     # 13 category definitions
├── brand-assets/           # Logo files
└── images/
    └── logos/              # Brand assets
```

## 🎨 Design System

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#0064d2` | eBay Blue — trust, navigation |
| Accent | `#f5af02` | eBay Orange — CTAs, badges |
| Success | `#86b817` | Green — confirmed states |
| Error | `#e74c3c` | Red — errors, hot deals |
| Text Primary | `#191919` | Near-black text |
| Text Secondary | `#767676` | Gray text |

## 🛠️ Tech Stack

- **HTML5** — Semantic markup
- **CSS3** — Custom properties, Grid, Flexbox, animations
- **Vanilla JavaScript** — No frameworks, fast and lightweight
- **Firebase** — Auth, Firestore, Storage (optional)
- **Font Awesome 6** — Icons
- **Google Fonts** — Poppins + Inter typography

## 📄 License

© 2026 Sankofa Market. All rights reserved.

---

Made with ❤️ in Ghana 🇬🇭
