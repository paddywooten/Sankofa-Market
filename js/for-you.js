/**
 * Sankofa Market — "Picked for you" engine (js/for-you.js)
 * ========================================================
 * A small personalisation brain that remembers what each shopper looks for and
 * then floats matching products to a "Picked for you" rail on the home page.
 *
 * Design rules (why it is built this way):
 *  - Everything is kept ON THIS DEVICE (localStorage). No extra Firestore
 *    writes, no per-user documents, no server cost — and it works for guests
 *    who have not even created an account.
 *  - Data-bundle friendly: the product pool reuses product lists the home page
 *    already downloaded (localStorage caches) whenever it can, and only falls
 *    back to ONE small query (40 newest items) when the cache is cold — and
 *    even that result is cached for 10 minutes.
 *  - Honest labels: the rail says WHY items were picked ("Because you searched
 *    'iphone'"), never fake percentages or scary tracking talk.
 *  - Sellers never get shown their own listings as "picks", and sold/inactive
 *    items are always filtered out.
 *
 * What it learns from (strongest signal first):
 *  1. Cart adds         (+8 category, +4 words)  — they nearly bought it
 *  2. Wishlist saves    (+6 category, +3 words)  — they really liked it
 *  3. Searches          (+3 words)               — they literally typed it
 *  4. Product views     (+2 category, +1 words)  — mild interest
 *  5. Category browses  (+1.5 category)          — background interest
 *
 * Signals fade with time (about 90% gone after ~4 weeks) so the rail follows
 * the shopper's CURRENT mood instead of an old obsession.
 */

/* Strictly growing storage version — bump if the profile shape ever changes. */
var SM_FORYOU_KEY = 'sankofa_foryou_v1';

/* === FOR-YOU CORE START (pure logic — unit-tested, no DOM/Firebase) === */

/* Words that carry no shopping meaning — ignored when learning searches. */
var SM_FORYOU_STOPWORDS = {
    a: 1, an: 1, and: 1, are: 1, as: 1, at: 1, be: 1, by: 1, for: 1, from: 1,
    get: 1, how: 1, i: 1, in: 1, is: 1, it: 1, me: 1, my: 1, new: 1, of: 1,
    on: 1, or: 1, the: 1, to: 1, we: 1, with: 1, you: 1, your: 1,
    buy: 1, sale: 1, sell: 1, price: 1, cheap: 1, best: 1, gh: 1, ghana: 1, accra: 1
};

/** Break free text into unique shopping words (lowercase, 2+ letters, no stopwords). */
function smForYouTokenize(text) {
    var seen = {}, out = [];
    String(text || '').toLowerCase().split(/[^a-z0-9]+/).forEach(function (w) {
        if (w.length < 2 || SM_FORYOU_STOPWORDS[w] || seen[w]) return;
        seen[w] = 1;
        out.push(w);
    });
    return out;
}

/** A fresh, empty interest profile. */
function smForYouBlankProfile() {
    return { v: 1, terms: {}, cats: {}, searches: [], views: [] };
}

/** Read the profile from this device's storage; heal anything corrupt/missing. */
function smForYouLoadProfile() {
    var blank = smForYouBlankProfile();
    try {
        var raw = localStorage.getItem(SM_FORYOU_KEY);
        if (!raw) return blank;
        var p = JSON.parse(raw);
        if (!p || typeof p !== 'object') return blank;
        if (!p.terms || typeof p.terms !== 'object') p.terms = {};
        if (!p.cats || typeof p.cats !== 'object') p.cats = {};
        if (!Array.isArray(p.searches)) p.searches = [];
        if (!Array.isArray(p.views)) p.views = [];
        p.v = 1;
        return p;
    } catch (e) {
        return blank;
    }
}

/**
 * Time fade for one signal: today's interest counts in full, but every day it
 * shrinks by 8% (×0.92). After about 4 weeks a signal is nearly weightless, so
 * shoppers stop seeing things they cared about months ago.
 */
function smForYouEff(entry, now) {
    if (!entry || !entry.s) return 0;
    var days = Math.max(0, (now - (entry.at || now)) / 86400000);
    return entry.s * Math.pow(0.92, days);
}

/** Add weight to one term/category, refreshing its timestamp. Cap keeps one obsession from drowning everything else. */
function smForYouBump(map, key, amount, now) {
    if (!key) return;
    var e = map[key] || { s: 0, at: now };
    e.s = Math.min(24, e.s + amount);
    e.at = now;
    map[key] = e;
}

/** Keep the profile small: max 60 words, 40 categories, 10 searches, 24 views. Weakest first out. */
function smForYouTrim(profile, now) {
    var terms = Object.keys(profile.terms);
    if (terms.length > 60) {
        terms.sort(function (a, b) { return smForYouEff(profile.terms[b], now) - smForYouEff(profile.terms[a], now); });
        var keepT = {};
        terms.slice(0, 60).forEach(function (k) { keepT[k] = profile.terms[k]; });
        profile.terms = keepT;
    }
    var cats = Object.keys(profile.cats);
    if (cats.length > 40) {
        cats.sort(function (a, b) { return smForYouEff(profile.cats[b], now) - smForYouEff(profile.cats[a], now); });
        var keepC = {};
        cats.slice(0, 40).forEach(function (k) { keepC[k] = profile.cats[k]; });
        profile.cats = keepC;
    }
    profile.searches = profile.searches.slice(0, 10);
    profile.views = profile.views.slice(0, 24);
    return profile;
}

function smForYouSaveProfile(profile) {
    try {
        localStorage.setItem(SM_FORYOU_KEY, JSON.stringify(smForYouTrim(profile, Date.now())));
    } catch (e) { /* storage full or private mode — learning just pauses */ }
}

/* ---------------------------------------------------------------------------
 * SIGNAL RECORDERS — called from search.js, product-detail.js, cart.js,
 * wishlist.js. Each is wrapped by the caller in a typeof-guard, so pages that
 * never load this file keep working untouched.
 * ------------------------------------------------------------------------- */

/** Shopper ran a search: remember the words and (lightly) the category. */
function smForYouTrackSearch(query, category) {
    var q = String(query || '').trim().toLowerCase();
    if (!q || q.length < 2) return;
    var now = Date.now();
    var p = smForYouLoadProfile();
    // most-recent-first list of exact searches (powers the honest "Because you searched …" label)
    p.searches = p.searches.filter(function (s) { return s.q !== q; });
    p.searches.unshift({ q: q, at: now });
    smForYouTokenize(q).forEach(function (tok) { smForYouBump(p.terms, tok, 3, now); });
    if (category) smForYouBump(p.cats, category, 2, now);
    smForYouSaveProfile(p);
}

/** Shopper browsed a whole category page (search.html?category=…). */
function smForYouTrackCategoryBrowse(category) {
    var cat = String(category || '').trim();
    if (!cat) return;
    var now = Date.now();
    var p = smForYouLoadProfile();
    smForYouBump(p.cats, cat, 1.5, now);
    smForYouSaveProfile(p);
}

/**
 * Shopper opened a product page. A repeat view within 10 minutes (page
 * re-renders, back-and-forth tapping) counts as ONE view.
 */
function smForYouTrackView(product) {
    if (!product || typeof product !== 'object') return;
    var now = Date.now();
    var p = smForYouLoadProfile();
    var id = product.id || product._docId || null;
    if (id) {
        var existing = null;
        for (var i = 0; i < p.views.length; i++) { if (String(p.views[i].id) === String(id)) { existing = p.views[i]; break; } }
        if (existing && (now - existing.at) < 10 * 60 * 1000) return;   // just saw it — no double count
        p.views = p.views.filter(function (v) { return String(v.id) !== String(id); });
        p.views.unshift({ id: String(id), at: now });
    }
    if (product.category) smForYouBump(p.cats, product.category, 2, now);
    smForYouTokenize(product.title).slice(0, 6).forEach(function (tok) { smForYouBump(p.terms, tok, 1, now); });
    smForYouSaveProfile(p);
}

/** Shopper saved an item to their wishlist — a strong "I want this" signal. */
function smForYouTrackWishlist(product) {
    if (!product || typeof product !== 'object') return;
    var now = Date.now();
    var p = smForYouLoadProfile();
    if (product.category) smForYouBump(p.cats, product.category, 6, now);
    smForYouTokenize(product.title).slice(0, 6).forEach(function (tok) { smForYouBump(p.terms, tok, 3, now); });
    smForYouSaveProfile(p);
}

/** Shopper put an item in the basket — the strongest signal short of paying. */
function smForYouTrackCart(product) {
    if (!product || typeof product !== 'object') return;
    var now = Date.now();
    var p = smForYouLoadProfile();
    if (product.category) smForYouBump(p.cats, product.category, 8, now);
    smForYouTokenize(product.title).slice(0, 6).forEach(function (tok) { smForYouBump(p.terms, tok, 4, now); });
    smForYouSaveProfile(p);
}

/** True when there is anything worth recommending with. */
function smForYouHasSignals(profile) {
    return Object.keys(profile.terms).length > 0 || Object.keys(profile.cats).length > 0;
}

/** createdAt can be a Firestore Timestamp, a Date, a string or nothing — always return ms. */
function smForYouCreatedMs(product) {
    var c = product && product.createdAt;
    if (!c) return 0;
    if (typeof c.toMillis === 'function') return c.toMillis();
    if (typeof c.toDate === 'function') { try { return c.toDate().getTime(); } catch (e) { return 0; } }
    if (c instanceof Date) return c.getTime();
    var ms = new Date(c).getTime();
    return isNaN(ms) ? 0 : ms;
}

/** Mirror of home.js smFlashActive (kept local so this file stands alone on any page). */
function smForYouFlashActive(product, now) {
    var f = product && product.flashSale;
    if (!f || !(f.percent > 0) || !f.endsAt) return false;
    var end;
    if (typeof f.endsAt.toDate === 'function') { try { end = f.endsAt.toDate().getTime(); } catch (e) { return false; } }
    else end = new Date(f.endsAt).getTime();
    return !isNaN(end) && end > now;
}

/**
 * Score one product against the interest profile. Higher = better match.
 *   words from searches/views/wishlist/cart …up to +30
 *   category interest                        …up to +12
 *   on flash sale right now                  …+2
 *   boosted / featured listing               …+1.5
 *   listed in the last week                  …+1
 * Sellers' own items and dead listings get −1000 (never recommended).
 */
function smForYouScoreProduct(product, profile, opts) {
    var now = (opts && opts.now) || Date.now();
    if (!product || product.isActive === false || product.isSold === true) return -1000;
    if (opts && opts.viewerId && product.sellerId && String(product.sellerId) === String(opts.viewerId)) return -1000;

    var score = 0;

    var catKey = product.category ? String(product.category) : '';
    if (catKey && profile.cats[catKey]) {
        score += Math.min(12, smForYouEff(profile.cats[catKey], now) * 2);
    }

    var text = String(product.title || '') + ' ' + String(product.description || '').slice(0, 180);
    var wordScore = 0;
    smForYouTokenize(text).forEach(function (tok) {
        var e = profile.terms[tok];
        if (e) wordScore += Math.min(8, smForYouEff(e, now));
    });
    score += Math.min(30, wordScore);

    if (smForYouFlashActive(product, now)) score += 2;
    if (product.isBoosted || (product.boostLevel || 0) > 0 || product.isFeatured) score += 1.5;
    if (now - smForYouCreatedMs(product) < 7 * 86400000) score += 1;

    return score;
}

/**
 * Pick the rail lineup: score everything, drop anything weak (< 4 — the rail
 * must feel magical, not random), best first, newest breaks ties, max 12.
 */
function smForYouPick(pool, profile, opts) {
    var now = (opts && opts.now) || Date.now();
    var scored = [];
    (pool || []).forEach(function (p) {
        var s = smForYouScoreProduct(p, profile, opts || {});
        if (s >= 4) scored.push({ p: p, s: s, c: smForYouCreatedMs(p) });
    });
    scored.sort(function (a, b) {
        if (b.s !== a.s) return b.s - a.s;
        return b.c - a.c;
    });
    return scored.slice(0, 12).map(function (x) { return x.p; });
}

/**
 * ORDER BUMP — Tier 2 "You may also need" under the buy button.
 * Like the rail, but tuned for a buying moment: the category of the item in
 * front of the shopper outweighs their history, and Sankofa Store items get a
 * nudge because they can jump straight into the cart. The current item, the
 * shopper's own items, and anything inactive/sold are hard-excluded.
 */
function smOrderBumpPick(pool, current, profile, opts) {
    var now = (opts && opts.now) || Date.now();
    var limit = (opts && opts.limit) || 3;
    var currentId = String((current && (current._docId || current.id)) || '');
    if (!currentId || !Array.isArray(pool)) return [];
    var scored = [];
    pool.forEach(function (p) {
        if (!p) return;
        var pid = String(p._docId || p.id || '');
        if (!pid || pid === currentId) return;
        var s = smForYouScoreProduct(p, profile, { now: now, viewerId: opts && opts.viewerId });
        if (s <= -100) return;                         // dead/own item
        if (current.category && p.category === current.category) s += 6;
        if (current.sellerId && p.sellerId && String(p.sellerId) === String(current.sellerId)) s += 3;
        if (p.isSankofaStore === true) s += 1;         // one-tap add wins ties
        if (s < 5) return;                             // still must be relevant, not random
        scored.push({ p: p, s: s });
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored.slice(0, limit).map(function (x) {
        var it = x.p;
        it._bumpCanAdd = it.isSankofaStore === true;
        return it;
    });
}

/** Built-in category display names (custom ones get prettified from their id). */
var SM_FORYOU_CAT_NAMES = {
    electronics: 'Electronics', fashion: 'Fashion', 'home-garden': 'Home & Garden',
    vehicles: 'Vehicles', services: 'Services', sports: 'Sports',
    'books-media': 'Books & Media', 'baby-kids': 'Baby & Kids',
    'beauty-health': 'Beauty & Health', 'food-groceries': 'Food & Groceries',
    pets: 'Pets', 'jobs-skills': 'Jobs & Skills', 'real-estate': 'Real Estate',
    'musical-instruments': 'Musical Instruments', others: 'Others'
};

function smForYouCatName(id) {
    if (SM_FORYOU_CAT_NAMES[id]) return SM_FORYOU_CAT_NAMES[id];
    return String(id || '').replace(/-/g, ' ').replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });
}

/**
 * The honest one-line reason for the rail:
 *   "Because you searched 'iphone 12'"  (freshest strong search wins)
 *   "Because you like Fashion"          (otherwise the strongest category)
 *   "Deals we think you'll love"        (last resort)
 */
function smForYouReason(profile, now) {
    now = now || Date.now();
    if (profile.searches.length) {
        var q = profile.searches[0];
        var strong = smForYouTokenize(q.q).some(function (tok) {
            return profile.terms[tok] && smForYouEff(profile.terms[tok], now) >= 1.5;
        });
        if (strong) return 'Because you searched \u201c' + q.q + '\u201d';
    }
    var bestCat = null, bestScore = 0;
    Object.keys(profile.cats).forEach(function (k) {
        var s = smForYouEff(profile.cats[k], now);
        if (s > bestScore) { bestScore = s; bestCat = k; }
    });
    if (bestCat && bestScore >= 2) return 'Because you like ' + smForYouCatName(bestCat);
    return 'Deals we think you\u2019ll love';
}

/* === FOR-YOU CORE END === */

/* ---------------------------------------------------------------------------
 * HOME PAGE RAIL — everything below touches DOM/Firebase, so it is NOT part of
 * the unit-tested core. It quietly does nothing on pages without #forYouRail.
 * ------------------------------------------------------------------------- */

/* Local cache helpers — reuse home.js's when present so both files share the
   5-minute TTL convention; fall back to our own elsewhere. */
function smForYouGetCached(key, maxAgeMs) {
    if (typeof getCached === 'function') return getCached(key, maxAgeMs);
    try {
        var raw = localStorage.getItem(key);
        if (!raw) return null;
        var pack = JSON.parse(raw);
        if (Date.now() - pack.ts > maxAgeMs) { localStorage.removeItem(key); return null; }
        return pack.data;
    } catch (e) { return null; }
}
function smForYouSetCached(key, data) {
    if (typeof setCached === 'function') { setCached(key, data); return; }
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data })); } catch (e) {}
}

/** Dedupe products by document id (featured + recent lists overlap). */
function smForYouDedupe(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (p) {
        var id = String(p._docId || p.id || '');
        if (!id || seen[id]) return;
        seen[id] = 1;
        out.push(p);
    });
    return out;
}

/**
 * Build the candidate pool as cheaply as possible:
 *   1. product lists the home page ALREADY fetched this visit (zero reads)
 *   2. this engine's own 10-minute cache                           (zero reads)
 *   3. ONE small Firestore pull of the 40 newest products          (≤40 reads,
 *      then cached for 10 minutes — matches the home page's own pattern)
 */
async function smForYouLoadPool() {
    var pool = [];
    try { var r = smForYouGetCached('sankofa_recent_v1', 10 * 60 * 1000); if (Array.isArray(r)) pool = pool.concat(r); } catch (e) {}
    try { var f = smForYouGetCached('sankofa_featured_v1', 10 * 60 * 1000); if (Array.isArray(f)) pool = pool.concat(f); } catch (e) {}
    pool = smForYouDedupe(pool);
    if (pool.length >= 12) return pool;   // plenty to rank — no extra reads needed

    try {
        var mine = smForYouGetCached('sankofa_foryou_pool_v1', 10 * 60 * 1000);
        if (Array.isArray(mine) && mine.length) return smForYouDedupe(pool.concat(mine));
    } catch (e) {}

    if (typeof firebaseDB === 'undefined' || !firebaseDB) return pool;
    try {
        var snap = await firebaseDB.collection('products')
            .orderBy('createdAt', 'desc')
            .limit(40)
            .get();
        var items = [];
        snap.forEach(function (d) {
            var p = d.data();
            p._docId = p._docId || d.id;
            if (!p.id) p.id = d.id;
            if (p.isActive !== false && p.isSold !== true) items.push(p);
        });
        smForYouSetCached('sankofa_foryou_pool_v1', items);
        return smForYouDedupe(pool.concat(items));
    } catch (e) {
        console.warn('for-you: pool query failed:', e && e.message);
        return pool;
    }
}

/** One rail card — same card skeleton as home.js, so all existing styles/❤ pills just work. */
function smForYouCardHtml(product) {
    var id = product._docId || product.id;
    var esc = (typeof escapeCardText === 'function') ? escapeCardText : function (v) { return String(v == null ? '' : v); };
    var img = (typeof productThumb === 'function') ? productThumb(product) : ((product.images || product.photos || [])[0] || '/images/placeholders/product.svg');
    var full = (typeof productFull === 'function') ? productFull(product) : img;
    var price = (typeof smFlashPriceHtml === 'function') ? smFlashPriceHtml(product) : ('GHS ' + Number(product.price || 0).toLocaleString());
    var ribbon = (typeof smFlashRibbonHtml === 'function') ? smFlashRibbonHtml(product) : '';
    var seller = product.sellerName || (product.isSankofaStore ? 'Sankofa Store' : 'Seller');
    return '' +
        '<a href="product-detail.html?id=' + esc(id) + '" class="product-card" data-pid="' + esc(id) + '" style="display:block;">' +
            '<div class="product-image-wrapper">' +
                '<img src="' + esc(img) + '" data-alt-src="' + esc(full) + '" onerror="smImgFallback(this)" alt="' + esc(product.title) + '" class="product-image" loading="lazy" decoding="async">' +
                (product.isSankofaStore ? '<span class="sankofa-store-badge"><i class="fas fa-store"></i> Official</span>' : '') +
                (product.preOrder ? ' <span class="preorder-badge" title="Pre-order — pay now, ships when stock lands (escrow protected)"><i class="fas fa-clock"></i> Pre-order</span>' : '') +
                ribbon +
            '</div>' +
            '<div class="product-content">' +
                '<div class="product-title">' + esc(product.title) + '</div>' +
                '<div class="product-price">' + price + '</div>' +
                '<div class="product-meta"><span style="font-size:0.75rem;color:#5a6572;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(seller) + '</span>' +
                (product.sellerId ? '<span class="premSlot" data-sid="' + esc(product.sellerId) + '"></span>' : '') + '</div>' +
            '</div>' +
        '</a>';
}

/** Fill the home-page rail; the section stays hidden when there is nothing good to say. */
async function smForYouInitRail() {
    var section = document.getElementById('forYouSection');
    var rail = document.getElementById('forYouRail');
    if (!section || !rail) return;   // page has no rail — nothing to do

    var profile = smForYouLoadProfile();
    if (!smForYouHasSignals(profile)) return;   // first visit — stay hidden until they browse a little

    // Give the home page a moment to fill its own caches, then reuse them (saves reads)
    if (typeof waitForFirebase === 'function') {
        try { await waitForFirebase(); } catch (e) {}
    }

    var viewerId = null;
    try { viewerId = (firebase.auth().currentUser || {}).uid || null; } catch (e) {}

    var pool = await smForYouLoadPool();
    if (!pool.length) return;

    var picked = smForYouPick(pool, profile, { now: Date.now(), viewerId: viewerId });
    if (picked.length < 4) return;   // fewer than 4 good matches would look thin — stay hidden

    rail.innerHTML = picked.map(function (p) {
        return '<div style="min-width:175px;max-width:175px;scroll-snap-align:start;flex-shrink:0;">' + smForYouCardHtml(p) + '</div>';
    }).join('');

    var reasonEl = document.getElementById('forYouReason');
    if (reasonEl) reasonEl.textContent = smForYouReason(profile, Date.now());

    if (typeof smInjectPremiumBadges === 'function') smInjectPremiumBadges(rail);
    if (typeof markSavedCards === 'function') markSavedCards();   // keep ❤ Saved pills in sync here too

    section.style.display = 'block';
}

/* Start the rail shortly after page load — after home.js had its chance to
   warm the shared caches, so most visits need ZERO extra downloads. */
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
        try { smForYouInitRail(); } catch (e) { console.warn('for-you rail failed:', e && e.message); }
    }, 800);
});

/* ===== GLOBAL BRIDGE — keep every entry point reachable on window ===== */
window.smForYouTokenize = smForYouTokenize;
window.smForYouLoadProfile = smForYouLoadProfile;
window.smForYouHasSignals = smForYouHasSignals;
window.smForYouTrackSearch = smForYouTrackSearch;
window.smForYouTrackCategoryBrowse = smForYouTrackCategoryBrowse;
window.smForYouTrackView = smForYouTrackView;
window.smForYouTrackWishlist = smForYouTrackWishlist;
window.smForYouTrackCart = smForYouTrackCart;
window.smForYouScoreProduct = smForYouScoreProduct;
window.smForYouPick = smForYouPick;
window.smForYouLoadPool = smForYouLoadPool;
window.smForYouFlashActive = smForYouFlashActive;
window.smOrderBumpPick = smOrderBumpPick;
window.smForYouReason = smForYouReason;
window.smForYouInitRail = smForYouInitRail;
