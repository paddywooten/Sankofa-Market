/**
 * Sankofa Market - Admin Management (with Roles)
 * Handles: add admins with roles, change password, reset admin code, remove admins
 */

// Role definitions with permissions
const ADMIN_ROLES = {
    super_admin: {
        label: '👑 Super Admin',
        color: '#8b5cf6',
        permissions: {
            manageUsers: true,
            manageProducts: true,
            manageOrders: true,
            viewAnalytics: true,
            monitorChats: true,
            flagProducts: true,
            blockSellers: true,
            manageDisputes: true,
            manageAdmins: true,
            manageSettings: true
        }
    },
    manager: {
        label: '📋 Manager',
        color: '#0064d2',
        permissions: {
            manageUsers: true,
            manageProducts: true,
            manageOrders: true,
            viewAnalytics: true,
            monitorChats: true,
            flagProducts: true,
            blockSellers: true,
            manageDisputes: true,
            manageAdmins: false,
            manageSettings: false
        }
    },
    support: {
        label: '🎧 Support Staff',
        color: '#f5af02',
        permissions: {
            manageUsers: false,
            manageProducts: false,
            manageOrders: true,
            viewAnalytics: false,
            monitorChats: true,
            flagProducts: false,
            blockSellers: false,
            manageDisputes: true,
            manageAdmins: false,
            manageSettings: false
        }
    },
    moderator: {
        label: '🛡️ Moderator',
        color: '#86b817',
        permissions: {
            manageUsers: false,
            manageProducts: true,
            manageOrders: false,
            viewAnalytics: false,
            monitorChats: false,
            flagProducts: true,
            blockSellers: true,
            manageDisputes: false,
            manageAdmins: false,
            manageSettings: false
        }
    }
};

const PERM_LABELS = {
    manageUsers: '👥 Manage Users',
    manageProducts: '📦 Manage Products',
    manageOrders: '🛒 Manage Orders',
    viewAnalytics: '📊 View Analytics',
    monitorChats: '💬 Monitor Chats',
    flagProducts: '🚩 Flag Products',
    blockSellers: '🚫 Block Sellers',
    manageDisputes: '⚖️ Manage Disputes',
    manageAdmins: '🔐 Manage Admins',
    manageSettings: '⚙️ Site Settings'
};

document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('section-admins')) return;
    initAdminManagement();
});

/**
 * Escape text before it is placed into innerHTML (flash messages, admin tables,
 * cart rows...). User-supplied values — listing titles, names, error messages —
 * must never be able to inject markup.
 *
 * NOTE: this helper is called from main.js, admin.js and admin-management.js; keep
 * the definition present in every file that uses it (the bundler treats each file
 * as its own scope).
 */
function escapeFlashText(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function initAdminManagement() {
    loadMyAdminInfo();
    loadAllAdmins();
    bindAdminButtons();
    updateRolePreview(); // Show initial preview
}

/* ============================
   ROLE PREVIEW
   ============================ */

function updateRolePreview() {
    const select = document.getElementById('newAdminRole');
    const preview = document.getElementById('rolePermissionsPreview');
    if (!select || !preview) return;

    const role = ADMIN_ROLES[select.value];
    if (!role) return;

    let html = '<strong>Permissions for ' + role.label + ':</strong><br>';
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.2rem; margin-top: 0.35rem;">';
    for (const [key, label] of Object.entries(PERM_LABELS)) {
        const has = role.permissions[key];
        html += `<span>${has ? '✅' : '❌'} ${label}</span>`;
    }
    html += '</div>';
    preview.innerHTML = html;
}

/* ============================
   LOAD MY ADMIN INFO
   ============================ */

async function loadMyAdminInfo() {
    const infoEl = document.getElementById('myAdminInfo');
    const permsEl = document.getElementById('myPermissions');

    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth().currentUser) {
        infoEl.innerHTML = '<p style="color: #e74c3c;">Not authenticated</p>';
        return;
    }

    try {
        const user = firebase.auth().currentUser;
        const doc = await firebase.firestore().collection('users').doc(user.uid).get();

        if (!doc.exists) {
            infoEl.innerHTML = '<p style="color: #e74c3c;">Admin profile not found</p>';
            return;
        }

        const data = doc.data();
        const adminRole = data.adminRole || 'super_admin';
        const roleInfo = ADMIN_ROLES[adminRole] || ADMIN_ROLES.super_admin;

        infoEl.innerHTML = `
            <div style="display: grid; gap: 0.4rem; font-size: 0.9rem;">
                <div><strong>Name:</strong> ${data.name || 'N/A'}</div>
                <div><strong>Email:</strong> ${data.email || user.email}</div>
                <div><strong>Phone:</strong> ${data.phone || 'N/A'}</div>
                <div><strong>Admin Code:</strong> <code style="background: rgba(0,100,210,0.08); padding: 0.1rem 0.4rem; border-radius: 4px;">${data.adminCode || 'Not set'}</code></div>
                <div><strong>Role:</strong> <span style="background: ${roleInfo.color}; color: white; padding: 0.15rem 0.6rem; border-radius: 50px; font-size: 0.75rem; font-weight: 600;">${roleInfo.label}</span></div>
            </div>
        `;

        // Permissions
        const perms = data.permissions || {};
        let permsHTML = '<div style="display: grid; gap: 0.3rem;">';
        for (const [key, label] of Object.entries(PERM_LABELS)) {
            const has = perms[key];
            permsHTML += `<div>${has ? '✅' : '❌'} ${label}</div>`;
        }
        permsHTML += '</div>';
        permsEl.innerHTML = permsHTML;

    } catch (error) {
        console.error('Error loading admin info:', error);
        infoEl.innerHTML = `<p style="color: #e74c3c;">Error: ${escapeFlashText(error.message)}</p>`;
    }
}

/* ============================
   LOAD ALL ADMINS
   ============================ */

async function loadAllAdmins() {
    const tbody = document.getElementById('adminsTableBody');

    if (typeof firebase === 'undefined' || !firebase.firestore) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: #e74c3c;">Firebase not connected</td></tr>';
        return;
    }

    try {
        const snapshot = await firebase.firestore()
            .collection('users')
            .where('role', '==', 'admin')
            .get();

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: #5a6572;">No admins found</td></tr>';
            return;
        }

        const currentUid = firebase.auth().currentUser?.uid;
        let html = '';

        snapshot.forEach(doc => {
            const data = doc.data();
            const isMe = doc.id === currentUid;
            const adminRole = data.adminRole || 'super_admin';
            const roleInfo = ADMIN_ROLES[adminRole] || ADMIN_ROLES.super_admin;

            html += `
                <tr style="border-bottom: 1px solid #e5e5e5;">
                    <td style="padding: 0.85rem 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${roleInfo.color}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.85rem;">
                                ${(data.name || 'A').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight: 600; font-size: 0.9rem;">${data.name || 'Unknown'}${isMe ? ' <span style="color: #0064d2; font-size: 0.75rem;">(You)</span>' : ''}</div>
                                <div style="font-size: 0.75rem; color: #5a6572;">Code: ${data.adminCode || 'N/A'}</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 0.85rem 1rem;">
                        <div style="font-size: 0.9rem;">${data.email || 'N/A'}</div>
                        <div style="font-size: 0.75rem; color: #5a6572;">${data.phone || ''}</div>
                    </td>
                    <td style="padding: 0.85rem 1rem;">
                        <span style="background: ${roleInfo.color}15; color: ${roleInfo.color}; padding: 0.2rem 0.6rem; border-radius: 50px; font-size: 0.75rem; font-weight: 600; white-space: nowrap;">
                            ${roleInfo.label}
                        </span>
                    </td>
                    <td style="padding: 0.85rem 1rem;">
                        <span style="background: ${data.status === 'approved' ? 'rgba(134,184,23,0.15)' : 'rgba(231,76,60,0.12)'}; color: ${data.status === 'approved' ? '#5a7e10' : '#e74c3c'}; padding: 0.2rem 0.6rem; border-radius: 50px; font-size: 0.75rem; font-weight: 600;">
                            ${data.status || 'unknown'}
                        </span>
                    </td>
                    <td style="padding: 0.85rem 1rem; text-align: right;">
                        ${isMe ? '<span style="color: #5a6572; font-size: 0.8rem;">Current user</span>' : `
                            <button class="btn btn-outline" onclick="resetOtherAdminCode('${doc.id}', '${data.name}')" style="font-size: 0.75rem; padding: 0.3rem 0.6rem; margin-right: 0.25rem;">
                                <i class="fas fa-sync-alt"></i> Reset Code
                            </button>
                            <button class="btn" onclick="removeAdmin('${doc.id}', '${data.name}')" style="font-size: 0.75rem; padding: 0.3rem 0.6rem; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                <i class="fas fa-trash"></i> Remove
                            </button>
                        `}
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error('Error loading admins:', error);
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 2rem; text-align: center; color: #e74c3c;">Error: ${escapeFlashText(error.message)}</td></tr>`;
    }
}

/* ============================
   BUTTON BINDINGS
   ============================ */

function bindAdminButtons() {
    document.getElementById('showAddAdminBtn')?.addEventListener('click', () => {
        document.getElementById('addAdminForm').style.display = 'block';
        document.getElementById('adminCreatedMsg').style.display = 'none';
    });

    document.getElementById('cancelAddAdmin')?.addEventListener('click', () => {
        document.getElementById('addAdminForm').style.display = 'none';
    });

    document.getElementById('createAdminBtn')?.addEventListener('click', createNewAdmin);
    document.getElementById('changePasswordBtn')?.addEventListener('click', changeMyPassword);
    document.getElementById('resetAdminCodeBtn')?.addEventListener('click', resetMyAdminCode);
}

/* ============================
   CREATE NEW ADMIN (with role)
   ============================ */

async function createNewAdmin() {
    const name = document.getElementById('newAdminName').value.trim();
    const email = document.getElementById('newAdminEmail').value.trim();
    const password = document.getElementById('newAdminPassword').value;
    const phone = document.getElementById('newAdminPhone').value.trim();
    const selectedRole = document.getElementById('newAdminRole').value;

    if (!name || !email || !password) {
        alert('Please fill in name, email, and password.');
        return;
    }

    if (password.length < 8) {
        alert('Password must be at least 8 characters.');
        return;
    }

    const roleInfo = ADMIN_ROLES[selectedRole];
    if (!roleInfo) {
        alert('Please select a valid role.');
        return;
    }

    const btn = document.getElementById('createAdminBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        // Admins are created by a Cloud Function: the security rules deliberately stop an
        // account from granting itself an admin role, and the function runs with the Admin SDK.
        if (!firebase.functions) throw new Error('Cloud Functions not available on this page');

        const res = await firebase.functions().httpsCallable('adminCreateAdmin')({
            email: email,
            password: password,
            name: name,
            phone: phone,
            adminRole: selectedRole
        });
        const adminCode = (res.data && res.data.adminCode) || 'see panel';

        // Show success
        document.getElementById('addAdminForm').style.display = 'none';
        document.getElementById('adminCreatedMsg').style.display = 'block';
        document.getElementById('newAdminCredentials').innerHTML =
            'Email: ' + escapeFlashText(email) + '<br>Password: ' + escapeFlashText(password) +
            '<br>Admin Code: <strong>' + escapeFlashText(adminCode) + '</strong>' +
            '<br>Role: <strong>' + escapeFlashText(roleInfo.label) + '</strong>';

        // Clear form
        document.getElementById('newAdminName').value = '';
        document.getElementById('newAdminEmail').value = '';
        document.getElementById('newAdminPassword').value = '';
        document.getElementById('newAdminPhone').value = '';
        document.getElementById('newAdminRole').selectedIndex = 1;

        loadAllAdmins();

    } catch (error) {
        console.error('Error creating admin:', error);
        let msg = error.message || String(error);
        if (/already-(exists|in-use)/.test(error.code || msg)) {
            msg = 'That email already has an account — use the "Make an existing member an admin" box above instead.';
        }
        if (/weak-password/.test(error.code || msg)) msg = 'Password is too weak (minimum 8 characters).';
        if (/not available/.test(msg)) msg = 'Cloud Functions are not loaded on this page — reload the admin panel and try again.';
        alert('Error: ' + msg);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-shield-alt"></i> Create Admin Account';
    }
}

/* ============================
   CHANGE MY PASSWORD
   ============================ */

async function changeMyPassword() {
    const currentPassword = prompt('Enter your current password:');
    if (!currentPassword) return;

    const newPassword = prompt('Enter your new password (min 8 characters):');
    if (!newPassword || newPassword.length < 8) {
        alert('Password must be at least 8 characters.');
        return;
    }

    const confirm = prompt('Confirm your new password:');
    if (confirm !== newPassword) {
        alert('Passwords do not match.');
        return;
    }

    try {
        const user = firebase.auth().currentUser;
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
        await user.updatePassword(newPassword);
        alert('✅ Password changed successfully!');
    } catch (error) {
        console.error('Error changing password:', error);
        let msg = error.message;
        if (error.code === 'auth/wrong-password') msg = 'Current password is incorrect.';
        if (error.code === 'auth/weak-password') msg = 'New password is too weak.';
        alert('Error: ' + msg);
    }
}

/* ============================
   RESET MY ADMIN CODE
   ============================ */

async function resetMyAdminCode() {
    if (!confirm('Generate a new admin code? Your old code will stop working immediately.')) return;

    const newCode = String(Math.floor(100000 + Math.random() * 900000));

    try {
        const user = firebase.auth().currentUser;
        await firebase.firestore().collection('users').doc(user.uid).update({
            adminCode: newCode
        });

        alert(`✅ New admin code generated!\n\nYour new code is: ${newCode}\n\nPlease save this code — you'll need it to log in.`);
        loadMyAdminInfo();
    } catch (error) {
        console.error('Error resetting admin code:', error);
        alert('Error: ' + error.message);
    }
}

/* ============================
   RESET OTHER ADMIN'S CODE
   ============================ */

async function resetOtherAdminCode(uid, name) {
    if (!confirm(`Generate a new admin code for ${name}?\n\nTheir old code will stop working.`)) return;

    const newCode = String(Math.floor(100000 + Math.random() * 900000));

    try {
        await firebase.firestore().collection('users').doc(uid).update({
            adminCode: newCode
        });

        alert(`✅ New admin code for ${name}:\n\n${newCode}\n\nShare this code securely with them.`);
        loadAllAdmins();
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

/* ============================
   REMOVE ADMIN
   ============================ */

/**
 * Promote an EXISTING account to admin — for members who already have an account
 * (the panel could only create brand-new admin accounts before).
 * Sets role = admin, optionally sets the custom claim so admin checks need no reads.
 */
async function promoteUserToAdmin() {
    const input = document.getElementById('promoteAdminEmail');
    const email = (input && input.value || '').trim().toLowerCase();
    const roleSel = document.getElementById('promoteAdminRole');
    const adminRole = (roleSel && roleSel.value) || 'manager';

    if (!email) { alert('Enter the email address of the account you want to make an admin.'); return; }

    const btn = document.getElementById('promoteAdminBtn');
    const original = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Promoting...'; }

    try {
        const db = firebase.firestore();

        // 1) find the account by email
        const snap = await db.collection('users').where('email', '==', email).limit(1).get();
        if (snap.empty) {
            alert('No account found with that email.\n\nThey must register first, then you can promote them.');
            return;
        }
        const doc = snap.docs[0];
        const data = doc.data() || {};
        if (data.role === 'admin') { alert((data.name || email) + ' is already an admin.'); loadAllAdmins(); return; }

        const label = data.name || email;
        if (!confirm('Make ' + label + ' (' + email + ') an admin?' + (data.role ? '\n\nTheir current role is "' + data.role + '".' : ''))) return;

        // 2) set the role in Firestore (this is what the security rules check)
        const adminCode = String(Math.floor(100000 + Math.random() * 900000));
        await db.collection('users').doc(doc.id).update({
            role: 'admin',
            adminRole: adminRole,
            previousRole: data.role || 'user',
            status: 'approved',
            adminCode: adminCode,
            permissions: (typeof ADMIN_ROLES !== 'undefined' && ADMIN_ROLES[adminRole] && ADMIN_ROLES[adminRole].permissions) || null,
            promotedAt: firebase.firestore.FieldValue.serverTimestamp(),
            promotedBy: firebase.auth().currentUser ? firebase.auth().currentUser.uid : null
        });

        // 3) also set the custom claim (optional: makes admin checks instant, no reads).
        //    If the function is unavailable the role above already grants access.
        let claimNote = 'Custom claim not set (the Firestore role is enough).';
        try {
            if (firebase.functions) {
                await firebase.functions().httpsCallable('setAdminClaim')({ uid: doc.id });
                claimNote = 'Custom claim set.';
            }
        } catch (claimErr) {
            console.warn('setAdminClaim skipped:', claimErr && claimErr.message);
        }

        alert('✅ ' + label + ' is now an admin (' + adminRole + ').\n\n' + claimNote +
              '\n\nThey should sign out and back in for the new permissions to load, and they will need this admin code to open the panel: ' + adminCode);
        if (input) input.value = '';
        loadAllAdmins();
    } catch (err) {
        console.error('promote failed:', err);
        alert('Could not promote: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = original || '<i class="fas fa-user-shield"></i> Make Admin'; }
    }
}

async function removeAdmin(uid, name) {
    if (!confirm(`Remove admin privileges from ${name}?\n\nThis will:\n• Change their role from "admin" to "user"\n• Remove all admin permissions\n• They will lose access to the admin panel\n\nThis does NOT delete their account.`)) return;

    try {
        await firebase.firestore().collection('users').doc(uid).update({
            role: 'user',
            adminRole: null,
            adminCode: null,
            permissions: null,
            adminRemovedAt: firebase.firestore.FieldValue.serverTimestamp(),
            adminRemovedBy: firebase.auth().currentUser.uid
        });

        // also drop the custom claim so admin checks stop passing for them
        try {
            if (firebase.functions) await firebase.functions().httpsCallable('setAdminClaim')({ uid: uid, admin: false });
        } catch (e) { console.warn('could not clear admin claim:', e && e.message); }

        alert(`✅ ${name} has been removed as admin.\n\nThey are now a regular user.`);
        loadAllAdmins();
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled “classic” <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.escapeFlashText = escapeFlashText;
window.initAdminManagement = initAdminManagement;
window.updateRolePreview = updateRolePreview;
window.loadMyAdminInfo = loadMyAdminInfo;
window.loadAllAdmins = loadAllAdmins;
window.bindAdminButtons = bindAdminButtons;
window.createNewAdmin = createNewAdmin;
window.changeMyPassword = changeMyPassword;
window.resetMyAdminCode = resetMyAdminCode;
window.resetOtherAdminCode = resetOtherAdminCode;
window.promoteUserToAdmin = promoteUserToAdmin;
window.removeAdmin = removeAdmin;

