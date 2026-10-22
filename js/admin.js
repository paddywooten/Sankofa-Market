/**
 * Sankofa Market - Admin Dashboard JavaScript
 * Handles all admin dashboard functionality including product management
 */

document.addEventListener('DOMContentLoaded', function() {
    initAdminDashboard();
});

// ============================================================================
// ADMIN DASHBOARD INITIALIZATION
// ============================================================================

function initAdminDashboard() {
    initNavigation();
    initProductManagement();
    initUserManagement();
    initOrderManagement();
    initCategoryManagement();
    initReportsManagement();
    initSettings();
    initMobileMenu();
    initGlobalSearch();
    initLegalChecklist();
    initBottomNav();
    initSidebarCollapse();
    initLogout();
    loadAdminProducts();
    initStoreProfile();
    initStoreManagement();
    initStoreTabs();
    initCommissionRates();
    initAuctionCommissionSettings();
    initMaintenanceSettings();
    loadNavCounts();
    loadOrders();
    loadAdminWallets();
    loadAnalytics();
    // Refresh overview every 60s so stats stay correct after external changes
    try {
        setInterval(function(){
            if (document.getElementById('section-overview') && document.getElementById('section-overview').classList.contains('active')){
                if (typeof loadOverviewData === 'function') loadOverviewData();
            }
            if (typeof loadNavCounts === 'function') loadNavCounts();
        }, 60000);
        // Also refresh immediately after a short delay to catch async cache fills
        setTimeout(function(){ if (typeof loadOverviewData === 'function') loadOverviewData(); }, 1500);
        setTimeout(function(){ if (typeof loadNavCounts === 'function') loadNavCounts(); }, 2500);
    } catch(e){}
    // If hash is overview, load now
    if (window.location.hash.replace('#','') === 'overview' || !window.location.hash) {
        setTimeout(function(){ if (typeof loadOverviewData === 'function') loadOverviewData(); }, 800);
    }
    handleHashRouting();

    // Product filters are hooked up in initProductManagement()
}

function handleHashRouting() {
    // 2026-10-08: hash routing now loads section data too (shops was stuck on
    // its hardcoded "Loading shops..." row when opened via a #shops link).
    function loadForHash(h) {
        if (h === 'shops') {
            try { if (typeof loadShopsAdmin === 'function') loadShopsAdmin(); } catch(e){}
            try { if (typeof loadStoreBillingAdmin === 'function') loadStoreBillingAdmin(); } catch(e){}
            try { if (typeof loadPaymentsReadiness === 'function') loadPaymentsReadiness(); } catch(e){}
        }
        if (h === 'overview') {
            try { if (typeof loadOverviewData === 'function') loadOverviewData(); } catch(e){}
        }
        if (h === 'carousel') {
            try { if (typeof loadCarouselAdmin === 'function') loadCarouselAdmin(); } catch(e){}
        }
    }
    var hash = window.location.hash.replace('#','');
    if (!hash) return;
    var target = document.getElementById('section-' + hash);
    if (target) {
        document.querySelectorAll('.admin-section').forEach(function(s){ s.classList.remove('active'); });
        target.classList.add('active');
        document.querySelectorAll('.nav-item[data-section]').forEach(function(n){ n.classList.remove('active'); });
        var nav = document.querySelector('.nav-item[data-section="'+hash+'"]');
        if (nav) nav.classList.add('active');
        document.querySelectorAll('.bottom-nav-item').forEach(function(b){ b.classList.toggle('active', b.dataset.section===hash); });
        loadForHash(hash);
    }
    window.addEventListener('hashchange', function(){
        var h = window.location.hash.replace('#','');
        var sec = document.getElementById('section-' + h);
        if (sec) {
            document.querySelectorAll('.admin-section').forEach(function(s){ s.classList.remove('active'); });
            sec.classList.add('active');
            document.querySelectorAll('.nav-item[data-section]').forEach(function(n){ n.classList.toggle('active', n.dataset.section===h); });
            document.querySelectorAll('.bottom-nav-item').forEach(function(b){ b.classList.toggle('active', b.dataset.section===h); });
            window.scrollTo({top:0, behavior:'smooth'});
            loadForHash(h);
        }
    });
}

// ============================================================================
// NAVIGATION
// ============================================================================

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const sections = document.querySelectorAll('.admin-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;
            
            // Check if section exists
            const targetSection = document.getElementById(`section-${section}`);
            if (!targetSection) {
                console.warn(`Section not found: section-${section}`);
                return;
            }
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding section
            sections.forEach(sec => sec.classList.remove('active'));
            targetSection.classList.add('active');
            if (section === 'overview' && typeof loadOverviewData === 'function') {
                try { loadOverviewData(); } catch(err){}
            }
            if (section === 'orders' && typeof loadOrders === 'function') {
                try { loadOrders(); } catch(err){}
            }
            // 2026-10-08 fix: the shops loader was only wired to the BOTTOM nav
            // (switchSection inside initBottomNav). Top/sidebar nav clicks showed
            // the section but never loaded it — "Loading shops..." forever.
            if (section === 'shops' && typeof loadShopsAdmin === 'function') {
                try { loadShopsAdmin(); } catch(err){}
                try { if (typeof loadStoreBillingAdmin === 'function') loadStoreBillingAdmin(); } catch(err){}
                try { loadPaymentsReadiness(); } catch(err){}
            }
            if (section === 'carousel' && typeof loadCarouselAdmin === 'function') {
                try { loadCarouselAdmin(); } catch(err){}
            }
        });
    });
}

// ============================================================================
// LOGOUT
// ============================================================================

function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleAdminLogout();
        });
    }
}

async function handleAdminLogout() {
    if (!confirm('Are you sure you want to log out of the admin panel?')) {
        return;
    }

    try {
        // Sign out from Firebase Auth
        if (typeof firebase !== 'undefined' && firebase.auth) {
            await firebase.auth().signOut();
            console.log('✅ Admin logged out successfully');
        }

        // Clear any admin-related localStorage
        localStorage.removeItem('sankofa_user');
        localStorage.removeItem('admin_session');

        // Redirect to admin login page
        window.location.href = '/sm-panel/login';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    }
}

// ============================================================================
// PRODUCT MANAGEMENT
// ============================================================================

function initProductManagement() {
    const addProductBtn = document.getElementById('addProductBtn');
    const exportProductsBtn = document.getElementById('exportProductsBtn');
    const selectAllProducts = document.getElementById('selectAllProducts');
    const productSearch = document.getElementById('productSearch');
    const categoryFilter = document.getElementById('productCategoryFilter');
    const statusFilter = document.getElementById('productStatusFilter');
    
    // Add Product button
    if (addProductBtn) {
        addProductBtn.addEventListener('click', function() {
            openAddProductModal();
        });
    }
    
    // Export Products button
    if (exportProductsBtn) {
        exportProductsBtn.addEventListener('click', function() {
            exportProducts();
        });
    }
    
    // Select all products checkbox
    if (selectAllProducts) {
        selectAllProducts.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.product-check');
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            updateBulkActions();
        });
    }
    
    // Filter event listeners (using filterAdminProducts with store support)
    if (productSearch) {
        productSearch.addEventListener('input', debounce(function() {
            filterAdminProducts();
        }, 300));
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            filterAdminProducts();
        });
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            filterAdminProducts();
        });
    }
    
    // Initialize product action buttons
    initProductActions();
}

// initProductActions consolidated below (with Flag support) — legacy stub removed

// ============================================================================
// ADD PRODUCT MODAL
// ============================================================================

// Rebuild the category dropdown inside the Add Product modal from the live
// category list (built-ins + admin-made categories; disabled ones are already
// filtered out of adminCategoriesCache). ⚠️ This function went missing at some
// point while the CALL inside openAddProductModal stayed — every click on
// "Add Product" threw a ReferenceError right after the modal was drawn, so the
// form's submit listener never attached and the Publish button did nothing.
function loadCustomCategoriesIntoModal() {
    try {
        var sel = document.getElementById('productCategory');
        if (!sel || typeof adminCategoriesCache === 'undefined' || !adminCategoriesCache.length) return;
        var current = sel.value;
        var html = '<option value="">Select Category</option>';
        adminCategoriesCache.forEach(function(c) {
            if (!c || c.isActive === false) return;
            html += '<option value="' + c.id + '">' + escapeHtml(c.name || c.id) + '</option>';
        });
        sel.innerHTML = html;
        if (current) sel.value = current;
    } catch (e) { console.warn('category dropdown refresh skipped:', e && e.message); }
}

function openAddProductModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'addProductModal';
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h2>Add New Product</h2>
                <button class="modal-close" onclick="closeAddProductModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="addProductForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="productTitle">Product Title *</label>
                            <input type="text" id="productTitle" required placeholder="Enter product title">
                        </div>
                        <div class="form-group">
                            <label for="productCategory">Category *</label>
                            <select id="productCategory" required>
                                <option value="">Select Category</option>
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
                                <option value="musical-instruments">Musical Instruments</option>
                                <option value="others">Others</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="productDescription">Description *</label>
                        <textarea id="productDescription" required rows="4" placeholder="Describe your product in detail..."></textarea>
                    </div>
                    
                    <div class="form-group" style="border-top:1px solid #e5e5e5;padding-top:1rem;margin-top:0.5rem;">
                        <label style="font-size:0.9rem;color:#5a6572;"><i class="fas fa-list-ul"></i> Specifications <span style="font-weight:400;">(Optional - changes based on category)</span></label>
                        <div id="adminSpecsContainer" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.5rem;">
                            <p style="grid-column:1/-1;color:#5a6572;font-size:0.85rem;"><i class="fas fa-info-circle"></i> Select a category to see relevant specifications</p>
                        </div>
                        <input type="text" id="adminSpecExtra" placeholder="Additional specs (e.g. Waterproof, Bluetooth 5.0)" style="margin-top:0.5rem;">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="productPrice">Price (GHS) *</label>
                            <input type="number" id="productPrice" required min="0" step="0.01" placeholder="0.00">
                        </div>
                        <div class="form-group">
                            <label for="productCondition">Condition *</label>
                            <select id="productCondition" required>
                                <option value="">Select Condition</option>
                                <option value="new">New</option>
                                <option value="like-new">Like New</option>
                                <option value="good">Good</option>
                                <option value="fair">Fair</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Product Images *</label>
                        <div class="image-upload-area" id="productImageUpload">
                            <input type="file" id="productImages" multiple accept="image/*" style="display: none;">
                            <div class="upload-placeholder" onclick="document.getElementById('productImages').click()">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <p>Click to upload images (max 4)</p>
                                <small>JPG, PNG, WebP — max 5MB each</small>
                            </div>
                            <div class="image-preview" id="imagePreview"></div>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="productLocation">Location *</label>
                            <input type="text" id="productLocation" required placeholder="e.g., Accra, Ghana">
                        </div>
                        <div class="form-group">
                            <label for="productSeller">Seller *</label>
                            <select id="productSeller" required>
                                <option value="">Select Seller</option>
                                <option value="sankofa-store">🏪 Sankofa Store (Official)</option>
                                <optgroup label="Your Stores" id="storesDropdownGroup">
                                    <!-- Populated by JS -->
                                </optgroup>
                                <optgroup label="Other">
                                    <option value="verified-seller">Verified Seller</option>
                                    <option value="individual">Individual Seller</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>

                    <!-- Pre-order box (Sankofa Store only — revealing itself when that seller is picked) -->
                    <div id="adminPreOrderSection" style="background:#fff7e0;border:2px solid #f5af02;border-radius:8px;padding:1rem;margin-bottom:1rem;display:none;">
                        <label style="display:flex;align-items:center;gap:0.5rem;font-weight:700;color:#7a4a00;margin-bottom:0.4rem;cursor:pointer;font-size:0.92rem;">
                            <input type="checkbox" id="adminPreOrder" style="width:18px;height:18px;accent-color:#f5af02;">
                            📦 List this as a PRE-ORDER item
                        </label>
                        <div id="adminPreOrderFields" style="display:none;">
                            <div class="form-group">
                                <label for="adminPreOrderDate">Expected availability (optional)</label>
                                <input type="date" id="adminPreOrderDate">
                                <small style="color:#5a6572;font-size:0.8rem;">When the stock is expected to land — shown on the listing</small>
                            </div>
                            <div class="form-group">
                                <label for="adminPreOrderNote">Note for buyers (optional)</label>
                                <input type="text" id="adminPreOrderNote" placeholder="e.g. Dispatches 5–7 days after the stock arrives">
                                <small style="color:#5a6572;font-size:0.8rem;">Shown inside the gold pre-order banner on the product page</small>
                            </div>
                            <div class="form-group">
                                <label for="adminMinOrderQty">Minimum pieces per buyer — MOQ-A (optional)</label>
                                <input type="number" id="adminMinOrderQty" min="1" step="1" placeholder="e.g. 5 (leave empty for no minimum)">
                                <small style="color:#5a6572;font-size:0.8rem;">Buyers must order at least this many pieces — the cart enforces it, and the
                                server rejects anything smaller, so nobody can slip one piece past you.</small>
                            </div>
                            <div class="form-group">
                                <label for="adminPreOrderTarget">Batch target — MOQ-B (optional)</label>
                                <input type="number" id="adminPreOrderTarget" min="2" step="1" placeholder="e.g. 50 (leave empty for no target)">
                                <small style="color:#5a6572;font-size:0.8rem;">Total pieces that must sell for the batch to happen. Below target at the
                                deadline → every buyer is auto-refunded to their Sankofa Wallet.</small>
                            </div>
                            <div class="form-group" id="adminPreOrderDeadlineGroup" style="display:none;">
                                <label for="adminPreOrderDeadline">Batch deadline <strong style="color:#b45309;">(required with a target)</strong></label>
                                <input type="date" id="adminPreOrderDeadline">
                                <small style="color:#5a6572;font-size:0.8rem;">Last day buyers can join the batch.</small>
                            </div>
                            <small style="color:#7a4a00;font-size:0.78rem;display:block;margin-top:0.2rem;"><i class="fas fa-shield-alt"></i> Buyers pay now as usual; their money stays in escrow until they confirm delivery — a pre-order simply tells them dispatch happens later.</small>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Delivery Option (choose one)</label>
                        <div class="radio-group">
                            <label class="radio-label">
                                <input type="radio" name="delivery" value="free-delivery">
                                <span>Free Delivery</span>
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="delivery" value="paid-delivery">
                                <span>Paid Delivery</span>
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="delivery" value="pickup" checked>
                                <span>Pickup Only</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Delivery Areas Section (shown for Free Delivery AND Paid Delivery) -->
                    <div id="adminDeliveryAreasSection" style="background:#f0fdf4;border:2px solid #22c55e;border-radius:8px;padding:1rem;margin-bottom:1rem;display:none;">
                        <div class="form-group">
                            <label for="adminDeliveryAreas" id="adminDeliveryAreasLabel">Areas You Deliver To</label>
                            <input type="text" id="adminDeliveryAreas" placeholder="e.g. Accra, Tema, Kasoa, Madina">
                            <small style="color:#5a6572;font-size:0.8rem;">Optional: List specific areas where you deliver</small>
                        </div>
                    </div>
                    
                    <!-- Pickup Location Section (shown when Pickup Only is selected) -->
                    <div id="adminPickupLocationSection" style="background:#f0f9ff;border:2px solid #0ea5e9;border-radius:8px;padding:1rem;margin-bottom:1rem;">
                        <p style="margin:0 0 0.75rem;font-weight:600;color:#0369a1;font-size:0.9rem;"><i class="fas fa-map-marker-alt"></i> Pickup Location Details</p>
                        <div class="form-group">
                            <label for="adminPickupAddress">Pickup Address *</label>
                            <input type="text" id="adminPickupAddress" placeholder="e.g. 123 Main Street, East Legon, Accra">
                            <small style="color:#5a6572;font-size:0.8rem;">Provide a detailed address where buyers can pick up the item</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="adminDigitalAddress">Digital Address (GhanaPostGPS)</label>
                            <input type="text" id="adminDigitalAddress" placeholder="e.g. GA-123-4567">
                            <small style="color:#5a6572;font-size:0.8rem;">Optional: GhanaPostGPS digital address for precise location</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="adminPickupNotes">Pickup Instructions</label>
                            <textarea id="adminPickupNotes" rows="2" placeholder="e.g. Call 30 minutes before arrival, landmark: near XYZ mall"></textarea>
                            <small style="color:#5a6572;font-size:0.8rem;">Optional: Special instructions for buyers</small>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="productFeatured">
                            <span>Mark as Featured Product</span>
                        </label>
                    </div>
                    
                    <div class="form-group">
                        <label>Choices for buyers <small style="color:#5a6572;font-weight:400;">(optional: sizes or colours, buyers pick one of each)</small></label>
                        <datalist id="variantNameList"><option value="Size"><option value="Colour"><option value="Style"><option value="Material"><option value="Storage"><option value="Pack"></datalist>
                        <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:0.5rem;">
                            <input type="text" id="variantName1" list="variantNameList" maxlength="20" placeholder="First kind, e.g. Size">
                            <input type="text" id="variantOptions1" maxlength="200" placeholder="Choices, e.g. S, M, L, XL">
                            <input type="text" id="variantName2" list="variantNameList" maxlength="20" placeholder="Second kind, e.g. Colour">
                            <input type="text" id="variantOptions2" maxlength="200" placeholder="Choices, e.g. Red, Blue">
                        </div>
                        <small style="color:#5a6572;font-size:0.8rem;">There is no separate price or stock for each choice. The choice is checked when the item is paid for.</small>
                        <div id="variantProblems" role="alert" style="color:#b91c1c;font-size:0.85rem;"></div>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="closeAddProductModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-plus"></i> Add Product
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Initialize image upload
    initProductImageUpload();
    
    // Load stores into seller dropdown
    loadStoresIntoDropdown();
    
    // Load custom categories into category dropdown
    try { loadCustomCategoriesIntoModal(); } catch (e) { console.warn('category dropdown refresh skipped:', e && e.message); }
    
    // Initialize form submission
    const form = document.getElementById('addProductForm');
    form.addEventListener('submit', handleAddProduct);
    
    // Initialize category-specific specifications
    initAdminCategorySpecs();
    
    // Initialize delivery option show/hide logic
    initAdminDeliveryOptions();

    // Pre-order box: Sankofa Store only, fields unfold when ticked
    initAdminPreOrderBox();
}

function initAdminPreOrderBox() {
    var sellerSel = document.getElementById('productSeller');
    var section = document.getElementById('adminPreOrderSection');
    var chk = document.getElementById('adminPreOrder');
    var fields = document.getElementById('adminPreOrderFields');
    if (sellerSel && section) {
        sellerSel.addEventListener('change', function() {
            var isStore = this.value === 'sankofa-store';
            section.style.display = isStore ? 'block' : 'none';
            if (!isStore && chk) { chk.checked = false; if (fields) fields.style.display = 'none'; }
        });
    }
    if (chk && fields) {
        chk.addEventListener('change', function() {
            fields.style.display = this.checked ? 'block' : 'none';
        });
    }
    // Batch deadline only appears when a batch target is set (MOQ-B)
    var targetEl = document.getElementById('adminPreOrderTarget');
    var dlGroup = document.getElementById('adminPreOrderDeadlineGroup');
    if (targetEl && dlGroup) {
        targetEl.addEventListener('input', function() {
            dlGroup.style.display = (parseInt(this.value, 10) >= 2) ? 'block' : 'none';
        });
    }
}

/**
 * Show/hide pickup location section based on selected delivery option
 */
function initAdminDeliveryOptions() {
    var radios = document.querySelectorAll('#addProductModal input[name="delivery"]');
    var pickupSection = document.getElementById('adminPickupLocationSection');
    var areasSection = document.getElementById('adminDeliveryAreasSection');
    var areasLabel = document.getElementById('adminDeliveryAreasLabel');
    if (!radios.length || !pickupSection) return;

    function updateVisibility() {
        var selected = document.querySelector('#addProductModal input[name="delivery"]:checked');
        if (!selected) return;
        
        if (selected.value === 'pickup') {
            pickupSection.style.display = 'block';
            if (areasSection) areasSection.style.display = 'none';
        } else if (selected.value === 'free-delivery' || selected.value === 'paid-delivery') {
            pickupSection.style.display = 'none';
            if (areasSection) areasSection.style.display = 'block';
            if (areasLabel) {
                areasLabel.textContent = selected.value === 'free-delivery'
                    ? 'Areas You Deliver to for Free'
                    : 'Areas You Deliver To';
            }
        } else {
            pickupSection.style.display = 'none';
            if (areasSection) areasSection.style.display = 'none';
        }
    }

    radios.forEach(function(radio) {
        radio.addEventListener('change', updateVisibility);
    });

    // Initial state (pickup is checked by default)
    updateVisibility();
}

function closeAddProductModal() {
    const modal = document.getElementById('addProductModal');
    if (modal) {
        modal.remove();
    }
}

// Category-specific specification templates for admin
const adminCategorySpecs = {
    'electronics': [
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Samsung, Apple, LG' },
        { id: 'model', label: 'Model', placeholder: 'e.g. iPhone 15, Galaxy S24' },
        { id: 'storage', label: 'Storage', placeholder: 'e.g. 128GB, 256GB' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Black, White, Blue' },
        { id: 'year', label: 'Year', placeholder: 'e.g. 2024, 2023' },
        { id: 'warranty', label: 'Warranty', placeholder: 'e.g. 1 year, 6 months' }
    ],
    'fashion': [
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Nike, Adidas, Gucci' },
        { id: 'size', label: 'Size', placeholder: 'e.g. M, L, 42, 10' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Black, Blue, Red' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Cotton, Leather' },
        { id: 'gender', label: 'Gender', placeholder: 'e.g. Men, Women, Unisex' },
        { id: 'style', label: 'Style', placeholder: 'e.g. Casual, Formal, Sport' }
    ],
    'vehicles': [
        { id: 'make', label: 'Make', placeholder: 'e.g. Toyota, Honda, Ford' },
        { id: 'model', label: 'Model', placeholder: 'e.g. Camry, Civic, F-150' },
        { id: 'year', label: 'Year', placeholder: 'e.g. 2020, 2021' },
        { id: 'mileage', label: 'Mileage', placeholder: 'e.g. 50,000 km' },
        { id: 'fuelType', label: 'Fuel Type', placeholder: 'e.g. Petrol, Diesel, Electric' },
        { id: 'transmission', label: 'Transmission', placeholder: 'e.g. Automatic, Manual' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Black, White, Silver' }
    ],
    'musical-instruments': [
        { id: 'type', label: 'Type', placeholder: 'e.g. Guitar, Piano, Drums' },
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Yamaha, Fender, Roland' },
        { id: 'model', label: 'Model', placeholder: 'e.g. Model name' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Wood, Metal' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Natural, Black' },
        { id: 'year', label: 'Year', placeholder: 'e.g. 2020, 2021' },
        { id: 'accessories', label: 'Accessories', placeholder: 'e.g. Case, Strap, Picks' }
    ],
    'home-garden': [
        { id: 'type', label: 'Type', placeholder: 'e.g. Furniture, Appliance' },
        { id: 'brand', label: 'Brand', placeholder: 'e.g. IKEA, Samsung' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Wood, Metal, Fabric' },
        { id: 'color', label: 'Color', placeholder: 'e.g. White, Brown, Grey' },
        { id: 'dimensions', label: 'Dimensions', placeholder: 'e.g. 100x50x80 cm' },
        { id: 'weight', label: 'Weight', placeholder: 'e.g. 10kg, 5kg' }
    ],
    'sports': [
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Nike, Adidas, Wilson' },
        { id: 'sport', label: 'Sport', placeholder: 'e.g. Football, Basketball' },
        { id: 'size', label: 'Size', placeholder: 'e.g. Size 5, Medium' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Leather, Synthetic' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Black, White' }
    ],
    'books-media': [
        { id: 'author', label: 'Author/Artist', placeholder: 'e.g. J.K. Rowling' },
        { id: 'title', label: 'Title', placeholder: 'e.g. Book or Album title' },
        { id: 'format', label: 'Format', placeholder: 'e.g. Hardcover, Paperback, CD' },
        { id: 'year', label: 'Year', placeholder: 'e.g. 2020, 2021' },
        { id: 'language', label: 'Language', placeholder: 'e.g. English, French' }
    ],
    'baby-kids': [
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Fisher-Price, Chicco' },
        { id: 'ageGroup', label: 'Age Group', placeholder: 'e.g. 0-6 months, 2-4 years' },
        { id: 'type', label: 'Type', placeholder: 'e.g. Toy, Clothing, Gear' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Cotton, Plastic' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Pink, Blue, Yellow' }
    ],
    'beauty-health': [
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Maybelline, Nivea' },
        { id: 'type', label: 'Type', placeholder: 'e.g. Skincare, Makeup, Fitness' },
        { id: 'volume', label: 'Volume/Size', placeholder: 'e.g. 50ml, 100g' },
        { id: 'expiryDate', label: 'Expiry Date', placeholder: 'e.g. 12/2025' }
    ],
    'food-groceries': [
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Nestle, Coca-Cola' },
        { id: 'type', label: 'Type', placeholder: 'e.g. Beverage, Snack' },
        { id: 'weight', label: 'Weight/Volume', placeholder: 'e.g. 500g, 1L' },
        { id: 'expiryDate', label: 'Expiry Date', placeholder: 'e.g. 12/2025' },
        { id: 'quantity', label: 'Quantity', placeholder: 'e.g. 1 pack, 6 bottles' }
    ],
    'pets': [
        { id: 'breed', label: 'Breed/Type', placeholder: 'e.g. Labrador, Persian' },
        { id: 'age', label: 'Age', placeholder: 'e.g. 2 months, 1 year' },
        { id: 'gender', label: 'Gender', placeholder: 'e.g. Male, Female' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Golden, Black' },
        { id: 'vaccinated', label: 'Vaccinated', placeholder: 'e.g. Yes, No' }
    ],
    'jobs-skills': [
        { id: 'jobType', label: 'Job Type', placeholder: 'e.g. Full-time, Part-time' },
        { id: 'experience', label: 'Experience', placeholder: 'e.g. 2 years, Entry level' },
        { id: 'qualification', label: 'Qualification', placeholder: 'e.g. Degree, Certificate' },
        { id: 'skills', label: 'Key Skills', placeholder: 'e.g. Python, Marketing' },
        { id: 'salary', label: 'Salary Range', placeholder: 'e.g. GHS 2,000 - 3,000' }
    ],
    'real-estate': [
        { id: 'propertyType', label: 'Property Type', placeholder: 'e.g. Apartment, House' },
        { id: 'bedrooms', label: 'Bedrooms', placeholder: 'e.g. 2, 3, 4' },
        { id: 'bathrooms', label: 'Bathrooms', placeholder: 'e.g. 1, 2, 3' },
        { id: 'area', label: 'Area', placeholder: 'e.g. 120 sqm, 1500 sqft' },
        { id: 'yearBuilt', label: 'Year Built', placeholder: 'e.g. 2020, 2015' },
        { id: 'furnishing', label: 'Furnishing', placeholder: 'e.g. Furnished, Unfurnished' }
    ],
    'others': [
        { id: 'type', label: 'Type', placeholder: 'e.g. Item type or category' },
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Brand name' },
        { id: 'model', label: 'Model', placeholder: 'e.g. Model name' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Black, White' },
        { id: 'size', label: 'Size/Dimensions', placeholder: 'e.g. Small, Medium, 100x50cm' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Wood, Metal' },
        { id: 'condition', label: 'Condition', placeholder: 'e.g. New, Used' },
        { id: 'year', label: 'Year', placeholder: 'e.g. 2024, 2023' }
    ],
    'default': [
        { id: 'brand', label: 'Brand', placeholder: 'e.g. Brand name' },
        { id: 'model', label: 'Model', placeholder: 'e.g. Model name' },
        { id: 'color', label: 'Color', placeholder: 'e.g. Black, White' },
        { id: 'size', label: 'Size', placeholder: 'e.g. Small, Medium, Large' },
        { id: 'material', label: 'Material', placeholder: 'e.g. Wood, Metal' },
        { id: 'condition', label: 'Condition', placeholder: 'e.g. New, Used' }
    ]
};

/**
 * Initialize admin category-specific specifications
 */
function initAdminCategorySpecs() {
    const categorySelect = document.getElementById('productCategory');
    if (!categorySelect) return;

    // Update specs when category changes
    categorySelect.addEventListener('change', updateAdminSpecifications);

    // Initialize with current category
    updateAdminSpecifications();
}

/**
 * Update admin specifications based on selected category
 */
function updateAdminSpecifications() {
    const categorySelect = document.getElementById('productCategory');
    const container = document.getElementById('adminSpecsContainer');
    
    if (!categorySelect || !container) return;

    const category = categorySelect.value;
    const specs = adminCategorySpecs[category] || adminCategorySpecs['default'];

    // Generate HTML for spec fields
    let html = '';
    specs.forEach(function(spec) {
        html += `<input type="text" id="adminSpec${spec.id.charAt(0).toUpperCase() + spec.id.slice(1)}" placeholder="${spec.placeholder}">`;
    });

    container.innerHTML = html;
}

function initProductImageUpload() {
    const input = document.getElementById('productImages');
    const preview = document.getElementById('imagePreview');
    
    if (!input || !preview) return;
    
    input.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        
        if (files.length > 8) {
            alert('Maximum 8 images allowed');
            return;
        }
        
        preview.innerHTML = '';
        
        // Show compression indicator
        var compressMsg = document.createElement('div');
        compressMsg.id = 'adminCompressIndicator';
        compressMsg.style.cssText = 'text-align:center;padding:0.5rem;color:#0064d2;font-size:0.82rem;';
        compressMsg.innerHTML = '<i class="fas fa-compress-arrows-alt fa-spin"></i> Compressing images...';
        preview.appendChild(compressMsg);
        
        // Compress and display each file
        (async function() {
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                
                // Enforce 5MB file size limit
                if (file.size > 5 * 1024 * 1024) {
                    alert('"' + (file.name || 'Image') + '" is ' + Math.round(file.size / 1024 / 1024) + 'MB. Max 5MB allowed.');
                    continue;
                }
                
                var dataUrl;
                
                try {
                    dataUrl = (typeof compressImage === 'function')
                        ? await compressImage(file)
                        : await new Promise(function(resolve) {
                            var r = new FileReader();
                            r.onload = function(ev) { resolve(ev.target.result); };
                            r.readAsDataURL(file);
                        });
                } catch(err) {
                    dataUrl = await new Promise(function(resolve) {
                        var r = new FileReader();
                        r.onload = function(ev) { resolve(ev.target.result); };
                        r.readAsDataURL(file);
                    });
                }
                
                var imgDiv = document.createElement('div');
                imgDiv.className = 'preview-image';
                imgDiv.innerHTML = '<img src="' + dataUrl + '" alt="Preview ' + (i + 1) + '">' +
                    '<button type="button" class="remove-image" onclick="removeImage(' + i + ')"><i class="fas fa-times"></i></button>';
                preview.appendChild(imgDiv);
            }
            
            // Remove compression indicator
            var indicator = document.getElementById('adminCompressIndicator');
            if (indicator) indicator.remove();
        })();
    });
}

function removeImage(index) {
    const preview = document.getElementById('imagePreview');
    const images = preview.querySelectorAll('.preview-image');
    if (images[index]) {
        images[index].remove();
    }
}


function loadStoresIntoDropdown() {
    var group = document.getElementById('storesDropdownGroup');
    if (!group) return;
    
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) return;
    
    firebaseDB.collection('stores').where('isActive', '==', true).get().then(function(snapshot) {
        group.innerHTML = '';
        if (snapshot.empty) {
            group.innerHTML = '<option value="" disabled>No stores created yet</option>';
            return;
        }
        snapshot.forEach(function(doc) {
            var store = doc.data();
            var opt = document.createElement('option');
            opt.value = 'store_' + doc.id;
            opt.textContent = '🏪 ' + (store.name || 'Untitled');
            group.appendChild(opt);
        });
    }).catch(function() {
        // Fallback: try without where clause
        firebaseDB.collection('stores').get().then(function(snapshot) {
            group.innerHTML = '';
            snapshot.forEach(function(doc) {
                var store = doc.data();
                if (store.isActive === false) return;
                var opt = document.createElement('option');
                opt.value = 'store_' + doc.id;
                opt.textContent = '🏪 ' + (store.name || 'Untitled');
                group.appendChild(opt);
            });
            if (group.children.length === 0) {
                group.innerHTML = '<option value="" disabled>No stores created yet</option>';
            }
        }).catch(function() {});
    });
}

function handleAddProduct(e) {
    e.preventDefault();

    // Choices for buyers (optional). Checked before anything is uploaded.
    if (typeof variantEditorRead === 'function') {
        var choiceChk = variantEditorRead();
        var choiceBox = document.getElementById('variantProblems');
        if (choiceBox) choiceBox.textContent = choiceChk.problems.join(' ');
        if (choiceChk.problems.length) {
            if (typeof showFlashMessage === 'function') showFlashMessage(choiceChk.problems[0], 'error');
            return;
        }
    }
    
    // Collect specifications (only non-empty fields)
    var specifications = {};
    var specFields = ['Brand', 'Model', 'Color', 'Size', 'Material', 'Year', 'Warranty', 'Weight', 'Extra'];
    specFields.forEach(function(field) {
        var el = document.getElementById('adminSpec' + field);
        if (el && el.value.trim()) {
            specifications[field.toLowerCase()] = el.value.trim();
        }
    });
    
    // Get selected delivery option (single selection with radio buttons)
    const selectedDelivery = document.querySelector('input[name="delivery"]:checked');
    
    // Collect pickup location data if pickup is selected
    const pickupLocation = (selectedDelivery && selectedDelivery.value === 'pickup') ? {
        address: document.getElementById('adminPickupAddress').value.trim(),
        digitalAddress: document.getElementById('adminDigitalAddress').value.trim() || null,
        notes: document.getElementById('adminPickupNotes').value.trim() || null
    } : null;
    
    // Collect delivery areas if free or paid delivery is selected
    const deliveryAreas = (selectedDelivery && (selectedDelivery.value === 'free-delivery' || selectedDelivery.value === 'paid-delivery'))
        ? document.getElementById('adminDeliveryAreas').value.trim()
        : null;
    
    const formData = {
        title: document.getElementById('productTitle').value,
        category: document.getElementById('productCategory').value,
        description: document.getElementById('productDescription').value,
        price: parseFloat(document.getElementById('productPrice').value),
        condition: document.getElementById('productCondition').value,
        location: document.getElementById('productLocation').value,
        seller: document.getElementById('productSeller').value,
        deliveryOption: selectedDelivery ? selectedDelivery.value : null,
        deliveryAreas: deliveryAreas,
        pickupLocation: pickupLocation,
        featured: document.getElementById('productFeatured').checked,
        variants: (typeof variantEditorRead === 'function' && variantEditorRead().groups.length) ? variantEditorRead().groups : null,
        specifications: Object.keys(specifications).length > 0 ? specifications : null,
        // Sankofa Store only: list an item as a pre-order (buyers pay now, it ships when
        // the stock lands — the escrow protects their money until delivery, as always)
        preOrder: formData_sellerIsStore() && document.getElementById('adminPreOrder') && document.getElementById('adminPreOrder').checked,
        preOrderDate: (document.getElementById('adminPreOrderDate') && document.getElementById('adminPreOrderDate').value) || null,
        preOrderNote: (document.getElementById('adminPreOrderNote') && document.getElementById('adminPreOrderNote').value.trim()) || null,
        // MOQ-A: floor on pieces per order; MOQ-B: batch target + deadline (Sankofa Store only)
        minOrderQty: Math.max(0, parseInt((document.getElementById('adminMinOrderQty') || {}).value, 10) || 0),
        preOrderTargetQty: Math.max(0, parseInt((document.getElementById('adminPreOrderTarget') || {}).value, 10) || 0),
        preOrderDeadline: (document.getElementById('adminPreOrderDeadline') && document.getElementById('adminPreOrderDeadline').value) || null
    };
    function formData_sellerIsStore() { return document.getElementById('productSeller').value === 'sankofa-store'; }

    // Validate form
    if (!formData.title || !formData.category || !formData.description || !formData.price || !formData.condition || !formData.location || !formData.seller) {
        alert('Please fill in all required fields');
        return;
    }
    // MOQ sanity checks (admin-facing, before anything is written)
    if (formData.minOrderQty === 1) formData.minOrderQty = 0; // 1 == no limit, keep docs clean
    if (!formData.preOrder && (formData.minOrderQty || formData.preOrderTargetQty || formData.preOrderDeadline)) {
        alert('Minimum pieces and batch settings belong to PRE-ORDER items — tick "List this as a PRE-ORDER item" first.');
        return;
    }
    if (formData.preOrderTargetQty > 0 && formData.preOrderTargetQty < 2) {
        alert('A batch target below 2 pieces makes no sense — leave it empty or set 2+.');
        return;
    }
    if (formData.preOrderTargetQty > 0 && !formData.preOrderDeadline) {
        alert('A batch target needs a deadline — otherwise buyers could wait forever. Pick the batch deadline date.');
        document.getElementById('adminPreOrderDeadline').focus();
        return;
    }
    if (formData.preOrderDeadline && !formData.preOrderTargetQty) {
        alert('You set a batch deadline but no target — add the target pieces or clear the deadline.');
        document.getElementById('adminPreOrderTarget').focus();
        return;
    }

    // Validate pickup address if pickup is selected
    if (formData.deliveryOption === 'pickup' && (!pickupLocation || !pickupLocation.address)) {
        alert('Please provide a pickup address for the "Pickup Only" delivery option');
        document.getElementById('adminPickupAddress').focus();
        return;
    }

    // Get uploaded image data URLs from preview (will upload to Storage)
    var imageDataUrls = [];
    var previewImgs = document.querySelectorAll('#imagePreview img');
    previewImgs.forEach(function(img) {
        if (img.src) imageDataUrls.push(img.src);
    });
    if (!imageDataUrls.length) {
        showFlashMessage('Choose at least one product photo before saving this listing.', 'error');
        var imageInput = document.getElementById('productImages');
        if (imageInput) imageInput.focus();
        return;
    }

    // Build the product document for Firestore
    // Determine seller info
    var isSankofaStore = formData.seller === 'sankofa-store';
    var isStoreId = formData.seller && formData.seller.startsWith('store_');
    var storeData = isStoreId ? storesCache.find(function(s) { return 'store_' + s.id === formData.seller; }) : null;
    var sellerName = isSankofaStore ? 'Sankofa Store' : (storeData ? storeData.name : (formData.seller === 'verified-seller' ? 'Verified Seller' : 'Individual Seller'));
    var isVerified = isSankofaStore || formData.seller === 'verified-seller' || !!storeData;

    // Disable submit button
    var submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading images...';

    if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        // Upload images to Firebase Storage first
        uploadImagesToStorage(imageDataUrls, formData.title).then(function(imageUrls) {
            // Now create product document with Storage URLs
            var productData = {
                title: formData.title,
                category: formData.category,
                description: formData.description,
                price: formData.price,
                condition: formData.condition,
                location: { city: formData.location },
                sellerType: formData.seller,
                sellerName: sellerName,
                storeId: storeData ? storeData.id : null,
                storeProfilePicture: storeData ? (storeData.profilePicture || '') : '',
                isSankofaStore: isSankofaStore,
                variants: formData.variants || null,
                isVerifiedSeller: isVerified,
                isFeatured: formData.featured,
                isActive: true,
                isSold: false,
                // pre-order lives ONLY on Sankofa Store items — buyers pay now, we ship
                // when the stock lands (the usual escrow keeps their money safe meanwhile)
                preOrder: isSankofaStore && formData.preOrder === true,
                preOrderDate: (isSankofaStore && formData.preOrder && formData.preOrderDate) ? formData.preOrderDate : null,
                preOrderNote: (isSankofaStore && formData.preOrder && formData.preOrderNote) ? formData.preOrderNote : null,
                // MOQ fields (Sankofa Store pre-orders only; absent/zero means "no rule")
                minOrderQty: (isSankofaStore && formData.preOrder && formData.minOrderQty > 1) ? formData.minOrderQty : null,
                preOrderTargetQty: (isSankofaStore && formData.preOrder && formData.preOrderTargetQty >= 2) ? formData.preOrderTargetQty : null,
                preOrderDeadline: (isSankofaStore && formData.preOrder && formData.preOrderTargetQty >= 2 && formData.preOrderDeadline) ? formData.preOrderDeadline : null,
                // countdown counters the money functions maintain — buyers see live progress
                preOrderSoldQty: 0,
                preOrderBatchStatus: (isSankofaStore && formData.preOrder && formData.preOrderTargetQty >= 2) ? 'collecting' : null,
                views: 0,
                images: imageUrls,
                photos: imageUrls,
                imagesThumb: (window.__lastUploadedThumbs && window.__lastUploadedThumbs.length === imageUrls.length)
                    ? window.__lastUploadedThumbs.slice() : null,
                deliveryOption: formData.deliveryOption,
                deliveryAreas: formData.deliveryAreas || null,
                pickupLocation: formData.pickupLocation || null,
                specifications: formData.specifications || null,
                sellerId: (typeof firebase !== 'undefined' && firebase.auth().currentUser) ? firebase.auth().currentUser.uid : 'admin',
                sellerName: sellerName || ((typeof firebase !== 'undefined' && firebase.auth().currentUser) ? (firebase.auth().currentUser.displayName || '') : 'Admin'),
                sellerEmail: (typeof firebase !== 'undefined' && firebase.auth().currentUser) ? (firebase.auth().currentUser.email || null) : null,
                createdAt: (typeof firebase !== 'undefined') ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
            };

            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

            // Save to Firestore
            return firebaseDB.collection('products').add(productData);
        })
        .then(function(docRef) {
            console.log('✅ Product added with ID:', docRef.id);
            showFlashMessage('Product added successfully! 🎉', 'success');
            closeAddProductModal();
            setTimeout(function() { location.reload(); }, 1500);
        })
        .catch(function(error) {
            console.error('❌ Error adding product:', error);
            showFlashMessage('Error: ' + error.message, 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Product';
        });
    } else {
        // Firebase not available
        showFlashMessage('Firebase not connected. Cannot save product.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Product';
    }
}

/**
 * Upload images to Firebase Storage and return download URLs
 * Shows upload progress in the admin panel
 */
async function uploadImagesToStorage(imageDataUrls, productTitle) {
    if (!imageDataUrls || imageDataUrls.length === 0) {
        return [];
    }

    if (typeof firebase === 'undefined' || typeof firebase.storage !== 'function') {
        throw new Error('Photo storage is not available. Please refresh the admin page and try again.');
    }
    var auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;
    var currentUser = auth && auth.currentUser;
    if (!currentUser || !currentUser.uid) {
        throw new Error('Your admin sign-in expired. Sign in again before uploading photos.');
    }
    var storageUserId = currentUser.uid;
    var productFolder = 'products/' + storageUserId + '/';

    // Create progress UI. The action row is inside the form, which is a
    // child of .modal-body, so insert beside the row using its actual parent.
    var progressUI = createAdminUploadProgressUI();
    var modalBody = document.querySelector('#addProductModal .modal-body') ||
        document.querySelector('#repairProductPhotosModal .modal-body') ||
        document.querySelector('#editProductModal .modal-body');
    if (modalBody) {
        var formActions = modalBody.querySelector('.form-actions');
        if (formActions && formActions.parentNode) {
            formActions.parentNode.insertBefore(progressUI, formActions);
        } else {
            // Keep uploads working even if a future modal layout omits the row.
            modalBody.appendChild(progressUI);
        }
    }

    var imageUrls = [];
    var thumbUrls = [];
    var uploadedRefs = [];
    var timestamp = Date.now();
    var sanitizedName = productTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    var total = imageDataUrls.length;

    for (var i = 0; i < total; i++) {
        var dataUrl = imageDataUrls[i];
        
        // Skip if it's already a Firebase Storage URL or external URL
        if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
            imageUrls.push(dataUrl);
            updateAdminUploadProgressUI({
                currentImage: i + 1,
                totalImages: total,
                percent: 100,
                status: 'uploading'
            });
            continue;
        }

        try {
            // Update UI for current image
            updateAdminUploadProgressUI({
                currentImage: i + 1,
                totalImages: total,
                percent: 0,
                status: 'uploading'
            });

            // Convert data URL to blob
            var blob = dataURLtoBlob(dataUrl);
            
            // Keep every picture inside the 300KB budget
            if (typeof compressToTarget === 'function') {
                try {
                    var tighter = await compressToTarget(blob, { maxDim: 1600, maxBytes: 300 * 1024, quality: 0.82 });
                    blob = tighter.blob;
                } catch (e) { /* keep the original blob if resizing fails */ }
            }

            // Create storage reference
            // Storage rules only allow a seller to upload under products/<their UID>/.
            var fileName = productFolder + sanitizedName + '_' + timestamp + '_' + i + '.jpg';
            var storageRef = firebase.storage().ref(fileName);
            
            // Upload to Storage with progress tracking
            console.log('📤 Uploading image ' + (i + 1) + '/' + total + '...');
            
            var snapshot = await new Promise(function(resolve, reject) {
                var uploadTask = storageRef.put(blob);
                uploadTask.on('state_changed',
                    function(snapshot) {
                        var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        updateAdminUploadProgressUI({
                            currentImage: i + 1,
                            totalImages: total,
                            percent: progress,
                            status: 'uploading'
                        });
                    },
                    function(error) { reject(error); },
                    function() { resolve(uploadTask.snapshot); }
                );
            });
            
            // Keep a reference so a later photo failure can clean up this attempt.
            var fullRef = snapshot.ref || storageRef;
            uploadedRefs.push(fullRef);
            var downloadUrl = await fullRef.getDownloadURL();
            imageUrls.push(downloadUrl);

            // And upload the small preview used by listings (max 800px, ~60-90KB)
            var thumbRef = null;
            try {
                var thumb = await compressToTarget(blob, { maxDim: 800, maxBytes: 90 * 1024, quality: 0.72 });
                thumbRef = firebase.storage().ref(productFolder + sanitizedName + '_' + timestamp + '_' + i + '_thumb.jpg');
                await new Promise(function (resolve, reject) {
                    var thumbTask = thumbRef.put(thumb.blob);
                    thumbTask.on('state_changed', null, reject, function () { resolve(); });
                });
                uploadedRefs.push(thumbRef);
                thumbUrls.push(await thumbRef.getDownloadURL());
            } catch (thumbErr) {
                console.warn('Preview upload skipped for image ' + (i + 1), thumbErr && thumbErr.message);
                if (thumbRef) {
                    try { await thumbRef.delete(); } catch (cleanupThumbErr) {}
                }
                thumbUrls.push(downloadUrl);
            }
            console.log('✅ Image ' + (i + 1) + ' uploaded:', downloadUrl);
        } catch (error) {
            console.error('❌ Error uploading image ' + (i + 1) + ':', error);
            await Promise.all(uploadedRefs.map(function (ref) {
                return ref.delete().catch(function () {});
            }));
            var failedProgress = document.getElementById('adminUploadProgressContainer');
            if (failedProgress && failedProgress.parentNode) failedProgress.remove();
            throw new Error('Could not upload image ' + (i + 1) + ': ' +
                (error && error.message ? error.message : 'Storage rejected the upload.'));
        }
    }

    // Show complete
    updateAdminUploadProgressUI({
        currentImage: total,
        totalImages: total,
        percent: 100,
        status: 'done'
    });

    // Remove progress UI after a short delay
    setTimeout(function() {
        var el = document.getElementById('adminUploadProgressContainer');
        if (el && el.parentNode) el.remove();
    }, 1500);

    // Handy for callers that want both versions
    window.__lastUploadedThumbs = thumbUrls;
    return imageUrls;
}

/**
 * Upload pictures and return BOTH the full URLs and the small preview URLs.
 * Returns { urls: [...], thumbs: [...] } with matching indexes.
 */
async function uploadImagesWithThumbs(imageDataUrls, productTitle) {
    var urls = await uploadImagesToStorage(imageDataUrls, productTitle);
    var thumbs = window.__lastUploadedThumbs || [];
    // Fall back to the full picture wherever a preview is missing
    var aligned = urls.map(function (u, i) { return thumbs[i] || u; });
    return { urls: urls, thumbs: aligned };
}

/**
 * Create admin upload progress UI
 */
function createAdminUploadProgressUI() {
    // Remove existing if any
    var existing = document.getElementById('adminUploadProgressContainer');
    if (existing) existing.remove();

    var container = document.createElement('div');
    container.id = 'adminUploadProgressContainer';
    container.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem 1.5rem;margin:1rem 0;';
    
    container.innerHTML = 
        '<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;">' +
            '<div id="adminUploadProgressIcon" style="width:36px;height:36px;border-radius:50%;background:rgba(0,100,210,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
                '<i class="fas fa-cloud-upload-alt" style="color:#0064d2;font-size:0.95rem;"></i>' +
            '</div>' +
            '<div style="flex:1;">' +
                '<div style="font-weight:600;font-size:0.95rem;" id="adminUploadProgressTitle">Uploading images...</div>' +
                '<div style="font-size:0.8rem;color:#5a6572;" id="adminUploadProgressSub">Preparing upload...</div>' +
            '</div>' +
            '<div style="font-weight:700;font-size:1.1rem;color:#0064d2;" id="adminUploadProgressPercent">0%</div>' +
        '</div>' +
        '<div style="width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">' +
            '<div id="adminUploadProgressBar" style="height:100%;width:0%;border-radius:4px;background:linear-gradient(90deg,#0064d2,#0052b5);transition:width 0.3s ease;"></div>' +
        '</div>' +
        '<div style="display:flex;gap:0.3rem;margin-top:0.5rem;" id="adminUploadProgressDots"></div>';
    
    return container;
}

/**
 * Update admin upload progress UI
 */
function updateAdminUploadProgressUI(data) {
    var title = document.getElementById('adminUploadProgressTitle');
    var sub = document.getElementById('adminUploadProgressSub');
    var percent = document.getElementById('adminUploadProgressPercent');
    var bar = document.getElementById('adminUploadProgressBar');
    var icon = document.getElementById('adminUploadProgressIcon');
    var dots = document.getElementById('adminUploadProgressDots');
    
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
        if (dots) dots.innerHTML = dotsHtml;
    } else if (data.status === 'done') {
        title.textContent = 'Upload complete!';
        sub.textContent = 'All ' + data.totalImages + ' images uploaded successfully';
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
        if (dots) dots.innerHTML = allDoneHtml;
    }
}

/**
 * Convert data URL to Blob
 */
function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(',');
    var mime = arr[0].match(/:(.*?);/)[1];
    var bstr = atob(arr[1]);
    var n = bstr.length;
    var u8arr = new Uint8Array(n);
    
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], {type: mime});
}

// ============================================================================
// EDIT PRODUCT
// ============================================================================

function buildAdminProductEditPatch(existing, fields, uploadedPhotos, updatedAt, replaceExisting) {
    var product = existing || {};
    var oldLocation = product.location && typeof product.location === 'object' ? product.location : {};
    var patch = {
        title: String(fields.title || '').trim(),
        category: String(fields.category || ''),
        description: String(fields.description || '').trim(),
        price: Number(fields.price),
        condition: String(fields.condition || ''),
        location: Object.assign({}, oldLocation, { city: String(fields.city || '').trim() }),
        updatedAt: updatedAt
    };
    var newUrls = uploadedPhotos && Array.isArray(uploadedPhotos.urls) ? uploadedPhotos.urls : [];
    if (newUrls.length) {
        var oldImages = replaceExisting ? [] : ((Array.isArray(product.images) && product.images.length)
            ? product.images : (Array.isArray(product.photos) ? product.photos : []));
        var oldThumbs = replaceExisting ? [] : (Array.isArray(product.imagesThumb) ? product.imagesThumb : []);
        var newThumbs = uploadedPhotos && Array.isArray(uploadedPhotos.thumbs) ? uploadedPhotos.thumbs : [];
        var combinedImages = oldImages.concat(newUrls);
        patch.images = combinedImages;
        patch.photos = combinedImages;
        patch.imagesThumb = oldImages.map(function (url, i) { return oldThumbs[i] || url; })
            .concat(newUrls.map(function (url, i) { return newThumbs[i] || url; }));
    }
    return patch;
}

function closeAdminProductEditModal() {
    var modal = document.getElementById('editProductModal');
    if (modal) modal.remove();
}

function editProduct(productId) {
    if (typeof firebaseDB === 'undefined' || !firebaseDB) {
        showFlashMessage('Firebase is not connected. Please refresh and try again.', 'error');
        return;
    }
    var productRef = firebaseDB.collection('products').doc(productId);
    productRef.get().then(function (snap) {
        if (!snap.exists) {
            showFlashMessage('This listing was not found. Refresh the product list.', 'error');
            return;
        }
        openAdminProductEditModal(productId, productRef, snap.data() || {});
    }).catch(function (err) {
        console.error('Could not load listing for editing:', err);
        showFlashMessage('Could not load this listing. Please refresh and try again.', 'error');
    });
}

function openAdminProductEditModal(productId, productRef, product) {
    closeAdminProductEditModal();
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'editProductModal';
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h2 id="editProductModalTitle">Edit listing</h2>
                <button type="button" class="modal-close" id="editProductModalClose" aria-label="Close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <p style="margin:0 0 1rem;color:#475569;line-height:1.5;">Edit the main details below. Seller, stock, variants, pre-order, and delivery settings stay as they are. New photos are added to the current photos.</p>
                <form id="adminEditProductForm">
                    <div class="form-row">
                        <div class="form-group"><label for="editProductTitle">Title *</label><input id="editProductTitle" type="text" maxlength="80" required></div>
                        <div class="form-group"><label for="editProductCategory">Category *</label><select id="editProductCategory" required></select></div>
                    </div>
                    <div class="form-group"><label for="editProductDescription">Description *</label><textarea id="editProductDescription" rows="4" required></textarea></div>
                    <div class="form-row">
                        <div class="form-group"><label for="editProductPrice">Price (GHS) *</label><input id="editProductPrice" type="number" min="0.01" step="0.01" required></div>
                        <div class="form-group"><label for="editProductCondition">Condition *</label><select id="editProductCondition" required></select></div>
                    </div>
                    <div class="form-group"><label for="editProductCity">Location *</label><input id="editProductCity" type="text" maxlength="80" required></div>
                    <div class="form-group">
                        <label>Current photos</label>
                        <div id="editProductCurrentPhotos" style="display:flex;gap:0.5rem;flex-wrap:wrap;min-height:56px;align-items:center;"></div>
                    </div>
                    <div class="form-group">
                        <label for="editProductImages">Add or replace photos (optional)</label>
                        <input id="editProductImages" type="file" accept="image/*" multiple>
                        <div id="editProductNewPhotoPreview" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem;"></div>
                        <label style="display:flex;align-items:center;gap:0.45rem;margin-top:0.55rem;font-size:0.82rem;cursor:pointer;">
                            <input id="editProductReplacePhotos" type="checkbox" style="width:17px;height:17px;accent-color:#0064d2;">
                            Replace current photos with the selected photos
                        </label>
                        <small style="display:block;margin-top:0.35rem;color:#64748b;">Leave photos unselected to keep the current set. Without the checkbox, new photos are added. With it, the selected photos replace the current set. Maximum 8 photos total, 5 MB per file.</small>
                    </div>
                    <div class="form-actions">
                        <button type="button" id="editProductCancel" class="btn btn-outline">Cancel</button>
                        <button type="submit" id="editProductSave" class="btn btn-primary"><i class="fas fa-save"></i> Save changes</button>
                    </div>
                </form>
            </div>
        </div>`;
    document.body.appendChild(modal);

    var titleInput = modal.querySelector('#editProductTitle');
    var categorySelect = modal.querySelector('#editProductCategory');
    var descriptionInput = modal.querySelector('#editProductDescription');
    var priceInput = modal.querySelector('#editProductPrice');
    var conditionSelect = modal.querySelector('#editProductCondition');
    var cityInput = modal.querySelector('#editProductCity');
    var fileInput = modal.querySelector('#editProductImages');
    var replacePhotosInput = modal.querySelector('#editProductReplacePhotos');
    var newPreview = modal.querySelector('#editProductNewPhotoPreview');
    var currentPhotos = modal.querySelector('#editProductCurrentPhotos');

    var builtInCategories = [
        ['electronics','Electronics'], ['fashion','Fashion'], ['home-garden','Home & Garden'],
        ['vehicles','Vehicles'], ['services','Services'], ['sports','Sports'], ['books-media','Books & Media'],
        ['baby-kids','Baby & Kids'], ['beauty-health','Beauty & Health'], ['food-groceries','Food & Groceries'],
        ['pets','Pets'], ['jobs-skills','Jobs & Skills'], ['real-estate','Real Estate'],
        ['musical-instruments','Musical Instruments'], ['others','Others']
    ];
    var seenCategories = {};
    function addCategory(id, label) {
        id = String(id || '').trim();
        if (!id || seenCategories[id]) return;
        seenCategories[id] = true;
        var option = document.createElement('option');
        option.value = id;
        option.textContent = label || id;
        categorySelect.appendChild(option);
    }
    builtInCategories.forEach(function (pair) { addCategory(pair[0], pair[1]); });
    if (typeof adminCategoriesCache !== 'undefined' && Array.isArray(adminCategoriesCache)) {
        adminCategoriesCache.forEach(function (c) {
            if (c && c.isActive !== false) addCategory(c.id, c.name || c.id);
        });
    }
    if (product.category && !seenCategories[product.category]) addCategory(product.category, product.category);

    var currentCondition = String(product.condition || 'new');
    ['new','like-new','good','fair','used','refurbished'].forEach(function (value) {
        var option = document.createElement('option');
        option.value = value;
        option.textContent = value.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        conditionSelect.appendChild(option);
    });
    if (currentCondition && !Array.prototype.some.call(conditionSelect.options, function (o) { return o.value === currentCondition; })) {
        var customCondition = document.createElement('option');
        customCondition.value = currentCondition;
        customCondition.textContent = currentCondition;
        conditionSelect.appendChild(customCondition);
    }

    titleInput.value = product.title || '';
    categorySelect.value = product.category || 'others';
    descriptionInput.value = product.description || '';
    priceInput.value = product.price == null ? '' : String(product.price);
    conditionSelect.value = currentCondition;
    cityInput.value = product.location && typeof product.location === 'object'
        ? (product.location.city || '') : String(product.location || '');

    var currentImages = (Array.isArray(product.images) && product.images.length)
        ? product.images : (Array.isArray(product.photos) ? product.photos : []);
    var currentThumbs = Array.isArray(product.imagesThumb) ? product.imagesThumb : [];
    if (currentImages.length) {
        currentImages.forEach(function (url, i) {
            var img = document.createElement('img');
            img.src = currentThumbs[i] || url;
            img.alt = 'Current listing photo ' + (i + 1);
            img.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;';
            currentPhotos.appendChild(img);
        });
    } else {
        var none = document.createElement('span');
        none.textContent = 'No photos saved on this listing yet.';
        none.style.color = '#9ca3af';
        currentPhotos.appendChild(none);
    }

    modal.querySelector('#editProductModalClose').addEventListener('click', closeAdminProductEditModal);
    modal.querySelector('#editProductCancel').addEventListener('click', closeAdminProductEditModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeAdminProductEditModal(); });
    fileInput.addEventListener('change', function () {
        var files = Array.from(fileInput.files || []);
        newPreview.innerHTML = '';
        var existingCount = replacePhotosInput.checked ? 0 : currentImages.length;
        if (existingCount + files.length > 8) {
            showFlashMessage('This listing can have at most 8 photos total.', 'error');
            fileInput.value = '';
            return;
        }
        (async function () {
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                if (file.size > 5 * 1024 * 1024) {
                    showFlashMessage('Each photo must be 5 MB or smaller.', 'error');
                    continue;
                }
                var dataUrl;
                try {
                    dataUrl = (typeof compressImage === 'function')
                        ? await compressImage(file)
                        : await new Promise(function (resolve, reject) {
                            var reader = new FileReader();
                            reader.onload = function (ev) { resolve(ev.target.result); };
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        });
                } catch (err) {
                    showFlashMessage('Could not read one of the selected photos.', 'error');
                    continue;
                }
                var img = document.createElement('img');
                img.src = dataUrl;
                img.alt = 'New listing photo ' + (i + 1);
                img.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;';
                newPreview.appendChild(img);
            }
        })();
    });

    modal.querySelector('#adminEditProductForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var fields = {
            title: titleInput.value.trim(),
            category: categorySelect.value,
            description: descriptionInput.value.trim(),
            price: Number(priceInput.value),
            condition: conditionSelect.value,
            city: cityInput.value.trim()
        };
        if (fields.title.length < 3 || fields.title.length > 80 || !fields.category || !fields.description ||
            !isFinite(fields.price) || fields.price <= 0 || !fields.condition || !fields.city) {
            showFlashMessage('Please check the title, category, description, price, condition, and location.', 'error');
            return;
        }
        var fileCount = (fileInput.files && fileInput.files.length) || 0;
        var replacePhotos = replacePhotosInput.checked;
        var existingPhotoCount = replacePhotos ? 0 : currentImages.length;
        if (existingPhotoCount + fileCount > 8) {
            showFlashMessage('This listing can have at most 8 photos total.', 'error');
            return;
        }
        var dataUrls = Array.from(newPreview.querySelectorAll('img')).map(function (img) { return img.src; }).filter(Boolean);
        if (fileCount && !dataUrls.length) {
            showFlashMessage('The selected photos could not be read. Choose them again.', 'error');
            return;
        }
        if (replacePhotos && !dataUrls.length) {
            showFlashMessage('Choose replacement photos first, or untick Replace current photos.', 'error');
            return;
        }
        var saveButton = modal.querySelector('#editProductSave');
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        var photoPromise = dataUrls.length
            ? uploadImagesToStorage(dataUrls, fields.title).then(function (urls) {
                if (!urls.length) throw new Error('No photos were uploaded.');
                return { urls: urls, thumbs: window.__lastUploadedThumbs || [], replace: replacePhotos }
            })
            : Promise.resolve(null);
        photoPromise.then(function (photos) {
            var updatedAt = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
                ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString();
            var patch = buildAdminProductEditPatch(product, fields, photos, updatedAt, !!(photos && photos.replace));
            return productRef.update(patch);
        }).then(function () {
            showFlashMessage('Listing updated successfully.', 'success');
            closeAdminProductEditModal();
            loadAdminProducts(true);
        }).catch(function (err) {
            console.error('Could not update product:', err);
            showFlashMessage('Could not update the listing: ' + (err && err.message ? err.message : err), 'error');
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML = '<i class="fas fa-save"></i> Save changes';
            }
        });
    });
}


function closeRepairProductPhotosModal() {
    var modal = document.getElementById('repairProductPhotosModal');
    if (modal) modal.remove();
}

// Repair an existing listing with no photos without making a duplicate product.
function addPhotosToProduct(productId) {
    if (typeof firebaseDB === 'undefined' || !firebaseDB) {
        showFlashMessage('Firebase is not connected. Please refresh and try again.', 'error');
        return;
    }
    var productRef = firebaseDB.collection('products').doc(productId);
    productRef.get().then(function (snap) {
        if (!snap.exists) {
            showFlashMessage('This listing was not found. Refresh the product list.', 'error');
            return;
        }
        var product = snap.data() || {};
        closeRepairProductPhotosModal();
        var modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'repairProductPhotosModal';
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h2 id="repairProductPhotosTitle">Add photos to listing</h2>
                    <button type="button" class="modal-close" onclick="closeRepairProductPhotosModal()" aria-label="Close"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <form id="repairProductPhotosForm">
                        <p style="margin:0 0 1rem;color:#475569;line-height:1.5;">Choose the photos for this existing listing. Saving photos here will not create another listing.</p>
                        <div class="form-group">
                            <label>Listing photos *</label>
                            <div class="image-upload-area" id="productImageUpload">
                                <input type="file" id="productImages" multiple accept="image/*" style="display:none;">
                                <div class="upload-placeholder" onclick="document.getElementById('productImages').click()">
                                    <i class="fas fa-cloud-upload-alt"></i>
                                    <p>Choose listing photos (up to 8)</p>
                                    <small>JPG, PNG, WebP — max 5MB each</small>
                                </div>
                                <div class="image-preview" id="imagePreview"></div>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="button" id="repairProductPhotosCancel" class="btn btn-outline" onclick="closeRepairProductPhotosModal()">Cancel</button>
                            <button type="submit" id="repairProductPhotosSave" class="btn btn-primary"><i class="fas fa-cloud-upload-alt"></i> Add photos</button>
                        </div>
                    </form>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#repairProductPhotosTitle').textContent = 'Add photos: ' + (product.title || 'Listing');
        modal.addEventListener('click', function (e) { if (e.target === modal) closeRepairProductPhotosModal(); });
        initProductImageUpload();

        var form = modal.querySelector('#repairProductPhotosForm');
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var imageDataUrls = [];
            modal.querySelectorAll('#imagePreview img').forEach(function (img) { if (img.src) imageDataUrls.push(img.src); });
            if (!imageDataUrls.length) {
                showFlashMessage('Choose at least one photo first.', 'error');
                return;
            }
            var saveButton = modal.querySelector('#repairProductPhotosSave');
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading photos...';
            uploadImagesToStorage(imageDataUrls, product.title || 'listing')
                .then(function (newUrls) {
                    if (!newUrls.length) throw new Error('No photos were uploaded. Please try again.');
                    var previous = (Array.isArray(product.images) && product.images.length)
                        ? product.images : (Array.isArray(product.photos) ? product.photos : []);
                    var oldThumbs = Array.isArray(product.imagesThumb) ? product.imagesThumb : [];
                    var newThumbs = (window.__lastUploadedThumbs && window.__lastUploadedThumbs.length === newUrls.length)
                        ? window.__lastUploadedThumbs.slice() : newUrls.slice();
                    var combinedImages = previous.concat(newUrls);
                    var combinedThumbs = previous.map(function (url, i) { return oldThumbs[i] || url; }).concat(newThumbs);
                    var patch = { images: combinedImages, photos: combinedImages, imagesThumb: combinedThumbs };
                    if (firebase.firestore && firebase.firestore.FieldValue && firebase.firestore.FieldValue.serverTimestamp) {
                        patch.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                    }
                    return productRef.update(patch);
                })
                .then(function () {
                    showFlashMessage('Photos added to the existing listing.', 'success');
                    closeRepairProductPhotosModal();
                    loadAdminProducts(true);
                })
                .catch(function (err) {
                    console.error('Could not add photos to existing product:', err);
                    showFlashMessage('Photos were not saved: ' + (err && err.message ? err.message : err), 'error');
                    if (saveButton) {
                        saveButton.disabled = false;
                        saveButton.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Add photos';
                    }
                });
        });
    }).catch(function (err) {
        console.error('Could not load listing for photo repair:', err);
        showFlashMessage('Could not load this listing. Please refresh and try again.', 'error');
    });
}

// ============================================================================
// DELETE PRODUCT
// ============================================================================

function deleteProduct(productId, productName) {
    if (!confirm('Are you sure you want to delete "' + productName + '"? This action cannot be undone.')) return;
    
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
        showFlashMessage('Firebase not connected. Cannot delete product.', 'error');
        return;
    }
    
    console.log('🗑️ Deleting product:', productId);
    
    // Get product data first so we can clean up images
    firebaseDB.collection('products').doc(productId).get()
        .then(function(doc) {
            if (!doc.exists) {
                showFlashMessage('Product not found.', 'error');
                loadAdminProducts(); loadNavCounts();
                return;
            }
            
            var productData = doc.data();
            var images = productData.images || productData.photos || [];
            
            // Delete the Firestore document
            return firebaseDB.collection('products').doc(productId).delete()
                .then(function() {
                    console.log('✅ Product document deleted');
                    
                    // Clean up images from Storage (non-blocking)
                    images.forEach(function(imageUrl) {
                        if (typeof imageUrl === 'string' && imageUrl.includes('firebasestorage.googleapis.com')) {
                            try {
                                firebase.storage().refFromURL(imageUrl).delete().catch(function() {});
                            } catch(e) {}
                        }
                    });
                    if (productData.videoStoragePath && firebase.storage) {
                        firebase.storage().ref().child(productData.videoStoragePath).delete().catch(function() {});
                    }
                    
                    showFlashMessage('"' + productName + '" deleted successfully!', 'success');
                    
                    // Wait a bit for Firestore cache to sync, then reload from server
                    setTimeout(function() {
                        loadAdminProducts(true); // Force server fetch
                        loadNavCounts();
                    }, 500);
                });
        })
        .catch(function(error) {
            console.error('❌ Error deleting product:', error);
            showFlashMessage('Error deleting product: ' + error.message, 'error');
        });
}

// ============================================================================
// APPROVE PRODUCT (for pending products)
// ============================================================================

function approveProduct(productId) {
    if (!confirm('Are you sure you want to approve this product?')) return;
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
        showFlashMessage('Firebase not connected.', 'error');
        return;
    }

    firebaseDB.collection('products').doc(productId).update({
        isActive: true
    }).then(function() {
        showFlashMessage('Product approved successfully!', 'success');
        setTimeout(function() {
            loadAdminProducts(true);
            loadNavCounts();
        }, 300);
    }).catch(function(err) {
        showFlashMessage('Error approving product: ' + err.message, 'error');
    });
}

// ============================================================================
// REJECT PRODUCT (for pending products)
// ============================================================================

function rejectProduct(productId) {
    const reason = prompt('Please provide a reason for rejection:');
    
    if (reason === null) return; // Cancelled
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
        showFlashMessage('Firebase not connected.', 'error');
        return;
    }

    firebaseDB.collection('products').doc(productId).update({
        isActive: false,
        rejectionReason: reason,
        rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        showFlashMessage('Product rejected successfully!', 'success');
        setTimeout(function() {
            loadAdminProducts(true);
            loadNavCounts();
        }, 300);
    }).catch(function(err) {
        showFlashMessage('Error rejecting product: ' + err.message, 'error');
    });
}

// ============================================================================
// REVIEW PRODUCT (for flagged products)
// ============================================================================

function reviewProduct(productId) {
    // Open product detail view for review
    window.open('/product-detail.html?id=' + productId, '_blank');
}

// ============================================================================
// REMOVE PRODUCT (for flagged products)
// ============================================================================

function removeProduct(productId) {
    if (!confirm('Are you sure you want to remove this flagged product? This action cannot be undone.')) return;
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
        showFlashMessage('Firebase not connected.', 'error');
        return;
    }

    // Delete the product (same as regular delete, with image cleanup)
    firebaseDB.collection('products').doc(productId).get()
        .then(function(doc) {
            if (!doc.exists) {
                showFlashMessage('Product not found.', 'error');
                loadAdminProducts(); loadNavCounts();
                return;
            }
            
            var productData = doc.data();
            var images = productData.images || productData.photos || [];
            
            return firebaseDB.collection('products').doc(productId).delete()
                .then(function() {
                    // Clean up images from Storage (non-blocking)
                    images.forEach(function(imageUrl) {
                        if (typeof imageUrl === 'string' && imageUrl.includes('firebasestorage.googleapis.com')) {
                            try {
                                firebase.storage().refFromURL(imageUrl).delete().catch(function() {});
                            } catch(e) {}
                        }
                    });
                    if (productData.videoStoragePath && firebase.storage) {
                        firebase.storage().ref().child(productData.videoStoragePath).delete().catch(function() {});
                    }
                    
                    showFlashMessage('Product removed successfully!', 'success');
                    setTimeout(function() {
                        loadAdminProducts(true);
                        loadNavCounts();
                    }, 500);
                });
        })
        .catch(function(err) {
            showFlashMessage('Error removing product: ' + err.message, 'error');
        });
}

// filterProducts removed - replaced by filterAdminProducts with store support

// ============================================================================
// EXPORT PRODUCTS
// ============================================================================

function exportProducts() {
    // In a real app, this would generate and download a CSV/Excel file
    console.log('Exporting products...');
    
    showFlashMessage('Products exported successfully!', 'success');
    
    // Simulate download
    setTimeout(() => {
        alert('Products exported to products_export.csv');
    }, 1000);
}

// ============================================================================
// BULK ACTIONS
// ============================================================================

function updateBulkActions() {
    const checkboxes = document.querySelectorAll('.product-check:checked');
    const count = checkboxes.length;
    
    // In a real app, this would show/hide bulk action buttons
    console.log('Selected products:', count);
}

// ============================================================================
// VIEW PRODUCT
// ============================================================================

function viewProduct(productId) {
    // In a real app, this would open a detailed product view modal or navigate to product page
    console.log('Viewing product:', productId);
    
    alert('Product view feature coming soon!');
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

var adminUsersCache = [];

function initUserManagement() {
    loadAdminUsers();
    
    var searchInput = document.getElementById('userSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            renderAdminUsers(this.value.toLowerCase());
        });
    }
}

function loadAdminUsers() {
    var tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#5a6572;"><p>Firebase not connected</p></td></tr>';
        return;
    }
    
    firebaseDB.collection('users').get().then(function(snapshot) {
        adminUsersCache = [];
        snapshot.forEach(function(doc) {
            adminUsersCache.push({ id: doc.id, ...doc.data() });
        });
        
        // Update stats
        var total = adminUsersCache.length;
        var approved = 0, pending = 0, blocked = 0;
        adminUsersCache.forEach(function(u) {
            if (u.status === 'approved') approved++;
            else if (u.status === 'pending') pending++;
            else if (u.status === 'blocked' || u.status === 'suspended') blocked++;
        });
        
        var el;
        el = document.getElementById('userStatTotal'); if (el) el.textContent = total;
        el = document.getElementById('userStatApproved'); if (el) el.textContent = approved;
        el = document.getElementById('userStatPending'); if (el) el.textContent = pending;
        el = document.getElementById('userStatBlocked'); if (el) el.textContent = blocked;
        
        // Also update nav count badge
        updateCount('countUsers', total);
        
        renderAdminUsers('');
        
        // Update overview Registered Users stat
        var overviewEl = document.getElementById('overviewTotalUsers');
        if (overviewEl) overviewEl.textContent = adminUsersCache.filter(function(u) { return u.role !== 'admin'; }).length;
    }).catch(function(err) {
        console.error('Error loading users:', err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#e74c3c;"><p>Error: ' + err.message + '</p></td></tr>';
    });
}

function renderAdminUsers(searchTerm) {
    var tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    var filtered = adminUsersCache;
    if (searchTerm) {
        filtered = adminUsersCache.filter(function(u) {
            var name = (u.name || u.firstName || '').toLowerCase();
            var email = (u.email || '').toLowerCase();
            var phone = (u.phone || '').toLowerCase();
            return name.includes(searchTerm) || email.includes(searchTerm) || phone.includes(searchTerm);
        });
    }
    
    // Filter out admins
    filtered = filtered.filter(function(u) { return u.role !== 'admin'; });
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:#5a6572;"><i class="fas fa-users" style="font-size:2rem;color:#ccc;display:block;margin-bottom:0.5rem;"></i><p>' + (searchTerm ? 'No users match your search' : 'No registered users yet') + '</p></td></tr>';
        return;
    }
    
    var html = '';
    filtered.forEach(function(u) {
        var name = u.name || (u.firstName ? u.firstName + ' ' + (u.lastName || '') : 'Unknown');
        var email = u.email || '—';
        var phone = u.phone || '—';
        var status = u.status || 'pending';
        var statusClass = status === 'approved' ? 'delivered' : (status === 'pending' ? 'pending' : 'cancelled');
        var statusLabel = status === 'approved' ? 'Approved' : (status === 'pending' ? 'Pending' : 'Blocked');
        
        // Ghana Card info
        var ghanaCardHtml = '—';
        if (u.ghanaCard && u.ghanaCard.number) {
            ghanaCardHtml = '<div style="font-size:0.82rem;"><strong>' + u.ghanaCard.number + '</strong></div>';
            if (u.ghanaCard.name) {
                ghanaCardHtml += '<div style="font-size:0.75rem;color:#5a6572;">' + u.ghanaCard.name + '</div>';
            }
        }
        
        // Sign-up method
        var signUpMethod = u.authProvider === 'google' ? '<i class="fab fa-google" style="color:#ea4335;"></i> Google' : '<i class="fas fa-envelope" style="color:#0064d2;"></i> Email';
        
        // Verified status + seller tier
        var verifiedHtml = '<span style="color:#5a6572;font-size:0.8rem;">Not verified</span>';
        if (u.verified === true) {
            var tier = u.sellerTier || 'starter';
            var foundingTag = u.isFoundingSeller === true ? ' <span title="Founding Seller — 0% commission" style="color:#f59e0b;font-size:0.75rem;">🏆</span>' : '';
            if (tier === 'trusted') {
                verifiedHtml = '<span class="status-badge" style="background:#22c55e;color:white;">⭐ Trusted</span>' + foundingTag;
            } else if (tier === 'verified') {
                verifiedHtml = '<span class="status-badge" style="background:#0064d2;color:white;">✓ Verified</span>' + foundingTag;
            } else {
                verifiedHtml = '<span class="status-badge" style="background:#f59e0b;color:white;">🆕 Starter</span>' + foundingTag;
            }
        } else if (u.verificationStatus === 'pending') {
            verifiedHtml = '<span class="status-badge" style="background:#f59e0b;color:white;">Pending</span>';
        } else if (u.verificationStatus === 'rejected') {
            verifiedHtml = '<span class="status-badge" style="background:#e74c3c;color:white;">Rejected</span>';
        }
        
        var joinDate = '—';
        if (u.createdAt) {
            var d = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
            joinDate = d.toLocaleDateString();
        }
        
        var initial = name.charAt(0).toUpperCase();
        var avatarHtml = u.photoURL 
            ? '<img src="' + u.photoURL + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">'
            : '<div style="width:36px;height:36px;border-radius:50%;background:#0064d2;color:white;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:0.85rem;">' + initial + '</div>';
        
        var actions = '';
        if (status === 'pending') {
            actions = '<button class="btn btn-small" onclick="approveUser(' + "'" + u.id + "'" + ')" style="padding:0.3rem 0.6rem;font-size:0.75rem;background:#22c55e;color:white;border:none;"><i class="fas fa-check"></i> Approve</button> ' +
                      '<button class="btn btn-small" onclick="blockUser(' + "'" + u.id + "'" + ')" style="padding:0.3rem 0.6rem;font-size:0.75rem;background:#e74c3c;color:white;border:none;"><i class="fas fa-ban"></i> Block</button>';
        } else if (status === 'approved') {
            actions = '<button class="btn btn-small" onclick="blockUser(' + "'" + u.id + "'" + ')" style="padding:0.3rem 0.6rem;font-size:0.75rem;background:#e74c3c;color:white;border:none;"><i class="fas fa-ban"></i> Block</button>';
            if (u.verificationStatus === 'pending') {
                actions += ' <button class="btn btn-small" onclick="viewVerification(' + "'" + u.id + "'" + ')" style="padding:0.3rem 0.6rem;font-size:0.75rem;background:#0064d2;color:white;border:none;"><i class="fas fa-eye"></i> Review</button>';
            }
            // Direct verify/revoke — works even if user never uploaded documents
            if (u.verified === true) {
                actions += ' <button class="btn btn-small" onclick="directVerifyUser(' + "'" + u.id + "'" + ',' + "'" + name.replace(/'/g, "\\'") + "'" + ')" title="Re-verify (re-runs verification and confirms in database)" style="padding:0.3rem 0.5rem;font-size:0.75rem;background:#0064d2;color:white;border:none;"><i class="fas fa-redo"></i></button>';
                actions += ' <button class="btn btn-small" onclick="revokeVerification(' + "'" + u.id + "'" + ')" title="Remove seller verification" style="padding:0.3rem 0.6rem;font-size:0.75rem;background:#767676;color:white;border:none;"><i class="fas fa-user-times"></i> Unverify</button>';
                // Tier management for verified sellers
                var currentTier = u.sellerTier || 'starter';
                actions += ' <select onchange="if(this.value) setUserTier(' + "'" + u.id + "'" + ', this.value)" title="Set seller tier" style="padding:0.25rem 0.3rem;font-size:0.72rem;border:1px solid #d1d5db;border-radius:6px;max-width:110px;">' +
                    '<option value="">Tier…</option>' +
                    '<option value="starter"' + (currentTier === 'starter' ? ' selected' : '') + '>🆕 Starter</option>' +
                    '<option value="verified"' + (currentTier === 'verified' ? ' selected' : '') + '>✅ Verified</option>' +
                    '<option value="trusted"' + (currentTier === 'trusted' ? ' selected' : '') + '>⭐ Trusted</option>' +
                '</select>';
                // Founding Seller toggle
                actions += ' <button class="btn btn-small" onclick="toggleFoundingSeller(' + "'" + u.id + "'" + ',' + "'" + name.replace(/'/g, "\\'") + "'" + ')" title="' + (u.isFoundingSeller === true ? 'Remove Founding Seller status' : 'Mark as Founding Seller (0% commission)') + '" style="padding:0.3rem 0.5rem;font-size:0.75rem;background:' + (u.isFoundingSeller === true ? '#f59e0b' : '#e5e7eb') + ';color:' + (u.isFoundingSeller === true ? 'white' : '#374151') + ';border:none;">🏆</button>';
            } else {
                actions += ' <button class="btn btn-small" onclick="directVerifyUser(' + "'" + u.id + "'" + ',' + "'" + name.replace(/'/g, "\\'") + "'" + ')" title="Verify directly (no documents needed)" style="padding:0.3rem 0.6rem;font-size:0.75rem;background:#22c55e;color:white;border:none;"><i class="fas fa-user-check"></i> Verify</button>';
            }
        } else {
            actions = '<button class="btn btn-small" onclick="approveUser(' + "'" + u.id + "'" + ')" style="padding:0.3rem 0.6rem;font-size:0.75rem;background:#22c55e;color:white;border:none;"><i class="fas fa-check"></i> Approve</button>';
        }
        
        html += '<tr>' +
            '<td><div style="display:flex;align-items:center;gap:0.65rem;">' + avatarHtml + '<strong style="font-size:0.85rem;">' + name + '</strong></div></td>' +
            '<td style="font-size:0.85rem;">' + email + '</td>' +
            '<td style="font-size:0.85rem;">' + phone + '</td>' +
            '<td>' + ghanaCardHtml + '</td>' +
            '<td style="font-size:0.82rem;">' + signUpMethod + '</td>' +
            '<td><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
            '<td>' + verifiedHtml + '</td>' +
            '<td style="font-size:0.82rem;color:#5a6572;">' + joinDate + '</td>' +
            '<td>' + actions + '</td>' +
        '</tr>';
    });
    
    tbody.innerHTML = html;
}

function approveUser(userId) {
    if (typeof firebaseDB === 'undefined') return;
    firebaseDB.collection('users').doc(userId).set({ status: 'approved' }, { merge: true }).then(function() {
        showFlashMessage('User approved!', 'success');
        loadAdminUsers();
    }).catch(function(err) {
        showFlashMessage('Error: ' + err.message, 'error');
    });
}

function blockUser(userId) {
    if (!confirm('Block this user? They will not be able to log in.')) return;
    if (typeof firebaseDB === 'undefined') return;
    firebaseDB.collection('users').doc(userId).set({ status: 'blocked' }, { merge: true }).then(function() {
        showFlashMessage('User blocked', 'success');
        loadAdminUsers();
    }).catch(function(err) {
        showFlashMessage('Error: ' + err.message, 'error');
    });
}

// ============================================================================
// USER ACTIONS — restore row buttons the table still renders (dead handlers)
// The users table's Verify/Unverify/Tier/🏆/Review buttons call these by name,
// but the implementations were lost in the 2026-09 bundling refactor — every
// click threw "X is not defined". Restored (founding-seller 0% and the tier
// badge contract match today's server + dashboard code).
// ============================================================================

/* Paid plan active right now? (used so admin actions never downgrade a paying seller) */
function isPremiumActive(u) {
    try {
        if (!u || u.isPremium !== true) return false;
        var exp = u.premiumExpiry;
        var d = exp && exp.toDate ? exp.toDate() : (exp ? new Date(exp) : null);
        return !!(d && d > new Date());
    } catch (e) { return false; }
}

/* After verification, free sellers sit at Starter; paying sellers keep their plan. */
function assignSellerTier(userId) {
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) return;
    firebaseDB.collection('users').doc(userId).get().then(function (doc) {
        if (!doc.exists) return;
        if (isPremiumActive(doc.data())) return;   // paid plan — never override
        return firebaseDB.collection('users').doc(userId).set({
            sellerTier: 'starter', premiumTier: 'starter',
            commissionRate: 5, boostLevel: 0, isPremium: false
        }, { merge: true });
    }).catch(function (err) { console.warn('assignSellerTier error', err); });
}

/* Verify a seller manually — no documents needed (admin judgement). */
function directVerifyUser(userId, userName) {
    var existingUser = (typeof adminUsersCache !== 'undefined')
        ? adminUsersCache.find(function (u) { return u.id === userId; })
        : null;
    var alreadyVerified = existingUser && existingUser.verified === true;
    if (!confirm(alreadyVerified
        ? 'Re-verify "' + userName + '"?\n\nThis re-runs seller verification and confirms the verified flag is saved in the database.'
        : 'Directly verify "' + userName + '" as a seller?\n\nThey will be able to list products immediately — no Ghana Card or passport photo required.\n\nThey will start as a Starter Seller unless they have a paid plan.')) return;
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
        showFlashMessage('Firebase not connected.', 'error');
        return;
    }
    firebaseDB.collection('users').doc(userId).set({
        verified: true,
        verificationStatus: 'approved',
        verificationApprovedAt: firebase.firestore.FieldValue.serverTimestamp(),
        directVerifiedByAdmin: true,
        directVerifiedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
        // READ-BACK: prove the write actually landed
        return firebaseDB.collection('users').doc(userId).get({ source: 'server' });
    }).then(function (doc) {
        var data = doc.exists ? doc.data() : {};
        if (data.verified === true) {
            assignSellerTier(userId);
            showFlashMessage('"' + userName + '" is now a seller! ✓ (verified flag confirmed in database)', 'success');
            loadAdminUsers();
        } else {
            alert('⚠️ The verify write did NOT stick!\n\nRead-back shows: verified=' + JSON.stringify(data.verified) +
                ', verificationStatus=' + JSON.stringify(data.verificationStatus) + '\nDoc exists: ' + doc.exists +
                '\n\nPlease check Firestore security rules or try again.');
        }
    }).catch(function (err) {
        alert('Error verifying user: ' + err.message);
    });
}

/* Remove seller verification from a user. */
function revokeVerification(userId) {
    var reason = prompt('Remove seller verification from this user?\n\nOptionally provide a reason (saved to the user record):');
    if (reason === null) return;
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
        showFlashMessage('Firebase not connected.', 'error');
        return;
    }
    firebaseDB.collection('users').doc(userId).set({
        verified: false,
        verificationStatus: 'rejected',
        verificationRejectionReason: 'Verification revoked by admin' + (reason ? ': ' + reason : ''),
        verificationRevokedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
        showFlashMessage('Seller verification removed.', 'warning');
        loadAdminUsers();
    }).catch(function (err) {
        alert('Error revoking verification: ' + err.message);
    });
}

/* Tier dropdown on the users row — sets the seller's badge tier
   (Starter 🆕 / Verified ✓ / Trusted ⭐) as shown on their dashboard and cards.
   Paid plans (Bronze…Diamond, fees, boosts) are untouched by this. */
function setUserTier(userId, tier) {
    tier = String(tier || 'starter').toLowerCase();
    if (['starter', 'verified', 'trusted'].indexOf(tier) === -1) tier = 'starter';
    var labels = { starter: '🆕 Starter', verified: '✅ Verified', trusted: '⭐ Trusted' };
    if (!confirm('Set this seller’s tier badge to ' + labels[tier] + '?\n\n(Their paid plan and fees are not affected.)')) return;
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) return;
    firebaseDB.collection('users').doc(userId).set({
        sellerTier: tier,
        tierSetByAdmin: true,
        tierSetAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
        showFlashMessage('Tier set to ' + labels[tier], 'success');
        loadAdminUsers();
    }).catch(function (err) {
        alert('Error setting tier: ' + err.message);
    });
}

/* Founding Seller 🏆 — 0% commission, honoured by the server at payout time. */
function toggleFoundingSeller(userId, name) {
    var user = (typeof adminUsersCache !== 'undefined') ? adminUsersCache.find(function (u) { return u.id === userId; }) : null;
    var isFounding = user && user.isFoundingSeller === true;
    if (!confirm(isFounding
        ? 'Remove Founding Seller status from "' + name + '"? They will pay normal commission.'
        : 'Mark "' + name + '" as a Founding Seller?\n\nThey will pay 0% commission for the founding period.')) return;
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) return;
    firebaseDB.collection('users').doc(userId).set({
        isFoundingSeller: !isFounding,
        foundingSellerSetAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
        showFlashMessage(isFounding ? 'Founding Seller status removed.' : '"' + name + '" is now a Founding Seller (0% commission)! 🎉', 'success');
        loadAdminUsers();
    }).catch(function (err) {
        alert('Error: ' + err.message);
    });
}

/* Review a pending verification: documents + escrow history, approve/reject. */
function viewVerification(userId) {
    var user = adminUsersCache.find(function (u) { return u.id === userId; });
    if (!user || (!user.ghanaCard && !user.passportPhoto)) {
        alert('Verification data not found');
        return;
    }
    var modal = document.createElement('div');
    modal.id = 'verificationModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = '<div style="background:white;border-radius:12px;padding:2rem;max-width:850px;width:100%;max-height:90vh;overflow-y:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">' +
            '<h2 style="margin:0;"><i class="fas fa-id-card"></i> Seller Verification Review</h2>' +
            '<button onclick="document.getElementById(\'verificationModal\').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#767676;"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem;">' +
            '<div>' +
                '<h3 style="font-size:1rem;margin-bottom:0.5rem;">Ghana Card</h3>' +
                (user.ghanaCard && user.ghanaCard.photoURL
                    ? '<img src="' + user.ghanaCard.photoURL + '" style="width:100%;border-radius:8px;border:2px solid #e5e5e5;">'
                    : '<div style="background:#f0f9ff;border:2px dashed #0ea5e9;border-radius:8px;padding:1.5rem;text-align:center;"><i class="fas fa-id-card" style="font-size:2rem;color:#0ea5e9;margin-bottom:0.5rem;"></i><p style="margin:0;font-size:0.82rem;color:#0369a1;">Number-only verification<br>(no card photo required)</p></div>') +
                '<p style="margin-top:0.5rem;font-size:0.9rem;"><strong>Card Number:</strong> ' + ((user.ghanaCard && user.ghanaCard.number) || 'N/A') + '</p>' +
            '</div>' +
            '<div>' +
                '<h3 style="font-size:1rem;margin-bottom:0.5rem;">Passport Photo</h3>' +
                (user.passportPhoto
                    ? '<img src="' + user.passportPhoto + '" style="width:100%;border-radius:8px;border:2px solid #e5e5e5;">'
                    : '<div style="background:#f5f5f5;border:2px dashed #d1d5db;border-radius:8px;padding:1.5rem;text-align:center;"><i class="fas fa-user" style="font-size:2rem;color:#9ca3af;margin-bottom:0.5rem;"></i><p style="margin:0;font-size:0.82rem;color:#767676;">No passport photo<br>(direct verification)</p></div>') +
                '<p style="margin-top:0.5rem;font-size:0.9rem;"><strong>Name:</strong> ' + (user.name || user.firstName || 'N/A') + '</p>' +
            '</div>' +
        '</div>' +
        '<div style="background:#f5f5f5;padding:1rem;border-radius:8px;margin-bottom:1.5rem;">' +
            '<p style="margin:0;font-size:0.9rem;"><strong>Email:</strong> ' + (user.email || 'N/A') + '</p>' +
            '<p style="margin:0.5rem 0 0;font-size:0.9rem;"><strong>Phone:</strong> ' + (user.phone || 'N/A') + '</p>' +
            '<p style="margin:0.5rem 0 0;font-size:0.9rem;"><strong>Submitted:</strong> ' + (user.verificationSubmittedAt ? new Date(user.verificationSubmittedAt.seconds * 1000).toLocaleString() : 'N/A') + '</p>' +
        '</div>' +
        '<div id="adminEscrowSection" style="margin-bottom:1.5rem;">' +
            '<div style="background:#eff6ff;padding:1rem;border-radius:8px;border-left:4px solid #0064d2;">' +
                '<h3 style="font-size:1rem;margin:0 0 0.5rem;"><i class="fas fa-shield-alt"></i> Escrow Purchase History</h3>' +
                '<p style="font-size:0.85rem;color:#767676;margin:0;" id="adminEscrowLoading"><i class="fas fa-spinner fa-spin"></i> Loading purchase history...</p>' +
                '<div id="adminEscrowContent" style="display:none;"></div>' +
            '</div>' +
        '</div>' +
        '<div style="display:flex;gap:1rem;justify-content:flex-end;">' +
            '<button onclick="rejectVerification(\'' + userId + '\')" style="padding:0.75rem 1.5rem;background:#e74c3c;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">' +
                '<i class="fas fa-times"></i> Reject' +
            '</button>' +
            '<button onclick="approveVerification(\'' + userId + '\')" style="padding:0.75rem 1.5rem;background:#22c55e;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">' +
                '<i class="fas fa-check"></i> Approve & Verify' +
            '</button>' +
        '</div>' +
    '</div>';
    document.body.appendChild(modal);
    loadAdminEscrowHistory(userId);
    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.remove();
    });
}

function loadAdminEscrowHistory(userId) {
    if (typeof firebaseDB === 'undefined') return;
    firebaseDB.collection('orders')
        .where('userId', '==', userId)
        .where('status', '==', 'completed')
        .get().then(function (snap) {
            var loading = document.getElementById('adminEscrowLoading');
            var content = document.getElementById('adminEscrowContent');
            if (!loading || !content) return;
            loading.style.display = 'none';
            content.style.display = '';
            var count = snap.size;
            var required = 2;
            var statusColor = count >= required ? '#22c55e' : '#e74c3c';
            var statusText = count >= required ? '✓ Requirement Met' : '✗ Requirement NOT Met';
            var statusBg = count >= required ? 'rgba(34,197,94,0.1)' : 'rgba(231,76,60,0.1)';
            var html = '<div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem;">' +
                '<span style="background:' + statusBg + ';color:' + statusColor + ';padding:0.3rem 0.75rem;border-radius:20px;font-size:0.85rem;font-weight:600;">' + statusText + '</span>' +
                '<span style="font-size:0.9rem;"><strong>' + count + '</strong> of <strong>' + required + '</strong> required purchases completed</span>' +
            '</div>';
            var percent = Math.min(100, Math.round((count / required) * 100));
            var barColor = count >= required ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #f59e0b, #d97706)';
            html += '<div style="width:100%;height:8px;background:#e5e5e5;border-radius:4px;margin-bottom:0.75rem;overflow:hidden;">' +
                '<div style="height:100%;width:' + percent + '%;border-radius:4px;background:' + barColor + ';transition:width 0.6s;"></div>' +
            '</div>';
            if (count > 0) {
                html += '<div style="max-height:200px;overflow-y:auto;">';
                var orderNum = 0;
                snap.forEach(function (doc) {
                    orderNum++;
                    var order = doc.data();
                    var dateStr = 'N/A';
                    if (order.confirmedAt) {
                        var d = order.confirmedAt.toDate ? order.confirmedAt.toDate() : new Date(order.confirmedAt);
                        dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    } else if (order.createdAt) {
                        var d2 = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                        dateStr = d2.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    }
                    var itemName = 'Order';
                    if (order.items && order.items.length > 0) {
                        itemName = order.items[0].name || order.items[0].title || 'Order';
                        if (order.items.length > 1) itemName += ' +' + (order.items.length - 1) + ' more';
                    }
                    var totalStr = order.total ? 'GHS ' + Number(order.total).toLocaleString() : '';
                    html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid #f0f0f0;font-size:0.85rem;">' +
                        '<i class="fas fa-check-circle" style="color:#22c55e;"></i>' +
                        '<span style="font-weight:500;">#' + orderNum + '</span>' +
                        '<span>' + itemName + '</span>' +
                        (totalStr ? '<span style="color:#767676;">— ' + totalStr + '</span>' : '') +
                        '<span style="margin-left:auto;color:#767676;font-size:0.8rem;">' + dateStr + '</span>' +
                    '</div>';
                });
                html += '</div>';
            } else {
                html += '<p style="font-size:0.85rem;color:#e74c3c;margin:0.5rem 0 0;"><i class="fas fa-exclamation-triangle"></i> This user has no completed escrow purchases.</p>';
            }
            firebaseDB.collection('orders').where('userId', '==', userId).get().then(function (allSnap) {
                var pendingOrders = allSnap.size - count;
                if (pendingOrders > 0) {
                    html += '<p style="font-size:0.8rem;color:#767676;margin:0.5rem 0 0;"><i class="fas fa-info-circle"></i> ' + pendingOrders + ' order' + (pendingOrders > 1 ? 's' : '') + ' still in progress (not yet delivered/confirmed)</p>';
                }
                if (content) content.innerHTML = html;
            }).catch(function () {
                if (content) content.innerHTML = html;
            });
        }).catch(function (err) {
            var loading = document.getElementById('adminEscrowLoading');
            if (loading) {
                loading.innerHTML = '<span style="color:#e74c3c;"><i class="fas fa-exclamation-circle"></i> Error loading purchase history</span>';
            }
            console.error('Error loading admin escrow history:', err);
        });
}

function approveVerification(userId) {
    if (!confirm('Approve this seller verification? They will be able to list products.')) return;
    if (typeof firebaseDB === 'undefined') return;
    var approveBtn = document.querySelector('#verificationModal button[onclick*="approveVerification"]');
    if (approveBtn) {
        approveBtn.disabled = true;
        approveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Approving...';
    }
    firebaseDB.collection('users').doc(userId).set({
        verified: true,
        verificationStatus: 'approved',
        verificationApprovedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
        return firebaseDB.collection('users').doc(userId).get({ source: 'server' });
    }).then(function (doc) {
        var data = doc.exists ? doc.data() : {};
        var modal = document.getElementById('verificationModal');
        if (modal) modal.remove();
        if (data.verified === true) {
            assignSellerTier(userId);
            showFlashMessage('Seller verified successfully! ✓ (confirmed in database)', 'success');
            loadAdminUsers();
        } else {
            alert('⚠️ The verify write did NOT stick!\n\nRead-back shows: verified=' + JSON.stringify(data.verified) +
                ', verificationStatus=' + JSON.stringify(data.verificationStatus) + '\nDoc exists: ' + doc.exists);
            if (approveBtn) {
                approveBtn.disabled = false;
                approveBtn.innerHTML = '<i class="fas fa-check"></i> Approve & Verify';
            }
        }
    }).catch(function (err) {
        alert('Error approving verification: ' + err.message);
        if (approveBtn) {
            approveBtn.disabled = false;
            approveBtn.innerHTML = '<i class="fas fa-check"></i> Approve & Verify';
        }
    });
}

function rejectVerification(userId) {
    var reason = prompt('Reason for rejection (optional):');
    if (reason === null) return;
    if (typeof firebaseDB === 'undefined') return;
    var rejectBtn = document.querySelector('#verificationModal button[onclick*="rejectVerification"]');
    if (rejectBtn) {
        rejectBtn.disabled = true;
        rejectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rejecting...';
    }
    firebaseDB.collection('users').doc(userId).set({
        verified: false,
        verificationStatus: 'rejected',
        verificationRejectionReason: reason || '',
        verificationRejectedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
        var modal = document.getElementById('verificationModal');
        if (modal) modal.remove();
        showFlashMessage('Verification rejected.', 'warning');
        loadAdminUsers();
    }).catch(function (err) {
        alert('Error rejecting verification: ' + err.message);
        if (rejectBtn) {
            rejectBtn.disabled = false;
            rejectBtn.innerHTML = '<i class="fas fa-times"></i> Reject';
        }
    });
}

// ============================================================================
// ORDER MANAGEMENT
// ============================================================================

function initOrderManagement() {
    var orderSearch = document.getElementById('orderSearch');
    if (orderSearch) {
        orderSearch.addEventListener('input', debounce(function(){
            applyOrderFilters();
        }, 300));
    }
    // Date filter + group toggle wiring
    var dateFilter = document.getElementById('orderDateFilter');
    var dateFrom = document.getElementById('orderDateFrom');
    var dateTo = document.getElementById('orderDateTo');
    var dateClear = document.getElementById('orderDateClear');
    var groupCb = document.getElementById('orderGroupByDate');
    if (dateFilter){
        dateFilter.addEventListener('change', function(){
            var v=this.value;
            var showCustom = v==='custom';
            var dash=document.getElementById('orderDateDash');
            if (dateFrom) dateFrom.style.display = showCustom ? '' : 'none';
            if (dateTo) dateTo.style.display = showCustom ? '' : 'none';
            if (dash) dash.style.display = showCustom ? '' : 'none';
            if (dateClear) dateClear.style.display = v ? '' : 'none';
            if (!showCustom){ applyOrderFilters(); }
        });
    }
    if (dateFrom) dateFrom.addEventListener('change', function(){ applyOrderFilters(); });
    if (dateTo) dateTo.addEventListener('change', function(){ applyOrderFilters(); });
    if (dateClear) dateClear.addEventListener('click', function(){
        var df=document.getElementById('orderDateFilter'); if(df) df.value='';
        if(dateFrom){ dateFrom.value=''; dateFrom.style.display='none'; }
        if(dateTo){ dateTo.value=''; dateTo.style.display='none'; }
        var dash=document.getElementById('orderDateDash'); if(dash) dash.style.display='none';
        this.style.display='none';
        applyOrderFilters();
    });
    if (groupCb){
        groupCb.addEventListener('change', function(){
            orderGroupByDateEnabled = this.checked;
            collapsedOrderGroups.clear();
            renderOrdersPaginated();
            updateOrderDateInfo();
        });
        orderGroupByDateEnabled = groupCb.checked;
    }
    console.log('Order management initialized — grouped by date + filters');
}
function filterOrders(query){
    // legacy direct call — delegate to unified filters
    var searchEl = document.getElementById('orderSearch');
    if (searchEl && query !== undefined) searchEl.value = query;
    applyOrderFilters();
}
function getOrderDateValue(order){
    var d = order.createdAt;
    if (!d) return null;
    try{
        if (d.toDate) return d.toDate();
        if (d instanceof Date) return d;
        return new Date(d);
    }catch(e){ return null; }
}
function isOrderInDateFilter(order){
    var filterEl = document.getElementById('orderDateFilter');
    if (!filterEl || !filterEl.value) return true;
    var v = filterEl.value;
    var od = getOrderDateValue(order);
    if (!od || isNaN(od.getTime())) return true; // keep undated in All, hide in filtered? keep visible for All only
    var now = new Date();
    var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var odDay = new Date(od.getFullYear(), od.getMonth(), od.getDate());
    var diffDays = Math.floor((startOfToday - odDay) / 86400000);
    if (v==='today') return diffDays===0;
    if (v==='yesterday') return diffDays===1;
    if (v==='7') return diffDays>=0 && diffDays<7;
    if (v==='30') return diffDays>=0 && diffDays<30;
    if (v==='custom'){
        var fromEl=document.getElementById('orderDateFrom');
        var toEl=document.getElementById('orderDateTo');
        var fromVal = fromEl && fromEl.value ? new Date(fromEl.value) : null;
        var toVal = toEl && toEl.value ? new Date(toEl.value) : null;
        if (fromVal) { fromVal.setHours(0,0,0,0); if (odDay < fromVal) return false; }
        if (toVal) { toVal.setHours(23,59,59,999); if (od > toVal) return false; }
        return true;
    }
    return true;
}
function getFilteredOrders(){
    var searchEl = document.getElementById('orderSearch');
    var q = searchEl ? searchEl.value.toLowerCase().trim() : '';
    var base = (window.adminOrdersCache||[]);
    var filtered = base.filter(function(o){
        if (q){
            var match = (o.id||'').toLowerCase().includes(q) || (o.buyerEmail||'').toLowerCase().includes(q) || (o.sellerName||'').toLowerCase().includes(q) || (o.productTitle||'').toLowerCase().includes(q);
            if (!match) return false;
        }
        if (!isOrderInDateFilter(o)) return false;
        return true;
    });
    return filtered;
}
function applyOrderFilters(){
    window.ordersCurrentPage = 1;
    var filtered = getFilteredOrders();
    // keep filtered cache in sync for pagination
    window.filteredOrdersCache = filtered.slice();
    renderOrdersPaginated();
    updateOrderDateInfo();
}
function updateOrderDateInfo(){
    var info=document.getElementById('orderDateInfo');
    if (!info) return;
    var total=(window.adminOrdersCache||[]).length;
    var filtered=(window.filteredOrdersCache||[]).length;
    var filterEl=document.getElementById('orderDateFilter');
    var v=filterEl? filterEl.value : '';
    if (!v && !document.getElementById('orderSearch')?.value){
        info.textContent = total ? total + ' orders' : '';
    } else {
        info.textContent = filtered + ' of ' + total;
    }
    var btn=document.getElementById('orderToggleGroupsBtn');
    if (btn) btn.style.display = orderGroupByDateEnabled && filtered>0 ? '' : 'none';
}
function formatOrderGroupLabel(date){
    if (!date || isNaN(date.getTime())) return 'Undated';
    var now=new Date();
    var t=new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var y=new Date(t); y.setDate(t.getDate()-1);
    var d=new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var timeStr=date.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    if (d.getTime()===t.getTime()) return 'Today — ' + date.toLocaleDateString('en-GB',{weekday:'long', day:'2-digit', month:'short', year:'numeric'});
    if (d.getTime()===y.getTime()) return 'Yesterday — ' + date.toLocaleDateString('en-GB',{weekday:'long', day:'2-digit', month:'short', year:'numeric'});
    // This week?
    var daysDiff=Math.floor((t - d)/86400000);
    if (daysDiff>=0 && daysDiff<7){
        return date.toLocaleDateString('en-GB',{weekday:'long', day:'2-digit', month:'short', year:'numeric'}) + ' · ' + daysDiff + 'd ago';
    }
    return date.toLocaleDateString('en-GB',{weekday:'short', day:'2-digit', month:'short', year:'numeric'});
}
function toggleOrderGroup(dateKey){
    if (collapsedOrderGroups.has(dateKey)) collapsedOrderGroups.delete(dateKey);
    else collapsedOrderGroups.add(dateKey);
    // toggle rows without full re-render for speed
    var rows=document.querySelectorAll('tr[data-group="'+dateKey+'"]');
    var collapsed=collapsedOrderGroups.has(dateKey);
    rows.forEach(function(r){ r.style.display = collapsed ? 'none' : ''; });
    var grp=document.querySelector('tr.orders-group-header[data-group="'+dateKey+'"] .group-chevron');
    if (grp) grp.className = 'fas fa-chevron-' + (collapsed ? 'down' : 'up') + ' group-chevron';
}
function toggleAllOrderGroups(){
    var allGroups=document.querySelectorAll('tr.orders-group-header');
    if (!allGroups.length) return;
    var shouldCollapse = collapsedOrderGroups.size !== allGroups.length;
    allGroups.forEach(function(h){
        var k=h.getAttribute('data-group');
        if (shouldCollapse) collapsedOrderGroups.add(k); else collapsedOrderGroups.delete(k);
        var rows=document.querySelectorAll('tr[data-group="'+k+'"]');
        rows.forEach(function(r){ r.style.display = shouldCollapse ? 'none' : ''; });
        var chev=h.querySelector('.group-chevron');
        if (chev) chev.className = 'fas fa-chevron-' + (shouldCollapse ? 'down' : 'up') + ' group-chevron';
    });
    var btn=document.getElementById('orderToggleGroupsBtn');
    if (btn){
        btn.innerHTML = shouldCollapse ? '<i class="fas fa-expand-alt"></i> Expand all' : '<i class="fas fa-compress-alt"></i> Collapse all';
    }
}

// ============================================================================
// CATEGORY MANAGEMENT
// ============================================================================

function initCategoryManagement() {
    var addBtn = document.getElementById('addCategoryBtn');
    if (!addBtn) return;
    
    addBtn.addEventListener('click', function() { openCategoryModal(); });
    loadAdminCategories();
}

var adminCategoriesCache = [];

function loadAdminCategories() {
    var grid = document.getElementById('categoriesAdminGrid');
    if (!grid) return;
    
    // First show the built-in categories
    var builtIn = [
        { id: 'electronics', name: 'Electronics', icon: 'fa-mobile-alt', color: '#0064d2' },
        { id: 'fashion', name: 'Fashion', icon: 'fa-tshirt', color: '#e74c3c' },
        { id: 'home-garden', name: 'Home & Garden', icon: 'fa-home', color: '#86b817' },
        { id: 'vehicles', name: 'Vehicles', icon: 'fa-car', color: '#f5af02' },
        { id: 'services', name: 'Services', icon: 'fa-concierge-bell', color: '#9b59b6' },
        { id: 'sports', name: 'Sports', icon: 'fa-futbol', color: '#3498db' },
        { id: 'books-media', name: 'Books & Media', icon: 'fa-book', color: '#795548' },
        { id: 'baby-kids', name: 'Baby & Kids', icon: 'fa-baby', color: '#e91e63' },
        { id: 'beauty-health', name: 'Beauty & Health', icon: 'fa-spa', color: '#ff69b4' },
        { id: 'food-groceries', name: 'Food & Groceries', icon: 'fa-utensils', color: '#ff5722' },
        { id: 'pets', name: 'Pets', icon: 'fa-paw', color: '#8bc34a' },
        { id: 'jobs-skills', name: 'Jobs & Skills', icon: 'fa-briefcase', color: '#3f51b5' },
        { id: 'real-estate', name: 'Real Estate', icon: 'fa-building', color: '#607d8b' },
        { id: 'musical-instruments', name: 'Musical Instruments', icon: 'fa-guitar', color: '#d35400' },
        { id: 'others', name: 'Others', icon: 'fa-tag', color: '#95a5a6' }
    ];
    
    adminCategoriesCache = builtIn;
    
    // Load custom categories and disabled categories from Firestore
    if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        firebaseDB.collection('categories').get().then(function(snapshot) {
            var disabledIds = {};
            snapshot.forEach(function(doc) {
                var data = doc.data();
                if (data.isActive === false) {
                    // Mark built-in category as disabled
                    disabledIds[doc.id] = true;
                } else {
                    // Custom active category
                    var exists = adminCategoriesCache.some(function(c) { return c.id === doc.id; });
                    if (exists) {
                        // Override built-in with saved data (edited)
                        adminCategoriesCache = adminCategoriesCache.map(function(c) {
                            if (c.id === doc.id) return { id: doc.id, ...data };
                            return c;
                        });
                    } else {
                        adminCategoriesCache.push({ id: doc.id, ...data, isCustom: true });
                    }
                }
            });
            // Remove disabled built-in categories
            adminCategoriesCache = adminCategoriesCache.filter(function(c) {
                return !disabledIds[c.id];
            });
            renderAdminCategories();
        }).catch(function() {
            renderAdminCategories();
        });
    } else {
        renderAdminCategories();
    }
}

function renderAdminCategories() {
    var grid = document.getElementById('categoriesAdminGrid');
    if (!grid) return;
    
    // Count products per category from cache
    var categoryCounts = {};
    
    var html = '';
    adminCategoriesCache.forEach(function(cat) {
        var count = categoryCounts[cat.id] || 0;
        var isCustom = cat.isCustom === true;
        
        html += '<div class="cat-admin-card">' +
            '<div class="cat-admin-header">' +
                '<div class="cat-admin-icon" style="background: ' + (cat.color || '#0064d2') + ';"><i class="fas ' + (cat.icon || 'fa-tag') + '"></i></div>' +
                '<div class="cat-admin-actions">' +
                    '<button class="action-btn" title="Edit" onclick="openCategoryModal(\'' + cat.id + '\')"><i class="fas fa-edit"></i></button>' +
                    '<button class="action-btn danger" title="Delete" onclick="deleteCategory(\'' + cat.id + '\',\'' + (cat.name || '').replace(/'/g, "\\'") + '\')"><i class="fas fa-trash"></i></button>' +
                '</div>' +
            '</div>' +
            '<h4>' + (cat.name || 'Untitled') + (isCustom ? ' <span style="font-size:0.65rem;color:#5a6572;">(custom)</span>' : '') + '</h4>' +
            '<div class="cat-admin-stats">' +
                '<span><i class="fas fa-box"></i> ' + count + ' listings</span>' +
                '<span><i class="fas fa-eye"></i> 0 views</span>' +
            '</div>' +
        '</div>';
    });
    
    grid.innerHTML = html;
    
    // Update nav count badge for categories
    updateCount('countCategories', adminCategoriesCache.length);
    
    // Load product counts per category from Firestore
    loadCategoryProductCounts();
}

function loadCategoryProductCounts() {
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) return;
    
    // Get all products and count by category
    firebaseDB.collection('products').get().then(function(snapshot) {
        var counts = {};
        snapshot.forEach(function(doc) {
            var data = doc.data();
            if (data.category && data.isActive !== false && data.isSold !== true) {
                counts[data.category] = (counts[data.category] || 0) + 1;
            }
        });
        
        // Update each category card's count
        adminCategoriesCache.forEach(function(cat) {
            var count = counts[cat.id] || 0;
            // Find the stats span in the card
            var cards = document.querySelectorAll('#categoriesAdminGrid .cat-admin-card');
            cards.forEach(function(card) {
                var h4 = card.querySelector('h4');
                if (h4 && h4.textContent.replace(/\s*\(custom\)/, '').trim() === cat.name) {
                    var statsSpans = card.querySelectorAll('.cat-admin-stats span');
                    if (statsSpans[0]) {
                        statsSpans[0].innerHTML = '<i class="fas fa-box"></i> ' + count + ' listings';
                    }
                }
            });
        });
    }).catch(function(err) {
        console.warn('Could not load category counts:', err);
    });
}

function openCategoryModal(categoryId) {
    var cat = categoryId ? adminCategoriesCache.find(function(c) { return c.id === categoryId; }) : null;
    var isEdit = !!cat;
    
    var existing = document.getElementById('categoryModal');
    if (existing) existing.remove();
    
    var modal = document.createElement('div');
    modal.id = 'categoryModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    
    // Extended icon list for marketplace categories
    var icons = [
        'fa-mobile-alt','fa-laptop','fa-tablet-alt','fa-desktop','fa-tv','fa-headphones','fa-camera','fa-gamepad',
        'fa-tshirt','fa-shoe-prints','fa-hat-cowboy','fa-glasses','fa-ring','fa-gem','fa-vest',
        'fa-home','fa-couch','fa-bed','fa-bath','fa-blender','fa-fan','fa-lightbulb','fa-door-open',
        'fa-car','fa-motorcycle','fa-bicycle','fa-truck','fa-bus','fa-tractor','fa-ship','fa-plane',
        'fa-utensils','fa-apple-alt','fa-bread-slice','fa-cheese','fa-fish','fa-drumstick-bite','fa-cookie','fa-wine-bottle',
        'fa-futbol','fa-basketball-ball','fa-baseball-ball','fa-table-tennis','fa-dumbbell','fa-running','fa-swimmer','fa-skiing',
        'fa-book','fa-music','fa-film','fa-palette','fa-theater-masks','fa-guitar','fa-microphone','fa-photo-video',
        'fa-baby','fa-child','fa-baby-carriage','fa-puzzle-piece','fa-school','fa-chalkboard-teacher',
        'fa-spa','fa-pump-medical','fa-pills','fa-heartbeat','fa-tooth','fa-eye','fa-brain',
        'fa-paw','fa-dog','fa-cat','fa-fish','fa-feather','fa-bone',
        'fa-briefcase','fa-graduation-cap','fa-tools','fa-wrench','fa-laptop-code','fa-user-tie',
        'fa-building','fa-house-user','fa-hotel','fa-warehouse','fa-store','fa-city',
        'fa-tag','fa-gift','fa-crown','fa-star','fa-fire','fa-bolt','fa-heart','fa-leaf',
        'fa-clock','fa-stopwatch','fa-hourglass-half',
        'fa-seedling','fa-tree','fa-frog','fa-sun','fa-cloud-rain','fa-mountain',
        'fa-scissors','fa-paint-brush','fa-paint-roller','fa-hammer','fa-ruler','fa-tape',
        'fa-shopping-bag','fa-shopping-cart','fa-cash-register','fa-credit-card','fa-money-bill-wave',
        'fa-wifi','fa-satellite-dish','fa-battery-full','fa-plug','fa-usb','fa-memory',
        'fa-stethoscope','fa-first-aid','fa-wheelchair','fa-procedures',
        'fa-pray','fa-mosque','fa-church','fa-synagogue','fa-om','fa-cross',
        'fa-passport','fa-suitcase-rolling','fa-map-marked-alt','fa-compass'
    ];
    
    // Preset colors
    var presetColors = [
        '#0064d2','#1a73e8','#00bcd4','#009688','#4caf50','#8bc34a',
        '#ffeb3b','#ffc107','#ff9800','#ff5722','#e74c3c','#e91e63',
        '#9c27b0','#673ab7','#3f51b5','#795548','#607d8b','#191919',
        '#ff69b4','#f5af02','#86b817','#3498db','#2ecc71','#1abc9c'
    ];
    
    var currentIcon = cat ? (cat.icon || 'fa-tag') : 'fa-tag';
    var currentColor = cat ? (cat.color || '#0064d2') : '#0064d2';
    
    // Build icon grid HTML
    var iconGridHtml = icons.map(function(ic) {
        var selected = ic === currentIcon ? 'border:2px solid #0064d2;background:rgba(0,100,210,0.1);' : 'border:2px solid #e5e5e5;background:white;';
        return '<button type="button" class="cat-icon-btn" data-icon="' + ic + '" style="' + selected + 'width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1rem;color:#333;transition:all 0.15s;" title="' + ic.replace('fa-','') + '"><i class="fas ' + ic + '"></i></button>';
    }).join('');
    
    // Build color preset HTML
    var colorPresetHtml = presetColors.map(function(co) {
        var selected = co === currentColor ? 'border:3px solid #191919;transform:scale(1.15);' : 'border:2px solid #e5e5e5;';
        return '<button type="button" class="cat-color-btn" data-color="' + co + '" style="' + selected + 'width:32px;height:32px;border-radius:50%;background:' + co + ';cursor:pointer;transition:all 0.15s;"></button>';
    }).join('');
    
    // Parse current color to RGB
    var rgb = hexToRgb(currentColor) || {r:0,g:100,b:210};
    
    modal.innerHTML = '<div style="background:white;border-radius:16px;padding:1.75rem;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">' +
            '<h2 style="margin:0;font-size:1.2rem;">' + (isEdit ? 'Edit Category' : 'Add New Category') + '</h2>' +
            '<button onclick="document.getElementById(\'categoryModal\').remove()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:#5a6572;"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<form id="categoryModalForm">' +
            '<div style="margin-bottom:1rem;">' +
                '<label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:0.35rem;">Category Name *</label>' +
                '<input type="text" id="catModalName" value="' + (cat ? (cat.name || '').replace(/"/g, '&quot;') : '') + '" required placeholder="e.g. Electronics" style="width:100%;padding:0.7rem;border:1.5px solid #e5e5e5;border-radius:8px;font-size:0.95rem;">' +
            '</div>' +
            
            '<div style="margin-bottom:1rem;">' +
                '<label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:0.5rem;">Icon</label>' +
                '<div id="catIconGrid" style="display:flex;flex-wrap:wrap;gap:6px;max-height:180px;overflow-y:auto;padding:4px;border:1px solid #e5e5e5;border-radius:8px;">' + iconGridHtml + '</div>' +
                '<input type="hidden" id="catModalIcon" value="' + currentIcon + '">' +
            '</div>' +
            
            '<div style="margin-bottom:1rem;">' +
                '<label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:0.5rem;">Color</label>' +
                '<div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem;">' +
                    '<div id="catColorPreview" style="width:48px;height:48px;border-radius:50%;background:' + currentColor + ';border:3px solid #e5e5e5;flex-shrink:0;"></div>' +
                    '<div style="flex:1;">' +
                        '<div style="display:flex;flex-wrap:wrap;gap:6px;" id="catColorPresets">' + colorPresetHtml + '</div>' +
                    '</div>' +
                '</div>' +
                '<div style="border:1px solid #e5e5e5;border-radius:8px;padding:0.75rem;">' +
                    '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">' +
                        '<label style="font-size:0.75rem;font-weight:600;width:14px;color:#e74c3c;">R</label>' +
                        '<input type="range" id="catSliderR" min="0" max="255" value="' + rgb.r + '" style="flex:1;accent-color:#e74c3c;">' +
                        '<span id="catValR" style="font-size:0.75rem;width:28px;text-align:right;">' + rgb.r + '</span>' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">' +
                        '<label style="font-size:0.75rem;font-weight:600;width:14px;color:#4caf50;">G</label>' +
                        '<input type="range" id="catSliderG" min="0" max="255" value="' + rgb.g + '" style="flex:1;accent-color:#4caf50;">' +
                        '<span id="catValG" style="font-size:0.75rem;width:28px;text-align:right;">' + rgb.g + '</span>' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:0.5rem;">' +
                        '<label style="font-size:0.75rem;font-weight:600;width:14px;color:#0064d2;">B</label>' +
                        '<input type="range" id="catSliderB" min="0" max="255" value="' + rgb.b + '" style="flex:1;accent-color:#0064d2;">' +
                        '<span id="catValB" style="font-size:0.75rem;width:28px;text-align:right;">' + rgb.b + '</span>' +
                    '</div>' +
                '</div>' +
                '<input type="hidden" id="catModalColor" value="' + currentColor + '">' +
            '</div>' +
            
            '<div id="catModalStatus" style="font-size:0.82rem;margin-bottom:0.75rem;"></div>' +
            '<div style="display:flex;gap:0.75rem;justify-content:flex-end;">' +
                '<button type="button" onclick="document.getElementById(\'categoryModal\').remove()" class="btn btn-outline">Cancel</button>' +
                '<button type="submit" class="btn btn-primary" id="catModalSaveBtn"><i class="fas fa-save"></i> ' + (isEdit ? 'Update' : 'Add Category') + '</button>' +
            '</div>' +
        '</form>' +
    '</div>';
    
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    
    // Icon selection
    modal.querySelectorAll('.cat-icon-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            modal.querySelectorAll('.cat-icon-btn').forEach(function(b) {
                b.style.border = '2px solid #e5e5e5';
                b.style.background = 'white';
            });
            this.style.border = '2px solid #0064d2';
            this.style.background = 'rgba(0,100,210,0.1)';
            document.getElementById('catModalIcon').value = this.dataset.icon;
        });
    });
    
    // Color preset selection
    modal.querySelectorAll('.cat-color-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var color = this.dataset.color;
            modal.querySelectorAll('.cat-color-btn').forEach(function(b) {
                b.style.border = '2px solid #e5e5e5';
                b.style.transform = 'scale(1)';
            });
            this.style.border = '3px solid #191919';
            this.style.transform = 'scale(1.15)';
            updateCatColor(color);
        });
    });
    
    // RGB sliders
    function updateCatColor(hex) {
        document.getElementById('catColorPreview').style.background = hex;
        document.getElementById('catModalColor').value = hex;
        var rgb = hexToRgb(hex);
        if (rgb) {
            document.getElementById('catSliderR').value = rgb.r;
            document.getElementById('catSliderG').value = rgb.g;
            document.getElementById('catSliderB').value = rgb.b;
            document.getElementById('catValR').textContent = rgb.r;
            document.getElementById('catValG').textContent = rgb.g;
            document.getElementById('catValB').textContent = rgb.b;
        }
    }
    
    ['catSliderR','catSliderG','catSliderB'].forEach(function(id) {
        document.getElementById(id).addEventListener('input', function() {
            var r = parseInt(document.getElementById('catSliderR').value);
            var g = parseInt(document.getElementById('catSliderG').value);
            var b = parseInt(document.getElementById('catSliderB').value);
            document.getElementById('catValR').textContent = r;
            document.getElementById('catValG').textContent = g;
            document.getElementById('catValB').textContent = b;
            var hex = rgbToHex(r, g, b);
            document.getElementById('catColorPreview').style.background = hex;
            document.getElementById('catModalColor').value = hex;
            // Deselect presets
            modal.querySelectorAll('.cat-color-btn').forEach(function(btn) {
                btn.style.border = '2px solid #e5e5e5';
                btn.style.transform = 'scale(1)';
            });
        });
    });
    
    // Form submit
    document.getElementById('categoryModalForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        var name = document.getElementById('catModalName').value.trim();
        var icon = document.getElementById('catModalIcon').value;
        var color = document.getElementById('catModalColor').value;
        
        if (!name) {
            document.getElementById('catModalStatus').innerHTML = '<span style="color:#e74c3c;">Name is required</span>';
            return;
        }
        
        var saveBtn = document.getElementById('catModalSaveBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        var catId = isEdit ? categoryId : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        var data = { name: name, icon: icon, color: color, isActive: true, updatedAt: new Date().toISOString() };
        if (!isEdit) data.createdAt = new Date().toISOString();
        
        if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
            firebaseDB.collection('categories').doc(catId).set(data, { merge: true }).then(function() {
                showFlashMessage(isEdit ? 'Category updated!' : 'Category added! \u{1F4C2}', 'success');
                modal.remove();
                loadAdminCategories();
                loadNavCounts();
            }).catch(function(err) {
                document.getElementById('catModalStatus').innerHTML = '<span style="color:#e74c3c;">Error: ' + err.message + '</span>';
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> ' + (isEdit ? 'Update' : 'Add Category');
            });
        } else {
            document.getElementById('catModalStatus').innerHTML = '<span style="color:#e74c3c;">Firebase not connected</span>';
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> ' + (isEdit ? 'Update' : 'Add Category');
        }
    });
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function(x) {
        var hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function deleteCategory(catId, catName) {
    if (!confirm('Delete category "' + catName + '"?\n\nProducts in this category will become uncategorized.')) return;
    
    // Check if it's a built-in category
    var builtInIds = ['electronics','fashion','home-garden','vehicles','services','sports','books-media','baby-kids','beauty-health','food-groceries','pets','jobs-skills','real-estate'];
    var isBuiltIn = builtInIds.indexOf(catId) >= 0;
    
    if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        if (isBuiltIn) {
            // For built-in categories, mark as disabled in Firestore
            firebaseDB.collection('categories').doc(catId).set({
                isActive: false,
                disabledAt: new Date().toISOString()
            }, { merge: true }).then(function() {
                showFlashMessage('Category "' + catName + '" removed', 'success');
                loadAdminCategories();
                loadNavCounts();
            }).catch(function(err) {
                showFlashMessage('Error: ' + err.message, 'error');
            });
        } else {
            // For custom categories, delete from Firestore
            firebaseDB.collection('categories').doc(catId).delete().then(function() {
                showFlashMessage('Category deleted', 'success');
                loadAdminCategories();
                loadNavCounts();
            }).catch(function(err) {
                showFlashMessage('Error: ' + err.message, 'error');
            });
        }
    }
}

// ============================================================================
// REPORTS MANAGEMENT
// ============================================================================

function initReportsManagement() {
    // Initialize reports management functionality
    console.log('Reports management initialized');
}

// ============================================================================
// SETTINGS
// ============================================================================

function initSettings() {
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', function() {
            saveSettings();
        });
    }
}

function saveSettings() {
    // In a real app, this would save settings to API
    console.log('Saving settings...');
    
    showFlashMessage('Settings saved successfully!', 'success');
}

// ============================================================================
// MOBILE MENU
// ============================================================================

function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const closeBtn = document.getElementById('sidebarClose');

    if (!menuToggle || !sidebar) return;

    var scrollPos = 0;

    function openSidebar() {
        scrollPos = window.pageYOffset;
        sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
        document.body.classList.add('sidebar-open');
        document.body.style.top = -scrollPos + 'px';
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        document.body.style.top = '';
        window.scrollTo(0, scrollPos);
    }

    // Hamburger button opens sidebar
    menuToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        if (sidebar.classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    // X button closes sidebar
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSidebar);
    }

    // Overlay tap closes sidebar
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }

    // Close sidebar when a nav item is clicked (mobile UX)
    var navItems = sidebar.querySelectorAll('.nav-item');
    navItems.forEach(function(item) {
        item.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });

    // Close sidebar on window resize to desktop
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768 && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });
}

// ============================================================================
// GLOBAL SEARCH
// ============================================================================

function initGlobalSearch() {
    const globalSearch = document.getElementById('globalSearch');
    if (!globalSearch) return;

    globalSearch.addEventListener('input', debounce(function () {
        // The debounce callback is not called with the input as `this`.
        // Read the captured input safely, then reuse the real Products filter.
        var query = String(globalSearch.value || '').toLowerCase().trim();
        var productSearch = document.getElementById('productSearch');
        if (!productSearch) return;
        productSearch.value = query;

        var productsSection = document.getElementById('section-products');
        var productsNav = document.querySelector('.nav-item[data-section="products"]');
        if (query && productsSection && !productsSection.classList.contains('active') && productsNav) {
            productsNav.click();
        }
        filterAdminProducts();
    }, 300));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Escape text before it is placed into innerHTML (flash messages, admin tables,
 * cart rows...). User-supplied values — listing titles, names, error messages —
 * must never be able to inject markup.
 *
 * NOTE: this helper is called from main.js, admin.js and admin-management.js; keep
 * the definition present in every file that uses it (the bundler treats each file
 * as its own scope).
 */
function escapeFlashText(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showFlashMessage(message, type = 'info') {
    // Delegate to the shared implementation when it is available (it lives in main.js and
    // is also the one the watchdog guarantees). The admin panel used to define its own,
    // subtly different version — two definitions of the same global means whichever script
    // loads last silently wins, which is how this project's worst past bugs happened.
    if (window.__smSharedFlash) return window.__smSharedFlash(message, type);
    const flash = document.createElement('div');
    flash.className = `flash-message ${type}`;
    flash.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${escapeFlashText(message)}</span>
    `;
    document.body.appendChild(flash);
    setTimeout(() => { flash.classList.add('show'); }, 100);
    setTimeout(() => {
        flash.classList.remove('show');
        setTimeout(() => { flash.remove(); }, 300);
    }, 3000);
}

// ============================================================================
// EXPORT
// ============================================================================

window.adminDashboard = {
    openAddProductModal,
    closeAddProductModal,
    editProduct,
    deleteProduct,
    approveProduct,
    rejectProduct,
    reviewProduct,
    removeProduct,
    viewProduct,
    exportProducts,
    filterAdminProducts,
    saveSettings
};

// ============================================================================
// FLAG PRODUCT FUNCTIONALITY
// ============================================================================

function flagProduct(productId, productName) {
    const reason = prompt(`Please provide a reason for flagging "${productName}":`);
    
    if (reason) {
        // Simulate API call
        console.log('Flagging product:', productId, 'Reason:', reason);
        
        // Show success message
        showFlashMessage('Product flagged successfully!', 'success');
        
        // Update row status (in real app, this would be done after API success)
        setTimeout(() => {
            const row = document.querySelector(`tr:has(.table-sub:contains("${productId}"))`);
            if (row) {
                const statusCell = row.querySelector('.status-pill');
                statusCell.className = 'status-pill warning';
                statusCell.textContent = 'Flagged';
                
                // Change action buttons
                const actionsCell = row.querySelector('.table-actions');
                actionsCell.innerHTML = `
                    <button class="action-btn" title="Review"><i class="fas fa-eye"></i></button>
                    <button class="action-btn success" title="Approve"><i class="fas fa-check"></i></button>
                    <button class="action-btn danger" title="Remove"><i class="fas fa-ban"></i></button>
                `;
                
                // Re-initialize action buttons
                initProductActions();
            }
        }, 500);
    }
}

// ============================================================================
// BLOCK SELLER FUNCTIONALITY
// ============================================================================

function blockSeller(sellerId, sellerName) {
    const reason = prompt(`Please provide a reason for blocking "${sellerName}":`);
    
    if (reason) {
        // Simulate API call
        console.log('Blocking seller:', sellerId, 'Reason:', reason);
        
        // Show success message
        showFlashMessage('Seller blocked successfully!', 'success');
        
        // Update row status (in real app, this would be done after API success)
        setTimeout(() => {
            const row = document.querySelector(`tr:has(.table-sub:contains("${sellerId}"))`);
            if (row) {
                const statusCell = row.querySelector('.status-pill');
                statusCell.className = 'status-pill danger';
                statusCell.textContent = 'Blocked';
                
                // Change action buttons
                const actionsCell = row.querySelector('.table-actions');
                actionsCell.innerHTML = `
                    <button class="action-btn" title="View"><i class="fas fa-eye"></i></button>
                    <button class="action-btn success" title="Unblock"><i class="fas fa-undo"></i></button>
                    <button class="action-btn danger" title="Delete"><i class="fas fa-trash"></i></button>
                `;
                
                // Re-initialize action buttons
                initUserActions();
            }
        }, 500);
    }
}

// ============================================================================
// UNBLOCK SELLER FUNCTIONALITY
// ============================================================================

function unblockSeller(sellerId, sellerName) {
    if (confirm(`Are you sure you want to unblock "${sellerName}"?`)) {
        // Simulate API call
        console.log('Unblocking seller:', sellerId);
        
        // Show success message
        showFlashMessage('Seller unblocked successfully!', 'success');
        
        // Update row status (in real app, this would be done after API success)
        setTimeout(() => {
            const row = document.querySelector(`tr:has(.table-sub:contains("${sellerId}"))`);
            if (row) {
                const statusCell = row.querySelector('.status-pill');
                statusCell.className = 'status-pill success';
                statusCell.textContent = 'Active';
                
                // Change action buttons
                const actionsCell = row.querySelector('.table-actions');
                actionsCell.innerHTML = `
                    <button class="action-btn" title="View"><i class="fas fa-eye"></i></button>
                    <button class="action-btn" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn danger" title="Block"><i class="fas fa-ban"></i></button>
                    <button class="action-btn danger" title="Suspend"><i class="fas fa-ban"></i></button>
                `;
                
                // Re-initialize action buttons
                initUserActions();
            }
        }, 500);
    }
}

// ============================================================================
// UPDATE INIT PRODUCT ACTIONS TO INCLUDE FLAG
// ============================================================================

function initProductActions() {
    // View product buttons
    document.querySelectorAll('.action-btn[title="View"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const productId = row.querySelector('.table-sub').textContent.replace('ID: ', '');
            viewProduct(productId);
        });
    });
    
    // Edit product buttons
    document.querySelectorAll('.action-btn[title="Edit"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const productId = row.querySelector('.table-sub').textContent.replace('ID: ', '');
            editProduct(productId);
        });
    });
    
    // Flag product buttons
    document.querySelectorAll('.action-btn[title="Flag"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const productId = row.querySelector('.table-sub').textContent.replace('ID: ', '');
            const productName = row.querySelector('strong').textContent;
            flagProduct(productId, productName);
        });
    });
    
    // Delete product buttons
    document.querySelectorAll('.action-btn[title="Delete"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const productId = row.querySelector('.table-sub').textContent.replace('ID: ', '');
            const productName = row.querySelector('strong').textContent;
            deleteProduct(productId, productName);
        });
    });
    
    // Approve product buttons (for pending products)
    document.querySelectorAll('.action-btn[title="Approve"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const productId = row.querySelector('.table-sub').textContent.replace('ID: ', '');
            approveProduct(productId);
        });
    });
    
    // Reject product buttons (for pending products)
    document.querySelectorAll('.action-btn[title="Reject"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const productId = row.querySelector('.table-sub').textContent.replace('ID: ', '');
            rejectProduct(productId);
        });
    });
    
    // Review product buttons (for flagged products)
    document.querySelectorAll('.action-btn[title="Review"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const productId = row.querySelector('.table-sub').textContent.replace('ID: ', '');
            reviewProduct(productId);
        });
    });
    
    // Remove/Ban product buttons (for flagged products)
    document.querySelectorAll('.action-btn[title="Remove"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const productId = row.querySelector('.table-sub').textContent.replace('ID: ', '');
            removeProduct(productId);
        });
    });
}

// ============================================================================
// UPDATE INIT USER ACTIONS TO INCLUDE BLOCK
// ============================================================================

function initUserActions() {
    // View user buttons
    document.querySelectorAll('.action-btn[title="View"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const userId = row.querySelector('.table-sub').textContent;
            viewUser(userId);
        });
    });
    
    // Edit user buttons
    document.querySelectorAll('.action-btn[title="Edit"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const userId = row.querySelector('.table-sub').textContent;
            editUser(userId);
        });
    });
    
    // Block user buttons
    document.querySelectorAll('.action-btn[title="Block"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const userId = row.querySelector('.table-sub').textContent;
            const userName = row.querySelector('strong').textContent;
            blockSeller(userId, userName);
        });
    });
    
    // Unblock user buttons
    document.querySelectorAll('.action-btn[title="Unblock"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const userId = row.querySelector('.table-sub').textContent;
            const userName = row.querySelector('strong').textContent;
            unblockSeller(userId, userName);
        });
    });
    
    // Suspend user buttons
    document.querySelectorAll('.action-btn[title="Suspend"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const userId = row.querySelector('.table-sub').textContent;
            const userName = row.querySelector('strong').textContent;
            suspendUser(userId, userName);
        });
    });
    
    // Delete user buttons
    document.querySelectorAll('.action-btn[title="Delete"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const userId = row.querySelector('.table-sub').textContent;
            const userName = row.querySelector('strong').textContent;
            deleteUser(userId, userName);
        });
    });
    
    // Approve user buttons (for pending users)
    document.querySelectorAll('.action-btn[title="Approve"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const userId = row.querySelector('.table-sub').textContent;
            approveUser(userId);
        });
    });
    
    // Reject user buttons (for pending users)
    document.querySelectorAll('.action-btn[title="Reject"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const userId = row.querySelector('.table-sub').textContent;
            rejectUser(userId);
        });
    });
    
    // Reactivate user buttons (for suspended users)
    document.querySelectorAll('.action-btn[title="Reactivate"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const userId = row.querySelector('.table-sub').textContent;
            reactivateUser(userId);
        });
    });
}

// ============================================================================
// ADDITIONAL USER MANAGEMENT FUNCTIONS
// ============================================================================

function viewUser(userId) {
    console.log('Viewing user:', userId);
    alert('User view feature coming soon!');
}

function editUser(userId) {
    console.log('Editing user:', userId);
    alert('User edit feature coming soon!');
}

function suspendUser(userId, userName) {
    const reason = prompt(`Please provide a reason for suspending "${userName}":`);
    
    if (reason) {
        console.log('Suspending user:', userId, 'Reason:', reason);
        showFlashMessage('User suspended successfully!', 'success');
        
        setTimeout(() => {
            const row = document.querySelector(`tr:has(.table-sub:contains("${userId}"))`);
            if (row) {
                const statusCell = row.querySelector('.status-pill');
                statusCell.className = 'status-pill warning';
                statusCell.textContent = 'Suspended';
                
                const actionsCell = row.querySelector('.table-actions');
                actionsCell.innerHTML = `
                    <button class="action-btn" title="View"><i class="fas fa-eye"></i></button>
                    <button class="action-btn success" title="Reactivate"><i class="fas fa-undo"></i></button>
                    <button class="action-btn danger" title="Delete"><i class="fas fa-trash"></i></button>
                `;
                
                initUserActions();
            }
        }, 500);
    }
}

/**
 * Delete a user for real (account + profile + wallet).
 * The old version only removed the table row and showed "User deleted successfully!"
 * while nothing was actually deleted — which is how dead wallet records piled up.
 * Deletion of the sign-in account needs the Admin SDK, so it runs in a Cloud Function.
 */
async function deleteUser(userId, userName) {
    if (!userId) return;
    if (!confirm('Delete "' + (userName || userId) + '"?\n\nThis removes their account, profile, wallet and wallet history. This cannot be undone.')) return;

    const row = document.querySelector('tr[data-user-id="' + userId + '"]') || null;
    if (row) row.style.opacity = '0.5';

    try {
        if (typeof firebase === 'undefined' || !firebase.functions) throw new Error('Cloud Functions not available');
        const callable = firebase.functions().httpsCallable('adminDeleteUser');
        const res = await callable({ userId: userId });
        showFlashMessage('Deleted ' + (userName || userId) + (res.data && res.data.productsDeleted ? ' and ' + res.data.productsDeleted + ' listing(s)' : ''), 'success');
        if (row) row.remove();
        if (typeof loadAdminUsers === 'function') loadAdminUsers();
        if (typeof loadAdminWallets === 'function') loadAdminWallets(true);
    } catch (err) {
        if (row) row.style.opacity = '';
        console.error('deleteUser failed:', err);
        showFlashMessage('Could not delete user: ' + (err.message || err), 'error');
    }
}

// Update the export to include new functions
window.adminDashboard = {
    openAddProductModal,
    closeAddProductModal,
    editProduct,
    deleteProduct,
    approveProduct,
    rejectProduct,
    reviewProduct,
    removeProduct,
    viewProduct,
    exportProducts,
    filterAdminProducts,
    saveSettings,
    flagProduct,
    blockSeller,
    unblockSeller,
    viewUser,
    editUser,
    suspendUser,
    deleteUser,
    approveUser
};

// ============================================================================
// LEGAL COMPLIANCE CHECKLIST
// ============================================================================

function initLegalChecklist() {
    // Load saved state from localStorage
    var saved = {};
    try {
        saved = JSON.parse(localStorage.getItem('sankofa_legal_checklist') || '{}');
    } catch(e) {}

    // Apply saved state
    document.querySelectorAll('.legal-checklist-item[data-legal-id]').forEach(function(item) {
        var id = item.dataset.legalId;
        var check = item.querySelector('.legal-check');
        if (saved[id]) {
            check.classList.add('checked');
        }
    });

    updateLegalProgress();
}

function toggleLegal(el) {
    el.classList.toggle('checked');
    
    // Save to localStorage
    var saved = {};
    try {
        saved = JSON.parse(localStorage.getItem('sankofa_legal_checklist') || '{}');
    } catch(e) {}

    document.querySelectorAll('.legal-checklist-item[data-legal-id]').forEach(function(item) {
        var id = item.dataset.legalId;
        var check = item.querySelector('.legal-check');
        saved[id] = check.classList.contains('checked');
    });

    localStorage.setItem('sankofa_legal_checklist', JSON.stringify(saved));
    updateLegalProgress();
}

function updateLegalProgress() {
    var total = document.querySelectorAll('.legal-checklist-item[data-legal-id]').length;
    var completed = document.querySelectorAll('.legal-check.checked').length;
    var remaining = total - completed;
    var percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    var completedEl = document.getElementById('legalCompleted');
    var remainingEl = document.getElementById('legalRemaining');
    var barEl = document.getElementById('legalProgressBar');
    var textEl = document.getElementById('legalProgressText');

    if (completedEl) completedEl.textContent = completed;
    if (remainingEl) remainingEl.textContent = remaining;
    if (barEl) barEl.style.width = percent + '%';
    if (textEl) textEl.textContent = percent + '% complete' + (percent === 100 ? ' 🎉' : '');

    // Change bar color based on progress
    if (barEl) {
        if (percent < 30) barEl.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        else if (percent < 70) barEl.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
        else barEl.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
    }
}

// ============================================================================
// BOTTOM NAVIGATION (Mobile App Experience)
// ============================================================================

function initBottomNav() {
    var bottomNav = document.getElementById('bottomNav');
    if (!bottomNav) return;

    var navItems = bottomNav.querySelectorAll('.bottom-nav-item');
    var sections = document.querySelectorAll('.admin-section');
    var sidebarNavItems = document.querySelectorAll('.sidebar-nav .nav-item');

    function switchSection(sectionId) {
        // Hide all sections
        sections.forEach(function(s) { s.classList.remove('active'); });

        // Show target section
        var target = document.getElementById('section-' + sectionId);
        if (target) {
            target.classList.add('active');
        }

        // Update bottom nav active state
        navItems.forEach(function(item) {
            item.classList.toggle('active', item.dataset.section === sectionId || 
                (sectionId === 'messages-nav' && item.dataset.section === 'messages-nav'));
        });
        if (sectionId === 'overview' && typeof loadOverviewData === 'function') {
            try { loadOverviewData(); } catch(e){}
        }
        if (sectionId === 'shops' && typeof loadShopsAdmin === 'function') {
            try { loadShopsAdmin(); } catch(e){}
            try { if (typeof loadStoreBillingAdmin === 'function') loadStoreBillingAdmin(); } catch(e){}
            try { loadPaymentsReadiness(); } catch(e){}
        }
        if (sectionId === 'carousel' && typeof loadCarouselAdmin === 'function') {
            try { loadCarouselAdmin(); } catch(e){}
        }

        // Update sidebar active state
        sidebarNavItems.forEach(function(item) {
            var itemSection = item.dataset.section || '';
            item.classList.toggle('active', itemSection === sectionId);
        });

        // Handle special "messages-nav" -> go to messages page
        if (sectionId === 'messages-nav') {
            window.location.href = '/sm-panel/messages';
            return;
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Close sidebar if open
        var sidebar = document.getElementById('adminSidebar');
        var overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        document.body.style.top = '';
    }

    // Bottom nav click handlers
    navItems.forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            switchSection(this.dataset.section);
        });
    });

    // More menu grid items
    document.querySelectorAll('.more-menu-item[data-goto]').forEach(function(item) {
        item.addEventListener('click', function() {
            switchSection(this.dataset.goto);
        });
    });

    // Also hook sidebar nav items on mobile to use bottom nav switching
    sidebarNavItems.forEach(function(item) {
        item.addEventListener('click', function(e) {
            if (window.innerWidth <= 768 && this.dataset.section) {
                e.preventDefault();
                switchSection(this.dataset.section);
            }
        });
    });
}

// ============================================================================
// SIDEBAR COLLAPSE / HIDE TOGGLE
// ============================================================================

function initSidebarCollapse() {
    var collapseBtn = document.getElementById('sidebarCollapseBtn');
    var showBtn = document.getElementById('sidebarShowBtn');

    if (!collapseBtn || !showBtn) return;

    // Restore saved state
    var isCollapsed = localStorage.getItem('sankofa_sidebar_collapsed') === 'true';
    if (isCollapsed && window.innerWidth > 768) {
        document.body.classList.add('sidebar-collapsed');
    }

    // Hide sidebar
    collapseBtn.addEventListener('click', function(e) {
        e.preventDefault();
        document.body.classList.add('sidebar-collapsed');
        localStorage.setItem('sankofa_sidebar_collapsed', 'true');
    });

    // Show sidebar
    showBtn.addEventListener('click', function() {
        document.body.classList.remove('sidebar-collapsed');
        localStorage.setItem('sankofa_sidebar_collapsed', 'false');
    });

    // Reset on mobile
    window.addEventListener('resize', function() {
        if (window.innerWidth <= 768) {
            document.body.classList.remove('sidebar-collapsed');
        }
    });
}

// ============================================================================
// LOAD ADMIN PRODUCTS FROM FIRESTORE
// ============================================================================

var adminProductsCache = [];

// ============================================================================
// SELLER LOOKUP — who listed each product (name + email)
// ----------------------------------------------------------------------------
// Newer listings store sellerName/sellerEmail on the product itself. For older
// listings we look the seller up in the users collection (admins may list users)
// and cache the result so the products table can always show a real person.
// ============================================================================
var adminSellersMap = {};          // uid -> { name, email, phone, role, isPremium }
var adminSellersPromise = null;

function sellerDisplayName(u) {
    if (!u) return '';
    return u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.displayName || '';
}

function loadAdminSellers(force) {
    if (adminSellersPromise && !force) return adminSellersPromise;
    adminSellersPromise = new Promise(function (resolve) {
        if (typeof firebaseDB === 'undefined' || !firebaseDB) { resolve(adminSellersMap); return; }
        firebaseDB.collection('users').limit(1000).get().then(function (snap) {
            snap.forEach(function (doc) {
                var u = doc.data() || {};
                adminSellersMap[doc.id] = {
                    id: doc.id,
                    name: sellerDisplayName(u),
                    email: u.email || '',
                    phone: u.phone || u.phoneNumber || '',
                    role: u.role || 'user',
                    isPremium: u.isPremium === true,
                    status: u.status || ''
                };
            });
            console.log('👥 Seller lookup loaded:', Object.keys(adminSellersMap).length, 'accounts');
            resolve(adminSellersMap);
        }).catch(function (err) {
            console.warn('Seller lookup failed (products will show what is stored on them):', err && err.message);
            resolve(adminSellersMap);
        });
    });
    return adminSellersPromise;
}

/** Best available seller info for a product row. */
function getProductSeller(p) {
    var id = p.sellerId || p.userId || null;
    var known = id ? adminSellersMap[id] : null;
    var name = p.sellerName || (known && known.name) || '';
    var email = p.sellerEmail || p.sellerMail || (known && known.email) || '';
    if (!name && email) name = email.split('@')[0];
    return {
        id: id,
        name: name,
        email: email,
        phone: p.sellerPhone || (known && known.phone) || '',
        isSankofaStore: p.isSankofaStore === true,
        known: !!known
    };
}
var adminAuctionsCache = [];
var adminAuctionsByProduct = {};
var activeStoreFilter = 'all';
var productsCurrentPage = 1, usersCurrentPage = 1, ordersCurrentPage = 1;
var orderGroupByDateEnabled = true;
var collapsedOrderGroups = new Set();
var productsPageSize = 10, usersPageSize = 10, ordersPageSize = 10;
var filteredProductsCache = [], filteredUsersCache = [], filteredOrdersCache = [];

function initStoreTabs() {
    var tabsContainer = document.getElementById('storeTabs');
    if (!tabsContainer) return;
    
    // Load stores from Firestore and create dynamic tabs
    if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        firebaseDB.collection('stores').get().then(function(snapshot) {
            var marketplaceBtn = tabsContainer.querySelector('[data-store="marketplace"]');
            snapshot.forEach(function(doc) {
                var store = doc.data();
                if (store.isActive === false) return;
                var btn = document.createElement('button');
                btn.className = 'store-tab';
                btn.setAttribute('data-store', 'store_' + doc.id);
                btn.setAttribute('onclick', 'selectStoreTab(this)');
                var imgHtml = store.profilePicture 
                    ? '<img src="' + store.profilePicture + '" alt="' + (store.name || '') + '">'
                    : '<i class="fas fa-store"></i>';
                btn.innerHTML = imgHtml + ' ' + (store.name || 'Store') + ' <span class="store-tab-count" id="storeCount_' + doc.id + '">0</span>';
                tabsContainer.insertBefore(btn, marketplaceBtn);
            });
            updateStoreCounts();
        }).catch(function() {});
    }
}

// Global function called by onclick on store tabs
function selectStoreTab(tabEl) {
    // Remove active from all tabs
    document.querySelectorAll('.store-tab').forEach(function(t) { t.classList.remove('active'); });
    tabEl.classList.add('active');
    
    activeStoreFilter = tabEl.getAttribute('data-store');
    filterAdminProducts();
}

function updateStoreCounts() {
    var counts = { all: 0, 'sankofa-store': 0, marketplace: 0 };
    adminProductsCache.forEach(function(p) {
        counts.all++;
        if (p.isSankofaStore) {
            counts['sankofa-store']++;
        } else if (p.storeId) {
            var key = 'store_' + p.storeId;
            counts[key] = (counts[key] || 0) + 1;
        } else {
            counts.marketplace++;
        }
    });
    
    // Update count badges
    Object.keys(counts).forEach(function(key) {
        var elId = key === 'all' ? 'storeCountAll' 
            : key === 'sankofa-store' ? 'storeCountSankofa'
            : key === 'marketplace' ? 'storeCountMarketplace'
            : 'storeCount_' + key.replace('store_', '');
        var el = document.getElementById(elId);
        if (el) el.textContent = counts[key];
    });
}

function loadAdminProducts(forceServer) {
    var tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#5a6572;"><p>Firebase not connected</p><p style="font-size:0.75rem;color:#5f6b7a;">Retrying...</p></td></tr>';
        setTimeout(function(){ loadAdminProducts(forceServer); }, 900);
        return;
    }

    // Kick off the seller lookup immediately so names/emails are ready when rows render
    loadAdminSellers();

    var getOptions = forceServer ? { source: 'server' } : {};
    if (typeof showTableSkeleton === 'function') try{ showTableSkeleton('productsTableBody', 8, 5); }catch(e){}

    // Load products WITHOUT limit so total & live detection is correct (admin can list without limit)
    var productsPromise = firebaseDB.collection('products').orderBy('createdAt', 'desc').get(getOptions)
        .catch(function(error) {
            // Fallback without orderBy if index missing
            return firebaseDB.collection('products').get(getOptions);
        });

    // Also load auctions to annotate live products — non-blocking; if fails, just render products without live badges
    var auctionsPromise = firebaseDB.collection('auctions').limit(50).get(getOptions).catch(function(){ return { empty:true, forEach:function(){} }; });

    Promise.all([productsPromise, auctionsPromise]).then(function(results){
        var snapProducts = results[0];
        var snapAuctions = results[1];
        if (!snapProducts || snapProducts.empty) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#5a6572;"><i class="fas fa-box-open" style="font-size:2rem;color:#ccc;"></i><p>No products yet. Click \"Add Product\" to create one.</p></td></tr>';
            adminProductsCache = [];
            adminAuctionsCache = [];
            adminAuctionsByProduct = {};
            updateStoreCounts();
            updateProductsLiveAlert();
            return;
        }
        adminProductsCache = [];
        snapProducts.forEach(function(doc) {
            adminProductsCache.push({ id: doc.id, ...doc.data() });
        });
        // Build auctions cache
        adminAuctionsCache = [];
        adminAuctionsByProduct = {};
        if (snapAuctions && !snapAuctions.empty){
            snapAuctions.forEach(function(doc){
                var a=doc.data(); a._id=doc.id;
                adminAuctionsCache.push(a);
                // Map by productId if present
                if (a.productId) adminAuctionsByProduct[a.productId] = a;
                else if (a.product && a.product.id) adminAuctionsByProduct[a.product.id] = a;
            });
        }
        // Show who listed each product — load the seller accounts, then render
        loadAdminSellers().then(function () {
            renderAdminProducts(adminProductsCache);
        });
        updateStoreCounts();
        updateProductsLiveAlert();
    }).catch(function(err) {
        console.error('Error loading products:', err);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#e74c3c;"><p>Error loading products: ' + escapeHtml(err.message||String(err)) + '</p><p style="font-size:0.78rem;color:#6b7280;margin-top:0.4rem;"><button onclick="loadAdminProducts(true)" style="background:#0064d2;color:#fff;border:none;padding:0.4rem 0.8rem;border-radius:6px;font-weight:600;cursor:pointer;">Retry</button></p></td></tr>';
    });
}
function getAuctionStatusForAdmin(auction){
    var now=Date.now();
    var startMs = auction.startAt ? (auction.startAt.toMillis? auction.startAt.toMillis(): new Date(auction.startAt).getTime()) : (auction.startAtMs||0);
    var endMs = auction.endAt ? (auction.endAt.toMillis? auction.endAt.toMillis(): new Date(auction.endAt).getTime()) : (auction.endAtMs||0);
    if (auction.status==='cancelled') return 'cancelled';
    if (auction.status==='ended') return 'ended';
    if (endMs && now>=endMs) return 'ended';
    if (auction.status==='scheduled' && now < startMs) return 'scheduled';
    if (auction.status==='live' || (now>=startMs && now<endMs)) return 'live';
    if (now < startMs) return 'scheduled';
    return 'live';
}
function updateProductsLiveAlert(){
    var alertEl = document.getElementById('productsLiveAuctionAlert');
    var countEl = document.getElementById('productsLiveCount');
    if (!alertEl || !countEl) return;
    var liveCount = 0;
    adminAuctionsCache.forEach(function(a){ if (getAuctionStatusForAdmin(a)==='live') liveCount++; });
    if (liveCount>0){
        countEl.textContent = liveCount;
        alertEl.style.display = 'flex';
    } else {
        alertEl.style.display = 'none';
    }
    // Also update auctions nav badge via loadNavCounts fallback is handled, but ensure countAuctions reflects live+scheduled
    var livePlusSched = 0;
    adminAuctionsCache.forEach(function(a){ var s=getAuctionStatusForAdmin(a); if(s==='live' || s==='scheduled') livePlusSched++; });
    var badge=document.getElementById('countAuctions');
    if (badge){
        if (livePlusSched>0){ badge.textContent=livePlusSched; badge.style.display=''; } else { badge.style.display='none'; }
    }
}

function renderAdminProducts(products) {
    var tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#5a6572;"><i class="fas fa-search" style="font-size:2rem;color:#ccc;"></i><p>No products match your filters</p></td></tr>';
        return;
    }

    var html = '';
    products.forEach(function(p) {
        var images = (Array.isArray(p.images) && p.images.length) ? p.images : (Array.isArray(p.photos) ? p.photos : []);
        var imgSrc = (typeof productThumb === 'function') ? productThumb(p) : (images.length > 0 ? images[0] : '/images/placeholders/product.svg');
        var status = p.isSold ? 'sold' : (p.isActive ? 'active' : 'inactive');
        var statusLabel = p.isSold ? 'Sold' : (p.isActive ? 'Active' : 'Inactive');
        var statusClass = p.isSold ? 'cancelled' : (p.isActive ? 'active' : 'draft');
        var date = p.createdAt ? (p.createdAt.toDate ? p.createdAt.toDate().toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()) : '—';
        var seller = getProductSeller(p);
        var sellerLabel = seller.isSankofaStore
            ? '<span style="color:#0064d2;font-weight:600;">🏪 Sankofa Store</span>'
            : (seller.name || 'Unknown');

        // "Listed by" cell — name, email, and a shortcut to the full account
        var listedByCell = '';
        if (seller.isSankofaStore && !seller.id) {
            listedByCell = '<span style="color:#0064d2;font-weight:600;font-size:0.82rem;">🏪 Sankofa Market (official store)</span>';
        } else if (!seller.id && !seller.email) {
            listedByCell = '<span style="color:#9ca3af;font-size:0.82rem;" title="This listing has no seller recorded">— unknown —</span>';
        } else {
            var initials = (seller.name || seller.email || '?').trim().charAt(0).toUpperCase();
            listedByCell =
                '<div style="display:flex;align-items:center;gap:0.5rem;min-width:190px;">' +
                    '<span style="width:28px;height:28px;border-radius:50%;background:#e8eef7;color:#0064d2;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:0.78rem;flex-shrink:0;">' + escapeHtml(initials) + '</span>' +
                    '<div style="min-width:0;">' +
                        '<div style="font-weight:600;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px;" title="' + escapeHtml(seller.name || '') + '">' +
                            escapeHtml(seller.name || 'Unnamed seller') +
                            (seller.isPremium ? ' <span title="Premium seller" style="color:#f5af02;font-size:0.7rem;">★</span>' : '') +
                        '</div>' +
                        (seller.email
                            ? '<a href="mailto:' + escapeHtml(seller.email) + '" style="display:block;font-size:0.72rem;color:#0064d2;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px;" title="Email this seller">' + escapeHtml(seller.email) + '</a>'
                            : '<span style="font-size:0.72rem;color:#9ca3af;">no email on file</span>') +
                        (seller.phone ? '<div style="font-size:0.7rem;color:#5a6572;">' + escapeHtml(seller.phone) + '</div>' : '') +
                    '</div>' +
                    (seller.id
                        ? ' <button class="btn btn-outline btn-small" onclick="viewSellerProfile(\'' + seller.id + '\')" title="Open this seller\'s account" style="padding:0.25rem 0.4rem;font-size:0.7rem;flex-shrink:0;"><i class="fas fa-user"></i></button>'
                        : '') +
                '</div>';
        }
        var featuredBadge = p.isFeatured ? ' <span style="background:#f5af02;color:#000;padding:0.1rem 0.4rem;border-radius:50px;font-size:0.65rem;font-weight:600;">⭐ Featured</span>' : '';
        var preOrderBadge = p.preOrder === true
            ? ' <span class="preorder-badge" title="Pre-order — buyers pay now, Sankofa Store dispatches when the stock lands"><i class="fas fa-clock"></i> Pre-order</span>'
            : '';
        // Live auction badge — if product has an associated live/scheduled auction
        var auction = adminAuctionsByProduct[p.id] || null;
        var auctionBadge = '';
        var auctionStatus = '';
        if (auction){
            auctionStatus = getAuctionStatusForAdmin(auction);
            if (auctionStatus==='live'){
                auctionBadge = ' <span style="background:#ef4444;color:#fff;padding:0.15rem 0.45rem;border-radius:999px;font-size:0.65rem;font-weight:800;border:1px solid #fecaca;animation: pulse 1s infinite;">🔴 LIVE</span>';
            } else if (auctionStatus==='scheduled'){
                auctionBadge = ' <span style="background:#f59e0b;color:#fff;padding:0.15rem 0.45rem;border-radius:999px;font-size:0.65rem;font-weight:700;">🟡 SOON</span>';
            } else if (auctionStatus==='ended'){
                auctionBadge = ' <span style="background:#6b7280;color:#fff;padding:0.15rem 0.45rem;border-radius:999px;font-size:0.65rem;">ENDED</span>';
            }
        }

        // Store label
        var storeLabel = '';
        if (p.isSankofaStore) {
            storeLabel = '<span style="color:#f5af02;font-weight:600;font-size:0.8rem;">🏪 Sankofa Store</span>';
        } else if (p.storeId && p.sellerName) {
            var storeImg = p.storeProfilePicture ? '<img src="' + escapeHtml(p.storeProfilePicture) + '" style="width:16px;height:16px;border-radius:50%;object-fit:cover;vertical-align:middle;"> ' : '';
            storeLabel = '<span style="color:#0064d2;font-weight:500;font-size:0.8rem;">' + storeImg + escapeHtml(p.sellerName) + '</span>';
        } else {
            storeLabel = '<span style="color:#5a6572;font-size:0.8rem;">🏷️ Marketplace</span>';
        }

        html += '<tr>' +
            '<td><div style="display:flex;align-items:center;gap:0.75rem;">' +
                '<img src="' + imgSrc + '" style="width:48px;height:48px;border-radius:8px;object-fit:cover;" loading="lazy">' +
                '<div><strong style="font-size:0.85rem;">' + escapeHtml(p.title || 'Untitled') + '</strong>' + featuredBadge + auctionBadge + preOrderBadge +
                '<br><small style="color:#5a6572;">' + (p.condition || '') + (auctionStatus ? ' · <span style="color:' + (auctionStatus==='live'?'#ef4444':auctionStatus==='scheduled'?'#d97706':'#6b7280') + ';font-weight:700;">' + escapeHtml(auctionStatus.charAt(0).toUpperCase()+auctionStatus.slice(1)) + '</span>' : '') + '</small></div>' +
            '</div></td>' +
            '<td>' + storeLabel + '</td>' +
            '<td>' + listedByCell + '</td>' +
            '<td><span style="text-transform:capitalize;">' + (p.category || '—').replace(/-/g, ' ') + '</span></td>' +
            '<td><strong>GHS ' + (p.price ? p.price.toLocaleString() : '0') + '</strong></td>' +
            '<td><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
            '<td style="font-size:0.82rem;color:#5a6572;">' + date + '</td>' +
            '<td><div style="display:flex;gap:0.35rem;align-items:center;">' +
                (images.length ? '' : '<button class="btn btn-outline btn-small admin-product-add-photos" data-id="' + escapeHtml(p.id) + '" title="Add photos to this listing" style="padding:0.3rem 0.5rem;font-size:0.75rem;color:#0064d2;"><i class="fas fa-camera"></i></button>') +
                '<button class="btn btn-outline btn-small admin-product-edit" data-id="' + escapeHtml(p.id) + '" title="Edit listing" style="padding:0.3rem 0.5rem;font-size:0.75rem;"><i class="fas fa-pen"></i></button>' +
                '<button class="btn btn-outline btn-small" onclick="viewAdminProduct(\'' + p.id + '\')" title="View" style="padding:0.3rem 0.5rem;font-size:0.75rem;"><i class="fas fa-eye"></i></button>' +
                (auction && auctionStatus==='live' ? '<a href="../../auction-detail.html?id='+auction._id+'" target="_blank" title="View live auction" style="background:#ef4444;color:#fff;padding:0.3rem 0.5rem;border-radius:6px;font-size:0.7rem;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;"><i class="fas fa-gavel"></i> Live</a>' : (auction && auctionStatus==='scheduled' ? '<a href="../../auction-detail.html?id='+auction._id+'" target="_blank" title="View scheduled auction" style="background:#f59e0b;color:#fff;padding:0.3rem 0.5rem;border-radius:6px;font-size:0.7rem;font-weight:700;text-decoration:none;">Soon</a>' : '')) +
                (p.preOrder === true ? '<button class="btn btn-small admin-product-stockalert" data-id="' + p.id + '" data-title="' + (p.title || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '" title="📦 Stock landed — alert everyone who pre-ordered" style="padding:0.3rem 0.5rem;font-size:0.75rem;background:#f5af02;color:#191919;border:none;"><i class="fas fa-box-open"></i></button>' : '') +
                '<button class="btn btn-outline btn-small" onclick="toggleFeaturedProduct(\'' + p.id + '\',' + !p.isFeatured + ')" title="' + (p.isFeatured ? 'Unfeature' : 'Feature') + '" style="padding:0.3rem 0.5rem;font-size:0.75rem;"><i class="fas fa-star"></i></button>' +
                '<button class="btn btn-small admin-product-delete" data-id="' + p.id + '" data-title="' + (p.title || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '" title="Delete" style="padding:0.3rem 0.5rem;font-size:0.75rem;background:#e74c3c;color:white;border:none;"><i class="fas fa-trash"></i></button>' +
            '</div></td>' +
        '</tr>';
    });

    tbody.innerHTML = html;

    // Give image-less listings a repair action; this updates the existing product,
    // so the admin never needs to delete and recreate a live listing.
    tbody.querySelectorAll('.admin-product-add-photos').forEach(function(btn) {
        btn.addEventListener('click', function() {
            addPhotosToProduct(this.getAttribute('data-id'));
        });
    });

    // Bind edit buttons; update the existing Firestore record, never create a duplicate.
    tbody.querySelectorAll('.admin-product-edit').forEach(function(btn) {
        btn.addEventListener('click', function() { editProduct(this.getAttribute('data-id')); });
    });

    // Bind delete buttons using event delegation (handles special characters in titles)
    tbody.querySelectorAll('.admin-product-delete').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var id = this.getAttribute('data-id');
            var title = this.getAttribute('data-title');
            deleteProduct(id, title);
        });
    });
    // Bind the gold "stock landed" buttons the same way
    tbody.querySelectorAll('.admin-product-stockalert').forEach(function(btn) {
        btn.addEventListener('click', function() {
            preorderStockLandedPrompt(this.getAttribute('data-id'), this.getAttribute('data-title'));
        });
    });
}

// ============================================================================
// "STOCK LANDED" pre-order alerts — one tap on the gold box button tells every
// buyer still waiting on a pre-order that their item has arrived (the
// preorderStockLanded callable does the fan-out; clients may NOT write into
// other people's notification inboxes). The modal also offers to retire the
// pre-order badge, because a landed item is just… in stock.
// ============================================================================
var PO_CLOSED_STATUSES = ['shipped', 'delivered', 'completed', 'cancelled', 'refunded'];

function preorderStockLandedPrompt(productId, title) {
    var modal = document.getElementById('poStockModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'poStockModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:9999;display:none;align-items:center;justify-content:center;padding:1rem;';
        modal.innerHTML =
            '<div style="background:#fff;border-radius:12px;max-width:440px;width:100%;padding:1.2rem 1.3rem;box-shadow:0 18px 50px rgba(0,0,0,0.28);border-top:6px solid #f5af02;">' +
                '<h3 id="poStockTitle" style="margin:0 0 0.35rem;font-size:1.05rem;color:#191919;"></h3>' +
                '<p id="poStockBody" style="margin:0 0 0.85rem;font-size:0.88rem;color:#374151;line-height:1.5;"></p>' +
                '<label style="display:flex;gap:0.5rem;align-items:flex-start;background:#fff7e0;border:1px solid #f5e0a0;border-radius:8px;padding:0.6rem 0.7rem;margin-bottom:0.9rem;cursor:pointer;font-size:0.85rem;color:#5b4300;">' +
                    '<input type="checkbox" id="poStockBadgeOff" checked style="width:17px;height:17px;accent-color:#f5af02;margin-top:0.1rem;flex-shrink:0;">' +
                    '<span><strong>Item is in stock now</strong> — remove the ⏳ Pre-order badge so new shoppers see it as a normal listing.</span>' +
                '</label>' +
                '<div style="display:flex;gap:0.6rem;justify-content:flex-end;">' +
                    '<button id="poStockCancel" class="btn btn-outline btn-small" style="padding:0.5rem 0.9rem;">Not yet</button>' +
                    '<button id="poStockSend" class="btn btn-small" style="padding:0.5rem 1rem;background:#f5af02;color:#191919;border:none;font-weight:700;">Send the alert</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });
        modal.querySelector('#poStockCancel').addEventListener('click', function () { modal.style.display = 'none'; });
    }

    var sendBtn = modal.querySelector('#poStockSend');
    var bodyEl = modal.querySelector('#poStockBody');
    modal.querySelector('#poStockTitle').textContent = '📦 "' + title + '" — stock landed?';
    modal.querySelector('#poStockBadgeOff').checked = true;
    sendBtn.disabled = true;
    sendBtn.textContent = 'Checking…';
    bodyEl.textContent = 'Counting the buyers waiting on this pre-order…';
    modal.style.display = 'flex';

    // NB: firestore.rules cap admin order-list queries at limit<=100 — keep the
    // pre-count inside that fence (the server function itself is rules-exempt).
    firebaseDB.collection('orders').where('productId', '==', productId).where('isPreOrder', '==', true).limit(100).get()
        .then(function (snap) {
            var buyers = {}, open = 0;
            snap.forEach(function (d) {
                var o = d.data();
                if (PO_CLOSED_STATUSES.indexOf(String(o.status || 'pending').toLowerCase()) !== -1) return;
                if (o.stockLandedAt) return;   // already announced — matches the server's no-double-tap guard
                open++;
                if (o.buyerId) buyers[o.buyerId] = true;
            });
            var n = Object.keys(buyers).length;
            bodyEl.textContent = n === 0
                ? 'No buyers are still waiting on this pre-order (every order has shipped or closed). You can still retire the badge below.'
                : (n + (n === 1 ? ' buyer has' : ' buyers have') + ' an open pre-order (' + open + (open === 1 ? ' order' : ' orders') + '). Each of them gets a bell alert: "Your pre-order has landed! 🎉" — their money stays in escrow until they confirm delivery, same as always.');
            sendBtn.textContent = n === 0 ? 'Update listing' : 'Send the alert';
            sendBtn.disabled = false;
            sendBtn.onclick = function () { preorderStockLandedSend(productId, modal); };
        })
        .catch(function () {
            bodyEl.textContent = 'Could not pre-count the waiting buyers (no harm done) — the alert below will only reach buyers whose pre-order is still open.';
            sendBtn.textContent = 'Send the alert';
            sendBtn.disabled = false;
            sendBtn.onclick = function () { preorderStockLandedSend(productId, modal); };
        });
}

function preorderStockLandedSend(productId, modal) {
    var sendBtn = modal.querySelector('#poStockSend');
    var badgeOff = modal.querySelector('#poStockBadgeOff').checked;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Alerting…';
    if (typeof firebase === 'undefined' || !firebase.functions) {
        showFlashMessage('Error: Cloud Functions not available', 'error');
        sendBtn.disabled = false; sendBtn.textContent = 'Send the alert';
        return;
    }
    firebase.functions().httpsCallable('preorderStockLanded')({ productId: productId, turnOffBadge: badgeOff })
        .then(function (res) {
            var d = (res && res.data) || {};
            modal.style.display = 'none';
            if (d.buyers > 0) {
                showFlashMessage('🎉 Alert sent to ' + d.buyers + (d.buyers === 1 ? ' buyer' : ' buyers') + (d.badgeTurnedOff ? ' — the pre-order badge is off too' : ''), 'success');
            } else {
                showFlashMessage(d.badgeTurnedOff ? 'Pre-order badge removed (nobody was waiting)' : 'No waiting buyers — nothing was sent', 'success');
            }
            loadAdminProducts(); loadNavCounts();
        })
        .catch(function (err) {
            showFlashMessage('Error sending the alert: ' + (err && err.message ? err.message : err), 'error');
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send the alert';
        });
}
window.preorderStockLandedPrompt = preorderStockLandedPrompt;

// ============================================================================
// PRE-ORDER STAGE JOURNEY — Placed → Stock landed → Preparing → On its way →
// Delivered. The gold chip on an order row says where the buyer's money is;
// the bullhorn button opens a journey card so the admin can announce the NEXT
// stage with one tap. 'Delivered' is never a button — only the buyer's own
// in-app "Confirm delivery" releases the escrow.
// ============================================================================
var PO_ORDER_STAGE_DEFS = [
    ['ordered', '📝', 'Placed'],
    ['stock_landed', '📦', 'Stock landed'],
    ['preparing', '🎁', 'Preparing'],
    ['dispatched', '🚚', 'On its way'],
    ['delivered', '✅', 'Delivered']
];
function preOrderStageRankOf(o) {
    if (!o) return 0;
    var st = String(o.status || 'pending').toLowerCase();
    if (st === 'delivered' || st === 'completed') return 4;
    if (o.preOrderStage) {
        for (var i = 0; i < PO_ORDER_STAGE_DEFS.length; i++) {
            if (PO_ORDER_STAGE_DEFS[i][0] === o.preOrderStage) return i;
        }
    }
    if (st === 'shipped') return 3;
    if (o.stockLandedAt) return 1;
    return 0;
}
function preOrderStageLabel(stage) {
    for (var i = 0; i < PO_ORDER_STAGE_DEFS.length; i++) if (PO_ORDER_STAGE_DEFS[i][0] === stage) return PO_ORDER_STAGE_DEFS[i][1] + ' ' + PO_ORDER_STAGE_DEFS[i][2];
    return stage;
}
function preOrderStageChipHtml(order) {
    if (!order || order.isPreOrder !== true) return '';
    var s = PO_ORDER_STAGE_DEFS[preOrderStageRankOf(order)];
    return ' <span style="background:#fff7e0;border:1px solid #f5af02;color:#7a4a00;padding:0.1rem 0.45rem;border-radius:999px;font-size:0.68rem;font-weight:700;white-space:nowrap;" title="Pre-order journey — the buyer hears every step by bell alert">' + s[1] + ' ' + s[2] + '</span>';
}
function preOrderStageBtnHtml(order) {
    if (!order || order.isPreOrder !== true) return '';
    if (preOrderStageRankOf(order) >= 3) return '';   // only "delivered" is left, and that belongs to the buyer
    return '<button class="btn btn-small admin-order-stagebtn" onclick="preOrderStagesPrompt(\'' + order.id + '\')" title="Pre-order stage — tap to tell the buyer where their order is" style="padding:0.3rem 0.5rem;font-size:0.75rem;background:#f5af02;color:#191919;border:none;"><i class="fas fa-bullhorn"></i></button>';
}

function preOrderStagesPrompt(orderId) {
    var order = (window.adminOrdersCache || []).find(function (o) { return o.id === orderId; });
    if (!order) { showFlashMessage('Could not find that order in the list — reload the orders section and try again.', 'error'); return; }
    if (order.isPreOrder !== true) { showFlashMessage('That order is not a pre-order.', 'error'); return; }

    var modal = document.getElementById('poStageModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'poStageModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:9999;display:none;align-items:center;justify-content:center;padding:1rem;';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });
    }

    var rank = preOrderStageRankOf(order);
    var steps = '';
    PO_ORDER_STAGE_DEFS.forEach(function (s, i) {
        var done = i <= rank, cur = i === rank;
        steps += '<div style="flex:1;min-width:58px;text-align:center;">'
            + '<div style="width:30px;height:30px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.92rem;background:' + (done ? '#f5af02' : '#f3f4f6') + ';border:2px solid ' + (done ? '#e09e00' : '#e5e7eb') + (cur ? ';box-shadow:0 0 0 3px #fff3c9' : '') + ';">' + s[1] + '</div>'
            + '<div style="margin-top:0.25rem;font-size:0.62rem;font-weight:' + (cur ? '800' : '600') + ';color:' + (done ? '#7a4a00' : '#9ca3af') + ';">' + s[2] + '</div></div>';
    });

    var hist = '';
    (Array.isArray(order.preOrderStageHistory) ? order.preOrderStageHistory : []).forEach(function (h) {
        var when = '';
        try { when = new Date(h.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
        hist += '<div style="font-size:0.72rem;color:#5a6572;">' + preOrderStageLabel(h.stage) + (when ? ' · ' + escapeHtml(when) : '') + '</div>';
    });
    if (hist) hist = '<div style="margin-top:0.7rem;border-top:1px dashed #f0e2b6;padding-top:0.55rem;"><div style="font-size:0.68rem;font-weight:800;color:#7a4a00;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.2rem;">Already announced</div>' + hist + '</div>';

    var btns = '';
    for (var i = rank + 1; i <= 3; i++) {
        btns += '<button class="btn btn-small po-stage-go" data-stage="' + PO_ORDER_STAGE_DEFS[i][0] + '" data-label="Notify: ' + PO_ORDER_STAGE_DEFS[i][2] + '" style="background:#f5af02;color:#191919;border:none;font-weight:800;padding:0.55rem 0.8rem;font-size:0.8rem;width:100%;text-align:left;">' + PO_ORDER_STAGE_DEFS[i][1] + ' Notify: ' + PO_ORDER_STAGE_DEFS[i][2] + '</button>';
    }

    modal.innerHTML =
        '<div style="background:#fff;border-radius:12px;max-width:460px;width:100%;padding:1.2rem 1.3rem;box-shadow:0 18px 50px rgba(0,0,0,0.28);border-top:6px solid #f5af02;">'
        + '<h3 style="margin:0 0 0.2rem;font-size:1.02rem;color:#191919;">⏳ Pre-order journey</h3>'
        + '<div style="font-size:0.8rem;color:#5a6572;margin-bottom:0.8rem;">' + escapeHtml(String(order.productTitle || 'Item')) + ' · for ' + escapeHtml(String(order.buyerEmail || order.buyerId || 'the buyer')) + '</div>'
        + '<div style="display:flex;gap:0.25rem;align-items:flex-start;margin-bottom:0.9rem;">' + steps + '</div>'
        + (rank >= 3
            ? '<div style="font-size:0.8rem;color:#5a6572;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:0.55rem 0.7rem;">Nothing left to announce — the buyer taps <strong>Confirm delivery</strong> in their own app when the item is in their hands. That is what releases the escrow money.</div>'
            : '<div style="font-size:0.74rem;color:#7a4a00;margin-bottom:0.4rem;font-weight:700;">Tap a stage to tell the buyer (bell alert, one tap):</div><div style="display:flex;flex-direction:column;gap:0.45rem;">' + btns + '</div>'
              + '<div style="font-size:0.7rem;color:#9ca3af;margin-top:0.6rem;">✅ Delivered has no button — only the buyer\'s in-app confirmation releases the escrow.</div>')
        + hist
        + '<div style="display:flex;justify-content:flex-end;margin-top:0.9rem;"><button id="poStageClose" class="btn btn-outline btn-small" style="padding:0.45rem 0.9rem;">Close</button></div>'
        + '</div>';
    modal.querySelector('#poStageClose').addEventListener('click', function () { modal.style.display = 'none'; });
    modal.querySelectorAll('.po-stage-go').forEach(function (b) {
        b.addEventListener('click', function () { preOrderStageAdvance(orderId, this.getAttribute('data-stage'), this); });
    });
    modal.style.display = 'flex';
}

function preOrderStageAdvance(orderId, stage, btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Telling the buyer…';
    if (typeof firebase === 'undefined' || !firebase.functions) {
        showFlashMessage('Error: Cloud Functions not available', 'error');
        btn.disabled = false; btn.textContent = btn.getAttribute('data-label');
        return;
    }
    firebase.functions().httpsCallable('preorderAdvanceStage')({ orderId: orderId, stage: stage })
        .then(function (res) {
            var d = (res && res.data) || {};
            var modal = document.getElementById('poStageModal');
            if (modal) modal.style.display = 'none';
            if (d.noop) showFlashMessage(d.message || 'Already at that stage — nothing was sent.', 'info');
            else showFlashMessage('📣 Buyer told: ' + preOrderStageLabel(stage) + (d.orderStatus === 'shipped' ? ' (order now marked shipped)' : ''), 'success');
            if (typeof loadOrders === 'function') loadOrders(true);
        })
        .catch(function (err) {
            showFlashMessage('Error: ' + (err && err.message ? err.message : err), 'error');
            btn.disabled = false; btn.textContent = btn.getAttribute('data-label');
        });
}
window.preOrderStagesPrompt = preOrderStagesPrompt;

// Filter/search products
function filterAdminProducts() {
    var search = (document.getElementById('productSearch')?.value || '').toLowerCase();
    var category = document.getElementById('productCategoryFilter')?.value || '';
    var status = document.getElementById('productStatusFilter')?.value || '';

    var filtered = adminProductsCache.filter(function(p) {
        var sellerInfo = getProductSeller(p);
        var matchSearch = !search
            || (p.title || '').toLowerCase().includes(search)
            || (p.description || '').toLowerCase().includes(search)
            || (sellerInfo.name || '').toLowerCase().includes(search)
            || (sellerInfo.email || '').toLowerCase().includes(search)
            || (sellerInfo.id || '').toLowerCase().includes(search);
        var matchCategory = !category || p.category === category;
        var matchStatus = !status || (status === 'active' && p.isActive && !p.isSold) || (status === 'sold' && p.isSold) || (status === 'flagged' && p.isFlagged) || (status === 'pending' && !p.isActive && !p.isSold);
        
        // Store filter
        var matchStore = true;
        if (activeStoreFilter === 'sankofa-store') {
            matchStore = p.isSankofaStore === true;
        } else if (activeStoreFilter === 'marketplace') {
            matchStore = !p.isSankofaStore && !p.storeId;
        } else if (activeStoreFilter !== 'all' && activeStoreFilter.startsWith('store_')) {
            var storeId = activeStoreFilter.replace('store_', '');
            matchStore = p.storeId === storeId;
        }
        
        return matchSearch && matchCategory && matchStatus && matchStore;
    });

    renderAdminProducts(filtered);
}

// Product actions
function viewAdminProduct(id) {
    window.open('/product-detail.html?id=' + id, '_blank');
}

/**
 * Seller card for the admin panel — who this account is, what they have listed,
 * and quick actions (email them, filter the products table to their listings).
 */
function viewSellerProfile(sellerId) {
    if (!sellerId) return;
    var overlay = document.getElementById('adminSellerModal');
    if (overlay) overlay.remove();

    var known = adminSellersMap[sellerId] || {};
    var listings = (typeof adminProductsCache !== 'undefined' ? adminProductsCache : []).filter(function (p) {
        return (p.sellerId || p.userId) === sellerId;
    });
    var activeCount = listings.filter(function (p) { return p.isActive && !p.isSold; }).length;

    overlay = document.createElement('div');
    overlay.id = 'adminSellerModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    overlay.innerHTML =
        '<div style="background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,0.25);">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb;">' +
            '<h3 style="margin:0;font-size:1.05rem;display:flex;align-items:center;gap:0.5rem;"><i class="fas fa-user-circle" style="color:#0064d2;"></i> Seller details</h3>' +
            '<button onclick="document.getElementById(\'adminSellerModal\').remove()" style="border:none;background:#f1f5f9;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1rem;">&times;</button>' +
          '</div>' +
          '<div id="adminSellerModalBody" style="padding:1.1rem 1.25rem;">' +
            '<p style="color:#5a6572;font-size:0.9rem;margin:0;"><i class="fas fa-spinner fa-spin"></i> Loading…</p>' +
          '</div>' +
        '</div>';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    var walletText = '';

    function paint(user) {
        var name = sellerDisplayName(user) || known.name || 'Unnamed seller';
        var email = user.email || known.email || '';
        var phone = user.phone || user.phoneNumber || known.phone || '';
        var role = user.role || known.role || 'user';
        var status = user.status || known.status || '';
        var tier = user.premiumTier || user.sellerTier || '';
        var expiry = user.premiumExpiry ? (user.premiumExpiry.toDate ? user.premiumExpiry.toDate() : new Date(user.premiumExpiry)) : null;
        var joined = user.createdAt ? (user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt)) : null;

        var row = function (label, value, extra) {
            return '<div style="display:flex;gap:0.75rem;padding:0.45rem 0;border-bottom:1px solid #f1f5f9;">' +
                '<div style="width:120px;color:#6b7280;font-size:0.82rem;">' + label + '</div>' +
                '<div style="flex:1;font-size:0.88rem;font-weight:600;word-break:break-word;">' + (value || '—') + (extra || '') + '</div></div>';
        };

        document.getElementById('adminSellerModalBody').innerHTML =
            '<div style="display:flex;align-items:center;gap:0.85rem;margin-bottom:1rem;">' +
              '<span style="width:52px;height:52px;border-radius:50%;background:#e8eef7;color:#0064d2;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:1.25rem;">' + escapeHtml((name || email || '?').charAt(0).toUpperCase()) + '</span>' +
              '<div style="min-width:0;">' +
                '<div style="font-weight:800;font-size:1rem;">' + escapeHtml(name) + '</div>' +
                (email ? '<a href="mailto:' + escapeHtml(email) + '" style="font-size:0.85rem;color:#0064d2;text-decoration:none;">' + escapeHtml(email) + '</a>' : '<div style="font-size:0.85rem;color:#9ca3af;">no email on file</div>') +
              '</div>' +
            '</div>' +
            row('Phone', escapeHtml(phone)) +
            row('Role', escapeHtml(role) + (role === 'admin' ? ' <span style="color:#0064d2;">(admin)</span>' : '')) +
            row('Status', status ? '<span style="text-transform:capitalize;">' + escapeHtml(status) + '</span>' : '') +
            row('Premium', user.isPremium === true
                ? '<span style="color:#f5af02;">★ ' + escapeHtml(tier || 'premium') + '</span>' + (expiry ? ' <span style="font-weight:400;font-size:0.78rem;color:#5a6572;">(until ' + expiry.toLocaleDateString() + ')</span>' : '')
                : '<span style="color:#9ca3af;font-weight:400;">not premium</span>') +
            row('Wallet', walletText) +
            row('Joined', joined ? joined.toLocaleDateString() : '') +
            row('Listings', listings.length + ' total · ' + activeCount + ' active') +
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:1rem;">' +
              (email ? '<a href="mailto:' + escapeHtml(email) + '?subject=About your Sankofa Market listing" class="btn btn-primary btn-small" style="text-decoration:none;"><i class="fas fa-envelope"></i> Email seller</a>' : '') +
              '<button onclick="filterProductsBySeller(\'' + escapeHtml(sellerId) + '\')" class="btn btn-outline btn-small"><i class="fas fa-box"></i> Show their products</button>' +
              '<button onclick="document.getElementById(\'adminSellerModal\').remove(); showSection(\'users\')" class="btn btn-outline btn-small"><i class="fas fa-users"></i> Users list</button>' +
              '<button onclick="copyText(\'' + escapeHtml(sellerId) + '\')" class="btn btn-outline btn-small" title="Copy the seller ID"><i class="fas fa-copy"></i> Copy ID</button>' +
            '</div>' +
            '<div style="font-size:0.72rem;color:#9ca3af;margin-top:0.75rem;word-break:break-all;">Seller ID: ' + escapeHtml(sellerId) + '</div>';
    }

    // Show the wallet balance too (handy when a seller disputes an escrow payment)
    (function loadWalletAndUser() {
        if (typeof firebaseDB === 'undefined' || !firebaseDB) { paint(known); return; }
        firebaseDB.collection('users').doc(sellerId).get().then(function (doc) {
            var user = doc.exists ? doc.data() : known;
            firebaseDB.collection('wallets').doc(sellerId).get().then(function (w) {
                if (w.exists) {
                    var bal = w.data().balance || 0;
                    walletText = 'GHS ' + Number(bal).toLocaleString();
                } else {
                    walletText = '<span style="color:#9ca3af;font-weight:400;">no wallet yet</span>';
                }
                paint(user);
            }).catch(function () { paint(user); });
        }).catch(function () { paint(known); });
    })();
}

/** Jump to the products table filtered to one seller. */
function filterProductsBySeller(sellerId) {
    var info = adminSellersMap[sellerId] || {};
    var box = document.getElementById('productSearch');
    if (box) box.value = info.email || sellerId;
    var modal = document.getElementById('adminSellerModal');
    if (modal) modal.remove();
    if (typeof showSection === 'function') showSection('products');
    filterAdminProducts();
}

/* === BULK PRODUCT EDIT CORE START (pure helpers: no DOM, no network) === */
var SM_BULK_MAX_PRICE = 1000000;
/** One edited row. Returns only the fields that really changed, or an error for a bad price. */
function smBulkChanges(original, edited) {
    var o = original || {}, e = edited || {};
    if (e.price === '' || e.price === null || e.price === undefined) {
        return { ok: false, error: 'Type a price.' };
    }
    var price = Number(e.price);
    if (!isFinite(price) || price < 0 || price > SM_BULK_MAX_PRICE) {
        return { ok: false, error: 'Price must be a number from 0 to ' + SM_BULK_MAX_PRICE.toLocaleString('en-GB') + '.' };
    }
    var out = {};
    var rounded = Math.round(price * 100) / 100;
    if (rounded !== Math.round((Number(o.price) || 0) * 100) / 100) out.price = rounded;
    var featured = e.isFeatured === true;
    if (featured !== (o.isFeatured === true)) out.isFeatured = featured;
    return { ok: true, changes: out };
}
/* === BULK PRODUCT EDIT CORE END === */

// Bulk edit (Tier 5, option 6): prices and featured flags in one table. Uses the products the
// admin list already loaded, so it costs no extra reads. Saves only the rows that changed.
var bulkEditRows = [];
function openBulkEditProducts() {
    var modal = document.getElementById('bulkEditModal');
    if (!modal) return;
    bulkEditRows = (adminProductsCache || []).map(function (p) {
        return {
            id: p.id, title: String(p.title || 'Untitled'), store: String(p.sellerName || p.storeName || ''),
            original: { price: Number(p.price) || 0, isFeatured: p.isFeatured === true }, edited: null
        };
    }).sort(function (a, b) { return a.title.localeCompare(b.title); });
    var search = document.getElementById('bulkEditSearch');
    if (search) search.value = '';
    renderBulkEditRows('');
    bindBulkEditOnce();
    modal.style.display = 'flex';
}
function closeBulkEditProducts() {
    var modal = document.getElementById('bulkEditModal');
    if (modal) modal.style.display = 'none';
}
function renderBulkEditRows(filter) {
    var body = document.getElementById('bulkEditBody');
    if (!body) return;
    var q = String(filter || '').toLowerCase().trim();
    var html = [];
    bulkEditRows.forEach(function (r, i) {
        if (q && (r.title + ' ' + r.store).toLowerCase().indexOf(q) === -1) return;
        var e = r.edited || r.original;
        html.push('<tr data-idx="' + i + '">' +
            '<td style="padding:0.45rem 0.5rem;border-bottom:1px solid #eef1f6;">' + escapeHtml(r.title) +
                '<div style="font-size:0.72rem;color:#8a94a3;">' + escapeHtml(r.store) + '</div></td>' +
            '<td style="padding:0.45rem 0.5rem;border-bottom:1px solid #eef1f6;"><input type="number" min="0" max="' + SM_BULK_MAX_PRICE + '" step="0.01" data-field="price" value="' + escapeHtml(String(e.price)) + '" style="width:120px;padding:0.35rem;border:1px solid #d7dce3;border-radius:8px;"></td>' +
            '<td style="padding:0.45rem 0.5rem;border-bottom:1px solid #eef1f6;text-align:center;"><input type="checkbox" data-field="isFeatured"' + (e.isFeatured ? ' checked' : '') + '></td>' +
            '</tr>');
    });
    body.innerHTML = html.join('') || '<tr><td colspan="3" style="padding:1rem;color:#5a6572;">No products match.</td></tr>';
    bulkEditCountUpdate();
}
function bindBulkEditOnce() {
    var body = document.getElementById('bulkEditBody');
    if (!body || body.getAttribute('data-bound') === '1') return;
    body.setAttribute('data-bound', '1');
    body.addEventListener('input', onBulkEditInput);
    body.addEventListener('change', onBulkEditInput);
}
function onBulkEditInput(ev) {
    var tr = ev.target.closest('tr');
    var field = ev.target.getAttribute('data-field');
    if (!tr || !field) return;
    var r = bulkEditRows[Number(tr.getAttribute('data-idx'))];
    if (!r) return;
    r.edited = r.edited || { price: r.original.price, isFeatured: r.original.isFeatured };
    r.edited[field] = field === 'isFeatured' ? ev.target.checked : ev.target.value;
    bulkEditCountUpdate();
}
function bulkEditPending() {
    return bulkEditRows.map(function (r) {
        if (!r.edited) return null;
        return { row: r, res: smBulkChanges(r.original, r.edited) };
    }).filter(function (x) { return x && (!x.res.ok || Object.keys(x.res.changes).length > 0); });
}
function bulkEditCountUpdate() {
    var n = bulkEditPending().length;
    var el = document.getElementById('bulkEditCount');
    if (el) el.textContent = n + (n === 1 ? ' product changed' : ' products changed');
}
async function saveBulkEditProducts() {
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    var pending = bulkEditPending();
    var bad = pending.filter(function (x) { return !x.res.ok; });
    if (bad.length) {
        showFlashMessage(bad[0].row.title + ': ' + bad[0].res.error, 'error');
        return;
    }
    var todo = pending.filter(function (x) { return Object.keys(x.res.changes).length > 0; });
    if (!todo.length) { showFlashMessage('Nothing to save yet.', 'info'); return; }
    if (!confirm('Save changes to ' + todo.length + (todo.length === 1 ? ' product' : ' products') + '?\n\nPrice changes show to buyers straight away. Orders that were already paid keep the price they were paid at.')) return;
    var saveBtn = document.getElementById('bulkEditSave');
    if (saveBtn) saveBtn.disabled = true;
    try {
        var user = firebase.auth().currentUser;
        var uid = user ? user.uid : '';
        var nowIso = new Date().toISOString();
        for (var i = 0; i < todo.length; i += 400) {
            var batch = firebaseDB.batch();
            todo.slice(i, i + 400).forEach(function (x) {
                batch.update(firebaseDB.collection('products').doc(x.row.id), Object.assign({}, x.res.changes, { updatedAt: nowIso, updatedBy: uid }));
            });
            await batch.commit();
        }
        showFlashMessage('Saved ' + todo.length + (todo.length === 1 ? ' product' : ' products') + ' ✅', 'success');
        closeBulkEditProducts();
        loadAdminProducts(true);
    } catch (e) {
        showFlashMessage('Some changes did not save: ' + ((e && e.message) || 'please try again') + '. Open Bulk edit again to see what is left.', 'error');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}
window.openBulkEditProducts = openBulkEditProducts;
window.closeBulkEditProducts = closeBulkEditProducts;
window.renderBulkEditRows = renderBulkEditRows;
window.saveBulkEditProducts = saveBulkEditProducts;

function toggleFeaturedProduct(id, featured) {
    if (typeof firebaseDB === 'undefined') return;
    firebaseDB.collection('products').doc(id).update({ isFeatured: featured })
        .then(function() {
            showFlashMessage(featured ? 'Product marked as featured ⭐' : 'Product unfeatured', 'success');
            loadAdminProducts(); loadNavCounts();
        })
        .catch(function(err) { showFlashMessage('Error: ' + err.message, 'error'); });
}

function deleteAdminProduct(id, title) {
    // Delegate to the main deleteProduct function (which handles image cleanup)
    deleteProduct(id, title);
}

// ============================================================================
// SANKOFA STORE PROFILE
// ============================================================================

function initStoreProfile() {
    var uploadInput = document.getElementById('storeProfileUpload');
    var saveBtn = document.getElementById('saveStoreProfileBtn');
    var profilePic = document.getElementById('storeProfilePic');
    var statusEl = document.getElementById('storeProfileStatus');
    
    if (!uploadInput || !saveBtn) return;
    
    var pendingImageURL = null;
    
    // Load existing store profile
    loadStoreProfile();
    
    // Handle image upload
    uploadInput.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            statusEl.innerHTML = '<span style="color:#e74c3c;">Image must be under 5MB</span>';
            return;
        }
        
        statusEl.innerHTML = '<span style="color:#0064d2;"><i class="fas fa-spinner fa-spin"></i> Uploading...</span>';
        
        // Upload to Firebase Storage
        if (typeof firebase !== 'undefined' && firebase.storage) {
            var storageRef = firebase.storage().ref();
            var fileRef = storageRef.child('store-profile/logo_' + Date.now() + '.' + file.name.split('.').pop());
            
            fileRef.put(file).then(function(snapshot) {
                return snapshot.ref.getDownloadURL();
            }).then(function(url) {
                pendingImageURL = url;
                profilePic.src = url;
                statusEl.innerHTML = '<span style="color:#22c55e;"><i class="fas fa-check"></i> Image uploaded! Click Save to apply.</span>';
            }).catch(function(err) {
                console.error('Upload error:', err);
                // Fallback: use data URL
                var reader = new FileReader();
                reader.onload = function(ev) {
                    pendingImageURL = ev.target.result;
                    profilePic.src = ev.target.result;
                    statusEl.innerHTML = '<span style="color:#f59e0b;"><i class="fas fa-check"></i> Image ready (local). Click Save to apply.</span>';
                };
                reader.readAsDataURL(file);
            });
        } else {
            // No Firebase Storage - use data URL
            var reader = new FileReader();
            reader.onload = function(ev) {
                pendingImageURL = ev.target.result;
                profilePic.src = ev.target.result;
                statusEl.innerHTML = '<span style="color:#f59e0b;"><i class="fas fa-check"></i> Image ready. Click Save to apply.</span>';
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Save store profile
    saveBtn.addEventListener('click', function() {
        var storeName = document.getElementById('storeName').value.trim() || 'Sankofa Store';
        var storeTagline = document.getElementById('storeTagline').value.trim();
        
        var profileData = {
            storeName: storeName,
            storeTagline: storeTagline,
            updatedAt: new Date().toISOString()
        };
        
        if (pendingImageURL) {
            profileData.profilePicture = pendingImageURL;
        }
        
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
            firebaseDB.collection('settings').doc('sankofaStore').set(profileData, { merge: true })
                .then(function() {
                    statusEl.innerHTML = '<span style="color:#22c55e;"><i class="fas fa-check-circle"></i> Store profile saved!</span>';
                    pendingImageURL = null;
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Profile';
                })
                .catch(function(err) {
                    statusEl.innerHTML = '<span style="color:#e74c3c;">Error: ' + err.message + '</span>';
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Profile';
                });
        } else {
            // Save to localStorage as fallback
            localStorage.setItem('sankofaStoreProfile', JSON.stringify(profileData));
            statusEl.innerHTML = '<span style="color:#22c55e;"><i class="fas fa-check-circle"></i> Saved locally (Firebase not connected)</span>';
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Profile';
        }
    });
}

function loadStoreProfile() {
    var profilePic = document.getElementById('storeProfilePic');
    var storeNameInput = document.getElementById('storeName');
    var storeTaglineInput = document.getElementById('storeTagline');
    
    if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        firebaseDB.collection('settings').doc('sankofaStore').get().then(function(doc) {
            if (doc.exists) {
                var data = doc.data();
                if (data.profilePicture && profilePic) profilePic.src = data.profilePicture;
                if (data.storeName && storeNameInput) storeNameInput.value = data.storeName;
                if (data.storeTagline && storeTaglineInput) storeTaglineInput.value = data.storeTagline;
            }
        }).catch(function(err) {
            console.warn('Could not load store profile:', err);
        });
    } else {
        // Try localStorage
        try {
            var saved = JSON.parse(localStorage.getItem('sankofaStoreProfile') || '{}');
            if (saved.profilePicture && profilePic) profilePic.src = saved.profilePicture;
            if (saved.storeName && storeNameInput) storeNameInput.value = saved.storeName;
            if (saved.storeTagline && storeTaglineInput) storeTaglineInput.value = saved.storeTagline;
        } catch(e) {}
    }
}

// ============================================================================
// STORE MANAGEMENT
// ============================================================================

var storesCache = [];

function initStoreManagement() {
    var addBtn = document.getElementById('addStoreBtn');
    if (!addBtn) return;
    
    addBtn.addEventListener('click', function() { openStoreModal(); });
    loadStores(); loadNavCounts();
}

function loadStores() {
    var grid = document.getElementById('storesGrid');
    if (!grid) return;
    
    storesCache = [];
    
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
        // Show Sankofa Store as default + offline message
        storesCache.push({ id: 'sankofa-store', name: 'Sankofa Store', tagline: 'Official marketplace store', isOfficial: true, profilePicture: '', productCount: 0, createdAt: null });
        renderStores();
        return;
    }
    
    // Load Sankofa Store profile from settings
    var sankofaPromise = firebaseDB.collection('settings').doc('sankofaStore').get().then(function(doc) {
        var data = doc.exists ? doc.data() : {};
        storesCache.push({
            id: 'sankofa-store',
            name: data.storeName || 'Sankofa Store',
            tagline: data.storeTagline || 'Official marketplace store',
            profilePicture: data.profilePicture || '',
            isOfficial: true,
            productCount: 0,
            createdAt: null
        });
    }).catch(function() {
        storesCache.push({ id: 'sankofa-store', name: 'Sankofa Store', tagline: 'Official marketplace store', isOfficial: true, profilePicture: '', productCount: 0, createdAt: null });
    });
    
    // Load other stores
    var otherStoresPromise = firebaseDB.collection('stores').get().then(function(snapshot) {
        snapshot.forEach(function(doc) {
            storesCache.push({ id: doc.id, ...doc.data() });
        });
    }).catch(function() {});
    
    Promise.all([sankofaPromise, otherStoresPromise]).then(function() {
        renderStores();
    });
}

function renderStores() {
    var grid = document.getElementById('storesGrid');
    if (!grid || storesCache.length === 0) return;
    
    var html = '';
    storesCache.forEach(function(store) {
        var imgSrc = store.profilePicture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(store.name || 'S') + '&size=120&background=0064d2&color=fff&bold=true';
        var productCount = store.productCount || 0;
        var isOfficial = store.isOfficial === true;
        var borderColor = isOfficial ? '#f5af02' : '#0064d2';
        var officialBadge = isOfficial ? ' <span style="background:#f5af02;color:#000;padding:0.15rem 0.5rem;border-radius:50px;font-size:0.65rem;font-weight:700;margin-left:0.35rem;">⭐ OFFICIAL</span>' : '';
        
        var editAction = isOfficial 
            ? '<button class="action-btn" title="Edit Store Profile" onclick="editSankofaStoreProfile()"><i class="fas fa-edit"></i></button>'
            : '<button class="action-btn" title="Edit" onclick="openStoreModal(\'' + store.id + '\')"><i class="fas fa-edit"></i></button>';
        
        var deleteAction = isOfficial 
            ? '' 
            : '<button class="action-btn danger" title="Delete" onclick="deleteStore(\'' + store.id + '\',\'' + (store.name || '').replace(/'/g, "\\'") + '\')"><i class="fas fa-trash"></i></button>';
        
        var dateDisplay = isOfficial ? 'Built-in' : (store.createdAt ? new Date(store.createdAt).toLocaleDateString() : '—');
        
        html += '<div class="cat-admin-card" style="position:relative;border-top:3px solid ' + borderColor + ';">' +
            '<div class="cat-admin-header">' +
                '<img src="' + imgSrc + '" alt="' + (store.name || '') + '" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid ' + borderColor + ';">' +
                '<div class="cat-admin-actions">' + editAction + deleteAction + '</div>' +
            '</div>' +
            '<h4>' + (store.name || 'Untitled Store') + officialBadge + '</h4>' +
            '<p style="font-size:0.78rem;color:#5a6572;margin:0.25rem 0;">' + (store.tagline || 'No tagline') + '</p>' +
            '<div class="cat-admin-stats">' +
                '<span><i class="fas fa-box"></i> ' + productCount + ' products</span>' +
                '<span><i class="fas fa-calendar"></i> ' + dateDisplay + '</span>' +
            '</div>' +
        '</div>';
    });
    
    grid.innerHTML = html;
}

function editSankofaStoreProfile() {
    // Scroll to the Sankofa Store Profile card in Settings
    var navItems = document.querySelectorAll('.sidebar-nav .nav-item, .bottom-nav-item');
    navItems.forEach(function(item) {
        if (item.dataset.section === 'settings') item.click();
    });
    setTimeout(function() {
        var profileCard = document.getElementById('storeProfilePic');
        if (profileCard) profileCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
}

function openStoreModal(storeId) {
    var store = storeId ? storesCache.find(function(s) { return s.id === storeId; }) : null;
    var isEdit = !!store;
    
    // Remove existing modal
    var existing = document.getElementById('storeModal');
    if (existing) existing.remove();
    
    var modal = document.createElement('div');
    modal.id = 'storeModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    
    var imgSrc = (store && store.profilePicture) || 'https://ui-avatars.com/api/?name=Store&size=120&background=0064d2&color=fff&bold=true';
    
    modal.innerHTML = '<div class="modal-content" style="background:white;border-radius:16px;padding:2rem;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">' +
            '<h2 style="margin:0;">' + (isEdit ? 'Edit Store' : 'Add New Store') + '</h2>' +
            '<button onclick="document.getElementById(\'storeModal\').remove()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:#5a6572;"><i class="fas fa-times"></i></button>' +
        '</div>' +
        
        '<div style="text-align:center;margin-bottom:1.5rem;">' +
            '<img id="storeModalPic" src="' + imgSrc + '" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #0064d2;margin-bottom:0.5rem;">' +
            '<br>' +
            '<label class="btn btn-outline btn-small" style="cursor:pointer;margin:0;font-size:0.8rem;">' +
                '<i class="fas fa-camera"></i> Change Photo' +
                '<input type="file" id="storeModalImageInput" accept="image/*" style="display:none;">' +
            '</label>' +
        '</div>' +
        
        '<form id="storeModalForm">' +
            '<div class="form-group" style="margin-bottom:1rem;">' +
                '<label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:0.35rem;">Store Name *</label>' +
                '<input type="text" id="storeModalName" value="' + (store ? (store.name || '').replace(/"/g, '&quot;') : '') + '" required placeholder="e.g. Accra Electronics Hub" style="width:100%;padding:0.7rem;border:1.5px solid #e5e5e5;border-radius:8px;font-size:0.95rem;">' +
            '</div>' +
            '<div class="form-group" style="margin-bottom:1rem;">' +
                '<label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:0.35rem;">Tagline</label>' +
                '<input type="text" id="storeModalTagline" value="' + (store ? (store.tagline || '').replace(/"/g, '&quot;') : '') + '" placeholder="e.g. Best electronics in Accra" style="width:100%;padding:0.7rem;border:1.5px solid #e5e5e5;border-radius:8px;font-size:0.95rem;">' +
            '</div>' +
            '<div class="form-group" style="margin-bottom:1rem;">' +
                '<label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:0.35rem;">Description</label>' +
                '<textarea id="storeModalDesc" rows="3" placeholder="Brief description of the store..." style="width:100%;padding:0.7rem;border:1.5px solid #e5e5e5;border-radius:8px;font-size:0.95rem;resize:vertical;">' + (store ? (store.description || '') : '') + '</textarea>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom:1rem;">' +
                '<label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:0.35rem;">Contact Email</label>' +
                '<input type="email" id="storeModalEmail" value="' + (store ? (store.email || '').replace(/"/g, '&quot;') : '') + '" placeholder="store@example.com" style="width:100%;padding:0.7rem;border:1.5px solid #e5e5e5;border-radius:8px;font-size:0.95rem;">' +
            '</div>' +
            '<div class="form-group" style="margin-bottom:1rem;">' +
                '<label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:0.35rem;">Phone</label>' +
                '<input type="tel" id="storeModalPhone" value="' + (store ? (store.phone || '').replace(/"/g, '&quot;') : '') + '" placeholder="0XX XXX XXXX" style="width:100%;padding:0.7rem;border:1.5px solid #e5e5e5;border-radius:8px;font-size:0.95rem;">' +
            '</div>' +
            '<div class="form-group" style="margin-bottom:1.5rem;">' +
                '<label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:0.35rem;">Location</label>' +
                '<input type="text" id="storeModalLocation" value="' + (store ? (store.location || '').replace(/"/g, '&quot;') : '') + '" placeholder="e.g. Accra, Ghana" style="width:100%;padding:0.7rem;border:1.5px solid #e5e5e5;border-radius:8px;font-size:0.95rem;">' +
            '</div>' +
            '<div id="storeModalStatus" style="font-size:0.82rem;margin-bottom:1rem;"></div>' +
            '<div style="display:flex;gap:0.75rem;justify-content:flex-end;">' +
                '<button type="button" onclick="document.getElementById(\'storeModal\').remove()" class="btn btn-outline">Cancel</button>' +
                '<button type="submit" class="btn btn-primary" id="storeModalSaveBtn"><i class="fas fa-save"></i> ' + (isEdit ? 'Update Store' : 'Create Store') + '</button>' +
            '</div>' +
        '</form>' +
    '</div>';
    
    document.body.appendChild(modal);
    
    // Close on backdrop click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.remove();
    });
    
    // Image upload
    var pendingImg = null;
    var imgInput = document.getElementById('storeModalImageInput');
    var modalPic = document.getElementById('storeModalPic');
    
    imgInput.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            document.getElementById('storeModalStatus').innerHTML = '<span style="color:#e74c3c;">Image must be under 5MB</span>';
            return;
        }
        
        if (typeof firebase !== 'undefined' && firebase.storage) {
            var ref = firebase.storage().ref().child('store-profiles/' + Date.now() + '_' + file.name);
            ref.put(file).then(function(snap) { return snap.ref.getDownloadURL(); }).then(function(url) {
                pendingImg = url;
                modalPic.src = url;
            }).catch(function() {
                var reader = new FileReader();
                reader.onload = function(ev) { pendingImg = ev.target.result; modalPic.src = ev.target.result; };
                reader.readAsDataURL(file);
            });
        } else {
            var reader = new FileReader();
            reader.onload = function(ev) { pendingImg = ev.target.result; modalPic.src = ev.target.result; };
            reader.readAsDataURL(file);
        }
    });
    
    // Form submit
    document.getElementById('storeModalForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        var data = {
            name: document.getElementById('storeModalName').value.trim(),
            tagline: document.getElementById('storeModalTagline').value.trim(),
            description: document.getElementById('storeModalDesc').value.trim(),
            email: document.getElementById('storeModalEmail').value.trim(),
            phone: document.getElementById('storeModalPhone').value.trim(),
            location: document.getElementById('storeModalLocation').value.trim(),
            isActive: true
        };
        
        if (!data.name) {
            document.getElementById('storeModalStatus').innerHTML = '<span style="color:#e74c3c;">Store name is required</span>';
            return;
        }
        
        if (pendingImg) data.profilePicture = pendingImg;
        if (!isEdit) data.createdAt = new Date().toISOString();
        data.updatedAt = new Date().toISOString();
        data.productCount = store ? (store.productCount || 0) : 0;
        
        var saveBtn = document.getElementById('storeModalSaveBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
            var promise = isEdit 
                ? firebaseDB.collection('stores').doc(storeId).update(data)
                : firebaseDB.collection('stores').add(data);
            
            promise.then(function() {
                showFlashMessage(isEdit ? 'Store updated!' : 'Store created! 🏪', 'success');
                modal.remove();
                loadStores(); loadNavCounts();
            }).catch(function(err) {
                document.getElementById('storeModalStatus').innerHTML = '<span style="color:#e74c3c;">Error: ' + err.message + '</span>';
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> ' + (isEdit ? 'Update Store' : 'Create Store');
            });
        } else {
            document.getElementById('storeModalStatus').innerHTML = '<span style="color:#e74c3c;">Firebase not connected</span>';
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> ' + (isEdit ? 'Update Store' : 'Create Store');
        }
    });
}

function deleteStore(storeId, storeName) {
    if (!confirm('Delete store "' + storeName + '"?\n\nProducts from this store will not be deleted, but they will lose their store association.')) return;
    
    if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        firebaseDB.collection('stores').doc(storeId).delete().then(function() {
            showFlashMessage('Store deleted', 'success');
            loadStores(); loadNavCounts();
        }).catch(function(err) {
            showFlashMessage('Error: ' + err.message, 'error');
        });
    }
}

// ============================================================================
// NAV COUNT BADGES - Load item counts from Firestore
// ============================================================================

function loadNavCounts() {
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) return;

    // Products count
    firebaseDB.collection('products').get().then(function(snap) {
        updateCount('countProducts', snap.size);
    }).catch(function() {});

    // Users count (non-admin users)
    firebaseDB.collection('users').get().then(function(snap) {
        var count = 0;
        snap.forEach(function(doc) {
            if (doc.data().role !== 'admin') count++;
        });
        updateCount('countUsers', count);
    }).catch(function() {});

    // Orders count
    firebaseDB.collection('orders').get().then(function(snap) {
        updateCount('countOrders', snap.size);
    }).catch(function() {});

    // Messages/conversations count
    firebaseDB.collection('conversations').get().then(function(snap) {
        updateCount('countMessages', snap.size);
    }).catch(function(err) {
        // ('chats' used to be tried here as a fallback — that collection has no rule and
        //  nothing writes it, so the read always failed. conversations is the real one.)
        console.warn('could not count conversations', err && err.message);
    });

    // Reports count (flagged products + disputes)
    var reportCount = 0;
    firebaseDB.collection('products').where('isFlagged', '==', true).get().then(function(snap) {
        reportCount += snap.size;
        updateCount('countReports', reportCount);
    }).catch(function() {
        // If flagged query fails, just count disputes
    });
    firebaseDB.collection('disputes').get().then(function(snap) {
        reportCount += snap.size;
        updateCount('countReports', reportCount);
    }).catch(function() {});
    firebaseDB.collection('reports').get().then(function(snap) {
        reportCount += snap.size;
        updateCount('countReports', reportCount);
    }).catch(function() {});

    // Categories count — if cache empty, fetch from Firestore, else use cache; also schedule retry
    if (typeof adminCategoriesCache !== 'undefined' && adminCategoriesCache.length > 0) {
        updateCount('countCategories', adminCategoriesCache.length);
    } else {
        // Try Firestore categories count; fallback to 15 built-in
        firebaseDB.collection('categories').get().then(function(snap){
            var cnt = snap.size || 15;
            // if no custom docs, use built-in 15
            if (cnt === 0) cnt = 15;
            updateCount('countCategories', cnt);
        }).catch(function(){
            updateCount('countCategories', 15);
        });
        // retry after cache loads
        setTimeout(function(){
            if (typeof adminCategoriesCache !== 'undefined' && adminCategoriesCache.length > 0) {
                updateCount('countCategories', adminCategoriesCache.length);
            }
        }, 2000);
    }

    // Stores count (excluding built-in Sankofa Store)
    firebaseDB.collection('stores').get().then(function(snap) {
        updateCount('countStores', snap.size);
    }).catch(function() {});
    // Wallets count + total balance
    // Count real wallet holders only (wallets whose account still exists)
    Promise.all([
        firebaseDB.collection('wallets').get().catch(function(){ return { forEach:function(){}, size:0, empty:true }; }),
        firebaseDB.collection('users').get().catch(function(){ return { forEach:function(){}, size:0, empty:true }; })
    ]).then(function(res){
        var snapWallets = res[0], snapUsers = res[1];
        var uids = {};
        try { snapUsers.forEach(function(d){ uids[d.id] = true; }); } catch (e) {}
        var real = 0, total = 0;
        try { snapWallets.forEach(function(d){
            var w = d.data();
            if (!uids[w.userId || d.id]) return;      // leftover wallet — not a holder
            real++;
            total += (w.balance || 0);
        }); } catch (e) {}
        updateCount('countWallets', real);
        const el=document.getElementById('walletStatTotal'); if(el) el.textContent='GHS '+total.toLocaleString(undefined,{minimumFractionDigits:2});
    }).catch(function(){ updateCount('countWallets', 0); });
}

function updateCount(elementId, count) {
    var el = document.getElementById(elementId);
    if (!el) return;
    
    var displayCount = count > 999 ? '999+' : count.toString();
    el.textContent = displayCount;
    el.setAttribute('data-count', count);
    
    // Always show the badge, just style it differently for zero
    el.style.display = '';
    if (count === 0) {
        el.style.opacity = '1';
        el.style.background = '#e5e5e5';
        el.style.color = '#767676';
    } else {
        el.style.opacity = '1';
        el.style.background = '';
        el.style.color = '';
    }
}

function loadOrders(forceServer) {
    var tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:1.5rem;color:#5a6572;"><i class="fas fa-spinner fa-spin"></i> Connecting to server...</td></tr>';
        setTimeout(function(){ loadOrders(forceServer); }, 900);
        return;
    }
    // skeleton
    if (typeof showTableSkeleton === 'function') {
        try{ showTableSkeleton('ordersTableBody', 9, 5); }catch(e){}
    } else {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:1.5rem;color:#5a6572;"><i class="fas fa-spinner fa-spin"></i> Loading orders...</td></tr>';
    }
    var opts = forceServer ? {source:'server'} : {};
    // Fetch ALL orders (no limit) so Total Orders is correct — admin has isAdmin() bypass for limit; paginated client-side 10/page
    firebaseDB.collection('orders').orderBy('createdAt', 'desc').get(opts)
        .then(function(snapshot) {
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:#5a6572;"><i class="fas fa-inbox" style="font-size:2rem;color:#ccc;"></i><p>No orders yet</p></td></tr>';
                updateOrderStats(0, 0, 0, 0);
                // keep caches empty but defined for search/bulk
                window.adminOrdersCache = [];
                window.filteredOrdersCache = [];
                try{ if (typeof renderPagination==='function') renderPagination('ordersPaginationBtns','ordersPaginationInfo',0,1,window.ordersPageSize||10,'goToOrdersPage'); }catch(e){}
                return;
            }
            var orders = [];
            snapshot.forEach(function(doc) { orders.push({ id: doc.id, ...doc.data() }); });
            window.adminOrdersCache = orders.slice();
            var total = orders.length;
            var pending = orders.filter(function(o) { return o.status === 'pending'; }).length;
            var paid = orders.filter(function(o) { return o.status === 'paid'; }).length;
            var completed = orders.filter(function(o) { return o.status === 'completed'; }).length;
            updateOrderStats(total, pending, paid, completed);
            renderOrders(orders);
        })
        .catch(function(error) {
            console.warn('loadOrders orderBy failed, fallback without orderBy', error.message || error);
            firebaseDB.collection('orders').get(opts)
                .then(function(snapshot2){
                    if (snapshot2.empty){
                        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:#5a6572;"><i class="fas fa-inbox" style="font-size:2rem;color:#ccc;"></i><p>No orders yet</p></td></tr>';
                        updateOrderStats(0,0,0,0);
                        window.adminOrdersCache = [];
                        window.filteredOrdersCache = [];
                        try{ if (typeof renderPagination==='function') renderPagination('ordersPaginationBtns','ordersPaginationInfo',0,1,window.ordersPageSize||10,'goToOrdersPage'); }catch(e){}
                        return;
                    }
                    var orders2 = [];
                    snapshot2.forEach(function(doc){ orders2.push({ id: doc.id, ...doc.data() }); });
                    // client sort desc by createdAt
                    orders2.sort(function(a,b){
                        var ta = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
                        var tb = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
                        return tb - ta;
                    });
                    window.adminOrdersCache = orders2.slice();
                    var total = orders2.length;
                    var pending = orders2.filter(function(o) { return o.status === 'pending'; }).length;
                    var paid = orders2.filter(function(o) { return o.status === 'paid'; }).length;
                    var completed = orders2.filter(function(o) { return o.status === 'completed'; }).length;
                    updateOrderStats(total, pending, paid, completed);
                    renderOrders(orders2);
                })
                .catch(function(err2){
                    console.error('Error loading orders fallback:', err2);
                    var msg = (err2 && err2.message) ? err2.message : String(err2);
                    // permission hint
                    if (msg.indexOf('Missing or insufficient permissions')!==-1){
                        msg += ' — sign in as admin (sankofamarketgh@gmail.com). If still failing, check Firestore rules allow list with limit 50.';
                    }
                    if (msg.indexOf('index')!==-1){
                        msg += ' — Firestore index for orders+createdAt missing; fallback should have worked. Try hard refresh.';
                    }
                    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:#e74c3c;"><i class="fas fa-exclamation-triangle"></i><p>Error loading orders: ' + escapeHtml(msg) + '</p><p style="font-size:0.78rem;color:#6b7280;margin-top:0.5rem;"><button onclick="loadOrders(true)" style="background:#0064d2;color:white;border:none;padding:0.4rem 0.8rem;border-radius:6px;font-weight:600;cursor:pointer;font-size:0.8rem;"><i class="fas fa-sync"></i> Retry</button> <button onclick="location.reload()" style="background:white;border:1px solid #e5e7eb;padding:0.4rem 0.8rem;border-radius:6px;font-weight:600;cursor:pointer;font-size:0.8rem;">Reload page</button></p></td></tr>';
                });
        });
}

function updateOrderStats(total, pending, paid, completed) {
    var elTotal = document.getElementById('orderStatTotal');
    var elPending = document.getElementById('orderStatPending');
    var elPaid = document.getElementById('orderStatPaid');
    var elCompleted = document.getElementById('orderStatCompleted');

    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elPaid) elPaid.textContent = paid;
    if (elCompleted) elCompleted.textContent = completed;
}

function renderOrders(orders) {
    // Unified entry — orders is already filtered (from loadOrders or applyOrderFilters)
    var tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    // If called with a pre-filtered list (e.g., from loadOrders), treat it as the filtered set
    // Otherwise if called via applyOrderFilters, filtered cache already set — keep consistent
    window.filteredOrdersCache = orders.slice();
    window.ordersCurrentPage = window.ordersCurrentPage || 1;
    window.ordersPageSize = window.ordersPageSize || 10;
    // After setting cache, delegate to paginated renderer which handles grouping
    renderOrdersPaginated();
    if (typeof updateOrderDateInfo === 'function') updateOrderDateInfo();
}

function renderOrdersPaginated(){
    var tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    var totalO = window.filteredOrdersCache ? window.filteredOrdersCache.length : 0;
    if (totalO===0) {
        var emptyMsg = 'No orders yet';
        var searchVal = document.getElementById('orderSearch')?.value;
        var dateVal = document.getElementById('orderDateFilter')?.value;
        if (searchVal || dateVal) emptyMsg = 'No orders match your filters';
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:#5a6572;"><i class="fas fa-search" style="font-size:1.5rem;color:#ccc;"></i><p>'+emptyMsg+'</p><p style="font-size:0.75rem;color:#5f6b7a;">Try changing search or date range</p></td></tr>';
        if (typeof renderPagination === 'function') renderPagination('ordersPaginationBtns', 'ordersPaginationInfo', 0, 1, window.ordersPageSize||10, 'goToOrdersPage');
        if (typeof updateOrderDateInfo === 'function') updateOrderDateInfo();
        return;
    }
    var startO = (window.ordersCurrentPage - 1) * window.ordersPageSize;
    var pageOrders = window.filteredOrdersCache.slice(startO, startO+window.ordersPageSize);
    if (pageOrders.length===0 && window.ordersCurrentPage>1) { window.ordersCurrentPage--; startO=(window.ordersCurrentPage-1)*window.ordersPageSize; pageOrders=window.filteredOrdersCache.slice(startO, startO+window.ordersPageSize); }
    var html='';
    if (!orderGroupByDateEnabled){
        pageOrders.forEach(function(order){
            var checked = (window.selectedOrderIds && window.selectedOrderIds.has(order.id)) ? ' checked' : '';
            var date = order.createdAt ? (order.createdAt.toDate ? order.createdAt.toDate().toLocaleDateString('en-GB') : new Date(order.createdAt).toLocaleDateString('en-GB')) : '—';
            var status = order.status || 'pending';
            var statusClass = status === 'completed' ? 'success' : (status === 'paid' ? 'active' : (status === 'cancelled' ? 'cancelled' : 'pending'));
            var amount = order.total || order.amount || 0;
            html += '<tr><td style="text-align:center;"><input type="checkbox" class="order-check" value="'+order.id+'"'+checked+' onchange="toggleOrderSelection(this)"></td><td><strong>'+escapeHtml(order.id.substring(0,8))+'</strong></td><td>'+escapeHtml(order.buyerEmail||order.buyerId||'—')+'</td><td>'+escapeHtml(order.sellerName||order.sellerId||'—')+'</td><td>'+escapeHtml(order.productTitle||'—')+(order.isPreOrder===true?' <span class="preorder-badge" title="Pre-order — Sankofa Store dispatches when the stock lands'+(order.preOrderDate?' (expected '+escapeHtml(order.preOrderDate)+')':'')+'"><i class="fas fa-clock"></i> Pre-order</span>':'')+preOrderStageChipHtml(order)+'</td><td><strong>GHS '+Number(amount).toLocaleString()+'</strong></td><td><span class="status-badge '+statusClass+'">'+escapeHtml(status.charAt(0).toUpperCase()+status.slice(1))+'</span></td><td style="font-size:0.85rem;color:#5a6572;">'+escapeHtml(date)+'</td><td><div style="display:flex;gap:0.3rem;"><button class="btn btn-small" onclick="viewOrder(\''+order.id+'\')" style="padding:0.3rem 0.6rem;font-size:0.75rem;"><i class="fas fa-eye"></i> View</button>' + preOrderStageBtnHtml(order) + '<button class="btn btn-small" onclick="deleteOrder(\''+order.id+'\')" style="padding:0.3rem 0.5rem;font-size:0.75rem;background:#fee2e2;color:#991b1b;border:1px solid #fecaca;"><i class="fas fa-trash"></i></button></div></td></tr>';
        });
    } else {
        // Group pageOrders by date
        var groups = {};
        var groupOrder = [];
        pageOrders.forEach(function(order){
            var d = getOrderDateValue(order);
            var key = d ? (d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')) : 'undated';
            if (!groups[key]){ groups[key]=[]; groupOrder.push(key); }
            groups[key].push(order);
        });
        // groupOrder already in display order (desc) because pageOrders is sorted desc; keep that order
        groupOrder.forEach(function(key){
            var gOrders = groups[key];
            var firstDate = getOrderDateValue(gOrders[0]);
            var label = key==='undated' ? 'Undated' : formatOrderGroupLabel(firstDate);
            var collapsed = collapsedOrderGroups.has(key);
            var totalAmt = gOrders.reduce(function(s,o){ var a=o.total||o.amount||0; if(typeof a==='string') a=parseFloat(a.replace(/[^0-9.]/g,''))||0; return s+(Number(a)||0); },0);
            html += '<tr class="orders-group-header" data-group="'+key+'" onclick="toggleOrderGroup(\''+key+'\')" style="background:#f1f5f9;cursor:pointer;user-select:none;"><td colspan="9" style="padding:0.65rem 0.75rem;font-weight:700;font-size:0.83rem;color:#1e293b;border-top:1.5px solid #e5e7eb;border-bottom:1px solid #e5e7eb;"><div style="display:flex;align-items:center;gap:0.5rem;justify-content:space-between;"><span style="display:flex;align-items:center;gap:0.5rem;"><i class="fas fa-calendar-day" style="color:#0064d2;"></i> '+escapeHtml(label)+' <span style="background:white;border:1px solid #e5e7eb;color:#475569;padding:0.1rem 0.45rem;border-radius:999px;font-size:0.7rem;font-weight:700;">'+gOrders.length+' order'+(gOrders.length===1?'':'s')+'</span> <span style="color:#64748b;font-weight:600;font-size:0.75rem;">· GHS '+totalAmt.toLocaleString()+'</span></span><i class="fas fa-chevron-'+(collapsed?'down':'up')+' group-chevron" style="color:#64748b;font-size:0.7rem;"></i></div></td></tr>';
            gOrders.forEach(function(order){
                var checked = (window.selectedOrderIds && window.selectedOrderIds.has(order.id)) ? ' checked' : '';
                var date = order.createdAt ? (order.createdAt.toDate ? order.createdAt.toDate().toLocaleDateString('en-GB') : new Date(order.createdAt).toLocaleDateString('en-GB')) : '—';
                var status = order.status || 'pending';
                var statusClass = status === 'completed' ? 'success' : (status === 'paid' ? 'active' : (status === 'cancelled' ? 'cancelled' : 'pending'));
                var amount = order.total || order.amount || 0;
                var disp = collapsed ? ' style="display:none;"' : '';
                html += '<tr data-group="'+key+'"'+disp+'><td style="text-align:center;"><input type="checkbox" class="order-check" value="'+order.id+'"'+checked+' onchange="toggleOrderSelection(this)"></td><td><strong>'+escapeHtml(order.id.substring(0,8))+'</strong></td><td>'+escapeHtml(order.buyerEmail||order.buyerId||'—')+'</td><td>'+escapeHtml(order.sellerName||order.sellerId||'—')+'</td><td>'+escapeHtml(order.productTitle||'—')+(order.isPreOrder===true?' <span class="preorder-badge" title="Pre-order — Sankofa Store dispatches when the stock lands'+(order.preOrderDate?' (expected '+escapeHtml(order.preOrderDate)+')':'')+'"><i class="fas fa-clock"></i> Pre-order</span>':'')+preOrderStageChipHtml(order)+'</td><td><strong>GHS '+Number(amount).toLocaleString()+'</strong></td><td><span class="status-badge '+statusClass+'">'+escapeHtml(status.charAt(0).toUpperCase()+status.slice(1))+'</span></td><td style="font-size:0.85rem;color:#5a6572;">'+escapeHtml(date)+'</td><td><div style="display:flex;gap:0.3rem;"><button class="btn btn-small" onclick="viewOrder(\''+order.id+'\')" style="padding:0.3rem 0.6rem;font-size:0.75rem;"><i class="fas fa-eye"></i> View</button>' + preOrderStageBtnHtml(order) + '<button class="btn btn-small" onclick="deleteOrder(\''+order.id+'\')" style="padding:0.3rem 0.5rem;font-size:0.75rem;background:#fee2e2;color:#991b1b;border:1px solid #fecaca;"><i class="fas fa-trash"></i></button></div></td></tr>';
            });
        });
    }
    tbody.innerHTML = html;
    if (typeof renderPagination === 'function') renderPagination('ordersPaginationBtns', 'ordersPaginationInfo', totalO, window.ordersCurrentPage, window.ordersPageSize, 'goToOrdersPage');
    if (typeof updateOrdersBulkBar === 'function') updateOrdersBulkBar();
    if (typeof updateOrderDateInfo === 'function') updateOrderDateInfo();
}
function goToOrdersPage(p){ window.ordersCurrentPage=p; renderOrdersPaginated(); window.scrollTo({top: document.getElementById('section-orders').offsetTop - 80, behavior:'smooth'}); }

// Bulk delete for orders — select all / delete selected
window.selectedOrderIds = window.selectedOrderIds || new Set();
function toggleOrderSelection(cb){
    if (cb.checked) window.selectedOrderIds.add(cb.value);
    else window.selectedOrderIds.delete(cb.value);
    updateOrdersBulkBar();
    // Sync selectAll checkbox
    var all = document.querySelectorAll('#ordersTableBody .order-check');
    var selAll = document.getElementById('selectAllOrders');
    if (selAll) selAll.checked = all.length && Array.from(all).every(function(c){ return c.checked; });
}
function toggleSelectAllOrders(checked){
    var boxes = document.querySelectorAll('#ordersTableBody .order-check');
    boxes.forEach(function(cb){
        cb.checked = checked;
        if (checked) window.selectedOrderIds.add(cb.value);
        else window.selectedOrderIds.delete(cb.value);
    });
    updateOrdersBulkBar();
}
function updateOrdersBulkBar(){
    var bar = document.getElementById('ordersBulkBar');
    var cnt = document.getElementById('ordersSelectedCount');
    var n = window.selectedOrderIds.size;
    if (cnt) cnt.textContent = n;
    if (bar) bar.style.display = n>0 ? 'flex' : 'none';
    // Update selectAll state
    var selAll = document.getElementById('selectAllOrders');
    if (selAll) {
        var all = document.querySelectorAll('#ordersTableBody .order-check');
        selAll.checked = all.length>0 && Array.from(all).every(function(c){ return c.checked; });
        selAll.indeterminate = n>0 && n < all.length;
    }
}
function clearOrderSelection(){
    window.selectedOrderIds.clear();
    document.querySelectorAll('#ordersTableBody .order-check').forEach(function(cb){ cb.checked=false; });
    var selAll = document.getElementById('selectAllOrders');
    if (selAll) { selAll.checked=false; selAll.indeterminate=false; }
    updateOrdersBulkBar();
}
function deleteSelectedOrders(){
    var ids = Array.from(window.selectedOrderIds);
    if (!ids.length) { showFlashMessage('No orders selected','warning'); return; }
    if (!confirm('Delete '+ids.length+' order(s)? This cannot be undone.\n\n'+ids.slice(0,5).map(function(id){ return id.substring(0,8); }).join(', ')+(ids.length>5?' +'+(ids.length-5)+' more':''))) return;
    if (typeof firebaseDB === 'undefined' || !firebaseDB) { alert('Firebase not connected'); return; }
    if (typeof firebaseAuth === 'undefined' || !firebaseAuth.currentUser) { alert('Sign in as admin'); return; }
    firebaseDB.collection('users').doc(firebaseAuth.currentUser.uid).get().then(function(doc){
        var d = doc.exists ? doc.data() : {};
        if (d.role !== 'admin') { alert('Only admin can delete orders'); return; }
        var batch = firebaseDB.batch();
        ids.forEach(function(id){ batch.delete(firebaseDB.collection('orders').doc(id)); });
        return batch.commit();
    }).then(function(){
        showFlashMessage('Deleted '+ids.length+' order(s) ✓','success');
        window.selectedOrderIds.clear();
        updateOrdersBulkBar();
        loadOrders();
        loadNavCounts();
        if (typeof loadOverviewRevenue === 'function') { _overviewRevenueCache.orders=null; loadOverviewRevenue(); }
    }).catch(function(err){
        alert('Error deleting: '+err.message);
    });
}
// Clear selection when changing page/search
var _origRenderOrdersPaginated = window.renderOrdersPaginated;

// ============================================================================
// PAGINATION & SKELETON & OVERVIEW HELPERS (Added Phase 1)
// ============================================================================
// ============================================================================
// OVERVIEW DASHBOARD — Correct live data (replaces phase-1 stubs)
// Populates Revenue, Total Orders, Active Listings, Registered Users + recent tables
// ============================================================================
var _overviewRevenueCache = {orders: null, products: null};
var _overviewLoaded = false;

function loadAnalytics(){
    // Called from initAdminDashboard; wrapper for overview + analytics sections
    try { loadOverviewData(); } catch(e){ console.warn('loadOverviewData', e); }
    try { loadAnalyticsSection(); } catch(e){ console.warn('loadAnalyticsSection', e); }
}
function loadAnalyticsSection(){
    // Analytics cards (Daily Active Users etc) — lightweight demo if no functions
    // Real analytics via Firestore analytics collection or getSearchAnalytics function
    // Keep placeholder but fill with overview-derived data where possible
    var dauCard = document.getElementById('analyticsDAU');
    if (dauCard) {
        // leave as is; exhaustive analytics handled by functions if present
    }
    // Ensure overview sub-sections refresh even when analytics tab not active
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    // Conversion / AOV already handled in loadOverviewData if needed
}

function loadOverviewData(){
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    // Prevent double-load on same page unless forced
    // Always refresh cards so badges stay correct after deletes
    loadOverviewRevenue();
    loadOverviewCounts();
    loadOverviewRecent();
    loadRecentUsers();
    loadRevenueTrend();
    loadCategoryOverview();
    _overviewLoaded = true;
}
function loadOverviewCounts(){
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    // Total Orders
    firebaseDB.collection('orders').get().then(function(snap){
        var el = document.getElementById('overviewTotalOrders');
        if (el) el.textContent = snap.size;
        var ch = document.getElementById('overviewOrdersChange');
        if (ch) ch.textContent = snap.size ? snap.size + ' orders total' : '—';
        // keep nav badge in sync
        if (typeof updateCount === 'function') updateCount('countOrders', snap.size);
    }).catch(function(){});
    // Active Listings
    firebaseDB.collection('products').get().then(function(snap){
        var active = 0;
        snap.forEach(function(d){
            var pd = d.data();
            var isActive = pd.isActive !== false;
            var isSold = pd.isSold === true;
            var isFlagged = pd.isFlagged === true;
            if (isActive && !isSold && !isFlagged) active++;
        });
        var el = document.getElementById('overviewActiveListings');
        if (el) el.textContent = active;
        var ch = document.getElementById('overviewListingsChange');
        if (ch) ch.textContent = snap.size ? active + ' active / ' + snap.size + ' total' : '—';
        if (typeof updateCount === 'function') updateCount('countProducts', snap.size);
    }).catch(function(){});
    // Registered Users (non-admin)
    firebaseDB.collection('users').get().then(function(snap){
        var total = 0, nonAdmin = 0;
        snap.forEach(function(d){
            total++;
            if (d.data().role !== 'admin') nonAdmin++;
        });
        var el = document.getElementById('overviewTotalUsers');
        if (el) el.textContent = nonAdmin;
        var ch = document.getElementById('overviewUsersChange');
        if (ch) ch.textContent = nonAdmin ? nonAdmin + ' users • ' + total + ' incl. admins' : '—';
        if (typeof updateCount === 'function') updateCount('countUsers', nonAdmin);
    }).catch(function(){});
}

// ---- Commissions card (pure logic, kept DOM-free so it can be unit-tested) ----
// One honest number for the platform owner: how much fee was kept from each order.
// commissionAmount is stamped server-side at release; fallbacks cover older shapes.
function commissionOfOrder(od){
    var c = od.commissionAmount;
    if (c == null){
        var t = Number(od.total || od.amount || 0) || 0;
        if (od.sellerPayout != null) c = t - (Number(od.sellerPayout) || 0);
        else if (od.commission != null) c = t * (Number(od.commission) || 0) / 100;
        else c = 0;
    }
    c = Number(c) || 0;
    return c > 0 ? Math.round(c * 100) / 100 : 0;
}
// Buckets: today / this month / all time (escrow RELEASED = earned), plus pending escrow.
// Multi-seller parents (isMultiSeller === true) are skipped because their commission is
// the SUM of their child orders, which are separate docs — counting both would double it.
function computeCommissions(orders, now){
    var startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    var out = { today: 0, month: 0, all: 0, pending: 0, sales: 0 };
    (orders || []).forEach(function(od){
        if (!od || od.isMultiSeller === true) return;
        var c = commissionOfOrder(od);
        if (od.escrowReleased === true){
            out.all += c; out.sales++;
            var t = od.escrowReleasedAt || od.updatedAt || od.paidAt || od.createdAt;
            var d = t && t.toDate ? t.toDate() : (t ? new Date(t) : null);
            if (d && !isNaN(d)){
                if (d >= startToday) out.today += c;
                if (d >= startMonth) out.month += c;
            }
        } else {
            var st = String(od.status || '').toLowerCase();
            var paid = od.paymentStatus === 'paid' || od.walletPaid === true || od.paidViaServer === true
                    || st === 'paid' || st === 'shipped' || st === 'delivered';
            if (paid && st !== 'cancelled' && st !== 'refunded') out.pending += c;
        }
    });
    ['today','month','all','pending'].forEach(function(k){ out[k] = Math.round(out[k] * 100) / 100; });
    return out;
}
function renderCommissions(orders){
    if (typeof document === 'undefined') return;
    var elT = document.getElementById('commToday');
    if (!elT) return;
    var r = computeCommissions(orders, new Date());
    var fmt = function(v){ return 'GHS ' + v.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}); };
    elT.textContent = fmt(r.today);
    var elM = document.getElementById('commMonth'); if (elM) elM.textContent = fmt(r.month);
    var elA = document.getElementById('commAllTime'); if (elA) elA.textContent = fmt(r.all);
    var sub = document.getElementById('commSub');
    if (sub){
        var line = r.sales ? 'from ' + r.sales + ' completed sale' + (r.sales === 1 ? '' : 's') : 'no completed sales yet';
        if (r.pending > 0) line += ' • ' + fmt(r.pending) + ' more in escrow — yours when deliveries confirm';
        sub.textContent = line;
    }
}

function loadOverviewRevenue(){
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    firebaseDB.collection('orders').get().then(function(snap){
        var total = 0;
        var orderRows = [];
        snap.forEach(function(d){
            var od = d.data();
            orderRows.push(od);
            // exclude cancelled
            if (od.status === 'cancelled' || od.status === 'refunded') return;
            var amt = od.total || od.amount || od.price || od.grandTotal || 0;
            if (typeof amt === 'string') amt = parseFloat(amt.replace(/[^0-9.]/g,''))||0;
            total += Number(amt)||0;
        });
        try { renderCommissions(orderRows); } catch(e){ console.warn('renderCommissions', e); }
        _overviewRevenueCache.orders = total;
        var revEl = document.getElementById('overviewRevenue');
        if (revEl) revEl.textContent = 'GHS ' + total.toLocaleString();
        var revCh = document.getElementById('overviewRevenueChange');
        if (revCh) revCh.textContent = snap.size>0 ? 'from ' + snap.size + ' orders' : '—';
        // also update analytics AOV if present
        var aovEl = document.getElementById('analyticsAOV');
        if (aovEl) aovEl.textContent = snap.size ? 'GHS ' + Math.round(total / snap.size).toLocaleString() : 'GHS 0';
        var convEl = document.getElementById('analyticsConversion');
        if (convEl) {
            // conversion = completed / total *100
            var completed = 0;
            snap.forEach(function(d){ if ((d.data().status||'').toLowerCase()==='completed') completed++; });
            convEl.textContent = snap.size ? Math.round((completed/snap.size)*100) + '%' : '0%';
        }
    }).catch(function(){});
}
function loadOverviewRecent(){
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    var tbody = document.querySelector('#section-overview .admin-table tbody');
    if (!tbody) return;
    // show skeleton while loading
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.2rem;color:#5a6572;"><i class="fas fa-spinner fa-spin"></i> Loading recent orders...</td></tr>';
    firebaseDB.collection('orders').orderBy('createdAt','desc').limit(5).get().then(function(snap){
        if (snap.empty){
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#5a6572;"><i class="fas fa-inbox" style="font-size:1.5rem;color:#ccc;"></i><p>No recent orders yet</p></td></tr>';
            return;
        }
        var html = '';
        snap.forEach(function(doc){
            var o = doc.data(); o.id = doc.id;
            var amt = o.total || o.amount || 0;
            var date = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate().toLocaleDateString('en-GB') : new Date(o.createdAt).toLocaleDateString('en-GB')) : '—';
            var st = (o.status||'pending'); var cls = st==='completed'?'success':st==='paid'?'info':st==='cancelled'?'danger':'pending';
            html += '<tr><td><strong>'+escapeHtml(o.id.substring(0,8))+'</strong></td><td>'+escapeHtml(o.buyerEmail||o.buyerId||'—')+'</td><td>'+escapeHtml(o.sellerName||o.sellerId||'—')+'</td><td>GHS '+Number(amt).toLocaleString()+'</td><td><span class="status-badge '+cls+'">'+escapeHtml(st.charAt(0).toUpperCase()+st.slice(1))+'</span></td><td>'+escapeHtml(date)+'</td></tr>';
        });
        tbody.innerHTML = html;
    }).catch(function(){
        // fallback without orderBy (if missing index)
        firebaseDB.collection('orders').limit(5).get().then(function(snap){
            if (snap.empty) return;
            var arr=[]; snap.forEach(function(d){ arr.push({id:d.id, data:d.data()}); });
            arr.sort(function(a,b){
                var ta = a.data.createdAt ? (a.data.createdAt.toMillis? a.data.createdAt.toMillis(): new Date(a.data.createdAt).getTime()) : 0;
                var tb = b.data.createdAt ? (b.data.createdAt.toMillis? b.data.createdAt.toMillis(): new Date(b.data.createdAt).getTime()) : 0;
                return tb-ta;
            });
            var html='';
            arr.slice(0,5).forEach(function(x){
                var o=x.data; o.id=x.id;
                var amt=o.total||o.amount||0;
                var date=o.createdAt ? (o.createdAt.toDate? o.createdAt.toDate().toLocaleDateString('en-GB'): new Date(o.createdAt).toLocaleDateString('en-GB')) : '—';
                var st=(o.status||'pending'); var cls=st==='completed'?'success':st==='paid'?'info':st==='cancelled'?'danger':'pending';
                html += '<tr><td><strong>'+escapeHtml(o.id.substring(0,8))+'</strong></td><td>'+escapeHtml(o.buyerEmail||o.buyerId||'—')+'</td><td>'+escapeHtml(o.sellerName||o.sellerId||'—')+'</td><td>GHS '+Number(amt).toLocaleString()+'</td><td><span class="status-badge '+cls+'">'+escapeHtml(st.charAt(0).toUpperCase()+st.slice(1))+'</span></td><td>'+escapeHtml(date)+'</td></tr>';
            });
            if (html) tbody.innerHTML = html;
        }).catch(function(){});
    });
}
function loadRecentUsers(){
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    var container = document.querySelector('#section-overview .user-list');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:#5a6572;"><i class="fas fa-spinner fa-spin"></i> Loading users...</div>';
    firebaseDB.collection('users').orderBy('createdAt','desc').limit(5).get().then(function(snap){
        if (snap.empty){
            container.innerHTML = '<div style="text-align:center;padding:2rem;color:#5a6572;"><i class="fas fa-users" style="font-size:2rem;color:#ccc;margin-bottom:0.5rem;"></i><p>No recent users</p></div>';
            return;
        }
        var html='';
        snap.forEach(function(doc){
            var u=doc.data(); u.id=doc.id;
            if (u.role==='admin') return;
            var name = u.name || (u.firstName ? (u.firstName+' '+(u.lastName||'')) : (u.email||'User'));
            var email = u.email||'—';
            var date = u.createdAt ? (u.createdAt.toDate? u.createdAt.toDate().toLocaleDateString('en-GB'): new Date(u.createdAt).toLocaleDateString('en-GB')) : '—';
            var initial = (name||'U').charAt(0).toUpperCase();
            var photo = u.photoURL ? '<img src="'+u.photoURL+'" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">' : '<div style="width:36px;height:36px;border-radius:50%;background:#0064d2;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;">'+initial+'</div>';
            html += '<div class="user-item" style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0;border-bottom:1px solid #f1f5f9;">'+photo+'<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escapeHtml(name)+'</div><div style="font-size:0.72rem;color:#5a6572;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escapeHtml(email)+'</div></div><div style="font-size:0.68rem;color:#5f6b7a;text-align:right;">'+escapeHtml(date)+'</div></div>';
        });
        if (!html) html = '<div style="text-align:center;padding:1.5rem;color:#5a6572;"><p>No recent non-admin users</p></div>';
        container.innerHTML = html;
    }).catch(function(){
        firebaseDB.collection('users').limit(5).get().then(function(snap){
            var arr=[]; snap.forEach(function(d){ arr.push({id:d.id, data:d.data()}); });
            arr.sort(function(a,b){
                var ta = a.data.createdAt ? (a.data.createdAt.toMillis? a.data.createdAt.toMillis(): new Date(a.data.createdAt).getTime()) : 0;
                var tb = b.data.createdAt ? (b.data.createdAt.toMillis? b.data.createdAt.toMillis(): new Date(b.data.createdAt).getTime()) : 0;
                return tb-ta;
            });
            var html='';
            arr.slice(0,5).forEach(function(x){
                var u=x.data;
                if (u.role==='admin') return;
                var name = u.name || (u.firstName ? (u.firstName+' '+(u.lastName||'')) : (u.email||'User'));
                var email = u.email||'—';
                var date = u.createdAt ? (u.createdAt.toDate? u.createdAt.toDate().toLocaleDateString('en-GB'): new Date(u.createdAt).toLocaleDateString('en-GB')) : '—';
                var initial=(name||'U').charAt(0).toUpperCase();
                var photo = u.photoURL ? '<img src="'+u.photoURL+'" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">' : '<div style="width:36px;height:36px;border-radius:50%;background:#0064d2;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;">'+initial+'</div>';
                html += '<div class="user-item" style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0;border-bottom:1px solid #f1f5f9;">'+photo+'<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:0.85rem;">'+escapeHtml(name)+'</div><div style="font-size:0.72rem;color:#5a6572;">'+escapeHtml(email)+'</div></div><div style="font-size:0.68rem;color:#5f6b7a;">'+escapeHtml(date)+'</div></div>';
            });
            if (html) container.innerHTML = html;
        }).catch(function(){ container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:#5a6572;"><p>Could not load users</p></div>'; });
    });
}
function loadRevenueTrend(){
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    var bars = document.querySelectorAll('#section-overview .chart-bars .bar');
    var labels = document.querySelectorAll('#section-overview .chart-bars .bar-group span');
    if (!bars.length) return;
    // Fetch orders from last 8 months and bucket by month
    firebaseDB.collection('orders').get().then(function(snap){
        var now = new Date();
        var buckets = [];
        var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        for (var i=7;i>=0;i--){
            var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
            buckets.push({ y:d.getFullYear(), m:d.getMonth(), label: monthNames[d.getMonth()], total:0, count:0 });
        }
        snap.forEach(function(doc){
            var od = doc.data();
            if (od.status==='cancelled') return;
            var amt = od.total || od.amount || od.price || 0;
            if (typeof amt==='string') amt=parseFloat(amt.replace(/[^0-9.]/g,''))||0;
            amt=Number(amt)||0;
            var dt = od.createdAt ? (od.createdAt.toDate ? od.createdAt.toDate() : new Date(od.createdAt)) : null;
            if (!dt || isNaN(dt.getTime())) return;
            for (var b=0;b<buckets.length;b++){
                if (dt.getFullYear()===buckets[b].y && dt.getMonth()===buckets[b].m){
                    buckets[b].total += amt;
                    buckets[b].count++;
                    break;
                }
            }
        });
        var max = Math.max.apply(null, buckets.map(function(b){ return b.total; })) || 1;
        bars.forEach(function(bar, idx){
            if (idx>=buckets.length) return;
            var h = Math.round((buckets[idx].total / max)*100);
            if (h<6 && buckets[idx].total>0) h=6;
            bar.style.height = h + '%';
            bar.title = buckets[idx].label + ': GHS ' + buckets[idx].total.toLocaleString() + ' ('+buckets[idx].count+' orders)';
        });
        labels.forEach(function(lbl, idx){
            if (idx<buckets.length) lbl.textContent = buckets[idx].label;
        });
        // Also update analytics DAU bars if present
        var anaBars = document.querySelectorAll('#analyticsDAU .chart-bars .bar');
        if (anaBars.length){
            var maxC = Math.max.apply(null, buckets.map(function(b){return b.count;}))||1;
            anaBars.forEach(function(bar, idx){
                if (idx>=buckets.length) return;
                var h2 = Math.round((buckets[idx].count / maxC)*100);
                if (h2<8 && buckets[idx].count>0) h2=8;
                bar.style.height = h2+'%';
                bar.title = buckets[idx].label+': '+buckets[idx].count+' orders';
            });
        }
    }).catch(function(){});
}
function loadCategoryOverview(){
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    var catStats = document.querySelectorAll('#section-overview .category-stats .cat-stat');
    if (!catStats.length) return;
    firebaseDB.collection('products').get().then(function(snap){
        var counts = {};
        var totalActive = 0;
        snap.forEach(function(doc){
            var pd = doc.data();
            if (pd.isActive===false || pd.isSold===true) return;
            var cat = (pd.category||'others').toLowerCase();
            counts[cat] = (counts[cat]||0)+1;
            totalActive++;
        });
        if (totalActive===0) return;
        // Map display categories (Electronics, Fashion, Home & Garden, Vehicles, Others)
        var mapping = [
            { keys:['electronics'], label:'Electronics' },
            { keys:['fashion'], label:'Fashion' },
            { keys:['home-garden','home'], label:'Home & Garden' },
            { keys:['vehicles'], label:'Vehicles' },
            { keys:['others'], label:'Others' }
        ];
        // Compute what's already mapped vs remainder for Others
        var mappedKeys = [];
        mapping.slice(0,4).forEach(function(m){ mappedKeys = mappedKeys.concat(m.keys); });
        // Fill each cat-stat
        catStats.forEach(function(row, idx){
            if (idx>=mapping.length) return;
            var m = mapping[idx];
            var cnt = 0;
            if (m.label==='Others'){
                // Others = everything not in mappedKeys
                Object.keys(counts).forEach(function(k){
                    if (mappedKeys.indexOf(k)===-1) cnt += counts[k];
                });
            } else {
                m.keys.forEach(function(k){ cnt += counts[k]||0; });
            }
            var pct = Math.round((cnt / totalActive)*100);
            var bar = row.querySelector('.cat-fill');
            var pctEl = row.querySelector('span:last-child');
            if (bar) bar.style.width = pct + '%';
            if (pctEl) pctEl.textContent = pct + '%';
            // update tooltip
            row.title = m.label+': '+cnt+' of '+totalActive;
        });
    }).catch(function(){});
}

// ============================================================================
// WALLETS ADMIN — view all users wallet balances
// ============================================================================
let adminWalletsCache = [];
let adminWalletsFiltered = [];
let walletsCurrentPage = 1;
let walletsPageSize = 15;

var adminOrphanWallets = [];

/** Tiny reusable info modal for the admin panel. */
function showAdminModal(title, bodyHtml) {
    var existing = document.getElementById('adminInfoModal');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.id = 'adminInfoModal';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    el.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:640px;width:100%;max-height:85vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,0.25);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb;">' +
        '<h3 style="margin:0;font-size:1.05rem;">' + title + '</h3>' +
        '<button onclick="document.getElementById(\'adminInfoModal\').remove()" style="border:none;background:#f1f5f9;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1rem;">&times;</button></div>' +
        '<div style="padding:1rem 1.25rem;">' + bodyHtml + '</div></div>';
    el.addEventListener('click', function (e) { if (e.target === el) el.remove(); });
    document.body.appendChild(el);
}

/**
 * Small bar above the wallets table telling the admin how many old wallet records
 * belong to accounts that no longer exist, with a one-click cleanup.
 */
function renderOrphanWalletsNotice() {
    var host = document.getElementById('walletsOrphanNotice');
    if (!host) {
        var table = document.getElementById('walletsTableBody');
        if (!table) return;
        var wrap = table.closest('.table-container') || table.parentNode;
        if (!wrap || !wrap.parentNode) return;
        host = document.createElement('div');
        host.id = 'walletsOrphanNotice';
        host.style.cssText = 'margin:0.75rem 0 0.5rem;';
        wrap.parentNode.insertBefore(host, wrap);
    }
    if (!adminOrphanWallets.length) { host.innerHTML = ''; return; }
    var money = adminOrphanWallets.reduce(function (sum, w) { return sum + (w.balance || 0); }, 0);
    host.innerHTML =
        '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.6rem;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:0.7rem 0.9rem;">' +
            '<i class="fas fa-broom" style="color:#d97706;"></i>' +
            '<span style="font-size:0.85rem;color:#92400e;">' +
                '<strong>' + adminOrphanWallets.length + '</strong> old wallet record' + (adminOrphanWallets.length === 1 ? '' : 's') +
                ' belong to accounts that no longer exist' +
                (money ? ' (holding GHS ' + money.toLocaleString() + ')' : ' (all empty)') + '. ' +
                'They are hidden from the list and totals below.' +
            '</span>' +
            '<button onclick="cleanupOrphanWallets()" style="background:#d97706;color:#fff;border:none;padding:0.4rem 0.8rem;border-radius:6px;font-weight:700;font-size:0.8rem;cursor:pointer;">Clean up</button>' +
            '<button onclick="showOrphanWallets()" style="background:#fff;border:1px solid #fed7aa;color:#92400e;padding:0.4rem 0.8rem;border-radius:6px;font-weight:600;font-size:0.8rem;cursor:pointer;">Show them</button>' +
        '</div>';
}

function showOrphanWallets() {
    var rows = adminOrphanWallets.map(function (w) {
        return '<tr><td style="font-family:monospace;font-size:0.78rem;">' + escapeHtml(w.walletId) + '</td>' +
               '<td>GHS ' + Number(w.balance || 0).toLocaleString() + '</td>' +
               '<td style="color:#9ca3af;">no account</td></tr>';
    }).join('');
    showAdminModal('Old wallet records (no account)',
        '<p style="font-size:0.85rem;color:#5a6572;margin-top:0;">These wallets cannot be used: the account they belonged to was deleted.</p>' +
        '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;"><thead><tr>' +
        '<th style="text-align:left;padding:0.4rem;border-bottom:1px solid #e5e7eb;">Wallet</th>' +
        '<th style="text-align:left;padding:0.4rem;border-bottom:1px solid #e5e7eb;">Balance</th>' +
        '<th style="text-align:left;padding:0.4rem;border-bottom:1px solid #e5e7eb;">Owner</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>');
}

function cleanupOrphanWallets() {
    if (!adminOrphanWallets.length) return;
    if (!confirm('Delete ' + adminOrphanWallets.length + ' old wallet record(s)?\n\nThey belong to accounts that no longer exist. This only removes the leftover wallet documents.')) return;
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    var batch = firebaseDB.batch();
    adminOrphanWallets.forEach(function (w) { batch.delete(firebaseDB.collection('wallets').doc(w.walletId)); });
    batch.commit().then(function () {
        showFlashMessage('Removed ' + adminOrphanWallets.length + ' old wallet records', 'success');
        adminOrphanWallets = [];
        loadAdminWallets(true);
        if (typeof loadNavCounts === 'function') loadNavCounts();
    }).catch(function (err) {
        showFlashMessage('Could not clean up: ' + err.message, 'error');
    });
}

function loadAdminWallets(forceServer){
    const tbody=document.getElementById('walletsTableBody');
    if(!tbody) return;
    if(typeof firebaseDB==='undefined' || !firebaseDB){
        tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:#5a6572;">Firebase not ready — retrying...</td></tr>';
        setTimeout(()=>loadAdminWallets(forceServer), 900);
        return;
    }
    if(typeof showTableSkeleton==='function') try{ showTableSkeleton('walletsTableBody', 8, 5); }catch(e){}
    const opts = forceServer ? {source:'server'} : {};
    let walletTimeout = setTimeout(function(){
        const tb=document.getElementById('walletsTableBody');
        if(tb && tb.innerHTML.includes('skeleton')){
            tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:#f59e0b;"><i class="fas fa-spinner fa-spin"></i> Still loading wallets — slow connection? <br><button onclick="loadAdminWallets(true)" style="margin-top:0.6rem;background:#0064d2;color:#fff;border:none;padding:0.5rem 0.9rem;border-radius:6px;cursor:pointer;font-weight:700;">Retry now (server)</button></td></tr>';
        }
    }, 6000);
    // Fetch wallets + users separately so one failure doesn't block other, with 12s overall timeout
    const walletsP = firebaseDB.collection('wallets').get(opts).catch(function(e){ console.warn('wallets get failed', e); return { empty:true, forEach:function(){}, docs:[], size:0 }; });
    const usersP = firebaseDB.collection('users').get(opts).catch(function(e){ console.warn('users get failed', e); return { empty:true, forEach:function(){}, docs:[], size:0 }; });
    Promise.all([walletsP, usersP]).then(function(results){
        clearTimeout(walletTimeout);
        const snapWallets = results[0];
        const snapUsers = results[1];
        // If both empty and we suspect permission/offline, try server source once
        if(snapWallets.empty && snapUsers.empty && !forceServer){
            console.warn('loadAdminWallets empty both, retry server');
            setTimeout(()=>loadAdminWallets(true), 1200);
        }
        const usersById={};
        try{ snapUsers.forEach(d=>{ usersById[d.id]=d.data(); }); }catch(e){}
        adminWalletsCache=[];
        let totalBal=0, totalTopups=0;
        adminOrphanWallets = [];
        try{ snapWallets.forEach(d=>{
            const w=d.data();
            const walletOwner = w.userId || d.id;
            const u = usersById[walletOwner];
            // A wallet with no matching account is a leftover (the account was deleted).
            // It is NOT a wallet holder — keep it out of the list and the totals.
            if (!u) {
                adminOrphanWallets.push({ walletId: d.id, userId: walletOwner, balance: w.balance||0,
                                          createdAt: w.createdAt||null, currency: w.currency||'GHS' });
                return;
            }
            adminWalletsCache.push({
                walletId: d.id,
                userId: walletOwner,
                balance: w.balance||0,
                totalTopups: w.totalTopups||0,
                totalSpent: w.totalSpent||0,
                totalEarnings: w.totalEarnings||0,
                updatedAt: w.updatedAt||w.createdAt||null,
                email: u.email||w.email||'',
                name: u.name || (u.firstName ? (u.firstName+' '+(u.lastName||'')) : (u.email||walletOwner)),
                photoURL: u.photoURL||'',
                role: u.role||''
            });
            totalBal+=(w.balance||0);
            totalTopups+=(w.totalTopups||0);
        }); }catch(e){ console.warn('wallet parse', e); }
        renderOrphanWalletsNotice();
        // Include users without wallet as 0 balance — only if we got users
        if(snapUsers && snapUsers.size>0){
            snapUsers.forEach(d=>{
                const uid=d.id;
                if(!adminWalletsCache.find(x=>x.userId===uid)){
                    const u=d.data();
                    if(u.role==='admin') return;
                    adminWalletsCache.push({
                        walletId: uid,
                        userId: uid,
                        balance: 0,
                        totalTopups: 0,
                        totalSpent: 0,
                        totalEarnings: 0,
                        updatedAt: null,
                        email: u.email||'',
                        name: u.name || (u.firstName ? (u.firstName+' '+(u.lastName||'')) : (u.email||uid)),
                        photoURL: u.photoURL||'',
                        role: u.role||'',
                        _noWallet: true
                    });
                }
            });
        }
        // If still empty, show helpful message not infinite skeleton
        if(adminWalletsCache.length===0){
            tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:2rem;color:#5f6b7a;"><i class="fas fa-wallet" style="font-size:1.5rem;"></i><p>No wallets yet</p><p style="font-size:0.78rem;margin-top:0.3rem;">Wallets are created automatically when users sign up or top up. <br>If you expect wallets, click Retry (server).</p><button onclick="loadAdminWallets(true)" style="margin-top:0.6rem;background:#0064d2;color:#fff;border:none;padding:0.5rem 0.9rem;border-radius:6px;cursor:pointer;font-weight:700;">Retry</button></td></tr>';
            updateCount('countWallets', 0);
            const elTotal=document.getElementById('walletStatTotal'); if(elTotal) elTotal.textContent='GHS 0.00';
            const elAvg=document.getElementById('walletStatAvg'); if(elAvg) elAvg.textContent='GHS 0.00';
            const elTop=document.getElementById('walletStatTopups'); if(elTop) elTop.textContent='GHS 0';
            const elHold=document.getElementById('walletStatHolders'); if(elHold) elHold.textContent='0';
            return;
        }
        // Sort by balance desc
        adminWalletsCache.sort((a,b)=> (b.balance||0)-(a.balance||0));
        // Update stats
        const avg = adminWalletsCache.length ? totalBal/adminWalletsCache.length : 0;
        const elTotal=document.getElementById('walletStatTotal'); if(elTotal) elTotal.textContent='GHS '+totalBal.toLocaleString(undefined,{minimumFractionDigits:2});
        const elAvg=document.getElementById('walletStatAvg'); if(elAvg) elAvg.textContent='GHS '+avg.toLocaleString(undefined,{minimumFractionDigits:2});
        const elTop=document.getElementById('walletStatTopups'); if(elTop) elTop.textContent='GHS '+totalTopups.toLocaleString();
        const elHold=document.getElementById('walletStatHolders'); if(elHold) elHold.textContent=adminWalletsCache.length.toString();
        updateCount('countWallets', adminWalletsCache.length);
        // Apply search filter
        applyWalletSearch();
    }).catch(function(err){
        clearTimeout(walletTimeout);
        console.error('loadAdminWallets', err);
        const tb=document.getElementById('walletsTableBody');
        if(tb) tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:#e74c3c;"><i class="fas fa-exclamation-triangle"></i> Error: '+(err.message||String(err))+'<br><small style="color:#6b7280;">If you see “Missing or insufficient permissions”, ensure you are logged in as admin (sankofamarketgh@gmail.com) and reload.</small><br><button onclick="loadAdminWallets(true)" style="margin-top:0.6rem;background:#0064d2;color:#fff;border:none;padding:0.5rem 0.9rem;border-radius:6px;cursor:pointer;font-weight:700;">Retry (server)</button> <button onclick="location.reload()" style="margin-top:0.6rem;background:#fff;border:1px solid #e5e7eb;padding:0.5rem 0.9rem;border-radius:6px;cursor:pointer;font-weight:600;margin-left:0.4rem;">Reload page</button></td></tr>';
    });
}

function applyWalletSearch(){
    const q=(document.getElementById('walletSearch')?.value||'').toLowerCase().trim();
    if(!q) adminWalletsFiltered=adminWalletsCache.slice();
    else adminWalletsFiltered=adminWalletsCache.filter(w=> (w.name||'').toLowerCase().includes(q) || (w.email||'').toLowerCase().includes(q) || (w.userId||'').toLowerCase().includes(q));
    walletsCurrentPage=1;
    renderAdminWallets();
}

function renderAdminWallets(){
    const tbody=document.getElementById('walletsTableBody');
    if(!tbody) return;
    const total=adminWalletsFiltered.length;
    if(total===0){
        tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:2rem;color:#5a6572;"><i class="fas fa-wallet" style="font-size:1.5rem;color:#cbd5e1;"></i><p>No wallets found</p></td></tr>';
        renderPagination('walletsPaginationBtns','walletsPaginationInfo',0,1,walletsPageSize,'goToWalletsPage');
        return;
    }
    const start=(walletsCurrentPage-1)*walletsPageSize;
    const page=adminWalletsFiltered.slice(start, start+walletsPageSize);
    let html='';
    page.forEach(function(w){
        const name=w.name||w.email||w.userId;
        const initial=(name||'U').charAt(0).toUpperCase();
        const avatar=w.photoURL?`<img src="${w.photoURL}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`:`<div style="width:32px;height:32px;border-radius:50%;background:#0064d2;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;">${initial}</div>`;
        const balColor=w.balance>0?'#15803d':(w.balance<0?'#dc2626':'#6b7280');
        const when=w.updatedAt ? (w.updatedAt.toDate ? w.updatedAt.toDate().toLocaleDateString('en-GB') : new Date(w.updatedAt).toLocaleDateString('en-GB')) : (w._noWallet?'No wallet':'—');
        const balText='GHS '+Number(w.balance||0).toLocaleString(undefined,{minimumFractionDigits:2});
        html+=`<tr>
            <td><div style="display:flex;align-items:center;gap:0.6rem;">${avatar}<div><div style="font-weight:700;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;">${escapeHtml(name)}</div><div style="font-size:0.65rem;color:#6b7280;">${escapeHtml(w.userId.substring(0,8))} ${w.role==='admin'?'• admin':''}</div></div></div></td>
            <td style="font-size:0.82rem;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(w.email||'—')}</td>
            <td style="text-align:right;font-weight:800;color:${balColor};">${balText}${w._noWallet?' <span style="font-size:0.6rem;color:#f59e0b;">• new</span>':''}</td>
            <td style="text-align:right;">GHS ${Number(w.totalTopups||0).toLocaleString()}</td>
            <td style="text-align:right;">GHS ${Number(w.totalSpent||0).toLocaleString()}</td>
            <td style="text-align:right;">GHS ${Number(w.totalEarnings||0).toLocaleString()}</td>
            <td style="font-size:0.75rem;color:#6b7280;">${when}</td>
            <td><div style="display:flex;gap:0.3rem;"><button onclick="viewWalletTransactions('${w.userId}', '${escapeHtml(name).replace(/'/g, "\'")}')" style="background:#fff;border:1px solid #e5e7eb;color:#374151;padding:0.3rem 0.5rem;border-radius:6px;font-size:0.7rem;cursor:pointer;"><i class="fas fa-list"></i> Tx</button><button onclick="adjustWalletBalance('${w.userId}')" style="background:#f0f7ff;border:1px solid #bfdbfe;color:#0064d2;padding:0.3rem 0.5rem;border-radius:6px;font-size:0.7rem;cursor:pointer;"><i class="fas fa-plus-minus"></i> Adjust</button></div></td>
        </tr>`;
    });
    tbody.innerHTML=html;
    renderPagination('walletsPaginationBtns','walletsPaginationInfo',total,walletsCurrentPage,walletsPageSize,'goToWalletsPage');
}

function goToWalletsPage(p){ walletsCurrentPage=p; renderAdminWallets(); window.scrollTo({top: document.getElementById('section-wallets').offsetTop - 80, behavior:'smooth'}); }

function viewWalletTransactions(userId, name){
    const modal=document.getElementById('walletTxModal');
    const list=document.getElementById('walletTxModalList');
    const title=document.getElementById('walletTxModalTitle');
    if(title) title.innerHTML='<i class="fas fa-list"></i> Transactions — '+escapeHtml(name);
    if(list) list.innerHTML='<div style="text-align:center;padding:1.5rem;color:#5a6572;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    if(modal){ modal.style.display='flex'; }
    firebaseDB.collection('walletTransactions').where('userId','==',userId).orderBy('createdAt','desc').limit(30).get().then(function(snap){
        if(snap.empty){ list.innerHTML='<div style="text-align:center;padding:1.5rem;color:#5f6b7a;">No transactions</div>'; return; }
        let h='';
        snap.forEach(function(doc){
            const tx=doc.data();
            const at=tx.createdAt ? (tx.createdAt.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt)) : new Date();
            let when=''; try{ when=at.toLocaleDateString('en-GB')+' '+at.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }catch(e){}
            const isCredit=tx.amount>0;
            const col=isCredit?'#15803d':'#dc2626';
            const sign=isCredit?'+':'';
            h+=`<div style="display:flex;gap:0.7rem;padding:0.7rem 0;border-bottom:1px solid #f1f5f9;align-items:center;">
                <div style="width:32px;height:32px;border-radius:50%;background:${tx.type==='topup'?'#22c55e':tx.type==='sale'?'#f59e0b':'#ef4444'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.75rem;"><i class="fas ${tx.type==='topup'?'fa-arrow-down':tx.type==='sale'?'fa-coins':'fa-shopping-bag'}"></i></div>
                <div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:0.82rem;">${escapeHtml(tx.description||tx.type)}</div><div style="font-size:0.7rem;color:#6b7280;">${when} ${tx.reference? '• '+escapeHtml(tx.reference.substring(0,10)):''}</div></div>
                <div style="text-align:right;"><div style="font-weight:800;color:${col};">${sign}GHS ${Number(tx.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</div><div style="font-size:0.65rem;color:#6b7280;">Bal GHS ${Number(tx.balanceAfter||0).toLocaleString(undefined,{minimumFractionDigits:2})}</div></div>
            </div>`;
        });
        list.innerHTML=h;
    }).catch(function(err){
        list.innerHTML='<div style="color:#e74c3c;padding:1rem;text-align:center;">Error: '+escapeHtml(err.message)+'</div>';
    });
}
function closeWalletTxModal(){ const m=document.getElementById('walletTxModal'); if(m) m.style.display='none'; }
function closeOrderModal(){ const m=document.getElementById('orderDetailModal'); if(m) m.style.display='none'; }
function viewOrder(orderId){
    const modal=document.getElementById('orderDetailModal');
    const title=document.getElementById('orderModalTitle');
    const body=document.getElementById('orderModalBody');
    if(!modal||!body) { alert('Order '+orderId); window.open('/pages/admin/dashboard.html#orders','_blank'); return; }
    if(title) title.innerHTML='<i class="fas fa-receipt"></i> Order '+escapeHtml(orderId.substring(0,8).toUpperCase());
    body.innerHTML='<div style="text-align:center;padding:1.5rem;color:#5a6572;"><i class="fas fa-spinner fa-spin"></i> Loading order...</div>';
    modal.style.display='flex';
    // Try cache first
    let cached = null;
    try{
        if(window.adminOrdersCache) cached = window.adminOrdersCache.find(function(o){ return o.id===orderId; });
        if(!cached && window.filteredOrdersCache) cached = window.filteredOrdersCache.find(function(o){ return o.id===orderId; });
    }catch(e){}
    function renderOrderDetail(order){
        const id=order.id||orderId;
        const amount = order.total||order.amount||order.price||order.grandTotal||0;
        const status = (order.status||'pending');
        const statusClass = status==='completed' ? 'background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;' : status==='paid' ? 'background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;' : status==='cancelled' ? 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca;' : status==='delivered' ? 'background:#fef9c3;color:#854d0e;border:1px solid #fde68a;' : 'background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;';
        const created = order.createdAt ? (order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt)) : null;
        let dateStr='—'; try{ if(created) dateStr=created.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch(e){}
        const updated = order.updatedAt ? (order.updatedAt.toDate ? order.updatedAt.toDate() : new Date(order.updatedAt)) : null;
        let updStr=''; try{ if(updated) updStr=updated.toLocaleString('en-GB'); }catch(e){}
        const buyer = escapeHtml(order.buyerEmail||order.buyerName||order.buyerId||'—');
        const seller = escapeHtml(order.sellerName||order.sellerEmail||order.sellerId||'—');
        const product = escapeHtml(order.productTitle||order.title||order.productName||'—');
        const productId = order.productId||order.listingId||'';
        const qty = order.quantity||order.qty||1;
        const payMethod = escapeHtml(order.paymentMethod||order.payMethod|| (order.walletPaid?'Wallet (0% fee)':'—'));
        const escrow = escapeHtml(order.escrowStatus|| (order.escrowReleased?'released':order.status==='paid'?'held':'—'));
        const isAuction = order.isAuctionOrder ? '<span style="background:#fef3c7;color:#92400e;padding:0.15rem 0.4rem;border-radius:999px;font-size:0.65rem;font-weight:800;">🏆 Auction</span>' : '';
        const preOrderChip = order.isPreOrder===true ? ' <span class="preorder-badge"><i class="fas fa-clock"></i> Pre-order</span>' + preOrderStageChipHtml(order) : '';
        let preOrderDetail = '';
        if (order.isPreOrder===true){
            let whenTxt='';
            try { if(order.preOrderDate) whenTxt = new Date(order.preOrderDate+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}); } catch(e){}
            preOrderDetail = '<div style="font-size:0.72rem;color:#8a6100;background:#fff7e0;border:1px solid #f5af02;border-radius:8px;padding:0.35rem 0.5rem;margin-top:0.4rem;">⏳ Pre-order — Sankofa Store dispatches when the stock lands'+(whenTxt?' (expected <strong>'+escapeHtml(whenTxt)+'</strong>)':'')+(order.preOrderNote?'. '+escapeHtml(order.preOrderNote):'')+'</div>';
        }
        const addr = order.shippingAddress ? escapeHtml(typeof order.shippingAddress==='string'?order.shippingAddress:JSON.stringify(order.shippingAddress)) : (order.deliveryAddress ? escapeHtml(order.deliveryAddress) : (order.address?escapeHtml(order.address):'—'));
        // Actions
        const statusOptions = ['pending','paid','delivered','completed','cancelled'].map(function(s){
            return '<option value="'+s+'"'+(s===status?' selected':'')+'>'+s.charAt(0).toUpperCase()+s.slice(1)+'</option>';
        }).join('');
        body.innerHTML = `
            <div style="display:grid;gap:1rem;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
                    <div>
                        <div style="font-size:0.72rem;color:#6b7280;letter-spacing:0.05em;font-weight:700;">ORDER ID</div>
                        <div style="font-family:monospace;font-weight:800;font-size:0.95rem;word-break:break-all;">${escapeHtml(id)} ${isAuction}</div>
                        <div style="font-size:0.72rem;color:#6b7280;margin-top:0.2rem;">${escapeHtml(dateStr)} ${updStr && updStr!==dateStr ? '• updated '+escapeHtml(updStr):''}</div>
                    </div>
                    <span style="padding:0.35rem 0.7rem;border-radius:999px;font-weight:800;font-size:0.78rem;${statusClass}">${escapeHtml(status.charAt(0).toUpperCase()+status.slice(1))}</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.7rem;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:0.8rem 1rem;">
                    <div><div style="font-size:0.65rem;color:#6b7280;font-weight:700;letter-spacing:0.05em;">AMOUNT</div><div style="font-weight:800;font-size:1.1rem;color:#0064d2;">GHS ${Number(amount).toLocaleString(undefined,{minimumFractionDigits:2})}</div><div style="font-size:0.65rem;color:#6b7280;">Qty: ${qty} ${payMethod!=='—' ? '• '+payMethod : ''} ${escrow!=='—' ? '• Escrow: '+escrow : ''}</div></div>
                    <div><div style="font-size:0.65rem;color:#6b7280;font-weight:700;">BUYER</div><div style="font-weight:600;font-size:0.82rem;word-break:break-all;">${buyer}</div><div style="font-size:0.65rem;color:#6b7280;">${escapeHtml(order.buyerId||'')}</div></div>
                    <div><div style="font-size:0.65rem;color:#6b7280;font-weight:700;">SELLER</div><div style="font-weight:600;font-size:0.82rem;word-break:break-all;">${seller}</div><div style="font-size:0.65rem;color:#6b7280;">${escapeHtml(order.sellerId||'')}</div></div>
                </div>
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:0.8rem 1rem;">
                    <div style="font-weight:700;font-size:0.82rem;margin-bottom:0.4rem;display:flex;align-items:center;gap:0.4rem;"><i class="fas fa-box" style="color:#0064d2;"></i> Product</div>
                    <div style="font-weight:600;">${product}${preOrderChip}</div>
                    ${preOrderDetail}
                    <div style="font-size:0.72rem;color:#6b7280;word-break:break-all;">${productId ? 'ID: '+escapeHtml(productId) : ''} ${order.auctionId ? '• Auction: '+escapeHtml(order.auctionId.substring(0,8)) : ''}</div>
                    ${order.productImage ? '<img src="'+escapeHtml(order.productImage)+'" style="width:100%;max-height:160px;object-fit:contain;margin-top:0.6rem;border:1px solid #f1f5f9;border-radius:8px;">' : ''}
                </div>
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:0.8rem 1rem;">
                    <div style="font-weight:700;font-size:0.82rem;margin-bottom:0.4rem;"><i class="fas fa-map-marker-alt" style="color:#e74c3c;"></i> Delivery / Address</div>
                    <div style="font-size:0.82rem;white-space:pre-wrap;word-break:break-word;">${addr}</div>
                    ${order.deliveryMethod ? '<div style="font-size:0.72rem;color:#6b7280;margin-top:0.3rem;">Method: '+escapeHtml(order.deliveryMethod)+'</div>' : ''}
                    ${order.buyerPhone ? '<div style="font-size:0.72rem;color:#6b7280;">Phone: '+escapeHtml(order.buyerPhone)+'</div>' : ''}
                </div>
                ${order.paystackReference||order.paymentReference ? '<div style="font-size:0.72rem;color:#6b7280;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:0.6rem 0.8rem;">Ref: <code style="font-size:0.72rem;">'+escapeHtml(order.paystackReference||order.paymentReference)+'</code></div>' : ''}
                <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:0.8rem 1rem;display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;">
                    <label style="font-size:0.78rem;font-weight:700;display:flex;align-items:center;gap:0.4rem;">Status <select id="orderStatusSelect" style="padding:0.4rem 0.6rem;border:1.5px solid #e5e7eb;border-radius:6px;font-size:0.82rem;background:#fff;">${statusOptions}</select></label>
                    <button onclick="updateOrderStatusFromModal('${id}')" style="background:#0064d2;color:#fff;border:none;padding:0.5rem 0.9rem;border-radius:8px;font-weight:700;font-size:0.78rem;cursor:pointer;"><i class="fas fa-save"></i> Update Status</button>
                    <button onclick="deleteOrder('${id}')" style="margin-left:auto;background:#fff;border:1px solid #fecaca;color:#991b1b;padding:0.5rem 0.9rem;border-radius:8px;font-weight:700;font-size:0.78rem;cursor:pointer;"><i class="fas fa-trash"></i> Delete Order</button>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    ${productId ? '<a href="../../product-detail.html?id='+escapeHtml(productId)+'" target="_blank" style="background:#fff;border:1px solid #e5e7eb;color:#374151;padding:0.5rem 0.9rem;border-radius:8px;font-weight:600;font-size:0.78rem;text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem;"><i class="fas fa-external-link-alt"></i> View Product</a>' : ''}
                    <a href="../../pages/user/messages.html" target="_blank" style="background:#fff;border:1px solid #e5e7eb;color:#374151;padding:0.5rem 0.9rem;border-radius:8px;font-weight:600;font-size:0.78rem;text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem;"><i class="fas fa-comments"></i> Messages</a>
                    <button onclick="navigator.clipboard&&navigator.clipboard.writeText('${id}').then(()=>alert('Copied '+id.substring(0,8))).catch(()=>prompt('Copy ID',id))" style="background:#f8fafc;border:1px solid #e5e7eb;color:#374151;padding:0.5rem 0.9rem;border-radius:8px;font-weight:600;font-size:0.78rem;cursor:pointer;"><i class="fas fa-copy"></i> Copy ID</button>
                </div>
            </div>
        `;
    }
    if(cached){
        renderOrderDetail(cached);
        // Also fetch fresh to ensure latest status
        firebaseDB.collection('orders').doc(orderId).get().then(function(doc){
            if(doc.exists){
                const fresh = {id:doc.id, ...doc.data()};
                // update cache
                try{ const idx=window.adminOrdersCache.findIndex(function(o){return o.id===orderId;}); if(idx>-1) window.adminOrdersCache[idx]=fresh; }catch(e){}
                renderOrderDetail(fresh);
            }
        }).catch(function(){});
    } else {
        firebaseDB.collection('orders').doc(orderId).get().then(function(doc){
            if(!doc.exists){ body.innerHTML='<div style="text-align:center;padding:2rem;color:#e74c3c;"><i class="fas fa-exclamation-triangle"></i><p>Order not found (may have been deleted)</p><p style="font-size:0.72rem;color:#6b7280;word-break:break-all;">'+escapeHtml(orderId)+'</p></div>'; return; }
            renderOrderDetail({id:doc.id,...doc.data()});
        }).catch(function(err){
            body.innerHTML='<div style="text-align:center;padding:1.5rem;color:#e74c3c;"><p>Error: '+escapeHtml(err.message||String(err))+'</p><button onclick="viewOrder(\''+orderId+'\')" style="margin-top:0.6rem;background:#0064d2;color:#fff;border:none;padding:0.5rem 0.9rem;border-radius:6px;cursor:pointer;">Retry</button></div>';
        });
    }
}
function updateOrderStatusFromModal(orderId){
    const sel=document.getElementById('orderStatusSelect');
    if(!sel) return;
    const newStatus=sel.value;
    if(!confirm('Change order '+orderId.substring(0,8)+' status to '+newStatus+'?')) return;
    const btn=sel.nextElementSibling;
    const orig=btn?btn.innerHTML:'';
    if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    firebaseDB.collection('orders').doc(orderId).update({status:newStatus, updatedAt: firebase.firestore.FieldValue.serverTimestamp()}).then(function(){
        try{ const idx=window.adminOrdersCache.findIndex(function(o){return o.id===orderId;}); if(idx>-1) window.adminOrdersCache[idx].status=newStatus; }catch(e){}
        if(typeof renderOrdersPaginated==='function') renderOrdersPaginated();
        if(typeof loadNavCounts==='function') loadNavCounts();
        const body=document.getElementById('orderModalBody');
        if(body) body.insertAdjacentHTML('afterbegin','<div style="background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;padding:0.6rem 0.8rem;border-radius:8px;font-size:0.78rem;font-weight:700;margin-bottom:0.8rem;"><i class="fas fa-check-circle"></i> Status updated to '+escapeHtml(newStatus)+'</div>');
        setTimeout(function(){ closeOrderModal(); }, 900);
    }).catch(function(err){
        alert('Failed: '+err.message);
        if(btn){ btn.disabled=false; btn.innerHTML=orig; }
    });
}
function deleteOrder(orderId){
    if(!confirm('Delete order '+orderId.substring(0,8)+'?\nThis cannot be undone.')) return;
    if(typeof firebaseDB==='undefined'||!firebaseDB){ alert('Firebase not connected'); return; }
    if(typeof firebaseAuth==='undefined'||!firebaseAuth.currentUser){ alert('Sign in as admin'); return; }
    firebaseDB.collection('users').doc(firebaseAuth.currentUser.uid).get().then(function(doc){
        const d=doc.exists?doc.data():{};
        if(d.role!=='admin'){ alert('Only admin can delete orders'); throw new Error('not admin'); }
        return firebaseDB.collection('orders').doc(orderId).delete();
    }).then(function(){
        if(typeof showFlashMessage==='function') showFlashMessage('Order deleted ✓','success'); else alert('Order deleted');
        closeOrderModal();
        try{ window.selectedOrderIds&&window.selectedOrderIds.delete(orderId); }catch(e){}
        if(typeof loadOrders==='function') loadOrders();
        if(typeof loadNavCounts==='function') loadNavCounts();
        if(typeof loadOverviewRevenue==='function'){ try{_overviewRevenueCache.orders=null; loadOverviewRevenue();}catch(e){} }
    }).catch(function(err){
        if(err&&err.message==='not admin') return;
        alert('Error deleting order: '+(err.message||String(err)));
    });
}
window.viewOrder=viewOrder; window.deleteOrder=deleteOrder; window.closeOrderModal=closeOrderModal; window.updateOrderStatusFromModal=updateOrderStatusFromModal;
function adjustWalletBalance(userId){
    const amtStr=prompt('Adjust wallet balance for '+userId.substring(0,8)+'\n\nEnter amount (+ to credit, - to debit), e.g. 50 or -20');
    if(amtStr===null) return;
    const amt=parseFloat(amtStr);
    if(isNaN(amt) || amt===0){ alert('Invalid amount'); return; }
    const reason=prompt('Reason for adjustment? (e.g. Bonus, Correction, Refund)');
    if(reason===null) return;
    if(!confirm((amt>0?'Credit':'Debit')+' GHS '+Math.abs(amt)+' to '+userId.substring(0,8)+'?\nReason: '+(reason||'-'))) return;
    // Use admin SDK via Functions? For now direct Firestore transaction as admin (rules allow)
    // Do via client transaction as admin
    const walletRef=firebaseDB.collection('wallets').doc(userId);
    firebaseDB.runTransaction(function(tx){
        return tx.get(walletRef).then(function(doc){
            let bal=0, totalTopups=0, totalSpent=0;
            if(doc.exists){ const d=doc.data(); bal=d.balance||0; totalTopups=d.totalTopups||0; totalSpent=d.totalSpent||0; }
            const newBal=Math.round((bal+amt)*100)/100;
            if(!doc.exists) tx.set(walletRef, {userId:userId, balance:newBal, currency:'GHS', totalTopups: amt>0? amt:0, totalSpent: amt<0? Math.abs(amt):0, totalEarnings:0, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()});
            else {
                const upd={balance:newBal, updatedAt: firebase.firestore.FieldValue.serverTimestamp()};
                if(amt>0) upd.totalTopups=(totalTopups||0)+amt;
                else upd.totalSpent=(totalSpent||0)+Math.abs(amt);
                tx.update(walletRef, upd);
            }
            const txRef=firebaseDB.collection('walletTransactions').doc();
            tx.set(txRef, {userId:userId, type: amt>0?'topup':'purchase', amount:amt, balanceAfter:newBal, description: 'Admin adjustment: '+(reason||'-')+(amt>0?' (bonus)':''), status:'completed', createdAt: firebase.firestore.FieldValue.serverTimestamp()});
        });
    }).then(function(){ alert('Adjusted GHS '+amt+' — new balance will show after refresh'); loadAdminWallets(true); }).catch(function(e){ alert('Failed: '+e.message); });
}
// Hook search + export + nav
document.addEventListener('DOMContentLoaded', function(){
    const s=document.getElementById('walletSearch');
    if(s) s.addEventListener('input', function(){ applyWalletSearch(); });
    const exp=document.getElementById('exportWalletsBtn');
    if(exp) exp.addEventListener('click', function(){
        if(!adminWalletsCache.length){ alert('No wallets to export'); return; }
        let csv='User,Email,UserId,Balance,Topups,Spent,Earned\n';
        adminWalletsCache.forEach(function(w){
            csv+='"'+String(w.name||'').replace(/"/g,'""')+'","'+String(w.email||'').replace(/"/g,'""')+'","'+w.userId+'",'+(w.balance||0)+','+(w.totalTopups||0)+','+(w.totalSpent||0)+','+(w.totalEarnings||0)+'\n';
        });
        const blob=new Blob([csv],{type:'text/csv'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download='sankofa_wallets_'+new Date().toISOString().slice(0,10)+'.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); },500);
    });
    // Close modals on backdrop
    const modal=document.getElementById('walletTxModal');
    if(modal) modal.addEventListener('click', function(e){ if(e.target===modal) closeWalletTxModal(); });
    const oModal=document.getElementById('orderDetailModal');
    if(oModal) oModal.addEventListener('click', function(e){ if(e.target===oModal) closeOrderModal(); });
});

function showTableSkeleton(tbodyId, cols, rows){
    var tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    var html='';
    for(var i=0;i<rows;i++){
        html+='<tr>';
        for(var c=0;c<cols;c++){
            html+='<td><div class="skeleton" style="width:'+(60+Math.random()*40)+'%;"></div></td>';
        }
        html+='</tr>';
    }
    tbody.innerHTML = html;
}
function renderPagination(containerId, infoId, total, currentPage, pageSize, onPageChange){
    var container = document.getElementById(containerId);
    var infoEl = document.getElementById(infoId);
    if (!container) return;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    if (infoEl) {
        var start = total===0 ? 0 : (currentPage-1)*pageSize+1;
        var end = Math.min(total, currentPage*pageSize);
        infoEl.textContent = total===0 ? 'No results' : 'Showing '+start+'–'+end+' of '+total;
    }
    var html='';
    html += '<button class="page-btn" '+(currentPage===1?'disabled':'')+' onclick="'+onPageChange+'('+(currentPage-1)+')"><i class="fas fa-chevron-left"></i></button>';
    var startPage = Math.max(1, currentPage-2);
    var endPage = Math.min(totalPages, startPage+4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage-4);
    if (startPage > 1) {
        html += '<button class="page-btn" onclick="'+onPageChange+'(1)">1</button>';
        if (startPage > 2) html += '<span style="padding:0.4rem;color:#9ca3af;">…</span>';
    }
    for(var p=startPage; p<=endPage; p++){
        html += '<button class="page-btn '+(p===currentPage?'active':'')+'" onclick="'+onPageChange+'('+p+')">'+p+'</button>';
    }
    if (endPage < totalPages) {
        if (endPage < totalPages-1) html += '<span style="padding:0.4rem;color:#9ca3af;">…</span>';
        html += '<button class="page-btn" onclick="'+onPageChange+'('+totalPages+')">'+totalPages+'</button>';
    }
    html += '<button class="page-btn" '+(currentPage===totalPages?'disabled':'')+' onclick="'+onPageChange+'('+(currentPage+1)+')"><i class="fas fa-chevron-right"></i></button>';
    container.innerHTML = html;
}
function goToProductsPage(p){ productsCurrentPage=p; renderAdminProducts(filteredProductsCache.length? filteredProductsCache : adminProductsCache, true); window.scrollTo({top: document.getElementById('section-products').offsetTop - 80, behavior:'smooth'}); }
function goToUsersPage(p){ usersCurrentPage=p; var s=document.getElementById('userSearch')?.value?.toLowerCase()||''; renderAdminUsers(s); window.scrollTo({top: document.getElementById('section-users').offsetTop - 80, behavior:'smooth'}); }

// ============================================================================
// COMMISSION RATES (Settings section) — restored here so the admin panel works
// without the old ES-module leftovers in js/admin-orders.js
// ============================================================================
// ADMIN AUCTION COMMISSION — one seller-side percentage, snapshotted on new auctions
// ============================================================================

function validateAuctionCommissionPercent(value){
    if (value === null || value === undefined || String(value).trim() === '') return null;
    var rate = Number(value);
    if (!isFinite(rate) || rate < 0 || rate > 100) return null;
    return Math.round(rate * 100) / 100;
}

function initAuctionCommissionSettings(){
    var input = document.getElementById('auctionCommissionPercent');
    var saveBtn = document.getElementById('saveAuctionCommissionBtn');
    var resetBtn = document.getElementById('resetAuctionCommissionBtn');
    var statusEl = document.getElementById('auctionCommissionStatus');
    var helpEl = document.getElementById('auctionCommissionHelp');
    if (!input) return;

    var settingsRef = (typeof firebaseDB !== 'undefined' && firebaseDB)
        ? firebaseDB.collection('settings').doc('auctionCommission') : null;
    var state = { loaded: false, exists: false, rate: null };
    if (saveBtn) saveBtn.disabled = true;
    if (resetBtn) resetBtn.disabled = true;
    function showStatus(message, type){
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.style.color = type === 'error' ? '#e74c3c' : (type === 'success' ? '#16a34a' : '#5a6572');
    }
    function renderSavedSetting(doc){
        state.loaded = true;
        state.exists = !!(doc && doc.exists);
        var data = state.exists ? (doc.data() || {}) : {};
        state.rate = validateAuctionCommissionPercent(data.sellerCommissionPercent);
        input.value = state.rate === null ? '' : String(state.rate);
        if (saveBtn) saveBtn.disabled = false;
        if (resetBtn) resetBtn.disabled = !state.exists;
        if (state.rate !== null){
            if (helpEl) helpEl.textContent = 'Current global rate: ' + state.rate + '%. This applies only to auctions created after saving; active auctions keep their existing fee.';
            showStatus('Global seller auction commission is ' + state.rate + '%.', 'success');
        } else if (state.exists){
            if (helpEl) helpEl.textContent = 'The saved setting is not a valid percentage. Enter a value from 0 to 100 and save, or clear it to return to seller-plan rates.';
            showStatus('The saved auction commission setting is invalid. Please correct it or reset to seller-plan rates.', 'error');
        } else {
            if (helpEl) helpEl.textContent = 'No global rate is saved. Current seller-plan rates remain in use until you save a percentage. 0% means no commission; 100% means the seller receives none.';
            showStatus('No global rate is set; existing seller-plan rates are still used.', '');
        }
    }

    if (!settingsRef){
        showStatus('Firebase is not connected.', 'error');
        if (saveBtn) saveBtn.disabled = true;
        if (resetBtn) resetBtn.disabled = true;
    } else {
        settingsRef.get().then(renderSavedSetting).catch(function(err){
            state.loaded = false;
            if (saveBtn) saveBtn.disabled = true;
            if (resetBtn) resetBtn.disabled = true;
            showStatus('Could not load the auction commission setting: ' + (err.message || err), 'error');
        });
    }

    if (saveBtn && !saveBtn.dataset.boundAuctionCommission){
        saveBtn.dataset.boundAuctionCommission = '1';
        saveBtn.addEventListener('click', function(){
            if (!settingsRef || !state.loaded){
                showStatus('Wait for the current setting to finish loading, then try again.', 'error');
                return;
            }
            var raw = String(input.value || '').trim();
            var rate = validateAuctionCommissionPercent(raw);
            if (raw === '' || rate === null){
                showStatus('Enter a commission percentage from 0 to 100.', 'error');
                input.focus();
                return;
            }
            input.value = String(rate);
            saveBtn.disabled = true;
            if (resetBtn) resetBtn.disabled = true;
            var original = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            var payload = {
                sellerCommissionPercent: rate,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            var current = (typeof firebaseAuth !== 'undefined' && firebaseAuth) ? firebaseAuth.currentUser : null;
            if (current) payload.updatedBy = current.uid;
            settingsRef.set(payload).then(function(){
                state.loaded = true;
                state.exists = true;
                state.rate = rate;
                if (resetBtn) resetBtn.disabled = false;
                if (helpEl) helpEl.textContent = 'Current global rate: ' + rate + '%. This applies only to auctions created after saving; active auctions keep their existing fee.';
                showStatus('Saved ' + rate + '%. New auctions will use this rate; existing auctions are unchanged.', 'success');
            }).catch(function(err){
                showStatus('Could not save the auction commission: ' + (err.message || err), 'error');
            }).finally(function(){
                saveBtn.disabled = false;
                if (resetBtn) resetBtn.disabled = !state.exists;
                saveBtn.innerHTML = original;
            });
        });
    }

    if (resetBtn && !resetBtn.dataset.boundAuctionCommission){
        resetBtn.dataset.boundAuctionCommission = '1';
        resetBtn.addEventListener('click', function(){
            if (!settingsRef || !state.loaded || !state.exists) return;
            if (!window.confirm('Clear the custom auction commission? New auctions will return to the current seller-plan rates. Auctions already created will not change.')) return;
            resetBtn.disabled = true;
            if (saveBtn) saveBtn.disabled = true;
            var original = resetBtn.innerHTML;
            resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clearing...';
            settingsRef.delete().then(function(){
                state.loaded = true;
                state.exists = false;
                state.rate = null;
                input.value = '';
                if (helpEl) helpEl.textContent = 'No global rate is saved. Current seller-plan rates remain in use until you save a percentage. 0% means no commission; 100% means the seller receives none.';
                showStatus('Custom rate cleared. New auctions will use seller-plan rates; existing auctions are unchanged.', 'success');
            }).catch(function(err){
                showStatus('Could not clear the auction commission: ' + (err.message || err), 'error');
                resetBtn.disabled = false;
            }).finally(function(){
                resetBtn.innerHTML = original;
                resetBtn.disabled = !state.exists;
                if (saveBtn) saveBtn.disabled = false;
            });
        });
    }
}

// ============================================================================
// ADMIN WEBSITE MAINTENANCE MODE
// ============================================================================

function initMaintenanceSettings(){
    var toggle = document.getElementById('maintenanceModeToggle');
    var statusEl = document.getElementById('maintenanceModeStatus');
    var feedbackEl = document.getElementById('maintenanceModeFeedback');
    if (!toggle) return;

    var settingsRef = (typeof firebaseDB !== 'undefined' && firebaseDB)
        ? firebaseDB.collection('settings').doc('maintenance') : null;
    var state = { loaded: false, enabled: false };
    function setFeedback(message, type){
        if (!feedbackEl) return;
        feedbackEl.textContent = message;
        feedbackEl.style.color = type === 'error' ? '#e74c3c' : (type === 'success' ? '#16a34a' : '#5a6572');
    }
    function renderMode(doc){
        state.loaded = true;
        var data = doc && doc.exists ? (doc.data() || {}) : {};
        state.enabled = data.enabled === true;
        toggle.checked = state.enabled;
        toggle.disabled = false;
        if (statusEl) statusEl.textContent = state.enabled
            ? 'ON — non-admin visitors see the maintenance page.'
            : 'OFF — the marketplace is visible to visitors.';
    }
    if (!settingsRef){
        toggle.disabled = true;
        setFeedback('Firebase is not connected, so this setting cannot be changed.', 'error');
        return;
    }
    settingsRef.get().then(renderMode).catch(function(err){
        toggle.disabled = true;
        setFeedback('Could not load maintenance mode: ' + (err.message || err), 'error');
    });

    if (!toggle.dataset.boundMaintenanceMode){
        toggle.dataset.boundMaintenanceMode = '1';
        toggle.addEventListener('change', function(){
            if (!state.loaded){ toggle.checked = state.enabled; return; }
            var nextEnabled = !!toggle.checked;
            if (nextEnabled && !window.confirm('Turn on maintenance mode? Visitors will see the maintenance page, while admins keep access.')){
                toggle.checked = state.enabled;
                return;
            }
            toggle.disabled = true;
            setFeedback(nextEnabled ? 'Turning maintenance mode on…' : 'Turning maintenance mode off…', '');
            var payload = {
                enabled: nextEnabled,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            var current = (typeof firebaseAuth !== 'undefined' && firebaseAuth) ? firebaseAuth.currentUser : null;
            if (current) payload.updatedBy = current.uid;
            settingsRef.set(payload, { merge: true }).then(function(){
                state.enabled = nextEnabled;
                toggle.checked = nextEnabled;
                if (statusEl) statusEl.textContent = nextEnabled
                    ? 'ON — non-admin visitors see the maintenance page.'
                    : 'OFF — the marketplace is visible to visitors.';
                setFeedback(nextEnabled
                    ? 'Maintenance mode is on. Your admin account can continue working on the site.'
                    : 'Maintenance mode is off. The marketplace is open to visitors.', 'success');
            }).catch(function(err){
                toggle.checked = state.enabled;
                setFeedback('Could not change maintenance mode: ' + (err.message || err), 'error');
            }).finally(function(){ toggle.disabled = false; });
        });
    }
}

// ============================================================================

var defaultCommissionRates = {
    'electronics': { name: 'Electronics', icon: 'fa-mobile-alt', rate: 5 },
    'fashion': { name: 'Fashion & Clothing', icon: 'fa-tshirt', rate: 8 },
    'home-garden': { name: 'Home & Garden', icon: 'fa-home', rate: 5 },
    'vehicles': { name: 'Vehicles', icon: 'fa-car', rate: 3 },
    'services': { name: 'Services', icon: 'fa-concierge-bell', rate: 5 },
    'sports': { name: 'Sports', icon: 'fa-futbol', rate: 5 },
    'books-media': { name: 'Books & Media', icon: 'fa-book', rate: 5 },
    'baby-kids': { name: 'Baby & Kids', icon: 'fa-baby', rate: 5 },
    'beauty-health': { name: 'Beauty & Health', icon: 'fa-spa', rate: 5 },
    'food-groceries': { name: 'Food & Groceries', icon: 'fa-utensils', rate: 5 },
    'pets': { name: 'Pets', icon: 'fa-paw', rate: 5 },
    'jobs-skills': { name: 'Jobs & Skills', icon: 'fa-briefcase', rate: 5 },
    'real-estate': { name: 'Real Estate', icon: 'fa-building', rate: 3 },
    'musical-instruments': { name: 'Musical Instruments', icon: 'fa-guitar', rate: 5 },
    'others': { name: 'Others', icon: 'fa-tag', rate: 5 }
};

function initCommissionRates() {
    var grid = document.getElementById('commissionRatesGrid');
    var saveBtn = document.getElementById('saveCommissionBtn');
    if (!grid) return;

    var rates = Object.assign({}, defaultCommissionRates);

    if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        firebaseDB.collection('settings').doc('commissionRates').get().then(function(doc) {
            if (doc.exists) {
                var saved = doc.data();
                Object.keys(saved).forEach(function(key) {
                    if (rates[key]) rates[key].rate = parseFloat(saved[key]);
                    if (isNaN(rates[key].rate)) rates[key].rate = defaultCommissionRates[key] ? defaultCommissionRates[key].rate : 5;
                });
            }
            renderCommissionGrid(grid, rates);
        }).catch(function() {
            renderCommissionGrid(grid, rates);
        });
    } else {
        renderCommissionGrid(grid, rates);
    }

    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.dataset.bound = '1';
        saveBtn.addEventListener('click', function() {
            saveCommissionRates(grid, saveBtn);
        });
    }
}

function renderCommissionGrid(grid, rates) {
    var html = '';
    Object.keys(rates).forEach(function(key) {
        var cat = rates[key];
        html += '<div style="display: flex; align-items: center; gap: 0.65rem; padding: 0.65rem 0.85rem; background: var(--bg-secondary, #f7f7f7); border-radius: 8px; border: 1px solid var(--border-color, #e5e5e5);">' +
            '<i class="fas ' + cat.icon + '" style="color: var(--primary-color, #0064d2); width: 20px; text-align: center;"></i>' +
            '<div style="flex: 1; min-width: 0;">' +
                '<div style="font-size: 0.82rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + cat.name + '</div>' +
            '</div>' +
            '<div style="display: flex; align-items: center; gap: 0.25rem;">' +
                '<input type="number" class="commission-input" data-category="' + key + '" value="' + cat.rate + '" min="0" max="50" step="0.5" style="width: 55px; padding: 0.35rem 0.5rem; border: 1.5px solid var(--border-color, #e5e5e5); border-radius: 6px; font-size: 0.85rem; text-align: center; font-weight: 600;">' +
                '<span style="font-size: 0.82rem; color: #5a6572; font-weight: 600;">%</span>' +
            '</div>' +
        '</div>';
    });
    grid.innerHTML = html;
}

function saveCommissionRates(grid, saveBtn) {
    var inputs = grid.querySelectorAll('.commission-input');
    var rates = {};
    inputs.forEach(function(input) {
        var category = input.getAttribute('data-category');
        var rate = parseFloat(input.value);
        if (isNaN(rate) || rate < 0) rate = 0;
        if (rate > 50) rate = 50;
        input.value = rate;
        rates[category] = rate;
    });

    saveBtn.disabled = true;
    var original = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    var statusEl = document.getElementById('commissionStatus');

    if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        firebaseDB.collection('settings').doc('commissionRates').set(rates).then(function() {
            if (statusEl) statusEl.innerHTML = '<span style="color: #22c55e;"><i class="fas fa-check-circle"></i> Commission rates saved!</span>';
            saveBtn.disabled = false;
            saveBtn.innerHTML = original;
        }).catch(function(err) {
            if (statusEl) statusEl.innerHTML = '<span style="color: #e74c3c;">Error: ' + err.message + '</span>';
            saveBtn.disabled = false;
            saveBtn.innerHTML = original;
        });
    } else {
        if (statusEl) statusEl.innerHTML = '<span style="color: #e74c3c;">Firebase not connected</span>';
        saveBtn.disabled = false;
        saveBtn.innerHTML = original;
    }
}

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled “classic” <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.initAdminDashboard = initAdminDashboard;
window.handleHashRouting = handleHashRouting;
window.initNavigation = initNavigation;
window.initLogout = initLogout;
window.handleAdminLogout = handleAdminLogout;
window.initProductManagement = initProductManagement;
window.openAddProductModal = openAddProductModal;
window.initAdminDeliveryOptions = initAdminDeliveryOptions;
window.closeAddProductModal = closeAddProductModal;
window.initAdminCategorySpecs = initAdminCategorySpecs;
window.updateAdminSpecifications = updateAdminSpecifications;
window.initProductImageUpload = initProductImageUpload;
window.removeImage = removeImage;
window.loadStoresIntoDropdown = loadStoresIntoDropdown;
window.handleAddProduct = handleAddProduct;
window.uploadImagesToStorage = uploadImagesToStorage;
window.uploadImagesWithThumbs = uploadImagesWithThumbs;
window.createAdminUploadProgressUI = createAdminUploadProgressUI;
window.updateAdminUploadProgressUI = updateAdminUploadProgressUI;
window.dataURLtoBlob = dataURLtoBlob;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.approveProduct = approveProduct;
window.rejectProduct = rejectProduct;
window.reviewProduct = reviewProduct;
window.removeProduct = removeProduct;
window.exportProducts = exportProducts;
window.updateBulkActions = updateBulkActions;
window.viewProduct = viewProduct;
window.initUserManagement = initUserManagement;
window.loadAdminUsers = loadAdminUsers;
window.renderAdminUsers = renderAdminUsers;
window.approveUser = approveUser;
window.blockUser = blockUser;
window.isPremiumActive = isPremiumActive;
window.assignSellerTier = assignSellerTier;
window.directVerifyUser = directVerifyUser;
window.revokeVerification = revokeVerification;
window.setUserTier = setUserTier;
window.toggleFoundingSeller = toggleFoundingSeller;
window.viewVerification = viewVerification;
window.loadAdminEscrowHistory = loadAdminEscrowHistory;
window.approveVerification = approveVerification;
window.rejectVerification = rejectVerification;
window.initOrderManagement = initOrderManagement;
window.filterOrders = filterOrders;
window.getOrderDateValue = getOrderDateValue;
window.isOrderInDateFilter = isOrderInDateFilter;
window.getFilteredOrders = getFilteredOrders;
window.applyOrderFilters = applyOrderFilters;
window.updateOrderDateInfo = updateOrderDateInfo;
window.formatOrderGroupLabel = formatOrderGroupLabel;
window.toggleOrderGroup = toggleOrderGroup;
window.toggleAllOrderGroups = toggleAllOrderGroups;
window.initCategoryManagement = initCategoryManagement;
window.loadAdminCategories = loadAdminCategories;
window.renderAdminCategories = renderAdminCategories;
window.loadCategoryProductCounts = loadCategoryProductCounts;
window.openCategoryModal = openCategoryModal;
window.hexToRgb = hexToRgb;
window.rgbToHex = rgbToHex;
window.deleteCategory = deleteCategory;
window.initReportsManagement = initReportsManagement;
window.initSettings = initSettings;
window.saveSettings = saveSettings;
window.initMobileMenu = initMobileMenu;
window.initGlobalSearch = initGlobalSearch;
window.escapeHtml = escapeHtml;
window.debounce = debounce;
window.escapeFlashText = escapeFlashText;
window.showFlashMessage = showFlashMessage;
window.flagProduct = flagProduct;
window.blockSeller = blockSeller;
window.unblockSeller = unblockSeller;
window.initProductActions = initProductActions;
window.initUserActions = initUserActions;
window.viewUser = viewUser;
window.editUser = editUser;
window.suspendUser = suspendUser;
window.deleteUser = deleteUser;
window.initLegalChecklist = initLegalChecklist;
window.toggleLegal = toggleLegal;
window.updateLegalProgress = updateLegalProgress;
window.initBottomNav = initBottomNav;
window.initSidebarCollapse = initSidebarCollapse;
window.sellerDisplayName = sellerDisplayName;
window.loadAdminSellers = loadAdminSellers;
window.getProductSeller = getProductSeller;
window.initStoreTabs = initStoreTabs;
window.selectStoreTab = selectStoreTab;
window.updateStoreCounts = updateStoreCounts;
window.loadAdminProducts = loadAdminProducts;
window.getAuctionStatusForAdmin = getAuctionStatusForAdmin;
window.updateProductsLiveAlert = updateProductsLiveAlert;
window.renderAdminProducts = renderAdminProducts;
window.filterAdminProducts = filterAdminProducts;
window.viewAdminProduct = viewAdminProduct;
window.viewSellerProfile = viewSellerProfile;
window.filterProductsBySeller = filterProductsBySeller;
window.toggleFeaturedProduct = toggleFeaturedProduct;
window.deleteAdminProduct = deleteAdminProduct;
window.initStoreProfile = initStoreProfile;
window.loadStoreProfile = loadStoreProfile;
window.initStoreManagement = initStoreManagement;
window.loadStores = loadStores;
window.renderStores = renderStores;
window.editSankofaStoreProfile = editSankofaStoreProfile;
window.openStoreModal = openStoreModal;
window.deleteStore = deleteStore;
window.loadNavCounts = loadNavCounts;
window.updateCount = updateCount;
window.loadOrders = loadOrders;
window.updateOrderStats = updateOrderStats;
window.renderOrders = renderOrders;
window.renderOrdersPaginated = renderOrdersPaginated;
window.goToOrdersPage = goToOrdersPage;
window.toggleOrderSelection = toggleOrderSelection;
window.toggleSelectAllOrders = toggleSelectAllOrders;
window.updateOrdersBulkBar = updateOrdersBulkBar;
window.clearOrderSelection = clearOrderSelection;
window.deleteSelectedOrders = deleteSelectedOrders;
window.loadAnalytics = loadAnalytics;
window.loadAnalyticsSection = loadAnalyticsSection;
window.loadOverviewData = loadOverviewData;
window.loadOverviewCounts = loadOverviewCounts;
window.loadOverviewRevenue = loadOverviewRevenue;
window.loadOverviewRecent = loadOverviewRecent;
window.loadRecentUsers = loadRecentUsers;
window.loadRevenueTrend = loadRevenueTrend;
window.loadCategoryOverview = loadCategoryOverview;
window.showAdminModal = showAdminModal;
window.renderOrphanWalletsNotice = renderOrphanWalletsNotice;
window.showOrphanWallets = showOrphanWallets;
window.cleanupOrphanWallets = cleanupOrphanWallets;
window.loadAdminWallets = loadAdminWallets;
window.applyWalletSearch = applyWalletSearch;
window.renderAdminWallets = renderAdminWallets;
window.goToWalletsPage = goToWalletsPage;
window.viewWalletTransactions = viewWalletTransactions;
window.closeWalletTxModal = closeWalletTxModal;
window.closeOrderModal = closeOrderModal;
window.viewOrder = viewOrder;
window.updateOrderStatusFromModal = updateOrderStatusFromModal;
window.deleteOrder = deleteOrder;
window.adjustWalletBalance = adjustWalletBalance;
window.showTableSkeleton = showTableSkeleton;
window.renderPagination = renderPagination;
window.goToProductsPage = goToProductsPage;
window.goToUsersPage = goToUsersPage;
window.initCommissionRates = initCommissionRates;
window.renderCommissionGrid = renderCommissionGrid;
window.saveCommissionRates = saveCommissionRates;


/* ============================================================================
 * VENDOR SHOPS (branded storefronts) — approve / switch off
 * ----------------------------------------------------------------------------
 * Sellers design their shop in "My Store" (saved via the saveMyStore Cloud
 * Function, always with isActive=false for brand-new shops). Nothing is
 * publicly visible until an admin flips the switch HERE — one click per shop.
 * Reads/writes use the admin rules path, no Cloud Function needed.
 * ==========================================================================*/
/* Shop owner lookups for the Vendor Shops table ---------------------------------
   The shop row shows the shop's own contact email when the seller set one;
   otherwise it falls back to the seller's ACCOUNT email (users/{uid}.email),
   so the admin always has someone to reach. Cached per session, and fetched in
   chunks of 30 ids per query, so a 100-shop panel costs ~4 reads at most. */
var _shopOwnerCache = {};   // uid → { email, founding }

async function fetchShopOwners(uids) {
    var out = {}, need = [];
    (uids || []).forEach(function (uid) {
        if (!uid) return;
        if (_shopOwnerCache[uid]) { out[uid] = _shopOwnerCache[uid]; return; }
        if (need.indexOf(uid) === -1) need.push(uid);
    });
    for (var i = 0; i < need.length; i += 30) {
        var chunk = need.slice(i, i + 30);
        try {
            var snap = await firebaseDB.collection('users')
                .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
                .get();
            snap.forEach(function (d) {
                var u = d.data() || {};
                var rec = { email: String(u.email || '').trim(), founding: u.isFoundingSeller === true, phone: String(u.phone || u.phoneNumber || '').trim() };
                _shopOwnerCache[d.id] = rec;
                out[d.id] = rec;
            });
        } catch (e) {
            console.warn('shop owner lookup failed:', e && e.message);
        }
    }
    // Cache the "no user doc" case too, or every panel open re-queries those ids.
    need.forEach(function (uid) {
        if (!out[uid]) {
            out[uid] = { email: '', founding: false };
            _shopOwnerCache[uid] = out[uid];
        }
    });
    return out;
}

/**
 * Payments readiness card — asks the server "can charging collect money right
 * now?" and renders the answer in plain English. Fails soft: if the check can't
 * run, the card says so instead of showing a false all-clear.
 */
async function loadPaymentsReadiness() {
    var body = document.getElementById('readinessBody');
    if (!body) return;
    body.innerHTML = 'Checking…';
    try {
        var res = await firebase.functions().httpsCallable('paymentReadiness')({});
        var d = (res && res.data) || {};
        var facts = d.facts || {};
        var dot = function (state) {
            var map = {
                ok: ['#16a34a', 'ok'], test: ['#f59e0b', 'TEST mode'], off: ['#9aa5b1', 'not set up'],
                on: ['#16a34a', 'ON'], unknown: ['#f59e0b', 'unknown'],
                failed: ['#dc2626', 'last test failed'], untested: ['#f59e0b', 'saved, not tested yet']
            };
            var m = map[state] || ['#9aa5b1', String(state || '—')];
            return '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + m[0] + ';margin-right:6px;"></span>' + m[1];
        };
        var rows = (d.rows || []).map(function (r) {
            return '<div style="display:flex;justify-content:space-between;gap:1rem;padding:0.3rem 0;border-bottom:1px dashed #eef1f4;">' +
                '<span style="font-weight:600;color:#191919;">' + escapeShopsText(r.label) + '</span><span>' + dot(r.state) + '</span></div>';
        }).join('');
        var warns = (d.warnings || []);
        var banner = '';
        if (d.level === 'stop') {
            banner = '<div style="margin-top:0.7rem;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:0.6rem 0.8rem;font-weight:700;">⛔ Fix these before charging sellers:</div>';
        } else if (d.level === 'warn') {
            banner = '<div style="margin-top:0.7rem;background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:10px;padding:0.6rem 0.8rem;font-weight:700;">Heads-up:</div>';
        } else {
            banner = '<div style="margin-top:0.7rem;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:10px;padding:0.6rem 0.8rem;font-weight:700;">✅ All good — payments can collect money.</div>';
        }
        var warnList = warns.length
            ? '<ul style="margin:0.45rem 0 0 1.1rem;padding:0;font-weight:400;">' + warns.map(function (w) {
                return '<li style="margin-bottom:0.3rem;">' + escapeShopsText(w) + '</li>';
            }).join('') + '</ul>'
            : '';
        body.innerHTML = rows + banner + warnList;
    } catch (e) {
        body.innerHTML = '<span style="color:#92400e;">Could not run the check: ' + escapeShopsText(e.message || e) +
            ' — tap Re-check. (Nothing here changes how payments behave; it only reports.)</span>';
    }
}

/* === SHOP WHATSAPP CORE START (pure helpers: no DOM, no network) === */
var SM_ADMIN_SHOP_SITE = 'https://sankofa-market.web.app';
/** Digits for wa.me. 0244705739 becomes 233244705739. Returns '' when it cannot be a phone number. */
function smWaNumber(phone) {
    var raw = String(phone || '').replace(/[^0-9+]/g, '');
    if (raw.charAt(0) === '+') raw = raw.slice(1);
    if (/^0\d{9}$/.test(raw)) raw = '233' + raw.slice(1);
    return /^\d{9,15}$/.test(raw) ? raw : '';
}
/** A WhatsApp link with the message already typed in. The admin can edit it before sending. */
function smWaLink(phone, text) {
    var n = smWaNumber(phone);
    return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(String(text || '')) : '';
}
/** Which ready-made message fits a shop today: free, trial, paid, ended, live or pending. */
function smShopMessageState(store, nowMs) {
    var s = store || {};
    var now = (typeof nowMs === 'number') ? nowMs : Date.now();
    if (s.freeForLife === true) return 'free';
    var plan = s.plan || null;
    if (plan && plan.endsAt) {
        var ends = new Date(plan.endsAt).getTime();
        if (!isNaN(ends)) {
            if (ends > now) return (plan.trial === true || plan.method === 'trial') ? 'trial' : 'paid';
            return 'ended';
        }
    }
    return s.isActive === true ? 'live' : 'pending';
}
/** The ready-made WhatsApp message for a shop, in plain English, with no HTML. */
function smShopMessage(store, nowMs) {
    var s = store || {};
    var state = smShopMessageState(s, nowMs);
    var first = String(s.ownerName || '').trim().split(/\s+/)[0] || 'there';
    var shop = String(s.storeName || 'your shop').trim() || 'your shop';
    var link = SM_ADMIN_SHOP_SITE + '/store/' + String(s.slug || '');
    var endsDate = s.plan && s.plan.endsAt ? new Date(s.plan.endsAt) : null;
    var date = (endsDate && !isNaN(endsDate.getTime()))
        ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Accra' }).format(endsDate)
        : '';
    var hi = 'Hi ' + first + ', ';
    if (state === 'trial') return hi + 'your free trial for "' + shop + '" ends on ' + date + '. Pick a plan from Dashboard → My Store to keep your shop open. Nothing you built is lost either way. ' + link;
    if (state === 'paid') return hi + 'your plan for "' + shop + '" runs until ' + date + '. Thank you for building with Sankofa Market! ' + link;
    if (state === 'ended') return hi + '"' + shop + '" is paused because its plan ended on ' + date + '. Renew from Dashboard → My Store and your shop comes back on. ' + link;
    if (state === 'free') return hi + '"' + shop + '" is free for life on Sankofa Market, so there is nothing to pay. ' + link;
    if (state === 'live') return hi + '"' + shop + '" is approved and live: ' + link + ' Share the link and list a few items to fill your shelves.';
    return hi + 'thank you for applying to sell on Sankofa Market. "' + shop + '" is being reviewed, and we will message you when it is live.';
}
/* === SHOP WHATSAPP CORE END === */

async function loadShopsAdmin() {
    var body = document.getElementById('shopsTableBody');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="7" class="loading">Loading shops...</td></tr>';
    try {
        var snap = await firebaseDB.collection('stores').orderBy('updatedAt', 'desc').limit(100).get();
        var countEl = document.getElementById('countShops');
        if (countEl) countEl.textContent = String(snap.size);

        if (snap.empty) {
            body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#767676;"><i class="fas fa-store-slash" style="font-size:1.4rem;color:#ccc;display:block;margin-bottom:0.4rem;"></i>No shops yet — they appear here when sellers open <b>Dashboard → My Store</b>.</td></tr>';
            return;
        }

        var all = [];
        snap.forEach(function (d) { all.push({ id: d.id, s: d.data() || {} }); });
        var owners = await fetchShopOwners(all.map(function (x) { return x.s.ownerId; }));

        // One-line money picture: live / paid / trial / free — computed from the
        // same docs, so it can never disagree with the rows below.
        (function () {
            var el = document.getElementById('shopsSummary');
            if (!el) return;
            var nowMs = Date.now();
            var live = 0, paid = 0, trial = 0, free = 0, pending = 0;
            all.forEach(function (x) {
                var st = x.s || {};
                var pl = st.plan || null;
                var ends = pl && pl.endsAt ? new Date(pl.endsAt).getTime() : 0;
                var running = ends > nowMs;
                var isTrial = !!(pl && (pl.trial === true || pl.method === 'trial'));
                if (st.isActive !== true) { pending++; return; }
                live++;
                if (running && isTrial) trial++;
                else if (running && !isTrial) paid++;
                else if (!running) free++;
            });
            el.innerHTML = '<b style="color:#191919;">' + live + '</b> live · ' +
                '<b style="color:#7c3aed;">' + paid + '</b> on a paid plan · ' +
                '<b style="color:#0e7490;">' + trial + '</b> on a free trial · ' +
                '<b style="color:#5a6572;">' + free + '</b> free (no plan)' +
                (pending ? ' · <b style="color:#92400e;">' + pending + '</b> pending approval' : '') +
                ' <span style="color:#9aa5b1;">— money picture right now</span>';
        })();

        var rows = [];
        all.forEach(function (item) {
            var d = { id: item.id };
            var s = item.s;
            var own = owners[s.ownerId] || { email: '', founding: false };
            var active = s.isActive === true;
            var updated = s.updatedAt ? String(s.updatedAt).slice(0, 10) : '—';
            var statusPill = active
                ? '<span style="display:inline-block;padding:0.18rem 0.6rem;border-radius:999px;font-size:0.72rem;font-weight:800;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;">🟢 LIVE</span>'
                : '<span style="display:inline-block;padding:0.18rem 0.6rem;border-radius:999px;font-size:0.72rem;font-weight:800;background:#fffbeb;color:#92400e;border:1px solid #fde68a;">🟡 PENDING</span>';
            // Phase 2: show the paid plan under the status pill
            if (s.plan && s.plan.endsAt) {
                var endsMs = new Date(s.plan.endsAt).getTime();
                var planLive = endsMs > Date.now();
                var isTrialPlan = s.plan.trial === true || s.plan.method === 'trial';
                statusPill += '<br><span style="display:inline-block;margin-top:0.25rem;font-size:0.7rem;font-weight:700;color:' + (planLive ? (isTrialPlan ? '#0e7490' : '#7c3aed') : '#9ca3af') + ';">' +
                    (isTrialPlan ? '🎁 trial ' : '👑 ') + escapeShopsText(s.plan.tier || 'plan') + ' ' + (planLive ? 'until' : 'ended') + ' ' + new Date(endsMs).toLocaleDateString('en-GB') +
                    ' <span style="font-weight:400;color:#9aa5b1;">(' + escapeShopsText(s.plan.method || '') + ')</span></span>';
            }
            var logo = (s.logoThumbUrl || s.logoUrl)
                ? '<img src="' + escapeShopsText(s.logoThumbUrl || s.logoUrl) + '" alt="" style="width:34px;height:34px;border-radius:9px;object-fit:cover;vertical-align:middle;margin-right:0.45rem;border:1px solid #e5e7eb;">'
                : '<span style="display:inline-flex;width:34px;height:34px;border-radius:9px;background:#eef2f7;color:#5a6572;align-items:center;justify-content:center;font-weight:800;margin-right:0.45rem;vertical-align:middle;">' + escapeShopsText((s.storeName || '?').charAt(0).toUpperCase()) + '</span>';
            // Contact cell: shop contact email → else the seller's ACCOUNT email → phone.
            var shopEmail = String(s.email || '').trim();
            var acctEmail = String(own.email || '').trim();
            var phone = String(s.phone || '').trim();
            var contactBits = '';
            if (shopEmail) {
                contactBits += '<a href="mailto:' + escapeShopsText(shopEmail) + '" style="color:#0064d2;text-decoration:none;font-weight:700;word-break:break-all;" title="Shop contact email — buyers see this on the shop page">' + escapeShopsText(shopEmail) + '</a>';
            } else if (acctEmail) {
                contactBits += '<a href="mailto:' + escapeShopsText(acctEmail) + '" style="color:#0064d2;text-decoration:none;font-weight:700;word-break:break-all;" title="The seller\'s account email — they have not set a shop contact email yet">' + escapeShopsText(acctEmail) + '</a> <span style="font-size:0.68rem;color:#9aa5b1;font-weight:400;">(account)</span>';
            }
            if (phone) {
                contactBits += (contactBits ? '<br>' : '') + '<a href="tel:' + escapeShopsText(phone.replace(/[^0-9+]/g, '')) + '" style="color:#5a6572;text-decoration:none;">' + escapeShopsText(phone) + '</a>';
            }
            var contactCell = contactBits
                ? '<span style="font-size:0.8rem;line-height:1.5;">' + contactBits + '</span>'
                : '<span style="font-size:0.76rem;color:#9aa5b1;" title="The seller can add a contact email in Dashboard → My Store">— not set</span>';
            var viewBtn = active
                ? '<a href="/store/' + escapeShopsText(s.slug) + '" target="_blank" class="btn btn-outline btn-small" style="margin-right:0.35rem;" title="Open the public shop page"><i class="fas fa-external-link-alt"></i></a>'
                : '';
            var toggleBtn = active
                ? '<button class="btn btn-outline btn-small" style="color:#b91c1c;border-color:#fecaca;" onclick="toggleShopActive(\'' + d.id + '\', false)" title="Switch OFF — the shop disappears from the public"><i class="fas fa-stop-circle"></i> Switch off</button>'
                : '<button class="btn btn-primary btn-small" onclick="toggleShopActive(\'' + d.id + '\', true)" title="Approve — the shop goes live"><i class="fas fa-check-circle"></i> Go live</button>';
            var isFree = s.freeForLife === true;
            if (isFree) statusPill += '<br><span style="display:inline-block;margin-top:0.25rem;font-size:0.7rem;font-weight:700;color:#15803d;">🕊️ free for life</span>';
            var freeBtn = '<button class="btn btn-outline btn-small" style="margin-left:0.35rem;" onclick="setShopFreeForLife(\'' + d.id + '\', ' + (isFree ? 'false' : 'true') + ')" title="' +
                (isFree ? 'Undo: the shop follows the normal plan rules again' : 'Never offer a trial, remind, or switch off for an expired plan') + '">' +
                (isFree ? '🕊️ Undo free for life' : '🕊️ Free for life') + '</button>';
            var waPhone = String(s.phone || '').trim() || String(own.phone || '').trim();
            var waState = smShopMessageState(s, Date.now());
            var waHref = smWaLink(waPhone, smShopMessage(s, Date.now()));
            var waBtn = waHref
                ? '<a class="btn btn-outline btn-small" style="margin-right:0.35rem;color:#15803d;border-color:#bbf7d0;" href="' + escapeShopsText(waHref) + '" target="_blank" rel="noopener" title="Open WhatsApp with a ready message (' + escapeShopsText(waState) + '). You can edit it before sending.">💬 WhatsApp</a>'
                : '<span class="btn btn-outline btn-small" style="margin-right:0.35rem;opacity:0.45;cursor:not-allowed;" title="No phone number on this shop or its owner account">💬 WhatsApp</span>';
            rows.push('<tr>' +
                '<td>' + logo + '<strong>' + escapeShopsText(s.storeName || '—') + '</strong></td>' +
                '<td><code style="font-size:0.78rem;">/store/' + escapeShopsText(s.slug || '—') + '</code></td>' +
                '<td style="font-size:0.82rem;">' + escapeShopsText(s.ownerName || '—') + (own.founding ? ' <span title="Founding Seller — 0% commission" style="color:#f59e0b;">🏆</span>' : '') + '</td>' +
                '<td>' + contactCell + '</td>' +
                '<td>' + statusPill + '</td>' +
                '<td style="font-size:0.78rem;color:#767676;">' + escapeShopsText(updated) + '</td>' +
                '<td style="white-space:nowrap;">' + viewBtn + waBtn + toggleBtn + freeBtn + '</td>' +
                '</tr>');
        });
        body.innerHTML = rows.join('');
    } catch (e) {
        console.error('loadShopsAdmin failed:', e);
        body.innerHTML = '<tr><td colspan="7" style="color:#b91c1c;">Could not load shops: ' + escapeShopsText(e.message || e) + '</td></tr>';
    }
}

// One button flips a shop on/off — the public page respects it instantly
// (storefront reads only ACTIVE stores, enforced by Firestore rules).
async function toggleShopActive(storeId, makeActive) {
    try {
        await firebaseDB.collection('stores').doc(storeId).update({
            isActive: makeActive === true
        });
        if (typeof showFlashMessage === 'function') {
            showFlashMessage(makeActive ? 'Shop is now LIVE 🏪 — tell the seller to share their link!' : 'Shop switched off.', 'success');
        }
        loadShopsAdmin();
    } catch (e) {
        if (typeof showFlashMessage === 'function') showFlashMessage('Could not update shop: ' + (e.message || e), 'error');
    }
}

function escapeShopsText(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.loadShopsAdmin = loadShopsAdmin;
window.toggleShopActive = toggleShopActive;

// Free for life (Tier 5): an admin decision, saved by a function that checks the admin role.
async function setShopFreeForLife(storeId, on) {
    var msg = on
        ? 'Make this shop FREE FOR LIFE?\n\nIt will never be offered a free trial, reminded to pay, or switched off for an expired plan. You can undo this any time.'
        : 'Undo free for life?\n\nThe shop goes back to the normal plan rules.';
    if (!confirm(msg)) return;
    try {
        await firebase.functions().httpsCallable('setStoreFreeForLife')({ uid: storeId, on: on === true });
        if (typeof showFlashMessage === 'function') showFlashMessage(on ? 'Shop is free for life 🕊️' : 'Free for life undone.', 'success');
        loadShopsAdmin();
    } catch (e) {
        if (typeof showFlashMessage === 'function') showFlashMessage('Could not change this shop: ' + ((e && e.message) || 'please try again'), 'error');
    }
}
window.setShopFreeForLife = setShopFreeForLife;

window.escapeShopsText = escapeShopsText;

document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('refreshShopsBtn');
    if (btn) btn.addEventListener('click', loadShopsAdmin);
});

/* ---------- Shop plan billing config (settings/storeBilling) ---------- */
/** Paints the always-visible rent master switch (colour, text, checkbox). */
function paintRentToggle(on) {
    var box = document.getElementById('rentToggleBox');
    var line = document.getElementById('rentToggleLine');
    var toggle = document.getElementById('rentToggle');
    if (toggle) toggle.checked = on === true;
    if (box) {
        box.style.borderColor = on ? '#a7f3d0' : '#fde68a';
        box.style.background = on ? '#ecfdf5' : '#fffbeb';
    }
    if (line) {
        line.innerHTML = on
            ? '<b style="color:#065f46;">ON</b> — shops whose paid plan ends will pause after the grace days (email + in-app reminders first). Shops with no plan are not affected.'
            : '<b style="color:#92400e;">OFF</b> — free launch: every approved shop stays live and nobody pays. Flip it whenever you\'re ready.';
    }
}

/** The switch itself saves — no need to hunt for a Save button after flipping. */
async function applyRentToggle() {
    var toggle = document.getElementById('rentToggle');
    var msg = document.getElementById('billMsg');
    if (!toggle) return;
    var want = toggle.checked;
    if (want && !confirm('Switch rent ON now?\n\nFrom now on, shops whose PAID plan has ended will pause after the grace days.\n\nShops you approved for free (no plan) are NOT affected — they stay live.')) {
        paintRentToggle(false);   // put the switch back where it was
        return;
    }
    var payload = {
        monthly: Number(document.getElementById('billMonthly').value),
        quarterly: Number(document.getElementById('billQuarterly').value),
        yearly: Number(document.getElementById('billYearly').value),
        graceDays: Number(document.getElementById('billGrace').value),
        requirePayment: want
    };
    if (!(payload.monthly >= 1) || !(payload.quarterly >= 1) || !(payload.yearly >= 1)) {
        if (msg) msg.textContent = 'Prices must be at least GHS 1 — fix the price boxes first.';
        paintRentToggle(!want);
        return;
    }
    try {
        await firebase.functions().httpsCallable('saveStoreBillingConfig')(payload);
        if (msg) msg.textContent = want ? 'Saved ✅ Billing ON from now.' : 'Saved ✅ Free launch continues.';
        paintRentToggle(want);
        if (typeof showFlashMessage === 'function') {
            showFlashMessage(want ? 'Rent charging is ON 💰' : 'Rent charging is OFF — free launch continues', 'success');
        }
    } catch (e) {
        if (msg) msg.textContent = 'Could not save the switch: ' + (e.message || e);
        paintRentToggle(!want);   // honest: the server did not accept it
        if (typeof showFlashMessage === 'function') showFlashMessage('Switch not saved: ' + (e.message || e), 'error');
    }
}

/** Paints the "charge approved shops" switch + its plain-English line. */
function paintAutoChargeToggle(on, trialDays) {
    var box = document.getElementById('autoChargeBox');
    var line = document.getElementById('autoChargeLine');
    var toggle = document.getElementById('autoChargeToggle');
    var daysEl = document.getElementById('trialDaysInput');
    if (toggle) toggle.checked = on === true;
    if (daysEl && isFinite(Number(trialDays))) daysEl.value = String(Math.round(Number(trialDays)));
    if (box) {
        box.style.borderColor = on ? '#a7f3d0' : '#e5e7eb';
        box.style.background = on ? '#ecfdf5' : '#f8fafc';
    }
    if (line) {
        line.innerHTML = on
            ? '<b style="color:#065f46;">ON</b> — shops you approve get a free trial, then plans apply. They get a heads-up email first, then the grace days, then the shop pauses until they choose a plan.'
            : '<b style="color:#5a6572;">OFF</b> — shops you approve stay live for free; they are never charged and never paused for payment.';
    }
}

/** The switch saves itself; turning it ON is confirmed, because it starts charging. */
async function applyAutoChargeToggle() {
    var toggle = document.getElementById('autoChargeToggle');
    var msg = document.getElementById('billMsg');
    if (!toggle) return;
    var want = toggle.checked;
    var days = Math.round(Number((document.getElementById('trialDaysInput') || {}).value));
    if (!isFinite(days)) days = 30;
    days = Math.min(365, Math.max(0, days));
    if (want && !confirm('Start charging approved shops?\n\nEvery shop you approved by hand gets a ' + days + '-day FREE trial starting now.\n' +
        'After that they get reminder emails + the grace days, and the shop pauses until they pick a plan.\n\nShops with a paid plan are unaffected.')) {
        paintAutoChargeToggle(false, days);
        return;
    }
    var billingOn = !!(document.getElementById('rentToggle') || {}).checked;
    if (want && !billingOn) {
        if (msg) msg.textContent = 'Turn "Charge rent on shops" ON first — charging approved shops only works while rent is on.';
        paintAutoChargeToggle(false, days);
        return;
    }
    try {
        await firebase.functions().httpsCallable('saveStoreBillingConfig')({
            monthly: Number(document.getElementById('billMonthly').value),
            quarterly: Number(document.getElementById('billQuarterly').value),
            yearly: Number(document.getElementById('billYearly').value),
            graceDays: Number(document.getElementById('billGrace').value),
            requirePayment: billingOn,
            chargeApprovedShops: want,
            trialDays: days
        });
        paintAutoChargeToggle(want, days);
        if (msg) msg.textContent = want ? 'Saved ✅ Approved shops now get trials, then plans.' : 'Saved ✅ Approved shops stay free.';
        if (typeof showFlashMessage === 'function') {
            showFlashMessage(want ? 'Approved shops will be charged after their trial' : 'Approved shops stay free', 'success');
        }
    } catch (e) {
        if (msg) msg.textContent = 'Could not save the switch: ' + (e.message || e);
        paintAutoChargeToggle(!want, days);
        if (typeof showFlashMessage === 'function') showFlashMessage('Switch not saved: ' + (e.message || e), 'error');
    }
}

async function loadStoreBillingAdmin() {
    var msg = document.getElementById('billMsg');
    try {
        var snap = await firebaseDB.collection('settings').doc('storeBilling').get();
        var c = { monthly: 50, quarterly: 135, yearly: 480, graceDays: 3, requirePayment: false, chargeApprovedShops: false, trialDays: 30 };
        if (snap.exists) {
            var d = snap.data();
            c.chargeApprovedShops = d.chargeApprovedShops === true;
            if (isFinite(Number(d.trialDays))) c.trialDays = Math.round(Number(d.trialDays));
            if (isFinite(Number(d.monthly))) c.monthly = Number(d.monthly);
            if (isFinite(Number(d.quarterly))) c.quarterly = Number(d.quarterly);
            if (isFinite(Number(d.yearly))) c.yearly = Number(d.yearly);
            if (isFinite(Number(d.graceDays))) c.graceDays = Math.floor(Number(d.graceDays));
            c.requirePayment = d.requirePayment === true;
        }
        document.getElementById('billMonthly').value = c.monthly;
        document.getElementById('billQuarterly').value = c.quarterly;
        document.getElementById('billYearly').value = c.yearly;
        document.getElementById('billGrace').value = c.graceDays;
        paintRentToggle(c.requirePayment);
        paintAutoChargeToggle(c.chargeApprovedShops, c.trialDays);
        if (msg) msg.textContent = c.requirePayment ? '💰 Billing is ON — expired shops auto-pause.' : '🎉 Free launch — billing is off.';
    } catch (e) {
        if (msg) msg.textContent = 'Could not load pricing: ' + (e.message || e);
        paintRentToggle(false);
    }
}

async function saveStoreBillingAdmin() {
    var msg = document.getElementById('billMsg');
    var payload = {
        monthly: Number(document.getElementById('billMonthly').value),
        quarterly: Number(document.getElementById('billQuarterly').value),
        yearly: Number(document.getElementById('billYearly').value),
        graceDays: Number(document.getElementById('billGrace').value),
        requirePayment: document.getElementById('rentToggle').checked,
        chargeApprovedShops: !!(document.getElementById('autoChargeToggle') || {}).checked,
        trialDays: (function () { var v = Math.round(Number((document.getElementById('trialDaysInput') || {}).value)); return isFinite(v) ? Math.min(365, Math.max(0, v)) : 30; })()
    };
    if (!(payload.monthly >= 1) || !(payload.quarterly >= 1) || !(payload.yearly >= 1)) {
        if (msg) msg.textContent = 'Prices must be at least GHS 1.';
        return;
    }
    try {
        await firebase.functions().httpsCallable('saveStoreBillingConfig')(payload);
        if (msg) msg.textContent = 'Saved ✅' + (payload.requirePayment ? ' Billing ON from now.' : ' Free launch continues.');
        paintRentToggle(payload.requirePayment);
        if (typeof showFlashMessage === 'function') showFlashMessage('Shop pricing saved', 'success');
    } catch (e) {
        if (msg) msg.textContent = 'Save failed: ' + (e.message || e);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('saveBillingBtn');
    if (b) b.addEventListener('click', saveStoreBillingAdmin);
    // The rent master switch saves itself the moment it is flipped
    var t = document.getElementById('rentToggle');
    if (t) t.addEventListener('change', applyRentToggle);
    var ac = document.getElementById('autoChargeToggle');
    if (ac) ac.addEventListener('change', applyAutoChargeToggle);
    var rc = document.getElementById('refreshReadinessBtn');
    if (rc) rc.addEventListener('click', loadPaymentsReadiness);
});

window.loadStoreBillingAdmin = loadStoreBillingAdmin;
window.saveStoreBillingAdmin = saveStoreBillingAdmin;
window.paintRentToggle = paintRentToggle;
window.applyRentToggle = applyRentToggle;
window.paintAutoChargeToggle = paintAutoChargeToggle;
window.applyAutoChargeToggle = applyAutoChargeToggle;
window.loadPaymentsReadiness = loadPaymentsReadiness;

/* ============================================================================
 * HOMEPAGE CAROUSEL — admin-managed promo slides
 * ----------------------------------------------------------------------------
 * Slides live in the `carousel` collection (public read for published slides,
 * admin-only writes). The homepage (js/carousel.js) renders them; the editor
 * here writes them. All sanitising + preview markup reuse the SAME helpers the
 * homepage uses (smCarouselNormalize / smCarouselSlideHtml from carousel.js),
 * so what the admin previews is exactly what buyers see.
 * ==========================================================================*/

var _cSlideId = null;          // Firestore id of the slide being edited (null = new)
var _cSlideImageUrl = '';      // current image URL ('' = no photo)
var _cSlideImageFile = null;   // freshly picked file, uploaded on save
var _cSlideOrder = 0;          // order of the slide being edited
var _cSlideSaving = false;

function carouselEl(id) { return document.getElementById(id); }

function carouselShrinkImage(file) {
    // Upload-ready JPEG, max 1000px wide (slides show at ~500px, retirees ~1920).
    return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
            try {
                var maxW = 1000;
                var scale = Math.min(1, maxW / (img.width || maxW));
                var canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(img.src);
                canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('Could not process that image.')); }, 'image/jpeg', 0.82);
            } catch (e) { reject(e); }
        };
        img.onerror = function () { reject(new Error('Could not read that image.')); };
        img.src = URL.createObjectURL(file);
    });
}

async function loadCarouselAdmin() {
    var body = carouselEl('carouselTableBody');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="5" class="loading">Loading slides...</td></tr>';
    try {
        var snap = await firebaseDB.collection('carousel').orderBy('order', 'asc').limit(50).get();
        if (snap.empty) {
            body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#767676;">' +
                '<i class="fas fa-images" style="font-size:1.4rem;color:#ccc;display:block;margin-bottom:0.4rem;"></i>' +
                'No slides here yet, so the homepage is showing its <b>5 built-in slides</b>.<br>' +
                'Bring them in to edit them, or start fresh:' +
                '<div style="margin-top:0.9rem;display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">' +
                '<button class="btn btn-primary btn-small" onclick="importDefaultCarouselSlides()"><i class="fas fa-download"></i> Import the 5 built-in slides</button>' +
                '<button class="btn btn-outline btn-small" onclick="openCarouselEditor(null)"><i class="fas fa-plus"></i> New blank slide</button>' +
                '</div></td></tr>';
            return;
        }
        var rows = '';
        snap.forEach(function (d) {
            var s = d.data() || {};
            s.id = d.id;
            var n = window.smCarouselNormalize ? window.smCarouselNormalize(s) : s;
            var active = n.isActive;
            var updated = s.updatedAt ? String(s.updatedAt.toDate ? s.updatedAt.toDate().toISOString() : s.updatedAt).slice(0, 10) : '—';
            var swatch = 'linear-gradient(135deg,' + n.bg1 + ',' + n.bg2 + ')';
            var thumb = n.imageUrl
                ? '<img src="' + window.smCarouselEsc(n.imageUrl) + '" alt="" style="width:56px;height:34px;border-radius:7px;object-fit:cover;vertical-align:middle;margin-right:0.5rem;border:1px solid #e5e7eb;">'
                : '<span style="display:inline-block;width:56px;height:34px;border-radius:7px;background:' + swatch + ';vertical-align:middle;margin-right:0.5rem;border:1px solid #e5e7eb;"></span>';
            var title = window.smCarouselEsc(n.title || n.titleAccent || n.tag || '(untitled)');
            var statusPill = active
                ? '<span style="display:inline-block;padding:0.18rem 0.6rem;border-radius:999px;font-size:0.72rem;font-weight:800;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;">🟢 LIVE</span>'
                : '<span style="display:inline-block;padding:0.18rem 0.6rem;border-radius:999px;font-size:0.72rem;font-weight:800;background:#fffbeb;color:#92400e;border:1px solid #fde68a;">🟡 HIDDEN</span>';
            rows += '<tr>' +
                '<td>' + thumb + '<strong>' + title + '</strong>' +
                    (n.subtitle ? '<div style="font-size:0.74rem;color:#767676;margin-top:0.15rem;">' + window.smCarouselEsc(n.subtitle.slice(0, 70)) + (n.subtitle.length > 70 ? '…' : '') + '</div>' : '') +
                '</td>' +
                '<td style="white-space:nowrap;">' +
                    '<button class="btn btn-outline btn-small" onclick="moveCarouselSlide(\'' + d.id + '\',-1)" title="Move up" style="padding:0.2rem 0.45rem;"><i class="fas fa-arrow-up"></i></button> ' +
                    '<button class="btn btn-outline btn-small" onclick="moveCarouselSlide(\'' + d.id + '\',1)" title="Move down" style="padding:0.2rem 0.45rem;"><i class="fas fa-arrow-down"></i></button>' +
                '</td>' +
                '<td>' + statusPill + '</td>' +
                '<td style="font-size:0.78rem;color:#767676;">' + window.smCarouselEsc(updated) + '</td>' +
                '<td style="white-space:nowrap;">' +
                    '<button class="btn btn-outline btn-small" onclick="toggleCarouselActive(\'' + d.id + '\',' + (active ? 'false' : 'true') + ')" title="' + (active ? 'Hide from the homepage' : 'Publish to the homepage') + '" style="margin-right:0.3rem;"><i class="fas fa-' + (active ? 'eye-slash' : 'eye') + '"></i></button>' +
                    '<button class="btn btn-primary btn-small" onclick="openCarouselEditor(\'' + d.id + '\')"><i class="fas fa-edit"></i> Edit</button>' +
                '</td>' +
                '</tr>';
        });
        body.innerHTML = rows;
    } catch (e) {
        console.error('loadCarouselAdmin failed:', e);
        body.innerHTML = '<tr><td colspan="5" style="color:#b91c1c;">Could not load slides: ' + window.smCarouselEsc(e.message || e) + '</td></tr>';
    }
}

function carouselFormValues() {
    function val(id) { var el = carouselEl(id); return el ? el.value : ''; }
    return {
        tag: val('cSlideTag'),
        title: val('cSlideTitle'),
        titleAccent: val('cSlideAccent'),
        subtitle: val('cSlideSub'),
        btnText: val('cSlideBtnText'),
        btnUrl: val('cSlideBtnUrl'),
        btnStyle: val('cSlideBtnStyle') || 'secondary',
        btnIcon: val('cSlideBtnIcon'),
        bg1: val('cSlideBg1'),
        bg2: val('cSlideBg2'),
        textColor: val('cSlideText'),
        accentColor: val('cSlideAccentColor'),
        tagBg: carouselEl('cSlideTagBg') ? carouselEl('cSlideTagBg').value : '',
        tagColor: carouselEl('cSlideTagColor') ? carouselEl('cSlideTagColor').value : '',
        titleSize: val('cSlideTitleSize'),
        bodySize: val('cSlideBodySize'),
        imageUrl: _cSlideImageUrl,
        isActive: carouselEl('cSlideActive') ? carouselEl('cSlideActive').checked : true
    };
}

function paintCarouselPreview() {
    var box = carouselEl('cSlidePreview');
    if (!box || !window.smCarouselNormalize) return;
    var vals = carouselFormValues();
    // Preview-only: an empty headline still shows a hint so the admin sees the colours
    var previewVals = Object.assign({}, vals, {
        title: vals.title || 'Your headline',
        titleAccent: vals.titleAccent || (vals.title ? '' : 'goes here'),
        subtitle: vals.subtitle || 'Your message appears here.'
    });
    var n = window.smCarouselNormalize(previewVals);
    box.innerHTML = window.smCarouselSlideHtml(n);
    if (carouselEl('cTitleSizeVal')) carouselEl('cTitleSizeVal').textContent = String(n.titleSize);
    if (carouselEl('cBodySizeVal')) carouselEl('cBodySizeVal').textContent = String(n.bodySize);
    var prev = carouselEl('cSlideImagePreview');
    if (prev) {
        prev.innerHTML = _cSlideImageUrl
            ? '<img src="' + window.smCarouselEsc(_cSlideImageUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;">'
            : 'No photo';
    }
}

function carouselEditorWireOnce() {
    if (carouselEl('carouselModal').dataset.wired === '1') return;
    carouselEl('carouselModal').dataset.wired = '1';
    ['cSlideTag', 'cSlideTitle', 'cSlideAccent', 'cSlideSub', 'cSlideBtnText', 'cSlideBtnUrl', 'cSlideBtnIcon',
     'cSlideBg1', 'cSlideBg2', 'cSlideText', 'cSlideAccentColor', 'cSlideTagBg', 'cSlideTagColor',
     'cSlideTitleSize', 'cSlideBodySize', 'cSlideBtnStyle'].forEach(function (id) {
        var el = carouselEl(id);
        if (el) el.addEventListener('input', paintCarouselPreview);
        if (el) el.addEventListener('change', paintCarouselPreview);
    });
    carouselEl('cSlideImageInput').addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        _cSlideImageFile = file;
        _cSlideImageUrl = URL.createObjectURL(file);   // instant preview until save
        paintCarouselPreview();
    });
    carouselEl('cSlideImageClear').addEventListener('click', function () {
        _cSlideImageFile = null;
        _cSlideImageUrl = '';
        carouselEl('cSlideImageInput').value = '';
        paintCarouselPreview();
    });
    carouselEl('cSlideSave').addEventListener('click', saveCarouselSlide);
    carouselEl('cSlideDelete').addEventListener('click', function () {
        if (_cSlideId) deleteCarouselSlide(_cSlideId);
    });
    carouselEl('carouselModal').addEventListener('click', function (e) {
        if (e.target === carouselEl('carouselModal')) closeCarouselModal();
    });
}

function setCarouselForm(v) {
    function set(id, val) { var el = carouselEl(id); if (el) el.value = val == null ? '' : String(val); }
    set('cSlideTag', v.tag);
    set('cSlideTitle', v.title);
    set('cSlideAccent', v.titleAccent);
    set('cSlideSub', v.subtitle);
    set('cSlideBtnText', v.btnText);
    set('cSlideBtnUrl', v.btnUrl);
    set('cSlideBtnStyle', v.btnStyle);
    set('cSlideBtnIcon', v.btnIcon);
    set('cSlideBg1', v.bg1);
    set('cSlideBg2', v.bg2);
    set('cSlideText', v.textColor);
    set('cSlideAccentColor', v.accentColor);
    set('cSlideTagBg', v.tagBg || '#000000');
    set('cSlideTagColor', v.tagColor || '#ffffff');
    set('cSlideTitleSize', v.titleSize);
    set('cSlideBodySize', v.bodySize);
    if (carouselEl('cSlideActive')) carouselEl('cSlideActive').checked = v.isActive !== false;
}

function openCarouselEditor(id) {
    carouselEditorWireOnce();
    _cSlideId = id || null;
    _cSlideImageFile = null;
    carouselEl('carouselModalTitle').textContent = id ? 'Edit slide' : 'New slide';
    carouselEl('cSlideDelete').style.display = id ? 'inline-flex' : 'none';

    if (!id) {
        // Sensible starter values for a fresh slide
        _cSlideImageUrl = '';
        _cSlideOrder = 9999;
        setCarouselForm({
            tag: '', title: '', titleAccent: '', subtitle: '', btnText: '', btnUrl: '',
            btnStyle: 'secondary', btnIcon: '', bg1: '#0064d2', bg2: '#002d6b',
            textColor: '#ffffff', accentColor: '#f5af02', tagBg: '', tagColor: '',
            titleSize: 44, bodySize: 18, isActive: true
        });
        carouselEl('cSlideImageInput').value = '';
        paintCarouselPreview();
        carouselEl('carouselModal').style.display = 'flex';
        return;
    }

    carouselEl('carouselTableBody').insertAdjacentHTML('afterbegin',
        '<tr><td colspan="5" style="font-size:0.78rem;color:#767676;">Loading slide…</td></tr>');
    firebaseDB.collection('carousel').doc(id).get().then(function (snap) {
        var row = carouselEl('carouselTableBody').querySelector('tr td[colspan="5"]');
        if (row && row.parentElement && row.parentElement.children.length === 1) row.parentElement.remove();
        if (!snap.exists) { if (typeof showFlashMessage === 'function') showFlashMessage('That slide no longer exists.', 'warning'); return; }
        var s = snap.data() || {};
        var n = window.smCarouselNormalize(Object.assign({}, s, { id: id }));
        _cSlideImageUrl = n.imageUrl;
        _cSlideOrder = n.order;
        setCarouselForm(n);
        carouselEl('cSlideImageInput').value = '';
        paintCarouselPreview();
        carouselEl('carouselModal').style.display = 'flex';
    }).catch(function (e) {
        if (typeof showFlashMessage === 'function') showFlashMessage('Could not open that slide: ' + (e.message || e), 'error');
    });
}

function closeCarouselModal() {
    carouselEl('carouselModal').style.display = 'none';
    _cSlideId = null;
    _cSlideImageFile = null;
}

async function saveCarouselSlide() {
    var btn = carouselEl('cSlideSave');
    if (_cSlideSaving) return;
    _cSlideSaving = true;
    var orig = btn.innerHTML;
    btn.innerHTML = 'Saving…';
    try {
        var vals = carouselFormValues();
        if (!window.smCarouselNormalize) throw new Error('Editor not ready — reload the page.');
        var n = window.smCarouselNormalize(vals);
        if (!n.title && !n.titleAccent && !n.subtitle) {
            throw new Error('Give the slide a headline or a message first.');
        }
        if (n.btnText && !n.btnUrl) {
            throw new Error('The button needs a link (e.g. /search.html?category=electronics).');
        }
        if (vals.btnUrl && !n.btnUrl) {
            throw new Error('That link is not allowed — use a Sankofa page path (/search.html) or an https:// link.');
        }

        // Upload a freshly picked photo (if any) to carousel/{id}.jpg
        var docRef = _cSlideId ? firebaseDB.collection('carousel').doc(_cSlideId) : firebaseDB.collection('carousel').doc();
        if (_cSlideImageFile) {
            btn.innerHTML = 'Uploading photo…';
            var blob = await carouselShrinkImage(_cSlideImageFile);
            var up = await firebase.storage().ref('carousel/' + docRef.id + '.jpg').put(blob);
            n.imageUrl = await up.ref.getDownloadURL();
            _cSlideImageUrl = n.imageUrl;
        }

        // Order: keep existing, or put a new slide at the end
        if (!_cSlideId) {
            var countSnap = await firebaseDB.collection('carousel').orderBy('order', 'desc').limit(1).get();
            var top = 0;
            countSnap.forEach(function (d) { top = Number((d.data() || {}).order) || 0; });
            _cSlideOrder = top + 1;
        }

        var payload = {
            tag: n.tag, title: n.title, titleAccent: n.titleAccent, subtitle: n.subtitle,
            textColor: n.textColor, accentColor: n.accentColor,
            titleSize: n.titleSize, bodySize: n.bodySize,
            bg1: n.bg1, bg2: n.bg2,
            tagBg: n.tagBg, tagColor: n.tagColor,
            imageUrl: n.imageUrl, imageAlt: n.title || n.titleAccent || 'Promotion',
            btnText: n.btnText, btnUrl: n.btnUrl, btnStyle: n.btnStyle, btnIcon: n.btnIcon,
            order: _cSlideOrder,
            isActive: vals.isActive !== false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: (firebase.auth().currentUser || {}).uid || null
        };
        await docRef.set(payload, { merge: true });
        if (typeof showFlashMessage === 'function') {
            showFlashMessage(payload.isActive ? 'Slide saved and LIVE on the homepage 🎠' : 'Slide saved (hidden)', 'success');
        }
        closeCarouselModal();
        loadCarouselAdmin();
    } catch (e) {
        console.error('saveCarouselSlide failed:', e);
        if (typeof showFlashMessage === 'function') showFlashMessage((e && e.message) || 'Could not save the slide.', 'error');
    } finally {
        _cSlideSaving = false;
        btn.innerHTML = orig;
    }
}

async function deleteCarouselSlide(id) {
    if (!confirm('Delete this slide? The homepage stops showing it immediately.')) return;
    try {
        await firebaseDB.collection('carousel').doc(id).delete();
        try { await firebase.storage().ref('carousel/' + id + '.jpg').delete(); } catch (e) { /* no photo or already gone */ }
        if (typeof showFlashMessage === 'function') showFlashMessage('Slide deleted', 'success');
        closeCarouselModal();
        loadCarouselAdmin();
    } catch (e) {
        if (typeof showFlashMessage === 'function') showFlashMessage('Could not delete: ' + (e.message || e), 'error');
    }
}

async function toggleCarouselActive(id, makeActive) {
    try {
        await firebaseDB.collection('carousel').doc(id).update({ isActive: makeActive === true });
        if (typeof showFlashMessage === 'function') {
            showFlashMessage(makeActive ? 'Slide is now LIVE on the homepage' : 'Slide hidden', 'success');
        }
        loadCarouselAdmin();
    } catch (e) {
        if (typeof showFlashMessage === 'function') showFlashMessage('Could not update: ' + (e.message || e), 'error');
    }
}

/**
 * Make the EXISTING homepage slides editable: copy the 5 built-in slides into
 * the carousel collection (deterministic ids default-1…default-5, so tapping
 * twice can never create duplicates, and an already-edited slide is never
 * overwritten). Imported slides are appended after any slides that already
 * exist, so the admin's current line-up stays first.
 */
async function importDefaultCarouselSlides() {
    try {
        if (typeof window.smCarouselDefaultDocs !== 'function') {
            throw new Error('Editor not ready — reload the page and try again.');
        }
        var defaults = window.smCarouselDefaultDocs();
        var snap = await firebaseDB.collection('carousel').limit(50).get();
        var have = {}, top = 0;
        snap.forEach(function (d) {
            have[d.id] = true;
            var o = Number((d.data() || {}).order);
            if (isFinite(o) && o > top) top = o;
        });
        var toWrite = defaults.filter(function (item) { return !have[item.id]; });
        if (!toWrite.length) {
            if (typeof showFlashMessage === 'function') showFlashMessage('The built-in slides are already in your editor — edit them below.', 'info');
            return;
        }
        var batch = firebaseDB.batch();
        toWrite.forEach(function (item, i) {
            var payload = Object.assign({}, item.data, {
                order: top + 1 + i,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: (firebase.auth().currentUser || {}).uid || null
            });
            batch.set(firebaseDB.collection('carousel').doc(item.id), payload);
        });
        await batch.commit();
        if (typeof showFlashMessage === 'function') {
            showFlashMessage(toWrite.length + ' homepage slide' + (toWrite.length === 1 ? '' : 's') +
                ' imported — edit them below. They are live on the homepage now.', 'success');
        }
        loadCarouselAdmin();
    } catch (e) {
        console.error('importDefaultCarouselSlides failed:', e);
        if (typeof showFlashMessage === 'function') {
            showFlashMessage('Could not import the slides: ' + ((e && e.message) || e), 'error');
        }
    }
}

async function moveCarouselSlide(id, dir) {
    try {
        var snap = await firebaseDB.collection('carousel').orderBy('order', 'asc').limit(50).get();
        var list = [];
        snap.forEach(function (d) { list.push({ id: d.id, order: Number((d.data() || {}).order) || 0 }); });
        var idx = -1;
        for (var i = 0; i < list.length; i++) if (list[i].id === id) idx = i;
        var swap = idx + (dir < 0 ? -1 : 1);
        if (idx === -1 || swap < 0 || swap >= list.length) return;   // already at the end
        var a = list[idx], b = list[swap];
        var batch = firebaseDB.batch();
        batch.update(firebaseDB.collection('carousel').doc(a.id), { order: b.order });
        batch.update(firebaseDB.collection('carousel').doc(b.id), { order: a.order });
        await batch.commit();
        loadCarouselAdmin();
    } catch (e) {
        if (typeof showFlashMessage === 'function') showFlashMessage('Could not reorder: ' + (e.message || e), 'error');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var b = carouselEl('carouselNewBtn');
    if (b) b.addEventListener('click', function () { openCarouselEditor(null); });
    var imp = carouselEl('carouselImportBtn');
    if (imp) imp.addEventListener('click', function () {
        if (confirm('Bring the 5 built-in homepage slides into this editor so you can edit them?\n\nThey appear on the homepage straight away, and nothing you already created is changed.')) {
            importDefaultCarouselSlides();
        }
    });
});

window.loadCarouselAdmin = loadCarouselAdmin;
window.importDefaultCarouselSlides = importDefaultCarouselSlides;
window.openCarouselEditor = openCarouselEditor;
window.closeCarouselModal = closeCarouselModal;
window.saveCarouselSlide = saveCarouselSlide;
window.deleteCarouselSlide = deleteCarouselSlide;
window.toggleCarouselActive = toggleCarouselActive;
window.moveCarouselSlide = moveCarouselSlide;
