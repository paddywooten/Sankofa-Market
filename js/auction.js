/**
 * Sankofa Market - Auction System (Premium Only)
 * Premium sellers can trigger blinking amber/red auction alerts; commission is admin-configured
 */

window._pendingWinnerOrders = window._pendingWinnerOrders || new Set();
var AUCTION_WARNING_SECONDS_DEFAULT = 120; // 2 minutes default - now customizable per auction

// Firestore auction rules require optional prices to be numbers. Store 0 when
// the seller leaves either optional field blank (never null).
function auctionOptionalPrice(value) {
    var n = Number(value);
    return isFinite(n) && n > 0 ? n : 0;
}

function isPremiumAuctionUser(userData){
    if (!userData) return false;
    // Admin can always auction (no premium needed) — per request admin must be able to start auctions
    if (userData.role === 'admin') return true;
    if (userData.isPremium !== true) return false;
    if (userData.premiumExpiry){
        var exp = userData.premiumExpiry.toDate ? userData.premiumExpiry.toDate() : new Date(userData.premiumExpiry);
        if (exp <= new Date()) return false;
    }
    return true;
}

function getAuctionStatus(auction, nowMs){
    nowMs = nowMs || Date.now();
    var startMs = auction.startAt ? (auction.startAt.toMillis ? auction.startAt.toMillis() : new Date(auction.startAt).getTime()) : (auction.startAtMs||0);
    var endMs = auction.endAt ? (auction.endAt.toMillis ? auction.endAt.toMillis() : new Date(auction.endAt).getTime()) : (auction.endAtMs||0);
    if (auction.status === 'cancelled') return 'cancelled';
    if (auction.status === 'ended') return 'ended';
    if (endMs && nowMs >= endMs) return 'ended';
    if (auction.status === 'scheduled' && nowMs < startMs) return 'scheduled';
    if (auction.status === 'live' || (nowMs >= startMs && nowMs < endMs)) return 'live';
    if (nowMs < startMs) return 'scheduled';
    return 'live';
}

function formatAuctionCountdown(ms){
    if (ms <= 0) return '00:00';
    var totalSec = Math.floor(ms/1000);
    var days = Math.floor(totalSec/86400);
    var hours = Math.floor((totalSec%86400)/3600);
    var mins = Math.floor((totalSec%3600)/60);
    var secs = totalSec%60;
    if (days>0) return days+'d '+String(hours).padStart(2,'0')+':'+String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');
    if (hours>0) return String(hours).padStart(2,'0')+':'+String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');
    return String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');
}

function escapeHtml(s){ var d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

// ============================================================================
// LISTING PAGE - auction.html
// ============================================================================

var _listingUnsub = null;
function initAuctionListing(){
    // Resolve the viewer's real role early — it decides whether Remove buttons show
    try{ resolveAuctionAdmin(function(){}); }catch(e){}
    var liveGrid = document.getElementById('liveAuctionsGrid');
    var upcomingGrid = document.getElementById('upcomingAuctionsGrid');
    var endedGrid = document.getElementById('endedAuctionsGrid');
    var emptyEl = document.getElementById('auctionEmpty');
    if (!liveGrid) return;

    // Safety: if still loading after 7s, force fallback UI so page never looks stuck
    var loadingTimeout = setTimeout(function(){
        if (liveGrid && liveGrid.innerHTML.indexOf('Loading') !== -1){
            liveGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem 1rem;background:#fff;border:1px solid #fecaca;border-radius:12px;color:#991b1b;"><i class="fas fa-exclamation-triangle" style="font-size:1.6rem;"></i><p style="margin:0.6rem 0 0;font-weight:700;">Taking too long to load</p><p style="margin:0.3rem 0 0;font-size:0.82rem;color:#6b7280;">Check your connection or Firestore permissions.<br>This can happen if Firestore is offline or the auctions index is missing.</p><button onclick="initAuctionListing()" style="margin-top:0.9rem;background:#0064d2;color:#fff;border:none;padding:0.55rem 1rem;border-radius:8px;font-weight:700;cursor:pointer;"><i class="fas fa-sync"></i> Retry</button> <a href="pages/user/create-auction.html" style="display:inline-block;margin-top:0.9rem;margin-left:0.4rem;background:#f5af02;color:#191919;padding:0.55rem 1rem;border-radius:8px;font-weight:800;text-decoration:none;font-size:0.82rem;">Start Auction</a></div>';
            // Try one-time get as last resort (bypasses onSnapshot cache)
            try{
                firebaseDB.collection('auctions').limit(50).get().then(function(snap2){
                    var live=[], scheduled=[], ended=[]; var now=Date.now();
                    snap2.forEach(function(doc){ var a=doc.data(); a._id=doc.id; var st=getAuctionStatus(a,now); if(st==='live') live.push(a); else if(st==='scheduled') scheduled.push(a); else ended.push(a); });
                    window._auctionListingSnapshot = { live: live, scheduled: scheduled, ended: ended };
                    renderLiveAuctions(live, liveGrid);
                    renderUpcomingAuctions(scheduled, upcomingGrid);
                    renderEndedAuctions(ended, endedGrid);
                    if (emptyEl) emptyEl.style.display = (live.length===0 && scheduled.length===0 && ended.length===0) ? 'block' : 'none';
                    var cLive=document.getElementById('countLive'); if(cLive) cLive.textContent=live.length;
                    var cUp=document.getElementById('countUpcoming'); if(cUp) cUp.textContent=scheduled.length;
                    var cEnd=document.getElementById('countEnded'); if(cEnd) cEnd.textContent=ended.length;
                }).catch(function(e){ console.warn('auction get fallback failed', e); });
            }catch(e){}
        }
    }, 7000);

    function render(){
        if (typeof firebaseDB === 'undefined' || !firebaseDB) {
            setTimeout(render, 800);
            return;
        }
        if (_listingUnsub) try{ _listingUnsub(); }catch(e){}
        // Use startAtMs (client timestamp) for ordering to avoid serverTimestamp pending delay (auction would not appear for ~2min if waiting)
        _listingUnsub = firebaseDB.collection('auctions').orderBy('startAtMs','desc').limit(50).onSnapshot(function(snap){
            var live=[], scheduled=[], ended=[];
            var now = Date.now();
            snap.forEach(function(doc){
                var a = doc.data(); a._id = doc.id;
                // Skip locally deleted (optimistic) until snapshot confirms
                try{ if(localStorage.getItem('deleted_auction_' + a._id)) return; }catch(e){}
                var st = getAuctionStatus(a, now);
                if (st==='live') live.push(a);
                else if (st==='scheduled') scheduled.push(a);
                else ended.push(a);
            });
            // Sort live by endAt ascending (ending soonest first), scheduled by startAt
            live.sort(function(a,b){
                var ae = a.endAt ? (a.endAt.toMillis?a.endAt.toMillis():new Date(a.endAt).getTime()) : 0;
                var be = b.endAt ? (b.endAt.toMillis?b.endAt.toMillis():new Date(b.endAt).getTime()) : 0;
                return ae-be;
            });
            scheduled.sort(function(a,b){
                var as = a.startAt ? (a.startAt.toMillis?a.startAt.toMillis():new Date(a.startAt).getTime()) : 0;
                var bs = b.startAt ? (b.startAt.toMillis?b.startAt.toMillis():new Date(b.startAt).getTime()) : 0;
                return as-bs;
            });
            // Loaded successfully — cancel loading timeout
            clearTimeout(loadingTimeout);
            window._auctionListingSnapshot = { live: live, scheduled: scheduled, ended: ended };
            renderLiveAuctions(live, liveGrid);
            renderUpcomingAuctions(scheduled, upcomingGrid);
            renderEndedAuctions(ended, endedGrid);
            if (live.length===0 && scheduled.length===0 && ended.length===0){
                if (emptyEl) emptyEl.style.display='block';
            } else if (emptyEl) emptyEl.style.display='none';
            // update counts
            var cLive = document.getElementById('countLive'); if (cLive) cLive.textContent = live.length;
            var cUp = document.getElementById('countUpcoming'); if (cUp) cUp.textContent = scheduled.length;
            var cEnd = document.getElementById('countEnded'); if (cEnd) cEnd.textContent = ended.length;
        }, function(err){
            clearTimeout(loadingTimeout);
            console.warn('Auction listing error (orderBy startAtMs), trying fallback', err);
            // Fallback without orderBy (in case old docs lack startAtMs)
            try{
                if (_listingUnsub) try{ _listingUnsub(); }catch(e){}
                _listingUnsub = firebaseDB.collection('auctions').limit(50).onSnapshot(function(snap2){
                    var live=[], scheduled=[], ended=[];
                    var now = Date.now();
                    snap2.forEach(function(doc){
                        var a = doc.data(); a._id = doc.id;
                        try{ if(localStorage.getItem('deleted_auction_' + a._id)) return; }catch(e){}
                        var st = getAuctionStatus(a, now);
                        if (st==='live') live.push(a);
                        else if (st==='scheduled') scheduled.push(a);
                        else ended.push(a);
                    });
                    live.sort(function(a,b){ var ae = a.endAt ? (a.endAt.toMillis?a.endAt.toMillis():new Date(a.endAt).getTime()) : 0; var be = b.endAt ? (b.endAt.toMillis?b.endAt.toMillis():new Date(b.endAt).getTime()) : 0; return ae-be; });
                    scheduled.sort(function(a,b){ var as = a.startAt ? (a.startAt.toMillis?a.startAt.toMillis():new Date(a.startAt).getTime()) : 0; var bs = b.startAt ? (b.startAt.toMillis?b.startAt.toMillis():new Date(b.startAt).getTime()) : 0; return as-bs; });
                    clearTimeout(loadingTimeout);
                    window._auctionListingSnapshot = { live: live, scheduled: scheduled, ended: ended };
                    renderLiveAuctions(live, liveGrid);
                    renderUpcomingAuctions(scheduled, upcomingGrid);
                    renderEndedAuctions(ended, endedGrid);
                    if (live.length===0 && scheduled.length===0 && ended.length===0){
                        if (emptyEl) emptyEl.style.display='block';
                    } else if (emptyEl) emptyEl.style.display='none';
                    var cLive = document.getElementById('countLive'); if (cLive) cLive.textContent = live.length;
                    var cUp = document.getElementById('countUpcoming'); if (cUp) cUp.textContent = scheduled.length;
                    var cEnd = document.getElementById('countEnded'); if (cEnd) cEnd.textContent = ended.length;
                });
            }catch(e2){ clearTimeout(loadingTimeout); if (liveGrid) liveGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;background:#fff;border:1px solid #fecaca;border-radius:12px;color:#991b1b;"><i class="fas fa-exclamation-triangle"></i><p style="margin:0.6rem 0 0;font-weight:700;">Error loading auctions</p><p style="font-size:0.82rem;color:#6b7280;">'+escapeHtml(err.message)+'</p><button onclick="initAuctionListing()" style="margin-top:0.9rem;background:#0064d2;color:#fff;border:none;padding:0.55rem 1rem;border-radius:8px;font-weight:700;cursor:pointer;">Retry</button></div>'; }
        });
        // Re-render ended when auth loads (so Delete appears on phone even if first render was before auth)
        if (typeof firebaseAuth !== 'undefined' && firebaseAuth.onAuthStateChanged){
            firebaseAuth.onAuthStateChanged(function(user){
                setTimeout(function(){
                    var cached = window._auctionListingSnapshot;
                    if (cached) {
                        if (liveGrid) renderLiveAuctions(cached.live || [], liveGrid);
                        if (upcomingGrid) renderUpcomingAuctions(cached.scheduled || [], upcomingGrid);
                    }
                    if (window._lastEndedList && window._lastEndedList.length){
                        var c = document.getElementById('endedAuctionsGrid');
                        if (c) renderEndedAuctions(window._lastEndedList, c);
                    }
                }, 600);
            });
        }
        // Periodic refresh for listing (every 15s) to fix phone showing deleted via cache after desktop delete)
        setInterval(function(){
            if (window._lastEndedList){
                // Filter out any locally deleted that may have been missed on this device
                var before = window._lastEndedList.length;
                var filtered = window._lastEndedList.filter(function(a){ try{ return !localStorage.getItem('deleted_auction_' + a._id); }catch(e){ return true; } });
                if (filtered.length !== before){
                    var c = document.getElementById('endedAuctionsGrid');
                    if (c) renderEndedAuctions(filtered, c);
                }
            }
        }, 8000);
        // Tick countdowns every second
        setInterval(function(){
            document.querySelectorAll('[data-countdown]').forEach(function(el){
                var target = parseInt(el.getAttribute('data-countdown'),10);
                var label = el.getAttribute('data-label') || '';
                var now = Date.now();
                var diff = target - now;
                if (diff <= 0){
                    if (label==='start') el.textContent = 'Starting...';
                    else el.textContent = 'Ended';
                    el.style.background = '#e5e7eb'; el.style.color='#767676';
                } else {
                    el.textContent = formatAuctionCountdown(diff) + (label==='start' ? ' to start' : ' left');
                }
            });
        }, 1000);
    }
    render();
}

function auctionViewerUid() {
    try {
        var u = (typeof firebaseAuth !== 'undefined' && firebaseAuth && firebaseAuth.currentUser) ? firebaseAuth.currentUser : null;
        if (!u && typeof firebase !== 'undefined' && firebase.auth) u = firebase.auth().currentUser;
        if (!u && window.currentUser) u = window.currentUser;
        if (!u && window.userData) u = { uid: window.userData.uid || window.userData.userId || window.userData.id };
        return u && (u.uid || u.userId || u.id) ? String(u.uid || u.userId || u.id) : '';
    } catch (e) { return ''; }
}
function auctionBelongsToViewer(auction) {
    var uid = auctionViewerUid();
    return !!uid && !!(auction && auction.sellerId) && uid === String(auction.sellerId);
}

function renderLiveAuctions(list, container){
    if (!container) return;
    if (list.length===0){
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem 1rem;background:#fff;border:1px dashed #e5e7eb;border-radius:12px;color:#5a6572;"><i class="fas fa-gavel" style="font-size:2rem;color:#cbd5e1;display:block;margin-bottom:0.6rem;"></i><p style="margin:0;font-weight:600;">No live auctions right now</p><p style="margin:0.3rem 0 0;font-size:0.82rem;">Premium sellers start auctions - you\'ll see a blinking red banner when one goes live!</p><a href="pages/user/create-auction.html" style="display:inline-block;margin-top:0.9rem;background:linear-gradient(135deg,#f5af02 0%,#e09e00 100%);color:#191919;padding:0.6rem 1.1rem;border-radius:8px;font-weight:800;text-decoration:none;font-size:0.85rem;"><i class="fas fa-crown"></i> Go Premium to Auction</a></div>';
        return;
    }
    var html='';
    list.forEach(function(a){
        var img = (a.images && a.images[0]) || a.productImage || '/images/placeholders/avatar.svg';
        var now=Date.now();
        var endMs = a.endAt ? (a.endAt.toMillis?a.endAt.toMillis():new Date(a.endAt).getTime()) : now+600000;
        var diff = endMs - now;
        var bid = a.currentBid || a.startingPrice || 0;
        var bids = a.bidCount || 0;
        var seller = a.sellerName || 'Premium Seller';
        var _cardBin = (Number(a.buyNowPrice) > 0 && !a.currentBidderId) ? Number(a.buyNowPrice) : 0;
        var _cardOwn = auctionBelongsToViewer(a);
        html += '<div class="auction-card live" onclick="window.location.href=\'auction-detail.html?id='+a._id+'\'" style="cursor:pointer;background:#fff;border-radius:14px;overflow:hidden;border:2px solid #fecaca;box-shadow:0 6px 20px rgba(239,68,68,0.12);position:relative;">'
            + '<div style="position:absolute;top:10px;left:10px;background:#ef4444;color:#fff;padding:0.2rem 0.6rem;border-radius:999px;font-size:0.68rem;font-weight:800;letter-spacing:0.06em;display:flex;align-items:center;gap:0.3rem;z-index:2;animation: auctionDotLive 1s infinite;"><span style="width:7px;height:7px;border-radius:50%;background:#fff;display:inline-block;"></span> LIVE NOW</div>'
            + '<div style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.75);color:#fff;padding:0.3rem 0.6rem;border-radius:999px;font-size:0.72rem;font-weight:800;backdrop-filter:blur(6px);z-index:2;" data-countdown="'+endMs+'" data-label="end">'+formatAuctionCountdown(diff)+' left</div>'
            + '<img src="'+escapeHtml(img)+'" alt="'+escapeHtml(a.title||'Auction')+'" style="width:100%;height:180px;object-fit:cover;" loading="lazy" onerror="this.src=\'/images/placeholders/avatar.svg\'">'
            + '<div style="padding:0.9rem 1rem 1rem;">'
            + '<h3 style="margin:0;font-size:0.95rem;font-weight:800;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+escapeHtml(a.title||'Untitled Auction')+'</h3>'
            + '<div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.35rem;font-size:0.75rem;color:#5a6572;"><i class="fas fa-crown" style="color:#f59e0b;" title="Premium seller"></i> '+escapeHtml(seller)+' <span style="background:#fef3c7;color:#92400e;padding:0.1rem 0.35rem;border-radius:999px;font-size:0.65rem;font-weight:700;border:1px solid #fde68a;">PREMIUM</span></div>'
            + '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-top:0.7rem;">'
            + '<div><div style="font-size:0.68rem;color:#5a6572;font-weight:600;letter-spacing:0.04em;">CURRENT BID</div><div style="font-size:1.25rem;font-weight:800;color:#dc2626;">GHS '+bid.toLocaleString()+'</div><div style="font-size:0.7rem;color:#5a6572;">'+bids+' bid'+(bids!==1?'s':'')+' • Min +GHS '+(a.bidIncrement||10)+'</div>'+(_cardBin ? '<div style="margin-top:0.3rem;display:inline-flex;align-items:center;gap:0.25rem;background:#faf5ff;border:1px solid #ddd6fe;color:#7c3aed;padding:0.15rem 0.5rem;border-radius:999px;font-size:0.65rem;font-weight:800;"><i class="fas fa-tag"></i> Buy It Now · GHS '+_cardBin.toLocaleString()+'</div>' : '')+'</div>'
            + '<button onclick="event.stopPropagation();window.location.href=\'auction-detail.html?id='+a._id+'\'" style="'+(_cardOwn?'background:#fff;border:1.5px solid #fecaca;color:#991b1b;':'background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;border:none;')+'padding:0.65rem 1rem;border-radius:10px;font-weight:800;font-size:0.82rem;cursor:pointer;box-shadow:0 4px 12px rgba(239,68,68,0.3);"><i class="fas '+(_cardOwn?'fa-eye':'fa-gavel')+'"></i> '+(_cardOwn?'View Your Auction':'Bid Now')+'</button>'
            + '</div></div></div>';
    });
    container.innerHTML = html;
}

function renderUpcomingAuctions(list, container){
    if (!container) return;
    if (list.length===0){
        container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#5f6b7a;font-size:0.85rem;padding:1.2rem;background:#f8fafc;border-radius:10px;border:1px dashed #e2e8f0;">No upcoming auctions. When a Premium seller triggers an auction, you\'ll see a blinking <span style="background:#f59e0b;color:#fff;padding:0.1rem 0.35rem;border-radius:4px;font-weight:700;">amber</span> alert in the header!</p>';
        return;
    }
    var html='';
    list.forEach(function(a){
        var img = (a.images && a.images[0]) || a.productImage || '/images/placeholders/avatar.svg';
        var now=Date.now();
        var startMs = a.startAt ? (a.startAt.toMillis?a.startAt.toMillis():new Date(a.startAt).getTime()) : now+120000;
        var diff = startMs - now;
        var _cardOwn = auctionBelongsToViewer(a);
        html += '<div class="auction-card scheduled" onclick="window.location.href=\'auction-detail.html?id='+a._id+'\'" style="cursor:pointer;background:#fff;border-radius:14px;overflow:hidden;border:1.5px solid #fde68a;box-shadow:0 4px 14px rgba(245,158,11,0.08);position:relative;">'
            + '<div style="position:absolute;top:10px;left:10px;background:#f59e0b;color:#fff;padding:0.2rem 0.6rem;border-radius:999px;font-size:0.68rem;font-weight:800;letter-spacing:0.06em;display:flex;align-items:center;gap:0.3rem;z-index:2;"><i class="fas fa-clock"></i> STARTING SOON</div>'
            + '<div style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.7);color:#fff;padding:0.3rem 0.6rem;border-radius:999px;font-size:0.72rem;font-weight:800;z-index:2;" data-countdown="'+startMs+'" data-label="start">'+formatAuctionCountdown(diff)+' to start</div>'
            + '<img src="'+escapeHtml(img)+'" style="width:100%;height:160px;object-fit:cover;" loading="lazy" onerror="this.src=\'/images/placeholders/avatar.svg\'">'
            + '<div style="padding:0.85rem 1rem 1rem;">'
            + '<h3 style="margin:0;font-size:0.9rem;font-weight:700;line-height:1.3;">'+escapeHtml(a.title||'Untitled')+'</h3>'
            + '<div style="margin-top:0.3rem;font-size:0.75rem;color:#5a6572;">by '+escapeHtml(a.sellerName||'Premium Seller')+'</div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.6rem;">'
            + '<div><div style="font-size:0.68rem;color:#5a6572;font-weight:600;">STARTS AT</div><div style="font-size:0.95rem;font-weight:800;color:#d97706;">GHS '+(a.startingPrice||0).toLocaleString()+'</div></div>'
            + '<button onclick="event.stopPropagation();window.location.href=\'auction-detail.html?id='+a._id+'\'" style="background:#fff;border:1.5px solid '+(_cardOwn?'#fecaca':'#f59e0b')+';color:'+(_cardOwn?'#991b1b':'#92400e')+';padding:0.5rem 0.85rem;border-radius:8px;font-weight:700;font-size:0.78rem;cursor:pointer;"><i class="fas fa-eye"></i> '+(_cardOwn?'View Your Auction':'View & Wait')+'</button>'
            + '</div></div></div>';
    });
    container.innerHTML = html;
}


// ============================================================================
// ADMIN / PERMISSION HELPERS FOR AUCTION CONTROLS
// window.userData is not always loaded when a list first renders, which used to
// hide the Delete button for admins. This resolves the real role once and caches it.
// ============================================================================
window._auctionIsAdmin = false;
window._auctionAdminChecked = false;

function resolveAuctionAdmin(callback) {
    if (window._auctionAdminChecked) { if (callback) callback(window._auctionIsAdmin); return; }
    function finish(isAdmin) {
        window._auctionIsAdmin = isAdmin;
        window._auctionAdminChecked = true;
        if (callback) callback(isAdmin);
    }
    try {
        if (window.userData && window.userData.role === 'admin') { finish(true); return; }
        var auth = (typeof firebaseAuth !== 'undefined' && firebaseAuth) ? firebaseAuth : (window.firebase && firebase.auth ? firebase.auth() : null);
        var user = auth && auth.currentUser;
        if (!user) { finish(false); return; }
        // 1) custom claim (no read needed)
        user.getIdTokenResult().then(function (res) {
            if (res && res.claims && res.claims.admin === true) { finish(true); return; }
            // 2) fall back to the users document
            if (typeof firebaseDB === 'undefined' || !firebaseDB) { finish(false); return; }
            firebaseDB.collection('users').doc(user.uid).get().then(function (doc) {
                finish(!!(doc.exists && doc.data().role === 'admin'));
            }).catch(function () { finish(false); });
        }).catch(function () {
            if (typeof firebaseDB === 'undefined' || !firebaseDB) { finish(false); return; }
            firebaseDB.collection('users').doc(user.uid).get().then(function (doc) {
                finish(!!(doc.exists && doc.data().role === 'admin'));
            }).catch(function () { finish(false); });
        });
    } catch (e) { finish(false); }
}

/** Can the signed-in user remove this auction? (seller or admin) */
function canRemoveAuction(auction) {
    var current = (typeof firebaseAuth !== 'undefined' && firebaseAuth && firebaseAuth.currentUser)
        ? firebaseAuth.currentUser
        : (window.currentUser || (window.userData && window.userData.uid ? { uid: window.userData.uid } : null));
    if (!current) return false;
    if (current.uid === auction.sellerId) return true;
    return window._auctionIsAdmin === true;
}

function renderEndedAuctions(list, container){
    if (!container) return;
    if (list.length===0){
        container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#5f6b7a;font-size:0.82rem;padding:1rem;">No ended auctions yet.</p>';
        return;
    }
    // Filter out locally deleted (optimistic) so it doesn't reappear before snapshot
    list = list.filter(function(a){ try{ return !localStorage.getItem('deleted_auction_' + a._id); }catch(e){ return true; } });
    // Show last 6 ended — with delete for owner/admin (visible on phone)
    var _cuDel = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser : null);
    if (!_cuDel && window.currentUser) _cuDel = window.currentUser;
    if (!_cuDel && window.userData && window.userData.uid) _cuDel = {uid: window.userData.uid};
    var _isAdminDel = window._auctionIsAdmin === true;
    // Cache for auth re-render
    window._lastEndedList = list.slice(0,12);
    // Resolve the real role once; when it turns out we ARE an admin, redraw so the
    // Delete buttons appear even if window.userData had not loaded yet.
    if (!window._auctionAdminChecked) {
        resolveAuctionAdmin(function (isAdmin) {
            if (isAdmin) {
                var c = document.getElementById('endedAuctionsGrid');
                if (c && window._lastEndedList) renderEndedAuctions(window._lastEndedList, c);
            }
        });
    }
    var html='';
    list.slice(0,12).forEach(function(a){
        var img = (a.images && a.images[0]) || a.productImage || '/images/placeholders/avatar.svg';
        var winner = a.currentBidderName ? 'Won by '+a.currentBidderName : (a.bidCount? 'Bidding closed' : 'No bids');
        var finalBid = a.currentBid || a.startingPrice || 0;
        var canDelete = _cuDel && (_cuDel.uid === a.sellerId || _isAdminDel);
        html += '<div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;opacity:0.95;position:relative;cursor:pointer;display:flex;flex-direction:column;" onclick="window.location.href=\'auction-detail.html?id='+a._id+'\'">'
            + (canDelete ? '<button onclick="event.stopPropagation(); deleteAuction(\''+a._id+'\')" title="Delete" style="position:absolute;top:6px;right:6px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.96);border:1.5px solid #fecaca;color:#dc2626;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;box-shadow:0 2px 6px rgba(0,0,0,0.1);"><i class="fas fa-trash" style="font-size:0.75rem;"></i></button>' : '')
            + '<img src="'+escapeHtml(img)+'" style="width:100%;height:130px;object-fit:cover;filter:grayscale(0.2);flex-shrink:0;" loading="lazy">'
            + '<div style="padding:0.7rem 0.85rem;flex:1;display:flex;flex-direction:column;">'
            + '<div style="font-size:0.8rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escapeHtml(a.title||'Auction')+'</div>'
            + '<div style="font-size:0.7rem;color:#5a6572;margin-top:0.15rem;">'+escapeHtml(winner)+'</div>'
            + '<div style="margin-top:0.4rem;display:flex;justify-content:space-between;align-items:center;"><span style="font-weight:800;color:#374151;">GHS '+finalBid.toLocaleString()+'</span><span style="font-size:0.65rem;background:#f3f4f6;color:#374151;padding:0.15rem 0.4rem;border-radius:999px;font-weight:700;border:1px solid #e5e7eb;">ENDED</span></div>'
            + (canDelete
                ? '<button onclick="event.stopPropagation(); deleteAuction(\''+a._id+'\')" style="margin-top:0.6rem;width:100%;background:#fef2f2;border:1.5px solid #fecaca;color:#991b1b;padding:0.55rem;border-radius:8px;font-weight:700;font-size:0.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.35rem;"><i class="fas fa-trash"></i> Remove</button>'
                : '<div style="margin-top:0.5rem;font-size:0.65rem;color:#9ca3af;text-align:center;">Time to remove' + (window._auctionAdminChecked ? ' — only the seller or an admin can' : '') + '</div>')
            + '</div></div>';
    });
    // Clear ended button for seller/admin if any ended belongs to them
    var hasOwnEnded = _cuDel && list.some(function(a){ return a.sellerId===_cuDel.uid || _isAdminDel; });
    if (hasOwnEnded && list.length>0){
        html += '<div style="grid-column:1/-1;display:flex;justify-content:center;padding-top:0.4rem;"><button onclick="clearEndedAuctions()" style="background:#fff;border:1.5px solid #fecaca;color:#991b1b;padding:0.5rem 0.9rem;border-radius:8px;font-weight:700;font-size:0.78rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.35rem;"><i class="fas fa-trash-alt"></i> Clear my ended ('+ list.filter(function(a){ return _isAdminDel || a.sellerId===_cuDel.uid; }).length +')</button></div>';
    }
    container.innerHTML = html;
}

// ============================================================================
// DETAIL PAGE - auction-detail.html
// ============================================================================

var _detailUnsub = null;
var _bidsUnsub = null;
var _currentAuction = null;
var _currentAuctionId = null;
var _detailTick = null;
var _waitlistUnsub = null;
var _waitlistCache = [];
var _detailAuthUnsub = null;
var _chatUnsub = null;
var _chatCache = [];

function initAuctionDetail(){
    // Resolve the viewer's real role early — it decides whether Remove buttons show
    try{ resolveAuctionAdmin(function(){}); }catch(e){}
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    if (!id){
        var el = document.getElementById('auctionDetailRoot');
        if (el) el.innerHTML = '<div style="text-align:center;padding:3rem 1rem;"><i class="fas fa-exclamation-triangle" style="font-size:2.5rem;color:#f59e0b;"></i><h2 style="margin-top:1rem;">No auction selected</h2><p style="color:#5a6572;">Go to <a href="auction.html" style="color:#0064d2;font-weight:700;">Auctions</a> to see live auctions.</p></div>';
        return;
    }
    _currentAuctionId = id;
    if (typeof firebaseDB === 'undefined' || !firebaseDB){ setTimeout(initAuctionDetail, 700); return; }

    var root = document.getElementById('auctionDetailRoot');
    if (root) root.innerHTML = '<div style="text-align:center;padding:3rem;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#0064d2;"></i><p style="color:#5a6572;margin-top:0.8rem;">Loading auction...</p></div>';

    // Clean previous listeners
    if (_detailUnsub) try{ _detailUnsub(); }catch(e){}
    if (_bidsUnsub) try{ _bidsUnsub(); }catch(e){}
    if (_waitlistUnsub) try{ _waitlistUnsub(); }catch(e){}
    if (_chatUnsub) try{ _chatUnsub(); }catch(e){}
    if (_detailTick) clearInterval(_detailTick);
    if (_detailAuthUnsub) try{ _detailAuthUnsub(); }catch(e){}
    window._endedStatusPushed = false;

    // Auth-aware re-render: when user signs out/in, re-render so "You won" persists after re-login
    function setupDetailAuthListener(){
        if (typeof firebaseAuth === 'undefined' || !firebaseAuth || !firebaseAuth.onAuthStateChanged){
            setTimeout(setupDetailAuthListener, 700);
            return;
        }
        _detailAuthUnsub = firebaseAuth.onAuthStateChanged(function(user){
            setTimeout(function(){
                if (_currentAuction){
                    console.log('🔐 Auth state changed — re-rendering auction detail. User:', user ? user.uid : 'signed out', '| winner:', _currentAuction.currentBidderId);
                    renderAuctionDetail(_currentAuction);
                    ensureAuctionWinnerOrder(_currentAuction);
                    updateWaitlistUI();
                }
            }, 350);
        });
    }
    setupDetailAuthListener();

    _detailUnsub = firebaseDB.collection('auctions').doc(id).onSnapshot({includeMetadataChanges:true}, function(doc){
        if (!doc.exists){
            if (root) root.innerHTML = '<div style="text-align:center;padding:3rem 1rem;"><h2>Auction not found</h2><p style="color:#5a6572;">It may have been removed.</p><a href="auction.html" class="btn btn-primary" style="margin-top:1rem;">Back to Auctions</a></div>';
            return;
        }
        _currentAuction = doc.data(); _currentAuction._id = doc.id;
        // Persist winner id in localStorage so win survives sign-out/in even before auth hydrates
        try{
            if (_currentAuction.currentBidderId && getAuctionStatus(_currentAuction, Date.now())==='ended'){
                localStorage.setItem('sm_last_won_' + _currentAuction._id, JSON.stringify({bidderId: _currentAuction.currentBidderId, at: Date.now()}));
            }
        }catch(e){}
        renderAuctionDetail(_currentAuction);
        // Auto-order: if ended, create order for highest bidder at bid price
        ensureAuctionWinnerOrder(_currentAuction);
        // Manage tick for countdown
        if (_detailTick) clearInterval(_detailTick);
        _detailTick = setInterval(function(){ if (_currentAuction) updateDetailCountdown(_currentAuction); }, 1000);
        updateDetailCountdown(_currentAuction);
    }, function(err){
        if (root) root.innerHTML = '<p style="color:#e74c3c;padding:2rem;text-align:center;">Error: '+escapeHtml(err.message)+'</p>';
    });

    // Waitlist listener - seller sees count (single)
    listenWaitlist(id);
    // Group chat for wait room → live
    listenAuctionChat(id);

    // Bids listener
    _bidsUnsub = firebaseDB.collection('auctions').doc(id).collection('bids').orderBy('createdAt','desc').limit(30).onSnapshot(function(snap){
        var bids=[];
        snap.forEach(function(d){ var b=d.data(); b._id=d.id; bids.push(b); });
        renderBidHistory(bids);
    });
}

function auctionBidNumbers(auction){
    auction = auction || {};
    var currentBid = Number(auction.currentBid);
    if (!isFinite(currentBid) || currentBid <= 0) currentBid = Number(auction.startingPrice) || 0;
    var increment = Number(auction.bidIncrement);
    if (!isFinite(increment) || increment <= 0) increment = 10;
    return { currentBid: currentBid, increment: increment, nextMin: currentBid + increment };
}

function refreshAuctionBidControls(auction, root){
    if (!auction || !root || !root.querySelector) return;
    var numbers = auctionBidNumbers(auction);
    var bidCount = Number(auction.bidCount) || 0;
    var currentEl = root.querySelector('#detailCurrentBid');
    var countEl = root.querySelector('#detailBidCountBadge');
    var historyCountEl = root.querySelector('#bidCountBadge');
    var timeCountEl = root.querySelector('#detailTimeBidCount');
    var nextMinEl = root.querySelector('#detailNextMin');
    var incrementEl = root.querySelector('#detailBidIncrement');
    var quickOne = root.querySelector('#bidQuickOne');
    var quickFive = root.querySelector('#bidQuickFive');
    var quickFifty = root.querySelector('#bidQuickFifty');
    var reservePill = root.querySelector('#auctionReservePill');
    var buyNowPanel = root.querySelector('#buyNowPanel');
    var input = root.querySelector('#bidAmountInput');

    if (currentEl) currentEl.textContent = numbers.currentBid.toLocaleString();
    if (countEl) countEl.textContent = bidCount + ' bids';
    if (historyCountEl) historyCountEl.textContent = bidCount;
    if (timeCountEl) timeCountEl.textContent = bidCount;
    if (nextMinEl) nextMinEl.textContent = numbers.nextMin.toLocaleString();
    if (incrementEl) incrementEl.textContent = numbers.increment;
    if (quickOne) quickOne.textContent = '+GHS ' + numbers.increment;
    if (quickFive) quickFive.textContent = '+GHS ' + (numbers.increment * 5);
    if (quickFifty) quickFifty.textContent = 'GHS ' + (numbers.currentBid + 50).toLocaleString();

    var viewerUid = typeof auctionViewerUid === 'function' ? auctionViewerUid() : null;
    var isAdminViewer = typeof window !== 'undefined' && window.userData && window.userData.role === 'admin';
    var isSellerView = (!!viewerUid && String(viewerUid) === String(auction.sellerId || '')) || !!isAdminViewer;
    var reserve = Number(auction.reservePrice) || 0;
    if (reservePill && reserve > 0){
        var reserveMet = numbers.currentBid >= reserve;
        reservePill.textContent = isSellerView
            ? '🛡️ Reserve GHS ' + reserve.toLocaleString() + (reserveMet ? ' — met ✓' : ' — not met yet')
            : (reserveMet ? '✓ Reserve met' : 'Reserve not met');
        if (reservePill.style){
            reservePill.style.background = reserveMet ? '#f0fdf4' : '#fffbeb';
            reservePill.style.color = reserveMet ? '#15803d' : '#92400e';
            reservePill.style.border = reserveMet ? '1px solid #bbf7d0' : '1px solid #fde68a';
        }
    }
    if (buyNowPanel && auction.currentBidderId){
        if (isSellerView){
            buyNowPanel.textContent = '⚡ Your Buy-It-Now price: GHS ' + (Number(auction.buyNowPrice) || 0).toLocaleString() + ' — off the table now that bids are in';
        } else if (buyNowPanel.parentNode){
            buyNowPanel.parentNode.removeChild(buyNowPanel);
        } else {
            buyNowPanel.style.display = 'none';
        }
    }

    if (input){
        input.placeholder = numbers.nextMin;
        input.min = numbers.nextMin;
        input.step = numbers.increment;
        var autoBidDefault = input.dataset ? Number(input.dataset.autoBidDefault) : NaN;
        var stillDefault = input.dataset && input.dataset.autoBidDefault !== ''
            && isFinite(autoBidDefault) && Number(input.value) === autoBidDefault;
        if (!String(input.value || '').trim() || stillDefault){
            input.value = numbers.nextMin;
            if (input.dataset) input.dataset.autoBidDefault = String(numbers.nextMin);
        }
    }
}

function renderAuctionDetail(a){
    var root = document.getElementById('auctionDetailRoot');
    if (!root) return;
    var now = Date.now();
    var status = getAuctionStatus(a, now);
    // Prevent flicker: if re-rendering same auction with same status and chat already exists, do partial update (don't destroy chat)
    var _prevStatus = root._lastStatus;
    var _hasChat = !!document.getElementById('auctionChatList');
    var _isSameAuction = _currentAuction && a._id === _currentAuction._id;
    var _canPartial = _hasChat && _isSameAuction && _prevStatus === status && status !== 'ended' && status !== 'cancelled';
    if (_canPartial){
        // Keep the live chat in place while refreshing every bidding control. Quick-bid
        // buttons calculate from _currentAuction at click time, so an old snapshot can
        // never send a bidder back to the previous price.
        refreshAuctionBidControls(a, root);
        _currentAuction = a;
        root._lastStatus = status;
        return;
    }
    root._lastStatus = status;
    var startMs = a.startAt ? (a.startAt.toMillis?a.startAt.toMillis():new Date(a.startAt).getTime()) : now;
    var endMs = a.endAt ? (a.endAt.toMillis?a.endAt.toMillis():new Date(a.endAt).getTime()) : now+600000;
    var img = (a.images && a.images[0]) || a.productImage || '/images/placeholders/product.svg';
    var imgs = a.images || (a.productImage ? [a.productImage] : [img]);
    var gallery = imgs.map(function(u,i){
        return '<img src="'+escapeHtml(u)+'" alt="Auction image '+(i+1)+'" style="width:100%;height:360px;object-fit:cover;border-radius:12px;'+(i===0?'':'display:none;')+'" id="mainAuctionImg" onerror="this.src=\'/images/placeholders/product.svg\'">';
    }).join('');
    var thumbs = imgs.length>1 ? '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;overflow-x:auto;padding-bottom:0.3rem;">'+imgs.map(function(u,i){
        return '<img src="'+escapeHtml(u)+'" onclick="document.getElementById(\'mainAuctionImg\').src=this.src" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:2px solid '+(i===0?'#0064d2':'#e5e7eb')+';cursor:pointer;flex-shrink:0;">';
    }).join('')+'</div>' : '';

    var badge = '';
    if (status==='live') badge = '<span style="background:#ef4444;color:#fff;padding:0.3rem 0.7rem;border-radius:999px;font-size:0.75rem;font-weight:800;letter-spacing:0.06em;display:inline-flex;align-items:center;gap:0.35rem;animation: auctionBlinkRed 0.7s infinite alternate;"><span style="width:8px;height:8px;border-radius:50%;background:#fff;display:inline-block;animation:auctionDotLive 1s infinite;"></span> LIVE NOW</span>';
    else if (status==='scheduled') badge = '<span style="background:#f59e0b;color:#fff;padding:0.3rem 0.7rem;border-radius:999px;font-size:0.75rem;font-weight:800;display:inline-flex;align-items:center;gap:0.35rem;"><i class="fas fa-clock"></i> STARTS SOON</span>';
    else if (status==='ended') badge = '<span style="background:#6b7280;color:#fff;padding:0.3rem 0.7rem;border-radius:999px;font-size:0.75rem;font-weight:800;">ENDED</span>';
    else badge = '<span style="background:#e5e7eb;color:#374151;padding:0.3rem 0.7rem;border-radius:999px;font-size:0.75rem;font-weight:700;">'+status.toUpperCase()+'</span>';

    var bidNumbers = auctionBidNumbers(a);
    var currentBid = bidNumbers.currentBid;
    var nextMin = bidNumbers.nextMin;
    var _cu = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser : null);
    // Fallback to window.userData / window.currentUser if firebaseAuth not yet ready
    if (!_cu && window.currentUser) _cu = window.currentUser;
    if (!_cu && window.userData && window.userData.uid) _cu = {uid: window.userData.uid};
    var _viewerAuctionUid = auctionViewerUid();
    var _isSeller = !!_viewerAuctionUid && _viewerAuctionUid === String(a.sellerId || '');
    // Admin can also act as seller for monitoring/cancel
    var _isAdmin = _cu && window.userData && window.userData.role === 'admin';
    if (!_isSeller && _isAdmin) _isSeller = true;
    var timeBox = '';
    if (status==='scheduled') timeBox = '<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:0.9rem;text-align:center;"><div style="font-size:0.7rem;font-weight:700;letter-spacing:0.06em;color:#92400e;">STARTS IN</div><div id="detailCountdown" style="font-size:1.6rem;font-weight:800;color:#d97706;margin-top:0.15rem;">--:--</div><div style="font-size:0.7rem;color:#92400e;margin-top:0.2rem;">Blinking amber alert is live in every header - invite friends!</div></div>';
    else if (status==='live') timeBox = '<div style="background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%);border:1.5px solid #fecaca;border-radius:10px;padding:0.9rem;text-align:center;"><div style="font-size:0.7rem;font-weight:700;letter-spacing:0.06em;color:#991b1b;">TIME LEFT</div><div id="detailCountdown" style="font-size:1.7rem;font-weight:800;color:#dc2626;margin-top:0.15rem;letter-spacing:0.04em;">--:--</div><div style="font-size:0.7rem;color:#991b1b;margin-top:0.2rem;"><i class="fas fa-users"></i> <span id="detailTimeBidCount">'+(a.bidCount||0)+'</span> bids • '+(_waitlistCache.length)+' waited • Be the highest to win!</div></div>';
    else if (status==='cancelled') {
        timeBox = '<div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:10px;padding:1rem;text-align:center;"><div style="font-weight:800;color:#991b1b;"><i class="fas fa-times-circle"></i> Auction Cancelled by Seller</div><div style="margin-top:0.3rem;color:#7f1d1d;font-size:0.85rem;">Seller felt waitlist not encouraging - apology sent to waitlist.</div></div>';
    } else if (status==='ended') {
        var _resMissX = a.reserveNotMet === true;
        var _binWonX = a.buyNowWon === true;
        var winner = _resMissX ? 'Reserve not met — no sale'
                   : _binWonX ? '🎉 Bought instantly via Buy-It-Now'
                   : (a.currentBidderName ? 'Won by <strong>'+escapeHtml(a.currentBidderName)+'</strong>' : 'No bids placed');
        var _isWinner = _cu && _cu.uid === a.currentBidderId;
        var _winnerOrderLink = a.winnerOrderId ? '<a href="pages/user/orders.html?order='+a.winnerOrderId+'" style="color:#0064d2;font-weight:700;">View Order</a>' : (a._id ? '<a href="pages/user/orders.html?auction='+a._id+'" style="color:#0064d2;font-weight:700;">View Order</a>' : '');
        timeBox = '<div style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:10px;padding:1rem;text-align:center;"><div style="font-weight:800;color:#374151;">Auction Ended</div><div style="margin-top:0.3rem;color:#6b7280;font-size:0.85rem;">'+winner+' - Final: <strong>GHS '+currentBid.toLocaleString()+'</strong></div>' + (_isWinner ? '<div style="margin-top:0.6rem;background:#f0fdf4;border:1px solid #bbf7d0;padding:0.5rem 0.7rem;border-radius:8px;"><span style="color:#15803d;font-weight:700;">🎉 You won! Order auto-placed • escrow protected</span> <span style="color:#166534;font-size:0.75rem;">Check Orders / Messages to pay & contact seller.</span></div>' : '') + '</div>';
    }

    var bidSection = '';
    if (status==='live'){
        // ---- premium auction tools (#8): reserve badge + Buy-It-Now panel ----
        var _hasBids = !!a.currentBidderId;
        var _resP = Number(a.reservePrice) || 0;
        var _binP = Number(a.buyNowPrice) || 0;
        var _detailReservePill = _resP > 0
            ? ' <span id="auctionReservePill" style="font-size:0.68rem;padding:0.15rem 0.45rem;border-radius:999px;font-weight:800;'
              + (currentBid >= _resP ? 'background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;">✓ Reserve met' : 'background:#fffbeb;color:#92400e;border:1px solid #fde68a;">Reserve not met')
              + (_isSeller ? ' (GHS ' + _resP.toLocaleString() + ')' : '')
              + '</span>'
            : '';
        var _detailBinBlock = '';
        if (_binP > 0 && !_isSeller && !_hasBids){
            _detailBinBlock = '<div id="buyNowPanel" style="margin-top:0.7rem;background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%);border:1.5px solid #fde68a;border-radius:12px;padding:0.8rem;text-align:center;">'
                + '<div style="font-size:0.7rem;font-weight:800;color:#92400e;letter-spacing:0.08em;">⚡ BUY-IT-NOW PRICE</div>'
                + '<div style="font-size:1.5rem;font-weight:800;color:#b45309;margin:0.15rem 0 0.4rem;">GHS ' + _binP.toLocaleString() + '</div>'
                + '<button onclick="auctionBuyNow()" id="buyNowBtn" style="width:100%;background:linear-gradient(135deg,#f5af02 0%,#e09e00 100%);color:#191919;border:none;padding:0.85rem 1rem;border-radius:10px;font-weight:800;font-size:0.95rem;cursor:pointer;box-shadow:0 4px 12px rgba(245,175,2,0.35);"><i class="fas fa-bolt"></i> Buy It Now — skip the bidding</button>'
                + '<div style="font-size:0.68rem;color:#92400e;margin-top:0.35rem;">First taker wins instantly — this offer disappears after the first bid.</div>'
                + '</div>';
        } else if (_binP > 0 && _isSeller){
            _detailBinBlock = '<div id="buyNowPanel" style="margin-top:0.7rem;background:#faf5ff;border:1px solid #ddd6fe;border-radius:10px;padding:0.6rem;text-align:center;font-size:0.78rem;color:#5b21b6;font-weight:700;">⚡ Your Buy-It-Now price: GHS ' + _binP.toLocaleString() + (_hasBids ? ' — off the table now that bids are in' : ' — first taker wins instantly') + '</div>';
        }
        bidSection = '<div style="background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;padding:1rem;margin-top:1rem;">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.7rem;">'
            + '<div><div style="font-size:0.7rem;font-weight:700;letter-spacing:0.06em;color:#5a6572;">CURRENT BID</div><div style="font-size:1.6rem;font-weight:800;color:#dc2626;">GHS <span id="detailCurrentBid">'+currentBid.toLocaleString()+'</span> <span id="detailBidCountBadge" style="font-size:0.7rem;background:#fee2e2;color:#991b1b;padding:0.15rem 0.4rem;border-radius:999px;border:1px solid #fecaca;">'+(a.bidCount||0)+' bids</span>'+_detailReservePill+'</div><div style="font-size:0.72rem;color:#5a6572;">Next min: <strong>GHS <span id="detailNextMin">'+nextMin.toLocaleString()+'</span></strong> (+GHS <span id="detailBidIncrement">'+(a.bidIncrement||10)+'</span>)</div></div>'
            + '<div style="text-align:right;"><div style="font-size:0.7rem;color:#5a6572;">Seller</div><div style="font-weight:700;font-size:0.85rem;">'+escapeHtml(a.sellerName||'Premium Seller')+'</div><div id="auctionSellerFee" style="font-size:0.65rem;background:#fef3c7;color:#92400e;padding:0.15rem 0.4rem;border-radius:999px;border:1px solid #fde68a;display:inline-block;margin-top:0.15rem;">'+((a.sellerTier? a.sellerTier.toUpperCase() : 'PREMIUM'))+' • escrow</div></div>'
            + '</div>'
            + '<div id="bidStatus" style="font-size:0.82rem;margin-bottom:0.6rem;min-height:1.2rem;"></div>'
            + '<div style="display:flex;gap:0.6rem;align-items:center;">'
            + '<div style="position:relative;flex:1;">'
            + '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-weight:800;color:#5a6572;font-size:0.85rem;">GHS</span>'
            + '<input type="number" id="bidAmountInput" placeholder="'+nextMin+'" min="'+nextMin+'" step="'+(a.bidIncrement||10)+'" style="width:100%;padding:0.85rem 1rem 0.85rem 3.2rem;border:2px solid #e5e7eb;border-radius:10px;font-size:1.05rem;font-weight:700;outline:none;">'
            + '</div>'
            + '<button onclick="placeBid()" id="placeBidBtn" style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;border:none;padding:0.9rem 1.4rem;border-radius:10px;font-weight:800;font-size:0.95rem;cursor:pointer;white-space:nowrap;box-shadow:0 4px 14px rgba(239,68,68,0.3);display:flex;align-items:center;gap:0.4rem;"><i class="fas fa-gavel"></i> Place Bid</button>'
            + '</div>'
            + '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap;">'
            + '<button id="bidQuickOne" onclick="setNextBidAmount(1)" style="flex:1;min-width:80px;background:#fff;border:1px solid #e5e7eb;padding:0.5rem;border-radius:8px;font-weight:700;font-size:0.78rem;cursor:pointer;">+GHS '+(a.bidIncrement||10)+'</button>'
            + '<button id="bidQuickFive" onclick="setNextBidAmount(5)" style="flex:1;min-width:80px;background:#fff;border:1px solid #e5e7eb;padding:0.5rem;border-radius:8px;font-weight:700;font-size:0.78rem;cursor:pointer;">+GHS '+((a.bidIncrement||10)*5)+'</button>'
            + '<button id="bidQuickFifty" onclick="setCurrentBidPlusAmount(50)" style="flex:1;min-width:80px;background:#f8fafc;border:1px solid #e5e7eb;padding:0.5rem;border-radius:8px;font-weight:700;font-size:0.78rem;cursor:pointer;">GHS '+(currentBid+50).toLocaleString()+'</button>'
            + '</div>'
            + _detailBinBlock
            + '<p id="auctionFeeInfo" style="font-size:0.7rem;color:#5f6b7a;margin:0.7rem 0 0;">You must be logged in to bid. Seller cannot bid on own auction. Escrow protected.</p>'
            + '</div>';
        if (_isSeller){
            bidSection = '<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:1.2rem;text-align:center;margin-top:1rem;"><div style="width:42px;height:42px;border-radius:50%;background:#fef3c7;color:#92400e;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:1.2rem;"><i class="fas fa-ban"></i></div><h3 style="margin:0.6rem 0 0.2rem;color:#92400e;font-size:1rem;">You are the seller</h3><p style="margin:0;color:#78350f;font-size:0.85rem;">You cannot bid on your own auction. Share it to get more bidders!</p>'
                + ((_resP > 0 || _binP > 0) ? '<div style="margin-top:0.6rem;display:flex;gap:0.4rem;justify-content:center;flex-wrap:wrap;">'
                    + (_resP > 0 ? '<span id="auctionReservePill" style="background:#fff;border:1px solid #fde68a;color:#92400e;padding:0.3rem 0.6rem;border-radius:999px;font-size:0.72rem;font-weight:800;">🛡️ Reserve GHS ' + _resP.toLocaleString() + (currentBid >= _resP ? ' — met ✓' : ' — not met yet') + '</span>' : '')
                    + (_binP > 0 ? '<span id="buyNowPanel" style="background:#faf5ff;border:1px solid #ddd6fe;color:#5b21b6;padding:0.3rem 0.6rem;border-radius:999px;font-size:0.72rem;font-weight:800;">⚡ Buy-It-Now GHS ' + _binP.toLocaleString() + (_hasBids ? ' (off — bids in)' : ' (live)') + '</span>' : '') + '</div>' : '')
                + '<div style="margin-top:0.8rem;display:flex;gap:0.5rem;justify-content:center;"><a href="auction.html" style="background:#fff;border:1px solid #fde68a;color:#92400e;padding:0.5rem 0.9rem;border-radius:8px;font-weight:700;text-decoration:none;font-size:0.82rem;">View all auctions</a></div></div>';
        }
    } else if (status==='scheduled'){
        var _waitCount = _waitlistCache.length;
        var _isSellerSched = _isSeller || _isAdmin || auctionBelongsToViewer(a);
        if (_isSellerSched){
            bidSection = '<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:1.1rem;margin-top:1rem;">'
            + '<div style="display:flex;align-items:center;gap:0.7rem;justify-content:center;"><div style="width:42px;height:42px;border-radius:50%;background:#f59e0b;color:#fff;display:flex;align-items:center;justify-content:center;"><i class="fas fa-users"></i></div><div style="text-align:left;"><div style="font-weight:800;color:#92400e;"><span id="waitlistCount">'+_waitCount+'</span> on your waitlist</div><div style="font-size:0.75rem;color:#a16207;">Starts in <span id="detailScheduledIn">--:--</span> • Share to get more!</div></div></div>'
            + '<div id="sellerWaitlistBox" style="margin-top:0.9rem;background:#fff;border:1px solid #fde68a;border-radius:10px;padding:0.8rem;text-align:left;"><div style="font-weight:700;font-size:0.82rem;color:#92400e;display:flex;align-items:center;gap:0.4rem;"><i class="fas fa-list"></i> Waitlist <span style="background:#fef3c7;color:#92400e;padding:0.15rem 0.45rem;border-radius:999px;font-size:0.7rem;border:1px solid #fde68a;" id="sellerWaitlistCount">'+_waitCount+'</span> <span style="margin-left:auto;font-size:0.65rem;color:#a16207;" id="waitlistDebug"></span></div><div id="sellerWaitlistList" style="margin-top:0.6rem;max-height:180px;overflow-y:auto;"><p style="color:#9ca3af;font-size:0.82rem;margin:0;">Loading…</p></div><button onclick="refreshWaitlistDebug()" style="margin-top:0.6rem;width:100%;background:#fffbeb;border:1px dashed #f59e0b;color:#92400e;padding:0.4rem;border-radius:6px;font-size:0.7rem;cursor:pointer;"><i class="fas fa-sync"></i> Refresh waitlist (debug)</button></div>'
            + '<p style="margin:0.7rem 0 0;color:#a16207;font-size:0.75rem;">Header blinking amber for all users. Bidding opens automatically.</p>'
            + '</div>'
            + '<div style="margin-top:1rem;background:#fff;border:2px solid #fecaca;border-radius:10px;padding:0.9rem;text-align:center;position:relative;z-index:5;clear:both;">'
            + '<div style="font-weight:800;color:#991b1b;font-size:0.85rem;display:flex;align-items:center;justify-content:center;gap:0.4rem;"><i class="fas fa-exclamation-triangle"></i> Not enough interest?</div>'
            + '<p style="margin:0.3rem 0 0.6rem;color:#7f1d1d;font-size:0.78rem;">Cancel now and we’ll send apology letters to everyone on waitlist.</p>'
            + '<button onclick="cancelAuction()" id="cancelAuctionBtn" style="width:100%;background:#fef2f2;border:1.5px solid #fecaca;color:#991b1b;padding:0.75rem 1rem;border-radius:8px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem;position:relative;z-index:10;"><i class="fas fa-times-circle"></i> Cancel Auction — Apologize to <span id="cancelWaitCount">'+_waitCount+'</span></button>'
            + '<p style="font-size:0.65rem;color:#9ca3af;margin:0.4rem 0 0;">This cannot be undone. Apology sent via notifications.</p>'
            + '</div>';
            console.log('👤 Seller scheduled view — _isSeller:', _isSeller, '_isAdmin:', _isAdmin, 'waitCount:', _waitCount, 'uid:', _cu? _cu.uid : 'null', 'sellerId:', a.sellerId);
            setTimeout(updateWaitlistUI, 120);
        } else {
            bidSection = '<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:1.1rem;text-align:center;margin-top:1rem;">'
            + '<i class="fas fa-hourglass-half" style="font-size:1.4rem;color:#d97706;"></i>'
            + '<h3 style="margin:0.5rem 0 0.2rem;font-size:1rem;color:#92400e;">Get ready - starts in <span id="detailScheduledIn">--:--</span></h3>'
            + '<p style="margin:0;color:#a16207;font-size:0.82rem;"><span id="waitlistCount">'+_waitCount+'</span> waiting • Header blinking amber for all</p>'
            + '<div style="margin-top:0.8rem;display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;">'
            + '<button onclick="joinWaitlist()" id="joinWaitlistBtn" style="background:#f59e0b;color:#fff;border:none;padding:0.65rem 1.1rem;border-radius:8px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;"><i class="fas fa-plus"></i> Join Waitlist</button>'
            + '<button onclick="leaveWaitlist()" id="leaveWaitlistBtn" style="display:none;background:#fff;border:1.5px solid #e5e7eb;color:#374151;padding:0.65rem 1.1rem;border-radius:8px;font-weight:700;cursor:pointer;"><i class="fas fa-sign-out-alt"></i> Leave</button>'
            + '</div>'
            + '<div id="waitlistStatus" style="font-size:0.75rem;color:#a16207;margin-top:0.5rem;"></div>'
            + '<div id="sellerWaitlistBox" style="display:none;"><span id="sellerWaitlistCount" style="display:none;"></span><div id="sellerWaitlistList" style="display:none;"></div></div>'
            + '</div>';
        }
        // Trigger waitlist UI update after render
        setTimeout(updateWaitlistUI, 100);
    } else if (status==='cancelled') {
        var _isWaitlisted = _waitlistCache.some(function(w){ var cu2 = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : null; return cu2 && w._id===cu2.uid; });
        bidSection = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:1.2rem;text-align:center;margin-top:1rem;"><div style="width:42px;height:42px;border-radius:50%;background:#fee2e2;color:#991b1b;display:flex;align-items:center;justify-content:center;margin:0 auto;"><i class="fas fa-envelope-open"></i></div><h3 style="margin:0.6rem 0 0.2rem;color:#991b1b;">Auction Cancelled</h3><p style="margin:0;color:#7f1d1d;font-size:0.85rem;">Seller cancelled - waitlist was not encouraging.</p>' + (_isWaitlisted ? '<div style="margin-top:0.8rem;background:#fff;border:1px solid #fecaca;border-radius:8px;padding:0.8rem;text-align:left;"><div style="font-weight:700;font-size:0.85rem;color:#991b1b;"><i class="fas fa-heart"></i> Apology Letter</div><div style="font-size:0.82rem;color:#374151;margin-top:0.4rem;line-height:1.5;">Dear '+escapeHtml((_waitlistCache.find(function(w){ var cu3 = firebaseAuth.currentUser; return cu3 && w._id===cu3.uid; })||{}).userName||'there')+',<br><br>We sincerely apologize - the auction "'+escapeHtml(a.title||'Auction')+'" has been cancelled by the seller.<br><br>You have not been charged. Please explore other auctions.<br><br>- Sankofa Market Team</div></div>' : '<p style="margin:0.5rem 0 0;color:#6b7280;font-size:0.82rem;">Check other auctions.</p>') + '<a href="auction.html" style="display:inline-block;margin-top:0.8rem;background:#fff;border:1px solid #e5e7eb;color:#374151;padding:0.5rem 0.9rem;border-radius:8px;font-weight:700;text-decoration:none;font-size:0.82rem;">Browse Auctions</a></div>';
    } else if (status==='ended') {
        var _resMissB = a.reserveNotMet === true;
        var _isWinner2 = _cu && _cu.uid === a.currentBidderId;
        var _isSeller2 = _cu && (_cu.uid === a.sellerId || _isAdmin);
        if (_isWinner2){
            var _viewOrderHref2 = a.winnerOrderId ? 'pages/user/orders.html?order='+a.winnerOrderId : (a._id ? 'pages/user/orders.html?auction='+a._id : 'pages/user/orders.html');
            bidSection = '<div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:1.2rem;text-align:center;margin-top:1rem;"><div style="width:42px;height:42px;border-radius:50%;background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto;"><i class="fas fa-trophy"></i></div><h3 style="margin:0.6rem 0 0.2rem;color:#15803d;">You won at GHS '+currentBid.toLocaleString()+'!</h3><p style="margin:0;color:#166534;font-size:0.85rem;">Order auto-placed at bid price. Contact seller to arrange delivery/pickup.</p><div style="margin-top:0.9rem;display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;"><a href="'+_viewOrderHref2+'" style="background:#22c55e;color:#fff;padding:0.65rem 1.1rem;border-radius:8px;font-weight:800;text-decoration:none;"><i class="fas fa-receipt"></i> View Order</a><a href="pages/user/messages.html" style="background:#fff;border:1.5px solid #bbf7d0;color:#15803d;padding:0.65rem 1.1rem;border-radius:8px;font-weight:700;text-decoration:none;"><i class="fas fa-comments"></i> Message Seller</a></div><p style="font-size:0.7rem;color:#6b7280;margin:0.6rem 0 0;">Seller commission comes from seller earnings • Escrow protected • Pay to confirm</p></div>';
        } else if (_isSeller2){
            bidSection = '<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:1.2rem;text-align:center;margin-top:1rem;"><h3 style="margin:0;color:#92400e;">Your auction ended</h3><p style="margin:0.3rem 0 0;color:#78350f;font-size:0.85rem;">'+(_resMissB ? 'No sale — your reserve was not met (top bid was GHS '+currentBid.toLocaleString()+'). You can relist the item.' : 'Winner: <strong>'+escapeHtml(a.currentBidderName||'Highest bidder')+'</strong> at <strong>GHS '+currentBid.toLocaleString()+'</strong>')+'</p><p style="margin:0.3rem 0 0;color:#a16207;font-size:0.75rem;">Order auto-created. Message winner to arrange delivery.</p><div style="margin-top:0.8rem;"><a href="pages/user/messages.html" style="background:#f59e0b;color:#fff;padding:0.6rem 1rem;border-radius:8px;font-weight:700;text-decoration:none;"><i class="fas fa-comments"></i> Message Winner</a></div></div>';
        } else {
            // Check if viewer is seller/admin — show delete option for ended
            var _canDelEnded = _cu && (_cu.uid===a.sellerId || (window.userData && window.userData.role==='admin'));
            var _delBtn = _canDelEnded ? '<div style="margin-top:0.7rem;"><button onclick="deleteAuction(\''+a._id+'\')" style="background:#fff;border:1.5px solid #fecaca;color:#991b1b;padding:0.45rem 0.85rem;border-radius:8px;font-weight:700;font-size:0.78rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.35rem;"><i class="fas fa-trash"></i> Delete Ended Auction</button> <button onclick="clearEndedAuctions()" style="background:#f8fafc;border:1px solid #e5e7eb;color:#6b7280;padding:0.45rem 0.75rem;border-radius:8px;font-weight:600;font-size:0.72rem;cursor:pointer;">Clear all ended</button></div>' : '';
            bidSection = '<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:1rem;margin-top:1rem;text-align:center;color:#6b7280;">'
            + '<p style="margin:0;font-weight:600;">Bidding closed</p><p style="margin:0.3rem 0 0;font-size:0.82rem;">See <a href="auction.html" style="color:#0064d2;font-weight:700;">other auctions</a> or contact seller via Messages.</p>'+_delBtn+'</div>';
        }
        // For winner/seller ended views, also allow delete
        if (status==='ended' && (_isWinner2 || _isSeller2)){
            var _canDelOwn = _cu && (_cu.uid===a.sellerId || (window.userData && window.userData.role==='admin') || _isWinner2);
            // Seller/admin can delete, winner can also hide? Only seller/admin per rules, but show for winner as "Clear" (won't delete via rules, but seller case will)
            if (_cu && (_cu.uid===a.sellerId || (window.userData && window.userData.role==='admin'))){
                bidSection += '<div style="text-align:center;margin-top:0.6rem;"><button onclick="deleteAuction(\''+a._id+'\')" style="background:#fff;border:1px solid #fecaca;color:#991b1b;padding:0.4rem 0.75rem;border-radius:6px;font-size:0.7rem;font-weight:700;cursor:pointer;"><i class="fas fa-trash"></i> Delete this ended auction</button></div>';
            }
        }
    } else {
    }

    // Build group chat HTML — preserve existing chat DOM if already rendered to prevent flicker
    var existingChat = document.getElementById('auctionChatList');
    var shouldBuildChat = !existingChat;
    var chatHTML = '';
    if (status==='scheduled' || status==='live'){
        if (shouldBuildChat){
            chatHTML = '<div id="auctionChatContainer" style="background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;margin-top:1.2rem;overflow:hidden;clear:both;position:relative;z-index:1;contain:content;">'
            + '<div style="background:#f8fafc;border-bottom:1px solid #e5e7eb;padding:0.7rem 0.9rem;display:flex;align-items:center;gap:0.5rem;justify-content:space-between;">'
            + '<div style="display:flex;align-items:center;gap:0.5rem;"><div style="width:32px;height:32px;border-radius:50%;background:#0064d2;color:#fff;display:flex;align-items:center;justify-content:center;"><i class="fas fa-comments"></i></div><div><div style="font-weight:800;font-size:0.85rem;">Wait Room Chat</div><div style="font-size:0.68rem;color:#6b7280;">Seller + <span id="auctionChatWaitCount">'+_waitlistCache.length+'</span> waiting • Ask questions, get answers live</div></div></div>'
            + '<span style="background:'+(status==='live'?'#fee2e2;color:#991b1b;border:1px solid #fecaca;':'#fef3c7;color:#92400e;border:1px solid #fde68a;')+'padding:0.2rem 0.45rem;border-radius:999px;font-size:0.65rem;font-weight:700;">'+(status==='live'?'🔴 LIVE':'🟡 WAITING')+'</span>'
            + '</div>'
            + '<div id="auctionChatList" style="max-height:450px;overflow-y:auto;padding:0.7rem;display:flex;flex-direction:column;gap:0.5rem;background:#f8fafc;min-height:260px;contain:content;transform:translateZ(0);backface-visibility:hidden;will-change:scroll-position;"><div style="text-align:center;padding:1.2rem;color:#5f6b7a;"><i class="fas fa-spinner fa-spin"></i><p style="margin:0.4rem 0 0;font-size:0.82rem;">Loading chat...</p></div></div>'
            + '<div style="display:flex;gap:0.5rem;padding:0.7rem;border-top:1px solid #e5e7eb;background:#fff;align-items:center;">'
            + '<input type="text" id="auctionChatInput" placeholder="'+(_isSeller?'Answer questions from wait room...':'Ask seller a question...')+'" maxlength="500" style="flex:1;padding:0.65rem 0.8rem;border:1.5px solid #e5e7eb;border-radius:999px;font-size:0.85rem;outline:none;" onkeypress="if(event.key===\'Enter\') sendAuctionChat()">'
            + '<button onclick="sendAuctionChat()" id="auctionChatSend" style="background:#0064d2;color:#fff;border:none;padding:0.65rem 1rem;border-radius:999px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:0.35rem;white-space:nowrap;"><i class="fas fa-paper-plane"></i> Send</button>'
            + '</div>'
            + '<div id="auctionChatStatus" style="font-size:0.68rem;color:#6b7280;padding:0 0.7rem 0.5rem;min-height:1rem;"></div>'
            + '</div>';
            // Trigger initial render after a tick (in case cache already has messages)
            setTimeout(function(){ renderAuctionChat(_chatCache); }, 150);
        } else {
            // Chat already exists — just update its header count to avoid flicker (don't rebuild DOM)
            var _cw = document.getElementById('auctionChatWaitCount');
            if (_cw) _cw.textContent = _waitlistCache.length;
            // Update status line
            var _cs = document.getElementById('auctionChatStatus');
            if (_cs && _chatCache){
                var _st = getAuctionStatus(a, Date.now());
                var _hint = _st==='live' ? ' • Bidding live' : ' • Ask before live';
                _cs.textContent = _chatCache.length + ' messages • ' + _waitlistCache.length + ' in wait room' + _hint;
            }
            chatHTML = ''; // Don't re-inject chat — keep existing DOM to prevent flicker
        }
    } else if (status==='ended' || status==='cancelled'){
        // Show read-only history after end — preserve existing chat DOM to prevent flicker if it already exists
        var _existingChatList = document.getElementById('auctionChatList');
        var _existingContainer = document.getElementById('auctionChatContainer');
        if (_existingChatList && _existingContainer && _chatCache.length>0){
            // Just flip header to READ ONLY and disable input, don't rebuild list
            var _hdr = _existingContainer.querySelector('div');
            if (_hdr){
                // Update header to read-only look if not already
                if (!_hdr._isReadOnly){
                    _hdr._isReadOnly = true;
                    _hdr.innerHTML = '<div style="display:flex;align-items:center;gap:0.4rem;font-weight:700;font-size:0.82rem;"><i class="fas fa-comments" style="color:#6b7280;"></i> Wait Room Chat History</div><span style="margin-left:auto;font-size:0.65rem;background:#f3f4f6;color:#374151;padding:0.15rem 0.4rem;border-radius:999px;border:1px solid #e5e7eb;">READ ONLY</span>';
                    _hdr.style.background = '#f8fafc';
                }
            }
            // Disable input
            var _inp = document.getElementById('auctionChatInput');
            var _btn = document.getElementById('auctionChatSend');
            if (_inp){ _inp.disabled=true; _inp.placeholder='Chat closed — auction ended'; _inp.style.background='#f3f4f6'; }
            if (_btn){ _btn.disabled=true; _btn.style.opacity='0.5'; }
            chatHTML = ''; // Don't re-inject — keep existing DOM
        } else if (_chatCache.length>0){
            chatHTML = '<div id="auctionChatContainer" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-top:1rem;overflow:hidden;opacity:0.9;contain:content;">'
                + '<div style="background:#f8fafc;border-bottom:1px solid #e5e7eb;padding:0.6rem 0.9rem;font-weight:700;font-size:0.82rem;display:flex;align-items:center;gap:0.4rem;"><i class="fas fa-comments" style="color:#6b7280;"></i> Wait Room Chat History <span style="margin-left:auto;font-size:0.65rem;background:#f3f4f6;color:#374151;padding:0.15rem 0.4rem;border-radius:999px;border:1px solid #e5e7eb;">READ ONLY</span></div>'
                + '<div id="auctionChatList" style="max-height:420px;overflow-y:auto;padding:0.7rem;display:flex;flex-direction:column;gap:0.5rem;background:#f8fafc;min-height:200px;contain:content;transform:translateZ(0);"></div>'
                + '</div>';
            setTimeout(function(){ renderAuctionChat(_chatCache); }, 150);
        }
    }
    root.innerHTML = '<div style="max-width:1100px;margin:0 auto;padding:1.2rem 1rem 2rem;display:grid;grid-template-columns:1.15fr 0.85fr;gap:1.4rem;align-items:start;">'
        + '<div style="background:#fff;border-radius:14px;padding:1rem;border:1px solid #e5e7eb;">'
        + '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.8rem;flex-wrap:wrap;">'+badge+' <a href="auction.html" style="margin-left:auto;font-size:0.78rem;color:#0064d2;font-weight:700;text-decoration:none;"><i class="fas fa-arrow-left"></i> All Auctions</a></div>'
        + gallery + thumbs
        + '<h1 style="margin:0.9rem 0 0.3rem;font-size:1.35rem;font-weight:800;line-height:1.25;">'+escapeHtml(a.title||'Auction Item')+'</h1>'
        + '<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-bottom:0.7rem;">'
        + '<span style="background:#f3f4f6;border:1px solid #e5e7eb;padding:0.2rem 0.5rem;border-radius:999px;font-size:0.7rem;font-weight:600;">'+escapeHtml((a.category||'General').replace(/-/g,' '))+'</span>'
        + '<span style="font-size:0.75rem;color:#5a6572;"><i class="fas fa-map-marker-alt"></i> '+escapeHtml(a.location||'Ghana')+'</span>'
        + '<span style="font-size:0.75rem;color:#5a6572;"><i class="fas fa-eye"></i> '+(a.views||0)+' views</span>'
        + '</div>'
        + '<p style="margin:0;color:#374151;font-size:0.9rem;line-height:1.6;white-space:pre-wrap;">'+escapeHtml(a.description||'No description.')+'</p>'
        + (a.productId ? '<a href="product-detail.html?id='+escapeHtml(a.productId)+'" style="display:inline-flex;align-items:center;gap:0.3rem;margin-top:0.9rem;font-size:0.8rem;color:#0064d2;font-weight:700;text-decoration:none;border:1px solid #bfdbfe;background:#eff6ff;padding:0.4rem 0.7rem;border-radius:8px;"><i class="fas fa-external-link-alt"></i> View original listing</a>' : '')
        + '</div>'
        + '<div>'
        + timeBox
        + bidSection
        + chatHTML
        + '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1rem;margin-top:1rem;">'
        + '<h3 style="margin:0 0 0.7rem;font-size:0.95rem;display:flex;align-items:center;gap:0.4rem;"><i class="fas fa-history" style="color:#0064d2;"></i> Bid History <span id="bidCountBadge" style="background:#f3f4f6;border:1px solid #e5e7eb;padding:0.15rem 0.45rem;border-radius:999px;font-size:0.7rem;">'+(a.bidCount||0)+'</span></h3>'
        + '<div id="bidHistory" style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:0.5rem;"><div style="text-align:center;padding:1.2rem;color:#5f6b7a;font-size:0.82rem;"><i class="fas fa-spinner fa-spin"></i> Loading bids...</div></div>'
        + '</div>'
        + '<div style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border:1px solid #bbf7d0;border-radius:12px;padding:0.9rem;margin-top:1rem;display:flex;gap:0.7rem;align-items:center;">'
        + '<div style="width:38px;height:38px;border-radius:50%;background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-shield-alt"></i></div>'
        + '<div><div style="font-weight:700;font-size:0.82rem;color:#15803d;">Escrow protected • seller commission</div><div style="font-size:0.72rem;color:#166534;"><span id="auctionFeeSummary">Seller commission comes from seller earnings. Winner pays only the bid.</span> Payment is held in Sankofa escrow.</div></div>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '<style>@media(max-width:860px){ #auctionDetailRoot > div { grid-template-columns:1fr !important; } }</style>';

    try{ setTimeout(function(){ fillAuctionFeeInfo(a.sellerId, a); }, 300); }catch(e){}

    // Set the initial suggestion from the latest snapshot (not a possibly stale render
    // argument), and do not overwrite anything the user already selected or typed.
    setTimeout(function(){
        var inp = document.getElementById('bidAmountInput');
        var latestAuction = _currentAuction && _currentAuction._id === a._id ? _currentAuction : a;
        if (inp && status==='live'){
            var suggestedAmount = auctionBidNumbers(latestAuction).nextMin;
            if (!String(inp.value || '').trim()){
                inp.value = suggestedAmount;
                if (inp.dataset) inp.dataset.autoBidDefault = String(suggestedAmount);
            }
            inp.oninput = function(){ if (this.dataset) this.dataset.autoBidDefault = ''; };
        }
    }, 100);
}

function updateDetailCountdown(a){
    var el = document.getElementById('detailCountdown');
    var el2 = document.getElementById('detailScheduledIn');
    var now = Date.now();
    // Use _currentAuction as source of truth if available (it holds the latest seller/winner IDs)
    var src = _currentAuction || a;
    if (!src) return;
    var status = getAuctionStatus(src, now);
    var targetMs = 0;
    if (status==='scheduled'){
        targetMs = src.startAt ? (src.startAt.toMillis?src.startAt.toMillis():new Date(src.startAt).getTime()) : now;
        var diff = targetMs - now;
        var txt = diff>0 ? formatAuctionCountdown(diff) : '00:00';
        if (el) el.textContent = txt;
        if (el2) el2.textContent = txt;
        // Auto-flip scheduled -> live when countdown hits 0 (no refresh needed)
        if (diff<=0){
            if (src.status !== 'live'){
                console.log('⏰ Scheduled time reached — auto flipping to LIVE');
                src.status = 'live';
                renderAuctionDetail(src);
                ensureAuctionWinnerOrder(src);
            }
        }
    } else if (status==='live'){
        targetMs = src.endAt ? (src.endAt.toMillis?src.endAt.toMillis():new Date(src.endAt).getTime()) : now;
        var diff2 = targetMs - now;
        var txt2 = diff2>0 ? formatAuctionCountdown(diff2) : '00:00';
        if (el) el.textContent = txt2;
        if (el2) el2.textContent = txt2;
        var bidEl = document.getElementById('detailCurrentBid');
        if (bidEl) bidEl.textContent = (src.currentBid||src.startingPrice||0).toLocaleString();
        if (diff2<=0){
            // Time is up but getAuctionStatus still says 'live' for this exact ms — force ended (only once)
            if (src.status !== 'ended'){
                console.log('⏰ Live time reached — auto flipping to ENDED');
                src.status = 'ended';
                if (el) el.textContent = 'ENDED';
                renderAuctionDetail(src);
                ensureAuctionWinnerOrder(src);
                if (_currentAuctionId && typeof firebaseDB!=='undefined' && !window._endedStatusPushed){
                    window._endedStatusPushed = true;
                    try{ firebaseDB.collection('auctions').doc(_currentAuctionId).update({ status:'ended', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(function(){ window._endedStatusPushed=false; }); }catch(e){ window._endedStatusPushed=false; }
                }
            }
        }
    } else if (status==='ended'){
        if (el) el.textContent = 'ENDED';
        if (el2) el2.textContent = 'ENDED';
        // If DB still says live/scheduled but time says ended, flip locally and show win screen automatically
        if (src.status !== 'ended' && src.status !== 'cancelled'){
            console.log('⏰ Detected ENDED by time — auto rendering win screen (was '+src.status+')');
            src.status = 'ended';
            renderAuctionDetail(src);
        }
        // Ensure order/conversation exists
        ensureAuctionWinnerOrder(src);
        // Best-effort persist to DB so listing page also updates — ONLY ONCE to avoid every-second flicker
        if (_currentAuctionId && typeof firebaseDB!=='undefined' && src.status==='ended'){
            if (!window._endedStatusPushed){
                window._endedStatusPushed = true;
                try{ firebaseDB.collection('auctions').doc(_currentAuctionId).update({ status:'ended', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(function(){ window._endedStatusPushed=false; }); }catch(e){ window._endedStatusPushed=false; }
            }
        }
    } else if (status==='cancelled'){
        if (el) el.textContent = 'CANCELLED';
        if (el2) el2.textContent = 'CANCELLED';
    }
}

function setBidAmount(v){
    var inp = document.getElementById('bidAmountInput');
    if (inp){
        inp.value = v;
        if (inp.dataset) inp.dataset.autoBidDefault = '';
    }
}

function setNextBidAmount(multiplier){
    if (!_currentAuction) return;
    var bid = auctionBidNumbers(_currentAuction);
    var times = Number(multiplier);
    if (!isFinite(times) || times <= 0) times = 1;
    setBidAmount(bid.currentBid + bid.increment * times);
}

function setCurrentBidPlusAmount(extra){
    if (!_currentAuction) return;
    var bid = auctionBidNumbers(_currentAuction);
    var amount = Number(extra);
    if (!isFinite(amount) || amount < 0) amount = 0;
    setBidAmount(bid.currentBid + amount);
}

function renderBidHistory(bids){
    var container = document.getElementById('bidHistory');
    var badge = document.getElementById('bidCountBadge');
    if (!container) return;
    if (badge) badge.textContent = bids.length;
    if (bids.length===0){
        container.innerHTML = '<div style="text-align:center;padding:1.5rem 1rem;color:#5f6b7a;"><i class="fas fa-gavel" style="font-size:1.5rem;display:block;margin-bottom:0.4rem;"></i><p style="margin:0;font-size:0.82rem;">No bids yet - be the first!</p><p style="margin:0.25rem 0 0;font-size:0.7rem;">Starting at GHS '+(_currentAuction? (_currentAuction.startingPrice||0).toLocaleString() : '-')+'</p></div>';
        return;
    }
    var html='';
    bids.forEach(function(b, idx){
        var isWinning = idx===0;
        var when = b.createdAt ? (b.createdAt.toMillis? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : Date.now();
        var ago = (function(diff){
            var s=Math.floor(diff/1000);
            if (s<60) return s+'s ago';
            var m=Math.floor(s/60); if (m<60) return m+'m ago';
            var h=Math.floor(m/60); if (h<24) return h+'h ago';
            return Math.floor(h/24)+'d ago';
        })(Date.now()-when);
        var bidder = b.bidderName || 'Bidder';
        var initial = bidder.charAt(0).toUpperCase();
        html += '<div style="display:flex;align-items:center;gap:0.7rem;padding:0.6rem 0.7rem;border-radius:10px;'+(isWinning ? 'background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%);border:1px solid #fecaca;' : 'background:#f9fafb;border:1px solid #f3f4f6;')+'">'
            + '<div style="width:34px;height:34px;border-radius:50%;background:'+(isWinning?'#ef4444':'#6b7280')+';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.8rem;flex-shrink:0;">'+escapeHtml(initial)+'</div>'
            + '<div style="flex:1;min-width:0;">'
            + '<div style="font-weight:700;font-size:0.85rem;display:flex;align-items:center;gap:0.4rem;">'+escapeHtml(bidder)+' '+(isWinning?'<span style="background:#ef4444;color:#fff;padding:0.1rem 0.35rem;border-radius:999px;font-size:0.6rem;font-weight:800;">WINNING</span>':'')+'</div>'
            + '<div style="font-size:0.7rem;color:#5a6572;">'+escapeHtml(ago)+' • <span style="font-weight:600;">GHS '+ (b.amount||0).toLocaleString() +'</span></div>'
            + '</div>'
            + '<div style="font-weight:800;color:'+(isWinning?'#dc2626':'#374151')+';font-size:0.95rem;">GHS '+(b.amount||0).toLocaleString()+'</div>'
            + '</div>';
    });
    container.innerHTML = html;
}

function placeBid(){
    var inp = document.getElementById('bidAmountInput');
    var statusEl = document.getElementById('bidStatus');
    var btn = document.getElementById('placeBidBtn');
    if (!_currentAuction || !_currentAuctionId) {
        if (statusEl) statusEl.innerHTML = '<span style="color:#e74c3c;">Auction not loaded.</span>';
        return;
    }
    if (!inp) return;
    var amount = parseInt(inp.value,10);
    if (isNaN(amount) || amount<=0){
        if (statusEl) statusEl.innerHTML = '<span style="color:#e74c3c;"><i class="fas fa-exclamation-triangle"></i> Enter a valid bid amount.</span>';
        return;
    }
    var currentBid = _currentAuction.currentBid || _currentAuction.startingPrice || 0;
    var increment = _currentAuction.bidIncrement || 10;
    var nextMin = currentBid + increment;
    // For first bid, startingPrice is floor; but if currentBid === startingPrice and no bids, amount >= startingPrice is ok? Enforce nextMin anyway except when bidCount===0
    var minRequired = (_currentAuction.bidCount||0)===0 ? _currentAuction.startingPrice : nextMin;
    if (amount < minRequired){
        if (statusEl) statusEl.innerHTML = '<span style="color:#e74c3c;">Bid must be at least <strong>GHS '+minRequired.toLocaleString()+'</strong> (current GHS '+currentBid.toLocaleString()+' + GHS '+increment+').</span>';
        inp.style.borderColor='#ef4444';
        return;
    }
    inp.style.borderColor='#e5e7eb';
    // Auth check
    var user = (typeof firebaseAuth!=='undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : (typeof firebase!=='undefined' && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser : null);
    if (!user){
        if (statusEl) statusEl.innerHTML = '<span style="color:#d97706;"><i class="fas fa-lock"></i> Please <a href="pages/auth/login.html?redirect='+encodeURIComponent('auction-detail.html?id='+_currentAuctionId)+'" style="color:#0064d2;font-weight:700;">sign in</a> to bid.</span>';
        setTimeout(function(){ window.location.href='pages/auth/login.html?redirect='+encodeURIComponent('auction-detail.html?id='+_currentAuctionId); }, 1200);
        return;
    }
    if (user.uid === _currentAuction.sellerId){
        if (statusEl) statusEl.innerHTML = '<span style="color:#e74c3c;"><i class="fas fa-ban"></i> You cannot bid on your own auction.</span>';
        return;
    }
    // Check still live
    var now = Date.now();
    var status = getAuctionStatus(_currentAuction, now);
    if (status!=='live'){
        if (status==='scheduled') {
            if (statusEl) statusEl.innerHTML = '<span style="color:#d97706;"><i class="fas fa-clock"></i> Auction hasn\'t started yet - wait for the countdown.</span>';
        } else {
            if (statusEl) statusEl.innerHTML = '<span style="color:#6b7280;"><i class="fas fa-flag-checkered"></i> Auction has ended.</span>';
        }
        return;
    }
    // Disable button
    if (btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Placing...'; }

    // Get user name
    var bidderName = (user.displayName || (window.userData && (window.userData.firstName || window.userData.name)) || user.email || 'Bidder').split('@')[0];
    // Also try Firestore user doc for better name
    var bidderId = user.uid;

    // Transaction: ensure still highest
    var auctionRef = firebaseDB.collection('auctions').doc(_currentAuctionId);
    firebaseDB.runTransaction(function(tx){
        return tx.get(auctionRef).then(function(doc){
            if (!doc.exists) throw new Error('Auction not found');
            var a = doc.data();
            var curStatus = getAuctionStatus(a, Date.now());
            if (curStatus!=='live') throw new Error('Auction is not live');
            var curBid = a.currentBid || a.startingPrice || 0;
            var inc = a.bidIncrement || 10;
            var minReq = (a.bidCount||0)===0 ? a.startingPrice : curBid + inc;
            if (amount < minReq) throw new Error('Bid too low. Minimum is GHS '+minReq.toLocaleString());
            // Update auction doc
            tx.update(auctionRef, {
                currentBid: amount,
                currentBidderId: bidderId,
                currentBidderName: bidderName,
                bidCount: (a.bidCount||0)+1,
                lastBidAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Create bid doc
            var bidRef = auctionRef.collection('bids').doc();
            tx.set(bidRef, {
                bidderId: bidderId,
                bidderName: bidderName,
                amount: amount,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
    }).then(function(){
        if (statusEl) statusEl.innerHTML = '<span style="color:#16a34a;"><i class="fas fa-check-circle"></i> Bid placed! You are now the highest bidder at <strong>GHS '+amount.toLocaleString()+'</strong></span>';
        if (btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-gavel"></i> Place Bid'; }
        // Suggest the next amount after our bid; later live bids advance this default
        // unless the user has started typing or selected a different quick amount.
        if (inp){
            inp.value = amount + ( _currentAuction.bidIncrement||10 );
            if (inp.dataset) inp.dataset.autoBidDefault = String(inp.value);
        }
        try{ if (navigator.vibrate) navigator.vibrate([80,40,80]); }catch(e){}
        // --- Wait Room Chat announcement: everyone in wait room sees new bid instantly ---
        try{
            var _bidCountAnn = (_currentAuction.bidCount||0)+1;
            var annText = '\uD83D\uDD28 New bid: GHS ' + amount.toLocaleString() + ' by ' + bidderName + ' — ' + _bidCountAnn + ' bid' + (_bidCountAnn>1?'s':'') + ', high: GHS ' + amount.toLocaleString();
            firebaseDB.collection('auctions').doc(_currentAuctionId).collection('chat').add({
                senderId: bidderId,
                senderName: bidderName,
                text: annText,
                isBidAnnouncement: true,
                amount: amount,
                bidCount: _bidCountAnn,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(function(e){ console.warn('bid announce chat failed', e&&e.message); });
        }catch(e){ console.warn('announce error', e); }
    }).catch(function(err){
        console.error('Bid error', err);
        if (statusEl) statusEl.innerHTML = '<span style="color:#e74c3c;"><i class="fas fa-exclamation-circle"></i> '+escapeHtml(err.message||'Could not place bid')+'</span>';
        if (btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-gavel"></i> Place Bid'; }
        // Refresh auction data to get latest currentBid
        firebaseDB.collection('auctions').doc(_currentAuctionId).get().then(function(d){
            if (d.exists){
                _currentAuction = d.data(); _currentAuction._id=d.id;
                refreshAuctionBidControls(_currentAuction, document.getElementById('auctionDetailRoot'));
            }
        });
    });
}

// ============================================================================
// WAITLIST - users waiting for scheduled auction (seller sees count)
// ============================================================================

function listenWaitlist(auctionId){
    if (_waitlistUnsub) try{ _waitlistUnsub(); }catch(e){}
    _waitlistCache = [];
    if (typeof firebaseDB === 'undefined' || !firebaseDB || !auctionId) return;
    var _myUidLog = (typeof firebaseAuth!=='undefined'&&firebaseAuth.currentUser) ? firebaseAuth.currentUser.uid : (window.currentUser?window.currentUser.uid:'anon');
    console.log('👂 Listening waitlist for', auctionId, 'as', _myUidLog, 'sellerId:', (_currentAuction? _currentAuction.sellerId : 'unknown'));
    // Periodic sync every 4s to fix "0 waiting" if snapshot missed (mobile background, cache, etc.) — force server read
    if (window._waitlistSync) try{ clearInterval(window._waitlistSync); }catch(e){}
    window._waitlistSync = setInterval(function(){
        if (!_currentAuctionId || _currentAuctionId!==auctionId) return;
        firebaseDB.collection('auctions').doc(auctionId).collection('waitlist').get({source:'server'}).catch(function(){ return firebaseDB.collection('auctions').doc(auctionId).collection('waitlist').get(); }).then(function(snap){
            if (!snap) return;
            var hasNew = snap.size !== _waitlistCache.length;
            // Also check ids to detect changes even if size same
            var ids = snap.docs ? snap.docs.map(function(d){return d.id;}).sort().join(',') : '';
            var cacheIds = _waitlistCache.map(function(w){return w._id;}).sort().join(',');
            if (hasNew || ids !== cacheIds){
                console.log('🔄 Waitlist periodic sync — server found', snap.size, 'vs cache', _waitlistCache.length, 'ids:', ids);
                _waitlistCache = [];
                snap.forEach(function(d){ var w=d.data(); w._id=d.id; _waitlistCache.push(w); });
                updateWaitlistUI();
            }
        }).catch(function(e){ console.warn('waitlist periodic get failed', e&&e.message); });
    }, 4000);
    // Also do an immediate server get to prime cache (fixes 0 on first load if snapshot from cache is empty)
    firebaseDB.collection('auctions').doc(auctionId).collection('waitlist').get({source:'server'}).catch(function(){ return firebaseDB.collection('auctions').doc(auctionId).collection('waitlist').get(); }).then(function(snap){
        if (snap && snap.size !== _waitlistCache.length){
            console.log('⚡ Waitlist initial server get —', snap.size);
            _waitlistCache = [];
            snap.forEach(function(d){ var w=d.data(); w._id=d.id; _waitlistCache.push(w); });
            updateWaitlistUI();
        }
    }).catch(function(){});
    _waitlistUnsub = firebaseDB.collection('auctions').doc(auctionId).collection('waitlist').onSnapshot(function(snap){
        _waitlistCache = [];
        snap.forEach(function(d){ var w=d.data(); w._id=d.id; _waitlistCache.push(w); });
        console.log('👥 Waitlist snapshot —', _waitlistCache.length, 'users');
        updateWaitlistUI();
        // If seller is viewing scheduled auction, also re-render to ensure count in rendered header is fresh (handles race where render happened before snapshot)
        if (_currentAuction && getAuctionStatus(_currentAuction, Date.now())==='scheduled'){
            var cu = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : null;
            if (cu && cu.uid === _currentAuction.sellerId){
                // Seller: update the count spans directly (already done), but also ensure list is fresh
                // No full re-render to avoid flicker, just UI
            }
        }
    }, function(err){ console.warn('waitlist listen error', err); showFlashMessage && showFlashMessage('Waitlist sync error: '+err.message,'error'); });
}

function updateWaitlistUI(){
    var countEl = document.getElementById('waitlistCount');
    var listEl = document.getElementById('waitlistList');
    var btnJoin = document.getElementById('joinWaitlistBtn');
    var btnLeave = document.getElementById('leaveWaitlistBtn');
    var statusEl = document.getElementById('waitlistStatus');
    var sellerBox = document.getElementById('sellerWaitlistBox');
    var count = _waitlistCache.length;
    console.log('👥 Waitlist UI update — count:', count, 'cache:', _waitlistCache.map(function(w){return w.userName||w._id;}));
    // Update main waiting count (seller + bidder)
    if (countEl) countEl.textContent = count + ' waiting';
    // Fallback: also update seller count elements directly even if sellerBox hidden
    var sellerCountDirect = document.getElementById('sellerWaitlistCount');
    if (sellerCountDirect) sellerCountDirect.textContent = count;
    var cancelCountDirect = document.getElementById('cancelWaitCount');
    if (cancelCountDirect) cancelCountDirect.textContent = count;
    // Update wait room chat header count
    var chatWaitCount = document.getElementById('auctionChatWaitCount');
    if (chatWaitCount) chatWaitCount.textContent = count;
    // Also update chat status line if chat is visible
    var chatStatus = document.getElementById('auctionChatStatus');
    if (chatStatus && _chatCache){
        var st = _currentAuction ? getAuctionStatus(_currentAuction, Date.now()) : 'live';
        var hint = st==='live' ? ' • Bidding live' : ' • Ask before live';
        chatStatus.textContent = _chatCache.length + ' messages • ' + count + ' in wait room' + hint;
    }
    if (sellerBox){
        var sellerCount = document.getElementById('sellerWaitlistCount');
        if (sellerCount) sellerCount.textContent = count;
        var cancelCount = document.getElementById('cancelWaitCount');
        if (cancelCount) cancelCount.textContent = count;
        var sellerList = document.getElementById('sellerWaitlistList');
        if (sellerList){
            if (count===0) sellerList.innerHTML = '<p style="color:#9ca3af;font-size:0.82rem;margin:0;">No one on waitlist yet - share your auction!</p>';
            else {
                var html='';
                _waitlistCache.slice(0,20).forEach(function(w, idx){
                    var name = w.userName || w.displayName || 'User '+(idx+1);
                    var when = w.joinedAt ? (w.joinedAt.toDate ? w.joinedAt.toDate().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : new Date(w.joinedAt).toLocaleTimeString()) : '';
                    html += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;border-bottom:1px solid #f3f4f6;"><div style="width:28px;height:28px;border-radius:50%;background:#f59e0b;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.7rem;">'+escapeHtml(name.charAt(0).toUpperCase())+'</div><div style="flex:1;"><div style="font-size:0.82rem;font-weight:600;">'+escapeHtml(name)+'</div><div style="font-size:0.68rem;color:#9ca3af;">Joined '+escapeHtml(when)+'</div></div><span style="font-size:0.65rem;background:#fef3c7;color:#92400e;padding:0.15rem 0.4rem;border-radius:999px;">#'+(idx+1)+'</span></div>';
                });
                if (count>20) html += '<p style="font-size:0.7rem;color:#9ca3af;margin:0.4rem 0 0;">+'+(count-20)+' more…</p>';
                sellerList.innerHTML = html;
            }
        }
    }
    // Debug: show listening info
    var dbg = document.getElementById('waitlistDebug');
    if (dbg){
        var myUid = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser.uid : 'anon';
        dbg.textContent = 'ID:' + (_currentAuctionId||'').slice(0,6) + ' as ' + (myUid||'anon').slice(0,6);
    }
    // For bidder buttons
    var cu = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser : null);
    if (!cu && window.currentUser) cu = window.currentUser;
    if (!cu && window.userData) cu = { uid: window.userData.uid || window.userData.userId || window.userData.id };
    var viewerUid = auctionViewerUid() || (cu && String(cu.uid)) || '';
    var isOnList = viewerUid && _waitlistCache.some(function(w){ return String(w._id)===String(viewerUid); });
    if (btnJoin && btnLeave){
        if (isOnList){
            btnJoin.style.display='none';
            btnLeave.style.display='inline-flex';
            if (statusEl) statusEl.innerHTML = '<span style="color:#16a34a;"><i class="fas fa-check-circle"></i> You are on the waitlist - you\'ll be notified when live!</span>';
        } else {
            btnJoin.style.display='inline-flex';
            btnLeave.style.display='none';
            if (statusEl) statusEl.textContent = count===0 ? 'Be first to join!' : count+' user'+(count!==1?'s':'')+' waiting';
        }
        // Seller cannot join own waitlist - hide buttons
        if (_currentAuction && viewerUid && String(viewerUid) === String(_currentAuction.sellerId || '')){
            btnJoin.style.display='none';
            btnLeave.style.display='none';
            if (statusEl) statusEl.innerHTML = '<span style="color:#92400e;">Seller view - you cannot join your own waitlist</span>';
        }
    }
}

// ============================================================================
// AUCTION GROUP CHAT — wait room → live (seller + waitlist + bidders)
// ============================================================================
function listenAuctionChat(auctionId){
    if (_chatUnsub) try{ _chatUnsub(); }catch(e){}
    _chatCache = [];
    if (typeof firebaseDB === 'undefined' || !firebaseDB || !auctionId) return;
    console.log('💬 Listening auction chat for', auctionId, 'as', (typeof firebaseAuth!=='undefined'&&firebaseAuth.currentUser?firebaseAuth.currentUser.uid:'anon'));
    // Prime with server get to ensure chat appears even if snapshot from cache is stale
    firebaseDB.collection('auctions').doc(auctionId).collection('chat').orderBy('createdAt','asc').limit(100).get({source:'server'}).catch(function(){ return firebaseDB.collection('auctions').doc(auctionId).collection('chat').orderBy('createdAt','asc').limit(100).get(); }).then(function(snap){
        if (snap && snap.size){
            console.log('⚡ Chat initial server get —', snap.size);
            _chatCache = [];
            snap.forEach(function(d){ var m=d.data(); m._id=d.id; _chatCache.push(m); });
            renderAuctionChat(_chatCache);
        }
    }).catch(function(){});
    _chatUnsub = firebaseDB.collection('auctions').doc(auctionId).collection('chat').orderBy('createdAt','asc').limit(100).onSnapshot(function(snap){
        // Use docChanges to avoid full flicker — only re-render if actually changed
        var changes = snap.docChanges();
        var needsRender = false;
        if (changes.length === 0 && snap.size === _chatCache.length) {
            // No changes, skip
            return;
        }
        // For simplicity, still rebuild cache but only render if sig changed (handled in renderAuctionChat)
        _chatCache = [];
        snap.forEach(function(d){ var m=d.data(); m._id=d.id; _chatCache.push(m); });
        console.log('💬 Chat snapshot —', _chatCache.length, 'messages (', changes.length, ' changes)');
        renderAuctionChat(_chatCache);
    }, function(err){
        console.warn('chat listen error (orderBy), trying fallback without orderBy', err&&err.message);
        // Fallback without orderBy (in case index missing or createdAt null)
        try{
            if (_chatUnsub) try{ _chatUnsub(); }catch(e){}
            _chatUnsub = firebaseDB.collection('auctions').doc(auctionId).collection('chat').limit(100).onSnapshot(function(snap2){
                _chatCache = [];
                snap2.forEach(function(d){ var m=d.data(); m._id=d.id; _chatCache.push(m); });
                // Sort client-side by createdAt
                _chatCache.sort(function(a,b){
                    var at = a.createdAt ? (a.createdAt.toMillis?a.createdAt.toMillis():new Date(a.createdAt).getTime()) : 0;
                    var bt = b.createdAt ? (b.createdAt.toMillis?b.createdAt.toMillis():new Date(b.createdAt).getTime()) : 0;
                    return at-bt;
                });
                console.log('💬 Chat fallback snapshot —', _chatCache.length);
                renderAuctionChat(_chatCache);
            }, function(err2){ console.warn('chat fallback also failed', err2); });
        }catch(e){ console.warn('chat fallback setup failed', e); }
    });
}

function renderAuctionChat(messages){
    var list = document.getElementById('auctionChatList');
    var statusEl = document.getElementById('auctionChatStatus');
    if (!list) return;
    // Prevent flicker: check if messages actually changed (by last id + length)
    var sig = (messages ? messages.length : 0) + '|' + (messages && messages.length ? messages[messages.length-1]._id : '') + '|' + (messages && messages[0] ? messages[0]._id : '');
    if (list._lastSig === sig && list._rendered) return;
    list._lastSig = sig;
    list._rendered = true;
    // Preserve scroll position near bottom and input focus
    var wasAtBottom = (list.scrollHeight - list.scrollTop - list.clientHeight) < 40;
    var activeEl = document.activeElement;
    var inputHadFocus = activeEl && activeEl.id === 'auctionChatInput';
    var inputVal = inputHadFocus ? activeEl.value : null;
    var inputSelStart = inputHadFocus ? activeEl.selectionStart : null;
    if (!messages || messages.length===0){
        list.innerHTML = '<div style="text-align:center;padding:1.2rem;color:#5f6b7a;"><i class="fas fa-comments" style="font-size:1.4rem;display:block;margin-bottom:0.4rem;"></i><p style="margin:0;font-size:0.82rem;">No questions yet — be the first to ask the seller!</p><p style="margin:0.2rem 0 0;font-size:0.68rem;">Seller will answer here live until auction ends.</p></div>';
        if (statusEl) statusEl.textContent = _waitlistCache.length + ' in wait room • Seller online';
        return;
    }
    var cu = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : null;
    var html='';
    messages.forEach(function(m){
        var isSeller = _currentAuction && m.senderId === _currentAuction.sellerId;
        var isMe = cu && m.senderId === cu.uid;
        var when = m.createdAt ? (m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt)) : new Date();
        var timeStr = '';
        try{ timeStr = when.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }catch(e){ timeStr=''; }
        var name = m.senderName || 'User';
        var initial = name.charAt(0).toUpperCase();
        var isBidAnn = !!m.isBidAnnouncement;
        var bubbleBg = isBidAnn ? 'linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%)' : isSeller ? 'linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)' : isMe ? '#eff6ff' : '#fff';
        var border = isBidAnn ? '#fecaca' : isSeller ? '#fde68a' : isMe ? '#bfdbfe' : '#e5e7eb';
        var align = isMe ? 'flex-end' : 'flex-start';
        if (isBidAnn){
            html += '<div style="display:flex;justify-content:center;margin:0.3rem 0;">'
                + '<div style="background:'+bubbleBg+';border:1px solid '+border+';border-radius:999px;padding:0.4rem 0.7rem;display:flex;align-items:center;gap:0.4rem;max-width:90%;">'
                + '<span style="width:22px;height:22px;border-radius:50%;background:#ef4444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.65rem;flex-shrink:0;"><i class="fas fa-gavel"></i></span>'
                + '<span style="font-size:0.78rem;color:#991b1b;font-weight:700;white-space:pre-wrap;word-break:break-word;">'+escapeHtml(m.text||'')+'</span>'
                + '<span style="font-size:0.6rem;color:#b45309;white-space:nowrap;">'+escapeHtml(timeStr)+'</span>'
                + '</div></div>';
        } else {
            html += '<div style="display:flex;gap:0.5rem;align-items:flex-start;justify-content:'+(isMe?'flex-end':'flex-start')+';">'
                + (!isMe ? '<div style="width:28px;height:28px;border-radius:50%;background:'+(isSeller?'#f59e0b':'#6b7280')+';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.7rem;flex-shrink:0;">'+escapeHtml(initial)+'</div>' : '')
                + '<div style="max-width:78%;background:'+bubbleBg+';border:1px solid '+border+';border-radius:14px;padding:0.5rem 0.7rem;'+(isMe?'border-bottom-right-radius:4px;':'border-bottom-left-radius:4px;')+'">'
                + '<div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;"><span style="font-weight:700;font-size:0.78rem;">'+escapeHtml(name)+'</span>'+(isSeller?'<span style="background:#f59e0b;color:#fff;padding:0.1rem 0.3rem;border-radius:999px;font-size:0.6rem;font-weight:800;">SELLER</span>':'')+(isMe?'<span style="background:#0064d2;color:#fff;padding:0.1rem 0.3rem;border-radius:999px;font-size:0.6rem;font-weight:700;">YOU</span>':'')+'<span style="font-size:0.65rem;color:#5f6b7a;">'+escapeHtml(timeStr)+'</span></div>'
                + '<div style="font-size:0.82rem;color:#374151;margin-top:0.2rem;white-space:pre-wrap;word-break:break-word;">'+escapeHtml(m.text||'')+'</div>'
                + '</div>'
                + (isMe ? '<div style="width:28px;height:28px;border-radius:50%;background:#0064d2;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.7rem;flex-shrink:0;">'+escapeHtml(initial)+'</div>' : '')
                + '</div>';
        }
    });
    // Use requestAnimationFrame to batch DOM and avoid flicker, preserve input focus
    var doRender = function(){
        list.innerHTML = html;
        // Only auto-scroll if user was at bottom
        if (wasAtBottom) list.scrollTop = list.scrollHeight;
        if (statusEl){
            var liveHint = _currentAuction && getAuctionStatus(_currentAuction, Date.now())==='live' ? ' • Bidding live' : ' • Ask before live';
            statusEl.textContent = messages.length + ' messages • ' + _waitlistCache.length + ' in wait room' + liveHint;
        }
        // Restore input focus if it had it
        if (inputHadFocus){
            var inp = document.getElementById('auctionChatInput');
            if (inp){
                inp.focus();
                if (inputVal !== null) inp.value = inputVal;
                try{ if(inputSelStart!==null) inp.setSelectionRange(inputSelStart, inputSelStart); }catch(e){}
            }
        }
    };
    if (window.requestAnimationFrame) requestAnimationFrame(doRender);
    else doRender();
}

function sendAuctionChat(){
    var input = document.getElementById('auctionChatInput');
    var statusEl = document.getElementById('auctionChatStatus');
    var btn = document.getElementById('auctionChatSend');
    if (!input || !_currentAuctionId) return;
    var text = input.value.trim();
    if (!text){ if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;">Type a message</span>'; return; }
    if (text.length>500){ if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;">Max 500 chars</span>'; return; }
    var cu = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser : null);
    if (!cu){
        if(statusEl) statusEl.innerHTML='<span style="color:#d97706;">Please <a href="pages/auth/login.html?redirect='+encodeURIComponent('auction-detail.html?id='+_currentAuctionId)+'" style="color:#0064d2;font-weight:700;">sign in</a> to chat</span>';
        return;
    }
    // During scheduled, only seller + waitlist can chat (to keep wait room exclusive)
    var st = _currentAuction ? getAuctionStatus(_currentAuction, Date.now()) : 'live';
    var isSeller = cu.uid === _currentAuction.sellerId;
    var isWaitlist = _waitlistCache.some(function(w){ return w._id===cu.uid; });
    var hasBid = _currentAuction && _currentAuction.bidCount>0; // allow bidders during live even if not waitlisted
    if (st==='scheduled' && !isSeller && !isWaitlist){
        if(statusEl) statusEl.innerHTML='<span style="color:#d97706;"><i class="fas fa-lock"></i> Join Waitlist to chat in waiting room</span>';
        return;
    }
    if (btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; }
    var senderName = (cu.displayName || (window.userData && (window.userData.firstName||window.userData.name)) || cu.email || 'User').split('@')[0];
    firebaseDB.collection('auctions').doc(_currentAuctionId).collection('chat').add({
        senderId: cu.uid,
        senderName: senderName,
        text: text,
        isSeller: isSeller,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(){
        input.value='';
        if(statusEl) statusEl.innerHTML='<span style="color:#16a34a;">Sent ✓</span>';
        setTimeout(function(){ if(statusEl) statusEl.textContent=''; }, 1500);
        try{ if(navigator.vibrate) navigator.vibrate(40); }catch(e){}
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Send'; }
    }).catch(function(err){
        console.error('chat send error', err, err.code);
        if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;">'+escapeHtml(err.message)+' (code:'+(err.code||'')+')</span>';
        try{ showFlashMessage('Chat send failed: '+err.message,'error'); }catch(e){}
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Send'; }
    });
}

function refreshWaitlistDebug(){
    var dbg = document.getElementById('waitlistDebug');
    if (dbg) dbg.textContent = 'Refreshing...';
    if (!_currentAuctionId) return;
    console.log('🔄 Manual refresh for', _currentAuctionId);
    firebaseDB.collection('auctions').doc(_currentAuctionId).collection('waitlist').get({source:'server'}).then(function(snap){
        console.log('🔄 Manual get — size', snap.size);
        _waitlistCache = [];
        snap.forEach(function(d){ var w=d.data(); w._id=d.id; _waitlistCache.push(w); });
        updateWaitlistUI();
        var dbg2 = document.getElementById('waitlistDebug');
        if (dbg2) dbg2.textContent = 'ID:' + _currentAuctionId.slice(0,6) + ' found:' + snap.size;
        try{ showFlashMessage('Waitlist: '+snap.size+' found','info'); }catch(e){}
    }).catch(function(err){
        console.error('manual refresh failed', err);
        try{ showFlashMessage('Refresh failed: '+err.message,'error'); }catch(e){}
        // Fallback without source
        firebaseDB.collection('auctions').doc(_currentAuctionId).collection('waitlist').get().then(function(snap2){
            console.log('🔄 Fallback get —', snap2.size);
            _waitlistCache = [];
            snap2.forEach(function(d){ var w=d.data(); w._id=d.id; _waitlistCache.push(w); });
            updateWaitlistUI();
        });
    });
}
async function joinWaitlist(){
    if (!_currentAuctionId) {
        var noAuctionStatus = document.getElementById('waitlistStatus');
        if (noAuctionStatus) noAuctionStatus.textContent = 'Auction is still loading. Please try again in a moment.';
        return;
    }
    var cu = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser)
        ? firebaseAuth.currentUser
        : (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser : null);
    if (!cu){
        var signInStatus = document.getElementById('waitlistStatus');
        if (signInStatus) signInStatus.innerHTML = '<span style="color:#d97706;">Please <a href="pages/auth/login.html?redirect='+encodeURIComponent('auction-detail.html?id='+_currentAuctionId)+'" style="color:#0064d2;font-weight:700;">sign in</a> to join waitlist</span>';
        setTimeout(function(){ window.location.href='pages/auth/login.html?redirect='+encodeURIComponent('auction-detail.html?id='+_currentAuctionId); }, 900);
        return;
    }
    if (!_currentAuction) {
        var loadingStatus = document.getElementById('waitlistStatus');
        if (loadingStatus) loadingStatus.textContent = 'Auction is still loading. Please try again in a moment.';
        return;
    }
    if (cu.uid === _currentAuction.sellerId){
        var sellerStatus = document.getElementById('waitlistStatus');
        if (sellerStatus) sellerStatus.textContent = 'You cannot join your own auction waitlist.';
        return;
    }
    if (getAuctionStatus(_currentAuction, Date.now()) !== 'scheduled') {
        var closedStatus = document.getElementById('waitlistStatus');
        if (closedStatus) closedStatus.textContent = 'The waiting room is closed for this auction.';
        return;
    }
    if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof firebaseDB.runTransaction !== 'function') {
        var dbStatus = document.getElementById('waitlistStatus');
        if (dbStatus) dbStatus.textContent = 'Could not connect. Please refresh and try again.';
        return;
    }

    var btn = document.getElementById('joinWaitlistBtn');
    var statusEl = document.getElementById('waitlistStatus');
    if (btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Joining...'; }
    if (statusEl) statusEl.textContent = 'Joining the waiting room…';
    var uid = String(cu.uid);
    var userName = (cu.displayName || (window.userData && (window.userData.firstName || window.userData.name)) || cu.email || 'User').split('@')[0];
    var joinedAt = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
        ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString();
    var waitlistRef = firebaseDB.collection('auctions').doc(_currentAuctionId).collection('waitlist').doc(uid);
    var entry = { userId: uid, userName: userName, displayName: userName, joinedAt: joinedAt };

    try {
        // Join is idempotent. The rules intentionally deny updates to waitlist docs,
        // so a stale page must read an existing entry rather than trying to set it again.
        var result = await firebaseDB.runTransaction(function (tx) {
            return tx.get(waitlistRef).then(function (existing) {
                if (existing.exists) return { alreadyJoined: true, data: existing.data() || entry };
                tx.set(waitlistRef, entry);
                return { alreadyJoined: false, data: entry };
            });
        });
        var cacheEntry = Object.assign({}, result.data || entry, { _id: uid });
        if (!_waitlistCache.some(function (w) { return String(w._id) === uid; })) _waitlistCache.push(cacheEntry);
        updateWaitlistUI();
        if (btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-check"></i> Joined'; }
        if (statusEl) statusEl.innerHTML = '<span style="color:#16a34a;"><i class="fas fa-check-circle"></i> ' +
            (result.alreadyJoined ? 'You are already on the waitlist.' : 'You joined the waiting room. We will notify you when bidding opens.') + '</span>';
        if (!result.alreadyJoined) try{ if(navigator.vibrate) navigator.vibrate([60,30,60]); }catch(e){}
    } catch(err) {
        console.error('joinWaitlist failed', err);
        if (btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-plus"></i> Join Waitlist'; }
        if (statusEl) statusEl.innerHTML = '<span style="color:#e74c3c;">Could not join: '+escapeHtml(err.message || 'Please try again.')+'</span>';
        try{ showFlashMessage('Could not join the waiting room: '+(err.message || err),'error'); }catch(e){}
    }
}

function leaveWaitlist(){
    if (!_currentAuctionId) return;
    var cu = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser : null);
    if (!cu) return;
    var btn = document.getElementById('leaveWaitlistBtn');
    if (btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Leaving...'; }
    firebaseDB.collection('auctions').doc(_currentAuctionId).collection('waitlist').doc(cu.uid).delete().then(function(){
        if (btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-sign-out-alt"></i> Leave'; }
    }).catch(function(err){
        if (btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-sign-out-alt"></i> Leave'; }
    });
}

// ============================================================================
// AUTO-ORDER - when auction ends, highest bidder automatically gets an order at bid price
// ============================================================================

function ensureAuctionWinnerOrder(auction){
    if (!auction || !auction._id) return;
    if (window._pendingWinnerOrders.has(auction._id)) return; // prevent concurrent duplicate creation
    window._pendingWinnerOrders.add(auction._id);
    var now = Date.now();
    var status = getAuctionStatus(auction, now);
    if (status !== 'ended') { window._pendingWinnerOrders.delete(auction._id); return; }
    if (!auction.currentBidderId || !auction.currentBid) { window._pendingWinnerOrders.delete(auction._id); return; }
    if (auction.winnerOrderId) { window._pendingWinnerOrders.delete(auction._id); return; } // already created
    // Do not create if already has order (check via flag)
    // Only winner or seller should trigger to satisfy Firestore rules (both allowed)
    var cu = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser : null);
    if (!cu) return;
    var isWinner = cu.uid === auction.currentBidderId;
    var isSeller = cu.uid === auction.sellerId;
    var isAdmin = window.userData && window.userData.role === 'admin';
    if (!isWinner && !isSeller && !isAdmin) return; // only winner/seller/admin can trigger
    // Check if order already exists for this auction (prevent duplicate)
    // NOTE: must filter by buyerId/sellerId to satisfy Firestore read rules (allow read only if buyerId/sellerId == auth.uid)
    var checkQuery;
    if (isWinner){
        checkQuery = firebaseDB.collection('orders').where('auctionId','==', auction._id).where('buyerId','==', cu.uid).limit(1);
    } else if (isSeller){
        checkQuery = firebaseDB.collection('orders').where('auctionId','==', auction._id).where('sellerId','==', cu.uid).limit(1);
    } else if (isAdmin){
        checkQuery = firebaseDB.collection('orders').where('auctionId','==', auction._id).limit(1);
    } else {
        return;
    }
    checkQuery.get().then(function(snap){
        if (!snap.empty) {
            var existingId = snap.docs[0].id;
            if (!auction.winnerOrderId){
                firebaseDB.collection('auctions').doc(auction._id).set({ winnerOrderId: existingId }, {merge:true}).catch(function(){});
            }
            // Cleanup duplicates if more than 1 (previous bug created many)
            if (snap.size > 1){
                console.warn('⚠️ Found', snap.size, 'duplicate orders for', auction._id, '— cleaning up');
                snap.docs.slice(1).forEach(function(d){
                    firebaseDB.collection('orders').doc(d.id).delete().catch(function(){});
                });
            }
            window._pendingWinnerOrders.delete(auction._id);
            return;
        }
        // Use the fee frozen on the auction; old auctions keep the seller-plan rate.
        var orderCommissionRate = auctionCommissionRateForOrder(auction);
        var commissionNote = orderCommissionRate === 0 ? '0% seller commission' : orderCommissionRate + '% seller commission';
        var orderId = auction._id; // one order per auction, deterministic
        var orderData = {
            auctionId: auction._id,
            isAuctionOrder: true,
            productId: auction.productId || null,
            productTitle: auction.title || 'Auction Item',
            productImage: (auction.images && auction.images[0]) || auction.productImage || '',
            amount: auction.currentBid,
            total: auction.currentBid,
            bidAmount: auction.currentBid,
            commission: orderCommissionRate,
            commissionAmount: Math.round(auction.currentBid * orderCommissionRate / 100 * 100)/100,
            sellerPayout: Math.round(auction.currentBid * (1 - orderCommissionRate / 100) * 100)/100,
            buyerId: auction.currentBidderId,
            buyerName: auction.currentBidderName || 'Winner',
            sellerId: auction.sellerId,
            sellerName: auction.sellerName || 'Seller',
            status: 'pending',
            paymentStatus: 'pending',
            escrowStatus: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            auctionEndAt: auction.endAt || null
        };
        // Use transaction with deterministic ID to guarantee single order even if winner+seller race
        return firebaseDB.runTransaction(function(tx){
            var orderRef = firebaseDB.collection('orders').doc(orderId);
            var auctionRef = firebaseDB.collection('auctions').doc(auction._id);
            return tx.get(orderRef).then(function(oDoc){
                if (oDoc.exists) throw new Error('order already exists');
                return tx.get(auctionRef).then(function(aDoc){
                    if (aDoc.exists && aDoc.data().winnerOrderId) throw new Error('winnerOrderId already set');
                    tx.set(orderRef, orderData);
                    tx.set(auctionRef, { winnerOrderId: orderId, winnerOrderCreatedAt: firebase.firestore.FieldValue.serverTimestamp() }, {merge:true});
                });
            });
        }).then(function(){
            var ref = {id: orderId};

            // Also create conversation so winner can contact seller directly
            var convPromise = firebaseDB.collection('conversations').where('auctionId','==', auction._id).where('participants','array-contains', auction.currentBidderId).limit(1).get().then(function(snap){
                if (!snap.empty) return;
                return firebaseDB.collection('conversations').add({
                    participants: [auction.sellerId, auction.currentBidderId],
                    participantNames: {},
                    auctionId: auction._id,
                    productId: auction.productId || null,
                    productTitle: auction.title || 'Auction Item',
                    productImage: (auction.images && auction.images[0]) || auction.productImage || '',
                    productPrice: auction.currentBid,
                    lastMessage: '🎉 You won the auction "' + (auction.title||'Auction') + '" at GHS ' + auction.currentBid.toLocaleString() + '! Contact seller to arrange delivery.',
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isAuctionConversation: true,
                    unreadBy: [auction.sellerId, auction.currentBidderId]
                }).then(function(convRef){
                    return convRef.collection('messages').add({
                        senderId: auction.sellerId,
                        senderName: auction.sellerName || 'Seller',
                        participants: [auction.sellerId, auction.currentBidderId],   // required by the security rules
                        text: '🎉 Congratulations! You won the auction "' + (auction.title||'Auction') + '" at GHS ' + auction.currentBid.toLocaleString() + '.\n\nOrder #' + ref.id.substring(0,8) + ' has been placed automatically at your bid price (' + commissionNote + ', deducted from the seller payout; escrow protected). Please reply here to arrange delivery/pickup.\n\n— Sankofa Market',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        status: 'sent'
                    });
                });
            }).catch(function(e){ console.warn('auction conv create skip', e); });
            return firebaseDB.collection('auctions').doc(auction._id).set({ winnerOrderId: ref.id, winnerOrderCreatedAt: firebase.firestore.FieldValue.serverTimestamp() }, {merge:true}).then(function(){
                return convPromise.then(function(){
                    window._pendingWinnerOrders.delete(auction._id);
                console.log('✅ Auction order + conversation auto-created:', ref.id, 'at GHS', auction.currentBid);
                    try{ showFlashMessage('Order placed for winner at GHS '+auction.currentBid.toLocaleString()+' - check Messages to contact seller', 'success'); }catch(e){}
                });
            });
        });
    }, function(err){
        console.warn('ensureAuctionWinnerOrder check failed (will still try create):', err && err.message);
        // Fallback: if query failed due to index/permission and winnerOrderId is still empty, try to create
        if (auction.winnerOrderId) return;
        // Try to create order despite check failure - Firestore will enforce duplicate via winnerOrderId later
        // We need to re-run creation logic - duplicate code below will not run, so we trigger creation here
        // For simplicity, just proceed to creation by re-invoking the same flow (create orderData)
        // Create the fallback order with the same saved seller commission.
        var _orderCommissionRate = auctionCommissionRateForOrder(auction);
        var _orderFeeNote = _orderCommissionRate === 0 ? '0% seller commission' : _orderCommissionRate + '% seller commission';
        var _orderData = {
            auctionId: auction._id,
            isAuctionOrder: true,
            productId: auction.productId || null,
            productTitle: auction.title || 'Auction Item',
            productImage: (auction.images && auction.images[0]) || auction.productImage || '',
            amount: auction.currentBid,
            total: auction.currentBid,
            bidAmount: auction.currentBid,
            commission: _orderCommissionRate,
            commissionAmount: Math.round(auction.currentBid * _orderCommissionRate / 100 * 100)/100,
            sellerPayout: Math.round(auction.currentBid * (1 - _orderCommissionRate / 100) * 100)/100,
            buyerId: auction.currentBidderId,
            buyerName: auction.currentBidderName || 'Winner',
            sellerId: auction.sellerId,
            sellerName: auction.sellerName || 'Seller',
            status: 'pending',
            paymentStatus: 'pending',
            escrowStatus: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            auctionEndAt: auction.endAt || null
        };
        var _orderId2 = auction._id;
        return firebaseDB.runTransaction(function(tx2){
            var oRef2 = firebaseDB.collection('orders').doc(_orderId2);
            var aRef2 = firebaseDB.collection('auctions').doc(auction._id);
            return tx2.get(oRef2).then(function(d){
                if (d.exists) throw new Error('order exists fallback');
                return tx2.get(aRef2).then(function(ad){
                    if (ad.exists && ad.data().winnerOrderId) throw new Error('winnerOrderId exists');
                    tx2.set(oRef2, _orderData);
                    tx2.set(aRef2, { winnerOrderId: _orderId2, winnerOrderCreatedAt: firebase.firestore.FieldValue.serverTimestamp() }, {merge:true});
                });
            });
        }).then(function(){ var ref={id:_orderId2};
            var convPromise2 = firebaseDB.collection('conversations').where('auctionId','==', auction._id).where('participants','array-contains', auction.currentBidderId).limit(1).get().then(function(snap){
                if (!snap.empty) return;
                return firebaseDB.collection('conversations').add({
                    participants: [auction.sellerId, auction.currentBidderId],
                    participantNames: {},
                    auctionId: auction._id,
                    productId: auction.productId || null,
                    productTitle: auction.title || 'Auction Item',
                    productImage: (auction.images && auction.images[0]) || auction.productImage || '',
                    productPrice: auction.currentBid,
                    lastMessage: '🎉 You won the auction "' + (auction.title||'Auction') + '" at GHS ' + auction.currentBid.toLocaleString() + '! Contact seller to arrange delivery.',
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isAuctionConversation: true,
                    unreadBy: [auction.sellerId, auction.currentBidderId]
                }).then(function(convRef){
                    return convRef.collection('messages').add({
                        senderId: auction.sellerId,
                        senderName: auction.sellerName || 'Seller',
                        participants: [auction.sellerId, auction.currentBidderId],   // required by the security rules
                        text: '🎉 Congratulations! You won the auction "' + (auction.title||'Auction') + '" at GHS ' + auction.currentBid.toLocaleString() + '.\n\nOrder #' + _orderId2.substring(0,8) + ' has been placed automatically at your bid price (' + _orderFeeNote + ', deducted from the seller payout; escrow protected). Please reply here to arrange delivery/pickup.\n\n— Sankofa Market',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        status: 'sent'
                    });
                });
            }).catch(function(e){});
            return convPromise2.then(function(){
                window._pendingWinnerOrders.delete(auction._id);
            console.log('✅ Auction order (fallback) auto-created:', _orderId2);
                try{ showFlashMessage('Order placed for winner at GHS '+auction.currentBid.toLocaleString(), 'success'); }catch(e){}
            });
        }).catch(function(err){
            if (err && err.message && err.message.indexOf('already exists')!==-1){
                console.log('Order already exists, skipping duplicate');
                window._pendingWinnerOrders.delete(auction._id);
                return;
            }
            console.warn('ensureAuctionWinnerOrder error', err);
            window._pendingWinnerOrders.delete(auction._id);
            window._pendingWinnerOrders.delete(auction._id);
        });
    });
    // Ensure pending flag cleared after async paths complete (also cleared in success handlers via finally-like)
    // Success handlers will clear via setTimeout to allow transaction to complete
    setTimeout(function(){ window._pendingWinnerOrders.delete(auction._id); }, 5000);
}

// ============================================================================
// CANCEL AUCTION - seller cancels if waitlist not encouraging, sends apology
// ============================================================================

function cancelAuction(){
    if (!_currentAuction || !_currentAuctionId) return;
    var isSeller = false;
    try{
        var cu = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser : null);
        isSeller = cu && cu.uid === _currentAuction.sellerId;
    }catch(e){}
    if (!isSeller){
        try{ showFlashMessage('Only the seller can cancel this auction', 'error'); }catch(e){ alert('Only seller can cancel'); }
        return;
    }
    var waitCount = _waitlistCache ? _waitlistCache.length : 0;
    var msg = 'Cancel auction "' + (_currentAuction.title||'Auction') + '"?\n\n';
    if (waitCount > 0) msg += waitCount + ' user' + (waitCount!==1?'s':'') + ' on waitlist will receive an apology letter.\n\n';
    else msg += 'No one on waitlist yet.\n\n';
    msg += 'This cannot be undone.';
    if (!confirm(msg)) return;
    var btn = document.getElementById('cancelAuctionBtn');
    if (btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Cancelling...'; }
    // Update auction status to cancelled
    firebaseDB.collection('auctions').doc(_currentAuctionId).update({
        status: 'cancelled',
        cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
        cancelledBy: _currentAuction.sellerId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(){
        // Send apology letters to waitlist
        if (waitCount === 0){
            try{ showFlashMessage('Auction cancelled - no waitlist to notify', 'success'); }catch(e){}
            return;
        }
        var sellerName = _currentAuction.sellerName || 'Seller';
        var auctionTitle = _currentAuction.title || 'Auction';
        var promises = [];
        _waitlistCache.forEach(function(w){
            var apology = {
                userId: w.userId || w._id,
                type: 'auction_cancelled',
                title: 'Auction Cancelled - Apology',
                message: 'Dear ' + (w.userName||'there') + ',\n\nWe sincerely apologize - the auction "' + auctionTitle + '" by ' + sellerName + ' has been cancelled by the seller due to low interest (' + waitCount + ' on waitlist, not encouraging).\n\nYou have not been charged. Please explore other auctions at https://sankofa-market.web.app/auction.html or browse listings.\n\nThank you for your understanding.\n\n- Sankofa Market Team',
                auctionId: _currentAuctionId,
                auctionTitle: auctionTitle,
                sellerName: sellerName,
                sellerId: _currentAuction.sellerId,
                waitlistCount: waitCount,
                isRead: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            // Create notification for each waitlist user
            var p = firebaseDB.collection('notifications').add(apology).catch(function(e){ console.warn('notify fail', e); });
            promises.push(p);
            // Also try to create a direct message conversation for more visibility (optional, best-effort)
            try{
                // Create a system conversation: seller -> waitlist user with apology
                var convId = [_currentAuction.sellerId, w.userId||w._id].sort().join('_') + '_auction_' + _currentAuctionId;
                // We use notifications as primary; conversations as secondary if needed
            }catch(e){}
        });
        return Promise.all(promises).then(function(){
            try{ showFlashMessage('Cancelled - apology sent to '+waitCount+' user'+(waitCount!==1?'s':'')+' on waitlist', 'success'); }catch(e){}
        });
    }).catch(function(err){
        console.error('cancel error', err);
        try{ showFlashMessage('Could not cancel: '+err.message, 'error'); }catch(e){ alert('Could not cancel: '+err.message); }
        if (btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-times"></i> Cancel Auction'; }
    });
}

// ============================================================================
// DELETE / CLEAR ENDED AUCTIONS — seller can delete own ended, admin any
// ============================================================================
function deleteAuction(auctionId, title){
    if (!auctionId) return;
    var cu = (typeof firebaseAuth !== 'undefined' && firebaseAuth && firebaseAuth.currentUser) ? firebaseAuth.currentUser
           : (window.currentUser || (window.userData && window.userData.uid ? { uid: window.userData.uid } : null));
    if (!cu){ alert('Please sign in to remove an auction'); return; }

    firebaseDB.collection('auctions').doc(auctionId).get().then(function(doc){
        if (!doc.exists){ try{ showFlashMessage('Auction not found','info'); }catch(e){} return; }
        var a = doc.data(); a._id = auctionId;
        var st = getAuctionStatus(a, Date.now());

        // Only ended / cancelled auctions should be removed — warn otherwise
        if (st !== 'ended' && st !== 'cancelled'){
            if (!confirm('This auction is still ' + st + '. Remove it anyway?\n\nBidders would lose it without warning. Consider cancelling first.')) return;
        }

        var name = title || a.title || 'this auction';

        // Permission: the seller owns it, or the viewer is a real admin.
        // (window.userData is not always loaded when a page first paints, so ask properly.)
        var isOwner = cu.uid === a.sellerId;
        if (!isOwner && window._auctionIsAdmin !== true) {
            resolveAuctionAdmin(function (isAdminNow) {
                if (!isAdminNow) {
                    alert('Only the seller of this auction or an admin can remove it.\n\nThis auction belongs to ' +
                        (a.sellerName || 'another seller') + '.');
                    return;
                }
                confirmAndRemove(auctionId, a, name, st, true);
            });
            return;
        }
        confirmAndRemove(auctionId, a, name, st, !isOwner);
    }).catch(function(err){
        console.error('delete error', err);
        try{ showFlashMessage('Could not remove: ' + err.message, 'error'); }catch(e){ alert('Could not remove: ' + err.message); }
    });
}

/** Second confirmation + the actual removal. */
function confirmAndRemove(auctionId, a, name, st, isAdminAction) {
    var winner = a.currentBidderId || a.currentBidderName;
    var extra = '';
    if (winner) {
        extra = '\n\nNOTE: this auction has a winner' +
            (a.winnerOrderId ? ' and an order was created' : '') +
            '. The order and the winner\'s chat history are NOT deleted — the buyer keeps their order. ' +
            'Only the auction (and its bids, waitlist and chat room) is removed.';
    }
    if (!confirm('Remove this ' + st + ' auction "' + name + '"?' + extra + '\n\nThis cannot be undone.')) return;

    // Hide it immediately so the UI responds even on a slow connection
    try{ localStorage.setItem('deleted_auction_' + auctionId, '1'); }catch(e){}
    if (window._lastEndedList) {
        window._lastEndedList = window._lastEndedList.filter(function(x){ return x._id !== auctionId; });
        var c = document.getElementById('endedAuctionsGrid');
        if (c) renderEndedAuctions(window._lastEndedList, c);
    }

    function clearSub(name) {
        return firebaseDB.collection('auctions').doc(auctionId).collection(name).get()
            .then(function (snap) {
                if (snap.empty) return null;
                var batch = firebaseDB.batch();
                snap.forEach(function (d) { batch.delete(d.ref); });
                return batch.commit().catch(function (e) { console.warn('could not clear ' + name, e && e.message); });
            })
            .catch(function (e) { console.warn('could not read ' + name, e && e.message); });
    }

    // bids -> waitlist -> chat -> the auction itself
    clearSub('bids')
        .then(function(){ return clearSub('waitlist'); })
        .then(function(){ return clearSub('chat'); })
        .then(function(){ return firebaseDB.collection('auctions').doc(auctionId).delete(); })
        .then(function(){
            try{ showFlashMessage('Auction removed' + (isAdminAction ? ' (admin)' : ''), 'success'); }catch(e){}
            setTimeout(function(){
                if (window.location.pathname.indexOf('auction.html') !== -1) {
                    window.location.reload();
                } else if (window.location.pathname.indexOf('auction-detail') !== -1 && _currentAuctionId === auctionId) {
                    window.location.href = 'auction.html';
                }
            }, 900);
        })
        .catch(function(err){
            console.error('delete error', err);
            try{ localStorage.removeItem('deleted_auction_' + auctionId); }catch(e){}
            try{ showFlashMessage('Could not remove: ' + err.message, 'error'); }catch(e){ alert('Could not remove: ' + err.message); }
        });
}

function clearEndedAuctions(){
    var cu = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser : null);
    if (!cu){ alert('Sign in first'); return; }
    var isAdmin = window._auctionIsAdmin === true;
    if (!isAdmin && !window._auctionAdminChecked) {
        // Role not resolved yet — resolve it, then run the same function again
        resolveAuctionAdmin(function () { clearEndedAuctions(); });
        return;
    }
    // Find ended auctions for this user (or all if admin and confirms)
    var q = isAdmin ? firebaseDB.collection('auctions') : firebaseDB.collection('auctions').where('sellerId','==',cu.uid);
    q.get().then(function(snap){
        var toDelete = [];
        var now = Date.now();
        snap.forEach(function(doc){
            var a=doc.data(); a._id=doc.id;
            var st = getAuctionStatus(a, now);
            if (st==='ended' || st==='cancelled'){
                if (isAdmin || a.sellerId===cu.uid) toDelete.push(a);
            }
        });
        if (toDelete.length===0){ alert('No ended auctions to clear'); return; }
        var msg = isAdmin ? 'Delete ALL '+toDelete.length+' ended/cancelled auctions (all sellers)?' : 'Delete your '+toDelete.length+' ended/cancelled auction'+(toDelete.length>1?'s':'')+'?';
        if (!confirm(msg+'\n\nThis cannot be undone.')) return;
        var promises = toDelete.map(function(a){
            return firebaseDB.collection('auctions').doc(a._id).collection('bids').get().then(function(s){ var b=firebaseDB.batch(); s.forEach(function(d){b.delete(d.ref);}); return b.commit().catch(function(){}); })
            .then(function(){ return firebaseDB.collection('auctions').doc(a._id).collection('waitlist').get().then(function(s){ var b2=firebaseDB.batch(); s.forEach(function(d){b2.delete(d.ref);}); return b2.commit().catch(function(){}); }); })
            .then(function(){ return firebaseDB.collection('auctions').doc(a._id).delete().catch(function(e){ console.warn('delete fail',a._id,e.message); }); });
        });
        return Promise.all(promises).then(function(){
            // Optimistic: mark all as deleted locally
            toDelete.forEach(function(a){ try{ localStorage.setItem('deleted_auction_' + a._id, '1'); }catch(e){} });
            if (window._lastEndedList) {
                var ids = toDelete.map(function(x){return x._id;});
                window._lastEndedList = window._lastEndedList.filter(function(x){ return ids.indexOf(x._id)===-1; });
                var c2 = document.getElementById('endedAuctionsGrid');
                if (c2) renderEndedAuctions(window._lastEndedList, c2);
            }
            try{ showFlashMessage('Cleared '+toDelete.length+' ended auction'+(toDelete.length>1?'s':''),'success'); }catch(e){}
            setTimeout(function(){ if(window.location.pathname.indexOf('auction.html')!==-1) window.location.reload(); }, 900);
        });
    }).catch(function(err){ console.error('clear error',err); alert('Could not clear: '+err.message); });
}

// ============================================================================
// ============================================================================
// BUY IT NOW (#8) + tier-aware fee label (#7)
// ============================================================================

/* ---- The saved fee is frozen on each new auction; older auctions use the seller-plan rate. ---- */
var SM_AUCTION_FEE_RATES = { bronze: 2, silver: 1.5, gold: 1.2, diamond: 0 };
function validAuctionCommissionPercent(value){
    if (typeof value !== 'number' || !isFinite(value) || value < 0 || value > 100) return null;
    return Math.round(value * 100) / 100;
}
function auctionCommissionPercentFromSnapshot(auction){
    if (!auction || !Object.prototype.hasOwnProperty.call(auction, 'auctionCommissionPercent')) return null;
    return validAuctionCommissionPercent(auction.auctionCommissionPercent);
}
function legacyAuctionCommissionPercent(){
    // Preserve the old browser-created order estimate for auctions without a saved rate.
    // The server's existing payout rules still decide the real plan-based commission.
    return 5;
}
function auctionCommissionRateForOrder(auction){
    var saved = auctionCommissionPercentFromSnapshot(auction);
    return saved !== null ? saved : legacyAuctionCommissionPercent(auction);
}
function showAuctionCommissionPercent(rate, tier){
    var rateLabel = String(rate) + '%';
    var el1 = document.getElementById('auctionSellerFee');
    if (el1) el1.textContent = (tier ? String(tier).toUpperCase() : 'SELLER') + ' • ' + rateLabel + ' fee';
    var explanation = 'Seller commission is ' + rateLabel + ' and is deducted from the seller\'s earnings. You pay only your winning bid.';
    if (rate === 0) explanation = 'There is no seller commission. The seller keeps every cedi, and you pay only your winning bid.';
    var el2 = document.getElementById('auctionFeeInfo');
    if (el2) el2.textContent = explanation;
    var summary = document.getElementById('auctionFeeSummary');
    if (summary) summary.textContent = rateLabel + ' seller commission, deducted from the seller\'s payout.';
}
function fillAuctionFeeInfo(sellerId, auction){
    if (!sellerId) return;
    var auctionData = auction || (_currentAuction && _currentAuction.sellerId === sellerId ? _currentAuction : null);
    var frozenRate = auctionCommissionPercentFromSnapshot(auctionData);
    if (frozenRate !== null){
        showAuctionCommissionPercent(frozenRate, 'AUCTION');
        return;
    }
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    var auctionId = auctionData && auctionData._id;
    firebaseDB.collection('sellerPublic').doc(sellerId).get().then(function(doc){
        if (auctionId && _currentAuctionId && auctionId !== _currentAuctionId) return;
        var m = doc.exists ? doc.data() : {};
        var tier = String(m.tier || '').toLowerCase();
        var exp = m.premiumExpiry ? (m.premiumExpiry.toDate ? m.premiumExpiry.toDate() : new Date(m.premiumExpiry)) : null;
        var active = tier && Object.prototype.hasOwnProperty.call(SM_AUCTION_FEE_RATES, tier) && exp && exp.getTime() > Date.now();
        var rate = active ? SM_AUCTION_FEE_RATES[tier] : 5;
        showAuctionCommissionPercent(rate, active ? tier : 'SELLER');
    }).catch(function(){ /* keep the generic fee wording */ });
}

/* ---- "Buy It Now": first taker wins instantly at the seller's fixed price.
 * The browser only asks; the server function (buyAuctionNow) checks everything
 * and ends the auction. */
function auctionBuyNow(){
    var a = _currentAuction;
    if (!a) return;
    var user = (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : null;
    var statusEl = document.getElementById('bidStatus');
    if (!user){
        if (statusEl){ statusEl.innerHTML = '<span style="color:#e74c3c;">Sign in to buy instantly.</span>'; }
        return;
    }
    var bin = Number(a.buyNowPrice) || 0;
    if (!(bin > 0)) return;
    if (!confirm('Buy "' + (a.title || 'this item') + '" instantly for GHS ' + bin.toLocaleString() + '?\n\nThe auction ends right away in your favour — no bidding war, and the price is locked.\n\nYou will pay from My Orders (escrow protected).')) return;
    var btn = document.getElementById('buyNowBtn');
    if (btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ending auction for you...'; }
    if (statusEl){ statusEl.innerHTML = '<span style="color:#0064d2;"><i class="fas fa-bolt"></i> Locking in your Buy-It-Now win...</span>'; }
    firebase.functions().httpsCallable('buyAuctionNow')({ auctionId: a._id }).then(function(res){
        var msg = (res && res.data && res.data.message) || 'Won!';
        alert('🎉 ' + msg);
        window.location.href = 'pages/user/orders.html';
    }).catch(function(err){
        var msg = (err && err.message) || 'Could not complete Buy-It-Now right now.';
        if (statusEl){ statusEl.innerHTML = '<span style="color:#e74c3c;">' + escapeHtml(msg) + '</span>'; }
        if (btn){ btn.disabled = false; btn.innerHTML = '<i class="fas fa-bolt"></i> Buy It Now — skip the bidding'; }
    });
}

// CREATE AUCTION PAGE

// pages/user/create-auction.html
// ============================================================================

var _userProductsCache = [];
function initCreateAuction(){
    var form = document.getElementById('createAuctionForm');
    if (!form) return;
    if (typeof firebaseDB==='undefined' || typeof firebaseAuth==='undefined'){ setTimeout(initCreateAuction, 700); return; }

    var gate = document.getElementById('auctionPremiumGate');
    var formWrap = document.getElementById('auctionFormWrap');
    var statusEl = document.getElementById('createAuctionStatus');
    var productSelect = document.getElementById('auctionProductSelect');
    var priceInput = document.getElementById('auctionStartingPrice');
    var incrementInput = document.getElementById('auctionBidIncrement');
    var durationSelect = document.getElementById('auctionDuration');
    var customImagesInput = document.getElementById('auctionCustomImages');
    var titleInput = document.getElementById('auctionTitle');
    var descInput = document.getElementById('auctionDescription');
    var feeNoteEl = document.getElementById('auctionFeeNote');
    var presentedAuctionFeeRate = null;
    var presentedAuctionFeeSource = 'loading';
    var sellerPlanFeeRate = 5;
    function showCreateAuctionFee(rate, source){
        presentedAuctionFeeRate = rate;
        presentedAuctionFeeSource = source;
        if (!feeNoteEl) return;
        var sourceLabel = source === 'global' ? 'admin-set rate for new auctions' : 'current seller-plan rate';
        feeNoteEl.textContent = 'Seller commission: ' + rate + '% (' + sourceLabel + '). It is deducted from seller earnings; the winner pays only the bid.';
    }

    firebaseAuth.onAuthStateChanged(function(user){
        if (!user){
            if (gate) gate.innerHTML = '<div style="background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;padding:1.8rem;text-align:center;"><i class="fas fa-lock" style="font-size:2rem;color:#5f6b7a;"></i><h3 style="margin:0.7rem 0 0.3rem;">Sign in to create auctions</h3><p style="color:#5a6572;font-size:0.85rem;">Auctions are a Premium feature. The seller commission is shown before you start.</p><a href="../auth/login.html?redirect=create-auction.html" class="btn btn-primary" style="margin-top:0.8rem;">Sign In</a></div>';
            if (formWrap) formWrap.style.display='none';
            return;
        }
        // Load user doc to check premium
        firebaseDB.collection('users').doc(user.uid).get().then(function(doc){
            var data = doc.exists ? doc.data() : {};
            var isPremium = isPremiumAuctionUser(data);
            if (!isPremium){
                if (gate) gate.innerHTML = '<div style="background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%);border:2px solid #fde68a;border-radius:14px;padding:1.6rem;text-align:center;">'
                    + '<div style="width:52px;height:52px;background:linear-gradient(135deg,#f5af02 0%,#e09e00 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#191919;font-size:1.4rem;margin:0 auto;box-shadow:0 4px 12px rgba(245,175,2,0.3);"><i class="fas fa-crown"></i></div>'
                    + '<h3 style="margin:0.8rem 0 0.3rem;color:#92400e;">Premium required to auction</h3>'
                    + '<p style="color:#78350f;font-size:0.85rem;margin:0;">Auctions are a <strong>Premium-only</strong> feature. The seller commission is set by Sankofa Market Admin and is shown before you start; winning buyers pay only their bids. You also get <strong>blinking amber/red header alerts</strong> for all users.</p>'
                    + '<div style="margin-top:0.9rem;display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">'
                    + '<a href="become-seller.html" style="background:linear-gradient(135deg,#f5af02 0%,#e09e00 100%);color:#191919;padding:0.7rem 1.2rem;border-radius:8px;font-weight:800;text-decoration:none;font-size:0.85rem;"><i class="fas fa-crown"></i> View Premium Plans - from GHS 45/mo</a>'
                    + '<a href="../../auction.html" style="background:#fff;border:1.5px solid #e5e7eb;color:#374151;padding:0.7rem 1.2rem;border-radius:8px;font-weight:700;text-decoration:none;font-size:0.85rem;"><i class="fas fa-gavel"></i> View Auctions</a>'
                    + '</div>'
                    + '<p style="font-size:0.7rem;color:#a16207;margin:0.7rem 0 0;">Premium sellers can start auctions. The current seller commission will be shown before the auction starts.</p>'
                    + '</div>';
                if (formWrap) formWrap.style.display='none';
                return;
            }
            // Premium - show form
            if (gate) gate.style.display='none';
            if (formWrap) formWrap.style.display='block';
            var feeTier = String(data.premiumTier || data.sellerTier || '').toLowerCase();
            var feeExpiry = data.premiumExpiry ? (data.premiumExpiry.toDate ? data.premiumExpiry.toDate() : new Date(data.premiumExpiry)) : null;
            var feeTierActive = feeTier && Object.prototype.hasOwnProperty.call(SM_AUCTION_FEE_RATES, feeTier) && feeExpiry && feeExpiry.getTime() > Date.now();
            sellerPlanFeeRate = data.isFoundingSeller === true ? 0 : (feeTierActive ? SM_AUCTION_FEE_RATES[feeTier] : 5);
            firebaseDB.collection('settings').doc('auctionCommission').get().then(function(feeDoc){
                if (!feeDoc.exists){ showCreateAuctionFee(sellerPlanFeeRate, 'plan'); return; }
                var savedRate = validAuctionCommissionPercent((feeDoc.data() || {}).sellerCommissionPercent);
                if (savedRate === null){
                    presentedAuctionFeeRate = null;
                    presentedAuctionFeeSource = 'invalid';
                    if (feeNoteEl) feeNoteEl.textContent = 'The saved auction commission is invalid. Please contact Sankofa Market Admin before starting.';
                    return;
                }
                showCreateAuctionFee(savedRate, 'global');
            }).catch(function(){
                presentedAuctionFeeRate = null;
                presentedAuctionFeeSource = 'unknown';
                if (feeNoteEl) feeNoteEl.textContent = 'Could not verify the auction commission. Please wait or refresh before starting.';
            });
            // Load products for selector — admin sees all recent listings, sellers see own
            var isAdminUser = data.role === 'admin';
            var prodQuery = isAdminUser
                ? firebaseDB.collection('products').orderBy('createdAt','desc').limit(50)
                : firebaseDB.collection('products').where('sellerId','==',user.uid).limit(30);
            prodQuery.get().then(function(snap){
                _userProductsCache = [];
                snap.forEach(function(d){ var p=d.data(); p._id=d.id; _userProductsCache.push(p); });
                if (productSelect){
                    productSelect.innerHTML = '<option value="">-- Select item to auction * --</option>';
                    _userProductsCache.forEach(function(p){
                        var sellerHint = isAdminUser && p.sellerId !== user.uid ? ' (by '+ (p.sellerName||'seller') +')' : '';
                        var label = p.title + ' - GHS '+(p.price||0).toLocaleString() + sellerHint + (p.isSold? ' (sold)':'');
                        var opt = document.createElement('option');
                        opt.value = p._id;
                        opt.textContent = label;
                        productSelect.appendChild(opt);
                    });
                    if (_userProductsCache.length===0){
                        productSelect.innerHTML = '<option value="">No listings found — list an item first at Publish</option>';
                    }
                }
                // For admin, show hint
                if (isAdminUser && statusEl){
                    statusEl.innerHTML = '<span style="color:#0064d2;"><i class="fas fa-crown"></i> Admin: you can auction any listing (50 recent shown)</span>';
                }
            }).catch(function(err){
                console.warn('product load error', err);
                if (productSelect) productSelect.innerHTML = '<option value="">Error loading listings: '+err.message+'</option>';
            });
            // Product select change -> autofill
            if (productSelect){
                productSelect.addEventListener('change', function(){
                    var pid = this.value;
                    if (!pid){
                        if (statusEl) statusEl.innerHTML = '<span style="color:#e74c3c;">Please select a listed item to auction.</span>';
                        return;
                    }
                    var prod = _userProductsCache.find(function(x){ return x._id===pid; });
                    if (prod){
                        if (titleInput && !titleInput.value) titleInput.value = prod.title||'';
                        if (descInput && !descInput.value) descInput.value = (prod.description||'').substring(0,300);
                        if (priceInput && !priceInput.value) priceInput.value = Math.max(10, Math.floor((prod.price||100)*0.7));
                    }
                });
            }
        });
    });

    form.addEventListener('submit', function(e){
        e.preventDefault();
        var user = firebaseAuth.currentUser;
        if (!user){ if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;">Please sign in.</span>'; return; }
        var title = titleInput ? titleInput.value.trim() : '';
        var description = descInput ? descInput.value.trim() : '';
        var startingPrice = priceInput ? parseInt(priceInput.value,10) : 0;
        var bidIncrement = incrementInput ? parseInt(incrementInput.value,10) : 10;
        var durationMin = durationSelect ? parseInt(durationSelect.value,10) : 10;
        // ---- premium auction tools (#8): optional reserve + Buy-It-Now ----
        var reserveInput = document.getElementById('auctionReservePrice');
        var buyNowInput = document.getElementById('auctionBuyNowPrice');
        var reservePrice = reserveInput ? parseInt(reserveInput.value,10) : 0;
        if (isNaN(reservePrice) || reservePrice < 0) reservePrice = 0;
        var buyNowPrice = buyNowInput ? parseInt(buyNowInput.value,10) : 0;
        if (isNaN(buyNowPrice) || buyNowPrice < 0) buyNowPrice = 0;
        var waitingSelect = document.getElementById('auctionWaitingTime');
        var waitingMin = waitingSelect ? parseInt(waitingSelect.value,10) : 2;
        if (isNaN(waitingMin) || waitingMin < 0) waitingMin = 2;
        if (waitingMin > 60) waitingMin = 60;
        var productId = productSelect ? productSelect.value : '';
        if (!productId){ if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;"><i class="fas fa-exclamation-triangle"></i> You can only auction an already listed item. Please select one.</span>'; return; }

        if (!title){ if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;">Enter auction title.</span>'; return; }
        if (!startingPrice || startingPrice < 5){ if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;">Starting price must be at least GHS 5.</span>'; return; }
        if (reservePrice && reservePrice < startingPrice){ if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;"><i class="fas fa-exclamation-triangle"></i> Reserve price must be at least the starting price (GHS '+startingPrice+') — otherwise it protects nothing.</span>'; return; }
        if (buyNowPrice && buyNowPrice <= startingPrice){ if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;"><i class="fas fa-exclamation-triangle"></i> Buy-It-Now must be ABOVE the starting price — nobody overpays to skip a bid.</span>'; return; }
        if (buyNowPrice && reservePrice && buyNowPrice < reservePrice){ if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;"><i class="fas fa-exclamation-triangle"></i> Buy-It-Now should be at least your reserve price — otherwise someone could win below your floor.</span>'; return; }
        if (!bidIncrement || bidIncrement < 5){ if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;">Bid increment min GHS 5.</span>'; return; }

        var btn = document.getElementById('createAuctionBtn');
        var origBtn = btn ? btn.innerHTML : '';
        if (btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Starting auction...'; }
        var waitLabel = waitingMin===0 ? 'instantly' : (waitingMin===1 ? '1 minute' : waitingMin+' minutes');
        if (statusEl) statusEl.innerHTML='<span style="color:#0064d2;"><i class="fas fa-bolt"></i> Creating auction - header will blink <span style="background:#f59e0b;color:#fff;padding:0.1rem 0.3rem;border-radius:4px;">amber '+waitLabel+'</span> then <span style="background:#ef4444;color:#fff;padding:0.1rem 0.3rem;border-radius:4px;">red LIVE</span> ...</span>';

        // Get seller profile for name/tier
        firebaseDB.collection('users').doc(user.uid).get().then(function(doc){
            var ud = doc.exists ? doc.data() : {};
            var sellerName = ud.firstName || ud.name || (ud.email? ud.email.split('@')[0] : 'Premium Seller');
            var sellerTier = ud.premiumTier || ud.sellerTier || 'premium';
            // (#7) the real fee comes from the seller's live tier at close time — the
            // browser no longer stamps any commission number on the auction.
            // Images: use product images if product selected, else custom upload preview? For MVP, use product images or placeholder
            var images = [];
            var location = 'Ghana';
            var category = 'general';
            if (productId){
                var prod = _userProductsCache.find(function(x){ return x._id===productId; });
                if (prod){
                    images = prod.images || prod.photos || [];
                    if (prod.location) location = typeof prod.location==='string' ? prod.location : (prod.location.city||'Ghana');
                    if (prod.category) category = prod.category;
                }
            }
            if (images.length===0){
                if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;">Selected listing has no images.</span>';
                if (btn){ btn.disabled=false; btn.innerHTML=origBtn; }
                return;
            }

            // Create auction with customizable waiting time (amber blink before live)
            var now = new Date();
            var waitingMs = waitingMin * 60 * 1000;
            var startAt = new Date(now.getTime() + waitingMs);
            var endAt = new Date(startAt.getTime() + durationMin*60*1000);

            var auctionData = {
                title: title,
                description: description || title,
                productId: productId || null,
                sellerId: user.uid,
                sellerName: sellerName,
                sellerTier: sellerTier,
                reservePrice: auctionOptionalPrice(reservePrice),
                buyNowPrice: auctionOptionalPrice(buyNowPrice),
                images: images,
                imagesThumb: (prod && prod.imagesThumb && prod.imagesThumb.length) ? prod.imagesThumb : null,
                productImage: (typeof productThumb === 'function' && prod) ? productThumb(prod) : images[0],
                category: category,
                location: location,
                startingPrice: startingPrice,
                currentBid: startingPrice,
                currentBidderId: null,
                currentBidderName: null,
                bidCount: 0,
                bidIncrement: bidIncrement,
                status: waitingMin===0 ? 'live' : 'scheduled',
                waitingMinutes: waitingMin,
                waitingMs: waitingMs,
                startAt: firebase.firestore.Timestamp.fromDate(startAt),
                endAt: firebase.firestore.Timestamp.fromDate(endAt),
                startAtMs: startAt.getTime(),
                endAtMs: endAt.getTime(),
                durationMinutes: durationMin,
                isPremiumAuction: true,
                views: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            return firebaseDB.collection('settings').doc('auctionCommission').get().then(function(feeDoc){
                var latestRate = sellerPlanFeeRate;
                var latestSource = 'plan';
                if (feeDoc.exists){
                    latestRate = validAuctionCommissionPercent((feeDoc.data() || {}).sellerCommissionPercent);
                    latestSource = 'global';
                    if (latestRate === null) throw new Error('The auction commission setting is invalid. Please contact Sankofa Market Admin.');
                }
                if (presentedAuctionFeeSource !== latestSource || presentedAuctionFeeRate !== latestRate){
                    showCreateAuctionFee(latestRate, latestSource);
                    throw new Error('The auction commission changed since this form was opened. Review the updated rate and press Start Auction again.');
                }
                if (latestSource === 'global') auctionData.auctionCommissionPercent = latestRate;
                return firebaseDB.collection('auctions').add(auctionData);
            }).then(function(ref){
                var waitMsg = waitingMin===0 ? 'LIVE RED now' : 'LIVE RED in '+waitLabel;
                if (statusEl) statusEl.innerHTML='<span style="color:#16a34a;"><i class="fas fa-check-circle"></i> Auction created! <strong>Amber blinking</strong> for <strong>'+waitLabel+'</strong> - goes <span style="background:#ef4444;color:#fff;padding:0.1rem 0.3rem;border-radius:4px;">'+waitMsg+'</span>. <a href="../../auction-detail.html?id='+ref.id+'" style="color:#0064d2;font-weight:700;">Open →</a></span>';
                if (btn){ btn.disabled=false; btn.innerHTML=origBtn; }
                // --- ADMIN NOTIFICATION: admin must be aware when any user starts an auction ---
                // Rehearsal robots (our own automated test suites) always title their auctions
                // "AuctionTools ..." — never ring the admin's bell/dashboard for those.
                var isRehearsal = /^AuctionTools\s/.test(title);
                if (!isRehearsal) try{
                    var adminNotifyMsg = sellerName + ' (' + (sellerTier||'premium') + ') started auction "' + title + '" — GHS ' + startingPrice + ' start, +' + bidIncrement + ' inc, ' + waitingMin + 'm wait + ' + durationMin + 'm live. View: https://sankofa-market.web.app/auction-detail.html?id=' + ref.id;
                    var adminNote = {
                        userId: 'z5qEmBHHipW4MqGRmCAQOMtfGr73',
                        type: 'auction_started',
                        title: '\uD83D\uDD28 New Auction: ' + title,
                        message: adminNotifyMsg,
                        auctionId: ref.id,
                        auctionTitle: title,
                        sellerId: user.uid,
                        sellerName: sellerName,
                        sellerTier: sellerTier,
                        waitingMinutes: waitingMin,
                        durationMinutes: durationMin,
                        startingPrice: startingPrice,
                        currentBid: startingPrice,
                        productId: productId || null,
                        isRead: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    // Don't notify admin about own auction
                    if (user.uid !== 'z5qEmBHHipW4MqGRmCAQOMtfGr73'){
                        firebaseDB.collection('notifications').add(adminNote).then(function(){ console.log('🔔 Admin notified of new auction', ref.id); }).catch(function(e){ console.warn('admin notify failed', e); });
                    }
                    // Also notify any other admins dynamically
                    firebaseDB.collection('users').where('role','==','admin').get().then(function(snap){
                        snap.forEach(function(doc){
                            if (doc.id === user.uid) return;
                            if (doc.id === 'z5qEmBHHipW4MqGRmCAQOMtfGr73') return;
                            var note2 = Object.assign({}, adminNote, {userId: doc.id});
                            firebaseDB.collection('notifications').add(note2).catch(function(){});
                        });
                    }).catch(function(){});
                    // (Removed) this used to write to analytics/auctions from the browser, but that
                    // collection is admin-only by design — the write was refused and silently
                    // swallowed. The admin analytics page computes auction numbers straight from
                    // the auctions collection instead, so nothing is lost.
                }catch(e){ console.warn('admin notify error', e); }
                // Redirect after short delay to detail
                setTimeout(function(){ window.location.href='../../auction-detail.html?id='+ref.id; }, 1600);
            });
        }).catch(function(err){
            console.error('Create auction error', err);
            if (statusEl) statusEl.innerHTML='<span style="color:#e74c3c;">Error: '+escapeHtml(err.message)+'</span>';
            if (btn){ btn.disabled=false; btn.innerHTML=origBtn; }
        });
    });

    // Custom image preview handler
    if (customImagesInput){
        customImagesInput.addEventListener('change', function(e){
            var files = Array.from(e.target.files||[]);
            var preview = document.getElementById('auctionCustomPreview');
            if (!preview) return;
            preview.innerHTML='';
            files.slice(0,4).forEach(function(file){
                if (file.size > 5*1024*1024){ showFlashMessage('"'+file.name+'" >5MB skipped','warning'); return; }
                var reader = new FileReader();
                reader.onload = function(ev){
                    var img=document.createElement('img');
                    img.src=ev.target.result;
                    img.style.cssText='width:80px;height:80px;object-fit:cover;border-radius:8px;border:1.5px solid #e5e7eb;';
                    preview.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        });
    }
}

// Expose
window.initAuctionListing = initAuctionListing;
window.initAuctionDetail = initAuctionDetail;
window.initCreateAuction = initCreateAuction;
window.placeBid = placeBid;
window.auctionBuyNow = auctionBuyNow;
window.fillAuctionFeeInfo = fillAuctionFeeInfo;
window.setBidAmount = setBidAmount;
window.setNextBidAmount = setNextBidAmount;
window.setCurrentBidPlusAmount = setCurrentBidPlusAmount;
window.joinWaitlist = joinWaitlist;
window.leaveWaitlist = leaveWaitlist;
window.sendAuctionChat = sendAuctionChat;
window.listenAuctionChat = listenAuctionChat;
window.renderAuctionChat = renderAuctionChat;
window.cancelAuction = cancelAuction;
window.deleteAuction = deleteAuction;
window.clearEndedAuctions = clearEndedAuctions;
window.joinWaitlist = joinWaitlist;
window.leaveWaitlist = leaveWaitlist;
window.sendAuctionChat = sendAuctionChat;
window.listenAuctionChat = listenAuctionChat;
window.renderAuctionChat = renderAuctionChat;
window.cancelAuction = cancelAuction;
window.deleteAuction = deleteAuction;
window.clearEndedAuctions = clearEndedAuctions;
window.ensureAuctionWinnerOrder = ensureAuctionWinnerOrder;
window.getAuctionStatus = getAuctionStatus;

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled “classic” <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.isPremiumAuctionUser = isPremiumAuctionUser;
window.getAuctionStatus = getAuctionStatus;
window.formatAuctionCountdown = formatAuctionCountdown;
window.escapeHtml = escapeHtml;
window.initAuctionListing = initAuctionListing;
window.renderLiveAuctions = renderLiveAuctions;
window.renderUpcomingAuctions = renderUpcomingAuctions;
window.resolveAuctionAdmin = resolveAuctionAdmin;
window.canRemoveAuction = canRemoveAuction;
window.renderEndedAuctions = renderEndedAuctions;
window.initAuctionDetail = initAuctionDetail;
window.renderAuctionDetail = renderAuctionDetail;
window.updateDetailCountdown = updateDetailCountdown;
window.setBidAmount = setBidAmount;
window.setNextBidAmount = setNextBidAmount;
window.setCurrentBidPlusAmount = setCurrentBidPlusAmount;
window.renderBidHistory = renderBidHistory;
window.placeBid = placeBid;
window.listenWaitlist = listenWaitlist;
window.updateWaitlistUI = updateWaitlistUI;
window.listenAuctionChat = listenAuctionChat;
window.renderAuctionChat = renderAuctionChat;
window.sendAuctionChat = sendAuctionChat;
window.refreshWaitlistDebug = refreshWaitlistDebug;
window.joinWaitlist = joinWaitlist;
window.leaveWaitlist = leaveWaitlist;
window.ensureAuctionWinnerOrder = ensureAuctionWinnerOrder;
window.cancelAuction = cancelAuction;
window.deleteAuction = deleteAuction;
window.confirmAndRemove = confirmAndRemove;
window.clearEndedAuctions = clearEndedAuctions;
window.initCreateAuction = initCreateAuction;

