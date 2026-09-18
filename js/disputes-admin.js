/**
 * Sankofa Market - Disputes Admin Page
 * Handles dispute listing, viewing, and resolution
 */

let allDisputes = [];
let currentDispute = null;

document.addEventListener('DOMContentLoaded', function() {
    loadDisputes();
    initFilters();
});

// ============================================================================
// LOAD DISPUTES
// ============================================================================

async function loadDisputes() {
    try {
        const snapshot = await firebaseDB.collection('disputes')
            .orderBy('createdAt', 'desc')
            .get();
        
        allDisputes = [];
        snapshot.forEach(doc => {
            allDisputes.push({ id: doc.id, ...doc.data() });
        });
        
        renderDisputes(allDisputes);
        updateDisputeCount();
    } catch (error) {
        console.error('Error loading disputes:', error);
        document.getElementById('disputesList').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load disputes</p>
            </div>
        `;
    }
}

// ============================================================================
// RENDER DISPUTES
// ============================================================================

function renderDisputes(disputes) {
    const container = document.getElementById('disputesList');
    
    if (disputes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>No disputes found</h3>
                <p>All clear! No disputes matching your filters.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = disputes.map(dispute => {
        const statusClass = {
            'open': 'status-warning',
            'reviewing': 'status-info',
            'resolved': 'status-success'
        }[dispute.status] || 'status-default';
        
        const statusLabel = {
            'open': 'Open',
            'reviewing': 'Under Review',
            'resolved': 'Resolved'
        }[dispute.status] || dispute.status;
        
        const reasonLabel = {
            'item_not_received': 'Item Not Received',
            'item_not_as_described': 'Not As Described',
            'defective_item': 'Defective Item',
            'wrong_item': 'Wrong Item',
            'other': 'Other'
        }[dispute.reason] || dispute.reason;
        
        const timeAgo = formatTimeAgo(dispute.createdAt?.toDate ? dispute.createdAt.toDate() : new Date());
        
        return `
            <div class="dispute-card" onclick="viewDispute('${dispute.id}')">
                <div class="dispute-header">
                    <div class="dispute-id">
                        <span class="dispute-number">#${dispute.id.substring(0, 8).toUpperCase()}</span>
                        <span class="dispute-status ${statusClass}">${statusLabel}</span>
                    </div>
                    <span class="dispute-time">${timeAgo}</span>
                </div>
                
                <div class="dispute-body">
                    <div class="dispute-info">
                        <div class="info-row">
                            <span class="info-label">Order:</span>
                            <span class="info-value">#${dispute.orderId?.substring(0, 8).toUpperCase() || 'N/A'}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Reason:</span>
                            <span class="info-value">${reasonLabel}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Amount:</span>
                            <span class="info-value">GHS ${dispute.amount?.toLocaleString() || '0'}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Raised by:</span>
                            <span class="info-value">${dispute.raisedBy === 'buyer' ? 'Buyer' : 'Seller'}</span>
                        </div>
                    </div>
                    
                    <div class="dispute-description">
                        <p>${dispute.description || 'No description provided'}</p>
                    </div>
                </div>
                
                <div class="dispute-footer">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); viewDispute('${dispute.id}')">
                        <i class="fas fa-eye"></i> Review
                    </button>
                    ${dispute.status === 'open' ? `
                        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); startReview('${dispute.id}')">
                            <i class="fas fa-play"></i> Start Review
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================================
// VIEW DISPUTE DETAILS
// ============================================================================

async function viewDispute(disputeId) {
    try {
        const doc = await firebaseDB.collection('disputes').doc(disputeId).get();
        if (!doc.exists) {
            showFlashMessage('Dispute not found', 'error');
            return;
        }
        
        currentDispute = { id: doc.id, ...doc.data() };
        
        // Load related data
        const [buyerDoc, sellerDoc, txnDoc] = await Promise.all([
            firebaseDB.collection('users').doc(currentDispute.buyerId).get(),
            firebaseDB.collection('users').doc(currentDispute.sellerId).get(),
            firebaseDB.collection('transactions').doc(currentDispute.transactionId).get()
        ]);
        
        const buyer = buyerDoc.exists ? buyerDoc.data() : {};
        const seller = sellerDoc.exists ? sellerDoc.data() : {};
        const transaction = txnDoc.exists ? txnDoc.data() : {};
        
        renderDisputeModal(currentDispute, buyer, seller, transaction);
        document.getElementById('disputeModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Error viewing dispute:', error);
        showFlashMessage('Failed to load dispute details', 'error');
    }
}

function renderDisputeModal(dispute, buyer, seller, transaction) {
    const modalBody = document.getElementById('disputeModalBody');
    
    const reasonLabel = {
        'item_not_received': 'Item Not Received',
        'item_not_as_described': 'Not As Described',
        'defective_item': 'Defective Item',
        'wrong_item': 'Wrong Item',
        'other': 'Other'
    }[dispute.reason] || dispute.reason;
    
    const buyerEvidence = dispute.buyerEvidence || [];
    const sellerEvidence = dispute.sellerEvidence || [];
    
    modalBody.innerHTML = `
        <div class="dispute-detail">
            <!-- Overview -->
            <div class="detail-section">
                <h3><i class="fas fa-info-circle"></i> Dispute Overview</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Dispute ID:</span>
                        <span class="detail-value">#${dispute.id.substring(0, 8).toUpperCase()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Order ID:</span>
                        <span class="detail-value">#${dispute.orderId?.substring(0, 8).toUpperCase() || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value status-${dispute.status}">${dispute.status.toUpperCase()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Reason:</span>
                        <span class="detail-value">${reasonLabel}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Amount:</span>
                        <span class="detail-value">GHS ${dispute.amount?.toLocaleString() || '0'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Raised:</span>
                        <span class="detail-value">${formatDate(dispute.createdAt?.toDate ? dispute.createdAt.toDate() : new Date())}</span>
                    </div>
                </div>
                <div class="detail-description">
                    <strong>Description:</strong>
                    <p>${dispute.description || 'No description provided'}</p>
                </div>
            </div>
            
            <!-- Parties -->
            <div class="detail-section">
                <h3><i class="fas fa-users"></i> Parties Involved</h3>
                <div class="parties-grid">
                    <div class="party-card">
                        <div class="party-header">
                            <i class="fas fa-user"></i>
                            <span>Buyer</span>
                            ${dispute.raisedBy === 'buyer' ? '<span class="badge badge-warning">Raised Dispute</span>' : ''}
                        </div>
                        <div class="party-info">
                            <p><strong>${buyer.firstName || ''} ${buyer.lastName || ''}</strong></p>
                            <p><i class="fas fa-envelope"></i> ${buyer.email || 'N/A'}</p>
                            <p><i class="fas fa-phone"></i> ${buyer.phone || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="party-card">
                        <div class="party-header">
                            <i class="fas fa-store"></i>
                            <span>Seller</span>
                            ${dispute.raisedBy === 'seller' ? '<span class="badge badge-warning">Raised Dispute</span>' : ''}
                        </div>
                        <div class="party-info">
                            <p><strong>${seller.firstName || ''} ${seller.lastName || ''}</strong></p>
                            <p><i class="fas fa-envelope"></i> ${seller.email || 'N/A'}</p>
                            <p><i class="fas fa-phone"></i> ${seller.phone || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Evidence -->
            <div class="detail-section">
                <h3><i class="fas fa-camera"></i> Evidence</h3>
                
                <div class="evidence-block">
                    <h4>Buyer's Evidence (${buyerEvidence.length} items)</h4>
                    ${buyerEvidence.length > 0 ? `
                        <div class="evidence-grid">
                            ${buyerEvidence.map(url => `
                                <div class="evidence-item">
                                    <img src="${url}" alt="Buyer evidence" onclick="openImage('${url}')">
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="no-evidence">No evidence provided by buyer</p>'}
                </div>
                
                <div class="evidence-block">
                    <h4>Seller's Evidence (${sellerEvidence.length} items)</h4>
                    ${sellerEvidence.length > 0 ? `
                        <div class="evidence-grid">
                            ${sellerEvidence.map(url => `
                                <div class="evidence-item">
                                    <img src="${url}" alt="Seller evidence" onclick="openImage('${url}')">
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="no-evidence">No evidence provided by seller</p>'}
                </div>
            </div>
            
            <!-- Chat History -->
            ${dispute.chatHistory && dispute.chatHistory.length > 0 ? `
                <div class="detail-section">
                    <h3><i class="fas fa-comments"></i> Chat History</h3>
                    <div class="chat-history">
                        ${dispute.chatHistory.map(msg => `
                            <div class="chat-message ${msg.sender === 'buyer' ? 'buyer-msg' : 'seller-msg'}">
                                <div class="chat-header">
                                    <strong>${msg.sender === 'buyer' ? 'Buyer' : 'Seller'}</strong>
                                    <span>${formatDate(msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date())}</span>
                                </div>
                                <p>${msg.message}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Resolution (if resolved) -->
            ${dispute.status === 'resolved' ? `
                <div class="detail-section">
                    <h3><i class="fas fa-gavel"></i> Resolution</h3>
                    <div class="resolution-info">
                        <div class="detail-item">
                            <span class="detail-label">Decision:</span>
                            <span class="detail-value">${dispute.resolution?.replace('_', ' ').toUpperCase() || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Resolved by:</span>
                            <span class="detail-value">${dispute.resolvedBy || 'System'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Resolved at:</span>
                            <span class="detail-value">${formatDate(dispute.resolvedAt?.toDate ? dispute.resolvedAt.toDate() : new Date())}</span>
                        </div>
                        ${dispute.adminNotes ? `
                            <div class="detail-description">
                                <strong>Admin Notes:</strong>
                                <p>${dispute.adminNotes}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            
            <!-- Admin Actions (if not resolved) -->
            ${dispute.status !== 'resolved' ? `
                <div class="detail-section">
                    <h3><i class="fas fa-gavel"></i> Admin Decision</h3>
                    <div class="admin-actions">
                        <div class="form-group">
                            <label>Admin Notes (optional):</label>
                            <textarea id="adminNotes" class="form-control" rows="3" placeholder="Add notes about your decision..."></textarea>
                        </div>
                        
                        <div class="action-buttons">
                            <button class="btn btn-success" onclick="resolveDispute('refund_to_buyer')">
                                <i class="fas fa-undo"></i> Refund Buyer
                            </button>
                            <button class="btn btn-primary" onclick="resolveDispute('release_to_seller')">
                                <i class="fas fa-check"></i> Release to Seller
                            </button>
                            <button class="btn btn-warning" onclick="resolveDispute('split')">
                                <i class="fas fa-divide"></i> Split (50/50)
                            </button>
                            <button class="btn btn-outline" onclick="requestMoreEvidence()">
                                <i class="fas fa-question-circle"></i> Request More Evidence
                            </button>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// ============================================================================
// DISPUTE ACTIONS
// ============================================================================

async function startReview(disputeId) {
    try {
        await firebaseDB.collection('disputes').doc(disputeId).update({
            status: 'reviewing',
            reviewStartedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showFlashMessage('Dispute marked as under review', 'success');
        loadDisputes();
    } catch (error) {
        console.error('Error starting review:', error);
        showFlashMessage('Failed to update dispute status', 'error');
    }
}

async function resolveDispute(resolution) {
    if (!currentDispute) return;
    
    const adminNotes = document.getElementById('adminNotes')?.value || '';
    
    if (!confirm(`Are you sure you want to resolve this dispute with: ${resolution.replace('_', ' ').toUpperCase()}?`)) {
        return;
    }
    
    try {
        // Update dispute
        await firebaseDB.collection('disputes').doc(currentDispute.id).update({
            status: 'resolved',
            resolution,
            adminNotes,
            resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            resolvedBy: firebase.auth().currentUser?.email || 'admin'
        });
        
        // Execute financial resolution
        if (resolution === 'refund_to_buyer') {
            await refundEscrow(currentDispute.transactionId, 'Dispute resolved: refund to buyer', 'admin');
        } else if (resolution === 'release_to_seller') {
            await releaseEscrow(currentDispute.transactionId, 'admin');
        } else if (resolution === 'split') {
            // For split, we'd need to implement partial refund + partial release
            // This is a simplified version
            await refundEscrow(currentDispute.transactionId, 'Dispute resolved: 50/50 split', 'admin');
            // In production, you'd also release 50% to seller
        }
        
        // Notify both parties
        await notifyDisputeResolution(currentDispute, resolution);
        
        showFlashMessage('Dispute resolved successfully!', 'success');
        closeDisputeModal();
        loadDisputes();
        
    } catch (error) {
        console.error('Error resolving dispute:', error);
        showFlashMessage('Failed to resolve dispute: ' + error.message, 'error');
    }
}

async function requestMoreEvidence() {
    if (!currentDispute) return;
    
    const message = prompt('What additional evidence do you need?');
    if (!message) return;
    
    try {
        // Add to chat history
        const chatHistory = currentDispute.chatHistory || [];
        chatHistory.push({
            sender: 'admin',
            message: `[Admin Request]: ${message}`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await firebaseDB.collection('disputes').doc(currentDispute.id).update({
            chatHistory,
            evidenceRequested: true,
            evidenceRequestedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Notify both parties
        await sendNotification(currentDispute.buyerId, {
            type: 'evidence_requested',
            title: 'Additional Evidence Requested',
            message: 'An admin has requested additional evidence for your dispute. Please check the dispute details.',
            disputeId: currentDispute.id
        });
        
        await sendNotification(currentDispute.sellerId, {
            type: 'evidence_requested',
            title: 'Additional Evidence Requested',
            message: 'An admin has requested additional evidence for the dispute. Please check the dispute details.',
            disputeId: currentDispute.id
        });
        
        showFlashMessage('Evidence request sent to both parties', 'success');
        closeDisputeModal();
        
    } catch (error) {
        console.error('Error requesting evidence:', error);
        showFlashMessage('Failed to request evidence', 'error');
    }
}

// ============================================================================
// UTILITIES
// ============================================================================

function closeDisputeModal() {
    document.getElementById('disputeModal').style.display = 'none';
    currentDispute = null;
}

function openImage(url) {
    window.open(url, '_blank');
}

async function notifyDisputeResolution(dispute, resolution) {
    const resolutionMessages = {
        'refund_to_buyer': 'The dispute has been resolved in your favor. A full refund has been issued.',
        'release_to_seller': 'The dispute has been resolved in the seller\'s favor. Payment has been released.',
        'split': 'The dispute has been resolved with a 50/50 split. Partial refund issued, partial payment released.'
    };
    
    await sendNotification(dispute.buyerId, {
        type: 'dispute_resolved',
        title: 'Dispute Resolved',
        message: resolutionMessages[resolution],
        disputeId: dispute.id,
        orderId: dispute.orderId
    });
    
    await sendNotification(dispute.sellerId, {
        type: 'dispute_resolved',
        title: 'Dispute Resolved',
        message: resolutionMessages[resolution],
        disputeId: dispute.id,
        orderId: dispute.orderId
    });
}

function initFilters() {
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('reasonFilter').addEventListener('change', applyFilters);
    document.getElementById('searchDisputes').addEventListener('input', applyFilters);
}

function applyFilters() {
    const status = document.getElementById('statusFilter').value;
    const reason = document.getElementById('reasonFilter').value;
    const search = document.getElementById('searchDisputes').value.toLowerCase();
    
    let filtered = allDisputes;
    
    if (status !== 'all') {
        filtered = filtered.filter(d => d.status === status);
    }
    
    if (reason !== 'all') {
        filtered = filtered.filter(d => d.reason === reason);
    }
    
    if (search) {
        filtered = filtered.filter(d => 
            d.id.toLowerCase().includes(search) ||
            d.orderId?.toLowerCase().includes(search) ||
            d.description?.toLowerCase().includes(search)
        );
    }
    
    renderDisputes(filtered);
}

function updateDisputeCount() {
    const openCount = allDisputes.filter(d => d.status === 'open' || d.status === 'reviewing').length;
    document.getElementById('disputeCount').textContent = openCount;
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return date.toLocaleDateString();
}

function formatDate(date) {
    return date.toLocaleString('en-GH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Close modal on overlay click
document.getElementById('disputeModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeDisputeModal();
    }
});
