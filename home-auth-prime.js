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

  // Once the server verified Pro, begin the *single-date* RLS-protected
  // FINAL snapshot immediately, while large app/static assets are loading.
  // Never fetch member predictions before verification. Never persist them.
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date()).map(item=>[item.type,item.value]));
  const calendarDay=parts.year+'-'+parts.month+'-'+parts.day;
  const requested=new URLSearchParams(location.search).get('date');
  const proDay=requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
    ? requested : calendarDay;
  window.qcHomeEarlyProDate=proDay;
  window.qcHomeEarlyProSnapshotPromise=window.qcHomeEarlyAccessPromise
    .then(async access=>{
      if(!access?.isPro) return null;
      const {data,error}=await sdk.from('jc_overview_prediction_snapshots')
        .select('business_date,payload,match_count,model_count,generated_at')
        .eq('business_date',proDay).limit(1);
      if(error) throw error;
      return (data||[])[0]||null;
    }).catch(error=>{
      console.warn('会员单日静态快照暂不可用，保留已有授权加载路径',error);
      return null;
    });


  // Render server-verified FINAL rows BEFORE app.js downloads or DOMContentLoaded.
  // This private HTML is built solely from the RLS-protected single-day response.
  // No model is written into public HTML, storage, URLs or a guest DOM.
  const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const firstModel=m=>(Array.isArray(m.jc_model_outputs)?m.jc_model_outputs:[])
    .find(x=>x?.stage==='FINAL'&&x?.is_locked===true&&x?.is_current===true);
  function compactDirection(value,m){
    const s=String(value||'').replace(/[｜|]\s*[ABC](?:[+-])?\s*$/i,'')
      .replace(/\s*(?:评级|等级|置信等级)\s*[：:]?\s*[ABC](?:[+-])?\s*$/i,'')
      .replace(/\s+/g,'').trim();
    const home=String(m.home_team_name||'').replace(/\s+/g,'');
    const away=String(m.away_team_name||'').replace(/\s+/g,'');
    const homeHit=home&&s.includes(home),awayHit=away&&s.includes(away);
    if(/分胜负|主胜.*客胜|客胜.*主胜/.test(s))return '胜/负';
    if(/主队?不败/.test(s)||(homeHit&&/不败/.test(s)))return '胜/平';
    if(/客队?不败/.test(s)||(awayHit&&/不败/.test(s)))return '平/负';
    if(s==='主胜'||(homeHit&&/胜/.test(s)))return '胜';
    if(s==='客胜'||(awayHit&&/胜/.test(s)))return '负';
    if(/^平局?$/.test(s))return '平';
    return s;
  }
  const htmlChoices=(items,stack=false)=>{
    const list=items.filter(Boolean);
    if(!list.length)return '<span class="jc-overview-pending">待生成</span>';
    return '<span class="'+(stack?'jc-choice-stack':'jc-choice-inline')+'">'+
      list.map((val,i)=>(i&&!stack?'<span class="jc-choice-sep">/</span>':'')+
        '<span class="'+(i?'jc-choice-secondary':'jc-choice-primary')+'">'+
          escape(val)+'</span>').join('')+'</span>';
  };
  function goalHtml(value){
    const s=String(value||'').trim(),range=s.match(/(\d+)\s*[—–-]\s*(\d+)\s*球?/);
    let vals=[];
    if(range&&Number(range[2])>=Number(range[1])&&Number(range[2])-Number(range[1])<=6){
      for(let n=Number(range[1]);n<=Number(range[2]);n++)vals.push(n+'球');
    }else vals=s.split(/[、,，｜|/\s]+/).filter(Boolean)
      .map(x=>/球$/.test(x)?x:x+'球');
    return vals.length?'<span class="jc-goal-choices">'+vals.map(x=>'<span>'+escape(x)+'</span>').join('')+'</span>'
      :'<span class="jc-overview-pending">待生成</span>';
  }
  function quickPredictionTable(record){
    const rows=record?.payload?.rows;
    const count=Number(record?.match_count||0);
    if(record?.business_date!==proDay || !Number.isInteger(count) ||
        count<1 || count>150 || Number(record?.model_count)!==count ||
        !Array.isArray(rows) || rows.length!==count ||
        new Set(rows.map(r=>String(r?.id||''))).size!==count ||
        !rows.every(r=>r?.id&&r.match_date&&r.home_team_name&&r.away_team_name&&
          r.business_date===proDay&&firstModel(r)))return null;
    const ordered=rows.slice().sort((a,b)=>String(a.match_num||'')
      .localeCompare(String(b.match_num||''),'zh-CN',{numeric:true}));
    const content=ordered.map(m=>{
      const model=firstModel(m);
      const hasHad=(m.jc_market_snapshots||[]).some(p=>p.pool_code==='had');
      const direction=hasHad?compactDirection(model.direction,m):
        String(model.direction||'').replace(/[＋+｜|]/g,'/');
      let picks=direction.split('/').map(x=>x.trim()).filter(Boolean);
      const single=hasHad?compactDirection(model.single_pick,m):String(model.single_pick||'').trim();
      const ix=picks.indexOf(single);
      if(ix>0)picks=[picks[ix],...picks.filter((_,i)=>i!==ix)];
      const two=[model.htft_top1,model.htft_top2].filter(Boolean);
      const full=String(m.raw?.sectionsNo999||'').trim().replace(':','-');
      const half=String(m.raw?.sectionsNo1||'').trim().replace(':','-');
      const isFinal=/(已结束|完赛|已完成|finished|final)/i.test(
        String(m.match_status||'')+' '+String(m.raw?.matchStatusName||'')) &&
        /^\d{1,2}-\d{1,2}$/.test(full)&&/^\d{1,2}-\d{1,2}$/.test(half);
      const team=n=>escape(Array.from(String(n||'—')).slice(0,5).join(''));
      const no=String(m.match_num||'—').replace(/^周[一二三四五六日天]/,'');
      const link='jc-match.html?id='+encodeURIComponent(m.id);
      return '<tr class="jc-overview-row" data-match-id="'+escape(m.id)+'" data-href="'+link+'"'+
        ' data-qc-match-date="'+escape(m.match_date)+'" data-qc-kickoff-at="'+escape(m.kickoff_at||'')+'">'+
        '<td class="jc-num"><b>'+escape(no)+'</b></td>'+
        '<td class="jc-time"><time>'+escape(String(m.match_time||'').slice(0,5)||'—')+'</time></td>'+
        '<td><span class="jc-overview-league">'+escape(m.league_short_name||m.league_name||'—')+'</span></td>'+
        '<td><a class="jc-review-match" href="'+link+'"><span>'+team(m.home_team_name)+
        '</span><span class="jc-score-stack">'+(isFinal
          ?'<strong class="jc-score-full">'+escape(full)+'</strong><span class="jc-score-half">半 '+escape(half)+'</span>'
          :'<strong class="jc-score-full vs">VS</strong><span class="jc-score-half">未开赛</span>')+
        '</span><span>'+team(m.away_team_name)+'</span></a></td>'+
        '<td class="jc-overview-market"><div class="jc-result-stack">'+htmlChoices(picks)+'</div></td>'+
        '<td class="jc-overview-goals">'+goalHtml(model.goal_range)+'</td>'+
        '<td class="jc-overview-htft">'+htmlChoices(two,true)+'</td></tr>';
    }).join('');
    return '<div class="jc-review-table-wrap"><table class="jc-review-table jc-overview-table">'+
      '<thead><tr><th>编号</th><th>时间</th><th>赛事</th><th>主队 比分 客队</th>'+
      '<th>胜平负/让球</th><th>总进球</th><th>半全场</th></tr></thead><tbody>'+
      content+'</tbody></table></div>';
  }

  // A signed-out event must invalidate an in-flight early paint.
  let validMember=true;
  sdk.auth.onAuthStateChange?.(event=>{
    if(event!=='SIGNED_OUT')return;
    validMember=false;
    window.qcHomeEarlyProValidatedRecord=null;
    if(cards.dataset.qcEarlyProPainted==='1'){
      cards.dataset.qcEarlyProPainted='0';
      cards.innerHTML='<div class="profile-card" role="status">请登录后查看今日预测。</div>';
    }
  });
  window.qcHomeEarlyProSnapshotPromise.then(async record=>{
    if(!validMember || cards.dataset.qcAuthPaintReady==='1')return;
    const access=await window.qcHomeEarlyAccessPromise;
    if(!access?.isPro || !validMember || cards.dataset.qcAuthPaintReady==='1')return;
    const markup=quickPredictionTable(record);
    if(!markup)return; // Partial/no FINAL: existing complete public path takes over.
    window.qcHomeEarlyProValidatedRecord=record;
    cards.dataset.qcEarlyProPainted='1';
    cards.dataset.qcEarlyProDate=proDay;
    cards.innerHTML=markup;
    const meta=document.getElementById('jcPredictionMeta');
    if(meta)meta.textContent='会员已验证 · '+record.match_count+'场';
    window.qcHomeProFirstPaintAt=Date.now();
  }).catch(error=>console.warn('会员首屏预显示失败，继续使用正式渲染',error));

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
