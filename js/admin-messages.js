/* ============================================================================
   SANKOFA MARKET - ADMIN MESSAGES (Firebase-powered)
   Admins can monitor all buyer↔seller conversations and reply as Sankofa Market.
   ============================================================================ */

var adminUid = null;
var adminEmail = null;
var adminName = 'Sankofa Market Support';
var adminConvs = {};
var adminCurrentConvId = null;
var adminMsgsUnsubscribe = null;
var adminConvsUnsubscribe = null;
window.selectedAdminConvIds = window.selectedAdminConvIds || new Set();

document.addEventListener('DOMContentLoaded', function() {
    initAdminMessages();
});

async function initAdminMessages() {
    if (typeof firebase === 'undefined' || typeof firebaseDB === 'undefined' || firebaseDB === null) {
        return;
    }

    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            window.location.href = '/sm-panel/login';
            return;
        }
        adminUid = user.uid;

        // Verify admin role
        firebaseDB.collection('users').doc(user.uid).get().then(function(doc) {
            if (!doc.exists || doc.data().role !== 'admin') {
                window.location.href = '/sm-panel/login';
                return;
            }
            adminName = doc.data().name || 'Sankofa Market Support';
            adminEmail = user.email || doc.data().email || null;
            listenAdminConversations();
            initAdminChatInput();
        });
    });
}

/* ---- Live conversation list (admins see ALL) ---- */
function listenAdminConversations() {
    // Limit to 100 most recent to avoid freezing on large datasets
    var query = firebaseDB.collection('conversations').orderBy('lastMessageAt','desc').limit(100);
    adminConvsUnsubscribe = query
        .onSnapshot(function(snap) {
            adminConvs = {};
            var convs = [];
            snap.forEach(function(doc) {
                var d = doc.data();
                d.id = doc.id;
                adminConvs[doc.id] = d;
                convs.push(d);
            });

            convs.sort(function(a, b) {
                var ta = a.lastMessageAt ? a.lastMessageAt.toMillis() : 0;
                var tb = b.lastMessageAt ? b.lastMessageAt.toMillis() : 0;
                return tb - ta;
            });

            renderAdminConversations(convs);
        }, function(err) {
            console.error('Admin conversations listener error:', err);
            if (err && err.code === 'failed-precondition') {
                // Fallback without orderBy if index missing
                if (adminConvsUnsubscribe) try{adminConvsUnsubscribe();}catch(e){}
                adminConvsUnsubscribe = firebaseDB.collection('conversations').limit(100).onSnapshot(function(snap2){
                    adminConvs = {};
                    var convs = [];
                    snap2.forEach(function(doc){ var d=doc.data(); d.id=doc.id; adminConvs[doc.id]=d; convs.push(d); });
                    convs.sort(function(a,b){ var ta=a.lastMessageAt?a.lastMessageAt.toMillis():0; var tb=b.lastMessageAt?b.lastMessageAt.toMillis():0; return tb-ta; });
                    renderAdminConversations(convs);
                }, function(e2){ console.error('Fallback also failed', e2); });
            }
        });
}

function renderAdminConversations(convs) {
    var container = document.getElementById('conversationsContainer');
    var countEl = document.querySelector('.conversations-count');
    if (!container) return;

    if (countEl) countEl.textContent = convs.length + ' conversation' + (convs.length === 1 ? '' : 's');

    // Ensure bulk bar exists and update its visibility
    ensureAdminConvsBulkBar();
    updateAdminConvsBulkBar();

    // Update select-all header checkbox state after render
    if (convs.length === 0) {
        container.innerHTML = '<div style="padding: 3rem 1.5rem; text-align: center; color: #5a6572;">' +
            '<i class="fas fa-shield-alt" style="font-size: 2.5rem; color: #ccc; margin-bottom: 0.75rem;"></i>' +
            '<p>No conversations to monitor</p>' +
            '<p style="font-size: 0.8rem;">Conversations between buyers and sellers will appear here for monitoring.</p>' +
        '</div>';
        var selAll = document.getElementById('selectAllConvs');
        if (selAll) { selAll.checked = false; selAll.indeterminate = false; }
        return;
    }

    var html = '';
    convs.forEach(function(conv) {
        var participants = conv.participantNames || {};
        var names = conv.participants.map(function(uid) {
            return participants[uid] || 'User';
        });
        var title = names.join(' ↔ ');
        var preview = conv.lastMessage || 'No messages yet';
        var timeStr = conv.lastMessageAt ? formatAdminTime(conv.lastMessageAt.toDate ? conv.lastMessageAt.toDate() : new Date(conv.lastMessageAt)) : '';

        var productLine = '';
        if (conv.productTitle) {
            if (conv.productId) {
                var pUrl = '/product-detail.html?id=' + encodeURIComponent(conv.productId);
                productLine = '<a href="' + pUrl + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="conv-product-line" style="display:inline-flex; align-items:center; gap:4px; color:#0064d2; text-decoration:none; background:#f0f7ff; border:1px solid #dbeafe; padding:1px 6px; border-radius:4px; font-size:0.72rem; max-width:100%;">' +
                    '<i class="fas fa-tag" style="font-size:0.65rem;"></i> ' + escapeHtmlAdmin(conv.productTitle) + ' <i class="fas fa-external-link-alt" style="font-size:0.6rem; opacity:0.7;"></i></a>';
            } else {
                productLine = '<div class="conv-product-line"><i class="fas fa-tag"></i> ' + escapeHtmlAdmin(conv.productTitle) + '</div>';
            }
        }
        var checked = window.selectedAdminConvIds.has(conv.id) ? ' checked' : '';
        html += '<div class="conversation-item' + (conv.id === adminCurrentConvId ? ' active' : '') + '" onclick="adminOpenConversation(\'' + conv.id + '\')" style="display:flex;align-items:center;gap:0.5rem;">' +
            '<input type="checkbox" class="conv-check" value="' + conv.id + '"' + checked + ' onclick="event.stopPropagation(); toggleAdminConvSelection(this)" title="Select for bulk delete" style="accent-color:#0064d2;width:16px;height:16px;flex-shrink:0;">' +
            '<div class="avatar conv-avatar" style="background:#0064d2;color:white;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;font-size:0.82rem;">' + names[0].charAt(0).toUpperCase() + '</div>' +
            '<div class="conv-details" style="flex:1;min-width:0;" onclick="event.stopPropagation(); adminOpenConversation(\'' + conv.id + '\')">' +
                '<div class="conv-name" style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;">' + escapeHtmlAdmin(title) + '</div>' +
                productLine +
                '<div class="conv-preview">' + escapeHtmlAdmin(preview) + '</div>' +
            '</div>' +
            '<div class="conv-meta" style="display:flex;flex-direction:column;align-items:flex-end;gap:0.25rem;flex-shrink:0;"><div class="conv-time">' + timeStr + '</div><button onclick="event.stopPropagation(); adminDeleteConversation(\'' + conv.id + '\')" title="Delete conversation" style="background:#fee2e2;color:#991b1b;border:1px solid #fecaca;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.7rem;"><i class="fas fa-trash"></i></button></div>' +
        '</div>';
    });
    container.innerHTML = html;
    // sync selectAll checkbox
    var selAll2 = document.getElementById('selectAllConvs');
    if (selAll2) {
        var boxes = container.querySelectorAll('.conv-check');
        selAll2.checked = boxes.length>0 && Array.from(boxes).every(function(c){ return c.checked; });
        selAll2.indeterminate = window.selectedAdminConvIds.size>0 && window.selectedAdminConvIds.size < boxes.length;
    }
}
function ensureAdminConvsBulkBar(){
    var list = document.getElementById('conversationsList');
    if (!list) return;
    var bar = document.getElementById('adminConvsBulkBar');
    if (bar) return;
    bar = document.createElement('div');
    bar.id = 'adminConvsBulkBar';
    bar.style.cssText = 'display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:0.6rem 0.8rem;margin:0.5rem 0.75rem;align-items:center;justify-content:space-between;gap:0.6rem;flex-wrap:wrap;';
    bar.innerHTML = '<span style="font-size:0.82rem;font-weight:700;color:#991b1b;"><span id="adminConvsSelectedCount">0</span> selected</span><div style="display:flex;gap:0.4rem;"><button onclick="deleteSelectedAdminConvs()" style="background:#ef4444;color:white;border:none;padding:0.4rem 0.7rem;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.78rem;"><i class="fas fa-trash"></i> Delete Selected</button><button onclick="clearAdminConvSelection()" style="background:white;border:1px solid #e5e7eb;color:#374151;padding:0.4rem 0.7rem;border-radius:6px;font-weight:600;cursor:pointer;font-size:0.78rem;">Clear</button></div>';
    var header = list.querySelector('.conversations-header');
    if (header && header.parentNode) header.parentNode.insertBefore(bar, header.nextSibling);
    // also inject select-all into header if missing
    if (header && !document.getElementById('selectAllConvs')){
        var cb = document.createElement('input');
        cb.type='checkbox'; cb.id='selectAllConvs';
        cb.title='Select all conversations on screen';
        cb.style.cssText='accent-color:#0064d2;width:16px;height:16px;';
        cb.onchange = function(){ toggleSelectAllAdminConvs(this.checked); };
        // Insert before h3 or append
        header.style.display='flex'; header.style.alignItems='center'; header.style.gap='0.5rem';
        header.insertBefore(cb, header.firstChild);
    }
}
function toggleAdminConvSelection(cb){
    if (cb.checked) window.selectedAdminConvIds.add(cb.value);
    else window.selectedAdminConvIds.delete(cb.value);
    updateAdminConvsBulkBar();
}
function toggleSelectAllAdminConvs(checked){
    var boxes = document.querySelectorAll('#conversationsContainer .conv-check');
    boxes.forEach(function(cb){
        cb.checked = checked;
        if (checked) window.selectedAdminConvIds.add(cb.value);
        else window.selectedAdminConvIds.delete(cb.value);
    });
    updateAdminConvsBulkBar();
}
function updateAdminConvsBulkBar(){
    var bar = document.getElementById('adminConvsBulkBar');
    var cnt = document.getElementById('adminConvsSelectedCount');
    var n = window.selectedAdminConvIds.size;
    if (cnt) cnt.textContent = n;
    if (bar) bar.style.display = n>0 ? 'flex' : 'none';
    var selAll = document.getElementById('selectAllConvs');
    if (selAll){
        var boxes = document.querySelectorAll('#conversationsContainer .conv-check');
        if (boxes.length){
            selAll.checked = Array.from(boxes).every(function(c){ return c.checked; });
            selAll.indeterminate = n>0 && n < boxes.length;
        } else { selAll.checked=false; selAll.indeterminate=false; }
    }
}
function clearAdminConvSelection(){
    window.selectedAdminConvIds.clear();
    document.querySelectorAll('#conversationsContainer .conv-check').forEach(function(cb){ cb.checked=false; });
    var selAll=document.getElementById('selectAllConvs'); if(selAll){ selAll.checked=false; selAll.indeterminate=false; }
    updateAdminConvsBulkBar();
}
function deleteSelectedAdminConvs(){
    var ids = Array.from(window.selectedAdminConvIds);
    if (!ids.length) { alert('No conversations selected'); return; }
    if (!confirm('Delete '+ids.length+' conversation(s)? All messages inside will be deleted too. This cannot be undone.\n\n'+ids.slice(0,5).join(', ')+(ids.length>5?' +'+(ids.length-5)+' more':''))) return;
    if (typeof firebaseDB==='undefined' || !firebaseDB) { alert('Firebase not connected'); return; }
    // verify admin
    if (!adminUid) { alert('Not authenticated'); return; }
    firebaseDB.collection('users').doc(adminUid).get().then(function(doc){
        var d = doc.exists?doc.data():{};
        if (d.role!=='admin') { alert('Only admin can delete'); return; }
        var batch = firebaseDB.batch();
        // Firestore batch max 500; we delete conv docs; messages subcollections need separate deletes per conv
        var promises = [];
        promises.push(new Promise(function(resolve, reject){
            try{
                ids.forEach(function(id){ batch.delete(firebaseDB.collection('conversations').doc(id)); });
                batch.commit().then(resolve).catch(reject);
            } catch(e){ reject(e); }
        }));
        // For each conv, attempt to delete its messages (first 50) — best effort, orphaned messages are harmless but we try
        ids.forEach(function(convId){
            promises.push(firebaseDB.collection('conversations').doc(convId).collection('messages').limit(50).get().then(function(snap){
                if (snap.empty) return;
                var b2 = firebaseDB.batch();
                snap.forEach(function(d){ b2.delete(d.ref); });
                return b2.commit();
            }).catch(function(){}));
        });
        return Promise.all(promises);
    }).then(function(){
        try{ if(typeof showFlashMessage==='function') showFlashMessage('Deleted '+ids.length+' conversation(s) ✓','success'); else alert('Deleted '+ids.length); }catch(e){}
        window.selectedAdminConvIds.clear();
        updateAdminConvsBulkBar();
        // If current open conv was deleted, clear chat
        if (adminCurrentConvId && ids.indexOf(adminCurrentConvId)!==-1){
            adminCurrentConvId=null;
            var chat = document.getElementById('adminChatMessages');
            if (chat) chat.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#5a6572;"><div style="text-align:center;"><i class="fas fa-comments" style="font-size:3rem;color:#ccc;margin-bottom:1rem;"></i><p>Conversation deleted</p></div></div>';
            var hdr = document.querySelector('.chat-panel .chat-header');
            if (hdr) hdr.innerHTML = '<div style="text-align:center;width:100%;color:#5a6572;padding:0.75rem;"><p>Select a conversation to monitor</p></div>';
        }
    }).catch(function(err){ alert('Error deleting: '+err.message); });
}
function adminDeleteConversation(convId){
    if (!confirm('Delete this conversation? All messages will be removed. This cannot be undone.')) return;
    if (typeof firebaseDB==='undefined' || !firebaseDB) { alert('Firebase not connected'); return; }
    firebaseDB.collection('users').doc(adminUid).get().then(function(doc){
        var d=doc.exists?doc.data():{};
        if (d.role!=='admin'){ alert('Only admin can delete'); return; }
        // Delete messages first (up to 50), then conv
        return firebaseDB.collection('conversations').doc(convId).collection('messages').limit(50).get().then(function(snap){
            var batch = firebaseDB.batch();
            snap.forEach(function(d){ batch.delete(d.ref); });
            // we will commit messages then conv
            if (!snap.empty){
                return batch.commit().then(function(){ return firebaseDB.collection('conversations').doc(convId).delete(); });
            } else {
                return firebaseDB.collection('conversations').doc(convId).delete();
            }
        });
    }).then(function(){
        try{ if(window.selectedAdminConvIds.has(convId)) window.selectedAdminConvIds.delete(convId); updateAdminConvsBulkBar(); }catch(e){}
        if (typeof showFlashMessage==='function') showFlashMessage('Conversation deleted ✓','success'); else alert('Deleted');
        if (adminCurrentConvId===convId){
            adminCurrentConvId=null;
            var chat=document.getElementById('adminChatMessages');
            if(chat) chat.innerHTML='<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#5a6572;"><div style="text-align:center;"><i class="fas fa-comments" style="font-size:3rem;color:#ccc;margin-bottom:1rem;"></i><p>Conversation deleted</p></div></div>';
        }
    }).catch(function(err){ alert('Error: '+err.message); });
}

/* ---- Open a conversation (admin view) ---- */
function adminOpenConversation(convId) {
    var conv = adminConvs[convId];
    if (!conv) return;

    adminCurrentConvId = convId;

    document.querySelectorAll('.conversation-item').forEach(function(el) {
        el.classList.remove('active');
    });
    // Mark active item
    var items = document.querySelectorAll('#conversationsContainer .conversation-item');
    items.forEach(function(el) {
        if (el.textContent.indexOf((conv.participantNames && conv.participantNames[conv.participants[0]]) || '') !== -1) {
            // best-effort; we set active via data in next iteration
        }
    });
    // Simpler: re-render list with active state
    renderAdminConversations(Object.keys(adminConvs).map(function(k) { return adminConvs[k]; }).sort(function(a, b) {
        var ta = a.lastMessageAt ? a.lastMessageAt.toMillis() : 0;
        var tb = b.lastMessageAt ? b.lastMessageAt.toMillis() : 0;
        return tb - ta;
    }));

    // Update chat header with legend + clickable listing + admin delete controls
    var header = document.querySelector('.chat-panel .chat-header');
    if (header) {
        var participants = conv.participantNames || {};
        var names = conv.participants.map(function(uid) { return participants[uid] || 'User'; });
        var listingHtml = '';
        if (conv.productId) {
            var safeTitle = escapeHtmlAdmin(conv.productTitle || 'View Listing');
            var productUrl = '/product-detail.html?id=' + encodeURIComponent(conv.productId);
            listingHtml = '<div style="margin:0.45rem 0 0; display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">' +
                '<a href="' + productUrl + '" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:6px; background:#f0f7ff; border:1px solid #bfdbfe; color:#0064d2; padding:0.32rem 0.6rem; border-radius:6px; font-size:0.78rem; font-weight:700; text-decoration:none;">' +
                    '<i class="fas fa-tag" style="font-size:0.7rem;"></i> ' + safeTitle +
                    '<i class="fas fa-external-link-alt" style="font-size:0.62rem; opacity:0.8;"></i>' +
                '</a>' +
                '<a href="' + productUrl + '" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:4px; background:white; border:1px solid #0064d2; color:#0064d2; padding:0.28rem 0.6rem; border-radius:6px; font-size:0.72rem; font-weight:700; text-decoration:none;"><i class="fas fa-eye"></i> Open Listing</a>' +
                (conv.productPrice ? '<span style="font-size:0.78rem; font-weight:700; color:#191919; background:#f8fafc; border:1px solid #e2e8f0; padding:0.2rem 0.5rem; border-radius:6px;">GHS ' + Number(conv.productPrice).toLocaleString() + '</span>' : '') +
                (conv.productImage ? '<img src="' + conv.productImage + '" alt="" style="width:36px; height:36px; border-radius:6px; object-fit:cover; border:1px solid #e2e8f0;" />' : '') +
            '</div>';
        } else if (conv.productTitle) {
            listingHtml = '<p style="margin:0.2rem 0 0;font-size:0.78rem;color:#0064d2;"><i class="fas fa-tag"></i> ' + escapeHtmlAdmin(conv.productTitle) + ' <span style="color:#999; font-size:0.7rem;">(no listing ID)</span></p>';
        }
        header.innerHTML = '<div style="padding: 0.75rem 1rem; width:100%;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;"><strong style="font-size:0.9rem;">' + escapeHtmlAdmin(names.join(' ↔ ')) + '</strong><div style="display:flex;gap:0.4rem;align-items:center;"><button onclick="adminDeleteConversation(\'' + convId + '\')" title="Delete entire conversation" style="background:#fee2e2;color:#991b1b;border:1px solid #fecaca;padding:0.3rem 0.6rem;border-radius:6px;font-size:0.72rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:0.3rem;"><i class="fas fa-trash"></i> Delete</button><button onclick="if(confirm(\'Delete ALL messages in this conversation? This cannot be undone.\')){ firebaseDB.collection(\'conversations\').doc(\'' + convId + '\').collection(\'messages\').get().then(function(s){ var b=firebaseDB.batch(); s.forEach(function(d){ b.delete(d.ref); }); return b.commit(); }).then(function(){ alert(\'Chat cleared\'); }); }" title="Clear all messages" style="background:white;border:1px solid #e5e7eb;color:#374151;padding:0.3rem 0.6rem;border-radius:6px;font-size:0.72rem;font-weight:600;cursor:pointer;"><i class="fas fa-eraser"></i> Clear</button></div></div>' +
            listingHtml +
            '<p style="margin:0.4rem 0 0;font-size:0.62rem; color:#64748b; display:flex; gap:0.6rem; flex-wrap:wrap; align-items:center;"><span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; background:#ffffff; border:1px solid #cbd5e1; border-left:3px solid #0064d2; border-radius:3px; display:inline-block;"></span> Buyer left</span><span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; background:#0064d2; border-radius:3px; display:inline-block;"></span> Seller right</span><span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; background:#fff8e1; border:1px solid #f5af02; border-radius:3px; display:inline-block;"></span> Admin center</span></p>' +
        '</div>';
    }

    listenAdminMessages(convId);
}

/* ---- Live message thread (admin) ---- */
function listenAdminMessages(convId) {
    if (adminMsgsUnsubscribe) {
        adminMsgsUnsubscribe();
        adminMsgsUnsubscribe = null;
    }

    var container = document.getElementById('adminChatMessages');
    if (container) {
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '0.85rem';
        container.style.alignItems = 'stretch';
        container.innerHTML = '<div style="text-align:center;color:#5a6572;padding:2rem;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    }

    var conv = adminConvs[convId];

    adminMsgsUnsubscribe = firebaseDB.collection('conversations').doc(convId)
        .collection('messages')
        .orderBy('createdAt', 'asc')
        .onSnapshot(function(snap) {
            if (adminCurrentConvId !== convId) return;
            var html = '';
            var count = 0;
            var seenSenders = [];
            snap.forEach(function(d){ var sid=d.data().senderId; if(sid && sid!==adminUid && seenSenders.indexOf(sid)===-1) seenSenders.push(sid); });
            var leftId = seenSenders[0] || (conv ? conv.participants[0] : null);
            var rightId = seenSenders[1] || (conv ? conv.participants[1] : null);
            var lastDateLabel = null;
            snap.forEach(function(doc) {
                var m = doc.data();
                var msgId = doc.id;
                var senderId = m.senderId || '';
                var isAdminMsg = m.isAdmin === true || senderId === adminUid || (m.senderEmail && adminEmail && m.senderEmail.toLowerCase() === adminEmail.toLowerCase()) || (m.senderEmail && m.senderEmail.toLowerCase() === 'sankofamarketgh@gmail.com');
                var senderName = m.senderName || 'User';
                var time = m.createdAt ? formatAdminTime(m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt)) : '';
                var msgDate = m.createdAt ? (m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt)) : null;
                var dateLabel = msgDate ? formatAdminDateLabel(msgDate) : null;
                if (dateLabel && dateLabel !== lastDateLabel) {
                    html += '<div class="admin-date-separator"><span>' + escapeHtmlAdmin(dateLabel) + '</span></div>';
                    lastDateLabel = dateLabel;
                }
                var bubbleClass, roleLabel, avatarColor;
                if (isAdminMsg) {
                    bubbleClass = 'admin';
                    roleLabel = 'Admin';
                    avatarColor = '#f5af02';
                } else if (senderId === leftId) {
                    bubbleClass = 'buyer';
                    roleLabel = 'Buyer \u00B7 ' + escapeHtmlAdmin(senderName);
                    avatarColor = '#0064d2';
                } else if (senderId === rightId) {
                    bubbleClass = 'seller';
                    roleLabel = 'Seller \u00B7 ' + escapeHtmlAdmin(senderName);
                    avatarColor = '#86b817';
                } else {
                    bubbleClass = 'buyer';
                    roleLabel = 'Buyer \u00B7 ' + escapeHtmlAdmin(senderName);
                    avatarColor = '#0064d2';
                }
                var status = m.status || 'sent';
                var tickHtml = '';
                if (!isAdminMsg) {
                    if (status === 'read' || status === 'seen') tickHtml = '<i class="fas fa-check-double" style="color:#0064d2; margin-left:6px; font-size:0.7rem;" title="Read"></i><span style="margin-left:4px; font-size:0.6rem; font-weight:700; color:#0064d2;">Read</span>';
                    else if (status === 'delivered' || status === 'received') tickHtml = '<i class="fas fa-check-double" style="color:#999; margin-left:6px; font-size:0.7rem;" title="Delivered"></i><span style="margin-left:4px; font-size:0.6rem; font-weight:700; color:#999;">Delivered</span>';
                    else tickHtml = '<i class="fas fa-check" style="color:#999; margin-left:6px; font-size:0.7rem;" title="Sent"></i><span style="margin-left:4px; font-size:0.6rem; font-weight:700; color:#999;">Sent</span>';
                }
                var fileHtml = '';
                if (m.fileUrl) {
                    var isImage = m.fileType && m.fileType.startsWith('image/');
                    var isAudio = m.fileType && m.fileType.startsWith('audio/');
                    if (isImage) {
                        fileHtml = '<div style="margin-bottom:0.4rem;"><a href="' + m.fileUrl + '" target="_blank" rel="noopener"><img src="' + m.fileUrl + '" alt="' + escapeHtmlAdmin(m.fileName || 'image') + '" style="max-width:200px; max-height:200px; border-radius:8px; display:block; cursor:pointer; border:1px solid rgba(0,0,0,0.08);"></a></div>';
                    } else if (isAudio) {
                        var dur = m.fileDuration ? ' &bull; ' + escapeHtmlAdmin(m.fileDuration) : '';
                        fileHtml = '<div style="margin-bottom:0.4rem;"><audio controls preload="metadata" src="' + m.fileUrl + '" style="width:200px; max-width:100%; height:32px; display:block; border-radius:8px; background:#f1f5f9;"></audio><div style="font-size:0.68rem; opacity:0.8; margin-top:0.2rem; display:flex; align-items:center; gap:0.3rem;' + (bubbleClass==='seller'?' color:rgba(255,255,255,0.85);':'') + '"><i class="fas fa-microphone" style="color:' + (bubbleClass==='seller'?'#fff':'#ef4444') + ';"></i> Voice note' + dur + '</div></div>';
                    } else {
                        fileHtml = '<div style="margin-bottom:0.4rem;"><a href="' + m.fileUrl + '" target="_blank" rel="noopener" download="' + escapeHtmlAdmin(m.fileName || 'file') + '" style="display:inline-flex; align-items:center; gap:0.5rem; background:' + (bubbleClass==='seller'?'rgba(255,255,255,0.15)':'rgba(0,0,0,0.06)') + '; border:1px solid ' + (bubbleClass==='seller'?'rgba(255,255,255,0.2)':'rgba(0,0,0,0.08)') + '; padding:0.5rem 0.7rem; border-radius:8px; text-decoration:none; color:' + (bubbleClass==='seller'?'white':'inherit') + '; font-size:0.82rem;"><i class="fas fa-file" style="color:' + (bubbleClass==='seller'?'white':'#0064d2') + ';"></i><span>' + escapeHtmlAdmin(m.fileName || 'file') + '</span><i class="fas fa-download" style="opacity:0.6; font-size:0.7rem;"></i></a></div>';
                    }
                }
                var textHtml = m.text ? '<div class="admin-msg-text" style="word-break:break-word;">' + escapeHtmlAdmin(m.text) + '</div>' : '';
                if (bubbleClass === 'admin') {
                    var delBtnAdmin = '<button onclick="adminDeleteMessage(\'' + convId + '\',\'' + msgId + '\')" title="Delete message" style="background:#fff;border:1px solid #fde68a;color:#92400e;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.65rem;flex-shrink:0;"><i class="fas fa-trash"></i></button>';
                    html += '<div class="admin-announcement" style="align-self:center; width:92%; max-width:560px; background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%); border:1px solid #fde68a; border-left:4px solid #f5af02; border-radius:10px; padding:0.75rem 0.9rem; margin:0.4rem auto; box-shadow:0 1px 4px rgba(245,175,2,0.12); position:relative;">' +
                        '<div style="display:flex; align-items:center; gap:0.4rem; font-size:0.68rem; font-weight:800; color:#92400e; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.35rem; justify-content:space-between;"><span style="display:flex;align-items:center;gap:0.4rem;"><i class="fas fa-bullhorn" style="color:#d97706;"></i> Announcement &bull; Admin</span>' + delBtnAdmin + '</div>' +
                        fileHtml + (m.text ? '<div style="font-size:0.88rem; color:#78350f; line-height:1.5; word-break:break-word;">' + escapeHtmlAdmin(m.text) + '</div>' : '') +
                        '<div style="font-size:0.62rem; color:#a16207; margin-top:0.35rem; text-align:right; display:flex;align-items:center;justify-content:flex-end;gap:0.4rem;"> ' + time + '</div>' +
                    '</div>';
                } else {
                    var rowStyle = bubbleClass==='buyer' ? 'align-self:flex-start; flex-direction:row; margin-right:auto; background:transparent;' : 'align-self:flex-end; flex-direction:row-reverse; margin-left:auto; background:transparent;';
                    var bubbleInline = bubbleClass==='buyer' ? 'background:#ffffff; color:#1e293b; border:1px solid #cbd5e1; border-left:3px solid #0064d2;' : 'background:#0064d2; color:#ffffff; border:1px solid #004a9f; border-right:3px solid #86b817;';
                    var delBtn = '<button onclick="adminDeleteMessage(\'' + convId + '\',\'' + msgId + '\')" title="Delete message (admin)" style="background:' + (bubbleClass==='seller'?'rgba(255,255,255,0.18)':'#fee2e2') + ';color:' + (bubbleClass==='seller'?'white':'#991b1b') + ';border:1px solid ' + (bubbleClass==='seller'?'rgba(255,255,255,0.25)':'#fecaca') + ';width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.62rem;flex-shrink:0;"><i class="fas fa-trash"></i></button>';
                    html += '<div class="admin-msg-row ' + bubbleClass + '" style="display:flex; gap:0.6rem; max-width:78%; width:fit-content; align-items:flex-end; ' + rowStyle + ' margin-bottom:0.6rem;">' +
                        '<div class="admin-msg-avatar" style="background:' + avatarColor + '; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:0.8rem; flex-shrink:0;">' + (bubbleClass==='admin' ? 'A' : escapeHtmlAdmin(senderName.charAt(0).toUpperCase())) + '</div>' +
                        '<div class="admin-msg-bubble ' + bubbleClass + '" style="padding:0.7rem 0.9rem; border-radius:14px; font-size:0.88rem; line-height:1.45; box-shadow:0 1px 2px rgba(0,0,0,0.06); max-width:100%; position:relative; ' + bubbleInline + (bubbleClass==='buyer'?' border-bottom-left-radius:4px;':'') + (bubbleClass==='seller'?' border-bottom-right-radius:4px;':'') + '">' +
                            '<div class="admin-msg-sender" style="font-size:0.68rem; font-weight:800; letter-spacing:0.02em; text-transform:uppercase; opacity:0.85; margin-bottom:0.2rem; color:' + (bubbleClass==='seller'?'rgba(255,255,255,0.9)':'#0064d2') + '; display:flex;align-items:center;justify-content:space-between;gap:0.5rem;"><span>' + roleLabel + '</span>' + delBtn + '</div>' +
                            fileHtml + textHtml +
                            '<div class="admin-msg-time" style="font-size:0.62rem; margin-top:0.3rem; display:flex; align-items:center; justify-content:flex-end; gap:3px; opacity:0.75; color:' + (bubbleClass==='seller'?'rgba(255,255,255,0.85)':'#64748b') + ';">' + time + ' ' + tickHtml + '</div>' +
                        '</div>' +
                    '</div>';
                }
                count++;
            });

            if (count === 0) {
                html = '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#5a6572;font-size:0.9rem;">' +
                    '<div style="text-align:center;"><i class="fas fa-comments" style="font-size:3rem;color:#ccc;margin-bottom:1rem;"></i><p>No messages yet</p></div></div>';
            }

            if (container) {
                container.innerHTML = html;
                container.scrollTop = container.scrollHeight;
            }
        }, function(err) {
            console.error('Admin messages listener error:', err);
            if (container) {
                container.innerHTML = '<div style="text-align:center;color:#e74c3c;padding:2rem;">Error: ' + err.message + '</div>';
            }
        });
}


/* ---- Admin reply ---- *//* ---- Admin reply ---- */
function initAdminChatInput() {
    var input = document.getElementById('chatInput');
    var sendBtn = document.getElementById('sendMessageBtn');
    if (!input || !sendBtn) return;

    sendBtn.addEventListener('click', sendAdminMessage);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAdminMessage();
        }
    });
}

async function sendAdminMessage() {
    var input = document.getElementById('chatInput');
    if (!input) return;
    var text = input.value.trim();
    if (!text || !adminCurrentConvId) return;

    var conv = adminConvs[adminCurrentConvId];
    if (!conv) return;

    input.value = '';

    try {
        await firebaseDB.collection('conversations').doc(adminCurrentConvId)
            .collection('messages').add({
                senderId: adminUid,
                senderName: adminName,
                senderEmail: adminEmail || 'sankofamarketgh@gmail.com',
                text: text,
                isAdmin: true,
                participants: conv.participants,   // required by the security rules
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

        await firebaseDB.collection('conversations').doc(adminCurrentConvId).update({
            lastMessage: text,
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Live listeners update the UI
    } catch (err) {
        console.error('Admin send error:', err);
        input.value = text;
        alert('Could not send message: ' + err.message);
    }
}

/* ---- Date grouping helper ---- */
function formatAdminDateLabel(date) {
    var now = new Date();
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === yesterday.getTime()) return 'Yesterday';
    return date.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
}

/* ---- Broadcast ---- */
var broadcastUsersCache = [];
var selectedBroadcastIds = new Set();

function openBroadcastModal(){
    var m = document.getElementById('broadcastModal');
    if (m) { m.style.display='flex'; loadBroadcastUsers(); updateBroadcastCount(); }
}
function closeBroadcastModal(){
    var m = document.getElementById('broadcastModal');
    if (m) m.style.display='none';
    var prog = document.getElementById('broadcastProgress');
    if (prog) { prog.style.display='none'; prog.textContent=''; }
}
function handleBroadcastAudienceChange(){
    var val = document.getElementById('broadcastAudience').value;
    var cont = document.getElementById('selectedUsersContainer');
    if (cont) cont.style.display = (val==='selected') ? 'block' : 'none';
    updateBroadcastCount();
}
function filterBroadcastUsers(){
    var q = (document.getElementById('broadcastUserSearch').value || '').toLowerCase();
    document.querySelectorAll('#broadcastUserList .broadcast-user-row').forEach(function(row){
        var txt = row.textContent.toLowerCase();
        row.style.display = txt.includes(q) ? 'flex' : 'none';
    });
}
async function loadBroadcastUsers(){
    var list = document.getElementById('broadcastUserList');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center; padding:1rem; color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Loading users...</div>';
    try {
        var snap = await firebaseDB.collection('users').limit(200).get();
        broadcastUsersCache = [];
        snap.forEach(function(doc){ var d=doc.data(); d._id=doc.id; if(d.role!=='admin') broadcastUsersCache.push(d); });
        renderBroadcastUsers(broadcastUsersCache);
    } catch(e){
        list.innerHTML = '<div style="color:#dc2626; padding:1rem; text-align:center;">Could not load users: ' + e.message + '</div>';
    }
}
function renderBroadcastUsers(users){
    var list = document.getElementById('broadcastUserList');
    if (!list) return;
    if (!users.length) { list.innerHTML = '<div style="text-align:center; color:#64748b; padding:0.8rem;">No users found</div>'; return; }
    var html='';
    users.forEach(function(u){
        var name = u.name || ((u.firstName||'') + ' ' + (u.lastName||'')) .trim() || u.email || 'User';
        var tier = u.sellerTier || (u.isPremium ? 'premium' : 'starter');
        var badge = u.isPremium ? '<span style="background:#fef3c7; border:1px solid #fde68a; color:#92400e; font-size:0.65rem; padding:1px 5px; border-radius:999px; font-weight:700;">PREMIUM</span>' : '<span style="background:#f1f5f9; border:1px solid #e2e8f0; color:#64748b; font-size:0.65rem; padding:1px 5px; border-radius:999px;">STARTER</span>';
        var checked = selectedBroadcastIds.has(u._id) ? 'checked' : '';
        html += '<label class="broadcast-user-row" style="display:flex; align-items:center; gap:0.6rem; padding:0.4rem 0.5rem; border-radius:6px; cursor:pointer; font-size:0.85rem;"><input type="checkbox" value="' + u._id + '" ' + checked + ' onchange="toggleBroadcastUser(this)" style="accent-color:#0064d2;"> <span style="width:28px; height:28px; border-radius:50%; background:#0064d2; color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.75rem; flex-shrink:0;">' + escapeHtmlAdmin(name.charAt(0).toUpperCase()) + '</span><span style="flex:1; min-width:0;"><span style="font-weight:600;">' + escapeHtmlAdmin(name) + '</span><br><span style="font-size:0.7rem; color:#64748b;">' + escapeHtmlAdmin(u.email||'') + '</span></span>' + badge + '</label>';
    });
    list.innerHTML = html;
}
function toggleBroadcastUser(cb){
    if (cb.checked) selectedBroadcastIds.add(cb.value);
    else selectedBroadcastIds.delete(cb.value);
    updateBroadcastCount();
}
function updateBroadcastCount(){
    var aud = document.getElementById('broadcastAudience') ? document.getElementById('broadcastAudience').value : 'all';
    var countEl = document.getElementById('broadcastSendCount');
    var selEl = document.getElementById('selectedCount');
    if (selEl) selEl.textContent = selectedBroadcastIds.size;
    var n = 0;
    if (aud==='selected') n = selectedBroadcastIds.size;
    else if (aud==='all') n = broadcastUsersCache.length || 'all';
    else if (aud==='premium') n = broadcastUsersCache.filter(function(u){ return u.isPremium; }).length || 'premium';
    else if (aud==='starter') n = broadcastUsersCache.filter(function(u){ return !u.isPremium; }).length || 'starter';
    if (countEl) countEl.textContent = n;
}
async function sendBroadcast(){
    var aud = document.getElementById('broadcastAudience').value;
    var msg = (document.getElementById('broadcastMessage').value || '').trim();
    if (!msg) { alert('Type an announcement first'); return; }
    if (aud==='selected' && selectedBroadcastIds.size===0) { alert('Select at least one user'); return; }
    var btn = document.getElementById('sendBroadcastBtn');
    var prog = document.getElementById('broadcastProgress');
    if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Sending...'; }
    if (prog) { prog.style.display='block'; prog.textContent='Preparing...'; }
    try {
        var targets = [];
        if (aud==='all') targets = broadcastUsersCache.slice();
        else if (aud==='premium') targets = broadcastUsersCache.filter(function(u){ return u.isPremium; });
        else if (aud==='starter') targets = broadcastUsersCache.filter(function(u){ return !u.isPremium; });
        else if (aud==='selected') {
            var ids = Array.from(selectedBroadcastIds);
            targets = broadcastUsersCache.filter(function(u){ return ids.indexOf(u._id)!==-1; });
        }
        if (!targets.length) { alert('No users in this audience'); if(btn){btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Send to ' + (document.getElementById('broadcastSendCount').textContent||'all');} if(prog) prog.style.display='none'; return; }
        if (!confirm('Send announcement to ' + targets.length + ' user(s)?\n\n"' + msg.slice(0,120) + (msg.length>120?'…':'') + '"\n\nIt will appear as an amber Announcement in each chat.')) {
            if(btn){btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Send to ' + (document.getElementById('broadcastSendCount').textContent||'all');}
            if(prog) prog.style.display='none';
            return;
        }
        var sent=0, failed=0;
        for (var i=0;i<targets.length;i++){
            var u = targets[i];
            var uid = u._id;
            if (prog) prog.textContent = 'Sending ' + (i+1) + '/' + targets.length + ' — ' + (u.email||uid);
            try {
                var q = await firebaseDB.collection('conversations')
                    .where('participants','array-contains', adminUid).get();
                var convId = null;
                q.forEach(function(doc){
                    var d=doc.data();
                    if (d.participants && d.participants.length===2 && d.participants.indexOf(uid)!==-1 && !d.productId) {
                        convId = doc.id;
                    }
                });
                if (!convId) {
                    var ref = await firebaseDB.collection('conversations').add({
                        participants: [adminUid, uid],
                        participantNames: (function(){ var m={}; m[adminUid]=adminName; m[uid]= (u.name||u.email||'User'); return m; })(),
                        productId: null,
                        productTitle: null,
                        lastMessage: msg,
                        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                        unreadBy: [uid],
                        isBroadcast: true,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    convId = ref.id;
                } else {
                    await firebaseDB.collection('conversations').doc(convId).update({
                        lastMessage: msg,
                        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                        unreadBy: firebase.firestore.FieldValue.arrayUnion(uid)
                    });
                }
                await firebaseDB.collection('conversations').doc(convId).collection('messages').add({
                    senderId: adminUid,
                    senderName: adminName,
                    senderEmail: adminEmail || 'sankofamarketgh@gmail.com',
                    text: msg,
                    isAdmin: true,
                    isAnnouncement: true,
                    participants: [adminUid, uid],   // required by the security rules
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'sent'
                });
                sent++;
            } catch(e){ console.error('broadcast to',uid,e); failed++; }
            await new Promise(function(r){ setTimeout(r, 120); });
        }
        if (prog) prog.innerHTML = '<span style="color:#16a34a;"><i class="fas fa-check-circle"></i> Sent to ' + sent + ' user(s)' + (failed?' — '+failed+' failed':'') + '</span>';
        setTimeout(function(){ closeBroadcastModal(); document.getElementById('broadcastMessage').value=''; if(document.getElementById('broadcastCharCount')) document.getElementById('broadcastCharCount').textContent='0'; }, 1400);
    } catch(e){
        alert('Broadcast failed: ' + e.message);
        if(prog) { prog.style.display='block'; prog.innerHTML='<span style="color:#dc2626;">Failed: '+e.message+'</span>'; }
    } finally {
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Send to ' + (document.getElementById('broadcastSendCount')?document.getElementById('broadcastSendCount').textContent:'all'); }
    }
}
document.addEventListener('DOMContentLoaded', function(){
    var b = document.getElementById('broadcastBtn');
    if (b) b.addEventListener('click', openBroadcastModal);
    var ta = document.getElementById('broadcastMessage');
    if (ta) ta.addEventListener('input', function(){ var c=document.getElementById('broadcastCharCount'); if(c) c.textContent=String(this.value.length); });
});


/* ---- Helpers ---- */
function formatAdminTime(date) {
    var now = new Date();
    var diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }
}

function escapeHtmlAdmin(text) {
    var div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}


// Admin delete helpers — also updates lastMessage if needed
function adminDeleteMessage(convId, msgId){
    if(!confirm('Delete this message? This cannot be undone.\n\nAdmin action — user messages will be removed permanently.')) return;
    if (typeof firebaseDB==='undefined' || !firebaseDB) { alert('Firebase not connected'); return; }
    firebaseDB.collection('users').doc(adminUid).get().then(function(doc){
        var d=doc.exists?doc.data():{};
        if (d.role!=='admin'){ alert('Only admin can delete messages'); return; }
        return firebaseDB.collection('conversations').doc(convId).collection('messages').doc(msgId).delete();
    }).then(function(){
        if (typeof showFlashMessage==='function') showFlashMessage('Message deleted ✓','success');
        // Best-effort: if deleted was lastMessage, update conv lastMessage to previous (or empty)
        try{
            var conv = adminConvs[convId];
            if (conv && conv.lastMessage){
                // fetch last 2 messages to deduce new last
                firebaseDB.collection('conversations').doc(convId).collection('messages').orderBy('createdAt','desc').limit(1).get().then(function(snap){
                    var newLast = '';
                    var newTime = firebase.firestore.FieldValue.serverTimestamp();
                    if (!snap.empty){
                        var lastDoc = snap.docs[0].data();
                        newLast = lastDoc.text || (lastDoc.fileUrl ? '[Attachment]' : '');
                        // keep existing server timestamp for ordering
                    }
                    firebaseDB.collection('conversations').doc(convId).update({ lastMessage: newLast, lastMessageAt: snap.empty ? newTime : (snap.docs[0].data().createdAt || newTime) }).catch(function(){});
                }).catch(function(){});
            }
        }catch(e){}
    }).catch(function(e){ alert('Error: '+e.message); });
}
// Expose admin delete helpers globally for inline handlers
window.adminDeleteMessage = adminDeleteMessage;
window.adminDeleteConversation = adminDeleteConversation;
window.deleteSelectedAdminConvs = deleteSelectedAdminConvs;
window.toggleAdminConvSelection = toggleAdminConvSelection;
window.toggleSelectAllAdminConvs = toggleSelectAllAdminConvs;
window.clearAdminConvSelection = clearAdminConvSelection;
