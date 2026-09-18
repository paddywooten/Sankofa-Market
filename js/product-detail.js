/**
 * Sankofa Market - Product Detail Page JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    initGallery();
    initProductActions();
    loadSimilarProducts();
    loadProductFromURL();
    injectPaymentSafetyWarnings();
});

/**
 * Inject payment safety warnings
 */
function injectPaymentSafetyWarnings() {
    const container = document.getElementById('paymentSafetyWarnings');
    if (container && typeof PaymentWarnings !== 'undefined') {
        container.innerHTML = PaymentWarnings.getPaymentPageWarning() + PaymentWarnings.getContactSellerWarning();
    }
}

// ============================================================================
// GALLERY FUNCTIONALITY
// ============================================================================

function initGallery() {
    const mainImage = document.getElementById('mainImage');
    const thumbs = document.querySelectorAll('.thumb');
    const prevBtn = document.getElementById('prevImage');
    const nextBtn = document.getElementById('nextImage');
    
    let currentIndex = 0;
    const images = Array.from(thumbs).map(t => t.src.replace('w=150&h=150', 'w=800&h=600'));
    
    thumbs.forEach((thumb, index) => {
        thumb.addEventListener('click', () => {
            setActiveThumb(index);
        });
    });
    
    prevBtn.addEventListener('click', () => {
        const newIndex = (currentIndex - 1 + images.length) % images.length;
        setActiveThumb(newIndex);
    });
    
    nextBtn.addEventListener('click', () => {
        const newIndex = (currentIndex + 1) % images.length;
        setActiveThumb(newIndex);
    });
    
    function setActiveThumb(index) {
        currentIndex = index;
        mainImage.style.opacity = '0';
        setTimeout(() => {
            mainImage.src = images[index];
            mainImage.style.opacity = '1';
        }, 150);
        
        thumbs.forEach(t => t.classList.remove('active'));
        thumbs[index].classList.add('active');
    }
}

// ============================================================================
// PRODUCT ACTIONS
// ============================================================================

function initProductActions() {
    const favoriteBtn = document.getElementById('favoriteBtn');
    const shareBtn = document.getElementById('shareBtn');
    const contactBtn = document.getElementById('contactSellerBtn');
    const callBtn = document.getElementById('callSellerBtn');
    
    favoriteBtn.addEventListener('click', function() {
        this.classList.toggle('active');
        const icon = this.querySelector('i');
        if (this.classList.contains('active')) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            showFlashMessage('Added to favorites!', 'success');
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
            showFlashMessage('Removed from favorites', 'info');
        }
    });
    
    shareBtn.addEventListener('click', async function() {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: document.getElementById('productTitle').textContent,
                    text: 'Check out this deal on Sankofa Market!',
                    url: window.location.href
                });
            } catch (err) {
                copyToClipboard();
            }
        } else {
            copyToClipboard();
        }
    });
    
    contactBtn.addEventListener('click', function() {
        if (!isLoggedIn()) {
            showFlashMessage('Please sign in to contact the seller', 'warning');
            setTimeout(() => {
                window.location.href = 'pages/auth/login.html';
            }, 1500);
            return;
        }
        
        // Show safety warning
        showFlashMessage('💡 Remember: Only communicate through Sankofa Market. Never share personal contact details or make payments outside the platform.', 'info');
        
        // In a real app, this would open the chat interface
        setTimeout(() => {
            showFlashMessage('Opening secure chat with seller...', 'success');
        }, 2000);
    });
    
    callBtn.addEventListener('click', function() {
        if (!isLoggedIn()) {
            showFlashMessage('Please sign in to view phone number', 'warning');
            setTimeout(() => {
                window.location.href = 'pages/auth/login.html';
            }, 1500);
            return;
        }
        
        // Show warning about platform communication
        showFlashMessage('⚠️ For your safety, we recommend using our secure messaging system instead of phone calls. All platform communications are recorded for dispute resolution.', 'warning');
    });
}

function copyToClipboard() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        showFlashMessage('Link copied to clipboard!', 'success');
    }).catch(() => {
        showFlashMessage('Could not copy link', 'error');
    });
}

// ============================================================================
// LOAD PRODUCT FROM URL
// ============================================================================

function loadProductFromURL() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    
    if (productId && typeof firebaseDB !== 'undefined') {
        // Load from Firebase
        firebaseDB.collection('products').doc(productId).get().then(doc => {
            if (doc.exists) {
                renderProduct(doc.data());
            }
        }).catch(err => {
            console.error('Error loading product:', err);
        });
    }
    // Otherwise use demo data already in HTML
}

function renderProduct(product) {
    document.getElementById('productTitle').textContent = product.title;
    document.getElementById('productPrice').textContent = formatCurrency(product.price);
    document.getElementById('productLocation').textContent = product.location?.city || 'Ghana';
    document.getElementById('breadcrumbTitle').textContent = product.title;
    document.getElementById('breadcrumbCategory').textContent = product.category;
    document.title = `${product.title} - Sankofa Market`;
    
    if (product.description) {
        document.getElementById('productDescription').innerHTML = product.description;
    }
}

// ============================================================================
// SIMILAR PRODUCTS
// ============================================================================

function loadSimilarProducts() {
    const similarProducts = [
        {
            title: 'Samsung Galaxy S23 Ultra - 256GB',
            price: 7800,
            image: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=350&h=260&fit=crop&q=75&auto=format',
            location: 'Accra',
            id: 'similar1'
        },
        {
            title: 'iPhone 13 Pro - 128GB - Graphite',
            price: 6200,
            image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=350&h=260&fit=crop&q=75&auto=format',
            location: 'Kumasi',
            id: 'similar2'
        },
        {
            title: 'Google Pixel 7 Pro - 128GB',
            price: 5500,
            image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=350&h=260&fit=crop&q=75&auto=format',
            location: 'Tema',
            id: 'similar3'
        },
        {
            title: 'OnePlus 11 - 256GB - Titan Black',
            price: 4800,
            image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=350&h=260&fit=crop&q=75&auto=format',
            location: 'Accra',
            id: 'similar4'
        }
    ];
    
    const container = document.getElementById('similarProducts');
    container.innerHTML = similarProducts.map(product => `
        <a href="product-detail.html?id=${product.id}" class="product-card">
            <div class="product-image-wrapper">
                <img src="${product.image}" alt="${product.title}" class="product-image" loading="lazy" decoding="async">
            </div>
            <div class="product-content">
                <div class="product-title">${product.title}</div>
                <div class="product-price">${formatCurrency(product.price)}</div>
                <div class="product-meta">
                    <span><i class="fas fa-map-marker-alt"></i> ${product.location}</span>
                </div>
            </div>
        </a>
    `).join('');
}

// =========================================================================
// E-COMMERCE BUTTONS FOR SANKOFA STORE
// =========================================================================

function updateProductActions(product) {
    const actionsContainer = document.getElementById('productActions');
    if (!actionsContainer) return;

    const isSankofaStore = product.isSankofaStore === true;

    if (isSankofaStore && typeof cart !== 'undefined' && typeof wishlist !== 'undefined') {
        // Sankofa Store - Show e-commerce buttons
        const isInWishlist = wishlist.isInWishlist(product.id);
        
        actionsContainer.innerHTML = `
            <button class="add-to-cart-btn" onclick="addToCartFromDetail()">
                <i class="fas fa-cart-plus"></i> Add to Cart
            </button>
            <button class="wishlist-btn ${isInWishlist ? 'active' : ''}" onclick="toggleWishlistFromDetail()" id="wishlistBtn">
                <i class="${isInWishlist ? 'fas' : 'far'} fa-heart"></i>
                ${isInWishlist ? 'In Wishlist' : 'Add to Wishlist'}
            </button>
            <button class="btn btn-icon" id="shareBtn" title="Share" onclick="shareProduct()">
                <i class="fas fa-share-alt"></i>
            </button>
        `;
    } else {
        // Regular seller - Show contact buttons
        actionsContainer.innerHTML = `
            <button class="btn btn-primary btn-large" id="contactSellerBtn" onclick="contactSeller()">
                <i class="fas fa-comment"></i> Contact Seller
            </button>
            <button class="btn btn-outline btn-large" id="callSellerBtn" onclick="callSeller()">
                <i class="fas fa-phone"></i> Call
            </button>
            <button class="btn btn-icon" id="favoriteBtn" title="Add to Favorites" onclick="toggleFavorite()">
                <i class="far fa-heart"></i>
            </button>
            <button class="btn btn-icon" id="shareBtn" title="Share" onclick="shareProduct()">
                <i class="fas fa-share-alt"></i>
            </button>
        `;
    }
}

function addToCartFromDetail() {
    if (typeof currentProduct === 'undefined' || !currentProduct) {
        showFlashMessage('Product not loaded', 'error');
        return;
    }

    if (typeof cart !== 'undefined') {
        cart.addItem(currentProduct, 1);
    }
}

function toggleWishlistFromDetail() {
    if (typeof currentProduct === 'undefined' || !currentProduct) {
        showFlashMessage('Product not loaded', 'error');
        return;
    }

    if (typeof wishlist !== 'undefined') {
        const isInWishlist = wishlist.isInWishlist(currentProduct.id);
        
        if (isInWishlist) {
            wishlist.removeItem(currentProduct.id);
        } else {
            wishlist.addItem(currentProduct);
        }

        // Update button state
        const btn = document.getElementById('wishlistBtn');
        if (btn) {
            const nowInWishlist = !isInWishlist;
            btn.classList.toggle('active', nowInWishlist);
            btn.innerHTML = `
                <i class="${nowInWishlist ? 'fas' : 'far'} fa-heart"></i>
                ${nowInWishlist ? 'In Wishlist' : 'Add to Wishlist'}
            `;
        }
    }
}

function contactSeller() {
    showFlashMessage('Opening chat with seller...', 'info');
    // Implement chat functionality
}

function callSeller() {
    showFlashMessage('Phone: +233 XX XXX XXXX', 'info');
    // Implement call functionality
}

function toggleFavorite() {
    const btn = document.getElementById('favoriteBtn');
    if (btn) {
        const icon = btn.querySelector('i');
        icon.classList.toggle('far');
        icon.classList.toggle('fas');
        icon.classList.toggle('text-danger');
        
        if (icon.classList.contains('fas')) {
            showFlashMessage('Added to favorites', 'success');
        } else {
            showFlashMessage('Removed from favorites', 'info');
        }
    }
}

function shareProduct() {
    if (navigator.share) {
        navigator.share({
            title: currentProduct.title,
            text: `Check out ${currentProduct.title} on Sankofa Market!`,
            url: window.location.href
        });
    } else {
        // Fallback - copy to clipboard
        const dummy = document.createElement('input');
        document.body.appendChild(dummy);
        dummy.value = window.location.href;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        showFlashMessage('Link copied to clipboard!', 'success');
    }
}

// Update actions when product is loaded
const originalRenderProduct = typeof renderProduct !== 'undefined' ? renderProduct : null;
if (originalRenderProduct) {
    renderProduct = function(product) {
        originalRenderProduct(product);
        window.currentProduct = product;
        updateProductActions(product);
    };
}
