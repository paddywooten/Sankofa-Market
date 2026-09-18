/* ============================================================================
   SANKOFA MARKET - USER MESSAGES PAGE
   ============================================================================ */

// Conversation data (mock)
const conversations = {};

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
