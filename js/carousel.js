/**
 * Sankofa Market — Hero Carousel (js/carousel.js)
 * Auto-swiping promotional carousel with touch support.
 *
 * Slides are managed from the ADMIN PANEL (Carousel section): the homepage
 * renders published slides from the `carousel` collection. If no slides exist
 * (or the fetch fails/offline) the built-in slides already in index.html keep
 * showing — the carousel can never end up empty.
 *
 * Data cost: ONE small query (≤20 tiny docs, sorted client-side — no composite
 * index) per visit. The last rendered set is kept in localStorage so the
 * carousel paints instantly and still works offline.
 */

/* === CAROUSEL CORE START (pure helpers — unit-tested, no DOM/Firebase) === */

var SM_CAROUSEL_HEX = /^#[0-9a-f]{6}$/i;
var SM_CAROUSEL_BTN_CLASSES = { primary: 'btn-primary', secondary: 'btn-secondary', outline: 'btn-outline' };

function smCarouselEsc(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Buttons can only link to our own paths or https:// — never javascript:. */
function smCarouselSafeHref(v) {
    var s = String(v || '').trim();
    if (!s) return '';
    if (s.charAt(0) === '/' && s.charAt(1) !== '/') return s;   // internal path (/search.html?...)
    if (/^https:\/\//i.test(s)) return s;                        // secure external link
    return '';
}

/**
 * One `carousel` Firestore doc → complete, safe render values.
 * Everything optional: defaults + clamps mean a half-filled slide still looks
 * right and junk can never break the homepage.
 */
function smCarouselNormalize(raw) {
    var d = (raw && typeof raw === 'object') ? raw : {};
    function hex(v, dflt) {
        var s = String(v || '').trim().toLowerCase();
        return SM_CAROUSEL_HEX.test(s) ? s : dflt;
    }
    function clampNum(v, min, max, dflt) {
        var n = Math.round(Number(v));
        if (!isFinite(n)) n = dflt;
        return Math.min(max, Math.max(min, n));
    }
    var rev = d.updatedAt;
    if (rev && typeof rev.toMillis === 'function') rev = rev.toMillis();
    else rev = String(rev || '');
    return {
        id: String(d.id || ''),
        rev: String(rev),
        order: Number(d.order) || 0,
        isActive: d.isActive !== false,
        tag: String(d.tag || '').slice(0, 40),
        tagBg: hex(d.tagBg, ''),
        tagColor: hex(d.tagColor, ''),
        title: String(d.title || '').slice(0, 80),
        titleAccent: String(d.titleAccent || '').slice(0, 80),
        subtitle: String(d.subtitle || '').slice(0, 300),
        textColor: hex(d.textColor, '#ffffff'),
        accentColor: hex(d.accentColor, '#f5af02'),
        titleSize: clampNum(d.titleSize, 20, 64, 44),
        bodySize: clampNum(d.bodySize, 12, 26, 18),
        bg1: hex(d.bg1, '#0064d2'),
        bg2: hex(d.bg2, '#002d6b'),
        // Photos may be an upload (https) or one of our own images (e.g. the
        // built-in /images/promo/*.jpg the homepage already ships with).
        imageUrl: smCarouselSafeHref(d.imageUrl),
        imageAlt: String(d.imageAlt || '').slice(0, 80),
        btnText: String(d.btnText || '').slice(0, 40),
        btnUrl: smCarouselSafeHref(d.btnUrl),
        btnStyle: SM_CAROUSEL_BTN_CLASSES[d.btnStyle] ? d.btnStyle : 'secondary',
        btnIcon: /^[a-z0-9-]{2,24}$/.test(String(d.btnIcon || '')) ? String(d.btnIcon) : ''
    };
}

/**
 * Safe slide markup using the classes the stylesheet already styles.
 * Font sizes use min(px, vw) so an admin-chosen size still shrinks to fit a
 * small phone instead of overflowing.
 */
function smCarouselSlideHtml(s) {
    var bg = 'linear-gradient(135deg,' + s.bg1 + ' 0%,' + s.bg2 + ' 100%)';
    var tag = s.tag
        ? '<span class="carousel-tag" style="' + (s.tagBg ? 'background:' + s.tagBg + ';' : '') +
          (s.tagColor ? 'color:' + s.tagColor + ';' : '') + '">' + smCarouselEsc(s.tag) + '</span>'
        : '';
    var h2 = (s.title || s.titleAccent)
        ? '<h2 style="color:' + s.textColor + ';font-size:min(' + s.titleSize + 'px,9vw);">' +
            smCarouselEsc(s.title) +
            (s.titleAccent
                ? (s.title ? '<br>' : '') + '<span style="color:' + s.accentColor + ';font-size:0.85em;">' +
                  smCarouselEsc(s.titleAccent) + '</span>'
                : '') +
          '</h2>'
        : '';
    var p = s.subtitle
        ? '<p style="color:' + s.textColor + ';opacity:0.92;font-size:min(' + s.bodySize + 'px,4.6vw);">' +
          smCarouselEsc(s.subtitle) + '</p>'
        : '';
    var btn = (s.btnText && s.btnUrl)
        ? '<a href="' + smCarouselEsc(s.btnUrl) + '" class="btn ' + SM_CAROUSEL_BTN_CLASSES[s.btnStyle] + ' btn-large">' +
            (s.btnIcon ? '<i class="fas fa-' + s.btnIcon + '"></i> ' : '') + smCarouselEsc(s.btnText) + '</a>'
        : '';
    var img = s.imageUrl
        ? '<div class="carousel-image"><img width="500" height="350" loading="lazy" decoding="async" ' +
          'onerror="this.onerror=null;this.src=\'/images/placeholders/product.svg\';" src="' + smCarouselEsc(s.imageUrl) +
          '" alt="' + smCarouselEsc(s.imageAlt || s.title || 'Promotion') + '"></div>'
        : '';
    return '<div class="carousel-slide" style="background:' + bg + ';">' +
        '<div class="carousel-inner"><div class="carousel-text">' + tag + h2 + p + btn + '</div>' + img + '</div></div>';
}

/**
 * The five slides the homepage ships with (the "existing carousel"). Kept in
 * sync with the static markup in index.html — carousel-test.mjs guards the
 * drift. The admin panel can import these into the editor to make them
 * editable; the homepage keeps rendering its static copy until then.
 */
var SM_CAROUSEL_DEFAULTS = [
    { tag: '🔥 Mega Sale', title: 'Electronics Blowout', titleAccent: 'Up to 40% Off', accentColor: '#f5af02',
      subtitle: 'Discover incredible deals on phones, laptops, TVs, and more from verified sellers across Ghana.',
      textColor: '#ffffff', bg1: '#0064d2', bg2: '#002d6b', titleSize: 48, bodySize: 18,
      btnText: 'Shop Electronics', btnUrl: '/search.html?category=electronics', btnIcon: 'bolt', btnStyle: 'secondary',
      imageUrl: '/images/promo/electronics-thumb.jpg' },
    { tag: '👗 New Arrivals', title: 'Fashion Week', titleAccent: 'Trending Styles', accentColor: '#ffc107',
      subtitle: 'Explore the latest fashion trends. From African prints to modern streetwear — find your style.',
      textColor: '#ffffff', bg1: '#e74c3c', bg2: '#922b21', titleSize: 48, bodySize: 18,
      btnText: 'Explore Fashion', btnUrl: '/search.html?category=fashion', btnIcon: 'tshirt', btnStyle: 'secondary',
      imageUrl: '/images/promo/fashion-thumb.jpg' },
    { tag: '⭐ Official Store', tagBg: '#c68900', tagColor: '#ffffff', title: 'Sankofa Store', titleAccent: '100% Verified', accentColor: '#004a9f',
      subtitle: 'Shop from our official in-house store. Quality guaranteed, fast delivery, and hassle-free returns.',
      textColor: '#191919', bg1: '#f5af02', bg2: '#c68900', titleSize: 48, bodySize: 18,
      btnText: 'Visit Sankofa Store', btnUrl: '/search.html?category=sankofa-store', btnIcon: 'store', btnStyle: 'primary',
      imageUrl: '/images/promo/sankofa-store-thumb.jpg' },
    { tag: '💰 Free Listing', title: 'Start Selling', titleAccent: "Today — It's Free!", accentColor: '#ffc107',
      subtitle: 'Turn your unused items into cash. List in minutes, reach thousands of buyers across Ghana.',
      textColor: '#ffffff', bg1: '#86b817', bg2: '#4a7a00', titleSize: 48, bodySize: 18,
      btnText: 'Sell Now', btnUrl: '/publish.html', btnIcon: 'rocket', btnStyle: 'secondary',
      imageUrl: '/images/promo/sell-thumb.jpg' },
    { tag: '🏠 Home Deals', title: 'Transform Your', titleAccent: 'Living Space', accentColor: '#f5af02',
      subtitle: 'Furniture, decor, kitchen essentials and more. Create the home of your dreams at unbeatable prices.',
      textColor: '#ffffff', bg1: '#9b59b6', bg2: '#5b2c6f', titleSize: 48, bodySize: 18,
      btnText: 'Shop Home & Garden', btnUrl: '/search.html?category=home-garden', btnIcon: 'couch', btnStyle: 'secondary',
      imageUrl: '/images/promo/home-garden-thumb.jpg' }
];

/**
 * The defaults shaped as importable `carousel` docs (deterministic ids so a
 * second import can never create duplicates; order 1–5). The admin importer
 * re-orders them after any slides that already exist.
 */
function smCarouselDefaultDocs() {
    return SM_CAROUSEL_DEFAULTS.map(function (raw, i) {
        var id = 'default-' + (i + 1);
        var n = smCarouselNormalize(Object.assign({}, raw, { id: id, order: i + 1, isActive: true }));
        return {
            id: id,
            data: {
                tag: n.tag, title: n.title, titleAccent: n.titleAccent, subtitle: n.subtitle,
                textColor: n.textColor, accentColor: n.accentColor,
                titleSize: n.titleSize, bodySize: n.bodySize,
                bg1: n.bg1, bg2: n.bg2, tagBg: n.tagBg, tagColor: n.tagColor,
                imageUrl: n.imageUrl, imageAlt: n.imageAlt || n.title || 'Promotion',
                btnText: n.btnText, btnUrl: n.btnUrl, btnStyle: n.btnStyle, btnIcon: n.btnIcon,
                order: i + 1,
                isActive: true
            }
        };
    });
}

/** Active slides, ordered, deduped, capped (the render set). */
function smCarouselPick(docs, max) {
    var seen = {}, list = [];
    (docs || []).forEach(function (raw) {
        var s = smCarouselNormalize(raw);
        if (!s.isActive || seen[s.id]) return;
        seen[s.id] = 1;
        if (s.title || s.titleAccent || s.subtitle || s.tag) list.push(s);
    });
    list.sort(function (a, b) { return a.order - b.order; });
    return list.slice(0, max || 8);
}

/** Cheap change-detector so a re-render only happens when the slides really changed. */
function smCarouselKey(slides) {
    return (slides || []).map(function (s) { return s.id + ':' + s.rev; }).join('|');
}

/* === CAROUSEL CORE END === */

var SM_CAROUSEL_CACHE_KEY = 'sm-carousel-cache-v1';

function smCarouselCacheGet() {
    try {
        var raw = localStorage.getItem(SM_CAROUSEL_CACHE_KEY);
        if (!raw) return [];
        var data = JSON.parse(raw);
        return Array.isArray(data && data.slides) ? smCarouselPick(data.slides, 8) : [];
    } catch (e) { return []; }
}

function smCarouselCacheSet(slides) {
    try {
        localStorage.setItem(SM_CAROUSEL_CACHE_KEY, JSON.stringify({ at: Date.now(), slides: slides }));
    } catch (e) { /* private mode / quota — cache is a bonus, never required */ }
}

/** One small query; sorted client-side so no composite index is needed. */
async function smCarouselFetch() {
    var tries = 0;
    while ((typeof firebaseDB === 'undefined' || !firebaseDB) && tries < 30) {
        await new Promise(function (r) { setTimeout(r, 120); });
        tries++;
    }
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return [];
    var snap = await firebaseDB.collection('carousel')
        .where('isActive', '==', true)
        .limit(20)
        .get();
    var docs = [];
    snap.forEach(function (d) {
        var data = d.data() || {};
        data.id = d.id;
        docs.push(data);
    });
    return smCarouselPick(docs, 8);
}

/** Rebuild the dots to match however many slides are on screen. */
function smCarouselBuildDots(count) {
    var dots = document.getElementById('carouselDots');
    if (!dots) return;
    var html = '';
    for (var i = 0; i < count; i++) {
        html += '<button class="carousel-dot' + (i === 0 ? ' active' : '') + '" data-index="' + i +
            '" aria-label="Go to slide ' + (i + 1) + '"></button>';
    }
    dots.innerHTML = html;
}

/**
 * The animation engine. Returns { destroy } so the carousel can be re-mounted
 * with fresh slides without stacking timers or duplicate listeners.
 */
function smCarouselEngine() {
    var track = document.getElementById('carouselTrack');
    var prevBtn = document.getElementById('carouselPrev');
    var nextBtn = document.getElementById('carouselNext');
    var dotsContainer = document.getElementById('carouselDots');
    var progressBar = document.getElementById('carouselProgress');
    var destroyed = false;

    var slides = track.querySelectorAll('.carousel-slide');
    var dots = dotsContainer ? dotsContainer.querySelectorAll('.carousel-dot') : [];
    var totalSlides = slides.length;
    if (!totalSlides) return { destroy: function () {} };

    var currentIndex = 0, autoPlayInterval = null, progressInterval = null, progressValue = 0;
    var autoPlayDelay = 5000;
    var isTransitioning = false;
    var touchStartX = 0, touchEndX = 0, touchStartY = 0, touchEndY = 0, isDragging = false;
    var carouselWrapper = document.querySelector('.hero-carousel');

    function goToSlide(index) {
        if (isTransitioning || destroyed) return;
        isTransitioning = true;
        currentIndex = index;
        if (currentIndex >= totalSlides) currentIndex = 0;
        if (currentIndex < 0) currentIndex = totalSlides - 1;
        track.style.transform = 'translateX(-' + (currentIndex * 100) + '%)';
        dots.forEach(function (dot, i) { dot.classList.toggle('active', i === currentIndex); });
        resetProgress();
        setTimeout(function () { isTransitioning = false; }, 600);
    }
    function nextSlide() { goToSlide(currentIndex + 1); }
    function prevSlide() { goToSlide(currentIndex - 1); }

    function startProgress() {
        progressValue = 0;
        if (progressBar) progressBar.style.width = '0%';
        progressInterval = setInterval(function () {
            progressValue += (100 / (autoPlayDelay / 30));
            if (progressBar) progressBar.style.width = Math.min(progressValue, 100) + '%';
        }, 30);
    }
    function resetProgress() {
        clearInterval(progressInterval);
        progressValue = 0;
        if (progressBar) progressBar.style.width = '0%';
        startProgress();
    }
    function startAutoPlay() {
        stopAutoPlay();
        startProgress();
        autoPlayInterval = setInterval(function () { nextSlide(); }, autoPlayDelay);
    }
    function stopAutoPlay() {
        clearInterval(autoPlayInterval);
        clearInterval(progressInterval);
        autoPlayInterval = null;
    }
    function restartAutoPlay() { stopAutoPlay(); startAutoPlay(); }

    function onPrev() { prevSlide(); restartAutoPlay(); }
    function onNext() { nextSlide(); restartAutoPlay(); }
    function onDotClick(i) { return function () { goToSlide(i); restartAutoPlay(); }; }
    function onMouseEnter() { stopAutoPlay(); }
    function onMouseLeave() { startAutoPlay(); }
    function onTouchStart(e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        isDragging = true;
        stopAutoPlay();
    }
    function onTouchMove(e) {
        if (!isDragging) return;
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
    }
    function onTouchEnd() {
        if (!isDragging) return;
        isDragging = false;
        var diffX = touchStartX - touchEndX, diffY = touchStartY - touchEndY;
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (diffX > 0) nextSlide(); else prevSlide();
        }
        startAutoPlay();
    }
    function onKeydown(e) {
        if (!carouselWrapper || destroyed) return;
        var rect = carouselWrapper.getBoundingClientRect();
        if (!(rect.top < window.innerHeight && rect.bottom > 0)) return;
        if (e.key === 'ArrowLeft') { prevSlide(); restartAutoPlay(); }
        else if (e.key === 'ArrowRight') { nextSlide(); restartAutoPlay(); }
    }
    function onVisibility() { if (document.hidden) stopAutoPlay(); else startAutoPlay(); }

    if (prevBtn) prevBtn.addEventListener('click', onPrev);
    if (nextBtn) nextBtn.addEventListener('click', onNext);
    dots.forEach(function (dot, i) { dot.addEventListener('click', onDotClick(i)); });
    if (carouselWrapper) {
        carouselWrapper.addEventListener('mouseenter', onMouseEnter);
        carouselWrapper.addEventListener('mouseleave', onMouseLeave);
    }
    track.addEventListener('touchstart', onTouchStart, { passive: true });
    track.addEventListener('touchmove', onTouchMove, { passive: true });
    track.addEventListener('touchend', onTouchEnd);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('visibilitychange', onVisibility);

    // Entrance animation
    slides.forEach(function (slide) {
        var text = slide.querySelector('.carousel-text');
        var image = slide.querySelector('.carousel-image');
        if (text) {
            text.style.opacity = '0';
            text.style.transform = 'translateX(-30px)';
            text.style.transition = 'opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s';
        }
        if (image) {
            image.style.opacity = '0';
            image.style.transform = 'translateX(30px)';
            image.style.transition = 'opacity 0.8s ease 0.4s, transform 0.8s ease 0.4s';
        }
    });
    function animateCurrentSlide() {
        slides.forEach(function (slide) {
            var text = slide.querySelector('.carousel-text');
            var image = slide.querySelector('.carousel-image');
            if (text) { text.style.opacity = '0'; text.style.transform = 'translateX(-30px)'; }
            if (image) { image.style.opacity = '0'; image.style.transform = 'translateX(30px)'; }
        });
        var current = slides[currentIndex];
        if (!current) return;
        var text = current.querySelector('.carousel-text');
        var image = current.querySelector('.carousel-image');
        if (text) { text.style.opacity = '1'; text.style.transform = 'translateX(0)'; }
        if (image) { image.style.opacity = '1'; image.style.transform = 'translateX(0)'; }
    }
    var animTimer = setTimeout(animateCurrentSlide, 100);
    track.addEventListener('transitionend', animateCurrentSlide);

    startAutoPlay();

    return {
        destroy: function () {
            destroyed = true;
            clearTimeout(animTimer);
            stopAutoPlay();
            if (prevBtn) prevBtn.removeEventListener('click', onPrev);
            if (nextBtn) nextBtn.removeEventListener('click', onNext);
            if (carouselWrapper) {
                carouselWrapper.removeEventListener('mouseenter', onMouseEnter);
                carouselWrapper.removeEventListener('mouseleave', onMouseLeave);
            }
            track.removeEventListener('touchstart', onTouchStart);
            track.removeEventListener('touchmove', onTouchMove);
            track.removeEventListener('touchend', onTouchEnd);
            track.removeEventListener('transitionend', animateCurrentSlide);
            document.removeEventListener('keydown', onKeydown);
            document.removeEventListener('visibilitychange', onVisibility);
        }
    };
}

function smCarouselBoot() {
    var track = document.getElementById('carouselTrack');
    if (!track) return;   // admin editor pages reuse the builders only — no boot

    var engine = null;
    var lastKey = '';

    function mount() {
        if (engine) { try { engine.destroy(); } catch (e) {} }
        engine = smCarouselEngine();
    }
    function render(slides) {
        track.innerHTML = slides.map(smCarouselSlideHtml).join('');
        smCarouselBuildDots(slides.length);
        track.style.transform = 'translateX(0%)';
    }

    // 1) Paint instantly from the last known set (if any), keep static slides otherwise
    var cached = smCarouselCacheGet();
    if (cached.length) {
        render(cached);
        lastKey = smCarouselKey(cached);
    }
    mount();

    // 2) Revalidate in the background — admin edits appear on the next visit
    smCarouselFetch().then(function (slides) {
        if (!slides.length) return;                       // no custom slides → keep built-ins
        var key = smCarouselKey(slides);
        if (key === lastKey) return;                      // nothing changed
        lastKey = key;
        render(slides);
        mount();
        smCarouselCacheSet(slides);
    }).catch(function () { /* offline or rules hiccup — static slides keep the page alive */ });
}

document.addEventListener('DOMContentLoaded', smCarouselBoot);

/** Exposed for the admin editor (preview + shared sanitising + defaults import). */
window.smCarouselNormalize = smCarouselNormalize;
window.smCarouselSlideHtml = smCarouselSlideHtml;
window.smCarouselSafeHref = smCarouselSafeHref;
window.smCarouselEsc = smCarouselEsc;
window.smCarouselPick = smCarouselPick;
window.smCarouselDefaultDocs = smCarouselDefaultDocs;

// Export (legacy)
window.Carousel = { init: smCarouselEngine };
