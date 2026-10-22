/**
 * Sankofa Market — "My Store" editor (js/my-store.js)
 * The seller's own branding studio: name, web address, logo, theme color,
 * story and contact details. Reads stores/{uid} directly (owner rule),
 * saves ONLY through the saveMyStore Cloud Function (validation + slug claim
 * happen server-side, in one transaction).
 */

(function () {
    'use strict';

    var THEMES = {
        ocean: { name: 'Ocean Blue', c1: '#0064d2', c2: '#004a99', on: '#ffffff' },
        gold: { name: 'Sankofa Gold', c1: '#f5af02', c2: '#e09e00', on: '#191919' },
        forest: { name: 'Forest Green', c1: '#16a34a', c2: '#0e6e33', on: '#ffffff' },
        ruby: { name: 'Ruby Red', c1: '#dc2626', c2: '#991b1b', on: '#ffffff' },
        plum: { name: 'Royal Plum', c1: '#7c3aed', c2: '#5b21b6', on: '#ffffff' },
        night: { name: 'Midnight Navy', c1: '#131f47', c2: '#0a1024', on: '#ffffff' }
    };

    /* === PLAN COUNTDOWN CORE START (pure helpers — unit-tested, no DOM) === */
    // Everything the My Store "Shop plan" countdown card shows, computed from ONE plan
    // record. Pure: no Firestore, no DOM. The card paints these strings verbatim.

    var SM_PLAN_DAY_MS = 86400000;
    var SM_PLAN_HOUR_MS = 3600000;
    var SM_PLAN_TERM_DAYS = { monthly: 30, quarterly: 91, yearly: 365 };
    var SM_PLAN_TERM_NAMES = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

    /** Firestore Timestamp / Date / ISO text / epoch number → epoch ms (0 when unknown). */
    function smPlanToMs(v) {
        if (v === null || v === undefined || v === '' || typeof v === 'boolean') return 0;
        if (typeof v === 'number') return isFinite(v) ? v : 0;
        try {
            if (typeof v.toMillis === 'function') { var a = Number(v.toMillis()); return isFinite(a) ? a : 0; }
            if (typeof v.toDate === 'function') { var b = v.toDate().getTime(); return isFinite(b) ? b : 0; }
        } catch (e) { return 0; }
        var c = new Date(v).getTime();
        return isFinite(c) ? c : 0;
    }

    /** "Thu 8 Oct 2026" in Ghana time (Africa/Accra is UTC+0 all year). */
    function smPlanFmtDate(ms) {
        if (!ms || !isFinite(ms)) return '';
        try {
            return new Date(ms).toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) { return new Date(ms).toISOString().slice(0, 10); }
    }

    /** "Fri 16 Oct 2026, 14:32" in Ghana time. */
    function smPlanFmtDateTime(ms) {
        if (!ms || !isFinite(ms)) return '';
        try {
            return new Date(ms).toLocaleString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) { return new Date(ms).toISOString().slice(0, 16).replace('T', ' '); }
    }

    function smPlanCount(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

    /**
     * The countdown card's content for one plan record.
     * opts: { nowMs, rentOn, graceDays, storeLive }
     * Returns plain text and numbers only; the page escapes and paints them.
     */
    function smPlanCountdown(plan, opts) {
        var o = opts || {};
        var now = (typeof o.nowMs === 'number' && isFinite(o.nowMs) && o.nowMs > 0) ? o.nowMs : Date.now();
        var rentOn = o.rentOn === true;
        var storeLive = o.storeLive === true;
        var graceDays = Math.max(0, Math.round(Number(o.graceDays) || 0));
        var p = (plan && typeof plan === 'object') ? plan : {};

        var isTrial = p.trial === true || p.method === 'trial' || p.tier === 'trial';
        var term = (!isTrial && Object.prototype.hasOwnProperty.call(SM_PLAN_TERM_NAMES, p.tier)) ? p.tier : '';
        var bankedDays = Math.max(0, Math.round(Number(p.bankedDays) || 0));
        var startedMs = smPlanToMs(p.startedAt) || smPlanToMs(p.paidAt);
        var endsMs = smPlanToMs(p.endsAt);

        // Free for life (an admin decision): no plan, no countdown, nothing to pay.
        if (o.freeForLife === true) {
            return {
                has: true, kind: 'free', typeLabel: '🕊️ Free for life', stateKey: 'free', stateLabel: 'Free for life', tone: 'ok',
                big: 'No payment needed', detail: 'Your shop stays open. Nothing to renew.', ends: '',
                explainer: 'The Sankofa team made this shop free for life, so plans and reminders do not apply.',
                barPct: 100, barLabel: '', daysLeft: 0, hoursLeft: 0, dayNumber: 0, totalDays: 0,
                bankedDays: bankedDays, graceDaysLeft: 0
            };
        }

        var out = {
            has: false, kind: 'none', typeLabel: '🆓 No plan', stateKey: 'none', stateLabel: 'No plan', tone: 'muted',
            big: '', detail: '', ends: '', explainer: '', barPct: 0, barLabel: '',
            daysLeft: 0, hoursLeft: 0, dayNumber: 0, totalDays: 0, bankedDays: bankedDays, graceDaysLeft: 0
        };

        var hasHistory = isTrial || !!term || bankedDays > 0 || startedMs > 0 || endsMs > 0;
        if (!hasHistory) {
            out.stateLabel = storeLive ? 'Shop is live' : 'Not open yet';
            out.big = (storeLive && !rentOn) ? 'Free launch — no plan needed' : 'No plan yet';
            out.detail = storeLive
                ? (rentOn ? 'Your shop is live. A plan is optional — pick one below to pay in advance.'
                          : "Your shop stays live on Sankofa's approval. A plan is optional.")
                : 'Pick a plan below to open your shop instantly.';
            return out;
        }

        out.has = true;
        out.kind = isTrial ? 'trial' : 'paid';
        out.typeLabel = isTrial ? '🎁 Free trial' : '👑 Paid · ' + (SM_PLAN_TERM_NAMES[term] || 'Plan');
        var startFmt = smPlanFmtDate(startedMs);
        var endFmt = smPlanFmtDateTime(endsMs);
        var startWord = isTrial ? 'started ' : 'subscribed ';

        // 1) Paid days banked while billing was off: nothing counts yet
        if (!endsMs && bankedDays > 0) {
            if (rentOn) {
                out.stateKey = 'starting'; out.stateLabel = 'Starting now'; out.tone = 'ok';
                out.big = 'Starting your ' + smPlanCount(bankedDays, 'day', 'days') + ' now';
                out.detail = (startFmt ? 'Paid ' + startFmt + ' · ' : '') + 'your new end date appears within the hour.';
                out.explainer = 'Your banked days start counting from now.';
                out.barLabel = 'Starting now';
            } else {
                out.stateKey = 'banked'; out.stateLabel = 'Banked · not counting yet'; out.tone = 'gold';
                out.big = bankedDays + ' paid ' + (bankedDays === 1 ? 'day' : 'days') + ' banked';
                out.detail = (startFmt ? 'Paid ' + startFmt + ' · ' : '') + 'counting starts only when Sankofa turns billing on.';
                out.explainer = 'Your paid days are safe — nothing burns while the launch is free.';
                out.barLabel = 'Not counting yet';
            }
            return out;
        }

        // 2) A running term: the countdown from the subscription day
        if (endsMs > now) {
            var remaining = endsMs - now;
            // Whole days round UP, the same rule as the grace-day count: 20.5 days reads "21 days left".
            // Under a day we switch to hours.
            out.daysLeft = remaining >= SM_PLAN_DAY_MS ? Math.ceil(remaining / SM_PLAN_DAY_MS) : 0;
            out.hoursLeft = remaining < SM_PLAN_DAY_MS ? Math.floor(remaining / SM_PLAN_HOUR_MS) : 0;
            var span = (startedMs && endsMs > startedMs) ? endsMs - startedMs : 0;
            out.totalDays = span ? Math.max(1, Math.ceil(span / SM_PLAN_DAY_MS)) : (SM_PLAN_TERM_DAYS[term] || 30);
            var elapsed = startedMs ? Math.max(0, now - startedMs) : 0;
            out.dayNumber = Math.min(out.totalDays, Math.floor(elapsed / SM_PLAN_DAY_MS) + 1);
            out.barPct = span ? Math.min(100, Math.max(0, Math.round(elapsed / span * 100))) : 0;
            out.barLabel = out.barPct + '% of this ' + (isTrial ? 'trial' : 'term') + ' used';
            out.stateKey = 'running'; out.stateLabel = 'Running'; out.tone = isTrial ? 'trial' : 'ok';
            out.big = out.daysLeft >= 1
                ? smPlanCount(out.daysLeft, 'day left', 'days left')
                : (out.hoursLeft >= 1 ? smPlanCount(out.hoursLeft, 'hour left', 'hours left') : 'less than an hour left');
            out.detail = 'Day ' + out.dayNumber + ' of ' + out.totalDays + (startFmt ? ' · ' + startWord + startFmt : '');
            out.ends = endFmt ? 'Ends ' + endFmt : '';
            out.explainer = isTrial
                ? 'Pick a plan to keep your shop open. Paid days start the day you pay, and any trial days left are replaced. Nothing you built is lost either way.'
                : 'Renewing early stacks extra days on top — you never lose time.';
            return out;
        }

        // 3) The term has ended: grace days first, then the shop pauses
        if (endsMs > 0) {
            var sinceEnd = now - endsMs;
            var graceMs = graceDays * SM_PLAN_DAY_MS;
            var endedDays = Math.floor(sinceEnd / SM_PLAN_DAY_MS);
            var endedWord = endedDays <= 0 ? 'Ended today' : ('Ended ' + smPlanCount(endedDays, 'day', 'days') + ' ago');
            out.barPct = 100;
            out.barLabel = 'Term finished';
            out.detail = endFmt ? 'Term ended ' + endFmt : '';
            if (sinceEnd < graceMs) {
                out.graceDaysLeft = Math.max(0, Math.ceil((graceMs - sinceEnd) / SM_PLAN_DAY_MS));
                out.stateKey = 'grace'; out.stateLabel = 'Grace period'; out.tone = 'warn';
                out.big = endedWord + ' — ' + smPlanCount(out.graceDaysLeft, 'grace day', 'grace days') + ' left';
                out.explainer = (isTrial ? 'Pick a plan' : 'Renew') + ' now and your shop stays open — no pause.';
            } else if (!rentOn) {
                out.stateKey = 'ended'; out.stateLabel = 'Ended · billing off'; out.tone = 'muted';
                out.big = endedWord + ' — billing is off';
                out.explainer = 'Nothing is paused for payment while billing is off.';
            } else {
                out.stateKey = 'ended'; out.stateLabel = 'Paused'; out.tone = 'bad';
                out.big = endedWord + ' — shop paused';
                out.explainer = storeLive
                    ? 'Renew to keep your shop open.'
                    : (isTrial ? 'Pick a plan' : 'Renew') + ' to reopen instantly at the same address.';
            }
            return out;
        }

        // 4) A plan record with no usable end date
        out.stateKey = 'none'; out.stateLabel = 'No end date'; out.tone = 'muted';
        out.big = 'No end date set';
        out.detail = 'Pick a plan below to set a fresh end date.';
        return out;
    }

    /* === PLAN COUNTDOWN CORE END === */

    var myUid = null;
    var existingStore = null;       // stores/{uid} doc or null
    var _storeDocLoaded = false;    // true once the stores read has resolved (plan-card race guard)
    var customMode = false;         // true when the seller mixes their own colour
    var textMode = 'auto';          // name/text colour: 'auto' | 'light' | 'dark'
    var bannerShadeMode = 'night';  // banner veil colour: 'night' | 'white' | 'theme'
    var bannerShadeOpacity = 60;    // banner veil strength: 0 (photo dominates) – 95 (faint)
    var advMode = false;            // Simple (presets) vs Advanced (full control) theming
    var heroTextColorCustom = '';   // advanced: fully custom hero text colour ('' = off)
    var heroTextBgColor = '#131f47';// advanced: translucent plate behind name + buttons
    var heroTextBgOpacity = 0;      // 0 = plate off
    var announceTextColor = '';     // advanced: '' = announcement follows the hero text
    var announceBgColor = '#f5af02';// advanced: announcement chip colour
    var announceBgOpacity = 0;      // 0 = Sankofa's default translucent strip

    /* ---- Colour maths for the "mix your own" studio ----------------------------
       MIRRORED from functions/index.js (STORE CORE) — keep the two in sync!
       The server re-derives c2/on anyway; these copies just give the seller a
       true WYSIWYG preview. Retired per theme guidance: only ONE colour crosses
       the wire (themePrimary), the server rebuilds the full theme from it. */

    /** h ∈ [0,360), s/l ∈ [0,100] → '#rrggbb'. */
    function smHslToHex(h, s, l) {
        h = ((Number(h) % 360) + 360) % 360;
        s = Math.min(100, Math.max(0, Number(s))) / 100;
        l = Math.min(100, Math.max(0, Number(l))) / 100;
        if (!isFinite(h) || !isFinite(s) || !isFinite(l)) return '#0064d2';
        var c = (1 - Math.abs(2 * l - 1)) * s;
        var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        var m = l - c / 2;
        var r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }
        function to2(v) { return ('0' + Math.round((v + m) * 255).toString(16)).slice(-2); }
        return '#' + to2(r) + to2(g) + to2(b);
    }

    function smStoreRelLum(hex) {
        var r = parseInt(hex.slice(1, 3), 16) / 255,
            g = parseInt(hex.slice(3, 5), 16) / 255,
            b = parseInt(hex.slice(5, 7), 16) / 255;
        function lin(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }

    function smStoreContrastRatio(hexA, hexB) {
        var a = smStoreRelLum(hexA), b = smStoreRelLum(hexB);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }

    /** '#rrggbb' → { h:0-360, s:0-100, l:0-100 } floats (kept EXACT so the
        preview matches the server's re-derivation to the last bit). */
    function smHexToHsl(hex) {
        var r = parseInt(hex.slice(1, 3), 16) / 255,
            g = parseInt(hex.slice(3, 5), 16) / 255,
            b = parseInt(hex.slice(5, 7), 16) / 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var l = (max + min) / 2, d = max - min, h = 0, s = 0;
        if (d > 0) {
            s = d / (1 - Math.abs(2 * l - 1));
            if (max === r) h = 60 * (((g - b) / d) % 6);
            else if (max === g) h = 60 * ((b - r) / d + 2);
            else h = 60 * ((r - g) / d + 4);
        }
        h = ((h % 360) + 360) % 360;
        return { h: h, s: s * 100, l: l * 100 };
    }

    /** One mixed colour → full readable theme (identical to the server). */
    function smStoreCustomColors(hex) {
        var c1 = String(hex || '').trim().toLowerCase();
        if (!/^#[0-9a-f]{6}$/i.test(c1)) return null;
        var hsl = smHexToHsl(c1);
        var c2 = smHslToHex(hsl.h, Math.min(100, hsl.s + 6), Math.max(8, hsl.l - 14));
        var w = Math.min(smStoreContrastRatio(c1, '#ffffff'), smStoreContrastRatio(c2, '#ffffff'));
        var k = Math.min(smStoreContrastRatio(c1, '#191919'), smStoreContrastRatio(c2, '#191919'));
        return { c1: c1, c2: c2, on: w >= k ? '#ffffff' : '#191919' };
    }
    var logoDataUrl = '';           // freshly picked logo (data URL) until uploaded
    var bannerDataUrl = '';         // freshly picked banner (data URL) until uploaded
    var saving = false;

    function $(id) { return document.getElementById(id); }
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function flash(msg, type) {
        if (typeof showFlashMessage === 'function') showFlashMessage(msg, type);
    }

    /** Same normalization the server applies — shown live so nobody is surprised. */
    function previewSlug(raw) {
        var s = String(raw || '').toLowerCase().trim();
        s = s.replace(/['’]/g, '');
        s = s.replace(/[^a-z0-9]+/g, '-');
        s = s.replace(/-{2,}/g, '-');
        s = s.replace(/^-+|-+$/g, '');
        return s;
    }

    function selectedTheme() {
        var el = document.querySelector('.mstore-swatch.active');
        return el ? el.getAttribute('data-theme') : 'ocean';
    }

    /** The colour the shop will wear right now — hand-mixed or a swatch. */
    function activeColors() {
        if (customMode) return smStoreCustomColors(mixHexFromSliders()) || THEMES.ocean;
        return THEMES[selectedTheme()] || THEMES.ocean;
    }

    /** activeColors + the seller's name/text-colour choice on top (auto keeps
        the readable pick). A fully custom hero text colour (advanced) wins last. */
    function resolvedColors() {
        var c = activeColors();
        if (textMode === 'light') c = { c1: c.c1, c2: c.c2, on: '#ffffff' };
        else if (textMode === 'dark') c = { c1: c.c1, c2: c.c2, on: '#191919' };
        if (heroTextColorCustom && /^#[0-9a-f]{6}$/i.test(heroTextColorCustom)) {
            c = { c1: c.c1, c2: c.c2, on: heroTextColorCustom };
        }
        return c;
    }

    /** '#rrggbb' + alpha (0–1) → 'rgba(r,g,b,a)'. */
    function smHexRgba(hex, alpha) {
        if (!/^#[0-9a-f]{6}$/i.test(hex)) return 'rgba(10,16,36,' + alpha + ')';
        return 'rgba(' + parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16) + ',' + alpha + ')';
    }

    /** '' unless a real '#rrggbb' (MIRRORED from functions/index.js — keep in sync). */
    function smHexOrBlank(v) {
        var s = String(v || '').trim().toLowerCase();
        return /^#[0-9a-f]{6}$/i.test(s) ? s : '';
    }

    /** Integer 0–95 transparency, default on junk (MIRRORED from the server). */
    function smClampOpacity(v, dflt) {
        var n = Math.round(Number(v));
        if (!isFinite(n)) n = dflt;
        return Math.min(95, Math.max(0, n));
    }

    /** rgba string for a translucent plate; '' when the plate is off. */
    function smStorePanelRgba(color, opacity) {
        var c = smHexOrBlank(color);
        var o = Math.round(Number(opacity));
        if (!c || !isFinite(o) || o <= 0) return '';
        o = Math.min(95, o);
        return smHexRgba(c, Math.round(o) / 100);
    }

    /** Point the mixer sliders at any colour (used to sync with a tapped swatch). */
    function setSlidersFromHex(hex) {
        var hsl = smHexToHsl(hex);
        if ($('mixH')) $('mixH').value = String(Math.round(hsl.h) % 360);
        if ($('mixS')) $('mixS').value = String(Math.round(Math.min(100, Math.max(0, hsl.s))));
        if ($('mixL')) $('mixL').value = String(Math.round(Math.min(68, Math.max(18, hsl.l))));
        paintMixer();
    }

    /** The veil colour the banner preview/public page will use. */
    function bannerVeilColor() {
        if (bannerShadeMode === 'white') return '#ffffff';
        if (bannerShadeMode === 'theme') return resolvedColors().c2;
        return '#0a1024';
    }

    /** Warn when the chosen text colour fights the shop colour (banner-less shops). */
    function paintTextModeWarn() {
        var warn = $('textModeWarn');
        if (!warn) return;
        var c = resolvedColors();
        var ratio = smStoreContrastRatio(c.c1, c.on);
        warn.style.display = ratio < 3 ? 'block' : 'none';
    }

    function mixHexFromSliders() {
        return smHslToHex(Number($('mixH').value), Number($('mixS').value), Number($('mixL').value));
    }

    function setCustomMode(on) {
        customMode = on === true;
        var box = $('mixBox');
        if (box) box.classList.toggle('mixing', customMode);
        var st = $('mixState');
        if (st) st.textContent = customMode ? '✓ your own colour is selected — swatches are off' : '— touch a slider to start mixing';
        if (customMode) {
            document.querySelectorAll('.mstore-swatch').forEach(function (x) {
                x.classList.remove('active');
                x.querySelector('i').style.opacity = '0';
            });
        }
    }

    function paintMixer() {
        var c = smStoreCustomColors(mixHexFromSliders());
        if (!c) return;
        var grad = $('mixChipGrad');
        if (grad) grad.style.background = 'linear-gradient(135deg,' + c.c1 + ',' + c.c2 + ')';
        var hex = $('mixHexLabel');
        if (hex) hex.textContent = c.c1;
        var txt = $('mixChipText');
        if (txt) {
            var on = textMode === 'light' ? '#ffffff' : (textMode === 'dark' ? '#191919' : c.on);
            txt.style.background = c.c2;
            txt.style.color = on;
        }
        ['mixH', 'mixS', 'mixL'].forEach(function (id) {
            try { $(id).style.accentColor = c.c1; } catch (e) {}
        });
        paintTextModeWarn();
    }

    /** "Banner look" — the tinted veil over the hero photo: colour + strength. */
    function renderBannerLook() {
        var field = $('bannerInput') && $('bannerInput').closest('.mstore-field');
        if (!field || $('bannerLookBox')) return;
        var box = document.createElement('div');
        box.className = 'mstore-bannerlook';
        box.id = 'bannerLookBox';
        box.innerHTML =
            '<div class="mstore-textmode" style="margin-top:0.6rem;">' +
                '<span class="mstore-textmode-label">Banner veil:</span>' +
                '<button type="button" class="mstore-tm-chip active" data-shade="night">🌙 Midnight</button>' +
                '<button type="button" class="mstore-tm-chip" data-shade="white">⬜ White</button>' +
                '<button type="button" class="mstore-tm-chip" data-shade="theme">🎨 My shop colour</button>' +
            '</div>' +
            '<div class="mstore-mix-row" style="margin-top:0.55rem;">' +
                '<label for="shadeStrength" style="width:74px;">Veil strength</label>' +
                '<input type="range" id="shadeStrength" min="0" max="95" value="60" aria-label="Veil strength">' +
                '<span id="shadeStrengthLabel" style="font-size:0.76rem;font-weight:700;color:#5a6572;min-width:38px;text-align:right;">60%</span>' +
            '</div>' +
            '<div class="mstore-hint" style="margin-top:0.35rem;">The veil sits between your photo and your shop name. ' +
                'High strength hides more of the photo; 0% shows it raw (only pick that if the photo is dark). ' +
                'Pair ⬜ White veil with ⬛ Dark text, 🌙 Midnight with ⬜ White text.</div>';
        field.appendChild(box);
        box.querySelectorAll('[data-shade]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                bannerShadeMode = btn.getAttribute('data-shade');
                box.querySelectorAll('[data-shade]').forEach(function (x) { x.classList.toggle('active', x === btn); });
                refreshPreview();
            });
        });
        $('shadeStrength').addEventListener('input', function () {
            bannerShadeOpacity = Math.min(95, Math.max(0, Number($('shadeStrength').value) || 0));
            $('shadeStrengthLabel').textContent = bannerShadeOpacity + '%';
            refreshPreview();
        });
    }

    /** "Name & text colour" chips — for sellers whose banner fights the auto pick. */
    function renderTextModePicker() {
        var box = $('mixBox') || $('themeRow');
        if (!box || $('textModeRow')) return;
        var wrap = document.createElement('div');
        wrap.className = 'mstore-textmode';
        wrap.id = 'textModeRow';
        wrap.innerHTML =
            '<span class="mstore-textmode-label">Name &amp; text colour:</span>' +
            '<button type="button" class="mstore-tm-chip active" data-tm="auto">✨ Auto</button>' +
            '<button type="button" class="mstore-tm-chip" data-tm="light">⬜ White</button>' +
            '<button type="button" class="mstore-tm-chip" data-tm="dark">⬛ Dark</button>' +
            '<div class="mstore-tm-warn" id="textModeWarn" style="display:none;">⚠ This colour may be hard to read on your shop colour — Auto or a banner usually fixes it.</div>';
        box.parentNode.insertBefore(wrap, box.nextSibling);
        wrap.querySelectorAll('.mstore-tm-chip').forEach(function (btn) {
            btn.addEventListener('click', function () {
                textMode = btn.getAttribute('data-tm');
                wrap.querySelectorAll('.mstore-tm-chip').forEach(function (x) { x.classList.toggle('active', x === btn); });
                paintMixer();
                paintTextModeWarn();
                refreshPreview();
            });
        });
    }

    /** Nearest curated swatch to a hex — used when a custom mixer colour is
        collapsed back to Simple mode, so nothing jumps to a random preset. */
    function nearestThemeSwatch(hex) {
        var best = 'ocean', bestD = Infinity;
        Object.keys(THEMES).forEach(function (k) {
            var a = THEMES[k].c1, b = hex;
            var d = Math.pow(parseInt(a.slice(1, 3), 16) - parseInt(b.slice(1, 3), 16), 2) +
                    Math.pow(parseInt(a.slice(3, 5), 16) - parseInt(b.slice(3, 5), 16), 2) +
                    Math.pow(parseInt(a.slice(5, 7), 16) - parseInt(b.slice(5, 7), 16), 2);
            if (d < bestD) { bestD = d; best = k; }
        });
        return best;
    }

    /** Simple ↔ Advanced theming. Simple = presets only (mixer hidden). Advanced
        unlocks every banner knob: text colour, text plate + transparency,
        announcement text/background colours + transparencies. */
    function setAdvMode(on) {
        advMode = on === true;
        document.body.classList.toggle('sm-adv-mode', advMode);
        document.querySelectorAll('.mstore-mode-chip').forEach(function (x) {
            x.classList.toggle('active', (x.getAttribute('data-mode') === 'adv') === advMode);
        });
        if (!advMode && customMode) {
            // Collapse a hand-mixed colour back to its nearest preset swatch
            var hex = mixHexFromSliders();
            setCustomMode(false);
            setThemeSwatch(nearestThemeSwatch(hex));
        }
        refreshPreview();
        paintTextModeWarn();
    }

    /** The Simple/Advanced switch + the full-control banner panel. */
    function renderAdvancedPanel() {
        var row = $('themeRow');
        if (!row || $('advPanel')) return;
        var wrap = document.createElement('div');
        wrap.id = 'advPanel';
        wrap.innerHTML =
            '<div class="mstore-textmode" style="margin-top:0.8rem;">' +
                '<span class="mstore-textmode-label">Theming:</span>' +
                '<button type="button" class="mstore-tm-chip mstore-mode-chip active" data-mode="simple">✨ Simple — pick a look</button>' +
                '<button type="button" class="mstore-tm-chip mstore-mode-chip" data-mode="adv">🛠 Advanced — full control</button>' +
            '</div>' +
            '<div class="mstore-adv-box mstore-advanced-only">' +
                '<div class="mstore-adv-title">🛠 Advanced banner controls</div>' +
                '<div class="mstore-adv-grid">' +
                    '<label class="mstore-adv-field"><span>Name &amp; story text colour</span>' +
                        '<span class="mstore-adv-ctl"><input type="color" id="advHeroText" value="#ffffff" aria-label="Text colour"><button type="button" class="mstore-adv-reset" data-reset="heroText">Auto</button></span></label>' +
                    '<label class="mstore-adv-field"><span>Plate behind text</span>' +
                        '<span class="mstore-adv-ctl"><input type="color" id="advTextBg" value="#131f47" aria-label="Plate colour"><button type="button" class="mstore-adv-reset" data-reset="textBg">Off</button></span></label>' +
                    '<label class="mstore-adv-field"><span>Plate strength</span>' +
                        '<span class="mstore-adv-ctl"><input type="range" id="advTextBgOp" min="0" max="95" value="0" aria-label="Plate strength"><b id="advTextBgOpLabel" class="mstore-adv-val">off</b></span></label>' +
                    '<label class="mstore-adv-field"><span>Announcement text colour</span>' +
                        '<span class="mstore-adv-ctl"><input type="color" id="advAnnText" value="#191919" aria-label="Announcement text colour"><button type="button" class="mstore-adv-reset" data-reset="annText">Auto</button></span></label>' +
                    '<label class="mstore-adv-field"><span>Announcement background</span>' +
                        '<span class="mstore-adv-ctl"><input type="color" id="advAnnBg" value="#f5af02" aria-label="Announcement background colour"><button type="button" class="mstore-adv-reset" data-reset="annBg">Default</button></span></label>' +
                    '<label class="mstore-adv-field"><span>Announcement background strength</span>' +
                        '<span class="mstore-adv-ctl"><input type="range" id="advAnnBgOp" min="0" max="95" value="0" aria-label="Announcement background strength"><b id="advAnnBgOpLabel" class="mstore-adv-val">default</b></span></label>' +
                '</div>' +
                '<div class="mstore-hint">These override everything above. The live preview shows exactly what buyers will see.</div>' +
            '</div>';
        row.parentNode.insertBefore(wrap, row.nextSibling);

        wrap.querySelectorAll('.mstore-mode-chip').forEach(function (btn) {
            btn.addEventListener('click', function () { setAdvMode(btn.getAttribute('data-mode') === 'adv'); });
        });
        $('advHeroText').addEventListener('input', function () {
            heroTextColorCustom = this.value;
            paintTextModeWarn();
            refreshPreview();
        });
        $('advTextBg').addEventListener('input', function () {
            heroTextBgColor = this.value;
            refreshPreview();
        });
        $('advTextBgOp').addEventListener('input', function () {
            heroTextBgOpacity = smClampOpacity(this.value, 0);
            $('advTextBgOpLabel').textContent = heroTextBgOpacity > 0 ? heroTextBgOpacity + '%' : 'off';
            refreshPreview();
        });
        $('advAnnText').addEventListener('input', function () {
            announceTextColor = this.value;
            refreshPreview();
        });
        $('advAnnBg').addEventListener('input', function () {
            announceBgColor = this.value;
            refreshPreview();
        });
        $('advAnnBgOp').addEventListener('input', function () {
            announceBgOpacity = smClampOpacity(this.value, 0);
            $('advAnnBgOpLabel').textContent = announceBgOpacity > 0 ? announceBgOpacity + '%' : 'default';
            refreshPreview();
        });
        wrap.querySelectorAll('.mstore-adv-reset').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var kind = btn.getAttribute('data-reset');
                if (kind === 'heroText') { heroTextColorCustom = ''; $('advHeroText').value = '#ffffff'; }
                if (kind === 'textBg') { heroTextBgOpacity = 0; $('advTextBgOp').value = '0'; $('advTextBgOpLabel').textContent = 'off'; }
                if (kind === 'annText') { announceTextColor = ''; $('advAnnText').value = '#191919'; }
                if (kind === 'annBg') { announceBgOpacity = 0; $('advAnnBgOp').value = '0'; $('advAnnBgOpLabel').textContent = 'default'; }
                paintTextModeWarn();
                refreshPreview();
            });
        });
    }

    /** The "mix your own colour" studio: three sliders under the swatches. */
    function renderColorMixer() {
        var row = $('themeRow');
        if (!row || $('mixBox')) return;
        var box = document.createElement('div');
        box.className = 'mstore-mix mstore-advanced-only';
        box.id = 'mixBox';
        box.innerHTML =
            '<div class="mstore-mix-head"><b>🎨 Or mix your own colour</b> <span class="mstore-mix-state" id="mixState">— touch a slider to start mixing</span></div>' +
            '<div class="mstore-mix-row"><label for="mixH">Colour</label>' +
                '<input type="range" id="mixH" min="0" max="359" value="211" aria-label="Colour"></div>' +
            '<div class="mstore-mix-row"><label for="mixS">Richness</label>' +
                '<input type="range" id="mixS" min="0" max="100" value="100" aria-label="Richness"></div>' +
            '<div class="mstore-mix-row"><label for="mixL">Brightness</label>' +
                '<input type="range" id="mixL" min="18" max="68" value="41" aria-label="Brightness"></div>' +
            '<div class="mstore-mix-out">' +
                '<span class="mstore-mix-chip" id="mixChipGrad"></span>' +
                '<span class="mstore-mix-chip mstore-mix-chip-text" id="mixChipText">Aa</span>' +
                '<span class="mstore-mix-note">Your colour <b id="mixHexLabel"></b> — we add the darker shade and readable text for you.</span>' +
            '</div>';
        row.parentNode.insertBefore(box, row.nextSibling);
        ['mixH', 'mixS', 'mixL'].forEach(function (id) {
            $(id).addEventListener('input', function () {
                setCustomMode(true);
                paintMixer();
                refreshPreview();
            });
        });
        paintMixer();
    }

    function refreshPreview() {
        var name = $('storeNameInput').value.trim() || 'Your store name';
        var bio = $('storeBioInput').value.trim() || 'Your story appears here';
        var theme = resolvedColors();

        $('previewName').textContent = name;
        $('previewBio').textContent = bio;
        var hero = $('previewHero');
        hero.style.setProperty('--st-c1', theme.c1);
        hero.style.setProperty('--st-c2', theme.c2);
        hero.style.setProperty('--st-on', theme.on);

        // Tier 3 banner: sits behind the name, dimmed just enough to keep text readable
        var bannerSrc = bannerDataUrl || (existingStore && (existingStore.bannerThumbUrl || existingStore.bannerUrl)) || '';
        if (bannerSrc) {
            var vc = bannerVeilColor();
            var a1 = Math.round(bannerShadeOpacity) / 100;
            var a2 = Math.round(bannerShadeOpacity * 0.83) / 100;
            hero.style.backgroundImage =
                'linear-gradient(' + smHexRgba(vc, a1) + ', ' + smHexRgba(vc, a2) + '), url("' + esc(bannerSrc) + '")';
            hero.style.backgroundSize = 'cover';
            hero.style.backgroundPosition = 'center';
        } else {
            hero.style.backgroundImage = '';
            hero.style.backgroundSize = '';
            hero.style.backgroundPosition = '';
        }

        var pvLogo = $('previewLogo');
        if (logoDataUrl) {
            pvLogo.innerHTML = '<img src="' + logoDataUrl + '" alt="logo">';
        } else if (existingStore && existingStore.logoThumbUrl) {
            pvLogo.innerHTML = '<img src="' + esc(existingStore.logoThumbUrl) + '" alt="logo">';
        } else {
            pvLogo.textContent = name.charAt(0).toUpperCase();
        }

        // Logo box at the top of Branding mirrors it too
        var slot = $('logoPreview');
        if (logoDataUrl) slot.innerHTML = '<img src="' + logoDataUrl + '" alt="logo">';
        else if (existingStore && existingStore.logoThumbUrl) slot.innerHTML = '<img src="' + esc(existingStore.logoThumbUrl) + '" alt="logo">';

        $('bioCounter').textContent = String($('storeBioInput').value.length);

        var slug = previewSlug($('storeSlugInput').value || $('storeNameInput').value);
        $('slugPreview').textContent = slug
            ? 'sankofa-market.web.app/store/' + slug
            : 'sankofa-market.web.app/store/your-shop';

        // Advanced preview: text plate behind name/story + announcement strip colours
        var pvText = $('previewText');
        var plate = advMode ? smStorePanelRgba(heroTextBgColor, heroTextBgOpacity) : '';
        if (pvText) {
            pvText.classList.toggle('has-textbg', !!plate);
            pvText.style.background = plate || '';
        }
        var pvAnn = $('previewAnnounce');
        if (pvAnn) {
            var annText = $('storeAnnounceInput').value.trim();
            if (annText) {
                pvAnn.style.display = 'flex';
                $('previewAnnounceText').textContent = annText;
                pvAnn.style.color = smHexOrBlank(announceTextColor) || theme.on;
                var annBg = advMode ? smStorePanelRgba(announceBgColor, announceBgOpacity) : '';
                pvAnn.style.background = annBg || '';
            } else {
                pvAnn.style.display = 'none';
            }
        }
    }

    function renderThemeSwatches() {
        var row = $('themeRow');
        row.innerHTML = Object.keys(THEMES).map(function (key) {
            var t = THEMES[key];
            return '<div class="mstore-swatch' + (key === 'ocean' ? ' active' : '') + '" data-theme="' + key + '" title="' + t.name + '" ' +
                'style="background:linear-gradient(135deg,' + t.c1 + ',' + t.c2 + ');">' +
                '<i class="fas fa-check" style="opacity:' + (key === 'ocean' ? '1' : '0') + ';"></i></div>';
        }).join('');
        row.querySelectorAll('.mstore-swatch').forEach(function (sw) {
            sw.addEventListener('click', function () {
                setCustomMode(false);   // back to a ready-made swatch
                row.querySelectorAll('.mstore-swatch').forEach(function (x) {
                    x.classList.remove('active');
                    x.querySelector('i').style.opacity = '0';
                });
                sw.classList.add('active');
                sw.querySelector('i').style.opacity = '1';
                // Sliders mirror the picked swatch — nudging one afterwards
                // starts a custom mix FROM that colour instead of from blue.
                var key = sw.getAttribute('data-theme');
                if (THEMES[key]) setSlidersFromHex(THEMES[key].c1);
                refreshPreview();
            });
        });
    }

    function setThemeSwatch(themeId) {
        setCustomMode(false);
        var t = THEMES[themeId] ? themeId : 'ocean';
        document.querySelectorAll('.mstore-swatch').forEach(function (x) {
            var on = x.getAttribute('data-theme') === t;
            x.classList.toggle('active', on);
            x.querySelector('i').style.opacity = on ? '1' : '0';
        });
    }

    function renderStatus(store) {
        var el = $('myStoreStatus');
        if (!store) {
            el.className = 'mstore-banner guide';
            el.innerHTML = '<i class="fas fa-rocket" style="margin-top:2px;"></i><span><b>Open your own shop!</b> Pick a name, an address and a color below — FREE during our launch period. Your shop goes live shortly after Sankofa reviews it.</span>';
            return;
        }
        if (store.isActive) {
            el.className = 'mstore-banner live';
            el.innerHTML = '<i class="fas fa-check-circle" style="margin-top:2px;"></i><span><b>Your shop is LIVE!</b> Share your address everywhere — WhatsApp status, Instagram bio, business cards.</span>';
        } else {
            el.className = 'mstore-banner pending';
            el.innerHTML = '<i class="fas fa-hourglass-half" style="margin-top:2px;"></i><span><b>Waiting for review.</b> Your shop is saved! Sankofa will switch it on shortly — usually within a day. Only you can see it for now.</span>';
        }
    }

    function renderShare(store) {
        var box = $('myStoreShare');
        if (!store || !store.slug) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        var url = 'https://sankofa-market.web.app/store/' + store.slug;
        $('myStoreUrl').textContent = url;
        $('viewStoreBtn').href = '/store/' + store.slug;
        $('waShareBtn').href = 'https://wa.me/?text=' + encodeURIComponent('🛍️ Visit my shop "' + (store.storeName || '') + '" on Sankofa Market: ' + url);
    }

    function fillForm(store) {
        $('storeNameInput').value = store.storeName || '';
        $('storeSlugInput').value = store.slug || '';
        $('storeBioInput').value = store.bio || '';
        $('storeAnnounceInput').value = store.announcement || '';
        $('storePhoneInput').value = store.phone || '';
        $('storeEmailInput').value = store.email || '';
        $('storeLocationInput').value = store.location || '';
        if (store.theme === 'custom' && store.themeColors && /^#[0-9a-f]{6}$/i.test(store.themeColors.c1 || '')) {
            // Seller mixed their own colour — put the sliders back where they were
            document.querySelectorAll('.mstore-swatch').forEach(function (x) { x.classList.remove('active'); x.querySelector('i').style.opacity = '0'; });
            setCustomMode(true);
            setSlidersFromHex(store.themeColors.c1);
        } else {
            setThemeSwatch(store.theme);
        }
        // Banner veil prefill (colour mode + strength slider)
        var shade = store.bannerShade || {};
        bannerShadeMode = (shade.mode === 'white' || shade.mode === 'theme') ? shade.mode : 'night';
        var so = Math.round(Number(shade.opacity));
        bannerShadeOpacity = isFinite(so) ? Math.min(95, Math.max(0, so)) : 60;
        document.querySelectorAll('#bannerLookBox [data-shade]').forEach(function (x) {
            x.classList.toggle('active', x.getAttribute('data-shade') === bannerShadeMode);
        });
        if ($('shadeStrength')) $('shadeStrength').value = String(bannerShadeOpacity);
        if ($('shadeStrengthLabel')) $('shadeStrengthLabel').textContent = bannerShadeOpacity + '%';
        // Name/text colour choice (auto keeps the readable pick unless the seller chose one)
        textMode = (store.themeTextMode === 'light' || store.themeTextMode === 'dark') ? store.themeTextMode : 'auto';
        // Scoped to #textModeRow — a bare .mstore-tm-chip selector would also
        // sweep up the banner-veil chips (same class) and strip their highlight.
        document.querySelectorAll('#textModeRow .mstore-tm-chip').forEach(function (x) {
            x.classList.toggle('active', x.getAttribute('data-tm') === textMode);
        });
        // Advanced theming prefill — a shop that uses any advanced knob reopens in Advanced
        heroTextColorCustom = smHexOrBlank(store.heroTextColor);
        heroTextBgColor = smHexOrBlank(store.heroTextBgColor) || '#131f47';
        heroTextBgOpacity = smClampOpacity(store.heroTextBgOpacity, 0);
        announceTextColor = smHexOrBlank(store.announceTextColor);
        announceBgColor = smHexOrBlank(store.announceBgColor) || '#f5af02';
        announceBgOpacity = smClampOpacity(store.announceBgOpacity, 0);
        var usesAdvanced = store.theme === 'custom' || !!heroTextColorCustom ||
            heroTextBgOpacity > 0 || !!announceTextColor || announceBgOpacity > 0;
        setAdvMode(usesAdvanced);
        if ($('advHeroText')) $('advHeroText').value = heroTextColorCustom || '#ffffff';
        if ($('advTextBg')) $('advTextBg').value = heroTextBgColor;
        if ($('advTextBgOp')) $('advTextBgOp').value = String(heroTextBgOpacity);
        if ($('advTextBgOpLabel')) $('advTextBgOpLabel').textContent = heroTextBgOpacity > 0 ? heroTextBgOpacity + '%' : 'off';
        if ($('advAnnText')) $('advAnnText').value = announceTextColor || '#191919';
        if ($('advAnnBg')) $('advAnnBg').value = announceBgColor;
        if ($('advAnnBgOp')) $('advAnnBgOp').value = String(announceBgOpacity);
        if ($('advAnnBgOpLabel')) $('advAnnBgOpLabel').textContent = announceBgOpacity > 0 ? announceBgOpacity + '%' : 'default';
        paintTextModeWarn();
        var bp = $('bannerPreview');
        if (bp) {
            var bs = store.bannerThumbUrl || store.bannerUrl || '';
            bp.innerHTML = bs ? '<img src="' + esc(bs) + '" alt="banner">' : '<i class="fas fa-image"></i> Banner preview';
        }
        refreshPreview();
    }

    function readAndShrinkLogo(file, maxPx) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () {
                try {
                    var scale = Math.min(1, maxPx / Math.max(img.width, img.height));
                    var canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(img.width * scale));
                    canvas.height = Math.max(1, Math.round(img.height * scale));
                    var ctx = canvas.getContext('2d');
                    // white backing so transparent PNGs don't turn black in JPEG
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(img.src);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                } catch (e) { reject(e); }
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    async function uploadBanner(uid) {
        if (!bannerDataUrl) {
            return {
                bannerUrl: existingStore ? (existingStore.bannerUrl || '') : '',
                bannerThumbUrl: existingStore ? (existingStore.bannerThumbUrl || '') : ''
            };
        }
        var full = await readShrinkTo(bannerDataUrl, 1200);
        var thumb = await readShrinkTo(bannerDataUrl, 380);

        var fullRef = firebaseStorage.ref().child('store-logos/' + uid + '/banner.jpg');
        await new Promise(function (resolve, reject) {
            fullRef.put(dataUrlToBlob(full)).on('state_changed', null, reject, resolve);
        });
        var thumbRef = firebaseStorage.ref().child('store-logos/' + uid + '/banner_thumb.jpg');
        await new Promise(function (resolve, reject) {
            thumbRef.put(dataUrlToBlob(thumb)).on('state_changed', null, reject, resolve);
        });
        return { bannerUrl: await fullRef.getDownloadURL(), bannerThumbUrl: await thumbRef.getDownloadURL() };
    }

    async function uploadLogo(uid) {
        if (!logoDataUrl) {
            return {
                logoUrl: existingStore ? (existingStore.logoUrl || '') : '',
                logoThumbUrl: existingStore ? (existingStore.logoThumbUrl || '') : ''
            };
        }
        var full = await readShrinkTo(logoDataUrl, 400);
        var thumb = await readShrinkTo(logoDataUrl, 160);

        var fullRef = firebaseStorage.ref().child('store-logos/' + uid + '/logo.jpg');
        await new Promise(function (resolve, reject) {
            fullRef.put(dataUrlToBlob(full)).on('state_changed', null, reject, resolve);
        });
        var thumbRef = firebaseStorage.ref().child('store-logos/' + uid + '/logo_thumb.jpg');
        await new Promise(function (resolve, reject) {
            thumbRef.put(dataUrlToBlob(thumb)).on('state_changed', null, reject, resolve);
        });
        return { logoUrl: await fullRef.getDownloadURL(), logoThumbUrl: await thumbRef.getDownloadURL() };
    }

    function readShrinkTo(dataUrl, maxPx) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () {
                var scale = Math.min(1, maxPx / Math.max(img.width, img.height));
                var canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    function dataUrlToBlob(dataUrl) {
        var parts = dataUrl.split(',');
        var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
        var bin = atob(parts[1]);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: mime });
    }

    async function saveStore() {
        if (saving || !myUid) return;
        saving = true;
        var btn = $('saveStoreBtn');
        var msg = $('saveStoreMsg');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving…';
        msg.textContent = '';

        try {
            // 1. Upload the logo + banner (if new ones were picked)
            msg.textContent = 'Uploading images…';
            var logo = await uploadLogo(myUid);
            var banner = await uploadBanner(myUid);

            // 2. Server does validation + claims the web address atomically
            msg.textContent = 'Saving your shop…';
            var payload = {
                storeName: $('storeNameInput').value,
                slug: $('storeSlugInput').value,
                bio: $('storeBioInput').value,
                announcement: $('storeAnnounceInput').value,
                theme: customMode ? 'custom' : selectedTheme(),
                themePrimary: customMode ? mixHexFromSliders() : '',
                themeTextMode: textMode,
                bannerShadeMode: bannerShadeMode,
                bannerShadeOpacity: bannerShadeOpacity,
                phone: $('storePhoneInput').value,
                email: $('storeEmailInput').value,
                location: $('storeLocationInput').value,
                logoUrl: logo.logoUrl,
                logoThumbUrl: logo.logoThumbUrl,
                bannerUrl: banner.bannerUrl,
                bannerThumbUrl: banner.bannerThumbUrl
            };
            var res = await firebase.functions().httpsCallable('saveMyStore')(payload);

            // 3. Reload the truth from Firestore
            var snap = await firebaseDB.collection('stores').doc(myUid).get();
            existingStore = snap.exists ? snap.data() : null;
            logoDataUrl = '';
            bannerDataUrl = '';
            renderStatus(existingStore);
            renderShare(existingStore);
            fillForm(existingStore || {});
            msg.textContent = '';
            flash('Store saved! 🏪 Your shop address: sankofa-market.web.app/store/' + res.data.slug, 'success');
        } catch (err) {
            console.error('saveStore failed:', err);
            var friendly = (err && err.message) || 'Could not save — please try again.';
            if (/not logged in|unauthenticated/i.test(friendly)) friendly = 'Please sign in again, then save.';
            msg.textContent = friendly;
            flash(friendly, 'error');
        } finally {
            saving = false;
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Save my store';
        }
    }

    /* ============== "COMPLETE MY SHOP" checklist (Feature 4) ============== */

    /** Pure checklist builder — kept out of the DOM so it stays trivially right. */
    function buildChecklist(store, itemCount) {
        var isStore = !!store;
        return [
            { label: 'List your <b>first item</b>', done: itemCount >= 1, act: itemCount < 1 ? '<a class="btn btn-primary btn-small" href="/publish.html"><i class="fas fa-plus"></i> List it</a>' : '' },
            { label: 'Reach <b>3 items</b> on the shelf' + (itemCount ? ' (' + Math.min(itemCount, 3) + '/3)' : ''), done: itemCount >= 3, act: (itemCount >= 1 && itemCount < 3) ? '<a class="btn btn-outline btn-small" href="/publish.html"><i class="fas fa-plus"></i> Add one</a>' : '' },
            { label: 'Fill the shelf: <b>5+ items</b>' + (itemCount ? ' (' + Math.min(itemCount, 5) + '/5)' : ''), done: itemCount >= 5, act: (itemCount >= 3 && itemCount < 5) ? '<a class="btn btn-outline btn-small" href="/publish.html"><i class="fas fa-plus"></i> Add more</a>' : '' },
            { label: 'Add your <b>shop logo</b>', done: !!(store && (store.logoThumbUrl || store.logoUrl)), act: (isStore && !(store.logoThumbUrl || store.logoUrl)) ? '<a class="btn btn-outline btn-small" href="#logoInput" onclick="document.getElementById(\'logoInput\').click();return false;"><i class="fas fa-image"></i> Upload</a>' : '' },
            { label: 'Add a <b>shop banner</b>', done: !!(store && (store.bannerThumbUrl || store.bannerUrl)), act: (isStore && !(store.bannerThumbUrl || store.bannerUrl)) ? '<a class="btn btn-outline btn-small" href="#bannerInput" onclick="document.getElementById(\'bannerInput\').click();return false;"><i class="fas fa-panorama"></i> Upload</a>' : '' },
            { label: '<b>Share your shop link</b> on WhatsApp', done: false, act: '<a class="btn btn-small" style="background:#25d366;color:#fff;border:none;" href="#myStoreShare" onclick="document.getElementById(\'myStoreShare\').scrollIntoView({behavior:\'smooth\'});return false;"><i class="fab fa-whatsapp"></i> Share</a>' }
        ];
    }

    async function renderChecklist(store) {
        var box = $('myStoreChecklist');
        if (!box) return;
        if (!store) { box.style.display = 'none'; return; }
        var itemCount = 0;
        try {
            // One small query counts the seller's live shelf — same shape as everywhere else
            var snap = await firebaseDB.collection('products')
                .where('sellerId', '==', myUid)
                .limit(60)
                .get();
            snap.forEach(function (d) {
                var p = d.data() || {};
                if (p.isActive !== false && p.isSold !== true) itemCount++;
            });
        } catch (e) { console.warn('checklist count failed:', e && e.message); }

        var rows = buildChecklist(store, itemCount);
        var doneCount = rows.filter(function (r) { return r.done; }).length;
        var pct = Math.round((doneCount / rows.length) * 100);
        box.style.display = 'block';
        $('checklistBar').style.width = pct + '%';
        $('checklistRows').innerHTML = rows.map(function (r) {
            return '<div class="mstore-check-row ' + (r.done ? 'done' : 'todo') + '">' +
                '<span class="cl-ic"><i class="fas ' + (r.done ? 'fa-check' : 'fa-circle') + '"></i></span>' +
                '<span class="cl-text">' + r.label + '</span>' +
                '<span class="cl-act">' + (r.act || '') + '</span>' +
                '</div>';
        }).join('');
        $('checklistDone').style.display = doneCount >= 5 ? 'block' : 'none';
    }

    /* ================== TIER 2: shop mini-analytics (owner-only) ================== */

    function statDayId(ms) {
        var d = new Date(ms);
        var m = d.getMonth() + 1, day = d.getDate();
        return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }

    async function renderStatsCard() {
        var body = $('statsBody'), bars = $('statsBars');
        if (!body) return;
        try {
            var rootSnap = await firebaseDB.collection('shopStats').doc(myUid).get();
            var totals = rootSnap.exists ? (rootSnap.data() || {}) : {};

            var ids = [], byId = {};
            for (var i = 6; i >= 0; i--) {
                var id = statDayId(Date.now() - i * 86400000);
                ids.push(id); byId[id] = { views: 0, itemViews: 0 };
            }
            var daySnap = await firebaseDB.collection('shopStats').doc(myUid).collection('daily')
                .orderBy('date', 'desc').limit(10).get();
            daySnap.forEach(function (d) {
                var v = d.data() || {};
                if (byId[d.id]) { byId[d.id].views = Number(v.views || 0); byId[d.id].itemViews = Number(v.itemViews || 0); }
            });
            var weekViews = 0, weekItems = 0, maxDay = 1;
            ids.forEach(function (id) {
                weekViews += byId[id].views; weekItems += byId[id].itemViews;
                var tot = byId[id].views + byId[id].itemViews;
                if (tot > maxDay) maxDay = tot;
            });

            var weekWord = (weekViews + weekItems) === 0
                ? 'No visits counted yet this week — share your shop link on WhatsApp to turn this on. 📣'
                : 'This week: <strong>' + weekViews + ' shop visit' + (weekViews === 1 ? '' : 's') +
                  '</strong> and <strong>' + weekItems + ' item view' + (weekItems === 1 ? '' : 's') + '</strong>. ' +
                  'All-time: ' + Number(totals.viewsTotal || 0).toLocaleString() + ' visits · ' +
                  Number(totals.itemViewsTotal || 0).toLocaleString() + ' item views.';
            body.innerHTML = weekWord;

            if (bars) {
                var dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
                bars.innerHTML = ids.map(function (id) {
                    var v = byId[id]; var tot = v.views + v.itemViews;
                    var h = tot === 0 ? 3 : Math.max(8, Math.round((tot / maxDay) * 44));
                    var dName = dayNames[new Date(id + 'T00:00:00').getDay()];
                    return '<div class="mstore-statbar" title="' + id + ': ' + v.views + ' visits, ' + v.itemViews + ' item views">' +
                        '<div class="mstore-statbar-col" style="height:' + h + 'px;"></div>' +
                        '<span>' + dName + '</span></div>';
                }).join('');
            }
        } catch (e) {
            console.warn('stats card failed:', e && e.message);
            body.textContent = 'Numbers are resting — pull to refresh in a moment.';
        }
    }

    /* ================== TIER 2: store promo codes ================== */

    function promoEsc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }

    async function refreshPromoList() {
        var box = $('promoList');
        if (!box) return;
        box.innerHTML = '<div style="font-size:0.82rem;color:#5a6572;">Loading your codes…</div>';
        try {
            var res = await firebase.functions().httpsCallable('listMyStorePromos')({});
            var rows = (res && res.data && res.data.promos) || [];
            if (!rows.length) {
                box.innerHTML = '<div style="font-size:0.82rem;color:#5a6572;">No codes yet. Mint your first one above — it takes 5 seconds.</div>';
                return;
            }
            box.innerHTML = rows.map(function (r) {
                var uses = r.usedCount + (r.maxUses > 0 ? '/' + r.maxUses : '') + ' use' + (r.usedCount === 1 ? '' : 's');
                var expiry = r.expiresAt ? (' · ends ' + new Date(r.expiresAt).toLocaleDateString()) : '';
                var min = r.minSubtotal > 0 ? (' · min GHS ' + Number(r.minSubtotal).toLocaleString()) : '';
                return '<div class="mstore-promo-row ' + (r.isActive ? '' : 'is-off') + '">' +
                    '<span class="mstore-promo-code">' + promoEsc(r.code) + '</span>' +
                    '<span class="mstore-promo-meta">' + promoEsc(r.percentOff) + '% off' + promoEsc(min) + ' · ' + promoEsc(uses) + promoEsc(expiry) + '</span>' +
                    '<button class="btn btn-outline btn-small mstore-promo-toggle" data-code="' + promoEsc(r.code) + '" data-on="' + (r.isActive ? '1' : '0') + '">' +
                        (r.isActive ? 'Turn off' : 'Turn on') + '</button>' +
                    '</div>';
            }).join('');
            box.querySelectorAll('.mstore-promo-toggle').forEach(function (btn) {
                btn.addEventListener('click', async function () {
                    btn.disabled = true;
                    try {
                        await firebase.functions().httpsCallable('saveStorePromo')({
                            action: btn.getAttribute('data-on') === '1' ? 'stop' : 'start', code: btn.getAttribute('data-code')
                        });
                        flash(btn.getAttribute('data-on') === '1' ? 'Code switched off — it no longer gives discounts.' : 'Code is live again! 🎉', 'success');
                    } catch (e) { flash(e && e.message ? e.message : 'Could not change that code.', 'error'); }
                    refreshPromoList();
                });
            });
        } catch (e) {
            box.innerHTML = '<div style="font-size:0.82rem;color:#b91c1c;">' + promoEsc(e && e.message ? e.message : 'Could not load codes.') + '</div>';
        }
    }

    function wirePromoForm() {
        var btn = $('promoCreateBtn');
        if (!btn || btn._wired) return;
        btn._wired = true;
        btn.addEventListener('click', async function () {
            var code = ($('promoCodeInput').value || '').trim();
            var pct = Number($('promoPctInput').value) || 10;
            var min = Math.max(0, Number($('promoMinInput').value) || 0);
            var msg = $('promoFormMsg');
            if (!code) { msg.style.color = '#b91c1c'; msg.textContent = 'Type a code word first — e.g. KOFI10.'; return; }
            btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Minting…';
            try {
                var res = await firebase.functions().httpsCallable('saveStorePromo')({
                    action: 'create', code: code, percentOff: pct, minSubtotal: min
                });
                msg.style.color = '#065f46';
                msg.innerHTML = '✅ <strong>' + promoEsc(res.data.code) + '</strong> is live (' + pct + '% off). Share it everywhere!';
                $('promoCodeInput').value = '';
                flash('Promo code ' + res.data.code + ' minted — share it on WhatsApp! 🎉', 'success');
            } catch (e) {
                msg.style.color = '#b91c1c';
                msg.textContent = e && e.message ? e.message : 'Could not mint that code.';
            }
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Mint code';
            refreshPromoList();
        });
    }


    /* ================== SHOP PLAN (rent) — Phase 2 ================== */

    var PLAN_DAYS = { monthly: 30, quarterly: 91, yearly: 365 };
    var PLAN_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };
    var billingCfg = null;        // settings/storeBilling (public read) or defaults
    var pickedTier = 'monthly';   // which plan tier is selected in the grid
    var planHintOnTrial = false;  // true while the seller is on a free trial (changes the payment hint)

    function defaultBilling() { return { monthly: 50, quarterly: 135, yearly: 480, graceDays: 3, requirePayment: false }; }

    async function loadBillingConfig() {
        billingCfg = defaultBilling();
        try {
            var snap = await firebaseDB.collection('settings').doc('storeBilling').get();
            if (snap.exists) {
                var d = snap.data();
                ['monthly', 'quarterly', 'yearly'].forEach(function (k) { if (isFinite(Number(d[k]))) billingCfg[k] = Number(d[k]); });
                if (isFinite(Number(d.graceDays))) billingCfg.graceDays = Math.floor(Number(d.graceDays));
                billingCfg.requirePayment = d.requirePayment === true;
            }
        } catch (e) { console.warn('billing config load failed:', e && e.message); }
        return billingCfg;
    }

    function planTierSavings() {
        // a plain-words "you save X%" nudge vs paying month by month
        if (!billingCfg) return {};
        var m = billingCfg.monthly;
        return {
            quarterly: m > 0 ? Math.max(0, Math.round((1 - billingCfg.quarterly / (3 * m)) * 100)) : 0,
            yearly: m > 0 ? Math.max(0, Math.round((1 - billingCfg.yearly / (12 * m)) * 100)) : 0
        };
    }

    /* ---- Shop plan countdown card: repaints once a minute, reads nothing new ---- */
    var _planCountdownTimer = null;
    function renderPlanCountdown(store) {
        var el = $('planCountdown');
        if (!el || !billingCfg) return;
        if (_planCountdownTimer) { clearInterval(_planCountdownTimer); _planCountdownTimer = null; }
        var plan = store && store.plan ? store.plan : null;
        var rules = {
            rentOn: billingCfg.requirePayment === true,
            graceDays: billingCfg.graceDays,
            storeLive: !!(store && store.isActive === true),
            freeForLife: !!(store && store.freeForLife === true)
        };
        function paint() {
            try {
                var v = smPlanCountdown(plan, Object.assign({ nowMs: Date.now() }, rules));
                el.className = 'mstore-countdown tone-' + v.tone;
                el.style.display = 'block';
                // The card is now the single source of truth: hide the older one-line status
                // sentence (its text stays in the page, and returns if the card cannot paint).
                var oldLine = $('planStatusLine');
                if (oldLine) oldLine.style.display = 'none';
                var bar = v.barLabel
                    ? '<div class="mstore-cd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v.barPct +
                      '" aria-label="' + esc(v.barLabel) + '"><div class="mstore-cd-fill" style="width:' + v.barPct + '%"></div></div>' +
                      '<div class="mstore-cd-barlabel">' + esc(v.barLabel) + '</div>'
                    : '';
                el.innerHTML =
                    '<div class="mstore-cd-top">' +
                        '<span class="mstore-cd-badge">' + esc(v.typeLabel) + '</span>' +
                        '<span class="mstore-cd-badge mstore-cd-state">' + esc(v.stateLabel) + '</span>' +
                    '</div>' +
                    '<div class="mstore-cd-big">' + esc(v.big) + '</div>' +
                    (v.detail ? '<div class="mstore-cd-detail">' + esc(v.detail) + '</div>' : '') +
                    (v.ends ? '<div class="mstore-cd-detail">' + esc(v.ends) + '</div>' : '') +
                    bar +
                    (v.explainer ? '<div class="mstore-cd-explain">' + esc(v.explainer) + '</div>' : '');
            } catch (e) {
                el.style.display = 'none';   // decoration only: never break the plan card
                var fallbackLine = $('planStatusLine');
                if (fallbackLine) fallbackLine.style.display = '';
            }
        }
        paint();
        _planCountdownTimer = setInterval(paint, 60000);   // minute tick, no Firestore reads
    }

    function renderPlanCard(store) {
        if (!billingCfg) return;
        var statusEl = $('planStatusLine');
        var tiersEl = $('planTiers');
        var hintEl = $('planHint');
        if (!statusEl) return;
        renderPlanCountdown(store);
        if (store && store.freeForLife === true) {
            // Free for life: no tiers and no payment hint.
            if (tiersEl) tiersEl.innerHTML = '';
            if (hintEl) hintEl.textContent = '';
            statusEl.textContent = '';
            return;
        }

        var plan = store && store.plan ? store.plan : null;
        var endsMs = plan && plan.endsAt ? new Date(plan.endsAt).getTime() : 0;
        var nowMs = Date.now();
        var daysLeft = endsMs > nowMs ? Math.ceil((endsMs - nowMs) / 86400000) : 0;
        planHintOnTrial = !!(plan && endsMs > nowMs && (plan.trial === true || plan.method === 'trial'));
        // Banked days: paid while rent was OFF — they start counting only when
        // Sankofa switches billing on (the server freezes them so they cannot
        // burn on the clock — see smFreezeRunningPlans).
        var bankedDays = plan ? Math.max(0, Math.round(Number(plan.bankedDays) || 0)) : 0;
        // Trial plans are granted free by the admin ("charge approved shops") —
        // never called "paid", never banked, always explained as a gift.
        var isTrialPlan = !!(plan && (plan.trial === true || plan.method === 'trial'));

        // Status line — honest about which world we're in (free launch vs paid)
        if (!billingCfg.requirePayment) {
            if (bankedDays > 0) {
                statusEl.innerHTML = '🎉 <strong>FREE launch period.</strong> You have <strong>' + bankedDays + ' paid day' + (bankedDays === 1 ? '' : 's') + ' banked</strong> — they start counting only when Sankofa switches billing on. Nothing to do; your shop stays live.';
            } else if (plan && daysLeft > 0) {
                statusEl.innerHTML = '🎉 <strong>FREE launch period</strong> — and you also have a paid <strong>' + esc(PLAN_LABELS[plan.tier] || '') + '</strong> plan banked until <strong>' + new Date(endsMs).toLocaleDateString('en-GB') + '</strong> (' + daysLeft + ' days left). It starts counting when billing begins.';
            } else {
                statusEl.innerHTML = '🎉 <strong>FREE launch period.</strong> Your shop runs on Sankofa\'s approval — no rent due. Want to support us and bank days for later? Pre-pay below; days start counting only when billing begins.';
            }
        } else if (isTrialPlan && daysLeft > 0) {
            statusEl.innerHTML = '🎁 <strong>Free trial</strong> — your shop is LIVE until <strong>' + new Date(endsMs).toLocaleDateString('en-GB') + '</strong> (' + daysLeft + ' days left). Pick a plan below to keep it open; nothing you built is lost either way.';
        } else if (plan && daysLeft > 0) {
            statusEl.innerHTML = '✅ <strong>' + esc(PLAN_LABELS[plan.tier] || 'Plan') + '</strong> plan active — your shop is LIVE until <strong>' + new Date(endsMs).toLocaleDateString('en-GB') + '</strong> (' + daysLeft + ' days left). Renewing stacks on top.';
        } else if (plan && bankedDays > 0) {
            // Mid-transition (rent just switched on) — the server starts banked days within the hour
            statusEl.innerHTML = '⏳ You have <strong>' + bankedDays + ' banked day' + (bankedDays === 1 ? '' : 's') + '</strong> — they start counting now and your new end date appears within the hour.';
        } else if (plan) {
            // Plan ran out. If the admin kept the shop on (or approved it), say so honestly
            // instead of telling a live seller their shop needs paying to reopen.
            var keptLive = !!(store && store.isActive === true);
            if (isTrialPlan) {
                statusEl.innerHTML = keptLive
                    ? '💤 Your free trial ended — your shop is still <strong>LIVE</strong> during the grace days. Pick a plan below to keep it open.'
                    : '💤 Your free trial ended — pick a plan below and your shop reopens instantly at the same address.';
            } else {
                statusEl.innerHTML = keptLive
                    ? '💤 Your paid plan ended — but your shop is still <strong>LIVE</strong> (Sankofa approved it directly). Nothing is in a hurry; a renewal would simply stack new days on top.'
                    : '💤 Your plan ended' + (billingCfg.graceDays > 0 ? ' (plus ' + billingCfg.graceDays + ' grace days)' : '') + ' — renew now and your shop reopens instantly at the same address.';
            }
        } else {
            // No plan at all. Two very different worlds:
            //  • shop already live (admin approved it) → it does NOT need a plan
            //  • shop not live yet → a plan is one way to open it
            var liveNow = !!(store && store.isActive === true);
            statusEl.innerHTML = liveNow
                ? '✅ Your shop is <strong>LIVE</strong> — no rent due right now. Sankofa approved your shop directly, so you don\'t need a plan to stay open. The plans below are optional: pre-paying simply banks days for later.'
                : '⏱️ No paid plan yet — pick one below to open (or reopen) your shop instantly.';
        }

        var save = planTierSavings();
        tiersEl.innerHTML = ['monthly', 'quarterly', 'yearly'].map(function (t) {
            var saveHtml = (save[t] || 0) >= 5 ? '<span class="tier-save">save ' + save[t] + '%</span>' : '';
            return '<div class="mstore-plan-tier' + (t === pickedTier ? ' active' : '') + '" data-tier="' + t + '">' +
                '<div class="tier-name">' + PLAN_LABELS[t] + '</div>' +
                '<div class="tier-price">GHS ' + Number(billingCfg[t]).toLocaleString() + '</div>' +
                '<div class="tier-days">' + PLAN_DAYS[t] + ' days</div>' +
                saveHtml +
                '</div>';
        }).join('');
        tiersEl.querySelectorAll('.mstore-plan-tier').forEach(function (el) {
            el.addEventListener('click', function () {
                pickedTier = el.getAttribute('data-tier');
                tiersEl.querySelectorAll('.mstore-plan-tier').forEach(function (x) { x.classList.toggle('active', x === el); });
                updatePlanHint();
            });
        });
        updatePlanHint();
    }

    function updatePlanHint() {
        var hintEl = $('planHint');
        if (!hintEl || !billingCfg) return;
        var what = billingCfg.requirePayment
            ? (planHintOnTrial
                ? ' days to your shop, counted from the day you pay. Any free-trial days left are replaced'
                : ' days to your shop (on top of any days left)')
            : ' days to your bank — the clock starts only when Sankofa switches billing on, so nothing burns while the launch is free';
        hintEl.textContent = 'Paying GHS ' + Number(billingCfg[pickedTier]).toLocaleString() + ' adds ' + PLAN_DAYS[pickedTier] +
            what + '. Wallet is instant + free; Card/MoMo goes through Paystack.';
    }

    function setPlanButtons(disabled, label) {
        var w = $('payPlanWalletBtn'), p = $('payPlanPaystackBtn');
        if (!w || !p) return;
        w.disabled = disabled; p.disabled = disabled;
        if (label) { w.innerHTML = label; } else { w.innerHTML = '<i class="fas fa-wallet"></i> Pay with Wallet'; }
    }

    async function refreshStoreAndPlan() {
        var snap = await firebaseDB.collection('stores').doc(myUid).get();
        existingStore = snap.exists ? snap.data() : null;
        renderStatus(existingStore);
        renderShare(existingStore);
        renderPlanCard(existingStore);
    }

    /** 👛 wallet path */
    async function payPlanWithWallet() {
        if (!myUid || !billingCfg) return;
        setPlanButtons(true, '<i class="fas fa-circle-notch fa-spin"></i> Paying…');
        try {
            var res = await firebase.functions().httpsCallable('payStorePlanWithWallet')({ tier: pickedTier });
            await refreshStoreAndPlan();
            flash('🏪 Paid! Your shop is LIVE until ' + new Date(res.data.endsAt).toLocaleDateString('en-GB') + ' — new wallet balance GHS ' + Number(res.data.balance).toLocaleString(), 'success');
        } catch (err) {
            console.error('wallet plan pay failed:', err);
            var msg = (err && err.message) || 'Payment failed — try again.';
            if (/Top up/i.test(msg)) {
                msg += ' 👉 Open Dashboard → Wallet to top up.';
            }
            flash(msg, 'error');
        } finally { setPlanButtons(false); }
    }

    /** 💳 Paystack popup (script loaded lazily — saves data on every other visit) */
    var _paystackKeyPromise = null;
    function loadPaystackReady() {
        if (_paystackKeyPromise) return _paystackKeyPromise;
        _paystackKeyPromise = (async function () {
            // 1. the popup script (only downloaded when someone actually pays)
            if (typeof PaystackPop === 'undefined') {
                await new Promise(function (resolve, reject) {
                    var s = document.createElement('script');
                    s.src = 'https://js.paystack.co/v1/inline.js';
                    s.onload = resolve;
                    s.onerror = function () { reject(new Error('Could not load the payment window — check your data connection and try again.')); };
                    document.head.appendChild(s);
                });
            }
            // 2. the public key (same source as the checkout page)
            try {
                var d = null, ps = null;
                try { d = await firebaseDB.collection('settings').doc('premium').get({ source: 'server' }); } catch (e) { try { d = await firebaseDB.collection('settings').doc('premium').get(); } catch (e2) {} }
                if (d && d.exists && d.data().paystackPublicKey) return d.data().paystackPublicKey;
                try { ps = await firebaseDB.collection('settings').doc('paystack').get({ source: 'server' }); } catch (e) { try { ps = await firebaseDB.collection('settings').doc('paystack').get(); } catch (e2) {} }
                if (ps && ps.exists && (ps.data().publicKey || ps.data().paystackPublicKey)) return ps.data().publicKey || ps.data().paystackPublicKey;
            } catch (e) {}
            return 'pk_test_c5ec8098c42f62cef3a9b31a86ff0d87cb98321c'; // test key fallback (same as checkout)
        })().catch(function (e) { _paystackKeyPromise = null; throw e; });
        return _paystackKeyPromise;
    }

    async function payPlanWithPaystack() {
        if (!myUid || !billingCfg) return;
        setPlanButtons(true);
        var pb = $('payPlanPaystackBtn');
        var origHtml = pb.innerHTML;
        pb.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Opening Paystack…';
        var me = null;
        try { me = firebase.auth().currentUser; } catch (e) {}
        try {
            var key = await loadPaystackReady();
            var amountPesewas = Math.round(Number(billingCfg[pickedTier]) * 100);
            var reference = 'STORE-' + pickedTier.toUpperCase() + '-' + myUid.slice(0, 6) + '-' + Date.now();
            var storeName = existingStore && existingStore.storeName ? existingStore.storeName : 'Vendor shop';
            var handler = PaystackPop.setup({
                key: key,
                email: (me && me.email) || 'shop@sankofa-market.web.app',
                amount: amountPesewas,
                currency: 'GHS',
                ref: reference,
                metadata: {
                    custom_fields: [
                        { display_name: 'Shop plan', variable_name: 'store_plan', value: PLAN_LABELS[pickedTier] },
                        { display_name: 'Store', variable_name: 'store_name', value: storeName }
                    ]
                },
                callback: function (response) {
                    pb.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Verifying…';
                    firebase.functions().httpsCallable('verifyStorePlanPayment')({ reference: response.reference, tier: pickedTier })
                        .then(function (res) {
                            refreshStoreAndPlan().then(function () {
                                flash('🏪 Paid! Your shop is LIVE until ' + new Date(res.data.endsAt).toLocaleDateString('en-GB'), 'success');
                            });
                        })
                        .catch(function (err) {
                            console.error('verify failed:', err);
                            flash('Payment sent but verification hiccuped: ' + ((err && err.message) || err) + ' — if money was taken it resolves itself shortly; reference ' + response.reference, 'warning');
                        })
                        .finally(function () { setPlanButtons(false); pb.innerHTML = origHtml; });
                },
                onClose: function () {
                    flash('Paystack closed — no payment made', 'warning');
                    setPlanButtons(false); pb.innerHTML = origHtml;
                }
            });
            handler.openIframe();
            pb.innerHTML = origHtml;
        } catch (err) {
            console.error('paystack plan pay failed:', err);
            flash((err && err.message) || 'Could not open the payment window.', 'error');
            setPlanButtons(false); pb.innerHTML = origHtml;
        }
    }

    function wirePlanButtons() {
        var w = $('payPlanWalletBtn'), p = $('payPlanPaystackBtn');
        if (w) w.addEventListener('click', payPlanWithWallet);
        if (p) p.addEventListener('click', payPlanWithPaystack);
    }

    function showSignedInAs(user) {
        var el = $('myStoreSignedInAs');
        if (!el) return;
        var who = (user && (user.email || user.displayName)) || 'your account';
        el.innerHTML = '<p style="font-size:0.8rem;color:#5a6572;margin-top:0.25rem;">Signed in as <strong>' + esc(who) + '</strong></p>';
    }

    function start() {
        renderThemeSwatches();
        renderColorMixer();
        renderTextModePicker();
        renderBannerLook();
        renderAdvancedPanel();
        setAdvMode(false);   // Simple presets first — Advanced is opt-in
        renderStatus(null);
        refreshPreview();

        ['storeNameInput', 'storeSlugInput', 'storeBioInput'].forEach(function (id) {
            $(id).addEventListener('input', refreshPreview);
        });
        $('storePhoneInput').addEventListener('input', refreshPreview);

        $('logoInput').addEventListener('change', function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;
            readAndShrinkLogo(file, 400).then(function (dataUrl) {
                logoDataUrl = dataUrl;
                refreshPreview();
            }).catch(function () {
                flash('Could not read that image — try another one.', 'error');
            });
        });

        $('bannerInput').addEventListener('change', function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;
            readAndShrinkLogo(file, 1000).then(function (dataUrl) {
                bannerDataUrl = dataUrl;
                var pv = $('bannerPreview');
                if (pv) pv.innerHTML = '<img src="' + dataUrl + '" alt="banner">';
                refreshPreview();
            }).catch(function () {
                flash('Could not read that image — try another one.', 'error');
            });
        });

        $('saveStoreBtn').addEventListener('click', saveStore);
        $('copyStoreUrlBtn').addEventListener('click', function () {
            var url = $('myStoreUrl').textContent;
            var done = function () { flash('Shop link copied! 📋', 'success'); };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(done).catch(done);
            } else {
                var ta = document.createElement('textarea');
                ta.value = url;
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); } catch (e) {}
                ta.remove();
                done();
            }
        });

        var auth = (typeof firebaseAuth !== 'undefined' && firebaseAuth) ? firebaseAuth : (firebase.auth ? firebase.auth() : null);
        if (!auth) { setTimeout(start, 300); return; }

        auth.onAuthStateChanged(function (user) {
            if (!user) {
                window.location.href = '../../pages/auth/login.html?redirect=' +
                    encodeURIComponent(window.location.pathname + window.location.search);
                return;
            }
            myUid = user.uid;
            showSignedInAs(user);
            wirePlanButtons();
            // The plan card depends on BOTH the shop and the billing settings — and
            // settings usually arrive LAST. Re-paint once they land, or a seller can
            // be shown "FREE launch period" for a moment even when rent is ON
            // (renderPlanCard runs first with the default config otherwise).
            loadBillingConfig().then(function () {
                if (_storeDocLoaded) renderPlanCard(existingStore);
            });

            firebaseDB.collection('stores').doc(user.uid).get().then(function (snap) {
                existingStore = snap.exists ? snap.data() : null;
                _storeDocLoaded = true;
                renderStatus(existingStore);
                renderShare(existingStore);
                if (existingStore) {
                    fillForm(existingStore);
                } else {
                    // Pre-fill a friendly default from their profile name
                    var base = (user.displayName || (user.email || '').split('@')[0] || '').trim();
                    if (base) $('storeNameInput').placeholder = 'e.g. ' + base + "'s Shop";
                    // Suggest their account email as the shop contact (a hint only —
                    // nothing is saved unless they leave it in the box)
                    if (user.email && $('storeEmailInput')) $('storeEmailInput').placeholder = 'e.g. ' + user.email;
                    refreshPreview();
                }
                renderPlanCard(existingStore);
                renderChecklist(existingStore);
                renderStatsCard();
                wirePromoForm();
                refreshPromoList();
            }).catch(function (e) {
                console.warn('my-store load failed:', e && e.message);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
