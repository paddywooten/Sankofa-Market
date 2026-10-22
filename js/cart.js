/**
 * Sankofa Store Shopping Cart
 * Manages cart items, quantities, and totals
 */

class SankofaCart {
    constructor() {
        this.items = this.loadCart();
        this.init();
    }

    init() {
        this.createCartUI();
        this.normaliseItems();       // make sure every stored item has a usable id
        this.updateCartCount();
        this.updateCartUI();         // ← render what is already stored (was missing: the panel
                                     //    kept showing "Your cart is empty" until you added
                                     //    something again on that same page)
        this.attachEventListeners();
    }

    /**
     * Older carts were saved without an id (product.id was undefined), which broke the
     * +/− and remove buttons. Give every item a stable id and keep the Firestore id
     * separately so the same product can never appear twice.
     */
    normaliseItems() {
        let changed = false;
        this.items.forEach((item, i) => {
            if (!item.id) {
                item.id = item.productId || ('local-' + i + '-' + String(item.title || 'item').replace(/\s+/g, '-'));
                changed = true;
            }
            if (item.productId === undefined) { item.productId = null; changed = true; }
        });
        if (changed) {
            try { localStorage.setItem('sankofa_cart', JSON.stringify(this.items)); } catch (e) {}
        }
    }

    // =========================================================================
    // CART MANAGEMENT
    // =========================================================================

    loadCart() {
        const saved = localStorage.getItem('sankofa_cart');
        return saved ? JSON.parse(saved) : [];
    }

    saveCart() {
        localStorage.setItem('sankofa_cart', JSON.stringify(this.items));
        this.updateCartCount();
        this.updateCartUI();
    }

    addItem(product, quantity = 1, variant = null) {
        // Check if item is from Sankofa Store
        if (!product || !product.isSankofaStore) {
            showFlashMessage('Only Sankofa Store items can be added to cart', 'warning');
            return false;
        }

        // Sizes and colours: a listing that offers them needs the buyer's choice, kept on the row.
        var choiceProblem = (typeof variantProblem === 'function') ? variantProblem(product.variants, variant || null) : '';
        var choiceNow = (typeof variantClean === 'function') ? variantClean(product.variants, variant || null) : null;
        if (choiceProblem) {
            showFlashMessage('Please ' + choiceProblem + ' on the product page first', 'warning');
            return false;
        }

        // MOQ-A: pack-size listings never enter the cart below their minimum
        const minQty = Math.max(1, Number(product.minOrderQty) || 1);
        if (quantity < minQty) {
            quantity = minQty;
            showFlashMessage(`"${product.title}" comes in packs of ${minQty} or more — added ${minQty} for you`, 'info');
        }

        // Firestore documents use _docId; some callers pass id. Keep both.
        const productId = product._docId || product.id || null;
        const baseKey = productId || String(product.title || 'item').replace(/\s+/g, '-').toLowerCase();
        // One cart row per product AND choice: a size M and a size L are two rows.
        const rowId = (typeof variantRowId === 'function') ? variantRowId(baseKey, product.variants, choiceNow) : baseKey;
        const existingIndex = this.items.findIndex(item => item.id === rowId);

        if (existingIndex > -1) {
            // Item already in cart - update quantity (still never below the minimum)
            const item = this.items[existingIndex];
            item.quantity += quantity;
            // a flash sale that started since the first add counts
            item.price = (typeof cartUnitPrice === 'function') ? cartUnitPrice(product, Date.now()) : product.price;
            item.minOrderQty = Math.max(item.minOrderQty || 1, minQty);
            showFlashMessage(`Updated ${product.title} quantity`, 'success');
        } else {
            // Add new item
            this.items.push({
                id: productId ? rowId : ('local-' + Date.now()),
                productId: productId,
                variant: choiceNow || null,
                title: product.title,
                price: (typeof cartUnitPrice === 'function') ? cartUnitPrice(product, Date.now()) : product.price,
                image: (typeof productThumb === 'function') ? productThumb(product) : (product.images || product.photos || [])[0],
                quantity: quantity,
                seller: product.sellerName || 'Sankofa Store',
                // keep the seller's id on the row: a cart can hold items from several sellers, and
                // the checkout needs to pay each of them separately (escrow is per seller)
                sellerId: product.sellerId || product._sellerId || null,
                maxQuantity: product.stock || 10,
                minOrderQty: minQty
            });
            showFlashMessage(`Added ${product.title} to cart`, 'success');   // flash escapes internally
        }

        this.saveCart();
        this.animateCartIcon();
        // "Picked for you" learning — a basket add is the strongest interest signal
        try {
            if (typeof window !== 'undefined' && typeof window.smForYouTrackCart === 'function') {
                window.smForYouTrackCart(product);
            }
        } catch (e) {}
        return true;
    }

    removeItem(productId) {
        this.items = this.items.filter(item => item.id !== productId);
        this.saveCart();
        showFlashMessage('Item removed from cart', 'info');
    }

    updateQuantity(productId, quantity) {
        const item = this.items.find(item => item.id === productId);
        if (item) {
            const minQty = Math.max(1, Number(item.minOrderQty) || 1);
            if (quantity <= 0) {
                this.removeItem(productId);
            } else if (quantity < minQty) {
                showFlashMessage(`"${item.title}" comes in packs of ${minQty} or more — ${minQty} is the smallest you can order`, 'warning');
                item.quantity = minQty;   // MOQ-A floor: dipping below bounces back up
            } else if (quantity > item.maxQuantity) {
                showFlashMessage(`Maximum ${item.maxQuantity} items available`, 'warning');
                item.quantity = item.maxQuantity;
            } else {
                item.quantity = quantity;
            }
            this.saveCart();
        }
    }

    clearCart() {
        if (confirm('Are you sure you want to clear your cart?')) {
            this.items = [];
            this.saveCart();
            showFlashMessage('Cart cleared', 'info');
        }
    }

    getSubtotal() {
        return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    getDeliveryFee() {
        // Calculate delivery fee based on items
        const hasFreeDelivery = this.items.some(item => item.deliveryOptions?.includes('free-delivery'));
        if (hasFreeDelivery) return 0;

        const paidDeliveryItems = this.items.filter(item => item.deliveryOptions?.includes('paid-delivery'));
        return paidDeliveryItems.reduce((sum, item) => sum + (item.deliveryFee || 0), 0);
    }

    getTotal() {
        return this.getSubtotal() + this.getDeliveryFee();
    }

    getItemCount() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
    }

    // =========================================================================
    // UI CREATION
    // =========================================================================

    createCartUI() {
        // Create cart icon in header
        this.createCartIcon();
        
        // Create cart sidebar
        this.createCartSidebar();
        
        // Create cart modal for checkout
        this.createCartModal();
    }

    createCartIcon() {
        const header = document.querySelector('.header-actions') || document.querySelector('.header .container');
        if (!header) return;

        const cartIcon = document.createElement('button');
        cartIcon.className = 'cart-icon-btn';
        cartIcon.id = 'cartIconBtn';
        cartIcon.setAttribute('aria-label', 'Open your cart');
        cartIcon.setAttribute('aria-haspopup', 'dialog');
        cartIcon.innerHTML = `
            <i class="fas fa-shopping-cart"></i>
            <span class="cart-count" id="cartCount">0</span>
        `;
        cartIcon.onclick = () => this.toggleCart();

        // Insert before the first button
        const firstButton = header.querySelector('a, button');
        if (firstButton) {
            header.insertBefore(cartIcon, firstButton);
        } else {
            header.appendChild(cartIcon);
        }
    }

    createCartSidebar() {
        const sidebar = document.createElement('div');
        sidebar.className = 'cart-sidebar';
        sidebar.id = 'cartSidebar';
        sidebar.innerHTML = `
            <div class="cart-sidebar-header">
                <h2><i class="fas fa-shopping-cart"></i> Your Cart</h2>
                <button class="cart-close" onclick="cart.toggleCart()" aria-label="Close cart">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </div>
            <div class="cart-sidebar-content" id="cartSidebarContent">
                <div class="cart-empty">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Your cart is empty</p>
                    <a href="search.html" class="btn btn-primary">Start Shopping</a>
                </div>
            </div>
            <div class="cart-sidebar-footer" id="cartSidebarFooter" style="display: none;">
                <div class="cart-summary">
                    <div class="cart-summary-row">
                        <span>Subtotal:</span>
                        <span id="cartSubtotal">GHS 0</span>
                    </div>
                    <div class="cart-summary-row">
                        <span>Delivery:</span>
                        <span id="cartDelivery">GHS 0</span>
                    </div>
                    <div class="cart-summary-row total">
                        <span>Total:</span>
                        <span id="cartTotal">GHS 0</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-full" onclick="cart.proceedToCheckout()">
                    <i class="fas fa-credit-card"></i> Proceed to Checkout
                </button>
                <button class="btn btn-outline btn-full" onclick="cart.clearCart()">
                    <i class="fas fa-trash"></i> Clear Cart
                </button>
            </div>
        `;
        document.body.appendChild(sidebar);

        // Add overlay
        const overlay = document.createElement('div');
        overlay.className = 'cart-overlay';
        overlay.id = 'cartOverlay';
        overlay.onclick = () => this.toggleCart();
        document.body.appendChild(overlay);
    }

    createCartModal() {
        const modal = document.createElement('div');
        modal.className = 'cart-modal';
        modal.id = 'cartModal';
        modal.innerHTML = `
            <div class="cart-modal-content">
                <div class="cart-modal-header">
                    <h2>Checkout</h2>
                    <button class="cart-modal-close" onclick="cart.closeCheckout()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="cart-modal-body" id="cartModalBody">
                    <!-- Checkout form will be inserted here -->
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // =========================================================================
    // UI UPDATES
    // =========================================================================

    updateCartCount() {
        const count = this.getItemCount();
        const countElement = document.getElementById('cartCount');
        if (countElement) {
            countElement.textContent = count;
            countElement.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    updateCartUI() {
        const content = document.getElementById('cartSidebarContent');
        const footer = document.getElementById('cartSidebarFooter');

        if (this.items.length === 0) {
            content.innerHTML = `
                <div class="cart-empty">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Your cart is empty</p>
                    <a href="search.html" class="btn btn-primary">Start Shopping</a>
                </div>
            `;
            footer.style.display = 'none';
        } else {
            content.innerHTML = this.items.map(item => `
                <div class="cart-item">
                    <img src="${escapeCardText(item.image)}" alt="${escapeCardText(item.title)}" class="cart-item-image">
                    <div class="cart-item-details">
                        <h4 class="cart-item-title">${escapeCardText(item.title)}</h4>
                        ${item.variant && typeof variantLabel === 'function' ? `<p class="cart-item-variant" style="font-size:0.78rem;color:#5a6572;margin:0.1rem 0 0;">${escapeCardText(variantLabel(item.variant))}</p>` : ''}
                        <p class="cart-item-price">GHS ${item.price.toLocaleString()}</p>
                        <div class="cart-item-quantity">
                            <button onclick="cart.updateQuantity('${item.id}', ${item.quantity - 1})">
                                <i class="fas fa-minus"></i>
                            </button>
                            <span>${item.quantity}</span>
                            <button onclick="cart.updateQuantity('${item.id}', ${item.quantity + 1})">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                    <button class="cart-item-remove" onclick="cart.removeItem('${item.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');

            footer.style.display = 'block';
            document.getElementById('cartSubtotal').textContent = `GHS ${this.getSubtotal().toLocaleString()}`;
            document.getElementById('cartDelivery').textContent = `GHS ${this.getDeliveryFee().toLocaleString()}`;
            document.getElementById('cartTotal').textContent = `GHS ${this.getTotal().toLocaleString()}`;
        }
    }

    animateCartIcon() {
        const icon = document.getElementById('cartIconBtn');
        if (icon) {
            icon.classList.add('animate');
            setTimeout(() => icon.classList.remove('animate'), 500);
        }
    }

    // =========================================================================
    // CART INTERACTIONS
    // =========================================================================

    toggleCart() {
        const sidebar = document.getElementById('cartSidebar');
        const overlay = document.getElementById('cartOverlay');
        if (!sidebar || !overlay) return;

        // Re-render from storage every time it is opened, so the panel can never
        // show a stale "empty" state (e.g. after adding on another page).
        this.items = this.loadCart();
        this.normaliseItems();
        this.updateCartUI();
        this.updateCartCount();

        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
        
        document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    }

    proceedToCheckout() {
        if (!this.isLoggedIn()) {
            showFlashMessage('Please login to proceed to checkout', 'warning');
            setTimeout(() => {
                window.location.href = 'pages/auth/login.html?redirect=payment.html';
            }, 1500);
            return;
        }

        // Redirect to payment page with comprehensive warnings
        this.toggleCart();
        window.location.href = 'payment.html';
    }

    showCheckoutModal() {
        const modal = document.getElementById('cartModal');
        const body = document.getElementById('cartModalBody');

        body.innerHTML = `
            <form id="checkoutForm" onsubmit="cart.processCheckout(event)">
                <div class="checkout-section">
                    <h3><i class="fas fa-map-marker-alt"></i> Delivery Address</h3>
                    <div class="form-group">
                        <label>Full Name *</label>
                        <input type="text" id="checkoutName" required>
                    </div>
                    <div class="form-group">
                        <label>Phone Number *</label>
                        <input type="tel" id="checkoutPhone" required placeholder="0XX XXX XXXX">
                    </div>
                    <div class="form-group">
                        <label>Address *</label>
                        <textarea id="checkoutAddress" required rows="3"></textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>City *</label>
                            <input type="text" id="checkoutCity" required>
                        </div>
                        <div class="form-group">
                            <label>Region *</label>
                            <select id="checkoutRegion" required>
                                <option value="">Select Region</option>
                                <option value="Greater Accra">Greater Accra</option>
                                <option value="Ashanti">Ashanti</option>
                                <option value="Western">Western</option>
                                <option value="Eastern">Eastern</option>
                                <option value="Central">Central</option>
                                <option value="Northern">Northern</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="checkout-section">
                    <h3><i class="fas fa-credit-card"></i> Payment Method</h3>
                    <div class="payment-options">
                        <label class="payment-option">
                            <input type="radio" name="paymentMethod" value="paystack" required checked>
                            <span>
                                <i class="fas fa-credit-card"></i>
                                Card or Mobile Money <small style="color:#5a6572;font-weight:400;">— you'll pick on Paystack's secure page</small>
                            </span>
                        </label>
                    </div>
                </div>

                <div class="checkout-summary">
                    <h3>Order Summary</h3>
                    <div class="summary-row">
                        <span>Items (${this.getItemCount()}):</span>
                        <span>GHS ${this.getSubtotal().toLocaleString()}</span>
                    </div>
                    <div class="summary-row">
                        <span>Delivery:</span>
                        <span>GHS ${this.getDeliveryFee().toLocaleString()}</span>
                    </div>
                    <div class="summary-row total">
                        <span>Total:</span>
                        <span>GHS ${this.getTotal().toLocaleString()}</span>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary btn-full btn-large">
                    <i class="fas fa-lock"></i> Place Order - GHS ${this.getTotal().toLocaleString()}
                </button>
            </form>
        `;

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeCheckout() {
        const modal = document.getElementById('cartModal');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    async processCheckout(event) {
        event.preventDefault();

        // Today's prices first: the order must carry the prices the server will check it against.
        let fresh;
        try {
            fresh = await cartRefreshRows(this.items);
        } catch (e) {
            showFlashMessage('Could not check today\u2019s prices. Nothing was ordered \u2014 check your connection and try again.', 'error');
            return;
        }
        if (fresh.unavailable.length) {
            showFlashMessage('These cannot be bought as they are now: ' + fresh.unavailable.join('; ') + '. Remove them from your cart and add them again.', 'warning');
            return;
        }
        this.items = fresh.items;
        this.saveCart();
        if (fresh.changed.length) {
            this.closeCheckout();
            showFlashMessage('Prices were updated: ' + fresh.changed.map(function (c) { return c.title + ' is now GHS ' + c.to.toLocaleString(); }).join('; ') + '. Check your order and place it again.', 'warning');
            return;
        }

        const formData = {
            name: document.getElementById('checkoutName').value,
            phone: document.getElementById('checkoutPhone').value,
            address: document.getElementById('checkoutAddress').value,
            city: document.getElementById('checkoutCity').value,
            region: document.getElementById('checkoutRegion').value,
            paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
            items: this.items,
            subtotal: this.getSubtotal(),
            deliveryFee: this.getDeliveryFee(),
            total: this.getTotal()
        };

        try {
            // Show loading
            const submitBtn = event.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

            // Create order in Firebase
            if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
                const orderRef = await firebase.firestore().collection('orders').add({
                    buyerId: firebase.auth().currentUser.uid,   // rules + escrow look for buyerId
                    userId: firebase.auth().currentUser.uid,
                    buyerName: firebase.auth().currentUser.displayName || firebase.auth().currentUser.email || 'Buyer',
                    ...formData,
                    status: 'pending',
                    paymentStatus: 'pending',
                    escrowStatus: 'pending',
                    currency: 'GHS',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Clear cart
                this.items = [];
                this.saveCart();

                // Show success
                this.closeCheckout();
                showFlashMessage('Order placed successfully! 🎉', 'success');
                
                // Redirect to order confirmation
                setTimeout(() => {
                    window.location.href = `order-confirmation.html?orderId=${orderRef.id}`;
                }, 1500);
            } else {
                // Demo mode
                await new Promise(resolve => setTimeout(resolve, 2000));
                this.items = [];
                this.saveCart();
                this.closeCheckout();
                showFlashMessage('Order placed successfully! (Demo mode)', 'success');
            }

        } catch (error) {
            console.error('Checkout error:', error);
            showFlashMessage('Error processing order. Please try again.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fas fa-lock"></i> Place Order - GHS ${this.getTotal().toLocaleString()}`;
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    isLoggedIn() {
        return typeof firebase !== 'undefined' && firebase.auth().currentUser !== null;
    }

    attachEventListeners() {
        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const sidebar = document.getElementById('cartSidebar');
                const modal = document.getElementById('cartModal');
                
                if (sidebar.classList.contains('open')) {
                    this.toggleCart();
                }
                if (modal.style.display === 'flex') {
                    this.closeCheckout();
                }
            }
        });
    }
}

// Initialize cart
const cart = new SankofaCart();

// Make cart globally accessible
window.cart = cart;

/* Escape values that come from users (product titles, names, locations) before
   putting them into innerHTML. Prevents stored XSS from listing text. */
function escapeCardText(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled “classic” <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.escapeCardText = escapeCardText;

