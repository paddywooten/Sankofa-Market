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
    // Built-in categories (defaults)
    var builtIn = [
        { id: 'electronics', name: 'Electronics', icon: 'fas fa-mobile-alt', color: '#0064d2' },
        { id: 'fashion', name: 'Fashion', icon: 'fas fa-tshirt', color: '#e74c3c' },
        { id: 'home-garden', name: 'Home & Garden', icon: 'fas fa-home', color: '#86b817' },
        { id: 'vehicles', name: 'Vehicles', icon: 'fas fa-car', color: '#f5af02' },
        { id: 'services', name: 'Services', icon: 'fas fa-concierge-bell', color: '#9b59b6' },
        { id: 'sports', name: 'Sports', icon: 'fas fa-futbol', color: '#3498db' },
        { id: 'books-media', name: 'Books & Media', icon: 'fas fa-book', color: '#795548' },
        { id: 'baby-kids', name: 'Baby & Kids', icon: 'fas fa-baby', color: '#e91e63' },
        { id: 'beauty-health', name: 'Beauty & Health', icon: 'fas fa-spa', color: '#ff69b4' },
        { id: 'food-groceries', name: 'Food & Groceries', icon: 'fas fa-utensils', color: '#ff5722' },
        { id: 'pets', name: 'Pets', icon: 'fas fa-paw', color: '#8bc34a' },
        { id: 'jobs-skills', name: 'Jobs & Skills', icon: 'fas fa-briefcase', color: '#3f51b5' },
        { id: 'real-estate', name: 'Real Estate', icon: 'fas fa-building', color: '#607d8b' }
    ];

    var categories = builtIn.slice(); // start with built-in

    // Load custom/edited categories from Firestore
    if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        try {
            var snapshot = await firebaseDB.collection('categories').get();
            var disabledIds = {};

            snapshot.forEach(function(doc) {
                var data = doc.data();
                if (data.isActive === false) {
                    disabledIds[doc.id] = true;
                    return;
                }
                // Check if it overrides a built-in
                var existingIdx = categories.findIndex(function(c) { return c.id === doc.id; });
                if (existingIdx >= 0) {
                    // Override built-in with saved edits
                    if (data.name) categories[existingIdx].name = data.name;
                    if (data.icon) categories[existingIdx].icon = 'fas ' + data.icon;
                    if (data.color) categories[existingIdx].color = data.color;
                } else {
                    // Add new custom category
                    categories.push({
                        id: doc.id,
                        name: data.name || doc.id,
                        icon: 'fas ' + (data.icon || 'fa-tag'),
                        color: data.color || '#0064d2'
                    });
                }
            });

            // Remove disabled categories
            categories = categories.filter(function(c) { return !disabledIds[c.id]; });
        } catch (err) {
            console.warn('Could not load categories from Firestore:', err);
        }
    }

    renderCategories(categories);
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
        if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
            console.warn('⚠️ firebaseDB not available for featured products');
            renderDemoProducts('featuredProducts', 'featured');
            return;
        }
        console.log('⭐ Loading featured products from Firestore...');
        
        // Simple query - single where clause, no composite index needed
        const snapshot = await firebaseDB.collection('products')
            .where('isFeatured', '==', true)
            .limit(12)
            .get();
        
        if (snapshot.empty) {
            renderDemoProducts('featuredProducts', 'featured');
            return;
        }
        
        // Filter client-side for active and not sold
        const products = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.isActive !== false && data.isSold !== true) {
                products.push({ id: doc.id, ...data });
            }
        });
        
        if (products.length === 0) {
            renderDemoProducts('featuredProducts', 'featured');
            return;
        }
        
        renderProducts('featuredProducts', products.slice(0, 8));
    } catch (error) {
        console.error('Error loading featured products:', error);
        // Try loading ALL products as fallback
        try {
            const allSnapshot = await firebaseDB.collection('products').limit(8).get();
            if (!allSnapshot.empty) {
                const products = [];
                allSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.isActive !== false && data.isSold !== true) {
                        products.push({ id: doc.id, ...data });
                    }
                });
                if (products.length > 0) {
                    renderProducts('featuredProducts', products);
                    return;
                }
            }
        } catch(e) {}
        renderDemoProducts('featuredProducts', 'featured');
    }
}

// ============================================================================
// LOAD RECENT PRODUCTS
// ============================================================================

async function loadRecentProducts() {
    try {
        if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
            console.warn('⚠️ firebaseDB not available, showing empty state');
            renderDemoProducts('recentProducts', 'recent');
            return;
        }
        console.log('📦 Loading recent products from Firestore...');
        
        // Simple query - orderBy only, no composite index needed
        const snapshot = await firebaseDB.collection('products')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        
        if (snapshot.empty) {
            renderDemoProducts('recentProducts', 'recent');
            return;
        }
        
        // Filter client-side for active and not sold
        const products = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.isActive !== false && data.isSold !== true) {
                products.push({ id: doc.id, ...data });
            }
        });
        
        if (products.length === 0) {
            renderDemoProducts('recentProducts', 'recent');
            return;
        }
        
        console.log('✅ Loaded ' + products.length + ' products');
        renderProducts('recentProducts', products.slice(0, 8));
    } catch (error) {
        console.error('Error loading recent products:', error);
        // Fallback: load without orderBy
        try {
            const fallback = await firebaseDB.collection('products').limit(20).get();
            if (!fallback.empty) {
                const products = [];
                fallback.forEach(doc => {
                    const data = doc.data();
                    if (data.isActive !== false && data.isSold !== true) {
                        products.push({ id: doc.id, ...data });
                    }
                });
                if (products.length > 0) {
                    console.log('✅ Loaded ' + products.length + ' products');
        renderProducts('recentProducts', products.slice(0, 8));
                    return;
                }
            }
        } catch(e) {}
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
        const productImages = product.images || product.photos || [];
        const imageUrl = productImages.length > 0 
            ? productImages[0] 
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
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (type === 'featured') {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem;">
                <i class="fas fa-fire" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <h3>No featured deals yet</h3>
                <p style="color: #767676; max-width: 400px; margin: 0.5rem auto;">Featured products will appear here once sellers start listing. Be the first to <a href="publish.html" style="color: var(--primary-color);">list a product!</a></p>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem;">
                <i class="fas fa-clock" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <h3>No listings yet</h3>
                <p style="color: #767676; max-width: 400px; margin: 0.5rem auto;">Recently listed products will appear here. <a href="publish.html" style="color: var(--primary-color);">Start selling</a> and your items will show up!</p>
            </div>
        `;
    }
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
