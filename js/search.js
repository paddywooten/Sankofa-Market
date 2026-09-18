/**
 * Sankofa Market - Search Page JavaScript
 * Search, filtering, and sorting functionality
 */

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Search Page Loaded');
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q') || '';
    const categoryParam = urlParams.get('category') || '';
    
    // Set search input value
    document.getElementById('searchInput').value = searchQuery;
    
    // Set category filter if provided
    if (categoryParam) {
        document.getElementById('filterCategory').value = categoryParam;
    }
    
    // Update search title
    updateSearchTitle(searchQuery, categoryParam);
    
    // Load products
    loadProducts(searchQuery, categoryParam);
});

// ============================================================================
// UPDATE SEARCH TITLE
// ============================================================================

function updateSearchTitle(query, category) {
    const titleEl = document.getElementById('searchTitle');
    const subtitleEl = document.getElementById('searchSubtitle');
    
    if (query) {
        titleEl.textContent = `Search Results for "${query}"`;
        subtitleEl.textContent = 'Loading...';
    } else if (category) {
        const categoryNames = {
            'electronics': 'Electronics',
            'fashion': 'Fashion',
            'home-garden': 'Home & Garden',
            'vehicles': 'Vehicles',
            'services': 'Services',
            'sports': 'Sports & Outdoors',
            'books-media': 'Books & Media',
            'baby-kids': 'Baby & Kids',
            'beauty-health': 'Beauty & Health',
            'food-groceries': 'Food & Groceries',
            'pets': 'Pets',
            'jobs-skills': 'Jobs & Skills',
            'real-estate': 'Real Estate',
            'sankofa-store': 'Sankofa Store'
        };
        
        titleEl.textContent = categoryNames[category] || 'Browse Products';
        subtitleEl.textContent = 'Loading...';
    } else {
        titleEl.textContent = 'All Products';
        subtitleEl.textContent = 'Loading...';
    }
}

// ============================================================================
// LOAD PRODUCTS
// ============================================================================

async function loadProducts(query = '', category = '') {
    try {
        if (typeof firebaseDB === 'undefined') {
            renderDemoProducts();
            return;
        }
        
        let queryRef = firebaseDB.collection('products')
            .where('isActive', '==', true)
            .where('isSold', '==', false);
        
        // Apply category filter
        if (category) {
            queryRef = queryRef.where('category', '==', category);
        }
        
        const snapshot = await queryRef.limit(50).get();
        
        if (snapshot.empty) {
            renderDemoProducts();
            return;
        }
        
        let products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        
        // Client-side search filter
        if (query) {
            const queryLower = query.toLowerCase();
            products = products.filter(p => 
                p.title.toLowerCase().includes(queryLower) ||
                p.description.toLowerCase().includes(queryLower)
            );
        }
        
        renderProducts(products);
        updateSubtitle(products.length, query, category);
    } catch (error) {
        console.error('Error loading products:', error);
        renderDemoProducts();
    }
}

// ============================================================================
// APPLY FILTERS
// ============================================================================

async function applyFilters() {
    const category = document.getElementById('filterCategory').value;
    const priceMin = document.getElementById('priceMin').value;
    const priceMax = document.getElementById('priceMax').value;
    const condition = document.getElementById('filterCondition').value;
    const location = document.getElementById('filterLocation').value;
    const sellerType = document.getElementById('filterSellerType').value;
    const sortBy = document.getElementById('sortBy').value;
    const searchQuery = document.getElementById('searchInput').value;
    
    try {
        if (typeof firebaseDB === 'undefined') {
            applyDemoFilters(category, priceMin, priceMax, condition, location, sellerType, sortBy);
            return;
        }
        
        let queryRef = firebaseDB.collection('products')
            .where('isActive', '==', true)
            .where('isSold', '==', false);
        
        // Apply category filter
        if (category) {
            queryRef = queryRef.where('category', '==', category);
        }
        
        // Apply condition filter
        if (condition) {
            queryRef = queryRef.where('condition', '==', condition);
        }
        
        // Apply location filter
        if (location) {
            queryRef = queryRef.where('location.city', '==', location);
        }
        
        const snapshot = await queryRef.limit(50).get();
        
        let products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        
        // Client-side filters
        if (searchQuery) {
            const queryLower = searchQuery.toLowerCase();
            products = products.filter(p => 
                p.title.toLowerCase().includes(queryLower) ||
                p.description.toLowerCase().includes(queryLower)
            );
        }
        
        // Apply price range filter
        if (priceMin) {
            products = products.filter(p => p.price >= parseFloat(priceMin));
        }
        if (priceMax) {
            products = products.filter(p => p.price <= parseFloat(priceMax));
        }
        
        // Apply seller type filter
        if (sellerType === 'sankofa-store') {
            products = products.filter(p => p.isSankofaStore === true);
        } else if (sellerType === 'verified') {
            products = products.filter(p => p.isVerifiedSeller === true);
        } else if (sellerType === 'individual') {
            products = products.filter(p => !p.isSankofaStore && !p.isVerifiedSeller);
        }
        
        // Apply sorting
        products = sortProducts(products, sortBy);
        
        renderProducts(products);
        updateSubtitle(products.length, searchQuery, category);
    } catch (error) {
        console.error('Error applying filters:', error);
        showFlashMessage('Error applying filters', 'error');
    }
}

// ============================================================================
// RESET FILTERS
// ============================================================================

function resetFilters() {
    document.getElementById('filterCategory').value = '';
    document.getElementById('priceMin').value = '';
    document.getElementById('priceMax').value = '';
    document.getElementById('filterCondition').value = '';
    document.getElementById('filterLocation').value = '';
    document.getElementById('filterSellerType').value = '';
    document.getElementById('sortBy').value = 'latest';
    
    const searchQuery = document.getElementById('searchInput').value;
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category') || '';
    
    loadProducts(searchQuery, categoryParam);
}

// ============================================================================
// SORT PRODUCTS
// ============================================================================

function sortProducts(products, sortBy) {
    switch (sortBy) {
        case 'latest':
            return products.sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return timeB - timeA;
            });
        
        case 'price-low':
            return products.sort((a, b) => a.price - b.price);
        
        case 'price-high':
            return products.sort((a, b) => b.price - a.price);
        
        case 'rating':
            return products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        
        case 'distance':
            return products;
        
        default:
            return products;
    }
}

// ============================================================================
// UPDATE SUBTITLE
// ============================================================================

function updateSubtitle(count, query, category) {
    const subtitleEl = document.getElementById('searchSubtitle');
    
    if (count === 0) {
        subtitleEl.textContent = 'No products found';
    } else {
        subtitleEl.textContent = `${count} product${count > 1 ? 's' : ''} found`;
    }
}

// ============================================================================
// RENDER PRODUCTS
// ============================================================================

function renderProducts(products) {
    const container = document.getElementById('searchResults');
    
    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No products found</h3>
                <p>Try adjusting your filters or search query</p>
                <button class="btn btn-primary" onclick="resetFilters()">
                    <i class="fas fa-times"></i> Reset Filters
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = products.map(product => {
        const imageUrl = product.images && product.images.length > 0 
            ? product.images[0] 
            : 'https://via.placeholder.com/400x300?text=No+Image';
        
        const relativeTime = product.createdAt 
            ? formatRelativeTime(product.createdAt.toDate ? product.createdAt.toDate() : new Date(product.createdAt))
            : 'Recently';
        
        const isSankofaStore = product.isSankofaStore === true;
        const isVerifiedSeller = product.isVerifiedSeller === true;
        
        const sellerInfo = product.sellerName 
            ? `<div class="product-seller">
                <img src="${product.sellerPhoto || 'https://via.placeholder.com/50'}" alt="${product.sellerName}">
                <span class="seller-name">${product.sellerName}</span>
                ${isVerifiedSeller ? '<i class="fas fa-check-circle verified-icon"></i>' : ''}
              </div>`
            : '';
        
        return `
            <a href="product-detail.html?id=${product.id}" class="product-card ${isSankofaStore ? 'sankofa-store' : ''}">
                ${isSankofaStore ? '<span class="sankofa-store-badge"><i class="fas fa-store"></i> Sankofa Store</span>' : ''}
                ${isVerifiedSeller && !isSankofaStore ? '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified</span>' : ''}
                <img src="${imageUrl}" alt="${product.title}" class="product-image">
                <div class="product-content">
                    ${product.isFeatured ? '<span class="product-badge">Featured</span>' : ''}
                    <div class="product-title">${product.title}</div>
                    <div class="product-price">${formatCurrency(product.price)}</div>
                    <div class="product-meta">
                        <span><i class="fas fa-map-marker-alt"></i> ${product.location?.city || 'Ghana'}</span>
                        <span><i class="fas fa-clock"></i> ${relativeTime}</span>
                    </div>
                    ${sellerInfo}
                </div>
            </a>
        `;
    }).join('');
}

// ============================================================================
// DEMO PRODUCTS
// ============================================================================

function renderDemoProducts() {
    const demoProducts = [
        {
            id: 'demo1',
            title: 'iPhone 12 Pro Max - Excellent Condition',
            price: 5500,
            images: ['https://via.placeholder.com/400x300/1a237e/ffffff?text=iPhone+12'],
            location: { city: 'Accra' },
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            isFeatured: true,
            isSankofaStore: true,
            sellerName: 'Sankofa Store',
            sellerPhoto: 'https://via.placeholder.com/50/d4af37/ffffff?text=SS',
            category: 'electronics',
            condition: 'like-new'
        },
        {
            id: 'demo2',
            title: 'Samsung 55" Smart TV - Like New',
            price: 3200,
            images: ['https://via.placeholder.com/400x300/d4af37/ffffff?text=Samsung+TV'],
            location: { city: 'Kumasi' },
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
            isFeatured: true,
            isSankofaStore: false,
            isVerifiedSeller: true,
            sellerName: 'Kwame Asante',
            sellerPhoto: 'https://via.placeholder.com/50/1a237e/ffffff?text=KA',
            category: 'electronics',
            condition: 'like-new'
        },
        {
            id: 'demo3',
            title: 'Leather Sofa Set - 3 Pieces',
            price: 2800,
            images: ['https://via.placeholder.com/400x300/4CAF50/ffffff?text=Sofa+Set'],
            location: { city: 'Tema' },
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: false,
            isVerifiedSeller: false,
            sellerName: 'Ama Boateng',
            sellerPhoto: 'https://via.placeholder.com/50/FF9800/ffffff?text=AB',
            category: 'home-garden',
            condition: 'good'
        },
        {
            id: 'demo4',
            title: 'MacBook Pro 2021 - M1 Chip',
            price: 8500,
            images: ['https://via.placeholder.com/400x300/FF9800/ffffff?text=MacBook+Pro'],
            location: { city: 'Accra' },
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
            isFeatured: true,
            isSankofaStore: true,
            sellerName: 'Sankofa Store',
            sellerPhoto: 'https://via.placeholder.com/50/d4af37/ffffff?text=SS',
            category: 'electronics',
            condition: 'new'
        },
        {
            id: 'demo5',
            title: 'Nike Air Jordan - Size 42',
            price: 800,
            images: ['https://via.placeholder.com/400x300/E91E63/ffffff?text=Nike+Shoes'],
            location: { city: 'Accra' },
            createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: false,
            isVerifiedSeller: true,
            sellerName: 'Kofi Mensah',
            sellerPhoto: 'https://via.placeholder.com/50/9C27B0/ffffff?text=KM',
            category: 'fashion',
            condition: 'like-new'
        },
        {
            id: 'demo6',
            title: 'Canon EOS Camera - With Lens',
            price: 4500,
            images: ['https://via.placeholder.com/400x300/9C27B0/ffffff?text=Canon+Camera'],
            location: { city: 'Kumasi' },
            createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: true,
            sellerName: 'Sankofa Store',
            sellerPhoto: 'https://via.placeholder.com/50/d4af37/ffffff?text=SS',
            category: 'electronics',
            condition: 'like-new'
        },
        {
            id: 'demo7',
            title: 'Dining Table - 6 Chairs',
            price: 1800,
            images: ['https://via.placeholder.com/400x300/2196F3/ffffff?text=Dining+Table'],
            location: { city: 'Takoradi' },
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: false,
            isVerifiedSeller: false,
            sellerName: 'Yaw Darkwa',
            sellerPhoto: 'https://via.placeholder.com/50/3F51B5/ffffff?text=YD',
            category: 'home-garden',
            condition: 'good'
        },
        {
            id: 'demo8',
            title: 'PlayStation 5 - With Games',
            price: 6500,
            images: ['https://via.placeholder.com/400x300/3F51B5/ffffff?text=PS5'],
            location: { city: 'Accra' },
            createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
            isFeatured: true,
            isSankofaStore: true,
            sellerName: 'Sankofa Store',
            sellerPhoto: 'https://via.placeholder.com/50/d4af37/ffffff?text=SS',
            category: 'electronics',
            condition: 'new'
        }
    ];
    
    renderProducts(demoProducts);
    updateSubtitle(demoProducts.length, '', '');
}

function applyDemoFilters(category, priceMin, priceMax, condition, location, sellerType, sortBy) {
    const demoProducts = [
        {
            id: 'demo1',
            title: 'iPhone 12 Pro Max - Excellent Condition',
            price: 5500,
            images: ['https://via.placeholder.com/400x300/1a237e/ffffff?text=iPhone+12'],
            location: { city: 'Accra' },
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            isFeatured: true,
            isSankofaStore: true,
            sellerName: 'Sankofa Store',
            sellerPhoto: 'https://via.placeholder.com/50/d4af37/ffffff?text=SS',
            category: 'electronics',
            condition: 'like-new'
        },
        {
            id: 'demo2',
            title: 'Samsung 55" Smart TV - Like New',
            price: 3200,
            images: ['https://via.placeholder.com/400x300/d4af37/ffffff?text=Samsung+TV'],
            location: { city: 'Kumasi' },
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
            isFeatured: true,
            isSankofaStore: false,
            isVerifiedSeller: true,
            sellerName: 'Kwame Asante',
            sellerPhoto: 'https://via.placeholder.com/50/1a237e/ffffff?text=KA',
            category: 'electronics',
            condition: 'like-new'
        },
        {
            id: 'demo3',
            title: 'Leather Sofa Set - 3 Pieces',
            price: 2800,
            images: ['https://via.placeholder.com/400x300/4CAF50/ffffff?text=Sofa+Set'],
            location: { city: 'Tema' },
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: false,
            isVerifiedSeller: false,
            sellerName: 'Ama Boateng',
            sellerPhoto: 'https://via.placeholder.com/50/FF9800/ffffff?text=AB',
            category: 'home-garden',
            condition: 'good'
        },
        {
            id: 'demo4',
            title: 'MacBook Pro 2021 - M1 Chip',
            price: 8500,
            images: ['https://via.placeholder.com/400x300/FF9800/ffffff?text=MacBook+Pro'],
            location: { city: 'Accra' },
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
            isFeatured: true,
            isSankofaStore: true,
            sellerName: 'Sankofa Store',
            sellerPhoto: 'https://via.placeholder.com/50/d4af37/ffffff?text=SS',
            category: 'electronics',
            condition: 'new'
        },
        {
            id: 'demo5',
            title: 'Nike Air Jordan - Size 42',
            price: 800,
            images: ['https://via.placeholder.com/400x300/E91E63/ffffff?text=Nike+Shoes'],
            location: { city: 'Accra' },
            createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: false,
            isVerifiedSeller: true,
            sellerName: 'Kofi Mensah',
            sellerPhoto: 'https://via.placeholder.com/50/9C27B0/ffffff?text=KM',
            category: 'fashion',
            condition: 'like-new'
        },
        {
            id: 'demo6',
            title: 'Canon EOS Camera - With Lens',
            price: 4500,
            images: ['https://via.placeholder.com/400x300/9C27B0/ffffff?text=Canon+Camera'],
            location: { city: 'Kumasi' },
            createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: true,
            sellerName: 'Sankofa Store',
            sellerPhoto: 'https://via.placeholder.com/50/d4af37/ffffff?text=SS',
            category: 'electronics',
            condition: 'like-new'
        },
        {
            id: 'demo7',
            title: 'Dining Table - 6 Chairs',
            price: 1800,
            images: ['https://via.placeholder.com/400x300/2196F3/ffffff?text=Dining+Table'],
            location: { city: 'Takoradi' },
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            isFeatured: false,
            isSankofaStore: false,
            isVerifiedSeller: false,
            sellerName: 'Yaw Darkwa',
            sellerPhoto: 'https://via.placeholder.com/50/3F51B5/ffffff?text=YD',
            category: 'home-garden',
            condition: 'good'
        },
        {
            id: 'demo8',
            title: 'PlayStation 5 - With Games',
            price: 6500,
            images: ['https://via.placeholder.com/400x300/3F51B5/ffffff?text=PS5'],
            location: { city: 'Accra' },
            createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
            isFeatured: true,
            isSankofaStore: true,
            sellerName: 'Sankofa Store',
            sellerPhoto: 'https://via.placeholder.com/50/d4af37/ffffff?text=SS',
            category: 'electronics',
            condition: 'new'
        }
    ];
    
    let filtered = [...demoProducts];
    
    if (category) {
        filtered = filtered.filter(p => p.category === category);
    }
    
    if (priceMin) {
        filtered = filtered.filter(p => p.price >= parseFloat(priceMin));
    }
    
    if (priceMax) {
        filtered = filtered.filter(p => p.price <= parseFloat(priceMax));
    }
    
    if (condition) {
        filtered = filtered.filter(p => p.condition === condition);
    }
    
    if (location) {
        filtered = filtered.filter(p => p.location.city === location);
    }
    
    if (sellerType === 'sankofa-store') {
        filtered = filtered.filter(p => p.isSankofaStore === true);
    } else if (sellerType === 'verified') {
        filtered = filtered.filter(p => p.isVerifiedSeller === true);
    } else if (sellerType === 'individual') {
        filtered = filtered.filter(p => !p.isSankofaStore && !p.isVerifiedSeller);
    }
    
    filtered = sortProducts(filtered, sortBy);
    
    renderProducts(filtered);
    updateSubtitle(filtered.length, '', category);
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

function showFlashMessage(message, type) {
    if (typeof window.SankofaMarket !== 'undefined' && window.SankofaMarket.showFlashMessage) {
        window.SankofaMarket.showFlashMessage(message, type);
    } else {
        alert(message);
    }
}

// ============================================================================
// EXPORT
// ============================================================================

window.Search = {
    loadProducts,
    applyFilters,
    resetFilters,
    sortProducts,
    renderProducts,
    renderDemoProducts,
    applyDemoFilters
};
