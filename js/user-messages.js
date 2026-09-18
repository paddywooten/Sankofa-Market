/* ============================================================================
   SANKOFA MARKET - USER MESSAGES PAGE
   ============================================================================ */

// Conversation data (mock)
const conversations = {
    'ama-textiles': {
        name: "Ama's Textiles",
        avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=80&h=80&fit=crop&crop=face&q=75&auto=format',
        status: 'Online',
        product: {
            image: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=100&h=100&fit=crop&q=75&auto=format',
            title: 'Authentic Kente Cloth - Hand-Woven Premium',
            price: 'GH₵ 350.00'
        },
        messages: [
            { text: "Hello! Welcome to Ama's Textiles. How can I help you today?", sent: false, time: 'Sep 17, 2:30 PM' },
            { text: "Hi! I'm interested in the hand-woven Kente cloth. Is it still available?", sent: true, time: 'Sep 17, 2:35 PM' },
            { text: "Yes, the Kente cloth is still available! It's a beautiful piece woven by artisans in Bonwire, the home of Kente.", sent: false, time: 'Sep 18, 9:15 AM' },
            { text: "That's great! Can you deliver to East Legon in Accra?", sent: true, time: 'Sep 18, 9:20 AM' },
            { text: "Yes, we deliver to East Legon. Delivery takes 1-2 business days and costs GH₵ 20. Would you like to proceed with the order?", sent: false, time: 'Sep 18, 9:25 AM' }
        ]
    },
    'heritage-crafts': {
        name: 'Heritage Crafts GH',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face&q=75&auto=format',
        status: 'Online',
        product: {
            image: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=100&h=100&fit=crop&q=75&auto=format',
            title: 'Krobo Glass Beads - Assorted Colors',
            price: 'GH₵ 85.00'
        },
        messages: [
            { text: 'Hi, I would like to order 2 sets of the Krobo beads.', sent: true, time: 'Sep 17, 11:00 AM' },
            { text: 'Great choice! We have them in stock. Which colors would you prefer?', sent: false, time: 'Sep 17, 11:15 AM' },
            { text: 'I\'d like one set in earth tones and another in blue/green.', sent: true, time: 'Sep 17, 11:20 AM' },
            { text: 'I can deliver to Accra by Friday. Would that work for you?', sent: false, time: 'Sep 17, 11:30 AM' }
        ]
    },
    'techhub': {
        name: 'TechHub Accra',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face&q=75&auto=format',
        status: 'Last seen 1 hour ago',
        product: {
            image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=100&h=100&fit=crop&q=75&auto=format',
            title: 'Samsung Galaxy A54 - 128GB (Like New)',
            price: 'GH₵ 2,800.00'
        },
        messages: [
            { text: 'Does the Samsung Galaxy A54 come with accessories?', sent: true, time: 'Sep 17, 3:00 PM' },
            { text: 'The phone comes with charger and case. Original box included.', sent: false, time: 'Sep 17, 3:45 PM' },
            { text: 'Is the price negotiable?', sent: true, time: 'Sep 17, 4:00 PM' },
            { text: 'I can do GH₵ 2,700 for a quick sale. Final price.', sent: false, time: 'Sep 17, 4:30 PM' }
        ]
    },
    'northern-naturals': {
        name: 'Northern Naturals',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face&q=75&auto=format',
        status: 'Last seen yesterday',
        product: {
            image: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=100&h=100&fit=crop&q=75&auto=format',
            title: 'Organic Shea Butter - Unrefined (500g)',
            price: 'GH₵ 45.00'
        },
        messages: [
            { text: 'I just placed an order for 3 jars of shea butter!', sent: true, time: 'Sep 16, 8:00 PM' },
            { text: 'Thank you for your order! We\'ll ship tomorrow morning.', sent: false, time: 'Sep 16, 8:30 PM' }
        ]
    },
    'tamale-fashion': {
        name: 'Tamale Fashion House',
        avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop&crop=face&q=75&auto=format',
        status: 'Last seen 2 days ago',
        product: {
            image: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=100&h=100&fit=crop&q=75&auto=format',
            title: 'Traditional Northern Smock (Fugu) - Premium',
            price: 'GH₵ 480.00'
        },
        messages: [
            { text: 'What size would you like for the Smock? We have M, L, XL, and XXL.', sent: false, time: 'Sep 15, 10:00 AM' },
            { text: 'I\'m not sure about the sizing. Can you provide measurements?', sent: true, time: 'Sep 15, 2:00 PM' }
        ]
    },
    'accra-electronics': {
        name: 'Accra Electronics',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face&q=75&auto=format',
        status: 'Offline',
        product: null,
        messages: [
            { text: 'Are the wireless headphones still available?', sent: true, time: 'Sep 10, 4:00 PM' },
            { text: 'The headphones are no longer available. Sorry about that!', sent: false, time: 'Sep 11, 9:00 AM' }
        ]
    }
};

let currentConversation = 'ama-textiles';

document.addEventListener('DOMContentLoaded', function() {
    initConversationSearch();
    initChatInput();
    scrollToBottom();
});

/* ---- Conversation Search ---- */
function initConversationSearch() {
    const searchInput = document.getElementById('searchConversations');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            document.querySelectorAll('.conversation-item').forEach(item => {
                const name = item.querySelector('.conv-name').textContent.toLowerCase();
                const preview = item.querySelector('.conv-preview').textContent.toLowerCase();
                item.style.display = (name.includes(query) || preview.includes(query)) ? '' : 'none';
            });
        });
    }
}

/* ---- Open Conversation ---- */
function openConversation(sellerId) {
    currentConversation = sellerId;
    const conv = conversations[sellerId];
    if (!conv) return;

    // Update active state
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget?.classList.add('active');

    // Update chat header
    document.getElementById('chatAvatar').src = conv.avatar;
    document.getElementById('chatUserName').textContent = conv.name;
    document.getElementById('chatUserStatus').innerHTML = `<i class="fas fa-circle" style="font-size: 0.5rem; color: ${conv.status === 'Online' ? 'var(--success-color)' : 'var(--text-light)'};"></i> ${conv.status}`;

    // Update product card
    const productCard = document.querySelector('.chat-product-card');
    if (conv.product && productCard) {
        productCard.style.display = '';
        productCard.querySelector('img').src = conv.product.image;
        productCard.querySelector('h4').textContent = conv.product.title;
        productCard.querySelector('p').textContent = conv.product.price;
    } else if (productCard) {
        productCard.style.display = 'none';
    }

    // Render messages
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    conv.messages.forEach(msg => {
        const msgEl = document.createElement('div');
        msgEl.className = `message ${msg.sent ? 'sent' : 'received'}`;
        msgEl.innerHTML = `
            <div>${msg.text}</div>
            <div class="message-time">${msg.time}</div>
        `;
        messagesContainer.appendChild(msgEl);
    });

    scrollToBottom();
}

/* ---- Send Message ---- */
function initChatInput() {
    const input = document.getElementById('messageInput');
    if (input) {
        input.focus();
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;

    const now = new Date();
    const timeStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + 
                    now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    // Add to UI
    const messagesContainer = document.getElementById('chatMessages');
    const msgEl = document.createElement('div');
    msgEl.className = 'message sent';
    msgEl.innerHTML = `
        <div>${escapeHtml(text)}</div>
        <div class="message-time">${timeStr}</div>
    `;
    msgEl.style.animation = 'slideIn 0.3s ease';
    messagesContainer.appendChild(msgEl);

    // Add to data
    if (conversations[currentConversation]) {
        conversations[currentConversation].messages.push({
            text: text,
            sent: true,
            time: timeStr
        });
    }

    input.value = '';
    scrollToBottom();

    // Simulate typing indicator and reply
    setTimeout(() => {
        showTypingIndicator();
        setTimeout(() => {
            removeTypingIndicator();
            simulateReply();
        }, 2000);
    }, 500);
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    const typing = document.createElement('div');
    typing.className = 'message received typing-indicator';
    typing.id = 'typingIndicator';
    typing.innerHTML = `
        <div style="display: flex; gap: 4px; padding: 4px 0;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--text-light); animation: typingBounce 1s infinite;"></span>
            <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--text-light); animation: typingBounce 1s infinite 0.2s;"></span>
            <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--text-light); animation: typingBounce 1s infinite 0.4s;"></span>
        </div>
    `;

    if (!document.getElementById('chat-animation-styles')) {
        const style = document.createElement('style');
        style.id = 'chat-animation-styles';
        style.textContent = `
            @keyframes typingBounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-4px); }
            }
        `;
        document.head.appendChild(style);
    }

    messagesContainer.appendChild(typing);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

function simulateReply() {
    const replies = [
        "Thank you for your message! Let me check on that for you.",
        "Sure, I can help with that. Give me a moment.",
        "That sounds great! Let me prepare your order.",
        "I appreciate your interest! The item is in excellent condition.",
        "Yes, we can arrange that. When would you like delivery?",
        "Thank you! I'll send you more photos shortly."
    ];
    
    const randomReply = replies[Math.floor(Math.random() * replies.length)];
    const now = new Date();
    const timeStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + 
                    now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const messagesContainer = document.getElementById('chatMessages');
    const msgEl = document.createElement('div');
    msgEl.className = 'message received';
    msgEl.innerHTML = `
        <div>${randomReply}</div>
        <div class="message-time">${timeStr}</div>
    `;
    messagesContainer.appendChild(msgEl);

    if (conversations[currentConversation]) {
        conversations[currentConversation].messages.push({
            text: randomReply,
            sent: false,
            time: timeStr
        });
    }

    scrollToBottom();
}

/* ---- Utility Functions ---- */
function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function attachFile() {
    alert('File attachment feature coming soon! In production, this would open a file picker for images and documents.');
}

function markAllRead() {
    document.querySelectorAll('.conv-unread').forEach(badge => badge.remove());
    const navBadge = document.getElementById('unreadMessages');
    if (navBadge) navBadge.style.display = 'none';
}

function viewSellerProfile() {
    showChatNotification('Opening seller profile...', 'info');
}

function reportUser() {
    if (confirm('Do you want to report this user? Please provide a reason.')) {
        const reason = prompt('Reason for reporting:');
        if (reason) {
            showChatNotification('Report submitted. Our team will review within 24 hours.', 'success');
        }
    }
}

function showChatNotification(message, type) {
    document.querySelectorAll('.chat-notification').forEach(n => n.remove());
    
    const colors = { info: 'var(--primary-color)', success: 'var(--success-color)', warning: 'var(--accent-color)', error: 'var(--error-color)' };
    const icons = { info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-circle', error: 'fa-times-circle' };
    
    const notification = document.createElement('div');
    notification.className = 'chat-notification';
    notification.style.cssText = `position:fixed;top:1rem;right:1rem;z-index:10000;background:white;padding:1rem 1.5rem;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);display:flex;align-items:center;gap:0.75rem;border-left:4px solid ${colors[type]};max-width:400px;`;
    notification.innerHTML = `<i class="fas ${icons[type]}" style="color:${colors[type]};font-size:1.25rem;"></i><span style="font-size:0.9rem;">${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}
