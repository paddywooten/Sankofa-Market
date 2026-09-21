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
    loadAdminProducts(); loadNavCounts();
    initStoreProfile();
    initStoreManagement();
    initCommissionRates();
    loadNavCounts();

    // Product filters are hooked up in initProductManagement()
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
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding section
            sections.forEach(sec => sec.classList.remove('active'));
            document.getElementById(`section-${section}`).classList.add('active');
        });
    });
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
// ADD PRODUCT MODAL
// ============================================================================

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
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="productDescription">Description *</label>
                        <textarea id="productDescription" required rows="4" placeholder="Describe your product in detail..."></textarea>
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
                    
                    <div class="form-group">
                        <label>Delivery Options</label>
                        <div class="checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" name="delivery" value="free-delivery">
                                <span>Free Delivery</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="delivery" value="paid-delivery">
                                <span>Paid Delivery</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="delivery" value="pickup-only">
                                <span>Pickup Only</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="productFeatured">
                            <span>Mark as Featured Product</span>
                        </label>
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
    loadCustomCategoriesIntoModal();
    
    // Initialize form submission
    const form = document.getElementById('addProductForm');
    form.addEventListener('submit', handleAddProduct);
}

function closeAddProductModal() {
    const modal = document.getElementById('addProductModal');
    if (modal) {
        modal.remove();
    }
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
    
    const formData = {
        title: document.getElementById('productTitle').value,
        category: document.getElementById('productCategory').value,
        description: document.getElementById('productDescription').value,
        price: parseFloat(document.getElementById('productPrice').value),
        condition: document.getElementById('productCondition').value,
        location: document.getElementById('productLocation').value,
        seller: document.getElementById('productSeller').value,
        delivery: Array.from(document.querySelectorAll('input[name="delivery"]:checked')).map(cb => cb.value),
        featured: document.getElementById('productFeatured').checked
    };
    
    // Validate form
    if (!formData.title || !formData.category || !formData.description || !formData.price || !formData.condition || !formData.location || !formData.seller) {
        alert('Please fill in all required fields');
        return;
    }

    // Get uploaded image URLs from preview
    var uploadedImages = [];
    var previewImgs = document.querySelectorAll('#imagePreview img');
    previewImgs.forEach(function(img) {
        if (img.src) uploadedImages.push(img.src);
    });

    // Build the product document for Firestore
    // Determine seller info
    var isSankofaStore = formData.seller === 'sankofa-store';
    var isStoreId = formData.seller && formData.seller.startsWith('store_');
    var storeData = isStoreId ? storesCache.find(function(s) { return 'store_' + s.id === formData.seller; }) : null;
    var sellerName = isSankofaStore ? 'Sankofa Store' : (storeData ? storeData.name : (formData.seller === 'verified-seller' ? 'Verified Seller' : 'Individual Seller'));
    var isVerified = isSankofaStore || formData.seller === 'verified-seller' || !!storeData;

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
        isVerifiedSeller: isVerified,
        isFeatured: formData.featured,
        isActive: true,
        isSold: false,
        views: 0,
        images: uploadedImages,
        photos: uploadedImages,
        deliveryOptions: formData.delivery,
        sellerId: (typeof firebase !== 'undefined' && firebase.auth().currentUser) ? firebase.auth().currentUser.uid : 'admin',
        createdAt: (typeof firebase !== 'undefined') ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
    };

    // Disable submit button
    var submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        // Save to Firestore
        firebaseDB.collection('products').add(productData)
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

// ============================================================================
// EDIT PRODUCT
// ============================================================================

function editProduct(productId) {
    // In a real app, this would fetch product data from API
    console.log('Editing product:', productId);
    
    // For now, open add product modal (in real app, this would be edit modal with pre-filled data)
    openAddProductModal();
}

// ============================================================================
// DELETE PRODUCT
// ============================================================================

function deleteProduct(productId, productName) {
    if (confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
        // Simulate API call
        console.log('Deleting product:', productId);
        
        // Show success message
        showFlashMessage('Product deleted successfully!', 'success');
        
        // Remove row from table (in real app, this would be done after API success)
        setTimeout(() => {
            const row = document.querySelector(`tr:has(.table-sub:contains("${productId}"))`);
            if (row) {
                row.remove();
            }
        }, 500);
    }
}

// ============================================================================
// APPROVE PRODUCT (for pending products)
// ============================================================================

function approveProduct(productId) {
    if (confirm('Are you sure you want to approve this product?')) {
        // Simulate API call
        console.log('Approving product:', productId);
        
        // Show success message
        showFlashMessage('Product approved successfully!', 'success');
        
        // Update row status (in real app, this would be done after API success)
        setTimeout(() => {
            const row = document.querySelector(`tr:has(.table-sub:contains("${productId}"))`);
            if (row) {
                const statusCell = row.querySelector('.status-pill');
                statusCell.className = 'status-pill success';
                statusCell.textContent = 'Active';
                
                // Change action buttons
                const actionsCell = row.querySelector('.table-actions');
                actionsCell.innerHTML = `
                    <button class="action-btn" title="View"><i class="fas fa-eye"></i></button>
                    <button class="action-btn" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn danger" title="Delete"><i class="fas fa-trash"></i></button>
                `;
                
                // Re-initialize action buttons
                initProductActions();
            }
        }, 500);
    }
}

// ============================================================================
// REJECT PRODUCT (for pending products)
// ============================================================================

function rejectProduct(productId) {
    const reason = prompt('Please provide a reason for rejection:');
    
    if (reason) {
        // Simulate API call
        console.log('Rejecting product:', productId, 'Reason:', reason);
        
        // Show success message
        showFlashMessage('Product rejected successfully!', 'success');
        
        // Remove row from table (in real app, this would be done after API success)
        setTimeout(() => {
            const row = document.querySelector(`tr:has(.table-sub:contains("${productId}"))`);
            if (row) {
                row.remove();
            }
        }, 500);
    }
}

// ============================================================================
// REVIEW PRODUCT (for flagged products)
// ============================================================================

function reviewProduct(productId) {
    // In a real app, this would open a detailed review modal
    console.log('Reviewing product:', productId);
    
    alert('Product review feature coming soon!');
}

// ============================================================================
// REMOVE PRODUCT (for flagged products)
// ============================================================================

function removeProduct(productId) {
    if (confirm('Are you sure you want to remove this flagged product? This action cannot be undone.')) {
        // Simulate API call
        console.log('Removing product:', productId);
        
        // Show success message
        showFlashMessage('Product removed successfully!', 'success');
        
        // Remove row from table (in real app, this would be done after API success)
        setTimeout(() => {
            const row = document.querySelector(`tr:has(.table-sub:contains("${productId}"))`);
            if (row) {
                row.remove();
            }
        }, 500);
    }
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#767676;"><p>Firebase not connected</p></td></tr>';
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#767676;"><i class="fas fa-users" style="font-size:2rem;color:#ccc;display:block;margin-bottom:0.5rem;"></i><p>' + (searchTerm ? 'No users match your search' : 'No registered users yet') + '</p></td></tr>';
        return;
    }
    
    var html = '';
    filtered.forEach(function(u) {
        var name = u.name || (u.firstName ? u.firstName + ' ' + (u.lastName || '') : 'Unknown');
        var email = u.email || '—';
        var phone = u.phone || '—';
        var status = u.status || 'pending';
        var statusClass = status === 'approved' ? 'delivered' : (status === 'pending' ? 'pending' : 'cancelled');
        var statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
        
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
        } else {
            actions = '<button class="btn btn-small" onclick="approveUser(' + "'" + u.id + "'" + ')" style="padding:0.3rem 0.6rem;font-size:0.75rem;background:#22c55e;color:white;border:none;"><i class="fas fa-check"></i> Approve</button>';
        }
        
        html += '<tr>' +
            '<td><div style="display:flex;align-items:center;gap:0.65rem;">' + avatarHtml + '<strong style="font-size:0.85rem;">' + name + '</strong></div></td>' +
            '<td style="font-size:0.85rem;">' + email + '</td>' +
            '<td style="font-size:0.85rem;">' + phone + '</td>' +
            '<td><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
            '<td style="font-size:0.82rem;color:#767676;">' + joinDate + '</td>' +
            '<td>' + actions + '</td>' +
        '</tr>';
    });
    
    tbody.innerHTML = html;
}

function approveUser(userId) {
    if (typeof firebaseDB === 'undefined') return;
    firebaseDB.collection('users').doc(userId).update({ status: 'approved' }).then(function() {
        showFlashMessage('User approved!', 'success');
        loadAdminUsers();
    }).catch(function(err) {
        showFlashMessage('Error: ' + err.message, 'error');
    });
}

function blockUser(userId) {
    if (!confirm('Block this user? They will not be able to log in.')) return;
    if (typeof firebaseDB === 'undefined') return;
    firebaseDB.collection('users').doc(userId).update({ status: 'blocked' }).then(function() {
        showFlashMessage('User blocked', 'success');
        loadAdminUsers();
    }).catch(function(err) {
        showFlashMessage('Error: ' + err.message, 'error');
    });
}

// ============================================================================
// ORDER MANAGEMENT
// ============================================================================

function initOrderManagement() {
    // Initialize order management functionality
    console.log('Order management initialized');
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
    
    // First show the 13 built-in categories
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
        { id: 'real-estate', name: 'Real Estate', icon: 'fa-building', color: '#607d8b' }
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
            '<h4>' + (cat.name || 'Untitled') + (isCustom ? ' <span style="font-size:0.65rem;color:#767676;">(custom)</span>' : '') + '</h4>' +
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
        'fa-clock','fa-watch','fa-stopwatch','fa-hourglass-half',
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
            '<button onclick="document.getElementById(\'categoryModal\').remove()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:#767676;"><i class="fas fa-times"></i></button>' +
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
    
    if (globalSearch) {
        globalSearch.addEventListener('input', debounce(function() {
            const query = this.value.toLowerCase();
            console.log('Global search:', query);
            // In a real app, this would search across all data
        }, 300));
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

function showFlashMessage(message, type = 'info') {
    const flash = document.createElement('div');
    flash.className = `flash-message ${type}`;
    flash.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(flash);
    
    setTimeout(() => {
        flash.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        flash.classList.remove('show');
        setTimeout(() => {
            flash.remove();
        }, 300);
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

function deleteUser(userId, userName) {
    if (confirm(`Are you sure you want to delete "${userName}"? This action cannot be undone.`)) {
        console.log('Deleting user:', userId);
        showFlashMessage('User deleted successfully!', 'success');
        
        setTimeout(() => {
            const row = document.querySelector(`tr:has(.table-sub:contains("${userId}"))`);
            if (row) {
                row.remove();
            }
        }, 500);
    }
}

function approveUser(userId) {
    if (confirm('Are you sure you want to approve this user?')) {
        console.log('Approving user:', userId);
        showFlashMessage('User approved successfully!', 'success');
        
        setTimeout(() => {
            const row = document.querySelector(`tr:has(.table-sub:contains("${userId}"))`);
            if (row) {
                const statusCell = row.querySelector('.status-pill');
                statusCell.className = 'status-pill success';
                statusCell.textContent = 'Active';
                
                const actionsCell = row.querySelector('.table-actions');
                actionsCell.innerHTML = `
                    <button class="action-btn" title="View"><i class="fas fa-eye"></i></button>
                    <button class="action-btn" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn danger" title="Block"><i class="fas fa-ban"></i></button>
                    <button class="action-btn danger" title="Suspend"><i class="fas fa-ban"></i></button>
                `;
                
                initUserActions();
            }
        }, 500);
    }
}

function rejectUser(userId) {
    const reason = prompt('Please provide a reason for rejection:');
    
    if (reason) {
        console.log('Rejecting user:', userId, 'Reason:', reason);
        showFlashMessage('User rejected successfully!', 'success');
        
        setTimeout(() => {
            const row = document.querySelector(`tr:has(.table-sub:contains("${userId}"))`);
            if (row) {
                row.remove();
            }
        }, 500);
    }
}

function reactivateUser(userId) {
    if (confirm('Are you sure you want to reactivate this user?')) {
        console.log('Reactivating user:', userId);
        showFlashMessage('User reactivated successfully!', 'success');
        
        setTimeout(() => {
            const row = document.querySelector(`tr:has(.table-sub:contains("${userId}"))`);
            if (row) {
                const statusCell = row.querySelector('.status-pill');
                statusCell.className = 'status-pill success';
                statusCell.textContent = 'Active';
                
                const actionsCell = row.querySelector('.table-actions');
                actionsCell.innerHTML = `
                    <button class="action-btn" title="View"><i class="fas fa-eye"></i></button>
                    <button class="action-btn" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn danger" title="Block"><i class="fas fa-ban"></i></button>
                    <button class="action-btn danger" title="Suspend"><i class="fas fa-ban"></i></button>
                `;
                
                initUserActions();
            }
        }, 500);
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
    approveUser,
    rejectUser,
    reactivateUser
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
var activeStoreFilter = 'all';

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

function loadAdminProducts() {
    var tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    if (typeof firebaseDB === 'undefined' || firebaseDB === null) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#767676;"><p>Firebase not connected</p></td></tr>';
        return;
    }

    firebaseDB.collection('products').orderBy('createdAt', 'desc').limit(50).get()
        .then(function(snapshot) {
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#767676;"><i class="fas fa-box-open" style="font-size:2rem;color:#ccc;"></i><p>No products yet. Click "Add Product" to create one.</p></td></tr>';
                return;
            }

            adminProductsCache = [];
            snapshot.forEach(function(doc) {
                adminProductsCache.push({ id: doc.id, ...doc.data() });
            });

            renderAdminProducts(adminProductsCache);
            updateStoreCounts();
        })
        .catch(function(error) {
            // Fallback without orderBy
            firebaseDB.collection('products').limit(50).get()
                .then(function(snapshot) {
                    if (snapshot.empty) {
                        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#767676;"><i class="fas fa-box-open" style="font-size:2rem;color:#ccc;"></i><p>No products yet.</p></td></tr>';
                        return;
                    }
                    adminProductsCache = [];
                    snapshot.forEach(function(doc) {
                        adminProductsCache.push({ id: doc.id, ...doc.data() });
                    });
                    renderAdminProducts(adminProductsCache);
                    updateStoreCounts();
                })
                .catch(function(err) {
                    console.error('Error loading products:', err);
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#e74c3c;"><p>Error loading products: ' + err.message + '</p></td></tr>';
                });
        });
}

function renderAdminProducts(products) {
    var tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#767676;"><i class="fas fa-search" style="font-size:2rem;color:#ccc;"></i><p>No products match your filters</p></td></tr>';
        return;
    }

    var html = '';
    products.forEach(function(p) {
        var images = p.images || p.photos || [];
        var imgSrc = images.length > 0 ? images[0] : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80&h=80&fit=crop&q=75';
        var status = p.isSold ? 'sold' : (p.isActive ? 'active' : 'inactive');
        var statusLabel = p.isSold ? 'Sold' : (p.isActive ? 'Active' : 'Inactive');
        var statusClass = p.isSold ? 'cancelled' : (p.isActive ? 'active' : 'draft');
        var date = p.createdAt ? (p.createdAt.toDate ? p.createdAt.toDate().toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()) : '—';
        var sellerLabel = p.isSankofaStore ? '<span style="color:#0064d2;font-weight:600;">🏪 Sankofa Store</span>' : (p.sellerName || 'Unknown');
        var featuredBadge = p.isFeatured ? ' <span style="background:#f5af02;color:#000;padding:0.1rem 0.4rem;border-radius:50px;font-size:0.65rem;font-weight:600;">⭐ Featured</span>' : '';

        // Store label
        var storeLabel = '';
        if (p.isSankofaStore) {
            storeLabel = '<span style="color:#f5af02;font-weight:600;font-size:0.8rem;">🏪 Sankofa Store</span>';
        } else if (p.storeId && p.sellerName) {
            var storeImg = p.storeProfilePicture ? '<img src="' + p.storeProfilePicture + '" style="width:16px;height:16px;border-radius:50%;object-fit:cover;vertical-align:middle;"> ' : '';
            storeLabel = '<span style="color:#0064d2;font-weight:500;font-size:0.8rem;">' + storeImg + p.sellerName + '</span>';
        } else {
            storeLabel = '<span style="color:#767676;font-size:0.8rem;">🏷️ Marketplace</span>';
        }

        html += '<tr>' +
            '<td><div style="display:flex;align-items:center;gap:0.75rem;">' +
                '<img src="' + imgSrc + '" style="width:48px;height:48px;border-radius:8px;object-fit:cover;" loading="lazy">' +
                '<div><strong style="font-size:0.85rem;">' + (p.title || 'Untitled') + '</strong>' + featuredBadge +
                '<br><small style="color:#767676;">' + (p.condition || '') + '</small></div>' +
            '</div></td>' +
            '<td>' + storeLabel + '</td>' +
            '<td><span style="text-transform:capitalize;">' + (p.category || '—').replace(/-/g, ' ') + '</span></td>' +
            '<td><strong>GH₵ ' + (p.price ? p.price.toLocaleString() : '0') + '</strong></td>' +
            '<td><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
            '<td style="font-size:0.82rem;color:#767676;">' + date + '</td>' +
            '<td><div style="display:flex;gap:0.35rem;">' +
                '<button class="btn btn-outline btn-small" onclick="viewAdminProduct(\'' + p.id + '\')" title="View" style="padding:0.3rem 0.5rem;font-size:0.75rem;"><i class="fas fa-eye"></i></button>' +
                '<button class="btn btn-outline btn-small" onclick="toggleFeaturedProduct(\'' + p.id + '\',' + !p.isFeatured + ')" title="' + (p.isFeatured ? 'Unfeature' : 'Feature') + '" style="padding:0.3rem 0.5rem;font-size:0.75rem;"><i class="fas fa-star"></i></button>' +
                '<button class="btn btn-small" onclick="deleteAdminProduct(\'' + p.id + '\',\'' + (p.title || '').replace(/'/g, "\\'") + '\')" title="Delete" style="padding:0.3rem 0.5rem;font-size:0.75rem;background:#e74c3c;color:white;border:none;"><i class="fas fa-trash"></i></button>' +
            '</div></td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
}

// Filter/search products
function filterAdminProducts() {
    var search = (document.getElementById('productSearch')?.value || '').toLowerCase();
    var category = document.getElementById('productCategoryFilter')?.value || '';
    var status = document.getElementById('productStatusFilter')?.value || '';

    var filtered = adminProductsCache.filter(function(p) {
        var matchSearch = !search || (p.title || '').toLowerCase().includes(search) || (p.description || '').toLowerCase().includes(search);
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
    if (!confirm('Delete "' + title + '"? This cannot be undone.')) return;
    if (typeof firebaseDB === 'undefined') return;
    firebaseDB.collection('products').doc(id).delete()
        .then(function() {
            showFlashMessage('Product deleted', 'success');
            loadAdminProducts(); loadNavCounts();
        })
        .catch(function(err) { showFlashMessage('Error: ' + err.message, 'error'); });
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
            '<p style="font-size:0.78rem;color:#767676;margin:0.25rem 0;">' + (store.tagline || 'No tagline') + '</p>' +
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
            '<button onclick="document.getElementById(\'storeModal\').remove()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:#767676;"><i class="fas fa-times"></i></button>' +
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
    }).catch(function() {
        // Try 'chats' collection as fallback
        firebaseDB.collection('chats').get().then(function(snap2) {
            updateCount('countMessages', snap2.size);
        }).catch(function() {});
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

    // Categories count (from adminCategoriesCache - loaded by loadAdminCategories)
    if (typeof adminCategoriesCache !== 'undefined' && adminCategoriesCache.length > 0) {
        updateCount('countCategories', adminCategoriesCache.length);
    } else {
        // If cache not loaded yet, count built-in categories
        updateCount('countCategories', 0);
    }

    // Stores count (excluding built-in Sankofa Store)
    firebaseDB.collection('stores').get().then(function(snap) {
        updateCount('countStores', snap.size);
    }).catch(function() {});
}

function updateCount(elementId, count) {
    var el = document.getElementById(elementId);
    if (!el) return;
    
    var displayCount = count > 999 ? '999+' : count.toString();
    el.textContent = displayCount;
    el.setAttribute('data-count', count);
    
    // Hide if zero
    if (count === 0) {
        el.style.opacity = '0.4';
    } else {
        el.style.opacity = '1';
    }
}

// ============================================================================
// COMMISSION RATES MANAGEMENT
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
    'real-estate': { name: 'Real Estate', icon: 'fa-building', rate: 3 }
};

function initCommissionRates() {
    var grid = document.getElementById('commissionRatesGrid');
    var saveBtn = document.getElementById('saveCommissionBtn');
    if (!grid) return;

    // Load rates from Firestore or use defaults
    var rates = Object.assign({}, defaultCommissionRates);

    if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        firebaseDB.collection('settings').doc('commissionRates').get().then(function(doc) {
            if (doc.exists) {
                var saved = doc.data();
                Object.keys(saved).forEach(function(key) {
                    if (rates[key]) {
                        rates[key].rate = parseFloat(saved[key]) || rates[key].rate;
                    }
                });
            }
            renderCommissionGrid(grid, rates);
        }).catch(function() {
            renderCommissionGrid(grid, rates);
        });
    } else {
        renderCommissionGrid(grid, rates);
    }

    // Save button
    if (saveBtn) {
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
                '<span style="font-size: 0.82rem; color: #767676; font-weight: 600;">%</span>' +
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
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    var statusEl = document.getElementById('commissionStatus');

    if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        firebaseDB.collection('settings').doc('commissionRates').set(rates).then(function() {
            if (statusEl) statusEl.innerHTML = '<span style="color: #22c55e;"><i class="fas fa-check-circle"></i> Commission rates saved!</span>';
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Commission Rates';
        }).catch(function(err) {
            if (statusEl) statusEl.innerHTML = '<span style="color: #e74c3c;">Error: ' + err.message + '</span>';
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Commission Rates';
        });
    } else {
        if (statusEl) statusEl.innerHTML = '<span style="color: #e74c3c;">Firebase not connected</span>';
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Commission Rates';
    }
}

// ============================================================================
// LOAD CUSTOM CATEGORIES INTO ADD PRODUCT MODAL
// ============================================================================

function loadCustomCategoriesIntoModal() {
    var select = document.getElementById('productCategory');
    if (!select) return;

    var builtInIds = ['electronics','fashion','home-garden','vehicles','services','sports','books-media','baby-kids','beauty-health','food-groceries','pets','jobs-skills','real-estate'];

    // Use adminCategoriesCache if available
    if (typeof adminCategoriesCache !== 'undefined' && adminCategoriesCache.length > 0) {
        adminCategoriesCache.forEach(function(cat) {
            if (builtInIds.indexOf(cat.id) < 0) {
                // Custom category - add to dropdown
                var opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name || cat.id;
                select.appendChild(opt);
            } else {
                // Built-in - update label if edited
                if (cat.name) {
                    Array.from(select.options).forEach(function(existingOpt) {
                        if (existingOpt.value === cat.id) {
                            existingOpt.textContent = cat.name;
                        }
                    });
                }
            }
        });
        return;
    }

    // Fallback: load from Firestore
    if (typeof firebaseDB !== 'undefined' && firebaseDB !== null) {
        firebaseDB.collection('categories').get().then(function(snapshot) {
            snapshot.forEach(function(doc) {
                var data = doc.data();
                if (data.isActive === false) return;
                
                if (builtInIds.indexOf(doc.id) < 0) {
                    var opt = document.createElement('option');
                    opt.value = doc.id;
                    opt.textContent = data.name || doc.id;
                    select.appendChild(opt);
                } else if (data.name) {
                    Array.from(select.options).forEach(function(existingOpt) {
                        if (existingOpt.value === doc.id) {
                            existingOpt.textContent = data.name;
                        }
                    });
                }
            });
        }).catch(function() {});
    }
}


function viewVerification(userId) {
    var user = adminUsersCache.find(function(u) { return u.id === userId; });
    if (!user || !user.ghanaCard || !user.passportPhoto) {
        alert('Verification data not found');
        return;
    }
    
    // Create modal
    var modal = document.createElement('div');
    modal.id = 'verificationModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    
    modal.innerHTML = '<div style="background:white;border-radius:12px;padding:2rem;max-width:800px;width:100%;max-height:90vh;overflow-y:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">' +
            '<h2 style="margin:0;"><i class="fas fa-id-card"></i> Seller Verification Review</h2>' +
            '<button onclick="document.getElementById(\'verificationModal\').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#767676;"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem;">' +
            '<div>' +
                '<h3 style="font-size:1rem;margin-bottom:0.5rem;">Ghana Card</h3>' +
                '<img src="' + user.ghanaCard.photoURL + '" style="width:100%;border-radius:8px;border:2px solid #e5e5e5;">' +
                '<p style="margin-top:0.5rem;font-size:0.9rem;"><strong>Card Number:</strong> ' + (user.ghanaCard.number || 'N/A') + '</p>' +
            '</div>' +
            '<div>' +
                '<h3 style="font-size:1rem;margin-bottom:0.5rem;">Passport Photo</h3>' +
                '<img src="' + user.passportPhoto + '" style="width:100%;border-radius:8px;border:2px solid #e5e5e5;">' +
                '<p style="margin-top:0.5rem;font-size:0.9rem;"><strong>Name:</strong> ' + (user.name || user.firstName || 'N/A') + '</p>' +
            '</div>' +
        '</div>' +
        '<div style="background:#f5f5f5;padding:1rem;border-radius:8px;margin-bottom:1.5rem;">' +
            '<p style="margin:0;font-size:0.9rem;"><strong>Email:</strong> ' + (user.email || 'N/A') + '</p>' +
            '<p style="margin:0.5rem 0 0;font-size:0.9rem;"><strong>Phone:</strong> ' + (user.phone || 'N/A') + '</p>' +
            '<p style="margin:0.5rem 0 0;font-size:0.9rem;"><strong>Submitted:</strong> ' + (user.verificationSubmittedAt ? new Date(user.verificationSubmittedAt.seconds * 1000).toLocaleString() : 'N/A') + '</p>' +
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
    
    // Close on backdrop click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.remove();
    });
}

function approveVerification(userId) {
    if (!confirm('Approve this seller verification? They will be able to list products.')) return;
    
    if (typeof firebaseDB === 'undefined') return;
    
    firebaseDB.collection('users').doc(userId).update({
        verified: true,
        verificationStatus: 'approved',
        verificationApprovedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        alert('Seller verified successfully!');
        document.getElementById('verificationModal').remove();
        loadAdminUsers();
    }).catch(function(err) {
        alert('Error approving verification: ' + err.message);
    });
}

function rejectVerification(userId) {
    var reason = prompt('Reason for rejection (optional):');
    if (reason === null) return;
    
    if (typeof firebaseDB === 'undefined') return;
    
    firebaseDB.collection('users').doc(userId).update({
        verified: false,
        verificationStatus: 'rejected',
        verificationRejectionReason: reason || '',
        verificationRejectedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        alert('Verification rejected.');
        document.getElementById('verificationModal').remove();
        loadAdminUsers();
    }).catch(function(err) {
        alert('Error rejecting verification: ' + err.message);
    });
}
