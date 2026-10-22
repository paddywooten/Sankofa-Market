/**
 * Payment Page JavaScript
 * Handles payment processing and form validation
 */

document.addEventListener('DOMContentLoaded', function() {
    initPaymentPage();
    // If a previous visit was charged but never recorded, say so immediately.
    try { renderPendingPaymentBanner(); } catch (e) { console.warn('pending banner', e); }
});

var PAYSTACK_PUBLIC_KEY = '';
async function loadPaystackKey(){
    try{
        if (typeof firebaseDB !== 'undefined' && firebaseDB){
            // Force server fetch to avoid stale cached live key after we switched to test — fallback to cache if offline
            let d=null, ps=null;
            try{ d = await firebaseDB.collection('settings').doc('premium').get({source:'server'}); }catch(e){ try{ d = await firebaseDB.collection('settings').doc('premium').get(); }catch(e2){} }
            if (d && d.exists && d.data().paystackPublicKey) PAYSTACK_PUBLIC_KEY = d.data().paystackPublicKey;
            try{ ps = await firebaseDB.collection('settings').doc('paystack').get({source:'server'}); }catch(e){ try{ ps = await firebaseDB.collection('settings').doc('paystack').get(); }catch(e2){} }
            if (!PAYSTACK_PUBLIC_KEY && ps && ps.exists && (ps.data().publicKey || ps.data().paystackPublicKey)) PAYSTACK_PUBLIC_KEY = ps.data().publicKey || ps.data().paystackPublicKey;
            // If still empty and we are on sankofa-market.web.app, fallback to test key for GHS testing (live GHS needs Paystack approval)
            if(!PAYSTACK_PUBLIC_KEY){
                PAYSTACK_PUBLIC_KEY = 'pk_test_c5ec8098c42f62cef3a9b31a86ff0d87cb98321c';
                console.warn('Paystack key fallback to TEST pk_test_... for GHS testing');
            }
        } else if(!PAYSTACK_PUBLIC_KEY){
            PAYSTACK_PUBLIC_KEY = 'pk_test_c5ec8098c42f62cef3a9b31a86ff0d87cb98321c';
        }
    }catch(e){ console.warn('Paystack key load failed', e); if(!PAYSTACK_PUBLIC_KEY) PAYSTACK_PUBLIC_KEY='pk_test_c5ec8098c42f62cef3a9b31a86ff0d87cb98321c'; }
    console.log('Paystack key', PAYSTACK_PUBLIC_KEY ? (PAYSTACK_PUBLIC_KEY.slice(0,12)+'...') : 'NOT SET (demo mode)', PAYSTACK_PUBLIC_KEY.includes('live')?'LIVE':'TEST');
}

function initPaymentPage() {
    // This file is also loaded by confirm-delivery.html — bail out when there is no
    // payment form on the page, otherwise the DOM lookups below throw.
    var isPaymentPage = !!document.getElementById('payButton') || !!document.querySelector('.payment-form-section');
    if (!isPaymentPage) return;

    // Load Paystack public key first (for real payments, not demo)
    loadPaystackKey();
    // If ?order=ID is present (auction win or existing order), load from Firebase instead of cart
    var params = new URLSearchParams(window.location.search);
    var orderId = params.get('order') || params.get('orderId') || params.get('id');
    if (orderId) {
        // Try Firebase order first; fallback to cart if fails (for backwards compat)
        loadOrderFromFirebase(orderId);
    } else {
        loadOrderFromCart();
    }
    
    // Each step is isolated: one problem must never stop the rest of the payment page.
    // (Before this, a single error here left the page showing demo numbers with a
    //  dead pay button and a payment-method selector that did nothing.)
    var steps = [
        ['payment methods', initPaymentMethodSwitching],
        ['form validation', initFormValidation],
        ['pay button', initPaymentProcessing],
        ['promo box', initPromoBox]
    ];
    steps.forEach(function (step) {
        try { step[1](); }
        catch (e) { console.error('Payment page: could not set up ' + step[0] + ':', e && e.message); }
    });
    // Retry loading Paystack key after Firebase ready (in case first load was before Firebase init)
    setTimeout(loadPaystackKey, 1500);
    setTimeout(loadPaystackKey, 3000);
}

// ============================================================================
// LOAD ORDER FROM FIREBASE (for auction wins & existing orders)
// ============================================================================
function loadOrderFromFirebase(orderId) {
    var container = document.getElementById('orderItems');
    if (container) container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:#5a6572;"><i class="fas fa-spinner fa-spin" style="font-size:1.4rem;color:#0064d2;"></i><p style="margin-top:0.6rem;">Loading order...</p></div>';
    
    var tries = 0;
    function tryLoad(){
        tries++;
        if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof firebaseAuth === 'undefined' || !firebaseAuth){
            if (tries < 25) { setTimeout(tryLoad, 500); return; }
            showFlashMessage('Firebase not ready — please refresh', 'error');
            return;
        }
        // Ensure auth state known
        var user = firebaseAuth.currentUser || (typeof firebase !== 'undefined' && firebase.auth().currentUser);
        if (!user && tries < 20){
            setTimeout(tryLoad, 600);
            return;
        }
        firebaseDB.collection('orders').doc(orderId).get().then(function(doc){
            if (!doc.exists){
                showFlashMessage('Order not found', 'error');
                if (container) container.innerHTML = '<div style="text-align:center;padding:2rem;color:#e74c3c;"><i class="fas fa-exclamation-triangle"></i><p>Order not found</p></div>';
                return;
            }
            var order = doc.data(); order._id = doc.id;
            // Security: only buyer/seller/admin can view — but we show anyway, pay button will be disabled if not buyer
            window._firebaseOrderId = orderId;
            window._firebaseOrder = order;
            
            // Auction order? Show bid price, not cart
            if (order.isAuctionOrder || order.auctionId){
                displayAuctionOrder(order);
                calculateAuctionTotals(order);
            } else {
                // Normal order with items array — try to display
                if (order.items && order.items.length){
                    displayOrderItems(order.items);
                    calculateTotals(order.items);
                    // Override totals with stored order totals if present (more accurate)
                    if (order.total) {
                        window.orderData.total = order.total;
                        // Null-safe writes: calculateTotals()/updatePayButtonLabel() rebuild the
                        // pay button, which REMOVES the #payAmount span — writing to it directly
                        // used to throw, fall into the catch below, and bounce the buyer to /search.
                        var setT = function (id, text) { var el = document.getElementById(id); if (el) el.textContent = text; };
                        setT('orderSubtotal', 'GHS ' + (order.subtotal||order.total).toLocaleString());
                        setT('orderTotal', 'GHS ' + order.total.toLocaleString());
                        setT('payAmount', 'GHS ' + order.total.toLocaleString());
                        // Rebuild the pay button label with the authoritative order total
                        if (typeof updatePayButtonLabel === 'function') updatePayButtonLabel();
                    }
                } else {
                    // Fallback single product
                    var single = [{ title: order.productTitle||order.title||'Item', image: order.productImage||order.image||'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2260%22%20height=%2260%22%3E%3Crect%20width=%2260%22%20height=%2260%22%20fill=%22%23e5e7eb%22/%3E%3C/svg%3E', price: order.amount||order.total||0, quantity: 1 }];
                    displayOrderItems(single);
                    calculateTotals(single);
                }
            }
            
            // If order already paid/delivered, disable pay
            if (order.status === 'paid' || order.paymentStatus === 'paid' || order.status === 'delivered' || order.status === 'completed'){
                var btn = document.getElementById('payButton');
                if (btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-check"></i> Already Paid'; }
                showFlashMessage('This order is already paid', 'info');
            }
            
            // If current user is not the buyer, warn
            var cu = firebaseAuth.currentUser || firebase.auth().currentUser;
            if (cu && order.buyerId && cu.uid !== order.buyerId){
                // Seller view — disable pay
                var btn2 = document.getElementById('payButton');
                if (btn2 && order.buyerId !== cu.uid){
                    // Only buyer can pay
                    btn2.disabled = true;
                    btn2.innerHTML = '<i class="fas fa-info-circle"></i> Only buyer can pay';
                    showFlashMessage('You are the seller — only the winner can pay for this auction', 'warning');
                }
            }
        }).catch(function(err){
            console.error('loadOrderFromFirebase error', err);
            showFlashMessage('Could not load order: '+err.message, 'error');
            if (container) container.innerHTML = '<div style="text-align:center;padding:2rem;color:#e74c3c;"><p>Error: '+err.message+'</p><a href="pages/user/orders.html" style="color:#0064d2;font-weight:700;">Go to My Orders</a></div>';
            // Fallback to cart
            loadOrderFromCart();
        });
    }
    tryLoad();
}

function displayAuctionOrder(order){
    var container = document.getElementById('orderItems');
    var img = order.productImage || order.image || '/images/placeholders/product.svg';
    var title = order.productTitle || order.title || 'Auction Item';
    var price = order.amount || order.total || order.bidAmount || 0;
    var feeRate = order.commission != null ? Number(order.commission) : 5;   // ◆ Diamond / 🏆 Founding = 0
    var fee = order.commissionAmount != null ? Number(order.commissionAmount) : Math.round(price*feeRate/100*100)/100;
    var auctionLink = order.auctionId ? '<a href="auction-detail.html?id=' + order.auctionId + '" style="font-size:0.75rem;color:#0064d2;font-weight:700;text-decoration:none;"><i class="fas fa-gavel"></i> View Auction</a>' : '';
    container.innerHTML = ''
        + '<div class="order-item" style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:0.8rem;">'
        + '  <div class="item-info" style="display:flex;gap:0.8rem;align-items:center;">'
        + '    <img src="' + img.replace(/"/g, '&quot;') + '" alt="' + escHtml(title) + '" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;" onerror="this.src=\'/images/placeholders/product.svg\'">'
        + '    <div style="flex:1;">'
        + '      <h4 style="margin:0;font-size:0.92rem;font-weight:800;">' + escHtml(title) + ' <span style="background:#f5af02;color:#191919;padding:0.15rem 0.4rem;border-radius:999px;font-size:0.6rem;font-weight:800;margin-left:0.3rem;">🏆 AUCTION WON</span></h4>'
        + '      <p style="margin:0.2rem 0 0;font-size:0.75rem;color:#92400e;">Winning bid price • ' + feeRate + '% fee' + (feeRate === 0 ? ' — seller keeps 100%' : '') + ' • escrow protected ' + auctionLink + '</p>'
        + '      <p style="margin:0.2rem 0 0;font-size:0.7rem;color:#6b7280;">Order #' + (order._id||'').substring(0,8).toUpperCase() + ' • Seller: ' + escHtml(order.sellerName||'Seller') + '</p>'
        + '    </div>'
        + '  </div>'
        + '  <div class="item-price" style="font-weight:800;color:#0064d2;">GHS ' + Number(price).toLocaleString() + '</div>'
        + '</div>';
    // Correct image src (above built wrong due to esc)
    setTimeout(function(){
        var el = container.querySelector('img');
        if (el) el.src = img;
    }, 50);
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function paymentEscape(s){ return s; }

function calculateAuctionTotals(order){
    var price = order.amount || order.total || order.bidAmount || 0;
    var feeRate = order.commission != null ? Number(order.commission) : 5;   // ◆ Diamond / 🏆 Founding = 0
    var fee = order.commissionAmount != null ? Number(order.commissionAmount) : Math.round(price*feeRate/100*100)/100;
    // For buyer, total is bid price (inclusive). Delivery free for auctions.
    var subtotal = price;
    var deliveryFee = 0;
    var serviceFee = 0;
    var total = price;
    document.getElementById('orderSubtotal').textContent = 'GHS ' + subtotal.toLocaleString();
    document.getElementById('orderDelivery').textContent = 'FREE';
    document.getElementById('orderService').textContent = 'GHS 0 (' + feeRate + '% fee: GHS ' + fee.toLocaleString() + ' included)';
    document.getElementById('orderTotal').textContent = 'GHS ' + total.toLocaleString();
    document.getElementById('payAmount').textContent = 'GHS ' + total.toLocaleString();
    // Store for payment processing — mark as auction order
    window.orderData = {
        isAuction: true,
        auctionId: order.auctionId,
        orderId: order._id,
        items: [{ title: order.productTitle, image: order.productImage, price: price, quantity: 1 }],
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        serviceFee: serviceFee,
        total: total,
        fee: fee,
        sellerPayout: price - fee
    };
}


// ============================================================================
// LOAD ORDER FROM CART
// ============================================================================

function loadOrderFromCart() {
    var items = readStoredCart();

    if (!items.length) {
        var box = document.getElementById('orderItems');
        if (box) box.innerHTML = '<div class="order-item"><div class="item-info"><div>' +
            '<h4>Your cart is empty</h4><p>Add an item before paying</p></div></div></div>';
        showFlashMessage('Your cart is empty \u2014 taking you to search\u2026', 'warning');
        setTimeout(function () { window.location.href = 'search.html'; }, 2000);
        return;
    }

    displayOrderItems(items);
    calculateTotals(items);

    // Show today's prices as soon as the page opens. The payment itself checks them again.
    if (typeof cartRefreshRows === 'function') {
        cartRefreshRows(items).then(function (fresh) {
            if (window._firebaseOrderId) return;                       // an order was opened meanwhile
            if (!fresh.changed.length && !fresh.unavailable.length) return;
            cartPersistPrices(fresh.items);
            displayOrderItems(fresh.items);
            calculateTotals(fresh.items);
            if (fresh.changed.length) showFlashMessage('Prices updated to today\u2019s prices.', 'info');
            if (fresh.unavailable.length) showFlashMessage('Some items cannot be bought as they are now: ' + fresh.unavailable.join('; ') + '.', 'warning');
        }).catch(function () {});
    }
}

/**
 * The cart is stored in localStorage as a plain ARRAY (see js/cart.js):
 *   [{ id, title, price, quantity, image, seller }]
 * The old code expected { items: [...] } which threw and killed the whole page setup.
 * Accept the array (and older shapes) and always return usable rows.
 */
function readStoredCart() {
    var raw = null;
    try { raw = localStorage.getItem('sankofa_cart'); } catch (e) { return []; }
    if (!raw) return [];
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return []; }
    var list = Array.isArray(parsed) ? parsed
             : (parsed && Array.isArray(parsed.items)) ? parsed.items
             : (parsed && Array.isArray(parsed.cart)) ? parsed.cart
             : [];
    return list.filter(function (i) {
        return i && (i.title || i.id) && i.price != null;
    }).map(function (i) {
        return {
            id: i.id || i.productId || i.title,
            productId: i.productId || null,
            sellerId: i.sellerId || null,
            variant: i.variant || null,
            title: i.title || 'Item',
            price: Number(i.price) || 0,
            quantity: Number(i.quantity) || 1,
            image: i.image || '/images/placeholders/product.svg',
            seller: i.seller || '',
            deliveryOptions: i.deliveryOptions || undefined,
            deliveryFee: i.deliveryFee
        };
    });
}

function displayOrderItems(items) {
    const orderItemsContainer = document.getElementById('orderItems');
    if (!orderItemsContainer) return;
    orderItemsContainer.innerHTML = items.map(item => `
        <div class="order-item">
            <div class="item-info">
                <img src="${item.image}" alt="${item.title}">
                <div>
                    <h4>${item.title}</h4>
                    ${item.variant && typeof variantLabel === 'function' ? `<p>${variantEsc(variantLabel(item.variant))}</p>` : ''}
                    <p>Qty: ${item.quantity}</p>
                </div>
            </div>
            <div class="item-price">GHS ${(item.price * item.quantity).toLocaleString()}</div>
        </div>
    `).join('');
}

function calculateTotals(items) {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Delivery is arranged with the seller - do NOT add an invented flat fee.
    // (A silent GHS 50 used to be added here, which made every total wrong.)
    const hasFreeDelivery = items.some(item => item.deliveryOptions && item.deliveryOptions.includes('free-delivery'));
    const deliveryFee = items.reduce((sum, item) => sum + (Number(item.deliveryFee) || 0), 0);
    
    // Service fee (optional - could be percentage or flat)
    const serviceFee = 0;

    // Tier 2 promo: the applied code's discount comes off the seller's items only.
    // The SERVER re-derives this number at pay time — here it is just a preview.
    const promoDiscount = (window.appliedPromo && window.appliedPromo.discount) || 0;
    const total = Math.max(0, Math.round((subtotal + deliveryFee + serviceFee - promoDiscount) * 100) / 100);

    // Update display
    // Store FIRST, so the pay button (and anything else) can read the real total
    window.orderData = {
        items: items,
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        serviceFee: serviceFee,
        promoDiscount: promoDiscount,
        total: total
    };

    const setText = function (id, text) { const el = document.getElementById(id); if (el) el.textContent = text; };
    setText('orderSubtotal', 'GHS ' + subtotal.toLocaleString());
    var promoRow = document.getElementById('orderPromoRow');
    if (promoRow) {
        promoRow.style.display = promoDiscount > 0 ? '' : 'none';
        if (promoDiscount > 0) {
            setText('orderPromoLabel', 'Promo ' + (window.appliedPromo.code || '') + ':');
            setText('orderPromo', '−GHS ' + promoDiscount.toLocaleString());
        }
    }
    setText('orderDelivery', hasFreeDelivery ? 'Free' : 'Arranged with seller');
    setText('orderService', 'GHS ' + serviceFee.toLocaleString());
    setText('orderTotal', 'GHS ' + total.toLocaleString());
    setText('payAmount', 'GHS ' + total.toLocaleString());
    updatePayButtonLabel();
}


// ============================================================================
// TIER 2 — STORE PROMO CODES on the checkout page
// The buyer types the seller's code; validateStorePromo (server) says what it
// saves on THIS cart; the real check re-runs inside the payment transaction.
// ============================================================================

function promoMsgShow(text, ok) {
    var el = document.getElementById('promoApplyMsg');
    if (!el) return;
    el.style.color = ok ? '#065f46' : '#b91c1c';
    el.innerHTML = paymentEscape ? paymentEscape(String(text)) : String(text);
}

function clearAppliedPromo(reason) {
    window.appliedPromo = null;
    if (reason) promoMsgShow(reason, false);
    if (window.orderData && window.orderData.items) calculateTotals(window.orderData.items);
}

async function applyPromoCode() {
    var input = document.getElementById('promoCodeInput');
    var btn = document.getElementById('promoApplyBtn');
    var code = ((input && input.value) || '').trim().toUpperCase();
    if (!code) { promoMsgShow('Type the code exactly as the seller shared it.', false); return; }

    var items = (window.orderData && window.orderData.items) || readStoredCart();
    if (!items.length) { promoMsgShow('Your cart is empty — add an item first.', false); return; }

    if (typeof firebase === 'undefined' || !firebase.auth().currentUser) {
        promoMsgShow('Sign in to use a promo code.', false); return;
    }
    if (typeof firebase.functions === 'undefined') {
        promoMsgShow('Payment service is still loading — try again in a moment.', false); return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
    try {
        var res = await firebase.functions().httpsCallable('validateStorePromo')({
            code: code,
            items: items.map(function (i) {
                return { sellerId: i.sellerId || null, price: Number(i.price) || 0, quantity: Number(i.quantity) || 1 };
            })
        });
        var d = (res && res.data) || {};
        if (!d.ok) { clearAppliedPromo(d.error || 'That code does not work on this order.'); return; }
        window.appliedPromo = { code: d.code, percentOff: d.percentOff, discount: d.discount, ownerName: d.ownerName };
        promoMsgShow('✅ ' + d.code + ' applied — ' + d.percentOff + '% off ' + (d.ownerName ? '"' + d.ownerName + '" ' : '') +
            'items. You save GHS ' + Number(d.discount).toLocaleString() + '!', true);
        if (window.orderData && window.orderData.items) calculateTotals(window.orderData.items);
        if (typeof showFlashMessage === 'function') showFlashMessage('Promo applied — you save GHS ' + Number(d.discount).toLocaleString() + ' 🎉', 'success');
    } catch (e) {
        clearAppliedPromo(e && e.message ? e.message : 'Could not check that code — try again.');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Apply'; }
    }
}

function initPromoBox() {
    var btn = document.getElementById('promoApplyBtn');
    if (!btn || btn._wired) return;
    btn._wired = true;
    btn.addEventListener('click', function () { applyPromoCode().catch(function () {}); });
    var input = document.getElementById('promoCodeInput');
    if (input) input.addEventListener('keydown', function (ev) {
        if (ev && ev.key === 'Enter') { ev.preventDefault(); applyPromoCode().catch(function () {}); }
    });
}
window.applyPromoCode = applyPromoCode;
window.clearAppliedPromo = clearAppliedPromo;

// ============================================================================
// PAYMENT METHOD SWITCHING
// ============================================================================

function initPaymentMethodSwitching() {
    const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
    const momoDetails = document.getElementById('momoDetails');   // legacy (removed) — null-safe guards stay
    const cardDetails = document.getElementById('cardDetails');   // legacy (removed)
    const walletHint = document.getElementById('walletPayHint');
    const paystackNote = document.getElementById('paystackNote');
    if (!paymentMethods.length) return;

    paymentMethods.forEach(method => {
        method.addEventListener('change', function() {
            if (this.value === 'wallet') {
                if (momoDetails) momoDetails.style.display = 'none';
                if (cardDetails) cardDetails.style.display = 'none';
                if (walletHint) walletHint.style.display = 'block';
                if (paystackNote) paystackNote.style.display = 'none';
                setRequiredFields('wallet');
                updateWalletPayDesc();
            } else { // 'paystack' — no local detail forms at all
                if (momoDetails) momoDetails.style.display = 'none';
                if (cardDetails) cardDetails.style.display = 'none';
                if (walletHint) walletHint.style.display = 'none';
                if (paystackNote) paystackNote.style.display = 'block';
                setRequiredFields('paystack');
            }

            updatePayButtonLabel();
            validateForm();
        });
    });
    // Init wallet desc
    updateWalletPayDesc();
    setTimeout(updateWalletPayDesc, 1500);
}

async function updateWalletPayDesc(){
    const el = document.getElementById('walletPayDesc');
    if (!el) return;
    if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof firebaseAuth === 'undefined' || !firebaseAuth.currentUser){
        el.textContent = 'Sign in to see balance • Top up once, pay 0% thereafter';
        return;
    }
    try{
        const uid = firebaseAuth.currentUser.uid;
        const doc = await firebaseDB.collection('wallets').doc(uid).get();
        const bal = doc.exists ? (doc.data().balance||0) : 0;
        const total = window.orderData ? window.orderData.total : 0;
        if (total && bal < total){
            el.innerHTML = `Balance: <span style="color:#dc2626;font-weight:800;">GHS ${bal.toLocaleString()}</span> • Need GHS ${total.toLocaleString()} — <a href="pages/user/wallet.html" style="color:#0064d2;font-weight:700;">top up</a>`;
        } else {
            el.textContent = `Balance: GHS ${bal.toLocaleString()} • Top up once, pay 0% thereafter`;
        }
        // Auto-select wallet if sufficient
        if (total && bal >= total){
            const walletOpt = document.querySelector('input[value="wallet"]');
            // Don't auto-switch, just hint, but make wallet attractive
        }
    }catch(e){ el.textContent = 'Balance: — • Top up once, pay 0% thereafter'; }
}

function setRequiredFields(method) {
    // Merged Paystack checkout (2026-10-05): NO payment details are collected
    // on this page anymore — Paystack's own page asks for card or MoMo. The
    // legacy field ids are kept here so any cached page shell simply no-ops.
    const legacyFields = ['momoNetwork', 'momoPhone', 'momoName', 'cardNumber', 'cardExpiry', 'cardCVV', 'cardName'];
    legacyFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) field.required = false;
    });
}

// ============================================================================
// FORM VALIDATION
// ============================================================================

function initFormValidation() {
    const form = document.querySelector('.payment-form-section');
    if (!form) return;
    const inputs = form.querySelectorAll('input, select');
    const acknowledgeCheckbox = document.getElementById('acknowledgeWarning');

    inputs.forEach(input => {
        input.addEventListener('input', validateForm);
        input.addEventListener('change', validateForm);
    });

    if (acknowledgeCheckbox) acknowledgeCheckbox.addEventListener('change', validateForm);
    
    // Initial validation
    validateForm();
}

function validateForm() {
    const methodInput = document.querySelector('input[name="paymentMethod"]:checked');
    if (!methodInput) return false;        // no payment form on this page
    const paymentMethod = methodInput.value;
    const acknowledgeCheckbox = document.getElementById('acknowledgeWarning');
    const payButton = document.getElementById('payButton');
    if (!acknowledgeCheckbox) return false;

    let isValid = true;

    // The only thing WE still require: the protection-terms tick. Every
    // payment detail (card or MoMo) is answered on Paystack's page, not ours.
    if (!acknowledgeCheckbox.checked) {
        isValid = false;
    }
    // 'paystack' and 'wallet' both need no local fields; wallet balance and
    // Paystack amounts are enforced server-side, never trustingly here.

    // Enable/disable pay button
    payButton.disabled = !isValid;
    
    return isValid;
}

// (Card/MoMo local validation & formatting lived here once — deleted when the
// two options merged into one Paystack checkout. Details are entered on
// Paystack's own secure page now, so they never cross our code at all.)

// ============================================================================
// PAYMENT PROCESSING
// ============================================================================

function updatePayButtonLabel() {
    var payButton = document.getElementById('payButton');
    if (!payButton) return;
    var total = (window.orderData && window.orderData.total != null) ? window.orderData.total : 0;
    var methodInput = document.querySelector('input[name="paymentMethod"]:checked');
    var method = methodInput ? methodInput.value : 'paystack';
    var via = method === 'wallet' ? 'Sankofa Wallet' : 'Paystack (card or MoMo)';
    payButton.innerHTML = '<i class="fas fa-lock"></i> Pay GHS ' + Number(total).toLocaleString() + ' with ' + via;
}

function initPaymentProcessing() {
    const payButton = document.getElementById('payButton');
    if (!payButton) return;
    
    payButton.addEventListener('click', async function() {
        if (!validateForm()) {
            showFlashMessage('Please fill in all required fields', 'error');
            return;
        }

        await processPayment();
    });
}

/** The item's title with its choice, for order titles and emails: "Sneakers (Size: M, Colour: Red)". */
function checkoutTitle(item) {
    var t = (item && item.title) || null;
    var label = (item && item.variant && typeof variantLabel === 'function') ? variantLabel(item.variant) : '';
    return t && label ? t + ' (' + label + ')' : t;
}

/** A message for the buyer that is not an error: nothing was charged, and the buyer should look again. */
function checkoutNotice(msg) {
    var e = new Error(msg);
    e.notice = true;
    return e;
}

async function processPayment() {
    const payButton = document.getElementById('payButton');
    if (!payButton) return;
    const originalText = payButton.innerHTML;
    
    try {
        // Disable button and show loading
        payButton.disabled = true;
        payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Payment...';

        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

        // A cart checkout has no order yet, so its prices come from the cart. Bring them in line with
        // the live listings BEFORE any money moves, and stop if they moved, so the buyer sees the new total.
        // (An existing order cannot be re-priced; the server checks it when it is paid.)
        if (!window._firebaseOrderId) {
            var fresh;
            try {
                fresh = await cartRefreshRows((window.orderData && window.orderData.items) || []);
            } catch (e) {
                throw checkoutNotice('Could not check today\u2019s prices. Nothing was charged \u2014 check your connection and try again.');
            }
            if (fresh.unavailable.length) {
                throw checkoutNotice('These cannot be bought as they are now: ' + fresh.unavailable.join('; ') + '. Remove them from your cart and add them again.');
            }
            cartPersistPrices(fresh.items);
            calculateTotals(fresh.items);                       // updates the totals on screen and window.orderData
            if (fresh.changed.length) {
                throw checkoutNotice('Prices were updated: ' + fresh.changed.map(function (c) {
                    return c.title + ' is now GHS ' + c.to.toLocaleString();
                }).join('; ') + '. Check the new total, then press pay again.');
            }
        }
        const orderData = window.orderData;

        let paymentData = {
            method: paymentMethod,
            amount: orderData.total,
            items: orderData.items,
            timestamp: new Date().toISOString()
        };

        if (paymentMethod === 'wallet') {
            await processWalletPayment(paymentData);
        } else {
            // 'paystack' — one secure checkout for card AND MoMo; the payer
            // picks the method and types everything on Paystack's own page.
            await initiatePaystackPayment(paymentData);
        }

    } catch (error) {
        console.error('Payment error:', error);
        var msg = error && error.message ? error.message : String(error);
        if (error && error.notice) {
            showFlashMessage(msg, 'warning');
        } else if (/no longer matches the live listings/.test(msg)) {
            showFlashMessage(msg, 'warning');                  // the server says what happened to the money
        } else if (msg.indexOf('Paystack not configured - demo cancelled')!==-1){
            showFlashMessage('Payment cancelled', 'info');
        } else if (msg.indexOf('already paid')!==-1){
            showFlashMessage(msg, 'info');
        } else {
            showFlashMessage('Payment failed: '+msg, 'error');
        }
        // Re-enable button
        if (payButton){ payButton.disabled = false; payButton.innerHTML = originalText; validateForm(); }
    }
}

// (processMomoPayment / processCardPayment were wrappers that both funnelled
// into initiatePaystackPayment — removed in the merge; callers now use the
// single Paystack path above.)

/**
 * Create the buyer's order in a PENDING state (nothing paid yet).
 * Used by the wallet flow, which needs an order id before it can move money.
 * The Paystack flow creates its order inline inside completePayment().
 */
async function createPendingCartOrder(paymentData){
    if (typeof firebase === 'undefined' || !firebase.auth().currentUser) throw new Error('Please sign in before paying');
    var uid = firebase.auth().currentUser.uid;
    var itemList = paymentData.items || [];
    var sellerId = null, sellerName = null, firstTitle = null;
    var preOrderInfo = null;  // filled below if ANY item is a Sankofa Store pre-order
    try {
        if (itemList.length) firstTitle = checkoutTitle(itemList[0]);
        var found = {};
        for (var i = 0; i < itemList.length && i < 10; i++) {
            var pid = itemList[i].productId || itemList[i].id;
            if (!pid || String(pid).indexOf('local-') === 0) continue;
            var pdoc = await firebase.firestore().collection('products').doc(pid).get();
            if (pdoc.exists) {
                var pd = pdoc.data();
                if (pd.preOrder === true) {
                    preOrderInfo = { isPreOrder: true, preOrderDate: pd.preOrderDate || null, preOrderNote: pd.preOrderNote || null };
                }
                if (pd.sellerId) {
                    found[pd.sellerId] = pd;
                    // stamp the seller on the row so a mixed cart can be split per seller server-side
                    itemList[i].sellerId = pd.sellerId;
                    itemList[i].seller = itemList[i].seller || pd.sellerName || pd.storeName || null;
                }
            }
        }
        var keys = Object.keys(found);
        if (keys.length === 1) { sellerId = keys[0]; sellerName = found[keys[0]].sellerName || found[keys[0]].storeName || null; }
    } catch (e) { console.warn('could not resolve seller for this cart', e); }

    return await firebase.firestore().collection('orders').add({
        buyerId: uid,
        userId: uid,
        buyerName: firebase.auth().currentUser.displayName || firebase.auth().currentUser.email || 'Buyer',
        items: cleanForFirestore(itemList),
        sellerId: sellerId,
        isPreOrder: preOrderInfo ? true : false,
        preOrderDate: preOrderInfo ? preOrderInfo.preOrderDate : null,
        preOrderNote: preOrderInfo ? preOrderInfo.preOrderNote : null,
        sellerName: sellerName,
        productTitle: firstTitle,
        paymentMethod: 'wallet',
        promo: window.appliedPromo ? {
            code: String(window.appliedPromo.code || ''),
            percentOff: Number(window.appliedPromo.percentOff) || 0,
            discount: Number(window.appliedPromo.discount) || 0
        } : null,
        subtotal: window.orderData ? window.orderData.subtotal : null,
        deliveryFee: window.orderData ? window.orderData.deliveryFee : null,
        serviceFee: window.orderData ? window.orderData.serviceFee : null,
        total: window.orderData ? window.orderData.total : 0,
        currency: 'GHS',
        status: 'pending',
        paymentStatus: 'pending',
        escrowStatus: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function processWalletPayment(paymentData){
    const total = window.orderData ? window.orderData.total : 0;
    if (!(await ensureFunctionsSdk())) {
        showFlashMessage('Wallet payments need the payment service — check your connection and try again.', 'error');
        throw new Error('Payment service unreachable');
    }

    // A cart checkout has no order yet, so we create one first and then move the money.
    // (Before, choosing "Sankofa Wallet" on a normal cart always failed with "only available
    // for existing orders", so the 0% fee option on the payment page could never be used.)
    let orderId = window._firebaseOrderId;
    let createdOrderRef = null;
    let walletBalance = null;
    try {
        if (typeof firebaseDB !== 'undefined' && firebaseDB && firebaseAuth && firebaseAuth.currentUser){
            const wDoc = await firebaseDB.collection('wallets').doc(firebaseAuth.currentUser.uid).get();
            if (wDoc.exists) walletBalance = Number(wDoc.data().balance || 0);
        }
    } catch(e){}

    if (walletBalance != null && walletBalance < total){
        const go = confirm('Your Sankofa Wallet balance is GHS ' + walletBalance.toLocaleString() +
            ' but this order is GHS ' + Number(total).toLocaleString() +
            '.\n\nTop up the difference in your wallet?');
        if (go) window.location.href = '/pages/user/wallet.html';
        throw new Error('Insufficient wallet balance');
    }

    if (!orderId){
        if (!confirm('Pay GHS ' + Number(total).toLocaleString() + ' from your Sankofa Wallet?\n\n0% fee on wallet payments. The money is held in escrow until you confirm delivery.')){
            throw new Error('Wallet payment cancelled');
        }
        createdOrderRef = await createPendingCartOrder(paymentData);
        orderId = createdOrderRef.id;
        window._firebaseOrderId = orderId;
        window._firebaseOrder = { id: orderId, total: total, status: 'pending', paymentStatus: 'pending' };
    } else if (!confirm(`Pay GHS ${total.toLocaleString()} from Sankofa Wallet?\n\n0% payment fee — the money is held in escrow until you confirm delivery (it auto-releases 24h after delivery for ◆ Diamond sellers, 48h otherwise).`)){
        throw new Error('Wallet payment cancelled');
    }
    const payButton = document.getElementById('payButton');
    if (payButton){ payButton.disabled=true; payButton.innerHTML='<i class="fas fa-spinner fa-spin"></i> Paying with wallet...'; }
    try{
        if (typeof firebase === 'undefined' || !firebase.functions) throw new Error('Firebase Functions not ready');
        const fn = firebase.functions().httpsCallable('payWithWallet');
        const res = await fn({ orderId });
        showFlashMessage(`Paid GHS ${res.data.amount.toLocaleString()} with wallet — new balance GHS ${res.data.balance.toLocaleString()}`, 'success');
        // Update local order cache
        if (window._firebaseOrder){ window._firebaseOrder.status='paid'; window._firebaseOrder.paymentStatus='paid'; }
        if (createdOrderRef){ try { localStorage.removeItem('sankofa_cart'); } catch(e){} }
        setTimeout(()=>{ window.location.href = `order-confirmation.html?orderId=${orderId}`; }, 1200);
    }catch(e){
        console.error('wallet pay error', e);
        const msg = e.message || String(e);
        if (msg.includes('Insufficient wallet balance')){
            if (confirm(msg + '\n\nTop up wallet now?')) window.location.href = 'pages/user/wallet.html';
        }
        // Don't leave a half-finished order behind if the wallet payment never went through.
        if (createdOrderRef){
            try { await createdOrderRef.delete(); } catch(x){ console.warn('could not remove the unpaid order', x); }
            window._firebaseOrderId = null; window._firebaseOrder = null;
        }
        throw e;
    }
}

async function initiatePaystackPayment(paymentData){
    var total = window.orderData ? window.orderData.total : 0;
    if (!total || total < 1) { showFlashMessage('Invalid amount', 'error'); throw new Error('Invalid amount'); }
    var payButton = document.getElementById('payButton');
    var originalText = payButton ? payButton.innerHTML : '';
    
    // Ensure Paystack key is loaded (retry if still empty)
    if (!PAYSTACK_PUBLIC_KEY){
        await loadPaystackKey();
    }
    // Bring in the checkout SDK on demand (it is no longer loaded on every page view)
    if (typeof PaystackPop === 'undefined') {
        if (payButton){ payButton.disabled = true; payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading secure checkout...'; }
        await ensurePaystackSdk();
        if (payButton){ payButton.disabled = false; payButton.innerHTML = originalText; }
    }
    // FAIL CLOSED. There used to be a "demo mode" here that popped up a confirm box and then
    // marked the order PAID without any money changing hands — a free order for anyone who
    // clicked OK. If the gateway will not load, we refuse to take the order as paid.
    if (!PAYSTACK_PUBLIC_KEY || typeof PaystackPop === 'undefined'){
        if (payButton){ payButton.disabled=false; payButton.innerHTML=originalText; validateForm(); }
        showFlashMessage('Card payments could not start (the payment window did not load). Nothing was charged. Please refresh the page (Ctrl+Shift+R) and try again, or use the Sankofa Wallet.', 'error');
        throw new Error('Payment gateway unavailable');
    }
    
    // Get user email
    var user = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : (typeof firebase !== 'undefined' && firebase.auth().currentUser);
    var email = user ? user.email : 'buyer@sankofa.market';
    var orderId = window._firebaseOrderId || ('CART-'+Date.now());
    var reference = 'SANKOFA-'+ orderId.slice(0,8).toUpperCase() +'-'+ Date.now();
    var amountKobo = Math.round(total * 100);
    
    showFlashMessage('Opening Paystack — GHS ' + total.toLocaleString() + '...', 'info');
    if (payButton){ payButton.disabled=true; payButton.innerHTML='<i class="fas fa-spinner fa-spin"></i> Opening Paystack...'; }
    
    return new Promise(function(resolve, reject){
        try{
            var handler = PaystackPop.setup({
                key: PAYSTACK_PUBLIC_KEY,
                email: email,
                amount: amountKobo,
                currency: 'GHS',
                ref: reference,
                metadata: {
                    custom_fields: [
                        { display_name: 'Order', variable_name: 'order_id', value: orderId },
                        { display_name: 'Platform', variable_name: 'platform', value: 'Sankofa Market' }
                    ]
                },
                callback: function(response){
                    console.log('Paystack success', response);
                    showFlashMessage('Paystack verified: ' + response.reference + ' — completing order...', 'success');
                    // Pass reference to completePayment via paymentData
                    paymentData.paystackReference = response.reference;
                    completePayment(paymentData).then(resolve).catch(reject);
                },
                onClose: function(){
                    showFlashMessage('Paystack closed — payment not completed', 'warning');
                    if (payButton){ payButton.disabled=false; payButton.innerHTML=originalText; validateForm(); }
                    reject(new Error('Paystack closed'));
                }
            });
            handler.openIframe();
        }catch(e){
            console.error('Paystack setup error', e);
            showFlashMessage('Paystack error: '+e.message, 'error');
            if (payButton){ payButton.disabled=false; payButton.innerHTML=originalText; }
            reject(e);
        }
    });
}

async function completePayment(paymentData) {
    var payButton2 = document.getElementById('payButton');
    var origText2 = payButton2 ? payButton2.innerHTML : '';
    try {
        // The Paystack reference is the receipt. Without it nothing gets marked as paid.
        var reference = paymentData.paystackReference
            || (paymentData.paymentData && paymentData.paymentData.reference) || null;

        if (!reference) {
            showFlashMessage('We could not confirm this payment (no Paystack reference came back). Nothing was marked as paid. If you were charged, email sankofamarketgh@gmail.com with your receipt.', 'error');
            if (payButton2){ payButton2.disabled=false; payButton2.innerHTML=origText2; }
            throw new Error('Missing Paystack reference');
        }
        // The reference is the receipt — save it BEFORE we try to record it, so a crash,
        // a closed tab or a dropped connection can never lose a payment.
        savePendingPayment({
            reference: reference,
            orderId: window._firebaseOrderId || null,
            orderData: {
                items: (window.orderData && window.orderData.items) || (paymentData && paymentData.items) || [],
                subtotal: window.orderData && window.orderData.subtotal,
                deliveryFee: window.orderData && window.orderData.deliveryFee,
                serviceFee: window.orderData && window.orderData.serviceFee,
                total: window.orderData && window.orderData.total,
                method: paymentData && paymentData.method
            },
            at: Date.now()
        });

        if (!(await ensureFunctionsSdk())) {
            if (payButton2){ payButton2.disabled=false; payButton2.innerHTML=origText2; }
            showFlashMessage('You were charged but we could not reach the server to record it. Reference ' + reference + ' is saved on this device — reopen this page and tap "Finish this payment".', 'error');
            throw new Error('Payment service unreachable — your reference is saved');
        }
        var confirmFn = firebase.functions().httpsCallable('confirmPaystackPayment');

        // ---- A) paying for an order that already exists (auction win, etc.) ----
        if (window._firebaseOrderId && window._firebaseOrder){
            var orderId = window._firebaseOrderId;

            var existingStatus = (window._firebaseOrder.status||'').toLowerCase();
            var existingPayStatus = (window._firebaseOrder.paymentStatus||'').toLowerCase();
            if (existingStatus==='paid' || existingPayStatus==='paid'){
                showFlashMessage('This order is already paid — redirecting...', 'info');
                setTimeout(()=>{ window.location.href = `order-confirmation.html?orderId=${orderId}`; }, 1200);
                if (payButton2){ payButton2.disabled=false; payButton2.innerHTML=origText2; }
                return;
            }

            if (payButton2){ payButton2.disabled=true; payButton2.innerHTML='<i class="fas fa-spinner fa-spin"></i> Confirming payment...'; }

            // The server re-verifies this reference with Paystack, checks the amount matches the
            // order, and checks the reference has never been used before. It is the only thing
            // allowed to write status: 'paid'.
            var res = await confirmFn({ orderId: orderId, reference: reference });
            clearPendingPayment();
            var amt = (res.data && res.data.amount) || window.orderData.total;

            window._firebaseOrder.status='paid'; window._firebaseOrder.paymentStatus='paid';
            showFlashMessage('Payment successful! 🎉 Escrow now holds GHS ' + Number(amt).toLocaleString(), 'success');
            if (payButton2){ payButton2.disabled=true; payButton2.innerHTML='<i class="fas fa-check"></i> Paid — redirecting...'; }
            setTimeout(function(){ window.location.href = `order-confirmation.html?orderId=${orderId}`; }, 1500);
            return;
        }

        // ---- B) normal cart checkout — create the order, then confirm the payment ----
        if (typeof firebase === 'undefined' || !firebase.auth().currentUser) {
            throw new Error('Please sign in before paying');
        }
        var uid = firebase.auth().currentUser.uid;
        var payMethod = paymentData.method;
        // Paystack holds all the sensitive bits — even we only keep the reference.
        var payDetail = { reference: reference, method: payMethod };

        // Work out which seller this order belongs to so the escrow can be released later.
        // A cart with items from one seller stores that seller; a mixed cart is left blank
        // (Sankofa support settles those by hand until multi-seller payouts exist).
        var sellerId = null, sellerName = null, firstTitle = null;
    var preOrderInfo = null;  // filled below if ANY item is a Sankofa Store pre-order
        try {
            var itemList = paymentData.items || [];
            if (itemList.length) firstTitle = checkoutTitle(itemList[0]);
            var found = {};
            for (var i = 0; i < itemList.length && i < 10; i++) {
                var pid = itemList[i].productId || itemList[i].id;
                if (!pid || String(pid).indexOf('local-') === 0) continue;
                var pdoc = await firebase.firestore().collection('products').doc(pid).get();
                if (pdoc.exists) {
                    var pd = pdoc.data();
                if (pd.preOrder === true) {
                    preOrderInfo = { isPreOrder: true, preOrderDate: pd.preOrderDate || null, preOrderNote: pd.preOrderNote || null };
                }
                    if (pd.sellerId) {
                        found[pd.sellerId] = pd;
                        // remember it on the row so the server can split a mixed cart per seller
                        itemList[i].sellerId = pd.sellerId;
                        itemList[i].seller = itemList[i].seller || pd.sellerName || pd.storeName || null;
                    }
                }
            }
            var keys = Object.keys(found);
            if (keys.length === 1) {
                sellerId = keys[0];
                sellerName = found[keys[0]].sellerName || found[keys[0]].storeName || null;
            }
        } catch (e) { console.warn('could not resolve seller for this cart', e); }

        // The order starts as 'pending'. Only confirmPaystackPayment may move it to 'paid'.
        var orderRef = await firebase.firestore().collection('orders').add({
            buyerId: uid,
            userId: uid,
            buyerName: firebase.auth().currentUser.displayName || firebase.auth().currentUser.email || 'Buyer',
            items: cleanForFirestore(paymentData.items),
            sellerId: sellerId,
        isPreOrder: preOrderInfo ? true : false,
        preOrderDate: preOrderInfo ? preOrderInfo.preOrderDate : null,
        preOrderNote: preOrderInfo ? preOrderInfo.preOrderNote : null,
            sellerName: sellerName,
            productTitle: firstTitle,
            paymentMethod: payMethod,
            paymentData: payDetail,
            promo: window.appliedPromo ? {
                code: String(window.appliedPromo.code || ''),
                percentOff: Number(window.appliedPromo.percentOff) || 0,
                discount: Number(window.appliedPromo.discount) || 0
            } : null,
            subtotal: window.orderData.subtotal,
            deliveryFee: window.orderData.deliveryFee,
            serviceFee: window.orderData.serviceFee,
            total: window.orderData.total,
            currency: 'GHS',
            status: 'pending',
            paymentStatus: 'pending',
            escrowStatus: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (payButton2){ payButton2.disabled=true; payButton2.innerHTML='<i class="fas fa-spinner fa-spin"></i> Confirming payment...'; }
        try {
            await confirmFn({ orderId: orderRef.id, reference: reference });
            clearPendingPayment();
            showFlashMessage('Payment successful! 🎉 Escrow now holds GHS ' + Number(window.orderData.total).toLocaleString(), 'success');
        } catch (confirmErr) {
            // The charge may have gone through but we could not attach it to the order
            // (for example the amount did not match). Tell the buyer exactly what to send support.
            console.error('confirm payment failed', confirmErr);
            var cmsg = confirmErr.message || String(confirmErr);
            showFlashMessage('Your order was created but the payment could not be confirmed automatically: ' + cmsg + ' — please email sankofamarketgh@gmail.com with reference ' + reference + '. You have NOT been charged twice.', 'warning');
        }

        localStorage.removeItem('sankofa_cart');

        setTimeout(function(){
            window.location.href = 'order-confirmation.html?orderId=' + orderRef.id;
        }, 2500);

    } catch (error) {
        console.error('Complete payment error:', error);
        showFlashMessage('Payment failed: ' + (error.message || error), 'error');
        if (payButton2){ payButton2.disabled=false; payButton2.innerHTML=origText2; }
        throw error;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showFlashMessage(message, type = 'info') {
    // Self-contained flash message. (Careful: this file loads AFTER main.js, so a
    // function with this name is replaced — always implement it, never delegate to
    // window.showFlashMessage or it calls itself forever.)
    try {
        var existing = document.querySelectorAll('.flash-message');
        existing.forEach(function (el) { el.remove(); });
        var colors = { success: '#22c55e', error: '#ef4444', warning: '#f59e0b', info: '#0064d2' };
        var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
        var flash = document.createElement('div');
        flash.className = 'flash-message';
        flash.style.cssText = 'position:fixed;top:80px;right:20px;z-index:99999;background:' + (colors[type] || colors.info) +
            ';color:#fff;padding:0.75rem 1.1rem;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,0.18);font-weight:600;font-size:0.9rem;max-width:90vw;';
        flash.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i> ' + escapeFlashText(message);
        document.body.appendChild(flash);
        setTimeout(function () {
            flash.style.transition = 'opacity .3s ease';
            flash.style.opacity = '0';
            setTimeout(function () { flash.remove(); }, 350);
        }, 4000);
    } catch (e) {
        alert(message);
    }
}


/* Escape text before putting it into an innerHTML string.
   Product titles, names and emails are user-supplied — injecting them raw allowed a
   stored XSS (a product titled <img src=x onerror=...> ran script in the buyer's
   browser when the "added to cart" message was shown). */
function escapeFlashText(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


/* ============================================================================
   UNCONFIRMED PAYMENT SAFETY NET
   ---------------------------------------------------------------------------
   If a buyer's card is charged but the order never gets recorded (tab closed,
   phone died, wifi dropped, or the payment function could not be reached) the
   money would sit in limbo. So:
     • the reference + a snapshot of the cart are kept in localStorage until the
       SERVER confirms the payment;
     • the payment page offers a one-tap "finish this payment";
     • and the Cloud Function is single-use, so retrying can never charge twice.
   ========================================================================== */
/**
 * Firestore rejects `undefined` values anywhere in a document — and cart rows carry
 * `deliveryOptions: undefined` (and similar) straight from the cart page. Writing the
 * cart to an order used to fail with "Unsupported field value: undefined", so the
 * order was never created even though the card had been charged.
 * This strips undefined (and functions) while leaving Firestore sentinels
 * (serverTimestamp, Timestamps, GeoPoints, refs) untouched.
 */
function cleanForFirestore(value) {
    if (Array.isArray(value)) {
        return value.map(cleanForFirestore).filter(function (v) { return v !== undefined; });
    }
    if (value && typeof value === 'object') {
        var proto = Object.getPrototypeOf(value);
        var isPlain = (proto === Object.prototype || proto === null);
        if (!isPlain) return value;                 // serverTimestamp(), Timestamp, GeoPoint, DocumentReference...
        var out = {};
        Object.keys(value).forEach(function (k) {
            var v = cleanForFirestore(value[k]);
            if (v !== undefined) out[k] = v;
        });
        return out;
    }
    if (typeof value === 'function') return undefined;
    return value;
}

var PENDING_PAYMENT_KEY = 'sankofa_pending_payment';

function savePendingPayment(rec) { try { localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(rec)); } catch (e) {} }
function readPendingPayment() { try { var r = localStorage.getItem(PENDING_PAYMENT_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function clearPendingPayment() { try { localStorage.removeItem(PENDING_PAYMENT_KEY); } catch (e) {} }

/** Make sure the Firebase Functions SDK is actually on the page.
 *  A missing SDK would otherwise mean "charged, but no order" — the worst outcome. */
function ensureFunctionsSdk() {
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

/** Build the order document from a saved snapshot (used when we must recover a payment). */
async function createOrderFromSnapshot(snap) {
    var user = firebase.auth().currentUser;
    if (!user) throw new Error('Please sign in again, then tap "Finish this payment" so we can record it.');
    var items = (snap && snap.items) || [];
    var sellerId = null, sellerName = null, firstTitle = null;
    var preOrderInfo = null;  // filled below if ANY item is a Sankofa Store pre-order
    try {
        if (items.length) firstTitle = checkoutTitle(items[0]);
        var found = {};
        for (var i = 0; i < items.length && i < 10; i++) {
            var pid = items[i].productId || items[i].id;
            if (!pid || String(pid).indexOf('local-') === 0) continue;
            var pdoc = await firebase.firestore().collection('products').doc(pid).get();
            if (pdoc.exists) {
                var pd = pdoc.data();
                if (pd.preOrder === true) {
                    preOrderInfo = { isPreOrder: true, preOrderDate: pd.preOrderDate || null, preOrderNote: pd.preOrderNote || null };
                }
                if (pd.sellerId) {
                    found[pd.sellerId] = pd;
                    // stamp the seller on the row so a mixed cart can be split per seller server-side
                    itemList[i].sellerId = pd.sellerId;
                    itemList[i].seller = itemList[i].seller || pd.sellerName || pd.storeName || null;
                }
            }
        }
        var keys = Object.keys(found);
        if (keys.length === 1) { sellerId = keys[0]; sellerName = found[keys[0]].sellerName || found[keys[0]].storeName || null; }
    } catch (e) { console.warn('recovery: could not resolve seller', e); }

    return await firebase.firestore().collection('orders').add({
        buyerId: user.uid,
        userId: user.uid,
        buyerName: user.displayName || user.email || 'Buyer',
        items: cleanForFirestore(items),
        sellerId: sellerId,
        isPreOrder: preOrderInfo ? true : false,
        preOrderDate: preOrderInfo ? preOrderInfo.preOrderDate : null,
        preOrderNote: preOrderInfo ? preOrderInfo.preOrderNote : null,
        sellerName: sellerName,
        productTitle: firstTitle,
        paymentMethod: (snap && snap.method) || 'card',
        paymentData: { reference: snap && snap.reference },
        subtotal: snap ? snap.subtotal : null,
        deliveryFee: snap ? snap.deliveryFee : null,
        serviceFee: snap ? snap.serviceFee : null,
        total: snap ? snap.total : 0,
        currency: 'GHS',
        status: 'pending',
        paymentStatus: 'pending',
        escrowStatus: 'pending',
        recoveredAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/** Finish (or retry) recording a payment that we know was charged. */
async function finishPendingPayment(rec) {
    rec = rec || readPendingPayment();
    if (!rec || !rec.reference) throw new Error('There is no unconfirmed payment saved on this device.');
    var ok = await ensureFunctionsSdk();
    if (!ok) throw new Error('We could not reach the payment service. Your reference is saved — try again when you have signal.');
    var orderId = rec.orderId;
    if (!orderId) {
        var ref = await createOrderFromSnapshot(rec.orderData || rec);
        orderId = ref.id;
        rec.orderId = orderId;
        savePendingPayment(rec);
    }
    var fn = firebase.functions().httpsCallable('confirmPaystackPayment');
    var res = await fn({ orderId: orderId, reference: rec.reference });
    clearPendingPayment();
    try { localStorage.removeItem('sankofa_cart'); } catch (e) {}
    return { orderId: orderId, amount: res.data && res.data.amount, already: res.data && res.data.alreadyCredited };
}

/** The banner shown on the payment page when a payment is waiting to be recorded. */
function renderPendingPaymentBanner() {
    var rec = readPendingPayment();
    var existing = document.getElementById('pendingPaymentBanner');
    if (!rec || !rec.reference) { if (existing) existing.remove(); return; }
    if (existing) existing.remove();

    var age = Date.now() - (rec.at || 0);
    var ageText = age < 3600000 ? Math.max(1, Math.round(age / 60000)) + ' minute(s) ago'
                : age < 86400000 ? Math.round(age / 3600000) + ' hour(s) ago'
                : 'over a day ago';

    var el = document.createElement('div');
    el.id = 'pendingPaymentBanner';
    el.style.cssText = 'background:#fffbeb;border:1.5px solid #fde68a;border-radius:14px;padding:0.9rem 1rem;margin:0 0 1rem;';
    el.innerHTML =
        '<div style="display:flex;gap:0.6rem;align-items:flex-start;">' +
            '<i class="fas fa-triangle-exclamation" style="color:#d97706;font-size:1.1rem;margin-top:0.15rem;"></i>' +
            '<div style="flex:1;">' +
                '<div style="font-weight:800;color:#92400e;font-size:0.9rem;">A payment from ' + ageText + ' was not finished</div>' +
                '<div style="font-size:0.8rem;color:#78350f;margin-top:0.2rem;line-height:1.45;">' +
                    'Reference <strong>' + escapeFlashText(rec.reference) + '</strong>' +
                    (rec.total ? ' — GHS ' + Number(rec.total).toLocaleString() : '') +
                    '. If you were charged, tap below and we will record it against your account.' +
                '</div>' +
                '<div style="margin-top:0.6rem;display:flex;gap:0.5rem;flex-wrap:wrap;">' +
                    '<button type="button" id="pendingPayBtn" style="background:#0064d2;color:#fff;border:none;padding:0.55rem 0.9rem;border-radius:10px;font-weight:800;font-size:0.8rem;cursor:pointer;">' +
                        '<i class="fas fa-rotate-right"></i> Finish this payment' +
                    '</button>' +
                    '<button type="button" id="pendingPayDismiss" style="background:#fff;border:1.5px solid #e5e7eb;color:#6b7280;padding:0.55rem 0.9rem;border-radius:10px;font-weight:700;font-size:0.8rem;cursor:pointer;">Not mine — remove</button>' +
                '</div>' +
                '<div id="pendingPayStatus" style="font-size:0.78rem;color:#78350f;margin-top:0.5rem;"></div>' +
            '</div>' +
        '</div>';

    var host = document.querySelector('.payment-container') || document.querySelector('main') || document.body;
    host.insertBefore(el, host.firstChild);

    var btn = el.querySelector('#pendingPayBtn');
    var status = el.querySelector('#pendingPayStatus');
    if (btn) btn.addEventListener('click', async function () {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recording...';
        status.textContent = 'Checking the payment with Paystack — do not close this page.';
        try {
            var out = await finishPendingPayment(rec);
            status.style.color = '#166534';
            status.textContent = 'Recorded! Opening your receipt...';
            window.location.href = 'order-confirmation.html?orderId=' + out.orderId;
        } catch (e) {
            status.style.color = '#b91c1c';
            status.textContent = (e.message || String(e)) + ' — nothing was charged again.';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-rotate-right"></i> Try again';
        }
    });
    var dismiss = el.querySelector('#pendingPayDismiss');
    if (dismiss) dismiss.addEventListener('click', function () {
        if (confirm('Remove this saved payment? Only do this if you know you were NOT charged.')) {
            clearPendingPayment();
            el.remove();
        }
    });
}


/** Load Paystack's inline checkout ONLY when someone actually pays.
 *  The script used to be loaded on every visit to the wallet page, and it drags in
 *  ~300 KB of its own bundle + pusher even when you just want to look at your balance. */
function ensurePaystackSdk(timeoutMs) {
    return new Promise(function (resolve) {
        if (typeof PaystackPop !== 'undefined') return resolve(true);
        if (window.__paystackLoading) { window.__paystackLoading.push(resolve); return; }
        window.__paystackLoading = [resolve];
        var finish = function (ok) {
            var waiting = window.__paystackLoading || [];
            window.__paystackLoading = null;
            waiting.forEach(function (fn) { try { fn(ok); } catch (e) {} });
        };
        var tag = document.createElement('script');
        tag.src = 'https://js.paystack.co/v1/inline.js';
        tag.async = true;
        tag.onload = function () { finish(typeof PaystackPop !== 'undefined'); };
        tag.onerror = function () { finish(false); };
        document.head.appendChild(tag);
        setTimeout(function () { finish(typeof PaystackPop !== 'undefined'); }, timeoutMs || 10000);
    });
}

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled “classic” <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.loadPaystackKey = loadPaystackKey;
window.initPaymentPage = initPaymentPage;
window.loadOrderFromFirebase = loadOrderFromFirebase;
window.displayAuctionOrder = displayAuctionOrder;
window.escHtml = escHtml;
window.paymentEscape = paymentEscape;
window.calculateAuctionTotals = calculateAuctionTotals;
window.loadOrderFromCart = loadOrderFromCart;
window.readStoredCart = readStoredCart;
window.displayOrderItems = displayOrderItems;
window.calculateTotals = calculateTotals;
window.initPaymentMethodSwitching = initPaymentMethodSwitching;
window.updateWalletPayDesc = updateWalletPayDesc;
window.setRequiredFields = setRequiredFields;
window.initFormValidation = initFormValidation;
window.validateForm = validateForm;
window.updatePayButtonLabel = updatePayButtonLabel;
window.initPaymentProcessing = initPaymentProcessing;
window.processPayment = processPayment;
window.processWalletPayment = processWalletPayment;
window.initiatePaystackPayment = initiatePaystackPayment;
window.completePayment = completePayment;
window.showFlashMessage = showFlashMessage;
window.escapeFlashText = escapeFlashText;

