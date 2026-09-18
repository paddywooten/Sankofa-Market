# SANKOFA MARKET GHANA
## Information Architecture

**Document Reference:** SM-IA-001  
**Version:** 1.0  
**Date:** January 2026  
**Classification:** Business Confidential

---

## DOCUMENT CONTROL

| **Prepared By:** | UX Designer, Information Architect |
| **Reviewed By:** | Product Manager, Technical Lead |
| **Approved By:** | Project Steering Committee |
| **Distribution:** | Design Team, Development Team, Product Team |

---

## 1. INTRODUCTION

### 1.1 Purpose
This document defines the information architecture (IA) for the Sankofa Market Ghana platform. It provides a blueprint for organizing, structuring, and labeling content to help users find information and complete tasks efficiently.

### 1.2 Scope
This document covers:
- Site structure and navigation
- Content organization and taxonomy
- User flows and task flows
- Labeling and terminology
- Search and filtering architecture
- Metadata and tagging strategy

### 1.3 Information Architecture Principles

Our information architecture is guided by these principles:

**User-Centered Design:**
- Structure based on user mental models
- Navigation based on user tasks
- Labels use user language
- Organization reflects user priorities

**Findability:**
- Multiple ways to find information
- Clear navigation paths
- Effective search functionality
- Logical content grouping

**Clarity:**
- Clear, concise labels
- Unambiguous terminology
- Consistent naming conventions
- Plain language

**Scalability:**
- Structure accommodates growth
- Flexible taxonomy
- Extensible navigation
- Modular design

**Accessibility:**
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader friendly
- Clear information hierarchy

---

## 2. USER RESEARCH AND PERSONAS

### 2.1 User Research Methods

#### Research Conducted

**User Interviews:**
- 20 interviews with potential users
- Mix of buyers and sellers
- Various age groups and tech literacy levels
- Urban and rural locations

**Surveys:**
- 500+ survey responses
- User preferences and behaviors
- Pain points and needs
- Feature priorities

**Competitive Analysis:**
- Analysis of 10 competitor platforms
- Best practices identification
- Gap analysis
- Differentiation opportunities

**Card Sorting:**
- Open card sorting with 30 participants
- Closed card sorting with 25 participants
- Category validation
- Label testing

**Tree Testing:**
- Tree testing with 40 participants
- Navigation structure validation
- Findability testing
- Task completion analysis

### 2.2 User Personas

#### Persona 1: Kwame - The Small Business Owner
**Information Needs:**
- How to list products efficiently
- How to manage inventory
- How to track sales and revenue
- How to communicate with buyers
- How to handle orders and shipping

**Information Seeking Behavior:**
- Task-oriented (wants to complete specific tasks)
- Efficiency-focused (wants quick access to tools)
- Mobile-first (uses phone for business)
- Visual learner (prefers images and videos)

**Pain Points:**
- Complex listing processes
- Difficult inventory management
- Poor order tracking
- Limited analytics

#### Persona 2: Ama - The Bargain Hunter
**Information Needs:**
- How to find specific products
- How to compare prices and quality
- How to verify seller credibility
- How to track orders
- How to leave reviews

**Information Seeking Behavior:**
- Search-oriented (uses search frequently)
- Comparison-focused (compares multiple options)
- Review-dependent (reads reviews before buying)
- Mobile-dominant (browses on phone)

**Pain Points:**
- Difficulty finding specific items
- Hard to compare products
- Unclear seller ratings
- Poor search results

#### Persona 3: Yaw - The Casual Seller
**Information Needs:**
- How to list items simply
- How to price items appropriately
- How to communicate with buyers
- How to handle payments
- How to ship items

**Information Seeking Behavior:**
- Simplicity-focused (wants easy processes)
- Guidance-seeking (needs help and tips)
- Mobile-only (uses phone exclusively)
- Visual learner (prefers step-by-step guides)

**Pain Points:**
- Complicated listing process
- Unclear pricing guidance
- Difficult communication
- Complex payment processes

#### Persona 4: Efua - The Power Seller
**Information Needs:**
- Advanced listing tools
- Bulk operations
- Detailed analytics
- Marketing tools
- Customer management

**Information Seeking Behavior:**
- Power user (knows what she wants)
- Efficiency-focused (wants shortcuts)
- Desktop-dominant (uses computer for business)
- Data-driven (relies on analytics)

**Pain Points:**
- Limited bulk operations
- Basic analytics
- No marketing tools
- Poor customer management

### 2.3 User Tasks

#### Buyer Tasks

**Primary Tasks:**
1. Search for products
2. Browse categories
3. View product details
4. Compare products
5. Add to cart/wishlist
6. Checkout and pay
7. Track orders
8. Leave reviews

**Secondary Tasks:**
1. Create account
2. Verify identity
3. Manage profile
4. Contact seller
5. File disputes
6. View order history
7. Manage addresses
8. Manage payment methods

#### Seller Tasks

**Primary Tasks:**
1. Create product listing
2. Manage listings
3. Process orders
4. Communicate with buyers
5. Track sales
6. Receive payments
7. Handle disputes
8. View analytics

**Secondary Tasks:**
1. Create account
2. Verify identity
3. Manage profile
4. Manage inventory
5. Set up payment methods
6. View reviews
7. Respond to reviews
8. Manage shipping

#### Admin Tasks

**Primary Tasks:**
1. Manage users
2. Moderate products
3. Resolve disputes
4. View analytics
5. Generate reports
6. Manage categories
7. Configure settings
8. Monitor system

**Secondary Tasks:**
1. Manage admins
2. View logs
3. Manage integrations
4. Configure payment methods
5. Manage notifications
6. View audit trails
7. Manage backups
8. Monitor performance

---

## 3. SITE STRUCTURE

### 3.1 High-Level Structure

The site follows a **hybrid structure** combining hierarchical, sequential, and matrix structures:

**Hierarchical Structure:**
- Main categories at top level
- Subcategories nested under main categories
- Products at leaf level
- Clear parent-child relationships

**Sequential Structure:**
- Checkout process (step-by-step)
- Registration process (step-by-step)
- Listing creation (step-by-step)
- Dispute resolution (step-by-step)

**Matrix Structure:**
- Products accessible via multiple paths (category, search, filters)
- Users can navigate laterally between related items
- Cross-linking between related content

### 3.2 Top-Level Navigation

#### Primary Navigation (Header)

**Logo:**
- Links to homepage
- Always visible
- Brand identifier

**Search Bar:**
- Prominent placement
- Always accessible
- Autocomplete suggestions
- Search filters

**Main Menu:**
- Home
- Categories (mega menu)
- Sankofa Store
- Sell
- Help

**User Menu:**
- Sign In / Sign Up (for guests)
- My Account (for logged-in users)
  - Dashboard
  - My Orders
  - My Listings
  - Wishlist
  - Messages
  - Settings
- Notifications
- Logout

#### Secondary Navigation (Footer)

**About:**
- About Us
- Our Story
- Team
- Careers
- Press

**Support:**
- Help Center
- Contact Us
- FAQs
- Safety Tips
- Report Issue

**Legal:**
- Terms of Service
- Privacy Policy
- Refund Policy
- Cookie Policy
- Acceptable Use Policy

**Connect:**
- Facebook
- Twitter
- Instagram
- LinkedIn
- Blog

### 3.3 Category Structure

#### Main Categories (14)

1. **Electronics**
   - Phones & Tablets
   - Computers & Laptops
   - TVs & Audio
   - Cameras & Photography
   - Gaming
   - Accessories

2. **Fashion**
   - Men's Clothing
   - Women's Clothing
   - Kids' Clothing
   - Shoes
   - Accessories
   - Bags

3. **Home & Garden**
   - Furniture
   - Home Decor
   - Kitchen & Dining
   - Garden & Outdoor
   - Tools & Hardware
   - Cleaning Supplies

4. **Vehicles**
   - Cars
   - Motorcycles
   - Bicycles
   - Vehicle Parts
   - Vehicle Accessories

5. **Services**
   - Professional Services
   - Home Services
   - Event Services
   - Beauty Services
   - Repair Services
   - Tutoring

6. **Sports & Outdoors**
   - Fitness Equipment
   - Sports Gear
   - Outdoor Gear
   - Sportswear
   - Camping
   - Water Sports

7. **Books & Media**
   - Books
   - Music
   - Movies & TV
   - Video Games
   - Educational Materials
   - Magazines

8. **Baby & Kids**
   - Baby Clothing
   - Kids' Clothing
   - Toys & Games
   - Baby Gear
   - Kids' Furniture
   - School Supplies

9. **Beauty & Health**
   - Skincare
   - Makeup
   - Hair Care
   - Fragrances
   - Health & Wellness
   - Personal Care

10. **Food & Groceries**
    - Fresh Produce
    - Packaged Foods
    - Beverages
    - Snacks
    - Organic Foods
    - Local Specialties

11. **Pets**
    - Pet Food
    - Pet Accessories
    - Pet Health
    - Pet Toys
    - Pet Grooming
    - Pet Services

12. **Jobs & Skills**
    - Job Listings
    - Freelance Services
    - Skill Development
    - Training Courses
    - Career Resources
    - Internships

13. **Real Estate**
    - Property for Sale
    - Property for Rent
    - Land for Sale
    - Commercial Property
    - Real Estate Services
    - Property Management

14. **Sankofa Store** (Official Store)
    - Featured Products
    - Electronics
    - Fashion
    - Home & Garden
    - Beauty & Health
    - Sports & Outdoors

### 3.4 Page Types

#### Landing Pages

**Homepage:**
- Hero banner with promotions
- Featured categories
- Trending products
- Recently listed items
- Sankofa Store highlights
- Trust indicators

**Category Pages:**
- Category description
- Subcategory navigation
- Product listings
- Filters and sorting
- Related categories

**Search Results:**
- Search query display
- Result count
- Filters and sorting
- Product listings
- Related searches

#### Content Pages

**Product Detail Page:**
- Product images (gallery)
- Product title and price
- Product description
- Seller information
- Delivery options
- Reviews and ratings
- Related products
- Add to cart/wishlist

**Listing Creation Page:**
- Step-by-step wizard
- Image upload
- Product details form
- Pricing and delivery
- Preview
- Submit

**User Dashboard:**
- Overview statistics
- Recent activity
- Quick actions
- Notifications
- Performance metrics

#### Transaction Pages

**Shopping Cart:**
- Cart items
- Quantity adjustment
- Price summary
- Delivery options
- Proceed to checkout

**Checkout:**
- Delivery address
- Payment method
- Order summary
- Terms acceptance
- Place order

**Order Confirmation:**
- Order number
- Order details
- Expected delivery
- Next steps
- Continue shopping

**Order Tracking:**
- Order status timeline
- Delivery information
- Order details
- Contact seller
- Report issue

#### Account Pages

**Registration:**
- Step-by-step form
- Ghana Card verification
- Email verification
- Phone verification
- Terms acceptance

**Login:**
- Email and password
- Remember me
- Forgot password
- Sign up link

**Profile:**
- Personal information
- Profile picture
- Verification status
- Edit profile

**Settings:**
- Account settings
- Notification preferences
- Privacy settings
- Security settings
- Payment methods

#### Support Pages

**Help Center:**
- Search help articles
- Browse categories
- Popular articles
- Contact support

**Contact Us:**
- Contact form
- Email addresses
- Phone numbers
- Office address
- Social media

**FAQs:**
- Searchable FAQs
- Categorized questions
- Popular questions
- Related articles

#### Admin Pages

**Admin Dashboard:**
- System statistics
- Recent activity
- Alerts and notifications
- Quick actions
- Performance metrics

**User Management:**
- User list
- User search
- User details
- User actions (verify, suspend, ban)
- Bulk operations

**Product Moderation:**
- Product queue
- Product review
- Approval/rejection
- Bulk operations
- Moderation logs

**Dispute Resolution:**
- Dispute list
- Dispute details
- Evidence review
- Decision making
- Resolution tracking

---

## 4. NAVIGATION DESIGN

### 4.1 Navigation Patterns

#### Global Navigation (Header)

**Desktop:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo]  [Search Bar]              [Sell] [Account ▼] [🔔] │
├─────────────────────────────────────────────────────────────┤
│ Home  Categories▼  Sankofa Store  Help                      │
└─────────────────────────────────────────────────────────────┘
```

**Mobile:**
```
┌─────────────────────────────────────┐
│ [☰]  [Logo]           [🔍]  [👤]  │
└─────────────────────────────────────┘
```

#### Mega Menu (Categories)

**Desktop:**
```
┌─────────────────────────────────────────────────────────────┐
│ Electronics          Fashion            Home & Garden       │
│ ├─ Phones           ├─ Men's           ├─ Furniture        │
│ ├─ Computers        ├─ Women's         ├─ Decor            │
│ ├─ TVs              ├─ Kids'           ├─ Kitchen          │
│ ├─ Cameras          ├─ Shoes           ├─ Garden           │
│ └─ Gaming           └─ Accessories     └─ Tools            │
│                                                             │
│ Vehicles             Services           Sports              │
│ ├─ Cars             ├─ Professional    ├─ Fitness          │
│ ├─ Motorcycles      ├─ Home            ├─ Sports Gear      │
│ ├─ Bicycles         ├─ Events          ├─ Outdoor          │
│ └─ Parts            └─ Beauty          └─ Sportswear       │
└─────────────────────────────────────────────────────────────┘
```

#### Breadcrumb Navigation

**Product Page:**
```
Home > Electronics > Phones & Tablets > Smartphones > iPhone 14 Pro Max
```

**Category Page:**
```
Home > Electronics > Phones & Tablets
```

**Search Results:**
```
Home > Search Results for "iPhone 14"
```

#### Pagination

**Product Listings:**
```
[← Previous]  1  2  3  4  5  ...  20  [Next →]
```

**With Jump:**
```
[← Previous]  1  2  3  ...  10  ...  20  [Next →]
           [Go to page: [___] Go]
```

#### Infinite Scroll

**Alternative to Pagination:**
- Load more items as user scrolls
- "Load More" button at bottom
- Smooth loading animation
- Back to top button

### 4.2 Navigation Elements

#### Search Bar

**Desktop:**
```
┌──────────────────────────────────────┐
│ 🔍  Search for products...      [🔍] │
└──────────────────────────────────────┘
```

**Features:**
- Placeholder text: "Search for products..."
- Search icon on left
- Search button on right
- Autocomplete suggestions
- Recent searches
- Popular searches
- Search filters (category, price, condition)

**Mobile:**
```
┌─────────────────┐
│ 🔍  Search...   │
└─────────────────┘
```

**Expanded:**
```
┌─────────────────────────────────────┐
│ [←] Search for products...      [✕] │
├─────────────────────────────────────┤
│ Recent Searches:                    │
│ • iPhone 14                         │
│ • Samsung TV                        │
│ • Nike shoes                        │
│                                     │
│ Popular Searches:                   │
│ • Laptops                           │
│ • Phones                            │
│ • Furniture                         │
└─────────────────────────────────────┘
```

#### Filters

**Sidebar Filters (Desktop):**
```
┌─────────────────────────┐
│ Filters                 │
├─────────────────────────┤
│ Category                │
│ ☑ Electronics           │
│ ☐ Fashion               │
│ ☐ Home & Garden         │
│                         │
│ Price Range             │
│ Min: [________]        │
│ Max: [________]        │
│ [Apply]                 │
│                         │
│ Condition               │
│ ☑ New                   │
│ ☑ Like New              │
│ ☐ Good                  │
│ ☐ Fair                  │
│                         │
│ Location                │
│ [All Regions ▼]        │
│                         │
│ Delivery Options        │
│ ☑ Free Delivery         │
│ ☐ Paid Delivery         │
│ ☐ Pickup Only           │
│                         │
│ Seller Rating           │
│ ☑ 4 stars & up          │
│ ☐ 3 stars & up          │
│ ☐ 2 stars & up          │
│                         │
│ [Clear All] [Apply]     │
└─────────────────────────┘
```

**Filter Bar (Mobile):**
```
┌─────────────────────────────────────┐
│ [Filters] [Sort: Relevance ▼]      │
└─────────────────────────────────────┘
```

**Filter Modal (Mobile):**
```
┌─────────────────────────────────────┐
│ Filters                        [✕]  │
├─────────────────────────────────────┤
│ Category                            │
│ [All Categories ▼]                 │
│                                     │
│ Price Range                         │
│ Min: [________]  Max: [______]   │
│                                     │
│ Condition                           │
│ ( ) New  ( ) Like New              │
│ ( ) Good  ( ) Fair                 │
│                                     │
│ [Clear All]          [Apply Filters]│
└─────────────────────────────────────┘
```

#### Sorting

**Sort Dropdown:**
```
┌──────────────────────────┐
│ Sort by: Relevance    ▼ │
└──────────────────────────┘
  ┌────────────────────────┐
  │ ✓ Relevance            │
  │   Price: Low to High   │
  │   Price: High to Low   │
  │   Newest First         │
  │   Oldest First         │
  │   Most Popular         │
  │   Best Rating          │
  └────────────────────────┘
```

### 4.3 Navigation Best Practices

#### Consistency
- Same navigation structure across all pages
- Consistent placement of navigation elements
- Consistent behavior of navigation elements
- Consistent labeling and terminology

#### Visibility
- Navigation always visible (sticky header)
- Current location clearly indicated
- Breadcrumbs show path
- Active states for current page

#### Feedback
- Hover states for interactive elements
- Active states for current selection
- Loading states during navigation
- Error states for failed navigation

#### Accessibility
- Keyboard navigation support
- Screen reader friendly
- Clear focus indicators
- ARIA labels and roles

#### Mobile Optimization
- Touch-friendly tap targets (44x44px minimum)
- Swipe gestures for navigation
- Collapsible navigation for small screens
- Bottom navigation for thumb-friendly access

---

## 5. CONTENT ORGANIZATION

### 5.1 Content Types

#### Product Content

**Essential Information:**
- Product title (clear, descriptive)
- Product images (multiple, high-quality)
- Price (clear, prominent)
- Condition (new, like new, good, fair)
- Category (specific subcategory)
- Location (region, city)

**Detailed Information:**
- Product description (comprehensive)
- Specifications (technical details)
- Features and benefits
- Usage instructions
- Warranty information

**Seller Information:**
- Seller name
- Seller rating and reviews
- Verification status
- Response time
- Location

**Transaction Information:**
- Delivery options
- Delivery fees
- Payment methods
- Return policy
- Warranty terms

**Social Proof:**
- Customer reviews
- Star ratings
- Number of views
- Number of favorites
- Sold count

#### User Content

**Profile Information:**
- Name
- Profile picture
- Verification status
- Location
- Member since
- Rating and reviews

**Activity Information:**
- Listings (for sellers)
- Orders (for buyers)
- Reviews given
- Reviews received
- Favorites

**Communication:**
- Messages
- Notifications
- Contact information
- Response time

#### Help Content

**Articles:**
- How-to guides
- Tutorials
- FAQs
- Troubleshooting
- Best practices

**Categories:**
- Getting Started
- Buying
- Selling
- Payments
- Delivery
- Account Management
- Safety & Security
- Disputes & Refunds

**Formats:**
- Text articles
- Video tutorials
- Infographics
- Step-by-step guides
- Checklists

### 5.2 Content Hierarchy

#### Product Detail Page Hierarchy

```
1. Product Images (Gallery)
   ├─ Main image
   ├─ Thumbnail navigation
   └─ Fullscreen view

2. Product Information
   ├─ Title
   ├─ Price
   ├─ Condition badge
   ├─ Seller information
   ├─ Location
   └─ Posted date

3. Action Buttons
   ├─ Add to Cart
   ├─ Add to Wishlist
   ├─ Contact Seller
   └─ Share

4. Delivery Information
   ├─ Delivery options
   ├─ Delivery fees
   └─ Estimated delivery

5. Product Description
   ├─ Overview
   ├─ Specifications
   ├─ Features
   └─ What's included

6. Reviews and Ratings
   ├─ Overall rating
   ├─ Rating breakdown
   ├─ Customer reviews
   └─ Write a review

7. Related Products
   ├─ Similar products
   ├─ Same category
   └─ Same seller
```

#### Category Page Hierarchy

```
1. Category Header
   ├─ Category name
   ├─ Category description
   └─ Category image

2. Subcategory Navigation
   ├─ Subcategory grid
   └─ Quick links

3. Filters and Sorting
   ├─ Filter sidebar (desktop)
   ├─ Filter bar (mobile)
   └─ Sort dropdown

4. Product Listings
   ├─ Product grid
   ├─ Product cards
   └─ Infinite scroll/pagination

5. Related Categories
   ├─ Sibling categories
   └─ Parent category
```

#### Search Results Hierarchy

```
1. Search Header
   ├─ Search query
   ├─ Result count
   └─ Search suggestions

2. Filters and Sorting
   ├─ Filter sidebar (desktop)
   ├─ Filter bar (mobile)
   └─ Sort dropdown

3. Search Results
   ├─ Product grid
   ├─ Product cards
   └─ Infinite scroll/pagination

4. Related Searches
   ├─ Similar searches
   └─ Popular searches
```

### 5.3 Content Labeling

#### Labeling Principles

**User-Centered:**
- Use language users understand
- Avoid technical jargon
- Use familiar terms
- Test labels with users

**Clear and Concise:**
- Short, descriptive labels
- Avoid ambiguity
- Be specific
- Use action verbs for buttons

**Consistent:**
- Same label for same concept
- Consistent capitalization
- Consistent formatting
- Consistent terminology

**Scannable:**
- Easy to scan quickly
- Clear visual hierarchy
- Appropriate length
- Readable fonts

#### Label Examples

**Navigation Labels:**
- ✓ Home (not "Homepage" or "Main Page")
- ✓ Categories (not "Product Categories" or "Browse")
- ✓ My Account (not "User Account" or "Profile")
- ✓ Help (not "Support" or "Customer Service")

**Button Labels:**
- ✓ Add to Cart (not "Add" or "Buy")
- ✓ Checkout (not "Proceed" or "Continue")
- ✓ Place Order (not "Submit" or "Confirm")
- ✓ Contact Seller (not "Message" or "Email")

**Form Labels:**
- ✓ Email Address (not "Email" or "E-mail")
- ✓ Password (not "Pass" or "Pwd")
- ✓ Phone Number (not "Phone" or "Tel")
- ✓ Full Name (not "Name" or "Your Name")

**Error Messages:**
- ✓ "Please enter a valid email address" (not "Invalid email")
- ✓ "Password must be at least 8 characters" (not "Password too short")
- ✓ "This field is required" (not "Required" or "Missing")

---

## 6. SEARCH ARCHITECTURE

### 6.1 Search Functionality

#### Search Types

**Text Search:**
- Keyword search
- Phrase search
- Boolean operators (AND, OR, NOT)
- Wildcard search
- Fuzzy search (typo tolerance)

**Image Search:**
- Upload image
- Camera capture
- Image URL
- Visual similarity matching

**Voice Search:**
- Voice input
- Speech-to-text
- Natural language queries

**Autocomplete:**
- Real-time suggestions
- Popular searches
- Recent searches
- Category suggestions

#### Search Features

**Filters:**
- Category
- Price range
- Condition
- Location
- Delivery options
- Seller rating
- Date posted

**Sorting:**
- Relevance
- Price (low to high, high to low)
- Date (newest, oldest)
- Popularity
- Rating

**Faceted Search:**
- Dynamic facets based on results
- Facet counts
- Multi-select facets
- Facet drill-down

**Search Results:**
- Highlighted keywords
- Snippets
- Product images
- Quick view
- Add to cart

### 6.2 Search Algorithm

#### Relevance Ranking

**Factors:**
- Keyword match (title, description, category)
- Keyword position (title > description)
- Keyword frequency
- Product popularity (views, favorites, sales)
- Seller rating
- Recency
- Price competitiveness

**Boosting:**
- Featured products
- Sankofa Store products
- Verified sellers
- High-rated products
- New listings

**Penalties:**
- Low-rated sellers
- Reported products
- Out-of-stock items
- Old listings

#### Search Optimization

**Indexing:**
- Full-text indexing
- Metadata indexing
- Image indexing (for image search)
- Real-time indexing

**Query Processing:**
- Query parsing
- Spell correction
- Synonym expansion
- Stopword removal
- Stemming

**Result Processing:**
- Result ranking
- Result filtering
- Result pagination
- Result caching

### 6.3 Search Interface

#### Search Bar

**Desktop:**
```
┌──────────────────────────────────────────────────┐
│ 🔍  Search for products...                  [🔍] │
└──────────────────────────────────────────────────┘
```

**With Autocomplete:**
```
┌──────────────────────────────────────────────────┐
│ 🔍  iPhone 14                               [🔍] │
└──────────────────────────────────────────────────┘
  ┌────────────────────────────────────────────────┐
  │ iPhone 14 Pro Max                              │
  │ iPhone 14 Pro                                  │
  │ iPhone 14                                      │
  │ iPhone 14 cases                                │
  │ iPhone 14 screen protector                     │
  │                                                │
  │ Popular Searches:                              │
  │ • Laptops                                      │
  │ • Samsung TV                                   │
  │ • Nike shoes                                   │
  └────────────────────────────────────────────────┘
```

#### Search Results Page

**Header:**
```
┌─────────────────────────────────────────────────────────────┐
│ Search Results for "iPhone 14"                    1,234 results│
│                                                             │
│ [Filters] [Sort: Relevance ▼]  [Grid View] [List View]     │
└─────────────────────────────────────────────────────────────┘
```

**Results Grid:**
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   [Image]   │ │   [Image]   │ │   [Image]   │ │   [Image]   │
│             │ │             │ │             │ │             │
│ iPhone 14   │ │ iPhone 14   │ │ iPhone 14   │ │ iPhone 14   │
│ Pro Max     │ │ Pro         │ │             │ │ cases       │
│             │ │             │ │             │ │             │
│ GHS 8,500   │ │ GHS 7,200   │ │ GHS 6,500   │ │ GHS 50      │
│             │ │             │ │             │ │             │
│ ⭐ 4.8 (127)│ │ ⭐ 4.7 (89) │ │ ⭐ 4.9 (234)│ │ ⭐ 4.5 (45) │
│             │ │             │ │             │ │             │
│ Accra       │ │ Kumasi      │ │ Accra       │ │ Tema        │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**No Results:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              No results found for "xyz123"                 │
│                                                             │
│  Suggestions:                                               │
│  • Check spelling                                           │
│  • Try different keywords                                   │
│  • Try more general keywords                                │
│  • Remove filters                                           │
│                                                             │
│  Popular Searches:                                          │
│  [iPhone] [Samsung] [Laptops] [Shoes] [Furniture]          │
│                                                             │
│  [Browse All Categories]                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. METADATA AND TAGGING

### 7.1 Metadata Strategy

#### Product Metadata

**Essential Metadata:**
- Product ID (unique identifier)
- Title
- Description
- Category (primary and secondary)
- Price
- Condition
- Location (region, city)
- Seller ID
- Created date
- Updated date
- Status (active, sold, removed)

**Descriptive Metadata:**
- Brand
- Model
- Color
- Size
- Weight
- Material
- Specifications (JSON)
- Features (array)
- Tags (array)

**Administrative Metadata:**
- View count
- Favorite count
- Sold count
- Rating average
- Review count
- Featured (boolean)
- Promoted (boolean)
- Moderation status

**Technical Metadata:**
- Image URLs (array)
- Image alt text (array)
- Video URLs (array)
- File attachments (array)
- Search index data

#### User Metadata

**Essential Metadata:**
- User ID (unique identifier)
- Email
- Phone
- Name
- Account type (buyer, seller, admin)
- Created date
- Last login date
- Status (active, suspended, banned)

**Profile Metadata:**
- Profile picture URL
- Bio
- Location (region, city)
- Website
- Social media links
- Languages

**Verification Metadata:**
- Ghana Card number
- Ghana Card verified (boolean)
- Ghana Card verified date
- Email verified (boolean)
- Email verified date
- Phone verified (boolean)
- Phone verified date

**Activity Metadata:**
- Listing count (for sellers)
- Order count (for buyers)
- Review count
- Rating average
- Response time
- Response rate

#### Content Metadata

**Essential Metadata:**
- Content ID (unique identifier)
- Title
- Content type (article, video, infographic)
- Category
- Author ID
- Created date
- Updated date
- Status (draft, published, archived)

**Descriptive Metadata:**
- Summary
- Tags (array)
- Keywords (array)
- Featured image URL
- Related content IDs (array)

**Administrative Metadata:**
- View count
- Share count
- Comment count
- Rating average
- Featured (boolean)

### 7.2 Tagging Strategy

#### Tag Types

**Category Tags:**
- Main category
- Subcategory
- Sub-subcategory
- Example: "Electronics", "Phones & Tablets", "Smartphones"

**Attribute Tags:**
- Brand
- Model
- Color
- Size
- Material
- Example: "Apple", "iPhone 14", "Black", "256GB"

**Descriptive Tags:**
- Features
- Use cases
- Benefits
- Example: "Waterproof", "Wireless charging", "Face ID"

**Condition Tags:**
- New
- Like New
- Good
- Fair
- Refurbished

**Location Tags:**
- Region
- City
- Neighborhood
- Example: "Greater Accra", "Accra", "East Legon"

#### Tagging Guidelines

**Consistency:**
- Use consistent terminology
- Use singular form (not plural)
- Use lowercase (except proper nouns)
- Avoid abbreviations (unless widely known)

**Specificity:**
- Be specific but not too specific
- Use standard terms
- Avoid jargon
- Use user-friendly terms

**Relevance:**
- Only tag relevant attributes
- Don't over-tag
- Focus on important attributes
- Consider search behavior

**Maintenance:**
- Regular tag audits
- Merge duplicate tags
- Remove unused tags
- Update tag hierarchy

### 7.3 Taxonomy Management

#### Taxonomy Structure

**Hierarchical Taxonomy:**
```
Electronics
├─ Phones & Tablets
│  ├─ Smartphones
│  ├─ Feature Phones
│  ├─ Tablets
│  └─ Phone Accessories
├─ Computers & Laptops
│  ├─ Laptops
│  ├─ Desktops
│  ├─ Computer Accessories
│  └─ Software
└─ TVs & Audio
   ├─ TVs
   ├─ Speakers
   ├─ Headphones
   └─ Audio Accessories
```

**Faceted Taxonomy:**
- Multiple facets (category, brand, price, condition)
- Independent facet values
- Multi-select facets
- Dynamic facet counts

**Folksonomy:**
- User-generated tags
- Tag clouds
- Popular tags
- Related tags

#### Taxonomy Governance

**Taxonomy Committee:**
- Product Manager
- UX Designer
- Content Strategist
- Search Specialist
- Category Manager

**Governance Process:**
1. Propose new category/tag
2. Review by committee
3. Test with users
4. Approve or reject
5. Implement and monitor
6. Regular review and update

**Taxonomy Tools:**
- Taxonomy management system
- Category analytics
- Search analytics
- User behavior analytics

---

## 8. USER FLOWS

### 8.1 Buyer User Flows

#### Product Discovery Flow

```
Homepage
  ├─ Browse Categories
  │  └─ Category Page
  │     └─ Product Listings
  │        └─ Product Detail
  │
  ├─ Search
  │  └─ Search Results
  │     └─ Product Detail
  │
  └─ Featured Products
     └─ Product Detail
```

#### Purchase Flow

```
Product Detail
  ├─ Add to Cart
  │  └─ Shopping Cart
  │     └─ Checkout
  │        ├─ Delivery Address
  │        ├─ Payment Method
  │        ├─ Order Review
  │        └─ Order Confirmation
  │
  └─ Buy Now
     └─ Checkout
        ├─ Delivery Address
        ├─ Payment Method
        ├─ Order Review
        └─ Order Confirmation
```

#### Order Tracking Flow

```
My Account
  └─ My Orders
     └─ Order Details
        ├─ Order Status
        ├─ Delivery Information
        ├─ Contact Seller
        └─ Report Issue
```

#### Review Flow

```
Order Confirmation
  └─ Leave Review (after delivery)
     ├─ Rating
     ├─ Review Text
     ├─ Photos
     └─ Submit Review
```

### 8.2 Seller User Flows

#### Listing Creation Flow

```
Sell
  └─ Create Listing
     ├─ Step 1: Category
     ├─ Step 2: Photos
     ├─ Step 3: Details
     ├─ Step 4: Pricing
     ├─ Step 5: Delivery
     ├─ Step 6: Preview
     └─ Step 7: Publish
```

#### Order Management Flow

```
My Account
  └─ My Listings
     └─ Manage Orders
        ├─ New Orders
        │  └─ Process Order
        │     ├─ Confirm Order
        │     ├─ Package Item
        │     ├─ Ship Item
        │     └─ Update Status
        │
        ├─ Active Orders
        │  └─ Track Order
        │
        └─ Completed Orders
           └─ View Details
```

#### Payment Withdrawal Flow

```
My Account
  └─ Payments
     └─ Withdraw Funds
        ├─ Select Amount
        ├─ Select Method
        ├─ Confirm Withdrawal
        └─ Withdrawal Confirmation
```

### 8.3 Admin User Flows

#### User Verification Flow

```
Admin Dashboard
  └─ User Management
     └─ Pending Verifications
        └─ Review User
           ├─ View Ghana Card
           ├─ Verify Information
           ├─ Approve or Reject
           └─ Notify User
```

#### Product Moderation Flow

```
Admin Dashboard
  └─ Product Moderation
     └─ Pending Products
        └─ Review Product
           ├─ Check Listing
           ├─ Verify Images
           ├─ Check Description
           ├─ Approve or Reject
           └─ Notify Seller
```

#### Dispute Resolution Flow

```
Admin Dashboard
  └─ Dispute Resolution
     └─ Open Disputes
        └─ Review Dispute
           ├─ View Evidence
           ├─ Contact Parties
           ├─ Make Decision
           ├─ Implement Decision
           └─ Notify Parties
```

---

## 9. ACCESSIBILITY

### 9.1 Accessibility Standards

#### WCAG 2.1 AA Compliance

**Perceivable:**
- Text alternatives for non-text content
- Captions for videos
- Adaptable content
- Distinguishable content

**Operable:**
- Keyboard accessible
- Enough time to read
- Seizure-safe
- Navigable

**Understandable:**
- Readable text
- Predictable behavior
- Input assistance

**Robust:**
- Compatible with assistive technologies
- Valid code
- Accessible names and labels

### 9.2 Accessibility Features

#### Keyboard Navigation

**Tab Order:**
- Logical tab order
- Visible focus indicators
- Skip navigation links
- Keyboard shortcuts

**Keyboard Shortcuts:**
- `/` - Focus search
- `Esc` - Close modal
- `Enter` - Submit form
- `Space` - Toggle checkbox

#### Screen Reader Support

**Semantic HTML:**
- Proper heading hierarchy
- Landmark regions
- ARIA labels and roles
- Descriptive link text

**Screen Reader Features:**
- Announce page changes
- Announce dynamic content
- Form field descriptions
- Error announcements

#### Visual Accessibility

**Color Contrast:**
- Minimum 4.5:1 for normal text
- Minimum 3:1 for large text
- Don't rely on color alone
- High contrast mode

**Text Sizing:**
- Scalable text (up to 200%)
- Responsive layout
- No horizontal scrolling
- Readable at all sizes

**Motion:**
- Reduced motion option
- No auto-playing videos
- Pause/stop controls
- No flashing content

### 9.3 Accessibility Testing

#### Automated Testing

**Tools:**
- WAVE Web Accessibility Evaluation Tool
- axe DevTools
- Lighthouse Accessibility Audit
- Pa11y

**Testing Frequency:**
- Every code commit
- Every pull request
- Every release
- Monthly full audit

#### Manual Testing

**Keyboard Testing:**
- Tab through entire site
- Test all interactive elements
- Verify focus indicators
- Test keyboard shortcuts

**Screen Reader Testing:**
- Test with NVDA (Windows)
- Test with VoiceOver (Mac/iOS)
- Test with TalkBack (Android)
- Verify all content is accessible

**User Testing:**
- Test with users with disabilities
- Test with assistive technologies
- Collect feedback
- Iterate and improve

---

## 10. APPROVAL

This Information Architecture document has been reviewed and approved by:

**Information Architect:** _________________________ Date: __________

**UX Designer:** _________________________ Date: __________

**Product Manager:** _________________________ Date: __________

**Project Steering Committee:** _________________________ Date: __________

---

**Document Reference:** SM-IA-001  
**Version:** 1.0  
**Status:** Approved  
**Next Review:** July 2026

---

© 2026 Sankofa Market Ghana. All rights reserved.

This document is confidential and intended for authorized recipients only.

Made with ❤️ in Ghana 🇬🇭
