/**
 * Sankofa Market - Dashboard JavaScript
 */

/* === SELLER VIEWS CORE START (unit-tested pure helper) === */
/** Sum + top performer for the seller's views — pure so tests can prove the math. */
function smSellerViewsSummarize(items) {
    var total = 0, count = 0, top = null;
    (items || []).forEach(function (p) {
        if (!p || typeof p !== 'object') return;
        var v = Number(p.views) || 0;
        if (v < 0) v = 0;
        total += v; count++;
        if (!top || v > top.views) {
            top = { title: String(p.title || 'Untitled'), views: v, id: p.id ? String(p.id) : '' };
        }
    });
    return { totalViews: total, listingCount: count, top: top };
}
/* === SELLER VIEWS CORE END === */


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

            // Items without data-tab are "quick links" that open their own page
            // (Wallet, Orders, Profile, Help) — they share this bar but must not
            // be treated as tabs.
            if (!tabId) return;

            const panel = document.getElementById(`${tabId}-panel`);
            if (!panel) {
                console.warn('Dashboard tab has no panel:', tabId);
                return;
            }

            // Update buttons (only real tabs can be "active")
            tabBtns.forEach(b => { if (b.dataset.tab) b.classList.remove('active'); });
            this.classList.add('active');

            // Update panels
            tabPanels.forEach(p => p.classList.remove('active'));
            panel.classList.add('active');
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

                        // "Email notifications for price drops on favorites" — saved as soon as it changes
                        var priceDropBox = document.getElementById('notifPriceDrops');
                        if (priceDropBox) {
                            priceDropBox.checked = !(d.notifications && d.notifications.priceDrops === false);
                            priceDropBox.onchange = function () { saveDashboardPriceDropPref(user.uid, priceDropBox); };
                        }
                        
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
                        if (verifiedBadge && d.verified === true) {
                            // Show tier badge
                            var tier = d.sellerTier || 'starter';
                            if (tier === 'trusted') {
                                verifiedBadge.innerHTML = '<i class="fas fa-star"></i> Trusted Seller';
                            } else if (tier === 'verified') {
                                verifiedBadge.innerHTML = '<i class="fas fa-check-circle"></i> Verified Seller';
                            } else {
                                verifiedBadge.innerHTML = '<i class="fas fa-store"></i> Starter Seller';
                            }
                            if (d.isFoundingSeller === true) {
                                verifiedBadge.innerHTML += ' 🏆';
                            }
                            verifiedBadge.style.display = '';
                        } else if (verifiedBadge && d.status === 'approved') {
                            verifiedBadge.innerHTML = '<i class="fas fa-check-circle"></i> Approved Buyer';
                            verifiedBadge.style.display = '';
                        }

                        // Show seller progress widget (verification progress or tier upgrade progress)
                        loadSellerProgress(user.uid, d);
                        
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
                // Ask the server first — the offline cache can be stale and show 0
                // Count only ACTIVE listings — the card is labelled "Active Listings".
                // (js/user-listings.js also fills this when it is loaded on the dashboard.)
                (function loadListingCount() {
                    var q = firebaseDB.collection('products').where('sellerId', '==', user.uid);
                    q.get({ source: 'server' }).catch(function () { return q.get(); })
                        .then(function (snap) {
                            var active = 0, all = [];
                            snap.forEach(function (d) {
                                var x = d.data() || {};
                                x.id = x.id || d.id;
                                all.push(x);
                                if (x.isActive !== false && x.isSold !== true) active++;
                            });
                            var el = document.getElementById('totalListings');
                            if (el) el.textContent = active;
                            // Total views card — same query, zero extra reads. Every seller
                            // (free too) sees honest eyes on their listings right here.
                            var sum = smSellerViewsSummarize(all);
                            var viewsEl = document.getElementById('totalViews');
                            if (viewsEl) {
                                viewsEl.textContent = sum.totalViews.toLocaleString();
                                var card = viewsEl.closest('.stat-card');
                                if (card) {
                                    card.title = sum.top && sum.top.views > 0
                                        ? 'Views across all ' + sum.listingCount + ' listing' + (sum.listingCount === 1 ? '' : 's') +
                                          ' \u2014 most seen: \u201C' + sum.top.title + '\u201D (' + sum.top.views.toLocaleString() + ')'
                                        : 'Views across all your listings \u2014 share your items to grow this number!';
                                    card.style.cursor = 'pointer';
                                    card.addEventListener('click', function () {
                                        window.location.href = '/pages/user/listings.html';
                                    });
                                }
                            }
                        }).catch(function () {});
                })();
                
                // Follower / following counts — new dashboard cards.
                // "People following you" comes from sellerFollowStats/{uid}, a doc the
                // updateFollowStats cloud function keeps accurate (browsers can't fake
                // it). "People you follow" is your own rows in `follows` — reads just
                // need sign-in, and we're signed in here. Server-first so a stale
                // offline cache can't show 0, exactly like the listings count above.
                (function loadFollowCounts() {
                    var followersEl = document.getElementById('dashFollowers');
                    var followingEl = document.getElementById('dashFollowing');
                    if (!followersEl && !followingEl) return;
                    if (followersEl) {
                        var sq = firebaseDB.collection('sellerFollowStats').doc(user.uid);
                        sq.get({ source: 'server' }).catch(function () { return sq.get(); })
                            .then(function (d) {
                                followersEl.textContent = (d && d.exists) ? Number((d.data() || {}).followers || 0) : 0;
                            }).catch(function () {});
                    }
                    if (followingEl) {
                        var fq = firebaseDB.collection('follows').where('followerId', '==', user.uid);
                        fq.get({ source: 'server' }).catch(function () { return fq.get(); })
                            .then(function (snap) { followingEl.textContent = snap.size; })
                            .catch(function () {});
                    }
                })();

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
// SELLER PROGRESS (ESCROW PURCHASE TRACKER)
// ============================================================================

function loadSellerProgress(uid, userData) {
    var widget = document.getElementById('sellerProgressWidget');
    if (!widget) return;

    var REQUIRED = 2;

    // Verified sellers: show tier upgrade progress (Starter → Verified → Trusted)
    if (userData.verified === true) {
        var tier = userData.sellerTier || 'starter';

        if (tier === 'trusted') {
            widget.style.display = 'none'; // Top tier — nothing to progress
            return;
        }

        if (typeof firebaseDB !== 'undefined') {
            firebaseDB.collection('orders')
                .where('buyerId', '==', uid)
                .where('status', '==', 'completed')
                .get().then(function(snap) {
                    var count = snap.size;

                    if (tier === 'starter') {
                        widget.style.display = '';
                        var pct = Math.min(100, Math.round((count / REQUIRED) * 100));
                        if (count >= REQUIRED) {
                            widget.style.borderLeftColor = '#22c55e';
                            document.getElementById('sellerProgressTitle').textContent = 'Unlock Unlimited Listings!';
                            document.getElementById('sellerProgressSubtitle').textContent = 'Escrow requirement met — you qualify as a Verified Seller. It unlocks automatically.';
                            document.getElementById('sellerProgressBar').style.width = '100%';
                            document.getElementById('sellerProgressBar').style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
                            document.getElementById('sellerProgressCount').textContent = count + ' / ' + REQUIRED + ' ✓';
                            document.getElementById('sellerProgressLabel').textContent = 'Escrow Purchases';
                        } else {
                            widget.style.borderLeftColor = '#f59e0b';
                            var remaining = REQUIRED - count;
                            document.getElementById('sellerProgressTitle').textContent = '🆕 Starter Seller — Unlock Unlimited Listings';
                            document.getElementById('sellerProgressSubtitle').textContent = 'You can list up to 10 items on the free plan. Complete ' + remaining + ' more escrow purchase' + (remaining > 1 ? 's' : '') + ' to unlock more listings';
                            document.getElementById('sellerProgressBar').style.width = pct + '%';
                            document.getElementById('sellerProgressBar').style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
                            document.getElementById('sellerProgressCount').textContent = count + ' / ' + REQUIRED;
                            document.getElementById('sellerProgressLabel').textContent = 'Escrow Purchases';
                        }
                        document.getElementById('sellerProgressLink').href = '../../search.html';
                        document.getElementById('sellerProgressLink').innerHTML = '<i class="fas fa-shopping-bag"></i> Shop';
                    } else if (tier === 'verified') {
                        // Progress toward Trusted (10 escrow sales)
                        firebaseDB.collection('orders')
                            .where('sellerId', '==', uid)
                            .where('status', '==', 'completed')
                            .get().then(function(salesSnap) {
                                var sales = salesSnap.size;
                                var TRUSTED_REQ = 10;
                                widget.style.display = '';
                                widget.style.borderLeftColor = '#22c55e';
                                var pct2 = Math.min(100, Math.round((sales / TRUSTED_REQ) * 100));
                                document.getElementById('sellerProgressTitle').textContent = '⭐ Path to Trusted Seller';
                                document.getElementById('sellerProgressSubtitle').textContent = 'Complete ' + (TRUSTED_REQ - sales) + ' more escrow sale' + ((TRUSTED_REQ - sales) === 1 ? '' : 's') + ' to earn Trusted badge + featured placement (Premium 1-2% keeps more!)';
                                document.getElementById('sellerProgressBar').style.width = pct2 + '%';
                                document.getElementById('sellerProgressBar').style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
                                document.getElementById('sellerProgressCount').textContent = sales + ' / ' + TRUSTED_REQ;
                                document.getElementById('sellerProgressLabel').textContent = 'Escrow Sales';
                                document.getElementById('sellerProgressLink').style.display = 'none';
                            });
                    }
                });
        }
        return;
    }

    // If verification is pending, show that status instead
    if (userData.verificationStatus === 'pending') {
        widget.style.display = '';
        widget.style.borderLeftColor = '#0064d2';
        document.getElementById('sellerProgressTitle').textContent = 'Verification Under Review';
        document.getElementById('sellerProgressSubtitle').textContent = 'Your seller documents are being reviewed (24-48 hours)';
        document.getElementById('sellerProgressBar').style.width = '100%';
        document.getElementById('sellerProgressBar').style.background = 'linear-gradient(90deg, #0064d2, #0052b5)';
        document.getElementById('sellerProgressCount').textContent = 'Pending Review';
        document.getElementById('sellerProgressLabel').textContent = 'Document Review';
        document.getElementById('sellerProgressDots').innerHTML = '<i class="fas fa-clock" style="color:#0064d2;font-size:1.2rem;"></i>';
        return;
    }

    // If rejected, show re-apply message
    if (userData.verificationStatus === 'rejected') {
        widget.style.display = '';
        widget.style.borderLeftColor = '#e74c3c';
        document.getElementById('sellerProgressTitle').textContent = 'Verification Rejected';
        var reason = userData.verificationRejectionReason || 'Please review the requirements and try again.';
        document.getElementById('sellerProgressSubtitle').textContent = reason;
        document.getElementById('sellerProgressBar').style.width = '0%';
        document.getElementById('sellerProgressCount').textContent = 'Action Required';
        document.getElementById('sellerProgressLabel').textContent = 'Re-apply';
        document.getElementById('sellerProgressLink').innerHTML = '<i class="fas fa-redo"></i> Re-apply';
        return;
    }

    // Fetch completed escrow orders
    if (typeof firebaseDB !== 'undefined') {
        firebaseDB.collection('orders')
            .where('buyerId', '==', uid)
            .where('status', '==', 'completed')
            .get().then(function(snap) {
                var count = snap.size;
                var percent = Math.min(100, Math.round((count / REQUIRED) * 100));

                widget.style.display = '';

                if (count >= REQUIRED) {
                    // Requirement met - show green
                    widget.style.borderLeftColor = '#22c55e';
                    document.getElementById('sellerProgressTitle').textContent = 'Ready to Become a Seller!';
                    document.getElementById('sellerProgressSubtitle').textContent = 'You\'ve completed ' + count + ' escrow purchases. Submit your documents now!';
                    document.getElementById('sellerProgressBar').style.width = '100%';
                    document.getElementById('sellerProgressBar').style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
                    document.getElementById('sellerProgressCount').textContent = count + ' / ' + REQUIRED + ' ✓';
                    document.getElementById('sellerProgressLink').innerHTML = '<i class="fas fa-arrow-right"></i> Apply Now';

                    // Update dots
                    document.getElementById('dashDot1').style.cssText = 'width:24px;height:24px;border-radius:50%;border:2px solid #22c55e;display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:white;background:#22c55e;';
                    document.getElementById('dashDot1').innerHTML = '<i class="fas fa-check" style="font-size:0.5rem;"></i>';
                    document.getElementById('dashDot2').style.cssText = 'width:24px;height:24px;border-radius:50%;border:2px solid #22c55e;display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:white;background:#22c55e;';
                    document.getElementById('dashDot2').innerHTML = '<i class="fas fa-check" style="font-size:0.5rem;"></i>';
                    document.getElementById('dashDotUnlock').style.cssText = 'width:24px;height:24px;border-radius:50%;border:2px solid #22c55e;display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:white;background:#22c55e;';
                    document.getElementById('dashDotUnlock').innerHTML = '<i class="fas fa-unlock" style="font-size:0.5rem;"></i>';
                } else {
                    // Still in progress
                    document.getElementById('sellerProgressBar').style.width = percent + '%';
                    document.getElementById('sellerProgressCount').textContent = count + ' / ' + REQUIRED;

                    var remaining = REQUIRED - count;
                    document.getElementById('sellerProgressSubtitle').textContent = remaining + ' more escrow purchase' + (remaining > 1 ? 's' : '') + ' to unlock selling';

                    // Update dots
                    if (count >= 1) {
                        document.getElementById('dashDot1').style.cssText = 'width:24px;height:24px;border-radius:50%;border:2px solid #22c55e;display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:white;background:#22c55e;';
                        document.getElementById('dashDot1').innerHTML = '<i class="fas fa-check" style="font-size:0.5rem;"></i>';
                        document.getElementById('dashDot2').style.cssText = 'width:24px;height:24px;border-radius:50%;border:2px solid #f59e0b;display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:#d97706;background:#fffbeb;';
                    }
                }
            }).catch(function(e) {
                console.warn('Error loading seller progress:', e);
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
    const filterBtns = document.querySelectorAll('.listings-filter .filter-btn');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const filter = this.dataset.filter;

            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            applyDashboardListingFilter(filter);
        });
    });
}

/** Show only the cards matching a filter. Uses data-status when present. */
function applyDashboardListingFilter(filter) {
    document.querySelectorAll('#listingsGrid .listing-card').forEach(card => {
        var status = (card.getAttribute('data-status') ||
                      (card.querySelector('.status-badge') || {}).textContent || '').toLowerCase().trim();
        if (filter === 'all' || !filter) {
            card.style.display = '';
        } else if (filter === 'draft') {
            // 'draft' and 'paused' mean the same thing to sellers
            card.style.display = (status === 'draft' || status === 'paused') ? '' : 'none';
        } else {
            card.style.display = (status === filter) ? '' : 'none';
        }
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

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled “classic” <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.initTabs = initTabs;
window.loadUserData = loadUserData;
window.loadSellerProgress = loadSellerProgress;
window.initLogout = initLogout;
window.initListingsFilters = initListingsFilters;
window.applyDashboardListingFilter = applyDashboardListingFilter;
/** Saves the price-drop email switch straight away. Puts the switch back if the save fails. */
function saveDashboardPriceDropPref(uid, box) {
    var on = box.checked;
    firebaseDB.collection('users').doc(uid).update({
        'notifications.priceDrops': on,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
        showFlashMessage(on ? 'Price-drop emails are on.' : 'Price-drop emails are off.', 'success');
    }).catch(function (e) {
        box.checked = !on;                       // keep the screen in line with what is saved
        showFlashMessage('Could not save that setting: ' + (e && e.message ? e.message : e), 'error');
    });
}

window.initSettingsForm = initSettingsForm;

