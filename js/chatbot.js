/**
 * Sankofa Market Chatbot Assistant - Advanced Version
 * Features: NLP, Conversation History, Feedback, Smart Suggestions, Human Handoff
 */

class SankofaChatbot {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.faqs = [];
        this.sessionId = this.generateSessionId();
        this.conversationId = this.generateConversationId();
        this.currentPageContext = this.getPageContext();
        this.useNLP = true; // Set to false if Dialogflow not configured
        this.init();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateConversationId() {
        return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getPageContext() {
        const path = window.location.pathname;
        if (path.includes('product-detail')) return 'product_detail';
        if (path.includes('search')) return 'search';
        if (path.includes('dashboard')) return 'dashboard';
        if (path.includes('publish')) return 'publish';
        return 'general';
    }

    async init() {
        this.createChatbotUI();
        this.attachEventListeners();
        await this.loadFAQs();
        await this.loadConversationHistory();
        this.showWelcomeMessage();
        await this.loadSmartSuggestions();
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
        this.saveToHistory('user', message);
        input.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        // Process message and respond
        setTimeout(() => {
            this.hideTypingIndicator();
            this.processMessage(message);
        }, 1000 + Math.random() * 1000);
    }

    async processMessage(message) {
        try {
            let response;

            // Try NLP first if enabled and Firebase is available
            if (this.useNLP && typeof firebase !== 'undefined' && firebase.functions) {
                try {
                    const result = await firebase.functions()
                        .httpsCallable('processMessage')({
                            message,
                            sessionId: this.sessionId,
                            pageContext: this.currentPageContext
                        });

                    if (result.data.success && !result.data.fallback) {
                        response = {
                            text: result.data.response,
                            quickReplies: result.data.quickReplies || [],
                            intent: result.data.intent,
                            confidence: result.data.confidence
                        };
                    } else {
                        // Fallback to keyword matching
                        response = this.findBestResponse(message.toLowerCase());
                    }
                } catch (error) {
                    console.warn('NLP failed, using keyword matching:', error);
                    response = this.findBestResponse(message.toLowerCase());
                }
            } else {
                // Use keyword matching
                response = this.findBestResponse(message.toLowerCase());
            }

            // Add bot message with feedback buttons
            this.addBotMessage(response.text, response.quickReplies, response.intent);

            // Save to conversation history
            this.saveToHistory('bot', response.text, response.intent);

        } catch (error) {
            console.error('Process message error:', error);
            this.addBotMessage('Sorry, I encountered an error. Please try again or contact support.');
        }
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
        if (bestMatch && highestScore > 0.15) {
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
        const msg = message.toLowerCase().replace(/[?!.,]/g, '');
        
        // Remove common filler words
        const stopWords = ['how', 'do', 'does', 'is', 'are', 'can', 'i', 'my', 'the', 'a', 'an', 'what', 'where', 'when', 'why', 'which', 'who', 'to', 'for', 'on', 'in', 'about', 'with', 'please', 'help', 'me', 'want', 'need', 'know', 'tell', 'me', 'get', 'got'];
        const msgWords = msg.split(/\s+/).filter(w => !stopWords.includes(w));
        
        for (const keyword of keywords) {
            const kw = keyword.toLowerCase();
            const kwWords = kw.split(/\s+/);
            
            // Exact phrase match (highest score)
            if (msg.includes(kw)) {
                score += 3;
                continue;
            }
            
            // Individual keyword matches
            for (const kwWord of kwWords) {
                if (kwWord.length < 3) continue; // Skip very short words
                
                // Exact word match
                if (msgWords.includes(kwWord)) {
                    score += 1.5;
                }
                // Partial/contains match
                else if (msg.includes(kwWord)) {
                    score += 0.8;
                }
                // Stem match (e.g., "selling" matches "sell")
                else {
                    for (const mw of msgWords) {
                        if (mw.startsWith(kwWord) || kwWord.startsWith(mw)) {
                            score += 0.5;
                            break;
                        }
                    }
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

    addBotMessage(text, quickReplies = [], intent = null) {
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

        // Add feedback buttons if intent is provided
        if (intent && intent !== 'Default Fallback Intent') {
            this.addFeedbackButtons(messageDiv.querySelector('.message-content'), intent);
        }

        this.scrollToBottom();

        // Save to history
        this.saveToHistory('bot', text, intent);
    }

    handleQuickReply(text) {
        const lowerText = text.toLowerCase();
        
        // Check for escalation triggers
        if (lowerText.includes('contact support') || 
            lowerText.includes('human') || 
            lowerText.includes('escalate') ||
            lowerText.includes('speak to agent')) {
            this.addUserMessage(text);
            this.saveToHistory('user', text);
            this.escalateToHuman();
            return;
        }

        // Check for conversation history trigger
        if (lowerText.includes('view history') || lowerText.includes('past conversations')) {
            this.addUserMessage(text);
            this.viewConversationHistory();
            return;
        }

        this.addUserMessage(text);
        this.saveToHistory('user', text);
        
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
                keywords: ['create account', 'sign up', 'register', 'new account', 'join', 'signup', 'account', 'create', 'open account', 'start', 'getting started', 'new here'],
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
                keywords: ['verification time', 'how long', 'approve', 'approval time', 'wait', 'verified', 'pending', 'status', 'taking long', 'still waiting', 'check status'],
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
                keywords: ['payment', 'pay', 'how to pay', 'payment methods', 'mobile money', 'momo', 'card', 'visa', 'mastercard', 'mtn', 'vodafone', 'airteltigo', 'pay for', 'checkout'],
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
                keywords: ['dispute', 'problem', 'issue', 'complaint', 'not as described', 'refund', 'return', 'broken', 'damaged', 'wrong item', 'scammed', 'cheated'],
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
                keywords: ['list item', 'sell', 'post item', 'create listing', 'how to sell', 'listing', 'put up', 'upload product', 'add product', 'selling', 'start selling'],
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
                keywords: ['fees', 'commission', 'cost', 'charges', 'how much', 'price', 'percentage', 'free', 'charge', 'expensive', 'rate'],
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
                keywords: ['delivery', 'shipping', 'pickup', 'free delivery', 'delivery options', 'ship', 'deliver', 'tracking', 'track order', 'receive', 'how long delivery'],
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
                keywords: ['contact seller', 'message seller', 'chat', 'talk to seller', 'reach seller', 'message', 'communicate', 'talk to', 'send message', 'inbox'],
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
                keywords: ['safety', 'safe', 'scam', 'fraud', 'secure', 'protect', 'trust', 'trustworthy', 'legit', 'legitimate', 'real', 'fake', 'security'],
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
                keywords: ['support', 'help', 'contact', 'customer service', 'assistance', 'reach out', 'email', 'phone', 'call', 'talk to someone', 'speak to'],
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
                keywords: ['withdraw', 'payout', 'get paid', 'receive money', 'cash out', 'withdrawal', 'my money', 'earnings', 'transfer', 'bank'],
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

    // =========================================================================
    // CONVERSATION HISTORY
    // =========================================================================

    async loadConversationHistory() {
        try {
            if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;

            const result = await firebase.functions()
                .httpsCallable('getConversationHistory')({ limit: 10 });

            if (result.data.success && result.data.conversations.length > 0) {
                // Show option to continue previous conversation
                const lastConv = result.data.conversations[result.data.conversations.length - 1];
                if (lastConv.messages && lastConv.messages.length > 0) {
                    this.showContinueConversationPrompt(lastConv);
                }
            }
        } catch (error) {
            console.warn('Could not load conversation history:', error);
        }
    }

    showContinueConversationPrompt(conversation) {
        const messageCount = conversation.messages.length;
        this.addBotMessage(
            `Welcome back! You have a previous conversation with ${messageCount} messages. Would you like to continue?`,
            ['Continue conversation', 'Start new conversation']
        );
    }

    saveToHistory(sender, text, intent = null) {
        this.messages.push({
            sender,
            text,
            intent,
            timestamp: new Date().toISOString()
        });

        // Auto-save conversation periodically (every 5 messages)
        if (this.messages.length % 5 === 0) {
            this.saveConversation();
        }
    }

    async saveConversation() {
        try {
            if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;
            if (this.messages.length === 0) return;

            await firebase.functions()
                .httpsCallable('saveConversation')({
                    conversationId: this.conversationId,
                    messages: this.messages
                });

            console.log('Conversation saved');
        } catch (error) {
            console.warn('Could not save conversation:', error);
        }
    }

    viewConversationHistory() {
        window.open('/pages/user/chat-history.html', '_blank');
    }

    // =========================================================================
    // USER FEEDBACK
    // =========================================================================

    addFeedbackButtons(messageElement, intent) {
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'message-feedback';
        feedbackDiv.innerHTML = `
            <span class="feedback-label">Was this helpful?</span>
            <button class="feedback-btn positive" onclick="chatbot.submitFeedback('positive', '${intent}', this)">
                <i class="fas fa-thumbs-up"></i> Yes
            </button>
            <button class="feedback-btn negative" onclick="chatbot.submitFeedback('negative', '${intent}', this)">
                <i class="fas fa-thumbs-down"></i> No
            </button>
        `;
        messageElement.appendChild(feedbackDiv);
    }

    async submitFeedback(rating, intent, button) {
        try {
            // Disable buttons
            const feedbackDiv = button.parentElement;
            feedbackDiv.querySelectorAll('.feedback-btn').forEach(btn => {
                btn.disabled = true;
            });

            // Highlight selected button
            button.classList.add('selected');

            // Submit feedback
            if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
                await firebase.functions()
                    .httpsCallable('submitFeedback')({
                        messageId: Date.now().toString(),
                        rating,
                        intent,
                        comment: ''
                    });
            }

            // Show thank you message
            const thankYou = document.createElement('span');
            thankYou.className = 'feedback-thanks';
            thankYou.textContent = rating === 'positive' ? '👍 Thanks for your feedback!' : '👎 Thanks! We\'ll improve this answer.';
            feedbackDiv.appendChild(thankYou);

            // If negative, offer to escalate
            if (rating === 'negative') {
                setTimeout(() => {
                    this.addBotMessage(
                        'I\'m sorry I couldn\'t help. Would you like to speak with a human support agent?',
                        ['Yes, contact support', 'No, I\'ll try again']
                    );
                }, 1000);
            }

        } catch (error) {
            console.error('Feedback error:', error);
        }
    }

    // =========================================================================
    // SMART SUGGESTIONS
    // =========================================================================

    async loadSmartSuggestions() {
        try {
            if (typeof firebase === 'undefined' || !firebase.auth().currentUser) {
                this.showDefaultSuggestions();
                return;
            }

            const result = await firebase.functions()
                .httpsCallable('getSmartSuggestions')({
                    pageContext: this.currentPageContext,
                    userHistory: this.messages.slice(-5)
                });

            if (result.data.success && result.data.suggestions.length > 0) {
                this.showSuggestions(result.data.suggestions);
            } else {
                this.showDefaultSuggestions();
            }
        } catch (error) {
            console.warn('Could not load smart suggestions:', error);
            this.showDefaultSuggestions();
        }
    }

    showSuggestions(suggestions) {
        setTimeout(() => {
            this.addBotMessage(
                'Based on your current page, you might want to ask:',
                suggestions
            );
        }, 2000);
    }

    showDefaultSuggestions() {
        const defaults = {
            general: [
                'How do I create an account?',
                'How does payment work?',
                'How do I list an item?'
            ],
            product_detail: [
                'How do I contact the seller?',
                'Is my payment safe?',
                'What are the delivery options?'
            ],
            search: [
                'How do I use filters?',
                'Can I search by image?',
                'How do I sort results?'
            ],
            dashboard: [
                'How do I list an item?',
                'How do I withdraw money?',
                'Where are my orders?'
            ]
        };

        const suggestions = defaults[this.currentPageContext] || defaults.general;
        
        setTimeout(() => {
            this.addBotMessage(
                'Here are some things I can help you with:',
                suggestions
            );
        }, 2000);
    }

    // =========================================================================
    // HUMAN HANDOFF
    // =========================================================================

    async escalateToHuman() {
        try {
            // Show typing indicator
            this.showTypingIndicator();

            // Prepare conversation summary
            const summary = this.prepareConversationSummary();

            // Create support ticket
            if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
                const result = await firebase.functions()
                    .httpsCallable('createSupportTicket')({
                        subject: 'Chatbot Escalation - User Request',
                        description: 'User requested human support from chatbot',
                        conversationHistory: summary,
                        priority: 'medium'
                    });

                this.hideTypingIndicator();

                if (result.data.success) {
                    this.addBotMessage(
                        `✅ Support ticket created!<br><br>
                        <strong>Ticket ID:</strong> ${result.data.ticketId}<br>
                        <strong>Status:</strong> Open<br><br>
                        Our support team will contact you within 24 hours via email. You can also check your ticket status in your dashboard.`,
                        ['View my tickets', 'Return to homepage']
                    );
                } else {
                    throw new Error('Failed to create ticket');
                }
            } else {
                this.hideTypingIndicator();
                this.addBotMessage(
                    'Please sign in to create a support ticket. You can also contact us directly at support@sankofamarket.com',
                    ['Sign in', 'Contact support']
                );
            }

        } catch (error) {
            this.hideTypingIndicator();
            console.error('Escalation error:', error);
            this.addBotMessage(
                'Sorry, I couldn\'t create a support ticket. Please contact us directly at support@sankofamarket.com or call +233 XX XXX XXXX.',
                ['Contact support', 'Try again']
            );
        }
    }

    prepareConversationSummary() {
        const summary = this.messages.slice(-10).map(msg => ({
            sender: msg.sender,
            text: msg.text,
            timestamp: msg.timestamp
        }));

        return summary;
    }

    // =========================================================================
    // ENHANCED MESSAGE HANDLING
    // =========================================================================

    addBotMessageEnhanced(text, quickReplies = [], intent = null) {
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

        // Add feedback buttons if intent is provided
        if (intent && intent !== 'Default Fallback Intent') {
            this.addFeedbackButtons(messageDiv.querySelector('.message-content'), intent);
        }

        this.scrollToBottom();

        // Save to history
        this.saveToHistory('bot', text, intent);
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
