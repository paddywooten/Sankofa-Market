/* Sankofa Market — public-site maintenance gate.
 * The admin setting is stored at settings/maintenance. Admins retain access.
 */
function smMaintenanceSettingEnabled(snapshot){
    return !!(snapshot && snapshot.exists && snapshot.data && snapshot.data().enabled === true);
}

function smIsMaintenanceLoginPath(path){
    return /^\/pages\/(?:auth|admin)\/login(?:\.html)?\/?$/.test(String(path || ''));
}

function smIsMaintenancePagePath(path){
    return /^\/pages\/maintenance(?:\.html)?\/?$/.test(String(path || ''));
}

function smSafeMaintenanceReturnTo(value){
    var target = String(value || '').trim();
    if (!target || target.charAt(0) !== '/' || target.indexOf('//') === 0) return '/index.html';
    if (smIsMaintenancePagePath(target.split('?')[0].split('#')[0])) return '/index.html';
    return target;
}

function smMaintenanceShouldBlock(enabled, path, authReady, user, adminReady, isAdmin){
    if (!enabled || smIsMaintenanceLoginPath(path) || smIsMaintenancePagePath(path)) return false;
    if (!authReady) return false;
    if (!user) return true;
    if (!adminReady) return false;
    return isAdmin !== true;
}

(function(global, document){
    if (!global || !document || global._sankofaMaintenanceGuardLoaded) return;
    global._sankofaMaintenanceGuardLoaded = true;

    function loadScript(src){
        return new Promise(function(resolve, reject){
            var script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = function(){ reject(new Error('Could not load Firebase library')); };
            (document.head || document.body).appendChild(script);
        });
    }
    function getMaintenanceAuth(){
        try{ if (typeof firebaseAuth !== 'undefined' && firebaseAuth) return firebaseAuth; }catch(e){}
        try{ if (global.firebase && typeof global.firebase.auth === 'function') return global.firebase.auth(); }catch(e){}
        return null;
    }
    function getMaintenanceDb(){
        try{ if (typeof firebaseDB !== 'undefined' && firebaseDB) return firebaseDB; }catch(e){}
        try{ if (global.firebase && typeof global.firebase.firestore === 'function') return global.firebase.firestore(); }catch(e){}
        return null;
    }
    function ensureFirebaseReady(){
        if (getMaintenanceDb() && getMaintenanceAuth()) return Promise.resolve();
        var chain = Promise.resolve();
        if (!global.firebase) chain = chain.then(function(){ return loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js'); });
        chain = chain.then(function(){
            if (!global.firebase || typeof global.firebase.auth !== 'function') return loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js');
        });
        chain = chain.then(function(){
            if (!global.firebase || typeof global.firebase.firestore !== 'function') return loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js');
        });
        chain = chain.then(function(){
            if (!getMaintenanceDb() || !getMaintenanceAuth()) return loadScript('/config/firebase-config.js?v=6');
        });
        return chain;
    }

    function startSankofaMaintenanceGuard(){
        if (global._sankofaMaintenanceGuardStarted) return;
        var path = global.location.pathname || '/';
        var isMaintenancePage = smIsMaintenancePagePath(path);
        if (smIsMaintenanceLoginPath(path)) return; // Admin must always be able to sign in.
        var auth = getMaintenanceAuth();
        var db = getMaintenanceDb();
        if (!auth || !db){
            if (global._sankofaMaintenanceFirebaseLoading) return;
            global._sankofaMaintenanceFirebaseLoading = true;
            ensureFirebaseReady().then(function(){
                global._sankofaMaintenanceFirebaseLoading = false;
                startSankofaMaintenanceGuard();
            }).catch(function(error){
                global._sankofaMaintenanceFirebaseLoading = false;
                console.warn('Maintenance status could not be checked; leaving the site available.', error && error.message);
            });
            return;
        }
        global._sankofaMaintenanceGuardStarted = true;

        var state = {
            settingReady: false,
            enabled: false,
            authReady: false,
            user: null,
            adminReady: false,
            isAdmin: false,
            adminCheckPending: false,
            redirecting: false
        };
        var overlay = null;

        function hideOverlay(){
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            overlay = null;
        }
        function showOverlay(message){
            if (!document.body) return;
            if (!overlay){
                overlay = document.createElement('div');
                overlay.id = 'sankofaMaintenanceCheck';
                overlay.setAttribute('role', 'status');
                overlay.setAttribute('aria-live', 'polite');
                overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#f8fafc;display:flex;align-items:center;justify-content:center;padding:1.5rem;text-align:center;font:600 16px system-ui,sans-serif;color:#334155;';
                document.body.appendChild(overlay);
            }
            overlay.textContent = message || 'Checking site availability…';
        }
        function maintenanceReturnTarget(){
            var params = new URLSearchParams(global.location.search || '');
            var target = smSafeMaintenanceReturnTo(params.get('returnTo'));
            if (!params.has('returnTo') && state.isAdmin) return '/sm-panel/dashboard';
            return target;
        }
        function redirectFromMaintenance(){
            if (!isMaintenancePage || state.redirecting) return;
            state.redirecting = true;
            global.location.replace(maintenanceReturnTarget());
        }
        function redirectToMaintenance(){
            if (state.redirecting || isMaintenancePage) return;
            state.redirecting = true;
            var returnTo = smSafeMaintenanceReturnTo(global.location.pathname + (global.location.search || '') + (global.location.hash || ''));
            global.location.replace('/pages/maintenance.html?returnTo=' + encodeURIComponent(returnTo));
        }
        function finishAdminCheck(user, answer){
            if (state.user !== user) return;
            state.adminCheckPending = false;
            state.adminReady = true;
            state.isAdmin = answer === true;
            evaluate();
        }
        function checkAdmin(){
            if (!state.user || state.adminReady || state.adminCheckPending) return;
            state.adminCheckPending = true;
            var user = state.user;
            if (global.userData && global.userData.role === 'admin'){
                finishAdminCheck(user, true);
                return;
            }
            Promise.resolve().then(function(){
                return typeof user.getIdTokenResult === 'function' ? user.getIdTokenResult() : null;
            }).then(function(token){
                if (token && token.claims && token.claims.admin === true) return true;
                return db.collection('users').doc(user.uid).get().then(function(profile){
                    return !!(profile.exists && profile.data() && profile.data().role === 'admin');
                }).catch(function(){ return false; });
            }).catch(function(){ return false; }).then(function(isAdmin){
                finishAdminCheck(user, isAdmin);
            });
        }
        function evaluate(){
            if (!state.settingReady) return;
            if (!state.enabled){
                hideOverlay();
                try{ global.localStorage.removeItem('sankofa_maintenance_mode'); }catch(e){}
                if (isMaintenancePage) redirectFromMaintenance();
                return;
            }
            try{ global.localStorage.setItem('sankofa_maintenance_mode', '1'); }catch(e){}
            if (isMaintenancePage){
                if (state.authReady && state.user && state.adminReady && state.isAdmin) redirectFromMaintenance();
                return;
            }
            if (smMaintenanceShouldBlock(true, path, state.authReady, state.user, state.adminReady, state.isAdmin)){
                redirectToMaintenance();
                return;
            }
            if (!state.authReady){ showOverlay('Checking site access…'); return; }
            if (state.user && !state.adminReady){ showOverlay('Checking administrator access…'); checkAdmin(); return; }
            if (state.isAdmin) hideOverlay();
        }

        auth.onAuthStateChanged(function(user){
            state.authReady = true;
            state.user = user || null;
            state.adminReady = !user;
            state.isAdmin = false;
            state.adminCheckPending = false;
            evaluate();
        });
        db.collection('settings').doc('maintenance').onSnapshot(function(snapshot){
            state.settingReady = true;
            state.enabled = smMaintenanceSettingEnabled(snapshot);
            evaluate();
        }, function(error){
            console.warn('Maintenance status could not be read; leaving the site available.', error && error.message);
            // Fail open if Firebase cannot be reached; do not lock out the site or its admin.
            state.settingReady = true;
            state.enabled = false;
            evaluate();
        });
    }

    global.startSankofaMaintenanceGuard = startSankofaMaintenanceGuard;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startSankofaMaintenanceGuard, { once: true });
    else startSankofaMaintenanceGuard();
})(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null);
