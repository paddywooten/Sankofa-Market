/**
 * Sankofa Market Chatbot Assistant
 * Helps users with FAQs and common questions
 */

class SankofaChatbot {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.faqs = [];
        this.init();
    }

    async init() {
        this.createChatbotUI();
        this.attachEventListeners();
        await this.loadFAQs();
        this.showWelcomeMessage();
    }

    async loadFAQs() {
        try {
            // Try to load from Firestore
            if (typeof firebaseDB !== 'undefined') {
                const snapshot = await firebaseDB.collection('chatbot_faqs').get();
                if (!snapshot.empty) {
                    this.faqs = [];
                    snapshot.forEach(doc => {
                        this.faqs.push(doc.data());
                    });
                    console.log(`Loaded ${this.faqs.length} FAQs from Firestore`);
                    return;
                }
            }
        } catch (error) {
            console.warn('Could not load FAQs from Firestore, using defaults:', error);
        }

        // Fallback to hardcoded FAQs
        this.faqs = this.getDefaultFAQs();
        console.log(`Loaded ${this.faqs.length} default FAQs`);
    }

    createChatbotUI() {
        // Create trigger button
        const trigger = document.createElement('button');
        trigger.className = 'chatbot-trigger';
        trigger.id = 'chatbotTrigger';
        trigger.innerHTML = `
            <i class="fas fa-comments"></i>
            <span class="chatbot-badge">1</span>
        `;
        document.body.appendChild(trigger);

        // Create chatbot window
        const window = document.createElement('div');
        window.className = 'chatbot-window';
        window.id = 'chatbotWindow';
        window.innerHTML = `
            <div class="chatbot-header">
                <div class="chatbot-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="chatbot-info">
                    <h3>Sankofa Assistant</h3>
                    <p><span class="status-dot"></span> Online | Here to help</p>
                </div>
            </div>
            <div class="chatbot-messages" id="chatbotMessages"></div>
            <div class="chatbot-input">
                <input type="text" id="chatbotInput" placeholder="Type your question..." autocomplete="off">
                <button id="chatbotSend">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;
        document.body.appendChild(window);
    }

    attachEventListeners() {
        const trigger = document.getElementById('chatbotTrigger');
        const sendBtn = document.getElementById('chatbotSend');
        const input = document.getElementById('chatbotInput');

        trigger.addEventListener('click', () => this.toggleChatbot());
        sendBtn.addEventListener('click', () => this.sendMessage());
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Close on outside click (mobile)
        document.addEventListener('click', (e) => {
            const chatbotWindow = document.getElementById('chatbotWindow');
            const chatbotTrigger = document.getElementById('chatbotTrigger');
            
            if (this.isOpen && 
                !chatbotWindow.contains(e.target) && 
                !chatbotTrigger.contains(e.target) &&
                window.innerWidth <= 768) {
                this.toggleChatbot();
            }
        });
    }

    toggleChatbot() {
        const trigger = document.getElementById('chatbotTrigger');
        const window = document.getElementById('chatbotWindow');
        
        this.isOpen = !this.isOpen;
        
        if (this.isOpen) {
            trigger.classList.add('active');
            trigger.innerHTML = '<i class="fas fa-times"></i>';
            window.classList.add('active');
            
            // Hide badge
            const badge = trigger.querySelector('.chatbot-badge');
            if (badge) badge.style.display = 'none';
            
            // Focus input
            setTimeout(() => {
                document.getElementById('chatbotInput').focus();
            }, 300);
        } else {
            trigger.classList.remove('active');
            trigger.innerHTML = `
                <i class="fas fa-comments"></i>
                <span class="chatbot-badge" style="display: none;">1</span>
            `;
            window.classList.remove('active');
        }
    }

    showWelcomeMessage() {
        setTimeout(() => {
            this.addBotMessage(
                `👋 Hello! I'm your Sankofa Market assistant. I'm here to help you with any questions about buying, selling, or using our platform.`,
                [
                    'How do I create an account?',
                    'How does payment work?',
                    'How do I list an item?',
                    'What are the delivery options?',
                    'How do I contact support?'
                ]
            );
        }, 1000);
    }

    sendMessage() {
        const input = document.getElementById('chatbotInput');
        const message = input.value.trim();

        if (!message) return;

        this.addUserMessage(message);
        input.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        // Process message and respond
        setTimeout(() => {
            this.hideTypingIndicator();
            this.processMessage(message);
        }, 1000 + Math.random() * 1000);
    }

    processMessage(message) {
        const lowerMessage = message.toLowerCase();
        const response = this.findBestResponse(lowerMessage);
        
        this.addBotMessage(response.text, response.quickReplies);
    }

    findBestResponse(message) {
        let bestMatch = null;
        let highestScore = 0;

        // Check each FAQ
        for (const faq of this.faqs) {
            const score = this.calculateMatchScore(message, faq.keywords);
            
            if (score > highestScore) {
                highestScore = score;
                bestMatch = faq;
            }
        }

        // If we found a good match (score > 0.3), return it
        if (bestMatch && highestScore > 0.3) {
            return {
                text: bestMatch.answer,
                quickReplies: bestMatch.quickReplies || []
            };
        }

        // Default response
        return {
            text: `I'm not sure I understand that question. Here are some things I can help you with:`,
            quickReplies: [
                'How do I create an account?',
                'How does payment work?',
                'How do I list an item?',
                'What are the delivery options?',
                'Contact support'
            ]
        };
    }

    calculateMatchScore(message, keywords) {
        let score = 0;
        const words = message.split(/\s+/);
        
        for (const keyword of keywords) {
            const keywordWords = keyword.split(/\s+/);
            
            for (const kw of keywordWords) {
                if (message.includes(kw)) {
                    score += 1;
                }
            }
        }

        // Normalize score
        return score / Math.max(keywords.length, 1);
    }

    addUserMessage(text) {
        const messagesContainer = document.getElementById('chatbotMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="message-content">
                <p>${this.escapeHtml(text)}</p>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addBotMessage(text, quickReplies = []) {
        const messagesContainer = document.getElementById('chatbotMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot';
        
        let quickRepliesHtml = '';
        if (quickReplies.length > 0) {
            quickRepliesHtml = '<div class="quick-replies">' +
                quickReplies.map(reply => 
                    `<button class="quick-reply" onclick="chatbot.handleQuickReply('${this.escapeHtml(reply)}')">${this.escapeHtml(reply)}</button>`
                ).join('') +
                '</div>';
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <p>${text}</p>
                ${quickRepliesHtml}
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    handleQuickReply(text) {
        this.addUserMessage(text);
        
        setTimeout(() => {
            this.showTypingIndicator();
            setTimeout(() => {
                this.hideTypingIndicator();
                this.processMessage(text);
            }, 800 + Math.random() * 800);
        }, 300);
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chatbotMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot typing';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typing = document.getElementById('typingIndicator');
        if (typing) typing.remove();
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatbotMessages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getDefaultFAQs() {
        return [
            {
                id: 'account_creation',
                keywords: ['create account', 'sign up', 'register', 'new account', 'join'],
                answer: `To create an account on Sankofa Market:<br><br>
                    <ol>
                        <li>Click "Sign Up" in the top right corner</li>
                        <li>Enter your Ghana Card number and name</li>
                        <li>Provide your email and phone number</li>
                        <li>Create a secure password</li>
                        <li>Submit for admin verification</li>
                    </ol>
                    <br>Your account will be verified within 24-48 hours. You'll receive an email once approved!`,
                quickReplies: ['How long does verification take?', 'What documents do I need?', 'Go to sign up page']
            },
            {
                id: 'verification_time',
                keywords: ['verification time', 'how long', 'approve', 'approval time', 'wait'],
                answer: `Account verification typically takes <strong>24-48 hours</strong>. Our admin team reviews your Ghana Card details to ensure platform safety.<br><br>
                    You'll receive an email notification once your account is approved. If it takes longer, please contact our support team.`,
                quickReplies: ['Contact support', 'Check verification status', 'What if I\'m not approved?']
            },
            {
                id: 'documents_needed',
                keywords: ['documents', 'ghana card', 'id', 'what do i need', 'required'],
                answer: `To create an account, you'll need:<br><br>
                    <ul>
                        <li><strong>Ghana Card number</strong> (format: GHA-123456789-0)</li>
                        <li><strong>Name</strong> (as it appears on your Ghana Card)</li>
                        <li><strong>Email address</strong></li>
                        <li><strong>Phone number</strong></li>
                    </ul>
                    <br>No photo uploads required - just your Ghana Card number for verification!`,
                quickReplies: ['How do I get a Ghana Card?', 'Create account', 'Contact support']
            },
            {
                id: 'payment_methods',
                keywords: ['payment', 'pay', 'how to pay', 'payment methods', 'mobile money', 'momo', 'card'],
                answer: `Sankofa Market supports multiple payment methods:<br><br>
                    <ul>
                        <li><strong>Mobile Money:</strong> MTN, Vodafone, AirtelTigo</li>
                        <li><strong>Cards:</strong> Visa, Mastercard</li>
                        <li><strong>Bank Transfer:</strong> Direct bank payments</li>
                    </ul>
                    <br>All payments are protected by our <strong>escrow system</strong> - funds are held securely until you confirm delivery!`,
                quickReplies: ['How does escrow work?', 'Is my payment safe?', 'View payment page']
            },
            {
                id: 'escrow_system',
                keywords: ['escrow', 'payment protection', 'safe payment', 'hold payment', 'secure'],
                answer: `Our <strong>escrow system</strong> protects both buyers and sellers:<br><br>
                    <ol>
                        <li>Buyer pays → Funds held in escrow</li>
                        <li>Seller ships item</li>
                        <li>Buyer receives and inspects item</li>
                        <li>Buyer confirms delivery (within 48 hours)</li>
                        <li>Funds released to seller</li>
                    </ol>
                    <br>If there's an issue, you can raise a dispute and our admin team will review the case.`,
                quickReplies: ['What if item is not as described?', 'How to raise dispute?', 'Auto-release timer']
            },
            {
                id: 'dispute_process',
                keywords: ['dispute', 'problem', 'issue', 'complaint', 'not as described', 'refund'],
                answer: `If you have an issue with your order:<br><br>
                    <ol>
                        <li>Go to your order details</li>
                        <li>Click "Raise Dispute" within 48 hours</li>
                        <li>Provide evidence (photos, description)</li>
                        <li>Admin reviews both sides</li>
                        <li>Decision: Refund buyer OR release to seller</li>
                    </ol>
                    <br><strong>Important:</strong> Always inspect items before confirming delivery!`,
                quickReplies: ['How long does dispute take?', 'What evidence do I need?', 'Contact support']
            },
            {
                id: 'list_item',
                keywords: ['list item', 'sell', 'post item', 'create listing', 'how to sell'],
                answer: `To list an item for sale:<br><br>
                    <ol>
                        <li>Click "Sell" or "List Item" button</li>
                        <li>Upload up to 8 photos (first is cover)</li>
                        <li>Add title and detailed description</li>
                        <li>Select category and condition</li>
                        <li>Set your price</li>
                        <li>Choose delivery options</li>
                        <li>Add location and contact info</li>
                        <li>Click "Publish Listing"</li>
                    </ol>
                    <br><strong>Tip:</strong> Be honest and transparent in your descriptions to avoid disputes!`,
                quickReplies: ['What are the fees?', 'Delivery options', 'Go to list page']
            },
            {
                id: 'selling_fees',
                keywords: ['fees', 'commission', 'cost', 'charges', 'how much'],
                answer: `Sankofa Market charges a <strong>5% commission</strong> on successful sales.<br><br>
                    <strong>Example:</strong><br>
                    • Item sells for GHS 1,000<br>
                    • Commission: GHS 50 (5%)<br>
                    • You receive: GHS 950<br><br>
                    Listing items is <strong>completely free</strong> - you only pay when you make a sale!`,
                quickReplies: ['When do I get paid?', 'How to withdraw money?', 'List an item']
            },
            {
                id: 'delivery_options',
                keywords: ['delivery', 'shipping', 'pickup', 'free delivery', 'delivery options'],
                answer: `Sellers can offer three delivery options:<br><br>
                    <ul>
                        <li><strong>🚚 Free Delivery:</strong> Seller delivers at no extra cost</li>
                        <li><strong>💰 Paid Delivery:</strong> Buyer pays delivery fee (set by seller)</li>
                        <li><strong>🏪 Pickup Only:</strong> Buyer picks up from seller's location</li>
                    </ul>
                    <br>Buyers can filter products by delivery preference. Always check delivery details before purchasing!`,
                quickReplies: ['How to track delivery?', 'What if delivery is late?', 'Contact seller']
            },
            {
                id: 'contact_seller',
                keywords: ['contact seller', 'message seller', 'chat', 'talk to seller', 'reach seller'],
                answer: `To contact a seller:<br><br>
                    <ol>
                        <li>Go to the product page</li>
                        <li>Click "Contact Seller" button</li>
                        <li>Use our secure messaging system</li>
                        <li>Ask questions about the item</li>
                    </ul>
                    <br><strong>⚠️ Safety Tip:</strong> Always communicate through our platform. Never share personal contact details or make payments outside Sankofa Market!`,
                quickReplies: ['Is messaging safe?', 'What if seller doesn\'t respond?', 'Report seller']
            },
            {
                id: 'safety_tips',
                keywords: ['safety', 'safe', 'scam', 'fraud', 'secure', 'protect'],
                answer: `Stay safe on Sankofa Market:<br><br>
                    <strong>✅ DO:</strong>
                    <ul>
                        <li>Use our escrow payment system</li>
                        <li>Communicate through platform messaging</li>
                        <li>Inspect items before confirming delivery</li>
                        <li>Check seller ratings and reviews</li>
                        <li>Report suspicious activity</li>
                    </ul>
                    <br><strong>❌ DON'T:</strong>
                    <ul>
                        <li>Pay outside the platform</li>
                        <li>Share personal contact details</li>
                        <li>Send money directly to sellers</li>
                        <li>Confirm delivery before receiving item</li>
                    </ul>`,
                quickReplies: ['Report suspicious user', 'How does escrow protect me?', 'Contact support']
            },
            {
                id: 'contact_support',
                keywords: ['support', 'help', 'contact', 'customer service', 'assistance'],
                answer: `Need help? Contact our support team:<br><br>
                    <ul>
                        <li><strong>Email:</strong> support@sankofamarket.com</li>
                        <li><strong>Phone:</strong> +233 XX XXX XXXX</li>
                        <li><strong>Hours:</strong> Mon-Fri, 9 AM - 6 PM</li>
                    </ul>
                    <br>For urgent issues, you can also reach us through the "Contact Support" button in your dashboard.`,
                quickReplies: ['Report a problem', 'Account issues', 'Go to support page']
            },
            {
                id: 'withdraw_money',
                keywords: ['withdraw', 'payout', 'get paid', 'receive money', 'cash out'],
                answer: `To withdraw your earnings:<br><br>
                    <ol>
                        <li>Go to your Dashboard</li>
                        <li>Click "Wallet" or "Earnings"</li>
                        <li>Click "Withdraw Funds"</li>
                        <li>Select withdrawal method (Mobile Money or Bank)</li>
                        <li>Enter amount and confirm</li>
                    </ol>
                    <br><strong>Processing time:</strong> 1-3 business days<br>
                    <strong>Minimum withdrawal:</strong> GHS 50`,
                quickReplies: ['Check my balance', 'Withdrawal fees?', 'Go to wallet']
            },
            {
                id: 'image_search',
                keywords: ['image search', 'search by image', 'photo search', 'visual search'],
                answer: `Search for products using images:<br><br>
                    <ol>
                        <li>Click the camera icon 📷 in the search bar</li>
                        <li>Upload an image or take a photo</li>
                        <li>Optionally select a category</li>
                        <li>Click "Search for Similar Products"</li>
                        <li>View matching products</li>
                    </ol>
                    <br>You can also paste an image URL or use your search history!`,
                quickReplies: ['Try image search', 'How accurate is it?', 'View search history']
            },
            {
                id: 'account_not_approved',
                keywords: ['not approved', 'rejected', 'denied', 'failed verification'],
                answer: `If your account wasn't approved, it could be due to:<br><br>
                    <ul>
                        <li>Incorrect Ghana Card number</li>
                        <li>Name doesn't match Ghana Card</li>
                        <li>Suspicious activity detected</li>
                        <li>Incomplete information</li>
                    </ul>
                    <br><strong>What to do:</strong><br>
                    Contact our support team with your email and we'll help resolve the issue. You can also try registering again with correct details.`,
                quickReplies: ['Contact support', 'Try again', 'What information is needed?']
            }
        ];
    }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new SankofaChatbot();
});

// Make handleQuickReply globally accessible
window.handleQuickReply = function(text) {
    if (window.chatbot) {
        window.chatbot.handleQuickReply(text);
    }
};
