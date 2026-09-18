/**
 * Sankofa Market - Admin Dashboard JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check which page we're on
    const loginForm = document.getElementById('adminLoginForm');
    const sidebar = document.getElementById('adminSidebar');
    
    if (loginForm) {
        initAdminLogin();
    } else if (sidebar) {
        checkAdminAuth();
        initAdminDashboard();
    }
});

// ============================================================================
// ADMIN LOGIN
// ============================================================================

function initAdminLogin() {
    const form = document.getElementById('adminLoginForm');
    const loginBtn = document.getElementById('loginBtn');
    const toggleBtn = document.getElementById('togglePassword');
    
    // Toggle password visibility
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            const input = document.getElementById('adminPassword');
            const icon = this.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    }
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        const code = document.getElementById('adminCode').value.trim();
        
        if (!email || !password || !code) {
            showFlashMessage('Please fill in all fields', 'error');
            return;
        }
        
        if (code.length !== 6) {
            showFlashMessage('Admin code must be 6 digits', 'error');
            return;
        }
        
        const stopLoading = showLoading(loginBtn);
        
        try {
            // Check Firebase first
            if (typeof firebaseAuth !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
                const cred = await firebaseAuth.signInWithEmailAndPassword(email, password);
                
                // Check if user is admin
                const userDoc = await firebaseDB.collection('users').doc(cred.user.uid).get();
                if (!userDoc.exists || userDoc.data().role !== 'admin') {
                    await firebaseAuth.signOut();
                    showFlashMessage('Access denied. Admin privileges required.', 'error');
                    stopLoading();
                    return;
                }
            } else {
                // Demo mode - accept any credentials with code "123456"
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                if (code !== '123456') {
                    showFlashMessage('Invalid admin code. Use 123456 for demo.', 'error');
                    stopLoading();
                    return;
                }
            }
            
            // Save admin session
            localStorage.setItem('sankofa_admin', JSON.stringify({
                email: email,
                loggedIn: true,
                timestamp: Date.now()
            }));
            
            showFlashMessage('Welcome to Admin Panel!', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
            
        } catch (error) {
            console.error('Admin login error:', error);
            showFlashMessage('Invalid credentials. Please try again.', 'error');
        } finally {
            stopLoading();
        }
    });
}

// ============================================================================
// ADMIN AUTH CHECK
// ============================================================================

function checkAdminAuth() {
    const admin = localStorage.getItem('sankofa_admin');
    
    if (!admin) {
        // Demo mode - allow access without auth for preview
        console.log('⚠️ Admin demo mode - no authentication required');
        return;
    }
    
    try {
        const data = JSON.parse(admin);
        if (!data.loggedIn) {
            window.location.href = 'login.html';
        }
    } catch (e) {
        window.location.href = 'login.html';
    }
}

// ============================================================================
// ADMIN DASHBOARD
// ============================================================================

function initAdminDashboard() {
    initNavigation();
    initMobileMenu();
    initLogout();
    initTableActions();
    initSettingsForm();
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
            
            // Update nav
            navItems.forEach(n => n.classList.remove('active'));
            this.classList.add('active');
            
            // Update sections
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(`section-${section}`).classList.add('active');
            
            // Close mobile menu
            document.getElementById('adminSidebar').classList.remove('open');
            
            // Update URL hash
            history.replaceState(null, '', `#${section}`);
        });
    });
    
    // Check URL hash on load
    const hash = window.location.hash.replace('#', '');
    if (hash) {
        const targetNav = document.querySelector(`.nav-item[data-section="${hash}"]`);
        if (targetNav) targetNav.click();
    }
}

// ============================================================================
// MOBILE MENU
// ============================================================================

function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('adminSidebar');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
    
    // Close sidebar on outside click (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            !sidebar.contains(e.target) && 
            !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

// ============================================================================
// LOGOUT
// ============================================================================

function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            try {
                if (typeof firebaseAuth !== 'undefined') {
                    await firebaseAuth.signOut();
                }
            } catch (e) {}
            
            localStorage.removeItem('sankofa_admin');
            showFlashMessage('Logged out successfully', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        });
    }
}

// ============================================================================
// TABLE ACTIONS
// ============================================================================

function initTableActions() {
    // Select all checkboxes
    const selectAll = document.getElementById('selectAllProducts');
    if (selectAll) {
        selectAll.addEventListener('change', function() {
            document.querySelectorAll('.product-check').forEach(cb => {
                cb.checked = this.checked;
            });
        });
    }
    
    // Action buttons - delegate events
    document.addEventListener('click', function(e) {
        const actionBtn = e.target.closest('.action-btn');
        if (!actionBtn) return;
        
        const title = actionBtn.getAttribute('title') || '';
        const row = actionBtn.closest('tr');
        
        if (title === 'Approve') {
            if (row) {
                const statusCell = row.querySelector('.status-pill');
                if (statusCell) {
                    statusCell.className = 'status-pill success';
                    statusCell.textContent = 'Active';
                }
                // Replace approve/reject buttons with edit/delete
                const actionsCell = actionBtn.closest('.table-actions');
                if (actionsCell) {
                    actionsCell.innerHTML = `
                        <button class="action-btn" title="View"><i class="fas fa-eye"></i></button>
                        <button class="action-btn" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="action-btn danger" title="Delete"><i class="fas fa-trash"></i></button>
                    `;
                }
            }
            showFlashMessage('Product approved!', 'success');
        } else if (title === 'Reject' || title === 'Remove') {
            if (row) {
                row.style.opacity = '0.5';
                setTimeout(() => row.remove(), 300);
            }
            showFlashMessage('Product removed', 'warning');
        } else if (title === 'Delete') {
            if (confirm('Are you sure you want to delete this item?')) {
                if (row) {
                    row.style.opacity = '0.5';
                    setTimeout(() => row.remove(), 300);
                }
                showFlashMessage('Item deleted', 'success');
            }
        } else if (title === 'Suspend') {
            if (confirm('Suspend this user?')) {
                const statusCell = row?.querySelector('.status-pill');
                if (statusCell) {
                    statusCell.className = 'status-pill danger';
                    statusCell.textContent = 'Suspended';
                }
                showFlashMessage('User suspended', 'warning');
            }
        } else if (title === 'Reactivate') {
            const statusCell = row?.querySelector('.status-pill');
            if (statusCell) {
                statusCell.className = 'status-pill success';
                statusCell.textContent = 'Active';
            }
            showFlashMessage('User reactivated', 'success');
        } else if (title === 'View' || title === 'View Details' || title === 'Review' || title === 'Investigate') {
            showFlashMessage('Opening details...', 'info');
        } else if (title === 'Edit') {
            showFlashMessage('Opening editor...', 'info');
        }
    });
    
    // Export buttons
    const exportProductsBtn = document.getElementById('exportProductsBtn');
    const exportUsersBtn = document.getElementById('exportUsersBtn');
    
    if (exportProductsBtn) {
        exportProductsBtn.addEventListener('click', () => {
            showFlashMessage('Exporting products to CSV...', 'info');
            setTimeout(() => showFlashMessage('Export complete!', 'success'), 1500);
        });
    }
    
    if (exportUsersBtn) {
        exportUsersBtn.addEventListener('click', () => {
            showFlashMessage('Exporting users to CSV...', 'info');
            setTimeout(() => showFlashMessage('Export complete!', 'success'), 1500);
        });
    }
    
    // Add buttons
    const addProductBtn = document.getElementById('addProductBtn');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    
    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            window.location.href = '../../publish.html';
        });
    }
    
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', () => {
            const name = prompt('Enter category name:');
            if (name) {
                showFlashMessage(`Category "${name}" created!`, 'success');
            }
        });
    }
    
    // Global search
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
        globalSearch.addEventListener('input', debounce(function() {
            const query = this.value.toLowerCase();
            if (query.length < 2) return;
            
            // Filter visible table rows
            document.querySelectorAll('.admin-table tbody tr').forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        }, 300));
    }
}

// ============================================================================
// SETTINGS
// ============================================================================

function initSettingsForm() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', async function() {
            const stopLoading = showLoading(this);
            
            try {
                // Simulate save
                await new Promise(resolve => setTimeout(resolve, 1000));
                showFlashMessage('Settings saved successfully!', 'success');
            } catch (error) {
                showFlashMessage('Error saving settings', 'error');
            } finally {
                stopLoading();
            }
        });
    }
}

// ============================================================================
// UTILITIES
// ============================================================================

function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Make showFlashMessage and showLoading available if not already
if (typeof showFlashMessage === 'undefined') {
    function showFlashMessage(message, type = 'info') {
        const container = document.createElement('div');
        container.className = 'flash-messages';
        container.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999;';
        
        const colors = {
            success: '#86b817',
            error: '#e74c3c',
            warning: '#f5af02',
            info: '#0064d2'
        };
        
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        
        const msg = document.createElement('div');
        msg.style.cssText = `padding:0.75rem 1.25rem;background:${colors[type]};color:white;border-radius:8px;margin-bottom:0.5rem;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;animation:slideIn 0.3s ease;`;
        msg.innerHTML = `<i class="fas fa-${icons[type]}"></i> ${message}`;
        
        container.appendChild(msg);
        document.body.appendChild(container);
        
        setTimeout(() => {
            msg.style.opacity = '0';
            msg.style.transform = 'translateX(400px)';
            msg.style.transition = 'all 0.3s ease';
            setTimeout(() => container.remove(), 300);
        }, 4000);
    }
}

if (typeof showLoading === 'undefined') {
    function showLoading(element) {
        const originalText = element.innerHTML;
        element.disabled = true;
        element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        return function() {
            element.disabled = false;
            element.innerHTML = originalText;
        };
    }
}
