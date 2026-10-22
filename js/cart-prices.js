/* ============================================================================
   CART PRICES — ask the server what things cost, before the checkout uses them.
   ---------------------------------------------------------------------------
   Loaded before js/cart.js and js/payment.js. The SERVER re-checks every price when
   money moves (CART PRICE CHECK in functions/index.js). This file keeps the screen,
   the cart and the order in step with that check, so an honest buyer is never charged
   a price they did not see. Nothing here decides a price on its own.
   ========================================================================== */

/* === CART PRICE CORE START === */
/* Pure helpers — extracted by cart-price-test.mjs. No network, no page in here. */

/** What one unit of a product costs right now, in GHS (a live flash sale included). Same rule as the server. */
function cartUnitPrice(product, nowMs) {
    var base = Number((product && product.price) || 0);
    var f = product && product.flashSale;
    var pct = (f && f.endsAt) ? Number(f.percent || 0) : 0;
    var end = 0;
    if (f && f.endsAt) {
        if (typeof f.endsAt.toMillis === 'function') end = f.endsAt.toMillis();
        else if (typeof f.endsAt.toDate === 'function') end = f.endsAt.toDate().getTime();
        else end = new Date(f.endsAt).getTime();
    }
    var live = pct >= 1 && end > nowMs;
    return (live ? Math.round(base * (1 - pct / 100) * 100) : Math.round(base * 100)) / 100;
}

/** The product a cart row refers to. Rows saved before productId existed carry the product id as their id. */
function cartRowProductId(row) {
    if (!row) return null;
    if (row.productId) return String(row.productId);
    var id = row.id != null ? String(row.id) : '';
    return (id && id.indexOf('local-') !== 0) ? id : null;
}

/** Brings checkout rows in line with the server's quotes. Returns the new rows and what changed. */
function cartApplyQuotes(rows, quotes) {
    var changed = [], unavailable = [];
    var out = (rows || []).map(function (it) {
        var row = Object.assign({}, it);
        var name = row.title || 'an item';
        var pid = cartRowProductId(row);
        row.productId = pid;
        var q = (pid && quotes) ? quotes[pid] : null;
        if (!q || !q.found || !q.sellable) { unavailable.push(name); return row; }
        // Judge the choice exactly as the buyer made it (a stale or extra choice is refused, not quietly dropped).
        var choiceProblem = (typeof variantProblem === 'function') ? variantProblem(q.variants, row.variant || null) : '';
        if (choiceProblem) { unavailable.push(name + ' (' + choiceProblem + ')'); return row; }
        row.variant = (typeof variantClean === 'function') ? variantClean(q.variants, row.variant || null) : (row.variant || null);
        var unitP = Math.round(Number(q.unitPrice) * 100);
        if (Math.round((Number(row.price) || 0) * 100) !== unitP) {
            changed.push({ title: name, from: Number(row.price) || 0, to: unitP / 100 });
            row.price = unitP / 100;
        }
        row.sellerId = q.sellerId || row.sellerId || null;
        row.deliveryFee = 0;                     // delivery is arranged with the seller, never charged in the app
        return row;
    });
    return { items: out, changed: changed, unavailable: unavailable };
}
/* === CART PRICE CORE END === */

/** Loads the Firebase functions SDK if this page does not have it yet. Resolves true when it is ready. */
function cartEnsureFunctionsSdk() {
    return new Promise(function (resolve) {
        if (typeof firebase !== 'undefined' && firebase && firebase.functions) return resolve(true);
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
}

/** Today's server prices for these products (read-only). Resolves to a map: product id → quote. */
async function cartQuotePrices(productIds) {
    var ids = (productIds || []).filter(Boolean);
    if (!ids.length) return {};
    var ready = await cartEnsureFunctionsSdk();
    if (!ready) throw new Error('Could not reach the price check.');
    var res = await firebase.functions().httpsCallable('quoteCartPrices')({ productIds: ids });
    return (res && res.data && res.data.quotes) || {};
}

/** Refreshes checkout rows against the server. A row with no product reference counts as unavailable. */
async function cartRefreshRows(rows) {
    var list = rows || [];
    var quotes = await cartQuotePrices(list.map(cartRowProductId));
    return cartApplyQuotes(list, quotes);
}

/** Writes refreshed prices into the stored cart (matched by row id), so every page shows the same numbers. */
function cartPersistPrices(rows) {
    try {
        var raw = JSON.parse(localStorage.getItem('sankofa_cart') || '[]');
        if (!Array.isArray(raw)) return;
        var byId = {};
        (rows || []).forEach(function (r) { if (r && r.id != null) byId[r.id] = r; });
        var next = raw.map(function (c) {
            var r = (c && c.id != null) ? byId[c.id] : null;
            return r ? Object.assign({}, c, { price: r.price, sellerId: r.sellerId, productId: r.productId, deliveryFee: 0 }) : c;
        });
        localStorage.setItem('sankofa_cart', JSON.stringify(next));
    } catch (e) {}
}
