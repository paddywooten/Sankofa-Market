/**
 * iPhone "Add to Home Screen" coach — Tier 3.
 *
 * Android shows an install prompt automatically; iPhones never do. So on iOS
 * Safari we teach the 3 taps once in a while: Share → Add to Home Screen → Add.
 * Politely: at most 3 times ever, at least 30 days apart, and "Got it" makes
 * it go away. iPadOS-lies-about-being-a-Mac is handled. Debuggers' note:
 * everything testable lives in the IHS CORE block below (no DOM inside).
 */

/* === IHS CORE START (pure helpers — unit-tested) === */

/** True for iPhone/iPad/iPod, including iPadOS pretending to be a Mac. */
function smIhsIsIos(ua, platform, maxTouchPoints) {
    var u = String(ua || '');
    if (/iPad|iPhone|iPod/i.test(u)) return true;
    // iPadOS 13+ sends a Macintosh UA — the touch points give it away
    if (platform === 'MacIntel' && (Number(maxTouchPoints) || 0) > 1) return true;
    return false;
}

/** Chrome/Firefox/Edge on iOS are WebKit shells; the classic A2HS flow is Safari's. */
function smIhsIsThirdPartyBrowser(ua) {
    return /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/i.test(String(ua || ''));
}

/** True when the page already runs from a home-screen icon (nothing to teach). */
function smIhsIsStandalone(navStandalone, matchMediaStandalone) {
    return navStandalone === true || matchMediaStandalone === true;
}

/**
 * Should the card show right now? State shape: { n, last, dismiss }.
 *   - never in standalone, never more than 3 shows ever
 *   - at least 30 days between shows
 *   - "Got it" (dismiss=true) ends it for good
 */
function smIhsShouldShow(state, nowMs) {
    var st = state || {};
    if (st.dismiss === true) return false;
    if ((Number(st.n) || 0) >= 3) return false;
    var last = Number(st.last) || 0;
    if (last > 0 && (nowMs - last) < 30 * 86400000) return false;
    return true;
}

/** The state AFTER a show or a dismiss (pure so the cadence is reviewable). */
function smIhsNextState(state, nowMs, dismissed) {
    var st = { n: (Number(state && state.n) || 0), last: nowMs, dismiss: dismissed === true };
    if (dismissed !== true) st.n = Math.min(99, st.n + 1);   // dismissals don't count as shows
    return st;
}
/* === IHS CORE END === */

(function () {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    var KEY = 'sankofa_ios_a2hs_v1';

    function loadState() {
        try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
    }
    function saveState(st) {
        try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
    }

    function maybeShow() {
        try {
            var ua = navigator.userAgent || '';
            if (!smIhsIsIos(ua, navigator.platform, navigator.maxTouchPoints)) return;
            var standalone = smIhsIsStandalone(
                window.navigator.standalone,
                window.matchMedia ? window.matchMedia('(display-mode: standalone)').matches : false
            );
            if (standalone) return;

            var state = loadState();
            var now = Date.now();
            if (!smIhsShouldShow(state, now)) return;

            var safariNote = smIhsIsThirdPartyBrowser(ua)
                ? '<div style="font-size:0.76rem;color:#92400e;margin-top:6px;">Tip: open this page in <b>Safari</b> first — the iPhone only adds apps from there.</div>'
                : '';

            var card = document.createElement('div');
            card.id = 'iosA2hsCard';
            card.setAttribute('role', 'dialog');
            card.setAttribute('aria-label', 'Add Sankofa Market to your home screen');
            card.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;' +
                'background:#131f47;color:#fff;border-radius:16px;padding:14px 16px;' +
                'box-shadow:0 10px 30px rgba(0,0,0,0.35);font-family:inherit;max-width:520px;margin:0 auto;';
            card.innerHTML =
                '<div style="display:flex;gap:12px;align-items:flex-start;">' +
                  '<div style="font-size:1.5rem;line-height:1;flex-shrink:0;">📲</div>' +
                  '<div style="flex:1;min-width:0;">' +
                    '<div style="font-weight:800;font-size:0.95rem;">Put Sankofa Market on your home screen</div>' +
                    '<div style="font-size:0.8rem;color:#c7d2fe;margin-top:4px;line-height:1.5;">' +
                      '1. Tap the <b>Share</b> button <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f5af02" stroke-width="2.4" style="vertical-align:-2px;"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg> at the bottom of Safari<br>' +
                      '2. Scroll and tap <b>“Add to Home Screen”</b><br>' +
                      '3. Tap <b>Add</b> — done. It opens like an app, uses very little data.' +
                    '</div>' + safariNote +
                    '<div style="display:flex;gap:8px;margin-top:10px;">' +
                      '<button id="iosA2hsGot" style="background:#f5af02;color:#191919;border:none;border-radius:999px;' +
                        'padding:7px 16px;font-size:0.82rem;font-weight:800;cursor:pointer;">Got it ✓</button>' +
                      '<button id="iosA2hsLater" style="background:transparent;color:#c7d2fe;border:1px solid #334155;' +
                        'border-radius:999px;padding:7px 14px;font-size:0.82rem;font-weight:700;cursor:pointer;">Not now</button>' +
                    '</div>' +
                  '</div>' +
                '</div>';
            document.body.appendChild(card);

            function closeCard(dismissed) {
                saveState(smIhsNextState(loadState(), Date.now(), dismissed));
                try { card.remove(); } catch (e) { card.style.display = 'none'; }
            }
            card.querySelector('#iosA2hsGot').addEventListener('click', function () { closeCard(true); });
            card.querySelector('#iosA2hsLater').addEventListener('click', function () { closeCard(false); });
        } catch (e) { /* a coach card must never break a page */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(maybeShow, 4000); });
    } else {
        setTimeout(maybeShow, 4000);
    }
})();

/* Test hook (harmless in the browser). */
if (typeof window !== 'undefined') {
    window.smIhsIsIos = smIhsIsIos;
    window.smIhsIsStandalone = smIhsIsStandalone;
    window.smIhsShouldShow = smIhsShouldShow;
    window.smIhsIsThirdPartyBrowser = smIhsIsThirdPartyBrowser;
    window.smIhsNextState = smIhsNextState;
}
