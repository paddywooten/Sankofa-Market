/**
 * Sankofa Market - Admin Messages Management
 * Handles admin chat monitoring and moderation
 */

document.addEventListener('DOMContentLoaded', function() {
    initAdminMessages();
});

// ============================================================================
// ADMIN MESSAGES INITIALIZATION
// ============================================================================

function initAdminMessages() {
    initConversationsList();
    initChatArea();
    initMessageFilters();
    initMessageActions();
    loadConversations();
}

// ============================================================================
// CONVERSATIONS LIST
// ============================================================================

function initConversationsList() {
    const conversationsContainer = document.getElementById('conversationsContainer');
    
    if (!conversationsContainer) return;
    
    // Add click event to conversation items
    conversationsContainer.addEventListener('click', function(e) {
        const conversationItem = e.target.closest('.conversation-item');
        if (conversationItem) {
            const conversationId = conversationItem.dataset.conversationId;
            loadConversation(conversationId);
            
            // Update active state
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
            });
            conversationItem.classList.add('active');
        }
    });
}

function loadConversations() {
    // In a real app, this would fetch from Firebase
    console.log('Loading conversations...');
    
    // Demo data is already in HTML
    // In production, this would fetch from Firebase
}

function loadConversation(conversationId) {
    console.log('Loading conversation:', conversationId);
    
    // In a real app, this would fetch conversation messages from Firebase
    // For now, we'll just update the chat area with demo data
    
    // Update chat header
    updateChatHeader(conversationId);
    
    // Load messages
    loadMessages(conversationId);
}

function updateChatHeader(conversationId) {
    // In a real app, this would fetch conversation details
    console.log('Updating chat header for:', conversationId);
}

function loadMessages(conversationId) {
    // In a real app, this would fetch messages from Firebase
    console.log('Loading messages for:', conversationId);
    
    // Demo messages are already in HTML
}

// ============================================================================
// CHAT AREA
// ============================================================================

function initChatArea() {
    const chatInput = document.getElementById('chatInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    
    if (!chatInput || !sendMessageBtn) return;
    
    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    
    // Send message on Enter (Shift+Enter for new line)
    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Send message button
    sendMessageBtn.addEventListener('click', sendMessage);
}

function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    console.log('Sending message:', message);
    
    // In a real app, this would send to Firebase
    // For now, we'll just add it to the chat
    
    addMessageToChat(message, 'sent');
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Scroll to bottom
    scrollToBottom();
}

function addMessageToChat(message, type = 'sent') {
    const chatMessages = document.getElementById('chatMessages');
    
    const messageItem = document.createElement('div');
    messageItem.className = `message-item ${type}`;
    
    const avatarUrl = type === 'sent' 
        ? 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=40&h=40&fit=crop&crop=face&q=75&auto=format'
        : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=40&h=40&fit=crop&crop=face&q=75&auto=format';
    
    const senderName = type === 'sent' ? 'Admin' : 'User';
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    messageItem.innerHTML = `
        <div class="message-avatar">
            <img src="${avatarUrl}" alt="${senderName}">
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">${senderName}</span>
                <span class="message-time">${currentTime}</span>
            </div>
            <div class="message-body">
                <p>${message}</p>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageItem);
    scrollToBottom();
}

function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ============================================================================
// MESSAGE FILTERS
// ============================================================================

function initMessageFilters() {
    const statusFilter = document.getElementById('messageStatusFilter');
    const typeFilter = document.getElementById('messageTypeFilter');
    const searchInput = document.getElementById('messageSearch');
    
    if (statusFilter) {
        statusFilter.addEventListener('change', filterConversations);
    }
    
    if (typeFilter) {
        typeFilter.addEventListener('change', filterConversations);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterConversations, 300));
    }
}

function filterConversations() {
    const statusFilter = document.getElementById('messageStatusFilter').value;
    const typeFilter = document.getElementById('messageTypeFilter').value;
    const searchQuery = document.getElementById('messageSearch').value.toLowerCase();
    
    const conversationItems = document.querySelectorAll('.conversation-item');
    
    conversationItems.forEach(item => {
        let show = true;
        
        // Filter by status
        if (statusFilter) {
            if (statusFilter === 'flagged' && !item.classList.contains('flagged')) {
                show = false;
            } else if (statusFilter === 'reported' && !item.classList.contains('reported')) {
                show = false;
            } else if (statusFilter === 'active' && (item.classList.contains('flagged') || item.classList.contains('reported'))) {
                show = false;
            }
        }
        
        // Filter by type
        if (typeFilter && show) {
            const conversationType = item.querySelector('.conversation-type').textContent.toLowerCase();
            if (!conversationType.includes(typeFilter)) {
                show = false;
            }
        }
        
        // Filter by search query
        if (searchQuery && show) {
            const conversationText = item.textContent.toLowerCase();
            if (!conversationText.includes(searchQuery)) {
                show = false;
            }
        }
        
        item.style.display = show ? 'flex' : 'none';
    });
}

// ============================================================================
// MESSAGE ACTIONS
// ============================================================================

function initMessageActions() {
    const viewUserProfileBtn = document.getElementById('viewUserProfileBtn');
    const viewProductBtn = document.getElementById('viewProductBtn');
    const flagConversationBtn = document.getElementById('flagConversationBtn');
    const suspendUsersBtn = document.getElementById('suspendUsersBtn');
    
    if (viewUserProfileBtn) {
        viewUserProfileBtn.addEventListener('click', viewUserProfile);
    }
    
    if (viewProductBtn) {
        viewProductBtn.addEventListener('click', viewProduct);
    }
    
    if (flagConversationBtn) {
        flagConversationBtn.addEventListener('click', flagConversation);
    }
    
    if (suspendUsersBtn) {
        suspendUsersBtn.addEventListener('click', suspendUsers);
    }
}

function viewUserProfile() {
    console.log('Viewing user profile...');
    alert('User profile view coming soon!');
}

function viewProduct() {
    console.log('Viewing product...');
    alert('Product view coming soon!');
}

function flagConversation() {
    const reason = prompt('Please provide a reason for flagging this conversation:');
    
    if (reason) {
        console.log('Flagging conversation:', reason);
        
        // In a real app, this would update Firebase
        showFlashMessage('Conversation flagged successfully!', 'success');
        
        // Update conversation item
        const activeConversation = document.querySelector('.conversation-item.active');
        if (activeConversation) {
            activeConversation.classList.add('flagged');
            const conversationType = activeConversation.querySelector('.conversation-type');
            if (conversationType) {
                conversationType.textContent = 'Flagged';
                conversationType.classList.add('flagged');
            }
        }
    }
}

function suspendUsers() {
    const reason = prompt('Please provide a reason for suspending users in this conversation:');
    
    if (reason) {
        if (confirm('Are you sure you want to suspend all users in this conversation?')) {
            console.log('Suspending users:', reason);
            
            // In a real app, this would update Firebase
            showFlashMessage('Users suspended successfully!', 'success');
        }
    }
}

// ============================================================================
// EXPORT FUNCTIONALITY
// ============================================================================

function exportMessages() {
    console.log('Exporting messages...');
    showFlashMessage('Messages exported successfully!', 'success');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    // Export button
    const exportMessagesBtn = document.getElementById('exportMessagesBtn');
    if (exportMessagesBtn) {
        exportMessagesBtn.addEventListener('click', exportMessages);
    }
    
    // Refresh button
    const refreshMessagesBtn = document.getElementById('refreshMessagesBtn');
    if (refreshMessagesBtn) {
        refreshMessagesBtn.addEventListener('click', function() {
            console.log('Refreshing messages...');
            loadConversations();
            showFlashMessage('Messages refreshed!', 'success');
        });
    }
});
