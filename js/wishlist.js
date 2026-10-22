/**
 * Sankofa Store Wishlist/Favorites
 * Allows users to save items for later
 */

/* ---- Wishlist cloud sync (Firestore is the truth; localStorage is the offline cache) ----
 * Saves/removes are mirrored to `wishlist/{uid}_{productId}` so (a) the server can alert
 * premium users when a saved item's price drops, and (b) the list follows you across phones. */
function syncWishlistToCloud(action, product, productId) {
    try {
        if (typeof firebase === 'undefined' || !firebase.auth || typeof firebaseDB === 'undefined' || !firebaseDB) return Promise.resolve(null);
        var u = firebase.auth().currentUser;
        if (!u) return Promise.resolve(null);
        if (action === 'remove' && window.SMWishlistCloud) return window.SMWishlistCloud.removeOne(productId);
        if (action !== 'add') return Promise.resolve(null);
        var ref = firebaseDB.collection('wishlist').doc(u.uid + '_' + productId);
        return ref.set({
            uid: u.uid,
            productId: String(productId),
            title: String(product.title || 'Item'),
            price: Number(product.price || 0),
            image: String((typeof productThumb === 'function' ? productThumb(product) : (product.images || product.photos || [])[0]) || ''),
            seller: String(product.sellerName || ''),
            isSankofaStore: product.isSankofaStore === true,
            addedAt: new Date().toISOString()
        });
    } catch (e) { return Promise.reject(e); }
}

class SankofaWishlist {
    constructor() {
        this.items = this.loadWishlist();
        this._localRevision = 0;
        this.init();
    }

    init() {
        this.createWishlistUI();
        this.updateWishlistCount();
        var self = this;
        window.addEventListener('sankofa:wishlist', function () {
            self.items = self.loadWishlist();
            self.updateWishlistCount();
            self.updateWishlistUI();
        });
        window.addEventListener('storage', function (e) {
            if (e.key === 'sankofa_wishlist') {
                self.items = self.loadWishlist();
                self.updateWishlistCount();
                self.updateWishlistUI();
            }
        });
        // The drawer's markup starts as the "empty" placeholder, and nothing ever redrew it —
        // so opening it showed "Your wishlist is empty" even with items saved, until you saved
        // another one in that same visit. Painting it here is what makes saved items appear.
        this.updateWishlistUI();
        // pull anything saved on another device/signed-in session and merge it in
        if (typeof firebase !== 'undefined' && firebase.auth) {
            var self = this;
            firebase.auth().onAuthStateChanged(function(u) { if (u) self.mergeFromCloud(u); });
        }
    }

    mergeFromCloud(u) {
        try {
            if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
            var self = this;
            var revisionAtStart = this._localRevision;
            firebaseDB.collection('wishlist').where('uid', '==', u.uid).limit(500).get({ source: 'server' }).then(function(snap) {
                if (revisionAtStart !== self._localRevision) return;
                var changed = false;
                snap.forEach(function(doc) {
                    var w = doc.data() || {};
                    if (!w.productId) return;
                    if (!self.items.some(function(it){ return String(it.id) === String(w.productId) || String(it.productId || '') === String(w.productId); })) {
                        self.items.push({
                            id: String(w.productId), productId: String(w.productId),
                            title: w.title || 'Item', price: Number(w.price || 0),
                            image: w.image || '', seller: w.seller || '',
                            isSankofaStore: w.isSankofaStore === true,
                            addedAt: w.addedAt || new Date().toISOString()
                        });
                        changed = true;
                    }
                });
                if (changed) self.saveWishlist();
            }).catch(function(){});
        } catch (e) {}
    }

    // =========================================================================
    // WISHLIST MANAGEMENT
    // =========================================================================

    loadWishlist() {
        const saved = localStorage.getItem('sankofa_wishlist');
        let items = [];
        try { items = saved ? JSON.parse(saved) : []; } catch (e) { items = []; }
        if (!Array.isArray(items)) items = [];
        // Older entries were saved without an id (product.id is undefined for Firestore
        // documents, which use _docId). Give them one so links/buttons keep working.
        let changed = false;
        items.forEach((item, i) => {
            if (!item.id) {
                item.id = item.productId || ('saved-' + i + '-' + String(item.title || 'item').replace(/\s+/g, '-').toLowerCase());
                changed = true;
            }
            if (item.productId === undefined) { item.productId = null; changed = true; }
        });
        if (changed) { try { localStorage.setItem('sankofa_wishlist', JSON.stringify(items)); } catch (e) {} }
        return items;
    }

    saveWishlist() {
        localStorage.setItem('sankofa_wishlist', JSON.stringify(this.items));
        this._localRevision++;
        this.updateWishlistCount();
        this.updateWishlistUI();
        // lets the header badge (js/main.js) update immediately, in this tab
        try { window.dispatchEvent(new Event('sankofa:wishlist')); } catch (e) {}
    }

    addItem(product) {
        // Firestore documents carry _docId — product.id is usually undefined for them
        const productId = product._docId || product.id || ('saved-' + Date.now());

        // Check if already in wishlist
        if (this.items.some(item => String(item.id) === String(productId) || String(item.productId || '') === String(productId))) {
            showFlashMessage('Item already in wishlist', 'info');
            return false;
        }

        this.items.push({
            id: productId,
            productId: productId,
            title: product.title,
            price: product.price,
            image: (typeof productThumb === 'function') ? productThumb(product) : (product.images || product.photos || [])[0],
            seller: product.sellerName || 'Sankofa Store',
            // Sankofa Store's own stock can be bought outright; other people's items are
            // contacted/negotiated first, exactly as on the product page.
            isSankofaStore: product.isSankofaStore === true,
            addedAt: new Date().toISOString()
        });

        this.saveWishlist();
        syncWishlistToCloud('add', product, productId).catch(function (e) { console.warn('wishlist cloud save failed:', e && e.message); });
        // "Picked for you" learning — a saved item is a strong interest signal
        try {
            if (typeof window !== 'undefined' && typeof window.smForYouTrackWishlist === 'function') {
                window.smForYouTrackWishlist(product);
            }
        } catch (e) {}
        showFlashMessage(`Added ${product.title} to wishlist`, 'success');
        this.animateWishlistIcon();
        return true;
    }

    removeItem(productId) {
        var self = this;
        return syncWishlistToCloud('remove', null, String(productId)).then(function () {
            self.items = self.items.filter(item => String(item.id) !== String(productId) && String(item.productId || '') !== String(productId));
            self.saveWishlist();
            showFlashMessage('Item removed from wishlist', 'info');
            return true;
        }).catch(function (err) {
            showFlashMessage('Could not remove this saved item from your account. Please try again.', 'error');
            console.warn('wishlist cloud delete failed:', err && err.message);
            return false;
        });
    }

    isInWishlist(productId) {
        return this.items.some(item => String(item.id) === String(productId) || String(item.productId || '') === String(productId));
    }

    clearWishlist() {
        var self = this;
        if (!confirm('Are you sure you want to clear your wishlist on this device and your account?')) return Promise.resolve(false);
        return (window.SMWishlistCloud ? window.SMWishlistCloud.clearAll() : Promise.resolve(null)).then(function () {
            self.items = [];
            self.saveWishlist();
            showFlashMessage('Wishlist cleared', 'info');
            return true;
        }).catch(function (err) {
            showFlashMessage('Could not clear your synced wishlist. Nothing was cleared; please try again.', 'error');
            console.warn('wishlist cloud clear failed:', err && err.message);
            return false;
        });
    }

    getCount() {
        return this.items.length;
    }

    // =========================================================================
    // UI CREATION
    // =========================================================================

    createWishlistUI() {
        // Create wishlist icon in header
        this.createWishlistIcon();
        
        // Create wishlist sidebar
        this.createWishlistSidebar();
    }

    createWishlistIcon() {
        const header = document.querySelector('.header-actions') || document.querySelector('.header .container');
        if (!header) return;

        const wishlistIcon = document.createElement('button');
        wishlistIcon.className = 'wishlist-icon-btn';
        wishlistIcon.id = 'wishlistIconBtn';
        wishlistIcon.setAttribute('aria-label', 'Open your saved items');
        wishlistIcon.setAttribute('aria-haspopup', 'dialog');
        // NOTE: no id on the badge — updateWishlistCount() finds it inside #wishlistIconBtn.
        // A duplicate id="wishlistCount" collided with the wishlist page's own "N items" label.
        wishlistIcon.innerHTML = `
            <i class="fas fa-heart"></i>
            <span class="wishlist-count">0</span>
        `;
        wishlistIcon.onclick = () => this.toggleWishlist();

        // Insert before cart icon
        const cartIcon = header.querySelector('.cart-icon-btn');
        if (cartIcon) {
            header.insertBefore(wishlistIcon, cartIcon);
        } else {
            const firstButton = header.querySelector('a, button');
            if (firstButton) {
                header.insertBefore(wishlistIcon, firstButton);
            } else {
                header.appendChild(wishlistIcon);
            }
        }
    }

    createWishlistSidebar() {
        const sidebar = document.createElement('div');
        sidebar.className = 'wishlist-sidebar';
        sidebar.id = 'wishlistSidebar';
        sidebar.innerHTML = `
            <div class="wishlist-sidebar-header">
                <h2><i class="fas fa-heart"></i> My Wishlist</h2>
                <button class="wishlist-close" onclick="wishlist.toggleWishlist()" aria-label="Close saved items">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </div>
            <div class="wishlist-sidebar-content" id="wishlistSidebarContent">
                <div class="wishlist-empty">
                    <i class="fas fa-heart"></i>
                    <p>Your wishlist is empty</p>
                    <a href="search.html" class="btn btn-primary">Browse Products</a>
                </div>
            </div>
            <div class="wishlist-sidebar-footer" id="wishlistSidebarFooter" style="display: none;">
                <button class="btn btn-outline btn-full" onclick="wishlist.clearWishlist()">
                    <i class="fas fa-trash"></i> Clear Wishlist
                </button>
            </div>
        `;
        document.body.appendChild(sidebar);

        // Add overlay
        const overlay = document.createElement('div');
        overlay.className = 'wishlist-overlay';
        overlay.id = 'wishlistOverlay';
        overlay.onclick = () => this.toggleWishlist();
        document.body.appendChild(overlay);
    }

    // =========================================================================
    // UI UPDATES
    // =========================================================================

    updateWishlistCount() {
        const count = this.getCount();
        // Scoped to this component's own icon — several .wishlist-count badges can be
        // on the page (header icon, drawer, page label) and document.getElementById
        // only ever returns the first one.
        const countElement = document.querySelector('#wishlistIconBtn .wishlist-count');
        if (countElement) {
            countElement.textContent = count;
            countElement.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    updateWishlistUI() {
        const content = document.getElementById('wishlistSidebarContent');
        const footer = document.getElementById('wishlistSidebarFooter');

        if (this.items.length === 0) {
            content.innerHTML = `
                <div class="wishlist-empty">
                    <i class="fas fa-heart"></i>
                    <p>Your wishlist is empty</p>
                    <a href="search.html" class="btn btn-primary">Browse Products</a>
                </div>
            `;
            footer.style.display = 'none';
        } else {
            content.innerHTML = this.items.map(item => `
                <div class="wishlist-item">
                    <img src="${item.image}" alt="${item.title}" class="wishlist-item-image">
                    <div class="wishlist-item-details">
                        <h4 class="wishlist-item-title">${item.title}</h4>
                        <p class="wishlist-item-price">GHS ${item.price.toLocaleString()}</p>
                        <div class="wishlist-item-actions">
                            <a href="product-detail.html?id=${item.id}" class="btn btn-sm btn-outline">
                                <i class="fas fa-eye"></i> View
                            </a>
                            ${item.isSankofaStore
                                ? `<button class="btn btn-sm btn-primary" onclick="wishlist.addToCart('${item.id}')">
                                       <i class="fas fa-cart-plus"></i> Add to Cart
                                   </button>`
                                : `<a href="product-detail.html?id=${item.id}" class="btn btn-sm btn-primary">
                                       <i class="fas fa-comment"></i> Contact seller
                                   </a>`}
                        </div>
                    </div>
                    <button class="wishlist-item-remove" onclick="wishlist.removeItem('${item.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');

            footer.style.display = 'block';
        }
    }

    animateWishlistIcon() {
        const icon = document.getElementById('wishlistIconBtn');
        if (icon) {
            icon.classList.add('animate');
            setTimeout(() => icon.classList.remove('animate'), 500);
        }
    }

    // =========================================================================
    // WISHLIST INTERACTIONS
    // =========================================================================

    toggleWishlist() {
        const sidebar = document.getElementById('wishlistSidebar');
        const overlay = document.getElementById('wishlistOverlay');
        
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
        
        document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    }

    addToCart(productId) {
        const item = this.items.find(item => String(item.id) === String(productId));
        if (!item) return false;
        if (typeof cart === 'undefined') {
            showFlashMessage('Cart is starting up — please try again in a second', 'warning');
            return false;
        }
        return cart.addItem({
            _docId: item.id,
            id: item.id,
            title: item.title,
            price: item.price,
            images: [item.image],
            photos: [item.image],
            sellerName: item.seller,
            isSankofaStore: true
        });
    }
}

// Initialize wishlist
const wishlist = new SankofaWishlist();

// Make wishlist globally accessible
window.wishlist = wishlist;
