/**
 * Sankofa Market - Admin Login Handler
 * Handles admin authentication with email, password, and admin code verification
 */

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('adminLoginForm');
    if (form) {
        initAdminLogin();
    }
    initPasswordToggle();
});

function initAdminLogin() {
    const form = document.getElementById('adminLoginForm');
    const loginBtn = document.getElementById('adminLoginBtn');
    if (!loginBtn) { console.error('Login button not found'); return; }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        const adminCode = document.getElementById('adminCode').value.trim();

        // Validate fields
        if (!email || !password || !adminCode) {
            showAdminFlash('Please fill in all fields', 'error');
            return;
        }

        // Validate admin code format (6 digits)
        if (!/^\d{6}$/.test(adminCode)) {
            showAdminFlash('Admin code must be a 6-digit number', 'error');
            return;
        }

        // Show loading state
        const originalHTML = loginBtn.innerHTML;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        loginBtn.disabled = true;

        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                // ===== REAL FIREBASE AUTH =====
                
                // Step 1: Sign in with email/password
                const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
                
                // Step 2: Check user document for admin role
                const userDoc = await firebase.firestore()
                    .collection('users')
                    .doc(cred.user.uid)
                    .get();

                if (!userDoc.exists) {
                    await firebase.auth().signOut();
                    showAdminFlash('Account not found. Contact the system administrator.', 'error');
                    return;
                }

                const userData = userDoc.data();

                // Step 3: Verify admin role
                if (userData.role !== 'admin') {
                    await firebase.auth().signOut();
                    showAdminFlash('Access denied. This account does not have admin privileges.', 'error');
                    return;
                }

                // Step 4: Verify admin code
                if (userData.adminCode !== adminCode) {
                    await firebase.auth().signOut();
                    showAdminFlash('Invalid admin verification code.', 'error');
                    return;
                }

                // Step 5: Check account status
                if (userData.status === 'suspended' || userData.status === 'blocked') {
                    await firebase.auth().signOut();
                    showAdminFlash('This admin account has been suspended.', 'error');
                    return;
                }

                // Success! Update last login
                await firebase.firestore().collection('users').doc(cred.user.uid).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Store admin session flag
                sessionStorage.setItem('sankofa_admin', 'true');
                sessionStorage.setItem('sankofa_admin_uid', cred.user.uid);

                showAdminFlash('Welcome to the Admin Panel!', 'success');
                
                // Keep button in loading state during redirect
                loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redirecting...';
                
                // Redirect to admin dashboard
                setTimeout(() => {
                    window.location.replace('/sm-panel/dashboard');
                }, 1500);

            } else {
                // ===== DEMO MODE (no Firebase) =====
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Demo mode fallback when Firebase is not configured
                showAdminFlash('Firebase is not configured. Admin login requires an active Firebase connection.', 'error');
            }

        } catch (error) {
            console.error('Admin login error:', error);
            
            let message = 'Login failed. Please try again.';
            
            if (error.code) {
                switch (error.code) {
                    case 'auth/user-not-found':
                        message = 'No account found with this email address.';
                        break;
                    case 'auth/wrong-password':
                    case 'auth/invalid-credential':
                        message = 'Incorrect email or password.';
                        break;
                    case 'auth/too-many-requests':
                        message = 'Too many failed attempts. Please try again later.';
                        break;
                    case 'auth/user-disabled':
                        message = 'This account has been disabled.';
                        break;
                    case 'auth/invalid-email':
                        message = 'Invalid email address format.';
                        break;
                    default:
                        message = error.message || message;
                }
            }
            
            showAdminFlash(message, 'error');
        } finally {
            loginBtn.innerHTML = originalHTML;
            loginBtn.disabled = false;
        }
    });
}

function initPasswordToggle() {
    const toggle = document.getElementById('togglePassword');
    if (toggle) {
        toggle.addEventListener('click', function() {
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
}

function showAdminFlash(message, type) {
    // Remove existing flash
    document.querySelectorAll('.admin-flash').forEach(f => f.remove());

    const colors = {
        success: '#86b817',
        error: '#e74c3c',
        warning: '#f5af02',
        info: '#0064d2'
    };

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    const flash = document.createElement('div');
    flash.className = 'admin-flash';
    flash.style.cssText = `
        position: fixed;
        top: 1.5rem;
        right: 1.5rem;
        padding: 1rem 1.5rem;
        background: ${colors[type] || colors.info};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        z-index: 100000;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.9rem;
        font-weight: 500;
        max-width: 400px;
        animation: adminSlideIn 0.3s ease;
        font-family: 'Poppins', sans-serif;
    `;
    flash.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;

    // Add animation styles
    if (!document.getElementById('admin-flash-styles')) {
        const style = document.createElement('style');
        style.id = 'admin-flash-styles';
        style.textContent = `
            @keyframes adminSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes adminSlideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(flash);

    setTimeout(() => {
        flash.style.animation = 'adminSlideOut 0.3s ease forwards';
        setTimeout(() => flash.remove(), 300);
    }, 4000);
}
