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
    
    // Simulate API call
    console.log('Adding product:', formData);
    
    // Show success message
    showFlashMessage('Product added successfully!', 'success');
    
    // Close modal
    closeAddProductModal();
    
    // Refresh product list (in real app, this would fetch from API)
    setTimeout(() => {
        location.reload();
    }, 1500);
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
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('open');
        });
    }
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
