/**
 * Sankofa Market — Seed Listings engine (js/admin-seed.js)
 * =========================================================
 * Two admin tools, one file:
 *   ⚡ QUICK-LIST — for the WhatsApp vendor: paste their photo + one line of
 *      details, publish a live listing under their account (or Sankofa Store)
 *      in under a minute. This is how founding sellers get carried in.
 *   📊 CSV BULK IMPORT — a wholesaler's catalogue pasted as rows → preview →
 *      hundreds of Sankofa Store listings in one go (no photos, so it stays
 *      light; placeholder art until a real photo is attached).
 *
 * Everything heavy (photo shrink, CSV parse, row validation) is local in the
 * browser; the only network work is the final Firestore write.
 */

/* === SEED CORE START (pure helpers — unit-tested, no DOM/Firebase) === */

/** Known categories for seed imports (ids mirror the home-page list). */
var SM_SEED_CATEGORIES = {
    electronics: 1, fashion: 1, 'home-garden': 1, vehicles: 1, services: 1,
    sports: 1, 'books-media': 1, 'baby-kids': 1, 'beauty-health': 1,
    'food-groceries': 1, pets: 1, 'jobs-skills': 1, 'real-estate': 1,
    'musical-instruments': 1, others: 1
};

/** Conditions a seeded row may carry (everything else falls back to 'new'). */
var SM_SEED_CONDITIONS = { new: 1, used: 1, 'like-new': 1, refurbished: 1 };

/**
 * A tiny CSV parser that survives real-world inventory lists: quoted cells,
 * commas INSIDE quotes, escaped "" quotes, Windows/Mac line endings, and a
 * stray blank line or two. Returns an array of string-arrays.
 */
function smSeedCsvParse(text) {
    var rows = [], row = [], cell = '', inQuotes = false;
    var s = String(text || '');
    // strip Excel's byte-order mark if it snuck in
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    for (var i = 0; i < s.length; i++) {
        var c = s[i];
        if (inQuotes) {
            if (c === '"') {
                if (s[i + 1] === '"') { cell += '"'; i++; }
                else inQuotes = false;
            } else cell += c;
        } else {
            if (c === '"') inQuotes = true;
            else if (c === ',') { row.push(cell); cell = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && s[i + 1] === '\n') i++;
                row.push(cell);
                cell = '';
                if (row.length > 1 || row[0].trim() !== '') rows.push(row);
                row = [];
            } else cell += c;
        }
    }
    if (cell !== '' || row.length) { row.push(cell); if (row.length > 1 || row[0].trim() !== '') rows.push(row); }
    return rows;
}

/** Tidy header cell: lowercase, spaces→underscore, no odd characters. */
function smSeedNormHeader(h) {
    return String(h || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/* Which spreadsheet column feeds which product field. */
var SM_SEED_COLUMN_MAP = {
    title: ['title', 'name', 'product', 'item', 'product_name'],
    price: ['price', 'amount', 'ghs', 'cost', 'price_ghs'],
    category: ['category', 'cat', 'type'],
    stock: ['stock', 'qty', 'quantity', 'count', 'pieces'],
    description: ['description', 'desc', 'details', 'note', 'notes'],
    condition: ['condition', 'state'],
    city: ['city', 'location', 'town', 'area']
};

/** Find the column index for a field from a header row (-1 = not present). */
function smSeedColumnIndex(header, field) {
    var aliases = SM_SEED_COLUMN_MAP[field] || [field];
    for (var i = 0; i < header.length; i++) {
        if (aliases.indexOf(smSeedNormHeader(header[i])) !== -1) return i;
    }
    return -1;
}

/**
 * Validate one spreadsheet row into a product-shaped object.
 * Returns { ok:true, value:{...} } or { ok:false, error:'plain reason' }.
 * Defaults: stock 1, condition 'new', city 'Accra', category 'others'.
 */
function smSeedRowToProduct(cells, idx) {
    var get = function (i) { return i < 0 ? '' : String(cells[i] == null ? '' : cells[i]).trim(); };
    var title = get(idx.title).replace(/\s+/g, ' ');
    if (title.length < 3) return { ok: false, error: 'title missing or under 3 letters' };
    if (title.length > 80) return { ok: false, error: 'title over 80 letters' };

    var price = Number(String(get(idx.price)).replace(/[, ]/g, ''));
    if (!isFinite(price) || price <= 0) return { ok: false, error: 'price must be a number above 0' };
    if (price > 1000000) return { ok: false, error: 'price looks too big — check it' };
    price = Math.round(price * 100) / 100;

    var cat = get(idx.category).toLowerCase().trim();
    if (!SM_SEED_CATEGORIES[cat]) cat = 'others';

    var stock = parseInt(get(idx.stock), 10);
    if (!isFinite(stock) || stock < 1) stock = 1;
    if (stock > 100000) stock = 100000;

    var cond = get(idx.condition).toLowerCase().trim();
    if (!SM_SEED_CONDITIONS[cond]) cond = 'new';

    var desc = get(idx.description).slice(0, 1000);
    if (!desc) desc = title + ' — available from Sankofa Store. Message us for details!';

    var city = get(idx.city).slice(0, 60) || 'Accra';

    return { ok: true, value: { title: title, price: price, category: cat, stock: stock, condition: cond, description: desc, city: city } };
}

/**
 * Validate the Quick-List form (single listing). Sellers come in two shapes:
 *   mode 'store'  → listed under Sankofa Store (Official)  [vendorName/Phone kept for off-app settling]
 *   mode 'vendor' → listed under an existing user account   [vendorUid required]
 */
function smSeedQuickListSanitize(d, mode) {
    var data = (d && typeof d === 'object') ? d : {};
    var title = String(data.title || '').replace(/\s+/g, ' ').trim();
    if (title.length < 3) return { ok: false, error: 'Title needs at least 3 characters.' };
    if (title.length > 80) return { ok: false, error: 'Title is too long — keep it under 80 characters.' };
    var price = Number(String(data.price == null ? '' : data.price).replace(/[, ]/g, ''));
    if (!isFinite(price) || price <= 0) return { ok: false, error: 'Price must be a number above 0.' };
    if (price > 1000000) return { ok: false, error: 'That price looks too big — double-check it.' };
    var category = String(data.category || 'others').toLowerCase();
    if (!SM_SEED_CATEGORIES[category]) category = 'others';
    var stock = parseInt(data.stock, 10);
    if (!isFinite(stock) || stock < 1) stock = 1;
    var condition = String(data.condition || 'new').toLowerCase();
    if (!SM_SEED_CONDITIONS[condition]) condition = 'new';
    var description = String(data.description || '').trim().slice(0, 1000);
    var city = String(data.city || 'Accra').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Accra';
    var vendorName = String(data.vendorName || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    var vendorPhone = String(data.vendorPhone || '').replace(/[\s\-().]/g, '').slice(0, 16);
    return {
        ok: true,
        value: {
            title: title, price: Math.round(price * 100) / 100, category: category, stock: stock,
            condition: condition, description: description, city: city,
            vendorName: vendorName, vendorPhone: vendorPhone
        }
    };
}

/**
 * Assemble the Firestore product document for a seed listing. Mirrors the
 * admin add-product schema field-for-field (plus stock + provenance).
 * images/imagesThumb arrive as {full:[], thumb:[]} from the uploader (or empties).
 */
function smSeedBuildProductDoc(clean, opts) {
    var images = (opts.images && opts.images.full) || [];
    var thumbs = (images.length && opts.images && opts.images.thumb && opts.images.thumb.length === images.length) ? opts.images.thumb : null;
    var isStore = opts.mode === 'store';
    var doc = {
        title: clean.title,
        category: clean.category,
        description: clean.description || (clean.title + ' — available now on Sankofa Market.'),
        price: clean.price,
        condition: clean.condition || 'new',
        stock: clean.stock || 1,
        location: { city: clean.city || 'Accra' },
        sellerId: opts.sellerId,
        sellerName: isStore ? 'Sankofa Store' : opts.sellerName,
        sellerEmail: opts.sellerEmail || null,
        isSankofaStore: isStore,
        isVerifiedSeller: isStore,
        isFeatured: false,
        isActive: true,
        isSold: false,
        deliveryOption: 'free-delivery',
        views: 0,
        images: images,
        photos: images,
        imagesThumb: thumbs,
        source: opts.source || 'quick-list',
        createdAt: opts.createdAt
    };
    // Off-app partner note (WhatsApp trader we settle by hand) — admin eyes only
    if (clean.vendorName || clean.vendorPhone) {
        doc.sourceVendor = { name: clean.vendorName || '', phone: clean.vendorPhone || '' };
    }
    return doc;
}

/* === SEED CORE END === */

/* ---------------------------------------------------------------------------
 * Everything below drives the admin UI (DOM + Firebase) — kept out of tests.
 * ------------------------------------------------------------------------- */

(function () {
    'use strict';

    var _qlMode = 'store';            // 'store' | 'vendor'
    var _qlPhotoDataUrl = '';         // picked photo for quick-list
    var _csvRows = [];                // validated preview rows
    var _saving = false;

    function $(id) { return document.getElementById(id); }
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function flash(msg, type) { if (typeof showFlashMessage === 'function') showFlashMessage(msg, type); }

    /* ---------------- shared: shrink + upload one photo (quick-list) ---------------- */
    function shrinkDataUrl(dataUrl, maxPx, quality) {
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
                resolve(canvas.toDataURL('image/jpeg', quality || 0.82));
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    }
    function blobOf(dataUrl) {
        var parts = dataUrl.split(',');
        var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
        var bin = atob(parts[1]);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: mime });
    }
    async function uploadSeedPhoto(uid) {
        // full (1200px) + thumb (400px), same shape the publish page produces
        var stamp = 'quicklist_' + Date.now();
        var full = await shrinkDataUrl(_qlPhotoDataUrl, 1200, 0.82);
        var thumb = await shrinkDataUrl(_qlPhotoDataUrl, 400, 0.78);
        var fullRef = firebaseStorage.ref().child('products/' + uid + '/' + stamp + '.jpg');
        await new Promise(function (res, rej) { fullRef.put(blobOf(full)).on('state_changed', null, rej, res); });
        var thumbRef = firebaseStorage.ref().child('products/' + uid + '/thumbs/' + stamp + '_thumb.jpg');
        await new Promise(function (res, rej) { thumbRef.put(blobOf(thumb)).on('state_changed', null, rej, res); });
        return { full: [await fullRef.getDownloadURL()], thumb: [await thumbRef.getDownloadURL()] };
    }

    /* ---------------- QUICK-LIST ---------------- */

    function qlSetMode(mode) {
        _qlMode = mode;
        $('qlModeStore').classList.toggle('active', mode === 'store');
        $('qlModeVendor').classList.toggle('active', mode === 'vendor');
        $('qlVendorLookup').style.display = mode === 'vendor' ? '' : 'none';
        $('qlVendorNote').style.display = mode === 'store' ? '' : 'none';
    }

    /** Find the vendor's account by email (admin may list users). */
    async function qlFindVendor(email) {
        email = String(email || '').trim().toLowerCase();
        if (!email) return null;
        var snap = await firebaseDB.collection('users').where('email', '==', email).limit(1).get();
        if (snap.empty) return null;
        var d = snap.docs[0];
        var data = d.data() || {};
        var name = data.name || ((data.firstName || '') + (data.lastName ? ' ' + data.lastName : '')).trim() || data.displayName || email;
        return { uid: d.id, name: name, email: data.email || email };
    }

    async function qlPublish() {
        if (_saving) return;
        var cleanR = smSeedQuickListSanitize({
            title: $('qlTitle').value,
            price: $('qlPrice').value,
            category: $('qlCategory').value,
            stock: $('qlStock').value,
            condition: $('qlCondition').value,
            description: $('qlDesc').value,
            city: $('qlCity').value,
            vendorName: $('qlVendorName') ? $('qlVendorName').value : '',
            vendorPhone: $('qlVendorPhone') ? $('qlVendorPhone').value : ''
        }, _qlMode);
        if (!cleanR.ok) { flash(cleanR.error, 'error'); return; }
        var clean = cleanR.value;

        var me = firebase.auth().currentUser;
        if (!me) { flash('Sign in again, please.', 'error'); return; }

        var status = $('qlStatus');
        var btn = $('qlPublishBtn');
        _saving = true;
        btn.disabled = true;
        status.textContent = '';

        try {
            var seller = { uid: me.uid, name: 'Sankofa Store', email: me.email };
            if (_qlMode === 'vendor') {
                status.textContent = 'Finding the vendor account…';
                var email = $('qlVendorEmail').value;
                var found = await qlFindVendor(email);
                if (!found) {
                    flash('No account with email "' + email + '". Ask the vendor to sign up first (or list it under Sankofa Store for now).', 'error');
                    status.textContent = '';
                    _saving = false; btn.disabled = false;
                    return;
                }
                seller = { uid: found.uid, name: found.name, email: found.email };
            }

            var images = { full: [], thumb: [] };
            if (_qlPhotoDataUrl) {
                status.textContent = 'Uploading the photo…';
                images = await uploadSeedPhoto(me.uid);
            }

            status.textContent = 'Publishing…';
            var doc = smSeedBuildProductDoc(clean, {
                mode: _qlMode,
                sellerId: seller.uid,
                sellerName: seller.name,
                sellerEmail: seller.email,
                images: images,
                source: 'quick-list',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            var ref = await firebaseDB.collection('products').add(doc);

            status.innerHTML = '✅ Live! <a href="/product-detail.html?id=' + ref.id + '" target="_blank" style="color:#0064d2;font-weight:700;">View the listing →</a>';
            flash(_qlMode === 'vendor'
                ? 'Listed under ' + seller.name + "'s account 🎉 (counting toward their plan's listing limit)"
                : 'Listed under Sankofa Store 🏪', 'success');
            // reset only the item bits — keep the vendor picked so a batch flies in fast
            ['qlTitle', 'qlPrice', 'qlDesc'].forEach(function (id) { $(id).value = ''; });
            _qlPhotoDataUrl = '';
            $('qlPhotoPreview').innerHTML = '<span style="color:#9aa5b1;font-size:0.8rem;">No photo</span>';
            $('qlTitle').focus();
            var n = Number(($('qlCount').textContent || '0')) + 1;
            $('qlCount').textContent = String(n);
        } catch (e) {
            console.error('quick-list failed:', e);
            flash('Could not publish: ' + (e.message || e), 'error');
            status.textContent = '';
        } finally {
            _saving = false;
            btn.disabled = false;
        }
    }

    function qlWire() {
        $('qlModeStore').addEventListener('click', function () { qlSetMode('store'); });
        $('qlModeVendor').addEventListener('click', function () { qlSetMode('vendor'); });
        $('qlPublishBtn').addEventListener('click', qlPublish);
        $('qlPhoto').addEventListener('change', function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function (ev) {
                _qlPhotoDataUrl = ev.target.result;
                $('qlPhotoPreview').innerHTML = '<img src="' + _qlPhotoDataUrl + '" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb;">';
            };
            reader.onerror = function () { flash('Could not read that image.', 'error'); };
            reader.readAsDataURL(file);
        });
        // Magic time-saver: paste a photo straight from WhatsApp Web's clipboard
        $('qlTitle').addEventListener('paste', function (e) {
            var items = (e.clipboardData || window.clipboardData || {}).items || [];
            for (var i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.indexOf('image/') === 0) {
                    var f = items[i].getAsFile();
                    if (f) {
                        var reader = new FileReader();
                        reader.onload = function (ev) {
                            _qlPhotoDataUrl = ev.target.result;
                            $('qlPhotoPreview').innerHTML = '<img src="' + _qlPhotoDataUrl + '" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb;">';
                            flash('Photo pasted from clipboard 📋✅', 'success');
                        };
                        reader.readAsDataURL(f);
                        e.preventDefault();
                    }
                }
            }
        });
    }

    /* ---------------- CSV BULK IMPORT ---------------- */

    var CSV_HINT = 'title,price,category,stock,description,condition,city';

    function csvReadInput() {
        return $('csvText').value || '';
    }

    function csvCheck() {
        var wrap = $('csvPreviewWrap');
        var rows = smSeedCsvParse(csvReadInput());
        if (!rows.length) { wrap.style.display = 'none'; flash('Nothing to check — paste the catalogue rows first.', 'warning'); return; }
        var header = rows[0].map(smSeedNormHeader);
        var hasHeader = header.indexOf('title') !== -1 && smSeedColumnIndex(rows[0], 'price') !== -1;
        var dataRows = hasHeader ? rows.slice(1) : rows;
        var idx = {
            title: smSeedColumnIndex(hasHeader ? rows[0] : [], 'title'),
            price: smSeedColumnIndex(hasHeader ? rows[0] : [], 'price'),
            category: smSeedColumnIndex(hasHeader ? rows[0] : [], 'category'),
            stock: smSeedColumnIndex(hasHeader ? rows[0] : [], 'stock'),
            description: smSeedColumnIndex(hasHeader ? rows[0] : [], 'description'),
            condition: smSeedColumnIndex(hasHeader ? rows[0] : [], 'condition'),
            city: smSeedColumnIndex(hasHeader ? rows[0] : [], 'city')
        };
        if (hasHeader === false) {
            flash('First line must be the header: ' + CSV_HINT, 'error');
            wrap.style.display = 'none';
            return;
        }
        if (dataRows.length > 200) {
            flash('That is ' + dataRows.length + ' rows — do it in batches of 200 so Ghana-NET does not drop your import halfway.', 'warning');
            dataRows = dataRows.slice(0, 200);
        }
        _csvRows = dataRows.map(function (cells, i) {
            var r = smSeedRowToProduct(cells, idx);
            return { n: i + 1, raw: cells, ok: r.ok, error: r.error || null, value: r.value || null };
        });
        var good = _csvRows.filter(function (r) { return r.ok; });
        var bad = _csvRows.length - good.length;
        $('csvImportBtn').disabled = good.length === 0;
        $('csvImportBtn').innerHTML = '<i class="fas fa-upload"></i> Import ' + good.length + ' item' + (good.length === 1 ? '' : 's');
        $('csvSummary').textContent = good.length + ' ready' + (bad ? ', ' + bad + ' skipped (red rows say why)' : '') + '.';
        wrap.style.display = '';
        $('csvPreviewBody').innerHTML = _csvRows.map(function (r) {
            if (!r.ok) {
                return '<tr style="background:#fef2f2;"><td>' + r.n + '</td><td colspan="3">' + esc(String(r.raw.join(' | ')).slice(0, 90)) + '</td><td style="color:#b91c1c;font-size:0.78rem;">⚠ ' + esc(r.error) + '</td></tr>';
            }
            return '<tr><td>' + r.n + '</td><td>' + esc(r.value.title) + '</td><td style="white-space:nowrap;">GHS ' + r.value.price.toLocaleString() + '</td><td>' + esc(r.value.category) + '</td><td style="color:#065f46;font-size:0.78rem;">✔</td></tr>';
        }).join('');
    }

    async function csvImport() {
        var good = _csvRows.filter(function (r) { return r.ok; });
        if (!good.length) return;
        var me = firebase.auth().currentUser;
        if (!me) { flash('Sign in again, please.', 'error'); return; }
        var btn = $('csvImportBtn');
        var prog = $('csvProgress');
        btn.disabled = true;
        var batchId = 'csv-' + Date.now();
        var total = good.length, done = 0, failed = 0;
        try {
            // Firestore batches cap at 500 writes — we stay well under at 300
            for (var off = 0; off < good.length; off += 300) {
                var chunk = good.slice(off, off + 300);
                var batch = firebaseDB.batch();
                chunk.forEach(function (r) {
                    var ref = firebaseDB.collection('products').doc();
                    batch.set(ref, smSeedBuildProductDoc(r.value, {
                        mode: 'store',
                        sellerId: me.uid,
                        sellerName: 'Sankofa Store',
                        sellerEmail: me.email,
                        images: { full: [], thumb: [] },
                        source: 'csv-import',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }));
                });
                try {
                    await batch.commit();
                    done += chunk.length;
                } catch (be) {
                    console.error('batch chunk failed:', be);
                    failed += chunk.length;
                }
                prog.textContent = 'Imported ' + done + ' of ' + total + (failed ? ' (' + failed + ' failed)' : '') + '…';
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> ' + done + '/' + total;
            }
            prog.textContent = '✅ Done: ' + done + ' listings live under Sankofa Store 🏪' + (failed ? ' — ' + failed + ' failed (try those rows again)' : '');
            flash('Bulk import: ' + done + ' listings created 🎉', done ? 'success' : 'error');
            if (done) { $('csvText').value = ''; $('csvPreviewWrap').style.display = 'none'; }
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-upload"></i> Import';
        }
    }

    function csvWire() {
        $('csvCheckBtn').addEventListener('click', csvCheck);
        $('csvImportBtn').addEventListener('click', csvImport);
        $('csvFile').addEventListener('change', function (e) {
            var f = e.target.files && e.target.files[0];
            if (!f) return;
            var reader = new FileReader();
            reader.onload = function (ev) {
                $('csvText').value = String(ev.target.result || '');
                csvCheck();
            };
            reader.onerror = function () { flash('Could not read that file.', 'error'); };
            reader.readAsText(f);
        });
        $('csvTemplateBtn').addEventListener('click', function () {
            var sample = CSV_HINT + '\nTecno Spark 20 128GB,1450,electronics,10,Brand new in box,new,Accra\nAfrican Print Dress 2-piece,350,fashion,5,Beautiful kente set,new,Kumasi';
            var done = function () { flash('Template copied 📋 — paste it to the wholesaler on WhatsApp and ask them to fill it in, or save as a .csv file.', 'success'); };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(sample).then(done).catch(done);
            else done();
        });
    }

    /* ================= TIER 3: saved stock feeds ================= */

    function feedEsc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }

    async function feedsRefresh() {
        var box = $('feedsList');
        if (!box) return;
        box.innerHTML = '<div style="font-size:0.8rem;color:#5a6572;">Loading feeds…</div>';
        try {
            var res = await firebase.functions().httpsCallable('listImportFeeds')({});
            var feeds = (res && res.data && res.data.feeds) || [];
            if (!feeds.length) {
                box.innerHTML = '<div style="font-size:0.8rem;color:#5a6572;">No feeds yet — save one above and it keeps your store prices + stock in step with the wholesaler\'s sheet, every day, by itself.</div>';
                return;
            }
            box.innerHTML = feeds.map(function (f) {
                var last = f.lastSync
                    ? ('last: ' + (f.lastSync.updated || 0) + ' updated, ' + (f.lastSync.created || 0) + ' new, ' + (f.lastSync.skipped || 0) + ' skipped')
                    : (f.lastError ? '<span style="color:#b91c1c;">⚠️ ' + feedEsc(f.lastError) + '</span>' : 'never synced yet');
                return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:1.5px solid #dbeafe;background:#f8fbff;' +
                    'border-radius:12px;padding:8px 10px;margin-top:8px;' + (f.isActive ? '' : 'opacity:.55;') + '">' +
                    '<div style="flex:1;min-width:170px;">' +
                        '<div style="font-size:0.86rem;font-weight:800;color:#131f47;">' + feedEsc(f.name) + '</div>' +
                        '<div style="font-size:0.72rem;color:#5a6572;word-break:break-all;">' + feedEsc(f.url) + '</div>' +
                        '<div style="font-size:0.74rem;color:#334155;margin-top:2px;">every ' + f.runEveryDays + ' day(s) · matches by ' + f.keyField + ' · ' + last + '</div>' +
                    '</div>' +
                    '<button class="btn btn-primary btn-small" data-feed-sync="' + feedEsc(f.id) + '"><i class="fas fa-rotate"></i> Sync now</button>' +
                    '<button class="btn btn-outline btn-small" data-feed-toggle="' + feedEsc(f.id) + '" data-on="' + (f.isActive ? '1' : '0') + '">' + (f.isActive ? 'Pause' : 'Resume') + '</button>' +
                    '<button class="btn btn-outline btn-small" data-feed-del="' + feedEsc(f.id) + '" style="color:#b91c1c;border-color:#fecaca;">✕</button>' +
                    '</div>';
            }).join('');

            box.querySelectorAll('[data-feed-sync]').forEach(function (btn) {
                btn.addEventListener('click', async function () {
                    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing…';
                    try {
                        var r = await firebase.functions().httpsCallable('runImportFeedNow')({ id: btn.getAttribute('data-feed-sync') });
                        var st = (r && r.data && r.data.stats) || {};
                        flash('Feed synced ✅ — ' + (st.updated || 0) + ' updated, ' + (st.created || 0) + ' new listings, ' + (st.skipped || 0) + ' skipped.', 'success');
                    } catch (e) {
                        flash(e && e.message ? e.message : 'Sync failed — check the sheet link.', 'error');
                    }
                    feedsRefresh();
                });
            });
            box.querySelectorAll('[data-feed-toggle]').forEach(function (btn) {
                btn.addEventListener('click', async function () {
                    btn.disabled = true;
                    try {
                        await firebase.functions().httpsCallable('saveImportFeed')({
                            action: btn.getAttribute('data-on') === '1' ? 'stop' : 'start', id: btn.getAttribute('data-feed-toggle')
                        });
                    } catch (e) { flash(e && e.message ? e.message : 'Could not change that feed.', 'error'); }
                    feedsRefresh();
                });
            });
            box.querySelectorAll('[data-feed-del]').forEach(function (btn) {
                btn.addEventListener('click', async function () {
                    if (!confirm('Delete this feed? (Listings it already created stay untouched.)')) return;
                    btn.disabled = true;
                    try {
                        await firebase.functions().httpsCallable('saveImportFeed')({ action: 'delete', id: btn.getAttribute('data-feed-del') });
                    } catch (e) { flash(e && e.message ? e.message : 'Could not delete.', 'error'); }
                    feedsRefresh();
                });
            });
        } catch (e) {
            box.innerHTML = '<div style="font-size:0.8rem;color:#b91c1c;">' + feedEsc(e && e.message ? e.message : 'Could not load feeds.') + '</div>';
        }
    }

    function feedsWire() {
        var btn = $('feedCreateBtn');
        if (!btn || btn._wired) return;
        btn._wired = true;
        btn.addEventListener('click', async function () {
            var name = ($('feedNameInput').value || '').trim();
            var url = ($('feedUrlInput').value || '').trim();
            var keyField = $('feedKeyInput').value === 'sku' ? 'sku' : 'title';
            var msg = $('feedFormMsg');
            if (!name || !url) { msg.style.color = '#b91c1c'; msg.textContent = 'Name and sheet link are both needed.'; return; }
            btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
            try {
                await firebase.functions().httpsCallable('saveImportFeed')({ action: 'create', name: name, url: url, keyField: keyField });
                msg.style.color = '#065f46';
                msg.textContent = '✅ Feed saved — tap "Sync now" to run it immediately, or wait for tonight\'s automatic run.';
                $('feedNameInput').value = ''; $('feedUrlInput').value = '';
                flash('Stock feed saved 🔄 — it re-syncs daily by itself.', 'success');
            } catch (e) {
                msg.style.color = '#b91c1c';
                msg.textContent = e && e.message ? e.message : 'Could not save the feed.';
            }
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Save feed';
            feedsRefresh();
        });
        feedsRefresh();
    }

    /* ---------------- boot ---------------- */
    document.addEventListener('DOMContentLoaded', function () {
        if ($('quickListCard')) { try { qlWire(); } catch (e) { console.error('ql wire', e); } }
        if ($('csvImportCard')) { try { csvWire(); } catch (e) { console.error('csv wire', e); } }
        if ($('feedsCard')) { try { feedsWire(); } catch (e) { console.error('feeds wire', e); } }
    });

    window.smBuildSeedListings = { qlSetMode: qlSetMode };
})();
