/* Shared Firestore cleanup for wishlists. Local storage is only the device cache;
   cloud copies must also be removed so they do not return at the next sign-in. */

/* === WISHLIST CLOUD CORE START === */
async function smWishlistDeleteDocs(db, docs) {
    var deleted = 0;
    for (var offset = 0; offset < docs.length; offset += 400) {
        var batch = db.batch();
        docs.slice(offset, offset + 400).forEach(function (doc) { batch.delete(doc.ref); });
        await batch.commit();
        deleted += Math.min(400, docs.length - offset);
    }
    return deleted;
}

async function smWishlistDeleteOne(db, uid, productId) {
    if (!db || !uid || !productId) return 0;
    var id = String(productId);
    var directRef = db.collection('wishlist').doc(String(uid) + '_' + id);
    try {
        var direct = await directRef.get({ source: 'server' });
        if (direct.exists) {
            var data = direct.data() || {};
            if (String(data.uid || '') === String(uid)) {
                await directRef.delete();
                return 1;
            }
        }
    } catch (err) {
        // Older IDs can be denied by a direct read. Fall back to the owner-filtered query.
    }
    var snap = await db.collection('wishlist').where('uid', '==', String(uid)).limit(500).get({ source: 'server' });
    var matches = snap.docs.filter(function (doc) {
        var data = doc.data() || {};
        return String(data.productId || '') === id;
    });
    return await smWishlistDeleteDocs(db, matches);
}

async function smWishlistDeleteAll(db, uid) {
    if (!db || !uid) return 0;
    var collection = db.collection('wishlist');
    var total = 0;
    while (true) {
        var snap = await collection.where('uid', '==', String(uid)).limit(400).get({ source: 'server' });
        if (!snap.docs.length) return total;
        total += await smWishlistDeleteDocs(db, snap.docs);
    }
}
/* === WISHLIST CLOUD CORE END === */

(function (global) {
    'use strict';
    function getDb() {
        return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    }
    function getUser() {
        try {
            var auth = (typeof firebaseAuth !== 'undefined' && firebaseAuth)
                ? firebaseAuth
                : ((typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null);
            return auth && auth.currentUser ? auth.currentUser : null;
        } catch (e) { return null; }
    }
    global.SMWishlistCloud = {
        removeOne: function (productId) {
            var user = getUser();
            if (!user) return Promise.resolve({ synced: false, deleted: 0 });
            return smWishlistDeleteOne(getDb(), user.uid, productId).then(function (n) {
                return { synced: true, deleted: n };
            });
        },
        clearAll: function () {
            var user = getUser();
            if (!user) return Promise.resolve({ synced: false, deleted: 0 });
            return smWishlistDeleteAll(getDb(), user.uid).then(function (n) {
                return { synced: true, deleted: n };
            });
        }
    };
})(window);
