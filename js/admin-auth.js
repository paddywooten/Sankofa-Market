/**
 * Admin Authentication & Route Protection
 * Prevents unauthorized access to admin pages
 * Waits for Firebase auth state to resolve before denying access
 */

document.addEventListener('DOMContentLoaded', async function() {
    await checkAdminAccess();
});

async function checkAdminAccess() {
    try {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            showAccessDenied('Firebase not configured. Admin access requires authentication.');
            return;
        }

        // Wait for auth state to resolve (important on mobile after redirect)
        const user = await getAuthUser();

        if (!user) {
            showAccessDenied('You must be logged in to access admin pages.');
            setTimeout(() => {
                window.location.href = '/sm-panel/login';
            }, 2000);
            return;
        }

        // Check if user is admin
        try {
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .get();

            if (!userDoc.exists) {
                showAccessDenied('User profile not found.');
                setTimeout(() => {
                    firebase.auth().signOut();
                    window.location.href = '/sm-panel/login';
                }, 2000);
                return;
            }

            const userData = userDoc.data();

            if (userData.role !== 'admin') {
                showAccessDenied('Access denied. Admin privileges required.');
                setTimeout(() => {
                    window.location.href = '../../index.html';
                }, 2000);
                return;
            }

            // Admin access granted
            console.log('Admin access granted for:', userData.name || user.email);
            
            // Update topbar with admin's name and avatar initial
            const adminName = userData.name || user.displayName || user.email?.split('@')[0] || 'Admin';
            const nameEl = document.getElementById('adminName');
            const avatarEl = document.getElementById('adminAvatar');
            if (nameEl) nameEl.textContent = adminName;
            if (avatarEl) avatarEl.textContent = adminName.charAt(0).toUpperCase();

            // Hide access denied message if it was shown
            const deniedMessage = document.getElementById('accessDeniedMessage');
            if (deniedMessage) {
                deniedMessage.style.display = 'none';
            }

            // Show admin content
            const adminContent = document.querySelector('.admin-main') || document.querySelector('main');
            if (adminContent) {
                adminContent.style.display = 'block';
            }

        } catch (error) {
            console.error('Error checking admin status:', error);
            showAccessDenied('Error verifying admin status. Please try again.');
            setTimeout(() => {
                window.location.href = '/sm-panel/login';
            }, 2000);
        }

    } catch (error) {
        console.error('Admin auth error:', error);
        showAccessDenied('Authentication error. Please try again.');
        setTimeout(() => {
            window.location.href = '/sm-panel/login';
        }, 2000);
    }
}

/**
 * Wait for Firebase auth state to resolve
 * On mobile, auth state can take 1-3 seconds to restore after redirect
 */
function getAuthUser() {
    return new Promise((resolve) => {
        let resolved = false;
        
        // Set a timeout - if auth doesn't resolve in 5 seconds, assume not logged in
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve(null);
            }
        }, 5000);

        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                unsubscribe();
                resolve(user);
            }
        });
    });
}

function showAccessDenied(message) {
    // Hide admin content
    const adminContent = document.querySelector('.admin-main') || document.querySelector('main');
    if (adminContent) {
        adminContent.style.display = 'none';
    }

    // Show access denied message
    let deniedMessage = document.getElementById('accessDeniedMessage');
    
    if (!deniedMessage) {
        deniedMessage = document.createElement('div');
        deniedMessage.id = 'accessDeniedMessage';
        deniedMessage.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            color: white;
            font-family: 'Poppins', sans-serif;
            padding: 2rem;
        `;
        
        deniedMessage.innerHTML = `
            <div style="text-align: center; max-width: 500px;">
                <i class="fas fa-lock" style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.8;"></i>
                <h1 style="font-size: 2rem; margin-bottom: 1rem;">Access Denied</h1>
                <p style="font-size: 1.1rem; opacity: 0.9; margin-bottom: 2rem;">${message}</p>
                <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                    <a href="/sm-panel/login" style="
                        padding: 0.75rem 2rem;
                        background: white;
                        color: #667eea;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: 600;
                    ">
                        <i class="fas fa-sign-in-alt"></i> Login
                    </a>
                    <a href="../../index.html" style="
                        padding: 0.75rem 2rem;
                        background: rgba(255,255,255,0.2);
                        color: white;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: 600;
                        border: 2px solid white;
                    ">
                        <i class="fas fa-home"></i> Home
                    </a>
                </div>
            </div>
        `;
        
        document.body.appendChild(deniedMessage);
    } else {
        deniedMessage.querySelector('p').textContent = message;
        deniedMessage.style.display = 'flex';
    }
}

// Prevent right-click on admin pages
document.addEventListener('contextmenu', function(e) {
    if (window.location.pathname.includes('/admin/') || window.location.pathname.includes('/sm-panel')) {
        e.preventDefault();
        return false;
    }
});

// Prevent common keyboard shortcuts for viewing source
document.addEventListener('keydown', function(e) {
    if (window.location.pathname.includes('/admin/') || window.location.pathname.includes('/sm-panel')) {
        if (e.ctrlKey && e.key === 'u') { e.preventDefault(); return false; }
        if (e.key === 'F12') { e.preventDefault(); return false; }
        if (e.ctrlKey && e.shiftKey && e.key === 'I') { e.preventDefault(); return false; }
        if (e.ctrlKey && e.shiftKey && e.key === 'J') { e.preventDefault(); return false; }
    }
});
