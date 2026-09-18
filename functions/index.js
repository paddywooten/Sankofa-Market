/**
 * Sankofa Market - Cloud Functions
 * 
 * Backend functions for Sankofa Market marketplace
 * Deploy with: firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// ============================================================================
// USER MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Create user profile when user signs up
 */
exports.createUserProfile = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL } = user;
  
  try {
    await db.collection('users').doc(uid).set({
      uid: uid,
      email: email,
      displayName: displayName || '',
      photoURL: photoURL || '',
      role: 'user', // Default role
      isVerified: false,
      isApproved: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ User profile created for ${email}`);
  } catch (error) {
    console.error('Error creating user profile:', error);
  }
});

/**
 * Delete user data when user is deleted
 */
exports.deleteUserData = functions.auth.user().onDelete(async (user) => {
  const { uid } = user;
  
  try {
    // Delete user document
    await db.collection('users').doc(uid).delete();
    
    // Delete user's products
    const products = await db.collection('products').where('sellerId', '==', uid).get();
    const batch = db.batch();
    products.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    console.log(`✅ User data deleted for ${uid}`);
  } catch (error) {
    console.error('Error deleting user data:', error);
  }
});

// ============================================================================
// PRODUCT MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Update product statistics (views, favorites)
 */
exports.updateProductStats = functions.firestore
  .document('products/{productId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();
    
    // Update view count
    if (newData.views !== previousData.views) {
      console.log(`Product ${context.params.productId} views updated`);
    }
  });

// ============================================================================
// ORDER MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Create order notification
 */
exports.createOrderNotification = functions.firestore
  .document('orders/{orderId}')
  .onCreate(async (snap, context) => {
    const order = snap.data();
    const orderId = context.params.orderId;
    
    try {
      // Create notification for seller
      await db.collection('notifications').add({
        userId: order.sellerId,
        type: 'new_order',
        title: 'New Order Received',
        message: `You have a new order for ${order.productTitle}`,
        orderId: orderId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Order notification created for order ${orderId}`);
    } catch (error) {
      console.error('Error creating order notification:', error);
    }
  });

/**
 * Update order status
 */
exports.updateOrderStatus = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();
    const orderId = context.params.orderId;
    
    // Check if status changed
    if (newData.status !== previousData.status) {
      console.log(`Order ${orderId} status changed to ${newData.status}`);
      
      // Create notification for buyer
      await db.collection('notifications').add({
        userId: newData.buyerId,
        type: 'order_status_update',
        title: 'Order Status Updated',
        message: `Your order status has been updated to ${newData.status}`,
        orderId: orderId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });

// ============================================================================
// MESSAGE MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Create message notification
 */
exports.createMessageNotification = functions.firestore
  .document('messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const messageId = context.params.messageId;
    
    try {
      // Don't notify if sender and receiver are the same
      if (message.senderId === message.receiverId) return;
      
      // Create notification for receiver
      await db.collection('notifications').add({
        userId: message.receiverId,
        type: 'new_message',
        title: 'New Message',
        message: message.content.substring(0, 100),
        messageId: messageId,
        conversationId: message.conversationId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Message notification created for message ${messageId}`);
    } catch (error) {
      console.error('Error creating message notification:', error);
    }
  });

// ============================================================================
// REVIEW MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Update product rating when review is created
 */
exports.updateProductRating = functions.firestore
  .document('reviews/{reviewId}')
  .onCreate(async (snap, context) => {
    const review = snap.data();
    const productId = review.productId;
    
    try {
      // Get all reviews for this product
      const reviews = await db.collection('reviews')
        .where('productId', '==', productId)
        .get();
      
      // Calculate average rating
      let totalRating = 0;
      reviews.forEach(doc => {
        totalRating += doc.data().rating;
      });
      
      const averageRating = totalRating / reviews.size;
      
      // Update product rating
      await db.collection('products').doc(productId).update({
        averageRating: averageRating,
        reviewCount: reviews.size,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Product rating updated for product ${productId}`);
    } catch (error) {
      console.error('Error updating product rating:', error);
    }
  });

// ============================================================================
// PAYMENT FUNCTIONS (Placeholder for Paystack Integration)
// ============================================================================

/**
 * Initialize payment with Paystack
 * 
 * IMPORTANT: Replace with your actual Paystack secret key
 */
exports.initializePayment = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { amount, email, productId, orderId } = data;
  
  try {
    // TODO: Implement actual Paystack integration
    // const response = await axios.post('https://api.paystack.co/transaction/initialize', {
    //   email: email,
    //   amount: amount * 100, // Paystack uses kobo (1 GHS = 100 kobo)
    //   callback_url: `https://sankofamarket.com.gh/payment-success?order=${orderId}`
    // }, {
    //   headers: {
    //     Authorization: `Bearer ${functions.config().paystack.secret_key}`
    //   }
    // });
    
    // For now, return a mock response
    return {
      success: true,
      message: 'Payment initialized (mock)',
      reference: `mock_${Date.now()}`
    };
  } catch (error) {
    console.error('Error initializing payment:', error);
    throw new functions.https.HttpsError('internal', 'Error initializing payment');
  }
});

/**
 * Verify payment with Paystack
 */
exports.verifyPayment = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { reference, orderId } = data;
  
  try {
    // TODO: Implement actual Paystack verification
    // const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
    //   headers: {
    //     Authorization: `Bearer ${functions.config().paystack.secret_key}`
    //   }
    // });
    
    // For now, return a mock response
    return {
      success: true,
      message: 'Payment verified (mock)',
      status: 'success'
    };
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw new functions.https.HttpsError('internal', 'Error verifying payment');
  }
});

// ============================================================================
// ESCROW FUNCTIONS
// ============================================================================

/**
 * Release escrow payment to seller
 */
exports.releaseEscrow = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { orderId } = data;
  const userId = context.auth.uid;
  
  try {
    // Get order
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Order not found');
    }
    
    const order = orderDoc.data();
    
    // Check if user is the buyer
    if (order.buyerId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Only buyer can release escrow');
    }
    
    // Check if order is in escrow
    if (order.status !== 'delivered') {
      throw new functions.https.HttpsError('failed-precondition', 'Order must be delivered before releasing escrow');
    }
    
    // TODO: Implement actual payment release to seller
    // This would integrate with Paystack to transfer funds to seller
    
    // Update order status
    await db.collection('orders').doc(orderId).update({
      status: 'completed',
      escrowReleased: true,
      escrowReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Escrow released for order ${orderId}`);
    
    return {
      success: true,
      message: 'Escrow released successfully'
    };
  } catch (error) {
    console.error('Error releasing escrow:', error);
    throw new functions.https.HttpsError('internal', 'Error releasing escrow');
  }
});

// ============================================================================
// ANALYTICS FUNCTIONS
// ============================================================================

/**
 * Track page view
 */
exports.trackPageView = functions.https.onCall(async (data, context) => {
  const { page, userId } = data;
  
  try {
    await db.collection('analytics').add({
      type: 'page_view',
      page: page,
      userId: userId || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Page view tracked: ${page}`);
  } catch (error) {
    console.error('Error tracking page view:', error);
  }
});

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

/**
 * Clean up old notifications (older than 90 days)
 */
exports.cleanupOldNotifications = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    try {
      const oldNotifications = await db.collection('notifications')
        .where('createdAt', '<', ninetyDaysAgo)
        .get();
      
      const batch = db.batch();
      oldNotifications.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      
      console.log(`✅ Cleaned up ${oldNotifications.size} old notifications`);
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
    }
  });

/**
 * Clean up old analytics (older than 1 year)
 */
exports.cleanupOldAnalytics = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    try {
      const oldAnalytics = await db.collection('analytics')
        .where('timestamp', '<', oneYearAgo)
        .get();
      
      const batch = db.batch();
      oldAnalytics.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      
      console.log(`✅ Cleaned up ${oldAnalytics.size} old analytics records`);
    } catch (error) {
      console.error('Error cleaning up analytics:', error);
    }
  });

// ============================================================================
// EXPORT ALL FUNCTIONS
// ============================================================================

module.exports = {
  // User management
  createUserProfile,
  deleteUserData,
  
  // Product management
  updateProductStats,
  
  // Order management
  createOrderNotification,
  updateOrderStatus,
  
  // Message management
  createMessageNotification,
  
  // Review management
  updateProductRating,
  
  // Payment functions
  initializePayment,
  verifyPayment,
  releaseEscrow,
  
  // Analytics
  trackPageView,
  
  // Cleanup functions
  cleanupOldNotifications,
  cleanupOldAnalytics
};
