/**
 * Admin — seller withdrawals (payouts).
 * Lists payoutRequests, and pays them: "I have sent the money" (markPayoutPaid) or
 * "Return to wallet" (rejectPayout). The money itself is held server-side by
 * requestPayout the moment the seller asks, so nothing here can double-spend it.
 */
var payoutsCache = [];
var payoutsFilter = 'pending';
var currentPayout = null;

function payoutEsc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function payoutMoney(n) {
    return 'GHS ' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function payoutWhen(ts) {
    try {
        var d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
        if (!d || isNaN(d.getTime())) return '—';
        return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '—'; }
}

document.addEventListener('DOMContentLoaded', function () {
    // admin-auth.js reveals the shell once the access check passes; wait for a user first
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(function (u) { if (u) loadPayouts(); });
    }
    setTimeout(loadPayouts, 3000);
});

async function loadPayouts() {
    var host = document.getElementById('payoutsList');
    if (!host) return;
    if (typeof firebaseDB === 'undefined' || !firebaseDB) {
        host.innerHTML = '<div style="padding:1rem;color:#b91c1c;">Not connected — please refresh the page.</div>';
        return;
    }
    host.innerHTML = '<div style="text-align:center;padding:2rem;color:#5a6572;"><i class="fas fa-spinner fa-spin"></i> Loading withdrawal requests…</div>';
    try {
        // the rules allow admins to list up to 100 payout requests per query
        var snap = await firebaseDB.collection('payoutRequests').limit(100).get();
        payoutsCache = [];
        snap.forEach(function (d) { payoutsCache.push(Object.assign({ id: d.id }, d.data())); });
        payoutsCache.sort(function (a, b) {
            var ta = a.requestedAt && a.requestedAt.toMillis ? a.requestedAt.toMillis() : 0;
            var tb = b.requestedAt && b.requestedAt.toMillis ? b.requestedAt.toMillis() : 0;
            return tb - ta;
        });
        renderPayoutStats();
        renderPayouts();
    } catch (e) {
        console.error('payouts load failed', e);
        host.innerHTML = '<div style="padding:1rem;color:#b91c1c;">Could not load withdrawals: ' + payoutEsc(e.message || e) + '</div>';
    }
}

function renderPayoutStats() {
    var pending = payoutsCache.filter(function (p) { return p.status === 'pending'; });
    var paid = payoutsCache.filter(function (p) { return p.status === 'paid'; });
    var held = pending.reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
    var paidTotal = paid.reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
    var el = function (id) { return document.getElementById(id); };
    if (el('statPending')) el('statPending').textContent = String(pending.length);
    if (el('statHeld')) el('statHeld').textContent = payoutMoney(held);
    if (el('statPaid')) el('statPaid').textContent = payoutMoney(paidTotal);
    var badge = el('payoutCount');
    if (badge) {
        if (pending.length) { badge.textContent = String(pending.length); badge.style.display = ''; }
        else badge.style.display = 'none';
    }
}

function filterPayouts(f) {
    payoutsFilter = f;
    document.querySelectorAll('.tab-btn[data-filter]').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-filter') === f);
    });
    renderPayouts();
}

var PAYOUT_BADGE = {
    pending: ['Waiting', 'background:#fffbeb;color:#92400e;border:1px solid #fde68a;'],
    paid: ['Paid', 'background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;'],
    rejected: ['Returned to wallet', 'background:#fef2f2;color:#991b1b;border:1px solid #fecaca;'],
    cancelled: ['Cancelled by seller', 'background:#f3f4f6;color:#4b5563;border:1px solid #e5e7eb;']
};

function renderPayouts() {
    var host = document.getElementById('payoutsList');
    if (!host) return;
    var rows = payoutsCache.filter(function (p) {
        return payoutsFilter === 'all' ? true
             : payoutsFilter === 'rejected' ? (p.status === 'rejected' || p.status === 'cancelled')
             : p.status === payoutsFilter;
    });
    if (!rows.length) {
        host.innerHTML = '<div style="text-align:center;padding:2rem;color:#5a6572;background:#f8fafc;border:1px dashed #e5e7eb;border-radius:10px;">'
            + '<i class="fas fa-inbox" style="font-size:1.4rem;color:#cbd5e1;"></i>'
            + '<p style="margin:0.5rem 0 0;font-weight:600;">Nothing here yet</p>'
            + '<p style="margin:0.2rem 0 0;font-size:0.82rem;">Withdrawal requests from sellers will appear here.</p></div>';
        return;
    }
    var html = '<div style="display:flex;flex-direction:column;gap:0.6rem;">';
    rows.forEach(function (p) {
        var badge = PAYOUT_BADGE[p.status] || PAYOUT_BADGE.pending;
        var dest = p.method === 'momo'
            ? ((p.details && p.details.provider) || 'Mobile Money') + ' • ' + ((p.details && p.details.number) || '')
            : ((p.details && p.details.bankName) || 'Bank') + ' • ' + ((p.details && p.details.number) || '');
        html += '<div style="border:1px solid #e5e7eb;border-radius:12px;padding:0.8rem 0.9rem;background:#fff;">'
             + '<div style="display:flex;justify-content:space-between;gap:0.6rem;flex-wrap:wrap;align-items:center;">'
             +   '<div>'
             +     '<div style="font-weight:800;font-size:1.05rem;">' + payoutMoney(p.amount) + '</div>'
             +     '<div style="font-size:0.78rem;color:#5a6572;">' + payoutEsc(p.userEmail || p.userId || 'seller') + '</div>'
             +   '</div>'
             +   '<div style="text-align:right;">'
             +     '<span style="' + badge[1] + 'padding:0.2rem 0.55rem;border-radius:999px;font-size:0.7rem;font-weight:800;">' + badge[0] + '</span>'
             +     '<div style="font-size:0.72rem;color:#5a6572;margin-top:0.25rem;">asked ' + payoutWhen(p.requestedAt) + '</div>'
             +   '</div>'
             + '</div>'
             + '<div style="margin-top:0.5rem;font-size:0.82rem;color:#374151;">'
             +   '<i class="fas fa-mobile-alt" style="color:#0064d2;"></i> ' + payoutEsc(dest)
             +   '<div style="font-size:0.76rem;color:#5a6572;">Account name: <strong>' + payoutEsc((p.details && p.details.name) || '—') + '</strong>'
             +   (p.reference ? ' • ' + payoutEsc(p.reference) : '') + '</div>'
             + '</div>'
             + (p.paymentReference ? '<div style="font-size:0.76rem;color:#166534;margin-top:0.25rem;">Sent • ref ' + payoutEsc(p.paymentReference) + '</div>' : '')
             + (p.rejectionReason ? '<div style="font-size:0.76rem;color:#991b1b;margin-top:0.25rem;">Returned: ' + payoutEsc(p.rejectionReason) + '</div>' : '')
             + (p.status === 'pending'
                 ? '<div style="margin-top:0.6rem;display:flex;gap:0.45rem;flex-wrap:wrap;">'
                 +   '<button onclick="openPayout(\'' + p.id + '\')" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:0.5rem 0.85rem;font-weight:800;font-size:0.78rem;cursor:pointer;"><i class="fas fa-check"></i> Pay this</button>'
                 +   '<button onclick="rejectFromList(\'' + p.id + '\')" style="background:#fff;border:1.5px solid #e5e7eb;color:#4b5563;border-radius:8px;padding:0.5rem 0.85rem;font-weight:700;font-size:0.78rem;cursor:pointer;">Return to wallet</button>'
                 + '</div>'
                 : '')
             + '</div>';
    });
    html += '</div>';
    host.innerHTML = html;
}

function openPayout(id) {
    currentPayout = payoutsCache.filter(function (p) { return p.id === id; })[0];
    if (!currentPayout) return;
    var p = currentPayout;
    var body = document.getElementById('payoutModalBody');
    var dest = p.method === 'momo'
        ? ((p.details && p.details.provider) || '') + ' ' + ((p.details && p.details.number) || '')
        : ((p.details && p.details.bankName) || '') + ' ' + ((p.details && p.details.number) || '');
    body.innerHTML =
        '<div style="font-size:1.3rem;font-weight:800;">' + payoutMoney(p.amount) + '</div>'
      + '<div style="margin-top:0.5rem;line-height:1.5;">'
      +   '<div><strong>Send to:</strong> ' + payoutEsc(dest) + '</div>'
      +   '<div><strong>Name on account:</strong> ' + payoutEsc((p.details && p.details.name) || '—') + '</div>'
      +   '<div><strong>Seller:</strong> ' + payoutEsc(p.userEmail || p.userId || '') + '</div>'
      +   '<div><strong>Requested:</strong> ' + payoutWhen(p.requestedAt) + '</div>'
      +   '<div><strong>Reference:</strong> ' + payoutEsc(p.reference || '') + '</div>'
      + '</div>'
      + '<p style="margin:0.7rem 0 0;font-size:0.78rem;color:#5a6572;">Send ' + payoutMoney(p.amount)
      + ' to the account above, then confirm here. Their money is already held, so nothing else can spend it.</p>';
    var refEl = document.getElementById('payoutRef'); if (refEl) refEl.value = '';
    var noteEl = document.getElementById('payoutNote'); if (noteEl) noteEl.value = '';
    document.getElementById('payoutModal').style.display = 'block';
}

function closePayoutModal() {
    document.getElementById('payoutModal').style.display = 'none';
    currentPayout = null;
}

async function confirmPayoutPaid() {
    if (!currentPayout) return;
    var ref = (document.getElementById('payoutRef') || {}).value || '';
    var note = (document.getElementById('payoutNote') || {}).value || '';
    if (!confirm('Confirm you have sent ' + payoutMoney(currentPayout.amount) + ' to the seller?')) return;
    await payoutCall('markPayoutPaid', { payoutId: currentPayout.id, reference: ref, note: note },
        'Marked as paid — the seller has been notified.');
}

async function confirmPayoutReject() {
    if (!currentPayout) return;
    var reason = prompt('Return this money to the seller\'s wallet.\n\nReason (optional, the seller will see it):', '');
    if (reason === null) return;
    await payoutCall('rejectPayout', { payoutId: currentPayout.id, reason: reason },
        'Returned — the money is back in the seller\'s wallet.');
}

async function rejectFromList(id) {
    currentPayout = payoutsCache.filter(function (p) { return p.id === id; })[0];
    await confirmPayoutReject();
}

async function payoutCall(fnName, payload, successMessage) {
    try {
        if (typeof firebase === 'undefined' || !firebase.functions) throw new Error('Firebase Functions has not loaded — refresh the page');
        var fn = firebase.functions().httpsCallable(fnName);
        var res = await fn(payload);
        if (typeof showFlashMessage === 'function') showFlashMessage((res.data && res.data.message) || successMessage, 'success');
        closePayoutModal();
        await loadPayouts();
    } catch (e) {
        var msg = (e && (e.message || (e.details && e.details.message))) || String(e);
        if (typeof showFlashMessage === 'function') showFlashMessage('Could not complete that: ' + msg, 'error');
        else alert('Could not complete that: ' + msg);
    }
}

window.loadPayouts = loadPayouts;
window.filterPayouts = filterPayouts;
window.openPayout = openPayout;
window.closePayoutModal = closePayoutModal;
window.confirmPayoutPaid = confirmPayoutPaid;
window.confirmPayoutReject = confirmPayoutReject;
window.rejectFromList = rejectFromList;
