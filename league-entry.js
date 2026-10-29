/* Fast entry for league archive. No league/P2/P3 bundles or archive queries
   are loaded for guests or ordinary accounts. Supabase RLS remains authoritative. */
(()=>{
  'use strict';
  const root=document.getElementById('leagueRecordRoot');
  const sdk=window.qcSupabase;
  if(!root) return;
  const $=s=>document.querySelector(s);
  const leagueLinks=[...document.querySelectorAll('[data-qc-member-nav="league"]')];
  let epoch=0, activeUser=null, started=false, authorized=false;
  let scriptsPromise=null;
  window.qcLeagueGateManaged=true;
  window.qcLeagueVerifiedAccess=()=>authorized;
  // Invalidate a previous directory read when auth identity changes.
  window.qcLeagueGateEpoch=()=>epoch;

  const loginUrl='login.html?v=20261029authhandoff5&next='+encodeURIComponent('league.html');
  const gate=(title,desc,button,label)=>'<div class="qc-league-gate" role="status">'+
    '<h2>'+title+'</h2><p>'+desc+'</p>'+
    (button?'<a href="'+button+'">'+label+'</a>':'')+'</div>';

  function display(session){
    const loggedIn=Boolean(session?.user);
    for(const link of leagueLinks){
      link.hidden=!loggedIn;
      link.style.display=loggedIn?'':'none';
    }
    for(const [sel,show] of [
      ['#navLogin',!loggedIn],['#navProfile',loggedIn],
      ['#navLogout',loggedIn],['#desktopLogin',!loggedIn],
      ['#desktopAccount',loggedIn],['#desktopLogout',loggedIn]
    ]){
      const el=$(sel);
      if(!el) continue;
      el.hidden=!show;
      el.style.display=show?'':'none';
    }
  }

  // This page cannot rely on the heavy app bundle just to open the menu.
  const btn=$('#menuBtn'),backdrop=$('#drawerBackdrop');
  if(btn&&backdrop){
    btn.onclick=()=>backdrop.classList.add('open');
    backdrop.onclick=e=>{if(e.target===backdrop)backdrop.classList.remove('open');};
  }

  async function loadScript(src){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.onload=resolve;
      script.onerror=()=>reject(new Error('无法加载联赛数据模块'));
      document.body.appendChild(script);
    });
  }
  function beginLeagueModules(){
    if(!scriptsPromise){
      // P3 only defines UI helpers; actual P3 data remains on-demand.
      scriptsPromise=loadScript('league-p3-public.js?v=20261022p3single1')
        .then(()=>loadScript('league-archive-snapshot-v2.js?v=20261029authlazy2'));
    }
    return scriptsPromise;
  }

  async function authorize(session,token){
    root.innerHTML=gate('正在核验会员权限','正在安全确认联赛档案访问资格。');
    try{
      const {data,error}=await sdk.rpc('has_active_pro_access');
      if(token!==epoch) return;
      if(error) throw error;
      if(data!==true){
        root.innerHTML=gate('联赛档案｜Pro会员专享',
          '当前账号已登录。开通Pro会员后即可查看联赛与球队赛季统计。',
          'profile.html','查看会员服务');
        return;
      }
      authorized=true;
      root.innerHTML=gate('正在载入联赛目录','会员权限已确认，正在加载联赛数据。');
      await beginLeagueModules();
      if(token!==epoch || !authorized) return;
      // Explicitly start the archive for this authorization epoch. Reusing a
      // downloaded script without reinitialization left returning Pro users
      // stuck on the loading notice after an auth state transition.
      if(typeof window.qcLeagueArchiveStart!=='function')
        throw new Error('联赛目录入口未初始化');
      await window.qcLeagueArchiveStart(token);
    }catch(err){
      if(token!==epoch) return;
      console.warn('联赛档案权限/模块加载失败',err);
      authorized=false;
      root.innerHTML=gate('联赛档案暂时无法加载',
        '连接暂时异常，请刷新页面后重试。',null,null);
    }
  }
  function useSession(session){
    const id=session?.user?.id||null;
    if(started && activeUser===id){display(session);return;}
    started=true;
    const token=++epoch;
    activeUser=id;
    authorized=false;
    display(session);
    if(!id){
      root.innerHTML=gate('请先登录','登录后可查看联赛档案；未登录状态不会加载联赛数据库。',
        loginUrl,'立即登录');
      return;
    }
    authorize(session,token);
  }
  if(!sdk){
    display(null);
    root.innerHTML=gate('暂时无法确认登录状态',
      '账号服务未就绪，请稍后刷新。',loginUrl,'前往登录');
    return;
  }
  for(const sel of ['#navLogout','#desktopLogout']){
    const el=$(sel);
    if(!el) continue;
    el.onclick=async e=>{
      e.preventDefault();
      const token=++epoch;
      activeUser=null;authorized=false;
      display(null);
      root.innerHTML=gate('请先登录','已退出登录。',loginUrl,'立即登录');
      try{await sdk.auth.signOut();}catch(err){console.warn('退出登录失败',err);}
      if(token===epoch) location.href='index.html';
    };
  }

  // Session is a local SDK read in the normal case. A slow SDK lock must
  // not hold the visitor behind a spinner indefinitely. Late success updates
  // this same page in place without a duplicate auth call.
  let receivedEvent=false;
  sdk.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'){
      receivedEvent=true;
      useSession(null);
    }else if(event==='SIGNED_IN'){
      receivedEvent=true;
      useSession(session);
    }
  });
  const timer=setTimeout(()=>{
    if(started) return;
    root.innerHTML=gate('请先登录',
      '登录后可查看联赛档案。如已登录，正在继续确认账号状态。',
      loginUrl,'立即登录');
  },900);
  Promise.resolve().then(()=>sdk.auth.getSession()).then(({data,error})=>{
    clearTimeout(timer);
    if(receivedEvent) return;
    if(error) throw error;
    useSession(data?.session||null);
  }).catch(error=>{
    clearTimeout(timer);
    if(receivedEvent) return;
    console.warn('联赛档案读取登录会话失败',error);
    root.innerHTML=gate('登录状态暂时无法确认',
      '可先前往登录页，或稍后刷新重试。',loginUrl,'前往登录');
  });
})();
