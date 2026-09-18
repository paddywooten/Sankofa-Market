/**
 * Sankofa Market - Confirm Delivery Page
 * Handles post-delivery confirmation and dispute raising
 */

let currentOrder = null;
let currentTransaction = null;
let uploadedFiles = [];
let countdownInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!isLoggedIn()) {
        window.location.href = 'pages/auth/login.html?redirect=' + encodeURIComponent(window.location.href);
        return;
    }
    
    // Get order ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order');
    
    if (!orderId) {
        showFlashMessage('Invalid order ID', 'error');
        setTimeout(() => window.location.href = 'pages/user/dashboard.html', 2000);
        return;
    }
    
    loadOrderDetails(orderId);
    initFileUpload();
    initCharCounter();
});

// ============================================================================
// LOAD ORDER DETAILS
// ============================================================================

async function loadOrderDetails(orderId) {
    try {
        // Load order
        const orderDoc = await firebaseDB.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            showFlashMessage('Order not found', 'error');
            setTimeout(() => window.location.href = 'pages/user/dashboard.html', 2000);
            return;
        }
        
        currentOrder = { id: orderDoc.id, ...orderDoc.data() };
        
        // Verify this is the buyer
        if (currentOrder.buyerId !== firebase.auth().currentUser.uid) {
            showFlashMessage('Access denied', 'error');
            setTimeout(() => window.location.href = 'pages/user/dashboard.html', 2000);
            return;
        }
        
        // Verify order status
        if (currentOrder.status !== 'delivered' && currentOrder.status !== 'paid') {
            showFlashMessage('This order is not ready for confirmation', 'warning');
            setTimeout(() => window.location.href = 'pages/user/dashboard.html', 2000);
            return;
        }
        
        // Load transaction
        const txnSnapshot = await firebaseDB.collection('transactions')
            .where('orderId', '==', orderId)
            .get();
        
        if (!txnSnapshot.empty) {
            currentTransaction = { id: txnSnapshot.docs[0].id, ...txnSnapshot.docs[0].data() };
        }
        
        // Load product details
        const productDoc = await firebaseDB.collection('products').doc(currentOrder.productId).get();
        const product = productDoc.exists ? productDoc.data() : {};
        
        // Render order info
        renderOrderInfo(currentOrder, product);
        
        // Start countdown timer
        if (currentTransaction?.paidAt) {
            startCountdown(currentTransaction.paidAt.toDate());
        }
        
    } catch (error) {
        console.error('Error loading order:', error);
        showFlashMessage('Failed to load order details', 'error');
    }
}

function renderOrderInfo(order, product) {
    const container = document.getElementById('orderInfo');
    
    container.innerHTML = `
        <div class="order-grid">
            <div class="order-item">
                <span class="order-label">Order ID:</span>
                <span class="order-value">#${order.id.substring(0, 8).toUpperCase()}</span>
            </div>
            <div class="order-item">
                <span class="order-label">Product:</span>
                <span class="order-value">${product.title || order.productTitle || 'N/A'}</span>
            </div>
            <div class="order-item">
                <span class="order-label">Amount:</span>
                <span class="order-value">GHS ${order.amount?.toLocaleString() || '0'}</span>
            </div>
            <div class="order-item">
                <span class="order-label">Seller:</span>
                <span class="order-value">${order.sellerName || 'N/A'}</span>
            </div>
            <div class="order-item">
                <span class="order-label">Order Date:</span>
                <span class="order-value">${formatDate(order.createdAt?.toDate ? order.createdAt.toDate() : new Date())}</span>
            </div>
            <div class="order-item">
                <span class="order-label">Status:</span>
                <span class="order-value status-badge status-${order.status}">${order.status.toUpperCase()}</span>
            </div>
        </div>
    `;
    
    // Render original images
    const imagesContainer = document.getElementById('originalImages');
    const images = product.images || [];
    
    if (images.length > 0) {
        imagesContainer.innerHTML = images.map(img => `
            <img src="${img}" alt="Product" class="original-image" onclick="openImageModal('${img}')">
        `).join('');
    } else {
        imagesContainer.innerHTML = '<p class="no-images">No images available</p>';
    }
    
    // Render original details
    const detailsContainer = document.getElementById('originalDetails');
    detailsContainer.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Condition:</span>
            <span class="detail-value">${product.condition || 'N/A'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Category:</span>
            <span class="detail-value">${product.category || 'N/A'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Description:</span>
            <span class="detail-value">${product.description || 'No description'}</span>
        </div>
    `;
}

// ============================================================================
// COUNTDOWN TIMER
// ============================================================================

function startCountdown(paidAt) {
    const autoReleaseHours = 48;
    const releaseTime = new Date(paidAt.getTime() + (autoReleaseHours * 60 * 60 * 1000));
    
    countdownInterval = setInterval(() => {
        const now = new Date();
        const diff = releaseTime - now;
        
        if (diff <= 0) {
            clearInterval(countdownInterval);
            document.getElementById('countdown').innerHTML = '<p class="timer-expired">Time expired - payment will be auto-released</p>';
            return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('hours').textContent = hours.toString().padStart(2, '0');
        document.getElementById('minutes').textContent = minutes.toString().padStart(2, '0');
        document.getElementById('seconds').textContent = seconds.toString().padStart(2, '0');
        
        // Change color when less than 6 hours remain
        if (hours < 6) {
            document.getElementById('timerSection').classList.add('timer-warning');
        }
    }, 1000);
}

// ============================================================================
// FILE UPLOAD
// ============================================================================

function initFileUpload() {
    const uploadInput = document.getElementById('evidenceUpload');
    const uploadArea = document.getElementById('uploadArea');
    
    uploadInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    });
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    handleFiles(files);
}

function handleFiles(files) {
    const maxFiles = 5;
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (uploadedFiles.length + files.length > maxFiles) {
        showFlashMessage(`Maximum ${maxFiles} photos allowed`, 'warning');
        return;
    }
    
    files.forEach(file => {
        if (!file.type.startsWith('image/')) {
            showFlashMessage('Only image files are allowed', 'error');
            return;
        }
        
        if (file.size > maxSize) {
            showFlashMessage('File size must be less than 10MB', 'error');
            return;
        }
        
        uploadedFiles.push(file);
    });
    
    renderUploadedImages();
}

function renderUploadedImages() {
    const container = document.getElementById('uploadedImages');
    
    if (uploadedFiles.length === 0) {
        container.innerHTML = '';
        document.querySelector('.upload-prompt').style.display = 'flex';
        return;
    }
    
    document.querySelector('.upload-prompt').style.display = 'none';
    
    container.innerHTML = uploadedFiles.map((file, index) => {
        const url = URL.createObjectURL(file);
        return `
            <div class="uploaded-image">
                <img src="${url}" alt="Uploaded">
                <button class="remove-image" onclick="removeImage(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

function removeImage(index) {
    uploadedFiles.splice(index, 1);
    renderUploadedImages();
}

// ============================================================================
// CONFIRM DELIVERY
// ============================================================================

async function confirmDelivery() {
    if (!currentOrder || !currentTransaction) {
        showFlashMessage('Order data not loaded', 'error');
        return;
    }
    
    if (!confirm('Are you sure the item matches the listing? Payment will be released to the seller.')) {
        return;
    }
    
    try {
        const confirmBtn = document.getElementById('confirmBtn');
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        // Update order status
        await firebaseDB.collection('orders').doc(currentOrder.id).update({
            status: 'completed',
            confirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
            confirmedBy: firebase.auth().currentUser.uid
        });
        
        // Release escrow
        await releaseEscrow(currentTransaction.id, firebase.auth().currentUser.uid);
        
        // Stop countdown
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        
        showFlashMessage('Delivery confirmed! Payment released to seller.', 'success');
        
        setTimeout(() => {
            window.location.href = 'pages/user/dashboard.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error confirming delivery:', error);
        showFlashMessage('Failed to confirm delivery: ' + error.message, 'error');
        
        const confirmBtn = document.getElementById('confirmBtn');
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-check-circle"></i> Item Matches - Confirm Delivery';
    }
}

// ============================================================================
// RAISE DISPUTE
// ============================================================================

function raiseDispute() {
    if (uploadedFiles.length === 0) {
        if (!confirm('You haven\'t uploaded any evidence photos. It\'s recommended to upload photos before raising a dispute. Continue anyway?')) {
            return;
        }
    }
    
    document.getElementById('disputeModal').style.display = 'flex';
    renderEvidencePreview();
}

function renderEvidencePreview() {
    const container = document.getElementById('evidencePreview');
    
    if (uploadedFiles.length === 0) {
        container.innerHTML = '<p class="no-evidence">No photos uploaded</p>';
        return;
    }
    
    container.innerHTML = uploadedFiles.map(file => {
        const url = URL.createObjectURL(file);
        return `<img src="${url}" alt="Evidence" class="evidence-thumb">`;
    }).join('');
}

function closeDisputeModal() {
    document.getElementById('disputeModal').style.display = 'none';
}

async function submitDispute(event) {
    event.preventDefault();
    
    if (!currentOrder || !currentTransaction) {
        showFlashMessage('Order data not loaded', 'error');
        return;
    }
    
    const reason = document.getElementById('disputeReason').value;
    const description = document.getElementById('disputeDescription').value;
    
    try {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        
        // Upload evidence photos
        const evidenceUrls = [];
        for (const file of uploadedFiles) {
            const url = await uploadEvidencePhoto(file);
            evidenceUrls.push(url);
        }
        
        // Create dispute
        const disputeData = {
            orderId: currentOrder.id,
            transactionId: currentTransaction.id,
            buyerId: currentOrder.buyerId,
            sellerId: currentOrder.sellerId,
            amount: currentOrder.amount,
            reason,
            description,
            buyerEvidence: evidenceUrls,
            sellerEvidence: [],
            status: 'open',
            raisedBy: 'buyer',
            chatHistory: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const disputeRef = await firebaseDB.collection('disputes').add(disputeData);
        
        // Update transaction
        await firebaseDB.collection('transactions').doc(currentTransaction.id).update({
            disputeId: disputeRef.id,
            disputedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update order status
        await firebaseDB.collection('orders').doc(currentOrder.id).update({
            status: 'disputed',
            disputeId: disputeRef.id
        });
        
        // Notify seller
        await sendNotification(currentOrder.sellerId, {
            type: 'dispute_raised',
            title: 'Dispute Raised',
            message: `A dispute has been raised for order #${currentOrder.id.substring(0, 8).toUpperCase()}. Please provide your evidence.`,
            disputeId: disputeRef.id,
            orderId: currentOrder.id
        });
        
        // Stop countdown
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        
        showFlashMessage('Dispute submitted successfully. Our team will review it within 24-48 hours.', 'success');
        
        setTimeout(() => {
            window.location.href = 'pages/user/dashboard.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error submitting dispute:', error);
        showFlashMessage('Failed to submit dispute: ' + error.message, 'error');
        
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-gavel"></i> Submit Dispute';
    }
}

async function uploadEvidencePhoto(file) {
    const path = `disputes/${currentOrder.id}/${Date.now()}_${file.name}`;
    const result = await uploadFile(file, path);
    return result.url;
}

// ============================================================================
// UTILITIES
// ============================================================================

function initCharCounter() {
    const textarea = document.getElementById('disputeDescription');
    const counter = document.getElementById('charCount');
    
    textarea.addEventListener('input', () => {
        counter.textContent = textarea.value.length;
    });
}

function openImageModal(url) {
    window.open(url, '_blank');
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
