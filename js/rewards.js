/**
 * Rewards & Points page — read-only Firestore for display; every points move
 * goes through callables (the rules make browsers spectators to balances).
 */
(function () {
    'use strict';

    var me = null;
    var pts = { balance: 0, streak: 0, lastClaimAtMs: 0 };
    var CLAIM_COOLDOWN_MS = 864e5; // mirror of the server: 24h after YOUR tap

    function $(id) { return document.getElementById(id); }
    function toast(msg, type) {
        if (window.__smSharedFlash) return window.__smSharedFlash(msg, type || 'info');
        console.log('[rewards]', msg);
    }
    function showBox(id, msg) {
        var el = $(id);
        if (!msg) { el.style.display = 'none'; return; }
        el.textContent = msg;
        el.style.display = 'block';
        if (window.scrollY > 120) window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderBalance() {
        $('rwBalance').textContent = Number(pts.balance || 0).toLocaleString();
        var st = pts.streak || 0;
        $('rwStreak').textContent = st;
        $('rwStreakPlural').textContent = st === 1 ? '' : 's';
        // streak dots: 7-dot cycle; the 7th glows (that's the bonus payday)
        var pos = st > 0 ? ((st - 1) % 7) + 1 : 0;
        var dots = '';
        for (var i = 1; i <= 7; i++) {
            dots += '<span class="rw-dot' + (i <= pos ? ' on' : '') + (i === 7 ? ' bonus' : '') + '">' + (i === 7 ? '+15' : i) + '</span>';
        }
        $('rwStreakDots').innerHTML = dots;
        $('rwStreakHint').textContent = st === 0
            ? 'Tap the claim button to start a streak — every 7th claim in a row pays a +15 bonus.'
            : (pos === 7 ? 'Bonus banked! The next 7-claim run starts now — claim again the moment it unlocks.' : (7 - pos) + ' more claim' + (7 - pos === 1 ? '' : 's') + ' in a row pays a +15 bonus — don\u2019t let 48 hours pass.');

        var locked = pts.lastClaimAtMs > 0 && (Date.now() - pts.lastClaimAtMs) < CLAIM_COOLDOWN_MS;
        var b = $('rwClaimBtn');
        b.disabled = locked;
        b.innerHTML = locked
            ? '<i class="fas fa-check-circle"></i> Today\u2019s points are in your pocket'
            : '🪙 Claim today\u2019s +5 points';
        if (locked) {
            startClaimCountdown(pts.lastClaimAtMs + CLAIM_COOLDOWN_MS);
        } else {
            stopClaimCountdown();
            $('rwClaimHint').textContent = 'One tap every 24 hours — your points only count when YOU claim them.';
        }
    }

    async function loadPoints() {
        try {
            const snap = await firebaseDB.collection('points').doc(me.uid).get();
            const d = snap.exists ? snap.data() : {};
            pts = {
                balance: d.balance || 0,
                streak: d.streak || 0,
                lastClaimAtMs: d.lastClaimAt && d.lastClaimAt.toMillis ? d.lastClaimAt.toMillis() : 0
            };
        } catch (e) {
            pts = { balance: 0, streak: 0, lastClaimAtMs: 0 };
        }
        renderBalance();
    }

    async function loadHistory() {
        var box = $('rwHistory');
        try {
            const snap = await firebaseDB.collection('points').doc(me.uid).collection('ledger')
                .orderBy('at', 'desc').limit(12).get();
            if (snap.empty) { box.innerHTML = '<div class="rw-muted">Nothing here yet — your first check-in starts the story.</div>'; return; }
            var html = '';
            snap.forEach(function (d) {
                var r = d.data();
                var when = '';
                try {
                    var t = r.at && r.at.toDate ? r.at.toDate() : new Date();
                    when = t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' + t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                } catch (e) {}
                var amt = Number(r.amount || 0);
                html += '<div class="rw-hist">'
                    + '<div><div style="font-weight:600;">' + (amt > 0 ? '🪙 ' : '🚀 ') + escapeRw(String(r.note || (amt > 0 ? 'Points earned' : 'Points spent'))) + '</div>'
                    + '<div class="rw-muted">' + when + '</div></div>'
                    + '<span class="rw-amt ' + (amt > 0 ? 'pos' : 'neg') + '">' + (amt > 0 ? '+' : '\u2212') + Math.abs(amt) + '</span>'
                    + '</div>';
            });
            box.innerHTML = html;
        } catch (e) {
            box.innerHTML = '<div class="rw-muted">History is shy right now — reload in a moment.</div>';
        }
    }

    function escapeRw(s) {
        return s.replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    async function loadListings() {
        var selB = $('rwBoostSelect'), selF = $('rwFeatureSelect');
        try {
            const snap = await firebaseDB.collection('products').where('sellerId', '==', me.uid).limit(100).get();
            var live = [];
            snap.forEach(function (d) {
                var p = d.data();
                if (p.isActive !== false && p.isSold !== true) live.push({ id: d.id, title: String(p.title || 'Untitled').slice(0, 60), boostLevel: p.boostLevel || (p.isBoosted ? 2 : 0), pointsBoostActive: p.boostSource === 'points' && p.boostUntil, featured: p.isFeatured === true });
            });
            live.sort(function (a, b) { return a.title.localeCompare(b.title); });
            if (!live.length) {
                var empty = '<option value="">No live listings yet — sell something first</option>';
                selB.innerHTML = empty; selF.innerHTML = empty;
                $('rwBoostBtn').disabled = true; $('rwFeatureBtn').disabled = true;
                return;
            }
            function opts(filter) {
                var h = '<option value="">— pick one of your ' + live.length + ' live listings —</option>';
                live.forEach(function (l) {
                    var tag = l.pointsBoostActive ? ' (already points-boosted)' : (l.boostLevel > 2 ? ' (premium boost — stronger)' : (l.featured ? ' (already featured)' : ''));
                    if ((filter === 'boost' && (l.boostLevel > 2 || l.pointsBoostActive)) || (filter === 'feature' && l.featured)) {
                        h += '<option value="" disabled>' + escapeRw(l.title) + escapeRw(tag) + '</option>';
                    } else {
                        h += '<option value="' + l.id + '">' + escapeRw(l.title) + '</option>';
                    }
                });
                return h;
            }
            selB.innerHTML = opts('boost');
            selF.innerHTML = opts('feature');
            $('rwBoostBtn').disabled = false;
            $('rwFeatureBtn').disabled = false;
        } catch (e) {
            selB.innerHTML = selF.innerHTML = '<option value="">Could not load your listings — reload</option>';
        }
    }

    async function claimToday() {
        var b = $('rwClaimBtn');
        b.disabled = true;
        b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Claiming…';
        showBox('rwError', null);
        try {
            const res = await firebase.functions().httpsCallable('claimDailyPoints')({});
            const d = (res && res.data) || {};
            if (d.already) {
                toast('Today\u2019s points were already in your pocket 🪙', 'info');
            } else {
                toast('🪙 +' + d.award + ' points!' + (d.milestone ? ' ' + d.streak + '-day streak bonus! 🎉' : (d.streak > 1 ? ' (' + d.streak + '-day streak 🔥)' : '')), 'success');
            }
            await loadPoints();
            await loadHistory();
        } catch (e) {
            showBox('rwError', 'Could not claim right now: ' + (e && e.message ? e.message : e));
            b.disabled = false;
            b.innerHTML = '🪙 Claim today\u2019s +5 points';
        }
    }

    // ---- ⏳ next-claim countdown (pure clockwork — zero network) ----
    // Rolling 24h cooldown: the timer starts at YOUR claim moment and runs to
    // exactly last-claim + 24h. Claim at 3:15pm → next unlock 3:15pm tomorrow.
    // The countdown ticks locally; at zero the button unlocks itself.
    var claimCountdownTimer = null;
    function fmtCountdown(ms) {
        var s = Math.max(0, Math.floor(ms / 1000));
        var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
        return (h > 0 ? h + 'h ' : '') + m + 'm ' + ss + 's';
    }
    function stopClaimCountdown() {
        if (claimCountdownTimer) { clearInterval(claimCountdownTimer); claimCountdownTimer = null; }
    }
    function startClaimCountdown(unlockAtMs) {
        stopClaimCountdown();
        var tick = function () {
            var hint = $('rwClaimHint');
            var ms = unlockAtMs - Date.now();
            if (ms <= 1000) {
                stopClaimCountdown();
                pts.lastClaimAtMs = 0; // cooldown over — the button wakes up
                renderBalance();
                if (hint) hint.textContent = '⏰ Your next +5 is ready! Tap the button above 👆';
                return;
            }
            var at = new Date(unlockAtMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            if (hint) hint.innerHTML = '⏳ Next +5 unlocks in <strong>' + fmtCountdown(ms) + '</strong> (at ' + at + ', 24h after your last claim)';
        };
        tick();
        claimCountdownTimer = setInterval(tick, 1000);
    }
    async function loadReferral() {
        try {
            const res = await firebase.functions().httpsCallable('getReferralOverview')({});
            renderReferral((res && res.data) || {});
        } catch (e) {
            $('rwRefCode').textContent = '—';
            console.warn('[rewards] referral overview failed', e);
        }
    }

    function renderReferral(d) {
        var code = d.code || '—';
        $('rwRefCode').textContent = code;
        $('rwRefJoined').textContent = Number(d.joined || 0);
        $('rwRefActive').textContent = Number(d.active || 0);
        $('rwRefEarned').textContent = Number(d.earned || 0);
        var wa = $('rwRefWaBtn');
        if (wa && d.code) {
            var msg = 'Join me on Sankofa Market — buy & sell directly with people in Ghana. Sign up with my code ' + d.code + ' and we BOTH get free points! 🇬🇭 https://sankofa-market.web.app/pages/auth/register.html';
            wa.href = 'https://wa.me/?text=' + encodeURIComponent(msg);
        }
        var byLine = $('rwRefByLine');
        if (d.referredBy) {
            byLine.style.display = 'block';
            byLine.textContent = 'You joined with ' + (d.referredBy.name ? d.referredBy.name + '’s' : 'a friend’s') + ' code' + (d.referredBy.code ? ' (' + d.referredBy.code + ')' : '') + ' 🎁';
        } else {
            byLine.style.display = 'none';
        }
        // the "have a code?" box is only for fresh accounts with no code yet
        $('rwRefApplyWrap').style.display = (!d.referredBy && d.windowOpen) ? 'block' : 'none';
    }

    function copyReferralCode() {
        var code = $('rwRefCode').textContent.trim();
        if (!code || code === '—' || code === '…') { toast('Your code is still loading — one moment.', 'info'); return; }
        var btn = $('rwRefCopyBtn');
        function done() {
            var old = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            toast('Code ' + code + ' copied — now send it to a friend 🎁', 'success');
            setTimeout(function () { btn.innerHTML = old; }, 1800);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(done, function () { legacyCopy(code); done(); });
        } else {
            legacyCopy(code); done();
        }
    }
    function legacyCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
    }

    async function applyFriendCode() {
        var input = $('rwRefApplyInput');
        var btn = $('rwRefApplyBtn');
        var code = input.value.trim();
        showBox('rwError', null);
        if (!code) { showBox('rwError', 'Type the code your friend gave you first (it looks like SM-ABC123).'); return; }
        btn.disabled = true;
        btn.textContent = 'Checking…';
        try {
            const res = await firebase.functions().httpsCallable('applyReferralCode')({ code: code });
            const d = (res && res.data) || {};
            toast('🎁 +' + (d.bonus || 15) + ' welcome points! Thanks to ' + (d.referrerName || 'your friend') + '.', 'success');
            showBox('rwOk', '🎁 Code accepted — +' + (d.bonus || 15) + ' welcome points are in your balance, thanks to ' + (d.referrerName || 'your friend') + '!');
            input.value = '';
            await Promise.all([loadPoints(), loadHistory(), loadReferral()]);
        } catch (e) {
            showBox('rwError', (e && e.message ? e.message : String(e)));
        }
        btn.disabled = false;
        btn.textContent = 'Apply';
    }

    async function redeem(offerKey, btn) {
        var select = $(offerKey === 'boost7' ? 'rwBoostSelect' : 'rwFeatureSelect');
        var productId = select.value;
        showBox('rwError', null); showBox('rwOk', null);
        if (!productId) { showBox('rwError', 'Pick one of your listings from the dropdown first.'); return; }
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redeeming…';
        try {
            const res = await firebase.functions().httpsCallable('redeemPointsOffer')({ offerType: offerKey, productId: productId });
            const d = (res && res.data) || {};
            showBox('rwOk', '🚀 ' + (d.offer || 'Offer') + ' is live on “' + select.options[select.selectedIndex].text + '” until ' + new Date(d.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) + '. ' + (d.balanceAfter != null ? d.balanceAfter : '?') + ' points left.');
            toast('🚀 ' + (d.offer || 'Offer') + ' is live!', 'success');
            await Promise.all([loadPoints(), loadHistory(), loadListings()]);
        } catch (e) {
            showBox('rwError', (e && e.message ? e.message : String(e)));
        }
        btn.disabled = false;
        btn.innerHTML = offerKey === 'boost7' ? 'Redeem 100 pts → Boost' : 'Redeem 150 pts → Feature';
    }

    // ---- boot ----
    if (typeof firebaseAuth !== 'undefined') {
        firebaseAuth.onAuthStateChanged(function (user) {
            if (!user) {
                var here = encodeURIComponent('/pages/user/rewards.html');
                window.location.href = '/pages/auth/login.html?redirect=' + here;
                return;
            }
            me = user;
            loadPoints();
            loadHistory();
            loadListings();
            loadReferral();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var cb = $('rwClaimBtn');
        if (cb) cb.addEventListener('click', claimToday);
        var bb = $('rwBoostBtn');
        if (bb) bb.addEventListener('click', function () { redeem('boost7', this); });
        var fb = $('rwFeatureBtn');
        if (fb) fb.addEventListener('click', function () { redeem('feature3', this); });
        var rc = $('rwRefCopyBtn');
        if (rc) rc.addEventListener('click', copyReferralCode);
        var ra = $('rwRefApplyBtn');
        if (ra) ra.addEventListener('click', applyFriendCode);
        var ri = $('rwRefApplyInput');
        if (ri) ri.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyFriendCode(); } });
    });
})();
