/* ============================================================================
   SANKOFA MARKET — SHOP ANALYTICS (Silver+ premium perk)
   Aggregates numbers the seller can already read anyway (their own listings,
   their own conversations, offers and orders, the public follow/rating mirrors)
   into one clean page. The tier gate is the convenience: below Silver the page
   shows the upsell panel instead.
   ============================================================================ */

(function () {
  'use strict';

  var anxUid = null;
  var anxTier = null;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function ghs(n) { return 'GHS ' + Number(n || 0).toLocaleString(); }
  function ts(d) {
    if (!d) return null;
    if (d.toDate) return d.toDate();
    var t = new Date(d);
    return isNaN(t.getTime()) ? null : t;
  }
  function thisMonthStart() {
    var n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
  }

  // Wait for firebase (config script assigns firebaseDB / firebaseAuth)
  function whenFirebase(cb, tries) {
    tries = tries || 0;
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof firebase !== 'undefined' && firebase.auth) return cb();
    if (tries > 30) { showFatal('Could not start. Please refresh.'); return; }
    setTimeout(function () { whenFirebase(cb, tries + 1); }, 400);
  }
  function showFatal(msg) {
    var l = document.getElementById('anxLoading');
    if (l) l.innerHTML = '<div class="anx-empty"><i class="fas fa-exclamation-triangle"></i>' + esc(msg) + '</div>';
  }

  whenFirebase(function () {
    firebase.auth().onAuthStateChanged(async function (user) {
      if (!user) {
        // flaky networks flash a transient "signed-out" during token refresh
        await new Promise(function (r) { setTimeout(r, 3000); });
        if (firebase.auth().currentUser) return;
        window.location.href = '../auth/login.html?redirect=' + encodeURIComponent('analytics.html');
        return;
      }
      anxUid = user.uid;
      try {
        var d = await firebaseDB.collection('users').doc(anxUid).get();
        var u = d.exists ? (d.data() || {}) : {};
        var exp = u.premiumExpiry && u.premiumExpiry.toDate ? u.premiumExpiry.toDate() : null;
        var active = u.isPremium === true && exp && exp > new Date();
        var t = String(u.premiumTier || u.sellerTier || '').toLowerCase();
        anxTier = (active && ['silver', 'gold', 'diamond'].indexOf(t) !== -1) ? t : null;
      } catch (e) { anxTier = null; }

      if (!anxTier) {
        document.getElementById('anxLoading').style.display = 'none';
        document.getElementById('anxGate').style.display = '';
        var btn = document.getElementById('anxRefresh');
        if (btn) btn.style.display = 'none';
        return;
      }
      loadAnalytics();
    });
  });

  async function loadAnalytics(manual) {
    var loading = document.getElementById('anxLoading');
    var body = document.getElementById('anxBody');
    var gate = document.getElementById('anxGate');
    if (!anxTier) return;
    if (gate) gate.style.display = 'none';
    if (loading) loading.style.display = '';
    if (body) body.style.display = 'none';
    try {
      var me = anxUid;
      var qs = await Promise.all([
        firebaseDB.collection('products').where('sellerId', '==', me).get(),
        firebaseDB.collection('conversations').where('participants', 'array-contains', me).get(),
        firebaseDB.collection('offers').where('sellerId', '==', me).get(),
        firebaseDB.collection('orders').where('sellerId', '==', me).get(),
        firebaseDB.collection('sellerFollowStats').doc(me).get().catch(function () { return { exists: false }; }),
        firebaseDB.collection('sellerRatings').doc(me).get().catch(function () { return { exists: false }; })
      ]);
      var products = qs[0].docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
      var convs = qs[1].docs.map(function (d) { return d.data(); });
      var offers = qs[2].docs.map(function (d) { return d.data(); });
      var orders = qs[3].docs.map(function (d) { return d.data(); });
      var followers = qs[4] && qs[4].exists ? (qs[4].data().followers || 0) : 0;
      var rating = qs[5] && qs[5].exists ? { avg: qs[5].data().avg || 0, count: qs[5].data().count || 0 } : { avg: 0, count: 0 };
      renderStats(products, convs, offers, orders, followers, rating);
      if (loading) loading.style.display = 'none';
      if (body) body.style.display = '';
    } catch (e) {
      console.error('analytics failed', e);
      showFatal('Could not load your numbers: ' + (e && e.message ? e.message : e));
    }
  }
  window.loadAnalytics = loadAnalytics;

  function renderStats(products, convs, offers, orders, followers, rating) {
    var myIds = {};
    products.forEach(function (p) { myIds[p.id] = true; });

    var views = 0;
    products.forEach(function (p) { views += Number(p.views || 0); });

    var itemConvs = convs.filter(function (c) { return c.productId && myIds[c.productId]; });
    var paid = orders.filter(function (o) {
      return ['paid', 'delivered', 'completed'].indexOf(o.status) !== -1 || o.paymentStatus === 'paid';
    });
    var revenue = paid.reduce(function (s, o) { return s + Number(o.total || o.amount || 0); }, 0);
    var pending = orders.length - paid.length;

    var mStart = thisMonthStart();
    var mChats = itemConvs.filter(function (c) { var t = ts(c.createdAt) || ts(c.lastMessageAt); return t && t >= mStart; }).length;
    var mPaid = paid.filter(function (o) { var t = ts(o.createdAt); return t && t >= mStart; }).length;
    var mRev = paid.reduce(function (s, o) { var t = ts(o.createdAt); return (t && t >= mStart) ? s + Number(o.total || o.amount || 0) : s; }, 0);

    // headline cards
    document.getElementById('anxCards').innerHTML =
      card('anx-blue', 'fa-eye', views.toLocaleString(), 'Listing views', products.length + ' listing' + (products.length === 1 ? '' : 's')) +
      card('anx-gold', 'fa-comments', itemConvs.length, 'Chats about your items', 'buyers who reached out') +
      card('anx-purple', 'fa-bolt', offers.length, 'Bargain offers set', offers.filter(function (o) { return o.status === 'paid'; }).length + ' ended in a sale') +
      card('anx-green', 'fa-shopping-bag', paid.length, 'Paid orders', pending + ' still pending') +
      card('anx-red', 'fa-money-bill-wave', ghs(revenue), 'Total revenue', ghs(mRev) + ' this month') +
      card('anx-slate', 'fa-users', followers, 'Followers', rating.count ? '★ ' + (Math.round(rating.avg * 10) / 10) + ' from ' + rating.count + ' reviews' : 'no reviews yet');

    // funnel: views → chats → orders
    var cRate = views ? Math.round((itemConvs.length / views) * 100) : 0;
    var oRate = views ? Math.round((paid.length / views) * 100) : 0;
    var coRate = itemConvs.length ? Math.round((paid.length / itemConvs.length) * 100) : 0;
    document.getElementById('anxFunnel').innerHTML =
      fstep('#0064d2', 100, views.toLocaleString(), 'views') +
      '<div class="anx-farrow">→</div>' +
      fstep('#c9930a', Math.min(100, Math.max(cRate, 4)), itemConvs.length + ' <small>(' + cRate + '%)</small>', 'started a chat') +
      '<div class="anx-farrow">→</div>' +
      fstep('#0e9f6e', Math.min(100, Math.max(oRate, 4)), paid.length + ' <small>(' + oRate + '%)</small>', 'paid you') +
      '<div class="anx-farrow">→</div>' +
      fstep('#7c3aed', 100, esc(ghs(revenue)), 'earned · ' + coRate + '% of chats paid');

    // this month
    document.getElementById('anxMonth').innerHTML =
      mchip(mChats, mChats === 1 ? 'new chat this month' : 'new chats this month') +
      mchip(mPaid, mPaid === 1 ? 'paid order this month' : 'paid orders this month') +
      mchip(ghs(mRev), 'revenue this month');

    // a simple, honest tip from the numbers
    var tip = '';
    var seen = products.filter(function (p) { return Number(p.views || 0) > 0; });
    var noChat = seen.filter(function (p) {
      return !itemConvs.some(function (c) { return c.productId === p.id; });
    }).sort(function (a, b) { return Number(b.views || 0) - Number(a.views || 0); })[0];
    if (noChat) {
      tip = '💡 <b>"' + esc(noChat.title || 'One listing') + '"</b> gets views (' + Number(noChat.views || 0) + ') but no chats yet — a sharper first photo or a small price move usually unlocks them. Try a 📣 broadcast about it!';
    } else if (products.length && itemConvs.length === 0) {
      tip = '💡 No chats yet. Premium sellers reach their followers directly — one 📣 broadcast a month wakes buyers up.';
    }
    var tipEl = document.getElementById('anxTip');
    if (tip && tipEl) { tipEl.innerHTML = tip; tipEl.style.display = ''; }

    // per-listing table
    var box = document.getElementById('anxProducts');
    if (!products.length) {
      box.innerHTML = '<div class="anx-empty"><i class="fas fa-box-open"></i>No listings yet. <a href="/publish.html" style="color:#0064d2;font-weight:700;">Post your first item</a> and watch this page come alive.</div>';
    } else {
      products.sort(function (a, b) { return Number(b.views || 0) - Number(a.views || 0); });
      box.innerHTML = products.map(function (p) {
        var img = (p.images && p.images[0]) || (p.photos && p.photos[0]) || '/images/placeholders/product.svg';
        var pChats = itemConvs.filter(function (c) { return c.productId === p.id; }).length;
        var pOffers = offers.filter(function (o) { return o.productId === p.id; });
        var pPaidOffers = pOffers.filter(function (o) { return o.status === 'paid'; }).length;
        var cc = Number(p.commentCount || 0);
        var st = p.isSold ? ['sold', 'Sold'] : (p.isActive === false ? ['off', 'Inactive'] : ['live', 'Live']);
        return '<div class="anx-prow">' +
          '<img class="anx-pimg" src="' + esc(img) + '" alt="" loading="lazy" onerror="this.src=\'/images/placeholders/product.svg\'">' +
          '<div class="anx-pinfo">' +
            '<div class="anx-ptitle">' + esc(p.title || 'Untitled') + '</div>' +
            '<div class="anx-pprice">' + esc(ghs(p.price)) + ' · <span class="anx-status ' + st[0] + '">' + st[1] + '</span></div>' +
          '</div>' +
          '<div class="anx-pstats">' +
            '<span title="views"><i class="fas fa-eye"></i>' + Number(p.views || 0).toLocaleString() + '</span>' +
            '<span title="chats"><i class="fas fa-comments"></i>' + pChats + '</span>' +
            '<span title="bargains"><i class="fas fa-bolt"></i>' + pOffers.length + (pPaidOffers ? ' (' + pPaidOffers + ' paid)' : '') + '</span>' +
            '<span title="Q&A comments"><i class="fas fa-question-circle"></i>' + cc + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  function card(cls, icon, num, label, sub) {
    return '<div class="anx-card ' + cls + '"><i class="fas ' + icon + '"></i>' +
      '<div class="anx-num">' + num + '</div><div class="anx-lab">' + esc(label) + '</div>' +
      '<div class="anx-sub">' + esc(sub || '') + '</div></div>';
  }
  function fstep(color, pct, num, lab) {
    return '<div class="anx-fstep"><div class="anx-fbar"><span style="width:' + pct + '%;background:' + color + ';"></span></div>' +
      '<div class="anx-fnum">' + num + '</div><div class="anx-flab">' + esc(lab) + '</div></div>';
  }
  function mchip(num, lab) {
    return '<div class="anx-mchip"><b>' + num + '</b>' + esc(lab) + '</div>';
  }
})();
