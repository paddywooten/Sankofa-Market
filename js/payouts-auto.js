/* Automatic Mobile Money payouts: the admin card (Tier 5, option 7).
   Switched OFF by default. Nothing is sent unless an admin turns the switch on. */
(function () {
  'use strict';
  function fn(name) { return firebase.functions().httpsCallable(name); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return 'GHS ' + Number(n || 0).toFixed(2); }
  function flash(msg, type) { if (typeof showFlashMessage === 'function') showFlashMessage(msg, type || 'info'); }
  function setResult(html) { var el = document.getElementById('autoPayResult'); if (el) el.innerHTML = html; }
  function setSwitch(on) {
    var st = document.getElementById('autoPayStatus');
    var btn = document.getElementById('autoPayToggle');
    if (st) st.innerHTML = on
      ? '<span style="color:#15803d;">● ON: Mobile Money withdrawals can be sent automatically</span>'
      : '<span style="color:#b91c1c;">● OFF: nothing is sent automatically</span>';
    if (btn) { btn.dataset.on = on ? '1' : '0'; btn.textContent = on ? 'Turn off' : 'Turn on…'; }
  }
  function refresh() {
    return fn('previewAutoPayouts')({}).then(function (r) { setSwitch(r.data.enabled === true); return r.data; })
      .catch(function (e) { setResult('<span style="color:#b91c1c;">Could not load the payout status: ' + esc(e.message) + '</span>'); });
  }
  window.autoPayRefresh = refresh;

  window.autoPayToggle = function () {
    var btn = document.getElementById('autoPayToggle');
    var on = !!(btn && btn.dataset.on === '1');
    var msg = on
      ? 'Turn automatic payouts OFF?\n\nNothing will be sent automatically until you turn them on again.'
      : 'Turn automatic payouts ON?\n\nWithdrawals will be sent through Paystack: at most 20 at a time and GHS 5,000 in total. The daily run at 10:00 also uses this switch.\n\nMake sure Paystack transfers are switched on for the account first.';
    if (!confirm(msg)) return;
    fn('setAutoPayEnabled')({ on: !on }).then(function (r) {
      setSwitch(r.data.enabled === true);
      flash(r.data.enabled ? 'Automatic payouts are ON' : 'Automatic payouts are OFF', 'success');
    }).catch(function (e) { flash('Could not change the switch: ' + e.message, 'error'); });
  };

  window.autoPayPreview = function () {
    setResult('Checking…');
    return fn('previewAutoPayouts')({}).then(function (r) {
      var d = r.data;
      setSwitch(d.enabled === true);
      var rows = (d.send || []).map(function (p) {
        return '<tr><td style="padding:0.3rem 0.4rem;">' + esc(p.name) + '</td><td style="padding:0.3rem 0.4rem;">' +
          esc(p.provider) + ' ' + esc(p.number) + '</td><td style="padding:0.3rem 0.4rem;text-align:right;">' + money(p.amount) + '</td></tr>';
      }).join('');
      var html = '<strong>A run would send ' + d.count + (d.count === 1 ? ' withdrawal' : ' withdrawals') + ', ' + money(d.total) +
        ' in total.</strong> Limit per run: ' + d.caps.count + ' withdrawals and GHS ' + d.caps.ghs + '.';
      if (rows) html += '<table style="width:100%;margin-top:0.5rem;font-size:0.84rem;border-collapse:collapse;"><tbody>' + rows + '</tbody></table>';
      if (d.skipped && d.skipped.length) html += '<div style="margin-top:0.5rem;color:#5a6572;">' + d.skipped.length + ' not sent (wrong number, unknown network, or over the limit). They stay pending for you.</div>';
      if (d.stuck && d.stuck.length) {
        html += '<div style="margin-top:0.6rem;color:#92400e;"><strong>Needs a check in Paystack first:</strong><ul style="margin:0.3rem 0 0 1.1rem;padding:0;">' +
          d.stuck.map(function (s) {
            var action = s.hasTransfer
              ? 'Paystack created this transfer. Wait for its result.'
              : '<button type="button" class="btn btn-outline btn-small" onclick="autoPayReturn(\'' + esc(s.id) + '\')">Return to pending</button> (only after you found no transfer in Paystack)';
            return '<li style="margin-bottom:0.3rem;">' + esc(s.id) + ' · ' + money(s.amount) + ' · ' + esc(s.error) + '<br>' + action + '</li>';
          }).join('') + '</ul></div>';
      }
      setResult(html);
    }).catch(function (e) { setResult('<span style="color:#b91c1c;">' + esc(e.message) + '</span>'); });
  };

  window.autoPayRunNow = function () {
    return fn('previewAutoPayouts')({}).then(function (r) {
      var d = r.data;
      if (!d.enabled) { flash('Turn automatic payouts on first.', 'error'); return; }
      if (!d.count) { flash('Nothing to send right now.', 'info'); return; }
      if (!confirm('Send ' + d.count + (d.count === 1 ? ' withdrawal' : ' withdrawals') + ' (' + money(d.total) + ') through Paystack now?\n\nThis moves real money.')) return;
      var btn = document.getElementById('autoPayRun');
      if (btn) btn.disabled = true;
      return fn('runAutoPayouts')({}).then(function (res) {
        var x = res.data;
        setResult('Sent ' + x.sent.length + ', failed ' + x.failed.length + ', needs a check ' + x.stuck.length + '.' +
          (x.stopped ? ' Stopped early: ' + esc(x.stopped) + '.' : ''));
        flash('Run finished: ' + x.sent.length + ' sent', 'success');
      }).catch(function (e) { flash('Run did not finish: ' + e.message, 'error'); })
        .then(function () { if (btn) btn.disabled = false; });
    }).catch(function (e) { flash(e.message, 'error'); });
  };

  window.autoPayReturn = function (id) {
    if (!confirm('Return withdrawal ' + id + ' to pending?\n\nOnly do this after you checked Paystack and found NO transfer for it.')) return;
    fn('returnStuckPayout')({ payoutId: id }).then(function () {
      flash('Returned to pending', 'success');
      refresh().then(function () { window.autoPayPreview(); });
    }).catch(function (e) { flash(e.message, 'error'); });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh);
  else refresh();
})();
