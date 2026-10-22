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

/**
 * Maximum ACTIVE listings per seller tier.
 * Sold / paused listings never count against this.
 * Diamond is unlimited in practice, with a fair-use ceiling to stop abuse.
 */
const LISTING_LIMITS = {
  starter: 10,
  bronze: 30,
  silver: 75,
  gold: 200,
  diamond: 1000
};
const FAIR_USE_LIMIT = 1000;

function listingLimitForUser(user) {
  if (!user) return LISTING_LIMITS.starter;
  const premiumActive = user.isPremium === true &&
    user.premiumExpiry && user.premiumExpiry.toDate && user.premiumExpiry.toDate() > new Date();
  if (!premiumActive) return LISTING_LIMITS.starter;
  const tier = String(user.premiumTier || user.sellerTier || 'bronze').toLowerCase();
  return LISTING_LIMITS[tier] || LISTING_LIMITS.bronze;
}

// ============================================================================
// USER MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Create user profile when user signs up — also creates Sankofa Wallet (GHS 0)
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
    
    // Create Sankofa Wallet with 0 balance (closed-loop, 0% internal)
    await db.collection('wallets').doc(uid).set({
      userId: uid,
      balance: 0,
      currency: 'GHS',
      totalTopups: 0,
      totalSpent: 0,
      totalEarnings: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log(`✅ User profile + wallet created for ${email}`);

    // Welcome email — sent from here (the server) rather than from the browser, so it still
    // goes out if the new member closes the tab, and so no email key has to live in a page.
    // A failure here must never stop the account from working.
    try {
      const first = displayName || String(email || '').split('@')[0];
      const sent = await sendEmail('welcome', email, { name: first, pendingApproval: true, support_phone: '0273659806' });
      console.log('📧 welcome email:', JSON.stringify(sent));
    } catch (e) {
      console.error('welcome email failed (account is still fine):', e && e.message);
    }
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

    // Delete user's wallet + wallet history.
    // (Wallets used to be left behind when an account was removed, so the admin
    //  wallet list filled up with records for accounts that no longer existed.)
    await db.collection('wallets').doc(uid).delete().catch(() => {});
    const walletTx = await db.collection('walletTransactions').where('userId', '==', uid).get().catch(() => null);
    if (walletTx && !walletTx.empty) {
      const txBatch = db.batch();
      walletTx.docs.forEach(doc => txBatch.delete(doc.ref));
      await txBatch.commit();
    }

    // Delete user's products
    const products = await db.collection('products').where('sellerId', '==', uid).get();
    const batch = db.batch();
    products.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`✅ User data (profile, wallet, ${products.size} listing(s)) deleted for ${uid}`);
  } catch (error) {
    console.error('Error deleting user data:', error);
  }
});

/**
 * Admin-only: delete a user account for real (sign-in account + profile + wallet + listings).
 * The admin panel used to only hide the table row, which is why dead wallet records piled up.
 */
exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  // caller must be an admin (custom claim or users doc role)
  let callerIsAdmin = context.auth.token && context.auth.token.admin === true;
  if (!callerIsAdmin) {
    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    callerIsAdmin = callerDoc.exists && callerDoc.data().role === 'admin';
  }
  if (!callerIsAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users');
  }

  const userId = data && data.userId;
  if (!userId) throw new functions.https.HttpsError('invalid-argument', 'userId is required');
  if (userId === context.auth.uid) {
    throw new functions.https.HttpsError('invalid-argument', 'You cannot delete your own admin account');
  }

  let productsDeleted = 0;
  try {
    // wallet + history
    await db.collection('wallets').doc(userId).delete().catch(() => {});
    const walletTx = await db.collection('walletTransactions').where('userId', '==', userId).get().catch(() => null);
    if (walletTx && !walletTx.empty) {
      const b = db.batch();
      walletTx.docs.forEach(doc => b.delete(doc.ref));
      await b.commit();
    }
    // listings
    const products = await db.collection('products').where('sellerId', '==', userId).get();
    if (!products.empty) {
      const b2 = db.batch();
      products.docs.forEach(doc => b2.delete(doc.ref));
      await b2.commit();
      productsDeleted = products.size;
    }
    // profile
    await db.collection('users').doc(userId).delete().catch(() => {});
    // sign-in account
    await admin.auth().deleteUser(userId).catch((err) => {
      if (err.code !== 'auth/user-not-found') throw err;
    });

    console.log(`✅ Admin deleted user ${userId} (${productsDeleted} listing(s))`);
    return { ok: true, productsDeleted: productsDeleted };
  } catch (error) {
    console.error('adminDeleteUser failed:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Could not delete user');
  }
});

/**
 * Admin-only: housekeeping for leftover wallet records whose account is gone.
 * Deletes wallets (and their transactions) that have no matching users document,
 * or places the money in the admin's own wallet first if you ask it to.
 */
exports.cleanupOrphanWallets = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }
  let callerIsAdmin = context.auth.token && context.auth.token.admin === true;
  if (!callerIsAdmin) {
    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    callerIsAdmin = callerDoc.exists && callerDoc.data().role === 'admin';
  }
  if (!callerIsAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can do this');
  }

  const dryRun = !(data && data.confirm === true);
  const wallets = await db.collection('wallets').get();
  let removed = 0, skippedWithMoney = 0, moneyFreed = 0;

  for (const doc of wallets.docs) {
    const w = doc.data() || {};
    const owner = w.userId || doc.id;
    const ownerDoc = await db.collection('users').doc(owner).get();
    if (ownerDoc.exists) continue;                       // real account — keep it

    const balance = Number(w.balance) || 0;
    if (balance > 0) {
      // Never throw money away silently: leave it and report it.
      skippedWithMoney++;
      moneyFreed += balance;
      continue;
    }
    if (!dryRun) {
      await doc.ref.delete().catch(() => {});
      const tx = await db.collection('walletTransactions').where('userId', '==', owner).get().catch(() => null);
      if (tx && !tx.empty) {
        const b = db.batch();
        tx.docs.forEach(t => b.delete(t.ref));
        await b.commit();
      }
    }
    removed++;
  }

  console.log(`cleanupOrphanWallets dryRun=${dryRun} removed=${removed} skippedWithMoney=${skippedWithMoney}`);
  return { dryRun: dryRun, removed: removed, skippedWithMoney: skippedWithMoney, moneyInSkipped: moneyFreed };
});

/**
 * Enforce Starter limit: 2 active listings max (Premium unlimited)
 * Runs on product create — premium check via isPremium + expiry
 */
exports.enforceStarterLimit = functions.firestore.document('products/{productId}').onCreate(async (snap, context) => {
  const product = snap.data();
  const sellerId = product.sellerId;
  if (!sellerId) return null;
  try {
    const userDoc = await db.collection('users').doc(sellerId).get();
    if (!userDoc.exists) return null;
    const user = userDoc.data() || {};
    // Staff accounts seed the marketplace (Quick-List, CSV bulk import, Sankofa
    // Store shelves) — seller plan quotas are for sellers, never for admins.
    // Without this, a bulk CSV import silently deleted its own rows over the cap.
    if (user.role === 'admin' || user.isAdmin === true) return null;
    const limit = listingLimitForUser(user);

    // Count this seller's ACTIVE listings (sold/paused do not count)
    const all = await db.collection('products').where('sellerId', '==', sellerId).get();
    let activeCount = 0;
    all.docs.forEach(d => {
      const x = d.data() || {};
      if (x.isActive !== false && x.isSold !== true) activeCount++;
    });

    if (activeCount > limit) {
      await snap.ref.delete();
      console.log(`Listing limit enforced for ${sellerId}: limit ${limit}, active ${activeCount} — removed ${context.params.productId}`);
      // Tell the seller why, so they are not left guessing
      await db.collection('notifications').add({
        userId: sellerId,
        type: 'listing_limit',
        title: 'Listing limit reached',
        message: `Your plan allows ${limit} active listings. The newest listing was not saved — remove or mark something as sold, or upgrade your plan for more.`,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});
    } else {
      console.log(`Listing limit OK for ${sellerId}: ${activeCount}/${limit} active`);
    }
  } catch (error) {
    console.error('Error enforcing listing limit:', error);
  }
});

/**
 * Set Custom Claim for admin — called manually or via admin panel
 * Enables 0-read isAdmin() via request.auth.token.admin
 */
/**
 * Admin-only: create a NEW admin account (auth user + profile + claim).
 *
 * Why a function: the security rules no longer allow an account to give itself an admin
 * role, so the old client-side "create then self-promote" flow cannot work. The Admin SDK
 * bypasses the rules, so the promotion happens safely on the server after verifying the
 * caller really is an admin.
 */
exports.adminCreateAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }
  // caller must be a full admin (claim or users-doc role)
  let callerIsAdmin = context.auth.token && context.auth.token.admin === true;
  if (!callerIsAdmin) {
    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    callerIsAdmin = callerDoc.exists && callerDoc.data().role === 'admin';
  }
  if (!callerIsAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can create admins');
  }

  const email = (data && data.email || '').trim().toLowerCase();
  const password = (data && data.password) || '';
  const name = (data && data.name || '').trim();
  const phone = (data && data.phone || '').trim();
  const adminRole = (data && data.adminRole) || 'manager';

  if (!email || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'Email and password are required');
  }
  if (password.length < 8) {
    throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 8 characters');
  }

  const adminCode = String(Math.floor(100000 + Math.random() * 900000));

  try {
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name || email,
      emailVerified: false
    });

    // Creating the auth user fires the signup trigger (createUserProfile), which writes a
    // normal 'user'/'pending' profile. Write our admin fields, then re-apply them once the
    // trigger has settled — otherwise the trigger can overwrite the admin role.
    const adminProfile = {
      name: name || email,
      email: email,
      phone: phone,
      role: 'admin',
      adminRole: adminRole,
      status: 'approved',
      adminCode: adminCode,
      isVerified: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth.uid
    };

    await db.collection('users').doc(userRecord.uid).set(
      Object.assign({}, adminProfile, { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
      { merge: true });

    // let the signup trigger finish, then make sure the admin fields are the ones that remain
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await db.collection('users').doc(userRecord.uid).set(adminProfile, { merge: true });

    // instant admin checks (no extra reads per request)
    await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });

    // verify we really ended up as an admin
    const check = await db.collection('users').doc(userRecord.uid).get();
    const finalRole = (check.data() || {}).role;
    if (finalRole !== 'admin') {
      console.warn(`adminCreateAdmin: role is "${finalRole}" after re-apply — forcing again`);
      await db.collection('users').doc(userRecord.uid).set({ role: 'admin', status: 'approved' }, { merge: true });
    }

    console.log(`✅ Admin created: ${email} (${adminRole}) by ${context.auth.uid}`);
    return { ok: true, uid: userRecord.uid, adminCode: adminCode };
  } catch (error) {
    console.error('adminCreateAdmin failed:', error);
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists',
        'That email already has an account. Use "Make an existing member an admin" instead.');
    }
    throw new functions.https.HttpsError('internal', error.message || 'Could not create the admin');
  }
});

exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  // Only existing admins can grant
  const callerDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can set claims');
  }
  const { uid } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'uid required');
  // data.admin === false clears the claim (used when an admin is demoted)
  const grant = !(data && data.admin === false);
  await admin.auth().setCustomUserClaims(uid, grant ? { admin: true } : { admin: false });
  // Demotion must also remove the Firestore role. The previous code always wrote
  // role:'admin', which silently restored the role after js/admin-management.js
  // had set it to 'user'.
  await db.collection('users').doc(uid).set(
    { role: grant ? 'admin' : 'user', updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  return { success: true, message: 'Admin claim ' + (grant ? 'granted' : 'revoked') + ' for ' + uid };
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
        isRead: false,   // the inbox and the bell both count unread by isRead
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
        isRead: false,   // the inbox and the bell both count unread by isRead
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
  // ⚠️ Chat messages live in a SUBCOLLECTION: conversations/{id}/messages/{id}.
  // This trigger used to watch the top-level `messages/{id}` path, which nothing ever writes,
  // so it never fired — there was no "new message" alert at all. It also read
  // `message.receiverId` and `message.content`, neither of which exists on a real message
  // (messages carry `participants` and `text`).
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data() || {};
    const messageId = context.params.messageId;
    const conversationId = context.params.conversationId;

    try {
      const senderId = message.senderId;
      if (!senderId) return null;

      // notify everyone in the conversation except the person who wrote it
      const recipients = (Array.isArray(message.participants) ? message.participants : [])
        .filter(function (uid) { return uid && uid !== senderId; });
      if (!recipients.length) return null;

      const preview = (message.text || '').trim() ||
        (message.fileUrl ? '📎 ' + (message.fileName || 'Attachment') : 'New message');
      const senderName = message.senderName || 'Someone';

      // what is the chat about? (product or auction, so the alert can say so)
      let about = '';
      try {
        const conv = await db.collection('conversations').doc(conversationId).get();
        if (conv.exists) about = (conv.data().productTitle || '');
      } catch (e) {}

      for (const uid of recipients) {
        // don't stack up alerts while the person is already sitting in that chat
        const open = await db.collection('notifications')
          .where('userId', '==', uid)
          .where('conversationId', '==', conversationId)
          .where('isRead', '==', false)
          .limit(1).get().catch(function () { return { empty: false, docs: [] }; });
        if (open && !open.empty) {
          // already an unread alert for this chat — refresh it instead of adding another
          await open.docs[0].ref.set({
            title: 'New message from ' + senderName,
            message: preview.substring(0, 140),
            isRead: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          continue;
        }
        await db.collection('notifications').add({
          userId: uid,
          type: 'new_message',
          title: 'New message from ' + senderName,
          message: preview.substring(0, 140) + (about ? '\n\nAbout: ' + about : ''),
          conversationId: conversationId,
          messageId: messageId,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      console.log(`✅ Message alert created for ${recipients.length} recipient(s) in ${conversationId}`);
    } catch (error) {
      console.error('Error creating message notification:', error && error.message);
    }
    return null;
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
      if (productId) {
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
      } else {
        // Reviews from places that cannot name the product still count toward the seller.
        console.log('review has no productId — skipping product aggregate');
      }

      // Seller aggregate → public sellerRatings/{sellerId}. The users/{id} docs are
      // owner/admin-only reads, so a buyer's browser could never show the seller's
      // score without this mirror.
      const sellerId = review.sellerId;
      if (sellerId) {
        try {
          const sellerReviews = await db.collection('reviews').where('sellerId', '==', sellerId).get();
          let sellerTotal = 0;
          sellerReviews.forEach(doc => { sellerTotal += Number(doc.data().rating) || 0; });
          const sellerAvg = sellerTotal / sellerReviews.size;
          await db.collection('sellerRatings').doc(sellerId).set({
            sellerId: sellerId,
            avg: Math.round(sellerAvg * 100) / 100,
            count: sellerReviews.size,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          console.log(`✅ Seller rating updated for seller ${sellerId}`);
        } catch (e) {
          console.error('Error updating seller rating:', e);
        }
      }
    } catch (error) {
      console.error('Error updating product rating:', error);
    }
  });

// ============================================================================
// FOLLOWS — follower counts + auction-start fan-out
// ============================================================================

/**
 * Keep sellerFollowStats/{sellerId} in step with the follows collection.
 * Fires on create + delete (updates are impossible by rule).
 */
exports.updateFollowStats = functions.firestore
  .document('follows/{followId}')
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const sellerId = (after && after.sellerId) || (before && before.sellerId);
    if (!sellerId) return;
    try {
      const snap = await db.collection('follows').where('sellerId', '==', sellerId).get();
      await db.collection('sellerFollowStats').doc(sellerId).set({
        sellerId: sellerId,
        followers: snap.size,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`✅ follower count for ${sellerId}: ${snap.size}`);
    } catch (e) {
      console.error('updateFollowStats failed', e);
    }
  });

/**
 * The moment a seller starts an auction, every follower gets an inbox alert.
 * Agreed design: auctions stay publicly discoverable (a seller with 0 followers
 * must not bid in an empty room) — followers simply hear about it first.
 * Batched 450 at a time, capped at 1,000 followers per fan-out for safety.
 */
exports.notifyFollowersAuction = functions.firestore
  .document('auctions/{auctionId}')
  .onCreate(async (snap, context) => {
    const a = snap.data();
    const auctionId = context.params.auctionId;
    if (!a || !a.sellerId) return;
    try {
      const followers = await db.collection('follows').where('sellerId', '==', a.sellerId).limit(1000).get();
      if (followers.empty) return;
      const sellerName = a.sellerName || 'A seller you follow';
      const title = String(a.title || 'New auction').slice(0, 120);
      const opens = a.waitingMinutes ? 'Bidding opens in ' + a.waitingMinutes + ' min — get ready.' : 'Bidding is open right now.';
      const docs = [];
      followers.forEach(d => {
        const f = d.data();
        if (!f.followerId || f.followerId === a.sellerId) return;
        docs.push({
          userId: f.followerId,
          type: 'auction_started',
          title: sellerName + ' just started an auction ⚡',
          message: '"' + title + '" — ' + opens + ' You follow this seller, so you heard about it first.',
          auctionId: auctionId,
          productId: a.productId || null,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      for (let i = 0; i < docs.length; i += 450) {
        const batch = db.batch();
        docs.slice(i, i + 450).forEach(n => batch.set(db.collection('notifications').doc(), n));
        await batch.commit();
      }
      console.log(`✅ auction "${title}" fanned out to ${docs.length} follower(s)`);
    } catch (e) {
      console.error('notifyFollowersAuction failed', e);
    }
  });

/**
 * Public premium-badge mirror. users/{id} is owner/admin-read only, so the gold
 * "✓ PREMIUM" / purple "◆ DIAMOND" badge could never render for strangers. This
 * mirrors {tier, premiumExpiry} into sellerPublic/{uid} on every profile write;
 * the badge dies the moment premiumExpiry passes because the CLIENT compares
 * timestamps — no scheduled cleanup needed.
 */
exports.syncSellerPublicBadge = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const uid = context.params.userId;
    const ref = db.collection('sellerPublic').doc(uid);
    try {
      // account deleted → badge gone
      if (!change.after.exists) {
        await ref.delete().catch(() => {});
        return;
      }
      const d = change.after.data() || {};
      const tier = String(d.premiumTier || d.sellerTier || '').toLowerCase();
      const expiry = d.premiumExpiry;
      const expiryMs = expiry && expiry.toMillis ? expiry.toMillis() : 0;
      const PAID = ['bronze', 'silver', 'gold', 'diamond'];
      if (d.isPremium !== true || PAID.indexOf(tier) === -1 || !expiryMs) {
        // not a premium account (anymore) — make sure nothing shows
        await ref.delete().catch(() => {});
        console.log(`sellerPublic cleared for ${uid} (isPremium=${d.isPremium}, tier=${tier})`);
        return;
      }
      await ref.set({
        sellerId: uid,
        tier: tier,
        premiumExpiry: expiry,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`✅ sellerPublic badge synced for ${uid}: ${tier} until ${new Date(expiryMs).toISOString()}`);
    } catch (e) {
      console.error('syncSellerPublicBadge failed for', uid, e);
    }
  });

// ============================================================================
// PRODUCT COMMENTS — public Q&A: notifications + count mirror + report auto-hide
// ============================================================================

/**
 * Top-level comment → alert the seller. Reply → alert the person being
 * answered. Nobody is ever alerted about their own typing.
 */
exports.notifyCommentActivity = functions.firestore
  .document('comments/{commentId}')
  .onCreate(async (snap, context) => {
    const c = snap.data();
    if (!c || !c.productId) return;
    try {
      const who = String(c.userName || 'Someone').slice(0, 60);
      const title = String(c.productTitle || 'your item').slice(0, 80);
      const snippet = String(c.text || '').slice(0, 120);
      const notes = [];
      if (c.parentId) {
        const parent = await db.collection('comments').doc(c.parentId).get();
        const p = parent.exists ? parent.data() : null;
        if (p && p.userId && p.userId !== c.userId) {
          notes.push({
            userId: p.userId,
            type: 'comment_reply',
            title: who + ' replied to your comment',
            message: '"' + snippet + '" — on ' + title,
            productId: c.productId,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } else if (c.sellerId && c.sellerId !== c.userId) {
        notes.push({
          userId: c.sellerId,
          type: 'new_comment',
          title: who + ' asked about ' + title,
          message: '"' + snippet + '"',
          productId: c.productId,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      if (notes.length) {
        const batch = db.batch();
        notes.forEach(n => batch.set(db.collection('notifications').doc(), n));
        await batch.commit();
      }
      console.log(`comment ${context.params.commentId}: ${notes.length} notification(s)`);
    } catch (e) {
      console.error('notifyCommentActivity failed', e);
    }
  });

/**
 * Keep products/{id}.commentCount in step with the thread, so listing cards
 * and the page header can show "5 comments" without scanning the collection.
 * Comments hidden by community reports (reported == true) stop counting.
 */
exports.updateCommentCount = functions.firestore
  .document('comments/{commentId}')
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const productId = (after && after.productId) || (before && before.productId);
    if (!productId) return;
    try {
      const all = await db.collection('comments').where('productId', '==', productId).get();
      let visible = 0;
      all.forEach(d => { if (d.data().reported !== true) visible++; });
      await db.collection('products').doc(productId).set({
        commentCount: visible,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`product ${productId}: ${visible} visible comment(s) of ${all.size}`);
    } catch (e) {
      console.error('updateCommentCount failed', e);
    }
  });

/**
 * Community moderation, reusing the shared `reports` collection (so the admin
 * panel's Reports badge counts them automatically): a comment is hidden once
 * THREE DIFFERENT people have reported it. Counting distinct reporters means
 * one angry shopper can never brigade a comment away on their own.
 */
exports.moderateReportedComments = functions.firestore
  .document('reports/{reportId}')
  .onCreate(async (snap, context) => {
    const r = snap.data();
    if (!r || !r.commentId) return;
    try {
      const reports = await db.collection('reports').where('commentId', '==', r.commentId).get();
      const reporters = new Set();
      reports.forEach(d => { const x = d.data(); if (x.reporterId) reporters.add(x.reporterId); });
      const n = reporters.size;
      const hide = n >= 3;
      await db.collection('comments').doc(r.commentId).set({
        reportCount: n,
        reported: hide
      }, { merge: true });
      console.log(`comment ${r.commentId}: ${n} distinct reporter(s) — ${hide ? 'HIDDEN' : 'still visible'}`);
    } catch (e) {
      console.error('moderateReportedComments failed', e);
    }
  });

// ============================================================================
// PAYMENT FUNCTIONS (Placeholder for Paystack Integration)
// ============================================================================

/**
 * Initialize payment with Paystack — now live with test secret (sk_test_... set via functions:config)
 * Uses Paystack API: POST https://api.paystack.co/transaction/initialize
 */
// ============================================================================
// PAYMENT FUNCTIONS — Paystack
// ============================================================================
//
// THE RULES OF THE ROAD (why this file is written the way it is)
//
//   1. Money is only ever CREATED by Paystack confirming a real charge.
//      Two functions are allowed to do that: verifyWalletTopup (wallet top-ups) and
//      confirmPaystackPayment / payWithWallet (orders). Nothing else may touch a balance.
//   2. Every Paystack reference may be spent exactly ONCE, by ONE account, for ONE purpose.
//      The `paystackRefs/{reference}` document is the ledger that enforces it. The old code
//      only checked "has THIS user used this reference", so any other account could replay
//      the same reference and credit itself again for free.
//   3. An order can only pay out if the SERVER recorded the payment (`paidViaServer` /
//      `walletPaid` / `escrowHeldByServer`). The browser cannot write those fields
//      (see firestore.rules → orders), so a hand-made "order" can never be paid out.
//   4. Escrow release is idempotent and the payout is computed from server-locked fields.
//      `releaseEscrowCore` re-reads the order inside a transaction, so a double-click, a
//      retry or the hourly auto-release can never pay the seller twice.
//   5. If the gateway is not configured we FAIL CLOSED. The old code answered
//      "verified: success" when the secret key was missing, which would have turned every
//      unverified reference into a valid payment.

function paystackSecret() {
  let secret = null;
  try {
    secret = functions.config().paystack?.secret_key || functions.config().paystack?.secret || null;
  } catch (e) { /* functions.config() can throw on newer runtimes */ }
  if (!secret) secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || null;
  return secret || null;
}

function requirePaystackSecret() {
  const secret = paystackSecret();
  if (!secret) {
    throw new functions.https.HttpsError('failed-precondition',
      'Card payments are temporarily unavailable (the payment gateway is not configured). Please try again later or contact support: sankofamarketgh@gmail.com');
  }
  return secret;
}

/** Ask Paystack about a reference. Throws a clear error if Paystack says no. */
async function paystackVerifyReference(reference) {
  const secret = requirePaystackSecret();
  const axios = require('axios');
  let resp;
  try {
    resp = await axios.get('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), {
      headers: { Authorization: 'Bearer ' + secret },
      timeout: 20000
    });
  } catch (e) {
    const status = e.response && e.response.status;
    console.error('Paystack verify failed', status, e.response ? e.response.data : e.message);
    if (status === 404) throw new functions.https.HttpsError('not-found', 'That payment reference was not found.');
    throw new functions.https.HttpsError('internal', 'Could not reach the payment gateway to verify this payment. Nothing was charged.');
  }
  if (!resp.data || !resp.data.status) {
    throw new functions.https.HttpsError('internal',
      'Payment gateway verification failed: ' + ((resp.data && resp.data.message) || 'unknown error'));
  }
  return resp.data.data || {};
}

/** Paystack returns metadata as an object OR a JSON string — normalise it. */
function paystackMetadata(payData) {
  let m = payData && payData.metadata;
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { m = {}; } }
  return (m && typeof m === 'object') ? m : {};
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function pesewas(n) { return Math.round((Number(n) || 0) * 100); }

/**
 * Start a card payment for an order.
 * The amount is taken from the ORDER DOCUMENT, never from the browser. (The old version
 * charged whatever number the caller sent, so a buyer could pay GHS 1 for a GHS 10,000 item.)
 */
exports.initializePayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in first.');
  const orderId = (data || {}).orderId;
  const productId = (data || {}).productId || null;

  let amount = 0;
  if (orderId) {
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) throw new functions.https.HttpsError('not-found', 'Order not found');
    const order = orderDoc.data();
    if (order.buyerId !== context.auth.uid && order.userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'This order is not yours.');
    }
    amount = round2(order.total || order.amount || 0);
  }
  if (!(amount > 0)) {
    throw new functions.https.HttpsError('invalid-argument',
      'An order with an amount is required to start a card payment (the amount may not be sent from the browser).');
  }
  const email = (context.auth.token && context.auth.token.email) || (data && data.email);
  if (!email) throw new functions.https.HttpsError('invalid-argument', 'This account has no email address.');

  const secret = requirePaystackSecret();
  const axios = require('axios');
  try {
    const response = await axios.post('https://api.paystack.co/transaction/initialize', {
      email: email,
      amount: pesewas(amount),
      currency: 'GHS',
      callback_url: 'https://sankofa-market.web.app/payment.html?order=' + (orderId || ''),
      metadata: { userId: context.auth.uid, orderId: orderId || null, productId: productId, purpose: 'order_payment' }
    }, {
      headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json' },
      timeout: 20000
    });
    const d = response.data;
    if (!d || !d.status) throw new Error((d && d.message) || 'Paystack init failed');
    return {
      success: true, message: 'Payment initialized',
      authorization_url: d.data.authorization_url, access_code: d.data.access_code,
      reference: d.data.reference, amount
    };
  } catch (error) {
    console.error('Paystack init error:', error.response ? error.response.data : error.message);
    throw new functions.https.HttpsError('internal',
      'Paystack error: ' + ((error.response && error.response.data && error.response.data.message) || error.message));
  }
});

/**
 * The ONLY way an order becomes "paid" on a card payment.
 * Verifies the reference with Paystack, checks the amount matches the order, makes sure the
 * reference has never been used before, records it, and only then marks the order paid.
 */
async function applyVerifiedOrderPayment(opts) {
  const orderId = opts.orderId, reference = opts.reference,
        callerUid = opts.callerUid, payData = opts.payData;

  const paidGHS = round2(Number(payData.amount || 0) / 100);   // Paystack sends pesewas
  const currency = String(payData.currency || 'GHS').toUpperCase();
  if (currency !== 'GHS') {
    throw new functions.https.HttpsError('failed-precondition', 'Only GHS payments are accepted (this one was ' + currency + ').');
  }
  const md = paystackMetadata(payData);
  if (md.userId && md.userId !== callerUid) {
    throw new functions.https.HttpsError('permission-denied', 'This payment was made from a different account.');
  }
  if (md.purpose === 'wallet_topup') {
    throw new functions.https.HttpsError('failed-precondition', 'That reference is a wallet top-up, not an order payment.');
  }

  const orderRef = db.collection('orders').doc(orderId);
  const refRef = db.collection('paystackRefs').doc(reference);

  return await db.runTransaction(async (tx) => {
    const orderDoc = await tx.get(orderRef);
    const refDoc = await tx.get(refRef);

    if (refDoc.exists) {
      const used = refDoc.data() || {};
      if (used.orderId === orderId) return { alreadyCredited: true, amount: round2(used.amount) };
      throw new functions.https.HttpsError('failed-precondition',
        'This payment has already been used on another order. Nothing was charged twice.');
    }
    if (!orderDoc.exists) throw new functions.https.HttpsError('not-found', 'Order not found');

    const order = orderDoc.data();
    const isBuyer = order.buyerId === callerUid || order.userId === callerUid;
    if (!isBuyer) throw new functions.https.HttpsError('permission-denied', 'Only the buyer can pay for this order.');
    if (order.escrowReleased === true || String(order.status) === 'completed') {
      throw new functions.https.HttpsError('failed-precondition', 'This order is already finished.');
    }
    if (order.paymentStatus === 'paid' || order.walletPaid === true || order.paidViaServer === true) {
      if (order.paystackReference === reference) return { alreadyCredited: true, amount: round2(order.paidAmount || paidGHS) };
      throw new functions.https.HttpsError('failed-precondition', 'This order is already paid.');
    }

    // THE PRICE CHECK: every row must match the live listing. The buyer's card has already been
    // charged at this point, so a refusal is recorded for support (like the amount check below).
    await smAssertCartPrices(async (pid) => {
      const pd = await tx.get(db.collection('products').doc(pid));
      return pd.exists ? (pd.data() || null) : null;
    }, order, 'Nothing was marked as paid. Please contact support with reference ' + reference + ' (sankofamarketgh@gmail.com).');
    // A promo-coded order must prove its discount math before a pesewa moves
    let promoUsed = null;
    if (order.promo && order.promo.code) promoUsed = await smPromoAssertAndConsume(tx, order);
    const expected = promoUsed ? promoUsed.expectedTotal : round2(order.total || order.amount || 0);
    if (!(expected > 0)) throw new functions.https.HttpsError('failed-precondition', 'This order has no amount to pay.');
    if (pesewas(paidGHS) !== pesewas(expected)) {
      throw new functions.https.HttpsError('failed-precondition',
        'Amount mismatch: Paystack charged GHS ' + paidGHS.toFixed(2) + ' but this order is GHS ' + expected.toFixed(2) +
        '. Nothing was marked as paid — please contact support with reference ' + reference + ' (sankofamarketgh@gmail.com).');
    }

    // MOQ-A seatbelt: pack-size listings refuse small orders right here, before any write
    await assertMinOrderQuantities(tx, order);

    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.set(refRef, {
      reference, kind: 'order_payment', orderId, userId: callerUid,
      amount: paidGHS, createdAt: now
    });
    tx.update(orderRef, {
      status: 'paid',
      paymentStatus: 'paid',
      paymentMethod: order.paymentMethod || 'paystack',
      paystackReference: reference,
      paidAmount: paidGHS,
      paidViaServer: true,
      escrowHeldByServer: true,
      escrowStatus: 'held',
      escrowHeldAt: now,
      paidAt: now,
      paidPromo: promoUsed ? { code: promoUsed.code, discount: promoUsed.discount, ownerId: promoUsed.ownerId } : null,
      updatedAt: now
    });
    // If this order paid out a CHAT BARGAIN, close the offer in the SAME transaction —
    // order creation demands status 'pending', so a second order can never spend it.
    if (order.offerId) {
      tx.update(db.collection('offers').doc(order.offerId), {
        status: 'paid',
        paidOrderId: orderId,
        paidAt: now
      });
    }
    return { paid: true, amount: paidGHS };
  });
}

/**
 * The bargain thread hears about the payment from the BUYER's side (posted as a
 * normal chat message), so the chat itself becomes the receipt both sides can
 * find later. Never throws — it is reporting, not money.
 */
async function announceOfferPaidInChat(orderId, amount) {
  if (!orderId) return;
  const orderDoc = await db.collection('orders').doc(orderId).get();
  const order = orderDoc.exists ? orderDoc.data() : null;
  if (!order || !order.offerId) return;
  const offerSnap = await db.collection('offers').doc(order.offerId).get();
  if (!offerSnap.exists) return;
  const offer = offerSnap.data() || {};
  const convId = offer.conversationId;
  const buyerId = order.buyerId || order.userId;
  const sellerId = order.sellerId || offer.sellerId;
  if (!convId || !buyerId || !sellerId) return;
  const text = '✅ I have just paid the special price GHS ' + Number(amount).toLocaleString() +
    ' for "' + String(order.productTitle || order.title || 'the item').slice(0, 80) +
    '". The money is held in escrow until I confirm delivery.';
  const now = admin.firestore.FieldValue.serverTimestamp();
  const convRef = db.collection('conversations').doc(convId);
  const msgRef = convRef.collection('messages').doc();
  const batch = db.batch();
  batch.set(msgRef, {
    senderId: buyerId,
    senderName: order.buyerName || 'Buyer',
    text: text,
    status: 'sent',
    participants: [buyerId, sellerId],
    createdAt: now
  });
  batch.update(convRef, {
    lastMessage: text,
    lastMessageAt: now,
    unreadBy: [sellerId]
  });
  await batch.commit();
  console.log(`💬 offer ${order.offerId}: payment announced in chat ${convId}`);
}

/**
 * Called by the payment page right after Paystack's popup reports success.
 * The browser's word is not enough — we re-verify with Paystack and check the amount.
 */
exports.confirmPaystackPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in first.');
  const orderId = (data || {}).orderId;
  const reference = (data || {}).reference;
  if (!orderId || !reference) throw new functions.https.HttpsError('invalid-argument', 'orderId and reference are required.');

  const payData = await paystackVerifyReference(reference);
  const status = String(payData.status || '').toLowerCase();
  if (status !== 'success') {
    throw new functions.https.HttpsError('failed-precondition', 'Paystack says this payment is "' + status + '", so the order was not marked as paid.');
  }
  const res = await applyVerifiedOrderPayment({ orderId, reference, callerUid: context.auth.uid, payData });
  if (!res.alreadyCredited) {
    // a mixed cart becomes one order per seller (escrow is per seller)
    try { await splitPaidOrderBySeller(orderId); } catch (e) { console.error('split failed', e && e.message); }
    try { await tickPreorderCounters(orderId); } catch (e) { console.error('preorder tick failed', e && e.message); }
    try { await announceOfferPaidInChat(orderId, res.amount); } catch (e) { console.error('offer chat announce failed', e && e.message); }
    try {
      const order = (await db.collection('orders').doc(orderId).get()).data() || {};
      const buyerEmail = await emailForUser(order.buyerId || order.userId);
      await sendEmail('payment_receipt', buyerEmail || order.buyerEmail, {
        name: order.buyerName, orderId: orderId, amount: res.amount,
        title: order.productTitle || order.title, method: 'paystack', reference: reference
      });
      const sellerEmail = order.sellerEmail || await emailForUser(order.sellerId);
      const est = await estimateSellerSplit(res.amount, order.sellerId);
      await sendEmail('sale_received', sellerEmail, {
        name: order.sellerName, orderId: orderId, amount: res.amount,
        title: order.productTitle || order.title,
        payout: order.sellerPayout != null ? round2(order.sellerPayout) : est.payout, commission: est.commission
      });
    } catch (e) { console.error('receipt emails failed', e && e.message); }
  }
  return {
    success: true,
    alreadyCredited: !!res.alreadyCredited,
    amount: res.amount,
    message: res.alreadyCredited ? 'This payment was already recorded.' : 'Payment confirmed and held in escrow.'
  };
});

/**
 * Verify a payment. Kept for compatibility; now amount-checked and single-use.
 * If an orderId is supplied it goes through exactly the same guarded path as
 * confirmPaystackPayment, so it cannot be used to mark an order paid for free.
 */
// ============================================================================
// PRE-ORDER MOQ (Sankofa Store batches)
// ============================================================================
// Two rules, one theme — nobody's money must ever hang on luck:
//   MOQ-A  minOrderQty on a listing = smallest pack a buyer may order. The cart
//          nudges people up front; assertMinOrderQuantities is the server-side
//          seatbelt so a tampered cart still can't buy "just 1" of a pack of 12.
//   MOQ-B  preOrderTargetQty + preOrderDeadline = "this batch only happens if N
//          pieces sell by date D". Counters tick on payment; an hourly sweep
//          refunds everyone automatically if the deadline passes short — escrow
//          was built exactly for this.

/** Map of productId → total pieces in an order (items array, or single-item shape). */
function moqItemsByProduct(order) {
  const byProduct = new Map();
  (order.items || []).forEach(it => {
    if (!it) return;
    const pid = it.productId || it.id;
    if (pid) byProduct.set(pid, (byProduct.get(pid) || 0) + (Number(it.quantity) || 1));
  });
  if (byProduct.size === 0 && order.productId) {
    byProduct.set(order.productId, Number(order.quantity || order.qty) || 1);
  }
  return byProduct;
}

/**
 * MOQ-A seatbelt. Runs inside the payment transaction BEFORE any write, so a
 * violating order is refused with money unmarked (reads come before writes here).
 */
async function assertMinOrderQuantities(tx, order) {
  const byProduct = moqItemsByProduct(order);
  if (!byProduct.size) return;
  for (const [pid, qty] of byProduct) {
    const pDoc = await tx.get(db.collection('products').doc(pid));
    if (!pDoc.exists) continue;                       // listing vanished → nothing to enforce
    const min = Number(pDoc.data().minOrderQty || 0);
    if (min >= 2 && qty < min) {
      const title = pDoc.data().title || 'This item';
      throw new functions.https.HttpsError('failed-precondition',
        '"' + title + '" comes in packs of ' + min + ' or more, but this order has ' + qty + '. ' +
        'Increase the quantity in your cart and pay again — nothing was marked as paid here.');
    }
  }
}

/**
 * MOQ-B counters: after an order is paid (any path — card, webhook, wallet), add its
 * batch pieces to the product docs. Idempotent via order.preOrderCounted. Runs AFTER
 * the money transaction commits, so a bookkeeping hiccup can never undo a payment.
 */
async function tickPreorderCounters(orderId) {
  const ref = db.collection('orders').doc(orderId);
  const doc = await ref.get();
  if (!doc.exists) return;
  const order = doc.data();
  if (order.preOrderCounted === true) return;
  const byProduct = moqItemsByProduct(order);
  const batch = db.batch();
  batch.update(ref, { preOrderCounted: true });
  let touched = 0;
  for (const [pid, qty] of byProduct) {
    const pRef = db.collection('products').doc(pid);
    const pDoc = await pRef.get();
    if (!pDoc.exists) continue;
    const p = pDoc.data();
    if (!(Number(p.preOrderTargetQty) >= 2) || p.preOrderBatchStatus !== 'collecting') continue;
    touched++;
    const updates = { preOrderSoldQty: admin.firestore.FieldValue.increment(qty) };
    if ((Number(p.preOrderSoldQty) || 0) + qty >= Number(p.preOrderTargetQty)) {
      updates.preOrderBatchStatus = 'ready';     // the batch is happening 🎉
      updates.preOrderReadyAt = admin.firestore.FieldValue.serverTimestamp();
    }
    batch.update(pRef, updates);
  }
  await batch.commit();
  if (touched) console.log(`🧺 pre-order counters ticked for order ${orderId} (${touched} batch item(s))`);
}

/**
 * Reverse of tick: a refund pulls pieces back out of a batch. Multi-seller parents
 * are skipped (their children own the slices, same rule as commissions).
 * A "ready" batch slides back to "collecting" if refunds drop it under target.
 */
async function untickPreorderCounters(orderId) {
  const doc = await db.collection('orders').doc(orderId).get();
  if (!doc.exists) return;
  const order = doc.data();
  if (order.isMultiSeller === true) return;
  const byProduct = moqItemsByProduct(order);
  for (const [pid, qty] of byProduct) {
    const pRef = db.collection('products').doc(pid);
    const pDoc = await pRef.get();
    if (!pDoc.exists) continue;
    const p = pDoc.data();
    if (!(Number(p.preOrderTargetQty) >= 2)) continue;
    const updates = { preOrderSoldQty: admin.firestore.FieldValue.increment(-qty) };
    if (p.preOrderBatchStatus === 'ready' && (Number(p.preOrderSoldQty) || 0) - qty < Number(p.preOrderTargetQty)) {
      updates.preOrderBatchStatus = 'collecting';
      updates.preOrderReadyAt = null;
    }
    await pRef.update(updates);
  }
}

/** Today in Accra as YYYY-MM-DD — batch deadlines compare safely as strings. */
function accraToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Accra', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

/** Refund one escrow-held order to the buyer's wallet — the batch-missed path. */
async function refundPreorderOrder(orderId, product, target, sold) {
  const orderRef = db.collection('orders').doc(orderId);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const reason = 'Pre-order batch missed its target — ' + sold + ' of ' + target +
                 ' pieces. Full auto-refund, nothing for you to do.';
  const result = await db.runTransaction(async (tx) => {
    const oDoc = await tx.get(orderRef);
    if (!oDoc.exists) return null;
    const o = oDoc.data();
    if (o.escrowReleased === true || o.escrowStatus !== 'held') return null;  // already settled
    const total = requireOrderAmount(o);
    const buyerId = o.buyerId || o.userId;
    if (!buyerId) return null;
    const buyerWallet = await readWallet(tx, buyerId);      // read first…
    const balance = applyCredit(tx, buyerWallet, buyerId, total, {
      type: 'refund',
      orderId: orderId,
      productTitle: o.productTitle || o.title || 'Item',
      description: 'Auto-refund: pre-order batch missed its target (' + sold + '/' + target + ')',
      escrowStatus: 'refunded'
    }, now);
    tx.update(orderRef, {
      status: 'refunded',
      escrowStatus: 'refunded',
      escrowReleased: true,
      escrowReleasedAt: now,
      escrowReleasedBy: 'system',
      refundAmount: total,
      refundReason: reason,
      refundedAt: now,
      refundedBy: 'system',
      updatedAt: now
    });
    return { total, buyerId, balance, title: o.productTitle || o.title || 'Item' };
  });
  if (!result) return false;
  try {
    await db.collection('notifications').add({
      userId: result.buyerId, type: 'refund_issued', title: 'Pre-order refunded',
      message: 'The pre-order for "' + result.title + '" missed its batch target (' + sold + ' of ' + target +
               ' pieces), so GHS ' + Number(result.total).toFixed(2) +
               ' has been refunded to your Sankofa Wallet automatically. You did nothing wrong — the batch simply did not fill.',
      orderId: orderId, isRead: false, createdAt: now
    });
  } catch (e) { console.error('batch refund notification failed', e && e.message); }
  try {
    const o = (await orderRef.get()).data() || {};
    const buyerEmail = await emailForUser(result.buyerId);
    await sendEmail('refund_issued', buyerEmail || o.buyerEmail, {
      name: o.buyerName, orderId: orderId, amount: result.total, title: result.title, reason: reason
    });
  } catch (e) { console.error('batch refund email failed', e && e.message); }
  return true;
}

/**
 * MOQ-B honesty, hourly: close pre-order batches whose deadline has passed.
 * Target met → 'ready' (payment-time ticking usually gets there first; this is the
 * belt-and-suspenders). Target missed → every waiting buyer is refunded to their
 * Sankofa Wallet automatically and the listing goes inactive.
 */
exports.preorderBatchSweep = functions.pubsub.schedule('every 1 hours').onRun(async () => {
  const today = accraToday();
  const snap = await db.collection('products').where('preOrderBatchStatus', '==', 'collecting').get();
  const expired = snap.docs.filter(d => d.data().preOrderDeadline && String(d.data().preOrderDeadline) < today);
  let failedBatches = 0, refundedOrders = 0, confirmedBatches = 0;
  for (const pDoc of expired) {
    const p = pDoc.data();
    const productId = pDoc.id;
    const target = Number(p.preOrderTargetQty || 0);
    const sold = Number(p.preOrderSoldQty || 0);
    if (target >= 2 && sold >= target) {
      await pDoc.ref.update({ preOrderBatchStatus: 'ready', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      confirmedBatches++;
      continue;
    }
    // ---- missed target: refund every still-held order containing this item ----
    failedBatches++;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const heldOrders = await db.collection('orders').where('escrowStatus', '==', 'held').get();
    for (const oDoc of heldOrders.docs) {
      const o = oDoc.data();
      if (o.isMultiSeller === true) continue;                    // children hold the slices
      const byProduct = moqItemsByProduct(o);
      if (!byProduct.has(productId)) continue;
      const done = await refundPreorderOrder(oDoc.id, p, target, sold);
      if (done) {
        refundedOrders++;
        // counter honesty — refunded pieces leave the batch tally
        await pDoc.ref.update({ preOrderSoldQty: admin.firestore.FieldValue.increment(-byProduct.get(productId)) });
      }
    }
    await pDoc.ref.update({
      preOrderBatchStatus: 'failed',
      preOrderFailedAt: now,
      preOrderFailReason: 'Batch closed at ' + sold + ' of ' + target + ' pieces — all buyers auto-refunded',
      isActive: false,
      updatedAt: now
    });
    console.log(`🧺 batch FAILED for product ${productId} (${sold}/${target}) — buyers refunded`);
  }
  console.log(`🧺 pre-order sweep: ${expired.length} expired, ${confirmedBatches} confirmed, ${failedBatches} failed, ${refundedOrders} orders auto-refunded`);
  return { expired: expired.length, confirmedBatches, failedBatches, refundedOrders };
});

exports.verifyPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  const reference = (data || {}).reference;
  const orderId = (data || {}).orderId || null;
  if (!reference) throw new functions.https.HttpsError('invalid-argument', 'reference required');

  const payData = await paystackVerifyReference(reference);
  const status = String(payData.status || '').toLowerCase();
  if (orderId && status === 'success') {
    const res = await applyVerifiedOrderPayment({ orderId, reference, callerUid: context.auth.uid, payData });
    if (!res.alreadyCredited) {
      try { await tickPreorderCounters(orderId); } catch (e) { console.error('preorder tick failed', e && e.message); }
    }
    return {
      success: true, status, amount: payData.amount, reference: payData.reference,
      orderMarkedPaid: !res.alreadyCredited, alreadyCredited: !!res.alreadyCredited
    };
  }
  return {
    success: status === 'success', message: 'Payment verified',
    status, gateway_response: payData.gateway_response,
    amount: payData.amount, reference: payData.reference
  };
});

// ============================================================================
// ESCROW
// ============================================================================

// ============================================================================
// SELLER MONEY PERKS — one honest source for commission % and escrow speed
// ============================================================================
// The plans page has always advertised discounted fees for paid tiers, but until
// perk #7 only auction orders actually honoured them — every regular escrow payout
// silently fell back to the full 5%. All money flows (release, auto-release,
// auction finalisation, dispute splits, emails) now read the seller's tier from
// THESE helpers, computed from their live premium document at the moment money moves.
//
// Diamond money perks: 0% commission (keep every cedi) + escrow released after
// 24 hours delivered instead of 48. Founding sellers (🏆) also earn at 0%.
const FREE_COMMISSION_RATE = 5;
const FREE_ESCROW_HOURS = 48;
const DIAMOND_ESCROW_HOURS = 24;

function premiumTierOf(u) {
  if (!u || u.isPremium !== true) return null;
  const tier = String(u.premiumTier || u.sellerTier || '').toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(PREMIUM_COMMISSION, tier)) return null;
  const exp = u.premiumExpiry && u.premiumExpiry.toDate ? u.premiumExpiry.toDate()
            : (u.premiumExpiry ? new Date(u.premiumExpiry) : null);
  if (!exp || exp.getTime() <= Date.now()) return null;   // perks end the moment the plan does
  return tier;
}

function moneyPerksFromUserDoc(u) {
  const tier = premiumTierOf(u);
  const founding = !!(u && u.isFoundingSeller === true);
  return {
    tier: tier,
    founding: founding,
    commissionRate: founding ? 0 : (tier ? PREMIUM_COMMISSION[tier] : FREE_COMMISSION_RATE),
    escrowHours: tier === 'diamond' ? DIAMOND_ESCROW_HOURS : FREE_ESCROW_HOURS
  };
}

// An admin-set auction commission is copied onto the auction at creation, and
// Firestore rules ensure sellers cannot choose or change it. Existing auctions
// without this field keep using the seller's legacy plan rate.
function auctionCommissionSnapshotRate(auction) {
  const raw = auction && auction.auctionCommissionPercent;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 100) return null;
  return round2(raw);
}

// Read a seller's perks once and cache them — a single payout run can touch many
// of the same seller's orders, and multi-seller orders mix different sellers.
async function fetchMoneyPerks(cache, sellerId) {
  if (!sellerId) return moneyPerksFromUserDoc(null);
  if (cache && cache.has(sellerId)) return cache.get(sellerId);
  let perks = moneyPerksFromUserDoc(null);
  try {
    const uDoc = await db.collection('users').doc(sellerId).get();
    if (uDoc.exists) perks = moneyPerksFromUserDoc(uDoc.data());
  } catch (e) { console.error('money-perks lookup failed for', sellerId, e && e.message); }
  if (cache) cache.set(sellerId, perks);
  return perks;
}

/** Best-effort payout estimate for "you made a sale" emails — the REAL split is
 *  computed at escrow release; this just stops emails from quoting a stale flat 5%. */
async function estimateSellerSplit(amount, sellerId) {
  const pk = await fetchMoneyPerks(new Map(), sellerId);
  return { payout: round2(amount - round2(amount * pk.commissionRate / 100)), commission: pk.commissionRate };
}

/**
 * THE ONLY PLACE SELLER MONEY IS CREATED.
 * Used by the buyer's "Confirm delivery" button, by admins, and by the hourly auto-release.
 * Authorisation, idempotency and the payout amount are all checked here.
 */
async function releaseEscrowCore(orderId, opts) {
  const actorUid = (opts && opts.actorUid) || null;
  const isAdmin = !!(opts && opts.isAdmin);
  const auto = !!(opts && opts.auto);
  const deliveryCode = (opts && opts.deliveryCode) ? String(opts.deliveryCode).trim() : null;
  const orderRef = db.collection('orders').doc(orderId);

  // Read the order (and any per-seller child orders) up front so every seller's
  // money perks are known BEFORE the transaction starts — a transaction forbids
  // reads after its first write, and each seller in a mixed order owns their own
  // commission rate.
  const preOrder = await orderRef.get();
  if (!preOrder.exists) throw new functions.https.HttpsError('not-found', 'Order not found');
  const perksBySeller = new Map();
  const preData = preOrder.data() || {};
  await fetchMoneyPerks(perksBySeller, preData.sellerId);
  let auctionFeeSnapshotRate = null;
  if (preData.isAuctionOrder === true && preData.auctionId) {
    // Read the trusted auction doc, not the order fields the browser may have created.
    const auctionDoc = await db.collection('auctions').doc(preData.auctionId).get();
    if (auctionDoc.exists) auctionFeeSnapshotRate = auctionCommissionSnapshotRate(auctionDoc.data());
  }
  if (Array.isArray(preData.childOrderIds)) {
    for (const cid of preData.childOrderIds) {
      try {
        const cDoc = await db.collection('orders').doc(cid).get();
        if (cDoc.exists) await fetchMoneyPerks(perksBySeller, cDoc.data().sellerId);
      } catch (e) { /* a child whose seller can't be looked up falls back to the standard rate */ }
    }
  }

  return await db.runTransaction(async (tx) => {
    const orderDoc = await tx.get(orderRef);
    if (!orderDoc.exists) throw new functions.https.HttpsError('not-found', 'Order not found');
    const order = orderDoc.data();

    // ---- Who may release? ----
    // The buyer (they are the one holding the money), Sankofa support, or the scheduler.
    // A SELLER MAY NOT. Releasing your own escrow is exactly the scam escrow exists to stop.
    const isBuyer = actorUid && (order.buyerId === actorUid || order.userId === actorUid);
    if (!auto && !isBuyer && !isAdmin) {
      throw new functions.https.HttpsError('permission-denied',
        'Only the buyer or Sankofa support can release this payment. Sellers cannot release their own escrow — that is what protects buyers.');
    }

    // ---- Delivery confirmation code (buyer self-confirm requires valid code if present) ----
    if (!auto && isBuyer && !isAdmin && order.deliveryConfirmationCode) {
      if (!deliveryCode || deliveryCode !== String(order.deliveryConfirmationCode).trim()) {
        throw new functions.https.HttpsError('failed-precondition', 'Invalid delivery confirmation code. Please enter the code sent to your email/notifications.');
      }
    }

    // ---- Idempotency: a second call is a no-op, never a second payout ----
    if (order.escrowReleased === true || order.escrowStatus === 'released') {
      return { alreadyReleased: true, payout: round2(order.sellerPayout || 0), sellerId: order.sellerId || null };
    }

    // ---- There must be a SERVER-recorded payment. The browser cannot write these fields. ----
    const serverPaid = order.walletPaid === true || order.paidViaServer === true || order.escrowHeldByServer === true;
    if (!serverPaid) {
      throw new functions.https.HttpsError('failed-precondition',
        'No verified payment is being held for this order, so nothing was released.');
    }
    // A dispute freezes the money… unless an admin is resolving that very dispute
    // (opts.adminResolve), which is the decision that ends the freeze.
    const adminResolve = !!(opts && opts.adminResolve);
    if (!adminResolve && (String(order.status) === 'disputed' || String(order.disputeStatus) === 'open')) {
      throw new functions.https.HttpsError('failed-precondition', 'This order is in dispute — escrow stays frozen until Sankofa support decides.');
    }

    // ---- Multi-seller orders: pay every seller their own slice ----
    const childIds = Array.isArray(order.childOrderIds) ? order.childOrderIds : null;
    if (childIds && childIds.length) {
      // ⚠️ read EVERYTHING first (children + all their wallets) — Firestore forbids reads
      // after the first write in a transaction
      const kids = [];
      for (const cid of childIds) {
        const cref = db.collection('orders').doc(cid);
        const cdoc = await tx.get(cref);
        if (!cdoc.exists) continue;
        const c = cdoc.data();
        if (c.escrowReleased === true || c.escrowStatus === 'released') { kids.push({ ref: cref, data: c, done: true }); continue; }
        const cw = c.sellerId ? await readWallet(tx, c.sellerId) : null;
        kids.push({ ref: cref, data: c, wallet: cw, done: false });
      }
      const now = admin.firestore.FieldValue.serverTimestamp();
      let paidOut = 0;
      const perSeller = [];
      for (const k of kids) {
        if (k.done || !k.data.sellerId || !k.wallet) continue;
        // Each seller's slice is re-computed from THEIR live tier right here — the
        // numbers the browser may have stamped at checkout are never trusted.
        const sliceTotal = round2(k.data.total || k.data.amount || 0);
        const pk = perksBySeller.get(k.data.sellerId) || moneyPerksFromUserDoc(null);
        const sliceCommission = round2(sliceTotal * pk.commissionRate / 100);
        const slicePayout = round2(sliceTotal - sliceCommission);
        if (!(sliceTotal > 0)) continue;
        applyCredit(tx, k.wallet, k.data.sellerId, slicePayout, {
          type: 'sale', orderId: k.ref.id, productTitle: k.data.productTitle || 'Item',
          description: 'Sale payout for order #' + String(k.ref.id).substring(0, 8).toUpperCase() +
                       ' (share of a multi-seller order' +
                       (pk.commissionRate === 0 ? ', ' + (pk.tier === 'diamond' ? '◆ Diamond 0% fee' : '🏆 Founding 0% fee')
                                                : ', ' + pk.commissionRate + '% fee') + ')'
        }, now);
        tx.update(k.ref, {
          status: 'completed', escrowStatus: 'released', escrowReleased: true,
          escrowReleasedAt: now, escrowReleasedBy: auto ? 'system' : actorUid,
          commission: pk.commissionRate, commissionAmount: sliceCommission, sellerPayout: slicePayout,
          updatedAt: now
        });
        paidOut = round2(paidOut + slicePayout);
        perSeller.push({ sellerId: k.data.sellerId, payout: slicePayout, orderId: k.ref.id, rate: pk.commissionRate });
      }
      tx.update(orderRef, {
        status: 'completed', escrowStatus: 'released', escrowReleased: true,
        escrowReleasedAt: now, escrowReleasedBy: auto ? 'system' : actorUid,
        sellerPayout: paidOut, multiSellerPaid: perSeller, updatedAt: now
      });
      return { payout: paidOut, sellerId: null, perSeller, multi: true };
    }

    const sellerId = order.sellerId;
    if (!sellerId) throw new functions.https.HttpsError('failed-precondition', 'This order has no seller on record.');
    if (sellerId === order.buyerId || sellerId === order.userId) {
      throw new functions.https.HttpsError('failed-precondition', 'This order is not a valid sale.');
    }

    const total = round2(order.total || order.amount || 0);
    if (!(total > 0)) {
      throw new functions.https.HttpsError('failed-precondition',
        'The amount on this order looks wrong (GHS ' + total + '), so nothing was released. Please contact support.');
    }
    // Auction orders use the admin-approved percentage frozen on their auction doc.
    // Other orders keep the existing live-tier commission rule.
    const pk = perksBySeller.get(sellerId) || moneyPerksFromUserDoc(null);
    const commissionRate = auctionFeeSnapshotRate !== null ? auctionFeeSnapshotRate : pk.commissionRate;
    const commission = round2(total * commissionRate / 100);
    const payout = round2(total - commission);

    // ---- Credit the seller wallet (read first, then write — one wallet per transaction) ----
    const walletRef = db.collection('wallets').doc(sellerId);
    const walletDoc = await tx.get(walletRef);
    const wallet = walletDoc.exists ? walletDoc.data() : { balance: 0, totalEarnings: 0 };
    const newBalance = round2(Number(wallet.balance || 0) + payout);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (walletDoc.exists) {
      tx.update(walletRef, {
        balance: newBalance,
        totalEarnings: round2(Number(wallet.totalEarnings || 0) + payout),
        updatedAt: now
      });
    } else {
      tx.set(walletRef, {
        userId: sellerId, balance: newBalance, currency: 'GHS',
        totalTopups: 0, totalSpent: 0, totalEarnings: payout,
        createdAt: now, updatedAt: now
      });
    }

    tx.set(db.collection('walletTransactions').doc(), {
      userId: sellerId,
      type: 'sale',
      amount: payout,
      balanceAfter: newBalance,
      orderId: orderId,
      productTitle: order.productTitle || order.title || 'Item',
      description: 'Sale payout for order #' + String(orderId).substring(0, 8).toUpperCase() +
                   (commissionRate === 0
                     ? ' (GHS ' + total + ' — 0% commission; seller keeps everything)'
                     : ' (GHS ' + total + ' - fee GHS ' + commission + ' at ' + commissionRate + '%)'),
      status: 'completed',
      escrowStatus: 'released',
      autoReleased: auto,
      createdAt: now
    });

    tx.update(orderRef, {
      status: 'completed',
      escrowStatus: 'released',
      escrowReleased: true,
      escrowReleasedAt: now,
      escrowReleasedBy: auto ? 'system' : actorUid,
      sellerPayout: payout,
      commissionAmount: commission,
      commission: commissionRate,
      autoReleased: auto || order.autoReleased === true,
      updatedAt: now
    });

    return { payout, newBalance, sellerId, rate: commissionRate, tier: pk.tier };
  });
}

/** Buyer's "Confirm delivery" button (and admin override). */
exports.releaseEscrowToWallet = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const orderId = (data || {}).orderId;
  const deliveryCode = (data || {}).deliveryCode || (data || {}).code || null;
  if (!orderId) throw new functions.https.HttpsError('invalid-argument', 'orderId required');

  let isAdmin = false;
  try {
    const u = await db.collection('users').doc(context.auth.uid).get();
    isAdmin = u.exists && u.data().role === 'admin';
  } catch (e) { /* treat as non-admin */ }

  const r = await releaseEscrowCore(orderId, { actorUid: context.auth.uid, isAdmin, deliveryCode });
  console.log(r.multi
    ? `✅ Escrow released: multi-seller order ${orderId} → ${(r.perSeller || []).length} sellers, GHS ${r.payout} in total`
    : `✅ Escrow released: order ${orderId} → seller ${r.sellerId} GHS ${r.payout}${r.rate === 0 ? ' at 0% fee — kept everything' : ''}${r.alreadyReleased ? ' (already released, no second payout)' : ''}`);

  // tell the seller their payout landed (only on the first release)
  if (!r.alreadyReleased) {
    try {
      const order = (await db.collection('orders').doc(orderId).get()).data() || {};
      const sellerEmail = order.sellerEmail || await emailForUser(r.sellerId);
      await sendEmail('sale_received', sellerEmail, {
        name: order.sellerName, orderId: orderId, amount: order.total || order.amount,
        title: order.productTitle || order.title, payout: r.payout,
        commission: order.commission != null ? order.commission : FREE_COMMISSION_RATE, auto: false
      });
    } catch (e) { console.error('sale email failed', e && e.message); }
  }
  return {
    success: true,
    alreadyReleased: !!r.alreadyReleased,
    payout: r.payout,
    rate: r.rate != null ? r.rate : null,
    tier: r.tier || null,
    message: r.alreadyReleased
      ? 'This payment had already been released — nobody was paid twice.'
      : 'Escrow released to the seller\'s wallet.'
  };
});

/** Legacy alias — older pages called "releaseEscrow". Same guarded code path. */
exports.releaseEscrow = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const orderId = (data || {}).orderId;
  if (!orderId) throw new functions.https.HttpsError('invalid-argument', 'orderId required');

  let isAdmin = false;
  try {
    const u = await db.collection('users').doc(context.auth.uid).get();
    isAdmin = u.exists && u.data().role === 'admin';
  } catch (e) {}

  const r = await releaseEscrowCore(orderId, { actorUid: context.auth.uid, isAdmin });
  return {
    success: true,
    alreadyReleased: !!r.alreadyReleased,
    payout: r.payout,
    message: 'Escrow released successfully'
  };
});

/**
 * Auto-release after 48h — runs hourly.
 * It now ACTUALLY PAYS THE SELLER. (The old version marked the order "completed", told the
 * seller "Payment released" and never credited the wallet — the money simply vanished.)
 */
/**
 * The escrow sweep, shared by the hourly scheduler and the admin "release due payouts"
 * button. Every order gets its OWN hold window from the seller's live tier:
 * Diamond sellers are paid 24 hours after delivery instead of 48 (#7 money perk).
 *
 * ⚠️ The clock runs from DELIVERY, not from payment. Counting from payment meant a
 * seller who never shipped still got paid later — the opposite of what the receipt
 * page promises. An order that is paid but never delivered stays in escrow until the
 * buyer confirms or Sankofa support resolves it.
 */
async function releaseDueEscrowNow(maxScan, maxRelease) {
  const scanScan = maxScan || 100, releaseCap = maxRelease || 20;
  const nowMs = Date.now();
  const perksBySeller = new Map();
  // Single-field query so no composite index is required.
  const snap = await db.collection('orders').where('escrowStatus', '==', 'held').limit(scanScan).get();

  const released = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    try {
      if (d.escrowReleased === true) continue;
      if (String(d.status) === 'disputed' || String(d.disputeStatus) === 'open') continue;

      let due = false;
      let windowHours = FREE_ESCROW_HOURS;
      if (Array.isArray(d.childOrderIds) && d.childOrderIds.length) {
        // a multi-seller parent has no deliveredAt of its own: it is due when EVERY
        // child's slice is older than THAT child's own escrow window
        let allDue = true;
        windowHours = null;
        for (const cid of d.childOrderIds) {
          const c = await db.collection('orders').doc(cid).get();
          if (!c.exists) { allDue = false; break; }
          const cd = c.data();
          if (cd.escrowReleased === true || cd.escrowStatus === 'released') continue;
          const pk = await fetchMoneyPerks(perksBySeller, cd.sellerId);
          const w = cd.deliveredAt || cd.deliveryConfirmedAt;
          const at = w && (w.toDate ? w.toDate() : new Date(w));
          if (!at || at.getTime() > nowMs - pk.escrowHours * 3600e3) { allDue = false; break; }
        }
        due = allDue;
      } else {
        const pk = await fetchMoneyPerks(perksBySeller, d.sellerId);
        windowHours = pk.escrowHours;
        const when = d.deliveredAt || d.deliveryConfirmedAt;
        const deliveredAt = when && (when.toDate ? when.toDate() : new Date(when));
        due = !!(deliveredAt && deliveredAt.getTime() <= nowMs - windowHours * 3600e3);
      }
      if (!due) continue;

      const r = await releaseEscrowCore(doc.id, { auto: true });
      try {
        const now = admin.firestore.FieldValue.serverTimestamp();
        const hoursText = windowHours ? ' after the ' + windowHours + 'h protection window' : '';
        const sellerPerks = r.sellerId ? (perksBySeller.get(r.sellerId) || moneyPerksFromUserDoc(null)) : moneyPerksFromUserDoc(null);
        await db.collection('notifications').add({
          userId: d.buyerId || d.userId, type: 'escrow_released', title: 'Order completed',
          message: `Your order for ${d.productTitle || d.title || 'item'} was auto-completed${hoursText}. GHS ${r.payout} released to the seller.`,
          orderId: doc.id, createdAt: now, isRead: false
        });
        if (r.sellerId) {
          await db.collection('notifications').add({
            userId: r.sellerId, type: 'escrow_released', title: 'Payment released',
            message: `GHS ${r.payout} for ${d.productTitle || d.title || 'item'} was added to your Sankofa Wallet (auto${hoursText}${sellerPerks.escrowHours === DIAMOND_ESCROW_HOURS ? ' — faster ◆ Diamond payout' : ''}${r.rate === 0 ? ', 0% fee' : ''}).`,
            orderId: doc.id, createdAt: now, isRead: false
          });
        }
      } catch (e) { /* notifications are best-effort */ }
      released.push({ orderId: doc.id, payout: r.payout, sellerId: r.sellerId || null, hours: windowHours });
      if (released.length >= releaseCap) break;
    } catch (e) {
      console.error('escrow sweep: order ' + doc.id + ' skipped —', e && e.message);
    }
  }
  return { scanned: snap.size, released: released };
}

exports.autoReleaseEscrow = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  try {
    const r = await releaseDueEscrowNow(100, 20);
    console.log(`autoReleaseEscrow: scanned ${r.scanned} held orders, released ${r.released.length}`);
  } catch (e) {
    console.error('autoReleaseEscrow error', e);
  }
  return null;
});

/**
 * Admin/support: run the exact same due-escrow sweep on demand — e.g. to push a due
 * payout now without waiting for the hourly run. Same rules, same core, same caps.
 */
exports.releaseDueEscrow = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  if (!(await adminCaller(context))) {
    throw new functions.https.HttpsError('permission-denied', 'Only Sankofa support can run the escrow sweep.');
  }
  const r = await releaseDueEscrowNow(100, 50);
  console.log(`releaseDueEscrow (manual): scanned ${r.scanned}, released ${r.released.length}`);
  return { success: true, scanned: r.scanned, releasedCount: r.released.length, released: r.released };
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
// SANKOFA WALLET — Closed-loop 0% internal transfers (Paystack only for top-up)
// ============================================================================


// ============================================================================
// PREMIUM SELLER UPGRADES
// ============================================================================
//
// The "Become a seller" page used to activate a paid tier **from the browser**, straight
// after the Paystack popup closed — with no verification of the charge, and a "demo mode"
// button that granted the tier for free. Section 1A's rules now (correctly) block clients
// from writing premium fields, which turned that into "money taken, no upgrade".
// This function is the only thing allowed to grant a tier.

const PREMIUM_PRICES = {
  bronze:  { 1: 45,  3: 120, 6: 220 },
  silver:  { 1: 79,  3: 210, 6: 390 },
  gold:    { 1: 129, 3: 350, 6: 650 },
  diamond: { 1: 199, 3: 540, 6: 990 }
};
const PREMIUM_BOOST = { bronze: 2, silver: 4, gold: 6, diamond: 10 };
// Diamond money perk (#7): 0% commission — a Diamond seller keeps every cedi of the
// sale price. Bronze/Silver/Gold stay discounted but non-zero.
const PREMIUM_COMMISSION = { bronze: 2, silver: 1.5, gold: 1.2, diamond: 0 };

/**
 * Activate a premium tier after a real Paystack payment.
 * Body: { tier, months, reference }
 * • the reference is verified with Paystack and can only ever be used once (paystackRefs)
 * • the amount charged must match the published price for that tier/length
 * • the seller's own listings are boosted at the same time
 */
exports.activatePremium = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in first.');
  const tier = String((data || {}).tier || '').toLowerCase();
  const months = Number((data || {}).months || 1);
  const reference = (data || {}).reference;
  if (!PREMIUM_PRICES[tier]) throw new functions.https.HttpsError('invalid-argument', 'Unknown plan: ' + tier);
  if (![1, 3, 6].includes(months)) throw new functions.https.HttpsError('invalid-argument', 'Plan length must be 1, 3 or 6 months.');
  if (!reference) throw new functions.https.HttpsError('invalid-argument', 'A payment reference is required.');

  const price = PREMIUM_PRICES[tier][months];
  const payData = await paystackVerifyReference(reference);
  const status = String(payData.status || '').toLowerCase();

  // The payment must belong to the account asking for the upgrade. Paystack stores the
  // metadata we sent when the charge was created, and the browser cannot forge it.
  // (Without this, ANY signed-in user could take someone else's reference and upgrade
  // their own account with it — found by the live test before it shipped.)
  const md = paystackMetadata(payData);
  const uid6 = context.auth.uid.slice(0, 6).toUpperCase();
  const refLooksMine = typeof reference === 'string' && reference.toUpperCase().indexOf('SANKOFA-') === 0
                    && reference.toUpperCase().indexOf('-' + uid6 + '-') !== -1;
  if (md.userId && md.userId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'That payment was made from a different account.');
  }
  if (!md.userId && !refLooksMine) {
    throw new functions.https.HttpsError('permission-denied',
      'We could not match that payment to your account. Please start the upgrade again from this page — you have not been charged twice.');
  }
  if (status !== 'success') {
    throw new functions.https.HttpsError('failed-precondition', 'That payment was not successful (Paystack says "' + status + '"). Nothing was activated.');
  }
  const currency = String(payData.currency || 'GHS').toUpperCase();
  if (currency !== 'GHS') throw new functions.https.HttpsError('failed-precondition', 'Only GHS payments are accepted.');
  const paid = round2(Number(payData.amount || 0) / 100);
  if (pesewas(paid) !== pesewas(price)) {
    throw new functions.https.HttpsError('failed-precondition',
      'This plan costs GHS ' + price + ' but the payment was GHS ' + paid.toFixed(2) +
      '. Nothing was activated — email sankofamarketgh@gmail.com with reference ' + reference + '.');
  }

  const uid = context.auth.uid;
  const refRef = db.collection('paystackRefs').doc(reference);
  const userRef = db.collection('users').doc(uid);

  const out = await db.runTransaction(async (tx) => {
    const refDoc = await tx.get(refRef);
    const userDoc = await tx.get(userRef);
    if (refDoc.exists) {
      const used = refDoc.data() || {};
      if (used.kind === 'premium' && used.userId === uid && used.tier === tier && Number(used.months) === months) {
        return { already: true, expiry: used.expiryMs || null };
      }
      throw new functions.https.HttpsError('failed-precondition', 'That payment has already been used.');
    }
    if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'Your profile was not found. Please contact support.');

    const now = Date.now();
    const current = userDoc.data() || {};
    let base = now;
    if (current.premiumExpiry) {
      const cur = current.premiumExpiry.toDate ? current.premiumExpiry.toDate().getTime() : new Date(current.premiumExpiry).getTime();
      if (isFinite(cur) && cur > now) base = cur;              // extend an existing plan
    }
    const expiry = new Date(base + months * 30 * 24 * 60 * 60 * 1000);
    const nowTs = admin.firestore.FieldValue.serverTimestamp();

    tx.set(refRef, { reference, kind: 'premium', userId: uid, tier, months, amount: paid, expiryMs: expiry.getTime(), createdAt: nowTs });

    tx.set(userRef, {
      isPremium: true,
      sellerTier: tier, premiumTier: tier,
      premiumDuration: months, premiumPrice: price,
      isBoosted: true, boostLevel: PREMIUM_BOOST[tier],
      commissionRate: PREMIUM_COMMISSION[tier],
      premiumSince: nowTs,
      premiumExpiry: admin.firestore.Timestamp.fromDate(expiry),
      premiumReference: reference, premiumAmount: paid, premiumStatus: 'active',
      premiumActivatedBy: 'server',
      updatedAt: nowTs
    }, { merge: true });

    tx.set(db.collection('premiumTransactions').doc(), {
      userId: uid, email: (context.auth.token && context.auth.token.email) || null,
      tier, durationMonths: months, boost: PREMIUM_BOOST[tier],
      reference, amountGHS: paid, createdAt: nowTs,
      expiry: admin.firestore.Timestamp.fromDate(expiry)
    });

    return { expiryMs: expiry.getTime(), expiry: expiry.toISOString(), tier, months, price };
  });

  // boost the seller's existing listings (outside the transaction — could be many)
  let boosted = 0;
  try {
    const snap = await db.collection('products').where('sellerId', '==', uid).get();
    if (!snap.empty) {
      const nowTs = admin.firestore.FieldValue.serverTimestamp();
      let batch = db.batch(), n = 0;
      snap.forEach(doc => {
        batch.update(doc.ref, {
          isBoosted: true,
          isFeatured: (tier === 'gold' || tier === 'diamond'),
          boostLevel: PREMIUM_BOOST[tier],
          boostedAt: nowTs
        });
        n++; boosted++;
        if (n % 400 === 0) { batch.commit(); batch = db.batch(); }
      });
      await batch.commit();
    }
  } catch (e) {
    console.error('activatePremium: could not boost listings', e && e.message);
  }

  console.log(`✅ Premium ${tier} (${months}m) activated for ${uid} via ${reference} — boosted ${boosted} listings`);
  return {
    success: true,
    alreadyActive: !!out.already,
    tier, months, price: paid,
    boost: PREMIUM_BOOST[tier],
    commission: PREMIUM_COMMISSION[tier],
    expiry: out.expiry,
    boostedListings: boosted,
    message: out.already ? 'This plan was already activated.' : 'Your plan is active — listings boosted.'
  };
});

// ============================================================================
// DISPUTE RESOLUTION + REFUNDS
// ============================================================================
//
// Before this existed, the admin panel's "resolve dispute" buttons called
// releaseEscrow() and refundEscrow() — functions that were never written. So a
// dispute froze the money and then nothing could ever move it: no refunds at all.
//
// resolveDispute is the single, transactional place that ends a dispute:
//   refund_buyer   → the buyer's wallet is credited with everything they paid
//   release_seller → the seller is paid as normal (total - commission)
//   split          → half back to the buyer, half to the seller (commission on the
//                    seller's half only, so the books always balance to the penny)

/** Is the caller an admin? Custom claim first (no reads), then the profile. */
async function adminCaller(context) {
  if (!context.auth) return false;
  if (context.auth.token && context.auth.token.admin === true) return true;
  try {
    const u = await db.collection('users').doc(context.auth.uid).get();
    return u.exists && (u.data().role === 'admin');
  } catch (e) { return false; }
}

function requireOrderAmount(order) {
  const total = round2(order.total || order.amount || order.bidAmount || 0);
  if (!(total > 0)) throw new functions.https.HttpsError('failed-precondition', 'This order has no amount on record.');
  return total;
}

/** Everything that must be true before any money leaves escrow. */
function assertEscrowHeld(order) {
  if (order.escrowReleased === true || order.escrowStatus === 'released' || order.escrowStatus === 'refunded') {
    throw new functions.https.HttpsError('failed-precondition', 'The money for this order has already been settled.');
  }
  const serverPaid = order.walletPaid === true || order.paidViaServer === true || order.escrowHeldByServer === true;
  if (!serverPaid) {
    throw new functions.https.HttpsError('failed-precondition', 'No verified payment is being held for this order.');
  }
}

/**
 * ⚠️ Firestore requires EVERY read in a transaction to happen before the first write.
 * creditWallet is therefore split in two: readWallet() must be called with the other reads,
 * applyCredit() afterwards. Doing the read inside the write phase threw
 * "transactions require all reads to be executed before all writes" — which is exactly why
 * the 50/50 split (the one case that touches two wallets) failed.
 */
async function readWallet(tx, userId) {
  const ref = db.collection('wallets').doc(userId);
  const doc = await tx.get(ref);
  return { ref: ref, exists: doc.exists, data: doc.exists ? doc.data() : { balance: 0 } };
}

function applyCredit(tx, wallet, userId, amount, txData, now) {
  const w = wallet.data || { balance: 0 };
  const newBalance = round2(Number(w.balance || 0) + amount);
  if (wallet.exists) {
    const patch = { balance: newBalance, updatedAt: now };
    if (txData.type === 'sale') patch.totalEarnings = round2(Number(w.totalEarnings || 0) + amount);
    if (txData.type === 'refund') patch.totalRefunded = round2(Number(w.totalRefunded || 0) + amount);
    tx.update(wallet.ref, patch);
  } else {
    tx.set(wallet.ref, {
      userId: userId, balance: newBalance, currency: 'GHS',
      totalTopups: 0, totalSpent: 0,
      totalEarnings: txData.type === 'sale' ? amount : 0,
      totalRefunded: txData.type === 'refund' ? amount : 0,
      createdAt: now, updatedAt: now
    });
  }
  tx.set(db.collection('walletTransactions').doc(), Object.assign({
    userId: userId, amount: amount, balanceAfter: newBalance,
    status: 'completed', createdAt: now
  }, txData));
  return newBalance;
}

/**
 * Resolve a dispute. Admin only.
 * Body: { disputeId, resolution: 'refund_buyer' | 'release_seller' | 'split', note }
 */
exports.resolveDispute = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  if (!(await adminCaller(context))) {
    throw new functions.https.HttpsError('permission-denied', 'Only Sankofa support can resolve a dispute.');
  }
  const disputeId = (data || {}).disputeId;
  const resolution = String((data || {}).resolution || '').toLowerCase();
  const note = ((data || {}).note || '').toString().slice(0, 1000);
  if (!disputeId) throw new functions.https.HttpsError('invalid-argument', 'disputeId is required.');
  if (!['refund_buyer', 'release_seller', 'split'].includes(resolution)) {
    throw new functions.https.HttpsError('invalid-argument', 'resolution must be refund_buyer, release_seller or split.');
  }

  const disputeRef = db.collection('disputes').doc(disputeId);
  const disputeDoc = await disputeRef.get();
  if (!disputeDoc.exists) throw new functions.https.HttpsError('not-found', 'Dispute not found.');
  const dispute = disputeDoc.data();
  if (String(dispute.status) === 'resolved' && dispute.financialOutcome) {
    return { success: true, alreadyResolved: true, outcome: dispute.financialOutcome, message: 'This dispute was already resolved.' };
  }
  const orderId = dispute.orderId;
  if (!orderId) throw new functions.https.HttpsError('failed-precondition', 'This dispute is not linked to an order.');

  const orderRef = db.collection('orders').doc(orderId);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const nowDate = new Date();

  const result = await db.runTransaction(async (tx) => {
    const orderDoc = await tx.get(orderRef);
    if (!orderDoc.exists) throw new functions.https.HttpsError('not-found', 'The order for this dispute no longer exists.');
    const order = orderDoc.data();
    assertEscrowHeld(order);

    // --- all reads first (Firestore forbids reads after the first write) ---
    const buyerIdEarly = order.buyerId || order.userId;
    const sellerIdEarly = order.sellerId;
    const buyerWallet = buyerIdEarly ? await readWallet(tx, buyerIdEarly) : null;
    const sellerWallet = sellerIdEarly ? await readWallet(tx, sellerIdEarly) : null;
    const sellerUserDoc = sellerIdEarly ? await tx.get(db.collection('users').doc(sellerIdEarly)) : null;
    const auctionDoc = order.isAuctionOrder === true && order.auctionId
      ? await tx.get(db.collection('auctions').doc(order.auctionId)) : null;

    const total = requireOrderAmount(order);
    // A configured auction's immutable, admin-approved percentage outranks any value
    // the browser may have put on the order. Older auctions keep their existing fee path.
    const sellerPk = moneyPerksFromUserDoc(sellerUserDoc && sellerUserDoc.exists ? sellerUserDoc.data() : null);
    const auctionFeeSnapshot = auctionCommissionSnapshotRate(auctionDoc && auctionDoc.exists ? auctionDoc.data() : null);
    const commission = auctionFeeSnapshot !== null ? round2(total * auctionFeeSnapshot / 100)
                     : order.commissionAmount != null ? round2(order.commissionAmount)
                     : order.commission != null ? round2(order.commission)
                     : round2(total * sellerPk.commissionRate / 100);
    const rate = auctionFeeSnapshot !== null ? auctionFeeSnapshot / 100
               : commission > 0 && total > 0 ? commission / total
               : commission === 0 ? 0
               : sellerPk.commissionRate / 100;

    let refund = 0, sellerPayout = 0;
    if (resolution === 'refund_buyer') {
      refund = total;
      sellerPayout = 0;
    } else if (resolution === 'release_seller') {
      refund = 0;
      sellerPayout = auctionFeeSnapshot !== null
        ? round2(total - commission)
        : (order.sellerPayout != null ? round2(order.sellerPayout) : round2(total - commission));
    } else { // split
      sellerPayout = round2((total / 2) * (1 - rate));
      refund = round2(total - sellerPayout);       // the two halves always add back to total
    }

    let buyerBalance = null, sellerBalance = null;

    // --- then the writes ---
    if (refund > 0) {
      if (!buyerIdEarly || !buyerWallet) throw new functions.https.HttpsError('failed-precondition', 'This order has no buyer on record.');
      buyerBalance = applyCredit(tx, buyerWallet, buyerIdEarly, refund, {
        type: 'refund',
        orderId: orderId,
        disputeId: disputeId,
        productTitle: order.productTitle || order.title || 'Item',
        description: 'Refund for order #' + String(orderId).substring(0, 8).toUpperCase() +
                     (resolution === 'split' ? ' (dispute settled 50/50)' : ' (dispute resolved in your favour)'),
        escrowStatus: 'refunded'
      }, now);
    }
    if (sellerPayout > 0) {
      if (!sellerIdEarly || !sellerWallet) throw new functions.https.HttpsError('failed-precondition', 'This order has no seller on record.');
      sellerBalance = applyCredit(tx, sellerWallet, sellerIdEarly, sellerPayout, {
        type: 'sale',
        orderId: orderId,
        disputeId: disputeId,
        productTitle: order.productTitle || order.title || 'Item',
        description: 'Dispute payout for order #' + String(orderId).substring(0, 8).toUpperCase() +
                     ' (GHS ' + total + ' order, GHS ' + sellerPayout + ' awarded)'
      }, now);
    }

    const status = resolution === 'release_seller' ? 'completed' : (resolution === 'refund_buyer' ? 'refunded' : 'partially_refunded');
    tx.update(orderRef, {
      status: status,
      escrowStatus: resolution === 'release_seller' ? 'released' : 'refunded',
      escrowReleased: true,                       // settled — can never be paid twice
      escrowReleasedAt: now,
      escrowReleasedBy: context.auth.uid,
      disputeStatus: 'resolved',
      resolution: resolution,
      resolvedAt: now,
      resolutionNotes: note,
      sellerPayout: sellerPayout,
      refundAmount: refund > 0 ? refund : (order.refundAmount || 0),
      refundedAt: refund > 0 ? now : (order.refundedAt || null),
      updatedAt: now
    });

    tx.set(disputeRef, {
      status: 'resolved',
      resolution: resolution,
      financialOutcome: { refund: refund, sellerPayout: sellerPayout, total: total },
      resolutionNotes: note,
      resolvedAt: now,
      resolvedBy: context.auth.uid,
      sellerEvidence: dispute.sellerEvidence || []
    }, { merge: true });

    return { refund, sellerPayout, total, buyerId: buyerIdEarly, sellerId: sellerIdEarly, buyerBalance, sellerBalance, status };
  });

  // Tell both parties what happened (best effort — the money has already moved)
  const money = (n) => 'GHS ' + Number(n).toFixed(2);
  const emails = [];
  try {
    const notes = [];
    if (result.refund > 0) emails.push(sendEmail('refund_issued', await emailForUser(result.buyerId), {
      name: null, orderId: orderId, amount: result.refund, note: note,
      title: (dispute && dispute.productTitle) || null, reason: 'Dispute resolved by Sankofa support'
    }));
    if (result.refund > 0) notes.push({
      userId: result.buyerId, type: 'dispute_resolved', title: 'Dispute resolved — refund issued',
      message: 'Sankofa support reviewed the dispute for order #' + orderId.substring(0, 8).toUpperCase() +
               ' and has refunded ' + money(result.refund) + ' to your Sankofa Wallet.' +
               (note ? '\n\nSupport note: ' + note : ''),
      orderId: orderId, disputeId: disputeId, isRead: false, createdAt: now
    });
    if (result.sellerPayout > 0) emails.push(sendEmail('dispute_resolved_seller', await emailForUser(result.sellerId), {
      name: null, orderId: orderId, amount: result.sellerPayout, note: note
    }));
    if (result.sellerPayout > 0) notes.push({
      userId: result.sellerId, type: 'dispute_resolved', title: 'Dispute resolved — payment released',
      message: 'Sankofa support reviewed the dispute for order #' + orderId.substring(0, 8).toUpperCase() +
               ' and released ' + money(result.sellerPayout) + ' to your Sankofa Wallet.' +
               (note ? '\n\nSupport note: ' + note : ''),
      orderId: orderId, disputeId: disputeId, isRead: false, createdAt: now
    });
    for (const n of notes) await db.collection('notifications').add(n);
    await Promise.all(emails);
  } catch (e) { console.error('dispute notifications failed', e.message); }

  console.log(`✅ Dispute ${disputeId} resolved (${resolution}) — refund ${result.refund}, seller payout ${result.sellerPayout}`);
  // fully refunded pieces leave any pre-order batch tally (a 50/50 split still counts
  // as a sale — the buyer kept the item, so the batch keeps the piece)
  if (resolution === 'refund_buyer') {
    try { await untickPreorderCounters(orderId); } catch (e) { console.error('preorder untick failed', e && e.message); }
  }
  return {
    success: true, resolution: resolution,
    refund: result.refund, sellerPayout: result.sellerPayout, total: result.total,
    orderStatus: result.status, buyerBalance: result.buyerBalance, sellerBalance: result.sellerBalance,
    message: resolution === 'refund_buyer' ? 'Refunded ' + money(result.refund) + ' to the buyer.'
           : resolution === 'release_seller' ? 'Released ' + money(result.sellerPayout) + ' to the seller.'
           : 'Split: ' + money(result.refund) + ' back to the buyer, ' + money(result.sellerPayout) + ' to the seller.'
  };
});

/**
 * Refund an order straight to the buyer's wallet (admin only) — for the cases that never
 * need a formal dispute (item lost, seller never shipped, goodwill).
 * Body: { orderId, reason }
 */
exports.refundOrderToBuyer = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  if (!(await adminCaller(context))) {
    throw new functions.https.HttpsError('permission-denied', 'Only Sankofa support can issue a refund.');
  }
  const orderId = (data || {}).orderId;
  const reason = ((data || {}).reason || '').toString().slice(0, 500);
  if (!orderId) throw new functions.https.HttpsError('invalid-argument', 'orderId is required.');

  const orderRef = db.collection('orders').doc(orderId);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const result = await db.runTransaction(async (tx) => {
    const orderDoc = await tx.get(orderRef);
    if (!orderDoc.exists) throw new functions.https.HttpsError('not-found', 'Order not found.');
    const order = orderDoc.data();
    assertEscrowHeld(order);
    const total = requireOrderAmount(order);
    const buyerId = order.buyerId || order.userId;
    if (!buyerId) throw new functions.https.HttpsError('failed-precondition', 'This order has no buyer on record.');

    const buyerWallet = await readWallet(tx, buyerId);      // read first…
    const buyerBalance = applyCredit(tx, buyerWallet, buyerId, total, {
      type: 'refund',
      orderId: orderId,
      productTitle: order.productTitle || order.title || 'Item',
      description: 'Refund for order #' + String(orderId).substring(0, 8).toUpperCase() + (reason ? ' — ' + reason : ''),
      escrowStatus: 'refunded'
    }, now);

    tx.update(orderRef, {
      status: 'refunded',
      escrowStatus: 'refunded',
      escrowReleased: true,
      escrowReleasedAt: now,
      escrowReleasedBy: context.auth.uid,
      refundAmount: total,
      refundReason: reason || null,
      refundedAt: now,
      refundedBy: context.auth.uid,
      updatedAt: now
    });
    return { refund: total, buyerId, buyerBalance };
  });

  try {
    await db.collection('notifications').add({
      userId: result.buyerId, type: 'refund_issued', title: 'Refund issued',
      message: 'GHS ' + Number(result.refund).toFixed(2) + ' has been refunded to your Sankofa Wallet for order #' +
               orderId.substring(0, 8).toUpperCase() + '.' + (reason ? '\n\nReason: ' + reason : ''),
      orderId: orderId, isRead: false, createdAt: now
    });
  } catch (e) {}

  console.log(`✅ Order ${orderId} refunded to buyer — GHS ${result.refund}`);
  try { await untickPreorderCounters(orderId); } catch (e) { console.error('preorder untick failed', e && e.message); }
  try {
    const order = (await db.collection('orders').doc(orderId).get()).data() || {};
    const buyerEmail = await emailForUser(result.buyerId);
    await sendEmail('refund_issued', buyerEmail || order.buyerEmail, {
      name: order.buyerName, orderId: orderId, amount: result.refund,
      title: order.productTitle || order.title, reason: reason
    });
  } catch (e) { console.error('refund email failed', e && e.message); }
  return { success: true, refund: result.refund, buyerBalance: result.buyerBalance, message: 'Refunded GHS ' + result.refund.toFixed(2) + ' to the buyer.' };
});

// ============================================================================
// SELLER WITHDRAWALS (PAYOUTS)
// ============================================================================
//
// Sellers could earn into their Sankofa Wallet but never take money out — the wallet
// page just said "email support". This is the flow:
//
//   seller asks  → requestPayout      (money is HELD in the wallet immediately)
//   admin decides → markPayoutPaid    (admin sent the money: MoMo / bank / Paystack transfer)
//                 → rejectPayout      (money is returned to the seller's wallet)
//
// Holding the money on request is deliberate: it stops a seller from requesting a payout
// and spending the same balance at the same time.
// Paystack Transfers (fully automatic payouts) need Paystack to approve the business for
// transfers; until then the admin sends the money and marks it paid, and the ledger shows
// exactly what happened.

const PAYOUT_MIN = 20;            // smallest withdrawal (GHS)
const PAYOUT_FEE = 0;             // Sankofa does not charge for withdrawals (Paystack's own fee, if any, is separate)

function payoutRef() {
  return 'PO-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

/** Sellers ask for their money. Immediately holds the amount in the wallet. */
exports.requestPayout = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  const uid = context.auth.uid;

  const amount = round2((data || {}).amount);
  const method = String((data || {}).method || '').toLowerCase();       // 'momo' | 'bank'
  const details = (data || {}).details || {};
  const holder = ((details.name || '') + '').trim().slice(0, 120);
  const number = ((details.number || '') + '').trim().slice(0, 40);
  const provider = ((details.provider || '') + '').trim().slice(0, 60);
  const bankName = ((details.bankName || '') + '').trim().slice(0, 80);

  if (!(amount > 0)) throw new functions.https.HttpsError('invalid-argument', 'Enter the amount you want to withdraw.');
  if (amount < PAYOUT_MIN) throw new functions.https.HttpsError('invalid-argument', 'The smallest withdrawal is GHS ' + PAYOUT_MIN + '.');
  if (!['momo', 'bank'].includes(method)) throw new functions.https.HttpsError('invalid-argument', 'Choose Mobile Money or Bank transfer.');
  if (!holder) throw new functions.https.HttpsError('invalid-argument', 'Enter the name on the account.');
  if (!number) throw new functions.https.HttpsError('invalid-argument', method === 'momo' ? 'Enter the Mobile Money number.' : 'Enter the account number.');
  if (method === 'momo' && !provider) throw new functions.https.HttpsError('invalid-argument', 'Choose the Mobile Money network.');
  if (method === 'bank' && !bankName) throw new functions.https.HttpsError('invalid-argument', 'Enter the bank name.');

  // One open request at a time keeps the ledger readable for support.
  const open = await db.collection('payoutRequests')
    .where('userId', '==', uid).where('status', '==', 'pending').limit(1).get();
  if (!open.empty) {
    throw new functions.https.HttpsError('failed-precondition',
      'You already have a withdrawal waiting to be paid. Please wait for it to be processed (or cancel it).');
  }

  const walletRef = db.collection('wallets').doc(uid);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const result = await db.runTransaction(async (tx) => {
    const walletDoc = await tx.get(walletRef);              // read first
    if (!walletDoc.exists) throw new functions.https.HttpsError('failed-precondition', 'You have no wallet yet — earn or top up first.');
    const balance = round2(Number(walletDoc.data().balance || 0));
    if (amount > balance) {
      throw new functions.https.HttpsError('failed-precondition',
        'You only have GHS ' + balance.toFixed(2) + ' available. Request a smaller amount.');
    }
    const held = round2(balance - amount);
    const ref = payoutRef();
    const reqRef = db.collection('payoutRequests').doc();

    tx.update(walletRef, { balance: held, updatedAt: now });
    tx.set(db.collection('walletTransactions').doc(), {
      userId: uid, type: 'payout_request', amount: -amount, balanceAfter: held,
      reference: ref, description: 'Withdrawal requested (' + (method === 'momo' ? provider + ' ' + number : bankName + ' ' + number) + ')',
      status: 'pending', payoutId: reqRef.id, createdAt: now
    });
    tx.set(reqRef, {
      userId: uid,
      userEmail: (context.auth.token && context.auth.token.email) || null,
      userName: (context.auth.token && context.auth.token.name) || null,
      amount: amount, fee: PAYOUT_FEE, netAmount: round2(amount - PAYOUT_FEE),
      method: method,
      details: { name: holder, number: number, provider: provider || null, bankName: bankName || null },
      status: 'pending',
      reference: ref,
      balanceAfterHold: held,
      requestedAt: now,
      updatedAt: now
    });
    return { id: reqRef.id, reference: ref, held: held };
  });

  // tell the admin
  try {
    const admins = await db.collection('users').where('role', '==', 'admin').limit(5).get();
    const note = {
      type: 'payout_requested', title: '💸 Withdrawal request',
      message: 'A seller asked to withdraw GHS ' + amount.toFixed(2) + ' by ' +
               (method === 'momo' ? provider + ' (' + number + ')' : bankName + ' (' + number + ')') +
               '. Log in to the admin panel to pay it.',
      payoutId: result.id, amount: amount, isRead: false, createdAt: now
    };
    // one note per UNIQUE admin — the hardcoded main admin is usually already
    // in the role==admin list, and got the same note twice before this dedupe
    const adminIds = new Set(['z5qEmBHHipW4MqGRmCAQOMtfGr73']);
    admins.forEach(a => adminIds.add(a.id));
    const jobs = [];
    adminIds.forEach(id => jobs.push(db.collection('notifications').add(Object.assign({ userId: id }, note))));
    await Promise.all(jobs);
  } catch (e) { console.error('payout admin notify failed', e.message); }

  console.log(`💸 Payout requested: ${amount} by ${uid} (${result.reference})`);
  return { success: true, payoutId: result.id, reference: result.reference, amount: amount,
           balance: result.held, message: 'Request received — GHS ' + amount.toFixed(2) + ' is on hold. We pay out within 1–2 working days.' };
});

/** The seller changes their mind — return the held money to their wallet. */
exports.cancelPayout = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  const id = (data || {}).payoutId;
  if (!id) throw new functions.https.HttpsError('invalid-argument', 'payoutId is required.');
  const ref = db.collection('payoutRequests').doc(id);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const out = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new functions.https.HttpsError('not-found', 'That withdrawal request was not found.');
    const p = doc.data();
    if (p.userId !== context.auth.uid) throw new functions.https.HttpsError('permission-denied', 'That is not your request.');
    if (p.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', 'This request is already ' + p.status + '.');
    const wallet = await readWallet(tx, p.userId);                       // read first
    const balance = applyCredit(tx, wallet, p.userId, p.amount, {
      type: 'payout_cancelled',
      reference: p.reference,
      description: 'Withdrawal cancelled — money returned to your wallet',
      payoutId: id
    }, now);
    tx.update(ref, { status: 'cancelled', cancelledAt: now, cancelledBy: 'seller', updatedAt: now });
    return { balance: balance };
  });
  return { success: true, balance: out.balance, message: 'Withdrawal cancelled — your money is back in your wallet.' };
});

/* === AUTO PAYOUT CORE START (pure helpers and the batch runner: no network, no database) === */
var AUTO_PAY_MAX_COUNT = 20;
var AUTO_PAY_MAX_GHS = 5000;
var AUTO_PAY_REASON = 'Sankofa Market withdrawal';

/** A Ghana mobile number as 10 digits starting with 0, or '' when it does not look right. */
function smAutoPayLocalNumber(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (/^233\d{9}$/.test(d)) d = '0' + d.slice(3);
    return /^0\d{9}$/.test(d) ? d : '';
}
/** Mobile money network key: 'mtn', 'vodafone', 'airteltigo' or '' when unknown. */
function smAutoPayNetworkKey(provider) {
    var p = String(provider || '').toLowerCase().replace(/[^a-z]/g, '');
    if (p.indexOf('mtn') !== -1) return 'mtn';
    if (p.indexOf('vodafone') !== -1 || p.indexOf('telecel') !== -1 || p === 'voda') return 'vodafone';
    if (p.indexOf('airtel') !== -1 || p.indexOf('tigo') !== -1) return 'airteltigo';
    return '';
}
/** Paystack's own code for a network, read from its list. Never typed in by hand. */
function smAutoPayBankCode(banks, key) {
    var hit = (banks || []).find(function (b) {
        var n = String((b && b.name) || '').toLowerCase().replace(/[^a-z]/g, '');
        if (!n || !key) return false;
        if (key === 'mtn') return n.indexOf('mtn') !== -1;
        if (key === 'vodafone') return n.indexOf('vodafone') !== -1 || n.indexOf('telecel') !== -1;
        if (key === 'airteltigo') return n.indexOf('airtel') !== -1 || n.indexOf('tigo') !== -1;
        return false;
    });
    return hit && hit.code ? String(hit.code) : '';
}
function smAutoPayAmount(p) {
    return Math.round((Number((p && (p.netAmount || p.amount)) || 0)) * 100) / 100;
}
function smAutoPayMs(v) {
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    var t = new Date(v).getTime();
    return isNaN(t) ? 0 : t;
}
/** Can this withdrawal be sent automatically? */
function smAutoPayEligible(p) {
    if (!p) return { ok: false, reason: 'missing' };
    if (String(p.status) !== 'pending') return { ok: false, reason: 'not pending (' + p.status + ')' };
    if (String(p.method) !== 'momo') return { ok: false, reason: 'not Mobile Money' };
    if (p.transferCode || p.autoPayReference) return { ok: false, reason: 'already sent' };
    var d = p.details || {};
    if (!smAutoPayLocalNumber(d.number)) return { ok: false, reason: 'phone number looks wrong' };
    if (!smAutoPayNetworkKey(d.provider)) return { ok: false, reason: 'network not recognised' };
    if (!String(d.holder || d.name || '').trim()) return { ok: false, reason: 'no name on the account' };
    if (!(smAutoPayAmount(p) > 0)) return { ok: false, reason: 'no amount' };
    return { ok: true, reason: '' };
}
/** One run: oldest first, at most 20 withdrawals and GHS 5,000 in total. */
function smAutoPayPlan(list) {
    var rows = (list || []).slice().sort(function (a, b) { return smAutoPayMs(a.createdAt) - smAutoPayMs(b.createdAt); });
    var send = [], skipped = [], total = 0;
    rows.forEach(function (p) {
        var el = smAutoPayEligible(p);
        if (!el.ok) { skipped.push({ id: p.id, reason: el.reason }); return; }
        var amt = smAutoPayAmount(p);
        if (send.length >= AUTO_PAY_MAX_COUNT || Math.round((total + amt) * 100) / 100 > AUTO_PAY_MAX_GHS) {
            skipped.push({ id: p.id, reason: 'over this run limit' });
            return;
        }
        send.push(p);
        total = Math.round((total + amt) * 100) / 100;
    });
    return { send: send, skipped: skipped, total: total };
}
/** Every transfer gets its own reference: the withdrawal id plus the attempt number. */
function smAutoPayReference(id, attempt) { return 'payout_' + String(id) + '_' + String(attempt); }
function smAutoPayParseReference(ref) {
    var m = /^payout_(.+)_(\d+)$/.exec(String(ref || ''));
    return m ? { id: m[1], attempt: Number(m[2]) } : null;
}
function smAutoPayRecipientBody(p, bankCode) {
    var d = p.details || {};
    return {
        type: 'mobile_money',
        name: String(d.holder || d.name || '').trim().slice(0, 80),
        account_number: smAutoPayLocalNumber(d.number),
        bank_code: String(bankCode),
        currency: 'GHS'
    };
}
function smAutoPayTransferBody(p, recipientCode, reference) {
    return {
        source: 'balance',
        amount: Math.round(smAutoPayAmount(p) * 100),
        recipient: String(recipientCode),
        reason: AUTO_PAY_REASON,
        reference: String(reference)
    };
}
/** A refusal means Paystack said no before creating anything, so the money is safe to retry. */
function smAutoPayIsRefusal(err, message) {
    var status = err && err.response && err.response.status;
    return typeof status === 'number' && status >= 400 && status < 500 && !/duplicate/i.test(String(message || ''));
}
function smAutoPayErrorMessage(err) {
    var apiMsg = err && err.response && err.response.data && err.response.data.message;
    return String(apiMsg || (err && err.message) || 'Paystack did not accept the transfer').slice(0, 300);
}
/** Runs one planned batch. Every outside call goes through `deps`, so the tests use fakes. */
async function smAutoPayExecute(plan, deps) {
    var out = { sent: [], failed: [], stuck: [], skipped: [], stopped: '' };
    if (!(await deps.enabled())) { out.stopped = 'switched off'; return out; }
    if (!plan.send.length) return out;
    var banks = await deps.fetchBankCodes();
    for (var i = 0; i < plan.send.length; i++) {
        var p = plan.send[i];
        if (!(await deps.enabled())) { out.stopped = 'switched off during the run'; break; }
        var code = smAutoPayBankCode(banks, smAutoPayNetworkKey((p.details || {}).provider));
        if (!code) { out.skipped.push({ id: p.id, reason: 'Paystack does not list that network' }); continue; }
        var got = await deps.reserve(p.id);
        if (!got.ok) { out.skipped.push({ id: p.id, reason: got.reason }); continue; }
        try {
            var recipient = await deps.createRecipient(smAutoPayRecipientBody(p, code));
            var t = await deps.createTransfer(smAutoPayTransferBody(p, recipient, got.reference));
            await deps.recordSent(p.id, {
                transferCode: String(t.transfer_code || ''), transferStatus: String(t.status || ''), recipientCode: String(recipient)
            });
            out.sent.push({ id: p.id, amount: smAutoPayAmount(p) });
        } catch (e) {
            var msg = smAutoPayErrorMessage(e);
            if (smAutoPayIsRefusal(e, msg)) {
                await deps.releaseToPending(p.id, msg);
                out.failed.push({ id: p.id, reason: msg });
                if (/insufficient|balance/i.test(msg)) { out.stopped = 'Paystack balance is too low'; break; }
            } else {
                await deps.markStuck(p.id, msg);
                out.stuck.push({ id: p.id, reason: msg });
            }
        }
    }
    return out;
}
/* === AUTO PAYOUT CORE END === */

// ---------- automatic Mobile Money payouts (Tier 5, option 7): switched OFF by default ----------
async function smAutoPayReadSwitch() {
  try {
    const s = await db.collection('settings').doc('payouts').get();
    return !!(s.exists && (s.data() || {}).autoPayEnabled === true);
  } catch (e) { return false; }
}
async function smAutoPayCollectPending() {
  const snap = await db.collection('payoutRequests').where('status', '==', 'pending').limit(300).get();
  return snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
}
function smAutoPayRow(p) {
  const d = p.details || {};
  const n = smAutoPayLocalNumber(d.number);
  return { id: p.id, name: String(d.holder || d.name || 'Seller'), amount: smAutoPayAmount(p), provider: String(d.provider || ''), number: n ? '•••' + n.slice(-3) : '—' };
}
function smAutoPayRealDeps() {
  const headers = { Authorization: 'Bearer ' + paystackSecret() };
  const col = db.collection('payoutRequests');
  const del = admin.firestore.FieldValue.delete();
  const nowIso = () => new Date().toISOString();
  return {
    enabled: () => smAutoPayReadSwitch(),
    fetchBankCodes: async () => {
      const r = await axios.get('https://api.paystack.co/bank', { params: { currency: 'GHS', type: 'mobile_money', perPage: 100 }, headers: headers });
      return (r.data && r.data.data) || [];
    },
    reserve: (id) => db.runTransaction(async (tx) => {
      const ref = col.doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) return { ok: false, reason: 'not found' };
      const p = snap.data();
      if (p.status !== 'pending') return { ok: false, reason: 'not pending any more' };
      if (p.transferCode || p.autoPayReference) return { ok: false, reason: 'already sent' };
      const attempt = (Number(p.autoPayAttempts) || 0) + 1;
      const reference = smAutoPayReference(id, attempt);
      tx.update(ref, { status: 'processing', autoPayAttempts: attempt, autoPayReference: reference, autoPayReservedAt: nowIso(), autoPayError: del, updatedAt: nowIso() });
      return { ok: true, reference: reference };
    }),
    createRecipient: async (body) => {
      const r = await axios.post('https://api.paystack.co/transferrecipient', body, { headers: headers });
      return r.data.data.recipient_code;
    },
    createTransfer: async (body) => {
      const r = await axios.post('https://api.paystack.co/transfer', body, { headers: headers });
      return r.data.data || {};
    },
    recordSent: (id, info) => col.doc(id).update({ transferCode: info.transferCode, transferStatus: info.transferStatus, recipientCode: info.recipientCode, autoPaySentAt: nowIso(), updatedAt: nowIso() }),
    releaseToPending: (id, msg) => col.doc(id).update({ status: 'pending', autoPayReference: del, autoPayReservedAt: del, autoPayError: msg, autoPayFailedAt: nowIso(), updatedAt: nowIso() }),
    markStuck: (id, msg) => col.doc(id).update({ autoPayError: msg, autoPayFailedAt: nowIso(), updatedAt: nowIso() })
  };
}
/** Paystack reported how a transfer ended. Only the attempt that is currently being sent can change the withdrawal. */
async function smAutoPayHandleTransferEvent(event, data, reference) {
  const parsed = smAutoPayParseReference(reference);
  if (!parsed) return 'not a payout transfer';
  const ref = db.collection('payoutRequests').doc(parsed.id);
  const snap = await ref.get();
  if (!snap.exists) return 'withdrawal not found';
  const p = snap.data();
  if (p.autoPayReference !== reference) return 'old attempt, ignored';
  const now = admin.firestore.FieldValue.serverTimestamp();
  const nowIso = new Date().toISOString();
  const del = admin.firestore.FieldValue.delete();
  const details = p.details || {};
  if (event === 'transfer.success') {
    if (p.status !== 'processing') return 'withdrawal is ' + p.status + ', nothing to change';
    await ref.update({ status: 'paid', paidAt: now, paidBy: 'paystack', paymentReference: reference, paymentNote: 'Sent automatically', autoPayError: del, updatedAt: now });
    try {
      await db.collection('walletTransactions').add({
        userId: p.userId, type: 'payout_paid', amount: 0, balanceAfter: p.balanceAfterHold,
        reference: p.reference, payoutId: parsed.id, description: 'Withdrawal sent automatically (ref ' + reference + ')',
        status: 'completed', createdAt: now
      });
      await db.collection('notifications').add({
        userId: p.userId, type: 'payout_paid', title: 'Withdrawal paid',
        message: 'GHS ' + Number(p.netAmount || p.amount).toFixed(2) + ' has been sent to your ' + (details.provider || 'Mobile Money') + ' ' + (details.number || '') + '. Transfer reference: ' + reference + '.',
        payoutId: parsed.id, isRead: false, createdAt: now
      });
    } catch (e) { console.error('auto payout notify failed', e && e.message); }
    try {
      const sellerEmail = p.userEmail || await emailForUser(p.userId);
      await sendEmail('payout_paid', sellerEmail, {
        name: details.holder || null, amount: p.netAmount || p.amount,
        destination: (details.provider || '') + ' ' + (details.number || ''), reference: reference
      });
    } catch (e) { console.error('auto payout email failed', e && e.message); }
    return 'marked paid';
  }
  // failed, or reversed: nothing reached the seller. Back to pending, and the money stays held for an admin.
  if (event === 'transfer.reversed' && p.status === 'paid' && p.paymentReference === reference) {
    await ref.update({ status: 'pending', paidAt: del, paidBy: del, autoPayError: 'Paystack reversed this transfer. Check before paying again.', autoPayFailedAt: nowIso, updatedAt: now });
    return 'paid withdrawal reversed, back to pending';
  }
  if (p.status !== 'processing') return 'withdrawal is ' + p.status + ', nothing to change';
  await ref.update({
    status: 'pending', autoPayReference: del, autoPayReservedAt: del, transferCode: del,
    autoPayError: 'Paystack: ' + String((data && data.gateway_response) || event), autoPayFailedAt: nowIso, updatedAt: now
  });
  return 'back to pending (' + event + ')';
}

exports.setAutoPayEnabled = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  if (!(await refIsAdmin(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only');
  const on = (data || {}).on;
  if (typeof on !== 'boolean') throw new functions.https.HttpsError('invalid-argument', 'Say on or off.');
  const nowIso = new Date().toISOString();
  await db.collection('settings').doc('payouts').set({ autoPayEnabled: on, updatedAt: nowIso, updatedBy: context.auth.uid }, { merge: true });
  console.log('setAutoPayEnabled: ' + on + ' by ' + context.auth.uid);
  return { ok: true, enabled: on };
});

exports.previewAutoPayouts = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  if (!(await refIsAdmin(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only');
  const enabled = await smAutoPayReadSwitch();
  const plan = smAutoPayPlan(await smAutoPayCollectPending());
  const stuckSnap = await db.collection('payoutRequests').where('status', '==', 'processing').limit(100).get();
  const stuck = stuckSnap.docs.map((d) => ({
    id: d.id, amount: smAutoPayAmount(d.data()), error: String(d.data().autoPayError || ''), hasTransfer: !!d.data().transferCode
  }));
  return {
    enabled: enabled, count: plan.send.length, total: plan.total,
    send: plan.send.slice(0, 50).map(smAutoPayRow), skipped: plan.skipped.slice(0, 100), stuck: stuck,
    caps: { count: AUTO_PAY_MAX_COUNT, ghs: AUTO_PAY_MAX_GHS }
  };
});

exports.runAutoPayouts = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  if (!(await refIsAdmin(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only');
  if (!(await smAutoPayReadSwitch())) throw new functions.https.HttpsError('failed-precondition', 'Automatic payouts are switched off. Turn them on first.');
  if (!paystackSecret()) throw new functions.https.HttpsError('failed-precondition', 'Paystack is not connected yet, so nothing can be sent.');
  const plan = smAutoPayPlan(await smAutoPayCollectPending());
  const result = await smAutoPayExecute(plan, smAutoPayRealDeps());
  console.log('runAutoPayouts by ' + context.auth.uid + ': sent ' + result.sent.length + ', failed ' + result.failed.length + ', stuck ' + result.stuck.length + ', stopped: ' + (result.stopped || 'no'));
  return {
    ok: true, planned: plan.send.length, plannedTotal: plan.total, sent: result.sent, failed: result.failed,
    stuck: result.stuck, skipped: result.skipped.slice(0, 100), stopped: result.stopped
  };
});

exports.returnStuckPayout = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  if (!(await refIsAdmin(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only');
  const id = String((data || {}).payoutId || '').trim();
  if (!id) throw new functions.https.HttpsError('invalid-argument', 'payoutId is required.');
  const ref = db.collection('payoutRequests').doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Withdrawal request not found.');
    const p = snap.data();
    if (p.status !== 'processing') throw new functions.https.HttpsError('failed-precondition', 'Only a withdrawal that is being sent can be returned.');
    if (p.transferCode) throw new functions.https.HttpsError('failed-precondition', 'Paystack already created this transfer. Wait for its result. Do not send it again.');
    tx.update(ref, {
      status: 'pending', autoPayReference: admin.firestore.FieldValue.delete(), autoPayReservedAt: admin.firestore.FieldValue.delete(),
      autoPayError: 'Returned to pending by an admin after a check in Paystack', updatedAt: new Date().toISOString()
    });
  });
  console.log('returnStuckPayout ' + id + ' by ' + context.auth.uid);
  return { ok: true };
});

exports.autoPayoutDaily = functions.pubsub.schedule('every day 10:00').timeZone('Africa/Accra').onRun(async () => {
  if (!(await smAutoPayReadSwitch())) { console.log('autoPayoutDaily: switched off, nothing sent'); return null; }
  if (!paystackSecret()) { console.log('autoPayoutDaily: Paystack not connected, nothing sent'); return null; }
  const plan = smAutoPayPlan(await smAutoPayCollectPending());
  const result = await smAutoPayExecute(plan, smAutoPayRealDeps());
  console.log('autoPayoutDaily: sent ' + result.sent.length + ', failed ' + result.failed.length + ', stuck ' + result.stuck.length + ', stopped: ' + (result.stopped || 'no'));
  return null;
});

/** Admin: the money has been sent (MoMo / bank / Paystack transfer). */
exports.markPayoutPaid = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  if (!(await adminCaller(context))) throw new functions.https.HttpsError('permission-denied', 'Only Sankofa support can pay out withdrawals.');
  const id = (data || {}).payoutId;
  const sentReference = ((data || {}).reference || '').toString().slice(0, 80);
  const note = ((data || {}).note || '').toString().slice(0, 400);
  if (!id) throw new functions.https.HttpsError('invalid-argument', 'payoutId is required.');

  const ref = db.collection('payoutRequests').doc(id);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const doc = await ref.get();
  if (!doc.exists) throw new functions.https.HttpsError('not-found', 'Withdrawal request not found.');
  const p = doc.data();
  if (p.status === 'paid') return { success: true, alreadyPaid: true, message: 'This withdrawal was already marked paid.' };
  if (p.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', 'This request is ' + p.status + ' — nothing to pay.');

  await ref.update({
    status: 'paid', paidAt: now, paidBy: context.auth.uid,
    paymentReference: sentReference || null, paymentNote: note || null, updatedAt: now
  });

  try {
    await db.collection('walletTransactions').add({
      userId: p.userId, type: 'payout_paid', amount: 0, balanceAfter: p.balanceAfterHold,
      reference: p.reference, payoutId: id,
      description: 'Withdrawal paid out by Sankofa' + (sentReference ? ' (ref ' + sentReference + ')' : ''),
      status: 'completed', createdAt: now
    });
    await db.collection('notifications').add({
      userId: p.userId, type: 'payout_paid', title: 'Withdrawal paid',
      message: 'GHS ' + Number(p.netAmount || p.amount).toFixed(2) + ' has been sent to your ' +
               (p.method === 'momo' ? (p.details.provider + ' ' + p.details.number) : (p.details.bankName + ' ' + p.details.number)) +
               (sentReference ? '. Transfer reference: ' + sentReference : '.') ,
      payoutId: id, isRead: false, createdAt: now
    });
  } catch (e) { console.error('payout paid notify failed', e.message); }

  console.log(`💸 Payout ${id} marked paid (${p.amount})`);
  try {
    const sellerEmail = p.userEmail || await emailForUser(p.userId);
    await sendEmail('payout_paid', sellerEmail, {
      name: (p.details && p.details.name) || null,
      amount: p.netAmount || p.amount,
      destination: p.method === 'momo' ? ((p.details.provider || '') + ' ' + (p.details.number || '')) : ((p.details.bankName || '') + ' ' + (p.details.number || '')),
      reference: sentReference
    });
  } catch (e) { console.error('payout email failed', e && e.message); }
  return { success: true, amount: p.netAmount || p.amount, message: 'Marked as paid — the seller has been told.' };
});

/** Admin: refuse the request (or undo a mistake) — the money goes back to the seller. */
exports.rejectPayout = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  if (!(await adminCaller(context))) throw new functions.https.HttpsError('permission-denied', 'Only Sankofa support can cancel a withdrawal.');
  const id = (data || {}).payoutId;
  const reason = ((data || {}).reason || '').toString().slice(0, 400);
  if (!id) throw new functions.https.HttpsError('invalid-argument', 'payoutId is required.');

  const ref = db.collection('payoutRequests').doc(id);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const out = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new functions.https.HttpsError('not-found', 'Withdrawal request not found.');
    const p = doc.data();
    if (p.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', 'This request is already ' + p.status + ' — the money is not on hold any more.');
    const wallet = await readWallet(tx, p.userId);                        // read first
    const balance = applyCredit(tx, wallet, p.userId, p.amount, {
      type: 'payout_returned',
      reference: p.reference,
      payoutId: id,
      description: 'Withdrawal returned to your wallet' + (reason ? ' — ' + reason : '')
    }, now);
    tx.update(ref, { status: 'rejected', rejectedAt: now, rejectedBy: context.auth.uid, rejectionReason: reason || null, updatedAt: now });
    return { balance: balance, userId: p.userId, amount: p.amount };
  });

  try {
    await db.collection('notifications').add({
      userId: out.userId, type: 'payout_rejected', title: 'Withdrawal needs attention',
      message: 'Your withdrawal of GHS ' + Number(out.amount).toFixed(2) + ' could not be paid, so the money is back in your Sankofa Wallet.' +
               (reason ? '\n\nReason: ' + reason : '') + '\n\nPlease check your payout details and try again, or email sankofamarketgh@gmail.com.',
      payoutId: id, isRead: false, createdAt: now
    });
  } catch (e) {}

  console.log(`💸 Payout ${id} rejected — ${out.amount} returned`);
  return { success: true, returned: out.amount, balance: out.balance, message: 'Request cancelled — the money is back in the seller\'s wallet.' };
});

// ============================================================================
// AUCTIONS — closing and paying the winner
// ============================================================================
//
// ⚠️ The winner's order used to be created ONLY in the browser, by the countdown ticker on
// the auction page (`ensureAuctionWinnerOrder`). If nobody had the auction open when the
// clock ran out, NO order was ever created — the auction just sat there "ended" and the
// winner could not pay for what they had won. (That is exactly why a winner order had to be
// re-created by hand for the guitar auction.)
//
// `closeEndedAuctionsCore` is now the server-side authority: it closes any auction whose
// time is up and creates the winner's order. It runs on a schedule every 5 minutes, and an
// admin can also trigger it on demand from the panel. It is idempotent — the order id is the
// auction id, so it can never create two orders for one auction.

async function closeEndedAuctionsCore(limit) {
  const now = Date.now();
  const summary = { scanned: 0, closed: 0, orders: 0, skipped: 0, details: [] };
  const snap = await db.collection('auctions').limit(limit || 100).get();

  for (const doc of snap.docs) {
    const a = doc.data();
    summary.scanned++;
    if (a.status === 'ended' || a.status === 'cancelled') continue;
    const endMs = a.endAt
      ? (a.endAt.toMillis ? a.endAt.toMillis() : new Date(a.endAt).getTime())
      : (a.endAtMs || null);
    if (!endMs || endMs > now) continue;

    // ---- close it ----
    const nowTs = admin.firestore.FieldValue.serverTimestamp();
    await doc.ref.update({ status: 'ended', endedAt: nowTs, endedBySystem: true, updatedAt: nowTs });
    summary.closed++;

    const winnerId = a.currentBidderId;
    const hammer = round2(a.currentBid || a.startingPrice || 0);
    if (!winnerId || !a.sellerId || !(hammer > 0)) {
      summary.skipped++;
      summary.details.push({ auction: doc.id, outcome: 'closed with no bidder' });
      continue;
    }
    if (a.winnerOrderId) { summary.skipped++; continue; }

    // RESERVE PRICE (premium auction tool): if the top bid never reached the reserve,
    // there is no sale — the auction just closes. Nobody is charged, the seller can relist.
    const reserve = Number(a.reservePrice) > 0 ? round2(Number(a.reservePrice)) : 0;
    if (reserve > 0 && hammer < reserve) {
      try {
        await doc.ref.set({ reserveNotMet: true, updatedAt: nowTs }, { merge: true });
        await db.collection('notifications').add({
          userId: a.sellerId, type: 'auction_reserve_not_met', title: 'Auction ended — reserve not met',
          message: 'Your auction "' + (a.title || '') + '" ended at GHS ' + hammer.toLocaleString() +
                   ', below your reserve of GHS ' + reserve.toLocaleString() + '. No sale was made — you can relist it.',
          auctionId: doc.id, isRead: false, createdAt: nowTs
        });
        if (winnerId) {
          await db.collection('notifications').add({
            userId: winnerId, type: 'auction_reserve_not_met', title: 'Auction ended — reserve not met',
            message: 'The auction for "' + (a.title || '') + '" ended below the seller\'s reserve, so no sale was made. You were not charged anything.',
            auctionId: doc.id, isRead: false, createdAt: nowTs
          });
        }
      } catch (e) { console.warn('reserve-not-met notices skipped', e && e.message); }
      summary.skipped++;
      summary.details.push({ auction: doc.id, outcome: 'reserve not met', hammer, reserve });
      continue;
    }

    try {
      const out = await closeAuctionWithWinner(doc.ref, a, winnerId, a.currentBidderName, hammer, 'bid');
      summary.orders++;
      summary.details.push({ auction: doc.id, outcome: 'winner order created', orderId: out.orderId, total: out.total });

    } catch (e) {
      console.error('could not create the winner order for', doc.id, e.message);
      summary.details.push({ auction: doc.id, outcome: 'order failed: ' + e.message });
    }
  }
  return summary;
}

/**
 * THE ONLY place an auction turns into a sale. The 5-minute closer and the Buy-It-Now
 * button both end up here, so there is exactly one fee rule and one receipt trail:
 *   · New auctions use the admin-set rate frozen on their auction doc; older auctions
 *     without a snapshot continue using the seller's live plan rate.
 *   · The order id IS the auction id → deterministic; it can never create two orders.
 * Returns { orderId, total, payout, commission }.
 */
async function closeAuctionWithWinner(auctionRef, a, winnerId, winnerName, hammer, via) {
  const orderId = auctionRef.id;
  const orderRef = db.collection('orders').doc(orderId);
  const nowTs = admin.firestore.FieldValue.serverTimestamp();
  const total = round2(hammer);
  const buyNow = via === 'buyNow';
  const winnerPerks = await fetchMoneyPerks(null, a.sellerId);
  const savedAuctionFee = auctionCommissionSnapshotRate(a);
  const feePct = savedAuctionFee !== null ? savedAuctionFee : winnerPerks.commissionRate;
  const commission = round2(total * feePct / 100);
  const payout = round2(total - commission);

  const existing = await orderRef.get();
  if (!existing.exists) {
    await orderRef.set({
      buyerId: winnerId,
      userId: winnerId,
      buyerName: winnerName || 'Winner',
      sellerId: a.sellerId,
      sellerName: a.sellerName || 'Seller',
      sellerEmail: a.sellerEmail || null,
      productId: a.productId || null,
      productTitle: a.title || 'Auction item',
      productImage: a.productImage || (a.images && a.images[0]) || null,
      imagesThumb: a.imagesThumb || null,
      auctionId: orderId,
      isAuctionOrder: true,
      wonViaBuyNow: buyNow,
      amount: total, bidAmount: total, total: total, currency: 'GHS',
      commission: feePct,
      commissionAmount: commission,
      sellerPayout: payout,
      status: 'pending', paymentStatus: 'pending', escrowStatus: 'pending',
      createdAt: nowTs, updatedAt: nowTs,
      createdBySystem: true
    });
  }
  await auctionRef.set({ winnerOrderId: orderId, winnerOrderCreatedAt: nowTs }, { merge: true });

  const feeNote = feePct === 0 ? '0% fee — you keep the full price' : feePct + '% fee';
  // a conversation so the winner and seller can arrange delivery
  try {
    const conv = await db.collection('conversations')
      .where('auctionId', '==', orderId)
      .where('participants', 'array-contains', winnerId).limit(1).get();
    if (conv.empty) {
      const convRef = db.collection('conversations').doc();
      const winLine = buyNow
        ? 'You won instantly at the Buy-It-Now price of GHS ' + total.toLocaleString() + '!'
        : 'You won the auction at GHS ' + total.toLocaleString() + '!';
      await convRef.set({
        participants: [a.sellerId, winnerId],
        participantNames: {},
        auctionId: orderId,
        productId: a.productId || null,
        productTitle: a.title || 'Auction item',
        lastMessage: winLine,
        lastMessageAt: nowTs,
        createdAt: nowTs,
        status: 'active'
      });
      await convRef.collection('messages').add({
        senderId: a.sellerId,
        senderName: a.sellerName || 'Seller',
        participants: [a.sellerId, winnerId],
        text: '🎉 Congratulations! ' + winLine + '\n\nOrder #' + orderId.substring(0, 8).toUpperCase() +
              ' has been created (' + feeNote + ', escrow protected). Please reply here to arrange delivery or pickup.\n\n— Sankofa Market',
        createdAt: nowTs, status: 'sent'
      });
    }
  } catch (e) { console.warn('auction conversation skipped', e.message); }

  // tell both sides
  try {
    await db.collection('notifications').add({
      userId: winnerId, type: 'auction_won', title: '🏆 You won the auction',
      message: buyNow
        ? 'You bought "' + (a.title || 'an auction') + '" instantly at the Buy-It-Now price GHS ' + total.toLocaleString() +
          '. Pay from My Orders to secure it — the money is held in escrow until you confirm delivery.'
        : 'You won "' + (a.title || 'an auction') + '" at GHS ' + total.toLocaleString() +
          '. Pay from My Orders to secure it — the money is held in escrow until you confirm delivery.',
      orderId, auctionId: orderId, isRead: false, createdAt: nowTs
    });
    await db.collection('notifications').add({
      userId: a.sellerId, type: 'auction_sold', title: buyNow ? '💥 Sold at Buy-It-Now!' : 'Your auction sold',
      message: 'Your auction "' + (a.title || '') + '" sold for GHS ' + total.toLocaleString() +
               ' to ' + (winnerName || 'the winner') + (buyNow ? ' (Buy-It-Now)' : '') + '. You are paid GHS ' + payout.toFixed(2) +
               (feePct === 0 ? ' (0% fee — you keep the whole price)' : ' (after the ' + feePct + '% fee)') +
               ' once they confirm delivery.',
      orderId, auctionId: orderId, isRead: false, createdAt: nowTs
    });
  } catch (e) { console.warn('auction notifications skipped', e.message); }

  try {
    await sendEmail('auction_won', a.currentBidderEmail || await emailForUser(winnerId), {
      name: winnerName, title: a.title, amount: total, orderId: orderId
    });
    const sellerEmail = a.sellerEmail || await emailForUser(a.sellerId);
    await sendEmail('auction_sold', sellerEmail, {
      name: a.sellerName, title: a.title, amount: total, payout: payout,
      commission: feePct
    });
  } catch (e) { console.error('auction emails failed', e && e.message); }
  console.log(`🔨 Auction ${orderId} closed (${buyNow ? 'Buy-It-Now' : 'highest bid'}) — order for ${total} (winner ${winnerId})`);

  return { orderId, total, payout, commission, rate: feePct };
}

/**
 * BUY IT NOW (premium auction tool) — the first shopper to accept the seller's fixed
 * Buy-It-Now price wins instantly and the auction ends right there. Everything that
 * decides the win happens here on the server; the browser only asks. Once someone has
 * placed even one bid, Buy-It-Now is over and bids decide it (the eBay rule).
 */
exports.buyAuctionNow = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in first.');
  const auctionId = String((data || {}).auctionId || '');
  if (!auctionId) throw new functions.https.HttpsError('invalid-argument', 'auctionId is required.');
  const buyerUid = context.auth.uid;
  const auctionRef = db.collection('auctions').doc(auctionId);

  let buyerName = (context.auth.token && context.auth.token.name) || null;
  try {
    const uDoc = await db.collection('users').doc(buyerUid).get();
    if (uDoc.exists) buyerName = uDoc.data().name || uDoc.data().firstName || buyerName;
  } catch (e) { /* fall back to the auth display name */ }
  buyerName = buyerName || 'Buyer';

  const hit = await db.runTransaction(async (tx) => {
    const snap = await tx.get(auctionRef);
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'This auction no longer exists.');
    const a = snap.data();
    if (a.sellerId === buyerUid) {
      throw new functions.https.HttpsError('permission-denied', 'You cannot buy your own auction.');
    }
    if (String(a.status) !== 'live') {
      throw new functions.https.HttpsError('failed-precondition', 'This auction is no longer live — Buy-It-Now missed its chance.');
    }
    const bin = Number(a.buyNowPrice) > 0 ? round2(Number(a.buyNowPrice)) : 0;
    if (!(bin > 0)) {
      throw new functions.https.HttpsError('failed-precondition', 'This auction has no Buy-It-Now price.');
    }
    if (a.currentBidderId) {
      throw new functions.https.HttpsError('failed-precondition', 'Someone has already placed a bid, so Buy-It-Now is over — the auction will be decided by bids.');
    }
    const endMs = a.endAt ? (a.endAt.toMillis ? a.endAt.toMillis() : new Date(a.endAt).getTime()) : (a.endAtMs || null);
    if (endMs && endMs <= Date.now()) {
      throw new functions.https.HttpsError('failed-precondition', 'This auction has just ended.');
    }
    const nowTx = admin.firestore.FieldValue.serverTimestamp();
    tx.update(auctionRef, {
      status: 'ended',
      endedAt: nowTx,
      endedBy: buyerUid,
      endedBySystem: false,
      buyNowWon: true,
      currentBid: bin,
      currentBidderId: buyerUid,
      currentBidderName: buyerName,
      updatedAt: nowTx
    });
    return { a, bin };
  });

  const out = await closeAuctionWithWinner(
    auctionRef,
    Object.assign({}, hit.a, { currentBidderId: buyerUid, currentBidderName: buyerName }),
    buyerUid, buyerName, hit.bin, 'buyNow'
  );
  return {
    success: true,
    orderId: out.orderId,
    total: out.total,
    message: 'You won it instantly at the Buy-It-Now price! Pay from My Orders to secure it.'
  };
});

/** Runs every 5 minutes so an auction always produces its winner order, even with nobody watching. */
exports.closeEndedAuctions = functions.pubsub.schedule('every 5 minutes').onRun(async () => {
  try {
    const out = await closeEndedAuctionsCore(100);
    if (out.closed || out.orders) console.log('closeEndedAuctions:', JSON.stringify(out).slice(0, 400));
  } catch (e) {
    console.error('closeEndedAuctions failed', e);
  }
  return null;
});

/** Admin: close anything that is due right now (button in the panel). */
exports.closeEndedAuctionsNow = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  if (!(await adminCaller(context))) throw new functions.https.HttpsError('permission-denied', 'Only Sankofa support can close auctions.');
  const out = await closeEndedAuctionsCore(200);
  return {
    success: true,
    closed: out.closed,
    ordersCreated: out.orders,
    message: 'Closed ' + out.closed + ' auction(s) and created ' + out.orders + ' winner order(s).'
  };
});

// ============================================================================
// EMAIL RECEIPTS AND NOTICES (EmailJS)
// ============================================================================
//
// Until now only the welcome email existed, and it was sent from the browser. Buyers and
// sellers had no email trail at all — they had to remember to open the site.
//
// This sends the important ones from the server (so they still arrive if the customer
// closed the tab): payment receipts, a sale notice, "your parcel is on its way", refunds,
// withdrawals paid, and auction results.
//
// ONE template does all of them. In EmailJS create a template and paste the markup from
// EMAIL_SETUP.md; it uses these variables:
//     {{to_name}} {{subject}} {{heading}} {{body}} {{cta_text}} {{cta_url}} {{order_ref}} {{site_name}}
// The template id is read from Firestore `settings/email` (templateId), with a fallback to
// the welcome template so nothing breaks before you create it.

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';
const EMAILJS_DEFAULTS = {
  serviceId: 'service_ud6z4l6',
  publicKey: 'nQCOm9xJnMIZHqmIW',
  templateId: 'welcome_template'
};
const SITE_URL = 'https://sankofa-market.web.app';

async function emailSettings() {
  // `enabled` defaults to true so nothing stops sending if the settings document is missing.
  const out = Object.assign({}, EMAILJS_DEFAULTS, { enabled: true });
  try {
    const d = await db.collection('settings').doc('email').get();
    if (d.exists) {
      const v = d.data() || {};
      if (v.serviceId) out.serviceId = String(v.serviceId).trim();
      // The key is stored as `emailjsKey`. That field name is on the Firestore rules deny-list
      // for settings, which is what keeps this document admin-only — a browser can never read
      // the key. `publicKey` is still accepted so an old document keeps working.
      const key = v.emailjsKey || v.publicKey;
      if (key) out.publicKey = String(key).trim();
      if (v.templateId) out.templateId = String(v.templateId).trim();
      out.enabled = v.enabled !== false;
      out.lastTest = v.lastTest || null;
      out.updatedAt = v.updatedAt || null;
      out.savedByAdmin = true;
    }
  } catch (e) { /* settings are optional */ }
  return out;
}

/** Compose the subject / heading / body for each kind of email. */
function composeEmail(kind, v) {
  v = v || {};
  const money = n => 'GHS ' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const short = id => String(id || '').substring(0, 8).toUpperCase();
  const map = {
    welcome: {
      subject: 'Welcome to Sankofa Market, ' + (v.name || 'friend') + ' 🎉',
      heading: 'Akwaaba — welcome to Sankofa Market',
      body: 'Hello ' + (v.name || 'friend') + ', your Sankofa Market account is ready. Akwaaba!\n\n' +
            'Sankofa Market is a marketplace for Ghana with a safety net built in.\n\n' +
            'Your money is protected:\n' +
            '  •  When you pay, the money is held safely in escrow.\n' +
            '  •  The seller is paid when you confirm the item arrived.\n' +
            '  •  If you do not confirm, the seller is paid automatically within 48 hours of delivery.\n' +
            '  •  Something wrong? Open a dispute. The money stays frozen until our team decides.\n\n' +
            'What you can do now:\n' +
            '  •  Search listings, or see picks made for you on the home page.\n' +
            '  •  Save items with the heart. Your saved list follows you to any phone.\n' +
            '  •  Follow sellers and chat with them inside the site, so every conversation is on record.\n' +
            '  •  Pay from your Sankofa Wallet. Wallet payments have no fee.\n' +
            '  •  Invite friends with your referral code and earn reward points.\n\n' +
            'Want to sell?\n' +
            '  •  Open your own shop page. Add your logo and banner, pick your colours, and share your link on WhatsApp and Instagram.\n' +
            '  •  Run an auction if you want buyers to bid.\n' +
            '  •  Withdraw your earnings to Mobile Money or your bank.\n\n' +
            (v.pendingApproval ? 'Selling needs one quick check first. An admin reviews new seller accounts, and you will get an email the moment yours is verified.\n\n' : '') +
            'Questions? Email sankofamarketgh@gmail.com or call 0273659806.\n' +
            'Help guides: ' + SITE_URL + '/help',
      cta_text: 'Start exploring',
      cta_url: SITE_URL
    },
    account_approved: {
      subject: 'Your Sankofa Market account is verified ✅',
      heading: 'You are verified — welcome to selling',
      body: 'Good news ' + (v.name || 'friend') + ', an admin has checked and verified your account.\n\n' +
            'You can now:\n' +
            '  •  List items for sale — Starter is free, with up to 10 live listings.\n' +
            '  •  Run auctions if you would rather let buyers bid.\n' +
            '  •  Get paid into your Sankofa Wallet, and withdraw to Mobile Money or your bank.\n\n' +
            'Two things worth knowing before your first sale:\n' +
            '  •  Buyers pay Sankofa Market, not you directly. The money is held in escrow and released when the buyer confirms the item arrived as described.\n' +
            '  •  Photographs sell items. Listings with clear, well-lit photos of the real item sell far faster.\n\n' +
            'Good luck with your first listing.',
      cta_text: 'List an item for sale',
      cta_url: SITE_URL + '/publish'
    },
    payment_receipt: {
      subject: 'Payment received — order #' + short(v.orderId) + ' (' + money(v.amount) + ')',
      heading: 'We have your payment',
      body: 'Thanks ' + (v.name || 'there') + ' — we received ' + money(v.amount) + ' for "' + (v.title || 'your order') +
            '".\n\n' +
            'The money is held safely in Sankofa escrow, NOT sent to the seller yet. It is released when you confirm the item arrived as described — or automatically 48 hours after delivery.\n\n' +
            'Order: #' + short(v.orderId) + '\nPaid with: ' + (v.method === 'wallet' ? 'Sankofa Wallet (0% fee)' : 'Card/Mobile Money via Paystack') +
            (v.reference ? '\nPayment reference: ' + v.reference : ''),
      cta_text: 'View your receipt',
      cta_url: SITE_URL + '/order-confirmation?orderId=' + (v.orderId || '')
    },
    sale_received: {
      subject: 'You have a sale — order #' + short(v.orderId),
      heading: 'You made a sale 🎉',
      body: 'Good news ' + (v.name || 'there') + ' — "' + (v.title || 'your item') + '" sold for ' + money(v.amount) + '.\n\n' +
            'Your payout of ' + money(v.payout) + ' (after the ' + (v.commission != null ? v.commission : 5) + '% fee) will be added to your Sankofa Wallet when the buyer confirms delivery'
            + (v.auto ? ' — or automatically 48 hours after delivery.' : '.') +
            '\n\nPlease send the item and mark it as shipped in My Orders so the buyer can follow along.',
      cta_text: 'Open My Orders',
      cta_url: SITE_URL + '/pages/user/orders'
    },
    store_plan_paid: {
      subject: 'Your shop plan is live — ' + (v.tier || 'Plan') + ' 🏪',
      heading: 'Your shop is open for business 🎉',
      body: 'Thank you ' + (v.name || 'friend') + '! Your ' + (v.tier || '') + ' shop plan (' + (v.days || '') + ' days) is paid — ' + money(v.amount) + '.\\n\\n' +
            'Your shop stays LIVE until ' + (v.ends ? new Date(v.ends).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '') + '. Renewing early simply stacks extra days on top — you never lose time.\\n\\n' +
            'Share your shop address everywhere: WhatsApp status, Instagram bio, business cards. Paid with: ' + (v.method || '') + (v.reference ? '\\nPayment reference: ' + v.reference : ''),
      cta_text: 'Open my shop',
      cta_url: SITE_URL + '/store/' + (v.slug || '')
    },
    store_plan_expiring: {
      subject: 'Your shop plan ends in ' + (v.days || 'a few') + ' day(s) ⏳',
      heading: 'A friendly nudge from Sankofa',
      body: 'Hi ' + (v.name || 'friend') + ', your shop plan runs out on ' + (v.ends ? new Date(v.ends).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '') + '.\\n\\n' +
            'Renew from Dashboard → My Store and the extra days stack onto what is left — nothing is lost by renewing early.',
      cta_text: 'Renew my plan',
      cta_url: SITE_URL + '/my-store'
    },
    store_plan_expired: {
      subject: 'Your shop is paused — renew to reopen 💤',
      heading: 'Your shop is taking a nap',
      body: 'Hi ' + (v.name || 'friend') + ', your shop plan ended and the grace days passed, so your shop is hidden for now.\\n\\n' +
            'Nothing is lost — your listings, name, logo and address are all safe. Renew from Dashboard → My Store and your shop reopens instantly at the same address.',
      cta_text: 'Reopen my shop',
      cta_url: SITE_URL + '/my-store'
    },
    store_trial_expiring: {
      subject: 'Your free shop trial ends in ' + (v.days || 'a few') + ' day(s) ⏳',
      heading: 'Your free trial is nearly over',
      body: 'Hi ' + (v.name || 'friend') + ', the free trial for your shop runs out on ' + (v.ends ? new Date(v.ends).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '') + '.\\n\\n' +
            'Pick a plan from Dashboard → My Store to keep your shop live and open. Nothing you built is lost either way — your listings, name, logo and address all stay safe.',
      cta_text: 'Choose a plan',
      cta_url: SITE_URL + '/my-store'
    },
    store_trial_expired: {
      subject: 'Your free shop trial ended — your shop is paused 💤',
      heading: 'Your free trial has ended',
      body: 'Hi ' + (v.name || 'friend') + ', the free trial for your shop ended and the grace days passed, so your shop is paused for now.\\n\\n' +
            'Nothing is lost — every listing, your logo and your web address are safe. Pick a plan from Dashboard → My Store and your shop reopens instantly.',
      cta_text: 'Reopen my shop',
      cta_url: SITE_URL + '/my-store'
    },
    store_live: {
      subject: 'Your shop is LIVE on Sankofa Market 🏪🎉',
      heading: 'Open for business!',
      body: 'Congratulations ' + (v.name || 'friend') + '! Your shop "' + (v.storeName || '') + '" just went live at:\n' + (v.shopUrl || '') + '\n\n' +
            'Make it a shop people trust:\n' +
            '  1.  List your first item (one tap in the app).\n' +
            '  2.  Get to 5 items — full shelves sell more.\n' +
            '  3.  Add your shop logo.\n' +
            '  4.  Share your shop link on WhatsApp and Instagram — every share is a free advert.\n\n' +
            'Buyers can message you straight from the shop page, and every sale stays escrow-protected.',
      cta_text: 'Add my first item',
      cta_url: SITE_URL + '/publish'
    },
    back_in_stock: {
      subject: 'It\u2019s BACK \u2014 "' + (v.title || 'your saved item') + '" is available again \u2728',
      heading: 'Back in stock \u2014 go, go, go!',
      body: (v.name || 'Hello') + ', the item you saved, "' + (v.title || 'an item') + '", is AVAILABLE again on Sankofa Market for GHS ' + (v.price || '') + '.\n\nItems that come back tend to sell out fast \u2014 if you still want it, now is the time. Your payment stays safe in escrow until you confirm delivery.',
      cta_text: 'Grab it before it goes',
      cta_url: (v.itemUrl || SITE_URL)
    },
    flash_sale: {
      subject: '\u26A1 FLASH SALE \u2014 "' + (v.title || 'a saved item') + '" is ' + (v.percent || '') + '% off',
      heading: '\u26A1 Flash sale on your saved item!',
      body: (v.name || 'Hello') + ', "' + (v.title || 'an item you saved') + '" just went on a timed flash sale: ' + (v.percent || '') + '% OFF \u2014 now GHS ' + (v.newPrice || '') + ' (was GHS ' + (v.oldPrice || '') + ').\n\nThe clock is ticking \u2014 when the countdown ends, the price goes back up by itself. Your payment stays safe in escrow until you confirm delivery.',
      cta_text: 'See the deal',
      cta_url: (v.itemUrl || SITE_URL)
    },
    price_drop: {
      subject: '\uD83D\uDCB8 Price drop \u2014 \u201C' + (v.title || 'an item you saved') + '\u201D is now GHS ' + (v.newPrice || ''),
      heading: 'An item you saved just got cheaper',
      body: (v.name || 'Hello') + ', \u201C' + (v.title || 'an item you saved') + '\u201D is now GHS ' + (v.newPrice || '') +
        ' (it was GHS ' + (v.oldPrice || '') + '). That is GHS ' + (v.saving || '') + ' off.\n\n' +
        'Sellers can change prices at any time, so if you still want it, now is a good moment. ' +
        'Your payment stays safe in escrow until you confirm delivery.\n\n' +
        'You can turn these emails off any time in Settings \u2192 Notifications on your dashboard.',
      cta_text: 'See the new price',
      cta_url: (v.itemUrl || SITE_URL)
    },
    promo_created: {
      subject: 'Your promo code ' + (v.code || '') + ' is live \uD83C\uDF9F\uFE0F',
      heading: 'Your promo code is ready to share',
      body: (v.name || 'Hello') + ', your code ' + (v.code || '') + ' now gives buyers ' + (v.percent || '') + '% off your Sankofa Store items' + (v.minSubtotal ? ' on orders over GHS ' + v.minSubtotal : '') + '.\n\nShare it on WhatsApp, Facebook and TikTok \u2014 every buyer who uses it lands on YOUR shelves. Watch the uses counter on your My Store page.',
      cta_text: 'Share my code',
      cta_url: SITE_URL + '/pages/user/my-store'
    },

    order_shipped: {
      subject: 'Your order is on its way — #' + short(v.orderId),
      heading: 'Your parcel is on its way 🚚',      body: (v.name || 'Hello') + ', "' + (v.title || 'your item') + '" has been dispatched' +
            (v.tracking ? ' (waybill ' + v.tracking + ')' : '') + '.\n\n' +
            'When it arrives, check it against the listing and tap "Confirm delivery" — that releases your payment from escrow to the seller. If you do nothing, it releases automatically 48 hours after it is marked delivered.',
      cta_text: 'Track this order',
      cta_url: SITE_URL + '/pages/user/orders'
    },
    order_delivered: {
      subject: 'Did it arrive? — order #' + short(v.orderId),
      heading: 'Please confirm your delivery',
      body: (v.name || 'Hello') + ', the seller marked "' + (v.title || 'your order') + '" as delivered.\n\n' +
            (v.deliveryCode ? 'Delivery confirmation code: ' + v.deliveryCode + '\n\n' : '') +
            'Check the item, then confirm delivery so the seller gets paid. If anything is wrong, raise a dispute instead — the money stays frozen until Sankofa support decides.\n\n' +
            'If you do nothing, the payment is released to the seller 48 hours after delivery.',
      cta_text: 'Confirm delivery',
      cta_url: SITE_URL + '/confirm-delivery?order=' + (v.orderId || '')
    },
    refund_issued: {
      subject: 'Refund issued — ' + money(v.amount) + ' for order #' + short(v.orderId),
      heading: 'Your refund is in your wallet',
      body: (v.name || 'Hello') + ', we have refunded ' + money(v.amount) + ' for "' + (v.title || 'your order') + '".\n\n' +
            'The money is in your Sankofa Wallet and can be spent on the marketplace or withdrawn.\n' +
            (v.reason ? '\nReason: ' + v.reason : '') +
            (v.note ? '\nNote from support: ' + v.note : ''),
      cta_text: 'Open my wallet',
      cta_url: SITE_URL + '/pages/user/wallet'
    },
    payout_paid: {
      subject: 'Withdrawal sent — ' + money(v.amount),
      heading: 'We have sent your money',
      body: (v.name || 'Hello') + ', ' + money(v.amount) + ' has been sent to ' + (v.destination || 'your account') + '.\n' +
            (v.reference ? '\nTransfer reference: ' + v.reference : '') +
            '\n\nIf it has not arrived within a day, reply to this email or contact sankofamarketgh@gmail.com.',
      cta_text: 'Open my wallet',
      cta_url: SITE_URL + '/pages/user/wallet'
    },
    auction_won: {
      subject: '🏆 You won "' + (v.title || 'the auction') + '"',
      heading: 'You won the auction!',
      body: (v.name || 'Congratulations') + ', you won "' + (v.title || 'the auction') + '" at ' + money(v.amount) + '.\n\n' +
            'An order has been created for you — pay from My Orders to secure it. The money is held in escrow until you confirm the item arrived as described.',
      cta_text: 'Pay for my win',
      cta_url: SITE_URL + '/pages/user/orders'
    },
    auction_sold: {
      subject: 'Your auction sold — ' + money(v.amount),
      heading: 'Your auction sold 🔨',
      body: (v.name || 'Hello') + ', "' + (v.title || 'your item') + '" sold at auction for ' + money(v.amount) + '.\n\n' +
            'Your payout is ' + money(v.payout) + ' after the ' + (v.commission != null ? v.commission : 5) + '% fee. Contact the winner in Messages to arrange delivery, and mark the order as shipped when you send it.',
      cta_text: 'Open My Orders',
      cta_url: SITE_URL + '/pages/user/orders'
    },
    dispute_resolved_seller: {
      subject: 'Dispute closed — ' + money(v.amount) + ' released to you',
      heading: 'Sankofa support decided the dispute',
      body: (v.name || 'Hello') + ', we reviewed the dispute on order #' + short(v.orderId) + ' and released ' + money(v.amount) + ' to your wallet.\n' +
            (v.note ? '\nSupport note: ' + v.note : ''),
      cta_text: 'Open my wallet',
      cta_url: SITE_URL + '/pages/user/wallet'
    }
  };
  return map[kind] || null;
}

/**
 * Send one email. Never throws: an email problem must never break a payment.
 * Pass { dryRun: true } to get the composed payload back without sending (used by tests).
 */
async function sendEmail(kind, toEmail, vars, opts) {
  try {
    if (!toEmail || String(toEmail).indexOf('@') === -1) return { sent: false, reason: 'no email address' };
    const cfg = await emailSettings();
    if (cfg.enabled === false) return { sent: false, reason: 'emails disabled in settings' };
    const content = composeEmail(kind, vars);
    if (!content) return { sent: false, reason: 'unknown email kind: ' + kind };

    const params = {
      to_email: toEmail,
      to_name: (vars && (vars.name || vars.buyerName || vars.sellerName)) || 'there',
      subject: content.subject,
      heading: content.heading,
      body: content.body,
      cta_text: content.cta_text || '',
      cta_url: content.cta_url || SITE_URL,
      order_ref: (vars && vars.orderId) ? String(vars.orderId).substring(0, 8).toUpperCase() : '',
      site_name: 'Sankofa Market',
      support_email: 'sankofamarketgh@gmail.com',
      support_phone: '0273659806'
    };
    if (opts && opts.dryRun) return { sent: false, dryRun: true, kind: kind, to: toEmail, params: params, templateId: cfg.templateId };

    const res = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: cfg.serviceId,
        template_id: cfg.templateId,
        user_id: cfg.publicKey,
        template_params: params
      })
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      console.error('EmailJS refused the email (' + res.status + '):', text.slice(0, 220));
      // The provider's own words are the most useful thing an admin can see, so keep more of them.
      return { sent: false, status: res.status, reason: text.slice(0, 400) };
    }
    console.log('📧 ' + kind + ' email sent to ' + toEmail);
    return { sent: true };
  } catch (e) {
    console.error('sendEmail failed', e && e.message);
    return { sent: false, reason: String(e && e.message).slice(0, 160) };
  }
}

/** Look up an email address for a user id (profiles store it, and so do orders). */
async function emailForUser(uid) {
  if (!uid) return null;
  try {
    const d = await db.collection('users').doc(uid).get();
    if (d.exists) return d.data().email || null;
  } catch (e) {}
  try {
    const u = await admin.auth().getUser(uid);
    return u.email || null;
  } catch (e) {}
  return null;
}

/** Get user profile data (phone, prefs). */
async function profileForUser(uid) {
  if (!uid) return {};
  try {
    const d = await db.collection('users').doc(uid).get();
    if (d.exists) return d.data() || {};
  } catch (e) {}
  return {};
}

/** Get notification settings. */
async function notificationSettings() {
  try {
    const d = await db.collection('settings').doc('notifications').get();
    if (d.exists) return d.data() || {};
  } catch (e) {}
  return {};
}

/** Send WhatsApp/SMS notification if configured. Gracefully skips if not configured. */
async function sendWhatsAppNotification(to, message, meta) {
  try {
    if (!to || !message) return { sent: false, reason: 'missing' };
    const cfg = await notificationSettings();
    const webhook = cfg.whatsappWebhookUrl || process.env.WHATSAPP_WEBHOOK_URL || cfg.smsWebhookUrl || process.env.SMS_WEBHOOK_URL;
    if (!webhook) return { sent: false, reason: 'not_configured' };
    const payload = {
      to: to,
      phone: to,
      message: message,
      ... (meta || {})
    };
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { sent: res.ok, status: res.status };
  } catch (e) {
    console.error('whatsapp/sms notification failed', e && e.message);
    return { sent: false, reason: 'error' };
  }
}

/** Admin: send a test receipt to yourself to check the template. */
exports.sendTestReceipt = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  if (!(await adminCaller(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only.');
  const to = (data || {}).to || (context.auth.token && context.auth.token.email);
  const kind = (data || {}).kind || 'payment_receipt';
  const dry = !!(data || {}).dryRun;
  const out = await sendEmail(kind, to, {
    name: 'Test Admin', orderId: 'TESTOID12345678', amount: 120, title: 'Test item', payout: 114,
    commission: 5, method: 'wallet', reference: 'TEST-REF-1', tracking: 'WB-123', destination: 'MTN 0240000000'
  }, { dryRun: dry });
  return { success: true, to: to, kind: kind, result: out };
});

/**
 * The list of email kinds, checked against composeEmail so it can never drift out of step.
 * (If a kind is renamed in the map above, it silently drops out of this list instead of
 * being offered in the admin panel and then failing.)
 */
async function availableEmailKinds() {
  const wanted = ['welcome', 'account_approved', 'payment_receipt', 'sale_received', 'order_shipped',
                  'order_delivered', 'refund_issued', 'payout_paid', 'auction_won', 'auction_sold', 'dispute_closed',
                  'back_in_stock', 'flash_sale', 'price_drop', 'promo_created',
                  'store_live', 'store_plan_paid', 'store_plan_expiring', 'store_plan_expired',
                  'store_trial_expiring', 'store_trial_expired'];
  return wanted.filter(k => !!composeEmail(k, {}));
}

const TEST_EMAIL_VARS = {
  name: 'Test Buyer', buyerName: 'Test Buyer', sellerName: 'Test Seller',
  orderId: 'TESTOID12345678', amount: 120, title: 'Test item', payout: 114,
  commission: 5, method: 'wallet', reference: 'TEST-REF-1', tracking: 'WB-123',
  destination: 'MTN 0240000000', reason: 'Item not as described', note: 'Refunded in full.',
  auto: true, pendingApproval: true, support_phone: '0273659806'
};

/**
 * Everything the admin "Emails" page needs: read the current settings, save new ones, show a
 * preview of any email, and send a real test so the provider's answer can be read verbatim.
 *
 * The key is never handed back to the browser — only its last 6 characters, so an admin can
 * confirm what is stored without the value being copyable from the page.
 */
exports.emailAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  if (!(await adminCaller(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only.');

  const d = data || {};
  const action = String(d.action || 'status');
  const ref = db.collection('settings').doc('email');

  if (action === 'status') {
    const cfg = await emailSettings();
    let saved = null;
    try { const snap = await ref.get(); saved = snap.exists ? (snap.data() || {}) : null; } catch (e) {}
    const kinds = await availableEmailKinds();
    return {
      success: true,
      kinds: kinds,
      usingDefaults: !saved,
      enabled: cfg.enabled !== false,
      serviceId: cfg.serviceId,
      templateId: cfg.templateId,
      keyTail: cfg.publicKey ? String(cfg.publicKey).slice(-6) : '',
      keyLength: cfg.publicKey ? String(cfg.publicKey).length : 0,
      configured: !!(saved && (saved.emailjsKey || saved.publicKey) && saved.serviceId && saved.templateId),
      lastTest: cfg.lastTest || null,
      updatedAt: cfg.updatedAt || null,
      updatedBy: (saved && saved.updatedBy) || null
    };
  }

  if (action === 'save') {
    const serviceId = String(d.serviceId || '').trim();
    const templateId = String(d.templateId || '').trim();
    const emailjsKey = String(d.emailjsKey || '').trim();
    const enabled = d.enabled !== false;
    if (!serviceId) throw new functions.https.HttpsError('invalid-argument', 'The Service ID is needed — copy it from EmailJS → Email Services.');
    if (!templateId) throw new functions.https.HttpsError('invalid-argument', 'The Template ID is needed — copy it from EmailJS → Email Templates.');
    if (emailjsKey && !/^[A-Za-z0-9._-]{10,80}$/.test(emailjsKey)) {
      throw new functions.https.HttpsError('invalid-argument', 'That does not look like an EmailJS public key. It is a single word of about 18 letters and numbers, like nQCOm9xJnMIZHqmIW.');
    }
    const patch = { serviceId: serviceId, templateId: templateId, enabled: enabled, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: (context.auth.token && context.auth.token.email) || context.auth.uid };
    if (emailjsKey) patch.emailjsKey = emailjsKey;
    await ref.set(patch, { merge: true });
    // A stale "publicKey" field would win over nothing but confuse the next reader — drop it.
    if (emailjsKey && d.clearLegacyKey !== false) { try { await ref.update({ publicKey: admin.firestore.FieldValue.delete() }); } catch (e) {} }
    return { success: true, saved: true, enabled: enabled, serviceId: serviceId, templateId: templateId, keyTail: emailjsKey ? emailjsKey.slice(-6) : '' };
  }

  if (action === 'preview') {
    const kind = String(d.kind || 'welcome');
    const content = composeEmail(kind, TEST_EMAIL_VARS);
    if (!content) throw new functions.https.HttpsError('invalid-argument', 'Unknown email kind: ' + kind);
    return { success: true, kind: kind, subject: content.subject, heading: content.heading, body: content.body, cta_text: content.cta_text || '', cta_url: content.cta_url || SITE_URL };
  }

  if (action === 'test') {
    const to = String(d.to || (context.auth.token && context.auth.token.email) || '').trim();
    const kind = String(d.kind || 'welcome');
    if (!to || to.indexOf('@') === -1) throw new functions.https.HttpsError('invalid-argument', 'Type the address to send the test to, for example sankofamarketgh@gmail.com.');
    const cfg = await emailSettings();
    const res = await sendEmail(kind, to, TEST_EMAIL_VARS, {});
    const outcome = {
      at: admin.firestore.FieldValue.serverTimestamp(),
      to: to,
      kind: kind,
      sent: !!res.sent,
      reason: res.reason || null,
      status: res.status || null,
      via: { serviceId: cfg.serviceId, templateId: cfg.templateId, keyTail: cfg.publicKey ? String(cfg.publicKey).slice(-6) : '' }
    };
    try { await ref.set({ lastTest: outcome }, { merge: true }); } catch (e) {}
    return {
      success: true, to: to, kind: kind, sent: !!res.sent, status: res.status || null,
      reason: res.reason || null, serviceId: cfg.serviceId, templateId: cfg.templateId,
      enabled: cfg.enabled !== false,
      hint: res.sent ? null : hintForEmailFailure(res, cfg)
    };
  }

  throw new functions.https.HttpsError('invalid-argument', 'Unknown action: ' + action);
});

/**
 * Turn the provider's error into something actionable, in plain words.
 */
function hintForEmailFailure(res, cfg) {
  const reason = String((res && res.reason) || '').toLowerCase();
  if (reason.indexOf('account not found') !== -1) {
    return 'EmailJS does not recognise the public key that is stored. Open dashboard.emailjs.com → Account → General, copy the Public Key again, and paste it in the box above.';
  }
  if (reason.indexOf('service') !== -1 && reason.indexOf('not found') !== -1) {
    return 'The Service ID (' + (cfg && cfg.serviceId) + ') does not exist in your EmailJS account. Check EmailJS → Email Services and paste the ID exactly.';
  }
  if (reason.indexOf('template') !== -1 && reason.indexOf('not found') !== -1) {
    return 'The Template ID (' + (cfg && cfg.templateId) + ') does not exist in your EmailJS account. Check EmailJS → Email Templates and paste the ID exactly.';
  }
  if (reason.indexOf('recipient') !== -1 || reason.indexOf('to_email') !== -1) {
    return 'EmailJS accepted the request but the template has no recipient. In your EmailJS template set "To Email" to {{to_email}}.';
  }
  if (reason.indexOf('disabled') !== -1) {
    return 'Email sending is switched off in this page. Turn the switch on and save, then send the test again.';
  }
  return 'The provider refused the message for the reason shown. The most common causes are a wrong public key, a wrong template ID, or the EmailJS service being disconnected.';
}

/**
 * "You are verified" — sent when an admin approves an account.
 * Approval is `users/{uid}.status = 'approved'`, written by the admin panel. This is what makes
 * the promise on the register page ("we'll email you as soon as it is verified") true.
 */
exports.emailAccountApproved = functions.firestore
  .document('users/{uid}')
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data() || {};
      const after = change.after.data() || {};
      // only when it BECOMES approved — not on every later profile edit
      if (after.status !== 'approved' || before.status === 'approved') return null;
      const to = after.email;
      if (!to || String(to).indexOf('@') === -1) return null;
      const name = after.firstName || after.displayName || after.name || String(to).split('@')[0];
      const res = await sendEmail('account_approved', to, { name: name });
      console.log('📧 account approved email:', JSON.stringify(res));
    } catch (e) {
      console.error('emailAccountApproved failed (approval still stands):', e && e.message);
    }
    return null;
  });

/**
 * Emails for the status changes that happen in the browser (seller marks shipped/delivered).
 * Firestore triggers run server-side, so these send even if the seller closed the tab.
 */
exports.emailOrderStatusUpdates = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data() || {};
      let after = change.after.data() || {};
      if (before.status === after.status) return null;
      const orderId = context.params.orderId;
      const base = {
        orderId: orderId,
        title: after.productTitle || after.title || 'your order',
        amount: after.total || after.amount || 0
      };
      if (after.status === 'shipped') {
        const to = await emailForUser(after.buyerId || after.userId);
        await sendEmail('order_shipped', to, Object.assign({}, base, { name: after.buyerName, tracking: after.trackingNumber }));
        try {
          const buyer = await profileForUser(after.buyerId || after.userId);
          if (buyer && buyer.phone && (buyer.notificationsEnabled !== false)) {
            await sendWhatsAppNotification(buyer.phone, 'Sankofa Market: Your order #' + short(orderId) + ' has been shipped. Track in My Orders.', { type: 'order_shipped', orderId: orderId });
          }
        } catch (e) { /* best effort */ }
      } else if (after.status === 'delivered') {
        // Generate delivery confirmation code if not present (server-side)
        if (!after.deliveryConfirmationCode) {
          try {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            await change.after.ref.update({
              deliveryConfirmationCode: code,
              deliveryCodeGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            after = Object.assign({}, after, { deliveryConfirmationCode: code });
          } catch (e) {
            console.error('delivery code generation failed', e && e.message);
          }
        }
        const to = await emailForUser(after.buyerId || after.userId);
        await sendEmail('order_delivered', to, Object.assign({}, base, { name: after.buyerName, deliveryCode: after.deliveryConfirmationCode }));
        // Also create in-app notification for buyer
        try {
          await db.collection('notifications').add({
            userId: after.buyerId || after.userId,
            type: 'order_status_update',
            title: 'Item delivered',
            message: after.deliveryConfirmationCode
              ? 'Your order has been delivered. Use delivery code ' + after.deliveryConfirmationCode + ' to confirm receipt.'
              : 'Your order has been delivered. Please confirm receipt on the confirm delivery page.',
            orderId: orderId,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) {
          console.error('delivery notification failed', e && e.message);
        }
        try {
          const buyer = await profileForUser(after.buyerId || after.userId);
          if (buyer && buyer.phone && (buyer.notificationsEnabled !== false)) {
            await sendWhatsAppNotification(buyer.phone, 'Sankofa Market: Your order #' + short(orderId) + ' has been delivered. Confirm delivery' + (after.deliveryConfirmationCode ? ' with code ' + after.deliveryConfirmationCode : '') + ' to release payment.', { type: 'order_delivered', orderId: orderId });
          }
        } catch (e) { /* best effort */ }
      }
    } catch (e) {
      console.error('emailOrderStatusUpdates failed', e && e.message);
    }
    return null;
  });

// ============================================================================
// MULTI-SELLER CARTS
// ============================================================================
//
// A cart can hold items from several sellers. That used to produce ONE order with no
// sellerId at all — so when the buyer confirmed delivery, the release was refused with
// "This order has no seller on record" and the money sat in escrow with nobody able to
// claim it.
//
// Now the buyer still pays ONCE, but the server splits the paid order into one child order
// per seller (deterministic ids, so it is idempotent). Each child holds that seller's slice
// in escrow with its own commission and payout. Confirming delivery releases every slice at
// once, so each seller is paid correctly and none of them can be paid twice.
//
// Single-seller carts are untouched: no children are created, exactly as before.

/** Group an order's items by seller id. */
function groupItemsBySeller(items) {
  const groups = new Map();
  (items || []).forEach(it => {
    const sid = (it && (it.sellerId || it.seller)) ? (it.sellerId || null) : null;
    const key = sid || '__unknown__';
    if (!groups.has(key)) groups.set(key, { sellerId: sid, sellerName: (it && it.seller) || null, items: [], subtotal: 0 });
    const g = groups.get(key);
    g.items.push(it);
    const price = Number(it.price || it.amount || 0) * Number(it.quantity || 1);
    g.subtotal = round2(g.subtotal + price);
    if (!g.sellerName && it.seller) g.sellerName = it.seller;
  });
  return groups;
}

/** Create the per-seller child orders for a paid multi-seller order. Idempotent. */
async function splitPaidOrderBySeller(orderId) {
  const orderRef = db.collection('orders').doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) return { split: false, reason: 'order not found' };
  const order = orderDoc.data();
  if (order.childOrderIds && order.childOrderIds.length) return { split: false, reason: 'already split', children: order.childOrderIds };
  if (order.sellerId) return { split: false, reason: 'single seller' };

  const groups = groupItemsBySeller(order.items);
  const real = [...groups.values()].filter(g => g.sellerId);
  if (real.length < 2) {
    // one real seller (or none): keep the simple single-seller shape
    if (real.length === 1) {
      const onePerks = await fetchMoneyPerks(new Map(), real[0].sellerId);
      const oneCommission = round2((order.total || 0) * onePerks.commissionRate / 100);
      await orderRef.update({
        sellerId: real[0].sellerId,
        sellerName: order.sellerName || real[0].sellerName || null,
        commission: onePerks.commissionRate,
        commissionAmount: oneCommission,
        sellerPayout: round2((order.total || 0) - oneCommission),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { split: false, reason: 'merged into one seller', sellerId: real[0].sellerId };
    }
    return { split: false, reason: 'no seller ids on the items' };
  }

  const total = round2(order.total || order.amount || 0);
  const nowTs = admin.firestore.FieldValue.serverTimestamp();
  const children = [];
  let allocated = 0;
  // Every seller's slice pays THEIR tier's fee — a Diamond seller in a mixed cart pays 0%.
  const perksBySeller = new Map();
  let totalCommission = 0;

  for (let i = 0; i < real.length; i++) {
    const g = real[i];
    const isLast = (i === real.length - 1);
    // the last slice takes the rounding remainder, so the children always add back to the total
    const slice = isLast ? round2(total - allocated) : round2(g.subtotal * 100 / Math.max(1, real.reduce((s, x) => s + x.subtotal, 0)) * total / 100);
    allocated = round2(allocated + slice);
    const gPerks = await fetchMoneyPerks(perksBySeller, g.sellerId);
    const rate = gPerks.commissionRate;
    const commission = round2(slice * rate / 100);
    const payout = round2(slice - commission);
    totalCommission = round2(totalCommission + commission);
    const childId = orderId + '_s' + String(g.sellerId).slice(0, 6);
    await db.collection('orders').doc(childId).set({
      buyerId: order.buyerId, userId: order.userId || order.buyerId, buyerName: order.buyerName,
      sellerId: g.sellerId, sellerName: g.sellerName || order.sellerName || null,
      items: g.items,
      productTitle: (g.items[0] && g.items[0].title) || order.productTitle || 'Item',
      parentOrderId: orderId,
      isMultiSellerChild: true,
      total: slice, amount: slice, currency: 'GHS',
      commission: rate, commissionAmount: commission, sellerPayout: payout,
      status: 'paid', paymentStatus: 'paid',
      walletPaid: order.walletPaid === true,
      paidViaServer: order.paidViaServer === true,
      escrowHeldByServer: true,
      escrowStatus: 'held', escrowHeldAt: nowTs, paidAt: order.paidAt || nowTs,
      paymentMethod: order.paymentMethod || null,
      createdAt: nowTs, updatedAt: nowTs
    }, { merge: true });
    children.push(childId);
  }

  await orderRef.update({
    isMultiSeller: true,
    childOrderIds: children,
    multiSellerCount: children.length,
    commissionAmount: totalCommission,
    sellerPayout: round2(total - totalCommission),
    updatedAt: nowTs
  });

  // let each seller know they have a sale
  try {
    for (const cid of children) {
      const c = (await db.collection('orders').doc(cid).get()).data() || {};
      const sellerEmail = c.sellerEmail || await emailForUser(c.sellerId);
      await sendEmail('sale_received', sellerEmail, {
        name: c.sellerName, orderId: cid, amount: c.total, title: c.productTitle,
        payout: c.sellerPayout, commission: c.commission
      });
    }
  } catch (e) { console.error('multi-seller sale emails failed', e && e.message); }

  console.log(`🧾 Order ${orderId} split into ${children.length} seller orders (total ${total})`);
  return { split: true, children, total };
}

/** Admin: split any order that was paid before this existed (or if a split ever failed). */
exports.splitMultiSellerOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  if (!(await adminCaller(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only.');
  const orderId = (data || {}).orderId;
  if (!orderId) throw new functions.https.HttpsError('invalid-argument', 'orderId is required.');
  const out = await splitPaidOrderBySeller(orderId);
  return {
    success: true,
    split: !!out.split,
    children: out.children || [],
    message: out.split ? 'Split into ' + out.children.length + ' seller orders.' : ('Nothing to split: ' + out.reason)
  };
});

// ============================================================================
// PRIVATE CHAT ATTACHMENTS
// ============================================================================
//
// ⚠️ The problem: Storage rules cannot read Firestore, so they cannot ask "is this person a
// member of this conversation?". The best they could check was "is signed in" — which meant
// any member who got hold of an attachment's path or download URL could open someone else's
// chat photos.
//
// The fix: attachments are no longer readable through Storage at all. They are served by
// `chatAttachment` below, and the only way to get a link is `authoriseChatAttachment`, which
// checks — on the server, with Firestore access — that the caller really is in that
// conversation.
//
// The link is a random 48-character token stored in `chatAttachments/{token}`, so it is
// unguessable, tied to one file, revocable (delete the token) and expires after 90 days.
// Nothing in the URL reveals the storage path.

const crypto = require('crypto');
const ATTACHMENT_DAYS = 90;

function attachmentToken() {
  return crypto.randomBytes(24).toString('hex');
}

function isParticipant(conv, uid) {
  return Array.isArray(conv.participants) && conv.participants.indexOf(uid) !== -1;
}

/** May this account open attachments in this conversation? (participant, or an admin) */
async function canAccessConversation(conversationId, uid) {
  try {
    const c = await db.collection('conversations').doc(conversationId).get();
    if (!c.exists) return { ok: false, reason: 'conversation not found' };
    const conv = c.data() || {};
    if (isParticipant(conv, uid)) return { ok: true, conv: conv };
    const u = await db.collection('users').doc(uid).get();
    if (u.exists && u.data().role === 'admin') return { ok: true, conv: conv, admin: true };
    return { ok: false, reason: 'not a member of this conversation' };
  } catch (e) {
    return { ok: false, reason: 'lookup failed: ' + e.message };
  }
}

/**
 * Ask for a private link to a chat attachment.
 * Body: { conversationId, storagePath }
 * Returns: { url, token, expiresAt }
 */
exports.authoriseChatAttachment = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  const uid = context.auth.uid;
  const conversationId = (data || {}).conversationId;
  const storagePath = String((data || {}).storagePath || '');
  if (!conversationId || !storagePath) {
    throw new functions.https.HttpsError('invalid-argument', 'conversationId and storagePath are required.');
  }
  // the file must live under this conversation — the endpoint must not become a skeleton key
  if (storagePath.indexOf('chat/' + conversationId + '/') !== 0 || storagePath.indexOf('..') !== -1) {
    throw new functions.https.HttpsError('permission-denied', 'That file does not belong to this conversation.');
  }

  const access = await canAccessConversation(conversationId, uid);
  if (!access.ok) {
    throw new functions.https.HttpsError('permission-denied',
      access.reason === 'conversation not found'
        ? 'That conversation no longer exists.'
        : 'Only the people in this conversation can open its attachments.');
  }

  const token = attachmentToken();
  const expiresAt = new Date(Date.now() + ATTACHMENT_DAYS * 24 * 60 * 60 * 1000);
  await db.collection('chatAttachments').doc(token).set({
    conversationId: conversationId,
    storagePath: storagePath,
    uploaderUid: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt)
  });

  return {
    success: true,
    url: 'https://us-central1-sankofa-market.cloudfunctions.net/chatAttachment?t=' + token,
    token: token,
    expiresAt: expiresAt.toISOString()
  };
});

/**
 * Serves one attachment. Public endpoint by design — an <img src> cannot send an auth header —
 * protected by the unguessable per-file token.
 *   GET /chatAttachment?t=<token>
 */
exports.chatAttachment = functions.https.onRequest(async (req, res) => {
  const token = (req.query && req.query.t) || '';
  if (!token || !/^[a-f0-9]{48}$/.test(String(token))) {
    res.status(400).send('Bad link');
    return;
  }

  let doc;
  try {
    doc = await db.collection('chatAttachments').doc(String(token)).get();
  } catch (e) {
    res.status(500).send('Lookup failed');
    return;
  }
  if (!doc.exists) {
    res.status(404).send('This attachment link is no longer valid.');
    return;
  }
  const meta = doc.data() || {};
  const expiry = meta.expiresAt && (meta.expiresAt.toDate ? meta.expiresAt.toDate() : new Date(meta.expiresAt));
  if (expiry && expiry.getTime() < Date.now()) {
    res.status(410).send('This attachment link has expired.');
    return;
  }

  const file = admin.storage().bucket().file(meta.storagePath);
  let info;
  try {
    const got = await file.getMetadata();
    info = got[0] || {};
  } catch (e) {
    res.status(404).send('That file is no longer there.');
    return;
  }

  const total = Number(info.size || 0);
  res.set('Content-Type', info.contentType || 'application/octet-stream');
  res.set('Cache-Control', 'private, max-age=3600');
  res.set('Accept-Ranges', 'bytes');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', 'inline; filename="' + String(meta.fileName || 'attachment').replace(/"/g, '') + '"');

  // simple Range support so voice notes and video can play/scrub
  const m = /bytes=(\d*)-(\d*)/.exec(String(req.headers.range || ''));
  if (m && total) {
    const start = m[1] ? parseInt(m[1], 10) : Math.max(0, total - parseInt(m[2] || '0', 10));
    const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
    if (start > end || start >= total) {
      res.status(416).set('Content-Range', 'bytes */' + total).end();
      return;
    }
    res.status(206);
    res.set('Content-Range', 'bytes ' + start + '-' + end + '/' + total);
    res.set('Content-Length', String(end - start + 1));
    file.createReadStream({ start: start, end: end }).on('error', () => res.end()).pipe(res);
    return;
  }

  if (total) res.set('Content-Length', String(total));
  file.createReadStream().on('error', () => res.end()).pipe(res);
});

/**
 * Revoke every attachment link for one conversation (used when a chat is deleted, or after a
 * mistake). Admins, or a member of that conversation.
 */
exports.revokeChatAttachments = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  const conversationId = (data || {}).conversationId;
  if (!conversationId) throw new functions.https.HttpsError('invalid-argument', 'conversationId is required.');
  const access = await canAccessConversation(conversationId, context.auth.uid);
  if (!access.ok) throw new functions.https.HttpsError('permission-denied', 'You are not in that conversation.');

  const snap = await db.collection('chatAttachments').where('conversationId', '==', conversationId).limit(500).get();
  let n = 0;
  for (const d of snap.docs) { await d.ref.delete(); n++; }
  return { success: true, revoked: n, message: 'Revoked ' + n + ' attachment link(s).' };
});

/**
 * Get or create wallet — ensures wallet exists with 0 balance
 */
async function getOrCreateWallet(userId, transaction) {
  const walletRef = db.collection('wallets').doc(userId);
  let walletDoc;
  if (transaction) walletDoc = await transaction.get(walletRef);
  else walletDoc = await walletRef.get();

  if (!walletDoc.exists) {
    const newWallet = {
      userId: userId,
      balance: 0,
      currency: 'GHS',
      totalTopups: 0,
      totalSpent: 0,
      totalEarnings: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (transaction) transaction.set(walletRef, newWallet);
    else await walletRef.set(newWallet);
    return { ...newWallet, balance: 0, _ref: walletRef };
  }
  return { ...walletDoc.data(), _ref: walletRef, _exists: true };
}

/**
 * Credit a wallet from a VERIFIED Paystack charge (wallet top-up).
 *
 * Three checks the old version was missing:
 *   • the Paystack transaction must belong to the caller  → metadata.userId === caller uid
 *     (metadata is stored by Paystack when the charge is created; the browser cannot forge it)
 *   • the reference may only ever be spent once, by ANYONE → `paystackRefs/{reference}`
 *   • the amount is taken from Paystack, and if the client claims a different amount we stop.
 */
exports.verifyWalletTopup = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const reference = (data || {}).reference;
  const claimedAmount = (data || {}).amount;
  if (!reference) throw new functions.https.HttpsError('invalid-argument', 'reference required');

  const payData = await paystackVerifyReference(reference);
  const status = String(payData.status || '').toLowerCase();
  if (status !== 'success') {
    throw new functions.https.HttpsError('failed-precondition', 'That top-up was not successful (Paystack says "' + status + '"). Nothing was credited.');
  }

  const currency = String(payData.currency || 'GHS').toUpperCase();
  if (currency !== 'GHS') {
    throw new functions.https.HttpsError('failed-precondition', 'Only GHS top-ups are accepted (this one was ' + currency + ').');
  }

  const userId = context.auth.uid;
  const md = paystackMetadata(payData);

  // The payment must be linked to this account. Newer wallet pages send metadata.userId;
  // if it is missing we fall back to the reference format WALLET-<uid6>-<timestamp>, which is
  // how the top-up was created, and the single-use ledger below still prevents replays.
  const uid6 = userId.slice(0, 6).toUpperCase();
  const refLooksLikeMine = typeof reference === 'string' && reference.toUpperCase().indexOf('WALLET-' + uid6 + '-') === 0;
  if (md.userId && md.userId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'That payment was made from a different account.');
  }
  if (!md.userId && !refLooksLikeMine) {
    throw new functions.https.HttpsError('permission-denied',
      'We could not match that payment to your account. Please refresh the wallet page (Ctrl+Shift+R) and start the top-up again — you have not been charged twice.');
  }
  if (md.purpose === 'order_payment') {
    throw new functions.https.HttpsError('failed-precondition', 'That reference is an order payment, not a wallet top-up.');
  }

  const verifiedAmountGHS = round2(Number(payData.amount || 0) / 100);   // Paystack sends pesewas
  if (!(verifiedAmountGHS > 0)) throw new functions.https.HttpsError('failed-precondition', 'That payment has no amount.');
  if (claimedAmount != null && pesewas(claimedAmount) !== pesewas(verifiedAmountGHS)) {
    throw new functions.https.HttpsError('failed-precondition',
      'The amount paid (GHS ' + verifiedAmountGHS.toFixed(2) + ') does not match the amount requested (GHS ' +
      round2(claimedAmount).toFixed(2) + '). Nothing was credited — please contact support.');
  }

  const refRef = db.collection('paystackRefs').doc(reference);
  const walletRef = db.collection('wallets').doc(userId);

  const result = await db.runTransaction(async (tx) => {
    const refDoc = await tx.get(refRef);
    const walletDoc = await tx.get(walletRef);

    if (refDoc.exists) {
      const used = refDoc.data() || {};
      if (used.userId === userId && used.kind === 'wallet_topup') {
        return { alreadyCredited: true, newBalance: round2(walletDoc.exists ? walletDoc.data().balance : 0), amount: round2(used.amount) };
      }
      throw new functions.https.HttpsError('failed-precondition',
        'This payment has already been used. A reference can only be credited once.');
    }

    const wallet = walletDoc.exists ? walletDoc.data() : { balance: 0, totalTopups: 0, totalSpent: 0, totalEarnings: 0 };
    const newBalance = round2(Number(wallet.balance || 0) + verifiedAmountGHS);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (walletDoc.exists) {
      tx.update(walletRef, {
        balance: newBalance,
        totalTopups: round2(Number(wallet.totalTopups || 0) + verifiedAmountGHS),
        updatedAt: now
      });
    } else {
      tx.set(walletRef, {
        userId: userId, balance: newBalance, currency: 'GHS',
        totalTopups: verifiedAmountGHS, totalSpent: 0, totalEarnings: 0,
        createdAt: now, updatedAt: now
      });
    }

    tx.set(refRef, {
      reference: reference, kind: 'wallet_topup', userId: userId,
      amount: verifiedAmountGHS, createdAt: now
    });

    tx.set(db.collection('walletTransactions').doc(), {
      userId: userId,
      type: 'topup',
      amount: verifiedAmountGHS,
      balanceAfter: newBalance,
      reference: reference,
      paystackReference: reference,
      gateway_response: payData.gateway_response || null,
      description: 'Wallet top-up via Paystack',
      status: 'completed',
      createdAt: now
    });

    return { newBalance, amount: verifiedAmountGHS };
  });

  console.log(`✅ Wallet top-up GHS ${result.amount} for ${userId} via ${reference} → balance ${result.newBalance}${result.alreadyCredited ? ' (already credited)' : ''}`);
  return {
    success: true,
    alreadyCredited: !!result.alreadyCredited,
    message: result.alreadyCredited ? 'Already credited' : 'Wallet credited',
    balance: result.newBalance, amount: result.amount, reference
  };
});

/**
 * Pay for an order from the Sankofa Wallet. Money moves from the buyer's wallet into escrow.
 * The total always comes from the order document (never from the browser), and only a
 * server-recorded payment can ever be released afterwards.
 */
/* ============================================================================
 * CART PRICE CHECK — the server checks the prices before any money moves
 *
 * The checkout runs in the buyer's browser and writes the order (items, prices,
 * subtotal and total). Before this check, the wallet and card paths charged the
 * total exactly as written, so a signed-in buyer could pay less than the price.
 *
 * Now, before a single pesewa is taken or marked paid, every cart row is checked
 * against the live product record: the right unit price (an active flash sale
 * counts), the same seller, a listing still for sale, a sane quantity, and a
 * subtotal and total that add up. Anything else is refused and nothing moves.
 *
 * Offer and auction orders are skipped on purpose: they carry their own agreed price,
 * and the security rules already check it against the offer or the auction.
 * ========================================================================== */

/* === CART PRICE CORE START === */
/* Pure helpers — extracted by cart-price-test.mjs. No Firestore in here. */

/** Timestamp-ish value (Firestore Timestamp, Date, ISO text, milliseconds) → ms, or 0. */
function smPriceMs(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') { try { return v.toDate().getTime(); } catch (e) { return 0; } }
  const ms = new Date(v).getTime();
  return isNaN(ms) ? 0 : ms;
}

/** The discount a timed sale gives right now (0 = no live sale). Same rule as the product page. */
function smPriceFlashPercent(product, nowMs) {
  const f = product && product.flashSale;
  if (!f || !f.endsAt) return 0;
  const pct = Number(f.percent || 0);
  if (!(pct >= 1)) return 0;
  return smPriceMs(f.endsAt) > nowMs ? pct : 0;
}

/** What ONE unit costs right now, in whole pesewas. Same rounding as the product page's flash price. */
function smPriceUnitPesewas(product, nowMs) {
  const base = Number((product && product.price) || 0);
  const pct = smPriceFlashPercent(product, nowMs);
  return pct ? Math.round(base * (1 - pct / 100) * 100) : Math.round(base * 100);
}

/** A GHS amount (number or text) in whole pesewas. Anything that is not a number counts as 0. */
function smPricePesewas(v) {
  const n = Number(v);
  return isFinite(n) ? Math.round(n * 100) : 0;
}

/** The product a cart row refers to. Rows saved before productId existed carry the product id as their id. */
function smPriceRowProductId(it) {
  if (!it) return '';
  if (it.productId) return String(it.productId);
  const id = it.id ? String(it.id) : '';
  return (id && id.indexOf('local-') !== 0) ? id : '';
}

/** Still for sale. The app treats a missing isActive as live (the same convention as the listing pages). */
function smPriceSellable(product) {
  return !!product && product.isActive !== false && product.isSold !== true;
}

/* --- VARIANT CORE (mirrors js/variants.js — keep the two in step; variants-test.mjs checks they agree) --- */

/** The listing's kinds of choice, cleaned: at most two, text only, each with at least one option. */
function smVariantGroupsOf(product) {
  const raw = product && Array.isArray(product.variants) ? product.variants : [];
  return raw.slice(0, 2).map(function (g) {
    const opts = g && Array.isArray(g.options) ? g.options : [];
    return {
      name: String((g && g.name) || '').trim(),
      options: opts.map(function (o) { return String(o == null ? '' : o).trim(); }).filter(Boolean)
    };
  }).filter(function (g) { return g.name && g.options.length; });
}

/** Is the buyer's choice right for these kinds? A short problem for the buyer, or '' when it is right. */
function smVariantProblem(groups, variant) {
  const gs = Array.isArray(groups) ? groups : [];
  const v = (variant && typeof variant === 'object' && !Array.isArray(variant)) ? variant : null;
  if (!gs.length) return (v && Object.keys(v).length) ? 'this item has no choices' : '';
  const missing = [];
  const bad = [];
  gs.forEach(function (g) {
    const val = v ? v[g.name] : undefined;
    if (val === undefined || val === null || String(val) === '') { missing.push(g.name); return; }
    if (g.options.map(String).indexOf(String(val)) === -1) bad.push(g.name + ' "' + String(val) + '" is no longer available');
  });
  const extra = v ? Object.keys(v).filter(function (k) { return !gs.some(function (g) { return g.name === k; }); }) : [];
  if (bad.length) return bad.join(', ');
  if (missing.length) return 'choose ' + missing.map(function (n) { return 'a ' + n.toLowerCase(); }).join(' and ');
  if (extra.length) return 'this item has no ' + extra.join(', ');
  return '';
}

/**
 * The verdict for one order. productsById maps product id → product data (absent = listing gone).
 * Returns { ok, skipped, problems[], subtotalP }. Money may move only when ok or skipped is true.
 */
function smCartPriceVerdict(order, productsById, nowMs) {
  const o = order || {};
  if (o.offerId || o.auctionId) return { ok: true, skipped: true, problems: [], subtotalP: 0 };
  const lines = [];                 // problems with a row: the buyer sees these first
  const items = Array.isArray(o.items) ? o.items : [];
  if (!items.length) lines.push('the order has no items');
  if (items.length > 50) lines.push('the order has too many items');
  let subtotalP = 0;
  items.forEach(function (it) {
    const label = String((it && it.title) || 'an item').slice(0, 120);
    const pid = smPriceRowProductId(it);
    if (!pid) { lines.push('"' + label + '" has no product reference'); return; }
    const p = productsById ? productsById[pid] : null;
    if (!p) { lines.push('"' + label + '" is no longer listed'); return; }
    if (!smPriceSellable(p)) { lines.push('"' + label + '" is no longer for sale'); return; }
    if (it.sellerId && p.sellerId && String(it.sellerId) !== String(p.sellerId)) {
      lines.push('"' + label + '" now belongs to a different seller'); return;
    }
    const choiceProblem = smVariantProblem(smVariantGroupsOf(p), it.variant);
    if (choiceProblem) { lines.push('"' + label + '": ' + choiceProblem); return; }
    const qty = Number(it.quantity);
    if (!(Number.isInteger(qty) && qty >= 1 && qty <= 999)) { lines.push('"' + label + '" has an invalid quantity'); return; }
    const unit = smPriceUnitPesewas(p, nowMs);
    const said = smPricePesewas(it.price);
    if (said !== unit) {
      lines.push('"' + label + '" costs GHS ' + (unit / 100).toFixed(2) + ' now (the order says GHS ' + (said / 100).toFixed(2) + ')');
    }
    subtotalP += unit * qty;
  });
  // The totals are only worth reporting when every row is right. Otherwise the rows already explain it.
  const totals = [];
  if (smPricePesewas(o.subtotal) !== subtotalP) totals.push('the subtotal does not match the item prices');
  if (smPricePesewas(o.deliveryFee) !== 0 || smPricePesewas(o.serviceFee) !== 0) {
    totals.push('delivery and service fees are not part of an app checkout');
  }
  // A promo order's total is re-proven by smPromoAssertAndConsume, which uses the subtotal checked above.
  const hasPromo = !!(o.promo && o.promo.code);
  if (!hasPromo && smPricePesewas(o.total) !== subtotalP) totals.push('the total does not match the item prices');
  const problems = lines.length ? lines : totals;
  return { ok: problems.length === 0, skipped: false, problems: problems, subtotalP: subtotalP };
}
/* === CART PRICE CORE END === */

/**
 * Runs the verdict against the live product records. readProduct(pid) resolves to the product
 * data or null. Throws a refusal (so nothing is charged or marked paid) when the order does not
 * match. `tail` is the last sentence the buyer sees, so each payment path can say what happened to the money.
 */
async function smAssertCartPrices(readProduct, order, tail) {
  const o = order || {};
  if (o.offerId || o.auctionId) return { ok: true, skipped: true };
  const ids = [];
  (Array.isArray(o.items) ? o.items : []).forEach(function (it) {
    const pid = smPriceRowProductId(it);
    if (pid && ids.indexOf(pid) === -1) ids.push(pid);
  });
  const byId = {};
  for (const pid of ids.slice(0, 50)) {
    const data = await readProduct(pid);
    if (data) byId[pid] = data;
  }
  const verdict = smCartPriceVerdict(o, byId, Date.now());
  if (verdict.ok) return verdict;
  throw new functions.https.HttpsError('failed-precondition',
    'This order no longer matches the live listings: ' + verdict.problems.slice(0, 3).join('; ') + '. ' + tail);
}

/**
 * Read-only: what each product costs RIGHT NOW, read from the live product records.
 * The checkout asks this before it shows totals or writes an order. It moves no money.
 */
exports.quoteCartPrices = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in first.');
  const raw = Array.isArray((data || {}).productIds) ? data.productIds : [];
  const ids = [];
  raw.forEach(function (x) {
    const s = String(x || '').trim();
    if (s && s.length <= 128 && s.indexOf('/') === -1 && ids.indexOf(s) === -1) ids.push(s);
  });
  if (ids.length > 50) throw new functions.https.HttpsError('invalid-argument', 'Too many items to price at once (50 at most).');
  const now = Date.now();
  const quotes = {};
  for (const pid of ids) {
    const d = await db.collection('products').doc(pid).get();
    if (!d.exists) { quotes[pid] = { found: false }; continue; }
    const p = d.data() || {};
    quotes[pid] = {
      found: true,
      unitPrice: smPriceUnitPesewas(p, now) / 100,
      basePrice: smPricePesewas(p.price) / 100,
      flashPercent: smPriceFlashPercent(p, now),
      title: String(p.title || 'Item').slice(0, 200),
      sellerId: p.sellerId ? String(p.sellerId) : null,
      sellable: smPriceSellable(p),
      variants: smVariantGroupsOf(p)
    };
  }
  return { success: true, quotes: quotes, serverTime: now };
});

exports.payWithWallet = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const orderId = (data || {}).orderId;
  if (!orderId) throw new functions.https.HttpsError('invalid-argument', 'orderId required');

  const buyerId = context.auth.uid;
  const orderRef = db.collection('orders').doc(orderId);
  const walletRef = db.collection('wallets').doc(buyerId);

  const result = await db.runTransaction(async (tx) => {
    const orderDoc = await tx.get(orderRef);
    const walletDoc = await tx.get(walletRef);

    if (!orderDoc.exists) throw new functions.https.HttpsError('not-found', 'Order not found');
    const order = orderDoc.data();

    if (order.buyerId !== buyerId && order.userId !== buyerId) {
      throw new functions.https.HttpsError('permission-denied', 'Only the buyer can pay for this order');
    }
    if (order.escrowReleased === true || String(order.status) === 'completed') {
      throw new functions.https.HttpsError('failed-precondition', 'This order is already finished.');
    }
    if (order.paymentStatus === 'paid' || order.walletPaid === true || order.paidViaServer === true) {
      throw new functions.https.HttpsError('failed-precondition', 'Order already paid');
    }
    // A mixed cart has no single sellerId yet — the seller ids live on the items and the
    // order is split per seller straight after payment. Only refuse when there is genuinely
    // nobody to pay, or the buyer is the only seller involved.
    const itemSellers = new Set((order.items || []).map(i => i && i.sellerId).filter(Boolean));
    if (order.sellerId) {
      if (order.sellerId === buyerId) throw new functions.https.HttpsError('failed-precondition', 'You cannot buy your own item.');
    } else if (itemSellers.size === 0) {
      throw new functions.https.HttpsError('failed-precondition',
        'We could not work out which seller this order is for (an item may have been removed). Nothing was charged — remove the item from your cart and try again.');
    } else if ([...itemSellers].every(x => x === buyerId)) {
      throw new functions.https.HttpsError('failed-precondition', 'You cannot buy your own item.');
    }

    // THE PRICE CHECK comes first: every row must match the live listing, or nothing is charged.
    await smAssertCartPrices(async (pid) => {
      const pd = await tx.get(db.collection('products').doc(pid));
      return pd.exists ? (pd.data() || null) : null;
    }, order, 'Nothing was charged. Go back to your cart, check the new total and pay again.');
    // A promo-coded order must prove its discount math before a pesewa moves
    let promoUsed = null;
    if (order.promo && order.promo.code) promoUsed = await smPromoAssertAndConsume(tx, order);
    const total = promoUsed ? promoUsed.expectedTotal : round2(order.total || order.amount || order.bidAmount || 0);
    if (!(total > 0)) throw new functions.https.HttpsError('invalid-argument', 'Invalid order amount');

    const wallet = walletDoc.exists ? walletDoc.data() : { balance: 0, totalSpent: 0 };
    const currentBalance = round2(wallet.balance || 0);
    if (currentBalance < total) {
      throw new functions.https.HttpsError('failed-precondition',
        `Insufficient wallet balance: GHS ${currentBalance.toLocaleString()} < GHS ${total.toLocaleString()}. Top up first.`);
    }

    // MOQ-A seatbelt: pack-size listings refuse small orders right here, before any write
    await assertMinOrderQuantities(tx, order);

    const newBalance = round2(currentBalance - total);
    const now = admin.firestore.FieldValue.serverTimestamp();

    tx.update(walletRef, {
      balance: newBalance,
      totalSpent: round2(Number(wallet.totalSpent || 0) + total),
      updatedAt: now
    });

    tx.set(db.collection('walletTransactions').doc(), {
      userId: buyerId,
      type: 'purchase',
      amount: -total,
      balanceAfter: newBalance,
      orderId: orderId,
      auctionId: order.auctionId || null,
      productTitle: order.productTitle || order.title || 'Item',
      description: `Payment for order #${String(orderId).substring(0, 8).toUpperCase()}${order.isAuctionOrder ? ' (auction win)' : ''}`,
      status: 'completed',
      escrowStatus: 'held',
      createdAt: now
    });

    tx.update(orderRef, {
      status: 'paid',
      paymentStatus: 'paid',
      paymentMethod: 'wallet',
      walletPaid: true,
      paidPromo: promoUsed ? { code: promoUsed.code, discount: promoUsed.discount, ownerId: promoUsed.ownerId } : null,
      paidAmount: total,
      escrowHeldByServer: true,
      escrowStatus: 'held',
      escrowHeldAt: now,
      paidAt: now,
      updatedAt: now
    });

    // Same bargain-close as the Paystack path — a wallet-paid offer is spent too.
    if (order.offerId) {
      tx.update(db.collection('offers').doc(order.offerId), {
        status: 'paid',
        paidOrderId: orderId,
        paidAt: now
      });
    }

    return { newBalance, total };
  });

  console.log(`✅ Wallet payment: order ${orderId} paid GHS ${result.total} by ${buyerId}, new balance ${result.newBalance}`);

  // a mixed cart becomes one order per seller (escrow is per seller)
  try { await splitPaidOrderBySeller(orderId); } catch (e) { console.error('split failed', e && e.message); }
  try { await tickPreorderCounters(orderId); } catch (e) { console.error('preorder tick failed', e && e.message); }
  // if this order spent a chat bargain, say so in the thread
  try { await announceOfferPaidInChat(orderId, result.total); } catch (e) { console.error('offer chat announce failed', e && e.message); }

  // receipts (never allowed to break the payment — sendEmail swallows its own errors)
  try {
    const order = (await db.collection('orders').doc(orderId).get()).data() || {};
    const buyerEmail = await emailForUser(buyerId);
    await sendEmail('payment_receipt', buyerEmail || order.buyerEmail, {
      name: order.buyerName, orderId: orderId, amount: result.total,
      title: order.productTitle || order.title, method: 'wallet'
    });
    const sellerEmail = order.sellerEmail || await emailForUser(order.sellerId);
    const est = await estimateSellerSplit(result.total, order.sellerId);
    await sendEmail('sale_received', sellerEmail, {
      name: order.sellerName, orderId: orderId, amount: result.total,
      title: order.productTitle || order.title,
      payout: order.sellerPayout != null ? round2(order.sellerPayout) : est.payout,
      commission: est.commission
    });
  } catch (e) { console.error('receipt emails failed', e && e.message); }

  return { success: true, message: 'Paid with wallet', balance: result.newBalance, amount: result.total };
});

/**
 * Get wallet balance (for frontend polling)
 */
exports.getWallet = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const userId = context.auth.uid;
  const walletDoc = await db.collection('wallets').doc(userId).get();
  if (!walletDoc.exists) {
    // Auto-create
    await db.collection('wallets').doc(userId).set({
      userId: userId,
      balance: 0,
      currency: 'GHS',
      totalTopups: 0,
      totalSpent: 0,
      totalEarnings: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, balance: 0, currency: 'GHS' };
  }
  const w = walletDoc.data();
  return { success: true, balance: w.balance || 0, currency: w.currency || 'GHS', totalTopups: w.totalTopups || 0, totalSpent: w.totalSpent || 0, totalEarnings: w.totalEarnings || 0 };
});

// ============================================================================
// PAYSTACK WEBHOOK — the safety net for payments
// ============================================================================
//
// THE PROBLEM THIS SOLVES
// A card payment is only recorded when the buyer's browser tells us about it
// (confirmPaystackPayment). If their phone dies, the tab is closed, the signal drops or the
// app crashes in those few seconds, the charge exists at Paystack and nothing exists here —
// the money sits in limbo until the buyer happens to reopen the site (there is a recovery
// banner for that, but it needs them to come back).
//
// Paystack also POSTs every event to a webhook URL. This function listens, verifies the
// signature with the secret key, and records the payment **server-side**, whether or not the
// buyer's browser ever comes back. Whoever gets there first wins; the paystackRefs ledger
// makes the second one a no-op, so a payment can never be credited twice.
//
// SET IT UP (one time): Paystack Dashboard → Settings → API Keys & Webhooks → Webhook URL:
//     https://us-central1-sankofa-market.cloudfunctions.net/paystackWebhook
//
// Nothing here trusts the request body: the signature is checked with the same secret the
// charges are created with, and the amount/currency are re-read from Paystack before a cent
// is credited.


function webhookEventsRef(reference) {
  return db.collection('webhookEvents').doc(String(reference || 'unknown').slice(0, 400));
}

/** Record that we heard from Paystack, so support can always see what happened. */
async function logWebhook(event, reference, outcome, extra) {
  try {
    await webhookEventsRef(reference).set({
      event: event,
      reference: reference || null,
      outcome: outcome,
      detail: extra || null,
      receivedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) { console.error('could not log webhook', e && e.message); }
}

/**
 * Credit a wallet top-up from a verified Paystack charge.
 * Shared with verifyWalletTopup so the browser path and the webhook path cannot drift apart.
 */
async function creditWalletFromTopup(reference, payData, userId) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const currency = String(payData.currency || 'GHS').toUpperCase();
  if (currency !== 'GHS') throw new Error('only GHS top-ups are accepted (got ' + currency + ')');
  const amount = round2(Number(payData.amount || 0) / 100);
  if (!(amount > 0)) throw new Error('that payment has no amount');

  const refRef = db.collection('paystackRefs').doc(reference);
  const walletRef = db.collection('wallets').doc(userId);

  return await db.runTransaction(async (tx) => {
    const refDoc = await tx.get(refRef);
    const walletDoc = await tx.get(walletRef);
    if (refDoc.exists) {
      const used = refDoc.data() || {};
      if (used.userId === userId && used.kind === 'wallet_topup') {
        return { alreadyCredited: true, newBalance: round2(walletDoc.exists ? walletDoc.data().balance : 0), amount: round2(used.amount) };
      }
      throw new Error('this payment has already been used for something else');
    }
    const wallet = walletDoc.exists ? walletDoc.data() : { balance: 0, totalTopups: 0 };
    const newBalance = round2(Number(wallet.balance || 0) + amount);
    if (walletDoc.exists) {
      tx.update(walletRef, {
        balance: newBalance,
        totalTopups: round2(Number(wallet.totalTopups || 0) + amount),
        updatedAt: now
      });
    } else {
      tx.set(walletRef, {
        userId: userId, balance: newBalance, currency: 'GHS',
        totalTopups: amount, totalSpent: 0, totalEarnings: 0,
        createdAt: now, updatedAt: now
      });
    }
    tx.set(refRef, { reference: reference, kind: 'wallet_topup', userId: userId, amount: amount, source: 'webhook', createdAt: now });
    tx.set(db.collection('walletTransactions').doc(), {
      userId: userId, type: 'topup', amount: amount, balanceAfter: newBalance,
      reference: reference, paystackReference: reference,
      gateway_response: payData.gateway_response || null,
      description: 'Wallet top-up via Paystack', status: 'completed', createdAt: now
    });
    return { newBalance: newBalance, amount: amount };
  });
}

exports.paystackWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

  // ---- 1. it must really be Paystack ----
  const secret = paystackSecret();
  if (!secret) { console.error('paystackWebhook: no secret key configured'); res.status(500).send('not configured'); return; }

  const signature = req.headers['x-paystack-signature'];
  const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');
  if (!signature || String(signature) !== expected) {
    console.warn('paystackWebhook: signature mismatch — ignoring');
    await logWebhook('unknown', (req.body && req.body.data && req.body.data.reference) || null, 'rejected: bad signature');
    res.status(401).send('invalid signature');
    return;
  }

  const event = String((req.body && req.body.event) || '');
  const data = (req.body && req.body.data) || {};
  const reference = data.reference || null;

  // answer Paystack immediately so it does not retry while we work
  res.status(200).send('ok');

  try {
    console.log('paystackWebhook:', event, reference);

    // ---- 1b. automatic payout transfers (only ever sent while the admin switch is on) ----
    if (event === 'transfer.success' || event === 'transfer.failed' || event === 'transfer.reversed') {
      const note = await smAutoPayHandleTransferEvent(event, data, reference);
      await logWebhook(event, reference, note);
      return;
    }

    // ---- 2. money coming in ----
    if (event === 'charge.success') {
      const md = paystackMetadata(data);
      const status = String(data.status || '').toLowerCase();
      if (status !== 'success') {
        await logWebhook(event, reference, 'ignored: status ' + status);
        return;
      }

      // (a) a wallet top-up
      if (md.purpose === 'wallet_topup' || (!md.orderId && md.userId)) {
        if (!md.userId) { await logWebhook(event, reference, 'no userId in metadata'); return; }
        const out = await creditWalletFromTopup(reference, data, md.userId);
        await logWebhook(event, reference, out.alreadyCredited ? 'wallet already credited' : 'wallet credited (webhook)', {
          userId: md.userId, amount: out.amount, balance: out.newBalance
        });
        try {
          await db.collection('notifications').add({
            userId: md.userId, type: 'wallet_topup', title: 'Wallet topped up',
            message: 'GHS ' + Number(out.amount).toFixed(2) + ' was added to your Sankofa Wallet.',
            isRead: false, createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) {}
        return;
      }

      // (b) an order payment
      const orderId = md.orderId || (data.metadata && data.metadata.custom_fields
        ? (data.metadata.custom_fields.find(f => f.variable_name === 'order_id') || {}).value
        : null);
      if (!orderId) { await logWebhook(event, reference, 'no orderId in metadata'); return; }

      const orderDoc = await db.collection('orders').doc(orderId).get();
      if (!orderDoc.exists) {
        await logWebhook(event, reference, 'order not found', { orderId: orderId });
        return;
      }
      const res2 = await applyVerifiedOrderPayment({
        orderId: orderId,
        reference: reference,
        callerUid: md.userId || orderDoc.data().buyerId || orderDoc.data().userId,
        payData: data,
        system: true                       // the caller is Paystack's signed webhook, not a browser
      });
      if (!res2.alreadyCredited) {
        try { await tickPreorderCounters(orderId); } catch (e) { console.error('preorder tick failed (webhook)', e && e.message); }
      }
      await logWebhook(event, reference, res2.alreadyCredited ? 'order already paid' : 'order marked paid (webhook)', {
        orderId: orderId, amount: res2.amount
      });
      return;
    }

    // ---- 3. payouts (only relevant once Paystack Transfers are approved) ----
    if (event === 'transfer.success' || event === 'transfer.failed' || event === 'transfer.reversed') {
      await logWebhook(event, reference, 'logged (transfers are still handled manually)', {
        transferCode: data.transfer_code || null, amount: data.amount || null
      });
      return;
    }

    await logWebhook(event, reference, 'event noted, nothing to do');
  } catch (e) {
    console.error('paystackWebhook failed', e && e.message);
    await logWebhook(event, reference, 'ERROR: ' + String(e && e.message).slice(0, 180));
  }
});

/**
 * Admin view of what the webhook has seen — used to trace a payment a customer swears they made.
 */
exports.getWebhookEvents = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
  if (!(await adminCaller(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only.');
  const snap = await db.collection('webhookEvents').orderBy('receivedAt', 'desc').limit(Number((data || {}).limit) || 25).get();
  const rows = [];
  snap.forEach(d => rows.push(Object.assign({ id: d.id }, d.data())));
  return { success: true, count: rows.length, events: rows };
});

// ============================================================================
// NOTE ON PROVENANCE
// ============================================================================
// The Paystack webhook below arrived outside this working copy: it was found live in the
// deployed Cloud Functions but was missing from the source in this repository, which meant a
// routine `firebase deploy --only functions` refused to run (it treats missing-from-source
// functions as deletions). It has been brought back into the repository verbatim so the work
// is version-controlled and a deploy can no longer throw it away.
//
// What it is: Paystack posts every charge to this URL, the signature is checked with the same
// secret the charges are created with, and a payment is recorded even if the buyer's browser
// never comes back. The paystackRefs ledger makes a double-credit impossible, so whichever of
// the browser and the webhook arrives second is a no-op.
//
// One-time setup on Paystack: Settings → API Keys & Webhooks → webhook URL
//     https://us-central1-sankofa-market.cloudfunctions.net/paystackWebhook
// (the function is already reachable by anyone, which is required for Paystack to call it, and
// it rejects anything without a valid signature).

// All functions already exported via exports.* above — no need for module.exports
// (removed duplicate export that caused ReferenceError: createUserProfile is not defined)

/* ============================================================================
   FOLLOWER BROADCAST (Silver+ premium perk)
   One tap in the chat page fans a single message out to every follower, each
   in their own 1-to-1 conversation (bcast_<sellerUid>_<followerUid>) so
   replies stay private. One broadcast per calendar month, enforced here.
   ========================================================================== */
exports.sendBroadcast = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const sellerId = context.auth.uid;

  // ---- the message itself ----
  const raw = (data && data.text != null) ? String(data.text) : '';
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) throw new functions.https.HttpsError('invalid-argument', 'Broadcast text required');
  if (text.length > 500) throw new functions.https.HttpsError('invalid-argument', 'Broadcasts are limited to 500 characters');

  // ---- tier gate: premium Silver and above only ----
  const userDoc = await db.collection('users').doc(sellerId).get();
  if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'Profile not found');
  const u = userDoc.data() || {};
  const expiry = u.premiumExpiry && u.premiumExpiry.toDate ? u.premiumExpiry.toDate() : null;
  const premiumActive = u.isPremium === true && !!expiry && expiry > new Date();
  const tier = String(u.premiumTier || u.sellerTier || '').toLowerCase();
  if (!premiumActive || ['silver', 'gold', 'diamond'].indexOf(tier) === -1) {
    throw new functions.https.HttpsError('failed-precondition',
      'Follower broadcast is a Silver, Gold and Diamond perk. Upgrade to use it.');
  }

  // ---- one broadcast per calendar month (UTC) ----
  const now = new Date();
  const monthKey = now.getUTCFullYear() + '-' + String(now.getUTCMonth() + 1).padStart(2, '0');
  const recRef = db.collection('broadcasts').doc(sellerId + '_' + monthKey);
  const recSnap = await recRef.get();
  if (recSnap.exists) {
    throw new functions.https.HttpsError('failed-precondition',
      'You already used this month\u2019s broadcast. The next one unlocks on the 1st of next month.');
  }

  // ---- the followers (names are already denormalised onto the follow docs) ----
  const folSnap = await db.collection('follows').where('sellerId', '==', sellerId).get();
  if (folSnap.empty) {
    throw new functions.https.HttpsError('failed-precondition',
      'You have no followers yet — a broadcast would reach nobody.');
  }
  const sellerName = String(u.name || ((u.firstName || '') + (u.lastName ? ' ' + u.lastName : '')).trim() || u.displayName || 'Seller').slice(0, 60);
  const serverNow = admin.firestore.FieldValue.serverTimestamp();
  const folDocs = folSnap.docs;

  // ---- fan out: conversation + first message per follower, batched (500/write batch) ----
  // Each follower gets their own chat with the seller, so replies come back privately.
  let delivered = 0;
  const CHUNK = 400; // 2 writes per follower + head-room under the 500-doc batch limit
  for (let i = 0; i < folDocs.length; i += CHUNK / 2) {
    const batch = db.batch();
    const slice = folDocs.slice(i, i + CHUNK / 2);
    for (const fd of slice) {
      const f = fd.data() || {};
      const followerId = f.followerId;
      if (!followerId) continue;
      const followerName = String(f.followerName || 'Buyer').slice(0, 60);
      const convRef = db.collection('conversations').doc('bcast_' + sellerId + '_' + followerId);
      batch.set(convRef, {
        participants: [sellerId, followerId],
        participantNames: { [sellerId]: sellerName, [followerId]: followerName },
        isBroadcast: true,
        senderTier: tier,
        senderIsPremium: true,
        lastMessage: '\uD83D\uDCE3 ' + (text.length > 90 ? text.slice(0, 90) + '…' : text),
        lastMessageAt: serverNow,
        unreadBy: [followerId]
      }); // full set (not merge): a stale conv from an old broadcast is refreshed wholesale
      batch.set(convRef.collection('messages').doc(), {
        senderId: sellerId,
        senderName: sellerName,
        text: '\uD83D\uDCE3 ' + text,
        status: 'sent',
        participants: [sellerId, followerId], // REQUIRED so both sides can read it (rules)
        isBroadcast: true,
        createdAt: serverNow
      });
      delivered++;
    }
    await batch.commit();
  }

  // ---- record it: same month = blocked above; also readable by the seller for the UI ----
  await recRef.set({
    sellerId,
    sellerName,
    text: text.slice(0, 500),
    followerCount: delivered,
    monthKey,
    createdAt: serverNow
  });

  return { success: true, message: 'Broadcast sent', followerCount: delivered, monthKey };
});

/* ============================================================================
   AUTO-AWAY REPLY (Silver+ premium perk)
   When a Silver/Gold/Diamond seller turns on Away mode, the FIRST message a
   buyer sends in a chat gets an automatic answer as if from the seller, once
   per 6 hours per conversation. Replies never chain (isAutoAway) and never
   answer broadcasts. The tier gate lives HERE, server-side — a free user who
   hand-writes a sellerPrefs doc still gets nothing.
   ========================================================================== */
exports.autoAwayReply = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data() || {};
    try {
      if (message.isAutoAway) return null;            // never reply to our own away replies
      if (message.isBroadcast) return null;           // never answer a broadcast (500 replies!)
      const senderId = message.senderId;
      const participants = Array.isArray(message.participants) ? message.participants : [];
      if (!senderId || participants.length !== 2) return null;
      const receiverId = participants.filter(function (p) { return p !== senderId; })[0];
      if (!receiverId) return null;

      // tier gate: the RECEIVER must be a genuinely active Silver+ seller
      const userDoc = await db.collection('users').doc(receiverId).get();
      if (!userDoc.exists) return null;
      const u = userDoc.data() || {};
      const expiry = u.premiumExpiry && u.premiumExpiry.toDate ? u.premiumExpiry.toDate() : null;
      const premiumActive = u.isPremium === true && !!expiry && expiry > new Date();
      const tier = String(u.premiumTier || u.sellerTier || '').toLowerCase();
      if (!premiumActive || ['silver', 'gold', 'diamond'].indexOf(tier) === -1) return null;

      // their settings
      const prefsDoc = await db.collection('sellerPrefs').doc(receiverId).get();
      const prefs = prefsDoc.exists ? (prefsDoc.data() || {}) : {};
      const away = prefs.autoAway || {};
      const awayText = String(away.message || '').trim();
      if (away.enabled !== true || !awayText) return null;

      // per-conversation cooldown: once per 6 hours, no matter how many messages arrive
      const convRef = db.collection('conversations').doc(context.params.conversationId);
      const convDoc = await convRef.get();
      if (!convDoc.exists) return null;
      const conv = convDoc.data() || {};
      const lastAt = conv.autoAwayLastAt && conv.autoAwayLastAt.toDate ? conv.autoAwayLastAt.toDate() : null;
      if (lastAt && (Date.now() - lastAt.getTime()) < 6 * 3600 * 1000) return null;

      const sellerName = (conv.participantNames && conv.participantNames[receiverId]) || u.name || 'Seller';
      const full = '🌙 ' + awayText.slice(0, 300);
      const now = admin.firestore.FieldValue.serverTimestamp();

      await convRef.collection('messages').add({
        senderId: receiverId,
        senderName: sellerName,
        text: full,
        status: 'sent',
        participants: participants,       // REQUIRED so both sides keep read rights (rules)
        isAutoAway: true,
        createdAt: now
      });
      await convRef.set({
        lastMessage: '🌙 ' + (awayText.length > 88 ? awayText.slice(0, 88) + '…' : awayText),
        lastMessageAt: now,
        unreadBy: admin.firestore.FieldValue.arrayUnion(senderId),
        autoAwayLastAt: now
      }, { merge: true });
      console.log('🌙 Away reply posted in', context.params.conversationId, 'for', receiverId);
    } catch (e) {
      console.error('autoAwayReply error:', e && e.message);
    }
    return null;
  });

/* ==========================================================================
 * imgProxy — same-origin relay for OUR product photos.
 * Why: image search analyses product photos in the browser (canvas pixels).
 * Reading pixels cross-origin needs CORS, and once a browser has cached the
 * photo from normal browsing (no CORS headers recorded), later CORS reads
 * fail even though the bucket allows them. Relaying through our own host
 * sidesteps all of it. Strictly limited to files in OUR bucket — this must
 * never become an open proxy.
 *   GET /imgProxy?u=<urlencoded firebasestorage URL>
 * ========================================================================== */
exports.imgProxy = functions.https.onRequest(async (req, res) => {
  try {
    const u = String((req.query && req.query.u) || '');
    let parsed;
    try { parsed = new URL(u); } catch (e) { res.status(400).send('Bad url'); return; }
    const okHost = parsed.hostname === 'firebasestorage.googleapis.com';
    const okBucket = parsed.pathname.indexOf('/v0/b/sankofa-market.firebasestorage.app/') === 0;
    if (!okHost || !okBucket) { res.status(403).send('Only this shop\'s own product photos.'); return; }

    const up = await fetch(u, { redirect: 'follow' });
    if (!up.ok) { res.status(up.status).send('Upstream said ' + up.status); return; }
    const buf = Buffer.from(await up.arrayBuffer());
    res.set('Content-Type', up.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).send(buf);
  } catch (e) {
    console.error('imgProxy error:', e && e.message);
    res.status(502).send('Could not fetch that image.');
  }
});

/* ==========================================================================
 * priceDropWatch — a saved (wishlisted) item's price went DOWN.
 *   • EVERY shopper who saved it gets an EMAIL, unless they switched off
 *     email notifications or price-drop emails (profile / dashboard switches);
 *   • PREMIUM shoppers also get the in-app BELL alert (a Premium perk).
 * One price-drop message per (user, product) per 72h. Bell and email share the
 * same throttle (priceAlertLog), so a seller who keeps moving the price cannot
 * spam anyone. Sellers are never told about their own listings. Big fan-outs are
 * sent a few at a time so they finish inside the function time limit.
 * ========================================================================== */
exports.priceDropWatch = functions.runWith({ timeoutSeconds: 300 }).firestore
  .document('products/{productId}')
  .onWrite(async (change, context) => {
    try {
      const before = change.before.exists ? (change.before.data() || {}) : null;
      const after = change.after.exists ? (change.after.data() || {}) : null;
      if (!smAlertPriceDropped(before, after)) return null;   // create/delete, sold, or not a drop

      const productId = context.params.productId;
      const wishSnap = await db.collection('wishlist').where('productId', '==', productId).limit(2000).get();
      if (wishSnap.empty) return null;

      const title = after.title || 'An item';
      const oldPrice = Number(before.price);
      const newPrice = Number(after.price);
      const save = oldPrice - newPrice;
      const itemUrl = 'https://sankofa-market.web.app/product-detail.html?id=' + productId;
      const nowMs = Date.now();
      let notified = 0;
      let emailed = 0;

      await smAlertEachChunked(wishSnap.docs, 10, async (wishDoc) => {
        const uid = (wishDoc.data() || {}).uid;
        if (!uid || uid === after.sellerId) return;
        const uDoc = await db.collection('users').doc(uid).get();
        if (!uDoc.exists) return;
        const u = uDoc.data() || {};
        const bell = smAlertPremiumActive(u, nowMs);        // in-app bell: Premium perk
        const mail = smAlertPriceDropEmailAllowed(u);       // email: everyone, unless switched off
        if (!bell && !mail) return;

        const logRef = db.collection('priceAlertLog').doc(uid + '_' + productId);
        const logDoc = await logRef.get();
        const lastMs = logDoc.exists ? smAlertMs((logDoc.data() || {}).lastSent) : 0;
        if (!smAlertThrottleOk(lastMs, nowMs)) return;      // already told about this item in the last 72h

        let sent = false;
        if (bell) {
          await db.collection('notifications').add({
            userId: uid,
            type: 'price_drop',
            title: '💸 Price dropped on your wishlist',
            message: '"' + title + '" is now GHS ' + newPrice.toLocaleString() +
              ' (was GHS ' + oldPrice.toLocaleString() + ') — you save GHS ' + save.toLocaleString() + '.',
            productId: productId,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          sent = true;
        }
        if (mail) {
          const to = u.email || await emailForUser(uid);
          if (to) {
            const r = await sendEmail('price_drop', to, {
              name: smAlertFirstName(u), title: title, itemUrl: itemUrl,
              newPrice: newPrice.toLocaleString(), oldPrice: oldPrice.toLocaleString(),
              saving: save.toLocaleString()
            });
            if (r && r.sent) { emailed++; sent = true; }
          }
        }
        if (!sent) return;
        await logRef.set({ uid: uid, productId: productId, lastPrice: newPrice,
          lastSent: admin.firestore.FieldValue.serverTimestamp() });
        notified++;
      });
      if (notified) console.log('priceDropWatch:', productId, oldPrice, '→', newPrice, 'notified', notified, 'emailed', emailed);
    } catch (e) {
      console.error('priceDropWatch error:', e && e.message);
    }
    return null;
  });

/**
 * "STOCK LANDED" — alert every buyer waiting on a Sankofa Store pre-order.
 * The admin taps one gold button on the product row; this fans out a bell
 * alert to each buyer with an OPEN pre-order (pending/paid/processing — never
 * shipped, delivered, completed, cancelled or refunded), stamps those orders
 * with stockLandedAt for the record, and (unless told otherwise) retires the
 * pre-order flag so the listing becomes a normal in-stock item.
 */
exports.preorderStockLanded = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  let callerIsAdmin = context.auth.token && context.auth.token.admin === true;
  if (!callerIsAdmin) {
    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    callerIsAdmin = callerDoc.exists && callerDoc.data().role === 'admin';
  }
  if (!callerIsAdmin) throw new functions.https.HttpsError('permission-denied', 'Admins only');

  const productId = String((data && data.productId) || '').trim();
  if (!productId) throw new functions.https.HttpsError('invalid-argument', 'productId is required');
  const turnOffBadge = !data || data.turnOffBadge !== false; // default ON — stock is in

  const prodRef = db.collection('products').doc(productId);
  const prodSnap = await prodRef.get();
  if (!prodSnap.exists) throw new functions.https.HttpsError('not-found', 'Product not found');
  const prod = prodSnap.data();
  const title = String(prod.title || 'An item you pre-ordered').slice(0, 120);

  // Orders that are no longer waiting on stock — they must NOT get the alert.
  const CLOSED = ['shipped', 'delivered', 'completed', 'cancelled', 'refunded'];
  const osnap = await db.collection('orders')
    .where('productId', '==', productId)
    .where('isPreOrder', '==', true)
    .limit(500).get();

  const buyers = new Map();   // buyerId -> one open orderId (dedupe: 1 alert per buyer)
  const openOrderIds = [];
  osnap.forEach(d => {
    const o = d.data();
    const status = String(o.status || 'pending').toLowerCase();
    if (CLOSED.indexOf(status) !== -1) return;
    if (o.stockLandedAt) return;   // already announced once — a second tap must never re-spam this buyer
    openOrderIds.push(d.id);
    const bid = o.buyerId;
    if (bid && typeof bid === 'string' && !buyers.has(bid)) buyers.set(bid, d.id);
  });

  // Fan out the bell alerts (same batching pattern as the auction follower fan-out)
  const whenTxt = prod.preOrderDate
    ? ' (you were told to expect it around ' + String(prod.preOrderDate).slice(0, 40) + ')'
    : '';
  const docs = [];
  buyers.forEach((oid, uid) => {
    docs.push({
      userId: uid,
      type: 'preorder_stock',
      title: 'Your pre-order has landed! 🎉',
      message: '"' + title + '"' + whenTxt + ' is now in stock at Sankofa Store and is being prepared for dispatch. Your money stayed safe in escrow the whole time.',
      productId: productId,
      orderId: oid,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  for (let i = 0; i < docs.length; i += 450) {
    const batch = db.batch();
    docs.slice(i, i + 450).forEach(n => batch.set(db.collection('notifications').doc(), n));
    await batch.commit();
  }

  // Stamp each open order for the record (audit trail: when were they told stock landed)
  for (let i = 0; i < openOrderIds.length; i += 450) {
    const batch = db.batch();
    openOrderIds.slice(i, i + 450).forEach(oid =>
      batch.update(db.collection('orders').doc(oid), {
        stockLandedAt: admin.firestore.FieldValue.serverTimestamp(),
        preOrderStage: 'stock_landed',
        preOrderStageHistory: admin.firestore.FieldValue.arrayUnion({ stage: 'stock_landed', at: new Date().toISOString(), by: context.auth.uid })
      }));
    await batch.commit();
  }

  // Retire the pre-order flag — the item is in stock now
  const wasPreOrder = prod.preOrder === true;
  if (turnOffBadge && wasPreOrder) {
    await prodRef.update({
      preOrder: false,
      preOrderDate: null,
      preOrderNote: null,
      preOrderStockLandedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  console.log('preorderStockLanded:', title, '-', buyers.size, 'buyer(s),', openOrderIds.length, 'open order(s), badge off:', turnOffBadge && wasPreOrder);
  return { title, buyers: buyers.size, openOrders: openOrderIds.length, badgeTurnedOff: turnOffBadge && wasPreOrder };
});

/**
 * PRE-ORDER STAGE JOURNEY — the admin taps one button and the buyer hears
 * where their money is at, step by step. Stages:
 *   ordered(0) → stock_landed(1) → preparing(2) → dispatched(3) → delivered(4)
 * 'ordered' is automatic (payment), 'delivered' belongs to the BUYER's in-app
 * confirmation (that is what releases the escrow) — the admin may only advance
 * 1→2→3, always forward, jumps allowed (e.g. stock straight onto the van).
 */
const PO_STAGE_LIST = ['ordered', 'stock_landed', 'preparing', 'dispatched', 'delivered'];
function poStageRankOf(o) {
  const status = String(o.status || 'pending').toLowerCase();
  if (status === 'delivered' || status === 'completed') return 4;
  if (o.preOrderStage && PO_STAGE_LIST.indexOf(o.preOrderStage) !== -1) return PO_STAGE_LIST.indexOf(o.preOrderStage);
  if (status === 'shipped') return 3;
  if (o.stockLandedAt) return 1;
  return 0;
}
exports.preorderAdvanceStage = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  let callerIsAdmin = context.auth.token && context.auth.token.admin === true;
  if (!callerIsAdmin) {
    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    callerIsAdmin = callerDoc.exists && callerDoc.data().role === 'admin';
  }
  if (!callerIsAdmin) throw new functions.https.HttpsError('permission-denied', 'Admins only');

  const orderId = String((data && data.orderId) || '').trim();
  const stage = String((data && data.stage) || '').trim();
  if (!orderId) throw new functions.https.HttpsError('invalid-argument', 'orderId is required');
  if (PO_STAGE_LIST.indexOf(stage) === -1) throw new functions.https.HttpsError('invalid-argument', 'unknown stage: ' + stage);
  if (stage === 'ordered' || stage === 'delivered') {
    throw new functions.https.HttpsError('failed-precondition', '"' + stage + '" is automatic — the buyer places the pre-order, and only the buyer\'s in-app confirmation marks it delivered (that is what releases the escrow).');
  }

  const ref = db.collection('orders').doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Order not found');
  const o = snap.data();
  if (o.isPreOrder !== true) throw new functions.https.HttpsError('failed-precondition', 'That order is not a pre-order.');
  const status = String(o.status || 'pending').toLowerCase();
  if (['delivered', 'completed', 'cancelled', 'refunded'].indexOf(status) !== -1) {
    throw new functions.https.HttpsError('failed-precondition', 'That pre-order is already ' + status + ' — the journey has ended.');
  }

  const currentRank = poStageRankOf(o);
  const targetRank = PO_STAGE_LIST.indexOf(stage);
  if (targetRank <= currentRank) {
    return { noop: true, current: PO_STAGE_LIST[currentRank], message: 'Already at "' + PO_STAGE_LIST[currentRank] + '" — the buyer has heard about this step already.' };
  }

  const title = String(o.productTitle || 'Your pre-order item').slice(0, 120);
  const updates = {
    preOrderStage: stage,
    preOrderStageHistory: admin.firestore.FieldValue.arrayUnion({ stage, at: new Date().toISOString(), by: context.auth.uid })
  };
  if (stage === 'stock_landed') updates.stockLandedAt = admin.firestore.FieldValue.serverTimestamp();
  if (stage === 'dispatched' && ['pending', 'paid', 'processing'].indexOf(status) !== -1) updates.status = 'shipped';
  await ref.update(updates);

  const COPY = {
    stock_landed: {
      title: 'Your pre-order has landed! 🎉',
      message: '"' + title + '" is now in stock at Sankofa Store — it gets packed for you next. Your money stayed safe in escrow the whole time.'
    },
    preparing: {
      title: 'Packing your pre-order 📦',
      message: '"' + title + '" is being carefully prepared for dispatch at Sankofa Store. It heads your way next — your money stays safe in escrow until you confirm delivery.'
    },
    dispatched: {
      title: 'Your pre-order is on its way! 🚚',
      message: '"' + title + '" has been dispatched and is heading to you. When it arrives, check it, then tap "Confirm delivery" inside the app — that is what releases your escrow money to the store.'
    }
  };
  const c = COPY[stage];
  if (o.buyerId && typeof o.buyerId === 'string') {
    await db.collection('notifications').add({
      userId: o.buyerId,
      type: 'preorder_stage',
      title: c.title,
      message: c.message,
      productId: o.productId || null,
      orderId: orderId,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  console.log('preorderAdvanceStage:', orderId, '→', stage, '(was', PO_STAGE_LIST[currentRank] + ')');
  return { noop: false, stage, notified: !!o.buyerId, orderStatus: updates.status || status };
});

// ============================================================================
// 🪙 SANKOFA POINTS — check-in loyalty the browser can never fake.
// Rolling 24-hour cooldown: claiming at 3:15pm means the next claim unlocks
// at 3:15pm tomorrow — no shared "midnight reset". A streak is "never let
// 48 hours pass between claims". Ghana keeps UTC year-round, but with a
// rolling clock we barely even care about timezones at all.
// ============================================================================
const PO_DAILY_POINTS = 5;        // every 24 hours, counted from YOUR last tap
const PO_STREAK_BONUS = 15;       // every 7th claim in a row
const PO_STREAK_CYCLE = 7;
const PO_CLAIM_COOLDOWN_MS = 864e5;      // 24h between claims (rolling)
const PO_STREAK_WINDOW_MS = 2 * 864e5;   // 48h between claims = streak survives
const PO_OFFERS = {
  boost7:   { key: 'boost7',   cost: 100, days: 7, label: '7-day Boost' },
  feature3: { key: 'feature3', cost: 150, days: 3, label: '3-day Featured' }
};

exports.claimDailyPoints = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const uid = context.auth.uid;
  const nowMs = Date.now();
  const ref = db.collection('points').doc(uid);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : {};
    const lastMs = d.lastClaimAt && d.lastClaimAt.toMillis ? d.lastClaimAt.toMillis() : 0;
    const nextMs = lastMs + PO_CLAIM_COOLDOWN_MS;
    if (lastMs && nowMs < nextMs) {
      return { already: true, balance: d.balance || 0, streak: d.streak || 0, nextClaimAt: new Date(nextMs).toISOString() };
    }
    // claimed within 48h of the previous claim → the streak lives on
    const streak = (lastMs && (nowMs - lastMs) <= PO_STREAK_WINDOW_MS) ? (d.streak || 0) + 1 : 1;
    let award = PO_DAILY_POINTS;
    let milestone = false;
    if (streak % PO_STREAK_CYCLE === 0) { award += PO_STREAK_BONUS; milestone = true; }
    // claims are ≥24h apart BY CONSTRUCTION (the cooldown above returns
    // early), so this counts provably separate days — the referral sweep
    // uses ">= 2" as proof a friend is a real, returning human.
    tx.set(ref, {
      balance: (d.balance || 0) + award,
      streak,
      lastClaimAt: admin.firestore.FieldValue.serverTimestamp(),
      lastClaimDate: new Date().toISOString().slice(0, 10), // human-readable only; logic keys on lastClaimAt
      claimDays: (d.claimDays || 0) + 1,
      totalEarned: (d.totalEarned || 0) + award,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(ref.collection('ledger').doc(), {
      type: 'claim',
      amount: award,
      note: milestone ? 'Daily check-in + ' + streak + '-day streak bonus 🎉' : 'Daily check-in (day ' + streak + ' of your streak)',
      at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { already: false, award, balance: (d.balance || 0) + award, streak, milestone, nextClaimAt: new Date(nowMs + PO_CLAIM_COOLDOWN_MS).toISOString() };
  });

  if (result.already !== true && result.milestone === true) {
    await db.collection('notifications').add({
      userId: uid,
      type: 'points_milestone',
      title: result.streak + '-day streak! 🪙',
      message: 'A full ' + result.streak + ' days in a row on Sankofa — that earned you a +' + PO_STREAK_BONUS + ' bonus on top of today\'s ' + PO_DAILY_POINTS + ' points. Keep the streak alive!',
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('claimDailyPoints milestone:', uid, result.streak, 'days');
  }
  return result;
});

exports.redeemPointsOffer = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const uid = context.auth.uid;
  const offer = PO_OFFERS[String((data && data.offerType) || '')];
  if (!offer) throw new functions.https.HttpsError('invalid-argument', 'Unknown offer');
  const productId = String((data && data.productId) || '').trim();
  if (!productId) throw new functions.https.HttpsError('invalid-argument', 'productId is required');

  const pref = db.collection('products').doc(productId);
  const pSnap = await pref.get();
  if (!pSnap.exists) throw new functions.https.HttpsError('not-found', 'Listing not found');
  const p = pSnap.data();
  if (p.sellerId !== uid) throw new functions.https.HttpsError('permission-denied', 'That listing is not yours.');
  if (p.isActive === false || p.isSold === true) throw new functions.https.HttpsError('failed-precondition', 'That listing is not live — pick one that is.');
  if (offer.key === 'boost7') {
    const lvl = p.boostLevel || (p.isBoosted ? 2 : 0);
    if (lvl > 2) throw new functions.https.HttpsError('failed-precondition', 'Your premium boost is already stronger than this offer.');
    if (p.boostSource === 'points' && p.boostUntil && p.boostUntil.toMillis() > Date.now()) {
      throw new functions.https.HttpsError('failed-precondition', 'That listing is already boosted until ' + new Date(p.boostUntil.toMillis()).toISOString().slice(0, 10) + ' — let it finish first.');
    }
  } else {
    if (p.isFeatured === true && (!p.featuredUntil || (p.featuredUntil.toMillis && p.featuredUntil.toMillis() > Date.now()))) {
      throw new functions.https.HttpsError('failed-precondition', 'That listing is already featured — let it finish first.');
    }
  }

  const pointsRef = db.collection('points').doc(uid);
  const title = String(p.title || 'your listing').slice(0, 80);
  const until = new Date(Date.now() + offer.days * 864e5);
  const outcome = await db.runTransaction(async (tx) => {
    const s = await tx.get(pointsRef);
    const bal = s.exists ? (s.data().balance || 0) : 0;
    if (bal < offer.cost) {
      throw new functions.https.HttpsError('failed-precondition', 'Not enough points — you have ' + bal + ', and ' + offer.label + ' costs ' + offer.cost + '.');
    }
    tx.set(pointsRef, {
      balance: bal - offer.cost,
      totalSpent: (s.data().totalSpent || 0) + offer.cost,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(pointsRef.collection('ledger').doc(), {
      type: 'redeem',
      amount: -offer.cost,
      note: offer.label + ' for "' + title + '"',
      productId,
      at: admin.firestore.FieldValue.serverTimestamp()
    });
    tx.update(pref, offer.key === 'boost7'
      ? { boostLevel: 2, isBoosted: true, boostSource: 'points', boostedAt: admin.firestore.FieldValue.serverTimestamp(), boostUntil: admin.firestore.Timestamp.fromDate(until) }
      : { isFeatured: true, featuredSource: 'points', featuredAt: admin.firestore.FieldValue.serverTimestamp(), featuredUntil: admin.firestore.Timestamp.fromDate(until) });
    return { balanceAfter: bal - offer.cost };
  });

  await db.collection('notifications').add({
    userId: uid,
    type: 'points_redeemed',
    title: offer.label + ' is live! 🚀',
    message: '"' + title + '" now ' + (offer.key === 'boost7' ? 'sits near the top of search for 7 days' : 'wears the ⭐ Featured badge for 3 days') + ' — bought with your points. ' + outcome.balanceAfter + ' points left.',
    productId,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('redeemPointsOffer:', uid, offer.key, 'on', productId, '-', outcome.balanceAfter, 'left');
  return { ok: true, balanceAfter: outcome.balanceAfter, offer: offer.label, until: until.toISOString() };
});

/**
 * Points-funded boosts/features expire — a daily sweep retires them so paid
 * tiers keep their meaning. Shares the kiosk with the ops/tests callable so
 * we never have to wait 24h to prove it works.
 */
async function poSweepExpiredOffers() {
  const nowMs = Date.now();
  let cleared = 0, boostCount = 0, featCount = 0;
  // Points-funded perks are rare, so a single-field query + in-memory date
  // filter beats owning two composite indexes forever.
  const [boostedSnaps, featSnaps] = await Promise.all([
    db.collection('products').where('boostSource', '==', 'points').limit(400).get(),
    db.collection('products').where('featuredSource', '==', 'points').limit(400).get()
  ]);
  const toSweep = [];
  boostedSnaps.forEach(d => {
    const u = d.data().boostUntil;
    if (!u || u.toMillis() < nowMs) toSweep.push({ ref: d.ref, patch: { boostLevel: 0, isBoosted: false, boostSource: null, boostUntil: null } });
  });
  featSnaps.forEach(d => {
    const u = d.data().featuredUntil;
    if (!u || u.toMillis() < nowMs) toSweep.push({ ref: d.ref, patch: { isFeatured: false, featuredSource: null, featuredUntil: null } });
  });
  boostCount = toSweep.filter(t => t.patch.boostSource === null && 'boostUntil' in t.patch).length;
  featCount = toSweep.length - boostCount;
  for (let i = 0; i < toSweep.length; i += 450) {
    const batch = db.batch();
    toSweep.slice(i, i + 450).forEach(t => batch.update(t.ref, t.patch));
    await batch.commit();
  }
  cleared = toSweep.length;
  if (cleared) console.log('poSweepExpiredOffers: retired', cleared, 'expired points offer(s)');
  return { cleared, boosts: boostCount, featured: featCount };
}
exports.expirePointsOffers = functions.pubsub.schedule('every 24 hours').onRun(async () => poSweepExpiredOffers());
exports.expirePointsOffersNow = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  let callerIsAdmin = context.auth.token && context.auth.token.admin === true;
  if (!callerIsAdmin) {
    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    callerIsAdmin = callerDoc.exists && callerDoc.data().role === 'admin';
  }
  if (!callerIsAdmin) throw new functions.https.HttpsError('permission-denied', 'Admins only');
  return poSweepExpiredOffers();
});

// ============================================================================
// 🎁 REFERRALS — "bring a friend, both of you eat."
// Every member owns one short code (SM-XXXXXX). A friend who joins with it
// gets +15 welcome points immediately; the referrer gets +10 immediately and
// +40 more once the friend has claimed points on 2 distinct days (which the
// daily check-in makes impossible to fake faster than two real days).
// All money movement lives here server-side: browsers can only LOOK at
// referral records (rules lock the writes), and an account gets exactly ONE
// code attached, within 7 days of joining, never its own.
// ============================================================================
const REF_WELCOME = 15;          // to the friend, the moment the code lands
const REF_INSTANT = 10;          // to the referrer, the moment a friend joins
const REF_ACTIVE = 40;           // to the referrer, once the friend is real
const REF_WINDOW_DAYS = 7;       // how long after joining a code can be added
const REF_ACTIVE_MIN_AGE_MS = 48 * 3600e3; // + the 2-claim-days rule below

/** 'SM-' + the first alphanumerics of the uid, uppercased. */
function refCodeCandidate(uid, len) {
  return 'SM-' + String(uid).replace(/[^a-zA-Z0-9]/g, '').slice(0, len).toUpperCase();
}

async function refIsAdmin(context) {
  if (context.auth && context.auth.token && context.auth.token.admin === true) return true;
  const d = await db.collection('users').doc(context.auth.uid).get();
  return d.exists && d.data().role === 'admin';
}

/**
 * The Rewards page calls this to draw the Refer & Earn card. It also LAZILY
 * mints the caller's code (first visit), so no backfill script is needed and
 * codes only exist for people who actually look at them. Collisions between
 * short codes are handled by lengthening until unique.
 */
exports.getReferralOverview = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const uid = context.auth.uid;
  const userRef = db.collection('users').doc(uid);

  let code = null;
  let me = {};
  const first = await userRef.get();
  me = first.exists ? first.data() : {};
  code = me.referralCode || null;

  if (!code) {
    for (const len of [6, 8, 10, 12]) {
      const cand = refCodeCandidate(uid, len);
      if (cand.length <= 3) continue;
      const clash = await db.collection('users').where('referralCode', '==', cand).limit(1).get();
      if (clash.empty || clash.docs[0].id === uid) {
        await userRef.set({
          referralCode: cand,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        code = cand;
        break;
      }
    }
    if (!code) throw new functions.https.HttpsError('internal', 'Could not mint a referral code — try again.');
  }

  const madeCol = db.collection('referrals').doc(uid).collection('made');
  const [joinedAgg, activeAgg, earnSnap] = await Promise.all([
    madeCol.count().get(),
    madeCol.where('bonusPaid', '==', true).count().get(),
    db.collection('points').doc(uid).collection('ledger').where('type', '==', 'referral').limit(200).get()
  ]);
  let earned = 0;
  earnSnap.forEach((d) => { const a = Number(d.data().amount || 0); if (a > 0) earned += a; });

  const createdMs = me.createdAt && me.createdAt.toMillis ? me.createdAt.toMillis() : 0;
  const windowOpen = !me.referredBy && createdMs > 0 && (Date.now() - createdMs) < REF_WINDOW_DAYS * 864e5;

  return {
    code,
    joined: joinedAgg.data().count || 0,
    active: activeAgg.data().count || 0,
    earned,
    referredBy: me.referredBy ? { code: String(me.referredBy.code || ''), name: String(me.referredBy.name || '') } : null,
    windowOpen,
    rewards: { welcome: REF_WELCOME, instant: REF_INSTANT, active: REF_ACTIVE }
  };
});

/**
 * Attach somebody else's code to YOUR account. Called at registration (the
 * register page offers a code box) or later from the Rewards page inside the
 * 7-day window. Every abuse door is bolted: unknown codes, your own code, a
 * second code, an aged-out account — each gets a polite, specific refusal.
 */
exports.applyReferralCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const uid = context.auth.uid;

  let code = String((data && data.code) || '').trim().toUpperCase().replace(/[\s_]+/g, '');
  if (code.startsWith('SM') && code.charAt(2) !== '-') code = 'SM-' + code.slice(2);
  if (!/^SM-[A-Z0-9]{4,14}$/.test(code)) {
    throw new functions.https.HttpsError('invalid-argument', 'That code does not look right — Sankofa codes look like SM-ABC123.');
  }

  const match = await db.collection('users').where('referralCode', '==', code).limit(1).get();
  if (match.empty) {
    throw new functions.https.HttpsError('not-found', 'That code does not match anyone on Sankofa — check the spelling with your friend.');
  }
  const referrerId = match.docs[0].id;
  const referrerName = String(match.docs[0].data().name || match.docs[0].data().displayName || 'a Sankofa member').slice(0, 60);
  if (referrerId === uid) {
    throw new functions.https.HttpsError('failed-precondition', 'That is your own code 🙂 — send it to a friend instead.');
  }

  const newRef = db.collection('users').doc(uid);
  const meSnap0 = await newRef.get();
  const me0 = meSnap0.exists ? meSnap0.data() : {};
  if (me0.referredBy) {
    throw new functions.https.HttpsError('failed-precondition', 'A referral code is already attached to your account — one code per person.');
  }
  const createdMs = me0.createdAt && me0.createdAt.toMillis ? me0.createdAt.toMillis() : 0;
  if (!createdMs || (Date.now() - createdMs) > REF_WINDOW_DAYS * 864e5) {
    throw new functions.https.HttpsError('failed-precondition', 'Referral codes can only be added within ' + REF_WINDOW_DAYS + ' days of joining — that window has closed for this account.');
  }

  const joinerName = String(me0.name || me0.displayName || 'A friend').slice(0, 60);
  const myPts = db.collection('points').doc(uid);
  const refPts = db.collection('points').doc(referrerId);
  const madeRef = db.collection('referrals').doc(referrerId).collection('made').doc(uid);

  await db.runTransaction(async (tx) => {
    // all reads before all writes (Firestore transaction law)
    const [meSnap, myPtsSnap, refPtsSnap] = await Promise.all([tx.get(newRef), tx.get(myPts), tx.get(refPts)]);
    if (meSnap.exists && meSnap.data().referredBy) {
      throw new functions.https.HttpsError('failed-precondition', 'A referral code is already attached to your account.');
    }
    const ts = admin.firestore.FieldValue.serverTimestamp();
    tx.set(newRef, { referredBy: { code, uid: referrerId, name: referrerName, at: ts }, updatedAt: ts }, { merge: true });
    tx.set(madeRef, { code, at: ts, bonusPaid: false });

    const m = myPtsSnap.exists ? myPtsSnap.data() : {};
    tx.set(myPts, {
      balance: (m.balance || 0) + REF_WELCOME,
      totalEarned: (m.totalEarned || 0) + REF_WELCOME,
      updatedAt: ts
    }, { merge: true });
    tx.set(myPts.collection('ledger').doc(), {
      type: 'referral',
      amount: REF_WELCOME,
      note: 'Welcome gift 🎁 — you joined with ' + referrerName + '’s code',
      at: ts
    });

    const r = refPtsSnap.exists ? refPtsSnap.data() : {};
    tx.set(refPts, {
      balance: (r.balance || 0) + REF_INSTANT,
      totalEarned: (r.totalEarned || 0) + REF_INSTANT,
      updatedAt: ts
    }, { merge: true });
    tx.set(refPts.collection('ledger').doc(), {
      type: 'referral',
      amount: REF_INSTANT,
      note: joinerName + ' joined Sankofa with your code 🎉',
      at: ts
    });
  });

  await db.collection('notifications').add({
    userId: referrerId,
    type: 'referral_joined',
    title: '+' + REF_INSTANT + ' points — your code worked! 🎉',
    message: joinerName + ' just joined Sankofa with your code ' + code + '. +' + REF_INSTANT + ' points are in your balance now, and +' + REF_ACTIVE + ' more land once they check in on 2 different days.',
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('applyReferralCode:', code, 'linked', uid, '→', referrerId);
  return { ok: true, referrerName, bonus: REF_WELCOME };
});

/**
 * Settle the "+40 active-friend" bonuses. A referral matures when the friend
 * (a) claimed points on 2 distinct days — impossible to speed-run because the
 * check-in pays once per UTC day — and (b) the link is at least 48h old.
 * Idempotent: bonusPaid flips inside the same transaction that pays, so a
 * retry, a double-run or overlapping sweeps can never pay twice.
 */
async function sweepReferralBonuses(minAgeMs) {
  const minAge = (typeof minAgeMs === 'number' && isFinite(minAgeMs)) ? Math.max(0, minAgeMs) : REF_ACTIVE_MIN_AGE_MS;
  const nowMs = Date.now();
  const pending = await db.collectionGroup('made').where('bonusPaid', '==', false).limit(400).get();
  let scanned = 0, awarded = 0, skipped = 0;
  for (const doc of pending.docs) {
    scanned++;
    const refereeUid = doc.id;
    const referrerDoc = doc.ref.parent.parent;
    if (!referrerDoc) { skipped++; continue; }
    const referrerId = referrerDoc.id;
    const joinedMs = doc.data().at && doc.data().at.toMillis ? doc.data().at.toMillis() : nowMs;
    if (nowMs - joinedMs < minAge) { skipped++; continue; }
    const ptsSnap = await db.collection('points').doc(refereeUid).get();
    const days = ptsSnap.exists ? Number(ptsSnap.data().claimDays || 0) : 0;
    if (days < 2) { skipped++; continue; }

    let paid = false;
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (!fresh.exists || fresh.data().bonusPaid === true) return;
      const ts = admin.firestore.FieldValue.serverTimestamp();
      const rRef = db.collection('points').doc(referrerId);
      const r = await tx.get(rRef);
      const rb = r.exists ? r.data() : {};
      tx.set(rRef, {
        balance: (rb.balance || 0) + REF_ACTIVE,
        totalEarned: (rb.totalEarned || 0) + REF_ACTIVE,
        updatedAt: ts
      }, { merge: true });
      tx.set(rRef.collection('ledger').doc(), {
        type: 'referral',
        amount: REF_ACTIVE,
        note: 'A friend you invited is now an active member — bonus unlocked 🏆',
        at: ts
      });
      tx.update(doc.ref, { bonusPaid: true, bonusPaidAt: ts });
      paid = true;
    });
    if (paid) {
      await db.collection('notifications').add({
        userId: referrerId,
        type: 'referral_bonus',
        title: '+' + REF_ACTIVE + ' referral bonus! 🏆',
        message: 'One of the friends you invited is now an active Sankofa member (2 check-in days). +' + REF_ACTIVE + ' points just landed in your balance.',
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      awarded++;
    } else {
      skipped++;
    }
  }
  if (awarded) console.log('sweepReferralBonuses: paid', awarded, 'active-friend bonus(es), skipped', skipped);
  return { scanned, awarded, skipped };
}
exports.referralBonusSweep = functions.pubsub.schedule('every 24 hours').onRun(async () => sweepReferralBonuses());
exports.referralBonusSweepNow = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  if (!(await refIsAdmin(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only');
  // tests/ops may force the clock: referralBonusSweepNow({minAgeHours: 0})
  const h = data && data.minAgeHours;
  const minAgeMs = (typeof h === 'number' && isFinite(h)) ? h * 3600e3 : undefined;
  return sweepReferralBonuses(minAgeMs);
});

/* ============================================================================
 * VENDOR STOREFRONTS ("My Store") — Phase 1
 * ----------------------------------------------------------------------------
 * A seller opens their own branded mini-shop: name, web address (slug), logo,
 * theme color, story and contact details. The data lives in stores/{uid}
 * (one shop per seller), claimed addresses in storeSlugs/{slug}.
 * Clients NEVER write these collections directly: everything goes through
 * saveMyStore (validation + slug claim in one transaction). Admins moderate
 * (activate/deactivate) straight from the admin panel — their rules allow it.
 * ===========================================================================*/

/* === STORE CORE START (unit-tested pure helpers) === */

// Curated themes — a small palette keeps shops classy and CSS light.
const STORE_THEMES = {
    ocean: { name: 'Ocean Blue', c1: '#0064d2', c2: '#004a99', on: '#ffffff' },
    gold: { name: 'Sankofa Gold', c1: '#f5af02', c2: '#e09e00', on: '#191919' },
    forest: { name: 'Forest Green', c1: '#16a34a', c2: '#0e6e33', on: '#ffffff' },
    ruby: { name: 'Ruby Red', c1: '#dc2626', c2: '#991b1b', on: '#ffffff' },
    plum: { name: 'Royal Plum', c1: '#7c3aed', c2: '#5b21b6', on: '#ffffff' },
    night: { name: 'Midnight Navy', c1: '#131f47', c2: '#0a1024', on: '#ffffff' }
};

// '#rrggbb' — the only colour format shops are allowed to store.
const SM_STORE_HEX_RE = /^#[0-9a-f]{6}$/i;

/** Trim+lowercase a '#rrggbb', '' on anything else — for optional colour overrides. */
function smHexOrBlank(v) {
    var s = String(v || '').trim().toLowerCase();
    return SM_STORE_HEX_RE.test(s) ? s : '';
}

/** Integer 0–95 (transparencies), falling back to a default on junk. */
function smClampOpacity(v, dflt) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) n = dflt;
    return Math.min(95, Math.max(0, n));
}

// A #hex must only ever mix ONE colour — Sankofa derives the rest, so even a
// wild pick still renders as a tasteful gradient with readable text.
/** h ∈ [0,360), s/l ∈ [0,100] → '#rrggbb'. */
function smHslToHex(h, s, l) {
    h = ((Number(h) % 360) + 360) % 360;
    s = Math.min(100, Math.max(0, Number(s))) / 100;
    l = Math.min(100, Math.max(0, Number(l))) / 100;
    if (!isFinite(h) || !isFinite(s) || !isFinite(l)) return '#0064d2';
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    function to2(v) { return ('0' + Math.round((v + m) * 255).toString(16)).slice(-2); }
    return '#' + to2(r) + to2(g) + to2(b);
}

/** WCAG relative luminance of a '#rrggbb'. */
function smStoreRelLum(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255,
        g = parseInt(hex.slice(3, 5), 16) / 255,
        b = parseInt(hex.slice(5, 7), 16) / 255;
    function lin(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio between two '#rrggbb' colours (1–21). */
function smStoreContrastRatio(hexA, hexB) {
    var a = smStoreRelLum(hexA), b = smStoreRelLum(hexB);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * One hand-mixed colour → a complete, always-readable theme:
 * c1 = the mixed colour, c2 = a darker shade of the SAME hue (the gradient
 * end), on = whichever of white/dark has the better WORST-case contrast
 * across both ends of the gradient — so light picks get dark text and dark
 * picks get white text, never unreadable chalk-on-chalk.
 * Returns null on any non-hex input.
 */
function smStoreCustomColors(hex) {
    var c1 = String(hex || '').trim().toLowerCase();
    if (!SM_STORE_HEX_RE.test(c1)) return null;
    var r = parseInt(c1.slice(1, 3), 16) / 255,
        g = parseInt(c1.slice(3, 5), 16) / 255,
        b = parseInt(c1.slice(5, 7), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2, d = max - min, h = 0, s = 0;
    if (d > 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
    }
    h = ((h % 360) + 360) % 360;
    var c2 = smHslToHex(h, Math.min(100, s * 100 + 6), Math.max(8, l * 100 - 14));
    var w = Math.min(smStoreContrastRatio(c1, '#ffffff'), smStoreContrastRatio(c2, '#ffffff'));
    var k = Math.min(smStoreContrastRatio(c1, '#191919'), smStoreContrastRatio(c2, '#191919'));
    return { c1: c1, c2: c2, on: w >= k ? '#ffffff' : '#191919' };
}
const STORE_RESERVED_SLUGS = {
    admin: 1, 'sm-panel': 1, store: 1, stores: 1, shop: 1, shops: 1, api: 1,
    www: 1, mail: 1, help: 1, support: 1, contact: 1, about: 1,
    sankofa: 1, 'sankofa-market': 1, sankofastore: 1, 'sankofa-store': 1, official: 1,
    search: 1, cart: 1, wallet: 1, login: 1, register: 1, signup: 1,
    publish: 1, auction: 1, auctions: 1, messages: 1, notifications: 1,
    orders: 1, listings: 1, dashboard: 1, profile: 1, wishlist: 1,
    terms: 1, privacy: 1, refunds: 1, 'refund-policy': 1, payouts: 1
};

/**
 * Turn "Kofi's Phones ®!" into "kofis-phones": lowercase, dashes for spaces,
 * only [a-z0-9-], no doubled dashes, no leading/trailing dash.
 */
function smNormalizeStoreSlug(raw) {
    var s = String(raw || '').toLowerCase().trim();
    s = s.replace(/['’]/g, '');
    s = s.replace(/[^a-z0-9]+/g, '-');
    s = s.replace(/-{2,}/g, '-');
    s = s.replace(/^-+|-+$/g, '');
    return s;
}

/**
 * Validate + sanitize everything a seller sends for their store.
 * Returns { ok:true, value:{...clean fields} } or { ok:false, error:'plain reason' }.
 */
function smSanitizeStoreInput(data) {
    var d = (data && typeof data === 'object') ? data : {};

    var storeName = String(d.storeName || '').replace(/\s+/g, ' ').trim();
    if (storeName.length < 2) return { ok: false, error: 'Give your store a name (at least 2 characters).' };
    if (storeName.length > 40) return { ok: false, error: 'Store name is too long — keep it under 40 characters.' };

    var slug = smNormalizeStoreSlug(d.slug || storeName);
    if (slug.length < 3) return { ok: false, error: 'Web address must be at least 3 characters.' };
    if (slug.length > 24) return { ok: false, error: 'Web address is too long — keep it under 25 characters.' };
    if (!/^[a-z0-9]/.test(slug)) return { ok: false, error: 'Web address must start with a letter or number.' };
    if (STORE_RESERVED_SLUGS[slug]) return { ok: false, error: 'That web address is reserved — please pick another.' };

    var theme = String(d.theme || 'ocean').toLowerCase();
    var themePrimary = '';
    if (theme === 'custom') {
        // Slider-mixed colour: only the mixed #hex crosses the wire — the
        // server re-derives the gradient end + text colour itself, so what
        // hits the database can always be rendered readable.
        themePrimary = String(d.themePrimary || '').trim().toLowerCase();
        if (!SM_STORE_HEX_RE.test(themePrimary)) {
            return { ok: false, error: 'Mix a colour with the sliders (or tap a ready-made swatch), then save again.' };
        }
    } else if (!STORE_THEMES[theme]) theme = 'ocean';

    // Optional text-colour choice for the shop name & hero text. 'auto' lets
    // Sankofa pick the readable one; 'light'/'dark' are for sellers whose
    // banner photo fights the automatic pick.
    var themeTextMode = String(d.themeTextMode || 'auto').toLowerCase();
    if (themeTextMode !== 'light' && themeTextMode !== 'dark') themeTextMode = 'auto';

    // Banner "veil" — the tinted see-through layer between the hero photo and
    // the shop text. Three modes keep the picker to one tap; opacity 0 (photo
    // dominates) – 95 (faint whisper of photo).
    var bannerShadeMode = String(d.bannerShadeMode || 'night').toLowerCase();
    if (['night', 'white', 'theme'].indexOf(bannerShadeMode) === -1) bannerShadeMode = 'night';
    var bannerShadeOpacity = Math.round(Number(d.bannerShadeOpacity));
    if (!isFinite(bannerShadeOpacity)) bannerShadeOpacity = 60;
    bannerShadeOpacity = Math.min(95, Math.max(0, bannerShadeOpacity));

    // Advanced styling overrides — every one is optional; ''/0 means "use the
    // automatic look". hexOrBlank guarantees only real #rrggbb can be stored.
    var heroTextColor = smHexOrBlank(d.heroTextColor);               // custom hero text colour
    var heroTextBgColor = smHexOrBlank(d.heroTextBgColor);           // plate behind name+buttons
    var heroTextBgOpacity = smClampOpacity(d.heroTextBgOpacity, 0);  // 0 = plate off
    var announceTextColor = smHexOrBlank(d.announceTextColor);       // '' = follow hero text
    var announceBgColor = smHexOrBlank(d.announceBgColor);           // '' = default translucent chip
    var announceBgOpacity = smClampOpacity(d.announceBgOpacity, 0);  // 0 = Sankofa's default strip

    var bio = String(d.bio || '').replace(/\s+/g, ' ').trim();
    if (bio.length > 240) return { ok: false, error: 'Store story is too long — keep it under 240 characters.' };

    var phone = String(d.phone || '').replace(/[\s\-().]/g, '').trim();
    if (phone && !/^\+?[0-9]{7,15}$/.test(phone)) return { ok: false, error: 'Phone number looks wrong — digits only, 7 to 15 of them.' };

    // Optional contact email shown as an "Email" button on the shop page
    // (revealed to signed-in buyers only, exactly like the phone number).
    var email = String(d.email || '').trim().toLowerCase();
    if (email.length > 80) return { ok: false, error: 'Contact email is too long — keep it under 80 characters.' };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return { ok: false, error: 'That contact email doesn\'t look right — please check it.' };
    }

    var location = String(d.location || '').replace(/\s+/g, ' ').trim().slice(0, 60);

    // Phase 3: a one-line shop announcement ("We deliver free inside Accra this week!")
    var announcement = String(d.announcement || '').replace(/\s+/g, ' ').trim();
    if (announcement.length > 120) return { ok: false, error: 'Announcement is too long — keep it under 120 characters.' };

    var logoUrl = String(d.logoUrl || '').trim();
    if (logoUrl.length > 500 || (logoUrl && !/^https:\/\//.test(logoUrl))) return { ok: false, error: 'Logo link looks wrong — upload the image again.' };
    var logoThumbUrl = String(d.logoThumbUrl || '').trim();
    if (logoThumbUrl.length > 500 || (logoThumbUrl && !/^https:\/\//.test(logoThumbUrl))) logoThumbUrl = '';

    // Tier 3: optional shop banner (hero backdrop). Same rules as the logo.
    var bannerUrl = String(d.bannerUrl || '').trim();
    if (bannerUrl.length > 500 || (bannerUrl && !/^https:\/\//.test(bannerUrl))) return { ok: false, error: 'Banner link looks wrong — upload the image again.' };
    var bannerThumbUrl = String(d.bannerThumbUrl || '').trim();
    if (bannerThumbUrl.length > 500 || (bannerThumbUrl && !/^https:\/\//.test(bannerThumbUrl))) bannerThumbUrl = '';

    return {
        ok: true,
        value: { storeName: storeName, slug: slug, theme: theme, themePrimary: themePrimary, themeTextMode: themeTextMode, bannerShadeMode: bannerShadeMode, bannerShadeOpacity: bannerShadeOpacity, heroTextColor: heroTextColor, heroTextBgColor: heroTextBgColor, heroTextBgOpacity: heroTextBgOpacity, announceTextColor: announceTextColor, announceBgColor: announceBgColor, announceBgOpacity: announceBgOpacity, email: email, bio: bio, phone: phone, location: location, logoUrl: logoUrl, logoThumbUrl: logoThumbUrl, announcement: announcement, bannerUrl: bannerUrl, bannerThumbUrl: bannerThumbUrl }
    };
}

/**
 * Assemble the stores/{uid} document. THE RULE: sellers can never flip
 * isActive themselves — a brand-new store starts pending, an existing store
 * keeps whatever the admin last decided.
 */
function smBuildStorePayload(existing, clean, uid, ownerName) {
    return {
        ownerId: uid,
        ownerName: String(ownerName || 'Seller').slice(0, 60),
        storeName: clean.storeName,
        slug: clean.slug,
        theme: clean.theme,
        // The exact colours the shop wears. Hand-mixed picks are re-derived
        // server-side (never trusting the client for the gradient/text), and
        // curated themes are spelled out too — so the storefront simply reads
        // themeColors and paints, no palette lookup needed for new shops.
        themeTextMode: clean.themeTextMode || 'auto',
        // Banner veil (how the hero photo is shaded behind the text)
        bannerShade: {
            mode: clean.bannerShadeMode === 'white' || clean.bannerShadeMode === 'theme' ? clean.bannerShadeMode : 'night',
            opacity: Math.min(95, Math.max(0, Math.round(Number(clean.bannerShadeOpacity) || 60)))
        },
        themeColors: (function () {
            var pal = STORE_THEMES.ocean;
            var t;
            if (clean.theme === 'custom') {
                t = smStoreCustomColors(clean.themePrimary) || { c1: pal.c1, c2: pal.c2, on: pal.on };
            } else {
                var p = STORE_THEMES[clean.theme] || pal;
                t = { c1: p.c1, c2: p.c2, on: p.on };
            }
            // Seller-picked text colour (banner conflicts) beats the auto pick;
            // a fully custom hero text colour (advanced) beats everything.
            if (clean.themeTextMode === 'light') t.on = '#ffffff';
            else if (clean.themeTextMode === 'dark') t.on = '#191919';
            if (clean.heroTextColor) t.on = clean.heroTextColor;
            return t;
        })(),
        // Advanced overrides, stored verbatim (all already sanitized above).
        heroTextColor: clean.heroTextColor,
        heroTextBgColor: clean.heroTextBgColor,
        heroTextBgOpacity: clean.heroTextBgOpacity,
        announceTextColor: clean.announceTextColor,
        announceBgColor: clean.announceBgColor,
        announceBgOpacity: clean.announceBgOpacity,
        bio: clean.bio,
        phone: clean.phone,
        email: clean.email || '',
        location: clean.location,
        logoUrl: clean.logoUrl,
        logoThumbUrl: clean.logoThumbUrl,
        bannerUrl: clean.bannerUrl || (existing ? (existing.bannerUrl || '') : ''),
        bannerThumbUrl: clean.bannerThumbUrl || (existing ? (existing.bannerThumbUrl || '') : ''),
        announcement: clean.announcement || '',
        isActive: existing ? existing.isActive === true : false,
        createdAt: existing && existing.createdAt ? existing.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

/**
 * Write a seller's shop inside a transaction WITHOUT erasing what the server keeps
 * on the store. `merge: true` is the whole point: a plain set() REPLACES the whole
 * document, so every save used to wipe the seller's plan (trial or paid days).
 * Regression-tested in stores-test.mjs ("save keeps the seller plan").
 */
function smWriteSellerStore(tx, storeRef, payload) {
    tx.set(storeRef, payload, { merge: true });
}

/* === STORE CORE END === */

/**
 * saveMyStore — the ONLY way a seller creates/edits their store.
 * Validates the input, then claims the web address and writes the store in
 * ONE transaction: if the slug belongs to someone else, nothing is written.
 */
exports.saveMyStore = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first, then set up your store.');
    const uid = context.auth.token.uid;

    const clean = smSanitizeStoreInput(data);
    if (!clean.ok) throw new functions.https.HttpsError('invalid-argument', clean.error);
    const v = clean.value;

    const db = admin.firestore();

    // Snapshot the seller's display name for the storefront & admin table
    let ownerName = String(context.auth.token.name || context.auth.token.email || 'Seller').split('@')[0];
    try {
        const u = await db.collection('users').doc(uid).get();
        if (u.exists) {
            const d = u.data();
            ownerName = String(d.name || ((d.firstName || '') + (d.lastName ? ' ' + d.lastName : '')).trim() || d.displayName || ownerName).slice(0, 60);
        }
    } catch (e) { /* fall back to the auth token name */ }

    await db.runTransaction(async (tx) => {
        const slugRef = db.collection('storeSlugs').doc(v.slug);
        const storeRef = db.collection('stores').doc(uid);
        // All reads BEFORE any write (Firestore transaction rule)
        const slugSnap = await tx.get(slugRef);
        const storeSnap = await tx.get(storeRef);

        if (slugSnap.exists && slugSnap.data().ownerId !== uid) {
            throw new functions.https.HttpsError('already-exists', 'That web address is taken — please pick another.');
        }

        const existing = storeSnap.exists ? storeSnap.data() : null;
        const oldSlug = existing && existing.slug;
        if (oldSlug && oldSlug !== v.slug) {
            tx.delete(db.collection('storeSlugs').doc(oldSlug));   // releasing the old address frees it for others
        }
        tx.set(slugRef, { ownerId: uid, updatedAt: new Date().toISOString() });
        smWriteSellerStore(tx, storeRef, smBuildStorePayload(existing, v, uid, ownerName));
    });

    console.log('saveMyStore: ' + uid + ' saved store "' + v.storeName + '" at /store/' + v.slug);
    return { ok: true, slug: v.slug };
});

/* ============================================================================
 * VENDOR STOREFRONTS — Phase 2: paid shop plans (rent)
 * ----------------------------------------------------------------------------
 * Plans: monthly / quarterly / yearly, priced in GHS from settings/storeBilling
 * (admin-editable from /sm-panel → Vendor Shops; safe defaults survive a
 * missing doc). Payment paths mirror the proven money flows:
 *   👛 wallet  → payStorePlanWithWallet   (debit inside ONE transaction)
 *   💳 card/momo → Paystack popup, then verifyStorePlanPayment (verified with
 *                  Paystack + idempotent via paystackRefs)
 * Paying stacks: a renewal extends the CURRENT end date (never cuts it short)
 * and instantly re-activates a paused shop. storePlanSweep (hourly) warns 3
 * days before the end, then switches the shop off after the grace days.
 * Billing only bites when the owner flips requirePayment on — during the free
 * launch, shops stay on admin approval alone.
 * ===========================================================================*/

/* === STORE BILLING CORE START (unit-tested pure helpers) === */

const STORE_PLAN_DAYS = { monthly: 30, quarterly: 91, yearly: 365 };
const STORE_PLAN_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

/** Defaults when settings/storeBilling does not exist yet. */
function smStoreBillingDefaults() {
    return { monthly: 50, quarterly: 135, yearly: 480, graceDays: 3, requirePayment: false,
             chargeApprovedShops: false, trialDays: 30 };
}

/**
 * Sanitize an admin-edited billing config. Prices clamp to sane GHS values,
 * grace days to 0–30, requirePayment forced boolean — a broken settings doc
 * can never zero out prices or lock every shop off by accident.
 */
function smSanitizeBillingConfig(raw) {
    var d = smStoreBillingDefaults();
    var r = (raw && typeof raw === 'object') ? raw : {};
    ['monthly', 'quarterly', 'yearly'].forEach(function (k) {
        var n = Number(r[k]);
        if (isFinite(n)) d[k] = Math.min(100000, Math.max(1, Math.round(n * 100) / 100));
    });
    var g = Number(r.graceDays);
    if (isFinite(g)) d.graceDays = Math.min(30, Math.max(0, Math.floor(g)));
    d.requirePayment = r.requirePayment === true;
    // Should admin-approved shops (no purchased plan) also be charged, after a
    // free trial? OFF by default — flipping it on never happens by accident.
    d.chargeApprovedShops = r.chargeApprovedShops === true;
    var td = Math.round(Number(r.trialDays));
    if (isFinite(td)) d.trialDays = Math.min(365, Math.max(0, td));
    return d;
}

/**
 * The golden rule of renewals: time STACKS onto whatever is left,
 * never resets it. Ends in the past renew from right now.
 */
function smComputeStorePlanEnd(existingEndsIso, nowMs, tier) {
    var days = STORE_PLAN_DAYS[tier];
    if (!days) return null;
    var base = nowMs;
    var prev = existingEndsIso ? new Date(existingEndsIso).getTime() : 0;
    if (!isNaN(prev) && prev > nowMs) base = prev;
    return new Date(base + days * 86400000).toISOString();
}

/**
 * Where a PAID purchase's days start counting (decision 2026-10-08, option B).
 * - Buying while a FREE TRIAL runs: a fresh paid term starts on the purchase day.
 *   The trial's leftover days are dropped, so the countdown matches what was paid.
 * - Renewing a running PAID term: unchanged, the days stack onto what is left.
 * - No plan, or a plan that has already ended: starts now.
 */
function smPurchaseEndFor(existing, nowMs, tier) {
    var e = (existing && typeof existing === 'object') ? existing : null;
    var stackOnto = (e && !smIsTrialPlan(e)) ? e.endsAt : null;
    return smComputeStorePlanEnd(stackOnto, nowMs, tier);
}

/**
 * Free for life (Tier 5, option 2). The admin can exempt a shop from every plan rule:
 * no free trial is granted, the expiry sweep never switches it off, and no reminders
 * are sent. The flag sits on the store itself, not inside `plan`, so a payment that
 * rewrites `plan` can never clear it.
 */
function smIsFreeForLife(store) {
    return !!(store && store.freeForLife === true);
}

/** Admin input for the free-for-life switch: a shop id and on / off. */
function smFreeForLifeInput(data) {
    const d = (data && typeof data === 'object') ? data : {};
    const uid = String(d.uid || '').trim();
    if (!uid || uid.length > 128 || /[\/\s]/.test(uid)) return { ok: false, error: 'Pick a shop first.' };
    if (typeof d.on !== 'boolean') return { ok: false, error: 'Say whether the shop is free for life (on or off).' };
    return { ok: true, value: { uid: uid, on: d.on } };
}

/* --- Banked-days rules (the promise sellers already read) ---------------------
 * While rent is OFF, paying must never burn days: purchases are BANKED
 * (plan.bankedDays, no end date), so nothing can expire on the clock. The
 * admin turning rent on starts every banked plan counting from that moment;
 * turning rent off again freezes whatever is left back into the bank.
 * These three helpers ARE that rule, kept pure so the tests pin it down. */

/** Days currently banked (never negative). */
function smPlanBankedDays(plan) {
    var n = Math.round(Number(plan && plan.bankedDays));
    return isFinite(n) && n > 0 ? n : 0;
}

/** Buying while rent is OFF: add the tier's days to the bank. */
function smPlanBankOnPurchase(plan, tier) {
    return smPlanBankedDays(plan) + (STORE_PLAN_DAYS[tier] || 0);
}

/** A trial plan is a plan we granted for free — never banked, never "paid days". */
function smIsTrialPlan(plan) {
    return !!(plan && (plan.trial === true || plan.method === 'trial'));
}

/**
 * The free-trial plan granted to an admin-approved shop when the admin turns on
 * "charge approved shops". Money-free: amount 0, method 'trial'. The normal
 * storePlanSweep then handles the reminders and the pause — same rails as a
 * paid plan, no separate machinery.
 */
function smTrialPlan(nowMs, trialDays) {
    var days = Math.min(365, Math.max(0, Math.round(Number(trialDays))));
    if (!days) return null;
    var iso = new Date(nowMs).toISOString();
    return {
        tier: 'trial', method: 'trial', amount: 0, ref: null, trial: true,
        paidAt: iso, startedAt: iso,
        endsAt: new Date(nowMs + days * 86400000).toISOString(),
        bankedDays: 0, reminderSentAt: null, expiredNotifiedAt: null
    };
}

/**
 * Rent turned OFF: freeze what is LEFT of a running plan back into the bank.
 * Returns null when there is nothing to freeze (no end date, or already past,
 * or a TRIAL — trial time is free, so banking it would invent paid days).
 */
function smFreezePlanPatch(plan, nowMs) {
    if (smIsTrialPlan(plan)) return null;
    var endsMs = plan && plan.endsAt ? new Date(plan.endsAt).getTime() : 0;
    var left = isFinite(endsMs) && endsMs > nowMs ? Math.ceil((endsMs - nowMs) / 86400000) : 0;
    if (left <= 0) return null;
    return { bankedDays: left, endsAt: null };
}

/**
 * Rent turned ON: banked days start counting NOW (this is the "days start
 * counting when billing begins" promise, kept literally). Null when nothing.
 */
function smStartBankedPlan(plan, nowMs) {
    var days = smPlanBankedDays(plan);
    if (!days) return null;
    return { endsAt: new Date(nowMs + days * 86400000).toISOString(), startedAt: new Date(nowMs).toISOString(), bankedDays: 0 };
}

/* --- Payments readiness (before charging is switched on) --------------------
 * Turning rent on while the gateway is still in TEST mode would greet sellers
 * with failed payments and lapsing trials. These pure helpers turn the raw
 * config into plain-English answers the admin panel can show. Keys are never
 * echoed back — only their MODE. */

/** 'sk_test_…' → 'test', 'sk_live_…' → 'live', '' → 'missing', anything else 'unknown'. */
function smKeyMode(key) {
    var k = String(key || '').trim();
    if (!k) return 'missing';
    if (k.indexOf('_live_') !== -1) return 'live';
    if (k.indexOf('_test_') !== -1) return 'test';
    return 'unknown';
}

/**
 * The readiness picture + its warnings, from already-gathered facts:
 *   { chargingOn, trialsOn, secretMode, publicMode, emailConfigured }
 * Returns { level: 'ok'|'warn'|'stop', warnings: [...], rows: [...] } — the
 * admin panel renders rows verbatim and shows the warnings in plain English.
 */
function smBillingReadiness(f) {
    var d = f || {};
    var testKeys = d.secretMode === 'test' || d.publicMode === 'test';
    var mismatched = d.secretMode !== 'missing' && d.publicMode !== 'missing' &&
                     d.secretMode !== d.publicMode;
    var noSecret = d.secretMode === 'missing';

    var warnings = [];
    if (d.chargingOn && testKeys) {
        warnings.push('Charging is ON but Paystack is in TEST mode — sellers cannot pay real money. Switch to LIVE keys before charging.');
    }
    if (mismatched) {
        warnings.push('The public key and secret key are from different modes (one test, one live) — payments will fail. Make both LIVE or both TEST.');
    }
    if (d.chargingOn && noSecret) {
        warnings.push('Charging is ON but the secret key is missing — card/MoMo payments cannot work; only wallet payments will succeed.');
    }
    if (d.chargingOn && !d.emailConfigured) {
        warnings.push('Emails are not set up — trial and renewal reminders will appear in the app but no emails will be sent.');
    }
    if (d.emailState === 'failed') {
        warnings.push('The last email test failed, so receipts and reminders are not reaching sellers or buyers. Fix the EmailJS settings on the Emails page, then send a test.');
    } else if (d.emailState === 'untested' && d.chargingOn) {
        warnings.push('Emails are saved but have not been tested yet. Send a test from the Emails page to confirm they arrive.');
    }
    if (d.trialsOn && !d.chargingOn) {
        warnings.push('Trials are enabled but rent is OFF — no trials will run until rent is switched on.');
    }

    var rows = [
        { label: 'Card / MoMo payments', state: d.secretMode === 'live' && d.publicMode === 'live' ? 'ok'
            : (testKeys ? 'test' : (noSecret ? 'off' : 'unknown')) },
        { label: 'Emails (reminders, receipts)', state: d.emailState || (d.emailConfigured ? 'ok' : 'off') },
        { label: 'Charging rent', state: d.chargingOn ? 'on' : 'off' },
        { label: 'Trials for approved shops', state: d.trialsOn ? 'on' : 'off' }
    ];

    var level = 'ok';
    if (warnings.length) level = (d.chargingOn ? 'stop' : 'warn');
    return { level: level, warnings: warnings, rows: rows };
}

/**
 * The subscription day the countdown runs from. A renewal made while a paid term is
 * still running keeps the ORIGINAL start, so the countdown is measured from the day
 * the seller first subscribed. A new run starts now, and a trial never carries into a
 * paid term's start. Display only: amounts and end dates do not depend on this value.
 */
function smPlanStartFor(existing, nowMs) {
    var e = (existing && typeof existing === 'object') ? existing : null;
    var endsMs = e && e.endsAt ? new Date(e.endsAt).getTime() : 0;
    var continuing = !!(e && !e.trial && e.method !== 'trial' && e.startedAt && endsMs > nowMs);
    return continuing ? e.startedAt : new Date(nowMs).toISOString();
}

/* === STORE BILLING CORE END === */

async function smGetStoreBilling(db) {
    try {
        const snap = await db.collection('settings').doc('storeBilling').get();
        if (snap.exists) return smSanitizeBillingConfig(snap.data());
    } catch (e) { console.error('store billing config read failed', e && e.message); }
    return smStoreBillingDefaults();
}

/**
 * The shared "credit a paid plan" logic, expressed as transaction WRITES.
 * Reads must already be done by the caller (Firestore: reads before writes).
 * Returns the plan object that was written (for receipts).
 */
function smWriteStorePlanCredit(tx, db, opts) {
    const now = new Date();
    const existing = opts.existingPlan || null;
    let plan;
    if (opts.rentOn) {
        // Rent is live: days count from now (stacking onto any end date left).
        plan = {
            tier: opts.tier,
            amount: round2(opts.amount),
            method: opts.method,
            ref: opts.ref || null,
            paidAt: now.toISOString(),
            startedAt: smPlanStartFor(existing, now.getTime()),
            endsAt: smPurchaseEndFor(existing, now.getTime(), opts.tier),
            bankedDays: 0,
            reminderSentAt: null,
            expiredNotifiedAt: null
        };
    } else {
        // Free launch: BANK the days — nothing may expire while rent is off, and
        // the clock only starts the moment the admin switches billing on.
        plan = {
            tier: opts.tier,
            amount: round2(opts.amount),
            method: opts.method,
            ref: opts.ref || null,
            paidAt: now.toISOString(),
            startedAt: now.toISOString(),
            endsAt: null,
            bankedDays: smPlanBankOnPurchase(existing, opts.tier),
            reminderSentAt: null,
            expiredNotifiedAt: null
        };
    }
    // Payment is also the re-activation switch: a paid shop goes (back) LIVE.
    tx.update(opts.storeRef, { plan: plan, isActive: true, updatedAt: now.toISOString() });
    tx.set(db.collection('storePlanPayments').doc(), {
        ownerId: opts.uid,
        storeSlug: opts.slug || null,
        storeName: opts.storeName || null,
        tier: opts.tier,
        amount: round2(opts.amount),
        method: opts.method,
        ref: opts.ref || null,
        endsAt: plan.endsAt,
        bankedDays: plan.bankedDays,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return plan;
}

/**
 * Rent turned ON: make every banked plan real (endsAt = now + banked days).
 * Idempotent — safe to re-run; also called by the hourly sweep as a self-heal.
 */
async function smStartBankedPlans(db) {
    const snap = await db.collection('stores').where('plan.bankedDays', '>', 0).limit(400).get();
    if (snap.empty) return 0;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    let n = 0;
    const batch = db.batch();
    snap.forEach(function (d) {
        const patch = smStartBankedPlan(d.data().plan, nowMs);
        if (!patch) return;
        batch.update(d.ref, {
            'plan.endsAt': patch.endsAt,
            'plan.startedAt': patch.startedAt,
            'plan.bankedDays': 0,
            'plan.reminderSentAt': null,
            'plan.expiredNotifiedAt': null,
            updatedAt: nowIso
        });
        n++;
    });
    if (n) await batch.commit();
    return n;
}

/**
 * Rent turned OFF: freeze the remaining days of every running plan back into
 * the bank, so nobody loses paid time to a pause in billing. Plans that had
 * already expired keep their (past) end date and stay subject to the sweep.
 */
async function smFreezeRunningPlans(db) {
    const snap = await db.collection('stores').where('plan.endsAt', '!=', null).limit(400).get();
    if (snap.empty) return 0;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    let n = 0;
    const batch = db.batch();
    snap.forEach(function (d) {
        const patch = smFreezePlanPatch(d.data().plan, nowMs);
        if (!patch) return;
        batch.update(d.ref, { 'plan.endsAt': null, 'plan.bankedDays': patch.bankedDays, updatedAt: nowIso });
        n++;
    });
    if (n) await batch.commit();
    return n;
}

/**
 * Grant a free trial to every LIVE shop that has no plan at all — used when the
 * admin turns on "charge approved shops" (and again on the hourly sweep as a
 * self-heal, so a shop approved while something hiccuped still gets its trial).
 * Idempotent: a shop with any existing plan (paid, banked or trial) is skipped.
 */
async function smGrantTrials(db, trialDays) {
    const snap = await db.collection('stores').where('isActive', '==', true).limit(400).get();
    if (snap.empty) return 0;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    let n = 0;
    const batch = db.batch();
    snap.forEach(function (d) {
        const st = d.data() || {};
        if (smIsFreeForLife(st)) return;   // free for life: never a trial
        const plan = st.plan || null;
        if (plan && (plan.endsAt || plan.bankedDays > 0 || plan.paidAt)) return;   // already has history
        const trial = smTrialPlan(nowMs, trialDays);
        if (!trial) return;
        batch.update(d.ref, { plan: trial, updatedAt: nowIso });
        n++;
    });
    if (n) await batch.commit();
    return n;
}

/**
 * Remove trial plans entirely (rent switched off, or charging approved shops
 * switched off). Trials are free, so there is nothing to bank — the shops simply
 * stay live exactly as if the trial never existed. Paid plans are untouched.
 */
async function smClearTrialPlans(db) {
    const snap = await db.collection('stores').where('plan.endsAt', '!=', null).limit(400).get();
    if (snap.empty) return 0;
    const nowIso = new Date().toISOString();
    let n = 0;
    const batch = db.batch();
    snap.forEach(function (d) {
        const plan = (d.data() || {}).plan;
        if (!smIsTrialPlan(plan)) return;
        batch.update(d.ref, { plan: null, updatedAt: nowIso });
        n++;
    });
    if (n) await batch.commit();
    return n;
}

/** 👛 Wallet path: debit + credit the plan in ONE transaction. */
exports.payStorePlanWithWallet = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in to pay for your shop plan.');
    const uid = context.auth.token.uid;
    const tier = String((data || {}).tier || '').toLowerCase();
    const days = STORE_PLAN_DAYS[tier];
    if (!days) throw new functions.https.HttpsError('invalid-argument', 'Pick a plan: monthly, quarterly or yearly.');

    const db = admin.firestore();
    const walletRef = db.collection('wallets').doc(uid);
    const storeRef = db.collection('stores').doc(uid);
    const billing = await smGetStoreBilling(db);
    const price = billing[tier];

    const result = await db.runTransaction(async (tx) => {
        const walletDoc = await tx.get(walletRef);
        const storeDoc = await tx.get(storeRef);
        if (!storeDoc.exists) {
            throw new functions.https.HttpsError('failed-precondition', 'Set up your store first (name, address, theme), then pay for the plan.');
        }
        const store = storeDoc.data();
        const wallet = walletDoc.exists ? walletDoc.data() : { balance: 0, totalSpent: 0 };
        const balance = round2(wallet.balance || 0);
        if (balance < price) {
            throw new functions.https.HttpsError('failed-precondition',
                'Wallet balance GHS ' + balance.toLocaleString() + ' is below the ' + STORE_PLAN_LABELS[tier] +
                ' plan price of GHS ' + Number(price).toLocaleString() + '. Top up your wallet first, or pay with card/momo.');
        }
        const newBalance = round2(balance - price);
        const now = admin.firestore.FieldValue.serverTimestamp();

        tx.update(walletRef, {
            balance: newBalance,
            totalSpent: round2(Number(wallet.totalSpent || 0) + price),
            updatedAt: now
        });
        tx.set(db.collection('walletTransactions').doc(), {
            userId: uid,
            type: 'store_plan',
            amount: -round2(price),
            balanceAfter: newBalance,
            productTitle: (store.storeName || 'Vendor shop') + ' — ' + STORE_PLAN_LABELS[tier] + ' plan',
            description: STORE_PLAN_LABELS[tier] + ' shop plan (' + STORE_PLAN_DAYS[tier] + ' days) for /store/' + (store.slug || uid),
            status: 'completed',
            createdAt: now
        });
        const plan = smWriteStorePlanCredit(tx, db, {
            uid, storeRef, tier, amount: price, method: 'wallet', ref: null,
            existingPlan: store.plan || null, rentOn: billing.requirePayment === true,
            slug: store.slug, storeName: store.storeName
        });
        return { newBalance, plan, storeName: store.storeName || 'your shop', slug: store.slug };
    });

    console.log('🏪 store plan (wallet):', uid, tier, 'until', result.plan.endsAt);
    try {
        const email = context.auth.token.email || await emailForUser(uid);
        await sendEmail('store_plan_paid', email, {
            name: result.storeName, tier: STORE_PLAN_LABELS[tier], days: STORE_PLAN_DAYS[tier],
            amount: price, ends: result.plan.endsAt, slug: result.slug, method: 'Sankofa Wallet'
        });
    } catch (e) { console.error('store plan receipt email failed', e && e.message); }

    return { ok: true, balance: result.newBalance, endsAt: result.plan.endsAt, storeName: result.storeName };
});

/** 💳 Paystack path: verify the popup reference, then credit (idempotent). */
exports.verifyStorePlanPayment = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in to pay for your shop plan.');
    const uid = context.auth.token.uid;
    const reference = String((data || {}).reference || '').trim();
    const tier = String((data || {}).tier || '').toLowerCase();
    if (!reference) throw new functions.https.HttpsError('invalid-argument', 'Payment reference required.');
    if (!STORE_PLAN_DAYS[tier]) throw new functions.https.HttpsError('invalid-argument', 'Pick a plan: monthly, quarterly or yearly.');

    const db = admin.firestore();
    const billing = await smGetStoreBilling(db);
    const price = billing[tier];

    const payData = await paystackVerifyReference(reference);
    if (String(payData.status || '').toLowerCase() !== 'success') {
        throw new functions.https.HttpsError('failed-precondition', 'Paystack says this payment is not successful. Nothing was credited.');
    }
    const paidPesewas = Number(payData.amount || 0);
    if (paidPesewas < pesewas(price) - 1) {
        throw new functions.https.HttpsError('failed-precondition',
            'Paid amount GHS ' + (paidPesewas / 100).toLocaleString() + ' is below the plan price GHS ' + Number(price).toLocaleString() + '. Nothing was credited — contact support.');
    }
    if (String(payData.currency || 'GHS').toUpperCase() !== 'GHS') {
        throw new functions.https.HttpsError('failed-precondition', 'Payments must be in GHS.');
    }

    const storeRef = db.collection('stores').doc(uid);
    const refRef = db.collection('paystackRefs').doc(reference);

    const result = await db.runTransaction(async (tx) => {
        const refDoc = await tx.get(refRef);
        const storeDoc = await tx.get(storeRef);
        if (refDoc.exists) {
            return { alreadyCredited: true, endsAt: (refDoc.data().storePlanEndsAt || null), storeName: null };
        }
        if (!storeDoc.exists) {
            throw new functions.https.HttpsError('failed-precondition', 'Set up your store first (name, address, theme), then pay for the plan.');
        }
        const store = storeDoc.data();
        const plan = smWriteStorePlanCredit(tx, db, {
            uid, storeRef, tier, amount: price, method: 'paystack', ref: reference,
            existingPlan: store.plan || null, rentOn: billing.requirePayment === true,
            slug: store.slug, storeName: store.storeName
        });
        tx.set(refRef, {
            kind: 'store_plan', uid, tier, amount: round2(price),
            storePlanEndsAt: plan.endsAt,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { alreadyCredited: false, endsAt: plan.endsAt, storeName: store.storeName || 'your shop', slug: store.slug };
    });

    console.log('🏪 store plan (paystack):', uid, tier, reference, '→ until', result.endsAt);
    if (!result.alreadyCredited) {
        try {
            const email = context.auth.token.email || await emailForUser(uid);
            await sendEmail('store_plan_paid', email, {
                name: result.storeName, tier: STORE_PLAN_LABELS[tier], days: STORE_PLAN_DAYS[tier],
                amount: price, ends: result.endsAt, slug: result.slug, method: 'Card/Mobile Money (Paystack)', reference: reference
            });
        } catch (e) { console.error('store plan receipt email failed', e && e.message); }
    }
    return { ok: true, alreadyCredited: result.alreadyCredited, endsAt: result.endsAt, storeName: result.storeName };
});

/**
 * Payments readiness — everything the admin panel needs to answer "can charging
 * actually collect money right now?". Admin-only. Keys are NEVER returned: only
 * their mode ('test' / 'live' / 'missing') and a plain-English verdict.
 */
exports.paymentReadiness = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    if (!(await refIsAdmin(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only');

    const db = admin.firestore();
    const billing = await smGetStoreBilling(db);

    // Public key: settings/paystack.publicKey, else settings/premium.paystackPublicKey
    let publicKey = '';
    try {
        const ps = await db.collection('settings').doc('paystack').get();
        if (ps.exists) publicKey = String((ps.data() || {}).publicKey || (ps.data() || {}).paystackPublicKey || '');
    } catch (e) {}
    if (!publicKey) {
        try {
            const pm = await db.collection('settings').doc('premium').get();
            if (pm.exists) publicKey = String((pm.data() || {}).paystackPublicKey || '');
        } catch (e) {}
    }

    // Email: key + service + template all present (same rule the Emails page uses)
    let emailConfigured = false;
    let emailState = 'off';
    try {
        const em = await db.collection('settings').doc('email').get();
        const d = em.exists ? (em.data() || {}) : {};
        emailConfigured = !!((d.emailjsKey || d.publicKey) && d.serviceId && d.templateId);
        // Configured is not the same as working: the state comes from the last real test send.
        if (emailConfigured) {
            const lt = d.lastTest || null;
            emailState = !lt ? 'untested' : (lt.sent === true ? 'ok' : 'failed');
        }
    } catch (e) {}

    const facts = {
        chargingOn: billing.requirePayment === true,
        trialsOn: billing.requirePayment === true && billing.chargeApprovedShops === true,
        secretMode: smKeyMode(paystackSecret()),
        publicMode: smKeyMode(publicKey),
        emailConfigured: emailConfigured,
        emailState: emailState
    };
    const result = smBillingReadiness(facts);
    console.log('paymentReadiness:', JSON.stringify(facts), '→', result.level);
    return { ok: true, facts: facts, level: result.level, warnings: result.warnings, rows: result.rows };
});

/** Admin edits prices / grace days / the requirePayment master switch (validated). */
exports.saveStoreBillingConfig = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    if (!(await refIsAdmin(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only');
    const clean = smSanitizeBillingConfig(data || {});
    const db = admin.firestore();
    const cfgRef = db.collection('settings').doc('storeBilling');

    // Was rent already on? The transition matters for banked paid days:
    //   OFF→ON  → banked days start counting now (their promise kept)
    //   ON→OFF  → remaining days are frozen back into the bank (nobody loses time)
    const before = await cfgRef.get();
    const prev = before.exists ? (before.data() || {}) : {};
    const wasOn = prev.requirePayment === true;
    const wasChargingApproved = prev.chargeApprovedShops === true;

    await cfgRef.set(Object.assign({}, clean, {
        updatedAt: new Date().toISOString(),
        updatedBy: context.auth.token.uid
    }));

    const transition = { turnedOn: 0, turnedOff: 0, trialsGranted: 0, trialsCleared: 0 };
    try {
        if (clean.requirePayment && !wasOn) transition.turnedOn = await smStartBankedPlans(db);
        if (!clean.requirePayment && wasOn) {
            transition.turnedOff = await smFreezeRunningPlans(db);
            transition.trialsCleared = await smClearTrialPlans(db);   // trials are void while rent is off
        }
        // "Charge approved shops" flips: grant everyone a free trial, or void
        // running trials (their shops stay live — trials are never punitive).
        if (clean.requirePayment && clean.chargeApprovedShops && !wasChargingApproved) {
            transition.trialsGranted = await smGrantTrials(db, clean.trialDays);
        }
        if (!clean.chargeApprovedShops && wasChargingApproved) {
            transition.trialsCleared = await smClearTrialPlans(db);
        }
    } catch (e) {
        console.error('billing transition sweep failed:', e && e.message);
    }
    console.log('storeBilling config saved by', context.auth.token.uid, JSON.stringify(clean), 'transition', JSON.stringify(transition));
    return { ok: true, config: clean, transition };
});

/**
 * Admin: make a shop FREE FOR LIFE, or undo it. Audited on the store itself.
 */
exports.setStoreFreeForLife = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    if (!(await refIsAdmin(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only');
    const clean = smFreeForLifeInput(data);
    if (!clean.ok) throw new functions.https.HttpsError('invalid-argument', clean.error);
    const db = admin.firestore();
    const ref = db.collection('stores').doc(clean.value.uid);
    const snap = await ref.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'That shop does not exist.');
    const nowIso = new Date().toISOString();
    await ref.update({ freeForLife: clean.value.on, freeForLifeAt: nowIso, freeForLifeBy: context.auth.uid, updatedAt: nowIso });
    console.log('setStoreFreeForLife: ' + clean.value.uid + ' -> ' + clean.value.on + ' by ' + context.auth.uid);
    return { ok: true, freeForLife: clean.value.on };
});

/* ---------- hourly plan sweep: reminders + expiry (grace days respected) ---------- */
async function sweepStorePlans(nowMsOverride) {
    const db = admin.firestore();
    const billing = await smGetStoreBilling(db);
    // Billing only bites once the owner flips the master switch — free launch
    // keeps shops alive on admin approval alone.
    if (!billing.requirePayment) return { skipped: true, reason: 'requirePayment off' };

    // Self-heal: any plan still sitting in the bank gets its real end date now
    // (covers the admin flipping rent on when a transition sweep failed).
    let started = 0, trialed = 0;
    try { started = await smStartBankedPlans(db); } catch (e) { console.error('start banked plans failed', e && e.message); }
    // Self-heal: a live shop that never got its trial (approved while something
    // hiccuped) gets it on the next sweep — no seller is ever skipped.
    if (billing.chargeApprovedShops) {
        try { trialed = await smGrantTrials(db, billing.trialDays); } catch (e) { console.error('grant trials failed', e && e.message); }
    }

    const now = (typeof nowMsOverride === 'number' ? nowMsOverride : Date.now());
    const nowTs = admin.firestore.Timestamp.fromMillis(now);
    const snap = await db.collection('stores').where('plan.endsAt', '!=', null).limit(400).get();

    let reminded = 0, expired = 0, scanned = 0;
    for (const d of snap.docs) {
        const s = d.data() || {};
        const plan = s.plan || {};
        const endsMs = plan.endsAt ? new Date(plan.endsAt).getTime() : 0;
        if (!endsMs || isNaN(endsMs)) continue;
        if (smIsFreeForLife(s)) continue;   // free for life: no reminders, never switched off
        scanned++;
        const msLeft = endsMs - now;
        const ref = d.ref;
        const isTrial = smIsTrialPlan(plan);   // free trial → different, honest copy

        // 1) friendly heads-up ~3 days before the end (once per plan period)
        if (msLeft > 0 && msLeft <= 3 * 86400000 && !plan.reminderSentAt) {
            try {
                await ref.update({ 'plan.reminderSentAt': new Date(now).toISOString() });
                await db.collection('notifications').add({
                    userId: s.ownerId, type: 'store_plan',
                    title: isTrial ? 'Your free shop trial ends soon ⏳' : 'Your shop plan ends soon ⏳',
                    message: isTrial
                        ? '"' + (s.storeName || 'Your shop') + '" free trial ends ' + new Date(endsMs).toLocaleDateString('en-GB') +
                          '. Pick a plan from Dashboard → My Store to keep your shop live — nothing is lost either way.'
                        : '"' + (s.storeName || 'Your shop') + '" plan ends ' + new Date(endsMs).toLocaleDateString('en-GB') +
                          '. Renew from Dashboard → My Store to keep your shop live.',
                    isRead: false, createdAt: nowTs
                });
                await sendEmail(isTrial ? 'store_trial_expiring' : 'store_plan_expiring', await emailForUser(s.ownerId), {
                    name: s.storeName, ends: plan.endsAt, days: Math.ceil(msLeft / 86400000), slug: s.slug
                });
                reminded++;
            } catch (e) { console.error('plan reminder failed for', d.id, e && e.message); }
            continue;
        }

        // 2) grace period over and still unpaid → switch the shop OFF
        if (msLeft <= -billing.graceDays * 86400000 && s.isActive === true && !plan.expiredNotifiedAt) {
            try {
                await ref.update({
                    isActive: false,
                    'plan.expiredNotifiedAt': new Date(now).toISOString(),
                    updatedAt: new Date(now).toISOString()
                });
                await db.collection('notifications').add({
                    userId: s.ownerId, type: 'store_plan',
                    title: isTrial ? 'Your free shop trial ended 💤' : 'Your shop was switched off 💤',
                    message: isTrial
                        ? '"' + (s.storeName || 'Your shop') + '" free trial ended and the grace days passed, so your shop is paused. ' +
                          'Nothing is lost — pick a plan from Dashboard → My Store and it reopens instantly.'
                        : '"' + (s.storeName || 'Your shop') + '" plan ended and the grace days passed, so your shop is hidden ' +
                          'until you renew. Nothing is lost — renew from Dashboard → My Store and it reopens instantly.',
                    isRead: false, createdAt: nowTs
                });
                await sendEmail(isTrial ? 'store_trial_expired' : 'store_plan_expired', await emailForUser(s.ownerId), {
                    name: s.storeName, slug: s.slug
                });
                expired++;
            } catch (e) { console.error('plan expiry failed for', d.id, e && e.message); }
        }
    }
    if (reminded || expired || started || trialed) console.log('storePlanSweep: scanned', scanned, 'reminded', reminded, 'expired', expired, 'bankedStarted', started, 'trialsGranted', trialed);
    return { scanned, reminded, expired, bankedStarted: started, trialsGranted: trialed };
}
exports.storePlanSweep = functions.pubsub.schedule('every 1 hours').onRun(async () => sweepStorePlans());
exports.storePlanSweepNow = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    if (!(await refIsAdmin(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only');
    // tests/ops may force the clock: storePlanSweepNow({nowMs: ...})
    const n = data && data.nowMs;
    return sweepStorePlans(typeof n === 'number' && isFinite(n) ? n : undefined);
});

/* ============================================================================
 * "COMPLETE MY SHOP" nudges — the moment a shop goes LIVE, the owner gets a
 * warm welcome (email + in-app) with the 4-step checklist that makes shops
 * succeed. Triggered by ANY isActive false→true flip (admin approval or a
 * paid plan), so both activation paths are covered by one tiny trigger.
 * ===========================================================================*/

/* ============================================================================
 * "COMPLETE MY SHOP" nudges — the moment a shop goes LIVE, the owner gets a
 * warm welcome (email + in-app) with the 4-step checklist that makes shops
 * succeed. Triggered by ANY isActive false→true flip (admin approval or a
 * paid plan), so both activation paths are covered by one tiny trigger.
 * ===========================================================================*/
exports.storeGoLiveNotify = functions.firestore.document('stores/{uid}').onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    if (before.isActive === true || after.isActive !== true) return null;
    const uid = context.params.uid;
    try {
        const now = admin.firestore.FieldValue.serverTimestamp();
        const shopUrl = 'https://sankofa-market.web.app/store/' + (after.slug || '');

        // Charging approved shops? Then a shop going live with NO plan at all
        // starts its free trial the very same moment it opens.
        try {
            const billing = await smGetStoreBilling(db);
            const hasPlan = !!(after.plan && (after.plan.endsAt || after.plan.bankedDays > 0 || after.plan.paidAt));
            if (billing.requirePayment && billing.chargeApprovedShops && !hasPlan && !smIsFreeForLife(after)) {
                const trial = smTrialPlan(Date.now(), billing.trialDays);
                if (trial) {
                    await db.collection('stores').doc(uid).update({ plan: trial, updatedAt: new Date().toISOString() });
                    console.log('storeGoLiveNotify: trial granted to', uid, 'until', trial.endsAt);
                }
            }
        } catch (e) { console.error('trial grant on go-live failed', e && e.message); }
        await db.collection('notifications').add({
            userId: uid, type: 'store_live', title: 'Your shop is LIVE 🏪🎉',
            message: '"' + (after.storeName || 'Your shop') + '" is open at sankofa-market.web.app/store/' + (after.slug || '') +
                     '! Next: list 5 items to fill the shelves, add your logo, then share your link everywhere.',
            isRead: false, createdAt: now
        });
        await sendEmail('store_live', await emailForUser(uid), {
            name: after.ownerName, storeName: after.storeName, shopUrl: shopUrl, slug: after.slug
        });
        console.log('storeGoLiveNotify: welcomed', uid, 'shop', after.slug);
    } catch (e) { console.error('storeGoLiveNotify failed', e && e.message); }
    return null;
});

/* ============================================================================
 * SAVED-ITEM ALERTS — Tier 2 💎 (restock for everyone + flash-sale starts)
 *
 * The wishlist already lives in `wishlist/{uid}_{productId}` so the server can
 * see what each shopper is watching. The older priceDropWatch (premium perk)
 * only reacts to an edited price going down. This watcher covers the two
 * OTHER moments a saver cares about:
 *   1. BACK IN STOCK — an item marked sold becomes available again
 *      (everyone is told: it simply could not be bought before)
 *   2. FLASH SALE STARTS — a seller switches on a timed ⚡ discount
 *      (everyone is told: it is the seller's own advert, and it brings buyers back)
 * Throttled per (user, product, kind) in priceAlertLog so an indecisive seller
 * can never spam a phone. Price drops stay premium-only inside priceDropWatch.
 * ========================================================================== */

/* === ALERT CORE START === */
/* Pure decision helpers — extracted by tests; no admin/Firestore in here. */

/** Any timestamp-ish value (Firestore Timestamp, Date, ISO string, ms) → ms or 0. */
function smAlertMs(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') { try { return v.toDate().getTime(); } catch (e) { return 0; } }
  var ms = new Date(v).getTime();
  return isNaN(ms) ? 0 : ms;
}

/** True while a product's flashSale window is still running. */
function smAlertFlashActive(p, nowMs) {
  var f = p && p.flashSale;
  if (!f || !(Number(f.percent) > 0)) return false;
  var end = smAlertMs(f.endsAt);
  return end > 0 && end > nowMs;
}

/** Sold → available again, and the listing is live. */
function smAlertRestockHappened(before, after) {
  if (!before || !after) return false;
  return before.isSold === true && after.isSold !== true && after.isActive === true;
}

/** Flash sale just switched on (was off/expired, now running, item buyable, real discount). */
function smAlertFlashStarted(before, after, nowMs) {
  if (!after) return false;
  if (after.isActive !== true || after.isSold === true) return false;
  return !smAlertFlashActive(before, nowMs) && smAlertFlashActive(after, nowMs) && Number(after.flashSale.percent) >= 5;
}

/** Price line for a flash alert: sale price + the crossed-out old price. */
function smAlertFlashText(after) {
  var pct = Math.round(Number(after.flashSale.percent));
  var oldPrice = Number(after.price || 0);
  var newPrice = Math.round(oldPrice * (100 - pct)) / 100;
  return { percent: pct, oldPrice: oldPrice, newPrice: newPrice };
}

/** One alert per (user, product, kind) per window — sellers yo-yoing settings can't spam. */
function smAlertThrottleOk(lastSentMs, nowMs, windowMs) {
  if (!(lastSentMs > 0)) return true;
  return (nowMs - lastSentMs) >= (windowMs || 72 * 3600 * 1000);
}
/** A live listing's price just went DOWN (both prices are real and the item is still buyable). */
function smAlertPriceDropped(before, after) {
  if (!before || !after) return false;
  if (after.isActive !== true || after.isSold === true) return false;
  const oldP = Number(before.price || 0);
  const newP = Number(after.price || 0);
  return oldP > 0 && newP > 0 && newP < oldP;
}

/** Email switch: a shopper who turned "Email notifications" off gets no alert emails at all. */
function smAlertEmailAllowed(userDoc) {
  const prefs = userDoc && userDoc.notifications;
  return !(prefs && prefs.email === false);
}

/** Price-drop emails need the general email switch AND their own switch (both default ON). */
function smAlertPriceDropEmailAllowed(userDoc) {
  if (!smAlertEmailAllowed(userDoc)) return false;
  const prefs = userDoc && userDoc.notifications;
  return !(prefs && prefs.priceDrops === false);
}

/** Premium with a running expiry date. The in-app bell price-drop alert is a Premium perk. */
function smAlertPremiumActive(userDoc, nowMs) {
  if (!userDoc || userDoc.isPremium !== true) return false;
  const exp = smAlertMs(userDoc.premiumExpiry);
  return exp > 0 && exp > nowMs;
}

/** First name for a greeting: "Ama Mensah" becomes "Ama". Never an email address. Empty when unknown. */
function smAlertFirstName(userDoc) {
  const candidates = [userDoc && userDoc.firstName, userDoc && userDoc.displayName, userDoc && userDoc.name];
  for (const c of candidates) {
    const raw = String(c || '').trim();
    if (!raw || raw.indexOf('@') !== -1) continue;
    return raw.split(/\s+/)[0].slice(0, 40);
  }
  return '';
}

/**
 * Run an async job over many items, a few at a time. Keeps a big fan-out (1,000 savers)
 * inside the function time limit. One failing item is logged and never stops the others.
 */
async function smAlertEachChunked(items, size, job) {
  const step = Math.max(1, Number(size) || 10);
  for (let i = 0; i < items.length; i += step) {
    await Promise.all(items.slice(i, i + step).map(async (item) => {
      try { await job(item); } catch (e) { console.error('saved-item alert job failed:', e && e.message); }
    }));
  }
}
/* === ALERT CORE END === */

exports.savedItemWatch = functions.runWith({ timeoutSeconds: 300 }).firestore
  .document('products/{productId}')
  .onWrite(async (change, context) => {
    try {
      const before = change.before.exists ? (change.before.data() || {}) : null;
      const after = change.after.exists ? (change.after.data() || {}) : null;
      if (!after) return null;                       // deleted listing — nothing to alert
      const nowMs = Date.now();
      const stockAlert = smAlertRestockHappened(before, after);
      const flashAlert = smAlertFlashStarted(before, after, nowMs);
      if (!stockAlert && !flashAlert) return null;

      const productId = context.params.productId;
      const wishSnap = await db.collection('wishlist').where('productId', '==', productId).limit(2000).get();
      if (wishSnap.empty) return null;

      const title = after.title || 'An item you saved';
      const itemUrl = 'https://sankofa-market.web.app/product-detail.html?id=' + productId;
      const flash = flashAlert ? smAlertFlashText(after) : null;
      const kind = stockAlert ? 'stock' : 'flash';   // one event per write wins (restock beats flash)
      let notified = 0;

      // A few shoppers at a time. Each one gets the bell alert, and the email only if
      // their email switch is on. The email is awaited, so the function is not stopped before it goes.
      await smAlertEachChunked(wishSnap.docs, 10, async (wishDoc) => {
        const uid = (wishDoc.data() || {}).uid;
        if (!uid || uid === after.sellerId) return;
        const logRef = db.collection('priceAlertLog').doc(uid + '_' + productId + '_' + kind);
        const logDoc = await logRef.get();
        const lastMs = logDoc.exists ? smAlertMs((logDoc.data() || {}).lastSent) : 0;
        if (!smAlertThrottleOk(lastMs, nowMs)) return;

        await db.collection('notifications').add({
          userId: uid,
          type: stockAlert ? 'back_in_stock' : 'flash_sale',
          title: stockAlert ? '✨ Back in stock: "' + title + '"'
                            : '⚡ Flash sale: "' + title + '"',
          message: stockAlert
            ? '"' + title + '" is available again for GHS ' + Number(after.price || 0).toLocaleString() +
              ' — grab it before it goes again.'
            : 'Seller just knocked ' + flash.percent + '% off "' + title + '" — now GHS ' +
              flash.newPrice.toLocaleString() + ' (was GHS ' + flash.oldPrice.toLocaleString() +
              '). The countdown is already ticking.',
          productId: productId,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const uDoc = await db.collection('users').doc(uid).get();
        const u = uDoc.exists ? (uDoc.data() || {}) : {};
        if (smAlertEmailAllowed(u)) {
          const to = u.email || await emailForUser(uid);
          if (to) {
            await sendEmail(stockAlert ? 'back_in_stock' : 'flash_sale', to, {
              name: smAlertFirstName(u), title: title, itemUrl: itemUrl,
              price: Number(after.price || 0).toLocaleString(),
              percent: flash ? String(flash.percent) : '',
              newPrice: flash ? flash.newPrice.toLocaleString() : '',
              oldPrice: flash ? flash.oldPrice.toLocaleString() : ''
            });
          }
        }
        await logRef.set({ uid: uid, productId: productId, kind: kind,
          lastSent: admin.firestore.FieldValue.serverTimestamp() });
        notified++;
      });
      if (notified) console.log('savedItemWatch:', kind, productId, '→ notified', notified);
    } catch (e) {
      console.error('savedItemWatch error:', e && e.message);
    }
    return null;
  });

/* ============================================================================
 * STORE PROMO CODES — Tier 2 💎
 *
 * A shop owner (or Sankofa itself) mints a code like KOFI10 that takes X% off
 * THE ITEMS THAT SHOP OWNS in the Sankofa Store checkout. Buyers type it on
 * the payment page; the discount shows before they pay.
 *
 * Trust model — deliberate and narrow:
 *   - The browser may whisper the code + the cart rows, nothing more.
 *   - At pay time (Paystack AND wallet paths) the server recomputes the
 *     eligible subtotal from the order rows, re-derives the discount and the
 *     final total, and REFUSES the payment if any digit is off. usedCount
 *     increments inside the same transaction, so a "10 uses only" code can
 *     never be spent 11 times.
 *   - storePromos docs are function-only (clients cannot even read them);
 *     validation for the UI goes through validateStorePromo.
 * ========================================================================== */

/* === PROMO CORE START === */
/* Pure helpers — extracted by tests; no admin/Firestore in here. */

/** Codes are uppercase letters+digits, 3–20 chars. Anything else → '' (invalid). */
function smPromoNormalizeCode(raw) {
  var c = String(raw == null ? '' : raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (c.length >= 3 && c.length <= 20) ? c : '';
}

/** The part of the cart a code can touch: rows owned by the code's shop. */
function smPromoEligibleSubtotal(ownerId, items) {
  var sum = 0;
  (items || []).forEach(function (it) {
    if (!it) return;
    if (String(it.sellerId || '') !== String(ownerId || '')) return;
    var price = Number(it.price) || 0;
    var qty = Math.max(1, Number(it.quantity) || 1);
    if (price > 0) sum += price * qty;
  });
  return Math.round(sum * 100) / 100;
}

function smPromoMs(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') { try { return v.toDate().getTime(); } catch (e) { return 0; } }
  var ms = new Date(v).getTime();
  return isNaN(ms) ? 0 : ms;
}

/**
 * Can this code run against this cart right now?
 * Returns { ok, discount, eligible } or { ok:false, error } — `error` is the
 * exact sentence a buyer should read, so the UI never has to invent one.
 */
function smPromoEligibility(promo, items, nowMs) {
  if (!promo || promo.isActive === false) {
    return { ok: false, error: 'That code is not active any more.' };
  }
  var exp = smPromoMs(promo.expiresAt);
  if (exp > 0 && exp <= nowMs) {
    return { ok: false, error: 'That code has expired.' };
  }
  if (Number(promo.maxUses) > 0 && Number(promo.usedCount || 0) >= Number(promo.maxUses)) {
    return { ok: false, error: 'That code has been fully used already.' };
  }
  var eligible = smPromoEligibleSubtotal(promo.ownerId, items);
  if (!(eligible > 0)) {
    return { ok: false, error: 'That code only works on items from "' + (promo.ownerName || 'its own shop') + '" — none are in this order.' };
  }
  if (Number(promo.minSubtotal) > 0 && eligible < Number(promo.minSubtotal)) {
    return { ok: false, error: 'That code needs at least GHS ' + Number(promo.minSubtotal).toLocaleString() + ' of "' + (promo.ownerName || 'that shop') + '" items — this order has GHS ' + eligible.toLocaleString() + '.' };
  }
  var pct = Number(promo.percentOff) || 0;
  if (!(pct >= 1 && pct <= 90)) return { ok: false, error: 'That code looks broken — please tell the seller.' };
  var discount = Math.round(eligible * pct) / 100;
  if (!(discount > 0)) return { ok: false, error: 'That code saves nothing on this order.' };
  return { ok: true, eligible: eligible, discount: discount, percentOff: pct };
}

/** The total the buyer should actually be charged, recomputed from scratch. */
function smPromoExpectedTotal(order, discount) {
  var sub = Math.round((Number(order.subtotal) || 0) * 100) / 100;
  var del = Math.round((Number(order.deliveryFee) || 0) * 100) / 100;
  var svc = Math.round((Number(order.serviceFee) || 0) * 100) / 100;
  var t = Math.round((sub + del + svc - (Number(discount) || 0)) * 100) / 100;
  return t > 0 ? t : 0;
}
/* === PROMO CORE END === */

/** Who may mint codes: a shop owner (active store doc) or an admin (their
 *  official-store items all carry the admin uid, so one mechanism serves both). */
async function smPromoCallerProfile(context) {
  const uid = context.auth.token.uid;
  let isAdmin = context.auth.token && context.auth.token.admin === true;
  let name = '';
  try {
    const uDoc = await db.collection('users').doc(uid).get();
    if (uDoc.exists) {
      const u = uDoc.data() || {};
      if (!isAdmin && (u.role === 'admin' || u.isAdmin === true)) isAdmin = true;
      name = u.displayName || u.name || '';
    }
  } catch (e) { /* fall through — store lookup still decides */ }
  let storeName = isAdmin ? 'Sankofa Store' : '';
  try {
    const sDoc = await db.collection('stores').doc(uid).get();
    if (sDoc.exists) {
      const st = sDoc.data() || {};
      if (st.isActive === true) {
        return { uid: uid, ok: true, isAdmin: isAdmin, ownerName: st.storeName || storeName || name || 'this shop' };
      }
      if (!isAdmin) return { uid: uid, ok: false, reason: 'Your shop is not live yet — promo codes unlock when it goes live.' };
    } else if (!isAdmin) {
      return { uid: uid, ok: false, reason: 'Create your free shop first (My Store), then you can mint promo codes.' };
    }
  } catch (e) { /* fall through */ }
  return { uid: uid, ok: isAdmin, isAdmin: isAdmin, ownerName: storeName || name || 'Sankofa Store' };
}

exports.saveStorePromo = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
  const who = await smPromoCallerProfile(context);
  if (!who.ok) throw new functions.https.HttpsError('permission-denied', who.reason || 'Promo codes need a live shop.');

  const action = String((data || {}).action || 'create');
  const code = smPromoNormalizeCode((data || {}).code);
  if (!code) throw new functions.https.HttpsError('invalid-argument', 'Codes are 3–20 letters/numbers, e.g. KOFI10.');
  const ref = db.collection('storePromos').doc(code);

  if (action === 'stop' || action === 'start') {
    const doc = await ref.get();
    if (!doc.exists) throw new functions.https.HttpsError('not-found', 'No such code.');
    const d = doc.data() || {};
    if (String(d.ownerId) !== who.uid && !who.isAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Only the shop that made this code can change it.');
    }
    await ref.update({ isActive: action === 'start', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { ok: true, code: code, isActive: action === 'start' };
  }

  if (action !== 'create') throw new functions.https.HttpsError('invalid-argument', 'Unknown action.');

  const percentOff = Math.round(Number((data || {}).percentOff) || 0);
  if (!(percentOff >= 1 && percentOff <= 50)) {
    throw new functions.https.HttpsError('invalid-argument', 'Discount must be between 1% and 50%.');
  }
  const minSubtotal = Math.max(0, Math.round(Number((data || {}).minSubtotal) || 0));
  const maxUses = Math.max(0, Math.round(Number((data || {}).maxUses) || 0));           // 0 = unlimited
  const daysValid = Math.max(0, Math.round(Number((data || {}).daysValid) || 0));      // 0 = never expires

  // create() refuses to overwrite — a code belongs forever to whoever minted it first
  const doc = {
    code: code,
    ownerId: who.uid,
    ownerName: who.ownerName,
    percentOff: percentOff,
    minSubtotal: minSubtotal,
    maxUses: maxUses,
    usedCount: 0,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: daysValid > 0 ? new Date(Date.now() + daysValid * 86400000) : null
  };
  try {
    await ref.create(doc);
  } catch (e) {
    throw new functions.https.HttpsError('already-exists', 'The code "' + code + '" is taken — try a small twist, like ' + code + 'GH.');
  }
  console.log('saveStorePromo:', who.uid, 'minted', code, percentOff + '%');
  sendEmail('promo_created', await emailForUser(who.uid), {
    name: who.ownerName, code: code, percent: String(percentOff),
    minSubtotal: minSubtotal > 0 ? String(minSubtotal) : ''
  }).catch(function () {});
  return { ok: true, code: code, percentOff: percentOff };
});

exports.listMyStorePromos = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
  const uid = context.auth.token.uid;
  const snap = await db.collection('storePromos').where('ownerId', '==', uid).limit(50).get();
  const rows = [];
  snap.forEach(function (d) {
    const p = d.data() || {};
    rows.push({
      code: d.id, percentOff: p.percentOff, isActive: p.isActive !== false,
      usedCount: Number(p.usedCount || 0), maxUses: Number(p.maxUses || 0),
      minSubtotal: Number(p.minSubtotal || 0),
      expiresAt: p.expiresAt && p.expiresAt.toDate ? p.expiresAt.toDate().toISOString() : null
    });
  });
  return { ok: true, promos: rows };
});

/** Pre-pay check — lets the payment page show "−GHS 20 with KOFI10 ✓" before money moves. */
exports.validateStorePromo = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in to use a promo code.');
  const code = smPromoNormalizeCode((data || {}).code);
  if (!code) return { ok: false, error: 'Type the code exactly as the seller shared it (letters/numbers).' };
  const doc = await db.collection('storePromos').doc(code).get();
  if (!doc.exists) return { ok: false, error: 'Code "' + code + '" does not exist.' };
  const items = Array.isArray((data || {}).items) ? (data.items).slice(0, 50) : [];
  const check = smPromoEligibility(doc.data() || {}, items, Date.now());
  if (!check.ok) return { ok: false, error: check.error };
  return { ok: true, code: code, discount: check.discount, eligible: check.eligible,
           percentOff: check.percentOff, ownerName: (doc.data() || {}).ownerName || '' };
});

/**
 * THE pay-time gate. Called inside the payment transaction by BOTH money paths
 * (Paystack confirm + wallet). Anything suspicious throws and the whole payment
 * aborts untouched. On success the code's use-counter moves in the SAME
 * transaction, and the caller swaps in the recomputed total.
 */
async function smPromoAssertAndConsume(tx, order) {
  const code = smPromoNormalizeCode(order.promo && order.promo.code);
  if (!code) throw new functions.https.HttpsError('failed-precondition', 'That promo code is not valid. Nothing was charged.');
  const promoRef = db.collection('storePromos').doc(code);
  const promoDoc = await tx.get(promoRef);
  if (!promoDoc.exists) throw new functions.https.HttpsError('failed-precondition', 'Promo code "' + code + '" does not exist. Nothing was charged.');
  const promo = promoDoc.data() || {};
  const check = smPromoEligibility(promo, order.items || [], Date.now());
  if (!check.ok) throw new functions.https.HttpsError('failed-precondition', check.error + ' Nothing was charged.');
  const expectedTotal = smPromoExpectedTotal(order, check.discount);
  if (pesewas(expectedTotal) !== pesewas(round2(order.total || 0))) {
    throw new functions.https.HttpsError('failed-precondition',
      'The promo discount on this order did not re-check on the server, so nothing was charged. Please refresh the checkout page, apply the code again, and retry.');
  }
  tx.update(promoRef, {
    usedCount: admin.firestore.FieldValue.increment(1),
    lastUsedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { code: code, discount: check.discount, ownerId: promo.ownerId, expectedTotal: expectedTotal };
}

/* ============================================================================
 * SHOP MINI-ANALYTICS — Tier 2 💎
 *
 * Fire-and-forget counters so a shop owner can open My Store and see
 * "42 visits and 137 item views this week". Numbers are OWNER-VISIBLE ONLY in
 * this tier (they go public in Tier 3 as social proof), so a little inflation
 * breaks nothing. One ping = one batched write pair (totals + that day).
 * Only signed-in visitors count, owners never count themselves, and pings for
 * uids without a live store doc are ignored (no junk counters).
 * ========================================================================== */

/* === SHOP STATS CORE START === */
/** Africa/Accra day id — the stats day resets at midnight Ghana time. */
function smStatsDayId(ms) {
  var d = new Date((typeof ms === 'number' ? ms : Date.now()) + 0);          // Ghana is UTC+0
  var m = d.getUTCMonth() + 1, day = d.getUTCDate();
  return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

/** Sum a list of daily docs into { weekViews, weekItemViews }. */
function smStatsWeekTotals(days) {
  var views = 0, items = 0;
  (days || []).forEach(function (d) {
    views += Number(d && d.views) || 0;
    items += Number(d && d.itemViews) || 0;
  });
  return { weekViews: views, weekItemViews: items };
}
/* === SHOP STATS CORE END === */

/* === SELLER DIGEST CORE START (pure helpers: weekly in-app summary) === */
/** Milliseconds from a Firestore Timestamp, a Date or an ISO string. NaN when unknown. */
function smDigestMs(v) {
  if (!v) return NaN;
  if (typeof v.toMillis === 'function') return v.toMillis();
  return new Date(v).getTime();
}
/** The seven Accra day ids that make up this week, today first. */
function smDigestWeekIds(nowMs) {
  var out = [];
  for (var i = 0; i < 7; i++) out.push(smStatsDayId(nowMs - i * 86400000));
  return out;
}
/** Shop visits and item views across the last seven days (from the shopStats daily documents). */
function smDigestWeekViews(dailyDocs, nowMs) {
  var wanted = smDigestWeekIds(nowMs);
  var visits = 0, itemViews = 0;
  (dailyDocs || []).forEach(function (d) {
    if (!d || wanted.indexOf(d.date) === -1) return;
    visits += Number(d.views) || 0;
    itemViews += Number(d.itemViews) || 0;
  });
  return { visits: visits, itemViews: itemViews };
}
/** Orders placed in the last seven days. Cancelled and refunded orders are not counted. */
function smDigestWeekOrders(orders, nowMs) {
  var from = nowMs - 7 * 86400000;
  return (orders || []).filter(function (o) {
    var t = smDigestMs(o && (o.createdAt || o.paidAt));
    var status = String((o && o.status) || '');
    return !isNaN(t) && t >= from && t <= nowMs && status !== 'cancelled' && status !== 'refunded';
  }).length;
}
/** A digest is due for a live shop, at most once every six days. */
function smDigestDue(store, nowMs) {
  if (!store || store.isActive !== true) return false;
  var last = smDigestMs(store.digestSentAt);
  return isNaN(last) || nowMs - last >= 6 * 86400000;
}
/** The plain-English weekly message. Null when there was no activity, so nobody gets noise. */
function smDigestMessage(store, week) {
  var visits = Number(week && week.visits) || 0;
  var items = Number(week && week.itemViews) || 0;
  var orders = Number(week && week.orders) || 0;
  if (visits + items + orders === 0) return null;
  var shop = String((store && store.storeName) || 'your shop');
  var link = 'https://sankofa-market.web.app/store/' + String((store && store.slug) || '');
  var text = 'This week: ' + visits + (visits === 1 ? ' visit' : ' visits') + ' to "' + shop + '", ' +
    items + (items === 1 ? ' item view' : ' item views') + ', ' +
    orders + (orders === 1 ? ' order' : ' orders') + '.';
  text += orders > 0
    ? ' Keep your shelves fresh: a new photo or price can bring buyers back.'
    : ' No orders yet this week. Share your shop link on WhatsApp and Instagram: ' + link;
  return { title: 'Your week on Sankofa Market', message: text };
}
/* === SELLER DIGEST CORE END === */

/** Sends the weekly digest to every live shop with some activity this week. */
async function sendSellerDigests(nowMs) {
  const now = (typeof nowMs === 'number') ? nowMs : Date.now();
  const snap = await db.collection('stores').where('isActive', '==', true).limit(300).get();
  let sent = 0, skipped = 0;
  for (const d of snap.docs) {
    const s = d.data() || {};
    if (!smDigestDue(s, now)) { skipped++; continue; }
    const uid = String(s.ownerId || d.id);
    try {
      const daily = await db.collection('shopStats').doc(uid).collection('daily')
        .where('date', 'in', smDigestWeekIds(now)).get();
      const week = smDigestWeekViews(daily.docs.map((x) => x.data()), now);
      const ords = await db.collection('orders').where('sellerId', '==', uid).limit(500).get();
      week.orders = smDigestWeekOrders(ords.docs.map((x) => x.data()), now);
      const msg = smDigestMessage(s, week);
      if (!msg) { skipped++; continue; }
      await db.collection('notifications').add({
        userId: uid, type: 'seller_digest', title: msg.title, message: msg.message,
        isRead: false, createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      await d.ref.update({ digestSentAt: new Date(now).toISOString() });
      sent++;
    } catch (e) {
      console.error('seller digest failed for', uid, e && e.message);
    }
  }
  console.log('weeklySellerDigest: sent ' + sent + ', skipped ' + skipped);
  return { sent: sent, skipped: skipped };
}
// Every Monday at 08:00, Accra time. In-app only (no email, so the EmailJS quota is not used).
exports.weeklySellerDigest = functions.pubsub.schedule('every monday 08:00').timeZone('Africa/Accra')
  .onRun(async () => sendSellerDigests(Date.now()));

exports.recordShopPing = functions.https.onCall(async (data, context) => {
  const kind = String((data || {}).kind || '');
  const uid = String((data || {}).uid || '');
  if (kind !== 'shop' && kind !== 'item') return { ok: false, reason: 'bad kind' };
  if (!uid || uid.length < 10 || uid.length > 128) return { ok: false, reason: 'bad uid' };
  if (context.auth && context.auth.uid === uid) return { ok: true, counted: false, reason: 'own visit' };

  try {
    const storeDoc = await db.collection('stores').doc(uid).get();
    if (!storeDoc.exists || (storeDoc.data() || {}).isActive !== true) {
      return { ok: true, counted: false, reason: 'no live store' };
    }

    const inc = admin.firestore.FieldValue.increment(1);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const rootRef = db.collection('shopStats').doc(uid);
    const dayRef = rootRef.collection('daily').doc(smStatsDayId(Date.now()));
    const batch = db.batch();
    if (kind === 'shop') {
      batch.set(rootRef, { viewsTotal: inc, lastPingAt: now }, { merge: true });
      batch.set(dayRef, { views: inc, date: smStatsDayId(Date.now()) }, { merge: true });
    } else {
      batch.set(rootRef, { itemViewsTotal: inc, lastPingAt: now }, { merge: true });
      batch.set(dayRef, { itemViews: inc, date: smStatsDayId(Date.now()) }, { merge: true });
    }
    await batch.commit();
    return { ok: true, counted: true };
  } catch (e) {
    console.error('recordShopPing failed:', e && e.message);
    return { ok: false, reason: 'server hiccup' };
  }
});

/* ============================================================================
 * STORE STOCK FEEDS — Tier 3 🔄 (the practical "store-API sync")
 *
 * A wholesaler shares ONE link (usually a Google Sheet published as CSV) —
 * Sankofa re-reads it on a schedule and keeps the official store's listings
 * fresh: prices and stock follow the sheet, brand-new rows become listings.
 * No deletions, ever: rows dropped from the sheet are left untouched for a
 * human to review. This gets 90% of a full API integration for a fraction of
 * the risk, and it works with tools Ghanaian wholesalers already use.
 * ========================================================================== */

/* === FEED CORE START (unit-tested pure helpers) === */

/** Minimal-but-honest CSV: quoted cells, escaped quotes, CRLF, header row. */
function smParseCsvText(text) {
    var src = String(text || '').replace(/^\uFEFF/, '');          // strip BOM
    if (!src.trim()) return { headers: [], rows: [] };
    var rows = [], row = [], cell = '', inQuotes = false;
    for (var i = 0; i < src.length; i++) {
        var ch = src[i];
        if (inQuotes) {
            if (ch === '"') {
                if (src[i + 1] === '"') { cell += '"'; i++; }
                else inQuotes = false;
            } else cell += ch;
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(cell); cell = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && src[i + 1] === '\n') i++;
            row.push(cell); cell = '';
            if (row.length > 1 || row[0] !== '') rows.push(row);
            row = [];
        } else {
            cell += ch;
        }
    }
    row.push(cell);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    if (!rows.length) return { headers: [], rows: [] };

    var headers = rows[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    var out = [];
    for (var r = 1; r < rows.length; r++) {
        var obj = {}, hasAny = false;
        for (var c = 0; c < headers.length; c++) {
            var v = rows[r][c] != null ? String(rows[r][c]).trim() : '';
            if (v !== '') hasAny = true;
            obj[headers[c]] = v;
        }
        if (hasAny) out.push(obj);
    }
    return { headers: headers, rows: out };
}

/** Header aliases — the same forgiving map the manual CSV import uses. */
var SM_FEED_ALIASES = {
    title: ['title', 'product name', 'name', 'product', 'item', 'item name'],
    price: ['price', 'amount', 'ghs', 'price (ghs)', 'selling price', 'cost'],
    stock: ['stock', 'qty', 'quantity', 'in stock', 'available', 'count'],
    category: ['category', 'type', 'group', 'department'],
    description: ['description', 'desc', 'details', 'note', 'notes'],
    sku: ['sku', 'code', 'item code', 'product code', 'id'],
    location: ['location', 'city', 'town', 'area']
};

function smFeedPick(row, field) {
    var wants = SM_FEED_ALIASES[field] || [field];
    for (var i = 0; i < wants.length; i++) {
        if (row[wants[i]] != null && String(row[wants[i]]).trim() !== '') return String(row[wants[i]]).trim();
    }
    return '';
}

/** The match key that decides "same item" between the sheet and the shop. */
function smFeedRowKey(row, keyField) {
    if (keyField === 'sku') {
        return String(smFeedPick(row, 'sku') || '').toLowerCase().replace(/\s+/g, '');
    }
    return String(smFeedPick(row, 'title') || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function smFeedCleanRow(row) {
    var title = smFeedPick(row, 'title').replace(/\s+/g, ' ').trim().slice(0, 90);
    var price = Math.round((Number(String(smFeedPick(row, 'price')).replace(/[^\d.]/g, '')) || 0) * 100) / 100;
    var stock = Math.max(0, Math.round(Number(String(smFeedPick(row, 'stock')).replace(/[^\d]/g, '')) || 0));
    if (title.length < 3) return { ok: false, reason: 'title missing/too short' };
    if (!(price > 0)) return { ok: false, reason: 'price missing or 0' };
    return {
        ok: true,
        value: {
            title: title,
            price: price,
            stock: stock > 0 ? stock : 1,
            category: (smFeedPick(row, 'category') || 'others').toLowerCase().replace(/\s+/g, '-').slice(0, 40),
            description: smFeedPick(row, 'description').slice(0, 500),
            sku: smFeedPick(row, 'sku').slice(0, 60),
            location: smFeedPick(row, 'location').slice(0, 60)
        }
    };
}

/**
 * The whole sync decision as one pure function — given the parsed rows and the
 * shop's existing listings (as {key: {id, price, stock, title}}), produce
 * { toCreate, toUpdate, skipped } WITHOUT touching Firestore. Existing items
 * get ONLY price/stock refreshed (photos/descriptions/edits stay untouched);
 * brand-new keys become draft listings. Cap: 500 creations per run.
 */
function smFeedPlanUpdates(feed, rows, existingByKey) {
    var plan = { toCreate: [], toUpdate: [], skipped: [] };
    var keyField = feed && feed.keyField === 'sku' ? 'sku' : 'title';
    var seenKeys = {};
    (rows || []).slice(0, 1200).forEach(function (row, idx) {
        var clean = smFeedCleanRow(row);
        if (!clean.ok) {
            plan.skipped.push({ row: idx + 2, reason: clean.reason, title: smFeedPick(row, 'title').slice(0, 40) });
            return;
        }
        var key = smFeedRowKey(row, keyField);
        if (!key) {
            plan.skipped.push({ row: idx + 2, reason: 'no match key (' + keyField + ')', title: clean.value.title });
            return;
        }
        if (seenKeys[key]) {
            plan.skipped.push({ row: idx + 2, reason: 'duplicate ' + keyField + ' in the sheet', title: clean.value.title });
            return;
        }
        seenKeys[key] = true;
        var existing = existingByKey && existingByKey[key];
        if (existing) {
            var patch = {};
            if (clean.value.price !== existing.price) patch.price = clean.value.price;
            if (clean.value.stock !== existing.stock) patch.stock = clean.value.stock;
            if (keyField === 'sku' && clean.value.title && clean.value.title !== existing.title) patch.title = clean.value.title;
            if (Object.keys(patch).length) {
                plan.toUpdate.push({ id: existing.id, key: key, patch: patch });
            }
        } else {
            if (plan.toCreate.length < 500) plan.toCreate.push({ key: key, row: clean.value });
        }
    });
    return plan;
}
/* === FEED CORE END === */

/** Run one feed end to end. Shared by the manual button and the daily sweep. */
async function smRunImportFeed(feedId, feed, opts) {
    const url = String(feed.url || '');
    if (!/^https:\/\//.test(url)) throw new Error('Feed URL must start with https://');
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'SankofaMarket-FeedBot/1.0' } });
    const text = await res.text();
    if (!res.ok) throw new Error('The feed link answered ' + res.status + ' — is the sheet published as CSV?');

    const parsed = smParseCsvText(text);
    if (!parsed.rows.length) throw new Error('The sheet had no data rows.');

    const sellerId = String(feed.sellerId || '');
    if (!sellerId) throw new Error('Feed has no owner (sellerId) configured.');
    const keyField = feed.keyField === 'sku' ? 'sku' : 'title';

    // Load this seller's listings once, then index them by the feed's match key
    const snap = await db.collection('products').where('sellerId', '==', sellerId).limit(1000).get();
    const existingByKey = {};
    snap.forEach(function (d) {
        const p = d.data() || {};
        let key;
        if (keyField === 'sku') {
            key = String(p.sku || '').toLowerCase().replace(/\s+/g, '');
        } else {
            key = String(p.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
        }
        if (key && !existingByKey[key]) {
            existingByKey[key] = { id: d.id, price: Number(p.price || 0), stock: Number(p.stock || 0), title: p.title || '' };
        }
    });

    const plan = smFeedPlanUpdates(feed, parsed.rows, existingByKey);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const isStore = feed.mode !== 'vendor';
    const sellerName = String(feed.sellerName || (isStore ? 'Sankofa Store' : 'Seller'));

    // Chunked batches: updates + creations, 400 ops per commit
    let ops = [];
    const commitAll = async function () {
        for (let i = 0; i < ops.length; i += 400) {
            const b = db.batch();
            ops.slice(i, i + 400).forEach(function (fn) { fn(b); });
            await b.commit();
        }
        ops = [];
    };

    plan.toUpdate.forEach(function (u) {
        ops.push(function (b) {
            b.update(db.collection('products').doc(u.id), Object.assign({ updatedAt: now, feedId: feedId }, u.patch));
        });
    });
    plan.toCreate.forEach(function (c) {
        ops.push(function (b) {
            b.set(db.collection('products').doc(), {
                title: c.row.title,
                category: c.row.category || 'others',
                description: c.row.description || (c.row.title + ' — available now on Sankofa Market.'),
                price: c.row.price,
                condition: 'new',
                stock: c.row.stock,
                sku: c.row.sku || null,
                location: { city: c.row.location || 'Accra' },
                sellerId: sellerId,
                sellerName: sellerName,
                isSankofaStore: isStore,
                isVerifiedSeller: isStore,
                isFeatured: false,
                isActive: true,
                isSold: false,
                deliveryOption: 'free-delivery',
                views: 0,
                images: [], photos: [], imagesThumb: null,
                source: 'feed-sync',
                feedId: feedId,
                createdAt: now
            });
        });
    });
    await commitAll();

    const stats = {
        at: now,
        updated: plan.toUpdate.length,
        created: plan.toCreate.length,
        skipped: plan.skipped.length,
        totalRows: parsed.rows.length,
        ok: true
    };
    await db.collection('importFeeds').doc(feedId).set({ lastSync: stats, updatedAt: now }, { merge: true });
    console.log('importFeed', feedId, '→', JSON.stringify({ updated: stats.updated, created: stats.created, skipped: stats.skipped }));
    return stats;
}

async function refIsAdminOnce(context) {
    let ok = context.auth.token && context.auth.token.admin === true;
    if (!ok) {
        try {
            const d = await db.collection('users').doc(context.auth.uid).get();
            ok = d.exists && (d.data().role === 'admin' || d.data().isAdmin === true);
        } catch (e) { ok = false; }
    }
    return ok;
}

/** Admin: create / pause / resume / delete a saved feed. */
exports.saveImportFeed = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    if (!(await refIsAdminOnce(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only.');

    const action = String((data || {}).action || 'create');
    const id = String((data || {}).id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
    const refId = id || db.collection('importFeeds').doc().id;
    const ref = db.collection('importFeeds').doc(refId);

    if (action === 'delete') { await ref.delete(); return { ok: true, deleted: refId }; }
    if (action === 'stop' || action === 'start') {
        await ref.set({ isActive: action === 'start', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return { ok: true, id: refId, isActive: action === 'start' };
    }
    if (action !== 'create') throw new functions.https.HttpsError('invalid-argument', 'Unknown action.');

    const name = String((data || {}).name || '').replace(/\s+/g, ' ').trim();
    if (name.length < 3 || name.length > 60) throw new functions.https.HttpsError('invalid-argument', 'Give the feed a name (3–60 characters).');
    const url = String((data || {}).url || '').trim();
    if (url.length > 600 || !/^https:\/\//.test(url)) {
        throw new functions.https.HttpsError('invalid-argument', 'The feed URL must be a full https:// link (a Google Sheet "Published to the web as CSV" link works perfectly).');
    }
    const runEveryDays = Math.min(30, Math.max(1, Math.round(Number((data || {}).runEveryDays) || 1)));

    await ref.set({
        name: name,
        url: url,
        keyField: (data || {}).keyField === 'sku' ? 'sku' : 'title',
        mode: 'store',                                   // official Sankofa Store feeds
        sellerId: context.auth.uid,                     // official items live under the admin
        sellerName: 'Sankofa Store',
        runEveryDays: runEveryDays,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSync: null
    });
    return { ok: true, id: refId };
});

exports.listImportFeeds = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    if (!(await refIsAdminOnce(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only.');
    const snap = await db.collection('importFeeds').limit(25).get();
    const feeds = [];
    snap.forEach(function (d) {
        const f = d.data() || {};
        feeds.push({
            id: d.id, name: f.name, url: f.url, isActive: f.isActive !== false,
            runEveryDays: Number(f.runEveryDays || 1),
            keyField: f.keyField === 'sku' ? 'sku' : 'title',
            lastSync: f.lastSync ? {
                updated: f.lastSync.updated, created: f.lastSync.created,
                skipped: f.lastSync.skipped, totalRows: f.lastSync.totalRows,
                error: f.lastSync.error || null
            } : null,
            lastError: f.lastError || null
        });
    });
    return { ok: true, feeds: feeds };
});

/** Admin button: sync one feed right now (the daily sweep uses the same code). */
exports.runImportFeedNow = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    if (!(await refIsAdminOnce(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only.');
    const id = String((data || {}).id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
    if (!id) throw new functions.https.HttpsError('invalid-argument', 'Which feed?');
    const ref = db.collection('importFeeds').doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new functions.https.HttpsError('not-found', 'No such feed.');
    try {
        const stats = await smRunImportFeed(id, doc.data() || {});
        return { ok: true, stats: { updated: stats.updated, created: stats.created, skipped: stats.skipped, totalRows: stats.totalRows } };
    } catch (e) {
        await ref.set({ lastError: String(e && e.message || e).slice(0, 300), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        throw new functions.https.HttpsError('failed-precondition', String(e && e.message || e).slice(0, 300));
    }
});

/** Every day: re-sync every active feed whose schedule is due. */
async function sweepImportFeeds() {
    const snap = await db.collection('importFeeds').where('isActive', '==', true).limit(25).get();
    let ran = 0, failed = 0;
    for (const d of snap.docs) {
        const f = d.data() || {};
        const dueDays = Math.max(1, Number(f.runEveryDays || 1));
        let lastMs = 0;
        try { lastMs = f.lastSync && f.lastSync.at && f.lastSync.at.toDate ? f.lastSync.at.toDate().getTime() : 0; } catch (e) {}
        if (lastMs > 0 && Date.now() - lastMs < dueDays * 86400000) continue;   // not due yet
        try {
            await smRunImportFeed(d.id, f);
            ran++;
        } catch (e) {
            failed++;
            console.error('importFeedSweep failed for', d.id, e && e.message);
            await db.collection('importFeeds').doc(d.id).set({
                lastError: String(e && e.message || e).slice(0, 300),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
    }
    if (ran || failed) console.log('importFeedSweep: ran', ran, 'failed', failed);
    return { ran, failed };
}
exports.importFeedSweep = functions.pubsub.schedule('every day 06:00').timeZone('Africa/Accra').onRun(async () => sweepImportFeeds());
exports.importFeedSweepNow = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    if (!(await refIsAdminOnce(context))) throw new functions.https.HttpsError('permission-denied', 'Admins only.');
    return sweepImportFeeds();
});
