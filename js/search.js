/**
 * Sankofa Market - Search Page JavaScript (Redesigned)
 */

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q') || '';
    const categoryParam = urlParams.get('category') || '';
    
    document.getElementById('searchInput').value = searchQuery;
    document.getElementById('headerSearchInput').value = searchQuery;
    
    if (categoryParam) {
        document.getElementById('filterCategory').value = categoryParam;
    }
    
    updateSearchTitle(searchQuery, categoryParam);
    loadProducts(searchQuery, categoryParam);
    initMobileFilters();
    initViewToggle();
    
    // Log search query for analytics
    if (searchQuery && typeof firebase !== 'undefined' && typeof firebaseDB !== 'undefined') {
        logSearchQuery(searchQuery, categoryParam);
    }
});

// ============================================================================
// SEARCH ANALYTICS LOGGING
// ============================================================================

async function logSearchQuery(query, category = '') {
    try {
        const searchData = {
            query: query.toLowerCase().trim(),
            originalQuery: query.trim(),
            category: category || '',
            userId: getCurrentUserId(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent,
            resultsCount: 0 // Will be updated after search completes
        };
        
        // Save to search_logs collection
        const docRef = await firebaseDB.collection('search_logs').add(searchData);
        
        // Update the document with results count after search completes
        setTimeout(async () => {
            const resultsCount = document.querySelectorAll('.product-card').length;
            await firebaseDB.collection('search_logs').doc(docRef.id).update({
                resultsCount: resultsCount
            });
        }, 2000);
        
        console.log('Search logged:', query);
    } catch (error) {
        console.error('Error logging search:', error);
        // Don't block user experience if logging fails
    }
}

function getCurrentUserId() {
    if (typeof firebase !== 'undefined' && firebase.auth()) {
        const user = firebase.auth().currentUser;
        return user ? user.uid : 'anonymous';
    }
    return 'anonymous';
}

// ============================================================================
// SEARCH TITLE
// ============================================================================

function updateSearchTitle(query, category) {
    const titleEl = document.getElementById('searchTitle');
    const subtitleEl = document.getElementById('searchSubtitle');
    const categoryNames = {
        'electronics': 'Electronics', 'fashion': 'Fashion',
        'home-garden': 'Home & Garden', 'vehicles': 'Vehicles',
        'services': 'Services', 'sports': 'Sports & Outdoors',
        'books-media': 'Books & Media', 'baby-kids': 'Baby & Kids',
        'beauty-health': 'Beauty & Health', 'food-groceries': 'Food & Groceries',
        'pets': 'Pets', 'jobs-skills': 'Jobs & Skills',
        'real-estate': 'Real Estate', 'sankofa-store': 'Sankofa Store'
    };
    
    if (query) {
        titleEl.textContent = `Results for "${query}"`;
    } else if (category) {
        titleEl.textContent = categoryNames[category] || 'Browse Products';
    } else {
        titleEl.textContent = 'All Products';
    }
    subtitleEl.textContent = 'Finding the best deals for you...';
}

// ============================================================================
// MOBILE FILTERS
// ============================================================================

function initMobileFilters() {
    const toggle = document.getElementById('mobileFilterToggle');
    const sidebar = document.getElementById('filtersSidebar');
    const overlay = document.getElementById('filterOverlay');
    const closeBtn = document.getElementById('mobileFiltersClose');
    const mobileHeader = sidebar.querySelector('.mobile-filters-header');
    
    toggle.addEventListener('click', () => {
        sidebar.classList.add('mobile-open');
        overlay.classList.add('active');
        mobileHeader.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });
    
    function closeFilters() {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    overlay.addEventListener('click', closeFilters);
    closeBtn.addEventListener('click', closeFilters);
}

// ============================================================================
// VIEW TOGGLE
// ============================================================================

function initViewToggle() {
    const saved = localStorage.getItem('sankofa_view') || 'grid';
    setView(saved);
}

function setView(mode) {
    const grid = document.getElementById('searchResults');
    const gridBtn = document.getElementById('gridViewBtn');
    const listBtn = document.getElementById('listViewBtn');
    
    if (mode === 'list') {
        grid.classList.add('list-view');
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
    } else {
        grid.classList.remove('list-view');
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
    }
    localStorage.setItem('sankofa_view', mode);
}

// ============================================================================
// FILTER GROUP TOGGLE
// ============================================================================

function toggleFilterGroup(el) {
    el.parentElement.classList.toggle('collapsed');
}

// ============================================================================
// LOAD PRODUCTS
// ============================================================================

async function loadProducts(query = '', category = '') {
    if (typeof firebaseDB === 'undefined') {
        renderDemoProducts(query, category);
        return;
    }
    
    try {
        let queryRef = firebaseDB.collection('products')
            .where('isActive', '==', true).where('isSold', '==', false);
        if (category) queryRef = queryRef.where('category', '==', category);
        
        const snapshot = await queryRef.limit(50).get();
        if (snapshot.empty) { renderDemoProducts(query, category); return; }
        
        let products = [];
        snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        
        if (query) {
            const q = query.toLowerCase();
            products = products.filter(p => p.title.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
        }
        
        renderProducts(products);
        updateResultsCount(products.length);
    } catch (error) {
        console.error('Error:', error);
        renderDemoProducts(query, category);
    }
}

// ============================================================================
// APPLY FILTERS
// ============================================================================

function applyFilters() {
    const category = document.getElementById('filterCategory').value;
    const priceMin = document.getElementById('priceMin').value;
    const priceMax = document.getElementById('priceMax').value;
    const location = document.getElementById('filterLocation').value;
    const sortBy = document.getElementById('sortBy').value;
    const sellerType = document.querySelector('.seller-filter:checked')?.value || '';
    const conditions = Array.from(document.querySelectorAll('.condition-filter:checked')).map(c => c.value);
    const deliveryOptions = Array.from(document.querySelectorAll('.delivery-filter:checked')).map(c => c.value);
    
    applyDemoFilters(category, priceMin, priceMax, conditions, location, sellerType, sortBy, deliveryOptions);
    updateActiveFilters(category, priceMin, priceMax, conditions, location, sellerType, deliveryOptions);
}

// ============================================================================
// RESET FILTERS
// ============================================================================

function resetFilters() {
    document.getElementById('filterCategory').value = '';
    document.getElementById('priceMin').value = '';
    document.getElementById('priceMax').value = '';
    document.getElementById('filterLocation').value = '';
    document.getElementById('sortBy').value = 'latest';
    document.querySelectorAll('.condition-filter').forEach(c => c.checked = false);
    document.querySelectorAll('.delivery-filter').forEach(c => c.checked = false);
    document.querySelector('.seller-filter[value=""]').checked = true;
    document.getElementById('activeFilters').style.display = 'none';
    
    const urlParams = new URLSearchParams(window.location.search);
    loadProducts(urlParams.get('q') || '', urlParams.get('category') || '');
}

// ============================================================================
// ACTIVE FILTERS CHIPS
// ============================================================================

function updateActiveFilters(category, priceMin, priceMax, conditions, location, sellerType, deliveryOptions) {
    const container = document.getElementById('activeFilters');
    const chips = [];
    
    if (category) chips.push({ label: document.getElementById('filterCategory').selectedOptions[0].text, key: 'category' });
    if (priceMin || priceMax) chips.push({ label: `GHS ${priceMin || '0'} - ${priceMax || '∞'}`, key: 'price' });
    conditions.forEach(c => chips.push({ label: c.replace('-', ' '), key: 'condition', value: c }));
    if (location) chips.push({ label: location, key: 'location' });
    if (sellerType) chips.push({ label: sellerType.replace('-', ' '), key: 'seller' });
    
    // Add delivery options to chips
    deliveryOptions.forEach(d => {
        const labels = {
            'free-delivery': 'Free Delivery',
            'paid-delivery': 'Paid Delivery',
            'pickup': 'Pickup Only'
        };
        chips.push({ label: labels[d] || d, key: 'delivery', value: d });
    });
    
    if (chips.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'flex';
    container.innerHTML = chips.map(c => `
        <span class="filter-chip">${c.label} <button onclick="removeFilter('${c.key}', '${c.value || ''}')"><i class="fas fa-times"></i></button></span>
    `).join('') + '<button class="clear-all-btn" onclick="resetFilters()">Clear all</button>';
}

function removeFilter(key, value) {
    if (key === 'category') document.getElementById('filterCategory').value = '';
    if (key === 'price') { document.getElementById('priceMin').value = ''; document.getElementById('priceMax').value = ''; }
    if (key === 'condition') document.querySelector(`.condition-filter[value="${value}"]`).checked = false;
    if (key === 'location') document.getElementById('filterLocation').value = '';
    if (key === 'seller') document.querySelector('.seller-filter[value=""]').checked = true;
    if (key === 'delivery') document.querySelector(`.delivery-filter[value="${value}"]`).checked = false;
    applyFilters();
}

// ============================================================================
// RESULTS COUNT
// ============================================================================

function updateResultsCount(count) {
    document.getElementById('resultsCount').innerHTML = `Showing <strong>${count} product${count !== 1 ? 's' : ''}</strong>`;
    document.getElementById('searchSubtitle').textContent = `${count} product${count !== 1 ? 's' : ''} found`;
}

// ============================================================================
// SORT
// ============================================================================

function sortProducts(products, sortBy) {
    switch (sortBy) {
        case 'price-low': return products.sort((a, b) => a.price - b.price);
        case 'price-high': return products.sort((a, b) => b.price - a.price);
        case 'rating': return products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        default: return products.sort((a, b) => {
            const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return tB - tA;
        });
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
                <p>Try adjusting your filters or search for something else</p>
                <button class="btn btn-primary" onclick="resetFilters()"><i class="fas fa-redo"></i> Reset Filters</button>
            </div>`;
        updateResultsCount(0);
        return;
    }
    
    container.innerHTML = products.map(p => {
        const img = p.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=350&h=260&fit=crop&q=75&auto=format';
        const time = p.createdAt ? formatRelTime(p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt)) : 'Recently';
        const isSS = p.isSankofaStore === true;
        const isV = p.isVerifiedSeller === true;
        const condClass = p.condition || '';
        const condLabel = { 'new': 'New', 'like-new': 'Like New', 'good': 'Good', 'fair': 'Fair' }[p.condition] || '';
        
        // Build delivery badges
        const deliveryBadges = [];
        if (p.deliveryOptions && p.deliveryOptions.includes('free-delivery')) {
            deliveryBadges.push('<span class="delivery-badge free"><i class="fas fa-truck"></i> Free Delivery</span>');
        }
        if (p.deliveryOptions && p.deliveryOptions.includes('paid-delivery')) {
            deliveryBadges.push(`<span class="delivery-badge paid"><i class="fas fa-shipping-fast"></i> Delivery: GHS ${p.deliveryFee || '0'}</span>`);
        }
        if (p.deliveryOptions && p.deliveryOptions.includes('pickup')) {
            deliveryBadges.push('<span class="delivery-badge pickup"><i class="fas fa-store"></i> Pickup</span>');
        }
        
        return `
        <a href="product-detail.html?id=${p.id}" class="product-card ${isSS ? 'sankofa-store' : ''}">
            <div class="product-image-wrapper">
                <img src="${img}" alt="${p.title}" class="product-image" loading="lazy" decoding="async">
                ${p.isFeatured ? '<span class="product-badge">Featured</span>' : ''}
                ${isSS ? '<span class="sankofa-store-badge"><i class="fas fa-store"></i> Official</span>' : ''}
            </div>
            <div class="product-content">
                ${condLabel ? `<span class="condition-badge ${condClass}">${condLabel}</span>` : ''}
                <div class="product-title">${p.title}</div>
                <div class="product-price">${formatCurr(p.price)}</div>
                ${deliveryBadges.length > 0 ? `<div class="delivery-badges">${deliveryBadges.join('')}</div>` : ''}
                <div class="product-meta">
                    <span><i class="fas fa-map-marker-alt"></i> ${p.location?.city || 'Ghana'}</span>
                    <span><i class="fas fa-clock"></i> ${time}</span>
                </div>
                ${p.sellerName ? `<div class="product-seller">
                    <img src="${p.sellerPhoto || 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=40&h=40&fit=crop&crop=face&q=75&auto=format'}" alt="${p.sellerName}" loading="lazy" decoding="async">
                    <span class="seller-name">${p.sellerName}</span>
                    ${isV || isSS ? '<i class="fas fa-check-circle verified-icon"></i>' : ''}
                </div>` : ''}
            </div>
        </a>`;
    }).join('');
    
    updateResultsCount(products.length);
}

// ============================================================================
// DEMO PRODUCTS (with real Unsplash images)
// ============================================================================

const DEMO_PRODUCTS = [
    createdAt: new Date(Date.now() - 2*3600000),
        isFeatured: true, isSankofaStore: true, sellerName: 'Sankofa Store',
        sellerPhoto: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=40&h=40&fit=crop&crop=face&q=75&auto=format',
        category: 'electronics', condition: 'new',
        deliveryOptions: ['free-delivery', 'pickup']
    },
    createdAt: new Date(Date.now() - 5*3600000),
        isFeatured: true, isVerifiedSeller: true, sellerName: '',
        sellerPhoto: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=40&h=40&fit=crop&crop=face&q=75&auto=format',
        category: 'electronics', condition: 'like-new',
        deliveryOptions: ['paid-delivery', 'pickup'], deliveryFee: 50
    },
    createdAt: new Date(Date.now() - 86400000),
        isFeatured: false, sellerName: 'Ama Boateng',
        sellerPhoto: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=40&h=40&fit=crop&crop=face&q=75&auto=format',
        category: 'home-garden', condition: 'good',
        deliveryOptions: ['paid-delivery'], deliveryFee: 100
    },
    createdAt: new Date(Date.now() - 3*3600000),
        isFeatured: true, isSankofaStore: true, sellerName: 'Sankofa Store',
        sellerPhoto: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=40&h=40&fit=crop&crop=face&q=75&auto=format',
        category: 'electronics', condition: 'new',
        deliveryOptions: ['free-delivery', 'paid-delivery', 'pickup'], deliveryFee: 30
    },
    createdAt: new Date(Date.now() - 6*3600000),
        isFeatured: false, isVerifiedSeller: true, sellerName: 'Kofi Mensah',
        sellerPhoto: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=40&h=40&fit=crop&crop=face&q=75&auto=format',
        category: 'fashion', condition: 'like-new',
        deliveryOptions: ['free-delivery', 'pickup']
    },
    createdAt: new Date(Date.now() - 12*3600000),
        isFeatured: false, isSankofaStore: true, sellerName: 'Sankofa Store',
        sellerPhoto: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=40&h=40&fit=crop&crop=face&q=75&auto=format',
        category: 'electronics', condition: 'like-new',
        deliveryOptions: ['free-delivery', 'pickup']
    },
    createdAt: new Date(Date.now() - 2*86400000),
        isFeatured: false, sellerName: 'Yaw Darkwa',
        sellerPhoto: 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=40&h=40&fit=crop&crop=face&q=75&auto=format',
        category: 'home-garden', condition: 'good',
        deliveryOptions: ['pickup']
    },
    createdAt: new Date(Date.now() - 8*3600000),
        isFeatured: true, isSankofaStore: true, sellerName: 'Sankofa Store',
        sellerPhoto: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=40&h=40&fit=crop&crop=face&q=75&auto=format',
        category: 'electronics', condition: 'new',
        deliveryOptions: ['free-delivery', 'paid-delivery', 'pickup'], deliveryFee: 25
    },
    createdAt: new Date(Date.now() - 4*3600000),
        isFeatured: false, isVerifiedSeller: true, sellerName: 'Efua Adjei',
        sellerPhoto: 'https://images.unsplash.com/photo-1523824921871-d6f411bace62?w=40&h=40&fit=crop&crop=face&q=75&auto=format',
        category: 'electronics', condition: 'new',
        deliveryOptions: ['free-delivery', 'pickup']
    },
    createdAt: new Date(Date.now() - 86400000),
        isFeatured: false, sellerName: 'Akosua Frimpong',
        sellerPhoto: 'https://images.unsplash.com/photo-1524638431109-93d95c968f68?w=40&h=40&fit=crop&crop=face&q=75&auto=format',
        category: 'fashion', condition: 'new',
        deliveryOptions: ['paid-delivery', 'pickup'], deliveryFee: 20
    },
    createdAt: new Date(Date.now() - 10*3600000),
        isFeatured: false, isVerifiedSeller: true, sellerName: 'Abena Osei',
        sellerPhoto: 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=40&h=40&fit=crop&crop=face&q=75&auto=format',
        category: 'fashion', condition: 'new',
        deliveryOptions: ['free-delivery', 'pickup']
    },
    createdAt: new Date(Date.now() - 3*86400000),
        isFeatured: false, sellerName: 'Kofi Agyeman',
        sellerPhoto: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=40&h=40&fit=crop&crop=face&q=75&auto=format',
        category: 'sports', condition: 'like-new',
        deliveryOptions: ['pickup']
    }
];

function renderDemoProducts(query = '', category = '') {
    let products = [];
    
    if (category) products = products.filter(p => p.category === category);
    if (query) {
        const q = query.toLowerCase();
        products = products.filter(p => p.title.toLowerCase().includes(q));
    }
    
    renderProducts(products);
}

function applyDemoFilters(category, priceMin, priceMax, conditions, location, sellerType, sortBy, deliveryOptions) {
    let filtered = [...DEMO_PRODUCTS];
    
    if (category) filtered = filtered.filter(p => p.category === category);
    if (priceMin) filtered = filtered.filter(p => p.price >= parseFloat(priceMin));
    if (priceMax) filtered = filtered.filter(p => p.price <= parseFloat(priceMax));
    if (conditions.length) filtered = filtered.filter(p => conditions.includes(p.condition));
    if (location) filtered = filtered.filter(p => p.location.city === location);
    if (sellerType === 'sankofa-store') filtered = filtered.filter(p => p.isSankofaStore);
    else if (sellerType === 'verified') filtered = filtered.filter(p => p.isVerifiedSeller);
    else if (sellerType === 'individual') filtered = filtered.filter(p => !p.isSankofaStore && !p.isVerifiedSeller);
    
    // Filter by delivery options
    if (deliveryOptions.length > 0) {
        filtered = filtered.filter(p => {
            // Product must have at least one of the selected delivery options
            return deliveryOptions.some(option => p.deliveryOptions && p.deliveryOptions.includes(option));
        });
    }
    
    filtered = sortProducts(filtered, sortBy);
    renderProducts(filtered);
}

// ============================================================================
// UTILITIES
// ============================================================================

function formatCurr(amount) {
    return `GHS ${amount.toLocaleString()}`;
}

function formatRelTime(date) {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}
