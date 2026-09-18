/**
 * Sankofa Market - Product Detail Page JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    initGallery();
    initProductActions();
    loadSimilarProducts();
    loadProductFromURL();
});

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
        showFlashMessage('Opening chat with seller...', 'info');
    });
    
    callBtn.addEventListener('click', function() {
        if (!isLoggedIn()) {
            showFlashMessage('Please sign in to view phone number', 'warning');
            setTimeout(() => {
                window.location.href = 'pages/auth/login.html';
            }, 1500);
            return;
        }
        showFlashMessage('Phone: +233 XX XXX XXXX', 'info');
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
