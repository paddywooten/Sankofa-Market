/**
 * Sankofa Market - Publish Page JavaScript
 */

// Category-specific specification templates
const categorySpecs = {
    'electronics': {
        'phones': [
            { id: 'brand', label: 'Brand', placeholder: 'e.g. Samsung, Apple, Xiaomi' },
            { id: 'model', label: 'Model', placeholder: 'e.g. iPhone 15, Galaxy S24' },
            { id: 'storage', label: 'Storage', placeholder: 'e.g. 128GB, 256GB, 512GB' },
            { id: 'ram', label: 'RAM', placeholder: 'e.g. 6GB, 8GB, 12GB' },
            { id: 'color', label: 'Color', placeholder: 'e.g. Black, White, Blue' },
            { id: 'network', label: 'Network', placeholder: 'e.g. 5G, 4G LTE' },
            { id: 'condition', label: 'Condition', placeholder: 'e.g. New, Like New, Used' },
            { id: 'warranty', label: 'Warranty', placeholder: 'e.g. 1 year, 6 months' }
        ],
        'default': [
            { id: 'brand', label: 'Brand', placeholder: 'e.g. Samsung, LG, Sony' },
            { id: 'model', label: 'Model', placeholder: 'e.g. Model name or number' },
            { id: 'color', label: 'Color', placeholder: 'e.g. Black, Silver, White' },
            { id: 'year', label: 'Year', placeholder: 'e.g. 2024, 2023' },
            { id: 'condition', label: 'Condition', placeholder: 'e.g. New, Refurbished, Used' },
            { id: 'warranty', label: 'Warranty', placeholder: 'e.g. 1 year, 6 months' }
        ]
    },
    'fashion': [
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Nike, Adidas, Gucci' },
        { id: 'size', label: 'Size', placeholder: 'e.g. M, L, 42, 10' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Black, Blue, Red' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Cotton, Leather, Polyester' },
        { id: 'gender', label: 'Gender', placeholder: 'e.g. Men, Women, Unisex' },
        { id: 'style', label: 'Style', placeholder: 'e.g. Casual, Formal, Sport' },
        { id: 'condition', label: 'Condition', placeholder: 'e.g. New, Like New, Vintage' }
    ],
    'vehicles': [
        { id: 'make', label: 'Make', placeholder: 'e.g. Toyota, Honda, Ford' },
        { id: 'model', label: 'Model', placeholder: 'e.g. Camry, Civic, F-150' },
        { id: 'year', label: 'Year', placeholder: 'e.g. 2020, 2021, 2022' },
        { id: 'mileage', label: 'Mileage', placeholder: 'e.g. 50,000 km, 30,000 miles' },
        { id: 'fuelType', label: 'Fuel Type', placeholder: 'e.g. Petrol, Diesel, Electric' },
        { id: 'transmission', label: 'Transmission', placeholder: 'e.g. Automatic, Manual' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Black, White, Silver' },
        { id: 'engineSize', label: 'Engine Size', placeholder: 'e.g. 2.0L, 1.5L' }
    ],
    'musical-instruments': [
        { id: 'type', label: 'Type', placeholder: 'e.g. Guitar, Piano, Drums' },
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Yamaha, Fender, Roland' },
        { id: 'model', label: 'Model', placeholder: 'e.g. Model name or number' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Wood, Metal, Plastic' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Natural, Black, Sunburst' },
        { id: 'year', label: 'Year', placeholder: 'e.g. 2020, 2021' },
        { id: 'condition', label: 'Condition', placeholder: 'e.g. New, Used, Vintage' },
        { id: 'accessories', label: 'Accessories', placeholder: 'e.g. Case, Strap, Picks' }
    ],
    'home-garden': [
        { id: 'type', label: 'Type', placeholder: 'e.g. Furniture, Appliance, Decor' },
        { id: 'brand', label: 'Brand', placeholder: 'e.g. IKEA, Samsung, Philips' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Wood, Metal, Fabric' },
        { id: 'color', label: 'Color', placeholder: 'e.g. White, Brown, Grey' },
        { id: 'dimensions', label: 'Dimensions', placeholder: 'e.g. 100x50x80 cm' },
        { id: 'weight', label: 'Weight', placeholder: 'e.g. 10kg, 5kg' },
        { id: 'condition', label: 'Condition', placeholder: 'e.g. New, Like New, Used' }
    ],
    'sports': [
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Nike, Adidas, Wilson' },
        { id: 'sport', label: 'Sport', placeholder: 'e.g. Football, Basketball, Tennis' },
        { id: 'size', label: 'Size', placeholder: 'e.g. Size 5, Medium, Large' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Leather, Synthetic, Rubber' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Black, White, Multi' },
        { id: 'condition', label: 'Condition', placeholder: 'e.g. New, Used, Like New' }
    ],
    'books-media': [
        { id: 'author', label: 'Author/Artist', placeholder: 'e.g. J.K. Rowling, Drake' },
        { id: 'title', label: 'Title', placeholder: 'e.g. Book or Album title' },
        { id: 'format', label: 'Format', placeholder: 'e.g. Hardcover, Paperback, CD, Vinyl' },
        { id: 'year', label: 'Year', placeholder: 'e.g. 2020, 2021' },
        { id: 'language', label: 'Language', placeholder: 'e.g. English, French, Spanish' },
        { id: 'condition', label: 'Condition', placeholder: 'e.g. New, Like New, Good' }
    ],
    'baby-kids': [
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Fisher-Price, Chicco' },
        { id: 'ageGroup', label: 'Age Group', placeholder: 'e.g. 0-6 months, 2-4 years' },
        { id: 'type', label: 'Type', placeholder: 'e.g. Toy, Clothing, Gear' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Cotton, Plastic, Wood' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Pink, Blue, Yellow' },
        { id: 'condition', label: 'Condition', placeholder: 'e.g. New, Like New, Used' }
    ],
    'beauty-health': [
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Maybelline, Nivea, Apple' },
        { id: 'type', label: 'Type', placeholder: 'e.g. Skincare, Makeup, Fitness' },
        { id: 'skinType', label: 'Skin Type', placeholder: 'e.g. Oily, Dry, Combination' },
        { id: 'volume', label: 'Volume/Size', placeholder: 'e.g. 50ml, 100g' },
        { id: 'expiryDate', label: 'Expiry Date', placeholder: 'e.g. 12/2025' },
        { id: 'condition', label: 'Condition', placeholder: 'e.g. New, Sealed, Opened' }
    ],
    'food-groceries': [
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Nestle, Coca-Cola' },
        { id: 'type', label: 'Type', placeholder: 'e.g. Beverage, Snack, Fresh' },
        { id: 'weight', label: 'Weight/Volume', placeholder: 'e.g. 500g, 1L, 1kg' },
        { id: 'expiryDate', label: 'Expiry Date', placeholder: 'e.g. 12/2025' },
        { id: 'packaging', label: 'Packaging', placeholder: 'e.g. Bottle, Box, Can' },
        { id: 'quantity', label: 'Quantity', placeholder: 'e.g. 1 pack, 6 bottles' }
    ],
    'pets': [
        { id: 'breed', label: 'Breed/Type', placeholder: 'e.g. Labrador, Persian Cat' },
        { id: 'age', label: 'Age', placeholder: 'e.g. 2 months, 1 year' },
        { id: 'gender', label: 'Gender', placeholder: 'e.g. Male, Female' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Golden, Black, White' },
        { id: 'vaccinated', label: 'Vaccinated', placeholder: 'e.g. Yes, No, Partial' },
        { id: 'health', label: 'Health Status', placeholder: 'e.g. Healthy, Special needs' }
    ],
    'jobs-skills': [
        { id: 'jobType', label: 'Job Type', placeholder: 'e.g. Full-time, Part-time, Contract' },
        { id: 'experience', label: 'Experience Required', placeholder: 'e.g. 2 years, Entry level' },
        { id: 'qualification', label: 'Qualification', placeholder: 'e.g. Degree, Certificate' },
        { id: 'skills', label: 'Key Skills', placeholder: 'e.g. Python, Marketing, Design' },
        { id: 'salary', label: 'Salary Range', placeholder: 'e.g. GHS 2,000 - 3,000' },
        { id: 'location', label: 'Work Location', placeholder: 'e.g. Remote, On-site, Hybrid' }
    ],
    'real-estate': [
        { id: 'propertyType', label: 'Property Type', placeholder: 'e.g. Apartment, House, Land' },
        { id: 'bedrooms', label: 'Bedrooms', placeholder: 'e.g. 2, 3, 4' },
        { id: 'bathrooms', label: 'Bathrooms', placeholder: 'e.g. 1, 2, 3' },
        { id: 'area', label: 'Area', placeholder: 'e.g. 120 sqm, 1500 sqft' },
        { id: 'yearBuilt', label: 'Year Built', placeholder: 'e.g. 2020, 2015' },
        { id: 'furnishing', label: 'Furnishing', placeholder: 'e.g. Furnished, Semi, Unfurnished' },
        { id: 'parking', label: 'Parking', placeholder: 'e.g. 1 space, 2 spaces, None' },
        { id: 'amenities', label: 'Amenities', placeholder: 'e.g. Pool, Gym, Security' }
    ],
    'others': [
        { id: 'type', label: 'Type', placeholder: 'e.g. Item type or category' },
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Brand name (if applicable)' },
        { id: 'model', label: 'Model', placeholder: 'e.g. Model name or number' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Black, White, Blue' },
        { id: 'size', label: 'Size/Dimensions', placeholder: 'e.g. Small, Medium, 100x50cm' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Wood, Metal, Plastic' },
        { id: 'condition', label: 'Condition', placeholder: 'e.g. New, Used, Like New' },
        { id: 'year', label: 'Year', placeholder: 'e.g. 2024, 2023' }
    ],
    'default': [
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Brand name' },
        { id: 'model', label: 'Model', placeholder: 'e.g. Model name or number' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Black, White, Blue' },
        { id: 'size', label: 'Size', placeholder: 'e.g. Small, Medium, Large' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Wood, Metal, Plastic' },
        { id: 'condition', label: 'Condition', placeholder: 'e.g. New, Used, Like New' }
    ]
};

/**
 * Initialize category-specific specifications
 */
function initCategorySpecs() {
    const categorySelect = document.getElementById('category');
    if (!categorySelect) return;

    // Update specs when category changes
    categorySelect.addEventListener('change', updateSpecifications);

    // Initialize with current category
    updateSpecifications();
}

/**
 * Update specifications based on selected category
 */
function updateSpecifications() {
    const categorySelect = document.getElementById('category');
    const container = document.getElementById('specificationsContainer');
    
    if (!categorySelect || !container) return;

    const category = categorySelect.value;
    let specs = categorySpecs[category] || categorySpecs['default'];

    // Handle subcategories for electronics
    if (category === 'electronics') {
        // For now, use default electronics specs
        // Can be extended to detect phones vs laptops vs TVs
        specs = categorySpecs['electronics']['default'];
    }

    // Generate HTML for spec fields
    let html = '';
    specs.forEach(function(spec) {
        html += `
            <div class="form-group">
                <label for="spec${spec.id.charAt(0).toUpperCase() + spec.id.slice(1)}">${spec.label}</label>
                <input type="text" id="spec${spec.id.charAt(0).toUpperCase() + spec.id.slice(1)}" name="spec${spec.id.charAt(0).toUpperCase() + spec.id.slice(1)}" placeholder="${spec.placeholder}">
            </div>
        `;
    });

    container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', function() {
    initPhotoUpload();
    initCharCounters();
    initDeliveryOptions();
    initFormSubmission();
    initCategorySpecs(); // Initialize dynamic specifications
});

// ============================================================================
// PHOTO UPLOAD (instant background upload with progress)
// ============================================================================

// Global photo upload state:
// Each entry: { id, dataUrl, status: 'compressing'|'uploading'|'done'|'error',
//               progress, url, error, promise, cancel }
window.photoUploads = window.photoUploads || [];

function initPhotoUpload() {
    const photoInput = document.getElementById('photoInput');
    const photoGrid = document.getElementById('photoGrid');
    const uploadBtn = document.getElementById('photoUploadBtn');
    
    photoInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        
        if (window.photoUploads.length + files.length > 4) {
            showFlashMessage('Maximum 4 photos allowed', 'warning');
            return;
        }
        
        // Start processing + uploading each file immediately in the background
        files.forEach(function(file) {
            if (!file.type.startsWith('image/')) return;
            
            // Enforce 5MB file size limit
            if (file.size > 5 * 1024 * 1024) {
                showFlashMessage('"' + (file.name || 'Image') + '" is ' + Math.round(file.size / 1024 / 1024) + 'MB. Max 5MB allowed.', 'error');
                return;
            }
            
            addAndUploadPhoto(file);
        });
        
        // Reset input so same file can be selected again
        this.value = '';
    });
    
    renderPhotoPreviews();
    
    function addAndUploadPhoto(file) {
        var photo = {
            id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            dataUrl: null,
            status: 'compressing',
            progress: 0,
            url: null,
            error: null,
            resolvePromise: null,
            rejectPromise: null
        };
        
        // Promise that resolves when this photo is fully uploaded (or rejects on failure)
        photo.promise = new Promise(function(resolve, reject) {
            photo.resolvePromise = resolve;
            photo.rejectPromise = reject;
        });
        
        window.photoUploads.push(photo);
        renderPhotoPreviews();
        processPhoto(photo, file);
    }
    
    async function processPhoto(photo, file) {
        try {
            // Step 1: Compress
            photo.status = 'compressing';
            photo.progress = 0;
            updatePhotoStatusUI(photo);
            var compressed, thumbCompressed = null;
            try {
                // Does this seller want OUR mark on their photos? (On by default; untick if you
                // already watermark your own — two marks on top of each other are unreadable.)
                var wantMark = true;
                var markBox = document.getElementById('addWatermark');
                if (markBox) wantMark = !!markBox.checked;

                if (typeof prepareListingPhoto === 'function') {
                    // Full picture capped at 300KB + a small preview for lists
                    var prepared = wantMark
                        ? await prepareListingPhoto(file)
                        : await prepareListingPhoto(file, { watermark: false });
                    compressed = prepared.full.dataUrl;
                    thumbCompressed = prepared.thumb.dataUrl;
                    photo.fullBytes = prepared.full.bytes;
                    photo.thumbBytes = prepared.thumb.bytes;
                    console.log('🖼️ ' + file.name + ': full ' + Math.round(prepared.full.bytes/1024) + 'KB (' +
                        prepared.full.width + '×' + prepared.full.height + '), preview ' +
                        Math.round(prepared.thumb.bytes/1024) + 'KB (' + prepared.thumb.width + '×' + prepared.thumb.height + ')');
                } else if (typeof compressImage === 'function') {
                    compressed = await compressImage(file);
                } else {
                    compressed = await readFileAsDataURL(file);
                }
            } catch (err) {
                compressed = await readFileAsDataURL(file);
            }
            photo.dataUrl = compressed;
            if (thumbCompressed) photo.thumbDataUrl = thumbCompressed;
            updatePhotoPreviewImage(photo);
            
            // Step 2: Upload to Firebase Storage immediately (if logged in + Firebase ready)
            var canUploadNow = (typeof firebase !== 'undefined' && firebase.auth &&
                firebase.auth().currentUser && typeof firebaseStorage !== 'undefined' && firebaseStorage);
            
            if (canUploadNow) {
                await uploadPhotoInBackground(photo);
            } else {
                // Not logged in yet or Firebase unavailable — keep compressed data URL,
                // it will be uploaded at publish time.
                photo.status = 'done';
                photo.progress = 100;
                photo.url = null; // null signals "upload at publish time"
                updatePhotoStatusUI(photo);
                updatePhotosSummary();
                if (photo.resolvePromise) photo.resolvePromise(photo);
            }
        } catch (err) {
            console.error('Photo processing error:', err);
            photo.status = 'error';
            photo.error = err.message || 'Upload failed';
            updatePhotoStatusUI(photo);
            updatePhotosSummary();
            if (photo.rejectPromise) photo.rejectPromise(err);
        }
    }
}

function readFileAsDataURL(file) {
    return new Promise(function(resolve, reject) {
        var r = new FileReader();
        r.onload = function(e) { resolve(e.target.result); };
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

/**
 * Upload one photo to Firebase Storage in the background with live progress
 */
async function uploadPhotoInBackground(photo) {
    var user = firebase.auth().currentUser;
    var stamp = Date.now() + '_' + photo.id;
    var path = 'products/' + user.uid + '/' + stamp + '.jpg';
    var thumbPath = 'products/' + user.uid + '/thumbs/' + stamp + '_thumb.jpg';
    
    photo.status = 'uploading';
    updatePhotoStatusUI(photo);
    
    try {
        var response = await fetch(photo.dataUrl);
        var blob = await response.blob();
        
        var result = await new Promise(function(resolve, reject) {
            var fileRef = firebaseStorage.ref().child(path);
            var task = fileRef.put(blob);
            photo.cancel = function() { task.cancel(); };
            
            task.on('state_changed',
                function(snapshot) {
                    var percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    photo.progress = percent;
                    updatePhotoProgressUI(photo);
                },
                function(error) {
                    if (error.code === 'storage/canceled') return; // silent
                    reject(error);
                },
                async function() {
                    try {
                        var downloadURL = await task.snapshot.ref.getDownloadURL();
                        resolve({ url: downloadURL });
                    } catch (err) { reject(err); }
                }
            );
        });
        
        // Upload the small preview too (used by listings/homepage/search)
        try {
            var thumbData = photo.thumbDataUrl || photo.dataUrl;
            var thumbBlob = await (await fetch(thumbData)).blob();
            if (thumbBlob.size < blob.size) {
                var thumbRef = firebaseStorage.ref().child(thumbPath);
                await new Promise(function (resolve, reject) {
                    var thumbTask = thumbRef.put(thumbBlob);
                    thumbTask.on('state_changed', null, reject, function () { resolve(); });
                });
                photo.thumbUrl = await thumbRef.getDownloadURL();
            } else {
                photo.thumbUrl = result.url;
            }
        } catch (thumbErr) {
            console.warn('Preview upload skipped, full picture will be used:', thumbErr && thumbErr.message);
            photo.thumbUrl = result.url;
        }

        photo.status = 'done';
        photo.progress = 100;
        photo.url = result.url;
        updatePhotoStatusUI(photo);
        updatePhotosSummary();
        if (photo.resolvePromise) photo.resolvePromise(photo);
    } catch (err) {
        console.error('Background upload error:', err);
        photo.status = 'error';
        photo.error = err.message || 'Upload failed';
        updatePhotoStatusUI(photo);
        updatePhotosSummary();
        if (photo.rejectPromise) photo.rejectPromise(err);
    }
}

/**
 * Retry a failed photo upload
 */
function retryPhotoUpload(photoId) {
    var photo = window.photoUploads.find(function(p) { return p.id === photoId; });
    if (!photo || !photo.dataUrl) return;
    
    photo.error = null;
    photo.progress = 0;
    photo.promise = new Promise(function(resolve, reject) {
        photo.resolvePromise = resolve;
        photo.rejectPromise = reject;
    });
    
    var canUploadNow = (typeof firebase !== 'undefined' && firebase.auth &&
        firebase.auth().currentUser && typeof firebaseStorage !== 'undefined' && firebaseStorage);
    
    if (canUploadNow) {
        uploadPhotoInBackground(photo);
    } else {
        photo.status = 'done';
        photo.progress = 100;
        photo.url = null;
        updatePhotoStatusUI(photo);
        updatePhotosSummary();
        if (photo.resolvePromise) photo.resolvePromise(photo);
    }
}

/**
 * Remove a photo (cancels in-flight upload, deletes uploaded file best-effort)
 */
function removePhotoUpload(photoId) {
    var index = window.photoUploads.findIndex(function(p) { return p.id === photoId; });
    if (index === -1) return;
    var photo = window.photoUploads[index];
    
    // Cancel in-flight upload
    if (photo.status === 'uploading' && typeof photo.cancel === 'function') {
        try { photo.cancel(); } catch (e) {}
    }
    
    // Delete already-uploaded file from Storage (best effort)
    if (photo.url && photo.url.indexOf('firebasestorage') !== -1 && typeof firebaseStorage !== 'undefined' && firebaseStorage) {
        try { firebaseStorage.refFromURL(photo.url).delete().catch(function() {}); } catch (e) {}
    }
    
    window.photoUploads.splice(index, 1);
    renderPhotoPreviews();
}

/**
 * Render all photo previews from global state
 */
function renderPhotoPreviews() {
    var photoGrid = document.getElementById('photoGrid');
    var uploadBtn = document.getElementById('photoUploadBtn');
    if (!photoGrid || !uploadBtn) return;
    
    // Remove existing previews and summary
    photoGrid.querySelectorAll('.photo-preview').forEach(function(p) { p.remove(); });
    var oldSummary = document.getElementById('photosUploadSummary');
    if (oldSummary) oldSummary.remove();
    
    window.photoUploads.forEach(function(photo, index) {
        var preview = document.createElement('div');
        preview.className = 'photo-preview';
        preview.id = 'preview_' + photo.id;
        preview.innerHTML =
            '<img src="' + (photo.dataUrl || '') + '" alt="Photo ' + (index + 1) + '" loading="lazy" style="' + (photo.dataUrl ? '' : 'display:none;') + '">' +
            '<div class="photo-upload-overlay" id="overlay_' + photo.id + '">' +
                '<div class="photo-upload-status"><i class="fas fa-compress-arrows-alt fa-spin"></i> Compressing...</div>' +
                '<div class="photo-progress-track"><div class="photo-progress-fill" style="width:0%"></div></div>' +
            '</div>' +
            '<button type="button" class="remove-photo" onclick="removePhotoUpload(\'' + photo.id + '\')">' +
                '<i class="fas fa-times"></i>' +
            '</button>' +
            (index === 0 ? '<span class="cover-badge">Cover</span>' : '');
        photoGrid.insertBefore(preview, uploadBtn);
    });
    
    // Hide upload button if max reached
    uploadBtn.style.display = window.photoUploads.length >= 4 ? 'none' : 'flex';
    
    // Add summary row after the grid
    if (window.photoUploads.length > 0) {
        var summary = document.createElement('div');
        summary.id = 'photosUploadSummary';
        summary.className = 'photos-upload-summary';
        photoGrid.parentNode.insertBefore(summary, photoGrid.nextSibling);
    }
    
    window.photoUploads.forEach(function(photo) {
        updatePhotoStatusUI(photo);
    });
    updatePhotosSummary();
}

function updatePhotoPreviewImage(photo) {
    var preview = document.getElementById('preview_' + photo.id);
    if (!preview) return;
    var img = preview.querySelector('img');
    if (img && photo.dataUrl) {
        img.src = photo.dataUrl;
        img.style.display = '';
    }
}

/**
 * Update the status/progress UI of one photo
 */
function updatePhotoStatusUI(photo) {
    var preview = document.getElementById('preview_' + photo.id);
    if (!preview) return;
    var overlay = document.getElementById('overlay_' + photo.id);
    if (!overlay) return;
    var statusEl = overlay.querySelector('.photo-upload-status');
    var fill = overlay.querySelector('.photo-progress-fill');
    
    if (photo.status === 'compressing') {
        overlay.style.display = 'flex';
        overlay.className = 'photo-upload-overlay uploading';
        if (statusEl) statusEl.innerHTML = '<i class="fas fa-compress-arrows-alt fa-spin"></i> Compressing...';
        if (fill) fill.style.width = '0%';
    } else if (photo.status === 'uploading') {
        overlay.style.display = 'flex';
        overlay.className = 'photo-upload-overlay uploading';
        if (statusEl) statusEl.innerHTML = '<i class="fas fa-cloud-upload-alt fa-spin"></i> Uploading... ' + photo.progress + '%';
        if (fill) fill.style.width = photo.progress + '%';
    } else if (photo.status === 'done') {
        // Show a brief "done" flash then hide the overlay
        overlay.style.display = 'flex';
        overlay.className = 'photo-upload-overlay done';
        if (statusEl) statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Uploaded';
        if (fill) fill.style.width = '100%';
        var id = photo.id;
        setTimeout(function() {
            var ov = document.getElementById('overlay_' + id);
            if (ov) ov.style.display = 'none';
        }, 1200);
    } else if (photo.status === 'error') {
        overlay.style.display = 'flex';
        overlay.className = 'photo-upload-overlay error';
        if (statusEl) statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed — <button type="button" class="photo-retry-btn" onclick="retryPhotoUpload(\'' + photo.id + '\')">Retry</button>';
        if (fill) { fill.style.width = '100%'; fill.style.background = '#e74c3c'; }
    }
}

/**
 * Fast progress updates (called many times per second during upload)
 */
function updatePhotoProgressUI(photo) {
    var overlay = document.getElementById('overlay_' + photo.id);
    if (!overlay) return;
    var statusEl = overlay.querySelector('.photo-upload-status');
    var fill = overlay.querySelector('.photo-progress-fill');
    if (statusEl) statusEl.innerHTML = '<i class="fas fa-cloud-upload-alt fa-spin"></i> Uploading... ' + photo.progress + '%';
    if (fill) fill.style.width = photo.progress + '%';
}

/**
 * Update the overall summary line under the photo grid
 */
function updatePhotosSummary() {
    var summary = document.getElementById('photosUploadSummary');
    if (!summary) return;
    
    var total = window.photoUploads.length;
    if (total === 0) { summary.remove(); return; }
    
    var done = window.photoUploads.filter(function(p) { return p.status === 'done'; }).length;
    var active = window.photoUploads.filter(function(p) { return p.status === 'uploading' || p.status === 'compressing'; }).length;
    var errors = window.photoUploads.filter(function(p) { return p.status === 'error'; }).length;
    
    if (errors > 0) {
        summary.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:#e74c3c;"></i> ' +
            errors + ' photo' + (errors > 1 ? 's' : '') + ' failed to upload — tap Retry on the photo to try again';
        summary.style.color = '#e74c3c';
    } else if (active > 0) {
        summary.innerHTML = '<i class="fas fa-cloud-upload-alt fa-spin" style="color:#0064d2;"></i> ' +
            'Uploading photos in the background... <strong>' + done + ' of ' + total + '</strong> done — keep filling the form!';
        summary.style.color = '#0064d2';
    } else if (done === total) {
        summary.innerHTML = '<i class="fas fa-check-circle" style="color:#22c55e;"></i> ' +
            'All ' + total + ' photo' + (total > 1 ? 's' : '') + ' uploaded and ready!';
        summary.style.color = '#22c55e';
    }
}

/**
 * Wait until every photo upload has finished.
 * Retries failed ones once. Throws if any still failing.
 * Returns a status line for the UI while waiting.
 */
async function ensureAllPhotosUploaded(onWaiting) {
    // Retry any failed uploads once
    window.photoUploads.filter(function(p) { return p.status === 'error'; }).forEach(function(p) {
        retryPhotoUpload(p.id);
    });
    
    // Wait for anything still in flight
    var pending = window.photoUploads.filter(function(p) {
        return p.status === 'compressing' || p.status === 'uploading';
    });
    
    if (pending.length > 0 && typeof onWaiting === 'function') {
        onWaiting(pending.length);
    }
    
    await Promise.all(pending.map(function(p) {
        return p.promise.catch(function() {});
    }));
    
    // Anything still failed?
    var failed = window.photoUploads.filter(function(p) { return p.status === 'error'; });
    if (failed.length > 0) {
        throw new Error(failed.length + ' photo(s) failed to upload. Please retry or remove them.');
    }
}

/**
 * Get final photo URLs for the product document.
 * Photos uploaded early return their Storage URL;
 * photos uploaded while logged out return their data URL (uploaded at publish time).
 */
function getUploadedPhotoUrls() {
    return window.photoUploads
        .filter(function(p) { return p.status === 'done'; })
        .map(function(p) { return p.url || p.dataUrl; });
}

// ============================================================================
// CHARACTER COUNTERS
// ============================================================================

function initCharCounters() {
    const titleInput = document.getElementById('title');
    const descInput = document.getElementById('description');
    const titleCount = document.getElementById('titleCount');
    const descCount = document.getElementById('descCount');
    
    titleInput.addEventListener('input', () => {
        titleCount.textContent = titleInput.value.length;
    });
    
    descInput.addEventListener('input', () => {
        descCount.textContent = descInput.value.length;
    });
}

// ============================================================================
// DELIVERY OPTIONS
// ============================================================================

function initDeliveryOptions() {
    const deliveryRadios = document.querySelectorAll('input[name="delivery"]');
    const deliveryFeeSection = document.getElementById('deliveryFeeSection');
    const deliveryFeeInput = document.getElementById('deliveryFee');
    const deliveryAreasSection = document.getElementById('deliveryAreasSection');
    const deliveryAreasInput = document.getElementById('deliveryAreas');
    const deliveryAreasLabel = document.getElementById('deliveryAreasLabel');
    const deliveryAreasHint = document.getElementById('deliveryAreasHint');
    const pickupLocationSection = document.getElementById('pickupLocationSection');
    const pickupAddressInput = document.getElementById('pickupAddress');

    if (!deliveryRadios.length || !deliveryFeeSection) return;

    // Listen to all delivery radio buttons
    deliveryRadios.forEach(function(radio) {
        radio.addEventListener('change', function() {
            // Hide all conditional sections first
            deliveryFeeSection.style.display = 'none';
            deliveryFeeInput.removeAttribute('required');
            if (deliveryAreasSection) deliveryAreasSection.style.display = 'none';
            if (pickupLocationSection) pickupLocationSection.style.display = 'none';
            if (pickupAddressInput) pickupAddressInput.removeAttribute('required');
            
            // Clear inputs when hiding sections
            deliveryFeeInput.value = '';
            if (deliveryAreasInput) deliveryAreasInput.value = '';
            
            // Show relevant section based on selection
            if (this.value === 'paid-delivery' && this.checked) {
                // Show delivery fee + areas sections
                deliveryFeeSection.style.display = 'block';
                deliveryFeeInput.setAttribute('required', 'required');
                if (deliveryAreasSection) deliveryAreasSection.style.display = 'block';
                if (deliveryAreasLabel) deliveryAreasLabel.textContent = 'Areas You Deliver To';
                if (deliveryAreasHint) deliveryAreasHint.textContent = 'Optional: List specific areas where you deliver';
            } else if (this.value === 'free-delivery' && this.checked) {
                // Show areas section for free delivery
                if (deliveryAreasSection) deliveryAreasSection.style.display = 'block';
                if (deliveryAreasLabel) deliveryAreasLabel.textContent = 'Areas You Deliver to for Free';
                if (deliveryAreasHint) deliveryAreasHint.textContent = 'Optional: List the areas where you offer free delivery';
            } else if (this.value === 'pickup' && this.checked && pickupLocationSection) {
                // Show pickup location section when "Pickup Only" is selected
                pickupLocationSection.style.display = 'block';
                if (pickupAddressInput) {
                    pickupAddressInput.setAttribute('required', 'required');
                }
            }
        });
    });

    // Initialize on page load - check which radio is selected
    const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
    if (selectedDelivery) {
        if (selectedDelivery.value === 'paid-delivery') {
            deliveryFeeSection.style.display = 'block';
            if (deliveryAreasSection) deliveryAreasSection.style.display = 'block';
        } else if (selectedDelivery.value === 'free-delivery') {
            if (deliveryAreasSection) deliveryAreasSection.style.display = 'block';
            if (deliveryAreasLabel) deliveryAreasLabel.textContent = 'Areas You Deliver to for Free';
            if (deliveryAreasHint) deliveryAreasHint.textContent = 'Optional: List the areas where you offer free delivery';
        } else if (selectedDelivery.value === 'pickup' && pickupLocationSection) {
            pickupLocationSection.style.display = 'block';
            if (pickupAddressInput) {
                pickupAddressInput.setAttribute('required', 'required');
            }
        } else {
            deliveryFeeSection.style.display = 'none';
            if (deliveryAreasSection) deliveryAreasSection.style.display = 'none';
            if (pickupLocationSection) pickupLocationSection.style.display = 'none';
        }
    } else {
        deliveryFeeSection.style.display = 'none';
        if (deliveryAreasSection) deliveryAreasSection.style.display = 'none';
        if (pickupLocationSection) pickupLocationSection.style.display = 'none';
    }
}

// ============================================================================
// FORM SUBMISSION
// ============================================================================

// Guards against a publish being started twice (double click, Enter + click, a retry while the
// first one is still working). Set at the top of the submit handler, cleared in its finally.
var publishing = false;
var published = false;

function initFormSubmission() {
    const form = document.getElementById('publishForm');
    const publishBtn = document.getElementById('publishBtn');
    const saveDraftBtn = document.getElementById('saveDraftBtn');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // ONE publish at a time.
        // The account checks below read your profile from the server and take a second or two.
        // The button used to sit there looking idle for that whole time, so a second click
        // started a second, complete publish — which is how the same item got listed twice.
        // The lock is taken here, before the first await, and the spinner goes up immediately.
        if (publishing) {
            console.log('Publish already in progress — ignoring the extra click.');
            return;
        }

        // Validate
        if (!validateForm()) return;
        
        // Check if user is logged in
        if (!isLoggedIn()) {
            showFlashMessage('Please sign in to publish a listing', 'warning');
            setTimeout(() => {
                window.location.href = 'pages/auth/login.html?redirect=publish.html';
            }, 1500);
            return;
        }
        
        publishing = true;
        published = false;
        const stopLoading = showLoading(publishBtn);   // instant feedback, before any waiting
        try {

        // Check if user account is approved
        if (typeof firebaseAuth !== 'undefined' && typeof firebaseDB !== 'undefined') {
            const user = firebaseAuth.currentUser;
            if (user) {
                // Fetch from server first (avoids stale offline cache showing
                // an old 'not verified' state after admin verifies the user)
                let userDoc;
                try {
                    userDoc = await firebaseDB.collection('users').doc(user.uid).get({ source: 'server' });
                } catch (serverErr) {
                    console.warn('Server fetch failed, using cache:', serverErr.message);
                    userDoc = await firebaseDB.collection('users').doc(user.uid).get();
                }
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    console.log('📋 Publish check — verified:', userData.verified, '| verificationStatus:', userData.verificationStatus, '| sellerTier:', userData.sellerTier);
                    
                    if (userData.status === 'pending') {
                        showFlashMessage('⚠️ Your account is pending admin approval. Please wait for an admin to approve your account before publishing listings.', 'warning');
                        console.warn('Account status: pending - cannot publish');
                        return;
                    } else if (userData.status === 'rejected') {
                        showFlashMessage('Your account registration was rejected. Please contact support for more information.', 'error');
                        return;
                    }
                    
                    // ============================================================
                    // SELLER TIER SYSTEM — Premium (paid) replaces Ghana Card
                    // Active-listing limits per plan:
                    //   Starter (free)   10   •  5% commission
                    //   Bronze   GHS 45  30   •  2%
                    //   Silver   GHS 79  75   •  1.5%
                    //   Gold     GHS 129 200  •  1.2%
                    //   Diamond  GHS 199 unlimited (fair use 1000) • 1%
                    // Sold / paused listings never count against the limit.
                    // ============================================================
                    var planUser = userData || {};
                    var planLimit = (typeof listingLimitForUser === 'function')
                        ? listingLimitForUser(planUser)
                        : 10;

                    // Legacy: existing verified sellers keep their promoted status
                    var sellerTier = planUser.sellerTier || 'starter';
                    if (sellerTier === 'starter' && (planUser.verified === true || planUser.verificationStatus === 'approved')) {
                        try {
                            var ordersSnap = await firebaseDB.collection('orders')
                                .where('userId', '==', user.uid)
                                .where('status', '==', 'completed')
                                .get();
                            if (ordersSnap.size >= 2) {
                                sellerTier = 'verified';
                                await firebaseDB.collection('users').doc(user.uid).update({ sellerTier: 'verified' });
                            }
                        } catch (e) { console.warn('Tier check error:', e); }
                    }

                    // Count my active listings once (used by the check + the counter on screen)
                    try {
                        var mineSnap = await firebaseDB.collection('products')
                            .where('sellerId', '==', user.uid).get();
                        var mineActive = 0;
                        mineSnap.forEach(function (d) {
                            var x = d.data() || {};
                            if (x.isActive !== false && x.isSold !== true) mineActive++;
                        });
                        window.__myActiveListingCount = mineActive;
                    } catch (countErr) {
                        console.warn('Could not count your active listings:', countErr);
                    }

                    // Enforce the plan's active-listing limit (admins are not limited)
                    try {
                        var isAdminUser = planUser.role === 'admin';
                        if (!isAdminUser && activeCountOfMine().count >= planLimit) {
                            showPlanLimitMessage(planLimit, activeCountOfMine().count, planUser);
                            setTimeout(function () {
                                window.location.href = 'pages/user/become-seller.html';
                            }, 4000);
                            return;
                        }
                    } catch (limitErr) {
                        console.warn('Could not check the listing limit (allowing publish):', limitErr);
                    }
                }
            }
        }
        
        // Collect form data
        const formData = collectFormData();

        // (the loading state went up at the top of this handler, before the first await)

        var listingVideoUploadFailed = false;
        var listingVideoAttached = false;
        var listingProductId = null;
        try {
            if (typeof firebaseDB !== 'undefined') {
                // Upload to Firebase
                console.log('📤 Publishing to Firebase...', formData);
                var publishResult = await publishToFirebase(formData);
                if (publishResult && publishResult.duplicateOf) {
                    if (publishResult.videoUploadFailed) {
                        showFlashMessage('This listing already exists, but the video could not be attached. Try again from My Listings → Edit.', 'warning');
                        return;
                    }
                    published = true;
                    if (publishResult.videoAttached) {
                        var duplicateProductId = publishResult.productId || publishResult.duplicateOf;
                        showFlashMessage('Video added to your existing listing. Opening it now…', 'success');
                        setTimeout(function () {
                            window.location.href = 'product-detail.html?id=' + encodeURIComponent(duplicateProductId);
                        }, 1800);
                    } else {
                        // No video was selected: keep the original duplicate guard behavior.
                        setTimeout(function () { window.location.href = 'pages/user/listings.html'; }, 1800);
                    }
                    return;
                }
                console.log('✅ Published successfully!');
                listingVideoUploadFailed = !!(publishResult && publishResult.videoUploadFailed);
                listingVideoAttached = !!(publishResult && publishResult.videoAttached);
                listingProductId = publishResult && publishResult.productId ? publishResult.productId : null;
            } else {
                // Demo mode - simulate success
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            published = true;      // stays locked: the page is about to navigate away
            if (listingVideoUploadFailed){
                showFlashMessage('Your listing was published, but the video did not upload. Open My Listings to try again.', 'warning');
            } else if (listingVideoAttached) {
                showFlashMessage('Listing published with video. Opening it now…', 'success');
            } else {
                showFlashMessage('Listing published successfully! 🎉', 'success');
            }
            setTimeout(() => {
                if (listingVideoUploadFailed) {
                    window.location.href = 'pages/user/listings.html';
                } else if (listingVideoAttached && listingProductId) {
                    window.location.href = 'product-detail.html?id=' + encodeURIComponent(listingProductId);
                } else {
                    window.location.href = 'index.html';
                }
            }, 1800);
        } catch (error) {
            console.error('Publish error:', error);
            showFlashMessage('Error publishing listing. Please try again.', 'error');
        }
        } finally {
            // Any ending that is NOT a successful publish (a refusal, the listing limit, an
            // error) hands the button back so the seller can try again. A success keeps the
            // lock, so a late click cannot slip a second copy in while the page navigates.
            if (!published) {
                publishing = false;
                try { stopLoading(); } catch (e) {}
            }
        }
    });
    
    saveDraftBtn.addEventListener('click', function() {
        const formData = collectFormData();
        // Photos are not stored in drafts (too large for localStorage)
        formData.photos = [];
        localStorage.setItem('sankofa_draft', JSON.stringify(formData));
        showFlashMessage('Draft saved! (Note: photos are not saved in drafts — please re-select them before publishing)', 'success');
    });
    
    // Load draft if exists
    const draft = localStorage.getItem('sankofa_draft');
    if (draft) {
        try {
            const data = JSON.parse(draft);
            if (data.title) document.getElementById('title').value = data.title;
            if (data.category) document.getElementById('category').value = data.category;
            if (data.description) document.getElementById('description').value = data.description;
            if (data.price) document.getElementById('price').value = data.price;
            if (data.city) document.getElementById('city').value = data.city;
            if (data.region) document.getElementById('region').value = data.region;
            if (data.variants && typeof variantEditorFill === 'function') variantEditorFill(data.variants);
            
            // Load delivery option (single selection)
            if (data.deliveryOption) {
                // Reset all conditional sections first
                var feeSecEl = document.getElementById('deliveryFeeSection');
                var areasSecEl = document.getElementById('deliveryAreasSection');
                var pickupSecEl = document.getElementById('pickupLocationSection');
                if (feeSecEl) feeSecEl.style.display = 'none';
                if (areasSecEl) areasSecEl.style.display = 'none';
                if (pickupSecEl) pickupSecEl.style.display = 'none';

                const deliveryRadio = document.querySelector(`input[name="delivery"][value="${data.deliveryOption}"]`);
                if (deliveryRadio) {
                    deliveryRadio.checked = true;
                    // Show delivery fee + areas sections if paid delivery is selected
                    if (data.deliveryOption === 'paid-delivery') {
                        document.getElementById('deliveryFee').value = data.deliveryFee || '';
                        if (feeSecEl) feeSecEl.style.display = 'block';
                        if (areasSecEl) areasSecEl.style.display = 'block';
                        var lbl = document.getElementById('deliveryAreasLabel');
                        if (lbl) lbl.textContent = 'Areas You Deliver To';
                    }
                    // Show areas section if free delivery is selected
                    if (data.deliveryOption === 'free-delivery') {
                        if (areasSecEl) areasSecEl.style.display = 'block';
                        var lblFree = document.getElementById('deliveryAreasLabel');
                        if (lblFree) lblFree.textContent = 'Areas You Deliver to for Free';
                    }
                    // Show pickup location section if pickup is selected
                    if (data.deliveryOption === 'pickup') {
                        if (pickupSecEl) {
                            pickupSecEl.style.display = 'block';
                            if (data.pickupLocation) {
                                document.getElementById('pickupAddress').value = data.pickupLocation.address || '';
                                document.getElementById('digitalAddress').value = data.pickupLocation.digitalAddress || '';
                                document.getElementById('pickupNotes').value = data.pickupLocation.notes || '';
                            }
                        }
                    }
                }
                if (data.deliveryAreas) {
                    document.getElementById('deliveryAreas').value = data.deliveryAreas;
                }
            }
            
            // Update counters
            document.getElementById('titleCount').textContent = data.title?.length || 0;
            document.getElementById('descCount').textContent = data.description?.length || 0;
        } catch (e) {}
    }
}

function validateForm() {
    // Sizes and colours the buyer can choose from (optional). Problems are shown under the editor.
    if (typeof variantEditorRead === 'function') {
        var choiceCheck = variantEditorRead();
        var choiceBox = document.getElementById('variantProblems');
        if (choiceBox) choiceBox.textContent = choiceCheck.problems.join(' ');
        if (choiceCheck.problems.length) {
            showFlashMessage(choiceCheck.problems[0], 'error');
            var firstChoice = document.getElementById('variantName1');
            if (firstChoice) firstChoice.focus();
            return false;
        }
    }
    const title = document.getElementById('title').value.trim();
    const category = document.getElementById('category').value;
    const condition = document.querySelector('input[name="condition"]:checked');
    const description = document.getElementById('description').value.trim();
    const price = document.getElementById('price').value;
    const region = document.getElementById('region').value;
    const city = document.getElementById('city').value.trim();
    const phone = document.getElementById('phone').value.trim();
    
    // Check if a delivery option is selected (radio button)
    const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
    
    if (!selectedDelivery) {
        showFlashMessage('Please select a delivery option', 'error');
        return false;
    }
    
    // Validate delivery fee if paid delivery is selected
    if (selectedDelivery.value === 'paid-delivery') {
        const deliveryFee = document.getElementById('deliveryFee').value;
        if (!deliveryFee || deliveryFee < 0) {
            showFlashMessage('Please enter a valid delivery fee', 'error');
            return false;
        }
    }
    
    // Validate pickup address if pickup only is selected
    if (selectedDelivery.value === 'pickup') {
        const pickupAddress = document.getElementById('pickupAddress').value.trim();
        if (!pickupAddress) {
            showFlashMessage('Please provide a pickup address for buyers', 'error');
            document.getElementById('pickupAddress').focus();
            return false;
        }
    }
    
    if (!title) {
        showFlashMessage('Please enter a title', 'error');
        return false;
    }
    if (!category) {
        showFlashMessage('Please select a category', 'error');
        return false;
    }
    if (!condition) {
        showFlashMessage('Please select the condition', 'error');
        return false;
    }
    if (!description) {
        showFlashMessage('Please add a description', 'error');
        return false;
    }
    if (!price || price < 1) {
        showFlashMessage('Please enter a valid price', 'error');
        return false;
    }
    if (!region) {
        showFlashMessage('Please select a region', 'error');
        return false;
    }
    if (!city) {
        showFlashMessage('Please enter your city', 'error');
        return false;
    }
    if (!phone) {
        showFlashMessage('Please enter your phone number', 'error');
        return false;
    }
    
    return true;
}

function collectFormData() {
    // Get selected delivery option (single selection with radio buttons)
    const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
    const deliveryOption = selectedDelivery ? selectedDelivery.value : null;

    // Collect specifications (only non-empty fields)
    const specifications = {};
    var specFields = ['Brand', 'Model', 'Color', 'Size', 'Material', 'Year', 'Warranty', 'Weight', 'Extra'];
    specFields.forEach(function(field) {
        var el = document.getElementById('spec' + field);
        if (el && el.value.trim()) {
            specifications[field.toLowerCase()] = el.value.trim();
        }
    });

    // Collect pickup location data if pickup is selected
    const pickupLocation = deliveryOption === 'pickup' ? {
        address: document.getElementById('pickupAddress').value.trim(),
        digitalAddress: document.getElementById('digitalAddress').value.trim() || null,
        notes: document.getElementById('pickupNotes').value.trim() || null
    } : null;

    return {
        title: document.getElementById('title').value.trim(),
        category: document.getElementById('category').value,
        condition: document.querySelector('input[name="condition"]:checked')?.value,
        description: document.getElementById('description').value.trim(),
        price: parseInt(document.getElementById('price').value),
        negotiable: document.getElementById('negotiable').checked,
        region: document.getElementById('region').value,
        city: document.getElementById('city').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        showPhone: document.getElementById('showPhone').checked,
        deliveryOption: deliveryOption,
        deliveryFee: deliveryOption === 'paid-delivery' ? parseFloat(document.getElementById('deliveryFee').value) : null,
        deliveryAreas: document.getElementById('deliveryAreas').value.trim(),
        pickupLocation: pickupLocation,
        specifications: Object.keys(specifications).length > 0 ? specifications : null,
        photos: getUploadedPhotoUrls(),
        variants: (typeof variantEditorRead === 'function' && variantEditorRead().groups.length) ? variantEditorRead().groups : null,
        createdAt: new Date().toISOString()
    };
}

async function attachVideoToExistingListing(productId, userId, draft, existingProduct) {
    var videoPath = window.SankofaListingVideo.storagePath(userId, productId);
    var oldPath = String(existingProduct && existingProduct.videoStoragePath || '');
    var status = document.getElementById('listingVideoStatus');
    var uploadComplete = false;
    function setStatus(message) { if (status) status.textContent = message; }

    try {
        setStatus('This listing already exists. Adding the video to it… 0%');
        await window.SankofaListingVideo.upload(draft.blob, userId, productId, function(percent) {
            setStatus(percent >= 100
                ? 'Finishing upload with Firebase…'
                : 'This listing already exists. Adding the video to it… ' + percent + '%');
        });
        uploadComplete = true;

        var videoPatch = {
            videoStoragePath: videoPath,
            videoDurationSeconds: Math.min(30, Number(draft.durationSeconds) || 30),
            videoWidth: Number(draft.width) || null,
            videoHeight: Number(draft.height) || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await firebaseDB.collection('products').doc(productId).update(videoPatch);
        } catch (updateError) {
            if (oldPath !== videoPath) {
                await window.SankofaListingVideo.delete(videoPath);
                throw updateError;
            }
            // The listing already points at this fixed path, so a successful upload is live
            // even if updating the descriptive dimensions/duration failed.
            console.warn('Video uploaded to the existing listing path, but its details could not be refreshed:', updateError && updateError.message);
            window._smListingVideoDraft = null;
            window._smListingVideoSelected = false;
            setStatus('Video attached. Some video details could not be refreshed; open the product page to check it.');
            return { videoAttached: true, productId: productId, videoPath: videoPath, videoMetadataUpdateFailed: true };
        }

        window._smListingVideoDraft = null;
        window._smListingVideoSelected = false;
        setStatus('Video uploaded and attached to your existing listing.');
        return { videoAttached: true, productId: productId, videoPath: videoPath };
    } catch (error) {
        if (!uploadComplete && oldPath !== videoPath) {
            await window.SankofaListingVideo.delete(videoPath);
        }
        var message = error && error.message ? error.message : 'Video upload failed.';
        setStatus('The video could not be attached to your existing listing: ' + message + ' You can try again from My Listings → Edit.');
        return { videoUploadFailed: true, videoUploadMessage: message };
    }
}

async function publishToFirebase(data) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Not authenticated');

    // If a premium video is still being converted on this device, wait before publishing.
    if (window._smListingVideoProcessing) await window._smListingVideoProcessing;
    if (window._smListingVideoSelected && !window._smListingVideoDraft) {
        throw new Error(window._smListingVideoError || 'Wait for the video to finish processing or choose it again.');
    }
    
    // Photos have been uploading in the background since they were selected.
    // Wait for any still in flight (retries failed ones once).
    await ensureAllPhotosUploaded(function(pendingCount) {
        showFlashMessage('Waiting for ' + pendingCount + ' photo upload(s) to finish...', 'info');
    });
    
    // Photos already uploaded in the background vs. ones still waiting
    var pendingPhotos = window.photoUploads.filter(function(p) { return !p.url && p.dataUrl; });
    var needsUpload = pendingPhotos.map(function(p) { return p.dataUrl; });

    // Build BOTH lists in the same order so images[i] and imagesThumb[i] match
    var photoURLs = [];
    var thumbURLs = [];
    window.photoUploads.forEach(function(p) {
        if (p.url) {
            photoURLs.push(p.url);
            thumbURLs.push(p.thumbUrl || p.url);
        }
    });

    // Only show upload progress UI if some photos still need uploading
    var progressUI = null;
    if (needsUpload.length > 0) {
        progressUI = createUploadProgressUI();
        var formActions = document.querySelector('.form-actions');
        if (formActions) {
            formActions.parentNode.insertBefore(progressUI.container, formActions);
        }
        
        try {
            for (let i = 0; i < pendingPhotos.length; i++) {
                updateUploadProgressUI(progressUI, {
                    currentImage: i + 1,
                    totalImages: pendingPhotos.length,
                    percent: 0,
                    status: 'uploading'
                });

                const pending = pendingPhotos[i];
                const url = await uploadPhotoToStorage(pending.dataUrl, user.uid, i, function(percent) {
                    updateUploadProgressUI(progressUI, {
                        currentImage: i + 1,
                        totalImages: pendingPhotos.length,
                        percent: percent,
                        status: 'uploading'
                    });
                });
                // and its small preview
                let thumbUrl = url;
                try {
                    thumbUrl = await uploadPhotoToStorage(pending.thumbDataUrl || pending.dataUrl, user.uid, i, null, 'thumbs', true);
                } catch (thumbErr) {
                    console.warn('Preview upload failed, using full picture:', thumbErr && thumbErr.message);
                }
                photoURLs.push(url);
                thumbURLs.push(thumbUrl);
            }
        } catch (error) {
            if (progressUI.container && progressUI.container.parentNode) {
                progressUI.container.remove();
            }
            throw error;
        }
    } else if (window.photoUploads.length > 0) {
        // All photos were pre-uploaded — show a quick confirmation flash
        var quickUI = createUploadProgressUI();
        var formActions2 = document.querySelector('.form-actions');
        if (formActions2) {
            formActions2.parentNode.insertBefore(quickUI.container, formActions2);
        }
        updateUploadProgressUI(quickUI, {
            currentImage: window.photoUploads.length,
            totalImages: window.photoUploads.length,
            percent: 100,
            status: 'uploading'
        });
        progressUI = quickUI;
    }
    
    try {
        // Saving to Firestore
        if (progressUI) {
            updateUploadProgressUI(progressUI, {
                currentImage: Math.max(window.photoUploads.length, 1),
                totalImages: Math.max(window.photoUploads.length, 1),
                percent: 100,
                status: 'saving'
            });
        }
        
        // Check if seller is Premium — boosted ads (tiered)
        var isPremiumSeller = false;
        var isActivePremiumForVideo = false;
        var boostLevel = 0;
        var tierForBoost = null;
        try {
            var uDoc = await firebaseDB.collection('users').doc(user.uid).get();
            if (uDoc.exists) {
                var ud = uDoc.data();
                isActivePremiumForVideo = !!(window.SankofaListingVideo && window.SankofaListingVideo.isActivePremiumSeller(ud));
                isPremiumSeller = ud.isPremium === true;
                if (isPremiumSeller && ud.premiumExpiry) {
                    var exp = ud.premiumExpiry.toDate ? ud.premiumExpiry.toDate() : new Date(ud.premiumExpiry);
                    if (exp <= new Date()) { isPremiumSeller = false; } else { tierForBoost = ud.premiumTier || ud.sellerTier || 'bronze'; }
                } else if (isPremiumSeller) { tierForBoost = ud.premiumTier || 'bronze'; }
                var map = {bronze:2, silver:4, gold:6, diamond:10};
                if (isPremiumSeller && tierForBoost) boostLevel = map[tierForBoost]||2;
                if (isPremiumSeller) console.log('⭐ Premium',tierForBoost,'boost',boostLevel+'×');
            }
        } catch(e){}

        // Create product document — Premium gets boosted + featured (higher tier = higher boost)
        // Who listed it — so the admin panel can show a name and email per listing
        var sellerNameForListing = user.displayName || '';
        try {
            var meDoc = await firebaseDB.collection('users').doc(user.uid).get();
            if (meDoc.exists) {
                var md = meDoc.data() || {};
                sellerNameForListing = md.name || [md.firstName, md.lastName].filter(Boolean).join(' ') || sellerNameForListing;
            }
        } catch (e) { /* fall back to the auth display name */ }

        var listingVideoDraft = window._smListingVideoDraft || null;
        if (window._smListingVideoSelected && !listingVideoDraft) {
            throw new Error(window._smListingVideoError || 'Wait for the video to finish processing or choose it again.');
        }
        if (listingVideoDraft && !isActivePremiumForVideo) {
            throw new Error('Only sellers with an active Premium plan can add a listing video.');
        }

        const productData = {
            ...data,
            photos: photoURLs,
            images: photoURLs,
            imagesThumb: thumbURLs,   // small versions for listing pages (see js/main.js)
            sellerId: user.uid,
            sellerName: sellerNameForListing || null,
            sellerEmail: user.email || null,
            sellerPhone: user.phoneNumber || null,
            isActive: true,
            isSold: false,
            isFeatured: isPremiumSeller && (tierForBoost==='gold' || tierForBoost==='diamond'),
            isBoosted: isPremiumSeller,
            boostLevel: boostLevel,
            boostedAt: isPremiumSeller ? firebase.firestore.FieldValue.serverTimestamp() : null,
            views: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // ---------------------------------------------------------------- duplicate guard
        // Last line of defence against the same listing being created twice (a double click, a
        // flaky connection where the write actually landed, two tabs, or a retry). If this
        // seller already has a listing with the same title created in the last two minutes, we
        // treat this publish as a repeat of that one instead of making a second copy.
        // Queried by sellerId only (a single-field index), then filtered here — so no new
        // composite index is needed.
        try {
            var titleKey = String(productData.title || '').trim().toLowerCase();
            if (titleKey) {
                var since = Date.now() - 2 * 60 * 1000;
                var mineSnap = await firebaseDB.collection('products')
                    .where('sellerId', '==', user.uid).get();
                var alreadyThere = null;
                var alreadyThereProduct = null;
                mineSnap.forEach(function (d) {
                    var x = d.data() || {};
                    if (String(x.title || '').trim().toLowerCase() !== titleKey) return;
                    var when = x.createdAt && x.createdAt.toDate ? x.createdAt.toDate().getTime()
                             : (x.createdAt ? new Date(x.createdAt).getTime() : 0);
                    if (when >= since) {
                        alreadyThere = d.id;
                        alreadyThereProduct = x;
                    }
                });
                if (alreadyThere) {
                    console.warn('Same listing was just published (' + alreadyThere + ') — not creating a second copy.');
                    window.__smLastPublishWasDuplicate = alreadyThere;
                    if (listingVideoDraft) {
                        var attachResult = await attachVideoToExistingListing(alreadyThere, user.uid, listingVideoDraft, alreadyThereProduct);
                        return Object.assign({ duplicateOf: alreadyThere }, attachResult);
                    }
                    showFlashMessage('This is the same listing you just published, so we did not create a second copy.', 'info');
                    return { duplicateOf: alreadyThere };
                }
            }
        } catch (dupErr) {
            // never block a real publish because the check could not run
            console.warn('Duplicate check skipped:', dupErr && dupErr.message);
        }

        var productRef = firebaseDB.collection('products').doc();
        var videoUploadFailed = false;
        var videoUploadMessage = '';
        var videoPath = null;
        if (listingVideoDraft){
            videoPath = window.SankofaListingVideo.storagePath(user.uid, productRef.id);
            productData.videoStoragePath = videoPath;
            productData.videoDurationSeconds = Math.min(30, Number(listingVideoDraft.durationSeconds) || 30);
            productData.videoWidth = Number(listingVideoDraft.width) || null;
            productData.videoHeight = Number(listingVideoDraft.height) || null;
        }
        await productRef.set(productData);
        if (listingVideoDraft){
            try {
                await window.SankofaListingVideo.upload(listingVideoDraft.blob, user.uid, productRef.id, function(percent){
                    var videoStatus = document.getElementById('listingVideoStatus');
                    if (videoStatus) videoStatus.textContent = percent >= 100
                        ? 'Finishing upload with Firebase…'
                        : 'Uploading processed video… ' + percent + '%';
                });
                window._smListingVideoDraft = null;
                window._smListingVideoSelected = false;
                var uploadedVideoStatus = document.getElementById('listingVideoStatus');
                if (uploadedVideoStatus) uploadedVideoStatus.textContent = 'Video uploaded and attached to the listing.';
            } catch (videoErr) {
                videoUploadFailed = true;
                videoUploadMessage = videoErr && videoErr.message ? videoErr.message : 'Video upload failed.';
                try {
                    await productRef.update({
                        videoStoragePath: firebase.firestore.FieldValue.delete(),
                        videoDurationSeconds: firebase.firestore.FieldValue.delete(),
                        videoWidth: firebase.firestore.FieldValue.delete(),
                        videoHeight: firebase.firestore.FieldValue.delete()
                    });
                } catch (cleanupDocErr) { console.warn('Could not clear failed video fields:', cleanupDocErr && cleanupDocErr.message); }
                await window.SankofaListingVideo.delete(videoPath);
                var videoStatusEl = document.getElementById('listingVideoStatus');
                if (videoStatusEl) videoStatusEl.textContent = 'Listing saved, but the video did not upload: ' + videoUploadMessage;
            }
        }
        
        // Done!
        if (progressUI) {
            updateUploadProgressUI(progressUI, {
                currentImage: Math.max(window.photoUploads.length, 1),
                totalImages: Math.max(window.photoUploads.length, 1),
                percent: 100,
                status: 'done'
            });
            
            // Remove progress UI after a moment
            setTimeout(function() {
                if (progressUI.container && progressUI.container.parentNode) {
                    progressUI.container.remove();
                }
            }, 1000);
        }
        return { videoUploadFailed: videoUploadFailed, videoUploadMessage: videoUploadMessage, videoAttached: !!listingVideoDraft && !videoUploadFailed, productId: productRef.id };
    } catch (error) {
        // Remove progress UI on error
        if (progressUI && progressUI.container && progressUI.container.parentNode) {
            progressUI.container.remove();
        }
        throw error;
    }
}

async function uploadPhotoToStorage(dataUrl, userId, index, onProgress, folder, isThumb) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const name = String(Date.now()) + '_' + index + (isThumb ? '_thumb' : '') + '.jpg';
    const path = folder
        ? `products/${userId}/${folder}/${name}`
        : `products/${userId}/${name}`;
    const result = await uploadFile(blob, path, onProgress);
    return result.url;
}

/**
 * Create upload progress UI elements
 */
function createUploadProgressUI() {
    var container = document.createElement('div');
    container.id = 'uploadProgressContainer';
    container.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem 1.5rem;margin-bottom:1rem;';
    
    container.innerHTML = 
        '<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;">' +
            '<div id="uploadProgressIcon" style="width:36px;height:36px;border-radius:50%;background:rgba(0,100,210,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
                '<i class="fas fa-cloud-upload-alt" style="color:#0064d2;font-size:0.95rem;"></i>' +
            '</div>' +
            '<div style="flex:1;">' +
                '<div style="font-weight:600;font-size:0.95rem;" id="uploadProgressTitle">Uploading image 1 of 1...</div>' +
                '<div style="font-size:0.8rem;color:#5a6572;" id="uploadProgressSub">Preparing upload...</div>' +
            '</div>' +
            '<div style="font-weight:700;font-size:1.1rem;color:#0064d2;" id="uploadProgressPercent">0%</div>' +
        '</div>' +
        '<div style="width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">' +
            '<div id="uploadProgressBar" style="height:100%;width:0%;border-radius:4px;background:linear-gradient(90deg,#0064d2,#0052b5);transition:width 0.3s ease;"></div>' +
        '</div>' +
        '<div style="display:flex;gap:0.3rem;margin-top:0.5rem;" id="uploadProgressDots"></div>';
    
    return {
        container: container,
        title: null,
        sub: null,
        percent: null,
        bar: null,
        icon: null,
        dots: null
    };
}

/**
 * Update upload progress UI
 */
function updateUploadProgressUI(ui, data) {
    var title = document.getElementById('uploadProgressTitle');
    var sub = document.getElementById('uploadProgressSub');
    var percent = document.getElementById('uploadProgressPercent');
    var bar = document.getElementById('uploadProgressBar');
    var icon = document.getElementById('uploadProgressIcon');
    var dots = document.getElementById('uploadProgressDots');
    
    if (!title || !bar) return;
    
    var overallPercent = Math.round(((data.currentImage - 1) / data.totalImages * 100) + (data.percent / data.totalImages));
    
    if (data.status === 'uploading') {
        title.textContent = 'Uploading image ' + data.currentImage + ' of ' + data.totalImages + '...';
        sub.textContent = 'Image ' + data.currentImage + ': ' + Math.round(data.percent) + '% uploaded';
        percent.textContent = overallPercent + '%';
        bar.style.width = overallPercent + '%';
        
        // Update dots
        var dotsHtml = '';
        for (var i = 1; i <= data.totalImages; i++) {
            if (i < data.currentImage) {
                dotsHtml += '<div style="width:24px;height:24px;border-radius:50%;background:#22c55e;color:white;display:flex;align-items:center;justify-content:center;font-size:0.65rem;"><i class="fas fa-check"></i></div>';
            } else if (i === data.currentImage) {
                dotsHtml += '<div style="width:24px;height:24px;border-radius:50%;background:#0064d2;color:white;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;">' + i + '</div>';
            } else {
                dotsHtml += '<div style="width:24px;height:24px;border-radius:50%;background:#e2e8f0;color:#5a6572;display:flex;align-items:center;justify-content:center;font-size:0.7rem;">' + i + '</div>';
            }
        }
        dots.innerHTML = dotsHtml;
    } else if (data.status === 'saving') {
        title.textContent = 'Saving listing...';
        sub.textContent = 'Creating your product listing';
        percent.textContent = '99%';
        bar.style.width = '99%';
        if (icon) icon.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#0064d2;font-size:0.95rem;"></i>';
    } else if (data.status === 'done') {
        title.textContent = 'Upload complete!';
        sub.textContent = 'All images uploaded successfully';
        percent.textContent = '100%';
        bar.style.width = '100%';
        bar.style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
        if (icon) {
            icon.style.background = 'rgba(34,197,94,0.1)';
            icon.innerHTML = '<i class="fas fa-check" style="color:#22c55e;font-size:0.95rem;"></i>';
        }
        percent.style.color = '#22c55e';
        
        // All dots green
        var allDoneHtml = '';
        for (var j = 1; j <= data.totalImages; j++) {
            allDoneHtml += '<div style="width:24px;height:24px;border-radius:50%;background:#22c55e;color:white;display:flex;align-items:center;justify-content:center;font-size:0.65rem;"><i class="fas fa-check"></i></div>';
        }
        dots.innerHTML = allDoneHtml;
    }
}

/* ============================================================================
   PLAN LIMITS — one shared table for the publish page (matches js/main.js and
   functions/index.js):  Starter 10 · Bronze 30 · Silver 75 · Gold 200 ·
   Diamond unlimited (fair use 1,000). Sold / paused listings do not count.
   ============================================================================ */
var DEFAULT_LISTING_LIMIT = 10;

function activeCountOfMine() {
    return { count: (typeof window.__myActiveListingCount === 'number') ? window.__myActiveListingCount : 0 };
}

function showPlanLimitMessage(limit, used, userData) {
    var tier = (userData && (userData.premiumTier || userData.sellerTier)) || 'starter';
    var label = tier === 'starter' ? 'the free Starter plan' : ('your ' + tier + ' plan');
    showFlashMessage('You have reached the limit of ' + limit + ' active listings on ' + label +
        ' (you have ' + used + '). Mark something as sold, remove a listing, or upgrade your plan for more.',
        'warning', 8000);
}

/** Shows "You are using X of N active listings" on the publish page. */
function renderListingQuota(used, userData) {
    if (used == null) used = activeCountOfMine().count;
    var limit = (typeof listingLimitForUser === 'function') ? listingLimitForUser(userData) : DEFAULT_LISTING_LIMIT;
    var box = document.getElementById('listingQuotaBox');
    if (!box) return;

    var isUnlimited = limit >= 1000;
    var left = Math.max(0, limit - used);
    var tight = !isUnlimited && used >= limit;
    var near = !isUnlimited && !tight && left <= 2;
    var color = tight ? '#b91c1c' : near ? '#b45309' : '#0064d2';
    var bg = tight ? '#fef2f2' : near ? '#fffbeb' : '#f0f7ff';
    var border = tight ? '#fecaca' : near ? '#fde68a' : '#bfdbfe';

    box.style.cssText = 'background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;padding:0.7rem 0.9rem;' +
        'margin:0 0 1rem;display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;font-size:0.85rem;';
    box.innerHTML =
        '<i class="fas fa-layer-group" style="color:' + color + ';"></i>' +
        '<span style="color:#374151;">' +
            (isUnlimited
                ? 'Your plan allows <strong>unlimited</strong> active listings — using <strong>' + used + '</strong>.'
                : 'You are using <strong>' + used + ' of ' + limit + '</strong> active listings' +
                  (tight ? ' — <strong style="color:' + color + ';">limit reached</strong>' : ' (' + left + ' left)') + '.') +
        '</span>' +
        (!isUnlimited
            ? '<a href="pages/user/become-seller.html" style="margin-left:auto;color:' + color + ';font-weight:700;text-decoration:none;white-space:nowrap;">More listings &amp; lower fees &rarr;</a>'
            : '') +
        '<span style="width:100%;font-size:0.75rem;color:#6b7280;">Sold or paused listings do not count towards this.</span>';
}

/** Reads the seller's plan + listing count, then draws the box. */
async function loadListingQuota(user) {
    try {
        if (!user) return;
        var box = document.getElementById('listingQuotaBox');
        if (box) box.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking your listing allowance…';
        var userData = null;
        try {
            var doc = await firebaseDB.collection('users').doc(user.uid).get();
            if (doc.exists) userData = doc.data();
        } catch (e) { /* plan unknown -> treated as free */ }
        var snap = await firebaseDB.collection('products').where('sellerId', '==', user.uid).get();
        var active = 0;
        snap.forEach(function (d) {
            var x = d.data() || {};
            if (x.isActive !== false && x.isSold !== true) active++;
        });
        window.__myActiveListingCount = active;
        renderListingQuota(active, userData);
    } catch (e) {
        var box2 = document.getElementById('listingQuotaBox');
        if (box2) box2.innerHTML = '';
    }
}

// Show the allowance once we know who is signed in
(function () {
    function hook() {
        try {
            if (typeof firebaseDB === 'undefined' || !firebaseDB) { setTimeout(hook, 600); return; }
            var auth = (typeof firebaseAuth !== 'undefined' && firebaseAuth) ? firebaseAuth : firebase.auth();
            auth.onAuthStateChanged(function (user) { if (user) loadListingQuota(user); });
        } catch (e) { setTimeout(hook, 900); }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook);
    else hook();
})();

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled “classic” <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.initCategorySpecs = initCategorySpecs;
window.updateSpecifications = updateSpecifications;
window.initPhotoUpload = initPhotoUpload;
window.readFileAsDataURL = readFileAsDataURL;
window.uploadPhotoInBackground = uploadPhotoInBackground;
window.retryPhotoUpload = retryPhotoUpload;
window.removePhotoUpload = removePhotoUpload;
window.renderPhotoPreviews = renderPhotoPreviews;
window.updatePhotoPreviewImage = updatePhotoPreviewImage;
window.updatePhotoStatusUI = updatePhotoStatusUI;
window.updatePhotoProgressUI = updatePhotoProgressUI;
window.updatePhotosSummary = updatePhotosSummary;
window.ensureAllPhotosUploaded = ensureAllPhotosUploaded;
window.getUploadedPhotoUrls = getUploadedPhotoUrls;
window.initCharCounters = initCharCounters;
window.initDeliveryOptions = initDeliveryOptions;
window.initFormSubmission = initFormSubmission;
window.validateForm = validateForm;
window.collectFormData = collectFormData;
window.publishToFirebase = publishToFirebase;
window.uploadPhotoToStorage = uploadPhotoToStorage;
window.createUploadProgressUI = createUploadProgressUI;
window.updateUploadProgressUI = updateUploadProgressUI;
window.activeCountOfMine = activeCountOfMine;
window.showPlanLimitMessage = showPlanLimitMessage;
window.renderListingQuota = renderListingQuota;
window.loadListingQuota = loadListingQuota;

