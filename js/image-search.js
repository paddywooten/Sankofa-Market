/**
 * Image Search Feature
 * Shoppers snap or upload one photo; the phone itself ranks every product
 * photo by likeness (sharp AI brain + colour referee, all on-device).
 * No uploads, no keys, no servers, no match-percentages shown — just the
 * nearest things, closest first, with an honest banner when nothing is close.
 */

class ImageSearch {
    constructor() {
        this.modal = null;
        this.uploadArea = null;
        this.fileInput = null;
        this.previewContainer = null;
        this.previewImage = null;
        this.searchBtn = null;
        this.loadingState = null;
        this.resultsContainer = null;
        this.currentImage = null;
        this.currentImageUrl = null;
        this.init();
    }

    init() {
        // The history feature was retired — quietly free the storage it used on
        // returning shoppers' phones (no-op for everyone else).
        try { localStorage.removeItem('imageSearchHistory'); } catch (e) {}
        this.createModal();
        this.attachEventListeners();
    }

    createModal() {
        // Create modal HTML
        const modalHTML = `
            <div class="image-search-modal" id="imageSearchModal">
                <div class="image-search-container">
                    <div class="image-search-header">
                        <h2><i class="fas fa-camera"></i> Search by Image</h2>
                        <button class="image-search-close" id="imageSearchClose">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="image-search-body">
                        <!-- Upload Area -->
                        <div class="search-method-content active" id="uploadMethod">
                            <div class="image-upload-area" id="imageUploadArea">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <h3>Upload an Image</h3>
                                <p>Drag and drop an image here, or click to browse</p>
                                <div class="upload-options">
                                    <button class="upload-option-btn" id="uploadFromFile">
                                        <i class="fas fa-folder-open"></i>
                                        Choose File
                                    </button>
                                    <button class="upload-option-btn" id="uploadFromCamera">
                                        <i class="fas fa-camera"></i>
                                        Take Photo
                                    </button>
                                </div>
                                <input type="file" id="imageFileInput" accept="image/*" style="display: none;">
                                <input type="file" id="cameraInput" accept="image/*" capture="environment" style="display: none;">
                            </div>
                        </div>

                        <!-- Image Preview (for upload) -->
                        <div class="image-preview-container" id="imagePreviewContainer">
                            <div class="image-preview-wrapper">
                                <img id="imagePreview" alt="Preview">
                                <button class="image-preview-remove" id="imagePreviewRemove">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            
                            <!-- Search Options -->
                            <div class="image-search-options">
                                <h4>Refine Your Search (Optional)</h4>
                                <select class="search-category-select" id="searchCategorySelect">
                                    <option value="">All Categories</option>
                                    <option value="electronics">Electronics</option>
                                    <option value="fashion">Fashion</option>
                                    <option value="home-garden">Home & Garden</option>
                                    <option value="vehicles">Vehicles</option>
                                    <option value="services">Services</option>
                                    <option value="sports">Sports</option>
                                    <option value="books-media">Books & Media</option>
                                    <option value="baby-kids">Baby & Kids</option>
                                    <option value="beauty-health">Beauty & Health</option>
                                    <option value="food-groceries">Food & Groceries</option>
                                    <option value="pets">Pets</option>
                                    <option value="jobs-skills">Jobs & Skills</option>
                                    <option value="real-estate">Real Estate</option>
                                </select>
                            </div>
                            
                            <!-- Image Analysis Info -->
                            <div class="image-analysis-info" id="imageAnalysisInfo" style="display: none;">
                                <h4><i class="fas fa-palette"></i> What we found in your photo</h4>
                                <div class="analysis-tags" id="analysisTags"></div>
                                <div class="analysis-colors" id="analysisColors"></div>
                            </div>
                            
                            <button class="image-search-btn" id="imageSearchBtn">
                                <i class="fas fa-search"></i>
                                Search for Similar Products
                            </button>
                        </div>
                        
                        <!-- Loading State -->
                        <div class="image-search-loading" id="imageSearchLoading">
                            <div class="loading-spinner"></div>
                            <h3>Reading Your Photo</h3>
                            <p id="loadingText">Looking at the colours and shapes in your photo...</p>
                        </div>
                        
                        <!-- Results -->
                        <div class="image-search-results" id="imageSearchResults">
                            <div class="results-header">
                                <h3>Closest Visual Matches</h3>
                                <span class="results-count" id="resultsCount"></span>
                            </div>
                            <div class="results-grid" id="resultsGrid"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Append modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Cache DOM elements
        this.modal = document.getElementById('imageSearchModal');
        this.uploadArea = document.getElementById('imageUploadArea');
        this.fileInput = document.getElementById('imageFileInput');
        this.cameraInput = document.getElementById('cameraInput');
        this.previewContainer = document.getElementById('imagePreviewContainer');
        this.previewImage = document.getElementById('imagePreview');
        this.searchBtn = document.getElementById('imageSearchBtn');
        this.loadingState = document.getElementById('imageSearchLoading');
        this.resultsContainer = document.getElementById('imageSearchResults');
    }

    attachEventListeners() {
        // Close modal
        document.getElementById('imageSearchClose').addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // Upload area click
        this.uploadArea.addEventListener('click', () => this.fileInput.click());

        // Upload buttons
        document.getElementById('uploadFromFile').addEventListener('click', (e) => {
            e.stopPropagation();
            this.fileInput.click();
        });

        document.getElementById('uploadFromCamera').addEventListener('click', (e) => {
            e.stopPropagation();
            this.cameraInput.click();
        });

        // File input change
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.cameraInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.processImage(files[0]);
            }
        });

        // Remove preview
        document.getElementById('imagePreviewRemove').addEventListener('click', () => {
            this.resetUpload();
        });

        // Search button
        this.searchBtn.addEventListener('click', () => this.performSearch());
    }

    showFlashMessage(message, type = 'info') {
        if (typeof showFlashMessage === 'function') {
            showFlashMessage(message, type);
        } else {
            alert(message);
        }
    }

    open() {
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        // Always start from a clean slate: if the modal never got closed after the
        // last search, the leftover state (hidden preview, old results) made a
        // second search impossible without closing & reopening — now it just works.
        this.resetUpload();
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.resetUpload();
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            this.processImage(file);
        }
    }

    processImage(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            this.currentImage = e.target.result;
            this.previewImage.src = this.currentImage;
            this.uploadArea.style.display = 'none';
            this.previewContainer.classList.add('active');
            this.searchBtn.disabled = false;
        };

        reader.readAsDataURL(file);
    }

    resetUpload() {
        this.currentImage = null;
        this.currentImageUrl = null;
        this.previewImage.removeAttribute('src');
        this.uploadArea.style.display = 'block';
        this.previewContainer.style.display = '';   // performSearch set it to 'none' — undo,
        this.previewContainer.classList.remove('active'); // or the 2nd search of the visit can't show preview/button
        this.loadingState.classList.remove('active');
        this.resultsContainer.classList.remove('active');
        this.fileInput.value = '';
        this.cameraInput.value = '';
        document.getElementById('searchCategorySelect').value = '';
        document.getElementById('imageAnalysisInfo').style.display = 'none';
    }

    /* =====================================================================
     * REAL client-side visual matching (no API keys, no servers, no cost).
     * Every photo (the user's upload + each product's thumbnail) is reduced
     * to a small "signature" on a hidden canvas:
     *   • palette  — a 4×4×4 colour histogram (which colours dominate)
     *   • layout   — a 6×6 grid of zone-averaged colours (rough shapes:
     *                dark object on light background vs. all-over pattern…)
     *   • luma     — overall brightness
     * Products are then ranked by how close their photo's signature is to the
     * photo the buyer uploaded. That is all it does — honestly advertised.
     * ===================================================================== */
    __sigCacheKey() { return 'imgSigCacheV2'; }   // V2: saturation-weighted palette (V1 sigs are not comparable)
    __readSigCache() {
        try { return JSON.parse(localStorage.getItem(this.__sigCacheKey()) || '{}'); } catch (e) { return {}; }
    }
    __writeSigCache(cache) {
        try {
            const keys = Object.keys(cache);
            if (keys.length > 400) { // shed the oldest entries first
                keys.sort((a, b) => (cache[a].at || 0) - (cache[b].at || 0));
                for (const k of keys.slice(0, keys.length - 400)) delete cache[k];
            }
            localStorage.setItem(this.__sigCacheKey(), JSON.stringify(cache));
        } catch (e) { /* storage full — fine, we just lose the cache */ }
    }

    async __loadImageCors(url) {
        return await new Promise((resolve, reject) => {
            const img = new Image();
            if (!/^data:/i.test(url)) img.crossOrigin = 'anonymous';   // bucket CORS allows our site
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('image failed to load'));
            img.src = url;
            setTimeout(() => reject(new Error('image load timed out')), 12000);
        });
    }

    // ------------------------------------------------------------------
    // The "visual brain" (optional — loads on demand): a tiny MobileNet model
    // (~2 MB, downloaded once then cached) that turns a photo into 256 numbers
    // describing WHAT is in it — guitar, microphone, cable — not just which
    // colours. Colour alone can't tell two black gadgets apart; this can.
    // If anything about it fails (old phone, shaky network), matching silently
    // falls back to the colour-only engine above. Everything happens on the
    // buyer's own phone — no photo is ever uploaded anywhere.
    // ------------------------------------------------------------------
    __embCacheKey() { return 'imgEmbCacheV1'; }
    __readEmbCache() {
        try { return JSON.parse(localStorage.getItem(this.__embCacheKey()) || '{}'); } catch (e) { return {}; }
    }
    __writeEmbCache(cache) {
        try {
            const keys = Object.keys(cache);
            if (keys.length > 250) { // shed the oldest entries first
                keys.sort((a, b) => (cache[a].at || 0) - (cache[b].at || 0));
                for (const k of keys.slice(0, keys.length - 250)) delete cache[k];
            }
            localStorage.setItem(this.__embCacheKey(), JSON.stringify(cache));
        } catch (e) { /* storage full — fine, we just lose the cache */ }
    }

    __loadScriptOnce(src) {
        this.__scriptCache = this.__scriptCache || {};
        if (!this.__scriptCache[src]) {
            this.__scriptCache[src] = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src; s.async = true;
                s.onload = () => resolve(true);
                s.onerror = () => reject(new Error('could not load ' + src));
                document.head.appendChild(s);
            });
        }
        return this.__scriptCache[src];
    }

    async __ensureBrain() {
        if (this.__brain === false) return null;         // tried & failed this visit
        if (this.__brain) return this.__brain;
        if (this.__brainPromise) return this.__brainPromise;
        this.__brainPromise = (async () => {
            try {
                if (typeof tf === 'undefined') await this.__loadScriptOnce('/js/vendor/tf.min.js?v=1');
                if (typeof tf === 'undefined') throw new Error('brain scripts missing');
                const cat = this.__brainCatalog();
                const want = this.__preferredBrainKind();
                const order = want === 'sharp' ? ['sharp', 'light'] : ['light', 'sharp'];
                for (const kind of order) {
                    try {
                        this.__brain = await this.__loadBrainModel(cat[kind]);
                        console.info('visual brain ready:', kind);
                        return this.__brain;
                    } catch (e) {
                        console.warn(kind + ' brain could not load (' + (e && e.message) + ') — trying fallback');
                    }
                }
                throw new Error('no brain could load');
            } catch (e) {
                console.warn('visual brain unavailable — falling back to colour-only matching:', e && e.message);
                this.__brain = false;
                return null;
            }
        })();
        return this.__brainPromise;
    }

    // Two self-hosted brains. The SHARP one (~10 MB, top-1 accuracy roughly 2×
    // better, 768-number fingerprints) is the default on decent connections;
    // the LIGHT one (~2 MB, 256-number fingerprints) serves buyers on Data
    // Saver or 2G-class networks. Both run 100% on the buyer's phone and sit
    // in HTTP cache for a month after the first download.
    __brainCatalog() {
        return {
            sharp: { url: '/models/mobilenet-075/model.json', kind: 'sharp' },
            light: { url: '/models/mobilenet/model.json',     kind: 'light' }
        };
    }
    __preferredBrainKind() {
        try {
            const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (c) {
                if (c.saveData) return 'light';
                const t = String(c.effectiveType || '');
                if (t.indexOf('2g') !== -1 && t.indexOf('4g') === -1) return 'light'; // slow-2g / 2g
            }
        } catch (e) {}
        return 'sharp';
    }
    async __loadBrainModel(spec) {
        const full = await tf.loadLayersModel(spec.url);
        // tap the bottle-neck layer: the "what is this thing" fingerprint
        // (768 numbers on the sharp brain, 256 on the light one — both work,
        // the cache below remembers which brain produced each fingerprint)
        const neck = full.getLayer('global_average_pooling2d_1');
        const embedder = tf.model({ inputs: full.inputs, outputs: neck.output });
        return { full, embedder, kind: spec.kind };
    }

    // MobileNet v1 preprocessing: 224×224, pixels scaled to [0,1]
    __brainInput(img) {
        const x = tf.browser.fromPixels(img).toFloat();
        const r = tf.image.resizeBilinear(x, [224, 224]);
        x.dispose();
        return r.div(255).expandDims(0);
    }

    // Storage photos read through the same /imgProxy relay the colour engine uses
    __proxied(url) {
        return /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/sankofa-market\.firebasestorage\.app\//i.test(url)
            ? '/imgProxy?u=' + encodeURIComponent(url) : url;
    }

    // The 256-number "what is this thing" fingerprint of a photo. L2-normalised,
    // so a plain dot product between two of these IS their cosine similarity.
    // Product-photo embeddings are cached per-URL for 7 days like the colour sigs.
    async __embeddingForUrl(url) {
        const brain = await this.__ensureBrain();
        if (!brain) return null;
        const isData = /^data:/i.test(url);
        if (!isData) {
            const cache = this.__readEmbCache();
            const hit = cache[url];
            // a fingerprint is only valid if THE SAME BRAIN produced it
            if (hit && hit.e && hit.b === brain.kind && (Date.now() - (hit.at || 0)) < 7 * 86400e3) return hit.e;
        }
        const img = await this.__loadImageCors(isData ? url : this.__proxied(url));
        const emb = tf.tidy(() => {
            const x = this.__brainInput(img);
            const flat = brain.embedder.predict(x).squeeze();
            return tf.div(flat, tf.norm(flat));
        });
        const e = Array.from(emb.dataSync(), v => Math.round(v * 1e4) / 1e4);
        emb.dispose();
        if (!isData) {
            const cache = this.__readEmbCache();
            cache[url] = { e, at: Date.now(), b: brain.kind };
            this.__writeEmbCache(cache);
        }
        return e;
    }

    // The 1000 ImageNet class names (tiny JSON, cached with the model)
    async __imagenetClasses() {
        if (this.__classes) return this.__classes;
        try {
            const r = await fetch('/models/imagenet-classes.json');
            this.__classes = r.ok ? await r.json() : [];
        } catch (e) { this.__classes = []; }
        return this.__classes;
    }

    // A few plain-English guesses at what the buyer's photo shows ("acoustic
    // guitar"), shown next to the colour swatches so the search is explainable.
    async __guessLabels(url) {
        const brain = await this.__ensureBrain();
        if (!brain) return [];
        try {
            const img = await this.__loadImageCors(/^data:/i.test(url) ? url : this.__proxied(url));
            const top = tf.tidy(() => {
                const x = this.__brainInput(img);
                return tf.topk(brain.full.predict(x), 3);
            });
            const idx = Array.from(top.indices.dataSync());
            top.values.dispose(); top.indices.dispose();
            const names = await this.__imagenetClasses();
            return idx.map(i => ((names[i] || '').split(',')[0] || '').trim()).filter(Boolean).slice(0, 3);
        } catch (e) { return []; }
    }

    async __signatureForUrl(url) {
        // cached? product photos don't change under the same URL
        if (!/^data:/i.test(url)) {
            const cache = this.__readSigCache();
            const hit = cache[url];
            if (hit && hit.sig && (Date.now() - (hit.at || 0)) < 7 * 86400e3) return hit.sig;
        }
        // Shop photos go through our own /imgProxy relay (same origin): browsers that
        // cached a photo from normal browsing refuse later CORS reads of the same URL.
        const relay = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/sankofa-market\.firebasestorage\.app\//i.test(url);
        const fetchUrl = relay ? '/imgProxy?u=' + encodeURIComponent(url) : url;
        const img = await this.__loadImageCors(fetchUrl);
        const N = 48;
        const cv = document.createElement('canvas');
        cv.width = N; cv.height = N;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0, N, N);
        const data = cx.getImageData(0, 0, N, N).data;   // throws if CORS-tainted — caller catches

        const hist = new Float32Array(64);               // 4×4×4 RGB bins
        const grid = new Float32Array(6 * 6 * 3);        // 6×6 zone averages
        const zoneCount = new Float32Array(36);
        let lumaSum = 0, dark = 0, light = 0, satSum = 0;
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                const i = (y * N + x) * 4;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                // saturation: colourful subject pixels speak louder than white/grey backgrounds
                const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
                const sat = mx === 0 ? 0 : (mx - mn) / mx;
                const w = 0.25 + 0.75 * sat;
                const bin = (r >> 6) * 16 + (g >> 6) * 4 + (b >> 6);
                hist[bin] += w;
                satSum += w;
                const zone = Math.min(5, Math.floor(y / 8)) * 6 + Math.min(5, Math.floor(x / 8));
                grid[zone * 3] += r; grid[zone * 3 + 1] += g; grid[zone * 3 + 2] += b;
                zoneCount[zone]++;
                const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                lumaSum += l;
                if (l < 64) dark++; else if (l > 192) light++;
            }
        }
        const total = N * N;
        const histTotal = satSum || total;
        for (let i = 0; i < 64; i++) hist[i] /= histTotal;
        for (let z = 0; z < 36; z++) {
            const c = zoneCount[z] || 1;
            grid[z * 3] /= c * 255; grid[z * 3 + 1] /= c * 255; grid[z * 3 + 2] /= c * 255;
        }
        const luma = lumaSum / total / 255;
        // top 5 palette colours as honest swatches (mid-bin hex)
        const topBins = Array.from(hist.keys()).sort((a, b) => hist[b] - hist[a]).slice(0, 5);
        const paletteHex = topBins.map(bin => {
            const rr = (bin >> 4) & 3, gg = (bin >> 2) & 3, bb = bin & 3;
            const hx = (v) => (v * 64 + 32).toString(16).padStart(2, '0');
            return '#' + hx(rr) + hx(gg) + hx(bb);
        });
        const sig = { hist: Array.from(hist), grid: Array.from(grid), luma, contrast: (light - dark) / total, paletteHex };
        if (!/^data:/i.test(url)) {
            const cache = this.__readSigCache();
            cache[url] = { sig, at: Date.now() };
            this.__writeSigCache(cache);
        }
        return sig;
    }

    __distance(a, b) {
        let h = 0;                                     // palette L1 (0..1)
        for (let i = 0; i < 64; i++) h += Math.abs(a.hist[i] - b.hist[i]);
        h /= 2;
        let g = 0;                                     // layout euclidean (0..~1)
        for (let i = 0; i < a.grid.length; i++) g += (a.grid[i] - b.grid[i]) * (a.grid[i] - b.grid[i]);
        g = Math.sqrt(g / a.grid.length) * 1.7;
        if (g > 1) g = 1;
        const l = Math.abs(a.luma - b.luma);
        return 0.50 * h + 0.42 * g + 0.08 * l;   // layout counts a little more now the palette is subject-weighted
    }

    async performSearch() {
        const hasImage = this.currentImage !== null;

        if (!hasImage) {
            this.showFlashMessage('Please upload an image first', 'warning');
            return;
        }

        if (!isLoggedIn()) {
            this.showFlashMessage('Please sign in to use image search', 'warning');
            setTimeout(() => {
                window.location.href = 'pages/auth/login.html';
            }, 1500);
            return;
        }

        this.previewContainer.style.display = 'none';
        this.loadingState.classList.add('active');
        document.getElementById('loadingText').textContent = 'Reading the colours and shapes in your photo...';
        const category = document.getElementById('searchCategorySelect').value;

        try {
            // 1) signature of the photo the buyer gave us
            const qUrl = this.currentImage;
            let qSig = null;
            try { qSig = await this.__signatureForUrl(qUrl); } catch (e) { qSig = null; }
            if (!qSig) {
                this.loadingState.classList.remove('active');
                this.previewContainer.style.display = 'block';
                this.showFlashMessage('Could not read that photo. Please try a different one.', 'error');
                return;
            }

            // Also warm up the optional on-device "visual brain" while we fetch
            // the catalogue — first-ever use downloads the saved weights (sharp
            // brain ~10 MB on good connections, light brain ~2 MB on Data Saver /
            // 2G), then it is cached for a month. Failure is fine: colour-only
            // matching takes over.
            const brainPromise = this.__ensureBrain();

            // 2) live products (same catalogue rule as the search page)
            document.getElementById('loadingText').textContent = 'Comparing against product photos...';
            var products = [];
            if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
                var query = firebaseDB.collection('products').where('isActive', '==', true).where('isSold', '==', false);
                if (category) {
                    query = firebaseDB.collection('products')
                        .where('isActive', '==', true)
                        .where('isSold', '==', false)
                        .where('category', '==', category);
                }
                var snapshot = await query.limit(40).get();
                snapshot.forEach(function(doc) { products.push({ id: doc.id, ...doc.data() }); });
                if (products.length === 0 && category) {
                    var fallback = await firebaseDB.collection('products')
                        .where('isActive', '==', true)
                        .where('isSold', '==', false)
                        .limit(40).get();
                    fallback.forEach(function(doc) { products.push({ id: doc.id, ...doc.data() }); });
                }
            }

            if (products.length === 0) {
                this.loadingState.classList.remove('active');
                this.previewContainer.style.display = 'block';
                this.showFlashMessage('No products to compare against right now.', 'warning');
                return;
            }

            // 3) if the brain woke up, fingerprint the buyer's photo too
            let qEmb = null, qLabels = [];
            const brain = await brainPromise;
            if (brain) {
                document.getElementById('loadingText').textContent = 'Understanding what is in your photo...';
                try { qEmb = await this.__embeddingForUrl(qUrl); } catch (e) { qEmb = null; }
                if (qEmb) { try { qLabels = await this.__guessLabels(qUrl); } catch (e) { qLabels = []; } }
                document.getElementById('loadingText').textContent = 'Comparing against product photos...';
            }

            // 4) score every product's main photo against the buyer's photo
            const scored = new Array(products.length);
            let rankable = 0;
            const CHUNK = 5;
            for (let i = 0; i < products.length; i += CHUNK) {
                await Promise.all(products.slice(i, i + CHUNK).map(async (p, j) => {
                    const imgUrl = (p.imagesThumb && p.imagesThumb[0]) || (p.images && p.images[0]) || null;
                    let dist = 1;
                    if (imgUrl) {
                        try {
                            const sig = await this.__signatureForUrl(imgUrl);
                            dist = this.__distance(qSig, sig);
                            if (qEmb) {
                                const pEmb = await this.__embeddingForUrl(imgUrl);
                                if (pEmb) {
                                    let sim = 0;
                                    for (let k = 0; k < qEmb.length; k++) sim += qEmb[k] * pEmb[k];
                                    // cosine → distance (0 = same thing, ~2 = opposite)
                                    const embDist = 1 - Math.max(-1, Math.min(1, sim));
                                    // the object itself leads (two black gadgets look alike
                                    // to colour alone); colour stays as the referee
                                    dist = 0.62 * embDist + 0.38 * dist;
                                }
                            }
                            rankable++;
                        } catch (e) { /* photo unreadable → sinks to the end */ }
                    }
                    scored[i + j] = { p, dist };
                }));
            }
            scored.sort((a, b) => a.dist - b.dist);

            // CALIBRATED honesty: the score maps the raw visual distance onto a fixed
            // ruler (dist 0 → 100%, dist ≥ 0.75 → 0%). The number is NOT shown to the
            // buyer (design decision — no fake-precision percentages); it judges only
            // whether the result set deserves the gold "nothing really close" banner.
            scored.forEach(s => { s.strength = Math.max(0, Math.round(100 * (1 - s.dist / 0.75))); });
            const bestDist = scored.length ? scored[0].dist : 1;
            const weak = bestDist > 0.55;   // even the best is far — say it plainly

            this.displayAnalysisInfo({ colors: qSig.paletteHex, brainOn: !!qEmb, brainKind: brain ? brain.kind : null, labels: qLabels });
            this.displayResults(scored.map(s => ({ ...s.p, __strength: s.strength })), weak);
            this.showFlashMessage(weak
                ? 'Nothing looks really close to that photo — showing the nearest we have'
                : 'Ranked ' + rankable + ' product photo' + (rankable === 1 ? '' : 's') + ' by visual match', weak ? 'warning' : 'success');

        } catch (error) {
            console.error('Search error:', error);
            this.loadingState.classList.remove('active');
            this.previewContainer.style.display = 'block';
            this.showFlashMessage('Search failed. Please try again.', 'error');
        }
    }

    displayAnalysisInfo(analysis) {
        const analysisInfo = document.getElementById('imageAnalysisInfo');
        const tagsContainer = document.getElementById('analysisTags');
        const colorsContainer = document.getElementById('analysisColors');

        if (!analysis) {
            analysisInfo.style.display = 'none';
            return;
        }

        var tags = [];
        if (analysis.brainOn) {
            tags.push(analysis.brainKind === 'light'
                ? 'Matched by <strong>look, shape &amp; colour</strong> — light on-phone AI (data-saver mode), nothing uploaded'
                : 'Matched by <strong>look, shape &amp; colour</strong> — sharp on-phone AI, nothing uploaded');
            if (analysis.labels && analysis.labels.length) {
                tags.push('Looks like: <strong>' + analysis.labels.map(function(l) {
                    var d = document.createElement('div'); d.textContent = l; return d.innerHTML;
                }).join(', ') + '</strong>');
            }
        } else {
            tags.push('Matched by colour palette & layout');
        }
        tagsContainer.innerHTML = tags.map(function(t) { return '<span class="analysis-tag">' + t + '</span>'; }).join(' ');
        if (analysis.colors && analysis.colors.length > 0) {
            colorsContainer.innerHTML = '<strong>Top colours in your photo:</strong> ' +
                analysis.colors.slice(0, 5).map(hex =>
                    `<span class="analysis-color" style="background: ${hex};" title="${hex}"></span>`
                ).join('');
        } else {
            colorsContainer.innerHTML = '';
        }

        analysisInfo.style.display = 'block';
    }

    displayResults(products, weak) {
        // Hide loading, show results
        this.loadingState.classList.remove('active');
        this.resultsContainer.classList.add('active');

        const resultsGrid = document.getElementById('resultsGrid');
        const resultsCount = document.getElementById('resultsCount');

        if (!products || products.length === 0) {
            resultsCount.textContent = '0 products found';
            resultsGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <h4>No similar products found</h4>
                    <p>Try a different image or broaden your category filter</p>
                </div>
            `;
            return;
        }

        resultsCount.textContent = `${products.length} products found`;

        const weakBanner = weak ? `
            <div style="grid-column:1/-1;background:#fff8e1;border:1px solid #ffe69c;border-radius:10px;padding:0.7rem 0.9rem;margin:0 0 0.4rem;font-size:0.8rem;color:#7a4a00;display:flex;gap:0.5rem;align-items:flex-start;">
                <i class="fas fa-info-circle" style="margin-top:0.1rem;"></i>
                <span>No product photo looks <strong>really</strong> close to yours right now — these are simply the nearest things on the market, closest first.</span>
            </div>` : '';

        resultsGrid.innerHTML = weakBanner + products.map(product => {
            const imageUrl = product.images?.[0] || 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2260%22%20height=%2260%22%3E%3Crect%20width=%2260%22%20height=%2260%22%20fill=%22%23e5e7eb%22/%3E%3C/svg%3Ex200?text=No+Image';
            const price = product.price ? `GHS ${product.price.toLocaleString()}` : 'Price on request';
            const condition = product.condition ? `<span class="product-condition">${product.condition}</span>` : '';
            const location = product.location?.city || 'Ghana';
            const isSankofaStore = product.isSankofaStore === true;

            return `
                <div class="product-card" data-strength="${typeof product.__strength === 'number' ? product.__strength : ''}" onclick="window.location.href='product-detail.html?id=${product.id}'">
                    <div class="product-image-wrapper">
                        <img src="${imageUrl}" alt="${product.title}" class="product-image" loading="lazy">
                        ${isSankofaStore ? '<span class="sankofa-store-badge"><i class="fas fa-store"></i> Official</span>' : ''}
                        ${product.preOrder ? ' <span class="preorder-badge" title="Pre-order — pay now, ships when stock lands (escrow protected)"><i class="fas fa-clock"></i> Pre-order</span>' : ''}
                    </div>
                    <div class="product-info">
                        <h4 class="product-title">${product.title}</h4>
                        <div class="product-price">${price}</div>
                        ${condition}
                        <div class="product-meta">
                            <span><i class="fas fa-map-marker-alt"></i> ${location}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Initialize image search when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create global instance
    window.imageSearch = new ImageSearch();

    // Add trigger buttons to all search bars
    const searchInputs = document.querySelectorAll('.search-form, .hero-search-form');

    searchInputs.forEach(form => {
        const input = form.querySelector('input[type="text"]');
        const submitBtn = form.querySelector('button[type="submit"]');

        if (input && submitBtn) {
            // Create image search button
            const imageSearchBtn = document.createElement('button');
            imageSearchBtn.type = 'button';
            imageSearchBtn.className = 'image-search-trigger';
            imageSearchBtn.innerHTML = '<i class="fas fa-camera"></i>';
            imageSearchBtn.title = 'Search by image';
            imageSearchBtn.addEventListener('click', () => window.imageSearch.open());

            // Insert button before submit button
            form.insertBefore(imageSearchBtn, submitBtn);

            // Adjust form layout
            form.style.display = 'flex';
            form.style.gap = '0.5rem';
            form.style.alignItems = 'center';
        }
    });

    // Phones: the header search form is hidden on ≤768px — the ONLY search bar
    // a shopper on a phone ever sees is the mobile pill on the search page.
    // Without this, image search simply did not exist on mobile.
    document.querySelectorAll('.search-mobile-box').forEach(box => {
        if (!box.querySelector('input[type="text"]') || box.querySelector('.image-search-trigger')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'image-search-trigger';
        btn.innerHTML = '<i class="fas fa-camera"></i>';
        btn.title = 'Search by photo';
        btn.setAttribute('aria-label', 'Search by photo');
        btn.addEventListener('click', (e) => {
            e.preventDefault();      // the bar sits inside a <label> — don't steal the tap for the text input
            e.stopPropagation();
            window.imageSearch.open();
        });
        box.appendChild(btn);
    });
});
