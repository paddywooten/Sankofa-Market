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
                                <option value="sankofa-store">Sankofa Store</option>
                                <option value="verified-seller">Verified Seller</option>
                                <option value="individual">Individual Seller</option>
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
    var isSankofaStore = formData.seller === 'sankofa-store';
    var isVerified = formData.seller === 'verified-seller' || isSankofaStore;

    var productData = {
        title: formData.title,
        category: formData.category,
        description: formData.description,
        price: formData.price,
        condition: formData.condition,
        location: { city: formData.location },
        sellerType: formData.seller,
        sellerName: isSankofaStore ? 'Sankofa Store' : (isVerified ? 'Verified Seller' : 'Individual Seller'),
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
