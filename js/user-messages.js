/* ============================================================================
   SANKOFA MARKET - USER MESSAGES PAGE (Firebase-powered + Ticks)
   Real conversations & messages stored in Firestore:
   - conversations/{id}                → participants, product info, lastMessage, unreadBy
   - conversations/{id}/messages/{id}  → individual chat messages (ticks, manual refresh)
   Ticks: ✓ sent (grey) → ✓✓ delivered/received (grey) → ✓✓ read/seen (blue)
   Manual refresh: tap ↻ to load new messages
   ============================================================================ */

var myUid = null;
var myName = 'Me';
var myBroadcastTier = null;           // 'silver' | 'gold' | 'diamond' when my plan is truly active
var myFollowersCache = null;          // [{followerId, followerName}] — Silver+ sellers only
var broadcastUsedThisMonth = false;   // refreshed at load + after every successful send
var _broadcastOn = false;             // the in-chat broadcast toggle
var conversationsCache = {};          // convId → data
var currentConversationId = null;
var conversationsPage = 1;
var conversationsPageSize = 15;
var allConversationsSorted = [];
var messagesUnsubscribe = null;       // live listener cleanup
var conversationsUnsubscribe = null;

/* ==== Phone viewport truth — keeps the chat input ON the screen ====
   100vh on a phone means "the viewport as if the browser's URL bar were hidden",
   so sizing the chat from it pushes the input beneath the bottom of the screen
   (and the on-screen keyboard shrinks nothing). visualViewport.height is the
   truth: what the user can actually see right now. While a chat is open on a
   phone we size the layout from it every time it changes — URL bar show/hide,
   keyboard open/close, rotation. Closed again → the CSS takes back over. */
var _chatVpBound = false;
function syncChatViewport() {
    try {
        if (window.innerWidth > 768) return;
        var layout = document.querySelector('.messages-layout');
        if (!layout) return;
        if (!document.body.classList.contains('mobile-chat-open')) {
            ['height', 'min-height', 'max-height'].forEach(function (p) { layout.style.removeProperty(p); });
            return;
        }
        var vv = window.visualViewport;
        var header = document.querySelector('.header');
        var hh = header ? Math.round(header.getBoundingClientRect().height) : 56;
        var avail = vv ? vv.height : window.innerHeight;
        var h = Math.max(260, Math.round(avail - hh));
        layout.style.setProperty('height', h + 'px', 'important');
        layout.style.setProperty('min-height', h + 'px', 'important');
        layout.style.setProperty('max-height', h + 'px', 'important');
    } catch (e) {}
}
function bindChatViewport() {
    if (_chatVpBound) return;
    _chatVpBound = true;
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncChatViewport);
        window.visualViewport.addEventListener('scroll', syncChatViewport);
    }
    window.addEventListener('orientationchange', function () { setTimeout(syncChatViewport, 350); });
    var mi = document.getElementById('messageInput');
    if (mi) mi.addEventListener('focus', function () {
        // bottom-sheet keyboards animate over ~300ms — re-sync + keep the latest
        // message in view after the layout has settled above the keyboard
        setTimeout(function () {
            syncChatViewport();
            var c = document.getElementById('chatMessages');
            if (c) c.scrollTop = c.scrollHeight;
        }, 380);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initMessagesPage();
});

async function initMessagesPage() {
    // Require Firebase + auth
    if (typeof firebase === 'undefined' || typeof firebaseDB === 'undefined' || firebaseDB === null) {
        showMessagesError('Messaging is unavailable right now. Please try again later.');
        return;
    }

    firebase.auth().onAuthStateChanged(async function(user) {
        if (!user) {
            // flaky networks sometimes flash a transient "signed out" during token
            // refresh — give the session a moment to come back before bouncing
            await new Promise(function(r){ setTimeout(r, 3000); });
            if (firebase.auth().currentUser) return;
            window.location.href = '../auth/login.html?redirect=messages.html';
            return;
        }
        myUid = user.uid;

        // Get my display name + my premium tier (Silver+ unlocks follower broadcast)
        try {
            var myDoc = await firebaseDB.collection('users').doc(myUid).get();
            if (myDoc.exists) {
                var md = myDoc.data();
                myName = md.name || (md.firstName ? md.firstName + (md.lastName ? ' ' + md.lastName : '') : (user.displayName || 'Me'));
                // Tier: plan must be genuinely active (expiry in the future)
                var pexp = md.premiumExpiry && md.premiumExpiry.toDate ? md.premiumExpiry.toDate() : null;
                var tierRaw = String(md.premiumTier || md.sellerTier || '').toLowerCase();
                myBroadcastTier = (md.isPremium === true && pexp && pexp > new Date()) ? tierRaw : null;
            } else if (user.displayName) {
                myName = user.displayName;
            }
        } catch (e) {}

        // Load my follower list (if I am Silver+) and whether this month's
        // broadcast is already used — both drive the broadcast panel + toggle.
        try { loadMyBroadcastState(); } catch (e) {}

        initConversationSearch();
        listenToConversations();
        // Responsive: if resized to desktop, show both panels again
        window.addEventListener('resize', function(){
            if (window.innerWidth > 768) document.body.classList.remove('mobile-chat-open');
        });

        // Auto-open a conversation passed via ?conv=
        var params = new URLSearchParams(window.location.search);
        var convParam = params.get('conv');
        if (convParam) {
            window.pendingConvOpen = convParam;
        }
    });
}

/* ---- Conversation list (manual refresh — no live auto-refresh) ---- */
function listenToConversations() {
    fetchConversations();
    // Manual refresh every 30s is disabled per user request — use button
}
function fetchConversations() {
    var listEl = document.getElementById('conversationsList');
    if (listEl) {
        var skel='';
        for(var i=0;i<5;i++) skel+='<div class="msg-skeleton"><div class="msg-skeleton-avatar"></div><div style="flex:1;"><div class="msg-skeleton-line" style="width:35%;"></div><div class="msg-skeleton-line" style="width:75%;"></div><div class="msg-skeleton-line" style="width:55%;"></div></div></div>';
        listEl.innerHTML = skel;
    }
    var pagEl = document.getElementById('conversationsPagination');
    if (pagEl) pagEl.innerHTML = '';
    conversationsPage = 1;
    // Live list: a new conversation, a new preview or a re-order shows up without a refresh.
    if (convListUnsub) { try { convListUnsub(); } catch (e) {} convListUnsub = null; }
    convListUnsub = firebaseDB.collection('conversations')
        .where('participants', 'array-contains', myUid)
        .onSnapshot(function(snap) {
            conversationsCache = {};
            var convs = [];
            snap.forEach(function(doc) {
                var d = doc.data();
                d.id = doc.id;
                conversationsCache[doc.id] = d;
                convs.push(d);
            });
            convs.sort(function(a, b) {
                var ta = a.lastMessageAt ? a.lastMessageAt.toMillis() : 0;
                var tb = b.lastMessageAt ? b.lastMessageAt.toMillis() : 0;
                return tb - ta;
            });
            allConversationsSorted = convs;
            // Update header count
            var hdr = document.querySelector('.conversations-header h3');
            if (hdr) hdr.textContent = 'Chats' + (convs.length ? ' ('+convs.length+')' : '');
            renderConversationList(convs.slice(0, conversationsPageSize));
            // Auto-open pending conversation (from Contact Seller) once it exists
            if (window.pendingConvOpen) {
                var target = window.pendingConvOpen;
                window.pendingConvOpen = null;
                openConversationById(target);
            }
        }, function(err) {
            console.error('Conversations listener error:', err);
            showMessagesError('Could not load your conversations: ' + (err && err.message ? err.message : err));
        });
}
/** Kept for the "refresh" buttons: the listeners already do this, but a manual nudge is harmless. */
function refreshConversations() { fetchConversations(); if (currentConversationId) fetchMessages(currentConversationId); }

/* ---- Render conversation list ---- */
function renderConversationList(convs) {
    convs = (convs || []).filter(function(c) { return c && Array.isArray(c.participants) && c.participants.length; });
    var list = document.getElementById('conversationsList');
    if (!list) return;

    if (convs.length === 0) {
        var empty = document.getElementById('noConversations');
        if (empty) empty.style.display = '';
        list.innerHTML = '';
        return;
    }

    var emptyEl = document.getElementById('noConversations');
    if (emptyEl) emptyEl.style.display = 'none';

    var html = '';
    convs.forEach(function(conv) {
        var otherUid = conv.participants.filter(function(p) { return p !== myUid; })[0];
        var otherName = (conv.participantNames && conv.participantNames[otherUid]) || 'User';
        var initial = otherName.charAt(0).toUpperCase();
        var preview = conv.lastMessage || 'No messages yet — say hello!';
        var timeStr = conv.lastMessageAt ? formatMsgTime(conv.lastMessageAt.toDate ? conv.lastMessageAt.toDate() : new Date(conv.lastMessageAt)) : '';
        var unread = conv.unreadBy && conv.unreadBy.indexOf(myUid) !== -1;
        var productLine = conv.productTitle ? '<div class="conv-product-line"><i class="fas fa-tag"></i> ' + escapeHtml(conv.productTitle) + '</div>' : '';

        html += '<div class="conversation-item' + (conv.id === currentConversationId ? ' active' : '') + '" data-conv-id="' + conv.id + '" onclick="openConversationById(\'' + conv.id + '\')">' +
            '<div class="avatar conv-avatar">' + initial + '</div>' +
            '<div class="conv-details">' +
                '<div class="conv-name">' + escapeHtml(otherName) + '<span data-conv-tier="' + otherUid + '"></span></div>' +
                productLine +
                '<div class="conv-preview">' + escapeHtml(preview) + '</div>' +
            '</div>' +
            '<div class="conv-meta">' +
                '<div class="conv-time">' + timeStr + '</div>' +
                (unread ? '<div class="conv-unread">•</div>' : '') +
            '</div>' +
        '</div>';
    });

    // Silver+ sellers: followers with no chat yet get their own rows BELOW the
    // real conversations, each with a Start chat button (address-book style).
    if (myBroadcastTier && myFollowersCache && myFollowersCache.length) {
        var shownIds = {};
        // base on the FULL cache, not the paginated slice — a follower whose
        // chat sits on page 2 must not reappear as "no chat yet" on page 1
        Object.keys(conversationsCache).forEach(function (cid) {
            var c = conversationsCache[cid] || {};
            var o = (c.participants || []).filter(function (p) { return p !== myUid; })[0];
            if (o) shownIds[o] = true;
        });
        var missing = myFollowersCache.filter(function (f) { return f && f.followerId && !shownIds[f.followerId]; });
        if (missing.length) {
            html += '<div class="sm-conv-sep"><i class="fas fa-users"></i> Followers with no chat yet</div>';
            missing.forEach(function (f) {
                html += '<div class="conversation-item sm-follower-conv" onclick="startChatWithFollower(\'' + f.followerId + '\')">' +
                    '<div class="avatar conv-avatar">' + escapeHtml((f.followerName || 'B').charAt(0).toUpperCase()) + '</div>' +
                    '<div class="conv-details">' +
                        '<div class="conv-name">' + escapeHtml(f.followerName) + '<span data-conv-tier="' + f.followerId + '"></span></div>' +
                        '<div class="conv-preview" style="color:#0064d2;font-weight:600;"><i class="fas fa-plus" style="font-size:0.7rem;"></i> Start chat</div>' +
                    '</div>' +
                '</div>';
            });
        }
    }

    list.innerHTML = html;

    // Tier labels ("Gold buyer", "◆ Diamond buyer") beside premium chat partners —
    // a Silver+ seller sight-line. Nothing at all is painted for free users.
    if (myBroadcastTier) {
        var tierUids = {};
        convs.forEach(function (c) {
            var o = (c.participants || []).filter(function (p) { return p !== myUid; })[0];
            if (o) tierUids[o] = true;
        });
        (myFollowersCache || []).forEach(function (f) { if (f && f.followerId) tierUids[f.followerId] = true; });
        Object.keys(tierUids).forEach(function (uid) {
            smGetPublicTier(uid).then(function (info) {
                if (!info || !info.tier) return;
                document.querySelectorAll('[data-conv-tier="' + uid + '"]').forEach(function (slot) {
                    slot.innerHTML = ' <span class="sm-conv-tier" style="color:' + smTierColor(info.tier) + ';font-weight:700;font-size:0.72rem;">' + smTierLabel(info.tier) + '</span>';
                });
            });
        });
    }
    // Pagination for conversations
    var pag = document.getElementById('conversationsPagination');
    if (pag) {
        if (convs.length <= conversationsPageSize) {
            pag.innerHTML = convs.length ? '<span class="msg-pagination-info">'+convs.length+' conversation'+(convs.length===1?'':'s')+'</span>' : '';
        } else {
            var shown = Math.min(convs.length, conversationsPage * conversationsPageSize);
            var remaining = convs.length - shown;
            // If we rendered only first page, show Load more
            var totalShown = document.querySelectorAll('#conversationsList .conversation-item').length;
            // For incremental, we need to track page
            if (totalShown < convs.length) {
                pag.innerHTML = '<span class="msg-pagination-info">Showing '+totalShown+' of '+convs.length+'</span><button class="conv-pagination-btn" onclick="loadMoreConversations()"><i class="fas fa-chevron-down"></i> Load more ('+remaining+' more)</button>';
            } else {
                pag.innerHTML = '<span class="msg-pagination-info">All '+convs.length+' conversations loaded</span>';
            }
        }
    }
}

function loadMoreConversations(){
    conversationsPage++;
    var start = (conversationsPage-1)*conversationsPageSize;
    var slice = allConversationsSorted.slice(start, start+conversationsPageSize);
    if (!slice.length) return;
    var list = document.getElementById('conversationsList');
    if (!list) return;
    // Append without clearing
    var htmlMore='';
    slice.forEach(function(conv){
        var otherUid = conv.participants.filter(function(p){ return p !== myUid; })[0];
        var otherName = (conv.participantNames && conv.participantNames[otherUid]) || 'User';
        var initial = otherName.charAt(0).toUpperCase();
        var preview = conv.lastMessage || 'No messages yet — say hello!';
        var timeStr = conv.lastMessageAt ? formatMsgTime(conv.lastMessageAt.toDate ? conv.lastMessageAt.toDate() : new Date(conv.lastMessageAt)) : '';
        var unread = conv.unreadBy && conv.unreadBy.indexOf(myUid) !== -1;
        var productLine = conv.productTitle ? '<div class="conv-product-line"><i class="fas fa-tag"></i> ' + escapeHtml(conv.productTitle) + '</div>' : '';
        htmlMore += '<div class="conversation-item' + (conv.id === currentConversationId ? ' active' : '') + '" data-conv-id="' + conv.id + '" onclick="openConversationById(\'' + conv.id + '\')">' +
            '<div class="avatar conv-avatar">' + initial + '</div>' +
            '<div class="conv-details">' +
                '<div class="conv-name">' + escapeHtml(otherName) + '<span data-conv-tier="' + otherUid + '"></span></div>' +
                productLine +
                '<div class="conv-preview">' + escapeHtml(preview) + '</div>' +
            '</div>' +
            '<div class="conv-meta">' +
                '<div class="conv-time">' + timeStr + '</div>' +
                (unread ? '<div class="conv-unread">•</div>' : '') +
            '</div>' +
        '</div>';
    });
    list.insertAdjacentHTML('beforeend', htmlMore);
    // Update pagination
    var pag = document.getElementById('conversationsPagination');
    var totalShown = document.querySelectorAll('#conversationsList .conversation-item').length;
    if (pag) {
        if (totalShown >= allConversationsSorted.length) {
            pag.innerHTML = '<span class="msg-pagination-info">All '+allConversationsSorted.length+' conversations loaded</span>';
        } else {
            var remaining = allConversationsSorted.length - totalShown;
            pag.innerHTML = '<span class="msg-pagination-info">Showing '+totalShown+' of '+allConversationsSorted.length+'</span><button class="conv-pagination-btn" onclick="loadMoreConversations()"><i class="fas fa-chevron-down"></i> Load more ('+remaining+' more)</button>';
        }
    }
}

/* ---- Open a conversation by ID ---- */
function openConversationById(convId) {
    var conv = conversationsCache[convId];
    if (!conv) {
        showMessagesError('Conversation not found. It may not belong to your account.');
        return;
    }

    // Switch active state in list
    document.querySelectorAll('.conversation-item').forEach(function(el) {
        el.classList.toggle('active', el.getAttribute('data-conv-id') === convId);
    });

    currentConversationId = convId;
    // Opening any real chat retires the "new chat with X" chip from a draft
    if (!conv._isDraft) clearDraftRecipientUI();

    var otherUid = conv.participants.filter(function(p) { return p !== myUid; })[0];
    var otherName = (conv.participantNames && conv.participantNames[otherUid]) || 'User';

    // Update header
    var nameEl = document.getElementById('chatUserName');
    if (nameEl) nameEl.textContent = otherName;
    // Gold ✓ PREMIUM (or purple ◆ DIAMOND) pill next to the name for paid-tier users
    try { paintChatPremiumBadge(otherUid, nameEl, otherName); } catch (e) {}
    var statusEl = document.getElementById('chatUserStatus');
    if (statusEl) {
        var base = conv.productTitle ? '<i class="fas fa-tag" style="font-size:0.7rem;"></i> About: ' + escapeHtml(conv.productTitle) : 'Chat';
        statusEl.innerHTML = base;
    }

    // Product card
    var productCard = document.querySelector('.chat-product-card');
    if (productCard) {
        if (conv.productId && conv.productTitle) {
            productCard.style.display = '';
            var img = productCard.querySelector('img');
            var title = productCard.querySelector('h4');
            var price = productCard.querySelector('p');
            if (img) img.src = conv.productImage || '/images/placeholders/product.svg';
            if (title) title.textContent = conv.productTitle;
            if (price) price.textContent = 'GHS ' + (Number(conv.productPrice || 0)).toLocaleString();
            productCard.style.cursor = 'pointer';
            productCard.onclick = function() {
                window.open('../../product-detail.html?id=' + conv.productId, '_blank');
            };
        } else {
            productCard.style.display = 'none';
        }
    }

    // Mark conversation as read (remove me from unreadBy) — instantly in UI
    if (conv.unreadBy && conv.unreadBy.indexOf(myUid) !== -1) {
        var remaining = conv.unreadBy.filter(function(u) { return u !== myUid; });
        firebaseDB.collection('conversations').doc(convId).update({ unreadBy: remaining }).catch(function() {});
        // Optimistic local update
        conv.unreadBy = remaining;
    }

    // Opening the chat clears any "new message" alerts for it, so the bell and the inbox
    // agree with what you have obviously already seen.
    (function clearMessageAlerts(){
        try {
            firebaseDB.collection('notifications')
                .where('userId', '==', myUid)
                .where('conversationId', '==', convId)
                .where('isRead', '==', false)
                .get().then(function(snap){
                    if (snap.empty) return;
                    var n = 0;
                    snap.forEach(function(d){
                        d.ref.update({ isRead: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
                          .then(function(){ n++; }).catch(function(){});
                    });
                    // let the bell catch up
                    if (typeof refreshNotificationBell === 'function') setTimeout(refreshNotificationBell, 1200);
                }).catch(function(){});
        } catch (e) {}
    })();

    // Bargain bar: the seller can set a 24-hour buyer-only price; the buyer pays from here
    try { initBargainForConversation(conv); } catch (e) { console.warn('bargain bar failed', e); }
    // Silver+ broadcast: show the toggle whenever this chat partner follows me
    try { refreshBroadcastToggle(conv); } catch (e) {}

    // Listen to messages live — auto refresh, ticks handled inside
    listenToMessages(convId);

    // Immediately mark all messages from the other user as READ so sender sees blue ticks instantly
    // (not just on next snapshot) — this is the reliable path for read receipts
    (function markReadNow(){
        firebaseDB.collection('conversations').doc(convId).collection('messages')
            .where('participants','array-contains', myUid).get().then(function(snap){
            var batch = [];
            snap.forEach(function(doc){
                var d = doc.data();
                if (d.senderId !== myUid && d.status !== 'read' && d.status !== 'seen') {
                    batch.push(doc.ref.update({ status: 'read', readAt: firebase.firestore.FieldValue.serverTimestamp() }));
                }
            });
            if (batch.length) Promise.all(batch).catch(function(){});
        }).catch(function(){});
    })();

    // Update URL without reloading
    try {
        history.replaceState(null, '', 'messages.html?conv=' + convId);
    } catch (e) {}

    // Focus input
    var input = document.getElementById('messageInput');
    if (input) input.focus();

    // On smartphone: hide conversation list, show chat full-screen
    if (window.innerWidth <= 768) {
        document.body.classList.add('mobile-chat-open');
        // Pin the layout to the REAL visible height so the input can never
        // slide beneath the bottom of the screen (URL bar) or the keyboard
        bindChatViewport();
        syncChatViewport();
        setTimeout(syncChatViewport, 350);
        // Ensure chat scrolls to bottom after layout shift
        setTimeout(function(){
            var c = document.getElementById('chatMessages');
            if (c) c.scrollTop = c.scrollHeight;
        }, 120);
    }
}

// Back to conversation list on smartphone
function closeChatOnMobile(){
    document.body.classList.remove('mobile-chat-open');
    syncChatViewport();   // hands sizing back to the CSS for the list view
    // Keep listener but hide chat — clear active conv so back doesn't re-open via URL
    // Do not clear currentConversationId fully so desktop still knows, but on mobile we reset URL
    try { history.replaceState(null,'','messages.html'); } catch(e){}
    // On mobile, after closing we want to show list; keep messagesUnsubscribe alive but hidden
    // Optional: scroll list to top
    var list = document.getElementById('conversationsList');
    if (list) list.scrollTop = 0;
    // Focus search
    var s = document.getElementById('searchConversations');
    if (s) s.focus();
}

/* ---- Tick helpers ---- */
function getTickHtml(status, isMine) {
    if (!isMine) return '';
    // status: sent → single grey, delivered/received → double grey, read/seen → double blue
    // Add text label so it's impossible to miss on phone
    if (status === 'read' || status === 'seen') {
        return '<i class="fas fa-check-double msg-tick msg-tick-read" title="Read"></i><span class="msg-tick-label msg-tick-label-read">Read</span>';
    }
    if (status === 'delivered' || status === 'received') {
        return '<i class="fas fa-check-double msg-tick msg-tick-delivered" title="Delivered"></i><span class="msg-tick-label">Delivered</span>';
    }
    // default: sent
    return '<i class="fas fa-check msg-tick msg-tick-sent" title="Sent"></i><span class="msg-tick-label">Sent</span>';
}

/* ---- Message thread — manual refresh (no live auto-refresh) ---- */
/**
 * Live message thread.
 * This used to be a single `.get()`, so a reply only appeared after you refreshed or reopened
 * the chat — the single most annoying thing about messaging on a phone. It is now a real
 * Firestore listener: the thread redraws the instant either side sends, the ticks update, and
 * it keeps working while you sit in the conversation.
 *
 * The listener is torn down whenever you switch chats or leave the page, so we never leave a
 * socket open on a conversation you are not looking at.
 */
var msgUnsub = null;              // this thread's listener
var msgConvId = null;             // which conversation it belongs to
var convListUnsub = null;         // the conversation list's listener

function listenToMessages(convId) {
    if (msgUnsub && msgConvId === convId) return;      // already listening to this one
    stopMessageListener();
    msgConvId = convId;
    fetchMessages(convId);
}

function stopMessageListener() {
    if (msgUnsub) { try { msgUnsub(); } catch (e) {} }
    msgUnsub = null;
}

function fetchMessages(convId) {
    var container = document.getElementById('chatMessages');
    if (container && !container.querySelector('.msg-bubble, .message-bubble')) {
        container.innerHTML = '<div style="text-align:center;color:#5a6572;padding:2rem;"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>';
    }
    if (msgUnsub) { try { msgUnsub(); } catch (e) {} msgUnsub = null; }

    msgUnsub = firebaseDB.collection('conversations').doc(convId)
        .collection('messages')
        // participants filter is REQUIRED by the security rules (see firestore.rules)
        .where('participants','array-contains', myUid)
        .orderBy('createdAt', 'asc')
        .limit(200)
        .onSnapshot(function(snap) {
            if (currentConversationId !== convId) return; // stale listener
            var html = '';
            var count = 0;
            var toMarkDelivered = [];
            var toMarkRead = [];

            var isNearBottom = false;
            if (container) {
                // Check if user was scrolled near bottom before update (within 120px)
                isNearBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 120;
            }

            var lastDateLabel = null;
            snap.forEach(function(doc) {
                var m = doc.data();
                var id = doc.id;
                var mine = m.senderId === myUid;
                var status = m.status || 'sent';
                var time = m.createdAt ? formatMsgTime(m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt)) : '';
                var ticks = getTickHtml(status, mine);
                var msgDate = m.createdAt ? (m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt)) : null;
                var dateLabel = msgDate ? formatMsgDateLabel(msgDate) : null;
                if (dateLabel && dateLabel !== lastDateLabel) {
                    html += '<div class="msg-date-separator"><span>' + escapeHtml(dateLabel) + '</span></div>';
                    lastDateLabel = dateLabel;
                }

                // If this message is to me and still 'sent', mark as delivered instantly
                if (!mine && status === 'sent') {
                    toMarkDelivered.push({ id: id, ref: doc.ref });
                }
                // If I'm viewing this conversation and message is to me and not yet read, mark as read
                if (!mine && (status === 'sent' || status === 'delivered' || status === 'received')) {
                    // Only if conversation is currently open and this is the active conv
                    toMarkRead.push({ id: id, ref: doc.ref, status: status });
                }

                var fileHtml = '';
                if (m.fileUrl) {
                    var isImage = m.fileType && m.fileType.startsWith('image/');
                    var isAudio = m.fileType && m.fileType.startsWith('audio/');
                    var safeUrl = escJsAttr(m.fileUrl);
                    var safeName = escJsAttr(m.fileName||'file');
                    var safeType = escJsAttr(m.fileType||'');
                    var sizeStr = m.fileSize ? ' • ' + (m.fileSize/1024).toFixed(1) + ' KB' : '';
                    var cacheKey = 'dl_' + btoa(m.fileUrl).replace(/[^a-zA-Z0-9]/g,'').slice(0,20);
                    // a private link can expire (90 days) or be revoked; if the file has a stored
                    // path we can quietly ask for a fresh link and swap the src in place
                    var pathAttr = m.filePath
                        ? ' data-filepath="' + escapeHtml(m.filePath) + '" data-convid="' + String(currentConversationId || '') + '" onerror="smReattach(this)"'
                        : '';
                    if (isImage) {
                        // Clear preview — tap image to download & save (mobile: no overlay text/icon per request)
                        fileHtml = '<div id="file_' + cacheKey + '" onclick="downloadAttachment(\'' + safeUrl + '\', \'' + safeName + '\', \'' + safeType + '\', \'' + cacheKey + '\')" style="margin-bottom:0.4rem; position:relative; display:inline-block; cursor:pointer; border-radius:8px; overflow:hidden; border:1px solid rgba(0,0,0,0.08); max-width:220px;">' +
                            '<img src="' + m.fileUrl + '" alt="' + escapeHtml(m.fileName||'image') + '"' + pathAttr + ' style="width:220px; height:160px; object-fit:cover; display:block;">' +
                            '<div class="mobile-hide-preview-overlay" style="position:absolute; inset:0; background:rgba(0,0,0,0.08); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.4rem;">' +
                                '<div style="width:48px; height:48px; background:rgba(0,0,0,0.6); border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:1.2rem;"><i class="fas fa-download"></i></div>' +
                                '<div style="background:rgba(0,0,0,0.6); color:white; font-size:0.7rem; padding:0.2rem 0.6rem; border-radius:12px; font-weight:600;"><i class="fas fa-image"></i> ' + escapeHtml(m.fileName||'image') + sizeStr + '</div>' +
                            '</div>' +
                            '<div class="mobile-hide-preview-bar" style="position:absolute; bottom:6px; left:6px; right:6px; display:flex; justify-content:space-between; align-items:center; font-size:0.62rem; color:rgba(255,255,255,0.9); text-shadow:0 1px 2px rgba(0,0,0,0.5);"><span><i class="fas fa-download"></i> Tap to save to phone</span><span style="background:rgba(0,0,0,0.5); padding:1px 5px; border-radius:4px;">' + (m.fileSize ? (m.fileSize/1024>1024 ? (m.fileSize/1024/1024).toFixed(1)+' MB' : (m.fileSize/1024).toFixed(0)+' KB') : '') + '</span></div>' +
                        '</div><div id="preview_' + cacheKey + '" style="display:none; margin-bottom:0.4rem;"></div>';
                    } else if (isAudio) {
                        var dur2 = m.fileDuration ? ' • ' + escapeHtml(m.fileDuration) : '';
                        fileHtml = '<div style="margin-bottom:0.4rem;"><audio controls preload="metadata" src="' + escapeHtml(m.fileUrl) + '" style="width:220px; max-width:100%; height:36px; border-radius:8px; display:block; background:#f1f5f9;"></audio><div style="font-size:0.68rem; color:inherit; opacity:0.7; margin-top:0.2rem; display:flex; align-items:center; gap:0.3rem;"><i class="fas fa-microphone" style="color:#ef4444;"></i> Voice note' + dur2 + '</div></div>';
                    } else {
                        fileHtml = '<div id="file_' + cacheKey + '" style="margin-bottom:0.4rem; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; padding:0.6rem; display:flex; align-items:center; gap:0.6rem;">' +
                            '<div style="width:44px; height:44px; background:#e0e7ff; border-radius:6px; display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fas fa-file" style="color:#4f46e5;"></i></div>' +
                            '<div style="flex:1; min-width:0;"><div style="font-size:0.82rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + escapeHtml(m.fileName||'file') + '</div><div style="font-size:0.68rem; color:#64748b;">' + escapeHtml(m.fileType||'file') + sizeStr + '</div></div>' +
                            '<button onclick="downloadAttachment(\'' + safeUrl + '\', \'' + safeName + '\', \'' + safeType + '\', \'' + cacheKey + '\')" style="background:#0064d2; color:white; border:none; border-radius:6px; padding:0.45rem 0.7rem; cursor:pointer; font-size:0.75rem; font-weight:700; display:flex; align-items:center; gap:0.3rem; flex-shrink:0; white-space:nowrap;"><i class="fas fa-download"></i> Download</button>' +
                            '</div><div id="preview_' + cacheKey + '" style="display:none; margin-bottom:0.4rem;"></div>';
                    }
                    // Check if already downloaded (cached) — if so, show open from phone immediately
                    (function(url, key, isImg, isAud){
                        getAttachmentDB().then(function(db){
                            var tx=db.transaction('files','readonly');
                            var req=tx.objectStore('files').get(url);
                            req.onsuccess=function(){
                                if(req.result && req.result.blob){
                                    var previewEl=document.getElementById('preview_'+key);
                                    var rowEl=document.getElementById('file_'+key);
                                    if(!previewEl || !rowEl) return;
                                    var blobUrl=URL.createObjectURL(req.result.blob);
                                    if(isImg){
                                        previewEl.innerHTML='<a href="#" onclick="openAttachment(event,\'' + escJsAttr(url) + '\',\'' + escJsAttr(req.result.fileName||'image') + '\',\'' + escJsAttr(req.result.fileType||'') + '\');return false;" style="display:block;"><img src="' + blobUrl + '" alt="' + escapeHtml(req.result.fileName||'image') + '" style="max-width:220px; max-height:220px; border-radius:8px; display:block; border:1px solid rgba(0,0,0,0.08);"></a><div style="font-size:0.62rem; color:#16a34a; margin-top:0.2rem;"><i class="fas fa-check-circle"></i> Saved on phone — tap to open</div>';
                                    } else if(isAud){
                                        previewEl.innerHTML='<audio controls src="' + blobUrl + '" style="width:220px; max-width:100%; height:32px; display:block; background:#f1f5f9; border-radius:8px;"></audio><div style="font-size:0.62rem; color:#16a34a; margin-top:0.2rem;"><i class="fas fa-check-circle"></i> Saved — playing from phone</div>';
                                    } else {
                                        previewEl.innerHTML='<a href="#" onclick="openAttachment(event,\'' + escJsAttr(url) + '\',\'' + escJsAttr(req.result.fileName||'file') + '\',\'' + escJsAttr(req.result.fileType||'') + '\');return false;" style="display:inline-flex; align-items:center; gap:0.5rem; background:#f0fdf4; border:1px solid #bbf7d0; padding:0.5rem 0.7rem; border-radius:8px; color:#166534; font-size:0.82rem; text-decoration:none;"><i class="fas fa-check-circle" style="color:#16a34a;"></i> ' + escapeHtml(req.result.fileName||'file') + ' — Tap to open from phone</a>';
                                    }
                                    previewEl.style.display='block';
                                    rowEl.style.display='none';
                                }
                            };
                        });
                    })(m.fileUrl, cacheKey, isImage, isAudio);
                }
                var textHtml = m.text ? '<div class="msg-text">' + escapeHtml(m.text) + '</div>' : '';
                if (m.isAdmin === true) {
                    var adminFileHtml2 = '';
                    if (m.fileUrl) {
                        var isImg2 = m.fileType && m.fileType.startsWith('image/');
                        var isAud2 = m.fileType && m.fileType.startsWith('audio/');
                        if (isImg2) adminFileHtml2 = '<div style="margin-bottom:0.4rem;"><a href="' + escapeHtml(m.fileUrl) + '" target="_blank" rel="noopener"><img src="' + m.fileUrl + '" alt="' + escapeHtml(m.fileName || 'image') + '" style="max-width:200px; max-height:200px; border-radius:8px; display:block; border:1px solid rgba(0,0,0,0.08);"></a></div>';
                        else if (isAud2) adminFileHtml2 = '<div style="margin-bottom:0.4rem;"><audio controls src="' + escapeHtml(m.fileUrl) + '" style="width:200px; max-width:100%; height:32px;"></audio><div style="font-size:0.68rem; opacity:0.8; margin-top:0.2rem;"><i class="fas fa-microphone" style="color:#b7791f;"></i> Voice note' + (m.fileDuration ? ' • ' + escapeHtml(m.fileDuration) : '') + '</div></div>';
                        else adminFileHtml2 = '<div style="margin-bottom:0.4rem;"><a href="' + escapeHtml(m.fileUrl) + '" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:0.5rem; background:#fff8e1; border:1px solid #ffe69c; padding:0.4rem 0.6rem; border-radius:8px; font-size:0.8rem; color:#7a4a00; text-decoration:none;"><i class="fas fa-file"></i> ' + escapeHtml(m.fileName || 'file') + '</a></div>';
                    }
                    var adminText2 = m.text ? '<div class="msg-text">' + escapeHtml(m.text) + '</div>' : '';
                    html += '<div class="admin-announcement" style="align-self:center; width:92%; max-width:520px; background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%); border:1px solid #fde68a; border-left:4px solid #f5af02; border-radius:10px; padding:0.7rem 0.9rem; margin:0.4rem auto; box-shadow:0 1px 4px rgba(245,175,2,0.12);">' +
                        '<div style="display:flex; align-items:center; gap:0.4rem; font-size:0.68rem; font-weight:800; color:#92400e; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.35rem;"><i class="fas fa-bullhorn" style="color:#d97706;"></i> Announcement &bull; Admin</div>' +
                        adminFileHtml2 + (m.text ? '<div style="font-size:0.88rem; color:#78350f; line-height:1.5; word-break:break-word;">' + escapeHtml(m.text) + '</div>' : '') +
                        '<div style="font-size:0.62rem; color:#a16207; margin-top:0.35rem; text-align:right;">' + time + '</div>' +
                    '</div>';
                } else {
                    html += '<div class="message ' + (mine ? 'sent' : 'received') + '">' +
                        fileHtml + textHtml +
                        '<div class="message-time">' + time + ' ' + ticks + '</div>' +
                    '</div>';
                }
                count++;
            });

            if (count === 0) {
                html = '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#5a6572;font-size:0.9rem;">' +
                    '<div style="text-align:center;">' +
                        '<i class="fas fa-handshake" style="font-size:2.5rem;color:#ccc;margin-bottom:0.75rem;"></i>' +
                        '<p>Say hello! Ask about the item, delivery, or price.</p>' +
                        '<p style="font-size:0.75rem;color:#f59e0b;"><i class="fas fa-shield-alt"></i> Stay on Sankofa Market — never pay outside the platform.</p>' +
                    '</div>' +
                '</div>';
            }

            if (container) {
                var wasEmpty = container.innerHTML.indexOf('Loading messages') !== -1;
                container.innerHTML = html;
                // Auto-scroll: always on first load, otherwise only if user was near bottom
                if (wasEmpty || isNearBottom || count <= 20) {
                    container.scrollTop = container.scrollHeight;
                }
            }

            if (container) {
                var wasEmpty = true;
                // Render was already done above, now handle read receipts then keep rendered
            }
            // Mark delivered/read in background (manual — will show on next refresh for sender)
            if (toMarkDelivered.length > 0) {
                toMarkDelivered.forEach(function(item){
                    item.ref.update({ status: 'delivered', deliveredAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(function(){});
                });
            }
            if (toMarkRead.length > 0) {
                toMarkRead.forEach(function(item){
                    item.ref.update({ status: 'read', readAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(function(){});
                });
                var convR = conversationsCache[convId];
                if (convR && convR.unreadBy && convR.unreadBy.indexOf(myUid) !== -1) {
                    var rem2 = convR.unreadBy.filter(function(u){ return u !== myUid; });
                    firebaseDB.collection('conversations').doc(convId).update({ unreadBy: rem2 }).catch(function(){});
                    convR.unreadBy = rem2;
                }
            }
        }, function(err) {
            console.error('Messages listener error:', err);
            var code = (err && err.code) || '';
            var msg = (err && err.message) || '';

            // Conversation was removed (e.g. deleted from the admin console):
            // drop the stale entry so the unread badge can't stay stuck, and
            // show a clear explanation instead of a raw error.
            var isDeleted = (code === 'permission-denied' || code === 'not-found') &&
                            !/index/i.test(msg);
            if (isDeleted) {
                delete conversationsCache[convId];
                allConversationsSorted = allConversationsSorted.filter(function(c){ return c.id !== convId; });
                renderConversationList(allConversationsSorted.slice(0, conversationsPageSize));
                currentConversationId = null;
                try {
                    var hdrC = document.querySelector('.conversations-header h3');
                    if (hdrC) hdrC.textContent = 'Chats' + (allConversationsSorted.length ? ' (' + allConversationsSorted.length + ')' : '');
                } catch (e) {}
                if (container) {
                    container.innerHTML =
                        '<div style="text-align:center;padding:3rem 1.5rem;color:#5a6572;">' +
                          '<i class="fas fa-comment-slash" style="font-size:2rem;color:#cbd5e1;display:block;margin-bottom:0.75rem;"></i>' +
                          '<strong style="display:block;color:#374151;margin-bottom:0.3rem;">This conversation is no longer available</strong>' +
                          '<p style="font-size:0.88rem;margin:0;">It may have been removed by Sankofa Market support. Pick another chat from the list, or contact the seller again from the product page.</p>' +
                        '</div>';
                }
                return;
            }

            // Anything else (index still building, offline, timeout) — offer a retry.
            if (container) {
                container.innerHTML = '<div style="text-align:center;color:#e74c3c;padding:2rem;">Could not load messages: ' + msg + '<br><button onclick="fetchMessages(\'' + convId + '\')" style="margin-top:0.75rem; padding:0.5rem 1rem; background:#0064d2; color:white; border:none; border-radius:6px; cursor:pointer;">Retry</button></div>';
            }
        });
}

/* ---- Send a message ---- */
async function sendMessage() {
    var input = document.getElementById('messageInput');
    if (!input) return;
    var text = input.value.trim();
    var hasFile = !!selectedFile;
    if ((!text && !hasFile) || !currentConversationId) return;

    var conv = conversationsCache[currentConversationId];
    if (!conv) return;

    // The conversation may be a DRAFT (started from the followers panel):
    // the first real message is what creates it in the database.
    if (conv._isDraft) {
        try {
            var otherUidD = conv.participants.filter(function (p) { return p !== myUid; })[0];
            // deterministic id — the SAME one the broadcast function uses, so a
            // seller↔follower pair always has exactly one direct thread
            var convRefD = firebaseDB.collection('conversations').doc('bcast_' + myUid + '_' + otherUidD);
            var draftData = {
                participants: conv.participants,
                participantNames: conv.participantNames,
                lastMessage: text ? text.slice(0, 120) : ' ',
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                unreadBy: [otherUidD],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            // a seller-started follower chat carries the tier the broadcast engine stamps too
            if (myBroadcastTier) { draftData.senderTier = myBroadcastTier; draftData.senderIsPremium = true; }
            await convRefD.set(draftData);
            delete conversationsCache[conv.id];
            currentConversationId = convRefD.id;
            conv = { id: convRefD.id, participants: draftData.participants, participantNames: draftData.participantNames };
            conversationsCache[currentConversationId] = conv;
            clearDraftRecipientUI();
            try { listenToMessages(currentConversationId); } catch (e) {}
        } catch (e) {
            showChatNotification('Could not start the chat: ' + (e && e.message ? e.message : e), 'error');
            return;
        }
    }

    input.value = '';
    // Optimistic UI: keep focus
    input.focus();

    var attachBtn = document.getElementById('attachBtn');
    var sendBtn = document.querySelector('.send-btn');
    if (attachBtn) attachBtn.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (sendBtn) sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        // Silver+ broadcast: one tap fans the text out to every follower's own chat.
        if (_broadcastOn && !broadcastUsedThisMonth) {
            if (hasFile) {
                showChatNotification('Broadcasts are text-only — switch the broadcast toggle off to send the file.', 'info');
            } else {
                try { await doBroadcastSend(text); }
                catch (be) { input.value = text; }
            }
            if (attachBtn) attachBtn.disabled = false;
            if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>'; }
            return;
        }

        var fileUrl = null, fileName = null, fileType = null, fileSize = null;
        // Upload file first if exists
        if (hasFile) {
            showChatNotification('Uploading ' + selectedFile.name + '...', 'info');
            var file = selectedFile;
            fileName = file.name;
            fileType = file.type || 'application/octet-stream';
            fileSize = file.size;
            var safeName = Date.now() + '_' + fileName.replace(/[^a-zA-Z0-9._-]/g,'_');
            var storagePath = 'chat/' + currentConversationId + '/' + myUid + '/' + safeName;
            var storageRef = firebaseStorage.ref().child(storagePath);
            var snapshot = await storageRef.put(file);
            // ask the server for a private link (attachments are not world-readable any more)
            fileUrl = await mintAttachmentLink(currentConversationId, storagePath);
            // Clear preview after successful upload
            clearFilePreview();
        }

        var msgData = {
            senderId: myUid,
            senderName: myName,
            text: text || '',
            status: 'sent',
            // REQUIRED by the security rules — lets both sides read the message
            participants: conv.participants,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (fileUrl) {
            msgData.fileUrl = fileUrl;
            msgData.filePath = storagePath;      // kept so the link can be re-minted if it expires
            msgData.fileName = fileName;
            msgData.fileType = fileType;
            msgData.fileSize = fileSize;
        }

        await firebaseDB.collection('conversations').doc(currentConversationId)
            .collection('messages').add(msgData);

        // Update conversation summary + mark the other participant as unread (triggers badge + popup globally)
        var otherUid = conv.participants.filter(function(p) { return p !== myUid; })[0];
        var lastMsgPreview = text || (fileUrl ? '📎 ' + (fileName || 'Attachment') : '');
        await firebaseDB.collection('conversations').doc(currentConversationId).update({
            lastMessage: lastMsgPreview,
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            unreadBy: firebase.firestore.FieldValue.arrayUnion(otherUid)
        });
        // Manual refresh after send
        setTimeout(function(){ fetchMessages(currentConversationId); fetchConversations(); }, 400);
        var c = document.getElementById('chatMessages');
        if (c) setTimeout(function(){ c.scrollTop = c.scrollHeight; }, 80);
        if (attachBtn) attachBtn.disabled = false;
        if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>'; }
    } catch (err) {
        console.error('Send message error:', err);
        input.value = text; // restore
        if (hasFile) {
            // Restore file preview so user can retry
            showChatNotification('Failed to send: ' + err.message, 'error');
        } else {
            showMessagesError('Could not send message: ' + err.message);
        }
        if (attachBtn) attachBtn.disabled = false;
        if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>'; }
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

/* ---- Toolbar actions ---- */
function viewSellerProfile() {
    if (!currentConversationId) return;
    var conv = conversationsCache[currentConversationId];
    if (conv && conv.productId) {
        window.open('../../product-detail.html?id=' + conv.productId, '_blank');
    } else {
        showChatNotification('No profile to show for this conversation.', 'info');
    }
}

function reportUser() {
    if (!currentConversationId) return;
    var reason = prompt('Report this user — please describe the problem:');
    if (!reason) return;

    var conv = conversationsCache[currentConversationId];
    var otherUid = conv ? conv.participants.filter(function(p) { return p !== myUid; })[0] : null;

    firebaseDB.collection('reports').add({
        type: 'user',
        reportedUserId: otherUid,
        conversationId: currentConversationId,
        reporterId: myUid,
        reason: reason,
        status: 'open',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        showChatNotification('Report submitted. Our team will review it within 24 hours.', 'success');
    }).catch(function(err) {
        showMessagesError('Could not submit report: ' + err.message);
    });
}

var selectedFile = null;
var mediaRecorder = null;
var audioChunks = [];
var recordingStream = null;
var recordingTimer = null;
var recordingSeconds = 0;
function attachFile() {
    if (!currentConversationId) {
        showChatNotification('Select a conversation first', 'warning');
        return;
    }
    var fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.click();
}
function handleFileSelect(event) {
    var file = event.target.files[0];
    if (!file) return;
    // Validate size: max 10MB for chat
    if (file.size > 10 * 1024 * 1024) {
        showChatNotification('File too large. Max 10MB allowed.', 'error');
        event.target.value = '';
        return;
    }
    selectedFile = file;
    var preview = document.getElementById('filePreview');
    var previewName = document.getElementById('filePreviewName');
    if (preview && previewName) {
        previewName.textContent = file.name + ' (' + (file.size/1024).toFixed(1) + ' KB)';
        preview.style.display = 'flex';
        // Focus message input
        var input = document.getElementById('messageInput');
        if (input) input.focus();
    }
    showChatNotification('File ready: ' + file.name + ' — tap Send to share', 'info');
}
function clearFilePreview() {
    selectedFile = null;
    var preview = document.getElementById('filePreview');
    var fileInput = document.getElementById('fileInput');
    if (preview) preview.style.display = 'none';
    if (fileInput) fileInput.value = '';
}
function formatRecordingTime(sec){
    var m = Math.floor(sec/60).toString().padStart(2,'0');
    var s = (sec%60).toString().padStart(2,'0');
    return m+':'+s;
}
function toggleVoiceRecording(){
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopVoiceRecording(true);
    } else {
        startVoiceRecording();
    }
}
async function startVoiceRecording(){
    if (!currentConversationId) { showChatNotification('Select a conversation first','warning'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showChatNotification('Voice notes not supported in this browser','error'); return;
    }
    try {
        recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch(e){
        showChatNotification('Microphone permission denied. Please allow microphone in browser settings.','error');
        return;
    }
    audioChunks = [];
    var mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4');
    try { mediaRecorder = new MediaRecorder(recordingStream, { mimeType: mime }); } catch(e){ mediaRecorder = new MediaRecorder(recordingStream); }
    mediaRecorder.ondataavailable = function(e){ if(e.data.size>0) audioChunks.push(e.data); };
    mediaRecorder.onstop = function(){
        var duration = formatRecordingTime(recordingSeconds);
        var blobType = mediaRecorder.mimeType || 'audio/webm';
        var blob = new Blob(audioChunks, { type: blobType });
        audioChunks = [];
        // Stop tracks
        if (recordingStream) { recordingStream.getTracks().forEach(function(tr){ tr.stop(); }); recordingStream=null; }
        clearInterval(recordingTimer); recordingTimer=null;
        var voiceUI = document.getElementById('voiceRecordingUI');
        var msgInput = document.getElementById('messageInput');
        var vBtn = document.getElementById('voiceBtn');
        var aBtn = document.getElementById('attachBtn');
        var sBtn = document.getElementById('sendBtn');
        if (voiceUI) voiceUI.style.display='none';
        if (msgInput) { msgInput.style.display=''; msgInput.focus(); }
        if (vBtn) { vBtn.style.display=''; vBtn.classList.remove('recording'); }
        if (aBtn) aBtn.style.display='';
        if (sBtn) sBtn.style.display='';
        // If user cancelled (no flag), we check a global
        if (window._voiceCancelled) { window._voiceCancelled=false; return; }
        if (blob.size < 500) { showChatNotification('Recording too short','warning'); return; }
        // Send as voice note
        sendVoiceNote(blob, duration);
    };
    mediaRecorder.start();
    recordingSeconds = 0;
    var timeEl = document.getElementById('recordingTime');
    if (timeEl) timeEl.textContent='00:00';
    var voiceUI2 = document.getElementById('voiceRecordingUI');
    var msgInput2 = document.getElementById('messageInput');
    var vBtn2 = document.getElementById('voiceBtn');
    var aBtn2 = document.getElementById('attachBtn');
    var sBtn2 = document.getElementById('sendBtn');
    if (voiceUI2) voiceUI2.style.display='flex';
    if (msgInput2) msgInput2.style.display='none';
    if (vBtn2) { vBtn2.style.display='none'; vBtn2.classList.add('recording'); }
    if (aBtn2) aBtn2.style.display='none';
    if (sBtn2) sBtn2.style.display='none';
    // Hide file preview if any
    var fp = document.getElementById('filePreview'); if(fp) fp.style.display='none';
    recordingTimer = setInterval(function(){
        recordingSeconds++;
        var te = document.getElementById('recordingTime');
        if (te) te.textContent = formatRecordingTime(recordingSeconds);
        if (recordingSeconds >= 120) { // max 2 minutes
            showChatNotification('Max 2 minutes reached, sending...','info');
            stopVoiceRecording(true);
        }
    }, 1000);
    showChatNotification('Recording… tap microphone again or Send to stop','info');
}
function stopVoiceRecording(shouldSend){
    window._voiceCancelled = !shouldSend;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        try{ mediaRecorder.stop(); }catch(e){}
    } else {
        // Just hide UI if not recording
        var voiceUI = document.getElementById('voiceRecordingUI');
        var msgInput = document.getElementById('messageInput');
        var vBtn = document.getElementById('voiceBtn');
        var aBtnx = document.getElementById('attachBtn');
        var sBtnx = document.getElementById('sendBtn');
        if (voiceUI) voiceUI.style.display='none';
        if (msgInput) msgInput.style.display='';
        if (vBtn) { vBtn.style.display=''; vBtn.classList.remove('recording'); }
        if (aBtnx) aBtnx.style.display='';
        if (sBtnx) sBtnx.style.display='';
        if (recordingStream) { recordingStream.getTracks().forEach(function(tr){ tr.stop(); }); recordingStream=null; }
        clearInterval(recordingTimer); recordingTimer=null;
    }
}
function cancelVoiceRecording(){ stopVoiceRecording(false); showChatNotification('Voice note cancelled','info'); }
async function sendVoiceNote(blob, duration){
    if (!currentConversationId) return;
    var conv = conversationsCache[currentConversationId];
    if (!conv) return;
    var fileName = 'voice_' + Date.now() + (blob.type.includes('mp4') ? '.m4a' : '.webm');
    var fileType = blob.type || 'audio/webm';
    showChatNotification('Sending voice note ' + duration + '...','info');
    try {
        var safeName = Date.now() + '_voice_' + Math.random().toString(36).slice(2,6) + (fileType.includes('mp4') ? '.m4a' : '.webm');
        var storagePath = 'chat/' + currentConversationId + '/' + myUid + '/' + safeName;
        var storageRef = firebaseStorage.ref().child(storagePath);
        var snapshot = await storageRef.put(blob, { contentType: fileType });
        var fileUrl = await mintAttachmentLink(currentConversationId, storagePath);
        var msgData = {
            senderId: myUid,
            senderName: myName,
            text: '',
            fileUrl: fileUrl,
            filePath: storagePath,
            fileName: fileName,
            fileType: fileType,
            fileSize: blob.size,
            fileDuration: duration,
            status: 'sent',
            participants: conv.participants,   // REQUIRED by the security rules
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await firebaseDB.collection('conversations').doc(currentConversationId).collection('messages').add(msgData);
        var otherUid = conv.participants.filter(function(p){ return p !== myUid; })[0];
        await firebaseDB.collection('conversations').doc(currentConversationId).update({
            lastMessage: '🎤 Voice note ' + duration,
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            unreadBy: firebase.firestore.FieldValue.arrayUnion(otherUid)
        });
        setTimeout(function(){ fetchMessages(currentConversationId); fetchConversations(); }, 400);
        var c = document.getElementById('chatMessages');
        if (c) setTimeout(function(){ c.scrollTop = c.scrollHeight; }, 80);
    } catch(err){
        console.error('Voice send error', err);
        showChatNotification('Could not send voice note: ' + err.message,'error');
    }
}

function markAllRead() {
    Object.keys(conversationsCache).forEach(function(convId) {
        var conv = conversationsCache[convId];
        if (conv.unreadBy && conv.unreadBy.indexOf(myUid) !== -1) {
            var remaining = conv.unreadBy.filter(function(u) { return u !== myUid; });
            firebaseDB.collection('conversations').doc(convId).update({ unreadBy: remaining }).catch(function() {});
            conv.unreadBy = remaining;
        }
        // Also mark all messages in that conv as read if any are to me
        firebaseDB.collection('conversations').doc(convId).collection('messages')
            .where('participants','array-contains', myUid)
            .where('senderId','!=', myUid).get().then(function(snap){
                snap.forEach(function(doc){
                    var d = doc.data();
                    if (d.status !== 'read' && d.status !== 'seen') {
                        doc.ref.update({ status: 'read', readAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(function(){});
                    }
                });
            }).catch(function(){});
    });
}

/* ---- Search ---- */
function initConversationSearch() {
    var searchInput = document.getElementById('searchConversations');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            var query = this.value.toLowerCase();
            document.querySelectorAll('.conversation-item').forEach(function(item) {
                var text = item.textContent.toLowerCase();
                item.style.display = text.includes(query) ? '' : 'none';
            });
        });
    }
}

/* ---- Date grouping helper ---- */
function formatMsgDateLabel(date) {
    var now = new Date();
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === yesterday.getTime()) return 'Yesterday';
    return date.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
}

/* ---- Helpers ---- */
function formatMsgTime(date) {
    var now = new Date();
    var diffMs = now - date;
    var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Escapes a value for BOTH an HTML attribute and a single-quoted JS string
// inside an inline handler (e.g. onclick="fn('...')"). Entities are decoded by
// the HTML parser before the JS runs, so quotes must be handled twice.
function escJsAttr(v) {
  return String(v == null ? '' : v)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/\r?\n/g, ' ');
}


function showMessagesError(message) {
    if (typeof showFlashMessage === 'function') {
        showFlashMessage(message, 'error');
    } else {
        alert(message);
    }
}

function showChatNotification(message, type) {
    document.querySelectorAll('.chat-notification').forEach(function(n) { n.remove(); });

    var colors = { info: 'var(--primary-color)', success: 'var(--success-color)', warning: 'var(--accent-color)', error: 'var(--error-color)' };
    var icons = { info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-circle', error: 'fa-times-circle' };

    var notification = document.createElement('div');
    notification.className = 'chat-notification';
    notification.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:10000;background:white;padding:1rem 1.5rem;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);display:flex;align-items:center;gap:0.75rem;border-left:4px solid ' + colors[type] + ';max-width:400px;';
    notification.innerHTML = '<i class="fas ' + icons[type] + '" style="color:' + colors[type] + ';font-size:1.25rem;"></i><span style="font-size:0.9rem;">' + escapeHtml(message) + '</span>';
    document.body.appendChild(notification);
    setTimeout(function() { notification.remove(); }, 3000);
}

// --- Offline attachment cache (stored on phone, no Firebase redirect on open) ---
var attachmentDBPromise = null;
function getAttachmentDB(){
    if (attachmentDBPromise) return attachmentDBPromise;
    attachmentDBPromise = new Promise(function(resolve, reject){
        var req = indexedDB.open('sankofa-attachments', 2);
        req.onupgradeneeded = function(e){ var db=e.target.result; if(!db.objectStoreNames.contains('files')) db.createObjectStore('files', {keyPath:'url'}); if(!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', {keyPath:'url'}); };
        req.onsuccess = function(e){ resolve(e.target.result); };
        req.onerror = function(e){ reject(e.target.error); };
    });
    return attachmentDBPromise;
}
function cacheAttachment(url, fileName, fileType){
    if(!url) return;
    // Use Cache API if available for faster offline, plus IndexedDB
    if ('caches' in window) {
        caches.open('sankofa-attachments-v1').then(function(cache){ cache.add(url).catch(function(){}); }).catch(function(){});
    }
    getAttachmentDB().then(function(db){
        var tx = db.transaction('files','readonly');
        var store = tx.objectStore('files');
        var getReq = store.get(url);
        getReq.onsuccess = function(){
            if(getReq.result && getReq.result.blob) {
                // Update any img src that is still Firebase to blob URL for offline display
                try { updateAttachmentElements(url, getReq.result.blob); } catch(e){}
                return;
            }
            fetch(url, {mode:'cors'}).then(function(r){ if(!r.ok) throw new Error('Fetch failed '+r.status); return r.blob(); }).then(function(blob){
                var tx2 = db.transaction('files','readwrite');
                tx2.objectStore('files').put({url:url, blob:blob, fileName:fileName||'file', fileType:fileType||'', cachedAt:Date.now()});
                try { updateAttachmentElements(url, blob); } catch(e){}
            }).catch(function(){});
        };
    }).catch(function(){});
}
function updateAttachmentElements(url, blob){
    var blobUrl = URL.createObjectURL(blob);
    // Update images
    document.querySelectorAll('img[data-file-url]').forEach(function(img){
        if (img.getAttribute('data-file-url')===url) {
            img.src = blobUrl;
            img.setAttribute('data-cached','true');
            // Revoke after a while? Keep for session
        }
    });
    // Update audio sources
    document.querySelectorAll('audio[data-file-url]').forEach(function(aud){
        if (aud.getAttribute('data-file-url')===url) {
            aud.src = blobUrl;
            aud.setAttribute('data-cached','true');
        }
    });
}
function openAttachment(event, url, fileName, fileType){
    if(event) { event.preventDefault(); event.stopPropagation(); }
    var a = event ? event.currentTarget : null;
    // Find the closest anchor if click was on child icon
    if (a && a.tagName !== 'A') a = a.closest ? a.closest('a') : a;
    var origText = a ? a.innerHTML : '';
    if(a) {
        a.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#0064d2;"></i> Downloading to phone...';
        a.style.pointerEvents = 'none';
    }
    showChatNotification('Downloading ' + (fileName||'file') + ' to phone...', 'info');
    getAttachmentDB().then(function(db){
        var tx = db.transaction('files','readonly');
        var req = tx.objectStore('files').get(url);
        req.onsuccess = function(){
            if(req.result && req.result.blob){
                var blobUrl = URL.createObjectURL(req.result.blob);
                // For images/audio, open in viewer from cache; for other files, download
                if (fileType && fileType.startsWith('image/')) {
                    window.open(blobUrl, '_blank', 'noopener');
                    showChatNotification('Opened from phone storage: ' + (fileName||'image'), 'success');
                } else if (fileType && fileType.startsWith('audio/')) {
                    window.open(blobUrl, '_blank', 'noopener');
                    showChatNotification('Playing from phone storage', 'success');
                } else {
                    triggerDownload(blobUrl, fileName || req.result.fileName || 'file');
                }
                if(a) { a.innerHTML = origText; a.style.pointerEvents=''; }
                setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 60000);
            } else {
                // Not cached — fetch from Firebase, save to phone, then open from phone
                fetch(url, {mode:'cors', cache:'no-store'}).then(function(r){
                    if(!r.ok) throw new Error('Network error '+r.status);
                    return r.blob();
                }).then(function(blob){
                    // Save to IndexedDB for offline next time
                    getAttachmentDB().then(function(db2){
                        try{
                            var tx2 = db2.transaction('files','readwrite');
                            tx2.objectStore('files').put({url:url, blob:blob, fileName:fileName, fileType:fileType, cachedAt:Date.now()});
                        }catch(e){}
                    });
                    // Also try Cache API
                    if ('caches' in window) {
                        caches.open('sankofa-attachments-v1').then(function(cache){
                            try { cache.put(url, new Response(blob)); } catch(e){}
                        });
                    }
                    var blobUrl2 = URL.createObjectURL(blob);
                    if (fileType && fileType.startsWith('image/')) {
                        window.open(blobUrl2, '_blank', 'noopener');
                        showChatNotification('Saved to phone & opened: ' + (fileName||'image'), 'success');
                    } else if (fileType && fileType.startsWith('audio/')) {
                        window.open(blobUrl2, '_blank', 'noopener');
                        showChatNotification('Saved to phone & playing', 'success');
                    } else {
                        triggerDownload(blobUrl2, fileName);
                    }
                    if(a) { a.innerHTML = origText; a.style.pointerEvents=''; }
                    setTimeout(function(){ URL.revokeObjectURL(blobUrl2); }, 60000);
                }).catch(function(err){
                    if(a) { a.innerHTML = origText; a.style.pointerEvents=''; }
                    showChatNotification('Download failed: ' + err.message + ' — opening from cloud', 'error');
                    // Last resort: open Firebase directly
                    window.open(url, '_blank', 'noopener');
                });
            }
        };
        req.onerror = function(){ if(a){ a.innerHTML=origText; a.style.pointerEvents=''; } window.open(url, '_blank','noopener'); };
    }).catch(function(){ if(a){ a.innerHTML=origText; a.style.pointerEvents=''; } window.open(url, '_blank','noopener'); });
    return false;
}
function triggerDownload(blobUrl, fileName){
    var a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || 'download';
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ try{document.body.removeChild(a);}catch(e){} }, 1000);
    showChatNotification('Saved to Downloads: ' + (fileName||'file'), 'success');
}
function downloadAttachment(url, fileName, fileType, cacheKey){
    var rowEl = document.getElementById('file_' + cacheKey);
    var previewEl = document.getElementById('preview_' + cacheKey);
    if (rowEl) rowEl.innerHTML = '<div style="display:flex; align-items:center; gap:0.5rem; padding:0.4rem; color:#0064d2; font-size:0.82rem;"><i class="fas fa-spinner fa-spin"></i> Downloading to phone...</div>';
    showChatNotification('Downloading ' + (fileName||'file') + ' to phone...', 'info');
    // Always do direct browser download first — this always works and saves to Downloads, even if fetch CORS fails
    try {
        var aDirect = document.createElement('a');
        aDirect.href = url;
        aDirect.download = fileName || 'download';
        aDirect.target = '_blank';
        aDirect.rel = 'noopener';
        aDirect.style.display='none';
        document.body.appendChild(aDirect);
        aDirect.click();
        setTimeout(function(){ try{document.body.removeChild(aDirect);}catch(e){} }, 1200);
    } catch(e) {
        try { window.open(url, '_blank', 'noopener'); } catch(e2){}
    }
    // In background, try to cache for offline open (best-effort, no error shown to user)
    try {
        fetch(url, {mode:'cors', cache:'no-store'}).then(function(r){
            if(!r.ok) throw new Error('Network error '+r.status);
            return r.blob();
        }).then(function(blob){
            getAttachmentDB().then(function(db){
                try{ var tx=db.transaction('files','readwrite'); tx.objectStore('files').put({url:url, blob:blob, fileName:fileName, fileType:fileType, cachedAt:Date.now()}); }catch(e){}
                if ('caches' in window) { caches.open('sankofa-attachments-v1').then(function(cache){ try{ cache.put(url, new Response(blob)); }catch(e){} }); }
            });
            if (previewEl) {
                var blobUrl = URL.createObjectURL(blob);
                var isImg = fileType && fileType.startsWith('image/');
                var isAud = fileType && fileType.startsWith('audio/');
                if (isImg) {
                    previewEl.innerHTML = '<a href="#" onclick="openAttachment(event,\'' + escJsAttr(url) + '\',\'' + escJsAttr(fileName) + '\',\'' + escJsAttr(fileType) + '\');return false;" style="display:block;"><img src="' + blobUrl + '" alt="' + escapeHtml(fileName) + '" style="max-width:220px; max-height:220px; border-radius:8px; display:block; border:1px solid rgba(0,0,0,0.08);"></a><div style="font-size:0.62rem; color:#16a34a; margin-top:0.2rem;"><i class="fas fa-check-circle"></i> Saved on phone — tap to open offline</div>';
                } else if (isAud) {
                    previewEl.innerHTML = '<audio controls src="' + blobUrl + '" style="width:220px; max-width:100%; height:32px; display:block; background:#f1f5f9; border-radius:8px;"></audio><div style="font-size:0.62rem; color:#16a34a; margin-top:0.2rem;"><i class="fas fa-check-circle"></i> Saved — playing from phone</div>';
                } else {
                    previewEl.innerHTML = '<a href="#" onclick="openAttachment(event,\'' + escJsAttr(url) + '\',\'' + escJsAttr(fileName) + '\',\'' + escJsAttr(fileType) + '\');return false;" style="display:inline-flex; align-items:center; gap:0.5rem; background:#f0fdf4; border:1px solid #bbf7d0; padding:0.5rem 0.7rem; border-radius:8px; color:#166534; font-size:0.82rem; text-decoration:none;"><i class="fas fa-check-circle" style="color:#16a34a;"></i> ' + escapeHtml(fileName) + ' — Tap to open from phone</a>';
                }
                previewEl.style.display = 'block';
            }
            if (rowEl) rowEl.style.display = 'none';
            showChatNotification('Saved to Downloads & phone storage: ' + (fileName||'file'), 'success');
        }).catch(function(err){
            console.log('Background cache failed (direct download already done):', err.message);
            // Still show success because direct download already started
            if (previewEl) {
                previewEl.innerHTML = '<div style="display:flex; align-items:center; gap:0.5rem; padding:0.4rem; color:#16a34a; font-size:0.82rem;"><i class="fas fa-check-circle"></i> Download started — check Downloads. <a href="#" onclick="openAttachment(event,\'' + escJsAttr(url) + '\',\'' + escJsAttr(fileName) + '\',\'' + escJsAttr(fileType) + '\');return false;" style="color:#0064d2; text-decoration:underline; margin-left:0.3rem;">Open</a></div>';
                previewEl.style.display = 'block';
            }
            if (rowEl) rowEl.style.display = 'none';
        });
    } catch(e){
        console.log('Background cache error', e);
    }
    // Immediately hide download row and show success (direct download already triggered)
    setTimeout(function(){
        if (rowEl) rowEl.style.display = 'none';
        if (previewEl && previewEl.innerHTML === '') {
            previewEl.innerHTML = '<div style="display:flex; align-items:center; gap:0.5rem; padding:0.4rem; color:#16a34a; font-size:0.82rem;"><i class="fas fa-check-circle"></i> Download started — check Downloads</div>';
            previewEl.style.display = 'block';
        }
    }, 600);
}
function prefetchAttachment(url, fileName, fileType){
    // Call when rendering a message with fileUrl — caches in background, no UI
    if(!url) return;
    // Don't prefetch too large files auto (>15MB) to save data
    cacheAttachment(url, fileName, fileType);
}

/* ============================================================================
   PRIVATE ATTACHMENT LINKS
   ---------------------------------------------------------------------------
   Chat files are no longer readable straight from Storage (anyone signed in could open a
   file if they knew its path or its download URL). They are served by the `chatAttachment`
   Cloud Function, and the only way to get a link is `authoriseChatAttachment`, which checks
   on the server that you really are in this conversation.
   ========================================================================== */
async function mintAttachmentLink(conversationId, storagePath) {
    if (typeof firebase === 'undefined' || !firebase.functions) {
        throw new Error('The secure attachment service has not loaded — please refresh and try again.');
    }
    var fn = firebase.functions().httpsCallable('authoriseChatAttachment');
    var res = await fn({ conversationId: conversationId, storagePath: storagePath });
    if (!res.data || !res.data.url) throw new Error('Could not create a private link for that file.');
    return res.data.url;
}

/** Older messages may still hold a Storage URL — ask for a fresh private link. */
async function refreshAttachmentLink(storagePath, conversationId) {
    try {
        var path = storagePath || '';
        var convId = conversationId || (path.split('/')[1] || '');
        if (!path || !convId) return null;
        return await mintAttachmentLink(convId, path);
    } catch (e) {
        console.warn('could not refresh attachment link', e && e.message);
        return null;
    }
}

window.mintAttachmentLink = mintAttachmentLink;
window.refreshAttachmentLink = refreshAttachmentLink;

/** If a private attachment link expires (or was revoked), ask for a new one and retry once.
 *  Falls back to a placeholder if there is no stored path to re-mint from. */
async function smReattach(el) {
    try {
        if (!el || el.dataset.reattachTried === '1') {
            if (el && el.tagName === 'IMG') { el.onerror = null; el.src = '/images/placeholders/product.svg'; }
            return;
        }
        el.dataset.reattachTried = '1';
        const path = el.getAttribute('data-filepath');
        const conv = el.getAttribute('data-convid');
        if (!path) { if (el.tagName === 'IMG') el.src = '/images/placeholders/product.svg'; return; }
        const url = await refreshAttachmentLink(path, conv);
        if (!url) { if (el.tagName === 'IMG') el.src = '/images/placeholders/product.svg'; return; }
        if (el.tagName === 'IMG') el.src = url;
        else if (el.tagName === 'AUDIO') { el.src = url; el.load(); }
        else if (el.tagName === 'A' || el.tagName === 'VIDEO') el.src = url;
    } catch (e) { /* never let this break a message */ }
}
window.smReattach = smReattach;

/** Stop every live listener (switching chats, or leaving the page). */
function stopAllMessageListeners() {
    stopMessageListener();
    if (convListUnsub) { try { convListUnsub(); } catch (e) {} convListUnsub = null; }
}
window.addEventListener('beforeunload', stopAllMessageListeners);
window.addEventListener('pagehide', stopAllMessageListeners);

/* ============================================================================
   BARGAIN PRICE (offers) — the seller sets a buyer-only price inside THIS chat.
   - one offer per item per chat: offers/{conversationId_productId}
   - alive for exactly 24 hours — the rules make expiresAt = createdAt + 24h and
     refuse backdated clocks on creation
   - the listing's public price never moves; everyone else still sees it
   - paying creates a normal order; the orders rules demand an exact match with
     the live offer, so an "agreed price" can never be faked from the browser
   - when the buyer pays, the server marks the offer PAID and posts the receipt
     right into this thread (see announceOfferPaidInChat in functions)
   ========================================================================== */

var _offer = { convId: null, offerId: null, unsub: null, data: null, product: null, isSeller: false, timer: null, lastHtml: '' };

/* ---- Gold ✓ PREMIUM / purple ◆ DIAMOND pill in the chat header ---- */
var _chatPremCache = {};   // uid -> {tier, ends} | null
function paintChatPremiumBadge(uid, nameEl, otherName) {
    if (!uid || !nameEl || typeof firebaseDB === 'undefined' || !firebaseDB) return;
    function paint(rec) {
        var ends = rec && (rec.ends || 0), tier = ends > Date.now() ? rec.tier : null;
        if (!tier) return;
        var isDiamond = tier === 'diamond';
        nameEl.innerHTML = escapeHtml(otherName) +
            ' <span style="display:inline-flex;align-items:center;gap:0.2rem;font-size:0.56rem;font-weight:800;letter-spacing:0.4px;padding:0.1rem 0.42rem;border-radius:999px;vertical-align:middle;' +
            (isDiamond ? 'background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;' : 'background:#f5af02;color:#191919;') + '">' +
            '<i class="fas ' + (isDiamond ? 'fa-gem' : 'fa-check-circle') + '"></i> ' + (isDiamond ? 'DIAMOND' : 'PREMIUM') + '</span>';
    }
    if (_chatPremCache[uid] !== undefined) { paint(_chatPremCache[uid]); return; }
    firebaseDB.collection('sellerPublic').doc(uid).get().then(function (doc) {
        if (doc.exists) {
            var x = doc.data() || {};
            _chatPremCache[uid] = { tier: String(x.tier || 'gold').toLowerCase(), ends: x.premiumExpiry && x.premiumExpiry.toMillis ? x.premiumExpiry.toMillis() : 0 };
        } else {
            _chatPremCache[uid] = null;
        }
        // only repaint if the header still shows the same person
        if (nameEl.textContent.indexOf((otherName || '').slice(0, 4)) !== -1) paint(_chatPremCache[uid]);
    }).catch(function () {});
}

var BARGAIN_CSS =
    '.bargain-btn{min-height:42px;border:none;border-radius:9px;padding:0.5rem 1rem;font-weight:800;font-size:0.8rem;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:0.35rem;justify-content:center;}' +
    '.bargain-btn-gold{background:#f5af02;color:#191919;}' +
    '.bargain-btn-blue{background:#0064d2;color:#fff;}' +
    '.bargain-btn-outline{background:#fff;border:1.5px solid #e5e7eb;color:#374151;}' +
    '.bargain-btn:disabled{opacity:0.6;cursor:default;}';
function bargainEnsureCss() {
    if (document.getElementById('bargainCss')) return;
    var s = document.createElement('style');
    s.id = 'bargainCss';
    s.textContent = BARGAIN_CSS;
    document.head.appendChild(s);
}

function bargainEsc(t) {
    return (typeof escapeHtml === 'function') ? escapeHtml(t) : String(t == null ? '' : t);
}

/** The live (unexpired) pending offer, or null. */
function bargainLiveOffer() {
    var o = _offer.data;
    if (!o || o.status !== 'pending' || !o.expiresAt) return null;
    try { if (o.expiresAt.toMillis() <= Date.now()) return null; } catch (e) { return null; }
    return o;
}

function bargainCountdown(expiresAt) {
    var left = 0;
    try { left = expiresAt.toMillis() - Date.now(); } catch (e) { return ''; }
    if (left <= 0) return 'expired';
    var h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000);
    return h > 0 ? (h + 'h ' + m + 'm') : (m + ' min');
}

async function initBargainForConversation(conv) {
    var area = document.getElementById('offerArea');
    if (_offer.unsub) { try { _offer.unsub(); } catch (e) {} }
    if (_offer.timer) { clearInterval(_offer.timer); }
    _offer = { convId: null, offerId: null, unsub: null, data: null, product: null, isSeller: false, timer: null, lastHtml: '' };
    if (area) { area.style.display = 'none'; area.innerHTML = ''; }
    if (!conv || !conv.productId || typeof firebaseDB === 'undefined' || !firebaseDB) return;

    _offer.convId = conv.id;
    _offer.offerId = conv.id + '_' + conv.productId;

    // the LIVE listing — its price may have moved since the chat started
    var snap = null;
    try { snap = await firebaseDB.collection('products').doc(conv.productId).get(); } catch (e) {}
    _offer.product = (snap && snap.exists) ? snap.data() : null;
    _offer.isSeller = !!(_offer.product && _offer.product.sellerId === myUid);

    // live offer card: edits on another phone appear here instantly
    _offer.unsub = firebaseDB.collection('offers').doc(_offer.offerId)
        .onSnapshot(function (doc) {
            _offer.data = doc.exists ? doc.data() : null;
            renderBargainBar();
        }, function () { _offer.data = null; renderBargainBar(); });
    _offer.timer = setInterval(renderBargainBar, 60000);   // countdown tick + expiry flip
    renderBargainBar();
}

function bargainBarWrap(bg, border, textHtml, buttonsHtml) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;background:' + bg + ';border:1.5px solid ' + border + ';border-radius:12px;padding:0.55rem 0.75rem;">' +
        '<div style="display:flex;flex-direction:column;gap:0.12rem;min-width:0;">' + textHtml + '</div>' +
        (buttonsHtml ? '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">' + buttonsHtml + '</div>' : '') +
        '</div>';
}

function renderBargainBar() {
    var area = document.getElementById('offerArea');
    if (!area || !_offer.convId) return;
    var conv = conversationsCache[_offer.convId];
    if (!conv) { area.style.display = 'none'; return; }
    bargainEnsureCss();

    var liveOffer = bargainLiveOffer();
    var o = _offer.data;
    var normalPrice = Number(_offer.product ? _offer.product.price : conv.productPrice) || 0;
    var html = '';

    if (_offer.isSeller) {
        if (o && o.status === 'paid') {
            html = bargainBarWrap('#f0fdf4', '#bbf7d0',
                '<span style="color:#16a34a;font-weight:800;"><i class="fas fa-circle-check"></i> GHS ' + Number(o.offerPrice || 0).toLocaleString() + ' paid ✓</span>' +
                '<span style="font-size:0.72rem;color:#5a6572;">escrow releases after delivery is confirmed</span>');
        } else if (liveOffer) {
            html = bargainBarWrap('#fffbeb', '#fde68a',
                '<span style="font-weight:800;color:#191919;"><i class="fas fa-bolt" style="color:#f5af02;"></i> You offered GHS ' + Number(liveOffer.offerPrice).toLocaleString() +
                ' <strike style="color:#9ca3af;font-weight:500;">GHS ' + Number(liveOffer.originalPrice).toLocaleString() + '</strike></span>' +
                '<span style="font-size:0.72rem;color:#92400e;"><i class="fas fa-clock"></i> ' + bargainCountdown(liveOffer.expiresAt) + ' left — only this buyer sees it</span>',
                '<button type="button" id="bargainChangeBtn" class="bargain-btn bargain-btn-outline"><i class="fas fa-tag"></i> Change</button>' +
                '<button type="button" id="bargainCancelBtn" class="bargain-btn bargain-btn-outline" style="color:#dc2626;border-color:#fecaca;"><i class="fas fa-ban"></i> Cancel</button>');
        } else {
            html = bargainBarWrap('#f8fafc', '#e2e8f0',
                '<span style="font-size:0.82rem;color:#374151;"><i class="fas fa-handshake" style="color:#0064d2;"></i> Agreed on a price in the chat?' +
                (o && o.status === 'cancelled' ? ' <span style="color:#9ca3af;">(last one was cancelled)</span>' : '') +
                (o && o.status === 'pending' && !liveOffer ? ' <span style="color:#9ca3af;">(the last one expired)</span>' : '') + '</span>',
                '<button type="button" id="bargainSetBtn" class="bargain-btn bargain-btn-gold"><i class="fas fa-bolt"></i> Set special price</button>');
        }
    } else {
        if (o && o.status === 'paid') {
            html = bargainBarWrap('#f0fdf4', '#bbf7d0',
                '<span style="color:#16a34a;font-weight:800;"><i class="fas fa-circle-check"></i> You paid GHS ' + Number(o.offerPrice || 0).toLocaleString() + ' ✓</span>' +
                '<span style="font-size:0.72rem;color:#5a6572;">escrow holds it until you confirm delivery</span>');
        } else if (liveOffer) {
            var save = Math.max(0, Math.round((Number(liveOffer.originalPrice) - Number(liveOffer.offerPrice)) * 100) / 100);
            html = '<div style="border:2px solid #f5af02;background:#fffbeb;border-radius:12px;padding:0.65rem 0.75rem;" id="bargainCard">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;flex-wrap:wrap;">' +
                '<div style="min-width:0;">' +
                '<div style="font-size:0.68rem;font-weight:800;color:#92400e;letter-spacing:0.5px;"><i class="fas fa-bolt"></i> SPECIAL PRICE FOR YOU · <i class="fas fa-clock"></i> ' + bargainCountdown(liveOffer.expiresAt) + ' left</div>' +
                '<div style="font-size:1.15rem;font-weight:800;color:#191919;margin-top:0.1rem;">GHS ' + Number(liveOffer.offerPrice).toLocaleString() +
                ' <strike style="font-size:0.8rem;color:#9ca3af;font-weight:500;">GHS ' + Number(liveOffer.originalPrice).toLocaleString() + '</strike>' +
                (save > 0 ? ' <span style="font-size:0.72rem;color:#16a34a;font-weight:800;">you save GHS ' + save.toLocaleString() + '</span>' : '') + '</div>' +
                '<div style="font-size:0.72rem;color:#5a6572;">Only you see this price — everyone else still pays GHS ' + normalPrice.toLocaleString() + '.</div>' +
                '</div>' +
                '<button type="button" id="bargainPayBtn" class="bargain-btn bargain-btn-gold" style="font-size:0.9rem;padding:0.65rem 1.1rem;"><i class="fas fa-lock"></i> Pay GHS ' + Number(liveOffer.offerPrice).toLocaleString() + '</button>' +
                '</div>' +
                '</div>';
        } else {
            var flashNow = smFlashActiveMsg(_offer.product);
            var payNow = flashNow ? flashNow.price : normalPrice;
            var subtitle = (o && o.status === 'pending')
                ? '<i class="fas fa-hourglass-half" style="color:#9ca3af;"></i> The GHS ' + Number(o.offerPrice).toLocaleString() + ' special price expired — the normal price applies again.'
                : flashNow
                    ? '<i class="fas fa-bolt" style="color:#dc2626;"></i> <b style="color:#dc2626;">FLASH SALE -' + flashNow.percent + '%</b> — pay GHS ' + payNow.toLocaleString() + ' <strike style="color:#9ca3af;">GHS ' + normalPrice.toLocaleString() + '</strike>'
                    : '<i class="fas fa-shield-alt" style="color:#16a34a;"></i> Ready to buy? Escrow protects your money until delivery.';
            html = bargainBarWrap('#f8fafc', '#e2e8f0',
                '<span style="font-size:0.8rem;color:#5a6572;">' + subtitle + '</span>',
                '<button type="button" id="bargainPayBtn" class="bargain-btn bargain-btn-blue"><i class="fas fa-lock"></i> Pay GHS ' + payNow.toLocaleString() + '</button>');
        }
    }

    if (!html) { area.style.display = 'none'; area.innerHTML = ''; _offer.lastHtml = ''; return; }
    if (html === _offer.lastHtml) return;      // no flicker on timer ticks
    _offer.lastHtml = html;
    area.innerHTML = html;
    area.style.display = 'block';

    var setBtn = document.getElementById('bargainSetBtn');
    var changeBtn = document.getElementById('bargainChangeBtn');
    var cancelBtn = document.getElementById('bargainCancelBtn');
    var payBtn = document.getElementById('bargainPayBtn');
    if (setBtn) setBtn.addEventListener('click', openBargainModal);
    if (changeBtn) changeBtn.addEventListener('click', openBargainModal);
    if (cancelBtn) cancelBtn.addEventListener('click', cancelBargainPrice);
    if (payBtn) payBtn.addEventListener('click', payFromChat);
}

/* ---- seller: set / re-price ---- */

function openBargainModal() {
    if (!_offer.isSeller || !_offer.product) return;
    closeBargainModal();
    bargainEnsureCss();
    var normal = Number(_offer.product.price || 0);
    var current = bargainLiveOffer();
    var overlay = document.createElement('div');
    overlay.id = 'bargainModal';
    overlay.setAttribute('style', 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:4000;display:flex;align-items:flex-end;justify-content:center;');
    overlay.innerHTML =
        '<div style="background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:480px;padding:1.1rem 1.1rem calc(1.1rem + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(0,0,0,0.25);max-height:88vh;overflow-y:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">' +
        '<h3 style="margin:0;font-size:1.05rem;color:#191919;"><i class="fas fa-bolt" style="color:#f5af02;"></i> Special price for this buyer</h3>' +
        '<button type="button" id="bargainCloseBtn" aria-label="Close" style="background:none;border:none;font-size:1.2rem;color:#6b7280;cursor:pointer;min-width:40px;min-height:40px;"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div style="font-size:0.85rem;color:#5a6572;margin-bottom:0.7rem;line-height:1.5;">Normal price: <strong style="color:#191919;">GHS ' + normal.toLocaleString() + '</strong>. The special price applies <strong>only inside this chat</strong> and dies automatically after <strong>24 hours</strong>.</div>' +
        '<div style="display:flex;gap:0.4rem;margin-bottom:0.6rem;flex-wrap:wrap;">' +
        [5, 10, 20].map(function (pct) {
            var v = Math.max(1, Math.round(normal * (1 - pct / 100) * 100) / 100);
            return '<button type="button" class="bargain-chip" data-pct="' + pct + '" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:0.45rem 0.8rem;font-size:0.78rem;font-weight:700;color:#0064d2;cursor:pointer;min-height:38px;">−' + pct + '% → GHS ' + v.toLocaleString() + '</button>';
        }).join('') +
        '</div>' +
        '<label for="bargainPriceInput" style="font-size:0.78rem;font-weight:700;color:#374151;">Special price (GHS)</label>' +
        '<input type="number" inputmode="decimal" min="1" step="0.01" id="bargainPriceInput" value="' + (current ? current.offerPrice : '') + '" placeholder="e.g. ' + Math.max(1, Math.round(normal * 0.9)) + '" ' +
        'style="width:100%;box-sizing:border-box;margin-top:0.25rem;border:1.5px solid #d1d5db;border-radius:10px;padding:0.65rem 0.75rem;font-size:1rem;">' +
        '<div id="bargainError" style="display:none;color:#dc2626;font-size:0.78rem;margin-top:0.4rem;font-weight:600;"></div>' +
        '<button type="button" id="bargainSubmitBtn" style="width:100%;min-height:46px;margin-top:0.7rem;background:#f5af02;color:#191919;border:none;border-radius:10px;font-weight:800;font-size:0.95rem;cursor:pointer;"><i class="fas fa-bolt"></i> Send special price (24h)</button>' +
        '<div style="font-size:0.72rem;color:#9ca3af;text-align:center;margin-top:0.45rem;">The buyer pays securely from this chat; money sits in escrow until they confirm delivery.</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeBargainModal(); });
    document.getElementById('bargainCloseBtn').addEventListener('click', closeBargainModal);
    document.getElementById('bargainSubmitBtn').addEventListener('click', submitBargainPrice);
    Array.prototype.forEach.call(overlay.querySelectorAll('.bargain-chip'), function (chip) {
        chip.addEventListener('click', function () {
            var pct = Number(chip.getAttribute('data-pct')) || 0;
            var input = document.getElementById('bargainPriceInput');
            if (input) input.value = Math.max(1, Math.round(normal * (1 - pct / 100) * 100) / 100);
        });
    });
    var inp = document.getElementById('bargainPriceInput');
    if (inp) inp.focus();
}

function closeBargainModal() {
    var m = document.getElementById('bargainModal');
    if (m && m.parentNode) m.parentNode.removeChild(m);
}

/** Post the bargain note into the thread exactly the way sendMessage() does. */
async function bargainPostNote(text) {
    var conv = conversationsCache[_offer.convId];
    if (!conv) return;
    var otherUid = conv.participants.filter(function (p) { return p !== myUid; })[0];
    await firebaseDB.collection('conversations').doc(_offer.convId).collection('messages').add({
        senderId: myUid,
        senderName: myName,
        text: text,
        status: 'sent',
        participants: conv.participants,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await firebaseDB.collection('conversations').doc(_offer.convId).update({
        lastMessage: text,
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
        unreadBy: firebase.firestore.FieldValue.arrayUnion(otherUid)
    });
}

/* ===== FLASH SALE awareness (Gold+ perk) — buyers pay the sale price ===== */
function smFlashActiveMsg(prod) {
    var f = prod && prod.flashSale;
    if (!f || !f.endsAt) return null;
    var end = f.endsAt.toDate ? f.endsAt.toDate() : new Date(f.endsAt);
    var pct = Number(f.percent || 0);
    if (!(pct >= 1) || !(end > new Date())) return null;
    var base = Number(prod.price || 0);
    return { percent: pct, endsAt: end, price: Math.round(base * (1 - pct / 100) * 100) / 100 };
}

async function submitBargainPrice() {
    var input = document.getElementById('bargainPriceInput');
    var errEl = document.getElementById('bargainError');
    var btn = document.getElementById('bargainSubmitBtn');
    var normal = Number(_offer.product ? _offer.product.price : 0);
    var price = Math.round(parseFloat(String(input ? input.value : '').replace(/,/g, '')) * 100) / 100;
    function bad(msg) { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } }
    if (errEl) errEl.style.display = 'none';
    if (!isFinite(price) || price <= 0) return bad('Enter a price above zero.');
    if (price >= normal) return bad('A bargain must be LOWER than the normal price (GHS ' + normal.toLocaleString() + ').');
    // A special price is for one item. Items with sizes or colours are not sold this way yet, so the
    // buyer's choice would have nowhere to go on the order.
    if (_offer.product && Array.isArray(_offer.product.variants) && _offer.product.variants.length) {
        return bad('Special prices are not available for items with sizes or colours yet. Sell it at the normal price instead.');
    }
    var conv = conversationsCache[_offer.convId];
    if (!conv) return;
    var buyerUid = conv.participants.filter(function (p) { return p !== myUid; })[0];
    var buyerName = (conv.participantNames && conv.participantNames[buyerUid]) || 'Buyer';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…'; }
    var nowMs = Date.now();
    var data = {
        conversationId: _offer.convId,
        productId: conv.productId,
        productTitle: String((_offer.product && _offer.product.title) || conv.productTitle || 'Item').slice(0, 120),
        sellerId: myUid,
        sellerName: myName || 'Seller',
        buyerId: buyerUid,
        buyerName: String(buyerName).slice(0, 60),
        originalPrice: normal,
        offerPrice: price,
        status: 'pending',
        createdAt: firebase.firestore.Timestamp.fromMillis(nowMs),
        // exactly 24 hours later — the rules demand this pairing precisely
        expiresAt: firebase.firestore.Timestamp.fromMillis(nowMs + 24 * 3600 * 1000)
    };
    try {
        await firebaseDB.collection('offers').doc(_offer.offerId).set(data);
        closeBargainModal();
        showChatNotification('Special price sent — active for 24 hours.', 'success');
        var saving = Math.round((normal - price) * 100) / 100;
        await bargainPostNote('⚡ I set a special price for you: GHS ' + price.toLocaleString() +
            ' (was GHS ' + normal.toLocaleString() + ')' +
            (saving > 0 ? ' — you save GHS ' + saving.toLocaleString() + '.' : '.') +
            ' It expires in 24 hours. Tap the gold card above to pay securely.');
    } catch (e) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-bolt"></i> Send special price (24h)'; }
        bad('Could not set the price: ' + e.message);
    }
}

async function cancelBargainPrice() {
    if (!bargainLiveOffer() || !_offer.offerId) return;
    if (!confirm('Cancel the special price? The buyer will see the normal price again.')) return;
    try {
        await firebaseDB.collection('offers').doc(_offer.offerId).update({ status: 'cancelled' });
        showChatNotification('Special price cancelled.', 'info');
        await bargainPostNote('⚡ I cancelled the special price — the normal price applies again.');
    } catch (e) {
        showChatNotification('Could not cancel: ' + e.message, 'error');
    }
}

/* ---- buyer: pay from the chat ---- */

async function payFromChat() {
    var conv = conversationsCache[_offer.convId];
    if (!conv || !conv.productId || _offer.isSeller) return;
    var liveOffer = bargainLiveOffer();
    var normal = Number(_offer.product ? _offer.product.price : conv.productPrice) || 0;
    var flashNow = smFlashActiveMsg(_offer.product);
    var amount = liveOffer ? Number(liveOffer.offerPrice) : (flashNow ? flashNow.price : normal);
    if (!(amount > 0)) { showChatNotification('This item has no price yet — ask the seller.', 'error'); return; }
    var offerId = liveOffer ? _offer.offerId : null;
    var ok = confirm(liveOffer
        ? 'Pay GHS ' + amount.toLocaleString() + ' — your special 24-hour price?\n\nThe money is held in escrow until you confirm delivery.'
        : 'Pay GHS ' + amount.toLocaleString() + ' for this item?\n\nThe money is held in escrow until you confirm delivery.');
    if (!ok) return;
    var payBtn = document.getElementById('bargainPayBtn');
    if (payBtn) { payBtn.disabled = true; payBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> One moment…'; }
    try {
        // never create a second unpaid order for the same offer
        // (single-field query only — a buyerId+offerId pair would demand a composite
        // index; buyer order lists are short, so filter the offerId on this side)
        if (offerId) {
            var q = await firebaseDB.collection('orders').where('buyerId', '==', myUid).get();
            var openId = null;
            q.forEach(function (d) {
                var o = d.data() || {};
                if (openId || o.offerId !== offerId) return;
                if (o.paymentStatus !== 'paid' && String(o.status) !== 'cancelled' && String(o.status) !== 'paid') openId = d.id;
            });
            if (openId) { window.location.href = '/payment.html?order=' + encodeURIComponent(openId); return; }
        }
        var product = _offer.product || {};
        var orderData = {
            buyerId: myUid,
            userId: myUid,
            buyerName: myName || 'Buyer',
            sellerId: product.sellerId || '',
            sellerName: product.sellerName || (conv.participantNames && conv.participantNames[product.sellerId]) || 'Seller',
            productId: conv.productId,
            productTitle: String(product.title || conv.productTitle || 'Item').slice(0, 120),
            items: [{
                productId: conv.productId,
                title: String(product.title || conv.productTitle || 'Item').slice(0, 120),
                price: amount,
                quantity: 1,
                image: conv.productImage || '',
                sellerId: product.sellerId || ''
            }],
            subtotal: amount,
            deliveryFee: 0,
            serviceFee: 0,
            total: amount,
            currency: 'GHS',
            status: 'pending',
            paymentStatus: 'pending',
            escrowStatus: 'pending',
            paymentMethod: 'paystack',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (offerId) orderData.offerId = offerId;
        var ref = await firebaseDB.collection('orders').add(orderData);
        showChatNotification('Order created at GHS ' + amount.toLocaleString() + ' — finish the secure payment on the next screen.', 'success');
        setTimeout(function () { window.location.href = '/payment.html?order=' + encodeURIComponent(ref.id); }, 600);
    } catch (e) {
        showChatNotification('Could not start the payment: ' + e.message, 'error');
        renderBargainBar();
    }
}


/* ===== FOLLOWER BROADCAST (Silver+ premium perk) =====
   Seller-side UI + state. One tap fans one message out to every follower,
   each in their own 1-to-1 conversation (server: sendBroadcast cloud fn).
   Also paints the conversations list as an address book: existing chats show
   the other person's tier label ("Gold buyer" etc.), and followers without a
   chat yet appear in a separate rows with a "Start chat" button that opens a
   draft conversation (created on first send).
*/

function smBroadcastMonthKey() {
    var d = new Date();
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

function smTierLabel(tier) {
    return { bronze: 'Bronze buyer', silver: 'Silver buyer', gold: 'Gold buyer', diamond: '◆ Diamond buyer' }[tier] || null;
}
function smTierColor(tier) {
    return { bronze: '#b0782f', silver: '#5b6470', gold: '#c9930a', diamond: '#7c3aed' }[tier] || '#5b6470';
}

/* Load my followers + whether this month's broadcast is used (Silver+ only).
   Falls back to an empty state on any failure — never blocks the page. */
async function loadMyBroadcastState() {
    var section = document.getElementById('myFollowersSection');
    if (!section) return;
    if (!myBroadcastTier || ['silver', 'gold', 'diamond'].indexOf(myBroadcastTier) === -1) {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';
    // this month's record (rules: a seller reads only their own)
    try {
        var rec = await firebaseDB.collection('broadcasts').doc(myUid + '_' + smBroadcastMonthKey()).get();
        broadcastUsedThisMonth = rec.exists;
    } catch (e) { broadcastUsedThisMonth = false; }
    // follower list (follows docs are world-readable and carry follower names)
    try {
        var snap = await firebaseDB.collection('follows').where('sellerId', '==', myUid).get();
        myFollowersCache = [];
        snap.forEach(function (d) {
            var f = d.data() || {};
            if (f.followerId) myFollowersCache.push({ followerId: f.followerId, followerName: f.followerName || 'Buyer' });
        });
    } catch (e) { myFollowersCache = []; }
    renderFollowersPanelList(document.getElementById('myFollowersSearch') ? document.getElementById('myFollowersSearch').value : '');
    // re-render the list so tier labels + separation apply now that followers are known
    if (typeof allConversationsSorted !== 'undefined' && allConversationsSorted) renderConversationList(allConversationsSorted.slice(0, conversationsPageSize));
    // Silver+ chat perks: quick replies + away mode buttons and settings
    try { loadMyChatPrefs(); } catch (e) {}
}

function toggleFollowersPanel() {
    var body = document.getElementById('myFollowersList');
    var chev = document.getElementById('myFollowersChevron');
    if (!body) return;
    var open = body.style.display === 'none';
    body.style.display = open ? '' : 'none';
    if (chev) chev.className = open ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
}

function renderFollowersPanelList(filter) {
    var el = document.getElementById('myFollowersRows');
    if (!el) return;
    var q = (filter || '').trim().toLowerCase();
    var fols = (myFollowersCache || []).filter(function (f) {
        return !q || (f.followerName || '').toLowerCase().indexOf(q) !== -1;
    });
    var html = '';
    if (broadcastUsedThisMonth) {
        html += '<div class="sm-bcast-used"><i class="fas fa-clock"></i> Broadcast used — next one unlocks on the 1st of next month.</div>';
    }
    if (!fols.length) {
        html += '<div class="sm-bcast-empty">' +
            (myFollowersCache && myFollowersCache.length
                ? 'No followers match that name.'
                : 'No followers yet. When shoppers tap Follow on your products they land here — and your monthly broadcast reaches them all.') +
            '</div>';
    }
    fols.forEach(function (f) {
        var convId = 'bcast_' + myUid + '_' + f.followerId;
        var existing = conversationsCache[convId];
        html += '<div class="sm-follower-row">' +
            '<div class="sm-follower-avatar">' + escapeHtml((f.followerName || 'B').charAt(0).toUpperCase()) + '</div>' +
            '<div class="sm-follower-info"><div class="sm-follower-name">' + escapeHtml(f.followerName) + '</div>' +
            '<div class="sm-follower-sub" data-tier-for="' + f.followerId + '">' +
                '<span class="sm-follower-tier-placeholder" style="color:#9aa5b1;">follower</span></div></div>' +
            (existing
                ? '<button class="sm-follower-btn" onclick="openConversationById(\'' + convId + '\')"><i class="fas fa-paper-plane"></i> Chat</button>'
                : '<button class="sm-follower-btn sm-follower-btn-new" onclick="startChatWithFollower(\'' + f.followerId + '\')"><i class="fas fa-plus"></i> Start chat</button>') +
            '</div>';
    });
    el.innerHTML = html;
    // Stamp premium tier labels on follower rows (mirror cache: _chatPremCache)
    fols.forEach(function (f) {
        smGetPublicTier(f.followerId).then(function (info) {
            var sub = el.querySelector('[data-tier-for="' + f.followerId + '"]');
            if (!sub) return;
            if (info && info.tier) {
                sub.innerHTML = '<span style="color:' + smTierColor(info.tier) + ';font-weight:700;">' + smTierLabel(info.tier) + '</span>';
            }
        });
    });
}

/* "Start chat" with a follower who has no conversation yet: open a DRAFT
   (nothing in the database until the first real message goes through). */
function startChatWithFollower(followerUid) {
    var f = (myFollowersCache || []).filter(function (x) { return x.followerId === followerUid; })[0];
    if (!f) return;
    var draftId = 'draft_' + followerUid;
    conversationsCache[draftId] = {
        id: draftId,
        participants: [myUid, followerUid],
        participantNames: (function () { var m = {}; m[myUid] = myName; m[followerUid] = f.followerName; return m; })(),
        _isDraft: true,
        _draftRecipientName: f.followerName
    };
    openConversationById(draftId);
    // a hint chip above the composer
    if (!document.getElementById('draftRecipientChip')) {
        var area = document.getElementById('chatInputArea');
        if (area && area.parentNode) {
            var chip = document.createElement('div');
            chip.id = 'draftRecipientChip';
            chip.className = 'sm-draft-chip';
            chip.innerHTML = '<i class="fas fa-user-plus"></i> New chat with <b>' + escapeHtml(f.followerName) + '</b>. Send any message to start the conversation. ' +
                '<button type="button" onclick="clearDraftRecipient()">not now</button>';
            area.parentNode.insertBefore(chip, area);
        }
    }
    var input = document.getElementById('messageInput');
    if (input) input.focus();
}

function clearDraftRecipient() {
    if (currentConversationId && conversationsCache[currentConversationId] && conversationsCache[currentConversationId]._isDraft) {
        delete conversationsCache[currentConversationId];
        currentConversationId = null;
        var msgs = document.getElementById('chatMessages');
        if (msgs) msgs.innerHTML = '';
        var empty = document.getElementById('noChatSelected');
        if (empty) empty.style.display = '';
        var wrap = document.getElementById('chatView');
        if (wrap) wrap.style.display = 'none';
    }
    clearDraftRecipientUI();
}

function clearDraftRecipientUI() {
    var chip = document.getElementById('draftRecipientChip');
    if (chip) chip.parentNode.removeChild(chip);
}

/* Resolve a user's premium tier from the public mirror (auto-expiry safe).
   Promise → {tier} or null. Caches per page (_chatPremCache exists for the
   header badge, but keep this one self-contained). */
var _smTierCache = {};
async function smGetPublicTier(uid) {
    if (Object.prototype.hasOwnProperty.call(_smTierCache, uid)) return _smTierCache[uid];
    var out = null;
    try {
        var d = await firebaseDB.collection('sellerPublic').doc(uid).get();
        if (d.exists) {
            var m = d.data() || {};
            var exp = m.premiumExpiry && m.premiumExpiry.toDate ? m.premiumExpiry.toDate() : null;
            if (exp && exp > new Date() && m.tier) out = { tier: String(m.tier).toLowerCase() };
        }
    } catch (e) {}
    _smTierCache[uid] = out;
    return out;
}

/* The in-chat broadcast toggle: shown to Silver+ sellers when the person in
   front of them follows them. ON → the next text message fans out to EVERY
   follower via sendBroadcast. OFF → normal 1-to-1 send. */
async function refreshBroadcastToggle(conv) {
    var wrap = document.getElementById('broadcastToggleWrap');
    if (!wrap) return;
    _broadcastOn = false;
    wrap.style.display = 'none';
    if (!conv || conv._isDraft) { updateBroadcastToggleUI(); return; }
    if (!myBroadcastTier || ['silver', 'gold', 'diamond'].indexOf(myBroadcastTier) === -1) return;
    var otherUid = conv.participants.filter(function (p) { return p !== myUid; })[0];
    if (!otherUid) return;
    var followsMe = (myFollowersCache || []).some(function (f) { return f.followerId === otherUid; });
    if (!followsMe) {
        // cache may not be loaded yet — one direct probe, then decide
        try { followsMe = (await firebaseDB.collection('follows').doc(otherUid + '_' + myUid).get()).exists; } catch (e) {}
    }
    if (!followsMe) return;
    wrap.style.display = '';
    updateBroadcastToggleUI();
}

function toggleBroadcastMode() {
    if (broadcastUsedThisMonth && !_broadcastOn) {
        showChatNotification('This month\u2019s broadcast is already used — the next one unlocks on the 1st.', 'info');
        return;
    }
    _broadcastOn = !_broadcastOn;
    updateBroadcastToggleUI();
}

function updateBroadcastToggleUI() {
    var btn = document.getElementById('broadcastToggleBtn');
    if (!btn) return;
    var wrap = document.getElementById('broadcastToggleWrap');
    var on = _broadcastOn && !broadcastUsedThisMonth;
    btn.classList.toggle('on', on);
    btn.innerHTML = '<i class="fas fa-bullhorn"></i> ' +
        (on ? 'BROADCAST ON — next message goes to all followers'
            : broadcastUsedThisMonth ? 'Broadcast used this month'
            : 'Broadcast to all followers');
    btn.disabled = broadcastUsedThisMonth && !on;
    if (wrap) wrap.title = broadcastUsedThisMonth
        ? 'You already used this month\u2019s broadcast.'
        : (on ? 'Tap to send normally instead' : 'Tap so this message reaches every follower at once');
}

/* The actual fan-out through the server. */
async function doBroadcastSend(text) {
    var btn = document.querySelector('.send-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    try {
        var fn = firebase.functions().httpsCallable('sendBroadcast');
        var res = await fn({ text: text });
        var n = res && res.data && typeof res.data.followerCount === 'number' ? res.data.followerCount : (myFollowersCache || []).length;
        broadcastUsedThisMonth = true;
        _broadcastOn = false;
        updateBroadcastToggleUI();
        renderFollowersPanelList(document.getElementById('myFollowersSearch') ? document.getElementById('myFollowersSearch').value : '');
        showChatNotification('\uD83D\uDCE3 Broadcast sent to ' + n + ' follower' + (n === 1 ? '' : 's') + '. Each got their own private chat with you.', 'success');
    } catch (e) {
        var msg = (e && e.message) ? e.message : String(e);
        if (/already used/i.test(msg)) broadcastUsedThisMonth = true;
        showChatNotification('Broadcast not sent: ' + msg.replace(/^.*?: /, ''), 'error');
        updateBroadcastToggleUI();
        throw e;
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i>'; }
    }
}

/* ===== QUICK REPLIES + AWAY MODE (Silver+ premium perks) =====
   Quick replies: saved canned answers fired in two taps from the ⚡ button.
   Away mode: while ON, the FIRST message a buyer sends in a chat gets an
   automatic answer from the autoAwayReply cloud function (max once / 6h /
   chat; the tier gate is enforced server-side). All settings live in the
   strictly private sellerPrefs/{uid} document.
*/

var myChatPrefs = { quickReplies: [], autoAway: { enabled: false, message: '' } };

function smIsSilverPlus() {
    return !!myBroadcastTier && ['silver', 'gold', 'diamond'].indexOf(myBroadcastTier) !== -1;
}

async function loadMyChatPrefs() {
    var qrBtn = document.getElementById('quickReplyBtn');
    var awayBtn = document.getElementById('awayModeBtn');
    if (!smIsSilverPlus()) {
        if (qrBtn) qrBtn.style.display = 'none';
        if (awayBtn) awayBtn.style.display = 'none';
        return;
    }
    if (qrBtn) qrBtn.style.display = '';
    if (awayBtn) awayBtn.style.display = '';
    try {
        var d = await firebaseDB.collection('sellerPrefs').doc(myUid).get();
        if (d.exists) {
            var p = d.data() || {};
            var replies = Array.isArray(p.quickReplies) ? p.quickReplies.filter(function (x) { return typeof x === 'string' && x.trim(); }) : [];
            myChatPrefs.quickReplies = replies.slice(0, 10);
            var aw = p.autoAway || {};
            myChatPrefs.autoAway = { enabled: aw.enabled === true, message: String(aw.message || '') };
        }
    } catch (e) { /* prefs are optional — never break the page */ }
    applyAwayUI();
    renderQuickReplyChips();
}

async function saveMyChatPrefs() {
    try {
        await firebaseDB.collection('sellerPrefs').doc(myUid).set({
            quickReplies: myChatPrefs.quickReplies.slice(0, 10),
            autoAway: { enabled: myChatPrefs.autoAway.enabled === true, message: String(myChatPrefs.autoAway.message || '').slice(0, 300) },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return true;
    } catch (e) {
        showChatNotification('Could not save: ' + (e && e.message ? e.message : e), 'error');
        return false;
    }
}

/* ---- quick replies ---- */
function toggleQuickReplyBar() {
    var bar = document.getElementById('quickReplyBar');
    if (!bar) return;
    var open = bar.style.display === 'none' || getComputedStyle(bar).display === 'none';
    // the element is a chips row: it needs flex when open
    bar.style.display = open ? 'flex' : 'none';
    if (open) renderQuickReplyChips();
}

function renderQuickReplyChips() {
    var bar = document.getElementById('quickReplyBar');
    if (!bar || !smIsSilverPlus()) return;
    var replies = myChatPrefs.quickReplies || [];
    var html = '';
    if (!replies.length) {
        html += '<button type="button" class="sm-qr-chip sm-qr-manage" onclick="openQrDialog()"><i class="fas fa-plus"></i> Save your first quick reply — answer buyers in two taps</button>';
    } else {
        replies.forEach(function (r, i) {
            html += '<button type="button" class="sm-qr-chip" title="' + escapeHtml(r) + '" onclick="quickReplySend(' + i + ')">' + escapeHtml(r.length > 42 ? r.slice(0, 42) + '…' : r) + '</button>';
        });
        html += '<button type="button" class="sm-qr-chip sm-qr-manage" onclick="openQrDialog()"><i class="fas fa-pen"></i> Manage</button>';
    }
    bar.innerHTML = html;
}

async function quickReplySend(i) {
    var text = (myChatPrefs.quickReplies || [])[i];
    if (!text) return;
    if (!currentConversationId) { showChatNotification('Open a chat first, then tap ⚡.', 'info'); return; }
    var input = document.getElementById('messageInput');
    if (!input) return;
    var bar = document.getElementById('quickReplyBar');
    if (bar) bar.style.display = 'none';
    input.value = text;
    try { await sendMessage(); } catch (e) {}
}

function openQrDialog() {
    var dlg = document.getElementById('qrDialog');
    if (!dlg) return;
    renderQrList();
    var inp = document.getElementById('qrNewInput');
    if (inp) inp.value = '';
    dlg.style.display = 'flex';
}
function closeQrDialog() { var dlg = document.getElementById('qrDialog'); if (dlg) dlg.style.display = 'none'; }

function renderQrList() {
    var el = document.getElementById('qrList');
    if (!el) return;
    var replies = myChatPrefs.quickReplies || [];
    if (!replies.length) {
        el.innerHTML = '<div class="sm-qr-empty">No quick replies yet. Add your most-typed answers below ("Yes, it\u2019s available", "Delivery is GHS 15 within Accra"…).</div>';
        return;
    }
    el.innerHTML = replies.map(function (r, i) {
        return '<div class="sm-qr-row"><span title="' + escapeHtml(r) + '">' + escapeHtml(r) + '</span>' +
               '<button type="button" onclick="qrDelete(' + i + ')" title="Delete"><i class="fas fa-trash-alt"></i></button></div>';
    }).join('');
}

async function qrAdd() {
    var inp = document.getElementById('qrNewInput');
    var v = (inp && inp.value || '').trim();
    if (!v) return;
    if (myChatPrefs.quickReplies.length >= 10) { showChatNotification('Maximum 10 quick replies — delete one first.', 'info'); return; }
    if (myChatPrefs.quickReplies.indexOf(v) !== -1) { showChatNotification('That reply is already saved.', 'info'); return; }
    myChatPrefs.quickReplies.push(v.slice(0, 200));
    if (await saveMyChatPrefs()) {
        if (inp) inp.value = '';
        renderQrList();
        renderQuickReplyChips();
    }
}

async function qrDelete(i) {
    myChatPrefs.quickReplies.splice(i, 1);
    if (await saveMyChatPrefs()) { renderQrList(); renderQuickReplyChips(); }
}

/* ---- away mode ---- */
function applyAwayUI() {
    var btn = document.getElementById('awayModeBtn');
    if (!btn) return;
    var on = smIsSilverPlus() && myChatPrefs.autoAway.enabled === true;
    btn.classList.toggle('away-on', on);
    btn.title = on ? 'Away mode ON — buyers get your auto-answer (tap to change)' : 'Away mode (Silver+)';
}

function openAwayDialog() {
    var dlg = document.getElementById('awayDialog');
    if (!dlg) return;
    var t = document.getElementById('awayEnabledToggle');
    var ta = document.getElementById('awayMessageInput');
    if (t) t.checked = myChatPrefs.autoAway.enabled === true;
    if (ta) ta.value = myChatPrefs.autoAway.message || defaultAwayMessage();
    applyAwayDialogToggle();
    dlg.style.display = 'flex';
}
function closeAwayDialog() { var dlg = document.getElementById('awayDialog'); if (dlg) dlg.style.display = 'none'; }
function applyAwayDialogToggle() {
    var t = document.getElementById('awayEnabledToggle');
    var w = document.getElementById('awayStateWord');
    if (w && t) w.textContent = t.checked ? 'ON' : 'OFF';
}
function defaultAwayMessage() {
    return 'Thanks for reaching out! I\u2019m away right now \u2014 I\u2019ll reply as soon as I\u2019m back. Feel free to keep browsing my shop.';
}

async function saveAwayDialog() {
    var t = document.getElementById('awayEnabledToggle');
    var ta = document.getElementById('awayMessageInput');
    var enabled = !!(t && t.checked);
    var message = String((ta && ta.value) || '').trim().slice(0, 300);
    if (enabled && !message) { showChatNotification('Write your away message first (or switch away mode off).', 'info'); return; }
    myChatPrefs.autoAway = { enabled: enabled, message: message };
    if (!(await saveMyChatPrefs())) return;
    applyAwayUI();
    closeAwayDialog();
    showChatNotification(enabled
        ? '🌙 Away mode ON — buyers now get your automatic answer (once every 6 hours per chat).'
        : 'Away mode OFF — you answer messages yourself again.', 'success');
}
