/**
 * Admin Authentication & Route Protection
 * Prevents unauthorized access to admin pages
 * Waits for Firebase auth state to resolve before denying access
 * Includes retry logic for offline/network errors
 */

document.addEventListener('DOMContentLoaded', async function() {
    await checkAdminAccess();
});

async function checkAdminAccess() {
    console.log('🔐 Checking admin access...');
    
    try {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            console.error('Firebase SDK not loaded');
            showAccessDenied('Firebase not configured. Admin access requires authentication.');
            return;
        }

        // Ensure auth persistence is set
        try {
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (e) {
            console.warn('Could not set auth persistence:', e);
        }

        // Wait for auth state to resolve (important on mobile after redirect)
        console.log('Waiting for auth state...');
        const user = await getAuthUser();

        if (!user) {
            console.log('No user found - not logged in');
            // Do not leave a prior admin-code session behind after sign-out.
            try {
                sessionStorage.removeItem('sankofa_admin');
                sessionStorage.removeItem('sankofa_admin_uid');
                sessionStorage.removeItem('sankofa_admin_auth_time');
            } catch (e) { /* sessionStorage unavailable */ }
            showAccessDenied('You must be logged in to access admin pages.');
            setTimeout(() => {
                window.location.href = '/sm-panel/login';
            }, 3000);
            return;
        }

        console.log('User found:', user.email, 'UID:', user.uid);

        // Check if user is admin (with retry logic for offline errors)
        const userDoc = await fetchUserDocWithRetry(user.uid);

        if (!userDoc) {
            // fetchUserDocWithRetry already showed appropriate error
            return;
        }

        // The {admin:true} custom claim is the fast path (no reads, and it is what the
        // Firestore rules and the Cloud Functions trust). The users-document role is the
        // fallback for an admin who has not been given a claim yet — without this, an admin
        // promoted via the claim alone saw the "access denied" screen on every panel page.
        let claimsOk = false;
        let adminAuthTime = '';
        try {
            const tok = await user.getIdTokenResult();
            claimsOk = !!(tok && tok.claims && tok.claims.admin === true);
            adminAuthTime = String((tok && tok.claims && tok.claims.auth_time) || '');
        } catch (e) { console.warn('could not read the admin claim', e); }

        if (!userDoc.exists && !claimsOk) {
            console.log('User document not found in Firestore');
            showAccessDenied('User profile not found in database.');
            setTimeout(() => {
                window.location.href = '/sm-panel/login';
            }, 3000);
            return;
        }

        const userData = userDoc.exists ? userDoc.data() : {};
        console.log('Admin check:', { claim: claimsOk, role: userData.role, name: userData.name });

        if (userData.role !== 'admin' && !claimsOk) {
            console.log('User is not an admin. Role:', userData.role, 'claim:', claimsOk);
            showAccessDenied('Access denied. Admin privileges required.');
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 3000);
            return;
        }

        // Being an admin is not enough: the 6-digit code from /sm-panel/login must
        // have been verified in THIS sign-in session. The marker is bound to the
        // current auth_time, so signing in elsewhere (for example /login) or after a
        // sign-out invalidates an old code session. This closes the previous bypass
        // where an admin could sign in at /login and open /sm-panel directly.
        let codeSession = null, codeSessionUid = null, codeSessionAuthTime = '';
        try {
            codeSession = sessionStorage.getItem('sankofa_admin');
            codeSessionUid = sessionStorage.getItem('sankofa_admin_uid');
            codeSessionAuthTime = sessionStorage.getItem('sankofa_admin_auth_time') || '';
        } catch (e) { /* sessionStorage unavailable */ }

        if (codeSession !== 'true' || codeSessionUid !== user.uid ||
            !adminAuthTime || codeSessionAuthTime !== adminAuthTime) {
            console.log('Admin code session missing or stale');
            showAccessDenied('Admin verification required. Please sign in through the admin login page and enter your 6-digit admin code.');
            setTimeout(() => {
                window.location.href = '/sm-panel/login';
            }, 3000);
            return;
        }

        // Admin access granted
        console.log('✅ Admin access granted for:', userData.name || user.email);
        
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

        // Reveal the admin shell. It is hidden by a CSS rule with !important, so the
        // reliable way is to remove that rule — an inline style would lose to it.
        const gateStyle = document.getElementById('adminGateHide');
        if (gateStyle) gateStyle.remove();
        ['.admin-sidebar', '.admin-topbar', 'main.admin-main', '.admin-main'].forEach(function (sel) {
            document.querySelectorAll(sel).forEach(function (el) {
                el.style.removeProperty('display');
                el.style.setProperty('display', 'block', 'important');
            });
        });

    } catch (error) {
        console.error('Admin auth error:', error);
        showAccessDenied('Authentication error: ' + error.message, true);
    }
}

/**
 * Fetch user document from Firestore with retry logic
 * Handles "client is offline" and network errors gracefully
 */
async function fetchUserDocWithRetry(uid, maxRetries = 3) {
    var lastError = null;

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log('📄 Reading user document (attempt ' + attempt + '/' + maxRetries + ')...');

            // Show connecting status on retries
            if (attempt > 1) {
                showConnecting('Verifying admin access... (attempt ' + attempt + ' of ' + maxRetries + ')');
            }

            // Try server-first to avoid stale offline cache issues
            var userDoc;
            try {
                userDoc = await firebase.firestore()
                    .collection('users')
                    .doc(uid)
                    .get({ source: 'server' });
            } catch (serverErr) {
                // If server fetch fails, try default (which uses cache if available)
                console.warn('Server fetch failed, trying cache:', serverErr.message);
                if (isOfflineError(serverErr)) {
                    // Wait before retrying
                    var delay = attempt * 2000; // 2s, 4s, 6s
                    console.log('⏳ Network issue detected. Retrying in ' + (delay / 1000) + 's...');
                    showConnecting('Connection issue. Retrying in ' + (delay / 1000) + ' seconds...');
                    await sleep(delay);
                    lastError = serverErr;
                    continue;
                }
                // For non-offline errors, try default source
                userDoc = await firebase.firestore()
                    .collection('users')
                    .doc(uid)
                    .get();
            }

            // Success!
            hideConnecting();
            console.log('✅ User document fetched successfully');
            return userDoc;

        } catch (error) {
            lastError = error;
            console.error('Attempt ' + attempt + ' failed:', error.message);

            if (isOfflineError(error) && attempt < maxRetries) {
                var delay = attempt * 2000; // 2s, 4s
                console.log('⏳ Offline/network error. Retrying in ' + (delay / 1000) + 's...');
                showConnecting('Connection issue. Retrying in ' + (delay / 1000) + ' seconds...');
                await sleep(delay);
            } else if (attempt >= maxRetries) {
                // All retries exhausted
                hideConnecting();
                console.error('❌ All ' + maxRetries + ' attempts failed');
                showAccessDenied(
                    'Could not verify your admin status. This usually happens when your internet connection is slow or briefly disconnected.<br><br>' +
                    '<strong>Error:</strong> ' + escapeFlashText(error.message),
                    true // show retry button
                );
                return null;
            }
        }
    }

    // Shouldn't reach here, but just in case
    hideConnecting();
    showAccessDenied(
        'Could not connect to the server after multiple attempts.<br><br><strong>Error:</strong> ' + escapeFlashText(lastError ? lastError.message : 'Unknown error'),
        true
    );
    return null;
}

/**
 * Check if an error is a network/offline error
 */
function isOfflineError(error) {
    if (!error) return false;
    var msg = (error.message || '').toLowerCase();
    return msg.includes('offline') ||
           msg.includes('unavailable') ||
           msg.includes('network') ||
           msg.includes('timeout') ||
           msg.includes('failed to fetch') ||
           msg.includes('net::') ||
           msg.includes('deadline exceeded') ||
           (error.code && (error.code === 'unavailable' || error.code === 'deadline-exceeded'));
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

/**
 * Show a "connecting..." overlay while retrying
 */
function showConnecting(message) {
    var el = document.getElementById('adminConnectingOverlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'adminConnectingOverlay';
        el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,#0064d2 0%,#0052b5 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99998;color:white;font-family:Poppins,sans-serif;padding:2rem;';
        el.innerHTML = '<div style="text-align:center;max-width:400px;">' +
            '<i class="fas fa-spinner fa-spin" style="font-size:3rem;margin-bottom:1.5rem;opacity:0.8;"></i>' +
            '<h2 style="font-size:1.3rem;margin-bottom:0.5rem;" id="connectingText">' + message + '</h2>' +
            '<p style="font-size:0.9rem;opacity:0.7;">Please wait while we verify your identity</p>' +
        '</div>';
        document.body.appendChild(el);
    } else {
        el.style.display = 'flex';
        var textEl = document.getElementById('connectingText');
        if (textEl) textEl.textContent = message;
    }
}

function hideConnecting() {
    var el = document.getElementById('adminConnectingOverlay');
    if (el) el.style.display = 'none';
}

/**
 * Wait for Firebase auth state to resolve
 * On mobile, auth state can take 1-3 seconds to restore after redirect
 */
function getAuthUser() {
    return new Promise((resolve) => {
        let resolved = false;
        
        // Set a timeout - if auth doesn't resolve in 10 seconds, assume not logged in
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve(null);
            }
        }, 10000);

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

function showAccessDenied(message, showRetry) {
    // Hide admin content
    const adminContent = document.querySelector('.admin-main') || document.querySelector('main');
    if (adminContent) {
        adminContent.style.display = 'none';
    }

    // Hide connecting overlay if showing
    hideConnecting();

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
        
        document.body.appendChild(deniedMessage);
    }

    var buttonsHtml = '<div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">';

    if (showRetry) {
        buttonsHtml += '<button onclick="location.reload()" style="' +
            'padding: 0.75rem 2rem;' +
            'background: white;' +
            'color: #667eea;' +
            'border: none;' +
            'border-radius: 8px;' +
            'font-weight: 600;' +
            'font-size: 1rem;' +
            'cursor: pointer;' +
            'font-family: Poppins, sans-serif;' +
        '"><i class="fas fa-redo"></i> Try Again</button>';
    }

    buttonsHtml += '<a href="/sm-panel/login" style="' +
        'padding: 0.75rem 2rem;' +
        (showRetry ? 'background: rgba(255,255,255,0.15);' : 'background: white;') +
        (showRetry ? 'color: white;' : 'color: #667eea;') +
        'text-decoration: none;' +
        'border-radius: 8px;' +
        'font-weight: 600;' +
        (showRetry ? 'border: 2px solid white;' : '') +
    '"><i class="fas fa-sign-in-alt"></i> Login</a>';

    buttonsHtml += '<a href="../../index.html" style="' +
        'padding: 0.75rem 2rem;' +
        'background: rgba(255,255,255,0.2);' +
        'color: white;' +
        'text-decoration: none;' +
        'border-radius: 8px;' +
        'font-weight: 600;' +
        'border: 2px solid white;' +
    '"><i class="fas fa-home"></i> Home</a>';

    buttonsHtml += '</div>';

    deniedMessage.innerHTML = '<div style="text-align: center; max-width: 500px;">' +
        '<i class="fas fa-lock" style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.8;"></i>' +
        '<h1 style="font-size: 2rem; margin-bottom: 1rem;">Access Denied</h1>' +
        '<p style="font-size: 1.1rem; opacity: 0.9; margin-bottom: 2rem; line-height: 1.6;">' + message + '</p>' +
        buttonsHtml +
    '</div>';
    
    deniedMessage.style.display = 'flex';
}

// Right-click and view-source shortcuts previously blocked here — removed for accessibility and to avoid false security.
// Real security is enforced via Firestore Rules + role === 'admin' check above.

function escapeFlashText(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled “classic” <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.checkAdminAccess = checkAdminAccess;
window.fetchUserDocWithRetry = fetchUserDocWithRetry;
window.isOfflineError = isOfflineError;
window.sleep = sleep;
window.showConnecting = showConnecting;
window.hideConnecting = hideConnecting;
window.getAuthUser = getAuthUser;
window.showAccessDenied = showAccessDenied;
window.escapeFlashText = escapeFlashText;

