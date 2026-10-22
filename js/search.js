/**
 * Sankofa Market - Search Page JavaScript (Redesigned)
 */

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q') || '';
    const categoryParam = urlParams.get('category') || '';
    
    var heroSearchBox = document.getElementById('searchInput');   // hero search bar was removed; only the header one remains on this page
    if (heroSearchBox) heroSearchBox.value = searchQuery;
    document.getElementById('headerSearchInput').value = searchQuery;
    
    if (categoryParam) {
        document.getElementById('filterCategory').value = categoryParam;
    }
    
    updateSearchTitle(searchQuery, categoryParam);
    showSearchSkeleton();
    loadProducts(searchQuery, categoryParam);
    initMobileFilters();
    initViewToggle();
    loadCustomCategories();
    initLiveSearch();
    initInstantFilters();
    
    // Log search query for analytics
    if (searchQuery && typeof firebase !== 'undefined' && typeof firebaseDB !== 'undefined') {
        logSearchQuery(searchQuery, categoryParam);
    }

    // "Picked for you" learning — remember searches (and plain category browses)
    // on this device so the home page can surface matching items next visit
    try {
        if (typeof window !== 'undefined' && typeof window.smForYouTrackSearch === 'function') {
            if (searchQuery) window.smForYouTrackSearch(searchQuery, categoryParam);
            else if (categoryParam) window.smForYouTrackCategoryBrowse(categoryParam);
        }
    } catch (e) {}
});

// ============================================================================
// INSTANT FILTERS — ticking a box must move the products immediately
// ============================================================================
// For a long time NOTHING listened to the filter controls: the results only
// refreshed if the shopper found the "Show Results" button at the very bottom
// of the panel — so selecting a condition appeared to do nothing at all.
function initInstantFilters() {
    var sidebar = document.getElementById('filtersSidebar');
    if (!sidebar) return;
    sidebar.addEventListener('change', function (e) {
        var t = e.target;
        if (t && t.matches && t.matches('.condition-filter, .seller-filter, .delivery-filter, #filterCategory, #filterLocation')) {
            applyFilters();
        }
    });
    // Price fields: wait for a pause in typing, then apply
    var timer = null;
    ['priceMin', 'priceMax'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', function () {
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () { applyFilters(); }, 400);
        });
    });
}

// Real counts beside each condition (the page used to ship hard-coded demo
// numbers — 24/56/89/12 — that had nothing to do with the live catalogue).
function updateConditionCounts() {
    try {
        var counts = {};
        (allProductsCache || []).forEach(function (p) {
            if (p && p.condition) counts[p.condition] = (counts[p.condition] || 0) + 1;
        });
        document.querySelectorAll('.condition-filter').forEach(function (cb) {
            var label = cb.closest('label');
            var span = label && label.querySelector('.count');
            if (span) span.textContent = String(counts[cb.value] || 0);
        });
    } catch (e) {}
}

function tryCloseMobileFilters() {
    try { if (window.__smCloseMobileFilters) window.__smCloseMobileFilters(); } catch (e) {}
}

// ============================================================================
// SEARCH ANALYTICS LOGGING
// ============================================================================

/**
 * Search analytics used to be written to a `search_logs` collection straight from the
 * browser. That collection has no rule (the catch-all denies everything) and nothing in the
 * app ever read it — so every search produced a "Missing or insufficient permissions" error
 * in the console and a promise that hung for two seconds updating a document that was never
 * created.
 *
 * If you want search analytics later, the right shape is a Cloud Function (or a rule that
 * lets signed-in users create — but never read — a log entry) plus a page in the admin panel
 * to read it. Records of what people search for that you do NOT have are genuinely useful;
 * they are just not worth a broken console until then.
 */
async function logSearchQuery(query, category = '') {
    window.__lastSearchQuery = { query: query, category: category, at: new Date().toISOString() };
    return true;
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
    
    if (flashOnly && !query && !category) {
        titleEl.textContent = '⚡ Flash Deals';
        subtitleEl.textContent = 'Live flash sales — ending soonest first';
        return;
    }
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
    // "Show Results" closes the panel on phones (applyFilters(true) calls this)
    window.__smCloseMobileFilters = closeFilters;
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

function debounce(fn, wait){ let t; return function(...a){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), wait); }; }
var allProductsCache = [];

/* The homepage "Flash Deals — View All" link lands on /search.html?flash=true:
   show ONLY sales that are still ticking, default order = "ending soonest first". */
var flashOnly = false;
try { flashOnly = new URLSearchParams(window.location.search).get('flash') === 'true'; } catch (e) {}
function smFlashEndMs(p) {
    var f = p && p.flashSale;
    if (!f || !f.endsAt) return 0;
    var d = f.endsAt.toDate ? f.endsAt.toDate() : new Date(f.endsAt);
    return d.getTime ? d.getTime() : 0;
}
var filteredCache = [];
var searchCurrentPage = 1;
var searchPageSize = 12;
var searchFuse = null;

function showSearchSkeleton(){
    var container = document.getElementById('searchResults');
    if (!container) return;
    var skel = '';
    for(var i=0;i<8;i++){
        skel += '<div class="product-card" style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);"><div style="height:180px;background:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;"></div><div style="padding:1rem;"><div style="height:14px;background:#e5e7eb;border-radius:6px;margin-bottom:8px;animation:shimmer 1.5s infinite;"></div><div style="height:14px;background:#e5e7eb;border-radius:6px;width:60%;animation:shimmer 1.5s infinite;"></div></div></div>';
    }
    container.innerHTML = skel;
    var pag = document.getElementById('searchPagination');
    if(pag) pag.style.display='none';
}
function renderSearchPagination(){
    var pag = document.getElementById('searchPagination');
    var info = document.getElementById('searchPaginationInfo');
    var btns = document.getElementById('searchPaginationBtns');
    if (!pag || !btns) return;
    var total = filteredCache.length;
    var totalPages = Math.max(1, Math.ceil(total / searchPageSize));
    if (searchCurrentPage > totalPages) searchCurrentPage = totalPages;
    if (total===0){ pag.style.display='none'; return; }
    pag.style.display='flex';
    if(info){
        var start = (searchCurrentPage-1)*searchPageSize+1;
        var end = Math.min(total, searchCurrentPage*searchPageSize);
        info.textContent = 'Showing '+start+'–'+end+' of '+total+' products';
    }
    var html='';
    html += '<button class="page-btn" '+(searchCurrentPage===1?'disabled':'')+' onclick="goToSearchPage('+(searchCurrentPage-1)+')" aria-label="Previous page"><i class="fas fa-chevron-left"></i></button>';
    var startPage = Math.max(1, searchCurrentPage-2);
    var endPage = Math.min(totalPages, startPage+4);
    if(endPage-startPage<4) startPage=Math.max(1,endPage-4);
    if(startPage>1){ html+='<button class="page-btn" onclick="goToSearchPage(1)">1</button>'; if(startPage>2) html+='<span style="padding:0.4rem;color:#9ca3af;">…</span>'; }
    for(var p=startPage;p<=endPage;p++) html+='<button class="page-btn '+(p===searchCurrentPage?'active':'')+'" onclick="goToSearchPage('+p+')" aria-label="Page '+p+'">'+p+'</button>';
    if(endPage<totalPages){ if(endPage<totalPages-1) html+='<span style="padding:0.4rem;color:#9ca3af;">…</span>'; html+='<button class="page-btn" onclick="goToSearchPage('+totalPages+')">'+totalPages+'</button>'; }
    html+='<button class="page-btn" '+(searchCurrentPage===totalPages?'disabled':'')+' onclick="goToSearchPage('+(searchCurrentPage+1)+')" aria-label="Next page"><i class="fas fa-chevron-right"></i></button>';
    btns.innerHTML=html;
}
function goToSearchPage(p){
    searchCurrentPage=p;
    renderProductsPage();
    window.scrollTo({top: document.getElementById('searchResults').offsetTop - 100, behavior:'smooth'});
}
function renderProductsPage(){
    var start=(searchCurrentPage-1)*searchPageSize;
    var pageItems=filteredCache.slice(start, start+searchPageSize);
    // Reuse renderProducts logic but with paginated slice
    var container=document.getElementById('searchResults');
    if(!container) return;
    if(pageItems.length===0){
        container.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><h2 style="font-size:1.17em;">No products found</h2><p>Try adjusting filters</p><button class="btn btn-primary" onclick="resetFilters()"><i class="fas fa-redo"></i> Reset</button></div>';
        return;
    }
    container.innerHTML = pageItems.map(p => {
        var img=(typeof productThumb==='function')?productThumb(p):((p.images||p.photos||[])[0]||'/images/placeholders/product.svg');
        var time=p.createdAt?formatRelTime(p.createdAt.toDate?p.createdAt.toDate():new Date(p.createdAt)):'Recently';
        var isSS=p.isSankofaStore===true;
        var condLabel={'new':'New','like-new':'Like New','good':'Good','fair':'Fair'}[p.condition]||'';
        var deliveryBadges=[];
        if(p.deliveryOptions&&p.deliveryOptions.includes('free-delivery')) deliveryBadges.push('<span class="delivery-badge free"><i class="fas fa-truck"></i> Free Delivery</span>');
        if(p.deliveryOptions&&p.deliveryOptions.includes('paid-delivery')) deliveryBadges.push(`<span class="delivery-badge paid"><i class="fas fa-shipping-fast"></i> Delivery: GHS ${p.deliveryFee||'0'}</span>`);
        if(p.deliveryOptions&&p.deliveryOptions.includes('pickup')) deliveryBadges.push('<span class="delivery-badge pickup"><i class="fas fa-store"></i> Pickup</span>');
        return `
        <a href="product-detail.html?id=${encodeURIComponent(p.id)}" class="product-card ${isSS?'sankofa-store':''}" data-pid="${escapeHtmlSearch(p.id)}">
            <div class="product-image-wrapper">
                <img src="${escapeHtmlSearch(img)}" data-alt-src="${escapeHtmlSearch((typeof productFull==='function')?productFull(p):img)}" onerror="smImgFallback(this)" alt="${escapeHtmlSearch(p.title)}" class="product-image" loading="lazy" decoding="async">
                ${p.isBoosted?'<span class="product-badge" style="background:linear-gradient(135deg,#f5af02 0%,#e09e00 100%);color:#191919;"><i class="fas fa-rocket"></i> Boosted</span>':(p.isFeatured?'<span class="product-badge">Featured</span>':'')}
                ${isSS?'<span class="sankofa-store-badge"><i class="fas fa-store"></i> Official</span>':''}${p.preOrder?' <span class="preorder-badge" title="Pre-order — pay now, ships when stock lands (escrow protected)"><i class="fas fa-clock"></i> Pre-order</span>':''}
                ${smFlashRibbonHtml(p)}
            </div>
            <div class="product-content">
                ${condLabel?`<span class="condition-badge ${p.condition}">${condLabel}</span>`:''}
                <div class="product-title">${escapeHtmlSearch(p.title)}</div>
                <div class="product-price">${smFlashPriceHtml(p)}</div>
                ${Number(p.reviewCount||0)>0 && Number(p.averageRating||0)>0 ? `<div class="product-rating" style="font-size:0.78rem;color:#5a6572;"><span style="color:#f5af02;">★</span> <strong style="color:#191919;">${Number(p.averageRating).toFixed(1)}</strong> (${Number(p.reviewCount)})</div>` : ''}
                ${deliveryBadges.length?`<div class="delivery-badges">${deliveryBadges.join('')}</div>`:''}
                <div class="product-meta">
                    <span><i class="fas fa-map-marker-alt"></i> ${escapeHtmlSearch(p.location?.city || 'Ghana')}</span>
                    <span><i class="fas fa-clock"></i> ${time}</span>
                </div>
                ${p.sellerName?`<div class="product-seller"><img src="${escapeHtmlSearch(p.sellerPhoto || '/images/placeholders/avatar.svg')}" alt="${escapeHtmlSearch(p.sellerName)}"><span class="seller-name">${escapeHtmlSearch(p.sellerName)}</span>${p.isVerifiedSeller?' <i class="fas fa-check-circle verified-icon"></i>':''}${p.sellerId?`<span class="premSlot" data-sid="${escapeHtmlSearch(p.sellerId)}"></span>`:''}</div>`:''}
            </div>
        </a>`;
    }).join('');
    smInjectPremiumBadges(container);
    renderSearchPagination();
}

// Debounced live search
function initLiveSearch(){
    var inputs=document.querySelectorAll('#searchInput, #headerSearchInput, #searchInput');
    inputs.forEach(function(inp){
        if(!inp) return;
        inp.addEventListener('input', debounce(function(){
            var q=this.value.trim();
            if(q.length<2 && q.length>0) return;
            // Update URL without reload
            var url=new URL(window.location.href);
            if(q) url.searchParams.set('q', q); else url.searchParams.delete('q');
            history.replaceState(null,'',url);
            updateSearchTitle(q, new URLSearchParams(window.location.search).get('category')||'');
            // Filter with Fuse if available, else simple
            if(q){
                if(typeof Fuse!=='undefined' && allProductsCache.length){
                    if(!searchFuse) searchFuse=new Fuse(allProductsCache,{keys:['title','description','category'],threshold:0.4,includeScore:true});
                    var res=searchFuse.search(q);
                    filteredCache=res.map(r=>r.item);
                    // If Fuse found nothing, fallback to includes
                    if(!filteredCache.length){
                        var qq=q.toLowerCase();
                        filteredCache=allProductsCache.filter(p=>p.title.toLowerCase().includes(qq)||(p.description||'').toLowerCase().includes(qq));
                    }
                } else {
                    var qq2=q.toLowerCase();
                    filteredCache=allProductsCache.filter(p=>p.title.toLowerCase().includes(qq2)||(p.description||'').toLowerCase().includes(qq2));
                }
            } else {
                filteredCache=allProductsCache.slice();
            }
            searchCurrentPage=1;
            filteredCache=sortProducts(filteredCache, document.getElementById('sortBy')?.value||'latest');
            renderProductsPage();
        }, 300));
    });
}

// ============================================================================
// LOAD PRODUCTS
// ============================================================================


async function loadProducts(query = '', category = '') {
    if (typeof firebaseDB === 'undefined') {
        renderDemoProducts(query, category);
        return;
    }
    showSearchSkeleton();
    try {
        // Ask for as much of the catalogue as the rules allow. If the query is ever refused
        // (a rules/limit mismatch, or a transient permission hiccup), retry smaller rather
        // than showing an empty shop — "nothing found" and "could not load" are very
        // different messages for a marketplace.
        let snapshot;
        try {
            snapshot = await firebaseDB.collection('products').limit(100).get();
        } catch (e) {
            console.warn('product list refused at limit 100, retrying smaller:', e && e.message);
            try {
                snapshot = await firebaseDB.collection('products').limit(50).get();
            } catch (e2) {
                snapshot = await firebaseDB.collection('products').limit(20).get();   // last try
            }
        }
        if (snapshot.empty) { renderCatalogueEmpty(query, category); return; }
        
        let products = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.isActive !== false && data.isSold !== true) {
                if (!category || data.category === category) {
                    if (!flashOnly || smFlashActive(data)) {
                        products.push({ id: doc.id, ...data });
                    }
                }
            }
        });
        
        if (products.length === 0) {
            allProductsCache = [];
            updateConditionCounts();
            renderCatalogueEmpty(query, category);
            return;
        }
        
        // Store all for Fuse/live search
        allProductsCache = products.slice();
        if (typeof Fuse !== 'undefined') {
            searchFuse = new Fuse(allProductsCache, {keys:['title','description','category'], threshold:0.4});
        }
        
        if (query) {
            if (searchFuse) {
                const res = searchFuse.search(query);
                products = res.map(r=>r.item);
                if (!products.length) {
                    const q = query.toLowerCase();
                    products = allProductsCache.filter(p => p.title.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
                }
            } else {
                const q = query.toLowerCase();
                products = products.filter(p => p.title.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
            }
        }
        
        filteredCache = sortProducts(products, document.getElementById('sortBy')?.value||'latest');
        allProductsCache = products.slice(); // for live search, keep category-filtered set? Actually keep full
        // For pagination, filteredCache is the displayed set
        searchCurrentPage = 1;
        renderProductsPage();
        updateResultsCount(filteredCache.length);
        updateConditionCounts();
    } catch (error) {
        console.error('Error loading the catalogue:', error);
        renderCatalogueFailed(error);
    }
}

/** The catalogue loaded and really is empty (a new marketplace, or every item is sold). */
function renderCatalogueEmpty(query, category) {
    const grid = document.getElementById('productsGrid') || document.querySelector('.products-grid');
    updateResultsCount(0);
    if (!grid) return;
    grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem;">
            <i class="fas fa-box-open" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
            <h2 style="font-size:1.17em; margin:0 0 0.4rem;">No products found</h2>
            <p style="color: #5a6572; max-width: 420px; margin: 0 auto; font-size:0.9rem;">
                ${query ? 'Nothing matches “' + escapeHtmlSearch(query) + '”.' : 'No items are listed yet.'}
                ${category ? ' Try another category,' : ''} or be the first to
                <a class="cta-inline" href="publish.html" style="color: var(--primary-color); font-weight:700;">list something!</a>
            </p>
        </div>`;
}

/** The catalogue could NOT be loaded — say so, and offer a retry. */
function renderCatalogueFailed(error) {
    const grid = document.getElementById('productsGrid') || document.querySelector('.products-grid');
    const msg = (error && error.message) || String(error || '');
    const signIn = /permission|insufficient/i.test(msg);
    if (grid) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem;">
                <i class="fas fa-triangle-exclamation" style="font-size: 2.6rem; color: #f59e0b; margin-bottom: 0.8rem;"></i>
                <h2 style="font-size:1.17em; margin:0 0 0.4rem;">We couldn't load the listings</h2>
                <p style="color: #5a6572; max-width: 460px; margin: 0 auto 1rem; font-size:0.9rem;">
                    ${signIn
                        ? 'This usually means the page needs you to sign in again — or our servers refused the request. Your listings are safe.'
                        : 'Something went wrong reaching the catalogue. Please try again.'}
                </p>
                <div style="display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
                    <button onclick="loadProducts('', '')" style="background:#0064d2;color:#fff;border:none;border-radius:10px;padding:0.7rem 1.1rem;font-weight:800;cursor:pointer;min-height:44px;">
                        <i class="fas fa-rotate"></i> Try again
                    </button>
                    ${signIn ? '<a href="/pages/auth/login.html?redirect=' + encodeURIComponent('search.html') + '" style="background:#fff;border:1.5px solid #cfe1f7;color:#0064d2;border-radius:10px;padding:0.7rem 1.1rem;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;min-height:44px;">Sign in</a>' : ''}
                </div>
                <p style="font-size:0.75rem;color:#7a8697;margin-top:0.8rem;">Still stuck? Email sankofamarketgh@gmail.com</p>
            </div>`;
    }
    // make the failure visible to the watchdog log too, not just the console
    try { (window.__smErrors = window.__smErrors || []).push({ at: new Date().toISOString(), kind: 'catalogue', message: 'search list failed: ' + msg.slice(0, 160) }); } catch (e) {}
}

// ============================================================================
// APPLY FILTERS
// ============================================================================

function applyFilters(closeDrawerAfter) {
    const category = document.getElementById('filterCategory').value;
    const priceMin = document.getElementById('priceMin').value;
    const priceMax = document.getElementById('priceMax').value;
    const location = document.getElementById('filterLocation').value;
    const sortBy = document.getElementById('sortBy').value;
    const sellerType = document.querySelector('.seller-filter:checked')?.value || '';
    const conditions = Array.from(document.querySelectorAll('.condition-filter:checked')).map(c => c.value);
    const deliveryOptions = Array.from(document.querySelectorAll('.delivery-filter:checked')).map(c => c.value);
    
    // If we have real products, filter allProductsCache directly with pagination
    if (allProductsCache.length) {
        let filtered = allProductsCache.slice();
        if (flashOnly) filtered = filtered.filter(p => !!smFlashActive(p));
        if (category) filtered = filtered.filter(p => p.category === category);
        if (priceMin) filtered = filtered.filter(p => p.price >= parseFloat(priceMin));
        if (priceMax) filtered = filtered.filter(p => p.price <= parseFloat(priceMax));
        if (conditions.length) filtered = filtered.filter(p => conditions.includes(p.condition));
        // Location: old listings nest it (location.city), newer ones carry flat city/region,
        // and sellers type freely ("Odorkor, Accra") — so look in every spelling, loosely.
        if (location) {
            const needle = location.toLowerCase();
            filtered = filtered.filter(p => [p.location && p.location.city, p.city, p.region, p.location && p.location.region]
                .filter(Boolean).join(' ').toLowerCase().includes(needle));
        }
        if (sellerType === 'sankofa-store') filtered = filtered.filter(p => p.isSankofaStore);
        else if (sellerType === 'verified') filtered = filtered.filter(p => p.isVerifiedSeller);
        else if (sellerType === 'individual') filtered = filtered.filter(p => !p.isSankofaStore && !p.isVerifiedSeller);
        // Delivery: listings written by the current form use the SINGULAR deliveryOption;
        // older ones stored a deliveryOptions array. Honour both.
        const hasDelivery = (p, o) => p.deliveryOption === o || (Array.isArray(p.deliveryOptions) && p.deliveryOptions.includes(o));
        if (deliveryOptions.length) filtered = filtered.filter(p => deliveryOptions.some(o => hasDelivery(p, o)));
        filteredCache = sortProducts(filtered, sortBy);
        searchCurrentPage = 1;
        renderProductsPage();
        updateResultsCount(filteredCache.length);
        updateActiveFilters(category, priceMin, priceMax, conditions, location, sellerType, deliveryOptions);
        if (closeDrawerAfter) tryCloseMobileFilters();
        return;
    }
    applyDemoFilters(category, priceMin, priceMax, conditions, location, sellerType, sortBy, deliveryOptions);
    updateActiveFilters(category, priceMin, priceMax, conditions, location, sellerType, deliveryOptions);
    if (closeDrawerAfter) tryCloseMobileFilters();
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
    // Premium tiered boost: diamond 10x > gold 6x > silver 4x > bronze 2x.
    // The boost TIER decides which group comes first (that is what sellers pay
    // for) — but the shopper's chosen sort must order items WITHIN a tier.
    // The old boostedAt tie-break fired for every pair of boosted products and
    // silently swallowed the chosen sort, so in a shop where most items are
    // boosted, "Price: Low → High" changed nothing. boostedAt now only breaks
    // ties inside the default "latest" view.
    function boostTier(p){ return p.boostLevel || (p.isBoosted ? 2 : 0); }
    function boostMs(p){ return p.boostedAt ? (p.boostedAt.toDate ? p.boostedAt.toDate().getTime() : new Date(p.boostedAt).getTime() || 0) : 0; }
    function createdMs(p){ var c = p.createdAt; if (!c) return 0; return c.toDate ? c.toDate().getTime() : (new Date(c).getTime() || 0); }
    function boostedFirst(a,b){
        var al = boostTier(a), bl = boostTier(b);
        if (bl !== al) return bl - al;
        if (sortBy === 'latest' && al && bl) {
            var bt = boostMs(b) - boostMs(a);
            if (bt !== 0) return bt;
        }
        return 0;
    }
    switch (sortBy) {
        case 'price-low': return products.sort((a, b) => boostedFirst(a,b) || a.price - b.price || createdMs(b) - createdMs(a));
        case 'price-high': return products.sort((a, b) => boostedFirst(a,b) || b.price - a.price || createdMs(b) - createdMs(a));
        case 'rating': return products.sort((a, b) => boostedFirst(a,b) || (Number(b.averageRating||b.rating||0)) - (Number(a.averageRating||a.rating||0)) || createdMs(b) - createdMs(a));
        default: return products.sort((a, b) => {
            var r = boostedFirst(a,b);
            if (r!==0) return r;
            // Flash mode's default order is "ending soonest first" — urgency, not newness.
            if (flashOnly) return smFlashEndMs(a) - smFlashEndMs(b);
            const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return tB - tA;
        });
    }
}

// ============================================================================
// PREMIUM SELLER BADGE — the gold "✓ PREMIUM" / purple "◆ DIAMOND" the pricing
// page promises paid tiers. Source: the public sellerPublic/{uid} mirror
// (functions-only mirror of users/{id}; premiumExpiry lives in the doc so a
// lapsed plan stops rendering the moment it ends — no scheduler needed).
// ============================================================================

/* ===== FLASH SALE (Gold+ perk) — card ribbon + sale price ===== */
function smFlashCss() {
    if (document.getElementById('smFlashCss')) return;
    var s = document.createElement('style');
    s.id = 'smFlashCss';
    s.textContent = '.sm-flash-ribbon{position:absolute;top:8px;right:8px;background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);color:#fff;font-size:0.62rem;font-weight:800;letter-spacing:0.4px;padding:0.22rem 0.5rem;border-radius:999px;box-shadow:0 2px 8px rgba(220,38,38,0.45);z-index:3;white-space:nowrap;}' +
        '.sm-flash-ribbon i{font-size:0.58rem;}' +
        '.sm-flash-was{font-size:0.72rem;color:#9aa5b1;font-weight:400;margin-left:0.3rem;}' +
        '.product-price .sm-flash-now{color:#dc2626;}';
    document.head.appendChild(s);
}
function smFlashActive(p) {
    var f = p && p.flashSale;
    if (!f || !f.endsAt) return null;
    var end = f.endsAt.toDate ? f.endsAt.toDate() : new Date(f.endsAt);
    var pct = Number(f.percent || 0);
    if (!(pct >= 1) || !(end > new Date())) return null;
    var base = Number(p.price || 0);
    return { percent: pct, endsAt: end, price: Math.round(base * (1 - pct / 100) * 100) / 100 };
}
function smFlashRibbonHtml(p) {
    var fl = smFlashActive(p);
    return fl ? '<span class="sm-flash-ribbon"><i class="fas fa-bolt"></i> FLASH -' + fl.percent + '%</span>' : '';
}
function smFlashPriceHtml(p) {
    var fl = smFlashActive(p);
    var base = Number(p.price || 0);
    if (!fl) return 'GHS ' + base.toLocaleString();
    return '<span class="sm-flash-now">GHS ' + fl.price.toLocaleString() + '</span><s class="sm-flash-was">GHS ' + base.toLocaleString() + '</s>';
}
smFlashCss();
var _premCache = {};   // uid -> {tier, ends} | null   (session cache, misses remembered)

function smPremBadgeCss() {
    if (document.getElementById('smPremBadgeCss')) return;
    var s = document.createElement('style');
    s.id = 'smPremBadgeCss';
    s.textContent = '.sm-prem-badge{display:inline-flex;align-items:center;gap:0.2rem;font-size:0.58rem;font-weight:800;letter-spacing:0.4px;padding:0.1rem 0.42rem;border-radius:999px;margin-left:0.3rem;vertical-align:middle;line-height:1.5;}' +
        '.sm-prem-badge.gold{background:#f5af02;color:#191919;}' +
        '.sm-prem-badge.diamond{background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;}';
    document.head.appendChild(s);
}
function smPremiumActive(rec) { return rec && (rec.ends || 0) > Date.now() ? rec.tier : null; }
function smPremBadgeHtml(tier) {
    if (tier === 'diamond') return '<span class="sm-prem-badge diamond"><i class="fas fa-gem"></i> DIAMOND</span>';
    return '<span class="sm-prem-badge gold"><i class="fas fa-check-circle"></i> PREMIUM</span>';
}
function smPaintPremiumBadges(container) {
    container.querySelectorAll('.premSlot[data-sid]').forEach(function (s) {
        var tier = smPremiumActive(_premCache[s.getAttribute('data-sid')]);
        s.innerHTML = tier ? smPremBadgeHtml(tier) : '';
    });
}
function smInjectPremiumBadges(container) {
    if (!container || typeof firebaseDB === 'undefined' || !firebaseDB) return;
    var slots = container.querySelectorAll('.premSlot[data-sid]');
    if (!slots.length) return;
    var need = [];
    slots.forEach(function (s) {
        var sid = s.getAttribute('data-sid');
        if (sid && _premCache[sid] === undefined && need.indexOf(sid) === -1) need.push(sid);
    });
    if (!need.length) { smPaintPremiumBadges(container); return; }
    var FP = firebase.firestore.FieldPath.documentId();
    var chunks = [];
    for (var i = 0; i < need.length; i += 10) chunks.push(need.slice(i, i + 10));
    Promise.all(chunks.map(function (c) { return firebaseDB.collection('sellerPublic').where(FP, 'in', c).get(); }))
        .then(function (snaps) {
            snaps.forEach(function (snap) {
                snap.forEach(function (d) {
                    var x = d.data() || {};
                    _premCache[d.id] = { tier: String(x.tier || 'gold').toLowerCase(), ends: x.premiumExpiry && x.premiumExpiry.toMillis ? x.premiumExpiry.toMillis() : 0 };
                });
            });
            need.forEach(function (sid) { if (_premCache[sid] === undefined) _premCache[sid] = null; });
            smPaintPremiumBadges(container);
        }).catch(function () {});
}
smPremBadgeCss();

// ============================================================================
// RENDER PRODUCTS
// ============================================================================

function renderProducts(products) {
    const container = document.getElementById('searchResults');
    
    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h2 style="font-size:1.17em;">No products found</h2>
                <p>Try adjusting your filters or search for something else</p>
                <button class="btn btn-primary" onclick="resetFilters()"><i class="fas fa-redo"></i> Reset Filters</button>
            </div>`;
        updateResultsCount(0);
        return;
    }
    
    container.innerHTML = products.map(p => {
        const img = (typeof productThumb === 'function') ? productThumb(p) : ((p.images || p.photos || [])[0] || '/images/placeholders/product.svg');
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
        <a href="product-detail.html?id=${encodeURIComponent(p.id)}" class="product-card ${isSS ? 'sankofa-store' : ''}" data-pid="${escapeHtmlSearch(p.id)}">
            <div class="product-image-wrapper">
                <img src="${img}" data-alt-src="${(typeof productFull==='function')?productFull(p):img}" onerror="smImgFallback(this)" alt="${p.title}" class="product-image" loading="lazy" decoding="async">
                ${p.isBoosted ? '<span class="product-badge" style="background:linear-gradient(135deg,#f5af02 0%,#e09e00 100%); color:#191919;"><i class="fas fa-rocket"></i> Boosted</span>' : (p.isFeatured ? '<span class="product-badge">Featured</span>' : '')}
                ${isSS ? '<span class="sankofa-store-badge"><i class="fas fa-store"></i> Official</span>' : ''}${p.preOrder ? ' <span class="preorder-badge" title="Pre-order — pay now, ships when stock lands (escrow protected)"><i class="fas fa-clock"></i> Pre-order</span>' : ''}
                ${smFlashRibbonHtml(p)}
            </div>
            <div class="product-content">
                ${condLabel ? `<span class="condition-badge ${condClass}">${condLabel}</span>` : ''}
                <div class="product-title">${escapeHtmlSearch(p.title)}</div>
                <div class="product-price">${smFlashPriceHtml(p)}</div>
                ${deliveryBadges.length > 0 ? `<div class="delivery-badges">${deliveryBadges.join('')}</div>` : ''}
                <div class="product-meta">
                    <span><i class="fas fa-map-marker-alt"></i> ${escapeHtmlSearch(p.location?.city || 'Ghana')}</span>
                    <span><i class="fas fa-clock"></i> ${time}</span>
                </div>
                ${p.sellerName ? `<div class="product-seller">
                    <img src="${escapeHtmlSearch(p.sellerPhoto || '/images/placeholders/avatar.svg')}" alt="${escapeHtmlSearch(p.sellerName)}" loading="lazy" decoding="async">
                    <span class="seller-name">${escapeHtmlSearch(p.sellerName)}</span>
                    ${isV || isSS ? '<i class="fas fa-check-circle verified-icon"></i>' : ''}${p.sellerId ? `<span class="premSlot" data-sid="${escapeHtmlSearch(p.sellerId)}"></span>` : ''}
                </div>` : ''}
            </div>
        </a>`;
    }).join('');

    smInjectPremiumBadges(container);
    updateResultsCount(products.length);
}

// ============================================================================
// DEMO PRODUCTS (with real Unsplash images)
// ============================================================================

const DEMO_PRODUCTS = [];

function renderDemoProducts(query = '', category = '') {
    renderProducts([]);
    const grid = document.getElementById('productsGrid') || document.querySelector('.products-grid');
    if (grid) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem;">
                <i class="fas fa-search" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <h2 style="font-size:1.17em;">No products found</h2>
                <p style="color: #5a6572; max-width: 400px; margin: 0.5rem auto;">Products from sellers will appear here. Be the first to <a class="cta-inline" href="publish.html" style="color: var(--primary-color);">list something!</a></p>
            </div>
        `;
    }
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

function escapeHtmlSearch(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
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
    // Short date (e.g. "27 Sep") — the numeric form was too cramped beside the city on phone cards
    if (typeof window.SankofaMarket !== 'undefined' && window.SankofaMarket.formatShortDate) {
        return window.SankofaMarket.formatShortDate(date);
    }
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}


// ============================================================================
// LOAD CUSTOM CATEGORIES FROM FIRESTORE
// ============================================================================

function loadCustomCategories() {
    var select = document.getElementById('filterCategory');
    if (!select) return;

    // Built-in category IDs
    var builtInIds = ['electronics','fashion','home-garden','vehicles','services','sports','books-media','baby-kids','beauty-health','food-groceries','pets','jobs-skills','real-estate','sankofa-store',''];

    if (typeof firebaseDB === 'undefined' || firebaseDB === null) return;

    firebaseDB.collection('categories').get().then(function(snapshot) {
        var customCategories = [];
        var editedBuiltIns = {};

        snapshot.forEach(function(doc) {
            var data = doc.data();
            if (data.isActive === false) return;

            if (builtInIds.indexOf(doc.id) >= 0) {
                // Track edits to built-in categories
                if (data.name) editedBuiltIns[doc.id] = data.name;
            } else {
                // New custom category
                customCategories.push({ id: doc.id, name: data.name || doc.id });
            }
        });

        // Update built-in option labels if edited
        Array.from(select.options).forEach(function(opt) {
            if (editedBuiltIns[opt.value]) {
                opt.textContent = editedBuiltIns[opt.value];
            }
        });

        // Append custom categories
        if (customCategories.length > 0) {
            var optgroup = document.createElement('optgroup');
            optgroup.label = 'More Categories';
            customCategories.forEach(function(cat) {
                var opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                optgroup.appendChild(opt);
            });
            select.appendChild(optgroup);
        }
    }).catch(function(err) {
        console.warn('Could not load custom categories:', err);
    });
}

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled "classic" <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.logSearchQuery = logSearchQuery;
window.getCurrentUserId = getCurrentUserId;
window.updateSearchTitle = updateSearchTitle;
window.initMobileFilters = initMobileFilters;
window.initViewToggle = initViewToggle;
window.setView = setView;
window.toggleFilterGroup = toggleFilterGroup;
window.debounce = debounce;
window.showSearchSkeleton = showSearchSkeleton;
window.renderSearchPagination = renderSearchPagination;
window.goToSearchPage = goToSearchPage;
window.renderProductsPage = renderProductsPage;
window.initLiveSearch = initLiveSearch;
window.loadProducts = loadProducts;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.updateActiveFilters = updateActiveFilters;
window.removeFilter = removeFilter;
window.updateResultsCount = updateResultsCount;
window.sortProducts = sortProducts;
window.renderProducts = renderProducts;
window.renderDemoProducts = renderDemoProducts;
window.applyDemoFilters = applyDemoFilters;
window.escapeHtmlSearch = escapeHtmlSearch;
window.formatCurr = formatCurr;
window.formatRelTime = formatRelTime;
window.loadCustomCategories = loadCustomCategories;

