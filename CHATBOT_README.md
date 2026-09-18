# 🤖 Sankofa Market Chatbot Assistant - Feature Documentation

## Overview

An intelligent floating chatbot assistant that provides instant help to users with FAQs and common questions about the Sankofa Market platform. The chatbot uses keyword-based intent detection to match user queries with relevant answers, providing 24/7 support and reducing the burden on human support teams.

---

## ✨ Key Features

### 1. **Floating Chat Widget**
- Fixed position button (bottom-right corner)
- Notification badge for new messages
- Smooth animations (slide-up, fade-in)
- Mobile-responsive (full-screen on mobile)
- Click outside to close (mobile)

### 2. **Smart Conversation Interface**
- Real-time messaging with typing indicators
- Bot and user message bubbles
- Avatar icons for visual distinction
- Auto-scroll to latest messages
- HTML support in answers (lists, links, bold text)

### 3. **Intent Detection**
- Keyword-based matching algorithm
- Confidence scoring for best match selection
- Fallback responses for unrecognized queries
- Multi-keyword support per FAQ

### 4. **Quick Replies**
- Suggested follow-up questions
- One-click response buttons
- Contextual to current topic
- Encourages conversation flow

### 5. **FAQ Management (Admin)**
- Add/edit/delete FAQs dynamically
- Keyword management
- Quick replies configuration
- Export to JSON
- Real-time Firestore integration

---

## 🎯 FAQ Topics Covered

### Account & Verification
1. **How to create an account** - Step-by-step registration guide
2. **Verification time** - 24-48 hour timeline explanation
3. **Required documents** - Ghana Card number and name
4. **Account rejection** - Reasons and solutions

### Payments & Escrow
5. **Payment methods** - Mobile Money, cards, bank transfer
6. **Escrow system** - How payment protection works
7. **Dispute process** - Raising and resolving disputes

### Selling
8. **How to list items** - Complete listing guide
9. **Selling fees** - 5% commission explanation
10. **Withdrawal process** - How to get paid

### Buying & Delivery
11. **Delivery options** - Free, paid, pickup explained
12. **Contacting sellers** - Safe communication practices
13. **Safety tips** - Fraud prevention guidelines

### Platform Features
14. **Image search** - Visual search functionality
15. **Contact support** - Help channels and hours

---

## 🔧 Technical Implementation

### Files Created

#### `css/chatbot.css` (300+ lines)
- Floating button styles
- Chat window layout
- Message bubbles and animations
- Quick reply buttons
- Typing indicators
- Responsive breakpoints

#### `js/chatbot.js` (600+ lines)
```javascript
class SankofaChatbot {
    constructor()
    async init()
    async loadFAQs()  // Load from Firestore or defaults
    createChatbotUI()
    attachEventListeners()
    toggleChatbot()
    showWelcomeMessage()
    sendMessage()
    processMessage(message)
    findBestResponse(message)
    calculateMatchScore(message, keywords)
    addUserMessage(text)
    addBotMessage(text, quickReplies)
    handleQuickReply(text)
    showTypingIndicator()
    hideTypingIndicator()
    scrollToBottom()
    escapeHtml(text)
    getDefaultFAQs()  // 15+ hardcoded FAQs
}
```

#### `pages/admin/chatbot-faqs.html` (400+ lines)
- FAQ management interface
- Add/edit modal form
- FAQ list with actions
- Export functionality
- Inline styles for admin page

### Files Modified

#### `index.html`
```html
<!-- Added CSS -->
<link rel="stylesheet" href="css/chatbot.css">

<!-- Added JS -->
<script src="js/chatbot.js"></script>
```

#### `search.html`
```html
<!-- Added CSS -->
<link rel="stylesheet" href="css/chatbot.css">

<!-- Added JS -->
<script src="js/chatbot.js"></script>
```

#### `product-detail.html`
```html
<!-- Added CSS -->
<link rel="stylesheet" href="css/chatbot.css">

<!-- Added JS -->
<script src="js/chatbot.js"></script>
```

---

## 🗄️ Database Schema

### Firestore Collection: `chatbot_faqs`

```javascript
{
    id: "account_creation",  // Unique identifier
    keywords: [
        "create account",
        "sign up",
        "register",
        "new account",
        "join"
    ],
    answer: "To create an account on Sankofa Market:<br><br>...",
    quickReplies: [
        "How long does verification take?",
        "What documents do I need?",
        "Go to sign up page"
    ],
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z"
}
```

---

## 🎨 User Interface

### Chatbot Trigger Button
```
Position: Fixed bottom-right (2rem from edges)
Size: 60x60px (desktop), 56x56px (tablet), 52x52px (mobile)
Color: Blue gradient (#0064d2 → #004a9f)
Icon: Chat bubble (fa-comments)
Active state: Red (fa-times)
Badge: Red circle with "1" (hidden after first open)
```

### Chat Window
```
Position: Fixed bottom-right (6rem from bottom)
Size: 380x600px (desktop), 100vw x 100vh (mobile)
Border radius: 16px (desktop), 0 (mobile)
Shadow: 0 10px 40px rgba(0, 0, 0, 0.2)
Animation: Slide up (0.3s ease)
```

### Message Bubbles
```
Bot messages:
- Background: White
- Text color: #212529
- Border radius: 12px (bottom-left: 4px)
- Max width: 75%
- Alignment: Left

User messages:
- Background: Blue gradient
- Text color: White
- Border radius: 12px (bottom-right: 4px)
- Max width: 75%
- Alignment: Right
```

---

## 🧠 Intent Detection Algorithm

### Matching Process
```javascript
1. Convert user message to lowercase
2. Split into words
3. For each FAQ:
   a. Check if FAQ keywords appear in message
   b. Calculate match score (matches / total keywords)
   c. Track highest scoring FAQ
4. If score > 0.3 (30% match):
   - Return best match
5. Else:
   - Return fallback response
```

### Scoring Formula
```
score = (number of keyword matches) / (total keywords in FAQ)

Example:
FAQ keywords: ["create", "account", "sign up"]
User message: "how do i create an account"
Matches: "create" ✓, "account" ✓
Score: 2 / 3 = 0.67 (67% match)
```

### Threshold
- Minimum score: 0.3 (30% match)
- Prevents false positives
- Ensures relevant responses

---

## 🎯 Example Conversations

### Example 1: Account Creation
```
User: "How do I create an account?"
Bot: "To create an account on Sankofa Market:
      1. Click 'Sign Up' in the top right corner
      2. Enter your Ghana Card number and name
      3. Provide your email and phone number
      4. Create a secure password
      5. Submit for admin verification
      
      Your account will be verified within 24-48 hours.
      You'll receive an email once approved!"
      
      [How long does verification take?]
      [What documents do I need?]
      [Go to sign up page]
```

### Example 2: Payment Methods
```
User: "What payment methods do you accept?"
Bot: "Sankofa Market supports multiple payment methods:
      
      • Mobile Money: MTN, Vodafone, AirtelTigo
      • Cards: Visa, Mastercard
      • Bank Transfer: Direct bank payments
      
      All payments are protected by our escrow system -
      funds are held securely until you confirm delivery!"
      
      [How does escrow work?]
      [Is my payment safe?]
      [View payment page]
```

### Example 3: Unrecognized Query
```
User: "What's the weather like?"
Bot: "I'm not sure I understand that question. Here are
      some things I can help you with:
      
      [How do I create an account?]
      [How does payment work?]
      [How do I list an item?]
      [What are the delivery options?]
      [Contact support]"
```

---

## 🛠️ Admin FAQ Management

### Access
- Navigate to: `/pages/admin/chatbot-faqs.html`
- Requires admin authentication

### Features

#### Add New FAQ
1. Click "Add New FAQ" button
2. Fill in form:
   - **FAQ ID**: Unique identifier (lowercase, underscores)
   - **Keywords**: Comma-separated list
   - **Answer**: HTML-supported response
   - **Quick Replies**: Optional follow-up suggestions
3. Click "Save FAQ"

#### Edit FAQ
1. Find FAQ in list
2. Click "Edit" button
3. Modify fields
4. Click "Save FAQ"

#### Delete FAQ
1. Find FAQ in list
2. Click "Delete" button
3. Confirm deletion

#### Export FAQs
- Click "Export FAQs" button
- Downloads `chatbot_faqs.json`
- Contains all FAQs in JSON format

### Form Validation
- FAQ ID: Required, lowercase letters/numbers/underscores only
- Keywords: Required, at least one keyword
- Answer: Required, supports HTML
- Quick Replies: Optional, comma-separated

---

## 📊 Analytics & Tracking

### Suggested Metrics to Track
```javascript
// Add to chatbot.js
{
    totalConversations: 0,
    totalMessages: 0,
    faqUsage: {
        "account_creation": 45,
        "payment_methods": 32,
        "escrow_system": 28,
        // ...
    },
    fallbackResponses: 12,
    averageResponseTime: 1.2,  // seconds
    userSatisfaction: 4.5  // out of 5
}
```

### Implementation (Optional)
```javascript
// Track FAQ usage
async function trackFAQUsage(faqId) {
    await firebaseDB.collection('chatbot_analytics').add({
        faqId: faqId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userId: getCurrentUserId()
    });
}
```

---

## 🎯 Use Cases

### For Buyers
- "How do I create an account?"
- "How does payment work?"
- "What are the delivery options?"
- "How do I contact a seller?"
- "Is my payment safe?"
- "How do I raise a dispute?"

### For Sellers
- "How do I list an item?"
- "What are the selling fees?"
- "How do I withdraw my money?"
- "What delivery options can I offer?"
- "How long until I get paid?"

### For All Users
- "How do I verify my account?"
- "What documents do I need?"
- "How does escrow protect me?"
- "How do I contact support?"
- "What are the safety tips?"

---

## 🔒 Security & Privacy

### Data Protection
- No personal information stored in chat logs
- Conversations are session-based (not persisted)
- No sensitive data in FAQ answers
- Admin-only access to FAQ management

### Best Practices
- Don't include personal info in examples
- Use generic placeholders (user@example.com)
- Avoid storing chat history (privacy)
- Regular FAQ updates for accuracy

---

## 🚀 Deployment Steps

### 1. Deploy Cloud Functions (if using Firestore FAQs)
```bash
cd functions
npm install
firebase deploy --only functions
```

### 2. Add Sample FAQs to Firestore
```javascript
// Run once in browser console or Node.js
const faqs = [
    {
        id: "account_creation",
        keywords: ["create account", "sign up", "register"],
        answer: "To create an account...",
        quickReplies: ["How long does verification take?"]
    },
    // ... more FAQs
];

faqs.forEach(faq => {
    firebaseDB.collection('chatbot_faqs').doc(faq.id).set(faq);
});
```

### 3. Test Chatbot
- Open website
- Click chatbot button (bottom-right)
- Test common questions
- Verify quick replies work
- Check mobile responsiveness

### 4. Monitor & Update
- Check admin FAQ management page
- Add new FAQs as needed
- Update existing answers
- Monitor user questions for new FAQ ideas

---

## 🎨 Customization Options

### Change Chatbot Position
```css
/* css/chatbot.css */
.chatbot-trigger {
    bottom: 2rem;  /* Change to 1rem for lower position */
    right: 2rem;   /* Change to 1rem for closer to edge */
}
```

### Change Colors
```css
/* css/chatbot.css */
.chatbot-trigger {
    background: linear-gradient(135deg, #YOUR_COLOR 0%, #YOUR_COLOR_DARK 100%);
}

.message.user .message-content {
    background: linear-gradient(135deg, #YOUR_COLOR 0%, #YOUR_COLOR_DARK 100%);
}
```

### Change Avatar Icons
```javascript
// js/chatbot.js
createChatbotUI() {
    // Change bot avatar
    <div class="chatbot-avatar">
        <i class="fas fa-robot"></i>  // Change to fa-headset, fa-comments, etc.
    </div>
}
```

### Add Welcome Message
```javascript
// js/chatbot.js
showWelcomeMessage() {
    this.addBotMessage(
        "👋 Welcome to Sankofa Market! I'm here to help you with any questions.",
        ["Get started", "View FAQs", "Contact support"]
    );
}
```

---

## 📈 Performance Optimization

### Lazy Loading
```javascript
// Only initialize chatbot after page load
window.addEventListener('load', () => {
    setTimeout(() => {
        window.chatbot = new SankofaChatbot();
    }, 2000);  // Delay 2 seconds
});
```

### FAQ Caching
```javascript
// Cache FAQs in localStorage
async function loadFAQs() {
    const cached = localStorage.getItem('chatbot_faqs');
    if (cached) {
        this.faqs = JSON.parse(cached);
        return;
    }
    
    // Load from Firestore
    const snapshot = await firebaseDB.collection('chatbot_faqs').get();
    this.faqs = snapshot.docs.map(doc => doc.data());
    
    // Cache for 1 hour
    localStorage.setItem('chatbot_faqs', JSON.stringify(this.faqs));
    setTimeout(() => localStorage.removeItem('chatbot_faqs'), 3600000);
}
```

### Minimize Re-renders
```javascript
// Debounce message rendering
let renderTimeout;
function scrollToBottom() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        const messagesContainer = document.getElementById('chatbotMessages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
}
```

---

## 🐛 Troubleshooting

### Chatbot Not Appearing
**Problem:** Chatbot button doesn't show
**Solution:**
- Check if `chatbot.css` is included in HTML
- Check if `chatbot.js` is included in HTML
- Check browser console for errors
- Verify z-index (should be 9999)

### FAQs Not Loading
**Problem:** Bot gives fallback responses for all questions
**Solution:**
- Check Firestore collection name (`chatbot_faqs`)
- Verify FAQs exist in Firestore
- Check browser console for Firestore errors
- Ensure Firebase is initialized before chatbot

### Quick Replies Not Working
**Problem:** Clicking quick replies does nothing
**Solution:**
- Check if `handleQuickReply` is globally accessible
- Verify `window.chatbot` is defined
- Check for JavaScript errors in console

### Mobile Issues
**Problem:** Chatbot doesn't work properly on mobile
**Solution:**
- Check responsive CSS breakpoints
- Test on actual mobile device (not just emulator)
- Verify touch event handlers
- Check z-index stacking context

---

## 📚 Future Enhancements

### Planned Features
1. **Natural Language Processing (NLP)**
   - Integrate Dialogflow or similar
   - Better intent recognition
   - Context awareness

2. **Conversation History**
   - Save chat logs to Firestore
   - Allow users to view past conversations
   - Admin review of conversations

3. **User Feedback**
   - "Was this helpful?" buttons
   - Star ratings for answers
   - Feedback collection

4. **Multi-language Support**
   - English, Twi, Ga, Hausa
   - Language detection
   - Localized FAQs

5. **Smart Suggestions**
   - Predict user questions
   - Proactive help based on page context
   - Personalized recommendations

6. **Human Handoff**
   - Escalate to human support
   - Live chat integration
   - Ticket creation

---

## 📞 Support

For issues or questions about the chatbot:
- **GitHub Issues**: Report bugs and request features
- **Admin FAQ Page**: Manage FAQs directly
- **Email**: support@sankofamarket.com

---

## 📊 Statistics

- **6 files changed** (3 new, 3 modified)
- **1,416 lines added**
- **15+ FAQs** pre-built
- **100% client-side** (no server required for basic functionality)
- **< 50KB** total size (CSS + JS)

---

## ✅ Benefits

### For Users
- ✅ Instant answers 24/7
- ✅ No waiting for support response
- ✅ Quick access to common information
- ✅ Guided conversation flow
- ✅ Mobile-friendly interface

### For Business
- ✅ Reduced support tickets (30-50% estimated)
- ✅ Lower support costs
- ✅ Improved user satisfaction
- ✅ Consistent information delivery
- ✅ Scalable support solution

### For Admins
- ✅ Easy FAQ management
- ✅ Real-time updates
- ✅ No coding required for updates
- ✅ Export/import capabilities
- ✅ Full control over responses

---

**Made with ❤️ in Ghana 🇬🇭**

© 2026 Sankofa Market. All rights reserved.
