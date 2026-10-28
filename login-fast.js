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

  // Native Auth fetch is abortable. A timeout must stop the request instead
  // of unlocking a form while a hidden SDK password request is still running.
  async function authenticate(email,password){
    if(!loginClient || !window.QC_SUPABASE_URL || !window.QC_SUPABASE_PUBLISHABLE_KEY)
      return {error:{code:'AUTH_UNAVAILABLE'}};
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    let payload={},status=0;
    try{
      const response=await fetch(window.QC_SUPABASE_URL+'/auth/v1/token?grant_type=password',{
        method:'POST',mode:'cors',cache:'no-store',signal:controller.signal,
        headers:{'Content-Type':'application/json','apikey':window.QC_SUPABASE_PUBLISHABLE_KEY},
        body:JSON.stringify({email,password})
      });
      status=response.status;
      try{payload=await response.json();}catch(_){}
      if(!response.ok)return {error:{
        code:String(payload?.code||payload?.error_code||'AUTH_FAILED'),
        message:String(payload?.message||payload?.error_description||payload?.error||''),
        status
      }};
      if(!payload.access_token || !payload.refresh_token)
        return {error:{code:'AUTH_INVALID_RESPONSE'}};
    }catch(error){
      return {error:{code:error?.name==='AbortError'?'AUTH_NETWORK_TIMEOUT':'AUTH_NETWORK',
        message:String(error?.message||''),status:0}};
    }finally{
      clearTimeout(timeout);
    }

    // setSession writes to the same protected storage used across the site.
    // Do not replace Supabase storage with an unaudited custom token cache.
    let gate;
    let timer;
    try{
      gate=await Promise.race([
        loginClient.auth.setSession({
          access_token:payload.access_token,
          refresh_token:payload.refresh_token
        }),
        new Promise(resolve=>{
          timer=setTimeout(()=>resolve({error:{code:'AUTH_SESSION_TIMEOUT'}}),7000);
        })
      ]);
    }catch(error){
      gate={error:{code:'AUTH_SESSION_ERROR',message:String(error?.message||'')}};
    }finally{clearTimeout(timer);}
    if(gate?.error)return {error:gate.error};
    if(!gate?.data?.session?.user)return {error:{code:'AUTH_NO_SESSION'}};
    return {user:gate.data.session.user};
  }
  const errorText=error=>{
    const code=String(error?.code||''),message=String(error?.message||'');
    if(/invalid_credentials|invalid login credentials/i.test(code+' '+message))return '邮箱或密码错误';
    if(/email_not_confirmed|email not confirmed/i.test(code+' '+message))return '邮箱尚未完成验证';
    if(/too_many|rate|over_request_rate_limit/i.test(code+' '+message))return '登录请求过于频繁，请稍后再试';
    if(code==='AUTH_NETWORK_TIMEOUT')return '账号服务连接超时，建议切换网络或使用系统浏览器重试。';
    if(code==='AUTH_SESSION_TIMEOUT')return '账号已通过验证，但登录状态同步较慢，请返回首页查看后再决定是否重试。';
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
      const result=await authenticate(email,password);
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
