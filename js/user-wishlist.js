/* ============================================================================
   SANKOFA MARKET - USER WISHLIST PAGE
   ============================================================================ */

document.addEventListener('DOMContentLoaded', function() {
    updateWishlistCount();
    initWishlistAnimations();
});

/* ---- Wishlist Count ---- */
function updateWishlistCount() {
    const count = document.querySelectorAll('.wishlist-card').length;
    const countEl = document.getElementById('wishlistCount');
    if (countEl) {
        countEl.textContent = count + (count === 1 ? ' item' : ' items');
    }

    // Show empty state if no items
    const emptyState = document.getElementById('emptyWishlist');
    const grid = document.getElementById('wishlistGrid');
    if (emptyState && grid) {
        if (count === 0) {
            emptyState.style.display = '';
            grid.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            grid.style.display = '';
        }
    }
}

/* ---- Animations ---- */
function initWishlistAnimations() {
    document.querySelectorAll('.wishlist-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-4px)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
    });
}

/* ---- Remove from Wishlist ---- */
function removeFromWishlist(itemId) {
    const card = document.querySelector(`.wishlist-card[data-id="${itemId}"]`);
    if (!card) return;

    const itemName = card.querySelector('h3')?.textContent || 'Item';
    
    if (confirm(`Remove "${itemName}" from your wishlist?`)) {
        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
            card.remove();
            updateWishlistCount();
            showWishlistNotification(`"${itemName}" removed from wishlist`, 'success');
        }, 300);
    }
}

/* ---- Add to Cart ---- */
function addToCart(itemId) {
    const card = document.querySelector(`.wishlist-card[data-id="${itemId}"]`);
    if (!card) return;

    const itemName = card.querySelector('h3')?.textContent || 'Item';
    const price = card.querySelector('.wishlist-price')?.textContent || '';

    // Animate the button
    const btn = card.querySelector('.btn-primary');
    if (btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Added!';
        btn.style.background = 'var(--success-color)';
        btn.disabled = true;

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.background = '';
            btn.disabled = false;
        }, 2000);
    }

    showWishlistNotification(`"${itemName}" added to cart!`, 'success');

    // Update cart count in header (if exists)
    const cartBadge = document.querySelector('.cart-count, .cart-badge');
    if (cartBadge) {
        const current = parseInt(cartBadge.textContent) || 0;
        cartBadge.textContent = current + 1;
        cartBadge.style.animation = 'none';
        cartBadge.offsetHeight; // trigger reflow
        cartBadge.style.animation = 'pulse 0.3s ease';
    }
}

/* ---- Clear All ---- */
function clearWishlist() {
    const count = document.querySelectorAll('.wishlist-card').length;
    if (count === 0) return;
    
    if (confirm(`Remove all ${count} items from your wishlist?\n\nThis action cannot be undone.`)) {
        const cards = document.querySelectorAll('.wishlist-card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.transition = 'opacity 0.2s, transform 0.2s';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
            }, index * 50);
        });

        setTimeout(() => {
            cards.forEach(card => card.remove());
            updateWishlistCount();
            showWishlistNotification('Wishlist cleared', 'success');
        }, cards.length * 50 + 200);
    }
}

/* ---- Notification ---- */
function showWishlistNotification(message, type) {
    document.querySelectorAll('.wishlist-notification').forEach(n => n.remove());
    
    const colors = { info: 'var(--primary-color)', success: 'var(--success-color)', warning: 'var(--accent-color)', error: 'var(--error-color)' };
    const icons = { info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-circle', error: 'fa-times-circle' };
    
    const notification = document.createElement('div');
    notification.className = 'wishlist-notification';
    notification.style.cssText = `position:fixed;top:1rem;right:1rem;z-index:10000;background:white;padding:1rem 1.5rem;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);display:flex;align-items:center;gap:0.75rem;border-left:4px solid ${colors[type]};max-width:400px;animation:slideIn 0.3s ease;`;
    notification.innerHTML = `<i class="fas ${icons[type]}" style="color:${colors[type]};font-size:1.25rem;"></i><span style="font-size:0.9rem;">${message}</span>`;

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
