/**
 * Admin — Emails.
 *
 * One page for the whole email setup: read what is stored, change it, preview any email, and
 * send a real test so EmailJS's own answer can be read word for word instead of guessed at.
 *
 * Everything goes through the `emailAdmin` Cloud Function. The key itself never reaches this
 * page — only its last six characters, so an admin can confirm what is saved without being able
 * to copy the value out of the browser.
 */
var emailKindsLoaded = false;

function mailEsc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mailWhen(ts) {
    // A timestamp can arrive as a Firestore Timestamp, as {seconds/_seconds, nanoseconds},
    // as an ISO string or as a number of milliseconds. The callable hands back the plain object
    // shape, which is why the last-test date used to render as a dash.
    try {
        if (!ts) return '—';
        var d = null;
        if (typeof ts.toDate === 'function') d = ts.toDate();
        else if (typeof ts === 'object') {
            var secs = ts.seconds != null ? ts.seconds : ts._seconds;
            if (secs != null) d = new Date(secs * 1000);
        } else if (typeof ts === 'number') d = new Date(ts);
        else if (typeof ts === 'string') d = new Date(ts);
        if (!d || isNaN(d.getTime())) return '—';
        return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '—'; }
}

function mailCall(action, extra) {
    if (typeof firebase === 'undefined' || !firebase.functions) {
        return Promise.reject(new Error('Not connected — please refresh the page.'));
    }
    var fn = firebase.functions().httpsCallable('emailAdmin');
    return fn(Object.assign({ action: action }, extra || {})).then(function (r) { return r.data; });
}

function mailSetResult(hostId, cssClass, html) {
    var host = document.getElementById(hostId);
    if (host) host.innerHTML = '<div class="mail-result ' + cssClass + '">' + html + '</div>';
}

function mailClearResult(hostId) {
    var host = document.getElementById(hostId);
    if (host) host.innerHTML = '';
}

document.addEventListener('DOMContentLoaded', function () {
    // admin-auth.js reveals the shell once the access check passes; wait for a user first
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(function (u) { if (u) loadEmailStatus(); });
    }
    setTimeout(function () {
        if (document.getElementById('testTo') && !document.getElementById('testTo').value) {
            try {
                var u = firebase.auth().currentUser;
                if (u && u.email) document.getElementById('testTo').value = u.email;
            } catch (e) {}
        }
    }, 1500);
});

/* ------------------------------------------------------------------ status */

function loadEmailStatus() {
    var strip = document.getElementById('emailStatus');
    if (strip) {
        strip.className = 'mail-status off';
        strip.innerHTML = '<span class="dot"></span><div><div class="t"><i class="fas fa-spinner fa-spin"></i> Checking how email is set up…</div><div class="s">One moment.</div></div>';
    }
    mailCall('status').then(function (s) {
        renderEmailStatus(s);
        fillEmailForm(s);
        fillKindDropdowns(s.kinds || []);
        renderPreview();
    }).catch(function (e) {
        if (strip) {
            strip.className = 'mail-status off';
            strip.innerHTML = '<span class="dot"></span><div><div class="t">Could not read the email settings</div><div class="s">' + mailEsc(e && e.message ? e.message : e) + '</div></div>';
        }
    });
}

function renderEmailStatus(s) {
    var strip = document.getElementById('emailStatus');
    if (!strip) return;
    var on = s.enabled !== false;
    var lines = [];
    lines.push('Service <code>' + mailEsc(s.serviceId || 'not set') + '</code> · template <code>' + mailEsc(s.templateId || 'not set') + '</code>');
    if (s.keyTail) {
        lines.push('Public key on file ends <code>…' + mailEsc(s.keyTail) + '</code> (' + (s.keyLength || 0) + ' characters).');
    } else {
        lines.push('No public key is stored yet.');
    }
    if (s.usingDefaults) {
        lines.push('<strong>Nothing has been saved yet</strong> — the built-in fallback values are being used, and the key among them is the one EmailJS has been rejecting. Fill the three boxes below and save.');
    } else if (s.updatedAt) {
        lines.push('Last saved ' + mailEsc(mailWhen(s.updatedAt)) + (s.updatedBy ? ' by ' + mailEsc(s.updatedBy) : '') + '.');
    }
    if (!on) lines.push('<strong>Sending is switched off</strong>, so no email will go out until you tick the switch below and save.');

    var last = s.lastTest;
    if (last) {
        var outcome = last.sent
            ? 'The last test <strong>succeeded</strong>'
            : 'The last test <strong>failed</strong> — ' + mailEsc(last.reason || 'no reason given');
        lines.push(outcome + ' (' + mailEsc(last.kind || '') + ' to ' + mailEsc(last.to || '') + ', ' + mailEsc(mailWhen(last.at)) + ').');
    }

    var configured = s.configured && on;
    strip.className = 'mail-status ' + (configured ? 'on' : 'off');
    strip.innerHTML = '<span class="dot"></span><div>' +
        '<div class="t">' + (configured
            ? '<i class="fas fa-circle-check"></i> Email is set up and switched on'
            : (on ? '<i class="fas fa-triangle-exclamation"></i> Email needs attention' : '<i class="fas fa-pause"></i> Email sending is paused')) +
        '</div><div class="s">' + lines.join('<br>') + '</div></div>';
}

function fillEmailForm(s) {
    var svc = document.getElementById('svcId');
    var tpl = document.getElementById('tplId');
    var key = document.getElementById('pubKey');
    var en = document.getElementById('mailEnabled');
    if (svc && !svc.value) svc.value = s.serviceId || '';
    if (tpl && !tpl.value) tpl.value = s.templateId || '';
    if (key && s.keyTail) key.placeholder = 'Saved — ends in ' + s.keyTail + '. Type a new key only to replace it.';
    if (en) en.checked = s.enabled !== false;
}

function fillKindDropdowns(kinds) {
    if (emailKindsLoaded || !kinds.length) return;
    emailKindsLoaded = true;
    var nice = {
        welcome: 'Welcome (new member)',
        payment_receipt: 'Payment receipt (buyer)',
        sale_received: 'You have a sale (seller)',
        order_shipped: 'On its way (buyer)',
        order_delivered: 'Did it arrive? (buyer)',
        refund_issued: 'Refund issued (buyer)',
        payout_paid: 'Withdrawal sent (seller)',
        auction_won: 'Auction won (winner)',
        auction_sold: 'Auction sold (seller)',
        dispute_closed: 'Dispute closed (seller)'
    };
    ['testKind', 'previewKind'].forEach(function (id) {
        var sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = kinds.map(function (k) {
            return '<option value="' + mailEsc(k) + '">' + mailEsc(nice[k] || k) + '</option>';
        }).join('');
    });
}

/* ------------------------------------------------------------------ save */

function saveEmailSettings() {
    var btn = document.getElementById('saveBtn');
    var svc = (document.getElementById('svcId') || {}).value || '';
    var tpl = (document.getElementById('tplId') || {}).value || '';
    var key = (document.getElementById('pubKey') || {}).value || '';
    var enabled = !!(document.getElementById('mailEnabled') || {}).checked;
    mailClearResult('saveResult');

    if (!svc.trim()) { mailSetResult('saveResult', 'bad', 'The Service ID is missing. It looks like <code>service_ud6z4l6</code>.'); return; }
    if (!tpl.trim()) { mailSetResult('saveResult', 'bad', 'The Template ID is missing. It looks like <code>template_xxxxxxx</code>.'); return; }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }
    mailCall('save', { serviceId: svc.trim(), templateId: tpl.trim(), emailjsKey: key.trim(), enabled: enabled })
        .then(function (r) {
            mailSetResult('saveResult', 'ok', '<strong>Saved.</strong> Service <code>' + mailEsc(r.serviceId) + '</code>, template <code>' + mailEsc(r.templateId) + '</code>' +
                (r.keyTail ? ', key ending <code>…' + mailEsc(r.keyTail) + '</code>' : '') +
                (r.enabled ? '' : ' — note that sending is switched off') + '.<br>Now use <strong>Send test email</strong> below to prove it works.');
            var keyBox = document.getElementById('pubKey');
            if (keyBox) keyBox.value = '';
            loadEmailStatus();
        })
        .catch(function (e) {
            mailSetResult('saveResult', 'bad', '<strong>Could not save.</strong> ' + mailEsc(e && e.message ? e.message : e));
        })
        .then(function () {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Save these details'; }
        });
}

/* ------------------------------------------------------------------ test */

function sendTestEmail() {
    var btn = document.getElementById('testBtn');
    var to = ((document.getElementById('testTo') || {}).value || '').trim();
    var kind = (document.getElementById('testKind') || {}).value || 'welcome';
    mailClearResult('testResult');
    if (!to || to.indexOf('@') === -1) {
        mailSetResult('testResult', 'bad', 'Type the email address to send the test to.');
        return;
    }
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…'; }
    mailCall('test', { to: to, kind: kind })
        .then(function (r) {
            if (r.sent) {
                mailSetResult('testResult', 'ok', '<strong>Sent.</strong> Check the inbox (and the spam folder) of <strong>' + mailEsc(r.to) + '</strong>.<br>' +
                    'It went out through service <code>' + mailEsc(r.serviceId) + '</code> using template <code>' + mailEsc(r.templateId) + '</code>.');
            } else {
                mailSetResult('testResult', 'bad',
                    '<strong>Not sent.</strong> ' + mailEsc(r.reason || 'The provider gave no reason.') +
                    (r.status ? '<br>Provider answer code: ' + mailEsc(r.status) : '') +
                    (r.hint ? '<br><br><strong>What to do:</strong> ' + mailEsc(r.hint) : ''));
            }
        })
        .catch(function (e) {
            mailSetResult('testResult', 'bad', '<strong>Could not run the test.</strong> ' + mailEsc(e && e.message ? e.message : e));
        })
        .then(function () {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send test email'; }
            loadEmailStatus();
        });
}

/* ------------------------------------------------------------------ preview */

function renderPreview() {
    var host = document.getElementById('previewBox');
    var kind = (document.getElementById('previewKind') || document.getElementById('testKind') || {}).value || 'welcome';
    if (!host) return;
    host.innerHTML = '<div class="mail-result info"><i class="fas fa-spinner fa-spin"></i> Building the preview…</div>';
    mailCall('preview', { kind: kind }).then(function (p) {
        host.innerHTML =
            '<div class="mail-preview">' +
                '<div class="hd">Sankofa <span>Market</span><div style="font-size:0.72rem;font-weight:500;opacity:0.9;">Culture. Nourishment. Community.</div></div>' +
                '<div class="bd">' +
                    '<div class="subj"><i class="fas fa-envelope"></i> ' + mailEsc(p.subject) + '</div>' +
                    '<div class="body">' + mailEsc(p.body) + '</div>' +
                    (p.cta_text ? '<div class="cta">' + mailEsc(p.cta_text) + '</div>' : '') +
                    '<div style="margin-top:0.8rem;font-size:0.75rem;color:#6b7280;line-height:1.7;border-top:1px solid #eef1f6;padding-top:0.7rem;">' +
                        'Your money is protected by Sankofa escrow — the seller is paid when you confirm delivery, or automatically within 48 hours of delivery if no dispute is open.<br>' +
                        'Questions? sankofamarketgh@gmail.com or 0273659806.' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="mail-hint" style="margin-top:0.5rem;">Subject and wording are generated on the server, so what you see here is what gets sent. The blue button points to <code>' + mailEsc(p.cta_url) + '</code>.</div>';
    }).catch(function (e) {
        host.innerHTML = '<div class="mail-result bad">Could not build the preview: ' + mailEsc(e && e.message ? e.message : e) + '</div>';
    });
}
