/**
 * Sankofa Market - User Profile (Firebase Connected)
 * Loads and saves user profile data from/to Firestore
 */

document.addEventListener('DOMContentLoaded', function() {
    initProfilePage();
});

async function initProfilePage() {
    // Wait for Firebase auth
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.warn('Firebase not available - profile page in demo mode');
        initProfileUI();
        return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            await loadUserProfile(user);
        } else {
            // Not logged in - redirect to login
            window.location.href = '../../pages/auth/login.html?redirect=profile';
        }
    });

    initProfileUI();
}

function initProfileUI() {
    initEditToggle();
    initProfileForm();
    initNotificationPreferences();
    initDangerZone();
    initAvatarUpload();
}

/* ============================
   LOAD USER PROFILE FROM FIRESTORE
   ============================ */

async function loadUserProfile(user) {
    try {
        const doc = await firebase.firestore().collection('users').doc(user.uid).get();

        if (doc.exists) {
            const data = doc.data();

            // Populate form fields
            setInputValue('firstName', data.firstName || data.name?.split(' ')[0] || '');
            setInputValue('lastName', data.lastName || data.name?.split(' ').slice(1).join(' ') || '');
            setInputValue('email', data.email || user.email || '');
            setInputValue('phone', data.phone || '');
            setInputValue('bio', data.bio || '');

            // Set region dropdown
            const regionSelect = document.getElementById('region');
            if (regionSelect && data.region) {
                regionSelect.value = data.region;
            }

            // Set city
            setInputValue('city', data.city || '');

            // Update display elements
            const userName = document.getElementById('userName');
            if (userName) userName.textContent = data.name || data.firstName || 'User';

            const userEmail = document.getElementById('userEmail');
            if (userEmail) userEmail.textContent = data.email || user.email;

            // Update avatar
            const avatar = document.getElementById('userAvatar');
            if (avatar && data.photoURL) {
                avatar.src = data.photoURL;
            }

            // Store UID for later use
            window.currentUserId = user.uid;
            window.currentUserData = data;

            console.log('✅ Profile loaded from Firestore');
        } else {
            // User exists in Auth but no Firestore doc yet - create one
            await firebase.firestore().collection('users').doc(user.uid).set({
                email: user.email,
                name: user.displayName || '',
                firstName: '',
                lastName: '',
                phone: '',
                bio: '',
                region: '',
                city: '',
                photoURL: '',
                status: 'pending',
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Created new user profile in Firestore');
            window.currentUserId = user.uid;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showProfileNotification('Error loading profile: ' + error.message, 'error');
    }
}

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

/* ============================
   SAVE PROFILE TO FIRESTORE
   ============================ */

function initProfileForm() {
    const saveForm = document.querySelector('.profile-section form');
    if (!saveForm) return;

    saveForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!window.currentUserId) {
            showProfileNotification('Please log in to save your profile', 'error');
            return;
        }

        const firstName = document.getElementById('firstName')?.value.trim() || '';
        const lastName = document.getElementById('lastName')?.value.trim() || '';
        const phone = document.getElementById('phone')?.value.trim() || '';
        const bio = document.getElementById('bio')?.value.trim() || '';
        const region = document.getElementById('region')?.value || '';
        const city = document.getElementById('city')?.value.trim() || '';

        const updateData = {
            firstName,
            lastName,
            name: `${firstName} ${lastName}`.trim(),
            phone,
            bio,
            region,
            city,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await firebase.firestore().collection('users').doc(window.currentUserId).update(updateData);

            // Update local data
            window.currentUserData = { ...window.currentUserData, ...updateData };

            // Update display
            const userName = document.getElementById('userName');
            if (userName) userName.textContent = updateData.name;

            showProfileNotification('Profile updated successfully!', 'success');

            // Disable edit mode
            const editBtn = document.getElementById('editProfileBtn');
            if (editBtn) editBtn.click();

        } catch (error) {
            console.error('Error saving profile:', error);
            showProfileNotification('Error saving profile: ' + error.message, 'error');
        }
    });
}

/* ============================
   EDIT TOGGLE
   ============================ */

function initEditToggle() {
    const editBtn = document.getElementById('editProfileBtn');
    if (!editBtn) return;

    editBtn.addEventListener('click', function() {
        const inputs = document.querySelectorAll('.profile-section input:not([type="checkbox"]), .profile-section select, .profile-section textarea');
        const isDisabled = inputs[0]?.disabled;

        inputs.forEach(input => {
            input.disabled = !isDisabled;
        });

        if (isDisabled) {
            this.innerHTML = '<i class="fas fa-times"></i> Cancel';
            this.classList.remove('btn-outline');
            this.classList.add('btn-danger');
        } else {
            this.innerHTML = '<i class="fas fa-edit"></i> Edit';
            this.classList.remove('btn-danger');
            this.classList.add('btn-outline');
        }
    });
}

/* ============================
   NOTIFICATION PREFERENCES
   ============================ */

function initNotificationPreferences() {
    const notifForm = document.querySelector('.profile-section form:last-of-type');
    if (!notifForm) return;

    // Load saved preferences
    if (window.currentUserData?.notifications) {
        const prefs = window.currentUserData.notifications;
        if (document.getElementById('emailNotifications')) document.getElementById('emailNotifications').checked = prefs.email !== false;
        if (document.getElementById('orderNotifications')) document.getElementById('orderNotifications').checked = prefs.orders !== false;
        if (document.getElementById('messageNotifications')) document.getElementById('messageNotifications').checked = prefs.messages !== false;
        if (document.getElementById('marketingEmails')) document.getElementById('marketingEmails').checked = prefs.marketing === true;
    }

    notifForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!window.currentUserId) return;

        const notifications = {
            email: document.getElementById('emailNotifications')?.checked ?? true,
            orders: document.getElementById('orderNotifications')?.checked ?? true,
            messages: document.getElementById('messageNotifications')?.checked ?? true,
            marketing: document.getElementById('marketingEmails')?.checked ?? false
        };

        try {
            await firebase.firestore().collection('users').doc(window.currentUserId).update({
                notifications,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showProfileNotification('Notification preferences saved!', 'success');
        } catch (error) {
            showProfileNotification('Error saving preferences: ' + error.message, 'error');
        }
    });
}

/* ============================
   DANGER ZONE (Deactivate / Delete)
   ============================ */

function initDangerZone() {
    const deactivateBtn = document.getElementById('deactivateBtn');
    if (deactivateBtn) {
        deactivateBtn.addEventListener('click', async function() {
            if (!confirm('Are you sure you want to deactivate your account?\n\nYour listings will be hidden and you won\'t be able to buy or sell until you reactivate.')) return;

            if (!window.currentUserId) return;

            try {
                await firebase.firestore().collection('users').doc(window.currentUserId).update({
                    status: 'deactivated',
                    deactivatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                await firebase.auth().signOut();
                window.location.href = '../../index.html';
            } catch (error) {
                showProfileNotification('Error: ' + error.message, 'error');
            }
        });
    }

    const deleteBtn = document.getElementById('deleteAccountBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            if (!confirm('⚠️ WARNING: This action is PERMANENT!\n\nAll your data, listings, orders, and messages will be permanently deleted.')) return;

            const input = prompt('Type DELETE to confirm account deletion:');
            if (input !== 'DELETE') {
                showProfileNotification('Account deletion cancelled.', 'info');
                return;
            }

            if (!window.currentUserId) return;

            try {
                // Delete user data from Firestore
                await firebase.firestore().collection('users').doc(window.currentUserId).delete();

                // Delete user's products
                const products = await firebase.firestore().collection('products')
                    .where('sellerId', '==', window.currentUserId).get();
                const batch = firebase.firestore().batch();
                products.forEach(doc => batch.delete(doc.ref));
                await batch.commit();

                // Delete auth account
                await firebase.auth().currentUser.delete();

                window.location.href = '../../index.html';
            } catch (error) {
                showProfileNotification('Error deleting account. Please contact support: ' + error.message, 'error');
            }
        });
    }
}

/* ============================
   AVATAR UPLOAD TO FIREBASE STORAGE
   ============================ */

function initAvatarUpload() {
    const avatarBtn = document.querySelector('.avatar-edit-btn');
    if (!avatarBtn) return;

    avatarBtn.addEventListener('click', function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                showProfileNotification('Image must be less than 5MB', 'error');
                return;
            }

            if (!window.currentUserId) {
                showProfileNotification('Please log in to upload a photo', 'error');
                return;
            }

            showProfileNotification('Uploading photo...', 'info');

            try {
                // Upload to Firebase Storage
                const storageRef = firebase.storage().ref();
                const fileRef = storageRef.child(`avatars/${window.currentUserId}/${Date.now()}_${file.name}`);
                await fileRef.put(file);

                // Get download URL
                const downloadURL = await fileRef.getDownloadURL();

                // Update Firestore
                await firebase.firestore().collection('users').doc(window.currentUserId).update({
                    photoURL: downloadURL,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Update UI
                const avatar = document.getElementById('userAvatar');
                if (avatar) avatar.src = downloadURL;

                showProfileNotification('Profile photo updated!', 'success');
            } catch (error) {
                console.error('Upload error:', error);
                // Fallback: use local preview
                const reader = new FileReader();
                reader.onload = function(ev) {
                    const avatar = document.getElementById('userAvatar');
                    if (avatar) avatar.src = ev.target.result;
                    showProfileNotification('Photo set locally (cloud upload failed)', 'warning');
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    });
}

/* ============================
   NOTIFICATION HELPER
   ============================ */

function showProfileNotification(message, type) {
    document.querySelectorAll('.profile-notification').forEach(n => n.remove());

    const colors = { info: 'var(--primary-color)', success: 'var(--success-color)', warning: 'var(--accent-color)', error: 'var(--error-color)' };
    const icons = { info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-circle', error: 'fa-times-circle' };

    const notification = document.createElement('div');
    notification.className = 'profile-notification';
    notification.style.cssText = `position:fixed;top:1rem;right:1rem;z-index:10000;background:white;padding:1rem 1.5rem;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);display:flex;align-items:center;gap:0.75rem;border-left:4px solid ${colors[type]};max-width:400px;`;
    notification.innerHTML = `<i class="fas ${icons[type]}" style="color:${colors[type]};font-size:1.25rem;"></i><span style="font-size:0.9rem;">${message}</span>`;

    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.transition = 'opacity 0.3s';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3500);
}
