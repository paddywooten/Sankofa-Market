/* ============================================================================
   SANKOFA MARKET - USER WISHLIST PAGE
   ============================================================================ */

var wishlistLocalRevision = 0;

document.addEventListener('DOMContentLoaded', function() {
    renderSavedWishlist();      // draw the items saved on product pages (localStorage)
    updateWishlistCount();
    initWishlistAnimations();
});

/* ---- Read the wishlist saved by js/wishlist.js on product pages ---- */
function getSavedWishlist() {
    try {
        var raw = localStorage.getItem('sankofa_wishlist');
        var list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
}

function saveWishlistList(list) {
    try { localStorage.setItem('sankofa_wishlist', JSON.stringify(list)); } catch (e) {}
    wishlistLocalRevision++;
    try { window.dispatchEvent(new Event('sankofa:wishlist')); } catch (e) {}
}

function escapeWishlistHtml(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---- Draw the saved items into the grid ---- */
function renderSavedWishlist() {
    var grid = document.getElementById('wishlistGrid');
    if (!grid) return;
    var items = getSavedWishlist();

    grid.innerHTML = items.map(function (item) {
        var img = item.image || '/images/placeholders/product.svg';
        var price = Number(item.price || 0);
        return '' +
            '<div class="wishlist-card" data-id="' + escapeWishlistHtml(item.id) + '">' +
                '<a href="../../product-detail.html?id=' + encodeURIComponent(item.id || '') + '" class="wishlist-card-image">' +
                    '<img src="' + escapeWishlistHtml(img) + '" alt="' + escapeWishlistHtml(item.title) + '"' +
                        ' onerror="this.onerror=null;this.src=\'/images/placeholders/product.svg\'" loading="lazy">' +
                '</a>' +
                '<div class="wishlist-card-body">' +
                    '<h3>' + escapeWishlistHtml(item.title || 'Item') + '</h3>' +
                    '<div class="wishlist-price">GHS ' + price.toLocaleString() + '</div>' +
                    (item.seller ? '<div class="wishlist-seller">' + escapeWishlistHtml(item.seller) + '</div>' : '') +
                    '<div class="wishlist-card-actions">' +
                        // Sankofa Store's own stock can be bought outright. For anybody else's
                        // item the buyer contacts the seller first — the same rule the product
                        // page uses. (A saved entry from before this change has no flag, so it
                        // is treated as another seller's, which is the safe default.)
                        (item.isSankofaStore === true
                            ? '<button class="btn btn-sm btn-primary" onclick="addToCart(\'' + escapeWishlistHtml(item.id) + '\')">' +
                                  '<i class="fas fa-cart-plus"></i> Add to Cart' +
                              '</button>'
                            : '<a class="btn btn-sm btn-primary" href="../../product-detail.html?id=' + encodeURIComponent(item.id || '') + '">' +
                                  '<i class="fas fa-comment"></i> Contact seller' +
                              '</a>') +
                        '<button class="btn btn-sm btn-outline" onclick="removeFromWishlist(\'' + escapeWishlistHtml(item.id) + '\')" title="Remove">' +
                            '<i class="fas fa-trash"></i>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }).join('');
}

/* ---- Wishlist Count ---- */
function updateWishlistCount() {
    const count = document.querySelectorAll('.wishlist-card').length;
    // This page's own label. The header/drawer badges injected by js/main.js and
    // js/wishlist.js also used to carry id="wishlistCount" — duplicate ids meant
    // getElementById found the badge first and this label stayed stuck on "0 items".
    const countEl = document.getElementById('wishlistPageCount');
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
async function removeFromWishlist(itemId) {
    var card = Array.from(document.querySelectorAll('.wishlist-card')).filter(function (c) {
        return String(c.getAttribute('data-id')) === String(itemId);
    })[0];
    if (!card) return;
    var savedItem = getSavedWishlist().filter(function (x) { return String(x.id) === String(itemId); })[0];
    var productId = String((savedItem && (savedItem.productId || savedItem.id)) || itemId);
    var itemName = card.querySelector('h3')?.textContent || 'Item';
    if (!confirm('Remove "' + itemName + '" from your wishlist?')) return;

    card.style.pointerEvents = 'none';
    try {
        if (window.SMWishlistCloud && typeof window.SMWishlistCloud.removeOne === 'function') {
            await window.SMWishlistCloud.removeOne(productId);
        } else if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
            throw new Error('Wishlist sync did not load. Refresh this page and try again.');
        }
    } catch (err) {
        card.style.pointerEvents = '';
        showWishlistNotification('Could not remove the synced item. Please try again.', 'error');
        return;
    }

    var remaining = getSavedWishlist().filter(function (x) {
        return String(x.id) !== String(itemId) && String(x.productId || x.id) !== productId;
    });
    saveWishlistList(remaining);
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.9)';
    setTimeout(function () {
        card.remove();
        renderSavedWishlist();
        updateWishlistCount();
        showWishlistNotification('"' + itemName + '" removed from wishlist', 'success');
    }, 300);
}

/* ---- Add to Cart ---- */
function addToCart(itemId) {
    const card = document.querySelector(`.wishlist-card[data-id="${itemId}"]`);
    if (!card) return;

    const itemName = card.querySelector('h3')?.textContent || 'Item';

    // Find the saved item; if the id lookup fails for any reason, rebuild it from the card
    var saved = getSavedWishlist().filter(function (x) { return String(x.id) === String(itemId); })[0];
    if (!saved) {
        saved = {
            id: itemId,
            title: itemName,
            price: Number(String(card.querySelector('.wishlist-price')?.textContent || '0').replace(/[^0-9.]/g, '')) || 0,
            image: card.querySelector('img')?.getAttribute('src') || '',
            seller: card.querySelector('.wishlist-seller')?.textContent || 'Sankofa Store'
        };
    }

    var added = addItemToStoredCart(saved);

    if (added.ok) {
        // animate the button
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
        showWishlistNotification('"' + itemName + '" added to your cart', 'success');
    } else {
        showWishlistNotification(added.reason || 'Could not add to cart', 'warning');
    }
}

/**
 * Put an item into the same cart storage the cart panel uses (localStorage: sankofa_cart).
 */
function addItemToStoredCart(item) {
    try {
        if (!item || !item.title) return { ok: false, reason: 'Item not found in your wishlist' };

        var cart = [];
        try { cart = JSON.parse(localStorage.getItem('sankofa_cart') || '[]'); } catch (e) { cart = []; }
        if (!Array.isArray(cart)) cart = [];

        var key = String(item.id || item.productId || item.title);
        var existing = cart.filter(function (c) { return String(c.id || c.productId || c.title) === key; })[0];

        if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
        } else {
            cart.push({
                id: item.id || ('local-' + Date.now()),
                productId: item.id || null,
                title: item.title,
                price: Number(item.price || 0),
                image: item.image || '/images/placeholders/product.svg',
                quantity: 1,
                seller: item.seller || 'Sankofa Store',
                maxQuantity: 10
            });
        }
        localStorage.setItem('sankofa_cart', JSON.stringify(cart));

        // Keep the live cart object in step (when cart.js is on this page)
        try {
            if (window.cart && typeof window.cart.loadCart === 'function') {
                window.cart.items = window.cart.loadCart();
                window.cart.updateCartCount();
                window.cart.updateCartUI();
            }
        } catch (e) {}
        return { ok: true };
    } catch (e) {
        return { ok: false, reason: 'Could not add to cart: ' + e.message };
    }
}

/**
 * Write a wishlist item into the same cart storage the cart panel uses
 * (localStorage key: sankofa_cart), de-duplicating by product id.
 */

/* ---- Clear All ---- */
async function clearWishlist() {
    var count = Math.max(document.querySelectorAll('.wishlist-card').length, getSavedWishlist().length);
    if (!confirm('Clear all saved items from this device and your account?\n\nThis action cannot be undone.')) return;
    try {
        if (window.SMWishlistCloud && typeof window.SMWishlistCloud.clearAll === 'function') {
            await window.SMWishlistCloud.clearAll();
        } else if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
            throw new Error('Wishlist sync did not load. Refresh this page and try again.');
        }
    } catch (err) {
        showWishlistNotification('Could not clear your synced wishlist. Nothing was cleared; please try again.', 'error');
        return;
    }

    saveWishlistList([]);
    var cards = document.querySelectorAll('.wishlist-card');
    cards.forEach(function (card, index) {
        setTimeout(function () {
            card.style.transition = 'opacity 0.2s, transform 0.2s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
        }, index * 50);
    });
    setTimeout(function () {
        cards.forEach(function (card) { card.remove(); });
        renderSavedWishlist();
        updateWishlistCount();
        showWishlistNotification(count ? 'Wishlist cleared' : 'Wishlist already empty', 'success');
    }, cards.length * 50 + 200);
}

/* ---- Notification ---- */
function showWishlistNotification(message, type) {
    document.querySelectorAll('.wishlist-notification').forEach(n => n.remove());
    
    const colors = { info: 'var(--primary-color)', success: 'var(--success-color)', warning: 'var(--accent-color)', error: 'var(--error-color)' };
    const icons = { info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-circle', error: 'fa-times-circle' };
    
    const notification = document.createElement('div');
    notification.className = 'wishlist-notification';
    notification.style.cssText = `position:fixed;top:1rem;right:1rem;z-index:10000;background:white;padding:1rem 1.5rem;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);display:flex;align-items:center;gap:0.75rem;border-left:4px solid ${colors[type]};max-width:400px;animation:slideIn 0.3s ease;`;
    notification.innerHTML = `<i class="fas ${icons[type]}" style="color:${colors[type]};font-size:1.25rem;"></i><span style="font-size:0.9rem;">${escapeFlashText(message)}</span>`;

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


/* Escape text before putting it into an innerHTML string.
   Product titles, names and emails are user-supplied — injecting them raw allowed a
   stored XSS (a product titled <img src=x onerror=...> ran script in the buyer's
   browser when the "added to cart" message was shown). */
function escapeFlashText(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled “classic” <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.getSavedWishlist = getSavedWishlist;
window.saveWishlistList = saveWishlistList;
window.escapeWishlistHtml = escapeWishlistHtml;
window.renderSavedWishlist = renderSavedWishlist;
window.showWishlistNotification = showWishlistNotification;
window.updateWishlistCount = updateWishlistCount;
window.initWishlistAnimations = initWishlistAnimations;
window.removeFromWishlist = removeFromWishlist;
window.addToCart = addToCart;
window.addItemToStoredCart = addItemToStoredCart;
window.clearWishlist = clearWishlist;
window.escapeFlashText = escapeFlashText;


/* ---- Cloud wishlist merge: items saved while signed in on another phone arrive here too ---- */
document.addEventListener('DOMContentLoaded', function() {
    if (typeof firebase === 'undefined' || !firebase.auth || typeof firebaseDB === 'undefined' || !firebaseDB) return;
    firebase.auth().onAuthStateChanged(function(u) {
        if (!u) return;
        var revisionAtStart = wishlistLocalRevision;
        firebaseDB.collection('wishlist').where('uid', '==', u.uid).limit(500).get({ source: 'server' }).then(function(snap) {
            if (revisionAtStart !== wishlistLocalRevision) return;
            var list = getSavedWishlist();
            var changed = false;
            snap.forEach(function(doc) {
                var w = doc.data() || {};
                if (!w.productId) return;
                if (!list.some(function(it){ return String(it.id) === String(w.productId) || String(it.productId || '') === String(w.productId); })) {
                    list.push({
                        id: String(w.productId), productId: String(w.productId),
                        title: w.title || 'Item', price: Number(w.price || 0),
                        image: w.image || '', seller: w.seller || '',
                        isSankofaStore: w.isSankofaStore === true,
                        addedAt: w.addedAt || new Date().toISOString()
                    });
                    changed = true;
                }
            });
            if (changed) { saveWishlistList(list); renderSavedWishlist(); updateWishlistCount(); }
        }).catch(function(){});
    });
});
