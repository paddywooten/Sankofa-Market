/**
 * Sankofa Wallet — Closed-loop 0% internal transfers
 * Top-up via Paystack (1.95% once), all internal buys/sells 0%
 * v3 — robust loading with fallback get() + timeout + auto-create
 */

let walletUnsub = null;
let txUnsub = null;
let currentBalance = 0;
let PAYSTACK_PUBLIC_KEY_WALLET = '';
let _walletLoaded = false;
let _txLoaded = false;

document.addEventListener('DOMContentLoaded', function(){
    initWallet();
    // the withdrawal form + history share this page
    payoutMethodChanged();
    loadMyPayouts();
    if (typeof firebase !== 'undefined' && firebase.auth) {
        // keep the history in step with the live balance
        firebase.auth().onAuthStateChanged(function (u) { if (u) loadMyPayouts(); });
    }
});

async function initWallet(){
    // Load Paystack key — force server fetch to avoid stale live cache after switch to test, fallback to TEST pk for GHS
    try{
        if(typeof firebaseDB !== 'undefined' && firebaseDB){
            let d=null, ps=null;
            try{ d = await firebaseDB.collection('settings').doc('premium').get({source:'server'}); }catch(e){ try{ d = await firebaseDB.collection('settings').doc('premium').get(); }catch(e2){} }
            if(d && d.exists && d.data().paystackPublicKey) PAYSTACK_PUBLIC_KEY_WALLET = d.data().paystackPublicKey;
            try{ ps = await firebaseDB.collection('settings').doc('paystack').get({source:'server'}); }catch(e){ try{ ps = await firebaseDB.collection('settings').doc('paystack').get(); }catch(e2){} }
            if(!PAYSTACK_PUBLIC_KEY_WALLET && ps && ps.exists && (ps.data().publicKey||ps.data().paystackPublicKey)) PAYSTACK_PUBLIC_KEY_WALLET = ps.data().publicKey||ps.data().paystackPublicKey;
            if(!PAYSTACK_PUBLIC_KEY_WALLET){ PAYSTACK_PUBLIC_KEY_WALLET='pk_test_c5ec8098c42f62cef3a9b31a86ff0d87cb98321c'; console.warn('wallet Paystack fallback TEST'); }
        } else if(!PAYSTACK_PUBLIC_KEY_WALLET){
            PAYSTACK_PUBLIC_KEY_WALLET='pk_test_c5ec8098c42f62cef3a9b31a86ff0d87cb98321c';
        }
        console.log('wallet Paystack key', PAYSTACK_PUBLIC_KEY_WALLET.slice(0,12)+'...', PAYSTACK_PUBLIC_KEY_WALLET.includes('live')?'LIVE':'TEST');
    }catch(e){ console.warn('wallet paystack key', e); if(!PAYSTACK_PUBLIC_KEY_WALLET) PAYSTACK_PUBLIC_KEY_WALLET='pk_test_c5ec8098c42f62cef3a9b31a86ff0d87cb98321c'; }

    // Show auth checking loader until first auth callback — prevents wallet page showing balance before sign-in known
    try{
        const wm0=document.getElementById('walletMain');
        const ws0=document.getElementById('walletSignIn');
        let wal0=document.getElementById('walletAuthLoader');
        if(wm0 && ws0 && !wal0){
            wal0=document.createElement('div');
            wal0.id='walletAuthLoader';
            wal0.style.cssText='text-align:center;padding:2rem;background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:1rem;';
            wal0.innerHTML='<i class="fas fa-spinner fa-spin" style="color:#0064d2;font-size:1.3rem;"></i><p style="margin-top:0.6rem;color:#6b7280;font-weight:600;">Checking sign-in...</p>';
            wm0.parentNode.insertBefore(wal0, wm0);
            wm0.classList.add('hidden');
            ws0.classList.add('hidden');
        } else if(wal0){
            // keep hidden until auth resolves
        }
    }catch(e){}

    if(typeof firebaseAuth === 'undefined' || !firebaseAuth || typeof firebaseDB === 'undefined' || !firebaseDB){
        setTimeout(initWallet, 800); return;
    }
    let walletAuthDone=false;
    firebaseAuth.onAuthStateChanged(function(user){
        if(!walletAuthDone){
            walletAuthDone=true;
            const wal=document.getElementById('walletAuthLoader');
            if(wal) wal.style.display='none';
        }
        if(walletUnsub) try{ walletUnsub(); }catch(e){}
        if(txUnsub) try{ txUnsub(); }catch(e){}
        _walletLoaded = false;
        _txLoaded = false;
        if(!user){
            const balEl = document.getElementById('walletBalance');
            if(balEl) balEl.textContent = '—';
            const subEl = document.getElementById('walletBalanceSub');
            if(subEl) subEl.textContent = 'Sign in to view balance';
            document.getElementById('walletMain')?.classList.add('hidden');
            document.getElementById('walletSignIn')?.classList.remove('hidden');
            const list = document.getElementById('walletTxList');
            if(list) list.innerHTML = '<div style="text-align:center;padding:1.5rem;color:#5f6b7a;">Please sign in.</div>';
            return;
        }
        document.getElementById('walletSignIn')?.classList.add('hidden');
        document.getElementById('walletMain')?.classList.remove('hidden');
        document.getElementById('walletUserEmail') && (document.getElementById('walletUserEmail').textContent = user.email || '');
        // Show syncing state immediately
        const balEl = document.getElementById('walletBalance');
        if(balEl) balEl.textContent = 'GHS 0.00';
        const subEl = document.getElementById('walletBalanceSub');
        if(subEl) subEl.textContent = 'Syncing wallet...';
        const txList = document.getElementById('walletTxList');
        if(txList) txList.innerHTML = '<div style="text-align:center;padding:1.5rem;color:#5f6b7a;"><i class="fas fa-spinner fa-spin"></i><p style="margin-top:0.5rem;">Loading transactions...</p></div>';

        // Start live listeners with fallback
        startWalletListener(user);
        startTxListener(user);
        initTopupChips();

        // Safety timeout: if still loading after 6s, fallback to direct get()
        setTimeout(function(){
            if(!_walletLoaded){
                console.warn('wallet still loading after 6s, fallback get()');
                fallbackWalletGet(user);
            }
            if(!_txLoaded){
                console.warn('tx still loading after 6s, fallback get()');
                fallbackTxGet(user);
            }
        }, 6000);
    });
}

function startWalletListener(user){
    try{
        const ref = firebaseDB.collection('wallets').doc(user.uid);
        walletUnsub = ref.onSnapshot(function(doc){
            _walletLoaded = true;
            if(!doc.exists){
                // Show new wallet state immediately
                const balEl = document.getElementById('walletBalance');
                if(balEl) balEl.textContent = 'GHS 0.00';
                document.getElementById('walletBalanceSub') && (document.getElementById('walletBalanceSub').textContent = 'New wallet • Top up to start • GHS 0.00');
                window.__walletBalance = 0;
                // Auto-create via function + direct fallback
                createWalletIfMissing(user);
                return;
            }
            const w = doc.data();
            currentBalance = w.balance || 0;
            const balEl = document.getElementById('walletBalance');
            if(balEl) balEl.textContent = 'GHS ' + Number(currentBalance).toLocaleString(undefined, {minimumFractionDigits:2});
            document.getElementById('walletBalanceSub') && (document.getElementById('walletBalanceSub').textContent = `Total top-ups GHS ${(w.totalTopups||0).toLocaleString()} • Spent GHS ${(w.totalSpent||0).toLocaleString()} • Earned GHS ${(w.totalEarnings||0).toLocaleString()}`);
            window.__walletBalance = Number(w.balance || 0);
        }, function(err){
            console.warn('wallet listen error', err);
            _walletLoaded = true; // prevent infinite timeout loop, but still try fallback
            // Try fallback get()
            fallbackWalletGet(user, err);
            // Also try function
            if(typeof firebase !== 'undefined' && firebase.functions){
                try{ firebase.functions().httpsCallable('getWallet')({}).catch(function(e){ console.warn('getWallet fn failed', e); }); }catch(e){}
            }
        });
    }catch(e){
        console.warn('startWalletListener exception', e);
        fallbackWalletGet(user, e);
    }
}

function fallbackWalletGet(user, origErr){
    const ref = firebaseDB.collection('wallets').doc(user.uid);
    // Try server first, then cache fallback
    ref.get({source:'server'}).then(function(doc){
        if(!doc.exists){
            const balEl = document.getElementById('walletBalance');
            if(balEl) balEl.textContent = 'GHS 0.00';
            const sub=document.getElementById('walletBalanceSub');
            if(sub) sub.textContent = 'New wallet • GHS 0.00 • Top up to start';
            createWalletIfMissing(user);
            return;
        }
        const w=doc.data();
        currentBalance = w.balance||0;
        const balEl=document.getElementById('walletBalance');
        if(balEl) balEl.textContent='GHS '+Number(currentBalance).toLocaleString(undefined,{minimumFractionDigits:2});
        const sub=document.getElementById('walletBalanceSub');
        if(sub) sub.textContent=`Total top-ups GHS ${(w.totalTopups||0).toLocaleString()} • Spent GHS ${(w.totalSpent||0).toLocaleString()} • Earned GHS ${(w.totalEarnings||0).toLocaleString()}`;
        _walletLoaded=true;
    }).catch(function(err){
        console.warn('fallbackWalletGet server failed', err);
        // Try cache or show error with retry
        ref.get().then(function(doc){
            if(doc.exists){
                const w=doc.data();
                currentBalance=w.balance||0;
                const balEl=document.getElementById('walletBalance');
                if(balEl) balEl.textContent='GHS '+Number(currentBalance).toLocaleString(undefined,{minimumFractionDigits:2});
                _walletLoaded=true;
            } else {
                const listErr = origErr || err;
                const sub=document.getElementById('walletBalanceSub');
                if(sub) sub.innerHTML = '<span style="color:#e74c3c;">Could not load wallet • <a href="#" onclick="location.reload();return false;" style="color:#0064d2;font-weight:700;">Retry</a></span>';
                // Also show in tx area if still loading
                console.warn('wallet get failed', listErr);
            }
        }).catch(function(e2){
            const sub=document.getElementById('walletBalanceSub');
            if(sub) sub.innerHTML = '<span style="color:#e74c3c;">Offline / error • <a href="#" onclick="location.reload();return false;" style="color:#0064d2;font-weight:700;">Retry</a></span>';
        });
    });
}

function createWalletIfMissing(user){
    // Try cloud function first
    if(typeof firebase !== 'undefined' && firebase.functions){
        try{
            firebase.functions().httpsCallable('getWallet')({}).then(function(res){
                console.log('getWallet created', res);
            }).catch(function(e){
                console.warn('getWallet fn error, fallback direct', e);
                directCreateWalletDoc(user);
            });
            return;
        }catch(e){}
    }
    directCreateWalletDoc(user);
}

function directCreateWalletDoc(user){
    const ref=firebaseDB.collection('wallets').doc(user.uid);
    ref.get().then(function(doc){
        if(doc.exists) return;
        // Creating your own wallet is allowed, but ONLY with a zero balance (enforced by rules)
        return ref.set({userId:user.uid, balance:0, currency:'GHS', totalTopups:0, totalSpent:0, totalEarnings:0, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()}).then(function(){
            console.log('direct wallet created');
            const sub=document.getElementById('walletBalanceSub');
            if(sub) sub.textContent='New wallet ready • GHS 0.00';
        }).catch(function(e){ console.warn('direct create failed', e); });
    }).catch(function(e){ console.warn('directCreate check failed', e); });
}

function startTxListener(user){
    try{
        const q = firebaseDB.collection('walletTransactions').where('userId','==',user.uid).orderBy('createdAt','desc').limit(50);
        txUnsub = q.onSnapshot(function(snap){
            _txLoaded = true;
            renderTxSnap(snap);
        }, function(err){
            console.warn('tx listen error', err);
            _txLoaded = true;
            // If missing index, fallback without orderBy
            if(err && err.code==='failed-precondition' && String(err.message).includes('index')){
                const list=document.getElementById('walletTxList');
                if(list) list.innerHTML = '<div style="text-align:center;padding:1rem;color:#f59e0b;"><i class="fas fa-spinner fa-spin"></i> Building index — retrying without sort...</div>';
                fallbackTxGet(user, true);
            } else {
                // Try fallback get without orderBy
                fallbackTxGet(user, false);
                // Also show error
                const list=document.getElementById('walletTxList');
                if(list && err && err.code==='permission-denied'){
                    list.innerHTML = '<p style="color:#e74c3c;padding:1rem;text-align:center;">Permission denied • <a href="#" onclick="location.reload();return false;" style="color:#0064d2;">Retry</a><br><small>'+escWallet(err.message)+'</small></p>';
                }
            }
        });
    }catch(e){
        console.warn('startTxListener exception', e);
        fallbackTxGet(user);
    }
}

function fallbackTxGet(user, noOrder){
    let q;
    if(noOrder){
        q = firebaseDB.collection('walletTransactions').where('userId','==',user.uid).limit(50);
    } else {
        q = firebaseDB.collection('walletTransactions').where('userId','==',user.uid).orderBy('createdAt','desc').limit(50);
    }
    q.get({source:'server'}).then(function(snap){
        if(noOrder){
            // Sort client side by createdAt desc
            let arr=[];
            snap.forEach(function(doc){ let d=doc.data(); d._id=doc.id; arr.push(d); });
            arr.sort(function(a,b){
                let at = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
                let bt = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
                return bt-at;
            });
            // Build fake snap-like render
            const list=document.getElementById('walletTxList');
            if(!list) return;
            if(arr.length===0){
                list.innerHTML = '<div style="text-align:center;padding:2rem;color:#5f6b7a;"><i class="fas fa-receipt" style="font-size:1.8rem;display:block;margin-bottom:0.6rem;"></i><p style="margin:0;font-weight:600;">No transactions yet</p><p style="margin:0.2rem 0 0;font-size:0.82rem;">Top up to start — then pay for orders with 0% fee.</p></div>';
                return;
            }
            let html='';
            arr.forEach(function(tx){
                const at = tx.createdAt ? (tx.createdAt.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt)) : new Date();
                let whenStr=''; try{ whenStr = at.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+' • '+at.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }catch(e){}
                const isCredit = tx.amount > 0;
                const icon = tx.type==='topup' ? 'fa-arrow-down' : tx.type==='purchase' ? 'fa-shopping-bag' : tx.type==='sale' ? 'fa-coins' : tx.type==='store_plan' ? 'fa-store' : 'fa-exchange-alt';
                const bg = tx.type==='topup' ? '#22c55e' : tx.type==='sale' ? '#f59e0b' : tx.type==='purchase' ? '#ef4444' : tx.type==='store_plan' ? '#7c3aed' : '#6b7280';
                const amtClass = isCredit ? 'pos' : 'neg';
                const sign = isCredit ? '+' : '';
                const desc = tx.description || (tx.type==='topup' ? 'Top-up' : tx.type);
                const ref = tx.reference ? `<span style="font-size:0.65rem;color:#5f6b7a;">${escWallet(tx.reference.substring(0,12))}</span>` : '';
                html += `<div class="tx-item">
                    <div class="tx-icon" style="background:${bg};"><i class="fas ${icon}"></i></div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escWallet(desc)}</div>
                        <div style="font-size:0.7rem;color:#6b7280;">${whenStr} ${ref}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="tx-amount ${amtClass}">${sign}GHS ${Number(tx.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                        <div style="font-size:0.65rem;color:#6b7280;">Bal GHS ${Number(tx.balanceAfter||0).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                    </div>
                </div>`;
            });
            list.innerHTML=html;
            _txLoaded=true;
        } else {
            renderTxSnap(snap);
        }
    }).catch(function(err){
        console.warn('fallbackTxGet failed', err);
        const list=document.getElementById('walletTxList');
        if(list){
            if(err && String(err.message).includes('index')){
                // Retry without order
                fallbackTxGet(user, true);
            } else {
                list.innerHTML = '<div style="text-align:center;padding:1.5rem;color:#e74c3c;"><p>Could not load transactions</p><p style="font-size:0.75rem;color:#6b7280;margin-top:0.4rem;">'+escWallet(err.message||String(err))+'</p><button onclick="location.reload()" style="margin-top:0.8rem;background:#0064d2;color:#fff;border:none;padding:0.5rem 0.9rem;border-radius:8px;font-weight:700;cursor:pointer;">Retry</button> <button onclick="fallbackTxGet(firebaseAuth.currentUser,true)" style="margin-top:0.8rem;background:#fff;border:1px solid #e5e7eb;padding:0.5rem 0.9rem;border-radius:8px;font-weight:600;cursor:pointer;margin-left:0.4rem;">Try without sort</button></div>';
                // Expose fallback for inline button
                window.fallbackTxGet = fallbackTxGet;
            }
        }
    });
}

function renderTxSnap(snap){
    const list = document.getElementById('walletTxList');
    if(!list) return;
    _txLoaded = true;
    if(snap.empty){
        list.innerHTML = '<div style="text-align:center;padding:2rem;color:#5f6b7a;"><i class="fas fa-receipt" style="font-size:1.8rem;display:block;margin-bottom:0.6rem;"></i><p style="margin:0;font-weight:600;">No transactions yet</p><p style="margin:0.2rem 0 0;font-size:0.82rem;">Top up to start — then pay for orders with 0% fee.</p></div>';
        return;
    }
    let html='';
    snap.forEach(function(doc){
        const tx = doc.data();
        const at = tx.createdAt ? (tx.createdAt.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt)) : new Date();
        let whenStr=''; try{ whenStr = at.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+' • '+at.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }catch(e){}
        const isCredit = tx.amount > 0;
        const icon = tx.type==='topup' ? 'fa-arrow-down' : tx.type==='purchase' ? 'fa-shopping-bag' : tx.type==='sale' ? 'fa-coins' : tx.type==='store_plan' ? 'fa-store' : 'fa-exchange-alt';
        const bg = tx.type==='topup' ? '#22c55e' : tx.type==='sale' ? '#f59e0b' : tx.type==='purchase' ? '#ef4444' : tx.type==='store_plan' ? '#7c3aed' : '#6b7280';
        const amtClass = isCredit ? 'pos' : 'neg';
        const sign = isCredit ? '+' : '';
        const desc = tx.description || (tx.type==='topup' ? 'Top-up' : tx.type);
        const ref = tx.reference ? `<span style="font-size:0.65rem;color:#5f6b7a;">${escWallet(tx.reference.substring(0,12))}</span>` : '';
        html += `<div class="tx-item">
            <div class="tx-icon" style="background:${bg};"><i class="fas ${icon}"></i></div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escWallet(desc)}</div>
                <div style="font-size:0.7rem;color:#6b7280;">${whenStr} ${ref}</div>
            </div>
            <div style="text-align:right;">
                <div class="tx-amount ${amtClass}">${sign}GHS ${Number(tx.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                <div style="font-size:0.65rem;color:#6b7280;">Bal GHS ${Number(tx.balanceAfter||0).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
            </div>
        </div>`;
    });
    list.innerHTML = html;
}

function escWallet(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initTopupChips(){
    document.querySelectorAll('.topup-chip').forEach(function(chip){
        chip.addEventListener('click', function(){
            document.querySelectorAll('.topup-chip').forEach(c=>c.classList.remove('active'));
            this.classList.add('active');
            const val=this.getAttribute('data-amount');
            const input=document.getElementById('topupAmount');
            if(input) input.value=val;
        });
    });
    const form=document.getElementById('topupForm');
    if(form && !form._walletBound){
        form._walletBound=true;
        form.addEventListener('submit', function(e){
            e.preventDefault();
            const amt=parseFloat(document.getElementById('topupAmount').value);
            if(!amt || amt < 5){ alert('Minimum top-up GHS 5'); return; }
            startTopup(amt);
        });
    }
}

async function startTopup(amount){
    const btn=document.getElementById('topupBtn');
    const orig=btn ? btn.innerHTML : '';
    const statusEl=document.getElementById('topupStatus');
    if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Opening Paystack...'; }
    if(statusEl) statusEl.innerHTML='<span style="color:#0064d2;"><i class="fas fa-spinner fa-spin"></i> Initializing GHS '+amount.toLocaleString()+'...</span>';

    // ⚠️ There used to be a "demo" branch here that credited the wallet straight from the
    // browser (mockCreditWallet). That was a money-forging hole: any signed-in member could
    // give themselves unlimited balance. It is gone for good, and the database rules now
    // reject client writes to balance/totalTopups anyway. Money may only be created by
    // Paystack + the verifyWalletTopup Cloud Function.
    // fetch the checkout SDK now (it is no longer loaded up-front on the wallet page)
    if(typeof PaystackPop==='undefined'){
        if(statusEl) statusEl.innerHTML='<span style="color:#0064d2;"><i class="fas fa-spinner fa-spin"></i> Loading secure checkout...</span>';
        await ensurePaystackSdk();
    }
    if(!PAYSTACK_PUBLIC_KEY_WALLET || typeof PaystackPop==='undefined'){
        if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;"><i class="fas fa-exclamation-triangle"></i> Wallet top-ups are unavailable right now — the payment gateway did not load. Please check your connection and try again, or contact support (sankofamarketgh@gmail.com).</span>';
        if(btn){ btn.disabled=false; btn.innerHTML=orig; }
        return;
    }

    const user = (typeof firebaseAuth!=='undefined' && firebaseAuth.currentUser) ? firebaseAuth.currentUser : (firebase.auth && firebase.auth().currentUser);
    const email = user ? user.email : 'user@sankofa.market';
    const reference='WALLET-'+(user?user.uid.slice(0,6).toUpperCase():'USR')+'-'+Date.now();
    const amountKobo=Math.round(amount*100);

    try{
        const handler=PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY_WALLET,
            email: email,
            amount: amountKobo,
            ref: reference,
            // Paystack stores this with the charge. The Cloud Function reads it back to prove
            // the payment belongs to THIS account before crediting anything — without it,
            // anyone who got hold of a reference could credit their own wallet with it.
            metadata: {
                userId: user ? user.uid : null,
                purpose: 'wallet_topup',
                custom_fields: [
                    { display_name: 'Purpose', variable_name: 'purpose', value: 'Sankofa Wallet top-up' },
                    { display_name: 'Account', variable_name: 'user_id', value: user ? user.uid : '' }
                ]
            },
            callback: function(resp){
                if(statusEl) statusEl.innerHTML='<span style="color:#0064d2;"><i class="fas fa-spinner fa-spin"></i> Verifying '+resp.reference+'...</span>';
                const fn=firebase.functions().httpsCallable('verifyWalletTopup');
                fn({reference: resp.reference, amount: amount}).then(function(res){
                    if(statusEl) statusEl.innerHTML='<span style="color:#16a34a;"><i class="fas fa-check-circle"></i> Credited GHS '+res.data.amount.toLocaleString()+' — new balance GHS '+res.data.balance.toLocaleString()+'</span>';
                    const inp=document.getElementById('topupAmount');
                    if(inp) inp.value='';
                    document.querySelectorAll('.topup-chip').forEach(c=>c.classList.remove('active'));
                    if(btn){ btn.disabled=false; btn.innerHTML=orig; }
                }).catch(function(e){
                    console.error('verify failed', e);
                    const msg = e.message || (e.details && e.details.message) || String(e);
                    if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;">Verification failed: '+escWallet(msg)+'</span>'+
                        '<br><span style="font-size:0.8rem;color:#6b7280;">Nothing was credited. If your card was charged, email sankofamarketgh@gmail.com with reference '+escWallet(resp.reference)+' and it will be credited manually.</span>';
                    if(btn){ btn.disabled=false; btn.innerHTML=orig; }
                });
            },
            onClose: function(){
                if(statusEl) statusEl.innerHTML='<span style="color:#f59e0b;">Paystack closed — not charged</span>';
                if(btn){ btn.disabled=false; btn.innerHTML=orig; }
            }
        });
        handler.openIframe();
    }catch(e){
        console.error('paystack setup', e);
        if(statusEl) statusEl.innerHTML='<span style="color:#e74c3c;">Paystack error: '+escWallet(e.message)+' — Try Top Up GHS 50 with test card 4084084084084081. If on Live, ensure sankofa-market.web.app is whitelisted in Paystack Dashboard → Settings → API Keys → Whitelisted domains.</span>';
        if(btn){ btn.disabled=false; btn.innerHTML=orig; }
    }
}


async function payOrderWithWallet(orderId){
    const btn=document.getElementById('payButton');
    const orig=btn?btn.innerHTML:'';
    if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Paying with wallet...'; }
    try{
        const fn=firebase.functions().httpsCallable('payWithWallet');
        const res=await fn({orderId});
        alert('Paid with wallet! New balance GHS '+res.data.balance.toLocaleString());
        location.href='order-confirmation.html?orderId='+orderId;
    }catch(e){
        alert('Wallet payment failed: '+(e.message||String(e)));
        if(btn){ btn.disabled=false; btn.innerHTML=orig; }
        throw e;
    }
}
window.payOrderWithWallet = payOrderWithWallet;
window.startTopup = startTopup;
window.fallbackTxGet = fallbackTxGet;


/** Load Paystack's inline checkout ONLY when someone actually pays.
 *  The script used to be loaded on every visit to the wallet page, and it drags in
 *  ~300 KB of its own bundle + pusher even when you just want to look at your balance. */
function ensurePaystackSdk(timeoutMs) {
    return new Promise(function (resolve) {
        if (typeof PaystackPop !== 'undefined') return resolve(true);
        if (window.__paystackLoading) { window.__paystackLoading.push(resolve); return; }
        window.__paystackLoading = [resolve];
        var finish = function (ok) {
            var waiting = window.__paystackLoading || [];
            window.__paystackLoading = null;
            waiting.forEach(function (fn) { try { fn(ok); } catch (e) {} });
        };
        var tag = document.createElement('script');
        tag.src = 'https://js.paystack.co/v1/inline.js';
        tag.async = true;
        tag.onload = function () { finish(typeof PaystackPop !== 'undefined'); };
        tag.onerror = function () { finish(false); };
        document.head.appendChild(tag);
        setTimeout(function () { finish(typeof PaystackPop !== 'undefined'); }, timeoutMs || 10000);
    });
}


/* ============================================================================
   SELLER WITHDRAWALS (UI)
   ---------------------------------------------------------------------------
   Talks to requestPayout / cancelPayout. The money is held server-side the moment
   a request is made, so the balance you see always matches what is really available.
   ========================================================================== */
var PAYOUT_MIN = 20;
var payoutCache = [];

function payoutEl(id) { return document.getElementById(id); }

function payoutPreset(v) { var el = payoutEl('payoutAmount'); if (el) el.value = v; }

function payoutMax() {
    var el = payoutEl('payoutAmount');
    var bal = (window.__walletBalance != null) ? Number(window.__walletBalance) : null;
    if (!el) return;
    if (bal == null) { escWalletStatus('Balance is still loading — try again in a second.', 'info'); return; }
    el.value = Math.max(0, Math.floor(bal * 100) / 100).toFixed(2);
}

function payoutMethodChanged() {
    var method = (document.querySelector('input[name="payoutMethod"]:checked') || {}).value || 'momo';
    var momo = payoutEl('payoutMomoFields'), bank = payoutEl('payoutBankFields'), num = payoutEl('payoutNumber');
    if (momo) momo.style.display = method === 'momo' ? '' : 'none';
    if (bank) bank.style.display = method === 'bank' ? '' : 'none';
    if (num) num.placeholder = method === 'momo' ? 'Mobile Money number (e.g. 024 123 4567)' : 'Account number';
}

function escWalletStatus(msg, type) {
    var el = payoutEl('payoutStatus');
    if (!el) return;
    var colors = { ok: '#166534', error: '#b91c1c', info: '#1e40af' };
    el.style.color = colors[type] || colors.info;
    el.innerHTML = msg;
}

function payoutEscape(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function payoutMoney(n) { return 'GHS ' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

async function submitPayoutRequest() {
    var btn = payoutEl('payoutSubmitBtn');
    var amount = Number(payoutEl('payoutAmount') ? payoutEl('payoutAmount').value : 0);
    var method = (document.querySelector('input[name="payoutMethod"]:checked') || {}).value || 'momo';
    var details = {
        name: (payoutEl('payoutName') || {}).value || '',
        number: (payoutEl('payoutNumber') || {}).value || '',
        provider: (payoutEl('payoutProvider') || {}).value || '',
        bankName: (payoutEl('payoutBankName') || {}).value || ''
    };

    if (!amount || amount <= 0) return escWalletStatus('Enter the amount you want to withdraw.', 'error');
    if (amount < PAYOUT_MIN) return escWalletStatus('The smallest withdrawal is ' + payoutMoney(PAYOUT_MIN) + '.', 'error');
    if (!details.name.trim()) return escWalletStatus('Enter the name on the account.', 'error');
    if (!details.number.trim()) return escWalletStatus(method === 'momo' ? 'Enter the Mobile Money number.' : 'Enter the account number.', 'error');
    if (method === 'momo' && !details.provider) return escWalletStatus('Choose the Mobile Money network.', 'error');
    if (method === 'bank' && !details.bankName.trim()) return escWalletStatus('Enter the bank name.', 'error');
    if (!confirm('Request ' + payoutMoney(amount) + ' to ' +
        (method === 'momo' ? details.provider + ' ' + details.number : details.bankName + ' ' + details.number) +
        '?\n\nThis amount is held straight away and paid out within 1–2 working days.')) return;

    var orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending request…'; }
    escWalletStatus('', 'info');

    try {
        if (typeof firebase === 'undefined' || !firebase.functions) throw new Error('The payment service has not loaded — please refresh the page.');
        var fn = firebase.functions().httpsCallable('requestPayout');
        var res = await fn({ amount: amount, method: method, details: details });
        var d = res.data || {};
        escWalletStatus('<i class="fas fa-check-circle"></i> ' + payoutEscape(d.message || 'Request received.') +
            '<br><span style="font-size:0.76rem;">Reference ' + payoutEscape(d.reference || '') + ' • available balance ' + payoutMoney(d.balance) + '</span>', 'ok');
        if (payoutEl('payoutAmount')) payoutEl('payoutAmount').value = '';
        if (typeof initWallet === 'function') { try { await initWallet(); } catch (e) {} }
        loadMyPayouts();
    } catch (e) {
        var msg = (e && (e.message || (e.details && e.details.message))) || String(e);
        escWalletStatus('Could not send the request: ' + payoutEscape(msg), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = orig || '<i class="fas fa-paper-plane"></i> Request withdrawal'; }
    }
}

async function cancelMyPayout(payoutId) {
    if (!confirm('Cancel this withdrawal request?\n\nThe money goes straight back into your wallet.')) return;
    try {
        var fn = firebase.functions().httpsCallable('cancelPayout');
        var res = await fn({ payoutId: payoutId });
        escWalletStatus('<i class="fas fa-check-circle"></i> ' + payoutEscape((res.data && res.data.message) || 'Cancelled.'), 'ok');
        if (typeof initWallet === 'function') { try { await initWallet(); } catch (e) {} }
        loadMyPayouts();
    } catch (e) {
        var msg = (e && (e.message || (e.details && e.details.message))) || String(e);
        escWalletStatus('Could not cancel: ' + payoutEscape(msg), 'error');
    }
}

var PAYOUT_BADGE = {
    pending:  ['Pending', 'background:#fffbeb;color:#92400e;border:1px solid #fde68a;'],
    processing: ['Being sent to your Mobile Money', 'background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;'],
    paid:     ['Paid', 'background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;'],
    rejected: ['Returned to wallet', 'background:#fef2f2;color:#991b1b;border:1px solid #fecaca;'],
    cancelled:['Cancelled', 'background:#f3f4f6;color:#4b5563;border:1px solid #e5e7eb;']
};

async function loadMyPayouts() {
    var host = payoutEl('payoutList');
    if (!host) return;
    if (typeof firebaseDB === 'undefined' || !firebaseDB || !firebaseAuth || !firebaseAuth.currentUser) { host.innerHTML = ''; return; }
    try {
        var snap = await firebaseDB.collection('payoutRequests')
            .where('userId', '==', firebaseAuth.currentUser.uid).limit(20).get();
        var rows = [];
        snap.forEach(function (d) { rows.push(Object.assign({ id: d.id }, d.data())); });
        if (!rows.length) { host.innerHTML = ''; return; }
        rows.sort(function (a, b) {
            var ta = a.requestedAt && a.requestedAt.toMillis ? a.requestedAt.toMillis() : 0;
            var tb = b.requestedAt && b.requestedAt.toMillis ? b.requestedAt.toMillis() : 0;
            return tb - ta;
        });
        payoutCache = rows;

        var html = '<div style="font-size:0.78rem;font-weight:800;color:#374151;margin-bottom:0.4rem;">Your withdrawal requests</div>';
        rows.forEach(function (p) {
            var badge = PAYOUT_BADGE[p.status] || PAYOUT_BADGE.pending;
            var when = p.requestedAt && p.requestedAt.toDate ? p.requestedAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
            var dest = p.method === 'momo' ? (p.details && (p.details.provider + ' ' + p.details.number)) : (p.details && (p.details.bankName + ' ' + p.details.number));
            html += '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:0.6rem 0.7rem;margin-bottom:0.45rem;background:#fff;">'
                 + '<div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center;flex-wrap:wrap;">'
                 + '<span style="font-weight:800;font-size:0.88rem;">' + payoutMoney(p.amount) + '</span>'
                 + '<span style="' + badge[1] + 'padding:0.15rem 0.5rem;border-radius:999px;font-size:0.68rem;font-weight:800;">' + badge[0] + '</span>'
                 + '</div>'
                 + '<div style="font-size:0.75rem;color:#5a6572;margin-top:0.2rem;">' + payoutEscape(dest || '') + (when ? ' • ' + when : '') + (p.reference ? ' • ' + payoutEscape(p.reference) : '') + '</div>'
                 + (p.rejectionReason ? '<div style="font-size:0.74rem;color:#991b1b;margin-top:0.25rem;">' + payoutEscape(p.rejectionReason) + '</div>' : '')
                 + (p.status === 'pending' ? '<button type="button" onclick="cancelMyPayout(\'' + p.id + '\')" style="margin-top:0.45rem;background:#fff;border:1.5px solid #e5e7eb;color:#4b5563;border-radius:8px;padding:0.4rem 0.7rem;font-weight:700;font-size:0.74rem;cursor:pointer;">Cancel request</button>' : '')
                 + '</div>';
        });
        host.innerHTML = html;
    } catch (e) {
        console.warn('could not load payout requests', e);
        host.innerHTML = '<div style="font-size:0.76rem;color:#5a6572;">Could not load your withdrawal history right now.</div>';
    }
}

window.submitPayoutRequest = submitPayoutRequest;
window.cancelMyPayout = cancelMyPayout;
window.loadMyPayouts = loadMyPayouts;
window.payoutPreset = payoutPreset;
window.payoutMax = payoutMax;
window.payoutMethodChanged = payoutMethodChanged;

/* ===== GLOBAL BRIDGE (auto-generated) — DO NOT DELETE ===== */
/* This file is served as a bundled “classic” <script>, so every top-level
   function must stay reachable on window. Without this, the bundler deletes
   functions that are only called from HTML like onclick="callSeller()", and
   short minified names can overwrite each other between bundles. */
window.initWallet = initWallet;
window.loadMyPayouts = loadMyPayouts;
window.startWalletListener = startWalletListener;
window.fallbackWalletGet = fallbackWalletGet;
window.createWalletIfMissing = createWalletIfMissing;
window.directCreateWalletDoc = directCreateWalletDoc;
window.startTxListener = startTxListener;
window.fallbackTxGet = fallbackTxGet;
window.renderTxSnap = renderTxSnap;
window.escWallet = escWallet;
window.initTopupChips = initTopupChips;
window.startTopup = startTopup;
window.payOrderWithWallet = payOrderWithWallet;

