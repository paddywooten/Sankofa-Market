/**
 * Sankofa Market - Dashboard JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    initLogout();
    initSettingsForm();
    initListingsFilters();
    loadUserData();
});

// ============================================================================
// TABS
// ============================================================================

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update panels
            tabPanels.forEach(panel => panel.classList.remove('active'));
            document.getElementById(`${tabId}-panel`).classList.add('active');
        });
    });
}

// ============================================================================
// USER DATA
// ============================================================================

function loadUserData() {
    // Check if user is logged in
    const user = localStorage.getItem('sankofa_user');
    
    if (!user && typeof firebaseAuth === 'undefined') {
        // Firebase not loaded - show basic greeting
        document.getElementById('userName').textContent = 'Welcome!';
        document.getElementById('userEmail').textContent = '';
        return;
    }
    

    
    // Firebase auth state + Firestore profile loading
    if (typeof firebaseAuth !== 'undefined') {
        firebaseAuth.onAuthStateChanged(function(user) {
            if (!user) {
                window.location.href = '../auth/login.html';
                return;
            }
            document.getElementById('userName').textContent = 'Welcome, ' + (user.displayName || 'User') + '!';
            document.getElementById('userEmail').textContent = user.email;
            
            // Load full profile from Firestore
            if (typeof firebaseDB !== 'undefined') {
                firebaseDB.collection('users').doc(user.uid).get().then(function(doc) {
                    if (doc.exists) {
                        var d = doc.data();
                        var name = d.firstName || d.name || user.displayName || 'User';
                        document.getElementById('userName').textContent = 'Welcome, ' + name + '!';
                        document.getElementById('userEmail').textContent = d.email || user.email;
                        if (d.firstName) document.getElementById('settingsFirstName').value = d.firstName;
                        if (d.lastName) document.getElementById('settingsLastName').value = d.lastName;
                        if (d.email) document.getElementById('settingsEmail').value = d.email;
                        if (d.phone) document.getElementById('settingsPhone').value = d.phone;
                        if (d.region) document.getElementById('settingsRegion').value = d.region;
                        if (d.city) document.getElementById('settingsCity').value = d.city;
                        
                        // Update avatar
                        var avatarImg = document.getElementById('userAvatar');
                        var avatarFallback = document.getElementById('userAvatarFallback');
                        if (d.photoURL) {
                            avatarImg.src = d.photoURL;
                            avatarImg.style.display = '';
                            if (avatarFallback) avatarFallback.style.display = 'none';
                        } else {
                            var initial = (d.firstName || d.name || name || 'U').charAt(0).toUpperCase();
                            if (avatarFallback) avatarFallback.textContent = initial;
                        }
                        
                        // Update verified badge
                        var verifiedBadge = document.getElementById('verifiedBadge');
                        if (verifiedBadge && d.status === 'approved') {
                            verifiedBadge.style.display = '';
                        }
                        
                        // Update member since badge
                        var memberSinceText = document.getElementById('memberSinceText');
                        if (memberSinceText && d.createdAt) {
                            var joinDate = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
                            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                            memberSinceText.textContent = 'Member since ' + months[joinDate.getMonth()] + ' ' + joinDate.getFullYear();
                        }
                    }
                }).catch(function(e) { console.warn('Profile load error:', e); });
                
                // Load user listing count
                firebaseDB.collection('products').where('sellerId', '==', user.uid).get().then(function(snap) {
                    document.getElementById('totalListings').textContent = snap.size;
                }).catch(function() {});
                
                // Load unread message count
                firebaseDB.collection('conversations')
                    .where('participants', 'array-contains', user.uid)
                    .get().then(function(snap) {
                        var unread = 0;
                        snap.forEach(function(doc) {
                            var d = doc.data();
                            if (d.unreadBy && d.unreadBy.indexOf(user.uid) >= 0) {
                                unread++;
                            }
                        });
                        // Update dashboard badge
                        var badge = document.getElementById('dashMsgBadge');
                        if (badge && unread > 0) {
                            badge.textContent = unread;
                            badge.style.display = '';
                        }
                    }).catch(function() {});
            }
        });
    }
}

// ============================================================================
// LOGOUT
// ============================================================================

function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    
    logoutBtn.addEventListener('click', async function() {
        try {
            if (typeof firebaseAuth !== 'undefined') {
                await firebaseAuth.signOut();
            }
            
            localStorage.removeItem('sankofa_user');
            showFlashMessage('Logged out successfully', 'success');
            
            setTimeout(() => {
                window.location.href = '../../index.html';
            }, 1000);
        } catch (error) {
            console.error('Logout error:', error);
            showFlashMessage('Error logging out', 'error');
        }
    });
}

// ============================================================================
// LISTINGS FILTERS
// ============================================================================

function initListingsFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const listingCards = document.querySelectorAll('.listing-card');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const filter = this.dataset.filter;
            
            // Update buttons
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Filter listings
            listingCards.forEach(card => {
                if (filter === 'all') {
                    card.style.display = 'flex';
                } else {
                    const status = card.querySelector('.status-badge');
                    if (status) {
                        const statusText = status.textContent.toLowerCase();
                        card.style.display = statusText === filter ? 'flex' : 'none';
                    }
                }
            });
        });
    });
}

// ============================================================================
// SETTINGS FORM
// ============================================================================

function initSettingsForm() {
    const form = document.getElementById('settingsForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const stopLoading = showLoading(submitBtn);
        
        try {
            const formData = {
                firstName: document.getElementById('settingsFirstName').value,
                lastName: document.getElementById('settingsLastName').value,
                phone: document.getElementById('settingsPhone').value,
                region: document.getElementById('settingsRegion').value,
                city: document.getElementById('settingsCity').value
            };
            
            // Update password if provided
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;
            
            if (newPassword) {
                if (newPassword !== confirmNewPassword) {
                    showFlashMessage('New passwords do not match', 'error');
                    stopLoading();
                    return;
                }
                
                if (typeof firebaseAuth !== 'undefined' && firebaseAuth.currentUser) {
                    // Re-authenticate and update password
                    const credential = firebase.auth.EmailAuthProvider.credential(
                        firebaseAuth.currentUser.email,
                        currentPassword
                    );
                    
                    await firebaseAuth.currentUser.reauthenticateWithCredential(credential);
                    await firebaseAuth.currentUser.updatePassword(newPassword);
                }
            }
            
            // Save to Firebase
            if (typeof firebaseDB !== 'undefined' && firebaseAuth.currentUser) {
                await firebaseDB.collection('users').doc(firebaseAuth.currentUser.uid).update(formData);
            }
            
            // Update display name
            document.getElementById('userName').textContent = 'Welcome, ' + (formData.firstName || 'User') + '!';
            
            showFlashMessage('Settings saved successfully!', 'success');
            
            // Clear password fields
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmNewPassword').value = '';
            
        } catch (error) {
            console.error('Settings error:', error);
            showFlashMessage('Error saving settings', 'error');
        } finally {
            stopLoading();
        }
    });
}

// ============================================================================
// ACCOUNT DEACTIVATE & DELETE (Dashboard Settings)
// ============================================================================

(function() {
    // Deactivate Account
    var deactivateBtn = document.getElementById('dashDeactivateBtn');
    if (deactivateBtn) {
        deactivateBtn.addEventListener('click', function() {
            if (!confirm('Are you sure you want to deactivate your account?\n\nYour listings will be hidden and you won\'t be able to buy or sell until you reactivate.\n\nYou can reactivate by contacting support at sankofamarketgh@gmail.com')) return;
            
            if (typeof firebaseAuth === 'undefined' || !firebaseAuth.currentUser) return;
            var uid = firebaseAuth.currentUser.uid;
            
            deactivateBtn.disabled = true;
            deactivateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deactivating...';
            
            firebase.firestore().collection('users').doc(uid).update({
                status: 'deactivated',
                deactivatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(function() {
                return firebaseAuth.signOut();
            }).then(function() {
                showFlashMessage('Account deactivated. Contact support to reactivate.', 'success');
                setTimeout(function() { window.location.href = '../../index.html'; }, 2000);
            }).catch(function(err) {
                showFlashMessage('Error: ' + err.message, 'error');
                deactivateBtn.disabled = false;
                deactivateBtn.innerHTML = '<i class="fas fa-pause"></i> Deactivate';
            });
        });
    }
    
    // Delete Account
    var deleteBtn = document.getElementById('dashDeleteAccountBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            if (!confirm('⚠️ WARNING: This action is PERMANENT!\n\nAll your data, listings, orders, and messages will be permanently deleted.\n\nThis CANNOT be undone.')) return;
            
            var input = prompt('Type DELETE to confirm account deletion:');
            if (input !== 'DELETE') {
                showFlashMessage('Account deletion cancelled.', 'info');
                return;
            }
            
            if (typeof firebaseAuth === 'undefined' || !firebaseAuth.currentUser) return;
            var uid = firebaseAuth.currentUser.uid;
            
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            
            // Delete user's products
            firebase.firestore().collection('products').where('sellerId', '==', uid).get().then(function(snap) {
                var batch = firebase.firestore().batch();
                snap.forEach(function(doc) { batch.delete(doc.ref); });
                return batch.commit();
            }).then(function() {
                // Delete user document
                return firebase.firestore().collection('users').doc(uid).delete();
            }).then(function() {
                // Delete auth account
                return firebaseAuth.currentUser.delete();
            }).then(function() {
                window.location.href = '../../index.html';
            }).catch(function(err) {
                showFlashMessage('Error deleting account. Please contact support at sankofamarketgh@gmail.com: ' + err.message, 'error');
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete Account';
            });
        });
    }
})();
