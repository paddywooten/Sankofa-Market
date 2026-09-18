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
        infoEl.innerHTML = `<p style="color: #e74c3c;">Error: ${error.message}</p>`;
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
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: #767676;">No admins found</td></tr>';
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
                                <div style="font-size: 0.75rem; color: #767676;">Code: ${data.adminCode || 'N/A'}</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 0.85rem 1rem;">
                        <div style="font-size: 0.9rem;">${data.email || 'N/A'}</div>
                        <div style="font-size: 0.75rem; color: #767676;">${data.phone || ''}</div>
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
                        ${isMe ? '<span style="color: #767676; font-size: 0.8rem;">Current user</span>' : `
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
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 2rem; text-align: center; color: #e74c3c;">Error: ${error.message}</td></tr>`;
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

    const adminCode = String(Math.floor(100000 + Math.random() * 900000));

    try {
        const currentUser = firebase.auth().currentUser;

        // Create new user via secondary app
        const secondaryApp = firebase.initializeApp(firebase.app().options, 'Secondary');
        const secondaryAuth = secondaryApp.auth();

        const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name });

        // Create admin document with role
        await firebase.firestore().collection('users').doc(cred.user.uid).set({
            name: name,
            email: email,
            phone: phone,
            role: 'admin',
            adminRole: selectedRole,
            status: 'approved',
            adminCode: adminCode,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            permissions: roleInfo.permissions
        });

        await secondaryAuth.signOut();
        await secondaryApp.delete();

        // Show success
        document.getElementById('addAdminForm').style.display = 'none';
        document.getElementById('adminCreatedMsg').style.display = 'block';
        document.getElementById('newAdminCredentials').innerHTML =
            `Email: ${email}<br>Password: ${password}<br>Admin Code: <strong>${adminCode}</strong><br>Role: <strong>${roleInfo.label}</strong>`;

        // Clear form
        document.getElementById('newAdminName').value = '';
        document.getElementById('newAdminEmail').value = '';
        document.getElementById('newAdminPassword').value = '';
        document.getElementById('newAdminPhone').value = '';
        document.getElementById('newAdminRole').selectedIndex = 1; // Reset to Manager

        loadAllAdmins();

    } catch (error) {
        console.error('Error creating admin:', error);
        let msg = error.message;
        if (error.code === 'auth/email-already-in-use') msg = 'This email is already registered.';
        if (error.code === 'auth/weak-password') msg = 'Password is too weak (min 6 characters).';
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

        alert(`✅ ${name} has been removed as admin.\n\nThey are now a regular user.`);
        loadAllAdmins();
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}
