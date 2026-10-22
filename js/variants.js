/* ============================================================================
   VARIANTS — sizes and colours a buyer chooses from (Sankofa Store items)
   ---------------------------------------------------------------------------
   A seller lists up to two kinds of choice on a listing, for example
     [{ name: 'Size', options: ['S','M','L'] }, { name: 'Colour', options: ['Red','Blue'] }]
   A buyer picks one of each. The pick is stored on the cart row and on the order item as
     { Size: 'M', Colour: 'Red' }
   Variants do NOT change the price and do NOT have their own stock or photos. The price is
   checked against the listing, and the choice is checked against the listing's options, by
   the SERVER when money moves (VARIANT CORE in functions/index.js mirrors these rules).

   Loaded before js/cart-prices.js, js/cart.js, js/payment.js and js/publish.js.
   ========================================================================== */

/* === VARIANT CORE START === */
/* Pure helpers — extracted by variants-test.mjs. No page, no network in here. */
var VARIANT_MAX_GROUPS = 2;
var VARIANT_MAX_OPTIONS = 20;
var VARIANT_NAME_MAX = 20;
var VARIANT_OPTION_MAX = 24;

/** Cleans the kinds of choice a seller typed. Returns { groups, problems }. Empty rows are ignored. */
function variantNormalizeGroups(raw) {
    var problems = [];
    var groups = [];
    var list = Array.isArray(raw) ? raw : [];
    if (list.length > VARIANT_MAX_GROUPS) {
        problems.push('Choose at most ' + VARIANT_MAX_GROUPS + ' kinds of choice (for example Size and Colour).');
    }
    var seenNames = {};
    list.slice(0, VARIANT_MAX_GROUPS).forEach(function (g) {
        var name = String((g && g.name) || '').replace(/\s+/g, ' ').trim();
        var rawOpts = (g && Array.isArray(g.options)) ? g.options : [];
        var opts = [];
        var seenOpts = {};
        var badOption = false;
        rawOpts.forEach(function (o) {
            var v = String(o == null ? '' : o).replace(/\s+/g, ' ').trim();
            if (!v) return;
            if (v.length > VARIANT_OPTION_MAX) {
                problems.push('"' + v.slice(0, 24) + '" is too long (' + VARIANT_OPTION_MAX + ' characters at most).');
                badOption = true;
                return;
            }
            var k = v.toLowerCase();
            if (seenOpts[k]) return;
            seenOpts[k] = true;
            opts.push(v);
        });
        if (badOption) return;                                    // the problem is already reported for this row
        if (!name && !opts.length) return;                       // an empty row is simply ignored
        if (!name) { problems.push('Give each row a name, for example Size or Colour.'); return; }
        if (name.length > VARIANT_NAME_MAX) {
            problems.push('"' + name.slice(0, 20) + '" is too long for a name (' + VARIANT_NAME_MAX + ' characters at most).');
            return;
        }
        if (seenNames[name.toLowerCase()]) { problems.push('"' + name + '" is used twice.'); return; }
        seenNames[name.toLowerCase()] = true;
        if (!opts.length) { problems.push('Add at least one choice for ' + name + '.'); return; }
        if (opts.length > VARIANT_MAX_OPTIONS) { problems.push(name + ' has more than ' + VARIANT_MAX_OPTIONS + ' choices.'); return; }
        groups.push({ name: name, options: opts });
    });
    return { groups: problems.length ? [] : groups, problems: problems };
}

/** A clean copy of a choice: only the listing's own kinds, as text. null when there is no choice. */
function variantClean(groups, variant) {
    var out = {};
    (groups || []).forEach(function (g) {
        if (variant && variant[g.name] != null && String(variant[g.name]) !== '') out[g.name] = String(variant[g.name]);
    });
    return Object.keys(out).length ? out : null;
}

/** Is this choice right for these kinds? Returns a short problem for the buyer, or '' when it is right. */
function variantProblem(groups, variant) {
    var gs = Array.isArray(groups) ? groups : [];
    var v = (variant && typeof variant === 'object') ? variant : null;
    if (!gs.length) return (v && Object.keys(v).length) ? 'this item has no choices' : '';
    var missing = [];
    var bad = [];
    gs.forEach(function (g) {
        var val = v ? v[g.name] : undefined;
        if (val === undefined || val === null || String(val) === '') { missing.push(g.name); return; }
        if (g.options.indexOf(String(val)) === -1) bad.push(g.name + ' "' + String(val) + '" is no longer available');
    });
    var extra = v ? Object.keys(v).filter(function (k) { return !gs.some(function (g) { return g.name === k; }); }) : [];
    if (bad.length) return bad.join(', ');
    if (missing.length) return 'choose ' + missing.map(function (n) { return 'a ' + n.toLowerCase(); }).join(' and ');
    if (extra.length) return 'this item has no ' + extra.join(', ');
    return '';
}

/** A stable text key for a choice, in the listing's own order of kinds. '' when there is no choice. */
function variantKey(groups, variant) {
    var gs = Array.isArray(groups) ? groups : [];
    if (!variant) return '';
    return gs.filter(function (g) { return variant[g.name] != null && String(variant[g.name]) !== ''; })
             .map(function (g) { return encodeURIComponent(g.name) + '=' + encodeURIComponent(String(variant[g.name])); })
             .join('&');
}

/** 'Size: M, Colour: Red' — for people to read. '' when there is no choice. */
function variantLabel(variant) {
    if (!variant) return '';
    return Object.keys(variant).map(function (k) { return k + ': ' + variant[k]; }).join(', ');
}

/** The cart row id: the product id, plus the choice when there is one (so M and L are two rows). */
function variantRowId(productId, groups, variant) {
    var k = variantKey(groups, variant);
    return String(productId) + (k ? '#' + k : '');
}
/** One line for a product page: what the seller offers ("Size: S, M, L · Colour: Red, Blue"). '' when none. */
function variantsInfoText(groups) {
    if (!Array.isArray(groups) || !groups.length) return '';
    return groups.map(function (g) { return g.name + ': ' + g.options.join(', '); }).join(' · ');
}
/* === VARIANT CORE END === */

/** Escapes text for HTML. */
function variantEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Draws the choice buttons into `host` (one row per kind). onChange(choice) runs every time the
 * buyer taps; choice is the full choice once every kind is picked, otherwise null.
 */
function variantRenderPicker(host, groups, initial, onChange) {
    var chosen = variantClean(groups, initial) || {};
    host.innerHTML = '';
    (groups || []).forEach(function (g) {
        var row = document.createElement('div');
        row.className = 'variant-group';
        var label = document.createElement('div');
        label.className = 'variant-label';
        label.textContent = g.name;
        row.appendChild(label);
        var chips = document.createElement('div');
        chips.className = 'variant-chips';
        chips.setAttribute('role', 'group');
        chips.setAttribute('aria-label', g.name);
        g.options.forEach(function (opt) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'variant-chip';
            b.textContent = opt;
            b.setAttribute('aria-pressed', chosen[g.name] === opt ? 'true' : 'false');
            b.addEventListener('click', function () {
                chosen[g.name] = opt;
                chips.querySelectorAll('.variant-chip').forEach(function (x) {
                    x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
                });
                var complete = (groups || []).every(function (gg) { return !!chosen[gg.name]; });
                if (typeof onChange === 'function') onChange(complete ? variantClean(groups, chosen) : null);
            });
            chips.appendChild(b);
        });
        row.appendChild(chips);
        host.appendChild(row);
    });
    if (groups && groups.length && typeof onChange === 'function') {
        onChange(((groups || []).every(function (gg) { return !!chosen[gg.name]; })) ? variantClean(groups, chosen) : null);
    }
}

/** Reads the seller's two editor rows (publish.html). Returns { groups, problems }. */
function variantEditorRead() {
    var rows = [1, 2].map(function (i) {
        var n = document.getElementById('variantName' + i);
        var o = document.getElementById('variantOptions' + i);
        return { name: n ? n.value : '', options: o ? String(o.value || '').split(',') : [] };
    });
    return variantNormalizeGroups(rows);
}

/** Fills the seller's editor rows from saved kinds (used when a draft is restored). */
function variantEditorFill(groups) {
    [1, 2].forEach(function (i) {
        var g = (groups || [])[i - 1];
        var n = document.getElementById('variantName' + i);
        var o = document.getElementById('variantOptions' + i);
        if (n) n.value = g ? g.name : '';
        if (o) o.value = g ? g.options.join(', ') : '';
    });
}

/* Styles for the picker (added once, so no stylesheet change is needed on each page). */
(function variantsStyles() {
    if (typeof document === 'undefined' || !document.head || document.getElementById('sm-variants-css')) return;
    var css = '.variant-group{margin:0 0 0.7rem;}' +
        '.variant-label{font-weight:800;font-size:0.85rem;color:#191919;margin:0 0 0.35rem;}' +
        '.variant-chips{display:flex;flex-wrap:wrap;gap:0.4rem;}' +
        '.variant-chip{min-height:40px;min-width:44px;padding:0.4rem 0.8rem;border-radius:999px;border:1.5px solid #d1d5db;background:#fff;color:#191919;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:inherit;}' +
        '.variant-chip[aria-pressed="true"]{background:#0064d2;border-color:#0064d2;color:#fff;}' +
        '.variant-chip:focus-visible{outline:3px solid #f5af02;outline-offset:2px;}';
    var st = document.createElement('style');
    st.id = 'sm-variants-css';
    st.textContent = css;
    document.head.appendChild(st);
})();
