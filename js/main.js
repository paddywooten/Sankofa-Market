/**
 * Sankofa Market - Main JavaScript
 * Core functionality for the marketplace
 */


// ============================================================================
// INITIALIZATION
// ============================================================================

function loadSankofaMaintenanceGuard(){
    if (window.startSankofaMaintenanceGuard){
        window.startSankofaMaintenanceGuard();
        return;
    }
    if (window._sankofaMaintenanceGuardLoading) return;
    window._sankofaMaintenanceGuardLoading = true;
    var script = document.createElement('script');
    script.src = '/js/maintenance-mode.js?v=1';
    script.async = true;
    script.onload = function(){
        window._sankofaMaintenanceGuardLoading = false;
        if (window.startSankofaMaintenanceGuard) window.startSankofaMaintenanceGuard();
    };
    script.onerror = function(){ window._sankofaMaintenanceGuardLoading = false; };
    document.head.appendChild(script);
}

loadSankofaMaintenanceGuard();

document.addEventListener('DOMContentLoaded', function() {
    console.log('🇬🇭 Sankofa Market Loaded - Give Your Items New Life!');
    // PWA Service Worker — cache shell + images for instant loads (GHS data still via Firestore IndexedDB)
    try{
        if('serviceWorker' in navigator){
            navigator.serviceWorker.register('/sw.js').then(function(reg){
                console.log('✅ SW registered', reg.scope);
                // Auto-update when new SW available
                if(reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
                reg.addEventListener('updatefound', function(){
                    const nw = reg.installing;
                    if(nw) nw.addEventListener('statechange', function(){
                        if(nw.state==='installed' && navigator.serviceWorker.controller){
                            console.log('New SW ready — refresh to update');
                            // Optionally show toast: new version available
                            try{ if(typeof showFlashMessage==='function') showFlashMessage('New version available — refresh to update', 'info'); }catch(e){}
                        }
                    });
                });
            }).catch(function(e){ console.warn('SW failed', e); });
            // Reload when new SW takes over
            let refreshing=false;
            navigator.serviceWorker.addEventListener('controllerchange', function(){ if(refreshing) return; refreshing=true; window.location.reload(); });
        }
    }catch(e){}
    
    // Initialize features
    initNavbar();
    initSmoothScroll();
    initScrollEffects();
    initFlashMessages();
    updateUserNav();
    refreshMessageBadges();
    ensureHeaderMessagesBtn();
    // Auction header button moved below carousel — not in header anymore
    var _ab = document.getElementById('headerAuctionBtn'); if (_ab) _ab.remove();
    ensureAppBottomNav();
    ensureNotificationBell();
    refreshNotificationBell();
    initGlobalMessageBadge();
    ensureAuctionAlertBar();
    initGlobalAuctionAlert();
});

// ============================================================================
// NAVIGATION
// ============================================================================

function initNavbar() {
    const header = document.querySelector('.header');
    
    // Sticky header on scroll
    if (header) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                header.style.boxShadow = 'var(--shadow-md)';
            } else {
                header.style.boxShadow = 'var(--shadow-sm)';
            }
        });
    }
}

// ============================================================================
// SMOOTH SCROLL
// ============================================================================

function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href === '#') return;
            
            const target = document.querySelector(href);
            
            if (target) {
                e.preventDefault();
                
                const offsetTop = target.offsetTop - 80;
                
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// ============================================================================
// SCROLL EFFECTS
// ============================================================================

function initScrollEffects() {
    // Add fade-in animation to elements as they come into view
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe product cards and sections
    const elements = document.querySelectorAll('.product-card, .category-card, .step-card');
    elements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// ============================================================================
// FLASH MESSAGES
// ============================================================================

function initFlashMessages() {
    // Auto-hide flash messages after 5 seconds
    const flashMessages = document.querySelectorAll('.flash-message');
    flashMessages.forEach(message => {
        setTimeout(() => {
            message.style.opacity = '0';
            message.style.transition = 'opacity 0.3s ease';
            
            setTimeout(() => {
                message.remove();
            }, 300);
        }, 5000);
    });
}

/**
 * Escape text before it is placed into innerHTML (flash messages, admin tables,
 * cart rows...). User-supplied values — listing titles, names, error messages —
 * must never be able to inject markup.
 *
 * NOTE: this helper is called from main.js, admin.js and admin-management.js; keep
 * the definition present in every file that uses it (the bundler treats each file
 * as its own scope).
 */
function escapeFlashText(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showFlashMessage(message, type = 'info') {
    const container = document.createElement('div');
    container.className = 'flash-messages';
    container.style.position = 'fixed';
    container.style.top = 'calc(env(safe-area-inset-top, 0px) + 72px)';
    container.style.left = '50%';
    container.style.right = 'auto';
    container.style.transform = 'translateX(-50%)';
    container.style.width = 'calc(100vw - 24px)';
    container.style.maxWidth = '440px';
    container.style.zIndex = '2147483000';
    container.style.pointerEvents = 'none';
    
    const messageEl = document.createElement('div');
    messageEl.className = `flash-message ${type}`;
    messageEl.style.pointerEvents = 'auto';
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 
                 type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    
    messageEl.innerHTML = `<i class="fas fa-${icon}"></i> ${escapeFlashText(message)}`;
    
    container.appendChild(messageEl);
    document.body.appendChild(container);
    
    setTimeout(() => {
        messageEl.style.opacity = '0';
        messageEl.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
            container.remove();
        }, 300);
    }, 5000);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Format currency (GHS)
function formatCurrency(amount) {
    // Always show the plain "GHS" code (Intl renders the ₵ symbol — we don't want that).
    var value = Number(amount);
    if (!isFinite(value)) value = 0;
    var hasKobo = Math.abs(value % 1) > 0.0001;
    return 'GHS ' + value.toLocaleString('en-GH', {
        minimumFractionDigits: hasKobo ? 2 : 0,
        maximumFractionDigits: hasKobo ? 2 : 0
    });
}

// Format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-GH', options);
}

// Format short date for cramped spots like listing cards (e.g., "27 Sep" / "27 Sep 2025")
function formatShortDate(dateString) {
    const date = new Date(dateString);
    const sameYear = date.getFullYear() === new Date().getFullYear();
    const options = { day: 'numeric', month: 'short' };
    if (!sameYear) options.year = 'numeric';
    return date.toLocaleDateString('en-GH', options);
}

// Format relative time (e.g., "2 hours ago")
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return formatShortDate(dateString);
}

// Validate email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate phone (Ghana format)
function isValidPhone(phone) {
    const re = /^(\+233|0)[2357]\d{8}$/;
    return re.test(phone.replace(/\s/g, ''));
}

// Show loading state
function showLoading(element) {
    const originalText = element.innerHTML;
    element.disabled = true;
    element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    element.classList.add('loading');
    
    return function() {
        element.disabled = false;
        element.innerHTML = originalText;
        element.classList.remove('loading');
    };
}

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

// Check if user is logged in — checks window.currentUser and Firebase directly (avoids race)
function isLoggedIn() {
    if (window.currentUser !== null && window.currentUser !== undefined) return true;
    try {
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) return true;
        if (typeof firebaseAuth !== 'undefined' && firebaseAuth && firebaseAuth.currentUser) return true;
    } catch(e) {}
    return false;
}

// Update user navigation
function ensureAuthLoader(){
    try{
        const actions = document.querySelector('.header-actions');
        if(!actions) return;
        if(document.getElementById('authLoader')) return;
        const loginBtn = document.getElementById('loginBtn');
        const dashboardBtn = document.getElementById('dashboardBtn');
        if(!loginBtn && !dashboardBtn) return;
        const loader = document.createElement('span');
        loader.id = 'authLoader';
        loader.style.cssText = 'display:inline-flex;align-items:center;gap:0.4rem;color:#6b7280;font-size:0.82rem;font-weight:600;padding:0.45rem 0.6rem;border:1px solid #e5e7eb;border-radius:999px;background:#f8fafc;';
        loader.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#0064d2;"></i> Checking...';
        // Insert before loginBtn if exists, else before dashboardBtn, else append
        if(loginBtn && loginBtn.parentNode === actions){
            actions.insertBefore(loader, loginBtn);
            loginBtn.style.display = 'none';
            if(dashboardBtn) dashboardBtn.style.display = 'none';
        } else if(dashboardBtn && dashboardBtn.parentNode === actions){
            actions.insertBefore(loader, dashboardBtn);
            if(loginBtn) loginBtn.style.display = 'none';
            dashboardBtn.style.display = 'none';
        } else {
            actions.appendChild(loader);
        }
        // Safety: if auth takes >4s, hide loader anyway and show login
        setTimeout(function(){
            const l = document.getElementById('authLoader');
            if(l && l.style.display !== 'none'){
                // If still showing, hide and fallback to login visible
                l.style.display = 'none';
                const lb = document.getElementById('loginBtn');
                const db = document.getElementById('dashboardBtn');
                if(lb && db){
                    // show login as fallback if not already decided
                    if(db.style.display==='none' && lb.style.display==='none'){
                        lb.style.display = 'inline-flex';
                    }
                }
            }
        }, 4000);
    }catch(e){}
}
function updateUserNav() {
    // Show loader immediately until first auth callback — prevents Sign in flicker for logged-in users
    ensureAuthLoader();
    let authResolved = false;
    function hideAuthLoader(){
        if(authResolved) return;
        authResolved = true;
        const loader = document.getElementById('authLoader');
        if(loader) loader.style.display = 'none';
    }
    if (typeof firebaseAuth !== 'undefined') {
        firebaseAuth.onAuthStateChanged((user) => {
            hideAuthLoader();
            if (user) {
                window.currentUser = user;
                // 🪙 Daily points are CLAIMED BY HAND now (owner's call):
                // the Rewards page has the tap-to-claim button, and the
                // dashboard shows a small gold dot while today's points wait.
                // Nothing fires here — signed-in browsing costs zero extra.
                // Immediately show dashboard (avoid gap before Firestore fetch)
                const loginBtn0 = document.getElementById('loginBtn');
                const dashboardBtn0 = document.getElementById('dashboardBtn');
                if(loginBtn0) loginBtn0.style.display = 'none';
                if(dashboardBtn0) dashboardBtn0.style.display = 'inline-flex';
                // Show messages button for logged-in users
                var hBtn0 = document.getElementById('headerMessagesBtn');
                if (hBtn0) hBtn0.style.display = 'inline-flex';
                // Get user data from Firestore to personalize name
                if (typeof firebaseDB !== 'undefined') {
                    firebaseDB.collection('users').doc(user.uid).get().then((doc) => {
                        if (doc.exists) {
                            window.userData = doc.data();
                            const userName = document.getElementById('userName');
                            const dashboardBtn = document.getElementById('dashboardBtn');
                            if (dashboardBtn) dashboardBtn.style.display = 'inline-flex';
                            if (userName) {
                                userName.textContent = window.userData.firstName || window.userData.name || 'Dashboard';
                            }
                        }
                    }).catch(function(){});
                }
            } else {
                window.currentUser = null;
                window.userData = null;
                const loginBtn = document.getElementById('loginBtn');
                const dashboardBtn = document.getElementById('dashboardBtn');
                if(loginBtn) loginBtn.style.display = 'inline-flex';
                if(dashboardBtn) dashboardBtn.style.display = 'none';
                // Logged out: keep messages btn visible but goes to login — hide badge
                var hBtn = document.getElementById('headerMessagesBtn');
                if (hBtn) hBtn.style.display = 'inline-flex';
                try{ updateHeaderMsgBadge(0); }catch(e){}
            }
        });
        // Fallback: if auth never fires (offline), hide loader after 3.5s and show login
        setTimeout(function(){
            if(!authResolved){
                hideAuthLoader();
                const lb = document.getElementById('loginBtn');
                const db = document.getElementById('dashboardBtn');
                if(lb && db && lb.style.display==='none' && db.style.display==='none'){
                    lb.style.display='inline-flex';
                }
            }
        }, 3500);
    } else {
        // No firebase yet — hide loader, show login
        hideAuthLoader();
        var hBtn = document.getElementById('headerMessagesBtn');
        if (hBtn) hBtn.style.display = 'inline-flex';
        const lb = document.getElementById('loginBtn');
        if(lb) lb.style.display='inline-flex';
    }
}

// Require authentication
function requireAuth(redirectUrl = '/pages/auth/login.html') {
    if (!isLoggedIn()) {
        showFlashMessage('Please login to continue', 'warning');
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1500);
        return false;
    }
    return true;
}

// Logout
function logout() {
    if (typeof firebaseAuth !== 'undefined') {
        firebaseAuth.signOut().then(() => {
            showFlashMessage('Logged out successfully', 'success');
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 1500);
        }).catch(error => {
            console.error('Logout error:', error);
            showFlashMessage('Error logging out', 'error');
        });
    }
}

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================

// Add document to collection
async function addDocument(collection, data) {
    try {
        const docRef = await firebaseDB.collection(collection).add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error adding document:', error);
        return { success: false, error: error.message };
    }
}

// Get document by ID
async function getDocument(collection, id) {
    try {
        const doc = await firebaseDB.collection(collection).doc(id).get();
        if (doc.exists) {
            return { success: true, data: { id: doc.id, ...doc.data() } };
        } else {
            return { success: false, error: 'Document not found' };
        }
    } catch (error) {
        console.error('Error getting document:', error);
        return { success: false, error: error.message };
    }
}

// Update document
async function updateDocument(collection, id, data) {
    try {
        await firebaseDB.collection(collection).doc(id).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating document:', error);
        return { success: false, error: error.message };
    }
}

// Delete document
async function deleteDocument(collection, id) {
    try {
        await firebaseDB.collection(collection).doc(id).delete();
        return { success: true };
    } catch (error) {
        console.error('Error deleting document:', error);
        return { success: false, error: error.message };
    }
}

// Query collection
async function queryCollection(collection, field, operator, value) {
    try {
        const snapshot = await firebaseDB.collection(collection)
            .where(field, operator, value)
            .get();
        
        const documents = [];
        snapshot.forEach(doc => {
            documents.push({ id: doc.id, ...doc.data() });
        });
        
        return { success: true, data: documents };
    } catch (error) {
        console.error('Error querying collection:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

// Upload file to Firebase Storage
async function uploadFile(file, path, onProgress = null) {
    return new Promise((resolve, reject) => {
        const storageRef = firebaseStorage.ref();
        const fileRef = storageRef.child(path);
        
        const uploadTask = fileRef.put(file);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (onProgress) {
                    onProgress(progress);
                }
            },
            (error) => {
                console.error('Upload error:', error);
                reject(error);
            },
            () => {
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    resolve({ success: true, url: downloadURL });
                }).catch(reject);
            }
        );
    });
}

// Delete file from Firebase Storage
async function deleteFile(url) {
    try {
        const storageRef = firebaseStorage.refFromURL(url);
        await storageRef.delete();
        return { success: true };
    } catch (error) {
        console.error('Delete error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

window.SankofaMarket = {
    // Utility functions
    formatCurrency,
    formatDate,
    formatShortDate,
    formatRelativeTime,
    isValidEmail,
    isValidPhone,
    showLoading,
    showFlashMessage,
    
    // Authentication
    isLoggedIn,
    requireAuth,
    logout,
    updateUserNav,
    
    // Firestore
    addDocument,
    getDocument,
    updateDocument,
    deleteDocument,
    queryCollection,
    
    // Storage
    uploadFile,
    deleteFile
};

// ============================================================================
// IMAGE COMPRESSION UTILITY
// Compresses images client-side before upload to save Firebase Storage
// ============================================================================

/**
 * Compress an image file using Canvas API
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Max width in pixels (default: 1200)
 * @param {number} options.maxHeight - Max height in pixels (default: 1200)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.75)
 * @returns {Promise<string>} - Compressed image as data URL
 */

// ============================================================================
// SELLER PLAN LIMITS — the single source of truth for the front end
// (the Cloud Function keeps the same numbers in functions/index.js)
//   Starter (free)   10 active listings  • 5% commission
//   Bronze   GHS 45  30                   • 2%
//   Silver   GHS 79  75                   • 1.5%
//   Gold     GHS 129 200                  • 1.2%
//   Diamond  GHS 199 unlimited (1000 fair use) • 1%
// Sold or paused listings never count.
// ============================================================================
var LISTING_LIMITS = {
    starter: 10,
    bronze: 30,
    silver: 75,
    gold: 200,
    diamond: 1000,
    verified: 200      // legacy "verified" sellers keep a generous allowance
};
var FAIR_USE_LISTING_LIMIT = 1000;

function listingLimitForTier(tier) {
    var key = String(tier || 'starter').toLowerCase();
    var value = LISTING_LIMITS[key];
    return (typeof value === 'number') ? value : LISTING_LIMITS.starter;
}

/** Works out the limit from a users document (premium expiry respected). */
function listingLimitForUser(user) {
    if (!user) return LISTING_LIMITS.starter;
    var premiumActive = user.isPremium === true;
    if (premiumActive && user.premiumExpiry) {
        var exp = user.premiumExpiry.toDate ? user.premiumExpiry.toDate() : new Date(user.premiumExpiry);
        if (exp && exp <= new Date()) premiumActive = false;
    }
    if (!premiumActive) {
        // legacy auto-promoted sellers keep their allowance
        if (user.sellerTier === 'verified' || user.sellerTier === 'trusted') return LISTING_LIMITS.verified;
        return LISTING_LIMITS.starter;
    }
    return listingLimitForTier(user.premiumTier || user.sellerTier || 'bronze');
}

/** Plain-English label for a limit: '10', '30', 'unlimited (fair use 1,000)' */
function listingLimitLabel(limit) {
    if (limit >= FAIR_USE_LISTING_LIMIT) return 'unlimited (fair use ' + FAIR_USE_LISTING_LIMIT.toLocaleString() + ')';
    return String(limit);
}

// ============================================================================
// IMAGE PREPARATION — small "preview" + full picture capped at 300KB
// ----------------------------------------------------------------------------
// Every listing photo is stored twice:
//   • thumb  — max 800px, ~60-90KB  → used in listings, homepage, search, admin
//   • full   — max 1600px, HARD CAP 300KB → only loaded when the buyer opens
//              the picture to see the details
// This keeps pages fast on Ghanaian mobile data while still allowing a
// full-quality look-on-click.
// ============================================================================

/** Load a File/Blob into an <img> (object URLs, no data-URL round trip). */
function loadImageElement(file) {
    return new Promise(function (resolve, reject) {
        if (!file || !/^image\//.test(file.type || '')) { reject(new Error('Not an image file')); return; }
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () { resolve({ img: img, revoke: function () { URL.revokeObjectURL(url); } }); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not read that image file')); };
        img.src = url;
    });
}

function canvasToBlob(canvas, mime, quality) {
    return new Promise(function (resolve, reject) {
        if (canvas.toBlob) {
            canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('Image encode failed')); }, mime, quality);
        } else {
            try { resolve(dataURLToBlobLocal(canvas.toDataURL(mime, quality))); } catch (e) { reject(e); }
        }
    });
}

function dataURLToBlobLocal(dataUrl) {
    var parts = String(dataUrl).split(',');
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    var bin = atob(parts[1] || '');
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
}

function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onload = function (e) { resolve(e.target.result); };
        r.onerror = reject;
        r.readAsDataURL(blob);
    });
}


// ============================================================================
// IMAGE FALLBACK CHAIN
// ----------------------------------------------------------------------------
// If the small preview of a listing ever fails to load, try the full picture
// before showing "No photo yet". Usage from markup:
//   <img src="preview.jpg" data-alt-src="full.jpg" onerror="smImgFallback(this)">
// ============================================================================
function smImgFallback(img) {
    if (!img) return;
    try {
        var alt = img.getAttribute('data-alt-src');
        if (alt && img.src !== alt) {
            img.removeAttribute('data-alt-src');   // only try the full picture once
            img.src = alt;
            return;
        }
        if (!/placeholders\/product\.svg/.test(img.src)) {
            img.src = '/images/placeholders/product.svg';
        }
    } catch (e) { /* never let an image break the page */ }
}

/**
 * Add the fallback attributes to an <img> element (preview -> full -> placeholder).
 */
function applyImageFallback(imgEl, previewUrl, fullUrl) {
    if (!imgEl) return imgEl;
    if (previewUrl) imgEl.src = previewUrl;
    if (fullUrl && fullUrl !== previewUrl) imgEl.setAttribute('data-alt-src', fullUrl);
    imgEl.onerror = function () { smImgFallback(this); };
    return imgEl;
}

/**
 * Resize + compress a picture until it fits `maxBytes`.
 * Quality drops first, then the dimensions shrink as a last resort.
 */
async function compressToTarget(file, options) {
    options = options || {};
    var maxDim = options.maxDim || 1600;
    var maxBytes = options.maxBytes || (300 * 1024);   // 300KB default cap
    var quality = options.quality || 0.82;
    var minQuality = options.minQuality || 0.45;
    var mime = options.mime || 'image/jpeg';

    var loaded = await loadImageElement(file);
    var img = loaded.img;
    try {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) throw new Error('Image has no size');

        var best = null;
        for (var round = 0; round < 5; round++) {
            var scale = Math.min(1, maxDim / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * scale));
            var ch = Math.max(1, Math.round(h * scale));

            var canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';                 // flatten transparency for JPEG
            ctx.fillRect(0, 0, cw, ch);
            ctx.drawImage(img, 0, 0, cw, ch);

            // every listed photo carries the Sankofa mark (set options.watermark = false to skip)
            if (options.watermark !== false) {
                try { await drawSankofaWatermark(ctx, cw, ch); } catch (e) { console.warn('watermark failed', e && e.message); }
            }

            var q = quality;
            var blob = await canvasToBlob(canvas, mime, q);
            while (blob.size > maxBytes && q > minQuality) {
                q = Math.max(minQuality, q - 0.08);
                blob = await canvasToBlob(canvas, mime, q);
            }
            best = { blob: blob, width: cw, height: ch, quality: q };
            if (blob.size <= maxBytes) break;

            // Still too big — shrink the picture and try again
            maxDim = Math.round(maxDim * 0.82);
            if (maxDim < 400) break;
        }
        best.dataUrl = await blobToDataURL(best.blob);
        best.bytes = best.blob.size;
        return best;
    } finally {
        loaded.revoke();
    }
}


/* ============================================================================
   SANKOFA WATERMARK  (every listed product photo carries it)
   ---------------------------------------------------------------------------
   Drawn onto the picture itself before it is uploaded, so it travels with the
   file — screenshots, downloads and re-posts elsewhere all keep the branding.
   It is applied to BOTH the small preview and the full-size photo.

   The mark is the Sankofa logo, bottom-right, at ~26% of the picture width,
   with a soft dark shadow underneath so it stays readable on white products
   and on dark ones. It is intentionally subtle: it must not spoil the item.
   ========================================================================== */
var SANKOFA_WATERMARK_SRC = '/images/watermarks/sankofa-watermark.png';
var _wmImagePromise = null;

function loadWatermarkImage() {
    if (_wmImagePromise) return _wmImagePromise;
    _wmImagePromise = new Promise(function (resolve) {
        try {
            var img = new Image();
            img.crossOrigin = 'anonymous';            // same-origin file, but be explicit
            img.onload = function () { resolve(img); };
            img.onerror = function () { resolve(null); };   // no watermark art -> text fallback
            img.src = SANKOFA_WATERMARK_SRC;
        } catch (e) { resolve(null); }
    });
    return _wmImagePromise;
}

/** Draw the Sankofa mark onto a canvas context (bottom-right). */
async function drawSankofaWatermark(ctx, w, h) {
    if (!ctx || !w || !h) return;
    var logo = await loadWatermarkImage();

    // The logo art is a full lock-up (bird + "SANKOFA MARKET" + tagline). Using the whole
    // thing would be too heavy on a small photo, so we crop to the bird + wordmark block and
    // scale that.
    // A little smaller and with more breathing room than the first version — at 2.7% padding
    // the mark looked clipped against the corner on phone-sized photos.
    var ratioW = (Math.max(w, h) < 480) ? 0.30 : 0.24;
    var targetW = Math.round(Math.min(Math.max(w * ratioW, 80), 320));
    var pad = Math.round(Math.min(Math.max(w * 0.04, 12), 48));

    ctx.save();
    // Deliberately gentle. A bold mark stamped over a seller's own watermark made BOTH
    // unreadable (it happened) — at this opacity the photo survives either way.
    ctx.globalAlpha = 0.55;

    if (logo) {
        var ratio = logo.naturalHeight / logo.naturalWidth;
        var lw = targetW;
        var lh = Math.round(lw * ratio);
        // soft shadow so the mark survives on light and dark pictures
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = Math.max(6, Math.round(targetW * 0.06));
        ctx.shadowOffsetY = 2;
        ctx.drawImage(logo, w - pad - lw, h - pad - lh, lw, lh);
    } else {
        // fallback: a simple wordmark, so a listing is never left unmarked
        var fs = Math.max(12, Math.round(w * 0.045));
        ctx.font = '700 ' + fs + 'px Poppins, Segoe UI, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = Math.max(4, Math.round(fs * 0.35));
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillText('SANKOFA MARKET', w - pad, h - pad);
    }
    ctx.restore();
}

/**
 * Prepare one listing photo: the small preview used in lists and the
 * full picture (never bigger than 300KB) used only when opened.
 */
async function prepareListingPhoto(file, options) {
    options = options || {};
    var mark = options.watermark !== false;
    var full = await compressToTarget(file, { maxDim: 1600, maxBytes: 300 * 1024, quality: 0.82, watermark: mark });
    var thumb;
    try {
        thumb = await compressToTarget(file, { maxDim: 800, maxBytes: 90 * 1024, quality: 0.72, watermark: mark });
    } catch (e) {
        thumb = { blob: full.blob, dataUrl: full.dataUrl, width: full.width, height: full.height, bytes: full.bytes };
    }
    // Never let the preview be bigger than the full picture
    if (thumb.blob.size >= full.blob.size) {
        thumb = { blob: full.blob, dataUrl: full.dataUrl, width: full.width, height: full.height, bytes: full.bytes };
    }
    return { full: full, thumb: thumb };
}

/** The small version of a product picture (falls back to the full one). */
window.drawSankofaWatermark = drawSankofaWatermark;
window.prepareListingPhoto = prepareListingPhoto;

function productThumb(product) {
    if (!product) return '/images/placeholders/product.svg';
    var t = product.imagesThumb || product.thumbs || product.thumbnails;
    if (Array.isArray(t) && t.length && t[0]) return t[0];
    var f = product.images || product.photos;
    if (Array.isArray(f) && f.length && f[0]) return f[0];
    if (product.productImage) return product.productImage;
    return '/images/placeholders/product.svg';
}

/** The full version of a product picture (used when the buyer opens it). */
function productFull(product) {
    if (!product) return '/images/placeholders/product.svg';
    var f = product.images || product.photos;
    if (Array.isArray(f) && f.length && f[0]) return f[0];
    if (product.productImage) return product.productImage;
    return '/images/placeholders/product.svg';
}

/** Small version of the n-th picture of a product. */
function productThumbAt(product, index) {
    if (!product) return '/images/placeholders/product.svg';
    var t = product.imagesThumb || product.thumbs || [];
    var f = product.images || product.photos || [];
    if (Array.isArray(t) && t[index]) return t[index];
    if (Array.isArray(f) && f[index]) return f[index];
    return productThumb(product);
}

function compressImage(file, options) {
    options = options || {};
    var maxDim = Math.max(options.maxWidth || 1600, options.maxHeight || 1600);
    var maxBytes = options.maxBytes || (300 * 1024);   // hard cap: 300KB per picture
    var quality = options.quality || 0.82;

    if (!file || !/^image\//.test(file.type || '')) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function (e) { resolve(e.target.result); };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Uses the shared target-size compressor so the 300KB cap is always respected,
    // even for files that are "small" but still heavy (e.g. 480KB PNG screenshots).
    return compressToTarget(file, {
        maxDim: maxDim,
        maxBytes: maxBytes,
        quality: quality,
        minQuality: 0.45
    }).then(function (result) {
        var originalKB = Math.round(file.size / 1024);
        var compressedKB = Math.round(result.bytes / 1024);
        console.log('📸 Compressed: ' + originalKB + 'KB → ' + compressedKB + 'KB (' +
            (originalKB > 0 ? Math.round((1 - compressedKB / originalKB) * 100) : 0) + '% smaller)');
        return result.dataUrl;
    });
}

// ============================================================================
// GLOBAL MESSAGES BADGE + POPUP — impossible to miss on homepage (and all pages)
// ============================================================================

// Ensure header has a Messages button even if HTML didn't include it (injected for all pages)
function ensureHeaderMessagesBtn() {
    if (document.getElementById('headerMessagesBtn')) return;
    var actions = document.querySelector('.header-actions');
    if (!actions) return;
    var btn = document.createElement('a');
    // Decide href: if on homepage, use pages/user/messages.html, if in subfolder adjust, but absolute-style with leading slash works via Firebase hosting root
    var href = 'pages/user/messages.html';
    // If we are already under pages/, adjust path
    var path = window.location.pathname;
    if (path.indexOf('/pages/') !== -1) {
        // Count depth — simplest: use absolute from root if starts with /
        href = '/pages/user/messages.html';
        // For pages under /pages/user/, '../../' relative also works, but absolute is safest
        // Keep relative fallback for file:// testing: detect if hosted
        if (window.location.protocol === 'file:') href = 'messages.html';
    } else if (path === '/' || path.indexOf('/index.html') !== -1) {
        href = 'pages/user/messages.html';
    }
    // If file is at root (index, product-detail, search, publish, payment) relative stays pages/...
    if (path.split('/').length > 2 && path.indexOf('/pages/') === -1 && path !== '/') {
        // For root-level pages like /search.html -> pages/ is correct
        href = 'pages/user/messages.html';
    }
    // Normalize: if on index at root, keep as is, if deep use absolute
    if (href.indexOf('pages/') === 0 && window.location.pathname.indexOf('/pages/') !== -1) href = '/pages/user/messages.html';

    btn.id = 'headerMessagesBtn';
    btn.href = href;
    btn.className = 'header-messages-btn';
    btn.title = 'Messages';
    btn.innerHTML = '<i class=\"fas fa-comments\"></i><span class=\"header-msg-label\">Messages</span><span class=\"header-msg-badge\" id=\"headerMsgBadge\" style=\"display:none;\">0</span>';
    // Insert before Sell button if exists, else append at start
    var sellBtn = actions.querySelector('a[href*=\"publish\"]');
    if (sellBtn && sellBtn.parentElement === actions) actions.insertBefore(btn, sellBtn);
    else actions.insertBefore(btn, actions.firstChild);
    // Click handler: if not logged in, go to login with redirect
    btn.addEventListener('click', function(e){
        if (!isLoggedIn()) {
            e.preventDefault();
            var target = 'pages/user/messages.html';
            if (window.location.pathname.indexOf('/pages/') !== -1) target = '/pages/user/messages.html';
            // Build login redirect URL correctly
            var loginHref = '/pages/auth/login.html?redirect=' + encodeURIComponent(target);
            // Fallback relative for root
            if (window.location.pathname === '/' || window.location.pathname.indexOf('/index.html') !== -1) {
                loginHref = 'pages/auth/login.html?redirect=' + encodeURIComponent('pages/user/messages.html');
            }
            window.location.href = loginHref;
        }
    });
}

function ensureAppBottomNav(){
    if (document.getElementById('appBottomNav')) return;
    // Don't show on admin pages
    if (window.location.pathname.includes('/sm-panel') || window.location.pathname.includes('/admin')) return;
    var nav = document.createElement('nav');
    nav.id = 'appBottomNav';
    nav.className = 'app-bottom-nav';
    nav.setAttribute('aria-label','Mobile navigation');
    var path = window.location.pathname;
    function isActive(href){
        if (href === '/index.html' || href === '/' ) return path === '/' || path.endsWith('/index.html') || path === '/index.html';
        return path.includes(href.replace('/index.html','').replace('.html',''));
    }
    var homeActive = isActive('/index.html') ? ' active' : '';
    var searchActive = path.includes('/search') ? ' active' : '';
    var sellActive = path.includes('/publish') ? ' active' : '';
    var msgActive = path.includes('/messages') ? ' active' : '';
    var accActive = path.includes('/dashboard') || path.includes('/profile') || path.includes('/auth') ? ' active' : '';
    nav.innerHTML = '<div class="app-bottom-nav-inner">'
        + '<a href="/index.html" class="app-nav-item'+homeActive+'" data-nav="home"><i class="fas fa-home"></i><span>Home</span></a>'
        + '<a href="/search.html" class="app-nav-item'+searchActive+'" data-nav="search"><i class="fas fa-search"></i><span>Search</span></a>'
        + '<a href="/publish.html" class="app-nav-item sell'+sellActive+'" data-nav="sell"><i class="fas fa-plus"></i><span>Sell</span></a>'
        + '<a href="/pages/user/messages.html" class="app-nav-item'+msgActive+'" data-nav="messages" style="position:relative;"><i class="fas fa-comments"></i><span>Messages</span><span class="app-nav-badge" id="appNavMsgBadge" style="display:none;">0</span></a>'
        + '<a href="/pages/user/dashboard.html" class="app-nav-item'+accActive+'" data-nav="account"><i class="fas fa-user"></i><span>Account</span></a>'
        + '</div>';
    document.body.appendChild(nav);
    // Update badge if we already have count
    if (window._lastMsgCount !== undefined) updateAppNavBadge(window._lastMsgCount);
}
function updateAppNavBadge(count){
    window._lastMsgCount = count;
    var b = document.getElementById('appNavMsgBadge');
    var item = document.querySelector('.app-nav-item[data-nav="messages"]');
    if (b) {
        if (count>0){ b.textContent = count>99?'99+':String(count); b.style.display='flex'; }
        else b.style.display='none';
    }
    if (item) {
        if (count>0) item.classList.add('has-unread');
        else item.classList.remove('has-unread');
    }
}
/**
 * Sidebar "Messages" badge (the .nav-badge inside dashboard sidebars).
 * It used to be hardcoded to "3" on some pages — now it shows the real number of
 * unread chats, and stays hidden when there is nothing new.
 */
function updateSidebarMsgBadge(count) {
    var badge = document.getElementById('unreadMessages');
    if (!badge) return;
    var n = Number(count) || 0;
    if (n > 0) {
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.style.display = 'inline-flex';
    } else {
        badge.textContent = '0';
        badge.style.display = 'none';
    }
}

/** Count unread conversations for the signed-in user and paint both badges. */
function refreshMessageBadges() {
    try {
        if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
        var auth = (typeof firebaseAuth !== 'undefined' && firebaseAuth) ? firebaseAuth
                 : (window.firebase && firebase.auth ? firebase.auth() : null);
        if (!auth) return;
        auth.onAuthStateChanged(function (user) {
            if (!user) { updateSidebarMsgBadge(0); return; }
            firebaseDB.collection('conversations')
                .where('participants', 'array-contains', user.uid)
                .get()
                .then(function (snap) {
                    var unread = 0;
                    snap.forEach(function (d) {
                        var c = d.data() || {};
                        if (Array.isArray(c.unreadBy) && c.unreadBy.indexOf(user.uid) !== -1) unread++;
                    });
                    updateSidebarMsgBadge(unread);
                })
                .catch(function () { updateSidebarMsgBadge(0); });
        });
    } catch (e) { /* never break a page for a badge */ }
}

function updateHeaderMsgBadge(count) {
    var badge = document.getElementById('headerMsgBadge');
    var btn = document.getElementById('headerMessagesBtn');
    if (!badge || !btn) return;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.display = 'flex';
        btn.classList.add('has-unread');
        btn.style.display = 'inline-flex';
        // Also update document title to be extra visible
        try {
            if (!window._origTitle) window._origTitle = document.title;
            document.title = '(' + count + ') New message' + (count>1?'s':'') + ' — ' + window._origTitle;
        } catch(e){}
    } else {
        badge.style.display = 'none';
        btn.classList.remove('has-unread');
        try {
            if (window._origTitle) document.title = window._origTitle;
        } catch(e){}
    }
    updateAppNavBadge(count);
}

function escapeHtmlMsg(s){
    var d=document.createElement('div'); d.textContent = s||''; return d.innerHTML;
}

function showMessageToast(convId, data){
    // Don't spam if user already on that exact conversation
    try {
        var params = new URLSearchParams(window.location.search);
        if (params.get('conv') === convId) return;
    } catch(e){}
    // dedupe: don't show same conv twice within 12s
    window._toastSeen = window._toastSeen || {};
    var now = Date.now();
    if (window._toastSeen[convId] && (now - window._toastSeen[convId] < 12000)) return;
    window._toastSeen[convId] = now;

    var container = document.getElementById('msgToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'msgToastContainer';
        container.className = 'msg-toast-container';
        document.body.appendChild(container);
    }
    var otherUid = null;
    try {
        var me = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser.uid : (firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.uid : null);
        if (data.participants) otherUid = data.participants.filter(function(p){ return p !== me; })[0];
    } catch(e){}
    var otherName = (data.participantNames && otherUid && data.participantNames[otherUid]) || 'New message';
    var productTitle = data.productTitle || 'Your listing';
    var preview = data.lastMessage || 'You have a new message';
    if (preview.length > 70) preview = preview.substring(0,70) + '…';

    var toast = document.createElement('div');
    toast.className = 'msg-toast';
    toast.innerHTML = '<div class=\"msg-toast-avatar\">' + escapeHtmlMsg(otherName.charAt(0).toUpperCase()) + '</div>' +
        '<div class=\"msg-toast-body\">' +
            '<div class=\"msg-toast-title\">' + escapeHtmlMsg(otherName) + '</div>' +
            '<div class=\"msg-toast-subtitle\"><i class=\"fas fa-tag\" style=\"font-size:0.6rem;\"></i> ' + escapeHtmlMsg(productTitle) + '</div>' +
            '<div class=\"msg-toast-preview\">' + escapeHtmlMsg(preview) + '</div>' +
            '<div class=\"msg-toast-actions\">' +
                '<button class=\"msg-toast-btn primary\" type=\"button\">Open chat</button>' +
                '<button class=\"msg-toast-btn\" type=\"button\">Dismiss</button>' +
            '</div>' +
        '</div>' +
        '<button class=\"msg-toast-close\" aria-label=\"Close\" type=\"button\"><i class=\"fas fa-times\"></i></button>';
    // Click behaviours
    function openChat(){
        var href = 'pages/user/messages.html?conv=' + convId;
        if (window.location.pathname.indexOf('/pages/') !== -1) href = '/pages/user/messages.html?conv=' + convId;
        window.location.href = href;
    }
    toast.addEventListener('click', function(e){
        if (e.target.closest('button')) return;
        openChat();
    });
    var btns = toast.querySelectorAll('.msg-toast-btn');
    if (btns[0]) btns[0].addEventListener('click', function(e){ e.stopPropagation(); openChat(); });
    if (btns[1]) btns[1].addEventListener('click', function(e){ e.stopPropagation(); dismiss(); });
    var closeX = toast.querySelector('.msg-toast-close');
    if (closeX) closeX.addEventListener('click', function(e){ e.stopPropagation(); dismiss(); });
    function dismiss(){
        toast.style.animation = 'toastOut 0.35s ease forwards';
        setTimeout(function(){ if (toast.parentNode) toast.remove(); }, 350);
    }
    container.appendChild(toast);
    // Auto-dismiss after 8.5s (matches progress bar)
    setTimeout(dismiss, 8500);
    // Optional haptics + sound tick
    try { if (navigator.vibrate) navigator.vibrate([120,60,120]); } catch(e){}
    // Play tiny beep via WebAudio if allowed
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var o = ctx.createOscillator(); var g = ctx.createGain();
        o.type='sine'; o.frequency.value=880; g.gain.value=0.04;
        o.connect(g); g.connect(ctx.destination); o.start(); setTimeout(function(){ o.stop(); try{ctx.close();}catch(e){} }, 160);
    } catch(e){}
}

// ============================================================================
// AUCTION HEADER — Auction button moved below carousel (not in header)
// Keep alert bar (blinking amber/red) — header button removed per design
// ============================================================================

function ensureAuctionHeaderBtn(){
    // Disabled: auction button now lives below carousel on homepage + prominent on publish page
    var existing = document.getElementById('headerAuctionBtn');
    if (existing) existing.remove();
    return;
}

function ensureAuctionAlertBar(){
    // Don't show blinking auction bar on admin pages — breaks admin layout
    if (window.location.pathname.includes('/admin') || window.location.pathname.includes('/sm-panel')) return;
    if (document.getElementById('auctionAlertBar')) return;
    var bar = document.createElement('div');
    bar.id = 'auctionAlertBar';
    bar.setAttribute('role','alert');
    bar.setAttribute('aria-live','assertive');
    bar.innerHTML = '<div class="auction-alert-inner"><span class="auction-alert-dot"></span><span id="auctionAlertText">Checking auctions...</span><span class="auction-alert-countdown" id="auctionAlertCountdown" style="display:none;">--:--</span><a class="auction-alert-cta" id="auctionAlertCta" href="auction.html"><i class="fas fa-gavel"></i> Join Auction</a></div>';
    // Insert at top of body, before header
    var header = document.querySelector('.header');
    if (header && header.parentNode) header.parentNode.insertBefore(bar, header);
    else document.body.insertBefore(bar, document.body.firstChild);
    bar.addEventListener('click', function(e){
        var cta = document.getElementById('auctionAlertCta');
        if (cta && cta.href) window.location.href = cta.href;
    });
}

var _auctionUnsub = null;
var _auctionCache = [];
var _auctionTick = null;

function initGlobalAuctionAlert(){
    if (window.location.pathname.includes('/admin') || window.location.pathname.includes('/sm-panel')) return;
    var attempts = 0;
    function tryInit(){
        attempts++;
        if (typeof firebaseDB === 'undefined' || !firebaseDB) {
            if (attempts < 30) setTimeout(tryInit, 700);
            return;
        }
        // Listen to auctions that are scheduled or live (where endAt > now)
        // We do client-side filtering because composite where on status + endAt needs index.
        // Listen to all scheduled/live; small collection so fine.
        if (_auctionUnsub) try{ _auctionUnsub(); }catch(e){}
        _auctionUnsub = firebaseDB.collection('auctions')
            .where('status','in',['scheduled','live'])
            .onSnapshot(function(snap){
                _auctionCache = [];
                var nowMs = Date.now();
                snap.forEach(function(doc){
                    var d = doc.data();
                    d._id = doc.id;
                    // Filter out ended by endAt
                    var endMs = d.endAt ? (d.endAt.toMillis ? d.endAt.toMillis() : new Date(d.endAt).getTime()) : (d.endAtMs||0);
                    if (endMs && endMs < nowMs) return; // ended, ignore
                    // Also filter scheduled that are far beyond? Keep all scheduled within 10min window? Keep all.
                    _auctionCache.push(d);
                });
                // Sort: live first, then scheduled soonest, then by endAt
                _auctionCache.sort(function(a,b){
                    var aLive = a.status==='live' ? 0 : 1;
                    var bLive = b.status==='live' ? 0 : 1;
                    if (aLive!==bLive) return aLive-bLive;
                    var aStart = a.startAt ? (a.startAt.toMillis ? a.startAt.toMillis() : new Date(a.startAt).getTime()) : 0;
                    var bStart = b.startAt ? (b.startAt.toMillis ? b.startAt.toMillis() : new Date(b.startAt).getTime()) : 0;
                    return aStart-bStart;
                });
                updateAuctionAlertUI();
            }, function(err){
                console.warn('Auction header listener error:', err);
            });
        // Tick every second for countdown
        if (_auctionTick) clearInterval(_auctionTick);
        _auctionTick = setInterval(updateAuctionAlertUI, 1000);
    }
    tryInit();
}

function smAuctionViewerUid() {
    try {
        var u = (typeof firebaseAuth !== 'undefined' && firebaseAuth && firebaseAuth.currentUser) ? firebaseAuth.currentUser : null;
        if (!u && typeof firebase !== 'undefined' && firebase.auth) u = firebase.auth().currentUser;
        if (!u && window.currentUser) u = window.currentUser;
        if (!u && window.userData) u = { uid: window.userData.uid || window.userData.userId || window.userData.id };
        return u && (u.uid || u.userId || u.id) ? String(u.uid || u.userId || u.id) : '';
    } catch (e) { return ''; }
}

function smAuctionAlertActionText(isScheduled, isOwnAuction) {
    if (isOwnAuction) return 'View Your Auction';
    return isScheduled ? 'Join Waiting Room' : 'Join & Bid Now';
}

function updateAuctionAlertUI(){
    if (window.location.pathname.includes('/admin') || window.location.pathname.includes('/sm-panel')){
        var _bar = document.getElementById('auctionAlertBar');
        if (_bar) _bar.style.display='none';
        return;
    }
    var bar = document.getElementById('auctionAlertBar');
    var textEl = document.getElementById('auctionAlertText');
    var countdownEl = document.getElementById('auctionAlertCountdown');
    var cta = document.getElementById('auctionAlertCta');
    var headerBtn = document.getElementById('headerAuctionBtn');
    var header = document.querySelector('.header');
    if (!bar || !textEl) return;

    if (!_auctionCache || _auctionCache.length===0){
        bar.style.display = 'none';
        if (header) header.classList.remove('auction-active');
        if (headerBtn){ headerBtn.classList.remove('has-live','has-scheduled'); headerBtn.title='Auctions — No live auctions now'; }
        if (countdownEl) countdownEl.style.display='none';
        return;
    }
    // Pick top auction (most urgent)
    var nowMs = Date.now();
    var top = _auctionCache[0];
    var startMs = top.startAt ? (top.startAt.toMillis ? top.startAt.toMillis() : new Date(top.startAt).getTime()) : nowMs;
    var endMs = top.endAt ? (top.endAt.toMillis ? top.endAt.toMillis() : new Date(top.endAt).getTime()) : nowMs+600000;
    var isScheduled = top.status==='scheduled' && nowMs < startMs;
    var isLive = top.status==='live' || (nowMs >= startMs && nowMs < endMs);
    var viewerUid = smAuctionViewerUid();
    var isOwnAuction = !!viewerUid && String(viewerUid) === String(top.sellerId || '');

    // Determine link
    var auctionHref = 'auction-detail.html?id=' + top._id;
    if (window.location.pathname.indexOf('/pages/')!==-1) auctionHref = '/auction-detail.html?id=' + top._id;
    if (window.location.pathname==='/' || window.location.pathname.endsWith('/index.html')) auctionHref = 'auction-detail.html?id=' + top._id;
    // For file:// testing
    if (window.location.protocol==='file:'){
        var depth = window.location.pathname.indexOf('/pages/')!==-1 ? '../../' : '';
        auctionHref = depth + 'auction-detail.html?id=' + top._id;
    }

    // Also update list page href
    if (cta) cta.href = auctionHref;

    // Update header button state
    if (headerBtn){
        headerBtn.classList.remove('has-live','has-scheduled');
        headerBtn.href = isLive ? auctionHref : 'auction.html';
        if (window.location.pathname.indexOf('/pages/')!==-1 && headerBtn.href.indexOf('auction')===0) {
            headerBtn.href = isLive ? '/'+auctionHref.replace('../../','') : '/auction.html';
        }
        if (isLive){ headerBtn.classList.add('has-live'); headerBtn.title = isOwnAuction ? 'Your live auction — view details' : '🔴 LIVE — '+ (top.title||'Auction') +' — Click to bid!'; }
        else if (isScheduled){ headerBtn.classList.add('has-scheduled'); headerBtn.title = isOwnAuction ? 'Your upcoming auction — view details' : '🟡 Auction starting soon — '+ (top.title||'Auction'); }
        else { headerBtn.title='Auctions'; }
    }
    if (header){
        header.classList.add('auction-active');
    }

    bar.style.display = 'flex';
    // Time calculations
    if (isScheduled){
        bar.className = 'scheduled';
        var msToStart = startMs - nowMs;
        var secToStart = Math.max(0, Math.floor(msToStart/1000));
        var m = Math.floor(secToStart/60);
        var s = secToStart%60;
        var mm = String(m).padStart(2,'0');
        var ss = String(s).padStart(2,'0');
        var shortTitle = escapeHtmlMsg((top.title||'Auction').substring(0,28)); if ((top.title||'').length>28) shortTitle+='…';
        textEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:0.35rem;min-width:0;overflow:hidden;"><i class="fas fa-clock" style="flex-shrink:0;"></i> <strong style="white-space:nowrap;">Starting in ' + mm+':'+ss + '</strong> <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">' + shortTitle + '</span> <span class="auction-alert-seller" style="opacity:0.9;font-weight:500;flex-shrink:0;">by ' + escapeHtmlMsg(top.sellerName||'Premium') + '</span></span>';
        if (countdownEl){ countdownEl.style.display='inline-flex'; countdownEl.textContent = mm+':'+ss + ' to start'; countdownEl.style.background='rgba(0,0,0,0.18)'; }
        if (cta) cta.innerHTML = '<i class="fas ' + (isOwnAuction ? 'fa-eye' : 'fa-hourglass-half') + '"></i> ' + smAuctionAlertActionText(true, isOwnAuction);
        // Vibrate/nudge on scheduled -> live transition should also be handled via live branch next tick
    } else if (isLive){
        bar.className = 'live';
        var msLeft = endMs - nowMs;
        var secLeft = Math.max(0, Math.floor(msLeft/1000));
        var m2 = Math.floor(secLeft/60);
        var s2 = secLeft%60;
        var mm2 = String(m2).padStart(2,'0');
        var ss2 = String(s2).padStart(2,'0');
        var bidText = top.currentBid ? 'GHS ' + top.currentBid.toLocaleString() : 'GHS ' + (top.startingPrice||0).toLocaleString();
        var bidders = top.bidCount ? ' • ' + top.bidCount + ' bid' + (top.bidCount>1?'s':'') : '';
        var shortTitle2 = escapeHtmlMsg((top.title||'Auction').substring(0,24)); if ((top.title||'').length>24) shortTitle2+='…';
        textEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:0.35rem;min-width:0;overflow:hidden;"><span style="background:#fff;color:#dc2626;padding:0.12rem 0.4rem;border-radius:999px;font-size:0.65rem;font-weight:800;letter-spacing:0.05em;flex-shrink:0;">LIVE</span> <strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">' + shortTitle2 + '</strong> <span style="font-weight:700;flex-shrink:0;">' + bidText + '</span></span>';
        if (countdownEl){ countdownEl.style.display='inline-flex'; countdownEl.textContent = mm2+':'+ss2 + ' left'; countdownEl.style.background='rgba(0,0,0,0.22)'; }
        if (cta) cta.innerHTML = '<i class="fas ' + (isOwnAuction ? 'fa-eye' : 'fa-gavel') + '"></i> ' + smAuctionAlertActionText(false, isOwnAuction);
        bar.style.cursor='pointer';
    } else {
        // ended but still in cache? hide
        bar.style.display='none';
    }
    // If multiple auctions, hint "+N more"
    if (_auctionCache.length>1){
        var more = _auctionCache.length-1;
        textEl.innerHTML += ' <span style="background:rgba(255,255,255,0.2);padding:0.1rem 0.4rem;border-radius:999px;font-size:0.7rem;border:1px solid rgba(255,255,255,0.3);">+'+more+' more</span>';
    }
}

var _globalMsgUnsub = null;
var _globalLastUnread = new Set();
var _globalFirstSnapshot = true;

function initGlobalMessageBadge(){
    // Wait for Firebase to be ready; retry a few times
    var attempts = 0;
    function tryInit(){
        attempts++;
        if (typeof firebaseAuth === 'undefined' || typeof firebaseDB === 'undefined' || !firebaseAuth || !firebaseDB) {
            if (attempts < 25) setTimeout(tryInit, 600);
            return;
        }
        // Got firebase — attach auth listener
        firebaseAuth.onAuthStateChanged(function(user){
            // Cleanup previous listener
            if (_globalMsgUnsub) { try{ _globalMsgUnsub(); }catch(e){} _globalMsgUnsub=null; }
            _globalLastUnread = new Set();
            _globalFirstSnapshot = true;

            if (!user) {
                updateHeaderMsgBadge(0);
                return;
            }
            // Live badge: count unread where unreadBy contains me
            _globalMsgUnsub = firebaseDB.collection('conversations')
                .where('participants','array-contains', user.uid)
                .onSnapshot(function(snap){
                    var unreadConvs = [];
                    snap.forEach(function(doc){
                        var d = doc.data();
                        if (d.unreadBy && Array.isArray(d.unreadBy) && d.unreadBy.indexOf(user.uid) !== -1) {
                            unreadConvs.push({ id: doc.id, data: d });
                        }
                    });
                    // Mark messages as DELIVERED even when not on messages page (so sender gets ✓✓ grey instantly)
                    unreadConvs.forEach(function(c){
                        firebaseDB.collection('conversations').doc(c.id).collection('messages')
                            .where('participants','array-contains', user.uid)   // required by the security rules
                            .where('status','==','sent').get().then(function(msnap){
                                msnap.forEach(function(mdoc){
                                    var md = mdoc.data();
                                    if (md.senderId !== user.uid) {
                                        mdoc.ref.update({ status: 'delivered', deliveredAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(function(){});
                                    }
                                });
                            }).catch(function(){});
                    });
                    updateHeaderMsgBadge(unreadConvs.length);

                    // Build set of current unread ids
                    var nowIds = new Set(unreadConvs.map(function(c){ return c.id; }));
                    if (_globalFirstSnapshot) {
                        // First load: don't pop for existing unread — just record
                        _globalFirstSnapshot = false;
                        _globalLastUnread = nowIds;
                        return;
                    }
                    // Find truly NEW unread that weren't in last snapshot -> popup
                    unreadConvs.forEach(function(c){
                        if (!_globalLastUnread.has(c.id)) {
                            showMessageToast(c.id, c.data);
                        }
                    });
                    _globalLastUnread = nowIds;
                }, function(err){
                    // permission-denied happens transiently for signed-out/stale tokens — retry quietly instead of spamming
                    if(err && err.code === 'permission-denied'){
                        setTimeout(function(){ try{ tryInit(); }catch(e){} }, 2500);
                        return;
                    }
                    console.warn('Global message badge listener error:', err);
                });
        });
    }
    tryInit();
}


/* ============================================================================
   IMAGE HYGIENE  (performance)
   ---------------------------------------------------------------------------
   Product photos are injected as plain <img src=...> all over the site. That
   meant: every photo (including 15 below the fold) was fetched immediately, and
   none of them declared their size, so the page jumped about while they arrived.

   This pass, run once per page and once per DOM update:
     • the first visible image is fetched eagerly and with high priority (it is
       usually the main product photo on a slow connection),
     • everything below the fold gets loading="lazy" + decoding="async",
     • once the real size is known we write width/height attributes, which tells
       the browser the aspect ratio up-front so the layout stops shifting.
   Nothing here changes how an image LOOKS — the CSS still decides that.
   ========================================================================== */
function optimiseImages(root) {
    try {
        root = root || document;
        var vh = window.innerHeight || 800;
        var imgs = root.querySelectorAll ? root.querySelectorAll('img') : [];
        var firstVisible = null;
        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            if (img.__smImgDone) continue;
            img.__smImgDone = true;

            var rect = img.getBoundingClientRect();
            var onScreen = rect.top < vh && rect.bottom > 0 && rect.width > 0;

            if (onScreen && !firstVisible) {
                firstVisible = img;
                try { img.loading = 'eager'; img.setAttribute('fetchpriority', 'high'); img.decoding = 'sync'; } catch (e) {}
            } else if (!onScreen) {
                try {
                    if (img.loading !== 'eager' && img.getAttribute('loading') !== 'eager') img.loading = 'lazy';
                    img.decoding = 'async';
                } catch (e) {}
            }

            (function (el) {
                var stamp = function () {
                    try {
                        if (!el.getAttribute('width') && el.naturalWidth) {
                            el.setAttribute('width', el.naturalWidth);
                            el.setAttribute('height', el.naturalHeight);
                        }
                    } catch (e) {}
                };
                if (el.complete) stamp();
                else el.addEventListener('load', stamp, { once: true });
            })(img);
        }
    } catch (e) { /* never let image tuning break a page */ }
}

/** Watch for dynamically added images (product grids, cart, chat) and tune them too. */
function watchImages() {
    try {
        if (typeof MutationObserver === 'undefined') return;
        var queue = null;
        var mo = new MutationObserver(function (records) {
            var touched = false;
            for (var i = 0; i < records.length; i++) {
                if (records[i].addedNodes && records[i].addedNodes.length) { touched = true; break; }
            }
            if (!touched || queue) return;
            queue = setTimeout(function () {
                queue = null;
                optimiseImages(document);
            }, 120);
        });
        if (document.body) mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { optimiseImages(); watchImages(); });
} else {
    optimiseImages(); watchImages();
}
window.addEventListener('load', function () { setTimeout(function () { optimiseImages(); }, 400); });

window.__smSharedFlash = showFlashMessage;   // one canonical flash helper (admin.js delegates here)


/**
 * The alerts bell. Notifications have been written to the database for months with no way to
 * read them — this puts a bell in the header of every page, with a real unread count.
 * Injected here (like the mobile search toggle and the cart button) so all 40+ pages get it
 * without touching their markup.
 */
function ensureNotificationBell(){
    if (document.getElementById('notifBellBtn')) return;
    // the admin panel has its own header — keep the customer bell out of it
    if (/^\/sm-panel|\/pages\/admin/.test(window.location.pathname)) return;
    var actions = document.querySelector('.header-actions');
    if (!actions) return;

    var a = document.createElement('a');
    a.id = 'notifBellBtn';
    a.className = 'notif-bell-btn';
    a.href = '/pages/user/notifications';
    a.setAttribute('aria-label', 'Your alerts');
    a.style.cssText = 'position:relative;display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;color:#374151;text-decoration:none;';
    a.innerHTML = '<i class="fas fa-bell" style="font-size:1.15rem;"></i>' +
                  '<span id="notifBellBadge" style="display:none;position:absolute;top:4px;right:4px;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#e11d48;color:#fff;font-size:0.65rem;font-weight:800;align-items:center;justify-content:center;line-height:18px;">0</span>';
    var cartBtn = actions.querySelector('.cart-icon-btn') || actions.querySelector('#cartIconBtn');
    if (cartBtn && cartBtn.parentNode === actions) actions.insertBefore(a, cartBtn);
    else actions.appendChild(a);
}

function refreshNotificationBell(){
    try {
        var auth = (typeof firebaseAuth !== 'undefined' && firebaseAuth) ? firebaseAuth
                 : (window.firebase && firebase.auth ? firebase.auth() : null);
        if (!auth || typeof firebaseDB === 'undefined' || !firebaseDB) return;
        auth.onAuthStateChanged(function(user){
            var badge = document.getElementById('notifBellBadge');
            if (!user) { if (badge) badge.style.display = 'none'; return; }
            // cheap query: only this user's unread alerts (index: userId + isRead)
            firebaseDB.collection('notifications')
                .where('userId', '==', user.uid)
                .where('isRead', '==', false)
                .limit(25)
                .get()
                .then(function(snap){
                    updateBellBadge(snap.size);
                })
                .catch(function(){
                    // index still building? fall back to counting the recent ones client-side
                    firebaseDB.collection('notifications').where('userId','==',user.uid).limit(50).get()
                        .then(function(s2){
                            var n = 0;
                            s2.forEach(function(d){ var v = d.data() || {}; if (!(v.isRead === true || v.read === true)) n++; });
                            updateBellBadge(n);
                        }).catch(function(){});
                });
        });
    } catch (e) { /* a badge must never break a page */ }
}

function updateBellBadge(count){
    // Some account pages show the same number in their desktop sidebar. The mobile bottom nav
    // deliberately does NOT carry an Alerts button (the bell in the header covers it, and a
    // sixth item wrapped the bar onto a second line).
    var navBadge = document.getElementById('navNotifBadge');
    if (navBadge) {
        var nv = Number(count) || 0;
        if (nv > 0) { navBadge.textContent = nv > 99 ? '99+' : String(nv); navBadge.style.display = 'inline-flex'; }
        else navBadge.style.display = 'none';
    }
    var badge = document.getElementById('notifBellBadge');
    var btn = document.getElementById('notifBellBtn');
    if (!badge) return;
    var n = Number(count) || 0;
    if (n > 0) {
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.style.display = 'flex';
        if (btn) btn.style.color = '#0064d2';
    } else {
        badge.style.display = 'none';
        if (btn) btn.style.color = '#374151';
    }
}

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled “classic” <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.initNavbar = initNavbar;
window.initSmoothScroll = initSmoothScroll;
window.initScrollEffects = initScrollEffects;
window.initFlashMessages = initFlashMessages;
window.escapeFlashText = escapeFlashText;
window.showFlashMessage = showFlashMessage;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatRelativeTime = formatRelativeTime;
window.formatShortDate = formatShortDate;
window.isValidEmail = isValidEmail;
window.isValidPhone = isValidPhone;
window.showLoading = showLoading;
window.isLoggedIn = isLoggedIn;
window.ensureAuthLoader = ensureAuthLoader;
window.updateUserNav = updateUserNav;
window.requireAuth = requireAuth;
window.logout = logout;
window.addDocument = addDocument;
window.getDocument = getDocument;
window.updateDocument = updateDocument;
window.deleteDocument = deleteDocument;
window.queryCollection = queryCollection;
window.uploadFile = uploadFile;
window.deleteFile = deleteFile;
window.listingLimitForTier = listingLimitForTier;
window.listingLimitForUser = listingLimitForUser;
window.listingLimitLabel = listingLimitLabel;
window.loadImageElement = loadImageElement;
window.canvasToBlob = canvasToBlob;
window.dataURLToBlobLocal = dataURLToBlobLocal;
window.blobToDataURL = blobToDataURL;
window.smImgFallback = smImgFallback;
window.applyImageFallback = applyImageFallback;
window.compressToTarget = compressToTarget;
window.prepareListingPhoto = prepareListingPhoto;
window.productThumb = productThumb;
window.productFull = productFull;
window.productThumbAt = productThumbAt;
window.compressImage = compressImage;
window.ensureHeaderMessagesBtn = ensureHeaderMessagesBtn;
window.ensureAppBottomNav = ensureAppBottomNav;
window.updateAppNavBadge = updateAppNavBadge;
window.updateSidebarMsgBadge = updateSidebarMsgBadge;
window.refreshMessageBadges = refreshMessageBadges;
window.updateHeaderMsgBadge = updateHeaderMsgBadge;
window.escapeHtmlMsg = escapeHtmlMsg;
window.showMessageToast = showMessageToast;
window.ensureAuctionHeaderBtn = ensureAuctionHeaderBtn;
window.ensureAuctionAlertBar = ensureAuctionAlertBar;
window.initGlobalAuctionAlert = initGlobalAuctionAlert;
window.updateAuctionAlertUI = updateAuctionAlertUI;
window.initGlobalMessageBadge = initGlobalMessageBadge;

// ============================================================================
// SAVED ITEMS — mark the cards you have saved (see js/wishlist.js / product page)
// ============================================================================
// The saved list lives in localStorage under 'sankofa_wishlist', so it is readable on every
// page without loading the whole wishlist component. Cards get a heart badge as soon as they
// are rendered, and it disappears again the moment an item is removed.

function smSavedIds() {
    try {
        var raw = JSON.parse(localStorage.getItem('sankofa_wishlist') || '[]');
        if (!Array.isArray(raw)) return [];
        return raw.map(function (i) { return String(i && (i.id || i.productId)); });
    } catch (e) { return []; }
}

function markSavedCards() {
    var cards = document.querySelectorAll('.product-card[data-pid]');
    if (!cards.length) return;
    var saved = smSavedIds();
    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var pid = String(card.getAttribute('data-pid') || '');
        var has = pid && saved.indexOf(pid) !== -1;
        var badge = card.querySelector('.saved-heart-badge');
        if (has && !badge) {
            badge = document.createElement('span');
            badge.className = 'saved-heart-badge';
            badge.title = 'Saved to your items';
            badge.setAttribute('aria-label', 'Saved to your items');
            // A tiny dot was too easy to miss. This reads as a label, so a saved item is
            // obvious at a glance in a grid of dozens of cards.
            badge.innerHTML = '<i class="fas fa-heart"></i><span>Saved</span>';
            (card.querySelector('.product-image-wrapper') || card).appendChild(badge);
        } else if (!has && badge) {
            badge.parentNode.removeChild(badge);
        }
    }
}

function initSavedCardMarks() {
    ensureWishlistHeaderBtn();
    markSavedCards();
    // cards arrive after the page loads (Firestore), so watch for them
    var pending = null;
    try {
        new MutationObserver(function () {
            if (pending) return;
            pending = setTimeout(function () { pending = null; markSavedCards(); }, 200);
        }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    // saved in another tab
    window.addEventListener('storage', function (e) {
        if (e.key === 'sankofa_wishlist') { markSavedCards(); refreshWishlistHeaderBtn(); }
    });
    // coming back to this tab (e.g. after saving on the product page)
    var resync = function () { markSavedCards(); refreshWishlistHeaderBtn(); };
    window.addEventListener('focus', resync);
    window.addEventListener('pageshow', resync);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) resync(); });
    // saving inside this page (the product page) — keep the count honest
    window.addEventListener('sankofa:wishlist', resync);
}

/**
 * The saved-items button in the header, on every page.
 * It only existed on the product page (js/wishlist.js drew it there), so on the home page,
 * search results and the dashboard there was no way to see your saved items at all.
 * This creates it where it is missing and keeps the count in step with the saved list.
 */
function ensureWishlistHeaderBtn() {
    try {
        if (window.location.pathname.includes('/admin') || window.location.pathname.includes('/sm-panel')) return;   // admin has its own header — no shopper buttons
        if (document.getElementById('wishlistIconBtn')) return;         // already there
        if (document.getElementById('wishlistSidebar')) return;         // the drawer page owns it
        var actions = document.querySelector('.header-actions') || document.querySelector('.header .container');
        if (!actions) return;

        var a = document.createElement('a');
        a.id = 'wishlistIconBtn';
        a.className = 'wishlist-icon-btn';
        a.href = '/pages/user/wishlist.html';
        a.title = 'Your saved items';
        a.setAttribute('aria-label', 'Your saved items');
        // NOTE: no id on the badge — every update goes through a.querySelector('.wishlist-count').
        // It used to be id="wishlistCount", but the wishlist PAGE has its own label that was given
        // the same id, so getElementById returned this badge and the page label stayed "0 items".
        a.innerHTML = '<i class="fas fa-heart"></i><span class="wishlist-count" style="display:none;">0</span>';

        // sit next to the cart, where the shopper looks for it
        var cartBtn = document.getElementById('cartIconBtn') || actions.querySelector('.cart-icon-btn');
        if (cartBtn && cartBtn.parentNode === actions) actions.insertBefore(a, cartBtn);
        else actions.appendChild(a);

        refreshWishlistHeaderBtn();
    } catch (e) {}
}

function refreshWishlistHeaderBtn() {
    try {
        var a = document.getElementById('wishlistIconBtn');
        if (!a) return;
        var n = smSavedIds().length;
        var badge = a.querySelector('.wishlist-count');
        if (badge) {
            badge.textContent = n > 99 ? '99+' : String(n);
            badge.style.display = n > 0 ? 'flex' : 'none';
        }
        a.setAttribute('aria-label', n === 0 ? 'Your saved items' : 'Your saved items, ' + n + ' saved');
    } catch (e) {}
}

window.ensureWishlistHeaderBtn = ensureWishlistHeaderBtn;
window.refreshWishlistHeaderBtn = refreshWishlistHeaderBtn;
window.markSavedCards = markSavedCards;
window.initSavedCardMarks = initSavedCardMarks;
window.smSavedIds = smSavedIds;

// kick off the saved-item marks (safe on pages with no cards — it simply does nothing)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { try { initSavedCardMarks(); } catch (e) {} });
} else {
    try { initSavedCardMarks(); } catch (e) {}
}
