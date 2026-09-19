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
    loadAdminProducts();
    initStoreProfile();
    initStoreManagement();

    // Hook up product filters
    var productSearch = document.getElementById('productSearch');
    var categoryFilter = document.getElementById('productCategoryFilter');
    var statusFilter = document.getElementById('productStatusFilter');
    if (productSearch) productSearch.addEventListener('input', filterAdminProducts);
    if (categoryFilter) categoryFilter.addEventListener('change', filterAdminProducts);
    if (statusFilter) statusFilter.addEventListener('change', filterAdminProducts);
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
    
    // Product search
    if (productSearch) {
        productSearch.addEventListener('input', debounce(function() {
            filterProducts();
        }, 300));
    }
    
    // Category filter
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            filterProducts();
        });
    }
    
    // Status filter
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            filterProducts();
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
                                <p>Click to upload images (max 8)</p>
                                <small>JPG, PNG up to 5MB each</small>
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
    
    if (input) {
        input.addEventListener('change', function(e) {
            const files = Array.from(e.target.files);
            
            if (files.length > 8) {
                alert('Maximum 8 images allowed');
                return;
            }
            
            preview.innerHTML = '';
            files.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imgDiv = document.createElement('div');
                    imgDiv.className = 'preview-image';
                    imgDiv.innerHTML = `
                        <img src="${e.target.result}" alt="Preview ${index + 1}">
                        <button type="button" class="remove-image" onclick="removeImage(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                    preview.appendChild(imgDiv);
                };
                reader.readAsDataURL(file);
            });
        });
    }
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

// ============================================================================
// FILTER PRODUCTS
// ============================================================================

function filterProducts() {
    const search = document.getElementById('productSearch').value.toLowerCase();
    const category = document.getElementById('productCategoryFilter').value;
    const status = document.getElementById('productStatusFilter').value;
    
    const rows = document.querySelectorAll('#productsTableBody tr');
    
    rows.forEach(row => {
        const productName = row.querySelector('strong').textContent.toLowerCase();
        const productCategory = row.querySelectorAll('td')[3].textContent.toLowerCase();
        const productStatus = row.querySelector('.status-pill').textContent.toLowerCase();
        
        let show = true;
        
        if (search && !productName.includes(search)) {
            show = false;
        }
        
        if (category && productCategory !== category) {
            show = false;
        }
        
        if (status && productStatus !== status) {
            show = false;
        }
        
        row.style.display = show ? '' : 'none';
    });
}

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

function initUserManagement() {
    // Initialize user management functionality
    console.log('User management initialized');
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
    // Initialize category management functionality
    console.log('Category management initialized');
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
    filterProducts,
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
    filterProducts,
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

        html += '<tr>' +
            '<td><div style="display:flex;align-items:center;gap:0.75rem;">' +
                '<img src="' + imgSrc + '" style="width:48px;height:48px;border-radius:8px;object-fit:cover;" loading="lazy">' +
                '<div><strong style="font-size:0.85rem;">' + (p.title || 'Untitled') + '</strong>' + featuredBadge +
                '<br><small style="color:#767676;">' + (p.condition || '') + '</small></div>' +
            '</div></td>' +
            '<td><span style="text-transform:capitalize;">' + (p.category || '—').replace(/-/g, ' ') + '</span></td>' +
            '<td><strong>GH₵ ' + (p.price ? p.price.toLocaleString() : '0') + '</strong></td>' +
            '<td>' + sellerLabel + '</td>' +
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
        return matchSearch && matchCategory && matchStatus;
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
            loadAdminProducts();
        })
        .catch(function(err) { showFlashMessage('Error: ' + err.message, 'error'); });
}

function deleteAdminProduct(id, title) {
    if (!confirm('Delete "' + title + '"? This cannot be undone.')) return;
    if (typeof firebaseDB === 'undefined') return;
    firebaseDB.collection('products').doc(id).delete()
        .then(function() {
            showFlashMessage('Product deleted', 'success');
            loadAdminProducts();
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
    loadStores();
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
                loadStores();
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
            loadStores();
        }).catch(function(err) {
            showFlashMessage('Error: ' + err.message, 'error');
        });
    }
}
