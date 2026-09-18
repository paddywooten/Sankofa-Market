/* ============================================================================
   SANKOFA MARKET - USER PROFILE PAGE
   ============================================================================ */

document.addEventListener('DOMContentLoaded', function() {
    initProfileForm();
    initNotificationPreferences();
    initDangerZone();
    initAvatarUpload();
});

/* ---- Profile Form ---- */
function initProfileForm() {
    const editBtn = document.getElementById('editProfileBtn');
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            const inputs = document.querySelectorAll('.profile-section input:not([type="checkbox"]), .profile-section select, .profile-section textarea');
            const isDisabled = inputs[0]?.disabled;
            
            inputs.forEach(input => {
                input.disabled = !isDisabled;
            });
            
            this.innerHTML = isDisabled ? '<i class="fas fa-times"></i> Cancel' : '<i class="fas fa-edit"></i> Edit';
            
            if (isDisabled) {
                this.classList.remove('btn-outline');
                this.classList.add('btn-danger');
            } else {
                this.classList.remove('btn-danger');
                this.classList.add('btn-outline');
            }
        });
    }

    // Save profile form
    const saveForm = document.querySelector('.profile-section form');
    if (saveForm) {
        saveForm.addEventListener('submit', function(e) {
            e.preventDefault();
            showProfileNotification('Profile updated successfully!', 'success');
        });
    }
}

/* ---- Notification Preferences ---- */
function initNotificationPreferences() {
    const notifForm = document.querySelector('.profile-section form:last-of-type');
    if (notifForm) {
        notifForm.addEventListener('submit', function(e) {
            e.preventDefault();
            showProfileNotification('Notification preferences saved!', 'success');
        });
    }
}

/* ---- Danger Zone ---- */
function initDangerZone() {
    const deactivateBtn = document.getElementById('deactivateBtn');
    if (deactivateBtn) {
        deactivateBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to deactivate your account?\n\nYour listings will be hidden and you won\'t be able to buy or sell until you reactivate.')) {
                showProfileNotification('Account deactivated. You can reactivate anytime by logging in.', 'warning');
            }
        });
    }

    const deleteBtn = document.getElementById('deleteAccountBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            const confirmed = confirm('⚠️ WARNING: This action is PERMANENT!\n\nAll your data, listings, orders, and messages will be permanently deleted.\n\nType "DELETE" to confirm:');
            if (confirmed) {
                const input = prompt('Type DELETE to confirm account deletion:');
                if (input === 'DELETE') {
                    showProfileNotification('Account deletion request submitted. Your account will be deleted within 30 days.', 'error');
                } else {
                    showProfileNotification('Account deletion cancelled.', 'info');
                }
            }
        });
    }
}

/* ---- Avatar Upload ---- */
function initAvatarUpload() {
    const avatarBtn = document.querySelector('.avatar-edit-btn');
    if (avatarBtn) {
        avatarBtn.addEventListener('click', function() {
            // Create a hidden file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                        showProfileNotification('Image must be less than 5MB', 'error');
                        return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = function(ev) {
                        const avatar = document.getElementById('userAvatar');
                        if (avatar) {
                            avatar.src = ev.target.result;
                            showProfileNotification('Profile photo updated!', 'success');
                        }
                    };
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        });
    }
}

/* ---- Notification ---- */
function showProfileNotification(message, type) {
    document.querySelectorAll('.profile-notification').forEach(n => n.remove());
    
    const colors = { info: 'var(--primary-color)', success: 'var(--success-color)', warning: 'var(--accent-color)', error: 'var(--error-color)' };
    const icons = { info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-circle', error: 'fa-times-circle' };
    
    const notification = document.createElement('div');
    notification.className = 'profile-notification';
    notification.style.cssText = `position:fixed;top:1rem;right:1rem;z-index:10000;background:white;padding:1rem 1.5rem;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);display:flex;align-items:center;gap:0.75rem;border-left:4px solid ${colors[type]};max-width:400px;`;
    notification.innerHTML = `<i class="fas ${icons[type]}" style="color:${colors[type]};font-size:1.25rem;"></i><span style="font-size:0.9rem;">${message}</span>`;
    
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.transition = 'opacity 0.3s';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
