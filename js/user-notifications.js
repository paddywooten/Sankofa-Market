/* ============================================================================
   SANKOFA ALERTS — the notifications inbox
   ---------------------------------------------------------------------------
   Order updates, payouts, auction results, refunds and dispute outcomes have been
   written to the `notifications` collection for months, but there was no page or
   bell anywhere to read them — sellers never saw "you have a sale" or "withdrawal
   paid". This is that page.

   Both read-flag spellings are supported (`isRead` and the older `read`) because
   older documents used a different field name.
   ========================================================================== */
var notifCache = [];
var notifFilterValue = 'all';
var notifUnsub = null;

function notifEsc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function notifIsRead(n) {
    return n.isRead === true || n.read === true;
}
function notifWhen(ts) {
    try {
        var d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
        if (!d || isNaN(d.getTime())) return '';
        var mins = Math.floor((Date.now() - d.getTime()) / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return mins + ' min ago';
        var hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
        var days = Math.floor(hrs / 24);
        if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago');
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
}

/** Icon + colour + where the alert should take you. */
function notifLook(n) {
    var t = String(n.type || '');
    var map = {
        new_order:              { icon: 'fa-bag-shopping',      cls: '',      label: 'Order' },
        new_message:            { icon: 'fa-comments',          cls: '',      label: 'Message' },
        new_comment:            { icon: 'fa-comment',           cls: '',      label: 'Comment on your item' },
        comment_reply:          { icon: 'fa-comments',          cls: '',      label: 'Comment reply' },
        order_status_update:    { icon: 'fa-truck-fast',        cls: '',      label: 'Order' },
        auction_won:            { icon: 'fa-trophy',            cls: 'money', label: 'Auction' },
        auction_sold:           { icon: 'fa-gavel',             cls: 'money', label: 'Auction' },
        auction_started:        { icon: 'fa-gavel',             cls: 'money', label: 'From sellers you follow' },
        auction_cancelled:      { icon: 'fa-ban',               cls: 'warn',  label: 'Auction' },
        sale_payout:            { icon: 'fa-hand-holding-usd',  cls: 'money', label: 'Payout' },
        payment_received:       { icon: 'fa-credit-card',       cls: 'money', label: 'Payment' },
        payout_requested:       { icon: 'fa-money-bill-transfer', cls: 'alert', label: 'Withdrawal' },
        payout_paid:            { icon: 'fa-circle-check',      cls: 'money', label: 'Withdrawal' },
        payout_rejected:        { icon: 'fa-rotate-left',       cls: 'warn',  label: 'Withdrawal' },
        refund_issued:          { icon: 'fa-arrow-rotate-left', cls: 'money', label: 'Refund' },
        dispute_raised:         { icon: 'fa-scale-balanced',    cls: 'alert', label: 'Dispute' },
        dispute_resolved:       { icon: 'fa-scale-balanced',    cls: 'money', label: 'Dispute' },
        escrow_released:        { icon: 'fa-shield-halved',     cls: 'money', label: 'Escrow' },
        verification:           { icon: 'fa-user-shield',       cls: '',      label: 'Account' },
        user_approved:          { icon: 'fa-user-check',        cls: 'money', label: 'Account' },
        user_blocked:           { icon: 'fa-user-lock',         cls: 'warn',  label: 'Account' },
        welcome:                { icon: 'fa-hand-sparkles',     cls: '',      label: 'Welcome' },
        support:                { icon: 'fa-headset',           cls: 'alert', label: 'Support' },
        back_in_stock:          { icon: 'fa-box-open',          cls: 'money', label: 'Back in stock' },
        flash_sale:             { icon: 'fa-bolt',              cls: 'alert', label: 'Flash sale' },
        price_drop:             { icon: 'fa-tag',               cls: 'money', label: 'Price drop' }
    };
    var m = map[t] || { icon: 'fa-bell', cls: '', label: t ? t.replace(/_/g, ' ') : 'Alert' };

    // where should "View" go?
    var url = null, cta = 'View';
    if (n.orderId) {
        var isSeller = n.sellerId && window.__myUid && n.sellerId === window.__myUid;
        url = isSeller ? '/pages/user/orders' : '/order-confirmation?orderId=' + encodeURIComponent(n.orderId);
        cta = 'View order';
    } else if (n.auctionId) {
        url = '/auction-detail.html?id=' + encodeURIComponent(n.auctionId);
        cta = 'View auction';
    } else if (n.payoutId || /payout/.test(t)) {
        url = '/pages/user/wallet';
        cta = 'Open wallet';
    } else if (n.disputeId) {
        url = '/pages/user/orders';
        cta = 'View order';
    } else if (n.conversationId) {
        url = '/pages/user/messages?conv=' + encodeURIComponent(n.conversationId);
        cta = 'Open chat';
    } else if (n.productId) {
        url = '/product-detail.html?id=' + encodeURIComponent(n.productId);
        cta = 'View item';
    } else if (/user_approved|verification|welcome/.test(t)) {
        url = '/pages/user/dashboard';
        cta = 'Open dashboard';
    }
    return { icon: m.icon, cls: m.cls, label: m.label, url: url, cta: cta };
}

document.addEventListener('DOMContentLoaded', function () {
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) return;
    firebase.auth().onAuthStateChanged(function (user) {
        if (!user) {
            document.getElementById('notifList').innerHTML =
                '<div class="empty"><i class="fas fa-user-lock" style="font-size:1.6rem;color:#cbd5e1;"></i>' +
                '<h2>Please sign in</h2><p>Your alerts are tied to your account.</p>' +
                '<p style="margin-top:0.8rem;"><a href="/pages/auth/login.html?redirect=' +
                encodeURIComponent('/pages/user/notifications') + '" style="background:#0064d2;color:#fff;padding:0.6rem 1rem;border-radius:10px;font-weight:800;text-decoration:none;display:inline-block;">Sign in</a></p></div>';
            return;
        }
        window.__myUid = user.uid;
        startNotifications(user);
    });
});

function startNotifications(user) {
    if (notifUnsub) { try { notifUnsub(); } catch (e) {} }
    try {
        notifUnsub = firebaseDB.collection('notifications')
            .where('userId', '==', user.uid)
            .limit(100)
            .onSnapshot(function (snap) {
                notifCache = [];
                snap.forEach(function (d) { notifCache.push(Object.assign({ id: d.id }, d.data())); });
                notifCache.sort(function (a, b) {
                    var ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
                    var tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
                    return tb - ta;
                });
                renderNotifications();
                notifRetryPending();
            }, function (err) {
                console.warn('notifications listener failed', err);
                loadNotificationsOnce(user);
            });
    } catch (e) {
        loadNotificationsOnce(user);
    }
}

function loadNotificationsOnce(user) {
    firebaseDB.collection('notifications').where('userId', '==', user.uid).limit(100).get()
        .then(function (snap) {
            notifCache = [];
            snap.forEach(function (d) { notifCache.push(Object.assign({ id: d.id }, d.data())); });
            renderNotifications();
        })
        .catch(function (err) {
            document.getElementById('notifList').innerHTML =
                '<div class="empty"><i class="fas fa-triangle-exclamation" style="color:#e74c3c;font-size:1.4rem;"></i>' +
                '<h2>Could not load your alerts</h2><p>' + notifEsc(err.message || err) + '</p></div>';
        });
}

function notifFilter(f) {
    notifFilterValue = f;
    document.querySelectorAll('.chip[data-filter]').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-filter') === f);
    });
    renderNotifications();
}

function notifMatches(n) {
    if (notifFilterValue === 'unread') return !notifIsRead(n);
    if (notifFilterValue === 'orders') return !!(n.orderId || /order|auction|dispute/.test(String(n.type || '')));
    if (notifFilterValue === 'money') {
        return /payout|refund|sale|payment|escrow|commission|wallet/.test(String(n.type || '')) ||
               typeof n.amount === 'number';
    }
    return true;
}

function renderNotifications() {
    var host = document.getElementById('notifList');
    if (!host) return;

    var unread = notifCache.filter(function (n) { return !notifIsRead(n); }).length;
    var chip = document.getElementById('notifUnreadChip');
    if (chip) chip.textContent = unread ? '(' + unread + ')' : '';
    var markAll = document.getElementById('markAllBtn');
    if (markAll) markAll.style.display = unread ? '' : 'none';

    var rows = notifCache.filter(notifMatches);
    if (!rows.length) {
        host.innerHTML = '<div class="empty"><i class="fas fa-bell-slash" style="font-size:1.6rem;color:#cbd5e1;"></i>' +
            '<h2>' + (notifCache.length ? 'Nothing in this filter' : 'No alerts yet') + '</h2>' +
            '<p>' + (notifCache.length ? 'Try “All” to see everything.' : 'Order updates, payouts and auction results will show up here.') + '</p></div>';
        return;
    }

    var html = '';
    rows.forEach(function (n) {
        var look = notifLook(n);
        var read = notifIsRead(n);
        html += '<div class="notif ' + (read ? '' : 'unread ') + notifEsc(look.cls) + '" data-id="' + notifEsc(n.id) + '" onclick="notifOpen(\'' + notifEsc(n.id) + '\', event)">'
             +  '<div class="icon"><i class="fas ' + look.icon + '"></i></div>'
             +  '<div class="body">'
             +    '<div class="title">' + (read ? '' : '<span class="dot" title="Unread"></span>') + notifEsc(n.title || 'Alert') + '</div>'
             +    (n.message ? '<div class="msg">' + notifEsc(n.message) + '</div>' : '')
             +    '<div class="meta"><span>' + notifEsc(look.label) + '</span><span>•</span><span>' + notifWhen(n.createdAt) + '</span>'
             +      (typeof n.amount === 'number' ? '<span>•</span><span><strong>GHS ' + Number(n.amount).toLocaleString() + '</strong></span>' : '')
             +      (n.orderId ? '<span>•</span><span>#' + notifEsc(String(n.orderId).substring(0, 8).toUpperCase()) + '</span>' : '')
             +    '</div>'
             +    '<div class="actions">'
             +      (look.url ? '<a href="' + notifEsc(look.url) + '"><i class="fas fa-arrow-right"></i> ' + notifEsc(look.cta) + '</a>' : '')
             +      (read ? '' : '<button type="button" onclick="markNotificationRead(\'' + notifEsc(n.id) + '\')"><i class="fas fa-check"></i> Mark read</button>')
             +      '<button type="button" onclick="deleteNotification(\'' + notifEsc(n.id) + '\')" title="Remove this alert"><i class="fas fa-trash"></i></button>'
             +    '</div>'
             +  '</div>'
             + '</div>';
    });
    host.innerHTML = html;
}

/* ---------- opening an alert marks it read ----------
   Tapping an alert (anywhere on the card, or its “View …” link) marks it read, then opens
   where it points. We wait briefly for the server to confirm the write before leaving the
   page (NOTIF_WAIT_MS at most, so a weak signal never blocks the tap). A read that did not
   reach the server stays on a short “still to send” list and is sent again the next time the
   inbox opens. Both field spellings are written, so nothing is left half-done. */
var NOTIF_WAIT_MS = window.NOTIF_WAIT_MS || 1500;
var NOTIF_PENDING_KEY = 'sankofa_notif_read_pending';
var notifRetriedThisLoad = false;

/** Where an opened alert goes. A small hook so the tests can see it; in the page it just follows the link. */
window.notifNavigate = window.notifNavigate || function (url) { window.location.href = url; };

function notifPendingList() {
    try {
        var v = JSON.parse(localStorage.getItem(NOTIF_PENDING_KEY) || '[]');
        return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
}
function notifPendingSave(list) {
    try { localStorage.setItem(NOTIF_PENDING_KEY, JSON.stringify(list.slice(-50))); } catch (e) {}
}
function notifPendingAdd(id) {
    notifPendingSave(notifPendingList().filter(function (x) { return x !== id; }).concat([id]));
}
function notifPendingDrop(id) {
    notifPendingSave(notifPendingList().filter(function (x) { return x !== id; }));
}

/** Saves isRead to the server. Resolves when it is saved, or when the alert no longer exists. */
function notifWriteRead(id) {
    return firebaseDB.collection('notifications').doc(id).update({
        isRead: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
        notifPendingDrop(id);
    }).catch(function (e) {
        if (e && e.code === 'not-found') { notifPendingDrop(id); return; }
        console.warn('could not mark read', e && e.message);      // stays on the pending list
    });
}

/** Marks one alert read on screen straight away, then saves it. Returns a promise. */
function notifMarkRead(id) {
    var n = notifCache.filter(function (x) { return x.id === id; })[0];
    if (!n || notifIsRead(n)) return Promise.resolve();
    n.isRead = true; n.read = true;
    notifPendingAdd(id);
    renderNotifications();                                         // instant feedback
    return notifWriteRead(id);
}

/** The “Mark read” button. */
function markNotificationRead(id) {
    notifMarkRead(id);
}

/** Tapping an alert: mark it read, then open where it points (if it points anywhere). */
function notifOpen(id, ev) {
    // The Mark read and Remove buttons inside the card do their own job.
    if (ev && ev.target && ev.target.closest && ev.target.closest('button')) return;
    var n = notifCache.filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    var url = notifLook(n).url;
    // Ctrl/Cmd/Shift-click or a middle click: let the browser open the link in a new tab.
    var plain = !ev || (!ev.ctrlKey && !ev.metaKey && !ev.shiftKey && !ev.altKey && (ev.button || 0) === 0);
    var saved = notifMarkRead(id);
    if (!url || !plain) return;
    if (ev && ev.preventDefault) ev.preventDefault();
    var go = function () { window.notifNavigate(url); };
    Promise.race([saved, new Promise(function (resolve) { setTimeout(resolve, NOTIF_WAIT_MS); })]).then(go, go);
}

/** Once per page load: send again any read that did not reach the server last time. */
function notifRetryPending() {
    if (notifRetriedThisLoad) return;
    notifRetriedThisLoad = true;
    notifPendingList().forEach(function (id) {
        var n = notifCache.filter(function (x) { return x.id === id; })[0];
        if (!n) return;                        // not in this list (another account, or older than the last 100)
        if (notifIsRead(n)) { notifPendingDrop(id); return; }
        notifWriteRead(id);
    });
}

async function markAllNotificationsRead() {
    var unread = notifCache.filter(function (n) { return !notifIsRead(n); });
    if (!unread.length) return;
    var btn = document.getElementById('markAllBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Marking…'; }
    var done = 0;
    for (var i = 0; i < unread.length; i++) {
        try {
            await firebaseDB.collection('notifications').doc(unread[i].id).update({
                isRead: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            unread[i].isRead = true; unread[i].read = true; done++;
        } catch (e) { console.warn('notification not marked', e && e.message); }
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-double"></i> Mark all read'; }
    renderNotifications();
    if (typeof showFlashMessage === 'function') showFlashMessage(done + ' alert' + (done === 1 ? '' : 's') + ' marked as read', 'success');
}

function deleteNotification(id) {
    var n = notifCache.filter(function (x) { return x.id === id; })[0];
    firebaseDB.collection('notifications').doc(id).delete()
        .then(function () {
            notifCache = notifCache.filter(function (x) { return x.id !== id; });
            renderNotifications();
        })
        .catch(function (e) {
            if (typeof showFlashMessage === 'function') showFlashMessage('Could not remove that alert: ' + (e.message || e), 'error');
        });
}

window.markNotificationRead = markNotificationRead;
window.notifOpen = notifOpen;
window.markAllNotificationsRead = markAllNotificationsRead;
window.deleteNotification = deleteNotification;
window.notifFilter = notifFilter;
