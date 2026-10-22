/**
 * Sankofa Market - Confirm Delivery Page
 * Handles post-delivery confirmation and dispute raising
 */

let currentOrder = null;
let currentTransaction = null;
let uploadedFiles = [];
let countdownInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    // Get order ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order') || urlParams.get('orderId');
    const loginUrl = '/pages/auth/login.html?redirect=' + encodeURIComponent(window.location.href);

    if (!orderId) {
        showFlashMessage('Invalid order ID', 'error');
        setTimeout(() => window.location.href = 'pages/user/dashboard.html', 2000);
        return;
    }

    // ⚠️ Firebase restores the session ASYNCHRONOUSLY. Checking "am I signed in?" the instant
    // the page loads sent signed-in buyers to the login screen every single time — which meant
    // nobody could confirm delivery, so sellers were never paid (except by the 48h auto-release).
    const start = function () { loadOrderDetails(orderId); initFileUpload(); initCharCounter(); };
    let settled = false;
    const go = function (user) {
        if (settled) return;
        settled = true;
        if (!user) { window.location.href = loginUrl; return; }
        start();
    };
    try {
        firebase.auth().onAuthStateChanged(go);
    } catch (e) {
        go(firebase.auth().currentUser);
    }
    // Safety net: never leave the buyer staring at a blank page.
    setTimeout(function () {
        if (settled) return;
        const u = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
        go(u);
    }, 6000);
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
        
        // NOTE: a `transactions` collection used to be read here. Nothing ever created one and
        // there is no rule allowing reads of it, so the request always failed — the code was
        // removed rather than left failing quietly on every visit. Escrow lives on the order.

        // Load product details (cart orders have no productId — use the first item)
        let product = {};
        try {
            const firstItem = (currentOrder.items && currentOrder.items[0]) || {};
            const pid = currentOrder.productId || firstItem.productId || firstItem.id;
            if (pid && String(pid).indexOf('local-') !== 0) {
                const productDoc = await firebaseDB.collection('products').doc(pid).get();
                product = productDoc.exists ? productDoc.data() : {};
            }
        } catch (e) {
            console.warn('product details unavailable', e && e.message);
        }

        // Render order info
        renderOrderInfo(currentOrder, product);

        // Start the countdown from when the money went into escrow
        // The clock runs from DELIVERY (matching the escrow function), not from
        // payment — otherwise the timer counted down before the item had even been sent.
        /* ---- escrow window: how long the money sits after delivery ----
         * ◆ Diamond sellers are paid out after 24h instead of 48 (premium money perk).
         * The counter reads the PUBLIC seller mirror (sellerPublic) — the money still
         * moves only when the server decides; the mirror just makes the countdown the
         * buyer sees match the server's window. */
        var windowHours = 48;
        try {
            const mirrorDoc = await firebaseDB.collection('sellerPublic').doc(currentOrder.sellerId).get();
            if (mirrorDoc.exists) {
                const m = mirrorDoc.data() || {};
                const tier = String(m.tier || '').toLowerCase();
                const exp = m.premiumExpiry && m.premiumExpiry.toDate ? m.premiumExpiry.toDate()
                          : (m.premiumExpiry ? new Date(m.premiumExpiry) : null);
                if (tier === 'diamond' && exp && exp.getTime() > Date.now()) windowHours = 24;
            }
        } catch (e) { /* unreadable mirror → show the standard 48h window */ }
        if (windowHours === 24) {
            const countdownEl = document.getElementById('countdown');
            if (countdownEl && !document.getElementById('smDiamondNote')) {
                const note = document.createElement('div');
                note.id = 'smDiamondNote';
                note.style.cssText = 'margin-top:0.5rem;font-size:0.72rem;font-weight:700;color:#5b21b6;';
                note.innerHTML = '<i class="fas fa-gem"></i> Diamond seller — escrow auto-releases after 24 hours instead of 48.';
                countdownEl.parentNode.appendChild(note);
            }
        }

        const heldAt = currentOrder.deliveredAt || currentOrder.deliveryConfirmedAt
                     || currentOrder.escrowHeldAt || currentOrder.paidAt
                     || (currentTransaction && currentTransaction.paidAt);
        try {
            if (heldAt && heldAt.toDate) startCountdown(heldAt.toDate(), windowHours);
            else if (heldAt) startCountdown(new Date(heldAt), windowHours);
        } catch (e) { console.warn('countdown skipped', e); }
        
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
                <span class="order-value">${product.title || order.productTitle || (order.items && order.items[0] && order.items[0].title) || 'Your item'}</span>
            </div>
            <div class="order-item">
                <span class="order-label">Amount:</span>
                <span class="order-value">GHS ${(order.total ?? order.amount ?? order.bidAmount ?? 0).toLocaleString()}</span>
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

function startCountdown(paidAt, autoReleaseHours) {
    autoReleaseHours = Number(autoReleaseHours) > 0 ? Number(autoReleaseHours) : 48;   // ◆ Diamond = 24, everyone else 48
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
    if (!currentOrder) {
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

        // Releasing the money is a SERVER job: the Cloud Function re-checks who is asking,
        // that a real payment is being held, and that the seller has not been paid already.
        // (This page used to call a browser function called releaseEscrow that does not exist
        // anywhere, so the button always failed with "Failed to confirm delivery" and the
        // seller was never paid.)
        if (typeof firebase === 'undefined' || !firebase.functions) {
            throw new Error('Firebase Functions not ready — please refresh the page');
        }
        const releaseFn = firebase.functions().httpsCallable('releaseEscrowToWallet');
        const res = await releaseFn({ orderId: currentOrder.id });
        const payout = res.data && res.data.payout;
        
        // Stop countdown
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        
        showFlashMessage('Delivery confirmed!' + (payout ? ' GHS ' + Number(payout).toLocaleString() + ' released to the seller\u2019s wallet.' : ' Payment released to seller.'), 'success');
        
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
    
    if (!currentOrder) {
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
            transactionId: currentTransaction ? currentTransaction.id : null,
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
        
        // (The old code also tried to link the dispute on a `transactions` document. That
        //  collection has no rule, so the write always failed — removed.)
        
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
