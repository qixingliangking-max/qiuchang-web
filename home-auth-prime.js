/* Homepage auth first paint: one shared SDK session and one server Pro check.
   This script runs BEFORE the large application bundle. It changes only the
   neutral login/status placeholder; protected prediction rows are never
   fetched or inserted here. app.js adopts this SAME verified result. */
(()=>{
  'use strict';
  const cards=document.getElementById('jcLiveCards');
  const client=window.qcSupabase;
  if(!cards || !client) return;

  let signedOut=false;
  client.auth.onAuthStateChange(event=>{
    if(event==='SIGNED_OUT'){
      signedOut=true;
      window.qcHomeEarlyAccess=null;
    }
  });
  function deadline(work,ms){
    let timer;
    return Promise.race([
      Promise.resolve(work).then(value=>({timeout:false,value})),
      new Promise(resolve=>{
        timer=setTimeout(()=>resolve({timeout:true,value:null}),ms);
      })
    ]).finally(()=>clearTimeout(timer));
  }
  const pending=(loggedIn=false,userId=null)=>({
    loggedIn,isPro:false,userId,verificationPending:true
  });
  // Use exactly one SDK read, adopted by app.js (never start a second SDK
  // getSession while WebView token refresh may hold the SDK auth lock).
  window.qcHomeEarlySession=Promise.resolve()
    .then(()=>client.auth.getSession())
    .catch(error=>({data:{session:null},error}));

  window.qcHomeEarlyAccess=(async()=>{
    const first=await deadline(window.qcHomeEarlySession,4000);
    if(signedOut) return {loggedIn:false,isPro:false,userId:null};
    if(first.timeout || first.value?.error) return pending();
    const session=first.value?.data?.session||null;
    if(!session?.user?.id) return {loggedIn:false,isPro:false,userId:null};
    const userId=session.user.id;
    try{
      const checked=await deadline(client.rpc('has_active_pro_access'),4500);
      if(signedOut) return {loggedIn:false,isPro:false,userId:null};
      if(checked.timeout || checked.value?.error) return pending(true,userId);
      return {loggedIn:true,isPro:checked.value?.data===true,userId};
    }catch(_){
      return signedOut
        ? {loggedIn:false,isPro:false,userId:null}
        : pending(true,userId);
    }
  })();

  // Paint the auth outcome immediately, before app.js and the rest of the
  // deferred scripts complete. Never display Pro fixtures from this script.
  window.qcHomeEarlyAccess.then(state=>{
    if(signedOut || cards.dataset.qcAuthPaintReady==='1') return;
    const current=String(cards.textContent||'');
    if(!current.includes('正在确认登录状态')) return;
    const meta=document.getElementById('jcPredictionMeta');
    if(state.verificationPending){
      if(meta) meta.textContent='会员状态暂时无法验证';
      cards.innerHTML='<div class="profile-card" role="status">'+
        '会员状态暂时无法验证，请检查网络后重试。 '+
        '<button type="button" id="qcRetryMemberStatus" class="btn btn-outline">重新验证</button></div>';
      const retry=cards.querySelector('#qcRetryMemberStatus');
      if(retry) retry.onclick=()=>cards.__qcRetryMemberAccess?.();
    }else if(state.isPro && state.loggedIn){
      if(meta) meta.textContent='会员已验证';
      cards.innerHTML='<div class="profile-card" role="status">会员已验证，正在载入今日赛事…</div>';
    }else if(state.loggedIn){
      if(meta) meta.textContent='已登录';
      cards.innerHTML='<div class="profile-card" role="status">已登录，正在载入账户状态…</div>';
    }else{
      if(meta) meta.textContent='';
      const next=encodeURIComponent(location.pathname+location.search);
      cards.innerHTML='<div class="qc-premium-gate">'+
        '<div class="qc-premium-lock" aria-hidden="true">🔒</div>'+
        '<h3>登录后查看今日预测</h3>'+
        '<p>今日预测需要登录后查看。</p>'+
        '<a class="qc-premium-primary" href="login.html?v=20261029authhandoff5&amp;next='+next+'">立即登录</a>'+
        '</div>';
    }
  }).catch(error=>console.warn('首页会员首屏读取失败',error));
})();