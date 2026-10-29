/* Homepage-only fast auth bootstrap. Starts before the 269KB app bundle.
   No public HTML or cache ever contains private prediction/report rows.
   The only Pro authorization is Supabase's has_active_pro_access RPC. */
(() => {
  'use strict';
  const cards=document.getElementById('jcLiveCards');
  if(!cards || !window.qcSupabase) return;
  const sdk=window.qcSupabase;
  // iOS / Android WebViews can hold auth.getSession() behind the SDK's
  // token-refresh lock even after INITIAL_SESSION has fired. Accept the
  // SDK's own session event instead of waiting for an unnecessary timeout.
  let resolveInitialEvent=null;
  let signedOut=false;
  const eventSession=new Promise(resolve=>{resolveInitialEvent=resolve;});
  sdk.auth.onAuthStateChange((event,session)=>{
    // Never call or await SDK auth methods inside this callback.
    if(event==='SIGNED_OUT') signedOut=true;
    if(resolveInitialEvent &&
       ['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED','SIGNED_OUT'].includes(event)){
      resolveInitialEvent({data:{session:session||null},error:null});
      resolveInitialEvent=null;
    }
  });
  const timed=async (promise,ms)=>{
    let timer;
    try {
      return await Promise.race([
        Promise.resolve(promise).then(value=>({value,timeout:false})),
        new Promise(resolve=>{timer=setTimeout(()=>resolve({timeout:true}),ms);})
      ]);
    } finally {clearTimeout(timer);}
  };
  // This exact SDK call is reused across homepage and app. No competing
  // getSession() is introduced, even when an embedded WebView is slow.
  window.qcHomeEarlySession=Promise.race([
    Promise.resolve().then(()=>sdk.auth.getSession())
      .catch(error=>({data:{session:null},error})),
    eventSession
  ]);

  window.qcHomeEarlyAccessPromise=(async()=>{
    const checked=await timed(window.qcHomeEarlySession,2500);
    if(signedOut) return {loggedIn:false,isPro:false};
    if(checked.timeout || checked.value?.error)
      return {loggedIn:false,isPro:false,verificationPending:true};
    const session=checked.value?.data?.session||null;
    if(!session) return {loggedIn:false,isPro:false};
    const identity=session.user?.id||null;
    const verified=await timed(sdk.rpc('has_active_pro_access'),2500);
    if(signedOut) return {loggedIn:false,isPro:false};
    if(verified.timeout || verified.value?.error)
      return {loggedIn:true,isPro:false,userId:identity,verificationPending:true};
    return {loggedIn:true,isPro:verified.value?.data===true,userId:identity};
  })().catch(error=>{
    console.warn('首页提前会员验证失败',error);
    return {loggedIn:false,isPro:false,verificationPending:true};
  });

  // Paint the verdict without waiting for the app bundle, public schedules,
  // full crest catalog or yesterday's already-rendered archive.
  window.qcHomeEarlyAccessPromise.then(access=>{
    if(signedOut || cards.dataset.qcAuthPaintReady==='1')return;
    const meta=document.getElementById('jcPredictionMeta');
    let handoff=0;
    try{handoff=Number(sessionStorage.getItem('qc-auth-handoff')||0);}catch(_){}
    if(!access.loggedIn && handoff>0 && Date.now()-handoff<12000)return;
    if(access.verificationPending){
      if(meta)meta.textContent='会员状态暂时无法验证';
      cards.innerHTML='<div class="profile-card" role="status">会员状态暂时无法验证，请检查网络后重试。 <button type="button" id="qcRetryMemberStatus" class="btn btn-outline">重新验证</button></div>';
      const button=cards.querySelector('#qcRetryMemberStatus');
      if(button)button.onclick=()=>cards.__qcRetryMemberAccess?.();
      return;
    }
    if(access.isPro){
      if(meta)meta.textContent='会员已验证';
      cards.innerHTML='<div class="profile-card" role="status">会员已验证，正在载入今日赛事…</div>';
      return;
    }
    if(meta)meta.textContent='';
    if(access.loggedIn){
      cards.innerHTML='<div class="qc-premium-gate"><div class="qc-premium-lock" aria-hidden="true">🔒</div><h3>订阅后查看今日预测</h3><p>当前账号尚无有效会员权限。</p><a class="qc-premium-primary" href="profile.html">查看会员服务</a></div>';
    } else {
      window.qcOverviewKnownGuestFirstPaint=true;
      cards.innerHTML='<div class="qc-premium-gate"><div class="qc-premium-lock" aria-hidden="true">🔒</div><h3>登录后查看今日预测</h3><p>请登录后查看今日预测。</p><a class="qc-premium-primary" href="login.html?v=20261029authhandoff5&amp;next='+encodeURIComponent(location.pathname+location.search)+'">立即登录</a></div>';
    }
  }).catch(()=>{});
})();