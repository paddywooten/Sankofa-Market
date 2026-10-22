/* ============================================================================
   Sankofa Market — reliability watchdog  (Section 5)
   Loaded by every page, before the app scripts.

   It does four things, all defensive (nothing here can break a page):

   1. GUARANTEES showFlashMessage EXISTS.
      Pages that do not load main.js had no way to show a message — a failure
      looked like nothing happening at all. Now every page has it.

   2. SURFACES UNCAUGHT ERRORS AND BROKEN PROMISES.
      A button whose handler threw used to fail in complete silence (console
      only). The user now gets a small, dismissible notice — once, not in a
      loop — so "nothing happened" becomes "something went wrong, here's what
      to do". Errors from third-party scripts (Paystack, Google) are logged but
      never shown, because they are not ours to report.

   3. TELLS YOU ABOUT DEAD CLICKS.
      If a click on a button / element with onclick="…" produces no DOM change,
      no navigation and no network request, it is recorded in
      `window.__deadClicks` (and the console), so `tools-reliability.mjs` and
      anyone debugging can find controls that do nothing.

   4. KEEPS A SMALL ERROR LOG.
      The last 20 problems live in `window.__smErrors` — useful when a user
      reports "it did nothing".
   ========================================================================== */
(function () {
    'use strict';

    var SUPPORT = 'sankofamarketgh@gmail.com';
    window.__smErrors = window.__smErrors || [];
    window.__deadClicks = window.__deadClicks || [];

    /* ---------------------------------------------------------------- 1. flash */
    if (typeof window.showFlashMessage !== 'function') {
        window.showFlashMessage = function (message, type) {
            try {
                Array.prototype.forEach.call(document.querySelectorAll('.flash-message'), function (el) { el.remove(); });
                var colors = { success: '#22c55e', error: '#ef4444', warning: '#f59e0b', info: '#0064d2' };
                var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
                var esc = function (v) {
                    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                };
                var el = document.createElement('div');
                el.className = 'flash-message';
                el.setAttribute('role', 'status');
                el.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px) + 72px);left:50%;right:auto;transform:translateX(-50%);' +
                    'width:calc(100vw - 24px);max-width:420px;box-sizing:border-box;z-index:2147483000;background:' +
                    (colors[type] || colors.info) + ';color:#fff;padding:0.75rem 1.1rem;border-radius:10px;' +
                    'box-shadow:0 8px 24px rgba(0,0,0,0.18);font-weight:600;font-size:0.88rem;line-height:1.45;';
                el.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i> ' + esc(message);
                document.body.appendChild(el);
                setTimeout(function () {
                    el.style.transition = 'opacity .3s ease';
                    el.style.opacity = '0';
                    setTimeout(function () { el.remove(); }, 350);
                }, type === 'error' ? 7000 : 4200);
            } catch (e) { /* last resort: never throw from the reporter */ }
        };
    }

    /* ------------------------------------------------- 2. error surfacing */
    var lastShown = 0;
    var reported = 0;

    function describe(err) {
        if (!err) return 'unknown error';
        if (err.message) return String(err.message).slice(0, 200);
        return String(err).slice(0, 200);
    }

    function isOurs(source) {
        // only report problems from our own code — third-party noise (Paystack, gstatic,
        // ad blockers) is logged but never shown to the customer
        if (!source) return true;
        try {
            return source.indexOf(location.hostname) !== -1 || source.indexOf('sankofa') !== -1;
        } catch (e) { return true; }
    }

    function note(kind, message, source) {
        window.__smErrors.push({ at: new Date().toISOString(), kind: kind, message: message, source: source || '' });
        if (window.__smErrors.length > 20) window.__smErrors.shift();
        console.error('[sankofa:' + kind + ']', message, source ? '(' + source + ')' : '');
    }

    function tellTheUser(kind, message) {
        var now = Date.now();
        if (reported >= 3 || now - lastShown < 12000) return;   // never nag
        lastShown = now; reported++;
        window.showFlashMessage(
            (kind === 'promise' ? 'Something did not finish loading or saving. ' : 'Something went wrong on this page. ') +
            'Please try again — if it keeps happening, email ' + SUPPORT + ' and tell us what you tapped.',
            'error'
        );
    }

    window.addEventListener('error', function (ev) {
        try {
            // A resource that failed to load (an image, a stylesheet, a third-party script) also
            // fires an "error" event, but it has a target element and no error object. Those are
            // not broken buttons — the page has fallbacks for them — so we skip them.
            var isResource = ev && ev.target && ev.target !== window && (ev.target.tagName || ev.target !== document);
            if (!ev || !ev.error ? isResource : false) return;
            if (isResource) return;

            var src = (ev && (ev.filename || '')) || '';
            var msg = describe(ev && (ev.error || ev.message));
            if (!msg || msg === 'unknown error') return;         // nothing useful to report
            note('error', msg, src);
            if (isOurs(src) && !/ResizeObserver|Script error/i.test(msg)) tellTheUser('error', msg);
        } catch (e) {}
    }, true);

    window.addEventListener('unhandledrejection', function (ev) {
        try {
            var reason = ev && ev.reason;
            var msg = describe(reason);
            // a permission-denied from Firestore almost always means "you are signed out"
            if (/permission|insufficient/i.test(msg)) {
                msg += ' (you may need to sign in again)';
            }
            note('promise', msg);
            tellTheUser('promise', msg);
        } catch (e) {}
    });

    /* ------------------------------------------------- 3. dead-click detector */
    // A click is only "dead" when nothing happened THAT RELATES TO IT. Comparing the whole
    // page would be useless here: the homepage carousel and live counters change the DOM
    // constantly. So we watch for mutations on the clicked control itself, on anything inside
    // it, or on overlays/dialogs/toasts that appear because of the click — plus navigation
    // and network activity.
    try {
        var pendingClick = null;

        var OVERLAY = '.modal, .overlay, .drawer, .cart-sidebar, .wishlist-sidebar, [role="dialog"], .flash-message, .toast, .dropdown-menu, .menu, .filters-sidebar';

        var deadObs = null;
        if (typeof MutationObserver !== 'undefined' && document.documentElement) {
            deadObs = new MutationObserver(function (records) {
                if (!pendingClick) return;
                var c = pendingClick.control;
                for (var i = 0; i < records.length; i++) {
                    var r = records[i];
                    try {
                        var t = r.target;
                        if (t === c || (c.contains && c.contains(t)) || (t.contains && t.contains(c))) { pendingClick.related = true; return; }
                        // an attribute change only counts when it is on the control itself
                        // (or inside it) — the carousel and live counters animate constantly
                        if (r.type === 'attributes' && (t === c || (c.contains && c.contains(t)))) { pendingClick.related = true; return; }
                        var added = r.addedNodes || [];
                        for (var j = 0; j < added.length; j++) {
                            var n = added[j];
                            if (n && n.nodeType === 1) {
                                if (n.matches && n.matches(OVERLAY)) { pendingClick.related = true; return; }
                                if (n.querySelector && n.querySelector(OVERLAY)) { pendingClick.related = true; return; }
                                // text swapped inside the control's own parent block
                                if (c.parentElement && c.parentElement.contains(n)) { pendingClick.related = true; return; }
                            }
                        }
                    } catch (e) {}
                }
            });
            deadObs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
        }

        document.addEventListener('click', function (ev) {
            try {
                var el = ev.target;
                if (!el || !el.closest) return;
                var control = el.closest('button, a[href="#"], a[onclick], [onclick], [role="button"], .tab-btn, input[type="submit"], input[type="button"]');
                if (!control) return;
                if (el.closest('iframe') || /paystack/i.test(String(control.className))) return;

                // discard anything that happened BEFORE this tap (e.g. the element itself
                // being rendered) so it cannot be mistaken for a result of the click
                try { if (deadObs) deadObs.takeRecords(); } catch (e) {}

                var snap = { url: location.href, requests: (window.__smReqCount || 0), active: document.activeElement };
                pendingClick = { control: control, related: false, snap: snap };
                var mine = pendingClick;

                setTimeout(function () {
                    if (pendingClick === mine) pendingClick = null;
                    var moved = location.href !== snap.url;
                    var grew = (window.__smReqCount || 0) !== snap.requests;
                    var focused = document.activeElement !== snap.active;
                    if (mine.related || moved || grew || focused) return;

                    var id = control.id ? '#' + control.id : '';
                    var cls = control.className ? '.' + String(control.className).split(' ').slice(0, 2).join('.') : '';
                    var label = (control.innerText || control.getAttribute('aria-label') || '').trim().slice(0, 40);
                    var sel = control.tagName.toLowerCase() + id + cls;
                    window.__deadClicks.push({ at: new Date().toISOString(), page: location.pathname, sel: sel, label: label });
                    if (window.__deadClicks.length > 50) window.__deadClicks.shift();
                    console.warn('[sankofa:dead-click] nothing happened after tapping', sel, label ? '"' + label + '"' : '');
                }, 1500);
            } catch (e) {}
        }, true);

        // count network activity so a silent background save still counts as "something happened"
        window.__smReqCount = 0;
        if (window.fetch) {
            var _fetch = window.fetch;
            window.fetch = function () { window.__smReqCount++; return _fetch.apply(this, arguments); };
        }
        if (window.XMLHttpRequest) {
            var _open = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function () { window.__smReqCount++; return _open.apply(this, arguments); };
        }
    } catch (e) { /* the detector is optional */ }

    /* ------------------------------------------------- 4. tiny helper for pages */
    window.smReportProblem = function (what) {
        note('manual', what || 'user reported a problem');
        window.showFlashMessage('Thanks — that is logged. If it keeps happening, email ' + SUPPORT + '.', 'info');
    };
})();
