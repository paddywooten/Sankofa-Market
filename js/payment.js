/**
 * Sankofa Market - Payment & Escrow System
 * Integrates Paystack for cards + Mobile Money with escrow protection
 */

// Paystack Configuration (replace with your actual keys)
const PAYSTACK_CONFIG = {
    publicKey: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    secretKey: 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Keep this server-side only!
    callbackUrl: window.location.origin + '/payment-success.html',
    currency: 'GHS'
};

// Escrow Configuration
const ESCROW_CONFIG = {
    commissionRate: 0.05, // 5% commission
    autoReleaseHours: 48, // Auto-release after 48 hours
    disputeWindowHours: 48, // Buyer can dispute within 48 hours
    momoHoldHours: 24 // Extra hold for MoMo (reversal window)
};

// ============================================================================
// PAYMENT INITIALIZATION
// ============================================================================

/**
 * Initialize a payment with escrow protection
 * @param {Object} orderData - Order details
 * @param {string} paymentMethod - 'card', 'momo_mtn', 'momo_vodafone', 'momo_airteltigo'
 */
async function initializePayment(orderData, paymentMethod) {
    const { orderId, amount, sellerId, buyerId, productTitle } = orderData;
    
    // Calculate commission and net amount
    const commission = Math.round(amount * ESCROW_CONFIG.commissionRate);
    const netAmount = amount - commission;
    
    // Create transaction record in Firestore
    const transactionData = {
        orderId,
        buyerId,
        sellerId,
        amount,
        commission,
        netAmount,
        status: 'pending', // pending → paid → held → released → refunded
        paymentMethod,
        productTitle,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        autoReleaseAt: null, // Set after delivery confirmation
        disputeId: null
    };
    
    try {
        // Save transaction to Firestore
        const txnRef = await firebaseDB.collection('transactions').add(transactionData);
        const transactionId = txnRef.id;
        
        // Initialize Paystack payment
        const handler = PaystackPop.setup({
            key: PAYSTACK_CONFIG.publicKey,
            email: orderData.buyerEmail,
            amount: amount * 100, // Paystack uses kobo/pesewas (amount * 100)
            currency: PAYSTACK_CONFIG.currency,
            ref: transactionId, // Use transaction ID as reference
            metadata: {
                custom_fields: [
                    { display_name: "Order ID", variable_name: "order_id", value: orderId },
                    { display_name: "Product", variable_name: "product", value: productTitle },
                    { display_name: "Payment Method", variable_name: "payment_method", value: paymentMethod }
                ]
            },
            callback: function(response) {
                handlePaymentSuccess(response, transactionId);
            },
            onClose: function() {
                handlePaymentClosed(transactionId);
            }
        });
        
        handler.openIframe();
        return { success: true, transactionId };
        
    } catch (error) {
        console.error('Payment initialization error:', error);
        showFlashMessage('Failed to initialize payment. Please try again.', 'error');
        return { success: false, error: error.message };
    }
}

// ============================================================================
// MOBILE MONEY PAYMENT
// ============================================================================

/**
 * Initialize Mobile Money payment
 * @param {Object} orderData - Order details
 * @param {string} network - 'mtn', 'vodafone', 'airteltigo'
 * @param {string} phone - MoMo phone number
 */
async function initializeMomoPayment(orderData, network, phone) {
    const { amount, orderId, sellerId, buyerId, productTitle } = orderData;
    
    const commission = Math.round(amount * ESCROW_CONFIG.commissionRate);
    const netAmount = amount - commission;
    
    // Validate phone number format
    if (!validateMomoPhone(phone, network)) {
        showFlashMessage('Invalid phone number format for ' + network.toUpperCase(), 'error');
        return { success: false };
    }
    
    // Create transaction record
    const transactionData = {
        orderId,
        buyerId,
        sellerId,
        amount,
        commission,
        netAmount,
        status: 'pending',
        paymentMethod: `momo_${network}`,
        momoPhone: phone,
        productTitle,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const txnRef = await firebaseDB.collection('transactions').add(transactionData);
        const transactionId = txnRef.id;
        
        // Call backend to initiate MoMo charge
        // Note: In production, this should be a Cloud Function (server-side)
        const response = await initiateMomoCharge({
            transactionId,
            amount,
            phone,
            network,
            email: orderData.buyerEmail
        });
        
        if (response.success) {
            showFlashMessage('Payment prompt sent to your phone. Please approve the transaction.', 'info');
            pollMomoStatus(transactionId);
            return { success: true, transactionId };
        } else {
            showFlashMessage(response.error || 'MoMo payment failed', 'error');
            return { success: false };
        }
        
    } catch (error) {
        console.error('MoMo payment error:', error);
        showFlashMessage('Failed to process MoMo payment', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Validate MoMo phone number format
 */
function validateMomoPhone(phone, network) {
    const cleaned = phone.replace(/\D/g, '');
    
    const patterns = {
        mtn: /^0(24|54|55|59)\d{7}$/,
        vodafone: /^0(20|50)\d{7}$/,
        airteltigo: /^0(26|27|56|57)\d{7}$/
    };
    
    return patterns[network]?.test(cleaned) || false;
}

/**
 * Poll MoMo payment status (for user approval)
 */
async function pollMomoStatus(transactionId) {
    const maxAttempts = 30; // 30 * 2s = 60 seconds
    let attempts = 0;
    
    const poll = setInterval(async () => {
        attempts++;
        
        try {
            const txnDoc = await firebaseDB.collection('transactions').doc(transactionId).get();
            const txn = txnDoc.data();
            
            if (txn.status === 'paid' || txn.status === 'held') {
                clearInterval(poll);
                handlePaymentSuccess({ reference: transactionId }, transactionId);
            } else if (txn.status === 'failed') {
                clearInterval(poll);
                showFlashMessage('Payment failed or was cancelled', 'error');
            } else if (attempts >= maxAttempts) {
                clearInterval(poll);
                showFlashMessage('Payment timeout. Please check your phone and try again.', 'warning');
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 2000);
}

// ============================================================================
// PAYMENT CALLBACKS
// ============================================================================

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(response, transactionId) {
    try {
        // Update transaction status to 'held' (in escrow)
        await firebaseDB.collection('transactions').doc(transactionId).update({
            status: 'held',
            paidAt: firebase.firestore.FieldValue.serverTimestamp(),
            paystackReference: response.reference
        });
        
        // Update order status
        const txnDoc = await firebaseDB.collection('transactions').doc(transactionId).get();
        const txn = txnDoc.data();
        
        await firebaseDB.collection('orders').doc(txn.orderId).update({
            status: 'paid',
            transactionId,
            paidAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Notify seller
        await sendNotification(txn.sellerId, {
            type: 'payment_received',
            title: 'Payment Received!',
            message: `You received a payment for "${txn.productTitle}". Please ship the item.`,
            orderId: txn.orderId
        });
        
        // Redirect to success page
        window.location.href = `/payment-success.html?txn=${transactionId}`;
        
    } catch (error) {
        console.error('Payment success handler error:', error);
        showFlashMessage('Payment received but failed to update order. Contact support.', 'error');
    }
}

/**
 * Handle payment window closed
 */
async function handlePaymentClosed(transactionId) {
    try {
        await firebaseDB.collection('transactions').doc(transactionId).update({
            status: 'cancelled',
            cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Payment closed handler error:', error);
    }
}

// ============================================================================
// ESCROW OPERATIONS
// ============================================================================

/**
 * Release escrow funds to seller (called after buyer confirms delivery)
 */
async function releaseEscrow(transactionId, confirmedBy) {
    try {
        const txnDoc = await firebaseDB.collection('transactions').doc(transactionId).get();
        const txn = txnDoc.data();
        
        if (txn.status !== 'held') {
            throw new Error('Transaction is not in escrow');
        }
        
        // Update transaction status
        await firebaseDB.collection('transactions').doc(transactionId).update({
            status: 'released',
            releasedAt: firebase.firestore.FieldValue.serverTimestamp(),
            releasedBy: confirmedBy
        });
        
        // Trigger payout to seller via Paystack Transfer API
        // Note: This should be a Cloud Function in production
        const payoutResult = await initiatePayout({
            sellerId: txn.sellerId,
            amount: txn.netAmount,
            transactionId
        });
        
        if (payoutResult.success) {
            // Notify seller
            await sendNotification(txn.sellerId, {
                type: 'payment_released',
                title: 'Payment Released!',
                message: `GHS ${txn.netAmount} has been transferred to your account.`,
                orderId: txn.orderId
            });
            
            showFlashMessage('Payment released to seller successfully!', 'success');
            return { success: true };
        } else {
            throw new Error('Payout failed');
        }
        
    } catch (error) {
        console.error('Release escrow error:', error);
        showFlashMessage('Failed to release payment. Contact support.', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Refund escrow funds to buyer (called after dispute resolution)
 */
async function refundEscrow(transactionId, reason, adminId) {
    try {
        const txnDoc = await firebaseDB.collection('transactions').doc(transactionId).get();
        const txn = txnDoc.data();
        
        if (txn.status !== 'held') {
            throw new Error('Transaction is not in escrow');
        }
        
        // Update transaction status
        await firebaseDB.collection('transactions').doc(transactionId).update({
            status: 'refunded',
            refundedAt: firebase.firestore.FieldValue.serverTimestamp(),
            refundReason: reason,
            refundedBy: adminId
        });
        
        // Trigger refund via Paystack
        const refundResult = await initiateRefund({
            transactionId,
            amount: txn.amount,
            reason
        });
        
        if (refundResult.success) {
            // Notify both parties
            await sendNotification(txn.buyerId, {
                type: 'refund_processed',
                title: 'Refund Processed',
                message: `GHS ${txn.amount} has been refunded to your account.`,
                orderId: txn.orderId
            });
            
            await sendNotification(txn.sellerId, {
                type: 'refund_issued',
                title: 'Refund Issued',
                message: `A refund was issued for order. Reason: ${reason}`,
                orderId: txn.orderId
            });
            
            showFlashMessage('Refund processed successfully!', 'success');
            return { success: true };
        } else {
            throw new Error('Refund failed');
        }
        
    } catch (error) {
        console.error('Refund escrow error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Auto-release escrow after timeout (Cloud Function should call this)
 */
async function autoReleaseEscrow(transactionId) {
    try {
        const txnDoc = await firebaseDB.collection('transactions').doc(transactionId).get();
        const txn = txnDoc.data();
        
        if (txn.status === 'held' && !txn.disputeId) {
            await releaseEscrow(transactionId, 'system_auto_release');
            console.log(`Auto-released transaction ${transactionId}`);
        }
    } catch (error) {
        console.error('Auto-release error:', error);
    }
}

// ============================================================================
// BACKEND API CALLS (Should be Cloud Functions in production)
// ============================================================================

/**
 * Initiate MoMo charge (server-side)
 */
async function initiateMomoCharge(data) {
    // In production, this calls a Firebase Cloud Function
    // For demo, simulate success
    console.log('Initiating MoMo charge:', data);
    
    // Simulate API call
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({ success: true, reference: data.transactionId });
        }, 1000);
    });
}

/**
 * Initiate payout to seller (server-side)
 */
async function initiatePayout(data) {
    // In production, calls Paystack Transfer API
    console.log('Initiating payout:', data);
    
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({ success: true, transferCode: 'TRF_' + Date.now() });
        }, 1000);
    });
}

/**
 * Initiate refund (server-side)
 */
async function initiateRefund(data) {
    // In production, calls Paystack Refund API
    console.log('Initiating refund:', data);
    
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({ success: true, refundId: 'REF_' + Date.now() });
        }, 1000);
    });
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Send notification to user
 */
async function sendNotification(userId, notification) {
    try {
        await firebaseDB.collection('notifications').add({
            userId,
            ...notification,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Notification error:', error);
    }
}

/**
 * Get transaction status
 */
async function getTransactionStatus(transactionId) {
    try {
        const doc = await firebaseDB.collection('transactions').doc(transactionId).get();
        return doc.exists ? doc.data() : null;
    } catch (error) {
        console.error('Get transaction error:', error);
        return null;
    }
}

// Export for use in other files
window.PaymentSystem = {
    initializePayment,
    initializeMomoPayment,
    releaseEscrow,
    refundEscrow,
    autoReleaseEscrow,
    getTransactionStatus,
    PAYSTACK_CONFIG,
    ESCROW_CONFIG
};
