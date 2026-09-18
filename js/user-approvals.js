/**
 * Sankofa Market - User Approvals Admin JavaScript
 */

let allUsers = [];

document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuth();
    loadUsers();
    initFilters();
});

// ============================================================================
// ADMIN AUTH CHECK
// ============================================================================

async function checkAdminAuth() {
    if (typeof firebaseAuth === 'undefined') {
        // Demo mode
        return;
    }
    
    const user = firebaseAuth.currentUser;
    if (!user) {
        window.location.href = '../auth/login.html?redirect=pages/admin/user-approvals.html';
        return;
    }
    
    // Check if user is admin
    if (typeof firebaseDB !== 'undefined') {
        const userDoc = await firebaseDB.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            showFlashMessage('Access denied. Admin privileges required.', 'error');
            setTimeout(() => {
                window.location.href = '../../index.html';
            }, 2000);
        }
    }
}

// ============================================================================
// LOAD USERS
// ============================================================================

async function loadUsers() {
    try {
        if (typeof firebaseDB === 'undefined') {
            // Demo mode
            renderDemoUsers();
            return;
        }
        
        const snapshot = await firebaseDB.collection('users')
            .orderBy('createdAt', 'desc')
            .get();
        
        allUsers = [];
        snapshot.forEach(doc => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });
        
        renderUsers(allUsers);
        updatePendingCount();
    } catch (error) {
        console.error('Error loading users:', error);
        showFlashMessage('Failed to load users', 'error');
    }
}

function renderDemoUsers() {
    allUsers = [
        {
            id: 'demo1',
            firstName: '', lastName: '',
            createdAt: new Date()
        },
        {
            id: 'demo2',
            firstName: 'Ama',
            lastName: 'Mensah',
            email: 'ama@example.com',
            phone: '0551234567',
            status: 'pending',
            ghanaCard: {
                number: 'GHA-987654321-1',
                name: 'Ama Serwaa Mensah',
                submittedAt: new Date()
            },
            createdAt: new Date(Date.now() - 86400000)
        },
        {
            id: 'demo3',
            firstName: 'Kofi',
            lastName: 'Owusu',
            email: 'kofi@example.com',
            phone: '0201234567',
            status: 'approved',
            ghanaCard: {
                number: 'GHA-456789123-2',
                name: 'Kofi Owusu',
                submittedAt: new Date(Date.now() - 172800000),
                approvedAt: new Date(Date.now() - 86400000)
            },
            createdAt: new Date(Date.now() - 172800000)
        }
    ];
    
    renderUsers(allUsers);
    updatePendingCount();
}

// ============================================================================
// RENDER USERS
// ============================================================================

function renderUsers(users) {
    const container = document.getElementById('usersList');
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No users found</h3>
                <p>No users match your current filters</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = users.map(user => {
        const statusClass = {
            'pending': 'status-warning',
            'approved': 'status-success',
            'rejected': 'status-danger'
        }[user.status] || 'status-default';
        
        const statusLabel = {
            'pending': 'Pending',
            'approved': 'Approved',
            'rejected': 'Rejected'
        }[user.status] || user.status;
        
        const submittedDate = user.ghanaCard?.submittedAt 
            ? formatDate(user.ghanaCard.submittedAt.toDate ? user.ghanaCard.submittedAt.toDate() : new Date(user.ghanaCard.submittedAt))
            : 'N/A';
        
        return `
            <div class="user-card">
                <div class="user-card-header">
                    <div class="user-info">
                        <div class="user-avatar">
                            <i class="fas fa-user" style="font-size: 2rem; color: #6c757d;"></i>
                        </div>
                        <div class="user-details">
                            <h3>${user.firstName} ${user.lastName}</h3>
                            <p><i class="fas fa-envelope"></i> ${user.email}</p>
                            <p><i class="fas fa-phone"></i> ${user.phone}</p>
                            <p><i class="fas fa-id-card"></i> ${user.ghanaCard?.number || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="user-status">
                        <span class="status-badge ${statusClass}">${statusLabel}</span>
                        <small>Submitted: ${submittedDate}</small>
                    </div>
                </div>
                
                <div class="user-card-actions">
                    <button class="btn btn-outline btn-small" onclick="viewUserDetails('${user.id}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    ${user.status === 'pending' ? `
                        <button class="btn btn-success btn-small" onclick="approveUser('${user.id}')">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="btn btn-danger btn-small" onclick="rejectUser('${user.id}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================================
// VIEW USER DETAILS
// ============================================================================

async function viewUserDetails(userId) {
    const user = allUsers.find(u => u.id === userId);
    
    if (!user) {
        showFlashMessage('User not found', 'error');
        return;
    }
    
    const modalBody = document.getElementById('userModalBody');
    
    const statusClass = {
        'pending': 'status-warning',
        'approved': 'status-success',
        'rejected': 'status-danger'
    }[user.status] || 'status-default';
    
    const statusLabel = {
        'pending': 'Pending',
        'approved': 'Approved',
        'rejected': 'Rejected'
    }[user.status] || user.status;
    
    modalBody.innerHTML = `
        <div class="user-detail">
            <div class="detail-section">
                <h3><i class="fas fa-user"></i> Personal Information</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Full Name:</span>
                        <span class="detail-value">${user.firstName} ${user.lastName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${user.email}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-value">${user.phone}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value"><span class="status-badge ${statusClass}">${statusLabel}</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Registered:</span>
                        <span class="detail-value">${formatDate(user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt))}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3><i class="fas fa-id-card"></i> Ghana Card Information</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Ghana Card Number:</span>
                        <span class="detail-value">${user.ghanaCard?.number || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Name on Card:</span>
                        <span class="detail-value">${user.ghanaCard?.name || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Submitted:</span>
                        <span class="detail-value">${formatDate(user.ghanaCard?.submittedAt?.toDate ? user.ghanaCard.submittedAt.toDate() : new Date(user.ghanaCard?.submittedAt))}</span>
                    </div>
                </div>
            </div>
            
            ${user.status === 'pending' ? `
                <div class="detail-section">
                    <h3><i class="fas fa-gavel"></i> Admin Actions</h3>
                    <div class="admin-actions">
                        <button class="btn btn-success" onclick="approveUser('${user.id}')">
                            <i class="fas fa-check"></i> Approve Account
                        </button>
                        <button class="btn btn-danger" onclick="rejectUser('${user.id}')">
                            <i class="fas fa-times"></i> Reject Account
                        </button>
                    </div>
                </div>
            ` : ''}
            
            ${user.verification?.approvedAt ? `
                <div class="detail-section">
                    <h3><i class="fas fa-history"></i> Approval History</h3>
                    <p>Approved on: ${formatDate(user.verification.approvedAt.toDate ? user.verification.approvedAt.toDate() : new Date(user.verification.approvedAt))}</p>
                    ${user.verification.approvedBy ? `<p>Approved by: ${user.verification.approvedBy}</p>` : ''}
                </div>
            ` : ''}
            
            ${user.verification?.rejectedAt ? `
                <div class="detail-section">
                    <h3><i class="fas fa-history"></i> Rejection History</h3>
                    <p>Rejected on: ${formatDate(user.verification.rejectedAt.toDate ? user.verification.rejectedAt.toDate() : new Date(user.verification.rejectedAt))}</p>
                    ${user.verification.rejectionReason ? `<p>Reason: ${user.verification.rejectionReason}</p>` : ''}
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('userModal').style.display = 'flex';
}

function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

// ============================================================================
// APPROVE USER
// ============================================================================

async function approveUser(userId) {
    if (!confirm('Are you sure you want to approve this user? They will be able to publish listings.')) {
        return;
    }
    
    try {
        if (typeof firebaseDB === 'undefined') {
            // Demo mode
            const user = allUsers.find(u => u.id === userId);
            if (user) {
                user.status = 'approved';
                user.ghanaCard.approvedAt = new Date();
                renderUsers(allUsers);
                updatePendingCount();
            }
            showFlashMessage('User approved successfully!', 'success');
            closeUserModal();
            return;
        }
        
        const adminUser = firebaseAuth.currentUser;
        
        await firebaseDB.collection('users').doc(userId).update({
            status: 'approved',
            'ghanaCard.approvedAt': firebase.firestore.FieldValue.serverTimestamp(),
            'ghanaCard.approvedBy': adminUser.email
        });
        
        showFlashMessage('User approved successfully!', 'success');
        
        // Reload users
        loadUsers();
        closeUserModal();
    } catch (error) {
        console.error('Error approving user:', error);
        showFlashMessage('Failed to approve user', 'error');
    }
}

// ============================================================================
// REJECT USER
// ============================================================================

async function rejectUser(userId) {
    const reason = prompt('Please provide a reason for rejection (optional):');
    
    if (reason === null) {
        return; // User cancelled
    }
    
    try {
        if (typeof firebaseDB === 'undefined') {
            // Demo mode
            const user = allUsers.find(u => u.id === userId);
            if (user) {
                user.status = 'rejected';
                user.ghanaCard.rejectedAt = new Date();
                user.ghanaCard.rejectionReason = reason || 'No reason provided';
                renderUsers(allUsers);
                updatePendingCount();
            }
            showFlashMessage('User rejected successfully!', 'success');
            closeUserModal();
            return;
        }
        
        const adminUser = firebaseAuth.currentUser;
        
        await firebaseDB.collection('users').doc(userId).update({
            status: 'rejected',
            'ghanaCard.rejectedAt': firebase.firestore.FieldValue.serverTimestamp(),
            'ghanaCard.rejectedBy': adminUser.email,
            'ghanaCard.rejectionReason': reason || 'No reason provided'
        });
        
        showFlashMessage('User rejected successfully!', 'success');
        
        // Reload users
        loadUsers();
        closeUserModal();
    } catch (error) {
        console.error('Error rejecting user:', error);
        showFlashMessage('Failed to reject user', 'error');
    }
}

// ============================================================================
// FILTERS
// ============================================================================

function initFilters() {
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');
    
    statusFilter.addEventListener('change', applyFilters);
    searchInput.addEventListener('input', debounce(applyFilters, 300));
}

function applyFilters() {
    const status = document.getElementById('statusFilter').value;
    const search = document.getElementById('searchInput').value.toLowerCase();
    
    let filtered = allUsers;
    
    if (status !== 'all') {
        filtered = filtered.filter(u => u.status === status);
    }
    
    if (search) {
        filtered = filtered.filter(u => 
            `${u.firstName} ${u.lastName}`.toLowerCase().includes(search) ||
            u.email.toLowerCase().includes(search)
        );
    }
    
    renderUsers(filtered);
}

function updatePendingCount() {
    const pendingCount = allUsers.filter(u => u.status === 'pending').length;
    document.getElementById('pendingCount').textContent = pendingCount;
}

// ============================================================================
// UTILITIES
// ============================================================================

function formatDate(date) {
    return date.toLocaleString('en-GH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Close modal on overlay click
document.getElementById('userModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeUserModal();
    }
});
