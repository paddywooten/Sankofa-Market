/**
 * Sankofa Market - Main JavaScript
 * Core functionality for the marketplace
 */

// Apply theme immediately (before DOM loads) to prevent flash
(function() {
    var theme = localStorage.getItem('sankofa-theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
})();

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🇬🇭 Sankofa Market Loaded - Give Your Items New Life!');
    
    // Initialize features
    initTheme();
    initNavbar();
    initSmoothScroll();
    initScrollEffects();
    initFlashMessages();
    updateUserNav();
});

// ============================================================================
// THEME TOGGLE (Light/Dark Mode)
// ============================================================================

function initTheme() {
    // Apply saved theme immediately
    const savedTheme = localStorage.getItem('sankofa-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Create and inject toggle button into header actions
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
        const toggle = document.createElement('button');
        toggle.className = 'theme-toggle';
        toggle.id = 'themeToggle';
        toggle.title = savedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        toggle.setAttribute('aria-label', 'Toggle dark mode');
        toggle.innerHTML = '<i class="fas fa-moon"></i><i class="fas fa-sun"></i>';
        
        toggle.addEventListener('click', function() {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('sankofa-theme', next);
            this.title = next === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        });

        // Insert at the end (far right) of header actions
        headerActions.appendChild(toggle);
    }
}

// ============================================================================
// NAVIGATION
// ============================================================================

function initNavbar() {
    const header = document.querySelector('.header');
    
    // Sticky header on scroll
    if (header) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                header.style.boxShadow = 'var(--shadow-md)';
            } else {
                header.style.boxShadow = 'var(--shadow-sm)';
            }
        });
    }
}

// ============================================================================
// SMOOTH SCROLL
// ============================================================================

function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href === '#') return;
            
            const target = document.querySelector(href);
            
            if (target) {
                e.preventDefault();
                
                const offsetTop = target.offsetTop - 80;
                
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// ============================================================================
// SCROLL EFFECTS
// ============================================================================

function initScrollEffects() {
    // Add fade-in animation to elements as they come into view
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe product cards and sections
    const elements = document.querySelectorAll('.product-card, .category-card, .step-card');
    elements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// ============================================================================
// FLASH MESSAGES
// ============================================================================

function initFlashMessages() {
    // Auto-hide flash messages after 5 seconds
    const flashMessages = document.querySelectorAll('.flash-message');
    flashMessages.forEach(message => {
        setTimeout(() => {
            message.style.opacity = '0';
            message.style.transform = 'translateX(400px)';
            message.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                message.remove();
            }, 300);
        }, 5000);
    });
}

function showFlashMessage(message, type = 'info') {
    const container = document.createElement('div');
    container.className = 'flash-messages';
    container.style.position = 'fixed';
    container.style.top = '80px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    
    const messageEl = document.createElement('div');
    messageEl.className = `flash-message ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 
                 type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    
    messageEl.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
    
    container.appendChild(messageEl);
    document.body.appendChild(container);
    
    setTimeout(() => {
        messageEl.style.opacity = '0';
        messageEl.style.transform = 'translateX(400px)';
        messageEl.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
            container.remove();
        }, 300);
    }, 5000);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Format currency (GHS)
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency: 'GHS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-GH', options);
}

// Format relative time (e.g., "2 hours ago")
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return formatDate(dateString);
}

// Validate email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate phone (Ghana format)
function isValidPhone(phone) {
    const re = /^(\+233|0)[2357]\d{8}$/;
    return re.test(phone.replace(/\s/g, ''));
}

// Show loading state
function showLoading(element) {
    const originalText = element.innerHTML;
    element.disabled = true;
    element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    element.classList.add('loading');
    
    return function() {
        element.disabled = false;
        element.innerHTML = originalText;
        element.classList.remove('loading');
    };
}

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

// Check if user is logged in
function isLoggedIn() {
    return window.currentUser !== null && window.currentUser !== undefined;
}

// Update user navigation
function updateUserNav() {
    if (typeof firebaseAuth !== 'undefined') {
        firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                window.currentUser = user;
                
                // Get user data from Firestore
                if (typeof firebaseDB !== 'undefined') {
                    firebaseDB.collection('users').doc(user.uid).get().then((doc) => {
                        if (doc.exists) {
                            window.userData = doc.data();
                            
                            // Update navigation
                            const loginBtn = document.getElementById('loginBtn');
                            const dashboardBtn = document.getElementById('dashboardBtn');
                            const userName = document.getElementById('userName');
                            
                            if (loginBtn) loginBtn.style.display = 'none';
                            if (dashboardBtn) {
                                dashboardBtn.style.display = 'inline-flex';
                                if (userName) {
                                    userName.textContent = window.userData.firstName || 'Dashboard';
                                }
                            }
                        }
                    });
                }
            } else {
                window.currentUser = null;
                window.userData = null;
            }
        });
    }
}

// Require authentication
function requireAuth(redirectUrl = '/pages/auth/login.html') {
    if (!isLoggedIn()) {
        showFlashMessage('Please login to continue', 'warning');
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1500);
        return false;
    }
    return true;
}

// Logout
function logout() {
    if (typeof firebaseAuth !== 'undefined') {
        firebaseAuth.signOut().then(() => {
            showFlashMessage('Logged out successfully', 'success');
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 1500);
        }).catch(error => {
            console.error('Logout error:', error);
            showFlashMessage('Error logging out', 'error');
        });
    }
}

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================

// Add document to collection
async function addDocument(collection, data) {
    try {
        const docRef = await firebaseDB.collection(collection).add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error adding document:', error);
        return { success: false, error: error.message };
    }
}

// Get document by ID
async function getDocument(collection, id) {
    try {
        const doc = await firebaseDB.collection(collection).doc(id).get();
        if (doc.exists) {
            return { success: true, data: { id: doc.id, ...doc.data() } };
        } else {
            return { success: false, error: 'Document not found' };
        }
    } catch (error) {
        console.error('Error getting document:', error);
        return { success: false, error: error.message };
    }
}

// Update document
async function updateDocument(collection, id, data) {
    try {
        await firebaseDB.collection(collection).doc(id).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating document:', error);
        return { success: false, error: error.message };
    }
}

// Delete document
async function deleteDocument(collection, id) {
    try {
        await firebaseDB.collection(collection).doc(id).delete();
        return { success: true };
    } catch (error) {
        console.error('Error deleting document:', error);
        return { success: false, error: error.message };
    }
}

// Query collection
async function queryCollection(collection, field, operator, value) {
    try {
        const snapshot = await firebaseDB.collection(collection)
            .where(field, operator, value)
            .get();
        
        const documents = [];
        snapshot.forEach(doc => {
            documents.push({ id: doc.id, ...doc.data() });
        });
        
        return { success: true, data: documents };
    } catch (error) {
        console.error('Error querying collection:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

// Upload file to Firebase Storage
async function uploadFile(file, path, onProgress = null) {
    return new Promise((resolve, reject) => {
        const storageRef = firebaseStorage.ref();
        const fileRef = storageRef.child(path);
        
        const uploadTask = fileRef.put(file);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (onProgress) {
                    onProgress(progress);
                }
            },
            (error) => {
                console.error('Upload error:', error);
                reject(error);
            },
            () => {
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    resolve({ success: true, url: downloadURL });
                }).catch(reject);
            }
        );
    });
}

// Delete file from Firebase Storage
async function deleteFile(url) {
    try {
        const storageRef = firebaseStorage.refFromURL(url);
        await storageRef.delete();
        return { success: true };
    } catch (error) {
        console.error('Delete error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

window.SankofaMarket = {
    // Utility functions
    formatCurrency,
    formatDate,
    formatRelativeTime,
    isValidEmail,
    isValidPhone,
    showLoading,
    showFlashMessage,
    
    // Authentication
    isLoggedIn,
    requireAuth,
    logout,
    updateUserNav,
    
    // Firestore
    addDocument,
    getDocument,
    updateDocument,
    deleteDocument,
    queryCollection,
    
    // Storage
    uploadFile,
    deleteFile
};
