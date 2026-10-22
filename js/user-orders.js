/* ============================================================================
   SANKOFA MARKET - USER ORDERS PAGE (Firebase-powered)
   - Shows all orders where buyerId==uid OR sellerId==uid
   - Auction wins appear automatically at bid price, with the seller commission shown on each order
   - Real-time via onSnapshot, sorted client-side, filter tabs including 🏆 Auctions
   ============================================================================ */

document.addEventListener('DOMContentLoaded', function() {
    initOrderFilters();
    initOrderActions();
    initFirebaseOrders();
});

var _allOrders = [];
var _buyerUnsub = null;
var _sellerUnsub = null;
var _currentFilter = 'all';

/* ---- Filter Tabs ---- */
function initOrderFilters() {
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            _currentFilter = this.dataset.filter;
            renderOrders();
        });
    });
}

/* ---- Order Actions ---- */
function initOrderActions() {
    document.querySelectorAll('.order-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-1px)';
            this.style.boxShadow = 'var(--shadow-md)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = '';
            this.style.boxShadow = '';
        });
    });
}

/* ---- Firebase Orders — real data ---- */
function initFirebaseOrders(){
    var tries = 0;
    function tryInit(){
        tries++;
        if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof firebaseAuth === 'undefined' || !firebaseAuth){
            if (tries < 30) setTimeout(tryInit, 600);
            else {
                var el = document.getElementById('ordersList');
                if (el) el.innerHTML = '<div style="text-align:center;padding:2rem;color:#e74c3c;"><i class="fas fa-exclamation-triangle"></i><p>Firebase not ready — please refresh</p></div>';
            }
            return;
        }
        firebaseAuth.onAuthStateChanged(function(user){
            // cleanup previous
            if (_buyerUnsub) try{ _buyerUnsub(); }catch(e){}
            if (_sellerUnsub) try{ _sellerUnsub(); }catch(e){}
            _buyerUnsub = _sellerUnsub = null;
            _allOrders = [];
            if (!user){
                var el = document.getElementById('ordersList');
                if (el) el.innerHTML = '<div style="text-align:center;padding:2.5rem 1rem;background:#fff;border:1px solid #e5e7eb;border-radius:12px;"><i class="fas fa-lock" style="font-size:2rem;color:#5f6b7a;"></i><h2 style="margin:0.8rem 0 0.3rem;font-size:1.17em;">Sign in to see orders</h2><p style="color:#5a6572;font-size:0.85rem;margin:0;">Auction wins are auto-placed as orders at your bid price.</p><a href="../auth/login.html?redirect=orders.html" class="btn btn-primary" style="margin-top:1rem;">Sign In</a></div>';
                return;
            }
            var listEl = document.getElementById('ordersList');
            if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:3rem 1rem;color:#5a6572;"><i class="fas fa-spinner fa-spin" style="font-size:1.8rem;color:#0064d2;"></i><p style="margin-top:0.8rem;">Loading your orders…</p></div>';

            var uid = user.uid;
            refreshMyReviews(uid);
            refreshMyEscrowHours(uid);
            var buyerMap = {};
            var sellerMap = {};

            function mergeAndRender(){
                var merged = {};
                Object.values(buyerMap).forEach(function(o){ merged[o._id] = o; });
                Object.values(sellerMap).forEach(function(o){ merged[o._id] = o; });
                _allOrders = Object.values(merged);
                // sort by createdAt desc (newest first)
                _allOrders.sort(function(a,b){
                    var at = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
                    var bt = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
                    return bt - at;
                });
                renderOrders();
            }

            // Listener 1: where buyerId == uid (covers normal purchases + auction wins as buyer)
            try{
                _buyerUnsub = firebaseDB.collection('orders').where('buyerId','==', uid).onSnapshot(function(snap){
                    buyerMap = {};
                    snap.forEach(function(doc){
                        var d = doc.data(); d._id = doc.id; d._role = 'buyer';
                        buyerMap[d._id] = d;
                    });
                    mergeAndRender();
                }, function(err){
                    console.warn('buyer orders listen error', err);
                    // Fallback: try without real-time - one-time get (may fail if index missing, but show error)
                    firebaseDB.collection('orders').where('buyerId','==', uid).get().then(function(snap){
                        buyerMap = {};
                        snap.forEach(function(doc){ var d=doc.data(); d._id=doc.id; d._role='buyer'; buyerMap[d._id]=d; });
                        mergeAndRender();
                    }).catch(function(e){ console.warn('buyer get fallback failed', e); });
                });
            }catch(e){ console.warn('buyerUnsub setup failed', e); }

            // Listener 2: where sellerId == uid (covers sales including auction sales)
            try{
                _sellerUnsub = firebaseDB.collection('orders').where('sellerId','==', uid).onSnapshot(function(snap){
                    sellerMap = {};
                    snap.forEach(function(doc){
                        var d = doc.data(); d._id = doc.id; d._role = 'seller';
                        // If already in buyerMap (should not happen for distinct, but could if self-buy?) keep buyer role
                        if (!buyerMap[d._id]) sellerMap[d._id] = d;
                        else {
                            // mark as both
                            buyerMap[d._id]._role = 'both';
                        }
                    });
                    mergeAndRender();
                }, function(err){
                    console.warn('seller orders listen error', err);
                    firebaseDB.collection('orders').where('sellerId','==', uid).get().then(function(snap){
                        sellerMap = {};
                        snap.forEach(function(doc){ var d=doc.data(); d._id=doc.id; d._role='seller'; if(!buyerMap[d._id]) sellerMap[d._id]=d; });
                        mergeAndRender();
                    }).catch(function(e){ console.warn('seller get fallback failed', e); });
                });
            }catch(e){ console.warn('sellerUnsub setup failed', e); }
        });
    }
    tryInit();
}

// Pre-order journey — the buyer-facing twin of the admin stage buttons.
// Placed → Stock landed → Preparing → On its way → Delivered; pure markup.
var PO_STAGE_DEFS = [
    ['ordered', '📝', 'Placed'],
    ['stock_landed', '📦', 'Stock landed'],
    ['preparing', '🎁', 'Preparing'],
    ['dispatched', '🚚', 'On its way'],
    ['delivered', '✅', 'Delivered']
];
function poStageRankOf(o) {
    var st = String(o.status || 'pending').toLowerCase();
    if (st === 'delivered' || st === 'completed') return 4;
    if (o.preOrderStage) {
        for (var i = 0; i < PO_STAGE_DEFS.length; i++) if (PO_STAGE_DEFS[i][0] === o.preOrderStage) return i;
    }
    if (st === 'shipped') return 3;
    if (o.stockLandedAt || (o._raw && o._raw.stockLandedAt)) return 1;
    return 0;
}
function poStageStripHtml(o) {
    var rank = poStageRankOf(o);
    var h = '<div style="margin-top:0.35rem;display:flex;align-items:center;flex-wrap:wrap;row-gap:0.15rem;" title="Where your pre-order is — you get a bell alert at every gold step">';
    for (var i = 0; i < PO_STAGE_DEFS.length; i++) {
        var done = i <= rank, cur = i === rank;
        h += '<span style="display:inline-flex;align-items:center;gap:0.18rem;font-size:0.64rem;font-weight:' + (cur ? '800' : '600') + ';color:' + (done ? '#7a4a00' : '#9ca3af') + ';white-space:nowrap;">'
           + '<span style="width:17px;height:17px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:0.62rem;background:' + (done ? '#f5af02' : '#f3f4f6') + ';border:1.5px solid ' + (done ? '#e09e00' : '#e5e7eb') + ';">' + PO_STAGE_DEFS[i][1] + '</span>'
           + PO_STAGE_DEFS[i][2] + '</span>';
        if (i < PO_STAGE_DEFS.length - 1) h += '<span style="width:9px;height:2px;background:' + (i < rank ? '#f5af02' : '#e5e7eb') + ';margin:0 2px;"></span>';
    }
    return h + '</div>';
}

function renderOrders(){
    var container = document.getElementById('ordersList');
    if (!container) return;
    var filtered = _allOrders.filter(function(o){
        if (_currentFilter === 'all') return true;
        if (_currentFilter === 'auction') return !!o.isAuctionOrder || !!o.auctionId;
        return (o.status || 'pending') === _currentFilter;
    });

    if (_allOrders.length === 0){
        container.innerHTML = '<div class="empty-state" style="text-align:center;padding:2.5rem 1rem;background:#fff;border:1px solid #e5e7eb;border-radius:14px;">'
            + '<div style="width:56px;height:56px;border-radius:50%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;margin:0 auto;color:#9ca3af;font-size:1.5rem;"><i class="fas fa-shopping-bag"></i></div>'
            + '<h2 style="margin:0.9rem 0 0.3rem;font-size:1.17em;">No orders yet</h2>'
            + '<p style="color:#5a6572;font-size:0.85rem;max-width:420px;margin:0 auto;">When you win an auction, your order is <strong>auto-placed at your bid price</strong>. Any seller commission is deducted from the seller payout; your payment stays escrow protected. You\'ll also get a conversation to contact the seller.</p>'
            + '<a href="../../auction.html" style="display:inline-flex;align-items:center;gap:0.4rem;margin-top:1rem;background:#f5af02;color:#191919;padding:0.65rem 1.1rem;border-radius:8px;font-weight:800;text-decoration:none;"><i class="fas fa-gavel"></i> Browse Auctions</a> '
            + '<a href="../../search.html" style="display:inline-flex;align-items:center;gap:0.4rem;margin-top:1rem;background:#fff;border:1.5px solid #e5e7eb;color:#374151;padding:0.65rem 1.1rem;border-radius:8px;font-weight:700;text-decoration:none;margin-left:0.5rem;"><i class="fas fa-search"></i> Shop</a>'
            + '</div>';
        return;
    }
    if (filtered.length === 0){
        var label = _currentFilter === 'auction' ? 'No auction orders' : 'No ' + _currentFilter + ' orders';
        container.innerHTML = '<div style="text-align:center;padding:2rem;background:#fff;border:1px dashed #e5e7eb;border-radius:12px;color:#5a6572;">'
            + '<p style="margin:0;font-weight:600;">' + label + '</p><p style="margin:0.3rem 0 0;font-size:0.82rem;">Try “All Orders” to see everything.</p></div>';
        return;
    }

    var html = '<div style="display:flex;flex-direction:column;gap:0.9rem;">';
    filtered.forEach(function(o){
        // Pre-order journey strip — Placed → Stock landed → Preparing → On its
        // way → Delivered. Mirrors the admin's stage buttons so the buyer can
        // always see where their money is. Pure markup, zero extra reads.
        // (helpers live just above the render loop)
        var isAuction = !!o.isAuctionOrder || !!o.auctionId;
        var isPreOrder = o.isPreOrder === true;
        var preOrderWhen = '';
        if (isPreOrder && o.preOrderDate) {
            try { preOrderWhen = new Date(o.preOrderDate + 'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}); } catch(e) {}
        }
        var preOrderNote = (isPreOrder
            ? '<div style="margin-top:0.35rem;font-size:0.72rem;color:#8a6100;background:#fff7e0;border:1px solid #f5af02;border-radius:8px;padding:0.3rem 0.5rem;display:inline-block;">'
              + '<i class="fas fa-clock"></i> Pre-order — Sankofa Store dispatches when the stock lands'
              + (preOrderWhen ? ' (expected <strong>' + esc(preOrderWhen) + '</strong>)' : '')
              + (o.preOrderNote ? '. ' + esc(o.preOrderNote) : '') + '</div>'
            : '');
        var isBuyer = o._role === 'buyer' || o._role === 'both';
        var status = (o.status || 'pending').toLowerCase();
        var poStageStrip = (isPreOrder ? poStageStripHtml(o) : '');
        var statusColor = status==='delivered'?'#16a34a': status==='shipped'?'#0064d2': status==='processing'?'#f59e0b': status==='cancelled'?'#e74c3c': '#6b7280';
        var statusBg = status==='delivered'?'#f0fdf4': status==='shipped'?'#eff6ff': status==='processing'?'#fffbeb': status==='cancelled'?'#fef2f2': '#f3f4f6';
        var statusBorder = status==='delivered'?'#bbf7d0': status==='shipped'?'#bfdbfe': status==='processing'?'#fde68a': status==='cancelled'?'#fecaca': '#e5e7eb';
        var when = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : new Date();
        var whenStr = '';
        try{ whenStr = when.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) + ' • ' + when.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }catch(e){ whenStr=''; }
        var img = (typeof productThumb === 'function' && o.imagesThumb) ? o.imagesThumb[0]
                : (o.productImage || o.image || (o.images && o.images[0]) || '/images/placeholders/product.svg');
        var title = o.productTitle || o.title || 'Item';
        var price = o.amount || o.total || o.bidAmount || 0;
        var feeRate = o.commission != null ? Number(o.commission) : 5;
        var fee = o.commissionAmount != null ? Number(o.commissionAmount) : Math.round(price*feeRate/100*100)/100;
        var orderIdShort = (o._id||'').substring(0,8).toUpperCase();
        var roleBadge = isAuction ? (isBuyer ? '🏆 Auction Won' : '🔨 Auction Sold') : (isBuyer ? '🛒 Purchase' : '💰 Sale');
        var roleBg = isAuction ? (isBuyer ? '#f0fdf4' : '#fffbeb') : '#f8fafc';
        var roleBorder = isAuction ? (isBuyer ? '#bbf7d0' : '#fde68a') : '#e5e7eb';
        var roleColor = isAuction ? (isBuyer ? '#15803d' : '#92400e') : '#374151';
        var auctionLink = o.auctionId ? '<a href="../../auction-detail.html?id=' + o.auctionId + '" style="font-size:0.72rem;color:#0064d2;font-weight:700;text-decoration:none;"><i class="fas fa-gavel"></i> View Auction</a>' : '';
        var contactBtn = isBuyer
            ? '<a href="messages.html" style="background:#fff;border:1.5px solid #e5e7eb;color:#374151;padding:0.45rem 0.75rem;border-radius:8px;font-weight:700;font-size:0.78rem;text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem;"><i class="fas fa-comments"></i> Message ' + esc(o.sellerName||'Seller') + '</a>'
            : '<a href="messages.html" style="background:#fff;border:1.5px solid #e5e7eb;color:#374151;padding:0.45rem 0.75rem;border-radius:8px;font-weight:700;font-size:0.78rem;text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem;"><i class="fas fa-comments"></i> Message Buyer</a>';
        var payBtn = (isBuyer && (status==='pending') ) ? '<a href="../../payment.html?order=' + o._id + '" style="background:#0064d2;color:#fff;padding:0.45rem 0.75rem;border-radius:8px;font-weight:800;font-size:0.78rem;text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem;"><i class="fas fa-credit-card"></i> Pay Now</a>' : '';

        // ---- seller actions -------------------------------------------------
        // There was no way for a seller to say "I have sent it" / "it has arrived", which
        // meant the delivery clock never started and the 48-hour release had to be measured
        // from payment instead. These two buttons close that loop.
        var paidOk = (status==='paid' || status==='processing');
        var shipBtn = '', deliveredBtn = '', buyerHint = '', reviewBtn = '';
        if (!isBuyer) {
            if (paidOk) {
                shipBtn = '<button onclick="markOrderShipped(\'' + o._id + '\')" style="background:#0064d2;color:#fff;border:none;padding:0.45rem 0.75rem;border-radius:8px;font-weight:800;font-size:0.78rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.3rem;"><i class="fas fa-truck"></i> Mark as shipped</button>';
            } else if (status === 'shipped') {
                deliveredBtn = '<button onclick="markOrderDelivered(\'' + o._id + '\')" style="background:#16a34a;color:#fff;border:none;padding:0.45rem 0.75rem;border-radius:8px;font-weight:800;font-size:0.78rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.3rem;"><i class="fas fa-box-open"></i> Mark as delivered</button>';
            } else if (status === 'pending') {
                buyerHint = '<span style="font-size:0.7rem;color:#92400e;background:#fffbeb;border:1px solid #fde68a;padding:0.2rem 0.5rem;border-radius:6px;">Waiting for the buyer to pay</span>';
            }
        } else if (status === 'delivered') {
            buyerHint = '<a href="../../confirm-delivery.html?order=' + o._id + '" style="background:#16a34a;color:#fff;padding:0.45rem 0.75rem;border-radius:8px;font-weight:800;font-size:0.78rem;text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem;"><i class="fas fa-circle-check"></i> Confirm delivery</a>';
            // One review per order — after it exists, the pill shows the score and re-opens for edits
            var existingReview = _myReviews[o._id];
            reviewBtn = existingReview
                ? '<button onclick="leaveReview(\'' + o._id + '\')" title="Edit your review" style="background:#fffbeb;color:#92400e;border:1.5px solid #fde68a;padding:0.45rem 0.75rem;border-radius:8px;font-weight:800;font-size:0.78rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.3rem;"><span style="color:#f5af02;">★</span> ' + existingReview.rating + ' — reviewed</button>'
                : '<button onclick="leaveReview(\'' + o._id + '\')" style="background:#f5af02;color:#191919;border:none;padding:0.45rem 0.75rem;border-radius:8px;font-weight:800;font-size:0.78rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.3rem;"><i class="fas fa-star"></i> Leave a review</button>';
        }

        html += '<div class="order-card" data-status="' + status + '" data-auction="' + (isAuction?'1':'0') + '" style="background:#fff;border:1.5px solid ' + (isAuction ? '#fde68a' : '#e5e7eb') + ';border-radius:14px;overflow:hidden;">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.7rem 0.9rem;background:' + roleBg + ';border-bottom:1px solid ' + roleBorder + ';flex-wrap:wrap;gap:0.4rem;">'
            + '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">'
            + '<span style="background:' + statusBg + ';border:1px solid ' + statusBorder + ';color:' + statusColor + ';padding:0.2rem 0.5rem;border-radius:999px;font-size:0.68rem;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">' + status + '</span>'
            + '<span style="background:#fff;border:1px solid ' + roleBorder + ';color:' + roleColor + ';padding:0.2rem 0.5rem;border-radius:999px;font-size:0.68rem;font-weight:700;">' + roleBadge + '</span>'
            + (isPreOrder ? '<span class="preorder-badge"><i class="fas fa-clock"></i> Pre-order</span>' : '')
            + (isAuction ? '<span style="background:#f5af02;color:#191919;padding:0.2rem 0.5rem;border-radius:999px;font-size:0.65rem;font-weight:800;">' + (o.commission != null ? o.commission : 5) + '% fee • escrow</span>' : '')
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:0.6rem;font-size:0.7rem;color:#6b7280;"><span>#' + orderIdShort + '</span><span>•</span><span>' + whenStr + '</span></div>'
            + '</div>'
            + '<div style="display:flex;gap:0.9rem;padding:0.9rem;align-items:center;">'
            + '<img src="' + esc(img) + '" alt="' + esc(title) + '" style="width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb;flex-shrink:0;" onerror="this.src=\'/images/placeholders/product.svg\'">'
            + '<div style="flex:1;min-width:0;">'
            + '<div style="font-weight:800;font-size:0.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(title) + '</div>'
            + '<div style="font-size:0.78rem;color:#6b7280;margin-top:0.15rem;">' + (isAuction && isBuyer ? 'You won at bid price' : isAuction && !isBuyer ? 'You sold via auction' : isBuyer ? 'Seller: ' + esc(o.sellerName||'Seller') : 'Buyer: ' + esc(o.buyerName||'Buyer') ) + (auctionLink ? ' • ' + auctionLink : '') + '</div>'
            + preOrderNote
            + poStageStrip
            + '<div style="margin-top:0.35rem;display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;"><span style="font-weight:800;color:#0064d2;">GHS ' + Number(price).toLocaleString() + '</span>'
            + (isAuction ? '<span style="font-size:0.7rem;background:#f3f4f6;border:1px solid #e5e7eb;padding:0.15rem 0.4rem;border-radius:6px;color:#374151;">Fee GHS ' + Number(fee).toLocaleString() + ' • Payout GHS ' + Number(price - fee).toLocaleString() + '</span>' : '')
            + '</div>'
            + '</div>'
            + '<div style="display:flex;flex-direction:column;gap:0.4rem;align-items:flex-end;">' + contactBtn + payBtn + shipBtn + deliveredBtn + buyerHint + reviewBtn + '</div>'
            + '</div>'
            + '</div>';
    });
    html += '</div>';
    // Summary footer
    html += '<div style="margin-top:1rem;padding:0.8rem;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">'
        + '<span style="font-size:0.78rem;color:#6b7280;">Showing ' + filtered.length + ' of ' + _allOrders.length + ' orders' + (_currentFilter==='auction' ? ' • 🏆 Auctions only' : '') + '</span>'
        + '<span style="font-size:0.7rem;color:#5f6b7a;">Auction wins are auto-created — check Messages to arrange delivery</span>'
        + '</div>';
    container.innerHTML = html;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------------------------------------------------------------- seller actions */

/* ---- my escrow window: ◆ Diamond sellers are paid 24h after delivery instead of 48.
 * Read from the PUBLIC seller mirror (sellerPublic) — the server is the source of
 * truth; the mirror only makes the buttons' messages match the server's window. */
var _myEscrowHours = 48;
function refreshMyEscrowHours(uid){
    _myEscrowHours = 48;
    if (!uid || typeof firebaseDB === 'undefined' || !firebaseDB) return;
    firebaseDB.collection('sellerPublic').doc(uid).get().then(function(doc){
        if (!doc.exists) return;
        var m = doc.data() || {};
        var tier = String(m.tier || '').toLowerCase();
        var exp = m.premiumExpiry && m.premiumExpiry.toDate ? m.premiumExpiry.toDate() : (m.premiumExpiry ? new Date(m.premiumExpiry) : null);
        if (tier === 'diamond' && exp && exp.getTime() > Date.now()) _myEscrowHours = 24;
    }).catch(function(){ /* keep 48 */ });
}

/** The seller confirms the parcel is on its way (tracking number is optional). */
function markOrderShipped(orderId) {
    if (!orderId) return;
    var tracking = prompt('Mark this order as shipped?\n\nTracking / waybill number (optional):', '');
    if (tracking === null) return;                       // cancelled
    var payload = {
        status: 'shipped',
        shippedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (tracking.trim()) payload.trackingNumber = tracking.trim();

    orderAction(orderId, payload, 'Order marked as shipped' + (tracking.trim() ? ' (waybill ' + tracking.trim() + ')' : '') + '. The buyer can now see it is on the way.');
}

/** The seller confirms the buyer has the item — this starts the escrow clock
 *  (24h for ◆ Diamond sellers, 48h for everyone else). */
function markOrderDelivered(orderId) {
    if (!orderId) return;
    var hrs = _myEscrowHours || 48;
    var msg = 'Mark this order as delivered?\n\nThe buyer will be asked to confirm. If they do nothing, the money is released to your wallet ' + hrs + ' hours after this.' + (hrs === 24 ? '\n\n◆ Diamond: your escrow releases 2× faster.' : '');
    if (!confirm(msg)) return;
    orderAction(orderId, {
        status: 'delivered',
        deliveredAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, 'Marked as delivered. You are paid as soon as the buyer confirms — or automatically ' + hrs + ' hours from now.');
}

/** Shared writer + friendly error reporting. */
function orderAction(orderId, payload, successMessage) {
    if (typeof firebaseDB === 'undefined' || !firebaseDB) { showNotification('Not connected — please refresh', 'error'); return; }
    firebaseDB.collection('orders').doc(orderId).update(payload)
        .then(function () {
            showNotification(successMessage, 'success');
            // keep the local cache in step so the card redraws immediately
            for (var i = 0; i < _allOrders.length; i++) {
                if (_allOrders[i]._id === orderId) { Object.assign(_allOrders[i], { status: payload.status }); break; }
            }
            renderOrders();
        })
        .catch(function (err) {
            var msg = (err && err.message) || String(err);
            if (/permission|insufficient/i.test(msg)) {
                showNotification('Could not update this order — please sign in again and retry.', 'error');
            } else {
                showNotification('Could not update the order: ' + msg, 'error');
            }
        });
}

/* ---- Legacy stubs (keep for onclick handlers in old HTML) ---- */
function viewOrderDetails(orderId) {
    window.location.href = '../../payment.html?order=' + orderId;
}
function trackOrder(orderId) {
    showNotification('Tracking order #' + orderId.substring(0,8) + '…', 'info');
}
function contactSeller(sellerId) {
    window.location.href = 'messages.html?seller=' + sellerId;
}
function reorderItems(orderId) { showNotification('Reorder coming soon', 'info'); }

/* ============================================================================
   REVIEWS — rate a seller after a delivered order
   - one review per order (document id = orderId + '_' + uid, so it is naturally
     de-duplicated and re-openable for edits)
   - Firestore rules enforce: reviewer must be the order's buyer, no self-
     reviews, score 1–5. The cloud trigger then updates the product's
     averageRating/reviewCount and the seller's public sellerRatings mirror.
   ========================================================================== */
var _myReviews = {};
var _myReviewsLastFetch = 0;

function refreshMyReviews(uid) {
    if (typeof firebaseDB === 'undefined') return;
    var now = Date.now();
    if (now - _myReviewsLastFetch < 2000) return;   // snapshots fire often; don't refetch each time
    _myReviewsLastFetch = now;
    firebaseDB.collection('reviews').where('userId', '==', uid).get().then(function (snap) {
        var found = false;
        snap.forEach(function (d) {
            var r = d.data();
            if (r && r.orderId) { _myReviews[r.orderId] = r; found = true; }
        });
        if (found) renderOrders();
    }).catch(function (e) { console.warn('could not load my reviews', e); });
}

var REVIEW_WORDS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent' };

function leaveReview(orderId) {
    var o = _allOrders.filter(function (x) { return x._id === orderId; })[0];
    if (!o) return;
    if (typeof firebase === 'undefined' || !firebase.auth().currentUser) {
        showNotification('Sign in to leave a review', 'warning');
        return;
    }
    var existing = _myReviews[orderId] || null;
    var startRating = existing ? Number(existing.rating) : 0;
    var productTitle = o.productTitle || o.title || 'your purchase';

    // ---- build the modal ----
    var overlay = document.createElement('div');
    overlay.id = 'reviewModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:12000;display:flex;align-items:flex-end;justify-content:center;padding:0;';
    overlay.innerHTML =
        '<div style="background:#fff;width:100%;max-width:460px;border-radius:16px 16px 0 0;padding:1.1rem 1.2rem calc(1.2rem + env(safe-area-inset-bottom,0px));max-height:92vh;overflow-y:auto;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.6rem;">' +
                '<div>' +
                    '<h2 style="margin:0;font-size:1.1rem;">' + (existing ? 'Edit your review' : 'Rate your purchase') + '</h2>' +
                    '<p style="margin:0.2rem 0 0;font-size:0.82rem;color:#5a6572;">' + esc(productTitle) + '</p>' +
                '</div>' +
                '<button type="button" id="reviewCloseBtn" aria-label="Close" style="background:#f3f4f6;border:none;width:34px;height:34px;border-radius:50%;font-size:1rem;cursor:pointer;flex-shrink:0;"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '<div id="reviewStars" style="display:flex;gap:0.25rem;justify-content:center;margin:1.1rem 0 0.2rem;"></div>' +
            '<div id="reviewWord" style="text-align:center;font-size:0.85rem;font-weight:700;color:#92400e;min-height:1.2em;margin-bottom:0.6rem;"></div>' +
            '<input type="text" id="reviewTitle" maxlength="80" placeholder="Headline (optional) — e.g. Exactly as described" value="' + esc(existing && existing.title || '') + '" style="width:100%;box-sizing:border-box;border:1.5px solid #e5e7eb;border-radius:8px;padding:0.6rem 0.7rem;font-size:0.9rem;font-family:inherit;margin-bottom:0.5rem;">' +
            '<textarea id="reviewComment" rows="3" maxlength="600" placeholder="How was the item and dealing with the seller?" style="width:100%;box-sizing:border-box;border:1.5px solid #e5e7eb;border-radius:8px;padding:0.6rem 0.7rem;font-size:0.9rem;font-family:inherit;resize:vertical;">' + esc(existing && existing.comment || '') + '</textarea>' +
            '<div id="reviewError" style="display:none;color:#e74c3c;font-size:0.8rem;margin-top:0.4rem;"></div>' +
            '<button id="reviewSubmitBtn" disabled style="width:100%;margin-top:0.8rem;background:#f5af02;color:#191919;border:none;border-radius:10px;padding:0.8rem;font-weight:800;font-size:0.95rem;cursor:pointer;opacity:0.5;"><i class="fas fa-paper-plane"></i> Post review</button>' +
        '</div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    var rating = startRating;
    var starsBox = overlay.querySelector('#reviewStars');
    var wordEl = overlay.querySelector('#reviewWord');
    var submitBtn = overlay.querySelector('#reviewSubmitBtn');

    function paint() {
        starsBox.innerHTML = '';
        for (var i = 1; i <= 5; i++) {
            (function (n) {
                var s = document.createElement('button');
                s.type = 'button';
                s.setAttribute('aria-label', n + ' star' + (n > 1 ? 's' : ''));
                s.textContent = '★';
                s.style.cssText = 'background:none;border:none;font-size:2.2rem;cursor:pointer;padding:0.1rem;color:' + (n <= rating ? '#f5af02' : '#d1d5db') + ';';
                s.onclick = function () { rating = n; paint(); };
                starsBox.appendChild(s);
            })(i);
        }
        wordEl.textContent = rating ? REVIEW_WORDS[rating] : 'Tap a star — 1 is poor, 5 is excellent';
        submitBtn.disabled = !rating;
        submitBtn.style.opacity = rating ? '1' : '0.5';
    }
    paint();

    function closeModal() {
        overlay.remove();
        document.body.style.overflow = '';
    }
    overlay.querySelector('#reviewCloseBtn').onclick = closeModal;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

    submitBtn.onclick = function () {
        if (!rating) return;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting…';
        var errEl = overlay.querySelector('#reviewError');
        errEl.style.display = 'none';

        var me = firebase.auth().currentUser;
        var title = overlay.querySelector('#reviewTitle').value.trim();
        var comment = overlay.querySelector('#reviewComment').value.trim();
        var ref = firebaseDB.collection('reviews').doc(orderId + '_' + me.uid);

        ref.get().then(function (snap) {
            var write;
            if (snap.exists) {
                // revision — the rules only allow these keys to change
                write = ref.update({
                    rating: rating,
                    comment: comment,
                    title: title,
                    text: comment,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                write = ref.set({
                    orderId: orderId,
                    productId: o.productId || o.product_id || o.itemId || '',
                    sellerId: o.sellerId || '',
                    userId: me.uid,
                    userName: me.displayName || me.email || 'Buyer',
                    rating: rating,
                    comment: comment,
                    title: title,
                    text: comment,
                    images: [],
                    isVerifiedPurchase: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            return write;
        }).then(function () {
            _myReviews[orderId] = { rating: rating, comment: comment, title: title };
            closeModal();
            renderOrders();
            showNotification(existing ? 'Review updated — thanks!' : 'Thanks! Your review is live.', 'success');
        }).catch(function (e) {
            console.warn('review save failed', e);
            errEl.textContent = (e && e.code === 'permission-denied')
                ? 'This could not be posted. Reviews are only allowed on your own delivered orders.'
                : 'Could not post the review' + (e && e.message ? ': ' + e.message : '') + '. Please try again.';
            errEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post review';
        });
    };
}
function cancelOrder(orderId) {
    if (!confirm('Cancel order #' + orderId.substring(0,8) + '?')) return;
    if (typeof firebaseDB === 'undefined') return;
    firebaseDB.collection('orders').doc(orderId).update({status:'cancelled', updatedAt: firebase.firestore.FieldValue.serverTimestamp()}).then(function(){
        showNotification('Order cancelled', 'success');
    }).catch(function(e){ showNotification('Could not cancel: '+e.message,'error'); });
}
function completePayment(orderId) { window.location.href = '../../payment.html?order=' + orderId; }

function showNotification(message, type = 'info') {
    document.querySelectorAll('.order-notification').forEach(n => n.remove());
    const icons = { info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-circle', error: 'fa-times-circle' };
    const colors = { info: '#0064d2', success: '#16a34a', warning: '#f59e0b', error: '#e74c3c' };
    const notification = document.createElement('div');
    notification.className = 'order-notification';
    notification.style.cssText = 'position: fixed; top: 1rem; right: 1rem; z-index: 10000; background: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 0.75rem; border-left: 4px solid ' + colors[type] + '; max-width: 400px; animation: slideIn 0.3s ease;';
    notification.innerHTML = '<i class="fas ' + icons[type] + '" style="color: ' + colors[type] + '; font-size: 1.25rem;"></i><span style="font-size: 0.9rem;">' + message + '</span>';
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style'); style.id = 'notification-styles';
        style.textContent = '@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }';
        document.head.appendChild(style);
    }
    document.body.appendChild(notification);
    setTimeout(() => { notification.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => notification.remove(), 300); }, 3000);
}
