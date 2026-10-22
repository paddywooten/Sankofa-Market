/**
 * Sankofa Market — shops directory (js/shops.js)
 * One public query of ACTIVE storefronts, then instant client-side search.
 * Data-light: 1 read total, no pagination until the directory outgrows 60 shops.
 */
(function () {
    'use strict';

    var THEMES = {
        ocean: { c1: '#0064d2', c2: '#004a99' }, gold: { c1: '#f5af02', c2: '#e09e00' },
        forest: { c1: '#16a34a', c2: '#0e6e33' }, ruby: { c1: '#dc2626', c2: '#991b1b' },
        plum: { c1: '#7c3aed', c2: '#5b21b6' }, night: { c1: '#131f47', c2: '#0a1024' }
    };

    var _all = [];

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function shopCardHtml(s) {
        var t = THEMES[s.theme] || THEMES.ocean;
        var logo = (s.logoThumbUrl || s.logoUrl)
            ? '<img src="' + esc(s.logoThumbUrl || s.logoUrl) + '" alt="" loading="lazy">'
            : esc((s.storeName || '?').charAt(0).toUpperCase());
        var loc = s.location ? '<span><i class="fas fa-map-marker-alt"></i> ' + esc(s.location) + '</span>' : '';
        return '' +
            '<a class="shop-card" href="/store/' + esc(s.slug) + '" data-search="' + esc([s.storeName, s.slug, s.location, s.bio, s.announcement].join(' ').toLowerCase()) + '">' +
                '<div class="shop-card-band" style="--sh-c1:' + t.c1 + ';--sh-c2:' + t.c2 + ';">' +
                    '<div class="shop-card-logo">' + logo + '</div>' +
                '</div>' +
                '<div class="shop-card-body">' +
                    '<h3>' + esc(s.storeName || 'Shop') + '</h3>' +
                    (s.bio ? '<p>' + esc(s.bio) + '</p>' : '') +
                    '<div class="shop-card-meta">' + loc + '<span><i class="fas fa-arrow-right"></i> visit shop</span></div>' +
                '</div>' +
            '</a>';
    }

    function render(list) {
        var grid = document.getElementById('shopsGrid');
        var count = document.getElementById('shopsCount');
        if (count) count.textContent = list.length + (list.length === 1 ? ' shop' : ' shops');
        if (!list.length) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2.5rem;color:#767676;">' +
                '<i class="fas fa-store-slash" style="font-size:1.8rem;color:#d1d5db;display:block;margin-bottom:0.5rem;"></i>' +
                'No shops match. Try another word — or <a href="/pages/user/my-store.html" style="color:#0064d2;font-weight:600;">open the first one</a>!</div>';
            return;
        }
        grid.innerHTML = list.map(shopCardHtml).join('');
    }

    function applySearch() {
        var q = (document.getElementById('shopsSearch').value || '').trim().toLowerCase();
        if (!q) { render(_all); return; }
        var words = q.split(/\s+/).filter(Boolean);
        render(_all.filter(function (s) {
            var hay = [s.storeName, s.slug, s.location, s.bio, s.announcement].join(' ').toLowerCase();
            return words.every(function (w) { return hay.indexOf(w) !== -1; });
        }));
    }

    async function load() {
        var grid = document.getElementById('shopsGrid');
        try {
            var tries = 0;
            while ((typeof firebaseDB === 'undefined' || !firebaseDB) && tries < 40) {
                await new Promise(function (r) { setTimeout(r, 100); });
                tries++;
            }
            if (typeof firebaseDB === 'undefined' || !firebaseDB) throw new Error('offline');
            // Public rule: only ACTIVE shops are visible to anyone — including visitors
            var snap = await firebaseDB.collection('stores')
                .where('isActive', '==', true)
                .limit(60)
                .get();
            _all = [];
            snap.forEach(function (d) { _all.push(d.data()); });
            _all.sort(function (a, b) { return String(a.storeName || '').localeCompare(String(b.storeName || '')); });
            render(_all);
        } catch (e) {
            console.warn('shops directory failed:', e && e.message);
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#767676;">Could not load shops right now — check your connection and refresh.</div>';
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        load();
        var timer = null;
        document.getElementById('shopsSearch').addEventListener('input', function () {
            if (timer) clearTimeout(timer);
            timer = setTimeout(applySearch, 150);
        });
    });
})();
