/* Lightweight login entrypoint: deliberately excludes the 284KB site app.js.
   Uses the existing Supabase client/session storage and server-side entitlements.
   This file never performs entitlement checks or exposes protected content. */
(() => {
  'use strict';
  const form=document.getElementById('loginForm');
  if(!form) return;
  const hint=document.getElementById('loginHint');
  const agreement=document.getElementById('loginAgreement');
  const remember=document.getElementById('loginAutoLogin');
  const passwordInput=document.getElementById('loginPassword');
  const submit=form.querySelector('button[type="submit"]');
  const loginClient=window.qcSupabase;

  const show=(message,kind='')=>{
    if(!hint) return;
    hint.textContent=message;
    hint.className='code-hint'+(kind?' '+kind:'');
  };
  const inApp=()=>/MicroMessenger|MQQBrowser|QQ\/|TBS\/|Weibo|FBAN|FBAV|Instagram|Line\/|Quark|UCBrowser/i.test(navigator.userAgent||'');
  const networkMessage=()=>inApp()
    ? '当前内置浏览器连接账号服务不稳定，请使用右上角菜单选择“在浏览器打开”，再用系统浏览器登录。'
    : '账号服务连接失败，请检查网络后重试。';
  const safeDestination=()=>{
    const raw=new URLSearchParams(location.search).get('next');
    if(!raw || raw.length>1024)return 'index.html';
    try{
      const u=new URL(raw,location.origin);
      if(u.origin!==location.origin)return 'index.html';
      if(u.pathname==='/'||u.pathname==='/index.html')return 'index.html'+u.search;
      if(!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.html$/.test(u.pathname))return 'index.html';
      return u.pathname.slice(1)+u.search;
    }catch(_){return 'index.html';}
  };
  const navigate=()=>{
    try{sessionStorage.setItem('qc-auth-handoff',String(Date.now()));}catch(_){}
    location.replace(safeDestination());
  };

  if(remember){
    remember.checked=Boolean(window.qcGetAutoLoginPreference?.());
    remember.addEventListener('change',()=>window.qcSetAutoLoginPreference?.(remember.checked));
  }
  if(agreement){
    try{agreement.checked=localStorage.getItem('qc-login-agreement-v1')==='1';}catch(_){}
    agreement.addEventListener('change',()=>{
      try{localStorage.setItem('qc-login-agreement-v1',agreement.checked?'1':'0');}catch(_){}
    });
  }
  if(new URLSearchParams(location.search).get('reset')==='success'){
    show('密码修改成功，请使用新密码重新登录。','success');
    try{history.replaceState({},'',location.pathname);}catch(_){}
  }
  else if(inApp()){
    show('当前是应用内浏览器；若登录连接超时，可通过右上角菜单选择“在浏览器打开”。');
  }
  form.addEventListener('invalid',event=>{
    if(event.target===agreement)show('请先勾选用户服务协议和隐私政策','error');
  },true);

  // Session recovery uses the SDK's INITIAL_SESSION event rather than a new
  // getSession() request on page load. This avoids a concurrent auth lock.
  if(window.qcGetAutoLoginPreference?.() && loginClient){
    loginClient.auth.onAuthStateChange((event,session)=>{
      if(!['INITIAL_SESSION','SIGNED_IN'].includes(event) || !session?.user)return;
      if(form.dataset.authSubmitting==='1' || passwordInput?.value ||
         form.contains(document.activeElement))return;
      setTimeout(()=>{
        if(form.dataset.authSubmitting!=='1' && !passwordInput?.value &&
           !form.contains(document.activeElement))navigate();
      },0);
    });
  }

  // A single SDK-native sign-in both validates the credentials and persists
  // the session. The previous token-fetch -> setSession path could perform an
  // additional remote user verification and misreport a successful login as a
  // 7-second session timeout on slow mobile networks.
  let loginAttemptId=0;
  async function authenticate(email,password,attemptId){
    if(!loginClient?.auth?.signInWithPassword)
      return {error:{code:'AUTH_UNAVAILABLE'}};
    const request=Promise.resolve()
      .then(()=>loginClient.auth.signInWithPassword({email,password}))
      .then(({data,error})=>{
        if(error)return {error:{
          code:String(error.code||error.name||'AUTH_FAILED'),
          message:String(error.message||''),
          status:Number(error.status||0)
        }};
        if(data?.session?.user)return {user:data.session.user};
        return {error:{code:'AUTH_NO_SESSION'}};
      },error=>({error:{
        code:'AUTH_NETWORK',message:String(error?.message||''),status:0
      }}));

    // This is a UI waiting budget, not an abort: a late successful response
    // must still be accepted and navigate rather than drop the user's session.
    let timer;
    const pending=new Promise(resolve=>{
      timer=setTimeout(()=>resolve({pending:true}),18000);
    });
    const first=await Promise.race([request,pending]);
    clearTimeout(timer);
    if(!first?.pending)return first;
    request.then(late=>{
      if(late?.user && loginAttemptId===attemptId && form.isConnected){
        show('登录验证成功，正在进入网站…','success');
        navigate();
      }
    }).catch(()=>{});
    return {error:{code:'AUTH_PENDING_SLOW'}};
  }
  const errorText=error=>{
    const code=String(error?.code||''),message=String(error?.message||'');
    if(/invalid_credentials|invalid login credentials/i.test(code+' '+message))return '邮箱或密码错误';
    if(/email_not_confirmed|email not confirmed/i.test(code+' '+message))return '邮箱尚未完成验证';
    if(/too_many|rate|over_request_rate_limit/i.test(code+' '+message))return '登录请求过于频繁，请稍后再试';
    if(code==='AUTH_NETWORK_TIMEOUT')return inApp()
      ? '当前内置浏览器未能连接账号服务。请点右上角“…”选择“在浏览器打开”，用系统浏览器重新登录。'
      : '账号服务连接超时，请检查 Wi-Fi / 移动网络后重试。';
    if(code==='AUTH_PENDING_SLOW')return '账号服务响应较慢，验证仍在等待。如果稍后成功会自动进入网站；请先检查网络，避免连续点击。';
    if(Number(error?.status)>=500)return '账号服务暂时繁忙，请稍后重试；无需修改密码。';
    if(/AuthRetryableFetchError|NetworkError|Failed to fetch|Load failed|fetch failed|abort|timeout/i.test(code+' '+message))return networkMessage();
    if(/AUTH_NETWORK|AUTH_UNAVAILABLE|AUTH_INVALID_RESPONSE|AUTH_SESSION_ERROR|AUTH_NO_SESSION/.test(code))
      return networkMessage();
    return '登录失败，请稍后重试';
  };

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(form.dataset.authSubmitting==='1')return;
    const email=document.getElementById('loginEmail')?.value?.trim()||'';
    const password=passwordInput?.value||'';
    if(!email||!password||!agreement?.checked)return;
    form.dataset.authSubmitting='1';
    submit.disabled=true;
    submit.textContent='验证账号中…';
    show('正在验证账号，请勿重复点击。');
    window.qcSetAutoLoginPreference?.(Boolean(remember?.checked));
    try{
      const attemptId=++loginAttemptId;
      const slowNotice=setTimeout(()=>{
        if(form.dataset.authSubmitting==='1')
          show('账号服务响应较慢，正在安全验证，请勿重复提交。');
      },6000);
      let result;
      try{result=await authenticate(email,password,attemptId);}
      finally{clearTimeout(slowNotice);}
      if(result.error){show(errorText(result.error),'error');return;}
      show('登录成功，正在进入网站…','success');
      // Existing audit is noncritical: do not hold up the navigation on it.
      try{
        await Promise.race([
          loginClient.rpc('record_user_login'),
          new Promise(resolve=>setTimeout(resolve,250))
        ]);
      }catch(_){}
      navigate();
    }catch(error){
      show(networkMessage(),'error');
    }finally{
      delete form.dataset.authSubmitting;
      submit.disabled=false;
      submit.textContent='登录';
    }
  });
})();
