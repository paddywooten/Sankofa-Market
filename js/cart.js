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
        this.updateCartCount();
        this.attachEventListeners();
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

    addItem(product, quantity = 1) {
        // Check if item is from Sankofa Store
        if (!product.isSankofaStore) {
            showFlashMessage('Only Sankofa Store items can be added to cart', 'warning');
            return false;
        }

        const existingIndex = this.items.findIndex(item => item.id === product.id);

        if (existingIndex > -1) {
            // Item already in cart - update quantity
            this.items[existingIndex].quantity += quantity;
            showFlashMessage(`Updated ${product.title} quantity`, 'success');
        } else {
            // Add new item
            this.items.push({
                id: product.id,
                title: product.title,
                price: product.price,
                image: product.images[0],
                quantity: quantity,
                seller: product.sellerName || 'Sankofa Store',
                maxQuantity: product.stock || 10
            });
            showFlashMessage(`Added ${product.title} to cart`, 'success');
        }

        this.saveCart();
        this.animateCartIcon();
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
            if (quantity <= 0) {
                this.removeItem(productId);
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
                <button class="cart-close" onclick="cart.toggleCart()">
                    <i class="fas fa-times"></i>
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
                    <img src="${item.image}" alt="${item.title}" class="cart-item-image">
                    <div class="cart-item-details">
                        <h4 class="cart-item-title">${item.title}</h4>
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
                            <input type="radio" name="paymentMethod" value="momo" required>
                            <span>
                                <i class="fas fa-mobile-alt"></i>
                                Mobile Money
                            </span>
                        </label>
                        <label class="payment-option">
                            <input type="radio" name="paymentMethod" value="card">
                            <span>
                                <i class="fas fa-credit-card"></i>
                                Card Payment
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
                    userId: firebase.auth().currentUser.uid,
                    ...formData,
                    status: 'pending',
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
