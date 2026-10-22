function escapeHtmlDetail(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtmlDetail = escapeHtmlDetail;
function isUserLoggedIn(){
  try{
    if(typeof window.SankofaMarket !== 'undefined' && window.SankofaMarket.isLoggedIn) return window.SankofaMarket.isLoggedIn();
    if(typeof isLoggedIn === 'function') { try{ return isLoggedIn(); }catch(e){} }
    if(typeof firebaseAuth !== 'undefined' && firebaseAuth && firebaseAuth.currentUser) return true;
    if(typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) return true;
  }catch(e){}
  return false;
}
function getFlash(msg,type){
  try{
    if(typeof showFlashMessage === 'function') return showFlashMessage(msg,type);
    if(window.SankofaMarket && typeof window.SankofaMarket.showFlashMessage === 'function') return window.SankofaMarket.showFlashMessage(msg,type);
  }catch(e){}
  try{ alert(msg); }catch(e){}
}
/**
 * Sankofa Market - Product Detail Page JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    initGallery();
    initProductActions();
    loadSimilarProducts();
    loadProductFromURL();
    injectPaymentSafetyWarnings();
});

/**
 * Inject payment safety warnings
 */
function injectPaymentSafetyWarnings() {
    const container = document.getElementById('paymentSafetyWarnings');
    if (container && typeof PaymentWarnings !== 'undefined') {
        container.innerHTML = PaymentWarnings.getPaymentPageWarning() + PaymentWarnings.getContactSellerWarning();
    }
}

// ============================================================================
// GALLERY FUNCTIONALITY
// ============================================================================

function initGallery() {
    const mainImage = document.getElementById('mainImage');
    const prevBtn = document.getElementById('prevImage');
    const nextBtn = document.getElementById('nextImage');
    
    // Dynamic: always read current thumbs from DOM (not captured at init)
    function getCurrentImages() {
        var thumbs = document.querySelectorAll('#galleryThumbs .thumb');
        return Array.from(thumbs).map(function(t) { return t.src; });
    }
    
    function getCurrentIndex() {
        var thumbs = document.querySelectorAll('#galleryThumbs .thumb');
        for (var i = 0; i < thumbs.length; i++) {
            if (thumbs[i].classList.contains('active')) return i;
        }
        return 0;
    }
    
    function setActiveThumb(index) {
        var images = getCurrentImages();
        var thumbs = document.querySelectorAll('#galleryThumbs .thumb');
        if (index < 0 || index >= images.length) return;
        
        mainImage.style.opacity = '0';
        setTimeout(function() {
            mainImage.src = images[index];
            mainImage.style.opacity = '1';
        }, 150);
        
        thumbs.forEach(function(t) { t.classList.remove('active'); });
        if (thumbs[index]) thumbs[index].classList.add('active');
    }
    
    // Attach thumb click handlers (for initial demo thumbs)
    document.querySelectorAll('#galleryThumbs .thumb').forEach(function(thumb, index) {
        thumb.addEventListener('click', function() { setActiveThumb(index); });
    });
    
    // Prev/Next buttons - dynamically read current state
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            var images = getCurrentImages();
            var idx = getCurrentIndex();
            var newIndex = (idx - 1 + images.length) % images.length;
            setActiveThumb(newIndex);
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            var images = getCurrentImages();
            var idx = getCurrentIndex();
            var newIndex = (idx + 1) % images.length;
            setActiveThumb(newIndex);
        });
    }
}


// ============================================================================
// PHOTO VIEWER — loads the FULL picture only when the buyer opens it
// ============================================================================
function openPhotoViewer(startIndex) {
    try {
        var product = window.currentProduct || {};
        var full = product.images || product.photos || [];
        var previews = window.currentProductPreviews || full;
        var count = previews.length || full.length;
        if (!count) return;

        var index = typeof startIndex === 'number' ? startIndex : 0;
        if (index < 0) index = 0;
        if (index >= count) index = count - 1;
        window.currentPhotoIndex = index;

        var existing = document.getElementById('smPhotoViewer');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'smPhotoViewer';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(9,14,22,0.94);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;';

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.style.cssText = 'position:absolute;top:14px;right:16px;width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,0.16);color:#fff;font-size:1.25rem;cursor:pointer;';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.onclick = closePhotoViewer;
        overlay.appendChild(closeBtn);

        // Show the preview immediately so it never looks empty…
        var pic = document.createElement('img');
        pic.id = 'smPhotoViewerImg';
        pic.style.cssText = 'max-width:min(1200px,94vw);max-height:78vh;object-fit:contain;border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,0.5);';
        pic.src = previews[index] || full[index];
        pic.alt = (product.title || 'Product') + ' — full size';
        overlay.appendChild(pic);

        var caption = document.createElement('div');
        caption.id = 'smPhotoViewerCaption';
        caption.style.cssText = 'color:#e5e7eb;font-size:0.85rem;margin-top:0.85rem;text-align:center;min-height:1.2em;';
        caption.textContent = 'Loading full-size photo…';
        overlay.appendChild(caption);

        // …then quietly swap in the full-size version (max 300KB).
        loadFullPhoto(full[index], function (ok) {
            caption.textContent = ok
                ? (product.title || 'Photo') + ' — full size · ' + (index + 1) + ' of ' + count + (count > 1 ? ' · use ← → to browse' : '')
                : 'Full-size photo could not load — showing the preview.';
        }, index, count, product);

        if (count > 1) {
            var prev = document.createElement('button');
            prev.type = 'button';
            prev.setAttribute('aria-label', 'Previous photo');
            prev.style.cssText = 'position:absolute;left:14px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;border:none;background:rgba(255,255,255,0.16);color:#fff;font-size:1.1rem;cursor:pointer;';
            prev.innerHTML = '<i class="fas fa-chevron-left"></i>';
            prev.onclick = function () { openPhotoViewer((window.currentPhotoIndex - 1 + count) % count); };

            var next = document.createElement('button');
            next.type = 'button';
            next.setAttribute('aria-label', 'Next photo');
            next.style.cssText = 'position:absolute;right:14px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;border:none;background:rgba(255,255,255,0.16);color:#fff;font-size:1.1rem;cursor:pointer;';
            next.innerHTML = '<i class="fas fa-chevron-right"></i>';
            next.onclick = function () { openPhotoViewer((window.currentPhotoIndex + 1) % count); };

            overlay.appendChild(prev);
            overlay.appendChild(next);
        }

        overlay.addEventListener('click', function (e) { if (e.target === overlay) closePhotoViewer(); });
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', photoViewerKeys);
    } catch (e) { console.warn('Photo viewer error', e); }
}

function loadFullPhoto(url, done, index, count, product) {
    if (!url) { done(false); return; }
    var img = new Image();
    img.onload = function () {
        var el = document.getElementById('smPhotoViewerImg');
        if (el) el.src = url;
        done(true);
    };
    img.onerror = function () { done(false); };
    img.src = url;
}

function photoViewerKeys(e) {
    var overlay = document.getElementById('smPhotoViewer');
    if (!overlay) return;
    if (e.key === 'Escape') closePhotoViewer();
    if (e.key === 'ArrowRight') openPhotoViewer((window.currentPhotoIndex || 0) + 1);
    if (e.key === 'ArrowLeft') openPhotoViewer((window.currentPhotoIndex || 0) - 1);
}

function closePhotoViewer() {
    var overlay = document.getElementById('smPhotoViewer');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', photoViewerKeys);
}

// ============================================================================
// PRODUCT ACTIONS
// ============================================================================

function initProductActions() {
    const favoriteBtn = document.getElementById('favoriteBtn');
    const shareBtn = document.getElementById('shareBtn');
    const contactBtn = document.getElementById('contactSellerBtn');
    const callBtn = document.getElementById('callSellerBtn');
    if(!favoriteBtn || !shareBtn || !contactBtn || !callBtn){
        console.warn('initProductActions: buttons not found yet, retrying');
        setTimeout(initProductActions, 500);
        return;
    }
    favoriteBtn.addEventListener('click', function() {
        this.classList.toggle('active');
        const icon = this.querySelector('i');
        if (this.classList.contains('active')) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            getFlash('Added to favorites!', 'success');
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
            getFlash('Removed from favorites', 'info');
        }
    });
    
    shareBtn.addEventListener('click', async function() {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: document.getElementById('productTitle').textContent,
                    text: 'Check out this deal on Sankofa Market!',
                    url: window.location.href
                });
            } catch (err) {
                copyToClipboard();
            }
        } else {
            copyToClipboard();
        }
    });
    
    contactBtn.addEventListener('click', function() {
        contactSeller();
    });
    
    callBtn.addEventListener('click', function() {
        callSeller();   // one single implementation (also used by the inline onclick)
    });
}

function copyToClipboard() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        getFlash('Link copied to clipboard!', 'success');
    }).catch(() => {
        getFlash('Could not copy link', 'error');
    });
}

// ============================================================================
// LOAD PRODUCT FROM URL
// ============================================================================

function loadProductFromURL() {
    var params = new URLSearchParams(window.location.search);
    var productId = params.get('id') || params.get('productId') || params.get('product');
    var loading = document.getElementById('productLoading');
    var content = document.getElementById('productContent');

    function showContent() {
        if (loading) loading.style.display = 'none';
        if (content) content.style.display = '';
    }
    function showError(msg){
        var safeMsg = String(msg||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        var safeId = String(productId||'-').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        if (loading) loading.innerHTML = '<div style="text-align:center;padding:3rem;color:#e74c3c;"><i class="fas fa-exclamation-triangle" style="font-size:1.8rem;"></i><p style="margin-top:0.8rem;font-weight:700;">'+safeMsg+'</p><p style="font-size:0.85rem;color:#6b7280;margin-top:0.4rem;">ID: '+safeId+'</p><a href="search.html" style="display:inline-block;margin-top:1rem;background:#0064d2;color:#fff;padding:0.6rem 1rem;border-radius:8px;text-decoration:none;font-weight:700;">Browse other products</a></div>';
        if (content) content.style.display = 'none';
        if (loading) loading.style.display = '';
    }
    function loadedOk(){
        return document.getElementById('productTitle') && document.getElementById('productTitle').textContent.trim() !== '';
    }

    if (!productId) {
        showError('No product selected — please choose a product from search.');
        return;
    }

    var tries = 0;
    var done = false;
    function finishProduct(data){
        done = true;
        try { renderProduct(data); } catch(e){ console.warn('renderProduct error', e); }
        showContent();
    }
    function tryLoad(){
        tries++;
        if (typeof firebaseDB === 'undefined' || firebaseDB === null){
            if (tries < 20){ setTimeout(tryLoad, 500); return; }
            showError('Could not connect to database — please refresh.');
            return;
        }
        console.log('Loading product:', productId, 'attempt', tries);
        var p = firebaseDB.collection('products').doc(productId).get({source:'server'}).catch(function(){
            return firebaseDB.collection('products').doc(productId).get();
        });
        p.then(function(doc) {
            if (doc && doc.exists) {
                var data = doc.data();
                data._docId = doc.id;
                finishProduct(data);
                console.log('Product loaded:', data.title);
            } else {
                console.warn('Product not found:', productId);
                showError('Product not found — it may have been sold or removed.');
            }
        }).catch(function(err) {
            console.warn('Error loading product:', err && err.message);
            // Retry a couple of times (offline / 10s backend delay) before showing error
            if (tries < 3 && !done){
                setTimeout(tryLoad, 1500);
                return;
            }
            showError('Could not load product: ' + ((err && err.message) || err));
        });
    }
    tryLoad();

    // Failsafe — never leave the skeleton forever
    setTimeout(function(){
        var lo = document.getElementById('productLoading');
        if(!lo || lo.style.display === 'none') return;
        if(loadedOk() || done){ showContent(); return; }
        // Last chance: read from offline cache (IndexedDB) even if server unreachable
        if(typeof firebaseDB !== 'undefined' && firebaseDB){
            firebaseDB.collection('products').doc(productId).get().then(function(doc){
                if(doc && doc.exists){
                    var data = doc.data(); data._docId = doc.id;
                    finishProduct(data);
                } else {
                    showError('Could not load product — check your internet and refresh.');
                }
            }).catch(function(){
                showError('Could not load product — check your internet and refresh.');
            });
        } else {
            showError('Could not load product — check your internet and refresh.');
        }
    }, 8000);
}

/* ===== FLASH SALE (Gold+ perk) — banner, countdown, owner controls ===== */
function smFlashCssDetail() {
    if (document.getElementById('smFlashCssDetail')) return;
    var st = document.createElement('style');
    st.id = 'smFlashCssDetail';
    st.textContent =
        '.sm-flash-banner{background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);color:#fff;border-radius:12px;padding:0.75rem 1rem;margin:0.35rem 0 0.8rem;box-shadow:0 6px 18px rgba(220,38,38,0.28);}' +
        '.sm-flash-banner .fb-row{display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;font-weight:800;font-size:0.95rem;}' +
        '.sm-flash-banner .fb-sub{font-size:0.76rem;opacity:0.92;margin-top:0.15rem;}' +
        '.sm-flash-timer{background:rgba(0,0,0,0.25);padding:0.18rem 0.55rem;border-radius:999px;font-variant-numeric:tabular-nums;letter-spacing:0.5px;}' +
        '.sm-flash-modal-wrap{position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:1300;display:flex;align-items:center;justify-content:center;padding:1rem;}' +
        '.sm-flash-modal{background:#fff;border-radius:14px;box-shadow:0 18px 50px rgba(2,32,71,0.3);width:100%;max-width:400px;padding:1.15rem;box-sizing:border-box;}' +
        '.sm-flash-chips{display:flex;gap:0.4rem;flex-wrap:wrap;margin:0.5rem 0 0.9rem;}' +
        '.sm-flash-chip{border:1px solid #f3c1c1;background:#fff5f5;color:#b91c1c;font-weight:800;font-size:0.84rem;padding:0.45rem 0.8rem;border-radius:999px;cursor:pointer;}' +
        '.sm-flash-chip.on{background:#dc2626;border-color:#dc2626;color:#fff;}' +
        '.sm-flash-chip.time{border-color:#c7ddff;background:#eef4ff;color:#0064d2;}' +
        '.sm-flash-chip.time.on{background:#0064d2;border-color:#0064d2;color:#fff;}' +
        '.owner-flash-btn{background:linear-gradient(135deg,#dc2626,#b91c1c)!important;color:#fff!important;border:1px solid #dc2626!important;}' +
        '.owner-flash-live{background:#fee2e2;color:#b91c1c;font-weight:700;font-size:0.8rem;padding:0.35rem 0.65rem;border-radius:999px;border:1px solid #fecaca;}';
    document.head.appendChild(st);
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
try { smFlashCssDetail(); } catch (e) {}
var _flashTimer = null;
function smFlashCountdownStr(end) {
    var ms = end - new Date();
    if (ms <= 0) return 'ended';
    var h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), sec = Math.floor(ms % 60000 / 1000);
    return (h > 0 ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}
function hideFlashBanner() {
    var b = document.getElementById('flashSaleBanner');
    if (b) { b.style.display = 'none'; b.innerHTML = ''; }
    if (_flashTimer) { clearInterval(_flashTimer); _flashTimer = null; }
}
function showFlashBanner(product, fl) {
    var b = document.getElementById('flashSaleBanner');
    if (!b) return;
    if (_flashTimer) { clearInterval(_flashTimer); _flashTimer = null; }
    function paint() {
        var left = smFlashCountdownStr(fl.endsAt);
        b.innerHTML = '<div class="fb-row"><i class="fas fa-bolt"></i> FLASH SALE -' + fl.percent + '%' +
            '<span class="sm-flash-timer"><i class="fas fa-clock"></i> ' + left + ' left</span></div>' +
            '<div class="fb-sub">You save GHS ' + (Math.round((Number(product.price || 0) - fl.price) * 100) / 100).toLocaleString() +
            ' — offer ends soon, then the price goes back up.</div>';
        b.style.display = '';
        if (left === 'ended') { hideFlashBanner(); if (typeof renderProduct === 'function') renderProduct(product); }
    }
    paint();
    _flashTimer = setInterval(paint, 1000);
}
function paintFlashAwarePrice(product, priceEl) {
    var wasEl = document.getElementById('flashWasPrice');
    var fmt = function (n) {
        return (typeof window.SankofaMarket !== 'undefined' && typeof window.SankofaMarket.formatCurrency === 'function')
            ? window.SankofaMarket.formatCurrency(n) : 'GHS ' + Number(n || 0).toLocaleString();
    };
    var fl = smFlashActive(product);
    if (fl) {
        priceEl.textContent = fmt(fl.price);
        priceEl.style.color = '#dc2626';
        if (wasEl) { wasEl.textContent = fmt(Number(product.price || 0)); wasEl.style.display = ''; }
        showFlashBanner(product, fl);
    } else {
        priceEl.textContent = fmt(product.price);
        priceEl.style.color = '';
        if (wasEl) wasEl.style.display = 'none';
        hideFlashBanner();
    }
}

/* ==== TIER 2: item-view ping + order bump (self-contained on this page) ==== */
var _smDetailFnsSdk = null;
function smDetailFunctionsSdk() {
    if (typeof firebase !== 'undefined' && firebase && firebase.functions) return Promise.resolve(true);
    if (_smDetailFnsSdk) return _smDetailFnsSdk;
    _smDetailFnsSdk = new Promise(function (resolve) {
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
    return _smDetailFnsSdk;
}

/** One fire-and-forget item-view ping per session (shop owners never count themselves — server checks). */
function smDetailPingItemView(product) {
    if (!product || !product.sellerId) return;
    var me = null;
    try { me = (typeof firebase !== 'undefined' && firebase.auth().currentUser) || null; } catch (e) {}
    if (me && me.uid === product.sellerId) return;      // your own item — your visit is yours, not a stat
    var pid = String(product._docId || product.id || '');
    if (!pid) return;
    var key = 'sm-ping-item-' + pid;
    try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
    } catch (e) {}
    smDetailFunctionsSdk().then(function (ok) {
        if (!ok) return;
        firebase.functions().httpsCallable('recordShopPing')({ kind: 'item', uid: product.sellerId })
            .catch(function () {});
    });
}

/* Order bump state — the picked rows, so the Add buttons can find their item. */
var _smBumpItems = [];

function smBumpPriceHtml(p) {
    var price = Number(p.price || 0);
    if (typeof smForYouFlashActive === 'function' && smForYouFlashActive(p, Date.now()) && p.flashSale) {
        var pct = Number(p.flashSale.percent) || 0;
        var sale = Math.round(price * (100 - pct)) / 100;
        return '<span style="color:#dc2626;font-weight:800;">GHS ' + sale.toLocaleString() + '</span>' +
               ' <span style="text-decoration:line-through;color:#94a3b8;font-size:0.74rem;">GHS ' + price.toLocaleString() + '</span>';
    }
    return '<span style="font-weight:800;color:#191919;">GHS ' + price.toLocaleString() + '</span>';
}

function smOrderBumpAdd(idx) {
    var p = _smBumpItems[idx];
    if (!p) return;
    if (typeof cart !== 'undefined' && cart && typeof cart.addItem === 'function') {
        cart.addItem(p, 1);
    } else {
        // cart lives on pages with js/cart.js — if it is missing, just open the item
        window.location.href = 'product-detail.html?id=' + encodeURIComponent(p._docId || p.id);
    }
}
window.smOrderBumpAdd = smOrderBumpAdd;

async function smMaybeRenderOrderBump(product) {
    var box = document.getElementById('orderBumpBox');
    var rows = document.getElementById('orderBumpRows');
    if (!box || !rows || box._done) return;
    box._done = true;    // re-renders (flash countdown end etc.) must not stack rows
    try {
        if (!product || product.isSold === true) return;
        if (typeof smForYouLoadPool !== 'function' || typeof smOrderBumpPick !== 'function' || typeof smForYouLoadProfile !== 'function') return;
        var viewerId = null;
        try { viewerId = ((typeof firebase !== 'undefined' && firebase.auth().currentUser) || {}).uid || null; } catch (e) {}
        if (product.sellerId && viewerId && String(product.sellerId) === String(viewerId)) return;   // your own item
        var pool = await smForYouLoadPool();
        if (!pool || !pool.length) return;
        var picked = smOrderBumpPick(pool, product, smForYouLoadProfile(), { now: Date.now(), viewerId: viewerId, limit: 3 });
        if (!picked.length) return;
        _smBumpItems = picked;

        var noteEl = document.getElementById('orderBumpNote');
        if (noteEl) {
            var sameCat = picked.filter(function (p) { return p.category && p.category === product.category; }).length;
            noteEl.textContent = sameCat
                ? 'more ' + String(product.category || '').replace(/-/g, ' ') + ' picked by your recent browsing'
                : 'picked from your recent browsing';
        }

        rows.innerHTML = picked.map(function (p, i) {
            var id = p._docId || p.id;
            var img = (typeof productThumb === 'function') ? productThumb(p) : ((p.images || p.photos || [])[0] || '/images/placeholders/product.svg');
            var canAdd = p._bumpCanAdd === true;
            var action = canAdd
                ? '<button type="button" class="sm-bump-add" onclick="smOrderBumpAdd(' + i + ')" style="border:1.5px solid #0064d2;color:#0064d2;background:#fff;border-radius:999px;padding:4px 12px;font-size:0.76rem;font-weight:800;white-space:nowrap;"><i class="fas fa-cart-plus"></i> Add</button>'
                : '<a href="product-detail.html?id=' + encodeURIComponent(id) + '" style="border:1.5px solid #e2e8f0;color:#334155;border-radius:999px;padding:4px 12px;font-size:0.76rem;font-weight:800;white-space:nowrap;text-decoration:none;">View →</a>';
            return '<div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #f3e3a1;border-radius:12px;padding:6px 8px;">' +
                '<a href="product-detail.html?id=' + encodeURIComponent(id) + '" style="flex-shrink:0;">' +
                    '<img src="' + escapeHtmlDetail(img) + '" alt="" loading="lazy" style="width:46px;height:46px;object-fit:cover;border-radius:9px;"></a>' +
                '<div style="flex:1;min-width:0;">' +
                    '<a href="product-detail.html?id=' + encodeURIComponent(id) + '" style="color:#191919;text-decoration:none;font-size:0.82rem;font-weight:700;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtmlDetail(p.title || 'Item') + '</a>' +
                    '<div style="font-size:0.8rem;margin-top:1px;">' + smBumpPriceHtml(p) + '</div>' +
                '</div>' + action + '</div>';
        }).join('');
        box.style.display = '';
    } catch (e) {
        console.warn('order bump failed:', e && e.message);
        box.style.display = 'none';
    }
}

function renderProduct(product) {
    // Guard: never crash if called with nothing (defensive — protects against
    // cross-script name collisions calling this function with wrong arguments)
    if (!product || typeof product !== 'object') {
        console.warn('renderProduct: no product data passed — ignoring call');
        return;
    }
    window.currentProduct = product;
    // "Picked for you" learning — opening a product page is a mild interest signal
    // (repeat views within 10 minutes are merged inside the tracker, so re-renders don't inflate it)
    try {
        if (typeof window !== 'undefined' && typeof window.smForYouTrackView === 'function') {
            window.smForYouTrackView(product);
        }
    } catch (e) {}
    // Title & breadcrumbs
    var titleEl = document.getElementById('productTitle');
    if (titleEl) titleEl.textContent = product.title || 'Untitled Product';
    
    var breadcrumbTitle = document.getElementById('breadcrumbTitle');
    if (breadcrumbTitle) breadcrumbTitle.textContent = product.title || '';
    
    var breadcrumbCat = document.getElementById('breadcrumbCategory');
    if (breadcrumbCat) breadcrumbCat.textContent = (product.category || '').replace(/-/g, ' ');
    
    document.title = (product.title || 'Product') + ' - Sankofa Market';
    
    // Price
    var priceEl = document.getElementById('productPrice');
    if (priceEl) paintFlashAwarePrice(product, priceEl); // flash-sale aware (was-price + countdown banner)
    
    // Location
    var locEl = document.getElementById('productLocation');
    if (locEl) locEl.textContent = (product.location && product.location.city) || product.location || 'Ghana';
    
    // Description
    var descEl = document.getElementById('productDescription');
    if (descEl && product.description) descEl.innerHTML = window.escapeHtmlDetail(product.description).replace(/\n/g,'<br>');
    
    // Condition
    var condEl = document.getElementById('productCondition');
    if (condEl && product.condition) condEl.textContent = product.condition.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    
    // Seller info
    var sellerEl = document.getElementById('sellerName');
    if (sellerEl) sellerEl.textContent = product.sellerName || (product.isSankofaStore ? 'Sankofa Store' : 'Seller');
    
    var verifiedEl = document.getElementById('sellerVerified');
    if (verifiedEl) {
        if (product.isVerifiedSeller || product.isSankofaStore) {
            verifiedEl.innerHTML = '<i class="fas fa-check-circle" style="color:#0064d2;"></i> Verified';
            verifiedEl.style.display = '';
        } else {
            verifiedEl.style.display = 'none';
        }
    }
    
    var officialBadge = document.getElementById('officialBadge');
    if (officialBadge) {
        officialBadge.style.display = product.isSankofaStore ? '' : 'none';
    }
    
    // Show featured badge if applicable
    var featuredBadge = document.getElementById('featuredBadge');
    if (featuredBadge) {
        featuredBadge.style.display = product.isFeatured ? '' : 'none';
    }
    
    // Update seller avatar with initial
    var sellerAvatar = document.getElementById('sellerAvatar');
    if (sellerAvatar) {
        var sellerName = product.sellerName || (product.isSankofaStore ? 'Sankofa Store' : 'Seller');
        sellerAvatar.textContent = sellerName.charAt(0).toUpperCase();
    }
    
    // Show member since if available (load from seller's user document)
    if (product.sellerId && typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        firebaseDB.collection('users').doc(product.sellerId).get().then(function(userDoc) {
            if (userDoc.exists) {
                var userData = userDoc.data();
                var memberSinceEl = document.getElementById('sellerMemberSince');
                if (memberSinceEl && userData.createdAt) {
                    var joinDate = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
                    memberSinceEl.textContent = 'Member since ' + joinDate.getFullYear();
                    memberSinceEl.style.display = 'block';
                }
            }
        }).catch(function() {});
    }

    // Buyer reviews: product average under the price, the review list further
    // down this page, and the seller's public score on the seller card.
    renderProductRating(product);

    // "Visit their shop" — when this seller has a LIVE storefront, link to it
    // (stores/{sellerId} is public-read only when active, so failures just hide the button)
    try {
        if (!product.isSankofaStore && product.sellerId) smAttachVisitShopButton(product.sellerId);
        else { var vb0 = document.getElementById('visitShopBtn'); if (vb0) vb0.style.display = 'none'; }
    } catch (e) {}
    loadProductReviews(product);
    loadSellerRating(product.sellerId);
    loadSellerPremiumBadge(product.sellerId);
    initFollowButton(product);
    initComments(product);

    // Render specifications if they exist
    if (product.specifications && typeof product.specifications === 'object') {
        var specsSection = document.getElementById('specsSection');
        var specsTable = document.getElementById('specsTable');
        if (specsSection && specsTable) {
            var specsHtml = '';
            Object.keys(product.specifications).forEach(function(key) {
                var value = product.specifications[key];
                if (value && value.trim && value.trim() !== '') {
                    var label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                    specsHtml += '<tr><th>' + label + '</th><td>' + value + '</td></tr>';
                }
            });
            if (specsHtml) {
                specsTable.innerHTML = specsHtml;
                specsSection.style.display = '';
            }
        }
    }
    
    // Load Sankofa Store profile picture
    if (product.isSankofaStore && typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        firebaseDB.collection('settings').doc('sankofaStore').get().then(function(doc) {
            if (doc.exists) {
                var storeData = doc.data();
                if (storeData.profilePicture && sellerAvatar) {
                    sellerAvatar.style.background = 'transparent';
                    sellerAvatar.innerHTML = '<img src="' + window.escapeHtmlDetail(storeData.profilePicture) + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
                }
                if (storeData.storeName && sellerEl) sellerEl.textContent = storeData.storeName;
                if (storeData.storeTagline) {
                    var taglineEl = document.getElementById('sellerTagline') || document.querySelector('.seller-tagline');
                    if (taglineEl) taglineEl.textContent = storeData.storeTagline;
                }
            }
        }).catch(function() {});
    }
    
    // Time
    var timeEl = document.getElementById('productTime');
    if (timeEl) {
        var created = product.createdAt;
        if (created) {
            var date = created.toDate ? created.toDate() : new Date(created);
            timeEl.textContent = typeof formatRelativeTime === 'function' ? formatRelativeTime(date) : date.toLocaleDateString();
        }
    }
    
    // Views
    var viewsEl = document.getElementById('productViews');
    if (viewsEl) viewsEl.textContent = (product.views || 0) + ' views';

    // Tier 2: count this view in the seller's shop stats + warm up the order bump
    try { smDetailPingItemView(product); } catch (e) {}
    try { setTimeout(function () { smMaybeRenderOrderBump(product); }, 700); } catch (e) {}
    
    // Delivery / Pickup info
    renderDeliveryInfo(product);
    
    // Images
    //   images      = full pictures (max 300KB) — only fetched when the buyer opens one
    //   imagesThumb = small previews (~60-90KB) — what the page shows by default
    var images = product.images || product.photos || [];
    var previews = (product.imagesThumb && product.imagesThumb.length) ? product.imagesThumb : images;
    window.currentProductPreviews = previews;
    var mainImage = document.getElementById('mainImage');
    var thumbsContainer = document.getElementById('galleryThumbs');

    if (previews.length > 0) {
        // Main picture shows the small preview (fast) — click opens the full one
        if (mainImage) {
            mainImage.onerror = function () {
                this.onerror = null;
                this.src = '/images/placeholders/product.svg';
            };
            mainImage.src = previews[0];
            mainImage.style.cursor = 'zoom-in';
            mainImage.title = 'Click to view the full-size photo';
            mainImage.setAttribute('data-full', images[0] || previews[0]);
            mainImage.onclick = function () { openPhotoViewer(0); };
        }

        // Rebuild thumbnails (small previews)
        if (thumbsContainer) {
            thumbsContainer.innerHTML = '';
            previews.forEach(function(previewUrl, i) {
                var thumb = document.createElement('img');
                thumb.src = previewUrl;
                thumb.alt = 'Thumbnail ' + (i + 1);
                thumb.className = 'thumb' + (i === 0 ? ' active' : '');
                thumb.loading = 'lazy';
                thumb.decoding = 'async';
                thumb.onerror = function () { this.onerror = null; this.src = '/images/placeholders/product.svg'; };
                thumb.addEventListener('click', function() {
                    if (mainImage) {
                        mainImage.src = previewUrl;
                        mainImage.setAttribute('data-full', images[i] || previewUrl);
                    }
                    thumbsContainer.querySelectorAll('.thumb').forEach(function(t) { t.classList.remove('active'); });
                    thumb.classList.add('active');
                    window.currentPhotoIndex = i;
                });
                thumbsContainer.appendChild(thumb);
            });
        }
    } else {
        // No images - show placeholder
        if (mainImage) mainImage.src = '/images/placeholders/product.svg';
        if (thumbsContainer) thumbsContainer.innerHTML = '';
    }

    // Premium sellers may attach one processed video. Load only its URL here and
    // let the buyer press Play (no autoplay or eager video download).
    var videoContainer = document.getElementById('productVideoContainer');
    var videoPath = String(product.videoStoragePath || '');
    if (videoContainer){
        videoContainer.innerHTML = '';
        videoContainer.style.display = 'none';
        if (videoPath && typeof firebase !== 'undefined' && firebase.storage){
            var videoProductId = String(product._docId || product.id || '');
            firebase.storage().ref().child(videoPath).getDownloadURL().then(function(videoUrl){
                var currentId = String((window.currentProduct && (window.currentProduct._docId || window.currentProduct.id)) || '');
                if (videoProductId && currentId && videoProductId !== currentId) return;
                var label = document.createElement('p');
                label.textContent = 'Seller video' + (product.videoDurationSeconds ? ' · up to ' + Math.round(Number(product.videoDurationSeconds)) + ' seconds' : '');
                label.style.cssText = 'font-size:0.78rem;font-weight:700;color:#475569;margin:0 0 0.35rem;';
                var player = document.createElement('video');
                player.controls = true;
                player.playsInline = true;
                player.preload = 'none';
                player.setAttribute('aria-label', 'Seller product video');
                player.src = videoUrl;
                if (previews && previews[0]) player.poster = previews[0];
                player.style.cssText = 'display:block;width:100%;max-height:360px;object-fit:contain;background:#111;border-radius:10px;';
                videoContainer.appendChild(label);
                videoContainer.appendChild(player);
                videoContainer.style.display = 'block';
            }).catch(function(err){ console.warn('Could not load seller video:', err && err.message); });
        }
    }
    
    // Increment view count — HONESTLY:
    //   • once per browser session per item (refresh / back-and-forth can't inflate)
    //   • the seller browsing their own item never counts
    //   • server-side increment (no read-then-write race when two phones open it together)
    try { smCountListingView(product); } catch (e) {}
}

/* === VIEW GUARD CORE START (unit-tested pure helper) === */
/**
 * Should this render count as ONE listing view?
 *   - a session counts each item once, no matter how often it re-renders
 *   - the seller browsing their own item never counts
 */
function smShouldCountView(opts) {
    if (!opts || !opts.productId) return false;
    if (opts.sessionSeen === true) return false;
    if (opts.viewerId && opts.sellerId && String(opts.viewerId) === String(opts.sellerId)) return false;
    return true;
}
/* === VIEW GUARD CORE END === */

function smCountListingView(product) {
    if (typeof firebaseDB === 'undefined' || !product || !product._docId) return;
    var pid = String(product._docId);
    var viewerId = null;
    try { viewerId = ((typeof firebase !== 'undefined' && firebase.auth().currentUser) || {}).uid || null; } catch (e) {}
    var key = 'sm-counted-view-' + pid;
    var seen = false;
    try { seen = sessionStorage.getItem(key) === '1'; } catch (e) {}

    if (!smShouldCountView({ productId: pid, sellerId: product.sellerId, viewerId: viewerId, sessionSeen: seen })) return;
    try { sessionStorage.setItem(key, '1'); } catch (e) {}

    firebaseDB.collection('products').doc(pid).update({
        views: firebase.firestore.FieldValue.increment(1)
    }).then(function () {
        // Reflect this visit in the number on screen (once — not on every re-render)
        product.views = Number(product.views || 0) + 1;
        var viewsEl = document.getElementById('productViews');
        if (viewsEl) viewsEl.textContent = product.views + ' views';
    }).catch(function() {});
}

/**
 * Render delivery / pickup information box
 * Supports both new format (deliveryOption string + pickupLocation object)
 * and legacy format (deliveryOptions array)
 */
function renderDeliveryInfo(product) {
    var box = document.getElementById('deliveryInfoBox');
    if (!box) return;
    // Guard: never crash if called with nothing
    if (!product || typeof product !== 'object') {
        box.style.display = 'none';
        return;
    }

    // Determine delivery option (new single format first, fall back to legacy array)
    var option = product.deliveryOption || null;
    if (!option && Array.isArray(product.deliveryOptions) && product.deliveryOptions.length > 0) {
        option = product.deliveryOptions[0];
    }
    // Normalize legacy value names
    if (option === 'pickup-only') option = 'pickup';

    if (!option) {
        box.style.display = 'none';
        return;
    }

    var html = '';

    if (option === 'free-delivery') {
        html = '<div style="display:flex;align-items:center;gap:0.75rem;">' +
            '<div style="width:38px;height:38px;border-radius:50%;background:rgba(34,197,94,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-truck" style="color:#16a34a;"></i></div>' +
            '<div><strong style="font-size:0.95rem;color:#16a34a;">Free Delivery</strong>' +
            '<p style="margin:0;font-size:0.82rem;color:#5a6572;">The seller delivers this item at no extra cost' +
            (product.deliveryAreas ? ' to: ' + window.escapeHtmlDetail(product.deliveryAreas) : '') + '</p></div>' +
        '</div>';
    } else if (option === 'paid-delivery') {
        var feeHtml = product.deliveryFee ? ' — <strong>GHS ' + Number(product.deliveryFee).toLocaleString() + '</strong>' : '';
        html = '<div style="display:flex;align-items:center;gap:0.75rem;">' +
            '<div style="width:38px;height:38px;border-radius:50%;background:rgba(0,100,210,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-shipping-fast" style="color:#0064d2;"></i></div>' +
            '<div><strong style="font-size:0.95rem;color:#0064d2;">Delivery Available</strong>' + feeHtml +
            '<p style="margin:0;font-size:0.82rem;color:#5a6572;">Buyer pays the delivery fee' +
            (product.deliveryAreas ? ' • Delivery areas: ' + window.escapeHtmlDetail(product.deliveryAreas) : '') + '</p></div>' +
        '</div>';
    } else if (option === 'pickup') {
        var pickup = product.pickupLocation || {};
        html = '<div style="display:flex;align-items:flex-start;gap:0.75rem;">' +
            '<div style="width:38px;height:38px;border-radius:50%;background:rgba(245,158,11,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-store" style="color:#d97706;"></i></div>' +
            '<div style="flex:1;"><strong style="font-size:0.95rem;color:#d97706;">Pickup Only</strong>' +
            '<p style="margin:0.2rem 0 0;font-size:0.82rem;color:#5a6572;">Buyer picks up this item from the seller\'s location.</p>';

        if (pickup.address) {
            html += '<p style="margin:0.4rem 0 0;font-size:0.85rem;"><i class="fas fa-map-marker-alt" style="color:#d97706;margin-right:0.35rem;"></i><strong>Pickup Address:</strong> ' + window.escapeHtmlDetail(pickup.address) + '</p>';
        }
        if (pickup.digitalAddress) {
            html += '<p style="margin:0.3rem 0 0;font-size:0.85rem;"><i class="fas fa-location-crosshairs" style="color:#d97706;margin-right:0.35rem;"></i><strong>Digital Address:</strong> ' + window.escapeHtmlDetail(pickup.digitalAddress) +
                ' <a href="https://www.ghanapostgps.com/" target="_blank" rel="noopener" style="color:#0064d2;font-size:0.78rem;text-decoration:none;">(View on GhanaPostGPS)</a></p>';
        }
        if (pickup.notes) {
            html += '<p style="margin:0.3rem 0 0;font-size:0.85rem;"><i class="fas fa-info-circle" style="color:#d97706;margin-right:0.35rem;"></i><strong>Pickup Instructions:</strong> ' + window.escapeHtmlDetail(pickup.notes) + '</p>';
        }

        html += '</div></div>';
    }

    if (html) {
        box.innerHTML = html;
        box.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:1rem 1.25rem;margin:1rem 0;';
        box.style.display = 'block';
    } else {
        box.style.display = 'none';
    }
}

// ============================================================================
// SIMILAR PRODUCTS
// ============================================================================

function loadSimilarProducts() {
    var container = document.getElementById('similarProducts');
    if (!container) return;
    
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) return;
    
    // Load recent products as "similar"
    firebaseDB.collection('products')
        .where('isActive', '==', true)
        .limit(8)
        .get()
        .then(function(snapshot) {
            if (snapshot.empty) {
                // Fallback: load without where clause
                return firebaseDB.collection('products').limit(8).get();
            }
            return snapshot;
        })
        .then(function(snapshot) {
            if (!snapshot || snapshot.empty) return;
            
            var html = '';
            var count = 0;
            snapshot.forEach(function(doc) {
                if (count >= 4) return;
                var p = doc.data();
                if (p.isSold) return;
                
                var images = p.images || p.photos || [];
                var imgSrc = (typeof productThumb === 'function') ? productThumb(p) : (images.length > 0 ? images[0] : '/images/placeholders/product.svg');
                var price = typeof window.SankofaMarket !== 'undefined' && typeof window.SankofaMarket.formatCurrency === 'function' ? window.SankofaMarket.formatCurrency(p.price) : 'GHS ' + (p.price || 0).toLocaleString();
                var location = (p.location && p.location.city) || p.location || 'Ghana';
                var isSS = p.isSankofaStore === true;
                
                // ⚠️ Every value below comes from a seller's listing, so it MUST be escaped
                // before it goes into innerHTML — otherwise a listing title can inject markup
                // (a stored XSS that runs for anyone viewing this page).
                var esc = (typeof escapeHtmlDetail === 'function') ? escapeHtmlDetail
                        : (typeof escapeFlashText === 'function') ? escapeFlashText
                        : function (v) { return String(v == null ? '' : v); };
                var safeTitle = esc(p.title || 'Untitled');
                var safeImg = esc(imgSrc);
                var safeFull = esc((typeof productFull === 'function') ? productFull(p) : imgSrc);
                var safeLocation = esc(location);

                html += '<a href="product-detail.html?id=' + encodeURIComponent(doc.id) + '" class="product-card">' +
                    '<div class="product-image-wrapper">' +
                        '<img src="' + safeImg + '" data-alt-src="' + safeFull + '" onerror="smImgFallback(this)" alt="' + safeTitle + '" class="product-image" loading="lazy">' +
                        (isSS ? '<span class="sankofa-store-badge"><i class="fas fa-store"></i> Official</span>' : '') +
                    '</div>' +
                    '<div class="product-content">' +
                        '<div class="product-title">' + safeTitle + '</div>' +
                        '<div class="product-price">' + esc(price) + '</div>' +
                        '<div class="product-meta"><span><i class="fas fa-map-marker-alt"></i> ' + safeLocation + '</span></div>' +
                    '</div>' +
                '</a>';
                count++;
            });
            
            if (html) container.innerHTML = html;
        })
        .catch(function(err) {
            console.warn('Could not load similar products:', err);
        });
}

// =========================================================================
// E-COMMERCE BUTTONS FOR SANKOFA STORE
// =========================================================================

function updateProductActions(product) {
    if (!product || typeof product !== 'object') return;
    const actionsContainer = document.getElementById('productActions');
    if (!actionsContainer) return;

    // If this is the seller's own listing, offer the owner controls (goes through the
    // same real delete used on the My Listings page).
    renderOwnerBar(product);

    const isSankofaStore = product.isSankofaStore === true;

    // Is this item already saved? (the heart used to be drawn empty every time, even for an item
    // that was already in the list)
    const favKey = productKey(product);
    const favSaved = (typeof wishlist !== 'undefined' && wishlist && favKey)
        ? wishlist.isInWishlist(favKey) : false;

    if (isSankofaStore && typeof cart !== 'undefined' && typeof wishlist !== 'undefined') {
        // Sankofa Store - Show e-commerce buttons
        const isInWishlist = wishlist.isInWishlist(productKey(product));

        // Pre-order listings: say it plainly before the buyer pays — pay now,
        // dispatch when the stock lands, escrow still protects every cedi.
        let preOrderBanner = '';
        if (product.preOrder === true) {
            let whenTxt = '';
            try { if (product.preOrderDate) whenTxt = new Date(product.preOrderDate + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }); } catch (e) {}

            // MOQ-A: "comes in packs of N" — the cart enforces it, the banner warns of it
            const minQty = Math.max(0, Number(product.minOrderQty) || 0);
            const moqLine = minQty >= 2
                ? `<p style="margin-top:0.35rem;"><i class="fas fa-boxes"></i> Sold in packs — <strong>minimum ${minQty} pieces</strong> per order.</p>`
                : '';

            // MOQ-B: batch target progress + the auto-refund promise, in plain sight
            let batchBlock = '';
            const target = Number(product.preOrderTargetQty) || 0;
            if (target >= 2) {
                const sold = Math.max(0, Number(product.preOrderSoldQty) || 0);
                const pct = Math.min(100, Math.round(sold * 100 / target));
                const left = Math.max(0, target - sold);
                const status = product.preOrderBatchStatus || 'collecting';
                let deadlineTxt = '';
                try { if (product.preOrderDeadline) deadlineTxt = new Date(product.preOrderDeadline + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }); } catch (e) {}
                if (status === 'ready') {
                    batchBlock = `<div class="preorder-batch" style="margin-top:0.5rem;">
                        <div class="preorder-batch-head" style="color:#15803d;"><i class="fas fa-check-circle"></i> <strong>Target reached — this batch is happening!</strong></div>
                        <div class="preorder-batch-bar"><span style="width:100%;background:#22c55e;"></span></div>
                        <p>${sold} of ${target} pieces pre-ordered. Dispatch happens when the stock lands${whenTxt ? ' (expected <strong>' + escapeHtmlDetail(whenTxt) + '</strong>)' : ''}.</p>
                    </div>`;
                } else if (status === 'failed') {
                    batchBlock = `<div class="preorder-batch" style="margin-top:0.5rem;">
                        <div class="preorder-batch-head" style="color:#b91c1c;"><i class="fas fa-undo"></i> <strong>This batch did not fill — all buyers were refunded automatically</strong></div>
                        <p style="color:#7f1d1d;">It closed at ${sold} of ${target} pieces. Every payment went back to buyers' Sankofa Wallets. You can buy again if Sankofa Store relists it.</p>
                    </div>`;
                } else {
                    batchBlock = `<div class="preorder-batch" style="margin-top:0.5rem;">
                        <div class="preorder-batch-head"><i class="fas fa-users"></i> <strong>${sold} of ${target} pieces pre-ordered</strong> — ${left} to go${deadlineTxt ? ' before <strong>' + escapeHtmlDetail(deadlineTxt) + '</strong>' : ''}</div>
                        <div class="preorder-batch-bar"><span style="width:${pct}%;"></span></div>
                        <p>This batch only happens if all ${target} pieces are pre-ordered${deadlineTxt ? ' by <strong>' + escapeHtmlDetail(deadlineTxt) + '</strong>' : ''}. If it falls short, <strong>every buyer is refunded automatically</strong> — in full, straight back to the Sankofa Wallet. No stories.</p>
                    </div>`;
                }
            }

            preOrderBanner = `
            <div class="preorder-banner">
                <div class="preorder-banner-head"><i class="fas fa-clock"></i> <strong>This is a pre-order item</strong></div>
                <p>Pay now as normal — Sankofa Store dispatches when the stock lands${whenTxt ? ' (expected <strong>' + escapeHtmlDetail(whenTxt) + '</strong>)' : ''}.${product.preOrderNote ? ' ' + escapeHtmlDetail(product.preOrderNote) : ''} Your money stays safely in escrow until you confirm delivery, exactly like any other order.</p>
                ${moqLine}
                ${batchBlock}
            </div>`;
        }

        const batchFailed = product.preOrderBatchStatus === 'failed';

        const minQtyBtn = Math.max(1, Number(product.minOrderQty) || 1);
        const hasChoices = Array.isArray(product.variants) && product.variants.length > 0;
        productChoice = null;                                   // a new product starts with no choice made
        actionsContainer.innerHTML = preOrderBanner + (hasChoices ? '<div id="variantPicker" class="variant-picker" style="margin:0.4rem 0 0.9rem;"></div>' : '') + (batchFailed ? `
            <button class="add-to-cart-btn" disabled style="opacity:0.55;cursor:not-allowed;">
                <i class="fas fa-ban"></i> Batch closed — refunded
            </button>
        ` : `
            <button class="add-to-cart-btn" onclick="addToCartFromDetail()">
                <i class="fas fa-cart-plus"></i> ${minQtyBtn >= 2 ? 'Add ' + minQtyBtn + ' (min. pack) to Cart' : 'Add to Cart'}
            </button>
        `) + `
            <button class="wishlist-btn ${isInWishlist ? 'active' : ''}" onclick="toggleWishlistFromDetail()" id="wishlistBtn">
                <i class="${isInWishlist ? 'fas' : 'far'} fa-heart"></i>
                ${isInWishlist ? 'In Wishlist' : 'Add to Wishlist'}
            </button>
            <button class="btn btn-icon" id="shareBtn" title="Share" onclick="shareProduct()">
                <i class="fas fa-share-alt"></i>
            </button>
        `;
        if (hasChoices && typeof variantRenderPicker === 'function') {
            variantRenderPicker(document.getElementById('variantPicker'), product.variants, null, function (choice) { productChoice = choice; });
        }
    } else {
        // Regular seller - Show contact buttons. The sizes and colours the seller offers are shown as information.
        const choicesText = (typeof variantsInfoText === 'function') ? variantsInfoText(product.variants) : '';
        actionsContainer.innerHTML = (choicesText ? '<p class="variant-info" style="font-size:0.9rem;color:#5a6572;margin:0 0 0.8rem;"><i class="fas fa-list"></i> Choices from the seller: ' + variantEsc(choicesText) + '</p>' : '') + `
            <button class="btn btn-primary btn-large" id="contactSellerBtn" onclick="contactSeller()">
                <i class="fas fa-comment"></i> Contact Seller
            </button>
            <button class="btn btn-outline btn-large" id="callSellerBtn" onclick="callSeller()">
                <i class="fas fa-phone"></i> Call
            </button>
            <button class="btn btn-outline btn-large soul-btn ${favSaved ? 'active is-saved' : ''}" id="favoriteBtn"
                    title="${favSaved ? 'Saved — tap to remove' : 'Save this item'}"
                    aria-pressed="${favSaved ? 'true' : 'false'}"
                    onclick="toggleFavorite()">
                <i class="${favSaved ? 'fas' : 'far'} fa-heart"></i> <span class="fav-label">${favSaved ? 'Saved' : 'Save'}</span>
            </button>
            <button class="btn btn-icon" id="shareBtn" title="Share" onclick="shareProduct()">
                <i class="fas fa-share-alt"></i>
            </button>
        `;
    }
}

/** The size / colour the buyer picked on the product page (null until every kind is chosen). */
var productChoice = null;

function addToCartFromDetail() {
    if (typeof currentProduct === 'undefined' || !currentProduct) {
        getFlash('Product not loaded', 'error');
        return;
    }
    if (currentProduct.preOrderBatchStatus === 'failed') {
        getFlash('This batch did not fill — all buyers were refunded', 'warning');
        return;
    }
    const minQty = Math.max(1, Number(currentProduct.minOrderQty) || 1);
    if (typeof cart !== 'undefined') {
        cart.addItem(currentProduct, minQty, productChoice);      // the cart refuses a missing choice
    }
}

/**
 * Owner controls on the product page — only the seller (or an admin) sees this.
 * Removing here does exactly the same as the My Listings page: listing record +
 * its photos are deleted.
 */
function renderOwnerBar(product) {
    try {
        var bar = document.getElementById('ownerListingBar');
        var auth = (typeof firebaseAuth !== 'undefined' && firebaseAuth) ? firebaseAuth
                 : (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
        var me = auth && auth.currentUser;
        if (!me) { if (bar) bar.remove(); return; }
        if (!product || (product.sellerId || product.userId) !== me.uid) { if (bar) bar.remove(); return; }

        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'ownerListingBar';
            bar.style.cssText = 'background:#f0f7ff;border:1px solid #bfdbfe;border-radius:10px;padding:0.75rem 1rem;' +
                'margin-bottom:1rem;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;';
            var host = document.getElementById('productContent');
            if (host) host.insertBefore(bar, host.firstChild);
            else document.body.insertBefore(bar, document.body.firstChild);
        }

        var isSold = product.isSold === true;
        bar.innerHTML =
            '<span style="font-size:0.85rem;color:#1e40af;font-weight:600;">' +
                '<i class="fas fa-user-check"></i> This is your listing' +
            '</span>' +
            '<button type="button" id="ownerToggleSold" class="btn btn-outline btn-small" style="font-size:0.78rem;padding:0.35rem 0.7rem;">' +
                (isSold ? '<i class="fas fa-rotate-left"></i> Mark available' : '<i class="fas fa-check"></i> Mark as sold') +
            '</button>' +
            '<button type="button" id="ownerRemove" class="btn btn-small" style="font-size:0.78rem;padding:0.35rem 0.7rem;background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;">' +
                '<i class="fas fa-trash"></i> Remove listing' +
            '</button>' +
            '<span id="ownerFlashSlot" style="display:inline-flex;align-items:center;gap:0.5rem;flex-wrap:wrap;"></span>' +
            (isSold ? '<span style="font-size:0.78rem;color:#b45309;">Currently marked as sold</span>' : '');

        var toggle = document.getElementById('ownerToggleSold');
        if (toggle) toggle.onclick = function () { ownerToggleSold(product); };
        var remove = document.getElementById('ownerRemove');
        if (remove) remove.onclick = function () { ownerRemoveListing(product); };
        try { paintFlashOwnerControls(product); } catch (e) {}
    } catch (e) { /* owner bar is a convenience — never break the page */ }
}

function ownerToggleSold(product) {
    if (!product || !product._docId) return;
    var makeSold = product.isSold !== true;
    if (!makeSold && !confirm('Make this listing available for sale again?')) return;
    firebaseDB.collection('products').doc(product._docId)
        .update({ isSold: makeSold, soldAt: makeSold ? firebase.firestore.FieldValue.serverTimestamp() : null })
        .then(function () {
            product.isSold = makeSold;
            getFlash(makeSold ? 'Marked as sold' : 'Listing is available again', 'success');
            renderOwnerBar(product);
        })
        .catch(function (err) { getFlash('Could not update: ' + err.message, 'error'); });
}

async function ownerRemoveListing(product) {
    if (!product || !product._docId) return;
    var title = product.title || 'this listing';

    var warn = [];
    try {
        var aSnap = await firebaseDB.collection('auctions').where('productId', '==', product._docId).get();
        aSnap.forEach(function (d) {
            var a = d.data();
            if (a.status === 'live' || a.status === 'scheduled') {
                warn.push('It is in a ' + a.status.toUpperCase() + ' auction' + (a.bidCount ? ' with ' + a.bidCount + ' bid(s)' : '') + ' — that auction will be cancelled.');
            }
        });
    } catch (e) {}

    var msg = 'Remove "' + title + '"?\n\nIt will be deleted from the marketplace and its photos removed.\nThis cannot be undone.';
    if (warn.length) msg = 'Remove "' + title + '"?\n\n' + warn.join('\n') + '\n\nThis cannot be undone.';
    if (!confirm(msg)) return;

    try {
        // cancel any live auction first
        try {
            var live = await firebaseDB.collection('auctions').where('productId', '==', product._docId).get();
            var updates = [];
            live.forEach(function (d) {
                var a = d.data();
                if (a.status === 'live' || a.status === 'scheduled') {
                    updates.push(firebaseDB.collection('auctions').doc(d.id).update({
                        status: 'cancelled', cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
                    }));
                }
            });
            if (updates.length) await Promise.all(updates);
        } catch (e) { console.warn('auction cancel skipped', e); }

        // delete the photos (only the seller's own folder can be removed by them)
        var urls = [].concat(product.imagesThumb || [], product.images || [], product.photos || [])
            .filter(function (u) { return typeof u === 'string' && u.indexOf('firebasestorage') !== -1; });
        urls = urls.filter(function (u, i) { return urls.indexOf(u) === i; });
        for (var i = 0; i < urls.length; i++) {
            try { await firebase.storage().refFromURL(urls[i]).delete(); } catch (e) { /* skip legacy paths */ }
        }

        await firebaseDB.collection('products').doc(product._docId).delete();
        getFlash('Listing removed', 'success');
        setTimeout(function () { window.location.href = 'pages/user/listings.html'; }, 1200);
    } catch (err) {
        console.error('Remove listing failed:', err);
        getFlash('Could not remove the listing: ' + (err.message || err), 'error');
    }
}

function toggleWishlistFromDetail() {
    if (typeof currentProduct === 'undefined' || !currentProduct) {
        getFlash('Product not loaded', 'error');
        return;
    }
    if (typeof wishlist === 'undefined' || !wishlist) {
        getFlash('Saved items are not available on this page — please refresh and try again.', 'error');
        return;
    }

    var key = productKey(currentProduct);
    var button = document.getElementById('wishlistBtn');
    function paint(saved) {
        if (!button) return;
        button.classList.toggle('active', saved);
        button.innerHTML = '<i class="' + (saved ? 'fas' : 'far') + ' fa-heart"></i> ' + (saved ? 'In Wishlist' : 'Add to Wishlist');
    }
    if (wishlist.isInWishlist(key)) {
        if (button) button.disabled = true;
        Promise.resolve(wishlist.removeItem(key)).then(function (removed) {
            if (button) button.disabled = false;
            paint(!removed);
        });
    } else {
        wishlist.addItem(Object.assign({}, currentProduct, { _docId: key }));
        paint(true);
    }
}

/**
 * Contact Seller — creates (or reuses) a Firestore conversation with the
 * seller about the current product, then opens the Messages page.
 */
async function contactSeller() {
    // Must be signed in
    if (!isUserLoggedIn()) {
        getFlash('Please sign in to contact the seller', 'warning');
        setTimeout(function() {
            window.location.href = 'pages/auth/login.html';
        }, 1500);
        return;
    }

    var product = window.currentProduct;
    if (!product || !product.sellerId) {
        getFlash('Seller information not available for this listing', 'error');
        return;
    }

    // Resolve Firestore DB robustly (avoids race where firebase-config loads late)
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);
    if (!db) {
        console.error('Messaging unavailable: firebaseDB not ready', { firebaseExists: typeof firebase !== 'undefined', firebaseDB: typeof firebaseDB !== 'undefined' ? firebaseDB : 'undef' });
        getFlash('Messaging is starting up — please wait 2 seconds and try again.', 'warning');
        return;
    }
    // Prefer the resolved db for all Firestore calls below
    if (typeof firebaseDB === 'undefined' || !firebaseDB) window.firebaseDB = db;

    var me = (typeof firebaseAuth !== 'undefined' && firebaseAuth && firebaseAuth.currentUser) ? firebaseAuth.currentUser : (firebase.auth ? firebase.auth().currentUser : null);
    if (!me) {
        getFlash('Please sign in to contact the seller', 'warning');
        setTimeout(function(){ window.location.href = 'pages/auth/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search); }, 1200);
        return;
    }

    // Can't message yourself
    if (product.sellerId === me.uid) {
        getFlash('This is your own listing — buyers will contact you here.', 'info');
        return;
    }

    getFlash('Opening secure chat with seller...', 'info');

    try {
        // Look for an existing conversation with this seller about this product
        // (single-field query only — no composite index required)
        var snap = await firebaseDB.collection('conversations')
            .where('participants', 'array-contains', me.uid)
            .get();

        var existing = null;
        snap.forEach(function(doc) {
            var d = doc.data();
            if (d.participants && d.participants.indexOf(product.sellerId) !== -1 &&
                d.productId === product._docId) {
                existing = doc.id;
            }
        });

        if (existing) {
            window.location.href = 'pages/user/messages.html?conv=' + existing;
            return;
        }

        // No conversation yet — create one
        var sellerName = product.sellerName || 'Seller';

        // Try to get the seller's real name from their profile
        try {
            var sellerDoc = await firebaseDB.collection('users').doc(product.sellerId).get();
            if (sellerDoc.exists) {
                var sd = sellerDoc.data();
                sellerName = sd.name || (sd.firstName ? sd.firstName + (sd.lastName ? ' ' + sd.lastName : '') : sellerName);
            }
        } catch (e) {}

        var myName = me.displayName || 'Buyer';
        try {
            var myDoc = await firebaseDB.collection('users').doc(me.uid).get();
            if (myDoc.exists) {
                var md = myDoc.data();
                myName = md.name || (md.firstName ? md.firstName + (md.lastName ? ' ' + md.lastName : '') : myName);
            }
        } catch (e) {}

        var images = product.images || product.photos || [];
        var convRef = await firebaseDB.collection('conversations').add({
            participants: [me.uid, product.sellerId],
            participantNames: (function() {
                var names = {};
                names[me.uid] = myName;
                names[product.sellerId] = sellerName;
                return names;
            })(),
            productId: product._docId,
            productTitle: product.title || 'Untitled product',
            productImage: (typeof productThumbAt === 'function') ? productThumbAt(product, 0) : (images.length > 0 ? images[0] : ''),
            productPrice: product.price || 0,
            lastMessage: '',
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            unreadBy: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.location.href = 'pages/user/messages.html?conv=' + convRef.id;
    } catch (err) {
        console.error('Contact seller error:', err);
        getFlash('Could not open chat: ' + err.message, 'error');
    }
}

function callSeller() {
    // Signed out -> they can't see the seller's number
    if (!isUserLoggedIn()) {
        getFlash('Please sign in to view the seller\'s phone number', 'warning');
        setTimeout(function() {
            window.location.href = 'pages/auth/login.html?redirect=' +
                encodeURIComponent(window.location.pathname + window.location.search);
        }, 1500);
        return;
    }

    var prod = window.currentProduct || {};
    var phoneRaw = prod.phone || prod.sellerPhone || prod.sellerWhatsapp || '';
    if (!phoneRaw) {
        getFlash('This seller has not added a phone number — please use Contact Seller instead.', 'info');
        return;
    }

    var phone = String(phoneRaw).replace(/\s/g, '');
    if (confirm('Call seller at ' + phoneRaw + '?\n\nFor safety, we recommend using secure messaging — calls are not recorded for disputes.')) {
        window.location.href = 'tel:' + phone;
    } else {
        getFlash('Tip: Use Contact Seller for escrow-protected chat.', 'info');
    }
}

/**
 * The id a saved item is filed under. Firestore documents come back with `_docId`; older/demo
 * objects carry `id`. Using the wrong one is why the button never showed the saved state: the
 * item was stored under _docId and looked up under the (undefined) id.
 */
function productKey(p) {
    var src = p || (typeof currentProduct !== 'undefined' ? currentProduct : null);
    if (!src) return null;
    return String(src._docId || src.id || '');
}

/**
 * Paint the heart button to match reality: filled and red when saved, outline when not.
 */
function paintFavoriteButton(saved, key) {
    var btn = document.getElementById('favoriteBtn');
    if (!btn) return;
    var icon = btn.querySelector('i');
    if (icon) {
        icon.classList.toggle('fas', !!saved);
        icon.classList.toggle('far', !saved);
    }
    btn.classList.toggle('active', !!saved);
    btn.classList.toggle('is-saved', !!saved);
    btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
    btn.title = saved ? 'Saved — tap to remove' : 'Save this item';
    var lbl = btn.querySelector('.fav-label');
    if (lbl) lbl.textContent = saved ? 'Saved' : 'Save';
}

function toggleFavorite() {
    const p = (typeof currentProduct !== 'undefined' && currentProduct) || window.currentProduct;
    if (!p) { getFlash('Product not loaded', 'error'); return; }

    const key = productKey(p);
    if (!key) { getFlash('This listing has no id, so it cannot be saved.', 'error'); return; }
    if (typeof wishlist === 'undefined' || !wishlist) {
        getFlash('Saved items are not available on this page — please refresh and try again.', 'error');
        return;
    }

    const wasSaved = wishlist.isInWishlist(key);
    if (wasSaved) {
        Promise.resolve(wishlist.removeItem(key)).then(function (removed) {
            if (removed) paintFavoriteButton(false, key);
        });
    } else {
        const item = Object.assign({}, p, { _docId: key });
        wishlist.addItem(item);
        paintFavoriteButton(true, key);
    }
}

function shareProduct() {
    if (navigator.share) {
        navigator.share({
            title: currentProduct.title,
            text: `Check out ${(window.currentProduct || {}).title || 'this item'} on Sankofa Market!`,
            url: window.location.href
        });
    } else {
        // Fallback - copy to clipboard
        const dummy = document.createElement('input');
        document.body.appendChild(dummy);
        dummy.value = window.location.href;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        getFlash('Link copied to clipboard!', 'success');
    }
}

// Update actions when product is loaded
const originalRenderProduct = typeof renderProduct !== 'undefined' ? renderProduct : null;
if (originalRenderProduct) {
    renderProduct = function(product) {
        originalRenderProduct(product);
        window.currentProduct = product;
        updateProductActions(product);
    };
}

/* ============================================================================
   BUYER REVIEWS on the product page
   - average under the price (from the cloud-maintained averageRating/reviewCount)
   - full list of reviews for this product (public reads; rules allow anyone)
   - seller's overall score beside their name (public sellerRatings mirror —
     the users/{id} document itself is owner/admin only)
   ========================================================================== */

function smStarString(roundTo) {
    var s = '';
    for (var i = 1; i <= 5; i++) s += i <= roundTo ? '★' : '☆';
    return s;
}

function renderProductRating(product) {
    var el = document.getElementById('productRatingSummary');
    if (!el) return;
    var avg = Number(product && product.averageRating || 0);
    var count = Number(product && product.reviewCount || 0);
    if (!avg || !count) return;
    el.innerHTML = '<span style="color:#f5af02;letter-spacing:1px;" aria-hidden="true">' + smStarString(Math.round(avg)) + '</span> ' +
        '<strong style="color:#191919;">' + avg.toFixed(1) + '</strong> · ' + count + ' review' + (count === 1 ? '' : 's');
    el.style.display = 'block';
}

function loadProductReviews(product) {
    var pid = product && (product._docId || product.id);
    if (!pid || typeof firebaseDB === 'undefined' || !firebaseDB) return;
    firebaseDB.collection('reviews').where('productId', '==', pid).limit(50).get().then(function (snap) {
        if (snap.empty) return;
        var items = [];
        snap.forEach(function (d) { items.push(d.data()); });
        items.sort(function (a, b) {
            var at = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
            var bt = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
            return bt - at;
        });
        var esc = (typeof escapeHtmlDetail === 'function') ? escapeHtmlDetail : function (t) { return String(t == null ? '' : t); };
        var html = '';
        var total = 0, n = 0;
        items.forEach(function (r) {
            total += Number(r.rating) || 0;
            n++;
        });
        items.forEach(function (r) {
            var when = '';
            if (r.createdAt && r.createdAt.toDate) {
                when = r.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            }
            var name = esc(r.userName || 'Buyer');
            if (name.length > 28) name = name.slice(0, 27) + '…';
            html +=
                '<div style="padding:0.9rem 0;border-bottom:1px solid #e5e7eb;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
                        '<span style="color:#f5af02;font-size:1rem;letter-spacing:1px;" aria-label="' + (Number(r.rating) || 0) + ' out of 5 stars">' + smStarString(Math.round(Number(r.rating) || 0)) + '</span>' +
                        '<span style="font-size:0.75rem;color:#5a6572;">' + when + '</span>' +
                    '</div>' +
                    (r.title ? '<div style="font-weight:700;font-size:0.95rem;margin-top:0.25rem;">' + esc(r.title) + '</div>' : '') +
                    (r.comment ? '<div style="font-size:0.88rem;color:#374151;margin-top:0.25rem;line-height:1.5;">' + esc(r.comment) + '</div>' : '') +
                    '<div style="font-size:0.78rem;color:#5a6572;margin-top:0.35rem;display:flex;align-items:center;gap:0.3rem;">' +
                        '<i class="fas fa-user-circle" aria-hidden="true"></i> ' + name +
                        (r.isVerifiedPurchase ? ' · <span style="color:#16a34a;font-weight:700;"><i class="fas fa-check-circle"></i> Verified purchase</span>' : '') +
                    '</div>' +
                '</div>';
        });
        var avg = n ? Math.round((total / n) * 10) / 10 : 0;
        var countEl = document.getElementById('reviewsCountInline');
        if (countEl) countEl.textContent = '— ' + avg.toFixed(1) + ' average from ' + n + ' buyer' + (n === 1 ? '' : 's');
        var list = document.getElementById('productReviewsList');
        var section = document.getElementById('reviewsSection');
        if (list && section) {
            list.innerHTML = html;
            section.style.display = 'block';
        }
    }).catch(function (e) { console.warn('reviews load failed', e); });
}

function loadSellerRating(sellerId) {
    var el = document.getElementById('sellerRating');
    if (!el || !sellerId || typeof firebaseDB === 'undefined' || !firebaseDB) return;
    firebaseDB.collection('sellerRatings').doc(sellerId).get().then(function (doc) {
        if (!doc.exists) return;
        var d = doc.data();
        var avg = Number(d.avg || 0), count = Number(d.count || 0);
        if (!avg || !count) return;
        el.innerHTML = '<span style="color:#f5af02;">★</span> ' + avg.toFixed(1) +
            ' <span style="color:#5a6572;font-weight:500;">(' + count + ' review' + (count === 1 ? '' : 's') + ')</span>';
        el.style.display = 'inline';
    }).catch(function () {});
}

/* Gold ✓ PREMIUM / purple ◆ DIAMOND pill on the seller card — the public
   sellerPublic/{uid} mirror keeps the tier private while letting shoppers see
   it. premiumExpiry is judged at render time: a lapsed plan stops showing the
   moment it ends. */
function loadSellerPremiumBadge(sellerId) {
    var el = document.getElementById('sellerPremiumBadge');
    if (!el || !sellerId || typeof firebaseDB === 'undefined' || !firebaseDB) return;
    firebaseDB.collection('sellerPublic').doc(sellerId).get().then(function (doc) {
        if (!doc.exists) return;
        var d = doc.data();
        var ends = d.premiumExpiry && d.premiumExpiry.toMillis ? d.premiumExpiry.toMillis() : 0;
        if (!ends || ends <= Date.now()) return;           // plan lapsed
        var tier = String(d.tier || 'gold').toLowerCase();
        var cssId = 'smPremBadgeCssDetail';
        if (!document.getElementById(cssId)) {
            var s = document.createElement('style');
            s.id = cssId;
            s.textContent = '.sm-prem-badge{display:inline-flex;align-items:center;gap:0.25rem;font-size:0.66rem;font-weight:800;letter-spacing:0.4px;padding:0.18rem 0.55rem;border-radius:999px;vertical-align:middle;line-height:1.4;}' +
                '.sm-prem-badge.gold{background:#f5af02;color:#191919;}' +
                '.sm-prem-badge.diamond{background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;}';
            document.head.appendChild(s);
        }
        el.innerHTML = tier === 'diamond'
            ? '<span class="sm-prem-badge diamond" title="Diamond seller — top premium tier"><i class="fas fa-gem"></i> DIAMOND</span>'
            : '<span class="sm-prem-badge gold" title="Premium seller"><i class="fas fa-check-circle"></i> PREMIUM</span>';
        el.style.display = 'inline';
        // ring the avatar so the premium feel is visible anywhere on the page
        var av = document.getElementById('sellerAvatar');
        if (av) av.style.boxShadow = '0 0 0 3px ' + (tier === 'diamond' ? '#7c3aed' : '#f5af02');
    }).catch(function () {});
}

/* ============================================================================
   FOLLOW this seller
   - anyone can follow any seller; Sankofa Store's official account gets the
     gold spotlight button
   - the follower count line comes from the public sellerFollowStats mirror
   - signed-out shoppers are sent to sign in first, and come back here after
   ========================================================================== */

function initFollowButton(product) {
    var btn = document.getElementById('followSellerBtn');
    if (!btn || !product || !product.sellerId) return;
    var sellerId = product.sellerId;
    var isOfficial = product.isSankofaStore === true;
    var sellerDisplay = product.sellerName || (isOfficial ? 'Sankofa Store' : 'this seller');

    // Follower count (public mirror; the stats doc may not exist yet — that's fine)
    if (typeof firebaseDB !== 'undefined' && firebaseDB) {
        firebaseDB.collection('sellerFollowStats').doc(sellerId).get().then(function (d) {
            var el = document.getElementById('sellerFollowers');
            var n = d.exists ? Number(d.data().followers || 0) : 0;
            if (el && n > 0) {
                el.textContent = '👥 ' + n + ' follower' + (n === 1 ? '' : 's');
                el.style.display = 'block';
            }
        }).catch(function () {});
    }

    if (typeof firebase === 'undefined') return;
    firebase.auth().onAuthStateChanged(function (user) {
        if (user && user.uid === sellerId) { btn.style.display = 'none'; return; }   // own product

        // Official store gets the gold spotlight; every other seller: outline
        if (isOfficial) {
            btn.className = 'btn btn-full';
            btn.style.background = '#f5af02';
            btn.style.color = '#191919';
            btn.style.border = 'none';
            btn.style.fontWeight = '800';
        } else {
            btn.className = 'btn btn-outline btn-full';
        }
        btn.style.display = 'block';

        if (!user) {
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Follow ' + (isOfficial ? 'Sankofa Store' : 'seller');
            btn.onclick = function () {
                window.location.href = '/pages/auth/login.html?redirect=' +
                    encodeURIComponent('/product-detail.html?id=' + (product._docId || product.id || ''));
            };
            return;
        }

        var followRef = firebaseDB.collection('follows').doc(user.uid + '_' + sellerId);
        function paint(following) {
            btn.dataset.following = following ? '1' : '';
            btn.innerHTML = following
                ? '<i class="fas fa-user-check"></i> Following — tap to unfollow'
                : '<i class="fas fa-user-plus"></i> Follow ' + (isOfficial ? 'Sankofa Store' : 'seller');
        }
        followRef.get().then(function (snap) { paint(snap.exists); })
                       .catch(function () { paint(false); });

        btn.onclick = function () {
            if (btn.disabled) return;
            btn.disabled = true;
            var following = btn.dataset.following === '1';
            var write = following
                ? followRef.delete()
                : followRef.set({
                    followerId: user.uid,
                    followerName: user.displayName || user.email || 'User',
                    sellerId: sellerId,
                    sellerName: sellerDisplay,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
            write.then(function () {
                paint(!following);
                if (typeof showFlashMessage === 'function') {
                    showFlashMessage(!following
                        ? 'Following ' + sellerDisplay + ' — their new items will appear on your homepage'
                        : 'Unfollowed ' + sellerDisplay, 'success');
                }
            }).catch(function (e) {
                if (typeof showFlashMessage === 'function') showFlashMessage('Could not update follow: ' + e.message, 'error');
            }).finally(function () { btn.disabled = false; });
        };
    });
}

/* ============================================================================
   QUESTIONS & COMMENTS — the public Q&A thread under every listing
   - anyone signed-in can ask or reply (ONE level of replies, like eBay Q&A)
   - the seller's answers carry a gold SELLER badge
   - authors delete their own comments; the seller can delete anything on
     their own listing; 3 reports from 3 different people hides a comment
   - security lives in firestore.rules (comments) + the moderation function
   ========================================================================== */

var _smComments = { product: null, user: null, items: [], openReplyId: null, posting: false, authWired: false, reported: {} };
var smCommentActionBtnStyle = 'background:none;border:none;color:#0064d2;font-size:0.78rem;font-weight:700;cursor:pointer;padding:0.45rem 0.4rem;min-height:34px;';

function smCommentEsc(t) {
    return (typeof escapeHtmlDetail === 'function') ? escapeHtmlDetail(t) : String(t == null ? '' : t);
}
function smCommentFlash(msg, type) {
    if (typeof showFlashMessage === 'function') showFlashMessage(msg, type || 'info');
    else if (typeof getFlash === 'function') { try { getFlash(msg, type || 'info'); } catch (e) {} }
}
function smCommentAuthor(user) {
    return (user && (user.displayName || (user.email ? user.email.split('@')[0] : ''))) || 'Member';
}
function smCommentTimeAgo(t) {
    var ms = 0;
    if (t && t.toMillis) ms = t.toMillis();
    else if (t) ms = Date.parse(t);
    if (!ms) return '';
    var s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24); if (d < 7) return d + 'd ago';
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initComments(product) {
    if (!product || !(product._docId || product.id)) return;
    _smComments.product = product;
    _smComments.openReplyId = null;
    if (typeof firebase !== 'undefined' && !_smComments.authWired) {
        _smComments.authWired = true;
        firebase.auth().onAuthStateChanged(function (user) {
            _smComments.user = user;
            smRenderCommentComposer();
            smRenderCommentList();      // action buttons depend on who is looking
        });
    } else if (typeof firebase === 'undefined') {
        smRenderCommentComposer();
    }
    loadProductComments();
}

function smRenderCommentComposer() {
    var box = document.getElementById('commentComposer');
    if (!box || !_smComments.product) return;
    var pid = _smComments.product._docId || _smComments.product.id;
    var me = _smComments.user;
    if (!me) {
        box.innerHTML =
            '<div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:0.85rem;text-align:center;">' +
            '<a href="/pages/auth/login.html?redirect=' + encodeURIComponent('/product-detail.html?id=' + pid) + '" ' +
               'style="display:inline-block;min-height:44px;line-height:30px;background:#0064d2;color:#fff;padding:0.55rem 1.1rem;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.88rem;box-sizing:border-box;">' +
               '<i class="fas fa-comment"></i> Sign in to ask a question</a>' +
            '<div style="font-size:0.75rem;color:#5a6572;margin-top:0.45rem;">Asks are public — the seller and the community answer.</div>' +
            '</div>';
        return;
    }
    box.innerHTML =
        '<div style="display:flex;gap:0.55rem;align-items:flex-start;">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:#0064d2;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.95rem;flex-shrink:0;" aria-hidden="true">' +
            smCommentEsc(smCommentAuthor(me).charAt(0).toUpperCase()) + '</div>' +
        '<div style="flex:1;min-width:0;">' +
            '<textarea id="commentInput" maxlength="500" rows="2" placeholder="Ask about this item…" ' +
            'style="width:100%;box-sizing:border-box;border:1.5px solid #d1d5db;border-radius:10px;padding:0.55rem 0.7rem;font-family:inherit;font-size:0.92rem;resize:vertical;"></textarea>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.4rem;">' +
            '<span id="commentCharCount" style="font-size:0.72rem;color:#9ca3af;">0 / 500</span>' +
            '<button type="button" id="commentPostBtn" ' +
            'style="min-height:44px;background:#f5af02;color:#191919;border:none;border-radius:8px;padding:0.5rem 1.2rem;font-weight:800;font-size:0.86rem;cursor:pointer;">' +
            '<i class="fas fa-paper-plane"></i> Post</button>' +
            '</div>' +
        '</div>' +
        '</div>';
    var ta = document.getElementById('commentInput');
    var cc = document.getElementById('commentCharCount');
    var pb = document.getElementById('commentPostBtn');
    if (ta && cc) ta.addEventListener('input', function () { cc.textContent = ta.value.length + ' / 500'; });
    if (pb) pb.addEventListener('click', function () { postProductComment(null); });
}

function loadProductComments() {
    var pid = _smComments.product && (_smComments.product._docId || _smComments.product.id);
    var list = document.getElementById('productCommentsList');
    if (!pid || !list) return;
    if (typeof firebaseDB === 'undefined' || !firebaseDB) {
        list.innerHTML = '<div style="font-size:0.85rem;color:#5a6572;">Comments are unavailable right now — try refreshing.</div>';
        return;
    }
    firebaseDB.collection('comments').where('productId', '==', pid).limit(100).get().then(function (snap) {
        var items = [];
        snap.forEach(function (d) { var x = d.data(); x._id = d.id; items.push(x); });
        items.sort(function (a, b) {   // oldest first — conversations read naturally that way
            var am = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
            var bm = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
            return am - bm;
        });
        _smComments.items = items;
        smRenderCommentList();
    }).catch(function (e) {
        console.warn('comments load failed', e);
        if (list) list.innerHTML = '<div style="font-size:0.85rem;color:#5a6572;">Could not load comments.</div>';
    });
}

function smRenderCommentList() {
    var list = document.getElementById('productCommentsList');
    if (!list || !_smComments.product) return;
    var sellerId = _smComments.product.sellerId || '';
    var me = _smComments.user;
    var visible = _smComments.items.filter(function (c) { return c.reported !== true; });

    var tops = [], repliesByParent = {}, topIds = {};
    visible.forEach(function (c) { if (!(typeof c.parentId === 'string' && c.parentId)) tops.push(c); });
    tops.forEach(function (c) { topIds[c._id] = true; });
    visible.forEach(function (c) {
        if (c.parentId && topIds[c.parentId]) {
            if (!repliesByParent[c.parentId]) repliesByParent[c.parentId] = [];
            repliesByParent[c.parentId].push(c);
        }
    });

    var shownCount = tops.length;
    Object.keys(repliesByParent).forEach(function (k) { shownCount += repliesByParent[k].length; });
    var ci = document.getElementById('commentsCountInline');
    if (ci) ci.textContent = shownCount ? '— ' + shownCount + (shownCount === 1 ? ' comment' : ' comments') : '';

    if (!tops.length) {
        list.innerHTML = '<div style="font-size:0.86rem;color:#5a6572;background:#f8fafc;border-radius:10px;padding:0.9rem;text-align:center;margin-top:0.6rem;">No questions yet — be the first to ask above.</div>';
        wireCommentActionsOnce(list);
        return;
    }
    var html = '<div id="commentsThread">';
    tops.forEach(function (c) {
        html += smCommentHtml(c, sellerId, me, false);
        var reps = repliesByParent[c._id] || [];
        if (reps.length) {
            html += '<div style="margin:0.4rem 0 0 1.5rem;padding-left:0.7rem;border-left:2px solid #e5e7eb;">';
            reps.forEach(function (r) { html += smCommentHtml(r, sellerId, me, true); });
            html += '</div>';
        }
    });
    html += '</div>';
    list.innerHTML = html;
    wireCommentActionsOnce(list);
}

function smCommentHtml(c, sellerId, me, isReply) {
    var name = smCommentEsc(c.userName || 'Member');
    if (name.length > 26) name = name.slice(0, 25) + '…';
    var isSeller = !!(sellerId && c.userId === sellerId);
    var when = smCommentTimeAgo(c.createdAt);
    var text = smCommentEsc(c.text || '').replace(/\n/g, '<br>');
    var avatarBg = isSeller ? '#f5af02' : '#0064d2';
    var avatarColor = isSeller ? '#191919' : '#fff';
    return '<div class="sm-comment" data-cid="' + smCommentEsc(c._id) + '" data-auid="' + smCommentEsc(c.userId || '') + '" ' +
        'style="padding:0.7rem 0;' + (isReply ? '' : 'border-bottom:1px solid #e5e7eb;') + '">' +
        '<div style="display:flex;gap:0.5rem;align-items:flex-start;">' +
        '<div style="width:30px;height:30px;border-radius:50%;background:' + avatarBg + ';color:' + avatarColor + ';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.8rem;flex-shrink:0;" aria-hidden="true">' +
            smCommentEsc(String(c.userName || 'M').charAt(0).toUpperCase()) + '</div>' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">' +
            '<span style="font-weight:700;font-size:0.86rem;color:#191919;">' + name + '</span>' +
            (isSeller ? '<span style="background:#f5af02;color:#191919;font-size:0.62rem;font-weight:800;padding:0.12rem 0.45rem;border-radius:999px;letter-spacing:0.4px;">SELLER</span>' : '') +
            (when ? '<span style="font-size:0.72rem;color:#9ca3af;">' + when + '</span>' : '') +
        '</div>' +
        '<div style="font-size:0.88rem;color:#374151;line-height:1.5;margin-top:0.18rem;word-wrap:break-word;overflow-wrap:break-word;">' + text + '</div>' +
        '<div style="display:flex;gap:0.4rem;margin-top:0.3rem;flex-wrap:wrap;">' +
            (me && !isReply ? '<button type="button" data-cact="reply" aria-label="Reply to this comment" style="' + smCommentActionBtnStyle + '"><i class="fas fa-comment"></i> Reply</button>' : '') +
            (me && me.uid !== c.userId ? '<button type="button" data-cact="report" aria-label="Report this comment" style="' + smCommentActionBtnStyle + '"><i class="fas fa-flag"></i> Report</button>' : '') +
            (me && (me.uid === c.userId || me.uid === sellerId) ? '<button type="button" data-cact="delete" aria-label="Delete this comment" style="' + smCommentActionBtnStyle + 'color:#dc2626;"><i class="fas fa-trash-alt"></i> Delete</button>' : '') +
        '</div>' +
        '<div class="reply-slot"></div>' +
        '</div>' +
        '</div>' +
        '</div>';
}

function wireCommentActionsOnce(list) {
    if (list._smWired) return;
    list._smWired = true;
    list.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-cact]');
        if (!btn) return;
        var card = btn.closest('.sm-comment');
        var cid = card ? card.getAttribute('data-cid') : null;
        var auid = card ? card.getAttribute('data-auid') : null;
        var act = btn.getAttribute('data-cact');
        if (act === 'reply') smToggleCommentReplyBox(card, cid);
        else if (act === 'report') reportProductComment(cid, auid);
        else if (act === 'delete') deleteProductComment(cid);
    });
}

function smToggleCommentReplyBox(card, cid) {
    if (!_smComments.user || !card || !cid) return;
    var open = _smComments.openReplyId === cid;
    var slots = document.querySelectorAll('#productCommentsList .reply-slot');
    Array.prototype.forEach.call(slots, function (s) { s.innerHTML = ''; });
    if (open) { _smComments.openReplyId = null; return; }
    _smComments.openReplyId = cid;
    var slot = card.querySelector('.reply-slot');
    if (!slot) return;
    slot.innerHTML =
        '<div style="display:flex;gap:0.4rem;align-items:flex-start;margin-top:0.45rem;">' +
        '<textarea id="replyInput-' + smCommentEsc(cid) + '" maxlength="500" rows="2" placeholder="Write a reply…" ' +
            'style="flex:1;min-width:0;border:1.5px solid #d1d5db;border-radius:8px;padding:0.45rem 0.6rem;font-family:inherit;font-size:0.86rem;resize:vertical;"></textarea>' +
        '<button type="button" id="replyPost-' + smCommentEsc(cid) + '" ' +
            'style="min-height:44px;background:#f5af02;color:#191919;border:none;border-radius:8px;padding:0.45rem 0.9rem;font-weight:800;font-size:0.82rem;cursor:pointer;">' +
            '<i class="fas fa-paper-plane"></i></button>' +
        '</div>';
    var ta = document.getElementById('replyInput-' + cid);
    var pb = document.getElementById('replyPost-' + cid);
    if (ta) ta.focus();
    if (pb) pb.addEventListener('click', function () { postProductComment(cid); });
}

function postProductComment(parentId) {
    var me = _smComments.user;
    if (!me || _smComments.posting || typeof firebaseDB === 'undefined' || !firebaseDB) return;
    var ta = parentId ? document.getElementById('replyInput-' + parentId) : document.getElementById('commentInput');
    var text = (ta && ta.value || '').trim();
    if (!text) { smCommentFlash('Type something first.', 'error'); if (ta) ta.focus(); return; }
    if (text.length > 500) text = text.slice(0, 500);
    var p = _smComments.product;
    var doc = {
        productId: p._docId || p.id,
        productTitle: String(p.title || 'this item').slice(0, 80),
        sellerId: p.sellerId || '',
        userId: me.uid,
        userName: smCommentAuthor(me).slice(0, 60),
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (parentId) doc.parentId = parentId;
    _smComments.posting = true;
    firebaseDB.collection('comments').add(doc).then(function () {
        _smComments.posting = false;
        if (ta) ta.value = '';
        var cc = document.getElementById('commentCharCount');
        if (cc && !parentId) cc.textContent = '0 / 500';
        _smComments.openReplyId = null;
        smCommentFlash(parentId ? 'Reply posted.' : 'Question posted — the seller was notified.', 'success');
        loadProductComments();
    }, function (e) {
        _smComments.posting = false;
        smCommentFlash('Could not post: ' + e.message, 'error');
    });
}

function reportProductComment(commentId, authorId) {
    var me = _smComments.user;
    if (!me || !commentId || !authorId || typeof firebaseDB === 'undefined' || !firebaseDB) return;
    if (_smComments.reported[commentId]) { smCommentFlash('You already reported this comment.', 'info'); return; }
    if (!window.confirm('Report this comment to the moderation team? It is hidden automatically after 3 reports from different people.')) return;
    var c = null;
    _smComments.items.forEach(function (x) { if (x._id === commentId) c = x; });
    var p = _smComments.product || {};
    firebaseDB.collection('reports').add({
        reporterId: me.uid,
        reportedUserId: authorId,
        reason: 'Comment on "' + String(p.title || 'item').slice(0, 60) + '": "' + String((c && c.text) || '').slice(0, 140) + '"',
        status: 'open',
        commentId: commentId,
        productId: p._docId || p.id || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
        _smComments.reported[commentId] = true;
        smCommentFlash('Thanks — our team will review this comment.', 'success');
    }, function (e) {
        smCommentFlash('Could not send the report: ' + e.message, 'error');
    });
}

function deleteProductComment(commentId) {
    if (!commentId || typeof firebaseDB === 'undefined' || !firebaseDB) return;
    if (!window.confirm('Delete this comment?')) return;
    firebaseDB.collection('comments').doc(commentId).delete().then(function () {
        smCommentFlash('Comment deleted.', 'success');
        loadProductComments();
    }, function (e) {
        smCommentFlash('Could not delete: ' + e.message, 'error');
    });
}

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled "classic" <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.escapeHtmlDetail = escapeHtmlDetail;
window.isUserLoggedIn = isUserLoggedIn;
window.getFlash = getFlash;
window.injectPaymentSafetyWarnings = injectPaymentSafetyWarnings;
window.initGallery = initGallery;
window.openPhotoViewer = openPhotoViewer;
window.loadFullPhoto = loadFullPhoto;
window.photoViewerKeys = photoViewerKeys;
window.closePhotoViewer = closePhotoViewer;
window.initProductActions = initProductActions;
window.copyToClipboard = copyToClipboard;
window.loadProductFromURL = loadProductFromURL;
window.renderProduct = renderProduct;
window.renderDeliveryInfo = renderDeliveryInfo;
window.loadSimilarProducts = loadSimilarProducts;
window.updateProductActions = updateProductActions;
window.addToCartFromDetail = addToCartFromDetail;
window.renderOwnerBar = renderOwnerBar;
window.ownerToggleSold = ownerToggleSold;
window.ownerRemoveListing = ownerRemoveListing;
window.toggleWishlistFromDetail = toggleWishlistFromDetail;
window.contactSeller = contactSeller;
window.callSeller = callSeller;
window.toggleFavorite = toggleFavorite;
window.shareProduct = shareProduct;

/* ===== FLASH SALE — owner controls + modal ===== */
var _flashTier;
async function ensureFlashTier() {
    if (_flashTier !== undefined) return _flashTier;
    _flashTier = null;
    try {
        var u = firebase.auth().currentUser;
        if (!u) return null;
        var d = await firebaseDB.collection('users').doc(u.uid).get();
        var x = d.exists ? (d.data() || {}) : {};
        var exp = x.premiumExpiry && x.premiumExpiry.toDate ? x.premiumExpiry.toDate() : null;
        var t = String(x.premiumTier || x.sellerTier || '').toLowerCase();
        if (x.isPremium === true && exp && exp > new Date() && ['gold', 'diamond'].indexOf(t) !== -1) _flashTier = t;
    } catch (e) {}
    return _flashTier;
}

async function paintFlashOwnerControls(product) {
    var slot = document.getElementById('ownerFlashSlot');
    if (!slot || !product) return;
    smFlashCssDetail();
    var fl = smFlashActive(product);
    if (fl) {
        slot.innerHTML = '<span class="owner-flash-live"><i class="fas fa-bolt"></i> FLASH -' + fl.percent + '% · ' + smFlashCountdownStr(fl.endsAt) + ' left</span>' +
            '<button type="button" id="ownerFlashEnd" class="btn btn-outline btn-small" style="font-size:0.78rem;padding:0.35rem 0.7rem;"><i class="fas fa-times"></i> End sale</button>';
        var endBtn = document.getElementById('ownerFlashEnd');
        if (endBtn) endBtn.addEventListener('click', function () { endFlashSale(product); });
        return;
    }
    var tier = await ensureFlashTier();
    var slotNow = document.getElementById('ownerFlashSlot');
    if (!slotNow) return;
    if (tier) {
        slotNow.innerHTML = '<button type="button" id="ownerFlashStart" class="btn btn-small owner-flash-btn" style="font-size:0.78rem;padding:0.35rem 0.7rem;"><i class="fas fa-bolt"></i> Flash sale</button>';
        var b = document.getElementById('ownerFlashStart');
        if (b) b.addEventListener('click', function () { openFlashSaleModal(product); });
    } else {
        slotNow.innerHTML = '<a href="pages/user/become-seller.html" class="btn btn-small" style="font-size:0.78rem;padding:0.35rem 0.7rem;background:#fef3e2;color:#b45309;border:1px solid #f5e0b8;text-decoration:none;" title="Flash sales are a Gold and Diamond perk"><i class="fas fa-bolt"></i> Flash sale (Gold+)</a>';
    }
}

var _flashPick = { percent: 30, hours: 24 };
function openFlashSaleModal(product) {
    if (!product || !product._docId) return;
    if (smFlashActive(product)) { getFlash('A flash sale is already running on this item.', 'info'); return; }
    closeFlashSaleModal();
    _flashPick = { percent: 30, hours: 24 };
    var wrap = document.createElement('div');
    wrap.id = 'flashSaleModal';
    wrap.className = 'sm-flash-modal-wrap';
    wrap.innerHTML =
        '<div class="sm-flash-modal">' +
            '<div style="font-size:1rem;font-weight:800;color:#1f2a37;display:flex;align-items:center;gap:0.5rem;"><i class="fas fa-bolt" style="color:#dc2626;"></i> Start a flash sale <span class="sm-followers-perk" style="background:#fee2e2;color:#b91c1c;">Gold+</span></div>' +
            '<p style="font-size:0.8rem;color:#5a6572;margin:0.3rem 0 0.2rem;">Everywhere your item shows — search, homepage, this page and chats — buyers see the sale price with a countdown. When time runs out the price goes back up on its own.</p>' +
            '<div style="font-size:0.78rem;font-weight:700;color:#4b5563;">Discount</div>' +
            '<div class="sm-flash-chips" id="flashPctChips">' +
                [10, 20, 30, 50].map(function (n) { return '<button type="button" class="sm-flash-chip' + (n === 30 ? ' on' : '') + '" data-p="' + n + '">-' + n + '%</button>'; }).join('') +
                '<input type="number" id="flashPctInput" min="1" max="90" value="30" style="width:70px;border:1px solid #f3c1c1;border-radius:999px;padding:0.35rem 0.6rem;font-weight:700;color:#b91c1c;text-align:center;" title="custom % (1–90)">' +
            '</div>' +
            '<div style="font-size:0.78rem;font-weight:700;color:#4b5563;">How long?</div>' +
            '<div class="sm-flash-chips" id="flashTimeChips">' +
                [6, 12, 24, 48].map(function (n) { return '<button type="button" class="sm-flash-chip time' + (n === 24 ? ' on' : '') + '" data-h="' + n + '">' + n + 'h</button>'; }).join('') +
            '</div>' +
            '<div id="flashPreview" style="font-size:0.82rem;color:#0e9f6e;font-weight:700;margin:0.2rem 0 0.6rem;"></div>' +
            '<div style="display:flex;justify-content:flex-end;gap:0.5rem;">' +
                '<button type="button" class="btn btn-outline btn-small" id="flashCancelBtn">Cancel</button>' +
                '<button type="button" class="btn btn-small owner-flash-btn" id="flashGoBtn" style="font-weight:800;"><i class="fas fa-bolt"></i> Start sale</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(wrap);
    function preview() {
        var base = Number(product.price || 0);
        var now = Math.round(base * (1 - _flashPick.percent / 100) * 100) / 100;
        var el = document.getElementById('flashPreview');
        if (el) el.innerHTML = 'Buyers will pay <b>GHS ' + now.toLocaleString() + '</b> instead of GHS ' + base.toLocaleString() + ' for the next ' + _flashPick.hours + 'h.';
    }
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeFlashSaleModal(); });
    document.getElementById('flashCancelBtn').addEventListener('click', closeFlashSaleModal);
    document.querySelectorAll('#flashPctChips .sm-flash-chip').forEach(function (c) {
        c.addEventListener('click', function () {
            document.querySelectorAll('#flashPctChips .sm-flash-chip').forEach(function (x) { x.classList.remove('on'); });
            c.classList.add('on');
            _flashPick.percent = Number(c.getAttribute('data-p'));
            document.getElementById('flashPctInput').value = _flashPick.percent;
            preview();
        });
    });
    document.getElementById('flashPctInput').addEventListener('input', function (e) {
        var v = Math.round(Number(e.target.value) || 0);
        _flashPick.percent = v;
        document.querySelectorAll('#flashPctChips .sm-flash-chip').forEach(function (x) { x.classList.toggle('on', Number(x.getAttribute('data-p')) === v); });
        preview();
    });
    document.querySelectorAll('#flashTimeChips .sm-flash-chip').forEach(function (c) {
        c.addEventListener('click', function () {
            document.querySelectorAll('#flashTimeChips .sm-flash-chip').forEach(function (x) { x.classList.remove('on'); });
            c.classList.add('on');
            _flashPick.hours = Number(c.getAttribute('data-h'));
            preview();
        });
    });
    document.getElementById('flashGoBtn').addEventListener('click', function () { submitFlashSale(product); });
    preview();
}
function closeFlashSaleModal() {
    var m = document.getElementById('flashSaleModal');
    if (m) m.parentNode.removeChild(m);
}
async function submitFlashSale(product) {
    var pct = Math.round(Number(_flashPick.percent) || 0);
    var hrs = Number(_flashPick.hours) || 24;
    if (!(pct >= 1 && pct <= 90)) { getFlash('Discount must be between 1% and 90%.', 'error'); return; }
    var me = firebase.auth().currentUser;
    if (!me) { getFlash('Please sign in again.', 'error'); return; }
    var btn = document.getElementById('flashGoBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting…'; }
    var ends = new Date(Date.now() + hrs * 3600 * 1000);
    try {
        await firebaseDB.collection('products').doc(product._docId).update({
            flashSale: {
                percent: pct,
                startedAt: firebase.firestore.FieldValue.serverTimestamp(),
                endsAt: firebase.firestore.Timestamp.fromDate(ends),
                startedBy: me.uid
            }
        });
        product.flashSale = { percent: pct, endsAt: firebase.firestore.Timestamp.fromDate(ends), startedBy: me.uid };
        closeFlashSaleModal();
        getFlash('⚡ Flash sale live: -' + pct + '% for ' + hrs + ' hours!', 'success');
        paintFlashAwarePrice(product, document.getElementById('productPrice'));
        renderOwnerBar(product);
    } catch (e) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-bolt"></i> Start sale'; }
        getFlash('Could not start the sale: ' + (e && e.message ? e.message : e), 'error');
    }
}
async function endFlashSale(product) {
    if (!product || !product._docId) return;
    if (!confirm('End the flash sale now? The price goes back up immediately.')) return;
    try {
        await firebaseDB.collection('products').doc(product._docId).update({
            flashSale: firebase.firestore.FieldValue.delete()
        });
        product.flashSale = null;
        getFlash('Flash sale ended — normal price restored.', 'success');
        paintFlashAwarePrice(product, document.getElementById('productPrice'));
        renderOwnerBar(product);
    } catch (e) {
        getFlash('Could not end the sale: ' + (e && e.message ? e.message : e), 'error');
    }
}


/**
 * Storefront discovery: when the seller of this listing has a LIVE shop
 * (stores/{sellerId} with isActive), the seller card grows a gold
 * "Visit their shop" button. One read per seller per browser session
 * (sessionStorage cache) — reading the shop costs a stranger nothing extra
 * since inactive stores are simply not readable (rules) and the button hides.
 */
async function smAttachVisitShopButton(sellerId) {
    var btn = document.getElementById('visitShopBtn');
    if (!btn) return;
    btn.style.display = 'none';
    if (!sellerId) return;

    var cacheKey = 'sankofa_store_link_' + sellerId;
    var store = null;
    try {
        var cached = sessionStorage.getItem(cacheKey);
        if (cached === 'none') return;                    // known: no live shop this session
        if (cached) store = JSON.parse(cached);
    } catch (e) {}

    if (!store) {
        try {
            if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
            var snap = await firebaseDB.collection('stores').doc(sellerId).get();
            if (!snap.exists || !snap.data().isActive) {
                try { sessionStorage.setItem(cacheKey, 'none'); } catch (e) {}
                return;
            }
            store = { slug: snap.data().slug, storeName: snap.data().storeName };
            try { sessionStorage.setItem(cacheKey, JSON.stringify(store)); } catch (e) {}
        } catch (e) {
            return;   // rules denied / offline — the button simply stays hidden
        }
    }

    if (!store || !store.slug) return;
    var label = document.getElementById('visitShopLabel');
    if (label) label.textContent = 'Visit ' + String(store.storeName || 'their shop');
    btn.href = '/store/' + store.slug;
    btn.style.display = 'block';
}
window.smAttachVisitShopButton = smAttachVisitShopButton;
