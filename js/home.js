/**
 * Sankofa Market - Home Page JavaScript
 * Load featured products, recent products, and categories
 */

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Home Page Loaded');
    
    // Load data
    loadCategories();
    loadFeaturedProducts();
    loadRecentProducts();
});

// ============================================================================
// LOAD CATEGORIES
// ============================================================================

async function loadCategories() {
    try {
        const response = await fetch('data/categories.json');
        const data = await response.json();
        
        renderCategories(data.categories);
    } catch (error) {
        console.error('Error loading categories:', error);
        document.getElementById('categoriesGrid').innerHTML = `
            <div class="loading-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading categories</p>
            </div>
        `;
    }
}

function renderCategories(categories) {
    const container = document.getElementById('categoriesGrid');
    
    container.innerHTML = categories.map(category => `
        <a href="search.html?category=${category.id}" class="category-card">
            <div class="category-icon" style="background: ${category.color};">
                <i class="${category.icon}"></i>
            </div>
            <div class="category-name">${category.name}</div>
        </a>
    `).join('');
}

// ============================================================================
// LOAD FEATURED PRODUCTS
// ============================================================================

async function loadFeaturedProducts() {
    try {
        if (typeof firebaseDB === 'undefined') {
            renderDemoProducts('featuredProducts', 'featured');
            return;
        }
        
        const snapshot = await firebaseDB.collection('products')
            .where('isFeatured', '==', true)
            .where('isActive', '==', true)
            .where('isSold', '==', false)
            .limit(8)
            .get();
        
        if (snapshot.empty) {
            renderDemoProducts('featuredProducts', 'featured');
            return;
        }
        
        const products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        
        renderProducts('featuredProducts', products);
    } catch (error) {
        console.error('Error loading featured products:', error);
        renderDemoProducts('featuredProducts', 'featured');
    }
}

// ============================================================================
// LOAD RECENT PRODUCTS
// ============================================================================

async function loadRecentProducts() {
    try {
        if (typeof firebaseDB === 'undefined') {
            renderDemoProducts('recentProducts', 'recent');
            return;
        }
        
        const snapshot = await firebaseDB.collection('products')
            .where('isActive', '==', true)
            .where('isSold', '==', false)
            .orderBy('createdAt', 'desc')
            .limit(8)
            .get();
        
        if (snapshot.empty) {
            renderDemoProducts('recentProducts', 'recent');
            return;
        }
        
        const products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        
        renderProducts('recentProducts', products);
    } catch (error) {
        console.error('Error loading recent products:', error);
        renderDemoProducts('recentProducts', 'recent');
    }
}

// ============================================================================
// RENDER PRODUCTS
// ============================================================================

function renderProducts(containerId, products) {
    const container = document.getElementById(containerId);
    
    if (products.length === 0) {
        container.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-box-open"></i>
                <p>No products available</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = products.map(product => {
        const imageUrl = product.images && product.images.length > 0 
            ? product.images[0] 
            : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop';
        
        const relativeTime = product.createdAt 
            ? formatRelativeTime(product.createdAt.toDate ? product.createdAt.toDate() : new Date(product.createdAt))
            : 'Recently';
        
        const badgeHtml = product.isFeatured 
            ? '<span class="product-badge">Featured</span>' 
            : '';
        
        const sankofaBadge = product.isSankofaStore 
            ? '<span class="sankofa-store-badge"><i class="fas fa-store"></i> Official</span>' 
            : '';
        
        return `
            <a href="product-detail.html?id=${product.id}" class="product-card">
                <div class="product-image-wrapper">
                    <img src="${imageUrl}" alt="${product.title}" class="product-image">
                    ${badgeHtml}
                    ${sankofaBadge}
                </div>
                <div class="product-content">
                    <div class="product-title">${product.title}</div>
                    <div class="product-price">${formatCurrency(product.price)}</div>
                    <div class="product-meta">
                        <span><i class="fas fa-map-marker-alt"></i> ${product.location?.city || 'Ghana'}</span>
                        <span><i class="fas fa-clock"></i> ${relativeTime}</span>
                    </div>
                </div>
            </a>
        `;
    }).join('');
    
    // Re-trigger scroll animations
    if (typeof window.SankofaMarket !== 'undefined') {
        const cards = container.querySelectorAll('.product-card');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        
        cards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(card);
        });
    }
}

// ============================================================================
// RENDER DEMO PRODUCTS (When Firebase is not configured)
// ============================================================================

function renderDemoProducts(containerId, type) {
    const demoProducts = [
        {
            id: 'demo1',
            title: 'iPhone 14 Pro Max - 256GB - Deep Purple',
            price: 8500,
            images: ['https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=400&h=300&fit=crop'],
            location: { city: 'Accra' },
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            isFeatured: true,
            isSankofaStore: true
        },
        {
            id: 'demo2',
            title: 'Samsung 55" 4K Smart TV - Crystal UHD',
            price: 3200,
            images: ['https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&h=300&fit=crop'],
            location: { city: 'Kumasi' },
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
            isFeatured: true,
            isSankofaStore: false
        },
        {
            id: 'demo3',
            title: 'Leather Sofa Set - 3 Pieces - Premium',
            price: 2800,
            images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop'],
            location: { city: 'Tema' },
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            isFeatured: true,
            isSankofaStore: false
        },
        {
            id: 'demo4',
            title: 'MacBook Pro 2023 - M2 Chip - 16GB',
            price: 12500,
            images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop'],
            location: { city: 'Accra' },
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
            isFeatured: true,
            isSankofaStore: true
        },
        {
            id: 'demo5',
            title: 'Nike Air Jordan Retro - Size 42',
            price: 800,
            images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop'],
            location: { city: 'Accra' },
            createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: false
        },
        {
            id: 'demo6',
            title: 'Canon EOS R6 - Full Frame + Lens Kit',
            price: 14500,
            images: ['https://images.unsplash.com/photo-1606986628253-49e940572d03?w=400&h=300&fit=crop'],
            location: { city: 'Kumasi' },
            createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: true
        },
        {
            id: 'demo7',
            title: 'Solid Wood Dining Table - 6 Chairs',
            price: 1800,
            images: ['https://images.unsplash.com/photo-1617806118233-18e1de247200?w=400&h=300&fit=crop'],
            location: { city: 'Takoradi' },
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: false
        },
        {
            id: 'demo8',
            title: 'PlayStation 5 - 2 Controllers + 5 Games',
            price: 6500,
            images: ['https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=400&h=300&fit=crop'],
            location: { city: 'Accra' },
            createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: true
        },
        {
            id: 'demo9',
            title: 'Apple Watch Series 8 - GPS + Cellular',
            price: 2200,
            images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop'],
            location: { city: 'Accra' },
            createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: false
        },
        {
            id: 'demo10',
            title: 'Premium Designer Jacket - Unisex',
            price: 350,
            images: ['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=300&fit=crop'],
            location: { city: 'Cape Coast' },
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: false
        },
        {
            id: 'demo11',
            title: 'African Print Ankara Dress - Handmade',
            price: 250,
            images: ['https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop'],
            location: { city: 'Kumasi' },
            createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: false
        },
        {
            id: 'demo12',
            title: 'Mountain Bike - 21 Speed - Barely Used',
            price: 1500,
            images: ['https://images.unsplash.com/photo-1592840496694-26d035b52b48?w=400&h=300&fit=crop'],
            location: { city: 'Tamale' },
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: false
        }
    ];
    
    const products = type === 'featured' 
        ? demoProducts.filter(p => p.isFeatured).slice(0, 8)
        : demoProducts.filter(p => !p.isFeatured).slice(0, 8);
    
    renderProducts(containerId, products);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatCurrency(amount) {
    if (typeof window.SankofaMarket !== 'undefined' && window.SankofaMarket.formatCurrency) {
        return window.SankofaMarket.formatCurrency(amount);
    }
    return `GHS ${amount.toLocaleString()}`;
}

function formatRelativeTime(date) {
    if (typeof window.SankofaMarket !== 'undefined' && window.SankofaMarket.formatRelativeTime) {
        return window.SankofaMarket.formatRelativeTime(date);
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
}

// ============================================================================
// EXPORT
// ============================================================================

window.Home = {
    loadCategories,
    loadFeaturedProducts,
    loadRecentProducts,
    renderProducts,
    renderDemoProducts
};
