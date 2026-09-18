/* ============================================================================
   SANKOFA MARKET - USER ORDERS PAGE
   ============================================================================ */

document.addEventListener('DOMContentLoaded', function() {
    initOrderFilters();
    initOrderActions();
});

/* ---- Filter Tabs ---- */
function initOrderFilters() {
    const tabs = document.querySelectorAll('.filter-tab');
    const orders = document.querySelectorAll('.order-card');

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            const filter = this.dataset.filter;

            orders.forEach(order => {
                if (filter === 'all' || order.dataset.status === filter) {
                    order.style.display = '';
                } else {
                    order.style.display = 'none';
                }
            });
        });
    });
}

/* ---- Order Actions ---- */
function initOrderActions() {
    // Add hover effects to order cards
    document.querySelectorAll('.order-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-1px)';
            this.style.boxShadow = 'var(--shadow-md)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = '';
            this.style.boxShadow = '';
        });
    });
}

/* ---- Order Functions ---- */
function viewOrderDetails(orderId) {
    showNotification('Opening order details for #' + orderId + '...', 'info');
    // In production: navigate to order detail page
    // window.location.href = '/pages/user/order-detail.html?id=' + orderId;
}

function trackOrder(orderId) {
    showNotification('Tracking order #' + orderId + '...', 'info');
    // Show tracking modal or navigate to tracking page
    const modal = createTrackingModal(orderId);
    document.body.appendChild(modal);
}

function contactSeller(sellerId) {
    window.location.href = 'messages.html?seller=' + sellerId;
}

function reorderItems(orderId) {
    showNotification('Adding items from order #' + orderId + ' to cart...', 'success');
    // In production: add items to cart via API
}

function leaveReview(orderId) {
    showNotification('Opening review form for order #' + orderId + '...', 'info');
    // In production: open review modal
}

function cancelOrder(orderId) {
    if (confirm('Are you sure you want to cancel order #' + orderId + '?\n\nIf payment was made, a refund will be processed within 5-10 business days.')) {
        showNotification('Cancelling order #' + orderId + '...', 'warning');
        // In production: call API to cancel
        setTimeout(() => {
            const card = document.querySelector(`[data-status] .order-card-header .order-info strong`);
            showNotification('Order #' + orderId + ' has been cancelled.', 'success');
        }, 1000);
    }
}

function completePayment(orderId) {
    showNotification('Redirecting to payment page...', 'info');
    window.location.href = '../../payment.html?order=' + orderId;
}

/* ---- Tracking Modal ---- */
function createTrackingModal(orderId) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    
    overlay.innerHTML = `
        <div style="background:white;border-radius:12px;max-width:500px;width:100%;padding:2rem;position:relative;">
            <button onclick="this.closest('div[style*=fixed]').remove()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.25rem;cursor:pointer;color:#767676;">
                <i class="fas fa-times"></i>
            </button>
            <h2 style="font-size:1.25rem;margin-bottom:1.5rem;">
                <i class="fas fa-truck" style="color:var(--primary-color);"></i> Track Order #${orderId}
            </h2>
            
            <div style="display:flex;flex-direction:column;gap:0;">
                <!-- Step 1 -->
                <div style="display:flex;gap:1rem;align-items:flex-start;">
                    <div style="display:flex;flex-direction:column;align-items:center;">
                        <div style="width:24px;height:24px;border-radius:50%;background:var(--success-color);color:white;display:flex;align-items:center;justify-content:center;font-size:0.7rem;"><i class="fas fa-check"></i></div>
                        <div style="width:2px;height:40px;background:var(--success-color);"></div>
                    </div>
                    <div style="padding-bottom:1rem;">
                        <strong>Order Confirmed</strong>
                        <p style="font-size:0.8rem;color:var(--text-secondary);margin:0;">Sep 14, 2026 at 2:30 PM</p>
                    </div>
                </div>
                
                <!-- Step 2 -->
                <div style="display:flex;gap:1rem;align-items:flex-start;">
                    <div style="display:flex;flex-direction:column;align-items:center;">
                        <div style="width:24px;height:24px;border-radius:50%;background:var(--success-color);color:white;display:flex;align-items:center;justify-content:center;font-size:0.7rem;"><i class="fas fa-check"></i></div>
                        <div style="width:2px;height:40px;background:var(--success-color);"></div>
                    </div>
                    <div style="padding-bottom:1rem;">
                        <strong>Payment Received</strong>
                        <p style="font-size:0.8rem;color:var(--text-secondary);margin:0;">Sep 14, 2026 at 2:31 PM (MTN MoMo)</p>
                    </div>
                </div>
                
                <!-- Step 3 -->
                <div style="display:flex;gap:1rem;align-items:flex-start;">
                    <div style="display:flex;flex-direction:column;align-items:center;">
                        <div style="width:24px;height:24px;border-radius:50%;background:var(--success-color);color:white;display:flex;align-items:center;justify-content:center;font-size:0.7rem;"><i class="fas fa-check"></i></div>
                        <div style="width:2px;height:40px;background:var(--primary-color);"></div>
                    </div>
                    <div style="padding-bottom:1rem;">
                        <strong>Shipped</strong>
                        <p style="font-size:0.8rem;color:var(--text-secondary);margin:0;">Sep 15, 2026 at 10:00 AM</p>
                        <p style="font-size:0.8rem;color:var(--primary-color);margin:0;">SPX Express - TRK${orderId.replace(/\D/g, '')}</p>
                    </div>
                </div>
                
                <!-- Step 4 (current) -->
                <div style="display:flex;gap:1rem;align-items:flex-start;">
                    <div style="display:flex;flex-direction:column;align-items:center;">
                        <div style="width:24px;height:24px;border-radius:50%;background:var(--primary-color);color:white;display:flex;align-items:center;justify-content:center;font-size:0.7rem;animation:pulse 2s infinite;"><i class="fas fa-truck"></i></div>
                        <div style="width:2px;height:40px;background:var(--border-color);"></div>
                    </div>
                    <div style="padding-bottom:1rem;">
                        <strong style="color:var(--primary-color);">In Transit - Out for Delivery</strong>
                        <p style="font-size:0.8rem;color:var(--text-secondary);margin:0;">Expected delivery: Sep 18, 2026</p>
                    </div>
                </div>
                
                <!-- Step 5 -->
                <div style="display:flex;gap:1rem;align-items:flex-start;">
                    <div style="display:flex;flex-direction:column;align-items:center;">
                        <div style="width:24px;height:24px;border-radius:50%;background:var(--border-color);color:var(--text-secondary);display:flex;align-items:center;justify-content:center;font-size:0.7rem;"><i class="fas fa-home"></i></div>
                    </div>
                    <div>
                        <strong style="color:var(--text-secondary);">Delivered</strong>
                        <p style="font-size:0.8rem;color:var(--text-light);margin:0;">Pending</p>
                    </div>
                </div>
            </div>
            
            <div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border-color);display:flex;gap:0.5rem;">
                <button class="btn btn-outline btn-small" onclick="this.closest('div[style*=fixed]').remove()">Close</button>
                <button class="btn btn-primary btn-small" onclick="contactSeller('ama-textiles')"><i class="fas fa-comments"></i> Contact Seller</button>
            </div>
        </div>
    `;
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });
    
    return overlay;
}

/* ---- Notification System ---- */
function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.order-notification').forEach(n => n.remove());
    
    const icons = {
        info: 'fa-info-circle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-circle',
        error: 'fa-times-circle'
    };
    
    const colors = {
        info: 'var(--primary-color)',
        success: 'var(--success-color)',
        warning: 'var(--accent-color)',
        error: 'var(--error-color)'
    };
    
    const notification = document.createElement('div');
    notification.className = 'order-notification';
    notification.style.cssText = `
        position: fixed; top: 1rem; right: 1rem; z-index: 10000;
        background: white; padding: 1rem 1.5rem; border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 0.75rem;
        border-left: 4px solid ${colors[type]}; max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `
        <i class="fas ${icons[type]}" style="color: ${colors[type]}; font-size: 1.25rem;"></i>
        <span style="font-size: 0.9rem;">${message}</span>
    `;
    
    // Add animation keyframes if not already present
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
