/* ============================================================================
   SANKOFA MARKET — MY LISTINGS (real data)
   ----------------------------------------------------------------------------
   Replaces the old mock-up page, which only removed the card from the screen and
   claimed "Listing deleted successfully" without touching the database.

   Sellers can now:
     • see their real listings (with status, views, price, date)
     • remove any listing at any time (optionally cancels a live auction first)
     • mark a listing as sold / make it available again
   ============================================================================ */

var myListingsCache = [];
var myListingsUid = null;
var myListingsFilter = 'all';

document.addEventListener('DOMContentLoaded', function () {
    initListingFilters();
    loadMyListings();
});

/* ---------------------------------------------------------------- helpers */
function listingEscape(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function listingThumb(p) {
    if (typeof productThumb === 'function') return productThumb(p);
    var imgs = p.images || p.photos || [];
    return imgs.length ? imgs[0] : '/images/placeholders/product.svg';
}

/** active | sold | draft | flagged — the status the filter tabs use */
function listingStatusOf(p) {
    if (p.isFlagged === true) return 'flagged';
    if (p.isSold === true) return 'sold';
    if (p.isActive === false) return 'draft';
    return 'active';
}

function listingStatusLabel(p) {
    var s = listingStatusOf(p);
    return s === 'active' ? 'Active' : s === 'sold' ? 'Sold' : s === 'draft' ? 'Paused' : 'Flagged';
}

function listingStatusClass(p) {
    var s = listingStatusOf(p);
    return s === 'active' ? 'completed' : s === 'sold' ? 'shipped' : s === 'flagged' ? 'cancelled' : 'pending';
}

function listingDate(p) {
    var c = p.createdAt;
    if (!c) return '—';
    var d = c.toDate ? c.toDate() : new Date(c);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}


// Update only fields the seller can safely edit. Ownership, status, stock,
// views, variants, preorder, and delivery fields are deliberately omitted.
function buildSellerListingEditPatch(existing, fields, uploadedPhotos, updatedAt) {
    var product = existing || {};
    var oldLocation = product.location && typeof product.location === 'object' ? product.location : {};
    var patch = {
        title: String(fields.title || '').trim(),
        category: String(fields.category || ''),
        description: String(fields.description || '').trim(),
        price: Number(fields.price),
        condition: String(fields.condition || ''),
        location: Object.assign({}, oldLocation, { city: String(fields.city || '').trim() }),
        updatedAt: updatedAt
    };
    var newUrls = uploadedPhotos && Array.isArray(uploadedPhotos.urls) ? uploadedPhotos.urls : [];
    if (newUrls.length) {
        var oldImages = (Array.isArray(product.images) && product.images.length)
            ? product.images : (Array.isArray(product.photos) ? product.photos : []);
        var oldThumbs = Array.isArray(product.imagesThumb) ? product.imagesThumb : [];
        var newThumbs = uploadedPhotos && Array.isArray(uploadedPhotos.thumbs) ? uploadedPhotos.thumbs : [];
        var combined = oldImages.concat(newUrls);
        patch.images = combined;
        patch.photos = combined;
        patch.imagesThumb = oldImages.map(function (url, i) { return oldThumbs[i] || url; })
            .concat(newUrls.map(function (url, i) { return newThumbs[i] || url; }));
    }
    return patch;
}

function sellerListingDataUrlToBlob(dataUrl) {
    var parts = String(dataUrl || '').split(',');
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    var binary = atob(parts[1] || '');
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

async function uploadSellerListingPhotos(dataUrls, uid, title) {
    if (!Array.isArray(dataUrls) || !dataUrls.length) return { urls: [], thumbs: [] };
    if (typeof firebase === 'undefined' || typeof firebase.storage !== 'function') throw new Error('Photo storage is not available.');
    if (!uid) throw new Error('Your sign-in expired. Sign in again before uploading photos.');
    var storage = firebase.storage();
    var folder = 'products/' + uid + '/';
    var safeTitle = String(title || 'listing').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    var stamp = 'seller-edit_' + Date.now();
    var refs = [], urls = [], thumbs = [];
    for (var i = 0; i < dataUrls.length; i++) {
        try {
            var blob = sellerListingDataUrlToBlob(dataUrls[i]);
            if (typeof compressToTarget === 'function') {
                try { blob = (await compressToTarget(blob, { maxDim: 1600, maxBytes: 300 * 1024, quality: 0.82 })).blob; } catch (e) {}
            }
            var fullRef = storage.ref(folder + safeTitle + '_' + stamp + '_' + i + '.jpg');
            var snapshot = await new Promise(function (resolve, reject) {
                var task = fullRef.put(blob);
                task.on('state_changed', null, reject, function () { resolve(task.snapshot); });
            });
            var savedRef = snapshot.ref || fullRef;
            refs.push(savedRef);
            var fullUrl = await savedRef.getDownloadURL();
            urls.push(fullUrl);
            var thumbRef = null;
            try {
                var thumbBlob = blob;
                if (typeof compressToTarget === 'function') thumbBlob = (await compressToTarget(blob, { maxDim: 800, maxBytes: 90 * 1024, quality: 0.72 })).blob;
                thumbRef = storage.ref(folder + safeTitle + '_' + stamp + '_' + i + '_thumb.jpg');
                await new Promise(function (resolve, reject) {
                    var task = thumbRef.put(thumbBlob);
                    task.on('state_changed', null, reject, function () { resolve(); });
                });
                refs.push(thumbRef);
                thumbs.push(await thumbRef.getDownloadURL());
            } catch (thumbErr) {
                if (thumbRef) { try { await thumbRef.delete(); } catch (cleanupErr) {} }
                thumbs.push(fullUrl);
            }
        } catch (err) {
            await Promise.all(refs.map(function (ref) { return ref.delete().catch(function () {}); }));
            throw new Error('Could not upload photo ' + (i + 1) + ': ' + (err && err.message ? err.message : 'Storage rejected the upload.'));
        }
    }
    return { urls: urls, thumbs: thumbs };
}

function listingNotify(message, type) {
    if (typeof showFlashMessage === 'function') { showFlashMessage(message, type || 'info'); return; }
    try {
        var el = document.createElement('div');
        el.style.cssText = 'position:fixed;top:80px;right:20px;z-index:10000;padding:0.75rem 1.1rem;border-radius:8px;' +
            'font-weight:600;font-size:0.9rem;color:#fff;background:' +
            (type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : type === 'success' ? '#22c55e' : '#0064d2');
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 4000);
    } catch (e) {}
}

/* ---------------------------------------------------------------- loading */
function loadMyListings() {
    var grid = document.getElementById('listingsGrid');
    if (grid) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2.5rem;color:#5a6572;">' +
            '<i class="fas fa-spinner fa-spin" style="font-size:1.4rem;color:#0064d2;"></i><p>Loading your listings…</p></div>';
    }

    function start() {
        if (typeof firebaseDB === 'undefined' || !firebaseDB) { setTimeout(start, 500); return; }
        var auth = (typeof firebaseAuth !== 'undefined' && firebaseAuth) ? firebaseAuth : firebase.auth();
        auth.onAuthStateChanged(function (user) {
            if (!user) {
                window.location.href = '../../pages/auth/login.html?redirect=' +
                    encodeURIComponent(window.location.pathname + window.location.search);
                return;
            }
            myListingsUid = user.uid;
            showSignedInAs(user);
            fetchMyListings(user);
        });
    }
    start();
}

/** Shows which account the page is using — sellers with several accounts get confused otherwise. */
function showSignedInAs(user) {
    var el = document.getElementById('listingsSignedInAs');
    if (!el) return;
    var who = (user && (user.email || user.displayName)) || 'your account';
    el.innerHTML = '<i class="fas fa-user-circle"></i> Signed in as <strong>' + listingEscape(who) + '</strong>' +
        ' <button type="button" id="listingsRefreshBtn" style="margin-left:0.5rem;background:#fff;border:1px solid #dbeafe;color:#0064d2;' +
        'border-radius:6px;padding:0.2rem 0.55rem;font-size:0.75rem;font-weight:700;cursor:pointer;"><i class="fas fa-rotate"></i> Refresh</button>';
    el.style.cssText = 'font-size:0.82rem;color:#1e40af;background:#f0f7ff;border:1px solid #bfdbfe;' +
        'border-radius:8px;padding:0.5rem 0.75rem;margin-top:0.6rem;display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;';
    var btn = document.getElementById('listingsRefreshBtn');
    if (btn) btn.onclick = function () {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing…';
        fetchMyListings(user);
    };
}

/**
 * Read the seller's listings.
 * Asks the SERVER first — the local cache can be empty or stale (that is what shows
 * "0 listings" while the listing exists), then falls back to the cache if offline.
 */
function fetchMyListings(user) {
    var grid = document.getElementById('listingsGrid');
    if (!user) {
        var auth = (typeof firebaseAuth !== 'undefined' && firebaseAuth) ? firebaseAuth : firebase.auth();
        user = auth.currentUser;
    }
    if (!user) return;

    function apply(snap, fromServer) {
        myListingsCache = [];
        snap.forEach(function (doc) { var d = doc.data(); d.id = doc.id; myListingsCache.push(d); });
        myListingsCache.sort(function (a, b) {
            var ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
            var tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        window.__listingsFromServer = fromServer;
        renderMyListings();
    }

    var q = firebaseDB.collection('products').where('sellerId', '==', user.uid);

    q.get({ source: 'server' })
        .then(function (snap) { apply(snap, true); })
        .catch(function (err) {
            console.warn('Server read failed, trying the local cache:', err && err.message);
            q.get()
                .then(function (snap) { apply(snap, false); })
                .catch(function (err2) {
                    console.error('Could not load your listings:', err2);
                    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#e74c3c;">' +
                        '<i class="fas fa-exclamation-triangle"></i><p>Could not load your listings: ' + listingEscape(err2.message) + '</p>' +
                        '<button onclick="loadMyListings()" class="btn btn-primary btn-small" style="margin-top:0.5rem;">Try again</button></div>';
                });
        });
}

/* ---------------------------------------------------------------- rendering */
function myListingsFiltered() {
    if (myListingsFilter === 'all') return myListingsCache;
    return myListingsCache.filter(function (p) { return listingStatusOf(p) === myListingsFilter; });
}

function renderMyListings() {
    var grid = document.getElementById('listingsGrid');
    if (!grid) return;
    updateMyListingStats();
    updateFilterTabCounts();

    var list = myListingsFiltered();

    if (!myListingsCache.length) {
        var offlineNote = (window.__listingsFromServer === false)
            ? '<p style="color:#b45309;font-size:0.85rem;margin-top:0.4rem;"><i class="fas fa-wifi"></i> ' +
              'These results came from your device\'s offline copy — the connection may not be ready. ' +
              'Tap <strong>Refresh</strong> above to check the server again.</p>'
            : '';
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">' +
            '<i class="fas fa-box-open"></i><h2 style="font-size:1.17em;">No listings on this account</h2>' +
            '<p>Nothing is listed under the account shown above. If you listed the item while signed in to a ' +
            'different account, sign out and sign in with that one.</p>' +
            offlineNote +
            '<a href="../../publish.html" class="btn btn-primary" style="margin-top:0.75rem;"><i class="fas fa-plus"></i> Create a Listing</a></div>';
        return;
    }
    if (!list.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">' +
            '<i class="fas fa-filter"></i><h2 style="font-size:1.17em;">Nothing in this tab</h2>' +
            '<p>You have no ' + listingEscape(myListingsFilter) + ' listings right now.</p></div>';
        return;
    }

    grid.innerHTML = list.map(function (p) {
        var status = listingStatusOf(p);
        var isSold = status === 'sold';
        return '' +
        '<div class="listing-card" data-id="' + listingEscape(p.id) + '" data-status="' + status + '">' +
            '<div class="listing-card-image">' +
                '<a href="../../product-detail.html?id=' + encodeURIComponent(p.id) + '">' +
                    '<img src="' + listingEscape(listingThumb(p)) + '" alt="' + listingEscape(p.title || 'Listing') + '"' +
                        ' loading="lazy">' +
                '</a>' +
                '<span class="listing-status status-badge ' + listingStatusClass(p) + '">' + listingStatusLabel(p) + '</span>' +
            '</div>' +
            '<div class="listing-card-body">' +
                '<h3 title="' + listingEscape(p.title || '') + '">' + listingEscape(p.title || 'Untitled') + '</h3>' +
                '<div class="listing-price">GHS ' + Number(p.price || 0).toLocaleString() + '</div>' +
                '<div class="listing-meta">' +
                    '<span><i class="fas fa-eye"></i> ' + (p.views || 0) + ' views</span>' +
                    '<span><i class="far fa-calendar"></i> ' + listingDate(p) + '</span>' +
                '</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.85rem;">' +
                    '<button type="button" class="btn btn-outline btn-small js-listing-action" data-action="edit" data-id="' + listingEscape(p.id) + '" style="padding:0.35rem 0.6rem;font-size:0.75rem;"><i class="fas fa-pen"></i> Edit</button>' +
                    '<a href="../../product-detail.html?id=' + encodeURIComponent(p.id) + '" class="btn btn-outline btn-small" style="padding:0.35rem 0.6rem;font-size:0.75rem;">' +
                        '<i class="fas fa-eye"></i> View</a>' +
                    '<button type="button" class="btn btn-outline btn-small js-listing-action" data-action="toggle-sold" data-id="' + listingEscape(p.id) + '"' +
                        ' style="padding:0.35rem 0.6rem;font-size:0.75rem;">' +
                        (isSold ? '<i class="fas fa-rotate-left"></i> Mark available' : '<i class="fas fa-check"></i> Mark as sold') + '</button>' +
                    '<button type="button" class="btn btn-small js-listing-action" data-action="delete" data-id="' + listingEscape(p.id) + '"' +
                        ' style="padding:0.35rem 0.6rem;font-size:0.75rem;background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;">' +
                        '<i class="fas fa-trash"></i> Remove</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');

    // Bind the buttons (data attributes keep the markup free of quote-escaping traps)
    grid.querySelectorAll('.js-listing-action').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var id = this.getAttribute('data-id');
            var action = this.getAttribute('data-action');
            if (action === 'delete') deleteListing(id);
            else if (action === 'edit') editUserListing(id);
            else toggleListingSold(id);
        });
    });

    // Broken picture -> local placeholder
    grid.querySelectorAll('img').forEach(function (img) {
        img.addEventListener('error', function () { this.onerror = null; this.src = '/images/placeholders/product.svg'; });
    });

    // If the dashboard is showing (it has its own filter buttons), keep the chosen filter applied
    var activeBtn = document.querySelector('.listings-filter .filter-btn.active');
    if (activeBtn && typeof applyDashboardListingFilter === 'function') {
        applyDashboardListingFilter(activeBtn.getAttribute('data-filter'));
    }
}

function updateMyListingStats() {
    var counts = { all: myListingsCache.length, active: 0, sold: 0, draft: 0, flagged: 0 };
    myListingsCache.forEach(function (p) { counts[listingStatusOf(p)]++; });
    var set = function (id, value) { var el = document.getElementById(id); if (el) el.textContent = value; };
    set('statActive', counts.active);
    set('statDrafts', counts.draft);
    set('statSold', counts.sold);
    set('statFlagged', counts.flagged);

    // Count next to the "My Listings" tab (dashboard) — hidden when there is nothing
    var badge = document.getElementById('listingsCount');
    if (badge) {
        badge.textContent = counts.all;
        badge.style.display = counts.all > 0 ? '' : 'none';
    }

    // The dashboard's "Active Listings" stat card must count ACTIVE listings only
    var activeEl = document.getElementById('totalListings');
    if (activeEl) activeEl.textContent = counts.active;
}

function updateFilterTabCounts() {
    var counts = { all: myListingsCache.length, active: 0, sold: 0, draft: 0, flagged: 0 };
    myListingsCache.forEach(function (p) { counts[listingStatusOf(p)]++; });

    // The My Listings page uses .filter-tab (All/Paused/Sold/Flagged)
    document.querySelectorAll('.filter-tab').forEach(function (tab) {
        var f = tab.getAttribute('data-filter');
        var label = f === 'all' ? 'All' : f === 'active' ? 'Active' : f === 'draft' ? 'Paused' : f === 'sold' ? 'Sold' : 'Flagged';
        tab.textContent = label + ' (' + (counts[f] || 0) + ')';
    });

    // The dashboard tab uses .filter-btn (All/Active/Sold/Drafts)
    document.querySelectorAll('.listings-filter .filter-btn').forEach(function (btn) {
        var f = btn.getAttribute('data-filter');
        var label = f === 'all' ? 'All' : f === 'active' ? 'Active' : f === 'draft' ? 'Drafts' : f === 'sold' ? 'Sold' : 'Flagged';
        var count = (f === 'draft') ? (counts.draft + counts.flagged) : counts[f];
        btn.textContent = label + ' (' + (count || 0) + ')';
    });
}

/* ---------------------------------------------------------------- filters */
function initListingFilters() {
    var tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            tabs.forEach(function (t) { t.classList.remove('active'); });
            this.classList.add('active');
            myListingsFilter = this.getAttribute('data-filter') || 'all';
            renderMyListings();
        });
    });
}

/* Load the video feature on demand as a fallback for a stale cached page or blocked first request. */
function ensureListingVideoTools() {
    if (window.SankofaListingVideo) return Promise.resolve(window.SankofaListingVideo);
    return new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = '/js/listing-video.js?v=8';
        script.onload = function () {
            if (window.SankofaListingVideo) resolve(window.SankofaListingVideo);
            else reject(new Error('Video support did not start.'));
        };
        script.onerror = function () { reject(new Error('Video support could not load.')); };
        document.head.appendChild(script);
    });
}

/* ---------------------------------------------------------------- edit existing listing */
function editUserListing(listingId) {
    var product = myListingsCache.filter(function (p) { return String(p.id) === String(listingId); })[0];
    if (!product || !myListingsUid || String(product.sellerId) !== String(myListingsUid)) {
        listingNotify('This listing is not on your account. Refresh your list and try again.', 'error');
        return;
    }
    closeUserListingEditModal();
    var modal = document.createElement('div');
    modal.id = 'userListingEditModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.58);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:14px;max-width:720px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,0.28);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:1rem 1.2rem;border-bottom:1px solid #e5e7eb;">
                <h2 style="margin:0;font-size:1.15rem;">Edit your listing</h2>
                <button type="button" id="userListingEditClose" aria-label="Close" style="border:0;background:none;font-size:1.4rem;cursor:pointer;color:#64748b;"><i class="fas fa-times"></i></button>
            </div>
            <form id="userListingEditForm" style="padding:1rem 1.2rem;">
                <p style="margin:0 0 1rem;color:#64748b;font-size:0.85rem;line-height:1.5;">Change the main details or add photos. Seller, stock, sold status, variants, pre-order, and delivery settings stay as they are.</p>
                <label style="display:block;font-size:0.82rem;font-weight:700;margin-top:0.7rem;">Title *<input id="sellerEditTitle" type="text" maxlength="80" required style="display:block;width:100%;margin-top:0.3rem;padding:0.65rem;border:1px solid #cbd5e1;border-radius:8px;"></label>
                <label style="display:block;font-size:0.82rem;font-weight:700;margin-top:0.7rem;">Category *<select id="sellerEditCategory" required style="display:block;width:100%;margin-top:0.3rem;padding:0.65rem;border:1px solid #cbd5e1;border-radius:8px;"></select></label>
                <label style="display:block;font-size:0.82rem;font-weight:700;margin-top:0.7rem;">Description *<textarea id="sellerEditDescription" rows="4" required style="display:block;width:100%;margin-top:0.3rem;padding:0.65rem;border:1px solid #cbd5e1;border-radius:8px;"></textarea></label>
                <label style="display:block;font-size:0.82rem;font-weight:700;margin-top:0.7rem;">Price (GHS) *<input id="sellerEditPrice" type="number" min="0.01" step="0.01" required style="display:block;width:100%;margin-top:0.3rem;padding:0.65rem;border:1px solid #cbd5e1;border-radius:8px;"></label>
                <label style="display:block;font-size:0.82rem;font-weight:700;margin-top:0.7rem;">Condition *<select id="sellerEditCondition" required style="display:block;width:100%;margin-top:0.3rem;padding:0.65rem;border:1px solid #cbd5e1;border-radius:8px;"></select></label>
                <label style="display:block;font-size:0.82rem;font-weight:700;margin-top:0.7rem;">Location *<input id="sellerEditCity" type="text" maxlength="80" required style="display:block;width:100%;margin-top:0.3rem;padding:0.65rem;border:1px solid #cbd5e1;border-radius:8px;"></label>
                <div style="margin-top:0.9rem;"><strong style="font-size:0.82rem;">Current photos</strong><div id="sellerEditCurrentPhotos" style="display:flex;gap:0.45rem;flex-wrap:wrap;min-height:54px;align-items:center;margin-top:0.35rem;"></div></div>
                <label style="display:block;font-size:0.82rem;font-weight:700;margin-top:0.9rem;">Add photos (optional)<input id="sellerEditPhotos" type="file" accept="image/*" multiple style="display:block;margin-top:0.35rem;"></label>
                <div id="sellerEditNewPhotos" style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.45rem;"></div>
                <small style="display:block;color:#64748b;margin-top:0.35rem;">Current photos stay. New photos are added. Maximum 8 photos total, 5 MB each.</small>
                <div style="margin-top:1rem;padding:0.8rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                    <strong style="font-size:0.82rem;">Premium listing video</strong>
                    <p id="sellerEditVideoNote" style="font-size:0.75rem;color:#64748b;margin:0.3rem 0 0.5rem;">Checking your seller plan…</p>
                    <div id="sellerEditCurrentVideo"></div>
                    <label id="sellerEditVideoPickerLabel" style="display:block;font-size:0.78rem;font-weight:700;">Add or replace video (one per listing; max 30 seconds)<input id="sellerEditVideo" type="file" accept="video/*" style="display:block;margin-top:0.3rem;" disabled></label>
                    <button type="button" id="sellerEditRemoveVideo" style="display:none;margin-top:0.45rem;background:#fff;border:1px solid #fecaca;color:#991b1b;border-radius:7px;padding:0.35rem 0.6rem;font-size:0.75rem;font-weight:700;cursor:pointer;">Remove current video</button>
                    <div id="sellerEditVideoStatus" role="status" aria-live="polite" style="font-size:0.75rem;color:#5a6572;margin-top:0.4rem;"></div>
                    <div id="sellerEditVideoPreview" style="margin-top:0.4rem;"></div>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:0.6rem;margin-top:1.2rem;">
                    <button type="button" id="sellerEditCancel" class="btn btn-outline">Cancel</button>
                    <button type="submit" id="sellerEditSave" class="btn btn-primary"><i class="fas fa-save"></i> Save changes</button>
                </div>
            </form>
        </div>`;
    document.body.appendChild(modal);

    var titleInput = modal.querySelector('#sellerEditTitle');
    var categorySelect = modal.querySelector('#sellerEditCategory');
    var descriptionInput = modal.querySelector('#sellerEditDescription');
    var priceInput = modal.querySelector('#sellerEditPrice');
    var conditionSelect = modal.querySelector('#sellerEditCondition');
    var cityInput = modal.querySelector('#sellerEditCity');
    var photoInput = modal.querySelector('#sellerEditPhotos');
    var newPhotosWrap = modal.querySelector('#sellerEditNewPhotos');
    var currentPhotosWrap = modal.querySelector('#sellerEditCurrentPhotos');
    var videoInput = modal.querySelector('#sellerEditVideo');
    var videoPickerLabel = modal.querySelector('#sellerEditVideoPickerLabel');
    var videoNote = modal.querySelector('#sellerEditVideoNote');
    var currentVideoWrap = modal.querySelector('#sellerEditCurrentVideo');
    var videoStatus = modal.querySelector('#sellerEditVideoStatus');
    var videoPreview = modal.querySelector('#sellerEditVideoPreview');
    var removeVideoBtn = modal.querySelector('#sellerEditRemoveVideo');
    var videoState = { premium: false, selected: false, draft: null, processing: null, remove: false, originalPath: product.videoStoragePath || '' };

    var categoryOptions = [
        ['electronics','Electronics'],['fashion','Fashion'],['home-garden','Home & Garden'],['vehicles','Vehicles'],
        ['services','Services'],['sports','Sports'],['books-media','Books & Media'],['baby-kids','Baby & Kids'],
        ['beauty-health','Beauty & Health'],['food-groceries','Food & Groceries'],['pets','Pets'],['jobs-skills','Jobs & Skills'],
        ['real-estate','Real Estate'],['musical-instruments','Musical Instruments'],['others','Others']
    ];
    var seenCategories = {};
    function addCategory(id, label) {
        id = String(id || '').trim(); if (!id || seenCategories[id]) return;
        seenCategories[id] = true;
        var option = document.createElement('option'); option.value = id; option.textContent = label || id; categorySelect.appendChild(option);
    }
    categoryOptions.forEach(function (pair) { addCategory(pair[0], pair[1]); });
    if (product.category && !seenCategories[product.category]) addCategory(product.category, product.category);
    var existingCondition = String(product.condition || 'new');
    ['new','used','like-new','good','fair','refurbished'].forEach(function (value) {
        var option = document.createElement('option'); option.value = value;
        option.textContent = value.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        conditionSelect.appendChild(option);
    });
    if (!Array.prototype.some.call(conditionSelect.options, function (o) { return o.value === existingCondition; })) {
        var extra = document.createElement('option'); extra.value = existingCondition; extra.textContent = existingCondition; conditionSelect.appendChild(extra);
    }

    titleInput.value = product.title || '';
    categorySelect.value = product.category || 'others';
    descriptionInput.value = product.description || '';
    priceInput.value = product.price == null ? '' : String(product.price);
    conditionSelect.value = existingCondition;
    cityInput.value = product.location && typeof product.location === 'object' ? (product.location.city || '') : String(product.location || '');
    var existingImages = (Array.isArray(product.images) && product.images.length) ? product.images : (Array.isArray(product.photos) ? product.photos : []);
    var existingThumbs = Array.isArray(product.imagesThumb) ? product.imagesThumb : [];
    if (existingImages.length) {
        existingImages.forEach(function (url, i) {
            var img = document.createElement('img'); img.src = existingThumbs[i] || url; img.alt = 'Current listing photo ' + (i + 1);
            img.style.cssText = 'width:56px;height:56px;object-fit:cover;border-radius:7px;border:1px solid #dbe3ed;'; currentPhotosWrap.appendChild(img);
        });
    } else {
        var empty = document.createElement('span'); empty.textContent = 'No photos saved yet.'; empty.style.color = '#9aa5b1'; currentPhotosWrap.appendChild(empty);
    }

    if (videoState.originalPath && typeof firebase !== 'undefined' && firebase.storage){
        var videoLoading = document.createElement('span'); videoLoading.textContent = 'Loading current video…'; videoLoading.style.cssText = 'font-size:0.75rem;color:#64748b;';
        currentVideoWrap.appendChild(videoLoading);
        firebase.storage().ref().child(videoState.originalPath).getDownloadURL().then(function(url){
            if (!document.body.contains(modal)) return;
            currentVideoWrap.innerHTML = '';
            var existingVideo = document.createElement('video');
            existingVideo.controls = true; existingVideo.playsInline = true; existingVideo.preload = 'none';
            existingVideo.src = url;
            existingVideo.style.cssText = 'display:block;width:100%;max-width:420px;max-height:240px;background:#111;border-radius:8px;';
            currentVideoWrap.appendChild(existingVideo);
            if (removeVideoBtn) removeVideoBtn.style.display = 'inline-block';
        }).catch(function(){
            currentVideoWrap.textContent = 'A video is saved, but it could not be previewed here.';
            if (removeVideoBtn) removeVideoBtn.style.display = 'inline-block';
        });
    } else {
        currentVideoWrap.textContent = 'No video attached.';
    }

    if (videoPickerLabel) videoPickerLabel.style.display = 'block';
    if (videoInput) videoInput.disabled = true;
    ensureListingVideoTools().then(function(videoTools){
        if (!document.body.contains(modal)) return;
        return videoTools.loadPremiumStatus(myListingsUid).then(function(active){
            if (!document.body.contains(modal)) return;
            videoState.premium = active;
            if (videoInput) videoInput.disabled = !active;
            if (videoPickerLabel) videoPickerLabel.style.display = 'block';
            if (videoNote) videoNote.textContent = active
                ? 'Your Premium plan allows one video per listing. New videos are converted to max 480p, clipped to 30 seconds, and capped at 8 MB.'
                : (videoState.originalPath ? 'This video stays on your listing. Premium is required to replace it.' : 'Premium is required to add a listing video. If your account shows a Premium badge, refresh this page and try again.');
        });
    }).catch(function(){
        if (!document.body.contains(modal)) return;
        if (videoInput) videoInput.disabled = true;
        if (videoPickerLabel) videoPickerLabel.style.display = 'block';
        if (videoNote) videoNote.textContent = 'The video tools did not load. Refresh My Listings and try again.';
    });

    if (videoInput) videoInput.addEventListener('change', function(){
        var file = videoInput.files && videoInput.files[0];
        videoState.selected = !!file;
        videoState.draft = null;
        videoState.remove = false;
        if (videoPreview && window.SankofaListingVideo) window.SankofaListingVideo.clearPreview(videoPreview);
        if (!file){ if (videoStatus) videoStatus.textContent = ''; return; }
        if (!videoState.premium || !window.SankofaListingVideo){
            videoState.selected = false;
            videoInput.value = '';
            if (videoStatus) videoStatus.textContent = 'An active Premium plan is required to add a video.';
            return;
        }
        videoInput.disabled = true;
        if (removeVideoBtn) removeVideoBtn.disabled = true;
        if (videoStatus) videoStatus.textContent = 'Converting video on this device… 0%';
        videoState.processing = window.SankofaListingVideo.process(file, function(percent){
            if (videoStatus) videoStatus.textContent = 'Converting video on this device… ' + percent + '%';
        }).then(function(result){
            videoState.draft = result;
            if (videoStatus) videoStatus.textContent = 'Preview ready (not uploaded yet): ' + result.width + '×' + result.height + ', ' + result.durationSeconds + ' seconds, ' + (result.blob.size / 1024 / 1024).toFixed(1) + ' MB. Save changes to attach it.';
            if (videoPreview) window.SankofaListingVideo.renderPreview(videoPreview, result);
            return result;
        }).catch(function(err){
            videoState.draft = null;
            videoState.selected = false;
            videoInput.value = '';
            videoState.error = err && err.message ? err.message : 'Video processing failed.';
            if (videoStatus) videoStatus.textContent = videoState.error + ' You can choose another video or save without one.';
            return null;
        }).finally(function(){
            videoInput.disabled = !videoState.premium;
            if (removeVideoBtn) removeVideoBtn.disabled = false;
            videoState.processing = null;
        });
    });
    if (removeVideoBtn) removeVideoBtn.addEventListener('click', function(){
        videoState.remove = true; videoState.selected = false; videoState.draft = null;
        if (videoInput) { videoInput.value = ''; videoInput.disabled = !videoState.premium; }
        currentVideoWrap.textContent = 'The current video will be removed when you save.';
        if (videoPreview && window.SankofaListingVideo) window.SankofaListingVideo.clearPreview(videoPreview);
        if (videoStatus) videoStatus.textContent = 'Video will be removed.';
    });

    modal.querySelector('#userListingEditClose').addEventListener('click', closeUserListingEditModal);
    modal.querySelector('#sellerEditCancel').addEventListener('click', closeUserListingEditModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeUserListingEditModal(); });
    photoInput.addEventListener('change', function () {
        var files = Array.from(photoInput.files || []); newPhotosWrap.innerHTML = '';
        if (existingImages.length + files.length > 8) { listingNotify('This listing can have at most 8 photos total.', 'error'); photoInput.value = ''; return; }
        (async function () {
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                if (file.size > 5 * 1024 * 1024) { listingNotify('Each photo must be 5 MB or smaller.', 'error'); continue; }
                var dataUrl;
                try {
                    dataUrl = (typeof compressImage === 'function') ? await compressImage(file) : await new Promise(function (resolve, reject) {
                        var reader = new FileReader(); reader.onload = function (ev) { resolve(ev.target.result); }; reader.onerror = reject; reader.readAsDataURL(file);
                    });
                } catch (err) {
                    try { dataUrl = await new Promise(function (resolve, reject) { var reader = new FileReader(); reader.onload = function (ev) { resolve(ev.target.result); }; reader.onerror = reject; reader.readAsDataURL(file); }); }
                    catch (readErr) { listingNotify('Could not read one of the selected photos.', 'error'); continue; }
                }
                var img = document.createElement('img'); img.src = dataUrl; img.alt = 'New photo ' + (i + 1);
                img.style.cssText = 'width:56px;height:56px;object-fit:cover;border-radius:7px;border:1px solid #dbe3ed;'; newPhotosWrap.appendChild(img);
            }
        })();
    });

    modal.querySelector('#userListingEditForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        var fields = { title: titleInput.value.trim(), category: categorySelect.value, description: descriptionInput.value.trim(), price: Number(priceInput.value), condition: conditionSelect.value, city: cityInput.value.trim() };
        if (fields.title.length < 3 || fields.title.length > 80 || !fields.category || !fields.description || !isFinite(fields.price) || fields.price <= 0 || !fields.condition || !fields.city) {
            listingNotify('Please check the title, category, description, price, condition, and location.', 'error'); return;
        }
        if (videoState.processing) await videoState.processing;
        if (videoState.selected && !videoState.draft){
            listingNotify(videoState.error || 'Wait for the video to finish processing or choose it again.', 'error');
            return;
        }
        if (videoState.draft && !videoState.premium){
            listingNotify('An active Premium plan is required to add a listing video.', 'error');
            return;
        }
        var fileCount = (photoInput.files && photoInput.files.length) || 0;
        var dataUrls = Array.from(newPhotosWrap.querySelectorAll('img')).map(function (img) { return img.src; }).filter(Boolean);
        if (fileCount && !dataUrls.length) { listingNotify('The selected photos could not be read. Choose them again.', 'error'); return; }
        var save = modal.querySelector('#sellerEditSave'); save.disabled = true; save.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
        try {
            var uploaded = dataUrls.length ? await uploadSellerListingPhotos(dataUrls, myListingsUid, fields.title) : null;
            var updatedAt = firebase.firestore && firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString();
            var patch = buildSellerListingEditPatch(product, fields, uploaded, updatedAt);
            var videoPath = videoState.originalPath;
            if (videoState.draft){
                videoPath = window.SankofaListingVideo.storagePath(myListingsUid, listingId);
                if (videoStatus) videoStatus.textContent = 'Uploading processed video…';
                await window.SankofaListingVideo.upload(videoState.draft.blob, myListingsUid, listingId, function(percent){
                    if (videoStatus) videoStatus.textContent = percent >= 100
                        ? 'Finishing upload with Firebase…'
                        : 'Uploading processed video… ' + percent + '%';
                });
                patch.videoStoragePath = videoPath;
                patch.videoDurationSeconds = videoState.draft.durationSeconds;
                patch.videoWidth = videoState.draft.width;
                patch.videoHeight = videoState.draft.height;
                if (videoStatus) videoStatus.textContent = 'Video uploaded. Saving it to your listing…';
            } else if (videoState.remove && videoState.originalPath){
                patch.videoStoragePath = firebase.firestore.FieldValue.delete();
                patch.videoDurationSeconds = firebase.firestore.FieldValue.delete();
                patch.videoWidth = firebase.firestore.FieldValue.delete();
                patch.videoHeight = firebase.firestore.FieldValue.delete();
            }
            await firebaseDB.collection('products').doc(listingId).update(patch);
            if (videoState.remove && videoState.originalPath){
                await window.SankofaListingVideo.delete(videoState.originalPath);
                delete product.videoStoragePath; delete product.videoDurationSeconds; delete product.videoWidth; delete product.videoHeight;
            } else if (videoState.draft){
                product.videoStoragePath = videoPath;
                product.videoDurationSeconds = videoState.draft.durationSeconds;
                product.videoWidth = videoState.draft.width;
                product.videoHeight = videoState.draft.height;
            }
            Object.assign(product, fields);
            if (uploaded && uploaded.urls.length) {
                var old = (Array.isArray(product.images) && product.images.length) ? product.images : (Array.isArray(product.photos) ? product.photos : []);
                var oldThumbs = Array.isArray(product.imagesThumb) ? product.imagesThumb : [];
                product.images = old.concat(uploaded.urls); product.photos = product.images;
                product.imagesThumb = old.map(function (url, i) { return oldThumbs[i] || url; }).concat(uploaded.thumbs);
            }
            var listingSaveMessage = videoState.draft
                ? 'Listing and video updated successfully.'
                : (videoState.remove && videoState.originalPath ? 'Listing updated and video removed.' : 'Listing updated successfully.');
            closeUserListingEditModal(); renderMyListings();
            listingNotify(listingSaveMessage, 'success');
        } catch (err) {
            console.error('Could not update seller listing:', err);
            var errorMessage = err && err.message ? err.message : String(err || 'Unknown error');
            if (videoState.draft && videoState.draft.blob) {
                var blobType = String(videoState.draft.blob.type || 'unknown').split(';')[0];
                var blobSizeBytes = Number(videoState.draft.blob.size || 0);
                var blobSizeMb = (blobSizeBytes / 1024 / 1024).toFixed(2);
                var authMatchesListing = false;
                try { authMatchesListing = !!(firebase.auth().currentUser && firebase.auth().currentUser.uid === myListingsUid); } catch (e) {}
                console.error('Listing video upload diagnostics:', { contentType: blobType, sizeBytes: blobSizeBytes, signedInAccountMatchesListing: authMatchesListing });
                if (videoStatus) videoStatus.textContent = 'Video save failed (' + blobType + ', ' + blobSizeMb + ' MB): ' + errorMessage + ' The converted preview is still here; tap Save changes to retry.';
            }
            listingNotify('Could not save changes: ' + errorMessage, 'error');
            save.disabled = false; save.innerHTML = '<i class="fas fa-save"></i> Save changes';
        }
    });
}

function closeUserListingEditModal() {
    var modal = document.getElementById('userListingEditModal');
    if (modal){
        var preview = modal.querySelector('#sellerEditVideoPreview');
        if (preview && window.SankofaListingVideo) window.SankofaListingVideo.clearPreview(preview);
        modal.remove();
    }
}

/* ---------------------------------------------------------------- actions */
function toggleListingSold(listingId) {
    var p = myListingsCache.filter(function (x) { return x.id === listingId; })[0];
    if (!p) return;
    var makeSold = listingStatusOf(p) !== 'sold';
    if (!makeSold && !confirm('Make "' + (p.title || 'this listing') + '" available for sale again?')) return;
    firebaseDB.collection('products').doc(listingId)
        .update({ isSold: makeSold, soldAt: makeSold ? firebase.firestore.FieldValue.serverTimestamp() : null })
        .then(function () {
            p.isSold = makeSold;
            listingNotify(makeSold ? 'Marked as sold' : 'Listing is available again', 'success');
            renderMyListings();
        })
        .catch(function (err) { listingNotify('Could not update: ' + err.message, 'error'); });
}

/**
 * Remove a listing for real: database record + its photos in Storage.
 * (The old version only hid the card on screen.)
 */
async function deleteListing(listingId) {
    var p = myListingsCache.filter(function (x) { return x.id === listingId; })[0];
    if (!p) return;
    if (!myListingsUid) { listingNotify('Please sign in again', 'error'); return; }

    var title = p.title || 'this listing';

    // Anything that would be hurt by deleting it? Tell the seller before they commit.
    var warnings = [];
    var liveAuction = null;
    try {
        var aSnap = await firebaseDB.collection('auctions').where('productId', '==', listingId).get();
        aSnap.forEach(function (d) {
            var a = d.data();
            if (a.status === 'live' || a.status === 'scheduled') liveAuction = { id: d.id, data: a };
        });
    } catch (e) { /* auctions are optional */ }

    if (liveAuction) {
        var bids = liveAuction.data.bidCount || 0;
        warnings.push('This item is in a ' + liveAuction.data.status.toUpperCase() + ' auction' +
            (bids ? ' with ' + bids + ' bid(s)' : '') + '. Removing it will CANCEL that auction.');
    }

    var orderCount = 0;
    try {
        var oSnap = await firebaseDB.collection('orders').where('productId', '==', listingId).limit(50).get();
        orderCount = oSnap.size;
    } catch (e) { /* orders collection may not allow this query — ignore */ }
    if (orderCount) {
        warnings.push('It has ' + orderCount + ' order(s). The orders and their records stay, but the listing disappears from the marketplace.');
    }

    var message = 'Remove "' + title + '"?\n\nIt will be deleted from the marketplace and its photos and video removed.\n' +
        'Chats about it stay available.\n\nThis cannot be undone.';
    if (warnings.length) message = 'Remove "' + title + '"?\n\n' + warnings.join('\n') + '\n\nThis cannot be undone.';
    if (!confirm(message)) return;

    var card = document.querySelector('.listing-card[data-id="' + listingId + '"]');
    if (card) { card.style.opacity = '0.5'; card.style.pointerEvents = 'none'; }

    try {
        // 1) cancel the auction first so bidders are not left waiting
        if (liveAuction) {
            await firebaseDB.collection('auctions').doc(liveAuction.id)
                .update({ status: 'cancelled', cancelledAt: firebase.firestore.FieldValue.serverTimestamp() })
                .catch(function (e) { console.warn('Could not cancel auction', e); });
        }

        // 2) delete the listing's photos and attached video from Storage (best effort)
        var removedFiles = await deleteListingFiles(p);

        // 3) delete the listing record itself
        await firebaseDB.collection('products').doc(listingId).delete();

        myListingsCache = myListingsCache.filter(function (x) { return x.id !== listingId; });
        renderMyListings();
        listingNotify('Listing removed' + (removedFiles ? ' (with ' + removedFiles + ' media file' + (removedFiles === 1 ? '' : 's') + ')' : '')
            + (liveAuction ? ' — its auction was cancelled' : ''), 'success');
    } catch (err) {
        console.error('Remove listing failed:', err);
        if (card) { card.style.opacity = ''; card.style.pointerEvents = ''; }
        listingNotify('Could not remove the listing: ' + (err.message || err), 'error');
    }
}

/**
 * Delete the product's pictures and listing video from Firebase Storage.
 * Only files in the seller's own folder are removed; legacy or foreign paths are skipped.
 */
async function deleteListingFiles(p) {
    if (typeof firebase === 'undefined' || !firebase.storage) return 0;
    var urls = []
        .concat(p.imagesThumb || [], p.images || [], p.photos || [])
        .filter(function (u) { return typeof u === 'string' && u.indexOf('firebasestorage') !== -1; });
    var unique = urls.filter(function (u, i) { return urls.indexOf(u) === i; });
    var deleted = 0;
    for (var i = 0; i < unique.length; i++) {
        try {
            var ref = firebase.storage().refFromURL(unique[i]);
            await ref.delete();
            deleted++;
        } catch (e) {
            // permission (file belongs to an older folder) or already missing — safe to skip
        }
    }
    var videoPath = String(p.videoStoragePath || '');
    if (videoPath && myListingsUid && videoPath.indexOf('products/' + myListingsUid + '/videos/') === 0){
        try{ await firebase.storage().ref().child(videoPath).delete(); deleted++; }catch(e){}
    }
    return deleted;
}

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled “classic” <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.listingEscape = listingEscape;
window.listingThumb = listingThumb;
window.listingStatusOf = listingStatusOf;
window.listingStatusLabel = listingStatusLabel;
window.listingStatusClass = listingStatusClass;
window.listingDate = listingDate;
window.listingNotify = listingNotify;
window.loadMyListings = loadMyListings;
window.showSignedInAs = showSignedInAs;
window.fetchMyListings = fetchMyListings;
window.myListingsFiltered = myListingsFiltered;
window.renderMyListings = renderMyListings;
window.updateMyListingStats = updateMyListingStats;
window.updateFilterTabCounts = updateFilterTabCounts;
window.initListingFilters = initListingFilters;
window.editUserListing = editUserListing;
window.closeUserListingEditModal = closeUserListingEditModal;
window.buildSellerListingEditPatch = buildSellerListingEditPatch;
window.uploadSellerListingPhotos = uploadSellerListingPhotos;
window.toggleListingSold = toggleListingSold;
window.deleteListing = deleteListing;
window.deleteListingFiles = deleteListingFiles;

