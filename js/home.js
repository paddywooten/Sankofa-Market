/**
 * Sankofa Market - Home Page JavaScript
 * Load featured products, recent products, and categories
 */

// ============================================================================
// PREMIUM SELLER BADGE — gold "✓ PREMIUM" / purple "◆ DIAMOND" pill next to
// the seller's name, promised to paid tiers on the pricing page. Reads the
// public sellerPublic/{uid} mirror (written by a cloud function; premiumExpiry
// is checked at render time, so lapsed plans stop showing immediately).
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
var _premCache = {};   // uid -> {tier, ends} | null

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
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Home Page Loaded');
    
    // Wait for Firebase to be ready before loading data
    waitForFirebase().then(function() {
        // Load data
        loadCategories();
        loadFlashDeals();
        loadFeaturedProducts();
        loadRecentProducts();
        initFollowingSection();
    });
});

/* ============================================================================
   NEW FROM SELLERS YOU FOLLOW
   Shoppers follow sellers from any product page. This rail is their reward:
   the newest listings from those sellers, right at the top of the homepage —
   not replacing the main sections (a brand-new user who follows nobody must
   still see a full homepage).
   ========================================================================== */
function initFollowingSection() {
    try {
        if (typeof firebase === 'undefined' || !firebase.auth) return;
        firebase.auth().onAuthStateChanged(function (user) {
            if (!user) return;
            if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
            firebaseDB.collection('follows').where('followerId', '==', user.uid).limit(30).get()
                .then(function (snap) {
                    if (snap.empty) return;
                    var ids = [];
                    snap.forEach(function (d) {
                        var s = d.data().sellerId;
                        if (s && ids.indexOf(s) === -1) ids.push(s);
                    });
                    if (ids.length) loadFollowedProducts(ids);
                })
                .catch(function () {});
        });
    } catch (e) {}
}

function loadFollowedProducts(sellerIds) {
    var chunks = [];
    for (var i = 0; i < sellerIds.length; i += 10) chunks.push(sellerIds.slice(i, i + 10));   // 'in' takes 10 max
    Promise.all(chunks.map(function (c) {
        return firebaseDB.collection('products').where('sellerId', 'in', c).limit(20).get();
    })).then(function (snaps) {
        var items = [];
        snaps.forEach(function (s) {
            s.forEach(function (d) {
                var p = d.data();
                p._docId = d.id;
                if (!p.id) p.id = d.id;
                if (!p.isSold && p.isActive !== false) items.push(p);
            });
        });
        items.sort(function (a, b) {
            var at = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
            var bt = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
            return bt - at;
        });
        items = items.slice(0, 10);
        if (!items.length) return;
        var rail = document.getElementById('followingRail');
        var section = document.getElementById('followingSection');
        if (!rail || !section) return;
        rail.innerHTML = items.map(function (p) {
            return '<div style="min-width:175px;max-width:175px;scroll-snap-align:start;flex-shrink:0;">' + followingCardHtml(p) + '</div>';
        }).join('');
        smInjectPremiumBadges(rail);
        section.style.display = 'block';
        if (typeof markSavedCards === 'function') markSavedCards();   // keep the ❤ Saved pills working here too
    }).catch(function () {});
}

function followingCardHtml(p) {
    var imgs = p.images || p.photos || [];
    var img = (typeof productThumb === 'function') ? productThumb(p) : (imgs[0] || '/images/placeholders/product.svg');
    var full = (typeof productFull === 'function') ? productFull(p) : img;
    var seller = p.sellerName || (p.isSankofaStore ? 'Sankofa Store' : 'Seller');
    return '' +
        '<a href="product-detail.html?id=' + escapeCardText(p._docId || p.id) + '" class="product-card" data-pid="' + escapeCardText(p._docId || p.id) + '" style="display:block;">' +
            '<div class="product-image-wrapper">' +
                '<img src="' + escapeCardText(img) + '" data-alt-src="' + escapeCardText(full) + '" onerror="smImgFallback(this)" alt="' + escapeCardText(p.title) + '" class="product-image" loading="lazy" decoding="async">' +
                (p.isSankofaStore ? '<span class="sankofa-store-badge"><i class="fas fa-store"></i> Official</span>' : '') +
            (p.preOrder ? ' <span class="preorder-badge" title="Pre-order — pay now, ships when stock lands (escrow protected)"><i class="fas fa-clock"></i> Pre-order</span>' : '') +
                smFlashRibbonHtml(p) +
            '</div>' +
            '<div class="product-content">' +
                '<div class="product-title">' + escapeCardText(p.title) + '</div>' +
                '<div class="product-price">' + smFlashPriceHtml(p) + '</div>' +
                (Number(p.reviewCount || 0) > 0 && Number(p.averageRating || 0) > 0
                    ? '<div class="product-rating" style="font-size:0.78rem;color:#5a6572;"><span style="color:#f5af02;">★</span> <strong style="color:#191919;">' + Number(p.averageRating).toFixed(1) + '</strong> (' + Number(p.reviewCount) + ')</div>'
                    : '') +
                '<div class="product-meta"><span style="font-size:0.75rem;color:#5a6572;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeCardText(seller) + '</span>' + (p.sellerId ? '<span class="premSlot" data-sid="' + escapeCardText(p.sellerId) + '"></span>' : '') + '</div>' +
            '</div>' +
        '</a>';
}

/* ============================================================================
   FLASH DEALS RAIL — every live flash sale, ending soonest first.
   Flash sales are a Gold/Diamond seller perk; this rail is the buyer's side of
   that promise — one strip near the top of the homepage collecting every deal
   that is still ticking, so shoppers have a reason to come back every day.
   The section stays hidden when nothing is on flash (no placeholder cards).
   Expiry is checked at render time, countdowns tick every second, and a card
   removes itself the moment its sale ends. Deliberately NO 5-min browser
   cache here: flash deals are time-sensitive, a stale deal is a lie.
   ========================================================================== */
var _flashTimer = null;

function flashEndMs(p) {
    var f = p && p.flashSale;
    if (!f || !f.endsAt) return 0;
    var d = f.endsAt.toDate ? f.endsAt.toDate() : new Date(f.endsAt);
    return d.getTime ? d.getTime() : 0;
}

/* "2h 14m" for long ones, "44m 7s" under an hour, "59s" under a minute —
   the closer to the end, the more urgent the ticking. */
function flashCountdownText(endMs) {
    var left = Math.max(0, endMs - Date.now());
    var s = Math.floor(left / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + sec + 's';
    return sec + 's';
}

function flashCardHtml(p) {
    var id = p._docId || p.id;
    var imgs = p.images || p.photos || [];
    var img = (typeof productThumb === 'function') ? productThumb(p) : (imgs[0] || '/images/placeholders/product.svg');
    var full = (typeof productFull === 'function') ? productFull(p) : img;
    var seller = p.sellerName || (p.isSankofaStore ? 'Sankofa Store' : 'Seller');
    var end = flashEndMs(p);
    return '' +
        '<a href="product-detail.html?id=' + escapeCardText(id) + '" class="product-card flash-card" data-pid="' + escapeCardText(id) + '" data-flash-end="' + end + '" style="display:block;">' +
            '<div class="product-image-wrapper">' +
                '<img src="' + escapeCardText(img) + '" data-alt-src="' + escapeCardText(full) + '" onerror="smImgFallback(this)" alt="' + escapeCardText(p.title) + '" class="product-image" loading="lazy" decoding="async">' +
                (p.isSankofaStore ? '<span class="sankofa-store-badge"><i class="fas fa-store"></i> Official</span>' : '') +
            (p.preOrder ? ' <span class="preorder-badge" title="Pre-order — pay now, ships when stock lands (escrow protected)"><i class="fas fa-clock"></i> Pre-order</span>' : '') +
                smFlashRibbonHtml(p) +
            '</div>' +
            '<div class="product-content">' +
                '<div class="product-title">' + escapeCardText(p.title) + '</div>' +
                '<div class="product-price">' + smFlashPriceHtml(p) + '</div>' +
                '<div class="flash-count" style="font-size:0.74rem;font-weight:800;color:#dc2626;white-space:nowrap;"><i class="far fa-clock"></i> Ends in ' + flashCountdownText(end) + '</div>' +
                '<div class="product-meta"><span style="font-size:0.75rem;color:#5a6572;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeCardText(seller) + '</span>' + (p.sellerId ? '<span class="premSlot" data-sid="' + escapeCardText(p.sellerId) + '"></span>' : '') + '</div>' +
            '</div>' +
        '</a>';
}

/* One shared 1s ticker drives every countdown on the rail. A card whose sale
   has just expired disappears on the spot; when the last card goes, the whole
   section hides itself and the ticker stops. */
function tickFlashCountdowns() {
    var rail = document.getElementById('flashRail');
    if (!rail) return;
    rail.querySelectorAll('.flash-card').forEach(function (card) {
        var end = Number(card.getAttribute('data-flash-end') || 0);
        var el = card.querySelector('.flash-count');
        if (!(end > Date.now())) { card.remove(); return; }
        if (el) el.innerHTML = '<i class="far fa-clock"></i> Ends in ' + flashCountdownText(end);
    });
    if (!rail.querySelector('.flash-card')) {
        var section = document.getElementById('flashSection');
        if (section) section.style.display = 'none';
        if (_flashTimer) { clearInterval(_flashTimer); _flashTimer = null; }
    }
}

async function loadFlashDeals() {
    try {
        if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
        var now = firebase.firestore.Timestamp.now();
        var items = [];
        try {
            // Server-ordered by end time ("ending soonest first") — the expiry check
            // also happens at the database, so dead sales never reach the browser.
            var snap = await firebaseDB.collection('products')
                .where('flashSale.endsAt', '>', now)
                .orderBy('flashSale.endsAt', 'asc')
                .limit(24)
                .get();
            snap.forEach(function (d) {
                var p = d.data(); p._docId = d.id; if (!p.id) p.id = d.id;
                if (p.isActive !== false && p.isSold !== true && smFlashActive(p)) items.push(p);
            });
        } catch (qerr) {
            // Fallback (e.g. index still building): pull anything carrying a flash-sale
            // map and do the sorting + expiry filtering here instead.
            console.warn('flash rail: ordered query failed, falling back:', qerr && qerr.message);
            items = [];
            var snap2 = await firebaseDB.collection('products')
                .where('flashSale.percent', '>', 0)
                .limit(50)
                .get();
            snap2.forEach(function (d) {
                var p = d.data(); p._docId = d.id; if (!p.id) p.id = d.id;
                if (p.isActive !== false && p.isSold !== true && smFlashActive(p)) items.push(p);
            });
            items.sort(function (a, b) { return flashEndMs(a) - flashEndMs(b); });
            items = items.slice(0, 24);
        }
        if (!items.length) return;   // nothing on flash right now — rail stays hidden
        var rail = document.getElementById('flashRail');
        var section = document.getElementById('flashSection');
        if (!rail || !section) return;
        rail.innerHTML = items.map(function (p) {
            return '<div style="min-width:175px;max-width:175px;scroll-snap-align:start;flex-shrink:0;">' + flashCardHtml(p) + '</div>';
        }).join('');
        smInjectPremiumBadges(rail);
        section.style.display = 'block';
        if (typeof markSavedCards === 'function') markSavedCards();   // keep ❤ Saved pills working here too
        if (_flashTimer) clearInterval(_flashTimer);
        _flashTimer = setInterval(tickFlashCountdowns, 1000);
    } catch (e) {
        console.warn('flash rail: load failed:', e && e.message);
    }
}

/**
 * Wait for Firebase to be fully initialized
 * This prevents race conditions where Firestore queries run before Firebase is ready
 */
function waitForFirebase() {
    return new Promise(function(resolve) {
        var maxAttempts = 50; // 5 seconds max (50 * 100ms)
        var attempts = 0;
        
        var checkInterval = setInterval(function() {
            attempts++;
            
            // Check if Firebase and Firestore are ready
            if (typeof firebase !== 'undefined' && 
                typeof firebaseDB !== 'undefined' && 
                firebaseDB !== null) {
                clearInterval(checkInterval);
                console.log('✅ Firebase ready after ' + attempts + ' checks');
                resolve();
            } else if (attempts >= maxAttempts) {
                // Timeout - proceed anyway (will show demo products)
                clearInterval(checkInterval);
                console.warn('⚠️ Firebase not ready after ' + maxAttempts + ' attempts, proceeding anyway');
                resolve();
            }
        }, 100); // Check every 100ms
    });
}

// 5-min browser cache for instant loads — home feels instant on 2nd visit
function getCached(key, maxAgeMs){
    try{
        const raw=localStorage.getItem(key);
        if(!raw) return null;
        const p=JSON.parse(raw);
        if(Date.now()-p.ts > maxAgeMs){ localStorage.removeItem(key); return null; }
        return p.data;
    }catch(e){ return null; }
}
function setCached(key, data){
    try{ localStorage.setItem(key, JSON.stringify({ts:Date.now(), data})); }catch(e){}
}

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
        { id: 'real-estate', name: 'Real Estate', icon: 'fas fa-building', color: '#607d8b' },
        { id: 'musical-instruments', name: 'Musical Instruments', icon: 'fas fa-guitar', color: '#d35400' },
        { id: 'others', name: 'Others', icon: 'fas fa-tag', color: '#95a5a6' }
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
            <div class="category-name">${escapeHomeText(category.name)}</div>
        </a>
    `).join('');
}

// ============================================================================
// LOAD FEATURED PRODUCTS
// ============================================================================

async function loadFeaturedProducts() {
    // Instant from browser cache (5 min) — no reload needed
    try{
        const cached = getCached('sankofa_featured_v1', 5*60*1000);
        if(cached && Array.isArray(cached) && cached.length){
            console.log('⚡ Featured from cache ('+cached.length+')');
            renderProducts('featuredProducts', cached.slice(0,8));
        }
    }catch(e){}
    try {
        if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
            console.warn('⚠️ firebaseDB not available for featured products');
            // if no cache, show demo
            const cc = getCached('sankofa_featured_v1', 5*60*1000);
            if(!cc) renderDemoProducts('featuredProducts', 'featured');
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
        
        // Premium boosted first
        products.sort(function(a,b){ var al = a.boostLevel || (a.isBoosted?2:0); var bl = b.boostLevel || (b.isBoosted?2:0); if (bl!==al) return bl-al; var at = a.boostedAt ? (a.boostedAt.toMillis ? a.boostedAt.toMillis() : new Date(a.boostedAt).getTime()) : 0; var bt = b.boostedAt ? (b.boostedAt.toMillis ? b.boostedAt.toMillis() : new Date(b.boostedAt).getTime()) : 0; if (bt!==at) return bt-at; return 0; });
        setCached('sankofa_featured_v1', products);
        renderProducts('featuredProducts', products.slice(0, 8));
    } catch (error) {
        console.error('Error loading featured products:', error);
        
        // Retry once after a short delay if it's a network error
        if (isNetworkError(error)) {
            console.log('🔄 Retrying featured products load...');
            await new Promise(r => setTimeout(r, 1000));
            try {
                const retrySnapshot = await firebaseDB.collection('products')
                    .where('isFeatured', '==', true)
                    .limit(12)
                    .get();
                
                if (!retrySnapshot.empty) {
                    const products = [];
                    retrySnapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.isActive !== false && data.isSold !== true) {
                            products.push({ id: doc.id, ...data });
                        }
                    });
                    if (products.length > 0) {
                        renderProducts('featuredProducts', products.slice(0, 8));
                        return;
                    }
                }
            } catch (retryErr) {
                console.error('Retry failed:', retryErr);
            }
        }
        
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
    try{
        const cachedR = getCached('sankofa_recent_v1', 5*60*1000);
        if(cachedR && Array.isArray(cachedR) && cachedR.length){
            console.log('⚡ Recent from cache ('+cachedR.length+')');
            renderProducts('recentProducts', cachedR.slice(0,8));
        }
    }catch(e){}
    try {
        if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
            console.warn('⚠️ firebaseDB not available, showing empty state');
            const cc2 = getCached('sankofa_recent_v1', 5*60*1000);
            if(!cc2) renderDemoProducts('recentProducts', 'recent');
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
        // Premium boosted first
        products.sort(function(a,b){ var al = a.boostLevel || (a.isBoosted?2:0); var bl = b.boostLevel || (b.isBoosted?2:0); if (bl!==al) return bl-al; var at = a.boostedAt ? (a.boostedAt.toMillis ? a.boostedAt.toMillis() : new Date(a.boostedAt).getTime()) : 0; var bt = b.boostedAt ? (b.boostedAt.toMillis ? b.boostedAt.toMillis() : new Date(b.boostedAt).getTime()) : 0; if (bt!==at) return bt-at; return 0; });
        setCached('sankofa_recent_v1', products);
        renderProducts('recentProducts', products.slice(0, 8));
    } catch (error) {
        console.error('Error loading recent products:', error);
        
        // Retry once after a short delay if it's a network error
        if (isNetworkError(error)) {
            console.log('🔄 Retrying recent products load...');
            await new Promise(r => setTimeout(r, 1000));
            try {
                const retrySnapshot = await firebaseDB.collection('products')
                    .orderBy('createdAt', 'desc')
                    .limit(20)
                    .get();
                
                if (!retrySnapshot.empty) {
                    const products = [];
                    retrySnapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.isActive !== false && data.isSold !== true) {
                            products.push({ id: doc.id, ...data });
                        }
                    });
                    if (products.length > 0) {
                        console.log('✅ Loaded ' + products.length + ' products on retry');
                        // Premium boosted first
        products.sort(function(a,b){ var al = a.boostLevel || (a.isBoosted?2:0); var bl = b.boostLevel || (b.isBoosted?2:0); if (bl!==al) return bl-al; var at = a.boostedAt ? (a.boostedAt.toMillis ? a.boostedAt.toMillis() : new Date(a.boostedAt).getTime()) : 0; var bt = b.boostedAt ? (b.boostedAt.toMillis ? b.boostedAt.toMillis() : new Date(b.boostedAt).getTime()) : 0; if (bt!==at) return bt-at; return 0; });
        renderProducts('recentProducts', products.slice(0, 8));
                        return;
                    }
                }
            } catch (retryErr) {
                console.error('Retry failed:', retryErr);
            }
        }
        
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
                    console.log('✅ Loaded ' + products.length + ' products (fallback)');
                    // Premium boosted first
        products.sort(function(a,b){ var al = a.boostLevel || (a.isBoosted?2:0); var bl = b.boostLevel || (b.isBoosted?2:0); if (bl!==al) return bl-al; var at = a.boostedAt ? (a.boostedAt.toMillis ? a.boostedAt.toMillis() : new Date(a.boostedAt).getTime()) : 0; var bt = b.boostedAt ? (b.boostedAt.toMillis ? b.boostedAt.toMillis() : new Date(b.boostedAt).getTime()) : 0; if (bt!==at) return bt-at; return 0; });
        renderProducts('recentProducts', products.slice(0, 8));
                    return;
                }
            }
        } catch(e) {}
        renderDemoProducts('recentProducts', 'recent');
    }
}

/**
 * Check if an error is a network/connectivity error
 */
function isNetworkError(error) {
    if (!error) return false;
    var msg = (error.message || '').toLowerCase();
    return msg.includes('offline') ||
           msg.includes('unavailable') ||
           msg.includes('network') ||
           msg.includes('timeout') ||
           msg.includes('failed to fetch') ||
           msg.includes('deadline exceeded') ||
           (error.code && (error.code === 'unavailable' || error.code === 'deadline-exceeded'));
}

// ============================================================================
// RENDER PRODUCTS
// ============================================================================

function escapeHomeText(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Seller-provided location, escaped for safe HTML insertion. */
function productLocationLabel(product) {
    var loc = (product && product.location && product.location.city) || (product && product.location) || 'Ghana';
    if (typeof loc === 'object') loc = 'Ghana';
    return escapeHomeText(loc);
}

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
        // Small preview version — keeps the homepage light (see js/main.js)
        const productImages = product.images || product.photos || [];
        const previewUrl = (typeof productThumb === 'function')
            ? productThumb(product)
            : (productImages.length > 0 ? productImages[0] : '/images/placeholders/product.svg');
        const fullUrl = (typeof productFull === 'function') ? productFull(product) : previewUrl;
        
        const relativeTime = product.createdAt 
            ? formatRelativeTime(product.createdAt.toDate ? product.createdAt.toDate() : new Date(product.createdAt))
            : 'Recently';
        
        const boostedBadge = product.isBoosted
            ? '<span class="product-badge" style="background:linear-gradient(135deg,#f5af02 0%,#e09e00 100%); color:#191919;"><i class="fas fa-rocket"></i> Boosted</span>'
            : (product.isFeatured ? '<span class="product-badge">Featured</span>' : '');
        const badgeHtml = boostedBadge;
        
        const sankofaBadge = product.isSankofaStore 
            ? '<span class="sankofa-store-badge"><i class="fas fa-store"></i> Official</span>' 
            : '';
                const preOrderBadge = product.preOrder
            ? ' <span class="preorder-badge" title="Pre-order — pay now, ships when stock lands (escrow protected)"><i class="fas fa-clock"></i> Pre-order</span>'
            : '';

        return `
            <a href="product-detail.html?id=${product.id}" class="product-card" data-pid="${escapeCardText(product.id)}">
                <div class="product-image-wrapper">
                    <img src="${escapeCardText(previewUrl)}" data-alt-src="${escapeCardText(fullUrl)}" onerror="smImgFallback(this)" alt="${escapeCardText(product.title)}" class="product-image">
                    ${badgeHtml}
                    ${sankofaBadge}
                    ${preOrderBadge}
                    ${smFlashRibbonHtml(product)}
                </div>
                <div class="product-content">
                    <div class="product-title">${escapeCardText(product.title)}</div>
                    <div class="product-price">${smFlashPriceHtml(product)}</div>
                    ${Number(product.reviewCount||0)>0 && Number(product.averageRating||0)>0 ? `<div class="product-rating" style="font-size:0.78rem;color:#5a6572;"><span style="color:#f5af02;">★</span> <strong style="color:#191919;">${Number(product.averageRating).toFixed(1)}</strong> (${Number(product.reviewCount)})</div>` : ''}
                    <div class="product-meta">
                        <span><i class="fas fa-map-marker-alt"></i> ${productLocationLabel(product)}</span>
                        <span><i class="fas fa-clock"></i> ${relativeTime}</span>
                        ${product.sellerId ? `<span class="premSlot" data-sid="${escapeCardText(product.sellerId)}"></span>` : ''}
                    </div>
                </div>
            </a>
        `;
    }).join('');

    smInjectPremiumBadges(container);
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
                <p style="color: #5a6572; max-width: 400px; margin: 0.5rem auto;">Featured products will appear here once sellers start listing. Be the first to <a href="publish.html" style="color: var(--primary-color);">list a product!</a></p>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem;">
                <i class="fas fa-clock" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <h3>No listings yet</h3>
                <p style="color: #5a6572; max-width: 400px; margin: 0.5rem auto;">Recently listed products will appear here. <a href="publish.html" style="color: var(--primary-color);">Start selling</a> and your items will show up!</p>
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
    
    // Short date (e.g. "27 Sep") so it fits narrow phone cards without touching the location
    if (typeof window.SankofaMarket !== 'undefined' && window.SankofaMarket.formatShortDate) {
        return window.SankofaMarket.formatShortDate(date);
    }
    const sameYear = date.getFullYear() === now.getFullYear();
    return date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

// ============================================================================
// EXPORT
// ============================================================================

window.Home = {
    loadCategories,
    loadFlashDeals,
    loadFeaturedProducts,
    loadRecentProducts,
    renderProducts,
    renderDemoProducts
};

/* Escape values that come from users (product titles, names, locations) before
   putting them into innerHTML. Prevents stored XSS from listing text. */
function escapeCardText(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled "classic" <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.waitForFirebase = waitForFirebase;
window.getCached = getCached;
window.setCached = setCached;
window.loadCategories = loadCategories;
window.loadFlashDeals = loadFlashDeals;
window.flashEndMs = flashEndMs;
window.flashCountdownText = flashCountdownText;
window.flashCardHtml = flashCardHtml;
window.tickFlashCountdowns = tickFlashCountdowns;
window.renderCategories = renderCategories;
window.loadFeaturedProducts = loadFeaturedProducts;
window.loadRecentProducts = loadRecentProducts;
window.isNetworkError = isNetworkError;
window.escapeHomeText = escapeHomeText;
window.productLocationLabel = productLocationLabel;
window.renderProducts = renderProducts;
window.renderDemoProducts = renderDemoProducts;
window.formatCurrency = formatCurrency;
window.formatRelativeTime = formatRelativeTime;
window.escapeCardText = escapeCardText;

