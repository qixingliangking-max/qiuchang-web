/* Lightweight homepage auth: same two checks as September's original
   implementation. Member predictions remain server-protected. */
(()=>{
  'use strict';
  const cards=document.getElementById('jcLiveCards');
  const sdk=window.qcSupabase;
  if(!cards || !sdk) return;

  // One session read, followed by exactly one Pro entitlement RPC.
  // A single four-second total deadline prevents an indefinite neutral card.
  window.qcHomeEarlySession=Promise.resolve().then(()=>sdk.auth.getSession());
  const check=(async()=>{
    let knownUserId=null;
    try{
      const {data:sessionData,error:sessionError}=await window.qcHomeEarlySession;
      if(sessionError) throw sessionError;
      const session=sessionData?.session||null;
      if(!session) return {loggedIn:false,isPro:false};
      knownUserId=session.user?.id||null;
      const {data:isPro,error:proError}=await sdk.rpc('has_active_pro_access');
      if(proError) throw proError;
      return {loggedIn:true,isPro:isPro===true,userId:session.user?.id||null};
    }catch(error){
      console.warn('读取会员权限失败',error);
      return {loggedIn:Boolean(knownUserId),isPro:false,
        userId:knownUserId,verificationPending:true};
    }
  })();

  let timer;
  window.qcHomeEarlyAccessPromise=Promise.race([
    check,
    new Promise(resolve=>{
      timer=setTimeout(()=>resolve({
        loggedIn:false,isPro:false,verificationPending:true
      }),4000);
    })
  ]).finally(()=>clearTimeout(timer));

  // Show the result before the large app initializes. This never renders
  // protected predictions; those still require server-verified Pro access.
  window.qcHomeEarlyAccessPromise.then(access=>{
    if(cards.dataset.qcAuthPaintReady==='1') return;
    const meta=document.getElementById('jcPredictionMeta');
    if(access.verificationPending){
      if(meta) meta.textContent='会员状态暂时无法验证';
      cards.innerHTML='<div class="profile-card" role="status">'+
        '会员状态暂时无法验证，请重试。 '+
        '<button type="button" id="qcRetryMemberStatus" class="btn btn-outline">重新验证</button></div>';
      const retry=cards.querySelector('#qcRetryMemberStatus');
      if(retry)retry.onclick=()=>cards.__qcRetryMemberAccess?.();
    }else if(access.isPro){
      if(meta)meta.textContent='会员已验证';
      cards.innerHTML='<div class="profile-card" role="status">'+
        '会员已验证，正在显示今日预测…</div>';
    }else if(access.loggedIn){
      if(meta)meta.textContent='';
      cards.innerHTML='<div class="qc-premium-gate"><div class="qc-premium-lock" aria-hidden="true">🔒</div>'+
        '<h3>订阅后查看今日预测</h3><p>当前账号尚无有效会员权限。</p>'+
        '<a class="qc-premium-primary" href="profile.html">查看会员服务</a></div>';
    }else{
      if(meta)meta.textContent='';
      window.qcOverviewKnownGuestFirstPaint=true;
      cards.innerHTML='<div class="qc-premium-gate"><div class="qc-premium-lock" aria-hidden="true">🔒</div>'+
        '<h3>登录后查看今日预测</h3><p>请登录后查看今日预测。</p>'+
        '<a class="qc-premium-primary" href="login.html?v=20261029authhandoff5&amp;next='+
        encodeURIComponent(location.pathname+location.search)+'">立即登录</a></div>';
    }
  }).catch(error=>console.warn('首页会员提示更新失败',error));
})();
