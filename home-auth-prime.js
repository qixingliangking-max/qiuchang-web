/* Prime only the homepage's SDK session read before the large application bundle.
   This is NOT an authorization cache: membership still requires the current
   server-verified has_active_pro_access RPC, and protected rows stay gated. */
(() => {
  'use strict';
  if (!document.getElementById('jcLiveCards') || !window.qcSupabase) return;
  // Exactly one SDK read. app.js adopts this same promise, including errors,
  // instead of starting another getSession() under mobile WebView auth locks.
  window.qcHomeEarlySession = Promise.resolve()
    .then(() => window.qcSupabase.auth.getSession())
    .catch(error => ({data:{session:null},error}));
})();
