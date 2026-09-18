/**
 * Admin Authentication & Route Protection
 * Prevents unauthorized access to admin pages
 */

document.addEventListener('DOMContentLoaded', async function() {
    // Check if user is authenticated and is admin
    await checkAdminAccess();
});

async function checkAdminAccess() {
    try {
        // Check if Firebase is available
        if (typeof firebase === 'undefined' || !firebase.auth) {
            // Demo mode - show warning
            showAccessDenied('Firebase not configured. Admin access requires authentication.');
            return;
        }

        // Wait for auth state
        firebase.auth().onAuthStateChanged(async (user) => {
            if (!user) {
                // Not logged in - redirect to login
                showAccessDenied('You must be logged in to access admin pages.');
                setTimeout(() => {
                    window.location.href = '../../pages/auth/login.html?redirect=' + encodeURIComponent(window.location.pathname);
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
                        window.location.href = '../../index.html';
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

                // User is admin - allow access
                console.log('Admin access granted');
                
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
                    window.location.href = '../../index.html';
                }, 2000);
            }
        });

    } catch (error) {
        console.error('Admin auth error:', error);
        showAccessDenied('Authentication error. Please try again.');
        setTimeout(() => {
            window.location.href = '../../index.html';
        }, 2000);
    }
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
        `;
        
        deniedMessage.innerHTML = `
            <div style="text-align: center; max-width: 500px; padding: 2rem;">
                <i class="fas fa-lock" style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.8;"></i>
                <h1 style="font-size: 2rem; margin-bottom: 1rem;">Access Denied</h1>
                <p style="font-size: 1.1rem; opacity: 0.9; margin-bottom: 2rem;">${message}</p>
                <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                    <a href="../../pages/auth/login.html" style="
                        padding: 0.75rem 2rem;
                        background: white;
                        color: #667eea;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: 600;
                        transition: transform 0.2s;
                    " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
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
                        transition: transform 0.2s;
                    " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
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

// Prevent right-click on admin pages (optional security measure)
document.addEventListener('contextmenu', function(e) {
    if (window.location.pathname.includes('/admin/')) {
        e.preventDefault();
        showFlashMessage('Right-click is disabled on admin pages', 'warning');
        return false;
    }
});

// Prevent common keyboard shortcuts for viewing source
document.addEventListener('keydown', function(e) {
    if (window.location.pathname.includes('/admin/')) {
        // Ctrl+U (View Source)
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            showFlashMessage('View source is disabled on admin pages', 'warning');
            return false;
        }
        // F12 (Developer Tools)
        if (e.key === 'F12') {
            e.preventDefault();
            showFlashMessage('Developer tools are disabled on admin pages', 'warning');
            return false;
        }
        // Ctrl+Shift+I (Inspect Element)
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            e.preventDefault();
            showFlashMessage('Inspect element is disabled on admin pages', 'warning');
            return false;
        }
        // Ctrl+Shift+J (Console)
        if (e.ctrlKey && e.shiftKey && e.key === 'J') {
            e.preventDefault();
            showFlashMessage('Console is disabled on admin pages', 'warning');
            return false;
        }
    }
});

function showFlashMessage(message, type = 'info') {
    const flashMessage = document.createElement('div');
    flashMessage.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'warning' ? '#ffc107' : '#17a2b8'};
        color: ${type === 'warning' ? '#000' : '#fff'};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 100000;
        font-weight: 500;
        animation: slideInRight 0.3s ease;
    `;
    flashMessage.textContent = message;
    
    document.body.appendChild(flashMessage);
    
    setTimeout(() => {
        flashMessage.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => flashMessage.remove(), 300);
    }, 3000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
