/**
 * Sankofa Store Wishlist/Favorites
 * Allows users to save items for later
 */

class SankofaWishlist {
    constructor() {
        this.items = this.loadWishlist();
        this.init();
    }

    init() {
        this.createWishlistUI();
        this.updateWishlistCount();
    }

    // =========================================================================
    // WISHLIST MANAGEMENT
    // =========================================================================

    loadWishlist() {
        const saved = localStorage.getItem('sankofa_wishlist');
        return saved ? JSON.parse(saved) : [];
    }

    saveWishlist() {
        localStorage.setItem('sankofa_wishlist', JSON.stringify(this.items));
        this.updateWishlistCount();
        this.updateWishlistUI();
    }

    addItem(product) {
        // Check if already in wishlist
        if (this.items.some(item => item.id === product.id)) {
            showFlashMessage('Item already in wishlist', 'info');
            return false;
        }

        this.items.push({
            id: product.id,
            title: product.title,
            price: product.price,
            image: product.images[0],
            seller: product.sellerName || 'Sankofa Store',
            addedAt: new Date().toISOString()
        });

        this.saveWishlist();
        showFlashMessage(`Added ${product.title} to wishlist`, 'success');
        this.animateWishlistIcon();
        return true;
    }

    removeItem(productId) {
        this.items = this.items.filter(item => item.id !== productId);
        this.saveWishlist();
        showFlashMessage('Item removed from wishlist', 'info');
    }

    isInWishlist(productId) {
        return this.items.some(item => item.id === productId);
    }

    clearWishlist() {
        if (confirm('Are you sure you want to clear your wishlist?')) {
            this.items = [];
            this.saveWishlist();
            showFlashMessage('Wishlist cleared', 'info');
        }
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
        wishlistIcon.innerHTML = `
            <i class="fas fa-heart"></i>
            <span class="wishlist-count" id="wishlistCount">0</span>
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
                <button class="wishlist-close" onclick="wishlist.toggleWishlist()">
                    <i class="fas fa-times"></i>
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
        const countElement = document.getElementById('wishlistCount');
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
                            <button class="btn btn-sm btn-primary" onclick="wishlist.addToCart('${item.id}')">
                                <i class="fas fa-cart-plus"></i> Add to Cart
                            </button>
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
        const item = this.items.find(item => item.id === productId);
        if (item && typeof cart !== 'undefined') {
            cart.addItem({
                id: item.id,
                title: item.title,
                price: item.price,
                images: [item.image],
                sellerName: item.seller,
                isSankofaStore: true
            });
        }
    }
}

// Initialize wishlist
const wishlist = new SankofaWishlist();

// Make wishlist globally accessible
window.wishlist = wishlist;
