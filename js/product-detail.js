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
    const prevBtn = document.getElementById('prevImage');
    const nextBtn = document.getElementById('nextImage');
    
    // Dynamic: always read current thumbs from DOM (not captured at init)
    function getCurrentImages() {
        var thumbs = document.querySelectorAll('#galleryThumbs .thumb');
        return Array.from(thumbs).map(function(t) { return t.src; });
    }
    
    function getCurrentIndex() {
        var thumbs = document.querySelectorAll('#galleryThumbs .thumb');
        for (var i = 0; i < thumbs.length; i++) {
            if (thumbs[i].classList.contains('active')) return i;
        }
        return 0;
    }
    
    function setActiveThumb(index) {
        var images = getCurrentImages();
        var thumbs = document.querySelectorAll('#galleryThumbs .thumb');
        if (index < 0 || index >= images.length) return;
        
        mainImage.style.opacity = '0';
        setTimeout(function() {
            mainImage.src = images[index];
            mainImage.style.opacity = '1';
        }, 150);
        
        thumbs.forEach(function(t) { t.classList.remove('active'); });
        if (thumbs[index]) thumbs[index].classList.add('active');
    }
    
    // Attach thumb click handlers (for initial demo thumbs)
    document.querySelectorAll('#galleryThumbs .thumb').forEach(function(thumb, index) {
        thumb.addEventListener('click', function() { setActiveThumb(index); });
    });
    
    // Prev/Next buttons - dynamically read current state
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            var images = getCurrentImages();
            var idx = getCurrentIndex();
            var newIndex = (idx - 1 + images.length) % images.length;
            setActiveThumb(newIndex);
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            var images = getCurrentImages();
            var idx = getCurrentIndex();
            var newIndex = (idx + 1) % images.length;
            setActiveThumb(newIndex);
        });
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
    var params = new URLSearchParams(window.location.search);
    var productId = params.get('id');
    
    if (productId && typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        console.log('Loading product:', productId);
        firebaseDB.collection('products').doc(productId).get().then(function(doc) {
            if (doc.exists) {
                var data = doc.data();
                data._docId = doc.id;
                renderProduct(data);
                console.log('Product loaded:', data.title);
            } else {
                console.warn('Product not found:', productId);
            }
        }).catch(function(err) {
            console.error('Error loading product:', err);
        });
    }
}

function renderProduct(product) {
    // Title & breadcrumbs
    var titleEl = document.getElementById('productTitle');
    if (titleEl) titleEl.textContent = product.title || 'Untitled Product';
    
    var breadcrumbTitle = document.getElementById('breadcrumbTitle');
    if (breadcrumbTitle) breadcrumbTitle.textContent = product.title || '';
    
    var breadcrumbCat = document.getElementById('breadcrumbCategory');
    if (breadcrumbCat) breadcrumbCat.textContent = (product.category || '').replace(/-/g, ' ');
    
    document.title = (product.title || 'Product') + ' - Sankofa Market';
    
    // Price
    var priceEl = document.getElementById('productPrice');
    if (priceEl) priceEl.textContent = typeof formatCurrency === 'function' ? formatCurrency(product.price) : 'GHS ' + (product.price || 0).toLocaleString();
    
    // Location
    var locEl = document.getElementById('productLocation');
    if (locEl) locEl.textContent = (product.location && product.location.city) || product.location || 'Ghana';
    
    // Description
    var descEl = document.getElementById('productDescription');
    if (descEl && product.description) descEl.innerHTML = product.description;
    
    // Condition
    var condEl = document.getElementById('productCondition');
    if (condEl && product.condition) condEl.textContent = product.condition.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    
    // Seller info
    var sellerEl = document.getElementById('sellerName');
    if (sellerEl) sellerEl.textContent = product.sellerName || (product.isSankofaStore ? 'Sankofa Store' : 'Seller');
    
    var verifiedEl = document.getElementById('sellerVerified');
    if (verifiedEl) {
        if (product.isVerifiedSeller || product.isSankofaStore) {
            verifiedEl.innerHTML = '<i class="fas fa-check-circle" style="color:#0064d2;"></i> Verified';
            verifiedEl.style.display = '';
        } else {
            verifiedEl.style.display = 'none';
        }
    }
    
    var officialBadge = document.getElementById('officialBadge');
    if (officialBadge) {
        officialBadge.style.display = product.isSankofaStore ? '' : 'none';
    }
    
    // Time
    var timeEl = document.getElementById('productTime');
    if (timeEl) {
        var created = product.createdAt;
        if (created) {
            var date = created.toDate ? created.toDate() : new Date(created);
            timeEl.textContent = typeof formatRelativeTime === 'function' ? formatRelativeTime(date) : date.toLocaleDateString();
        }
    }
    
    // Views
    var viewsEl = document.getElementById('productViews');
    if (viewsEl) viewsEl.textContent = (product.views || 0) + ' views';
    
    // Images - update main image and thumbnails
    var images = product.images || product.photos || [];
    var mainImage = document.getElementById('mainImage');
    var thumbsContainer = document.getElementById('galleryThumbs');
    
    if (images.length > 0) {
        // Update main image
        if (mainImage) mainImage.src = images[0];
        
        // Rebuild thumbnails
        if (thumbsContainer) {
            thumbsContainer.innerHTML = '';
            images.forEach(function(imgUrl, i) {
                var thumb = document.createElement('img');
                thumb.src = imgUrl;
                thumb.alt = 'Thumbnail ' + (i + 1);
                thumb.className = 'thumb' + (i === 0 ? ' active' : '');
                thumb.loading = 'lazy';
                thumb.decoding = 'async';
                thumb.addEventListener('click', function() {
                    if (mainImage) mainImage.src = imgUrl;
                    thumbsContainer.querySelectorAll('.thumb').forEach(function(t) { t.classList.remove('active'); });
                    thumb.classList.add('active');
                });
                thumbsContainer.appendChild(thumb);
            });
        }
    } else {
        // No images - show placeholder
        if (mainImage) mainImage.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&h=600&fit=crop&q=75';
        if (thumbsContainer) thumbsContainer.innerHTML = '';
    }
    
    // Increment view count
    if (typeof firebaseDB !== 'undefined' && product._docId) {
        firebaseDB.collection('products').doc(product._docId).update({
            views: (product.views || 0) + 1
        }).catch(function() {});
    }
}

// ============================================================================
// SIMILAR PRODUCTS
// ============================================================================

function loadSimilarProducts() {
    var container = document.getElementById('similarProducts');
    if (!container) return;
    
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) return;
    
    // Load recent products as "similar"
    firebaseDB.collection('products')
        .where('isActive', '==', true)
        .limit(8)
        .get()
        .then(function(snapshot) {
            if (snapshot.empty) {
                // Fallback: load without where clause
                return firebaseDB.collection('products').limit(8).get();
            }
            return snapshot;
        })
        .then(function(snapshot) {
            if (!snapshot || snapshot.empty) return;
            
            var html = '';
            var count = 0;
            snapshot.forEach(function(doc) {
                if (count >= 4) return;
                var p = doc.data();
                if (p.isSold) return;
                
                var images = p.images || p.photos || [];
                var imgSrc = images.length > 0 ? images[0] : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=350&h=260&fit=crop&q=75';
                var price = typeof formatCurrency === 'function' ? formatCurrency(p.price) : 'GHS ' + (p.price || 0).toLocaleString();
                var location = (p.location && p.location.city) || p.location || 'Ghana';
                var isSS = p.isSankofaStore === true;
                
                html += '<a href="product-detail.html?id=' + doc.id + '" class="product-card">' +
                    '<div class="product-image-wrapper">' +
                        '<img src="' + imgSrc + '" alt="' + (p.title || '') + '" class="product-image" loading="lazy">' +
                        (isSS ? '<span class="sankofa-store-badge"><i class="fas fa-store"></i> Official</span>' : '') +
                    '</div>' +
                    '<div class="product-content">' +
                        '<div class="product-title">' + (p.title || 'Untitled') + '</div>' +
                        '<div class="product-price">' + price + '</div>' +
                        '<div class="product-meta"><span><i class="fas fa-map-marker-alt"></i> ' + location + '</span></div>' +
                    '</div>' +
                '</a>';
                count++;
            });
            
            if (html) container.innerHTML = html;
        })
        .catch(function(err) {
            console.warn('Could not load similar products:', err);
        });
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
