/**
 * Sankofa Market — vendor storefront page (js/storefront.js)
 * Renders /store/{slug}: the seller's branded mini-shop with their logo,
 * theme color, story, contact buttons and their full live catalogue.
 *
 * Data cost notes: reads ONE stores doc (single query) + ONE products query
 * of that seller's items, all product thumbs through the preview pipeline.
 * Phone/WhatsApp are revealed only to signed-in users (keeps numbers away
 * from scrapers AND nudges buyers into free accounts).
 */

/* === STOREFRONT CORE START (pure helpers — unit-tested, no DOM/Firebase) === */

/** Same curated palette the server enforces (keep in sync with functions). */
var SM_STORE_THEMES = {
    ocean: { name: 'Ocean Blue', c1: '#0064d2', c2: '#004a99', on: '#ffffff' },
    gold: { name: 'Sankofa Gold', c1: '#f5af02', c2: '#e09e00', on: '#191919' },
    forest: { name: 'Forest Green', c1: '#16a34a', c2: '#0e6e33', on: '#ffffff' },
    ruby: { name: 'Ruby Red', c1: '#dc2626', c2: '#991b1b', on: '#ffffff' },
    plum: { name: 'Royal Plum', c1: '#7c3aed', c2: '#5b21b6', on: '#ffffff' },
    night: { name: 'Midnight Navy', c1: '#131f47', c2: '#0a1024', on: '#ffffff' }
};

var SM_STORE_HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * The colours a shop wears. Hand-mixed themes (theme:'custom' + themeColors
 * re-derived by the server) win; anything missing or junk falls back to the
 * curated palette, then to Ocean — a shop can never render with broken colors.
 */
function smStoreThemeColors(store) {
    var t = store && store.themeColors;
    if (t && SM_STORE_HEX_RE.test(t.c1 || '') && SM_STORE_HEX_RE.test(t.c2 || '') && SM_STORE_HEX_RE.test(t.on || '')) {
        // A fully custom hero text colour (advanced theming) beats the stored pick
        if (store.heroTextColor && SM_STORE_HEX_RE.test(store.heroTextColor)) {
            return { c1: t.c1, c2: t.c2, on: store.heroTextColor };
        }
        return { c1: t.c1, c2: t.c2, on: t.on };
    }
    return SM_STORE_THEMES[(store && store.theme)] || SM_STORE_THEMES.ocean;
}

/** '' unless a real '#rrggbb' (optional advanced overrides). */
function smStoreHexOrBlank(v) {
    var s = String(v || '').trim().toLowerCase();
    return SM_STORE_HEX_RE.test(s) ? s : '';
}

/** rgba string for a translucent plate; '' when the plate is off. */
function smStorePanelRgba(color, opacity) {
    var c = smStoreHexOrBlank(color);
    var o = Math.round(Number(opacity));
    if (!c || !isFinite(o) || o <= 0) return '';
    o = Math.min(95, o);
    return smStoreHexRgba(c, Math.round(o) / 100);
}

/** '#rrggbb' + alpha (0–1) → 'rgba(r,g,b,a)'. Junk hex → safe navy fallback. */
function smStoreHexRgba(hex, alpha) {
    if (!SM_STORE_HEX_RE.test(hex)) return 'rgba(10,16,36,' + alpha + ')';
    return 'rgba(' + parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16) + ',' + alpha + ')';
}

/**
 * How the hero photo is shaded behind the text ("the veil"):
 * night → deep navy (the classic look), white → light veil (pair with dark
 * text), theme → the shop's own darker gradient end. Missing or junk settings
 * fall back to the classic night veil at 60% so old shops never change look.
 */
function smStoreBannerShade(store) {
    var s = store && store.bannerShade;
    var mode = s && typeof s.mode === 'string' ? s.mode : 'night';
    var opacity = s ? Math.round(Number(s.opacity)) : NaN;
    if (!isFinite(opacity)) opacity = 60;
    opacity = Math.min(95, Math.max(0, opacity));
    var color = '#0a1024';
    if (mode === 'white') color = '#ffffff';
    else if (mode === 'theme') color = smStoreThemeColors(store).c2;
    else mode = 'night';
    return { mode: mode, opacity: opacity, color: color };
}

/** Pull the shop address out of "/store/kofi-phones" (or "?s=kofi-phones"). */
function smStoreSlugFromPath(pathname, search) {
    var m = String(pathname || '').match(/^\/store\/([a-z0-9][a-z0-9-]*)/i);
    if (m) return m[1].toLowerCase();
    try {
        var q = new URLSearchParams(search || '');
        var s = q.get('s');
        if (s) return String(s).toLowerCase();
    } catch (e) {}
    return '';
}

/** Pretty one-line price with live flash-sale awareness. */
function smStorePriceHtml(product, now) {
    now = now || Date.now();
    var f = product && product.flashSale;
    var active = false, end = 0;
    if (f && f.percent > 0 && f.endsAt) {
        end = (typeof f.endsAt.toDate === 'function') ? f.endsAt.toDate().getTime() : new Date(f.endsAt).getTime();
        active = !isNaN(end) && end > now;
    }
    if (active && f.price > 0) {
        return '<span style="color:#dc2626;font-weight:800;">GHS ' + Number(f.price).toLocaleString() + '</span>' +
               ' <s style="font-size:0.74rem;color:#9aa5b1;font-weight:400;">GHS ' + Number(product.price || 0).toLocaleString() + '</s>';
    }
    return 'GHS ' + Number((product && product.price) || 0).toLocaleString();
}

/** createdAt → ms, tolerating Timestamp/Date/string shapes. */
function smStoreCreatedMs(product) {
    var c = product && product.createdAt;
    if (!c) return 0;
    if (typeof c.toMillis === 'function') return c.toMillis();
    if (typeof c.toDate === 'function') { try { return c.toDate().getTime(); } catch (e) { return 0; } }
    if (c instanceof Date) return c.getTime();
    var ms = new Date(c).getTime();
    return isNaN(ms) ? 0 : ms;
}


/** 1234 → "1.2k", 2_400_000 → "2.4M" — compact numbers for public shop stats. */
function smStoreFormatCount(n) {
    var v = Math.max(0, Number(n) || 0);
    if (v < 1000) return String(Math.floor(v));
    if (v < 1000000) {
        var k = v / 1000;
        return (k >= 100 ? String(Math.round(k)) : (Math.round(k * 10) / 10).toString()) + 'k';
    }
    var m = v / 1000000;
    return (Math.round(m * 10) / 10).toString() + 'M';
}

/* Shop search (Tier 5, option 3). Pure: no DOM and no network. */
function smStoreSearchWords(query) {
    return String(query || '').toLowerCase().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, 6);
}
/** The text a buyer can search in one listing: title, category, brand, tags and description. */
function smStoreSearchText(p) {
    var tags = Array.isArray(p.tags) ? p.tags.join(' ') : String(p.tags || '');
    return [p.title, p.category, p.brand, tags, p.description].join(' ').toLowerCase();
}
/** Every typed word must appear somewhere in the listing. Order and case do not matter. */
function smStoreSearchMatch(p, query) {
    var words = smStoreSearchWords(query);
    if (!words.length) return true;
    var hay = smStoreSearchText(p || {});
    return words.every(function (w) { return hay.indexOf(w) !== -1; });
}
/** The listings that match, in their original order. An empty search keeps everything. */
function smStoreFilterItems(items, query) {
    var list = Array.isArray(items) ? items : [];
    if (!smStoreSearchWords(query).length) return list.slice();
    return list.filter(function (p) { return smStoreSearchMatch(p, query); });
}
/* === STOREFRONT CORE END === */

function smStoreEsc(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

var _smStoreDoc = null;   // the loaded stores/{uid} document

function smStoreShowState(which) {
    document.getElementById('storeLoading').style.display = which === 'loading' ? 'block' : 'none';
    document.getElementById('storeNotFound').style.display = which === 'notfound' ? 'block' : 'none';
    document.getElementById('storeView').style.display = which === 'ready' ? 'block' : 'none';
}

/** Apply the shop's theme to the page (CSS variables + browser chrome color). */
function smStoreApplyTheme(store) {
    var t = smStoreThemeColors(store);
    var root = document.documentElement;
    root.style.setProperty('--st-c1', t.c1);
    root.style.setProperty('--st-c2', t.c2);
    root.style.setProperty('--st-on', t.on);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = t.c1;
}

function smStoreRenderHero(store) {
    var name = store.storeName || 'Store';

    // Tier 3: optional banner behind the hero — shaded with the seller's veil
    // choice (colour + strength) so text stays readable on any photo
    var banner = store.bannerThumbUrl || store.bannerUrl || '';
    var heroEl = document.getElementById('storeHero');
    if (heroEl && banner) {
        heroEl.classList.add('has-banner');
        var shade = smStoreBannerShade(store);
        var a1 = Math.round(shade.opacity) / 100;
        var a2 = Math.round(shade.opacity * 0.83) / 100;
        heroEl.style.backgroundImage =
            'linear-gradient(' + smStoreHexRgba(shade.color, a1) + ', ' + smStoreHexRgba(shade.color, a2) + '), url("' + smStoreEsc(banner) + '")';
        heroEl.style.color = smStoreThemeColors(store).on;
    }

    // Advanced: translucent plate behind name + buttons (banner readability)
    var textPanel = smStorePanelRgba(store.heroTextBgColor, store.heroTextBgOpacity);
    var heroTextEl = document.querySelector('#storeHero .store-hero-text');
    if (heroTextEl) {
        heroTextEl.classList.toggle('has-textbg', !!textPanel);
        heroTextEl.style.background = textPanel || '';
    }

    // Logo (or a friendly letter tile when the shop has no logo yet)
    var logoWrap = document.getElementById('storeLogoWrap');
    var logoSrc = store.logoThumbUrl || store.logoUrl || '';
    if (logoSrc) {
        logoWrap.innerHTML = '<img class="store-logo" src="' + smStoreEsc(logoSrc) + '" alt="' + smStoreEsc(name) + ' logo" onerror="this.outerHTML=\'<div class=&quot;store-logo-letter&quot;>' + smStoreEsc(name.charAt(0).toUpperCase()) + '</div>\';">';
    } else {
        logoWrap.innerHTML = '<div class="store-logo-letter">' + smStoreEsc(name.charAt(0).toUpperCase()) + '</div>';
    }

    document.getElementById('storeName').textContent = name;
    document.getElementById('storeListingsName').textContent = name;
    document.getElementById('storeBio').textContent = store.bio || '';
    document.getElementById('storeBio').style.display = store.bio ? '' : 'none';

    // Chips: location, member since
    var chips = [];
    if (store.location) chips.push('<span class="store-chip"><i class="fas fa-map-marker-alt"></i> ' + smStoreEsc(store.location) + '</span>');
    if (store.createdAt) {
        var d = new Date(store.createdAt);
        if (!isNaN(d.getTime())) {
            chips.push('<span class="store-chip"><i class="fas fa-calendar-check"></i> On Sankofa since ' +
                d.toLocaleDateString('en-GH', { month: 'short', year: 'numeric' }) + '</span>');
        }
    }
    // Tier 3: public social proof — "1.2k visits · 340 item views"
    if (store.shopStats && (store.shopStats.viewsTotal > 0 || store.shopStats.itemViewsTotal > 0)) {
        chips.push('<span class="store-chip" title="Real visits counted by Sankofa — owners never count themselves">' +
            '<i class="fas fa-eye"></i> ' + smStoreFormatCount(store.shopStats.viewsTotal) + ' visits · ' +
            smStoreFormatCount(store.shopStats.itemViewsTotal) + ' item views</span>');
    }
    document.getElementById('storeChips').innerHTML = chips.join('');

    // Phase-3 announcement strip — one punchy line under the chips
    var oldAnn = document.querySelector('#storeHero .store-announce');
    if (oldAnn) oldAnn.remove();
    if (store.announcement) {
        var ann = document.createElement('div');
        ann.className = 'store-announce';
        ann.innerHTML = '<i class="fas fa-bullhorn" style="margin-top:2px;"></i><span></span>';
        ann.querySelector('span').textContent = store.announcement;   // textContent — no HTML injection
        // Advanced: custom announcement text colour / translucent background
        var annText = smStoreHexOrBlank(store.announceTextColor);
        if (annText) ann.style.color = annText;
        var annBg = smStorePanelRgba(store.announceBgColor, store.announceBgColor ? store.announceBgOpacity : 0);
        if (annBg) {
            ann.style.background = annBg;
            var edge = Math.min(100, (Math.round(Number(store.announceBgOpacity)) || 0) + 25) / 100;
            ann.style.borderColor = smStoreHexRgba(store.announceBgColor, edge);
        }
        // Own full-width row BELOW logo + text (never cram it into the logo column).
        document.getElementById('storeHero').querySelector('.store-hero-inner').appendChild(ann);
    }

    // Action buttons — Message first (escrow-safe path), then phone + WhatsApp
    var me = null;
    try { me = firebase.auth().currentUser; } catch (e) {}
    var isOwner = me && me.uid === store.ownerId;

    // Tier 2 mini-analytics: count this visit once per session (owners never count)
    if (!isOwner && store.ownerId) smPingShopStats('shop', store.ownerId);

    var actions = '';
    if (!isOwner) {
        actions += '<button class="st-btn st-btn-primary" onclick="smStoreMessageOwner()"><i class="fas fa-comment"></i> Message on Sankofa</button>';
        if (store.phone) {
            actions += '<button class="st-btn st-btn-outline" id="storeCallBtn" onclick="smStoreRevealContact(\'call\')"><i class="fas fa-phone"></i> <span id="storeCallLabel">Show number</span></button>';
            actions += '<button class="st-btn st-btn-wa" id="storeWaBtn" onclick="smStoreRevealContact(\'wa\')"><i class="fab fa-whatsapp"></i> WhatsApp</button>';
        }
        // Shop contact email — same sign-in shield as the phone number
        if (store.email) {
            actions += '<button class="st-btn st-btn-outline" id="storeEmailBtn" onclick="smStoreRevealContact(\'email\')" title="Email the shop"><i class="fas fa-envelope"></i> <span id="storeEmailLabel">Email shop</span></button>';
        }
    } else {
        actions += '<a class="st-btn st-btn-primary" href="/pages/user/my-store.html"><i class="fas fa-pen"></i> Edit my shop</a>';
        actions += '<a class="st-btn st-btn-outline" href="/pages/user/listings.html"><i class="fas fa-box"></i> Manage items</a>';
    }
    document.getElementById('storeActions').innerHTML = actions;

    document.title = name + ' — shop on Sankofa Market';
}

/** Tier 3: public aggregate shop stats (root doc is world-readable; daily detail is not). */
async function smStoreFetchStats(ownerId) {
    try {
        if (!ownerId || typeof firebaseDB === 'undefined' || !firebaseDB) return null;
        var s = await firebaseDB.collection('shopStats').doc(ownerId).get();
        return s.exists ? (s.data() || {}) : null;
    } catch (e) { return null; }   // stats are decoration — never break the shop page
}

/** Phone & WhatsApp stay behind sign-in (scraper shield + free-account nudge). */
function smStoreRevealContact(kind) {
    var me = null;
    try { me = firebase.auth().currentUser; } catch (e) {}
    if (!me) {
        if (typeof showFlashMessage === 'function') showFlashMessage('Sign in to see the seller\'s contact', 'warning');
        setTimeout(function () {
            window.location.href = '/pages/auth/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        }, 1200);
        return;
    }
    var store = _smStoreDoc;
    if (!store) return;
    if (kind === 'email') {
        if (!store.email) return;
        var emailLabel = document.getElementById('storeEmailLabel');
        var emailBtn = document.getElementById('storeEmailBtn');
        if (emailLabel) emailLabel.textContent = store.email;
        if (emailBtn) emailBtn.onclick = function () {
            window.location.href = 'mailto:' + store.email +
                '?subject=' + encodeURIComponent('Enquiry from Sankofa Market — ' + (store.storeName || 'shop'));
        };
        return;
    }
    if (!store.phone) return;
    var digits = store.phone.replace(/[^0-9+]/g, '');
    if (kind === 'call') {
        var label = document.getElementById('storeCallLabel');
        var btn = document.getElementById('storeCallBtn');
        if (label) label.textContent = store.phone;
        if (btn) btn.onclick = function () { window.location.href = 'tel:' + digits; };
        return;
    }
    // WhatsApp deep link — convert 0xxx Ghana numbers to 233 format
    var wa = digits;
    if (wa.charAt(0) === '0') wa = '233' + wa.slice(1);
    if (wa.charAt(0) === '+') wa = wa.slice(1);
    var text = encodeURIComponent('Hi ' + (store.storeName || '') + '! I found your shop on Sankofa Market 🏪');
    window.open('https://wa.me/' + wa + '?text=' + text, '_blank', 'noopener');
}

/** Find-or-create a Sankofa chat with the shop owner, then open it. */
async function smStoreMessageOwner() {
    var store = _smStoreDoc;
    if (!store) return;

    var me = null;
    try { me = firebase.auth().currentUser; } catch (e) {}
    if (!me) {
        if (typeof showFlashMessage === 'function') showFlashMessage('Sign in to message this shop', 'warning');
        setTimeout(function () {
            window.location.href = '/pages/auth/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        }, 1200);
        return;
    }
    if (me.uid === store.ownerId) return;

    if (typeof showFlashMessage === 'function') showFlashMessage('Opening secure chat…', 'info');

    try {
        // Use an existing shop chat if the buyer already started one
        var snap = await firebaseDB.collection('conversations')
            .where('participants', 'array-contains', me.uid)
            .get();
        var existing = null;
        snap.forEach(function (doc) {
            var d = doc.data();
            if (existing) return;
            if (d.participants && d.participants.indexOf(store.ownerId) !== -1 && d.source === 'store' && d.storeSlug === store.slug) {
                existing = doc.id;
            }
        });
        if (existing) {
            window.location.href = '/pages/user/messages.html?conv=' + existing;
            return;
        }

        // Otherwise start a fresh one — product-less, like follower chats
        var myName = me.displayName || 'Buyer';
        try {
            var myDoc = await firebaseDB.collection('users').doc(me.uid).get();
            if (myDoc.exists) {
                var md = myDoc.data();
                myName = md.name || (md.firstName ? md.firstName + (md.lastName ? ' ' + md.lastName : '') : myName);
            }
        } catch (e) {}

        var names = {};
        names[me.uid] = myName;
        names[store.ownerId] = store.ownerName || store.storeName || 'Seller';

        var convRef = await firebaseDB.collection('conversations').add({
            participants: [me.uid, store.ownerId],
            participantNames: names,
            source: 'store',
            storeSlug: store.slug,
            storeName: store.storeName || 'Shop',
            lastMessage: '',
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            unreadBy: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.location.href = '/pages/user/messages.html?conv=' + convRef.id;
    } catch (err) {
        console.error('store chat error:', err);
        if (typeof showFlashMessage === 'function') showFlashMessage('Could not open chat: ' + err.message, 'error');
    }
}

/** One product card in the shop grid — same family of markup as home cards. */
function smStoreCardHtml(product) {
    var id = product._docId || product.id;
    var img = (typeof productThumb === 'function') ? productThumb(product) : ((product.images || product.photos || [])[0] || '/images/placeholders/product.svg');
    var full = (typeof productFull === 'function') ? productFull(product) : img;
    var loc = (product.location && product.location.city) || (typeof product.location === 'string' ? product.location : 'Ghana');
    var badge = '';
    if (product.preOrder) badge += ' <span class="preorder-badge" title="Pre-order — pay now, ships when stock lands (escrow protected)"><i class="fas fa-clock"></i> Pre-order</span>';
    if (product.isBoosted || product.isFeatured) badge += '<span class="product-badge" style="background:linear-gradient(135deg,#f5af02,#e09e00);color:#191919;"><i class="fas fa-rocket"></i> Top</span>';
    return '' +
        '<a href="/product-detail.html?id=' + smStoreEsc(id) + '" class="product-card" data-pid="' + smStoreEsc(id) + '">' +
            '<div class="product-image-wrapper">' +
                '<img src="' + smStoreEsc(img) + '" data-alt-src="' + smStoreEsc(full) + '" onerror="smImgFallback(this)" alt="' + smStoreEsc(product.title) + '" class="product-image" loading="lazy" decoding="async">' +
                badge +
            '</div>' +
            '<div class="product-content">' +
                '<div class="product-title">' + smStoreEsc(product.title) + '</div>' +
                '<div class="product-price">' + smStorePriceHtml(product) + '</div>' +
                '<div class="product-meta"><span><i class="fas fa-map-marker-alt"></i> ' + smStoreEsc(loc) + '</span></div>' +
            '</div>' +
        '</a>';
}

/* Shop search state: the first page is 60 items. Every item is fetched only when a buyer types a search. */
var smStoreSearchState = { ownerId: '', items: [], full: false, capped: false, fetchPromise: null, timer: null };

function smStoreSortListings(items) {
    items.sort(function (a, b) {
        var ba = (a.boostLevel || (a.isBoosted ? 2 : 0)), bb = (b.boostLevel || (b.isBoosted ? 2 : 0));
        if (bb !== ba) return bb - ba;
        return smStoreCreatedMs(b) - smStoreCreatedMs(a);
    });
    return items;
}

function smStoreCollectListings(snap) {
    var items = [];
    snap.forEach(function (d) {
        var p = d.data();
        p._docId = p._docId || d.id;
        if (!p.id) p.id = d.id;
        if (p.isActive !== false && p.isSold !== true) items.push(p);
    });
    return items;
}

/** One extra query, made only when a buyer types a search: up to 300 items. */
function smStoreFetchAllListings() {
    var st = smStoreSearchState;
    if (!st.fetchPromise) {
        st.fetchPromise = firebaseDB.collection('products')
            .where('sellerId', '==', st.ownerId)
            .limit(300)
            .get()
            .then(function (snap) {
                st.items = smStoreSortListings(smStoreCollectListings(snap));
                st.full = snap.size < 300;
                st.capped = !st.full;
            })
            .catch(function (e) {
                console.warn('shop search: could not load every item', e && e.message);
                st.fetchPromise = null;   // try again on the next search
            });
    }
    return st.fetchPromise;
}

function smStoreRenderListings(items, emptyText) {
    var grid = document.getElementById('storeGrid');
    if (!items.length) {
        grid.innerHTML = '<p style="grid-column:1/-1;color:#5a6572;font-size:0.9rem;margin:0.5rem 0;">' + smStoreEsc(emptyText) + '</p>';
        return;
    }
    grid.innerHTML = items.map(smStoreCardHtml).join('');
    if (typeof markSavedCards === 'function') markSavedCards();
}

async function smStoreApplySearch() {
    var input = document.getElementById('storeSearch');
    var note = document.getElementById('storeSearchNote');
    var countEl = document.getElementById('storeCount');
    var st = smStoreSearchState;
    var q = input ? input.value : '';
    if (!smStoreSearchWords(q).length) {
        if (note) note.textContent = '';
        countEl.textContent = st.items.length + (st.items.length === 1 ? ' item' : ' items');
        smStoreRenderListings(st.items, 'No items in this shop yet.');
        return;
    }
    if (!st.full && !st.capped) {
        if (note) note.textContent = 'Searching every item in this shop…';
        await smStoreFetchAllListings();
        if (note) note.textContent = '';
    }
    var matches = smStoreFilterItems(st.items, q);
    var total = st.items.length;
    countEl.textContent = st.full
        ? matches.length + ' of ' + total + (total === 1 ? ' item matches' : ' items match')
        : matches.length + ' of the first ' + total + ' items match';
    smStoreRenderListings(matches, 'No items match “' + q.trim().slice(0, 40) + '”. Try a shorter word.');
}

function smStoreBindSearch() {
    var input = document.getElementById('storeSearch');
    if (!input || input.getAttribute('data-bound') === '1') return;
    input.setAttribute('data-bound', '1');
    input.addEventListener('input', function () {
        clearTimeout(smStoreSearchState.timer);
        smStoreSearchState.timer = setTimeout(smStoreApplySearch, 250);
    });
}

async function smStoreLoadListings(ownerId) {
    var grid = document.getElementById('storeGrid');
    var countEl = document.getElementById('storeCount');
    try {
        // Single-field query only (no composite index) — sort client-side, the
        // same way the home page does it.
        var snap = await firebaseDB.collection('products')
            .where('sellerId', '==', ownerId)
            .limit(60)
            .get();
        var items = [];
        snap.forEach(function (d) {
            var p = d.data();
            p._docId = p._docId || d.id;
            if (!p.id) p.id = d.id;
            if (p.isActive !== false && p.isSold !== true) items.push(p);
        });
        items = smStoreSortListings(items);
        smStoreSearchState.ownerId = ownerId;
        smStoreSearchState.items = items;
        smStoreSearchState.full = snap.size < 60;   // a full first page may hide more items
        smStoreBindSearch();
        countEl.textContent = items.length + (items.length === 1 ? ' item' : ' items');
        if (!items.length) {
            document.getElementById('storeEmpty').style.display = 'block';
            grid.innerHTML = '';
            return;
        }
        grid.innerHTML = items.map(smStoreCardHtml).join('');
        if (typeof markSavedCards === 'function') markSavedCards();
    } catch (e) {
        console.warn('store listings failed:', e && e.message);
        countEl.textContent = '';
    }
}

async function smStorefrontInit() {
    var slug = smStoreSlugFromPath(window.location.pathname, window.location.search);
    if (!slug) { smStoreShowState('notfound'); return; }

    // Wait briefly for firebase-config (it initializes firebaseDB)
    var tries = 0;
    while ((typeof firebaseDB === 'undefined' || !firebaseDB) && tries < 40) {
        await new Promise(function (r) { setTimeout(r, 100); });
        tries++;
    }
    if (typeof firebaseDB === 'undefined' || !firebaseDB) { smStoreShowState('notfound'); return; }

    // Let auth settle first — the owner editing their shop should see
    // "Edit my shop", not visitor buttons (and contact gating needs it too)
    try {
        await new Promise(function (resolve) {
            var settled = false;
            var done = function () { if (!settled) { settled = true; resolve(); } };
            try {
                var unsub = firebase.auth().onAuthStateChanged(function () { try { unsub(); } catch (e) {} done(); });
            } catch (e) { done(); }
            setTimeout(done, 3000);
        });
    } catch (e) {}

    try {
        // Public rule lets us read ONLY active stores — pending/paused ones land here as "not open"
        var snap = await firebaseDB.collection('stores')
            .where('slug', '==', slug)
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (snap.empty) {
            // Maybe the visitor IS the owner — they can preview their pending shop
            var me = null;
            try { me = firebase.auth().currentUser; } catch (e) {}
            if (me) {
                var own = await firebaseDB.collection('stores').doc(me.uid).get();
                if (own.exists && own.data().slug === slug) {
                    _smStoreDoc = own.data();
                    _smStoreDoc.shopStats = await smStoreFetchStats(me.uid);
                    smStoreApplyTheme(_smStoreDoc);
                    smStoreRenderHero(_smStoreDoc);
                    smStoreShowState('ready');
                    var hero = document.getElementById('storeHero');
                    var note = document.createElement('div');
                    note.style.cssText = 'background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:0.6rem 1rem;border-radius:10px;font-size:0.82rem;font-weight:600;width:100%;margin-top:0.8rem;';
                    note.innerHTML = '<i class="fas fa-eye"></i> Preview — your shop shows here once Sankofa approves it (only you can see this page for now).';
                    hero.querySelector('.store-hero-inner').appendChild(note);
                    smStoreLoadListings(me.uid);
                    return;
                }
            }
            smStoreShowState('notfound');
            return;
        }

        _smStoreDoc = snap.docs[0].data();
        _smStoreDoc.shopStats = await smStoreFetchStats(_smStoreDoc.ownerId);
        smStoreApplyTheme(_smStoreDoc);
        smStoreRenderHero(_smStoreDoc);
        smStoreShowState('ready');
        smStoreLoadListings(_smStoreDoc.ownerId);
    } catch (e) {
        console.warn('storefront load failed:', e && e.message);
        smStoreShowState('notfound');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    try { smStorefrontInit(); } catch (e) { smStoreShowState('notfound'); }
});

window.smStoreMessageOwner = smStoreMessageOwner;
window.smStoreRevealContact = smStoreRevealContact;
window.smStoreSlugFromPath = smStoreSlugFromPath;

/** The functions SDK is pulled in on demand — never loaded for pages that don't ping. */
var _smFnsSdkPromise = null;
function smShopStatsFns() {
    if (typeof firebase !== 'undefined' && firebase && firebase.functions) return Promise.resolve(true);
    if (_smFnsSdkPromise) return _smFnsSdkPromise;
    _smFnsSdkPromise = new Promise(function (resolve) {
        var settled = false;
        var done = function (ok) { if (!settled) { settled = true; resolve(ok); } };
        try {
            var tag = document.createElement('script');
            tag.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions-compat.js';
            tag.onload = function () { done(!!(window.firebase && firebase.functions)); };
            tag.onerror = function () { done(false); };
            document.head.appendChild(tag);
        } catch (e) { done(false); }
        setTimeout(function () { done(!!(window.firebase && firebase.functions)); }, 8000);
    });
    return _smFnsSdkPromise;
}

/** Tier 2: fire-and-forget stats ping — once per session per target, never blocking. */
function smPingShopStats(kind, uid) {
    try {
        if (!uid || typeof firebase === 'undefined') return;
        var key = 'sm-ping-' + kind + '-' + uid;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
        smShopStatsFns().then(function (ok) {
            if (!ok) { sessionStorage.removeItem(key); return; }
            firebase.functions().httpsCallable('recordShopPing')({ kind: kind, uid: uid })
                .then(function (r) { if (r && r.data && r.data.counted === false) sessionStorage.removeItem(key); })
                .catch(function () {});
        });
    } catch (e) {}
}
window.smPingShopStats = smPingShopStats;
