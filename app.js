function $(q, el=document){return el.querySelector(q)}
function $$(q, el=document){return [...el.querySelectorAll(q)]}
function setupDrawer(){const btn=$('#menuBtn'),bd=$('#drawerBackdrop'); if(!btn||!bd)return;btn.onclick=()=>bd.classList.add('open');bd.onclick=e=>{if(e.target===bd)bd.classList.remove('open')}}
function renderIndex(){
 const recap=$('#recapRows'),cards=$('#matchCards');if(!recap||!cards)return;
 recap.innerHTML=QC_DATA.recap.map(r=>`<tr class="${r.hit?'hit':''}"><td><b>${r.n}</b></td><td>${r.time}</td><td><span class="league-tag">${r.league}</span></td><td><span class="home">${r.home}</span><br><b class="score">${r.score}</b><br><span class="away">${r.away}</span></td><td>${r.hit?`<span class="hit-ring">${r.direction}</span>`:`<span class="pick">${r.direction}</span>`}</td><td><span class="pick">${r.goals}</span></td><td><span class="pick">${r.htft}</span></td></tr>`).join('');
 cards.innerHTML=QC_DATA.matches.map(m=>`<a class="match-card" href="match.html?id=${m.id}"><div class="match-top"><span>${m.n} · ${m.league}</span><span>${m.time}</span></div><div class="match-main"><div class="team">${m.home}</div><div class="versus">VS</div><div class="team right">${m.away}</div></div><div class="model-grid"><div class="model-chip"><b>模型方向</b><span>${m.direction}</span></div><div class="model-chip"><b>M7</b><span>${m.m7}</span></div><div class="model-chip"><b>M8</b><span>${m.m8}</span></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><span class="pill blue">半全场 ${m.htft}</span><span class="pill orange">区间 ${m.range}</span><span class="pill green">置信 ${m.confidence}</span></div></a>`).join('')
}

function qcEscape(value){
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function jcPoolLabel(code){
  return ({had:'胜平负',hhad:'让球胜平负',crs:'比分',ttg:'总进球',hafu:'半全场'})[code] || code;
}

function jcLatestPools(snapshots){
  const latest = {};
  for(const s of snapshots || []){
    const old = latest[s.pool_code];
    if(!old || new Date(s.captured_at || 0) > new Date(old.captured_at || 0)) latest[s.pool_code] = s;
  }
  return latest;
}

function jcOutcomeLabel(poolCode,key){
  const k=String(key ?? '').trim();
  const common={h:'主胜',d:'平',a:'客胜'};
  if(poolCode==='had' || poolCode==='hhad') return common[k] || k;

  if(poolCode==='ttg'){
    const m=k.match(/^s([0-7])$/i);
    if(m) return m[1]==='7' ? '7+球' : m[1]+'球';
    return k;
  }

  if(poolCode==='hafu'){
    const map={
      hh:'胜/胜',hd:'胜/平',ha:'胜/负',
      dh:'平/胜',dd:'平/平',da:'平/负',
      ah:'负/胜',ad:'负/平',aa:'负/负'
    };
    return map[k] || k;
  }

  if(poolCode==='crs'){
    const special={
      's-1sh':'胜其他','s-1sd':'平其他','s-1sa':'负其他',
      's1sh':'胜其他','s1sd':'平其他','s1sa':'负其他'
    };
    if(special[k]) return special[k];
    const m=k.match(/^s(\d{2})s(\d{2})$/i);
    if(m) return Number(m[1])+'-'+Number(m[2]);
    return k;
  }

  return k;
}

function jcOutcomeSort(poolCode,entries){
  const order={
    had:['h','d','a'],
    hhad:['h','d','a'],
    ttg:['s0','s1','s2','s3','s4','s5','s6','s7'],
    hafu:['hh','hd','ha','dh','dd','da','ah','ad','aa']
  }[poolCode];
  if(!order) return entries;
  return [...entries].sort((x,y)=>{
    const xi=order.indexOf(String(x[0]));
    const yi=order.indexOf(String(y[0]));
    return (xi<0?999:xi)-(yi<0?999:yi);
  });
}

function jcOutcomeSummary(pool, poolCode){
  if(!pool || !pool.outcomes) return '—';
  const o = pool.outcomes;
  let entries = Array.isArray(o)
    ? o.map((x,i)=>[x.key || x.label || x.labelZh || String(i+1), x.odds ?? x.value ?? x])
    : Object.entries(o);

  if(!entries.length) return '—';
  entries=jcOutcomeSort(poolCode,entries);

  const limit = poolCode==='crs' ? 40 : 12;
  return entries.slice(0,limit).map(([k,v])=>{
    let val=v;
    let label=jcOutcomeLabel(poolCode,k);
    if(v && typeof v === 'object'){
      val = v.odds ?? v.value ?? v.fixedBonus ?? v.sp ?? '';
      label = v.labelZh || v.label || label;
    }
    return val === '' ? String(label) : String(label)+' '+String(val);
  }).join(' · ');
}

function jcDateTime(m){
  const d = m.match_date || m.business_date || '';
  const t = (m.match_time || '').slice(0,5);
  return [d,t].filter(Boolean).join(' ');
}


function qcBeijingToday(){
  const parts=new Intl.DateTimeFormat('zh-CN',{
    timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date());
  const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return map.year+'-'+map.month+'-'+map.day;
}

function qcAddDays(dateStr,days){
  const d=new Date(dateStr+'T12:00:00+08:00');
  d.setUTCDate(d.getUTCDate()+days);
  return d.toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});
}

function qcDateLabel(ds){
  const d=new Date(ds+'T12:00:00+08:00');
  if(Number.isNaN(d.getTime())) return ds;
  return (d.getMonth()+1)+'月'+d.getDate()+'日 '+d.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',weekday:'short'});
}

function jcBusinessDate(m){
  // 竞彩足球必须按官方销售日/竞彩编号所属星期归档。
  // 例如“周二002”即使 09-23 02:00 开球，也属于 09-22 周二页面。
  return m?.business_date || m?.match_date || '';
}

function qcRenderDateCalendar(selectedDate,availableDates,onSelect){
  const box=$('#jcDatePopover');
  if(!box) return;
  const base=new Date(selectedDate+'T12:00:00+08:00');
  const year=Number(base.toLocaleString('en-US',{timeZone:'Asia/Shanghai',year:'numeric'}));
  const month=Number(base.toLocaleString('en-US',{timeZone:'Asia/Shanghai',month:'numeric'}));
  const first=new Date(Date.UTC(year,month-1,1,4));
  const firstWeek=(first.getUTCDay()+6)%7;
  const daysInMonth=new Date(Date.UTC(year,month,0,4)).getUTCDate();
  const avail=new Set(availableDates);
  let cells='';
  for(let i=0;i<firstWeek;i++) cells+='<span class="jc-cal-cell empty"></span>';
  for(let day=1;day<=daysInMonth;day++){
    const ds=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    const has=avail.has(ds);
    const cls=['jc-cal-cell',has?'has-data':'no-data',ds===selectedDate?'selected':''].filter(Boolean).join(' ');
    cells+='<button type="button" class="'+cls+'" data-date="'+ds+'" '+(has?'':'disabled')+'>'+day+'</button>';
  }
  box.innerHTML=
    '<div class="jc-cal-note">选择有比赛数据的日期</div>'+
    '<div class="jc-cal-head"><b>'+year+'年'+month+'月</b></div>'+
    '<div class="jc-cal-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>'+
    '<div class="jc-cal-grid">'+cells+'</div>';
  $$('.jc-cal-cell.has-data',box).forEach(btn=>{
    btn.onclick=()=>{onSelect(btn.dataset.date);box.hidden=true;};
  });
}


function jcPoolNumber(pool,key){
  if(!pool || !pool.outcomes) return null;
  const raw=pool.outcomes[key];
  if(raw==null) return null;
  if(typeof raw==='object') return raw.odds ?? raw.value ?? raw.fixedBonus ?? raw.sp ?? null;
  return raw;
}

function jcApiLiveInfo(m){
  const p=m?._apiFootballLive || null;
  const short=String(p?.status?.short || '').trim().toUpperCase();
  const elapsed=Number(p?.status?.elapsed);
  const home=p?.goals?.home;
  const away=p?.goals?.away;
  const htHome=p?.score?.halftime?.home;
  const htAway=p?.score?.halftime?.away;
  const finished=['FT','AET','PEN','CANC','ABD','AWD','WO'].includes(short);
  const notStarted=['NS','TBD','PST'].includes(short);
  const started=Boolean(short && !notStarted) || (home!=null && away!=null && Number.isFinite(elapsed));
  const current=(started && home!=null && away!=null)?String(home)+'-'+String(away):'';
  const ht=(htHome!=null && htAway!=null)?String(htHome)+'-'+String(htAway):'';
  return {short,elapsed:Number.isFinite(elapsed)?elapsed:null,started,finished,current,ht};
}

function jcMatchStatusLabel(m,today){
  const api=jcApiLiveInfo(m);
  const minute=api.elapsed!=null ? String(api.elapsed)+"'" : '';
  const map={
    'HT':'半场',
    'BT':'加时中场',
    'P':'点球',
    'INT':'中断',
    'SUSP':'暂停',
    'PST':'延期',
    'CANC':'取消',
    'ABD':'中止',
    'FT':'完场',
    'AET':'加时完场',
    'PEN':'点球完场',
    'AWD':'判定结束',
    'WO':'判定结束'
  };
  if(api.short==='1H') return '上半'+(minute?' '+minute:'');
  if(api.short==='2H') return '下半'+(minute?' '+minute:'');
  if(api.short==='ET') return '加时'+(minute?' '+minute:'');
  if(map[api.short]) return map[api.short];
  if(api.started) return minute ? minute+' 进行中' : '进行中';

  const rawStatus=String(m?.raw?.matchStatusName || m?.match_status || '').trim();
  const ft=String(m?.raw?.sectionsNo999 || '').trim();
  if(ft) return '完场';
  if(/完成|结束|finished/i.test(rawStatus)) return '完场';
  if(/进行|live/i.test(rawStatus)) return '进行中';
  if(m.match_date>today) return '未开赛';
  if(/Selling|销售|开售|暂停销售|未开赛|2|3/.test(rawStatus)) return '未开赛';
  return rawStatus || '未开赛';
}

function jcScoreInfo(m){
  const officialFt=String(m?.raw?.sectionsNo999 || '').trim().replace(':','-');
  const officialHt=String(m?.raw?.sectionsNo1 || '').trim().replace(':','-');
  const api=jcApiLiveInfo(m);
  const ft=officialFt || (api.finished?api.current:'');
  const htReady=['HT','2H','ET','BT','P','FT','AET','PEN'].includes(api.short);
  const ht=officialHt || (htReady?api.ht:'') || '';
  const current=api.current || officialFt || '';
  const started=api.started || Boolean(officialFt);
  const finished=api.finished || Boolean(officialFt);
  return {ft,ht,current,started,finished,elapsed:api.elapsed,statusShort:api.short};
}

function jcShouldFetchLive(m){
  const t=new Date(m?.kickoff_at || '').getTime();
  if(!Number.isFinite(t)) return false;
  const now=Date.now();
  // 覆盖开赛前20分钟至赛后约26小时，方便昨日回看读取已缓存完赛比分。
  return t<=now+20*60*1000 && t>=now-26*60*60*1000;
}

async function jcAttachLiveScores(rows){
  const list=(rows||[]).filter(m=>m?.id && jcShouldFetchLive(m));
  if(!list.length || !window.QC_SUPABASE_URL) return rows||[];
  await Promise.all(list.map(async m=>{
    try{
      const res=await fetch(window.QC_SUPABASE_URL+'/functions/v1/api-football-match?jc_match_id='+encodeURIComponent(m.id),{cache:'no-store'});
      const payload=await res.json();
      if(res.ok && payload?.ok && payload?.data) m._apiFootballLive=payload.data;
    }catch(err){
      console.warn('实时比分读取失败',m?.match_num||m?.id,err);
    }
  }));
  return rows||[];
}

function jcRelativeDayLabel(dateStr,today){
  if(dateStr===today) return '今天';
  if(dateStr===qcAddDays(today,1)) return '明天';
  if(dateStr===qcAddDays(today,2)) return '后天';
  return '';
}

function jcRenderOddsMini(pools){
  const had=pools.had;
  const hhad=pools.hhad;
  const cell=v=>v==null?'<span class="muted-dash">—</span>':qcEscape(v);
  return '<div class="jc-mini-odds">'+
    '<div class="jc-mini-head"><span>玩法</span><span>主胜</span><span>平局</span><span>客胜</span></div>'+
    '<div class="jc-mini-row"><b class="jc-play-tag blue">胜平负</b><strong>'+cell(jcPoolNumber(had,'h'))+'</strong><strong>'+cell(jcPoolNumber(had,'d'))+'</strong><strong>'+cell(jcPoolNumber(had,'a'))+'</strong></div>'+
    '<div class="jc-mini-row"><b class="jc-play-tag orange">让球胜平负'+(hhad?.goal_line?' '+qcEscape(hhad.goal_line):'')+'</b><strong>'+cell(jcPoolNumber(hhad,'h'))+'</strong><strong>'+cell(jcPoolNumber(hhad,'d'))+'</strong><strong>'+cell(jcPoolNumber(hhad,'a'))+'</strong></div>'+
  '</div>';
}

function jcRenderLeagueFilters(rows,activeLeague,onChange){
  const box=$('#jcLeagueFilters');
  if(!box) return;
  const counts={};
  rows.forEach(m=>{
    const league=m.league_name || m.league_short_name || '其他';
    counts[league]=(counts[league]||0)+1;
  });
  const leagues=Object.keys(counts);
  const all=[{key:'全部',label:'全部赛事',count:rows.length},...leagues.map(x=>({key:x,label:x,count:counts[x]}))];
  box.innerHTML=all.map(item=>
    '<button type="button" class="'+(activeLeague===item.key?'active':'')+'" data-league="'+qcEscape(item.key)+'">'+
      '<span class="jc-filter-check">'+(activeLeague===item.key?'✓':'')+'</span>'+
      '<span class="jc-filter-name">'+qcEscape(item.label)+'</span>'+
      '<b>'+item.count+'</b>'+
    '</button>'
  ).join('');
  $('button',box).forEach(btn=>{
    btn.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();
      onChange(btn.dataset.league || '全部');
    };
  });
}

function jcRenderCompactFixtures(rows,today,emptyText){
  if(!rows.length) return '<div class="profile-card">'+qcEscape(emptyText || '暂无比赛')+'</div>';
  const ordered=[...rows].sort((a,b)=>String(a.match_num||'').localeCompare(String(b.match_num||''),'zh-CN',{numeric:true}));
  return '<div class="jc-compact-list">'+ordered.map(m=>{
    const score=jcScoreInfo(m);
    const status=jcMatchStatusLabel(m,today);
    const league=qcEscape(m.league_name || m.league_short_name || '—');
    const num=qcEscape(m.match_num || '竞彩');
    const time=qcEscape((m.match_time || '').slice(0,5) || '—');
    const home=qcEscape(m.home_team_name || '—');
    const away=qcEscape(m.away_team_name || '—');
    const middle=score.current?qcEscape(score.current):'VS';
    const ht=score.ht?'<span class="jc-compact-ht">半 '+qcEscape(score.ht)+'</span>':'';
    return '<a class="jc-compact-match" href="jc-match.html?id='+encodeURIComponent(m.id)+'">'+
      '<div class="jc-compact-top"><span><b>'+num+'</b><em>'+league+'</em></span><time>'+time+'</time></div>'+
      '<div class="jc-compact-main">'+
        '<strong class="jc-compact-team">'+home+'</strong>'+
        '<div class="jc-compact-score"><b>'+middle+'</b>'+ht+'</div>'+
        '<strong class="jc-compact-team away">'+away+'</strong>'+
      '</div>'+
      '<div class="jc-compact-status">'+qcEscape(status)+'</div>'+
    '</a>';
  }).join('')+'</div>';
}

function jcRenderFutureGrid(rows,today){
  return jcRenderCompactFixtures(rows,today,'这一天暂时没有符合筛选条件的比赛。');
}


function jcRenderTodayLayout(rows,today){
  return jcRenderCompactFixtures(rows,today,'今天暂时没有采集到竞彩足球赛程。');
}


function jcResultTextByScore(score){
  const parts=String(score||'').split('-').map(Number);
  if(parts.length!==2 || parts.some(n=>!Number.isFinite(n))) return '—';
  return parts[0]>parts[1]?'主胜':parts[0]<parts[1]?'客胜':'平';
}

function jcShortResultByScore(score){
  const parts=String(score||'').split('-').map(Number);
  if(parts.length!==2 || parts.some(n=>!Number.isFinite(n))) return '—';
  return parts[0]>parts[1]?'胜':parts[0]<parts[1]?'负':'平';
}

function jcHandicapResult(score,goalLine){
  const parts=String(score||'').split('-').map(Number);
  const line=Number(goalLine);
  if(parts.length!==2 || parts.some(n=>!Number.isFinite(n)) || !Number.isFinite(line)) return '';
  const adjusted=parts[0]+line;
  const r=adjusted>parts[1]?'胜':adjusted<parts[1]?'负':'平';
  const label=(line>0?'+':'')+String(line);
  return label+'让'+r;
}

let qcAccessStatePromise=null;

async function qcGetAccessState(force=false){
  if(force) qcAccessStatePromise=null;
  if(qcAccessStatePromise) return qcAccessStatePromise;

  qcAccessStatePromise=(async()=>{
    if(!window.qcSupabase) return {loggedIn:false,isPro:false};
    try{
      const {data:sessionData}=await window.qcSupabase.auth.getSession();
      const session=sessionData?.session||null;
      if(!session) return {loggedIn:false,isPro:false};

      const {data:isPro,error}=await window.qcSupabase.rpc('has_active_pro_access');
      if(error) console.warn('读取Pro权限失败',error);
      return {loggedIn:true,isPro:isPro===true,userId:session.user?.id||null};
    }catch(err){
      console.warn('读取会员权限失败',err);
      return {loggedIn:false,isPro:false};
    }
  })();

  return qcAccessStatePromise;
}

function qcMatchHasStarted(m){
  const score=jcScoreInfo(m);
  if(score.started || score.finished) return true;
  const kickoff=new Date(m?.kickoff_at||'').getTime();
  return Number.isFinite(kickoff) && kickoff<=Date.now();
}

function qcCanViewPrematchContent(m,access){
  return Boolean(access?.isPro || qcMatchHasStarted(m));
}

function qcPremiumGateHtml(access,kind='prediction'){
  const loggedIn=Boolean(access?.loggedIn);
  const isAi=kind==='ai';
  const title=loggedIn
    ? (isAi?'当前账号暂无完整分析权限':'当前账号暂无查看权限')
    : (isAi?'登录后查看完整分析报告':'登录后查看今日预测');
  const desc=loggedIn
    ? (isAi?'赛前AI分析与锁板结论属于 Pro 内容，请开通或续费 Pro 后查看。':'今日赛前预测属于 Pro 内容，请开通或续费 Pro 后查看。')
    : '新注册账号自动获得 1 天 Pro 体验，可查看赛前预测与完整 AI 分析。';
  const primaryHref=loggedIn?'profile.html':'login.html?next='+encodeURIComponent(location.pathname+location.search);
  const primaryText=loggedIn?'进入个人中心':'登录查看';
  const secondary=!loggedIn
    ? '<a class="qc-premium-secondary" href="register.html">注册免费体验 1 天 Pro</a>'
    : '';

  return '<div class="qc-premium-gate">'+
    '<div class="qc-premium-lock" aria-hidden="true">🔒</div>'+
    '<h3>'+qcEscape(title)+'</h3>'+
    '<p>'+qcEscape(desc)+'</p>'+
    '<a class="qc-premium-primary" href="'+primaryHref+'">'+qcEscape(primaryText)+'</a>'+
    secondary+
  '</div>';
}

function jcPublicModel(m){
  const list=Array.isArray(m?.jc_model_outputs)?m.jc_model_outputs:[];
  return list.find(x=>x?.is_locked===true && x?.is_current===true && x?.stage==='FINAL') || list[0] || null;
}

function jcModelTopText(model){
  const top=Array.isArray(model?.top_scores)?model.top_scores:[];
  return top.length?top.join('｜'):'待生成';
}

function jcShortTeamPick(text,m){
  let s=String(text||'').trim();
  const home=String(m?.home_team_name||'').trim();
  const away=String(m?.away_team_name||'').trim();
  const variants=[
    [home,home.replace(/亚运男足|U23|亚足/g,'').trim()],
    [away,away.replace(/亚运男足|U23|亚足/g,'').trim()]
  ];
  for(const [full,short] of variants){
    if(full && short && full!==short) s=s.replace(full,short);
  }
  return s;
}

function jcCompactResultPick(text,m){
  const s=String(text||'')
    .replace(/[｜|]\s*[ABC](?:[+-])?\s*$/i,'')
    .replace(/\s*(?:评级|等级|置信等级)\s*[：:]?\s*[ABC](?:[+-])?\s*$/i,'')
    .replace(/\s+/g,'').trim();
  if(!s) return '待生成';

  const home=String(m?.home_team_name||'').replace(/\s+/g,'').trim();
  const away=String(m?.away_team_name||'').replace(/\s+/g,'').trim();
  const homeShort=home.replace(/亚运男足|U23|亚足/g,'');
  const awayShort=away.replace(/亚运男足|U23|亚足/g,'');
  const hasTeam=(name,short)=>Boolean((name&&s.includes(name))||(short&&short!==name&&s.includes(short)));
  const homeHit=hasTeam(home,homeShort);
  const awayHit=hasTeam(away,awayShort);

  if(/分胜负|主胜.*客胜|客胜.*主胜/.test(s)) return '胜 / 负';
  if(/主队?不败/.test(s) || (homeHit && /不败/.test(s))) return '胜 / 平';
  if(/客队?不败/.test(s) || (awayHit && /不败/.test(s))) return '平 / 负';
  if(/^主胜$/.test(s) || (homeHit && /胜/.test(s))) return '胜';
  if(/^客胜$/.test(s) || (awayHit && /胜/.test(s))) return '负';
  if(/^平局?$/.test(s)) return '平';

  return jcShortTeamPick(text,m);
}

function jcCompactHandicapPick(text){
  return String(text||'待生成')
    .replace(/\s+/g,'')
    .replace(/[＋+]/g,' / ')
    .replace(/[｜|]/g,' / ');
}

function jcOverviewDirectionChoices(model,m){
  const raw=jcCompactResultPick(model?.direction,m);
  let choices=String(raw||'').split('/').map(x=>x.trim()).filter(Boolean);
  if(!choices.length) return [];
  const single=jcCompactResultPick(model?.single_pick,m);
  if(single && !String(single).includes('/')){
    const idx=choices.indexOf(single);
    if(idx>0) choices=[choices[idx],...choices.filter((_,i)=>i!==idx)];
  }
  return [...new Set(choices)];
}

function jcPrekickLatestPools(m){
  const kickoff=new Date(m?.kickoff_at||'').getTime();
  const snaps=(m?.jc_market_snapshots||[]).filter(s=>{
    const t=new Date(s?.captured_at||0).getTime();
    return !Number.isFinite(kickoff) || !Number.isFinite(t) || t<=kickoff;
  });
  return jcLatestPools(snaps);
}

function jcFootballHitOddsHtml(m,model,score){
  if(!model || !score?.finished || !score?.ft) return '';
  const pools=jcPrekickLatestPools(m);
  const hits=[];

  const actual=jcShortResultByScore(score.ft);
  const directionChoices=jcOverviewDirectionChoices(model,m);
  const hadKey={胜:'h',平:'d',负:'a'}[actual];
  const hadOdd=hadKey?jcPoolNumber(pools.had,hadKey):null;
  if(directionChoices.includes(actual) && hadOdd!=null){
    hits.push({kind:'胜平负',label:actual,odds:hadOdd});
  }

  const hhad=pools.hhad;
  if(hhad?.goal_line!=null){
    const full=jcHandicapResult(score.ft,hhad.goal_line);
    const handicapLabel=String(full||'').replace(/^[+-]?\d+(?:\.\d+)?/,'');
    const handicapChoices=jcCompactHandicapPick(model.handicap_direction)
      .split('/').map(x=>x.trim()).filter(Boolean);
    const hk={让胜:'h',让平:'d',让负:'a'}[handicapLabel];
    const ho=hk?jcPoolNumber(hhad,hk):null;
    if(handicapChoices.includes(handicapLabel) && ho!=null){
      hits.push({kind:'让球',label:handicapLabel,odds:ho});
    }
  }

  const top=Array.isArray(model.top_scores)?model.top_scores.map(String):[];
  if(top.includes(String(score.ft))){
    const parts=String(score.ft).split('-').map(Number);
    if(parts.length===2 && parts.every(Number.isFinite)){
      const key='s'+String(parts[0]).padStart(2,'0')+'s'+String(parts[1]).padStart(2,'0');
      const odd=jcPoolNumber(pools.crs,key);
      if(odd!=null) hits.push({kind:'比分',label:String(score.ft),odds:odd});
    }
  }

  if(!hits.length) return '';
  return '<div class="jc-card-hit-band">'+
    '<span class="jc-card-hit-title">赛后命中</span>'+
    '<div class="jc-card-hit-items">'+hits.map(x=>
      '<span class="jc-card-hit-chip" title="'+qcEscape(x.kind)+'">'+
        '<b>'+qcEscape(x.label)+'</b><em>'+qcEscape(x.odds)+'</em>'+
      '</span>'
    ).join('')+'</div>'+
  '</div>';
}

function jcOverviewChoicesHtml(choices){
  const list=(choices||[]).filter(Boolean);
  if(!list.length) return jcPredictionPlaceholder();
  return '<span class="jc-choice-stack">'+list.map((x,i)=>
    '<span class="'+(i===0?'jc-choice-primary':'jc-choice-secondary')+'">'+qcEscape(x)+'</span>'
  ).join('')+'</span>';
}

function jcOverviewInlineChoicesHtml(choices){
  const list=(choices||[]).filter(Boolean);
  if(!list.length) return jcPredictionPlaceholder();
  return '<span class="jc-choice-inline">'+list.map((x,i)=>
    (i?'<span class="jc-choice-sep">/</span>':'')+
    '<span class="'+(i===0?'jc-choice-primary':'jc-choice-secondary')+'">'+qcEscape(x)+'</span>'
  ).join('')+'</span>';
}

function jcOverviewGoalsHtml(range){
  const s=String(range||'').trim();
  const m=s.match(/(\d+)\s*[—–-]\s*(\d+)\s*球?/);
  let values=[];
  if(m){
    const a=Number(m[1]),b=Number(m[2]);
    if(Number.isFinite(a)&&Number.isFinite(b)&&b>=a&&b-a<=6){
      for(let n=a;n<=b;n++) values.push(n+'球');
    }
  }
  if(!values.length){
    values=s.split(/[、,，｜|/\s]+/).map(x=>x.trim()).filter(Boolean).map(x=>/球$/.test(x)?x:x+'球');
  }
  if(!values.length) return jcPredictionPlaceholder();
  return '<span class="jc-goal-choices">'+values.map(x=>'<span>'+qcEscape(x)+'</span>').join('')+'</span>';
}

function jcOverviewGoalValues(range){
  const s=String(range||'').trim();
  const m=s.match(/(\d+)\s*[—–-]\s*(\d+)\s*球?/);
  let values=[];
  if(m){
    const a=Number(m[1]),b=Number(m[2]);
    if(Number.isFinite(a)&&Number.isFinite(b)&&b>=a&&b-a<=6){
      for(let n=a;n<=b;n++) values.push(n+'球');
    }
  }
  if(!values.length){
    values=s.split(/[、,，｜|/\s]+/).map(x=>x.trim()).filter(Boolean).map(x=>/球$/.test(x)?x:x+'球');
  }
  return [...new Set(values)];
}

function jcPublicTotalGoalsText(range){
  const values=jcOverviewGoalValues(range);
  return values.length ? values.join(' ') : '待生成';
}

function jcNormalizePublicAiText(text){
  let s=String(text||'');
  if(!s) return s;
  s=s.replace(/主要进球区间/g,'总进球').replace(/进球区间/g,'总进球');
  s=s.replace(/单选(?!倾向)/g,'单选倾向');
  s=s.replace(/[，,；;]?\s*(?:模型方向|方向)?(?:评级|等级|置信等级)\s*[：:]?\s*[ABC](?:[+-])?/gi,'');
  s=s.replace(/[｜|]\s*[ABC](?:[+-])?(?=\s*(?:[，,。；;]|$))/gi,'');
  s=s.replace(/(\d+)\s*[—–-]\s*(\d+)\s*球/g,(all,a,b)=>{
    const start=Number(a),end=Number(b);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>6) return all;
    const out=[];
    for(let n=start;n<=end;n++) out.push(n+'球');
    return out.join('、');
  });
  return s;
}

function jcReviewResultHtml(value,hit){
  const cls=hit?'jc-hit-ring':'jc-landed';
  return '<span class="'+cls+'">'+qcEscape(value||'—')+'</span>';
}

function jcReviewInlineChoicesHtml(choices,hitValue){
  const list=(choices||[]).filter(Boolean);
  if(!list.length) return jcPredictionPlaceholder();
  return '<span class="jc-choice-inline jc-review-choices">'+list.map((x,i)=>
    (i?'<span class="jc-choice-sep">/</span>':'')+
    '<span class="'+(i===0?'jc-choice-primary':'jc-choice-secondary')+(x===hitValue?' jc-hit-ring':'')+'">'+qcEscape(x)+'</span>'
  ).join('')+'</span>';
}

function jcReviewGoalChoicesHtml(choices,hitValue){
  const list=(choices||[]).filter(Boolean);
  if(!list.length) return jcPredictionPlaceholder();
  return '<span class="jc-goal-choices jc-review-choices">'+list.map(x=>
    '<span class="'+(x===hitValue?'jc-hit-ring':'')+'">'+qcEscape(x)+'</span>'
  ).join('')+'</span>';
}

function jcReviewHtftChoicesHtml(choices,hitValue){
  const list=(choices||[]).filter(Boolean);
  if(!list.length) return jcPredictionPlaceholder();
  return '<span class="jc-choice-stack jc-review-choices">'+list.map((x,i)=>
    '<span class="'+(i===0?'jc-choice-primary':'jc-choice-secondary')+(x===hitValue?' jc-hit-ring':'')+'">'+qcEscape(x)+'</span>'
  ).join('')+'</span>';
}

function jcOverviewHtftHtml(model){
  const values=[model?.htft_top1,model?.htft_top2].filter(Boolean);
  return jcOverviewChoicesHtml(values);
}

async function jcAttachModels(rows){
  if(!window.qcSupabase || !Array.isArray(rows) || !rows.length) return rows||[];
  const ids=rows.map(x=>x.id).filter(Boolean);
  if(!ids.length) return rows;
  const {data,error}=await window.qcSupabase
    .from('jc_model_outputs')
    .select('id,jc_match_id,model_version,stage,direction,single_pick,handicap_direction,htft_top1,htft_top2,goal_range,top_scores,raw_input,is_current,is_locked,locked_at')
    .in('jc_match_id',ids)
    .eq('is_locked',true)
    .eq('is_current',true);
  if(error){ console.warn('读取模型锁板结果失败',error); return rows; }
  const map=new Map();
  (data||[]).forEach(x=>map.set(x.jc_match_id,x));
  rows.forEach(m=>{ m.jc_model_outputs=map.has(m.id)?[map.get(m.id)]:[]; });
  return rows;
}

function jcPredictionPlaceholder(){
  return '<span class="jc-overview-pending">待生成</span>';
}

function jcRenderOverviewTable(rows,today,mode='today'){
  const ordered=[...rows].sort((a,b)=>String(a.match_num||'').localeCompare(String(b.match_num||''),'zh-CN',{numeric:true}));
  if(!ordered.length){
    return '<div class="jc-review-empty">'+(mode==='yesterday'?'昨日暂无已回收赛事':'今日暂无竞彩赛事')+'</div>';
  }

  return '<div class="jc-review-table-wrap"><table class="jc-review-table jc-overview-table">'+
    '<thead><tr><th>编号 时间</th><th>赛事</th><th>主队 比分 客队</th><th>胜平负</th><th>总进球</th><th>半全场</th></tr></thead>'+
    '<tbody>'+ordered.map(m=>{
      const score=jcScoreInfo(m);
      const href='jc-match.html?id='+encodeURIComponent(m.id);
      const league=qcEscape(m.league_short_name||m.league_name||'—');
      const num=qcEscape(String(m.match_num||'—').replace(/^周[一二三四五六日天]/,''));
      const time=qcEscape(String(m.match_time||'').slice(0,5)||'—');
      const home=qcEscape(m.home_team_name||'—');
      const away=qcEscape(m.away_team_name||'—');

      let market=jcPredictionPlaceholder();
      let goals=jcPredictionPlaceholder();
      let hafu=jcPredictionPlaceholder();
      const model=jcPublicModel(m);

      if(mode!=='yesterday' && model){
        market=jcOverviewInlineChoicesHtml(jcOverviewDirectionChoices(model,m));
        goals=jcOverviewGoalsHtml(model.goal_range);
        hafu=jcOverviewHtftHtml(model);
      }

      if(score.finished && score.ft && model){
        const ftParts=String(score.ft).split('-').map(Number);
        const total=ftParts.length===2 && ftParts.every(Number.isFinite)?(ftParts[0]+ftParts[1])+'球':'—';
        const htft=score.ht ? jcShortResultByScore(score.ht)+'/'+jcShortResultByScore(score.ft) : '—';
        const resultShort=jcShortResultByScore(score.ft);

        const directionChoices=jcOverviewDirectionChoices(model,m);
        const goalChoices=jcOverviewGoalValues(model.goal_range);
        const htftChoices=[model.htft_top1,model.htft_top2].filter(Boolean);

        market=jcReviewInlineChoicesHtml(directionChoices,resultShort);
        goals=jcReviewGoalChoicesHtml(goalChoices,total);
        hafu=jcReviewHtftChoicesHtml(htftChoices,htft);
      }

      const displayScore=mode==='yesterday'?score.ft:score.current;
      let scoreMeta='';
      let scoreMetaClass='jc-score-half';
      if(mode==='yesterday'){
        scoreMeta=score.ht?'半 '+score.ht:'半 —';
      }else if(score.started && !score.finished){
        scoreMeta=jcMatchStatusLabel(m,today);
        scoreMetaClass='jc-score-live';
      }else if(score.finished){
        scoreMeta=score.ht?'半 '+score.ht:'完场';
      }else{
        scoreMeta='未开赛';
      }
      const scoreStack=displayScore
        ? '<strong class="jc-score-full">'+qcEscape(displayScore)+'</strong><span class="'+scoreMetaClass+'">'+qcEscape(scoreMeta)+'</span>'
        : '<strong class="jc-score-full vs">VS</strong><span class="jc-score-half">'+qcEscape(scoreMeta)+'</span>';

      return '<tr class="jc-overview-row" data-href="'+href+'">'+
        '<td class="jc-num-time"><b>'+num+'</b><time>'+time+'</time></td>'+
        '<td><span class="jc-overview-league">'+league+'</span></td>'+
        '<td><a class="jc-review-match" href="'+href+'"><span>'+home+'</span><span class="jc-score-stack">'+scoreStack+'</span><span>'+away+'</span></a></td>'+
        '<td><div class="jc-result-stack">'+market+'</div></td>'+
        '<td>'+goals+'</td>'+
        '<td>'+hafu+'</td>'+
      '</tr>';
    }).join('')+'</tbody></table></div>';
}

function jcBindOverviewRows(root=document){
  $$('.jc-overview-row',root).forEach(row=>{
    row.onclick=e=>{
      if(e.target.closest('a')) return;
      const href=row.dataset.href;
      if(href) location.href=href;
    };
  });
}

function jcRenderYesterdayReview(rows,today){
  return jcRenderOverviewTable(rows,today,'yesterday');
}

function jcRenderFootballCards(rows,today,access={loggedIn:false,isPro:false}){
  if(!rows.length) return '<div class="profile-card">这一天暂时没有符合筛选条件的竞彩足球比赛。</div>';
  const ordered=[...rows].sort((a,b)=>String(a.match_num||'').localeCompare(String(b.match_num||''),'zh-CN',{numeric:true}));
  return '<div class="jc-football-grid">'+ordered.map((m,index)=>{
    const score=jcScoreInfo(m);
    const status=jcMatchStatusLabel(m,today);
    const relative=jcRelativeDayLabel(m.match_date,today);
    const when=(relative?relative+' ':'')+String(m.match_date||'').slice(5)+' '+String(m.match_time||'').slice(0,5);
    const href='jc-match.html?id='+encodeURIComponent(m.id);
    const canViewPrematch=qcCanViewPrematchContent(m,access);
    const model=canViewPrematch?jcPublicModel(m):null;
    const modelBlock=canViewPrematch ? (()=>{const raw=model?.raw_input||{};const sp=raw.single_prob!=null?('｜'+raw.single_prob+'%'):'';return '<div class="jc-card-model-lite">'+
      '<div><span>模型方向</span><b>'+(model?qcEscape(jcCompactResultPick(model.direction,m)):'待生成')+'</b></div>'+
      '<div><span>单选倾向</span><b>'+(model?qcEscape(jcCompactResultPick(model.single_pick,m)+sp):'待生成')+'</b></div>'+
      '<div><span>让球胜平负</span><b>'+(model?qcEscape(jcCompactHandicapPick(model.handicap_direction)):'待生成')+'</b></div>'+
      '<div class="jc-card-model-top"><span>TOP</span><b>'+(model?qcEscape(jcModelTopText(model)):'待生成')+'</b></div>'+
    '</div>';})() : '';
    const hitOddsBlock=canViewPrematch?jcFootballHitOddsHtml(m,model,score):'';
    const centerMeta=score.finished && score.ht
      ? '半 '+score.ht
      : jcMatchStatusLabel(m,today);
    const centerScore=score.current?qcEscape(score.current):'VS';
    const centerStateClass=score.started&&!score.finished?' is-live':'';

    return '<article class="jc-football-card jc-football-card-lite jc-football-card-final">'+
      '<a class="jc-card-link" href="'+href+'">'+
        '<div class="jc-card-top">'+
          '<span class="jc-card-top-left">'+
            (index<3?'<img class="jc-card-mini-logo" src="football-mark.svg" alt="">':'')+
            '<span class="jc-card-top-meta"><em>'+qcEscape(m.league_short_name||m.league_name||'—')+'</em><b>'+qcEscape(m.match_num||'竞彩')+'</b></span>'+
          '</span>'+
          '<time>'+qcEscape(String(m.match_date||'').slice(5)+' '+String(m.match_time||'').slice(0,5))+'</time>'+
        '</div>'+
        '<div class="jc-card-score-axis">'+
          '<strong class="jc-team jc-team-home">'+qcEscape(m.home_team_name||'—')+'</strong>'+
          '<span class="jc-score-center">'+
            '<b class="jc-score-main">'+centerScore+'</b>'+
            '<small class="jc-score-meta'+centerStateClass+'">'+qcEscape(centerMeta)+'</small>'+
          '</span>'+
          '<strong class="jc-team away-team jc-team-away">'+qcEscape(m.away_team_name||'—')+'</strong>'+
        '</div>'+
        modelBlock+
        hitOddsBlock+
        '<div class="jc-card-detail-btn">查看详情 <span>›</span></div>'+
      '</a>'+
    '</article>';
  }).join('')+'</div>';
}

const JC_MATCH_BASE_SELECT='id,match_num,business_date,league_name,league_short_name,home_team_name,away_team_name,match_date,match_time,kickoff_at,match_status,raw';
const JC_MATCH_WITH_SNAPSHOTS_SELECT=JC_MATCH_BASE_SELECT+',jc_market_snapshots(pool_code,goal_line,outcomes,captured_at,official_update_time)';

async function jcFetchDateRows(dateStr,withSnapshots=false){
  if(!dateStr || !window.qcSupabase) return {data:[],error:null};
  return window.qcSupabase.from('jc_matches')
    .select(withSnapshots?JC_MATCH_WITH_SNAPSHOTS_SELECT:JC_MATCH_BASE_SELECT)
    .eq('business_date',dateStr)
    .order('match_date',{ascending:true}).order('match_time',{ascending:true}).limit(100);
}

async function jcFetchAvailableDates(){
  if(!window.qcSupabase) return [];
  const {data,error}=await window.qcSupabase.from('jc_matches').select('business_date').not('business_date','is',null).limit(10000);
  if(error){ console.warn('读取竞彩日期索引失败',error); return []; }
  return [...new Set((data||[]).map(x=>x.business_date).filter(Boolean))].sort();
}

async function loadJcFootball(){
  const cards=$('#jcFootballCards');
  if(!cards || !window.qcSupabase) return;

  const today=qcBeijingToday();
  const paramDate=new URLSearchParams(location.search).get('date');
  const initialDate=paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)?paramDate:today;
  const [initial,availableDates]=await Promise.all([jcFetchDateRows(initialDate,true),jcFetchAvailableDates()]);
  const {data,error}=initial;

  if(error){
    cards.innerHTML='<div class="profile-card">竞彩足球数据暂时读取失败，请稍后刷新。</div>';
    return;
  }

  let allRows=(data||[]).filter(m=>m.match_date);
  const access=await qcGetAccessState();
  await jcAttachModels(allRows);
  const dateLocked=!access.loggedIn;
  let selectedDate=dateLocked
    ? today
    : (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)?paramDate:today);
  let activeLeague='全部';

  const leagueKey=m=>m.league_short_name||m.league_name||'其他';
  const label=$('#jcFootballDateLabel');
  const prev=$('#jcFootballPrevDate');
  const next=$('#jcFootballNextDate');
  const todayBtn=$('#jcFootballTodayBtn');
  const datePop=$('#jcDatePopover');
  const leagueToggle=$('#jcFootballLeagueToggle');
  const leaguePop=$('#jcFootballLeaguePopover');
  const leagueMenu=$('#jcFootballLeagueMenu');

  if(dateLocked){
    [prev,next,todayBtn,label].filter(Boolean).forEach(el=>{
      el.disabled=true;
      el.setAttribute('aria-disabled','true');
      el.classList.add('qc-date-locked-control');
    });
    if(datePop) datePop.hidden=true;
  }

  function setUrlDate(ds){
    const u=new URL(location.href);
    if(dateLocked) u.searchParams.delete('date');
    else u.searchParams.set('date',ds);
    history.replaceState({},'',u);
  }

  function closeLeague(){
    if(leaguePop) leaguePop.hidden=true;
    if(leagueToggle) leagueToggle.setAttribute('aria-expanded','false');
  }

  function renderLeagueMenu(rows){
    if(!leagueMenu) return;
    const counts={};
    rows.forEach(m=>{
      const k=leagueKey(m);
      counts[k]=(counts[k]||0)+1;
    });
    const items=[
      {key:'全部',label:'全部赛事',count:rows.length},
      ...Object.keys(counts).sort((x,y)=>x.localeCompare(y,'zh-CN')).map(k=>({key:k,label:k,count:counts[k]}))
    ];
    leagueMenu.innerHTML=items.map(item=>
      '<button type="button" class="'+(activeLeague===item.key?'active':'')+'" data-league="'+qcEscape(item.key)+'">'+
        '<span class="jc-football-league-check">'+(activeLeague===item.key?'✓':'')+'</span>'+
        '<span class="jc-football-league-name">'+qcEscape(item.label)+'</span>'+
        '<b>'+item.count+'</b>'+
      '</button>'
    ).join('');
    $$('button',leagueMenu).forEach(btn=>{
      btn.onclick=e=>{
        e.preventDefault();
        e.stopPropagation();
        activeLeague=btn.dataset.league||'全部';
        closeLeague();
        render();
      };
    });
  }

  async function loadFootballDate(ds){
    cards.innerHTML='<div class="profile-card">正在读取该日期赛程…</div>';
    const result=await jcFetchDateRows(ds,true);
    if(result.error){ cards.innerHTML='<div class="profile-card">该日期数据暂时读取失败，请稍后重试。</div>'; return; }
    allRows=(result.data||[]).filter(m=>m.match_date);
    await jcAttachModels(allRows);
    selectedDate=ds;
    activeLeague='全部';
    render();
  }

  function render(){
    const dateRows=allRows.filter(m=>jcBusinessDate(m)===selectedDate);
    if(activeLeague!=='全部' && !dateRows.some(m=>leagueKey(m)===activeLeague)) activeLeague='全部';
    const filtered=activeLeague==='全部'?dateRows:dateRows.filter(m=>leagueKey(m)===activeLeague);

    if(label){
      const d=new Date(selectedDate+'T12:00:00+08:00');
      label.textContent=selectedDate.slice(5)+' '+d.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',weekday:'short'});
    }
    if(leagueToggle){
      leagueToggle.textContent=activeLeague==='全部'?'赛事':activeLeague;
      leagueToggle.title=activeLeague==='全部'?'选择赛事':'当前：'+activeLeague;
    }

    renderLeagueMenu(dateRows);
    cards.innerHTML=jcRenderFootballCards(filtered,today,access);
    setUrlDate(selectedDate);
    if(!dateLocked){
      qcRenderDateCalendar(selectedDate,availableDates,ds=>{
        closeLeague();
        loadFootballDate(ds);
      });
    }
  }

  if(!dateLocked){
    if(prev) prev.onclick=()=>{
      selectedDate=qcAddDays(selectedDate,-1);
      activeLeague='全部';
      closeLeague();
      loadFootballDate(selectedDate);
    };
    if(next) next.onclick=()=>{
      selectedDate=qcAddDays(selectedDate,1);
      activeLeague='全部';
      closeLeague();
      loadFootballDate(selectedDate);
    };
    if(todayBtn) todayBtn.onclick=()=>{
      selectedDate=today;
      activeLeague='全部';
      closeLeague();
      loadFootballDate(selectedDate);
    };
    if(label) label.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();
      qcRenderDateCalendar(selectedDate,availableDates,ds=>{
        loadFootballDate(ds);
      });
      if(datePop) datePop.hidden=!datePop.hidden;
      closeLeague();
    };
  }
  if(leagueToggle) leagueToggle.onclick=e=>{
    e.preventDefault();
    e.stopPropagation();
    if(datePop) datePop.hidden=true;
    if(leaguePop){
      leaguePop.hidden=!leaguePop.hidden;
      leagueToggle.setAttribute('aria-expanded',String(!leaguePop.hidden));
    }
  };

  document.addEventListener('click',e=>{
    if(datePop && !datePop.hidden && e.target!==label && !datePop.contains(e.target)) datePop.hidden=true;
    if(leaguePop && !leaguePop.hidden && e.target!==leagueToggle && !leaguePop.contains(e.target)) closeLeague();
  });

  render();

  async function refreshFootballLive(){
    const dateRows=allRows.filter(m=>jcBusinessDate(m)===selectedDate);
    await jcAttachLiveScores(dateRows);
    render();
  }
  refreshFootballLive();
  if(window.__jcFootballLiveTimer) clearInterval(window.__jcFootballLiveTimer);
  window.__jcFootballLiveTimer=setInterval(refreshFootballLive,300000);
}

async function loadJcFrontend(){
  const cards=$('#jcLiveCards');
  const reviewCards=$('#jcYesterdayCards');
  if(!cards || !window.qcSupabase) return;

  const initialToday=qcBeijingToday();
  const initialYesterday=qcAddDays(initialToday,-1);
  const initialDate=new URLSearchParams(location.search).get('date');
  const cacheKey='qc-finished-review-'+initialYesterday;
  let cachedReviewShown=false;
  if(!initialDate || initialDate===initialToday){
    const dateLabel=$('#jcDateLabel');
    if(dateLabel) dateLabel.textContent=qcDateLabel(initialToday);
    try{
      const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');
      if(Array.isArray(cached?.rows) && cached.rows.length &&
        cached.rows.every(m=>jcBusinessDate(m)===initialYesterday && jcScoreInfo(m).finished)){
        reviewCards.innerHTML=jcRenderYesterdayReview(cached.rows,initialToday);
        jcBindOverviewRows(reviewCards);
        cachedReviewShown=true;
        const meta=$('#jcYesterdayMeta');
        if(meta) meta.textContent=initialYesterday.slice(5)+' · '+cached.rows.length+'场';
      }
    }catch(err){ console.warn('昨日赛果缓存不可用',err); }
  }

  const accessPromise=qcGetAccessState();
  const requestedDate=initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)?initialDate:initialToday;
  const requestedPrevious=qcAddDays(requestedDate,-1);
  const [currentResult,previousResult,availableDates]=await Promise.all([
    jcFetchDateRows(requestedDate,false),
    jcFetchDateRows(requestedPrevious,false),
    jcFetchAvailableDates()
  ]);
  const data=[...(currentResult.data||[]),...(previousResult.data||[])];
  const error=currentResult.error||previousResult.error;

  if(error){
    console.error('读取竞彩前台数据失败',error);
    cards.innerHTML='<div class="profile-card">竞彩数据暂时读取失败，请稍后刷新。</div>';
    if(reviewCards && !cachedReviewShown) reviewCards.innerHTML='<div class="jc-review-empty">昨日回看暂时读取失败</div>';
    return;
  }

  let allRows=(data||[]).filter(m=>m.match_date);
  const access=await accessPromise;
  const today=initialToday;
  const paramDate=new URLSearchParams(location.search).get('date');
  const dateLocked=!access.loggedIn;
  let selectedDate=dateLocked
    ? today
    : (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)?paramDate:today);
  let activeLeague='全部';
  let modelsLoaded=false;

  const label=$('#jcDateLabel');
  const prev=$('#jcPrevDate');
  const next=$('#jcNextDate');
  const todayBtn=$('#jcTodayBtn');
  const pop=$('#jcDatePopover');
  const leagueToggle=$('#jcLeagueToggle');
  const leaguePop=$('#jcLeaguePopover');

  if(dateLocked){
    [prev,next,todayBtn,label].filter(Boolean).forEach(el=>{
      el.disabled=true;
      el.setAttribute('aria-disabled','true');
      el.classList.add('qc-date-locked-control');
    });
    if(pop) pop.hidden=true;
  }

  function setUrlDate(ds){
    const u=new URL(location.href);
    if(dateLocked) u.searchParams.delete('date');
    else u.searchParams.set('date',ds);
    history.replaceState({},'',u);
  }

  async function loadFrontendDateBundle(ds){
    cards.innerHTML='<div class="profile-card">正在读取该日期赛程…</div>';
    if(reviewCards) reviewCards.innerHTML='<div class="jc-review-empty">正在读取昨日赛果…</div>';
    const prev=qcAddDays(ds,-1);
    const [currentResult,previousResult]=await Promise.all([
      jcFetchDateRows(ds,false),
      jcFetchDateRows(prev,false)
    ]);
    if(currentResult.error||previousResult.error){
      cards.innerHTML='<div class="profile-card">该日期数据暂时读取失败，请稍后重试。</div>';
      return;
    }
    allRows=[...(currentResult.data||[]),...(previousResult.data||[])].filter(m=>m.match_date);
    await jcAttachModels(allRows);
    selectedDate=ds;
    activeLeague='全部';
    modelsLoaded=true;
    render();
  }

  function render(){
    const dateRows=allRows.filter(m=>jcBusinessDate(m)===selectedDate);
    const previousDate=qcAddDays(selectedDate,-1);
    const previousRows=allRows.filter(m=>jcBusinessDate(m)===previousDate);
    const filtered=dateRows;

    if(label) label.textContent=qcDateLabel(selectedDate);
    if($('#jcPredictionMeta')) $('#jcPredictionMeta').textContent=(selectedDate===today?'今日竞彩日':'竞彩日')+' · '+dateRows.length+'场';
    if($('#jcPredictionCount')) $('#jcPredictionCount').textContent=filtered.length+'场';
    if($('#jcYesterdayMeta')) $('#jcYesterdayMeta').textContent=previousDate.slice(5)+' · '+previousRows.length+'场';
    if($('#jcPredictionTitle')) $('#jcPredictionTitle').textContent=selectedDate===today?'今日预测':'当日赛程';

    try{
      if(reviewCards){
        reviewCards.innerHTML=jcRenderYesterdayReview(previousRows,today);
        jcBindOverviewRows(reviewCards);
        if(modelsLoaded && previousDate===initialYesterday && previousRows.length &&
          previousRows.every(m=>jcScoreInfo(m).finished)){
          try{
            const finished=previousRows.map(m=>({
              id:m.id,match_num:m.match_num,business_date:m.business_date,
              league_name:m.league_name,league_short_name:m.league_short_name,
              home_team_name:m.home_team_name,away_team_name:m.away_team_name,
              match_date:m.match_date,match_time:m.match_time,match_status:m.match_status,
              raw:{sectionsNo999:m.raw?.sectionsNo999,sectionsNo1:m.raw?.sectionsNo1},
              _apiFootballLive:m._apiFootballLive,jc_model_outputs:m.jc_model_outputs
            }));
            localStorage.setItem(cacheKey,JSON.stringify({rows:finished}));
          }catch(err){ console.warn('昨日赛果缓存写入失败',err); }
        }
      }
    }catch(err){
      console.error('昨日回看渲染失败',err);
      if(reviewCards) reviewCards.innerHTML='<div class="jc-review-empty">昨日回看暂时无法显示</div>';
    }

    try{
      const premiumDate=selectedDate>=today;
      if(premiumDate && !access.isPro){
        cards.innerHTML=qcPremiumGateHtml(access,'prediction');
      }else{
        cards.innerHTML=jcRenderOverviewTable(filtered,today,'today');
        jcBindOverviewRows(cards);
      }
    }catch(err){
      console.error('今日预测渲染失败',err);
      cards.innerHTML='<div class="profile-card">今日预测列表暂时无法显示</div>';
    }

    try{ setUrlDate(selectedDate); }catch(err){ console.warn('日期URL更新失败',err); }

    try{
      if(!dateLocked){
        qcRenderDateCalendar(selectedDate,availableDates,(ds)=>{
          loadFrontendDateBundle(ds);
        });
      }
    }catch(err){ console.error('日期日历渲染失败',err); }
  }

  if(!dateLocked){
    if(prev) prev.onclick=()=>{loadFrontendDateBundle(qcAddDays(selectedDate,-1));};
    if(next) next.onclick=()=>{loadFrontendDateBundle(qcAddDays(selectedDate,1));};
    if(todayBtn) todayBtn.onclick=()=>{loadFrontendDateBundle(today);};
    if(label) label.onclick=()=>{
      qcRenderDateCalendar(selectedDate,availableDates,(ds)=>{
        loadFrontendDateBundle(ds);
      });
      if(pop) pop.hidden=!pop.hidden;
    };
  }

  document.addEventListener('click',e=>{
    if(pop && !pop.hidden && e.target!==label && !pop.contains(e.target)) pop.hidden=true;
  });

  render();

  async function refreshOverviewLive(){
    const dateRows=allRows.filter(m=>jcBusinessDate(m)===selectedDate);
    const previousDate=qcAddDays(selectedDate,-1);
    const reviewRows=allRows.filter(m=>jcBusinessDate(m)===previousDate);
    await jcAttachLiveScores([...dateRows,...reviewRows]);
    render();
  }
  jcAttachModels(allRows).then(()=>{ modelsLoaded=true; render(); }).catch(err=>console.warn('首页模型读取失败',err));
  refreshOverviewLive();
  if(window.__jcOverviewLiveTimer) clearInterval(window.__jcOverviewLiveTimer);
  window.__jcOverviewLiveTimer=setInterval(refreshOverviewLive,300000);
}


const JC_FIXED_ODDS_TEMPLATE = Object.freeze({
  had: Object.freeze([
    Object.freeze({key:'h',label:'主胜'}),
    Object.freeze({key:'d',label:'平局'}),
    Object.freeze({key:'a',label:'客胜'})
  ]),
  ttg: Object.freeze([
    Object.freeze({key:'s0',label:'0'}),
    Object.freeze({key:'s1',label:'1'}),
    Object.freeze({key:'s2',label:'2'}),
    Object.freeze({key:'s3',label:'3'}),
    Object.freeze({key:'s4',label:'4'}),
    Object.freeze({key:'s5',label:'5'}),
    Object.freeze({key:'s6',label:'6'}),
    Object.freeze({key:'s7',label:'7+'})
  ]),
  hafu: Object.freeze([
    Object.freeze({key:'hh',label:'胜胜'}),
    Object.freeze({key:'hd',label:'胜平'}),
    Object.freeze({key:'ha',label:'胜负'}),
    Object.freeze({key:'dh',label:'平胜'}),
    Object.freeze({key:'dd',label:'平平'}),
    Object.freeze({key:'da',label:'平负'}),
    Object.freeze({key:'ah',label:'负胜'}),
    Object.freeze({key:'ad',label:'负平'}),
    Object.freeze({key:'aa',label:'负负'})
  ]),
  crs: Object.freeze({
    home: Object.freeze([[1,0],[2,0],[2,1],[3,0],[3,1],[3,2],[4,0],[4,1],[4,2],[5,0],[5,1],[5,2]]),
    draw: Object.freeze([[0,0],[1,1],[2,2],[3,3]]),
    away: Object.freeze([[0,1],[0,2],[1,2],[0,3],[1,3],[2,3],[0,4],[1,4],[2,4],[0,5],[1,5],[2,5]])
  })
});

function jcPoolHistory(snapshots,code){
  return (snapshots||[])
    .filter(s=>s.pool_code===code)
    .sort((a,b)=>new Date(a.captured_at||0)-new Date(b.captured_at||0));
}

function jcTrendFromHistory(history,key){
  if(!history || history.length<2) return '';
  const a=Number(history[history.length-2]?.outcomes?.[key]);
  const b=Number(history[history.length-1]?.outcomes?.[key]);
  if(!Number.isFinite(a)||!Number.isFinite(b)||a===b) return '';
  return b>a?'up':'down';
}

function jcTrendFromRaw(pool,key){
  const v=Number(pool?.raw?.[key+'f']);
  if(!Number.isFinite(v) || v===0) return '';
  return v>0?'up':'down';
}

function jcTrendMark(pool,key,history){
  const t=jcTrendFromHistory(history,key) || jcTrendFromRaw(pool,key);
  return t==='up'
    ? '<span class="jc-trend up">▲</span>'
    : t==='down'
      ? '<span class="jc-trend down">▼</span>'
      : '';
}

function jcFmtOdd(v){
  const n=Number(v);
  if(!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

function jcOddCell(pool,key,history){
  if(!pool || pool.outcomes?.[key]==null) return '<span class="jc-odd-empty">—</span>';
  return '<strong>'+jcFmtOdd(pool.outcomes[key])+'</strong>'+jcTrendMark(pool,key,history);
}

function jcRenderHadDetail(pools,snapshots){
  const had=pools.had;
  const hhad=pools.hhad;
  const hadHist=jcPoolHistory(snapshots,'had');
  const hhadHist=jcPoolHistory(snapshots,'hhad');
  return '<section class="jc-odds-section">'+
    '<div class="jc-section-title-row"><h2>赔率</h2><span>当前</span></div>'+
    '<div class="jc-odds-table">'+
      '<div class="jc-odds-head"><span>玩法</span><span>主胜</span><span>平局</span><span>客胜</span></div>'+
      '<div class="jc-odds-row"><b class="jc-play-tag blue">胜平负</b><span>'+jcOddCell(had,'h',hadHist)+'</span><span>'+jcOddCell(had,'d',hadHist)+'</span><span>'+jcOddCell(had,'a',hadHist)+'</span></div>'+
      '<div class="jc-odds-row"><b class="jc-play-tag orange">让球胜平负 '+(hhad?.goal_line?qcEscape(hhad.goal_line):'')+'</b><span>'+jcOddCell(hhad,'h',hhadHist)+'</span><span>'+jcOddCell(hhad,'d',hhadHist)+'</span><span>'+jcOddCell(hhad,'a',hhadHist)+'</span></div>'+
    '</div>'+
  '</section>';
}

function jcCrsKey(home,away){
  return 's'+String(home).padStart(2,'0')+'s'+String(away).padStart(2,'0');
}

function jcScoreItem(pool,key,label,history){
  return '<div class="jc-score-odd"><b>'+qcEscape(label)+'</b><span>'+jcFmtOdd(pool?.outcomes?.[key])+jcTrendMark(pool,key,history)+'</span></div>';
}

function jcRenderHhadDetail(pools,snapshots){
  const pool=pools?.hhad;
  const hist=jcPoolHistory(snapshots,'hhad');
  return '<section class="jc-odds-section">'+
    '<div class="jc-section-title-row"><h2>让球胜平负</h2><span>'+(pool?.goal_line?('让球 '+qcEscape(pool.goal_line)):'当前')+'</span></div>'+
    '<div class="jc-odds-table">'+
      '<div class="jc-odds-head"><span>玩法</span><span>主胜</span><span>平局</span><span>客胜</span></div>'+
      '<div class="jc-odds-row"><b class="jc-play-tag orange">让球胜平负 '+(pool?.goal_line?qcEscape(pool.goal_line):'')+'</b><span>'+jcOddCell(pool,'h',hist)+'</span><span>'+jcOddCell(pool,'d',hist)+'</span><span>'+jcOddCell(pool,'a',hist)+'</span></div>'+
    '</div>'+
  '</section>';
}


function jcRenderCrsDetail(pool,snapshots){
  const hist=jcPoolHistory(snapshots,'crs');
  const tpl=JC_FIXED_ODDS_TEMPLATE.crs;
  const group=(items,specialKey,specialLabel)=>items.map(([h,a])=>jcScoreItem(pool,jcCrsKey(h,a),h+'-'+a,hist)).join('')+
    jcScoreItem(pool,specialKey,specialLabel,hist);

  return '<section class="jc-odds-section"><h2>比分</h2>'+
    '<div class="jc-score-band"><div class="jc-score-band-label">主胜比分</div><div class="jc-score-group home-win">'+group(tpl.home,'s1sh','胜其它')+'</div></div>'+
    '<div class="jc-score-band"><div class="jc-score-band-label">平局比分</div><div class="jc-score-group draw">'+group(tpl.draw,'s1sd','平其它')+'</div></div>'+
    '<div class="jc-score-band"><div class="jc-score-band-label">客胜比分</div><div class="jc-score-group away-win">'+group(tpl.away,'s1sa','负其它')+'</div></div>'+
  '</section>';
}

function jcRenderTtgDetail(pool,snapshots){
  const hist=jcPoolHistory(snapshots,'ttg');
  return '<section class="jc-odds-section"><h2>总进球数</h2>'+
    '<div class="jc-ttg-grid">'+JC_FIXED_ODDS_TEMPLATE.ttg.map(item=>
      '<div class="jc-ttg-item"><b>'+item.label+'</b><span>'+jcFmtOdd(pool?.outcomes?.[item.key])+jcTrendMark(pool,item.key,hist)+'</span></div>'
    ).join('')+'</div>'+
  '</section>';
}

function jcRenderHafuDetail(pool,snapshots){
  const hist=jcPoolHistory(snapshots,'hafu');
  return '<section class="jc-odds-section"><h2>半全场胜平负</h2>'+
    '<div class="jc-hafu-grid">'+JC_FIXED_ODDS_TEMPLATE.hafu.map(item=>
      '<div class="jc-hafu-item"><b>'+item.label+'</b><span>'+jcFmtOdd(pool?.outcomes?.[item.key])+jcTrendMark(pool,item.key,hist)+'</span></div>'
    ).join('')+'</div>'+
  '</section>';
}

function jcSnapshotDateTime(s){
  const rd=s?.raw?.updateDate || '';
  const rt=s?.raw?.updateTime || s?.official_update_time || '';
  if(rd || rt) return (rd+' '+rt).trim();
  if(!s?.captured_at) return '—';
  return new Date(s.captured_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
}

function jcRenderOddsHistory(snapshots,preferredCode='had'){
  let code=preferredCode==='hhad'?'hhad':'had';
  let hist=jcPoolHistory(snapshots,code);
  if(!hist.length){ code=code==='had'?'hhad':'had'; hist=jcPoolHistory(snapshots,code); }
  if(!hist.length) return '<section class="jc-odds-section"><h2>赔率变化</h2><div class="jc-empty-market">暂无历史快照</div></section>';

  return '<section class="jc-odds-section"><h2>赔率变化</h2>'+
    '<div class="jc-history-table">'+
      '<div class="jc-history-head"><span>时间</span><span>主胜</span><span>平局</span><span>客胜</span></div>'+
      hist.slice(-12).reverse().map(s=>
        '<div class="jc-history-row"><span>'+qcEscape(jcSnapshotDateTime(s))+'</span><strong>'+jcFmtOdd(s.outcomes?.h)+'</strong><strong>'+jcFmtOdd(s.outcomes?.d)+'</strong><strong>'+jcFmtOdd(s.outcomes?.a)+'</strong></div>'
      ).join('')+
    '</div>'+
    '<div class="jc-history-note">'+(code==='had'?'胜平负':'让球胜平负')+' · 每次官方赔率变化后自动增加一条记录</div>'+
  '</section>';
}



function jcRenderOddsPlayShell(pools,snapshots,active='had'){
  return '<div class="jc-odds-play-shell">'+
    '<div class="jc-odds-play-tabs">'+
      '<button type="button" class="'+(active==='had'?'active':'')+'" data-odds-play="had">胜平负</button>'+

      '<button type="button" class="'+(active==='crs'?'active':'')+'" data-odds-play="crs">比分</button>'+
      '<button type="button" class="'+(active==='ttg'?'active':'')+'" data-odds-play="ttg">总进球数</button>'+
      '<button type="button" class="'+(active==='hafu'?'active':'')+'" data-odds-play="hafu">半全场</button>'+
    '</div>'+
    '<div id="jcOddsPlayPanel">'+jcRenderOddsPlayPanel(active,pools,snapshots)+'</div>'+
    '<div class="jc-source-line">数据来源：中国体育彩票竞彩足球移动端官方链路</div>'+
  '</div>';
}

function jcRenderOddsPlayPanel(tab,pools,snapshots){
  if(tab==='hhad') return jcRenderHhadDetail(pools,snapshots)+jcRenderOddsHistory(snapshots,'hhad');
  if(tab==='crs') return jcRenderCrsDetail(pools.crs,snapshots);
  if(tab==='ttg') return jcRenderTtgDetail(pools.ttg,snapshots);
  if(tab==='hafu') return jcRenderHafuDetail(pools.hafu,snapshots);
  return jcRenderHadDetail(pools,snapshots)+jcRenderOddsHistory(snapshots,'had');
}

function jcBindOddsPlayTabs(root,pools,snapshots){
  if(!root) return;
  const panel=$('#jcOddsPlayPanel',root) || $('#jcOddsPlayPanel');
  const buttons=$$('.jc-odds-play-tabs button',root);
  buttons.forEach(btn=>{
    btn.onclick=e=>{
      e.preventDefault();
      const tab=btn.dataset.oddsPlay || 'had';
      buttons.forEach(b=>b.classList.toggle('active',b===btn));
      if(panel) panel.innerHTML=jcRenderOddsPlayPanel(tab,pools,snapshots);
    };
  });
}


function jcApiStatusText(s){
  const code=s?.short || '';
  const map={NS:'未开赛','1H':'上半场',HT:'半场','2H':'下半场',ET:'加时',BT:'加时休息',P:'点球',FT:'已结束',AET:'加时结束',PEN:'点球结束',PST:'延期',CANC:'取消',ABD:'中止',INT:'中断'};
  const base=map[code] || s?.long || '状态待更新';
  return s?.elapsed ? base+' · '+s.elapsed+"'" : base;
}

function jcStatZh(type){
  const map={
    'Ball Possession':'控球率',
    'Total Shots':'总射门',
    'Shots on Goal':'射正',
    'Shots off Goal':'射偏',
    'Shots insidebox':'禁区内射门',
    'Shots outsidebox':'禁区外射门',
    'Corner Kicks':'角球',
    'Fouls':'犯规',
    'Yellow Cards':'黄牌',
    'Red Cards':'红牌',
    'Goalkeeper Saves':'扑救',
    'Total passes':'传球',
    'Passes accurate':'成功传球',
    'Passes %':'传球成功率',
    'expected_goals':'预期进球(xG)'
  };
  return map[type] || type;
}

function jcRenderFactsData(data){
  const home=data?.teams?.home?.name || '主队';
  const away=data?.teams?.away?.name || '客队';
  const hs=data?.goals?.home;
  const as=data?.goals?.away;
  const venue=[data?.venue?.name,data?.venue?.city].filter(Boolean).join(' · ') || '—';
  const round=data?.league?.round || '—';
  const referee=data?.referee || '—';
  const events=Array.isArray(data?.events)?data.events:[];

  return '<div class="jc-facts-panel">'+
    '<div class="jc-facts-score"><div><b>'+qcEscape(home)+'</b></div><div class="jc-facts-score-center"><strong>'+((hs==null||as==null)?'VS':qcEscape(hs)+' - '+qcEscape(as))+'</strong><span>'+qcEscape(jcApiStatusText(data?.status))+'</span></div><div class="right"><b>'+qcEscape(away)+'</b></div></div>'+
    '<div class="jc-facts-kpis">'+
      '<div><span>赛事</span><b>'+qcEscape(data?.league?.name || '—')+'</b></div>'+
      '<div><span>轮次</span><b>'+qcEscape(round)+'</b></div>'+
      '<div><span>场地</span><b>'+qcEscape(venue)+'</b></div>'+
      '<div><span>裁判</span><b>'+qcEscape(referee)+'</b></div>'+
    '</div>'+
    '<h3>比赛事件</h3>'+
    (events.length
      ? '<div class="jc-event-list">'+events.map(ev=>{
          const tm=(ev?.time?.elapsed ?? '')+(ev?.time?.extra?('+'+ev.time.extra):'');
          const who=ev?.player?.name || ev?.team?.name || '';
          const detail=[ev?.type,ev?.detail].filter(Boolean).join(' · ');
          return '<div class="jc-event-item"><time>'+qcEscape(tm)+"'</time><b>"+qcEscape(who)+'</b><span>'+qcEscape(detail)+'</span></div>';
        }).join('')+'</div>'
      : '<div class="jc-empty-market">未开赛；比赛开始后这里会自动出现进球、红黄牌、换人等事件。</div>')+
  '</div>';
}

function jcRenderFactsLineups(data){
  const lineups=Array.isArray(data?.lineups)?data.lineups:[];
  if(!lineups.length) return '<div class="jc-empty-market">阵容尚未发布；官方数据返回后会自动显示首发、替补和阵型。</div>';
  return '<div class="jc-lineups-grid">'+lineups.map(team=>{
    const starters=Array.isArray(team?.startXI)?team.startXI:[];
    const subs=Array.isArray(team?.substitutes)?team.substitutes:[];
    return '<section class="jc-lineup-card"><h3>'+qcEscape(team?.team?.name || '球队')+' <small>'+qcEscape(team?.formation || '')+'</small></h3>'+
      '<b>首发</b><div class="jc-player-list">'+starters.map(x=>'<span>'+qcEscape(x?.player?.number || '')+' '+qcEscape(x?.player?.name || '—')+'</span>').join('')+'</div>'+
      '<b>替补</b><div class="jc-player-list">'+subs.slice(0,12).map(x=>'<span>'+qcEscape(x?.player?.number || '')+' '+qcEscape(x?.player?.name || '—')+'</span>').join('')+'</div>'+
    '</section>';
  }).join('')+'</div>';
}

function jcRenderFactsStats(data){
  const stats=Array.isArray(data?.statistics)?data.statistics:[];
  if(!stats.length) return '<div class="jc-empty-market">技术统计尚未返回；比赛进行后会自动更新控球率、射门、角球等数据。</div>';

  const teams=stats.slice(0,2);
  const byType={};
  teams.forEach((team,idx)=>{
    (team?.statistics||[]).forEach(s=>{
      if(!byType[s.type]) byType[s.type]=['—','—'];
      byType[s.type][idx]=s.value ?? '—';
    });
  });

  const preferred=['Ball Possession','expected_goals','Total Shots','Shots on Goal','Shots insidebox','Corner Kicks','Fouls','Yellow Cards'];
  const keys=[...preferred.filter(k=>byType[k]),...Object.keys(byType).filter(k=>!preferred.includes(k)).slice(0,6)];
  return '<div class="jc-stats-table">'+
    '<div class="jc-stats-head"><b>'+qcEscape(teams[0]?.team?.name || '主队')+'</b><span>技术统计</span><b>'+qcEscape(teams[1]?.team?.name || '客队')+'</b></div>'+
    keys.map(k=>'<div class="jc-stats-row"><strong>'+qcEscape(byType[k]?.[0] ?? '—')+'</strong><span>'+qcEscape(jcStatZh(k))+'</span><strong>'+qcEscape(byType[k]?.[1] ?? '—')+'</strong></div>').join('')+
  '</div>';
}

function jcSportteryDetailsMap(rows){
  const map={};
  (rows||[]).forEach(x=>{ if(x?.detail_type) map[x.detail_type]=x.payload||{}; });
  return map;
}

function jcSportteryValue(details,type){
  const p=details?.[type];
  return p?.value ?? p ?? null;
}

function jcRenderFeatureBlock(m,details,apiData){
  const feature=jcSportteryValue(details,'feature') || {};
  const live=jcSportteryValue(details,'live') || {};
  const score=jcScoreInfo(m);
  const last=feature.last || {};
  const goal=feature.goalAvg || {};
  const loss=feature.lossGoalAvg || {};
  const recent=feature.eachSameHomeAway || feature.eachHomeAway || {};

  const stat=(label,home,away)=>'<div class="jc-stat-pair"><span>'+qcEscape(label)+'</span><strong>'+qcEscape(home ?? '—')+'</strong><strong>'+qcEscape(away ?? '—')+'</strong></div>';

  return '<div class="jc-facts-panel">'+
    '<div class="jc-facts-score"><div><b>'+qcEscape(m.home_team_name||'主队')+'</b></div>'+
      '<div class="jc-facts-score-center"><strong>'+(score.ft?qcEscape(score.ft):'VS')+'</strong><span>'+qcEscape(jcMatchStatusLabel(m,qcBeijingToday()))+'</span></div>'+
      '<div class="right"><b>'+qcEscape(m.away_team_name||'客队')+'</b></div></div>'+
    '<div class="jc-facts-kpis">'+
      '<div><span>竞彩编号</span><b>'+qcEscape(m.match_num||'—')+'</b></div>'+
      '<div><span>比赛时间</span><b>'+qcEscape(jcDateTime(m)||'—')+'</b></div>'+
      '<div><span>半场比分</span><b>'+qcEscape(score.ht||live.sectionsNo1||'—')+'</b></div>'+
      '<div><span>全场比分</span><b>'+qcEscape(score.ft||live.sectionsNo999||'—')+'</b></div>'+
    '</div>'+
    '<div class="jc-section-title-row"><h2>赛事前瞻</h2><span>竞彩网</span></div>'+
    '<div class="jc-stat-pairs">'+
      stat('近况得分率',last.homeScoreRatio?last.homeScoreRatio+'%':'—',last.awayScoreRatio?last.awayScoreRatio+'%':'—')+
      stat('场均进球',goal.homeGoalAvgCnt,goal.awayGoalAvgCnt)+
      stat('场均失球',loss.homeLossGoalAvgCnt,loss.awayLossGoalAvgCnt)+
      stat('近期胜场',recent.homeWinGoalMatchCnt,recent.awayWinGoalMatchCnt)+
      stat('近期平场',recent.homeDrawMatchCnt,recent.awayDrawMatchCnt)+
      stat('近期负场',recent.homeLossGoalMatchCnt,recent.awayLossGoalMatchCnt)+
    '</div>'+
    (apiData?jcRenderFactsData(apiData):'')+
  '</div>';
}

function jcRenderSportteryLineups(m,details,apiData){
  const players=jcSportteryValue(details,'players') || {};
  const injuries=jcSportteryValue(details,'injuries') || {};
  const apiLineups=apiData && Array.isArray(apiData.lineups) && apiData.lineups.length ? jcRenderFactsLineups(apiData) : '';

  function teamBlock(side,label,name){
    const plist=Array.isArray(players?.[side]?.playerList)?players[side].playerList:[];
    const ilist=Array.isArray(injuries?.[side]?.injuriesAndSuspensionsList)?injuries[side].injuriesAndSuspensionsList:[];
    return '<section class="jc-lineup-card"><h3>'+qcEscape(name||label)+'</h3>'+
      '<b>球员信息</b>'+
      (plist.length?'<div class="jc-player-list">'+plist.slice(0,18).map(p=>'<span>'+qcEscape((p.uniformNo||'')+' '+(p.personName||p.playerName||'—'))+'</span>').join('')+'</div>':'<div class="jc-empty-inline">暂无球员名单</div>')+
      '<b>伤停</b>'+
      (ilist.length?'<div class="jc-injury-list">'+ilist.map(p=>'<div><strong>'+qcEscape(p.personName||'—')+'</strong><span>'+qcEscape(p.playerPositionDesc||p.playerPositionCode||'')+'</span><em>'+(p.suspensionFlag?'停赛':'伤缺')+'</em></div>').join('')+'</div>':'<div class="jc-empty-inline">暂无伤停记录</div>')+
    '</section>';
  }

  return (apiLineups?'<div class="jc-api-block"><div class="jc-section-title-row"><h2>预计/正式阵容</h2><span>API-Football</span></div>'+apiLineups+'</div>':'')+
    '<div class="jc-section-title-row"><h2>球员与伤停</h2><span>竞彩网</span></div>'+
    '<div class="jc-lineups-grid">'+teamBlock('home','主队',m.home_team_name)+teamBlock('away','客队',m.away_team_name)+'</div>';
}

function jcRenderStandings(m,details){
  const s=jcSportteryValue(details,'standings') || {};
  const home=s?.homeTables?.total || s?.homeTables?.home || {};
  const away=s?.awayTables?.total || s?.awayTables?.away || {};
  const row=(label,a,b)=>'<div class="jc-stats-row"><strong>'+qcEscape(a ?? '—')+'</strong><span>'+qcEscape(label)+'</span><strong>'+qcEscape(b ?? '—')+'</strong></div>';
  return '<div class="jc-stats-table">'+
    '<div class="jc-stats-head"><b>'+qcEscape(m.home_team_name||'主队')+'</b><span>联赛排名</span><b>'+qcEscape(m.away_team_name||'客队')+'</b></div>'+
    row('排名',home.ranking,away.ranking)+
    row('积分',home.points,away.points)+
    row('场次',home.totalLegCnt,away.totalLegCnt)+
    row('胜',home.winGoalMatchCnt,away.winGoalMatchCnt)+
    row('平',home.drawMatchCnt,away.drawMatchCnt)+
    row('负',home.lossGoalMatchCnt,away.lossGoalMatchCnt)+
    row('进球',home.goalCnt,away.goalCnt)+
    row('失球',home.lossGoalCnt,away.lossGoalCnt)+
    row('净胜球',home.netGoal,away.netGoal)+
  '</div>';
}

function jcRenderH2H(m,details){
  const h=jcSportteryValue(details,'h2h') || {};
  const list=Array.isArray(h.matchList)?h.matchList:[];
  if(!list.length) return '<div class="jc-empty-market">暂无历史对决数据。</div>';
  return '<div class="jc-h2h-list">'+list.slice(0,10).map(x=>
    '<div class="jc-h2h-row">'+
      '<time>'+qcEscape(x.matchDate||'—')+'</time>'+
      '<span>'+qcEscape(x.homeTeamShortName||'主队')+'</span>'+
      '<strong>'+qcEscape(String(x.fullCourtGoal||'—').replace(':','-'))+'</strong>'+
      '<span>'+qcEscape(x.awayTeamShortName||'客队')+'</span>'+
      '<small>半 '+qcEscape(String(x.halfTimeGoal||'—').replace(':','-'))+'</small>'+
    '</div>'
  ).join('')+'</div>';
}

function jcRenderTechnicalStats(apiData){
  if(apiData && Array.isArray(apiData.statistics) && apiData.statistics.length){
    return jcRenderFactsStats(apiData);
  }
  return '<div class="jc-empty-market">技术统计将在比赛开始后由实时数据源更新；当前竞彩网采集到的是前瞻、排名、球员、伤停和历史对决。</div>';
}

function jcRenderFactsShell(){
  return '<div class="jc-facts-subtabs">'+
    '<button type="button" class="active" data-facts-tab="data">数据</button>'+
    '<button type="button" data-facts-tab="lineups">阵容</button>'+
    '<button type="button" data-facts-tab="standings">排名</button>'+
    '<button type="button" data-facts-tab="stats">技术统计</button>'+
    '<button type="button" data-facts-tab="h2h">历史交锋</button>'+
  '</div>'+
  '<div id="jcFactsContent"><div class="profile-card">正在读取赛况数据…</div></div>';
}

function jcRenderAiLockedPanel(m,pools,access){
  const poolCount=['had','hhad','crs','ttg','hafu'].filter(k=>pools?.[k]).length;
  return '<div class="jc-ai-placeholder jc-ai-page jc-ai-locked">'+
    '<h2>'+qcEscape(m.home_team_name || '主队')+' vs '+qcEscape(m.away_team_name || '客队')+'｜赛前分析报告</h2>'+
    '<div class="jc-ai-lock-note">'+
      '<b>🔒 '+(access?.loggedIn?'Pro会员可查看完整分析报告':'登录后查看完整分析报告')+'</b>'+
      '<span>本页不会向未授权用户展示模型方向、单选倾向、官方让球、总进球或 TOP 比分。</span>'+
    '</div>'+
    '<div class="jc-ai-context jc-ai-context-public">'+
      '<div><span>官方竞彩玩法</span><strong>'+poolCount+'/5</strong></div>'+
      '<div><span>比赛状态</span><strong>'+qcEscape(jcMatchStatusLabel(m,qcBeijingToday()))+'</strong></div>'+
      '<div><span>比赛时间</span><strong>'+qcEscape(jcDateTime(m) || '—')+'</strong></div>'+
    '</div>'+
    '<div class="jc-ai-locked-preview" aria-hidden="true">'+
      '<div></div><div></div><div></div>'+
    '</div>'+
    qcPremiumGateHtml(access,'ai')+
  '</div>';
}

function jcRenderAiPanel(m,pools,model,analysis){
  const poolCount=['had','hhad','crs','ttg','hafu'].filter(k=>pools?.[k]).length;
  const modelReady=!!model;
  const statusText=modelReady
    ? (analysis?.status==='ready'?'AI分析已生成':analysis?.status==='generating'?'AI分析生成中':'模型已锁板，等待AI分析')
    : '等待本场模型结果写入';

  // Keep the six public model fields in the detail page identical to the overview semantics.
  // Stored model conclusions remain untouched; only the public display mapping is normalized.
  const direction=model?qcEscape(jcCompactResultPick(model.direction,m)):'待生成';
  const single=model?qcEscape(
    jcCompactResultPick(model.single_pick,m)+
    (model.raw_input?.single_prob!=null?'｜'+model.raw_input.single_prob+'%':'')
  ):'待生成';
  const handicap=model?qcEscape(jcCompactHandicapPick(model.handicap_direction)):'待生成';
  const htft=model?qcEscape([model.htft_top1,model.htft_top2].filter(Boolean).join('｜')||'待生成'):'待生成';
  const goals=model?qcEscape(jcPublicTotalGoalsText(model.goal_range)):'待生成';
  const top=model?qcEscape(jcModelTopText(model)):'待生成';

  const modelBlock=
    '<div class="jc-ai-model-summary">'+
      '<div><span>模型方向</span><b>'+direction+'</b></div>'+
      '<div><span>单选倾向</span><b>'+single+'</b></div>'+
      '<div><span>官方让球</span><b>'+handicap+'</b></div>'+
      '<div><span>半全场</span><b>'+htft+'</b></div>'+
      '<div><span>总进球</span><b>'+goals+'</b></div>'+
      '<div><span>TOP</span><b>'+top+'</b></div>'+
    '</div>';

  let analysisHtml='';
  if(analysis?.status==='ready'){
    const sections=[
      ['模型摘要',analysis.summary],
      ['实力基线',analysis.strength_baseline],
      ['近期状态',analysis.recent_form],
      ['攻防效率',analysis.attack_defense],
      ['主客场表现',analysis.home_away],
      ['阵容完整度',analysis.squad_integrity],
      ['历史交锋',analysis.h2h_analysis],
      ['市场变化',analysis.market_movement],
      ['比赛路径',analysis.match_path],
      ['综合观察',analysis.comprehensive_observation],
      ['风险因素',analysis.risk_factors]
    ];
    analysisHtml='<div class="jc-ai-report">'+sections.filter(x=>x[1]).map(([title,body])=>
      '<section class="jc-ai-report-section"><h3>'+qcEscape(title==='进球区间'?'总进球':title)+'</h3><p>'+qcEscape(jcNormalizePublicAiText(body))+'</p></section>'
    ).join('')+'</div>';
  }else{
    analysisHtml='<div class="jc-ai-wait">'+
      '<b>'+qcEscape(statusText)+'</b>'+
      '<p>锁板结果会作为固定结论，AI只负责结合官方数据、阵容、交锋和市场变化生成解释，不会改写模型方向。</p>'+
    '</div>';
  }

  return '<div class="jc-ai-placeholder jc-ai-page">'+
    '<h2>'+qcEscape(m.home_team_name || '主队')+' vs '+qcEscape(m.away_team_name || '客队')+'｜AI分析</h2>'+
    '<div class="jc-ai-status"><b>分析状态</b><span>'+qcEscape(statusText)+'</span></div>'+
    modelBlock+
    '<div class="jc-ai-context">'+
      '<div><span>官方竞彩玩法</span><strong>'+poolCount+'/5</strong></div>'+
      '<div><span>比赛状态</span><strong>'+qcEscape(jcMatchStatusLabel(m,qcBeijingToday()))+'</strong></div>'+
      '<div><span>比赛时间</span><strong>'+qcEscape(jcDateTime(m) || '—')+'</strong></div>'+
    '</div>'+
    analysisHtml+
  '</div>';
}

function jcRenderFactsFallback(m,message){
  const score=jcScoreInfo(m);
  return '<div class="jc-facts-panel">'+
    '<div class="jc-facts-score"><div><b>'+qcEscape(m.home_team_name || '主队')+'</b></div>'+
      '<div class="jc-facts-score-center"><strong>'+(score.ft?qcEscape(score.ft):'VS')+'</strong><span>'+qcEscape(jcMatchStatusLabel(m,qcBeijingToday()))+'</span></div>'+
      '<div class="right"><b>'+qcEscape(m.away_team_name || '客队')+'</b></div></div>'+
    '<div class="jc-facts-kpis">'+
      '<div><span>竞彩编号</span><b>'+qcEscape(m.match_num || '—')+'</b></div>'+
      '<div><span>联赛</span><b>'+qcEscape(m.league_name || m.league_short_name || '—')+'</b></div>'+
      '<div><span>比赛时间</span><b>'+qcEscape(jcDateTime(m) || '—')+'</b></div>'+
      '<div><span>半场比分</span><b>'+qcEscape(score.ht || '—')+'</b></div>'+
    '</div>'+
    '<div class="jc-empty-market">'+qcEscape(message || '赛况数据源正在匹配，基础赛事信息已正常显示。')+'</div>'+
  '</div>';
}

async function setupJcMatchDetail(){
  const root=$('#jcMatchDetailRoot');
  if(!root || !window.qcSupabase) return;

  const id=new URLSearchParams(location.search).get('id');
  if(!id){
    root.innerHTML='<div class="profile-card">缺少比赛参数。</div>';
    return;
  }

  const {data:m,error}=await window.qcSupabase
    .from('jc_matches')
    .select('id,match_num,business_date,league_name,league_short_name,home_team_name,away_team_name,match_date,match_time,kickoff_at,match_status,raw')
    .eq('id',id)
    .single();

  if(error || !m){
    root.innerHTML='<div class="profile-card">这场比赛暂时无法读取。</div>';
    return;
  }

  // Show the match as soon as its basic record arrives. Premium data stays hidden
  // until access has been checked.
  root.innerHTML='<div class="detail-head jc-odds-headcard">'+
    '<div class="match-top"><span>'+qcEscape(m.match_num||'')+' · '+qcEscape(m.league_name||m.league_short_name||'—')+'</span><span>'+qcEscape(jcDateTime(m)||'')+'</span></div>'+
    '<div class="detail-title jc-odds-matchup" style="margin-top:18px">'+
      '<div class="team-badge"><span class="badge-circle">主</span>'+qcEscape(m.home_team_name||'—')+'</div>'+
      '<div class="center-score"><strong>'+qcEscape(jcScoreInfo(m).current||'VS')+'</strong><small>'+qcEscape(jcMatchStatusLabel(m,qcBeijingToday()))+'</small></div>'+
      '<div class="team-badge right">'+qcEscape(m.away_team_name||'—')+'<span class="badge-circle">客</span></div></div></div>'+
    '<div class="profile-card">正在读取比赛分析…</div>';

  const [access,detailResult,snapshotResult]=await Promise.all([
    qcGetAccessState(),
    window.qcSupabase.from('jc_match_details')
      .select('detail_type,payload,source_endpoint,fetched_at').eq('jc_match_id',id),
    window.qcSupabase.from('jc_market_snapshots')
      .select('pool_code,goal_line,outcomes,raw,captured_at,official_update_time').eq('jc_match_id',id)
  ]);
  const canViewPremium=qcCanViewPrematchContent(m,access);
  const {data:detailRows,error:detailError}=detailResult;
  const {data:snapshots,error:snapshotError}=snapshotResult;

  if(detailError) console.warn('读取竞彩详情数据失败',detailError);
  if(snapshotError) console.warn('读取赔率快照失败',snapshotError);
  const sportteryDetails=jcSportteryDetailsMap(detailRows||[]);
  const snapshotRows=snapshots||[];
  m.jc_market_snapshots=snapshotRows;

  let model=null;
  let aiAnalysis=null;

  if(canViewPremium){
    const {data:modelRows,error:modelError}=await window.qcSupabase
      .from('jc_model_outputs')
      .select('id,jc_match_id,model_version,stage,direction,single_pick,handicap_direction,htft_top1,htft_top2,goal_range,top_scores,raw_input,is_current,is_locked,locked_at')
      .eq('jc_match_id',id)
      .eq('is_locked',true)
      .eq('is_current',true)
      .order('locked_at',{ascending:false})
      .limit(1);
    if(modelError) console.warn('读取模型锁板结果失败',modelError);
    model=(modelRows||[])[0]||null;

    if(model){
      const {data:aiRows,error:aiError}=await window.qcSupabase
        .from('jc_match_ai_analysis')
        .select('status,summary,strength_baseline,recent_form,attack_defense,home_away,squad_integrity,h2h_analysis,market_movement,match_path,comprehensive_observation,risk_factors,generator,generated_at')
        .eq('model_output_id',model.id)
        .order('generated_at',{ascending:false})
        .limit(1);
      if(aiError) console.warn('读取AI分析失败',aiError);
      aiAnalysis=(aiRows||[])[0]||null;
    }
  }

  const pools=jcLatestPools(snapshotRows);
  const score=jcScoreInfo(m);
  const status=score.finished && score.ht
    ? '半 '+score.ht
    : jcMatchStatusLabel(m,qcBeijingToday());

  const oddsHtml='<div class="jc-odds-detail-page">'+jcRenderOddsPlayShell(pools,snapshotRows,'had')+'</div>';

  root.innerHTML=
    '<div class="detail-head jc-odds-headcard">'+
      '<div class="match-top"><span>'+qcEscape(m.match_num || '竞彩')+' · '+qcEscape(m.league_name || m.league_short_name || '—')+'</span><span>'+qcEscape(jcDateTime(m) || '时间待定')+'</span></div>'+
      '<div class="detail-title jc-odds-matchup" style="margin-top:18px">'+
        '<div class="team-badge"><span class="badge-circle">主</span>'+qcEscape(m.home_team_name || '—')+'</div>'+
        '<div class="center-score"><strong>'+(score.current?qcEscape(score.current):'VS')+'</strong><small class="'+(score.started&&!score.finished?'jc-live-stage':'')+'">'+qcEscape(status)+'</small></div>'+
        '<div class="team-badge right">'+qcEscape(m.away_team_name || '—')+'<span class="badge-circle">客</span></div>'+
      '</div>'+
      '<div class="jc-main-tabs">'+
        '<button type="button" data-main-tab="facts">赛况数据</button>'+
        '<button type="button" data-main-tab="odds">赔率详情</button>'+
        '<button type="button" class="active" data-main-tab="ai">AI分析</button>'+
      '</div>'+
    '</div>'+
    '<div id="jcMainPanel">'+(canViewPremium?jcRenderAiPanel(m,pools,model,aiAnalysis):jcRenderAiLockedPanel(m,pools,access))+'</div>';

  const panel=$('#jcMainPanel');
  let factsData=null;
  let factsLoaded=false;

  async function loadFacts(){
    panel.innerHTML=jcRenderFactsShell();
    let activeFactsTab='data';

    function renderFactsTab(tab){
      activeFactsTab=tab;
      $$('.jc-facts-subtabs button',panel).forEach(b=>b.classList.toggle('active',b.dataset.factsTab===tab));
      const content=$('#jcFactsContent',panel);
      if(!content) return;
      if(tab==='lineups') content.innerHTML=jcRenderSportteryLineups(m,sportteryDetails,factsData);
      else if(tab==='standings') content.innerHTML=jcRenderStandings(m,sportteryDetails);
      else if(tab==='stats') content.innerHTML=jcRenderTechnicalStats(factsData);
      else if(tab==='h2h') content.innerHTML=jcRenderH2H(m,sportteryDetails);
      else content.innerHTML=jcRenderFeatureBlock(m,sportteryDetails,factsData);
    }

    // Bind immediately. Tabs must remain usable even when API-Football has no fixture mapping.
    $$('.jc-facts-subtabs button',panel).forEach(btn=>{
      btn.onclick=e=>{
        e.preventDefault();
        renderFactsTab(btn.dataset.factsTab||'data');
      };
    });
    renderFactsTab('data');

    if(factsLoaded) return;

    try{
      const res=await fetch(window.QC_SUPABASE_URL+'/functions/v1/api-football-match?jc_match_id='+encodeURIComponent(id));
      const payload=await res.json();
      if(res.ok && payload?.ok){
        factsData=payload.data || {};
        factsLoaded=true;
        renderFactsTab(activeFactsTab);
      }
    }catch(e){
      console.warn('API-Football赛况读取失败，继续使用竞彩网详情数据',e);
    }
  }

  async function renderMainTab(tab){
    Array.from(root.querySelectorAll('.jc-main-tabs button')).forEach(b=>b.classList.toggle('active',b.dataset.mainTab===tab));
    if(tab==='odds'){
      panel.innerHTML=oddsHtml;
      jcBindOddsPlayTabs(panel,pools,snapshotRows);
      return;
    }
    if(tab==='ai'){
      panel.innerHTML=canViewPremium?jcRenderAiPanel(m,pools,model,aiAnalysis):jcRenderAiLockedPanel(m,pools,access);
      return;
    }
    await loadFacts();
  }

  const mainButtons=Array.from(root.querySelectorAll('.jc-main-tabs button'));
  mainButtons.forEach(btn=>{
    btn.onclick=async e=>{
      e.preventDefault();
      e.stopPropagation();
      await renderMainTab(btn.dataset.mainTab || 'ai');
    };
  });

  // Live data comes from the cache and should never hold up the first render.
  if(jcShouldFetchLive(m)){
    jcAttachLiveScores([m]).then(()=>{
      const live=jcScoreInfo(m);
      const scoreEl=$('.jc-odds-matchup .center-score strong',root);
      const statusEl=$('.jc-odds-matchup .center-score small',root);
      if(scoreEl) scoreEl.textContent=live.current||'VS';
      if(statusEl) statusEl.textContent=live.finished&&live.ht?'半 '+live.ht:jcMatchStatusLabel(m,qcBeijingToday());
    });
  }
}

function renderMatch(){
 const root=$('#matchRoot');if(!root)return;const id=new URLSearchParams(location.search).get('id');const m=QC_DATA.matches.find(x=>x.id===id)||QC_DATA.matches[0];
 root.innerHTML=`<div class="detail-head"><div class="match-top"><span>${m.n} · ${m.league}</span><span>${m.time}</span></div><div class="detail-title" style="margin-top:18px"><div class="team-badge"><span class="badge-circle">主</span>${m.home}</div><div class="center-score"><strong>VS</strong><small>赛前</small></div><div class="team-badge right">${m.away}<span class="badge-circle">客</span></div></div><div class="tabs" id="topTabs"><button class="active" data-tab="model">模型分析</button><button data-tab="data">赛况数据</button><button data-tab="market">市场数据</button><button data-tab="report">深度报告</button></div></div><div id="tabBody"></div>`;
 function show(tab){$$('#topTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab)); const body=$('#tabBody');
 if(tab==='model') body.innerHTML=`<div class="panel"><h2>模型结论</h2><div class="prob-row"><div class="prob-box"><b>46%</b><span>主胜</span></div><div class="prob-box"><b>31%</b><span>平局</span></div><div class="prob-box"><b>23%</b><span>客胜</span></div></div><div class="result-grid" style="margin-top:16px"><div class="result-card"><b>模型方向</b><strong>${m.direction}</strong></div><div class="result-card"><b>M7</b><strong>${m.m7}</strong></div><div class="result-card"><b>M8</b><strong>${m.m8}</strong></div><div class="result-card"><b>半全场</b><strong>${m.htft}</strong></div><div class="result-card"><b>主要进球区间</b><strong>${m.range}</strong></div><div class="result-card"><b>置信度</b><strong>${m.confidence}</strong></div></div><h3 style="margin-top:22px">TOP3</h3><div class="score-list">${m.top.map(s=>`<span class="score-chip">${s}</span>`).join('')}</div><div class="data-quality" style="margin-top:22px"><b>数据完整度 ${m.quality}%</b><div class="quality-bar"><span style="width:${m.quality}%"></span></div></div></div>`;
 if(tab==='data') body.innerHTML=`<div class="panel"><div class="subtabs"><button class="active">数据</button><button>阵容</button><button>排名</button><button>技术统计</button><button>交锋</button></div><h2 style="margin-top:22px">赛况数据</h2><div class="result-grid"><div class="result-card"><b>比赛状态</b><strong>赛前</strong></div><div class="result-card"><b>联赛</b><strong>${m.league}</strong></div><div class="result-card"><b>主队</b><strong>${m.home}</strong></div><div class="result-card"><b>客队</b><strong>${m.away}</strong></div></div><p style="color:var(--muted);line-height:1.7;margin-top:18px">V0.1 先接入我们已有的赛程、球队、近期状态和模型结果。阵容、排名、技术统计、H2H 会作为后续自动数据层逐项接入。</p></div>`;
 if(tab==='market') body.innerHTML=`<div class="panel"><h2>市场数据</h2><div class="result-grid"><div class="result-card"><b>1X2 快照</b><strong>已预留字段</strong></div><div class="result-card"><b>让球快照</b><strong>已预留字段</strong></div><div class="result-card"><b>大小球快照</b><strong>已预留字段</strong></div><div class="result-card"><b>时间序列</b><strong>待接自动采集</strong></div></div><h3 style="margin-top:24px">赔率变化表</h3><table class="brief-table"><thead><tr><th>时间</th><th>主</th><th>平</th><th>客</th></tr></thead><tbody><tr><td>11:00</td><td>2.07</td><td>3.10</td><td>3.10</td></tr><tr><td>12:00</td><td>1.95</td><td>3.18</td><td>3.45</td></tr><tr><td>13:00</td><td>1.88</td><td>3.22</td><td>3.60</td></tr></tbody></table></div>`;
 if(tab==='report') body.innerHTML=`<div class="panel report"><h2>${m.home} vs ${m.away}｜赛前模型分析报告</h2><p><b>报告状态：</b>V0.1 模板生成。</p><h3>一、核心矛盾</h3><p>主队的比赛控制能力与客队的转换效率构成本场主要矛盾。模型不把单一近期比分直接等同于当前实力，而是结合阵容完整度、对手层级与路径一致性处理。</p><h3>二、近期状态与阵容</h3><p>近期表现用于刻画状态，不直接覆盖长期基线。阵容信息在未确认首发前只做有限修正，避免重复加权。</p><h3>三、市场与路径</h3><p>市场层作为有界参考，不直接接管模型方向。M7 与 M8 分别保留独立 Gate，最终以模型一致性和路径可实现性决定输出。</p><h3>四、最终结论</h3><p><b>方向：</b>${m.direction}；<b>区间：</b>${m.range}；<b>半全场：</b>${m.htft}；<b>TOP3：</b>${m.top.join(' / ')}。</p><h3>数据边界</h3><p>当前演示版未接实时阵容、xG、赔率公司池和赛中技术统计，因此这些字段不参与 V0.1 的实时校正。</p></div>`;
 }
 $$('#topTabs button').forEach(b=>b.onclick=()=>show(b.dataset.tab));show('model')
}
async function setupDemoAuth(){
  const login = $('#loginForm');

  if(login){
    const loginHint=$('#loginHint');
    if(loginHint && new URLSearchParams(location.search).get('reset')==='success'){
      loginHint.textContent='密码修改成功，请使用新密码重新登录。';
      loginHint.className='code-hint success';
      history.replaceState({},'',location.pathname);
    }

    login.onsubmit = async e => {
      e.preventDefault();

      if(!window.qcSupabase){
        alert('数据库连接失败，请刷新页面后重试');
        return;
      }

      const email = login.querySelector('input[type="email"]').value.trim();
      const password = login.querySelector('input[type="password"]').value;
      const button = login.querySelector('button');

      button.disabled = true;
      button.textContent = '登录中...';

      const signInOnce = () => window.qcSupabase.auth.signInWithPassword({ email, password });
      let { data, error } = await signInOnce();

      const firstRaw = String(error?.message || '');
      const firstName = String(error?.name || '');
      const firstCode = String(error?.code || '');
      const firstStatus = Number(error?.status || 0);
      const firstLooksNetwork = Boolean(error) && (
        (!firstCode && !firstStatus) ||
        /failed to fetch|network|fetch failed|load failed|retryable/i.test(firstRaw+' '+firstName)
      );

      if(firstLooksNetwork){
        await new Promise(resolve => setTimeout(resolve, 1200));
        const retry = await signInOnce();
        data = retry.data;
        error = retry.error;
      }

      button.disabled = false;
      button.textContent = '登录';

      if(error){
        const raw = String(error.message || '');
        const name = String(error.name || '');
        const code = String(error.code || '');
        const status = Number(error.status || 0);
        let message = '登录失败，请稍后重试';
        let publicCode = code || (status ? String(status) : '');

        const looksNetwork = (
          (!code && !status) ||
          /failed to fetch|network|fetch failed|load failed|retryable/i.test(raw+' '+name)
        );

        if(looksNetwork){
          message = '登录接口连接失败，当前网络无法稳定访问账号服务';
          publicCode = 'NETWORK_AUTH';
        }else if(/invalid login credentials|invalid_credentials/i.test(raw+' '+code)){
          message = '邮箱或密码错误';
          publicCode = 'INVALID_CREDENTIALS';
        }else if(/email not confirmed|email_not_confirmed/i.test(raw+' '+code)){
          message = '邮箱尚未完成验证';
        }else if(/rate|too many|over_request_rate_limit/i.test(raw+' '+code)){
          message = '登录请求过于频繁，请稍后再试';
        }

        const suffix = publicCode ? '（诊断：'+publicCode+'）' : '';
        console.error('登录失败', {name,errorCode:code,status,message:raw,navigatorOnline:navigator.onLine});
        if(loginHint){
          loginHint.textContent = message + suffix;
          loginHint.className = 'code-hint error';
        }
        alert(message + suffix);
        return;
      }

      if(data.user){
        const next = new URLSearchParams(location.search).get('next');
        const safeNext = next && /^[a-zA-Z0-9._?=&-]+$/.test(next) ? next : 'index.html';
        location.href = safeNext;
      }
    };
  }

  const reg = $('#registerForm');

  if(reg){
    reg.onsubmit = async e => {
      e.preventDefault();

      if(!window.qcSupabase){
        alert('数据库连接失败，请刷新页面后重试');
        return;
      }

      const email = $('#regEmail').value.trim();
      const password = $('#regPassword').value;
      const password2 = $('#regPassword2').value;
      const button = reg.querySelector('button[type="submit"]');
      const hint = $('#registerHint');

      if(password.length < 8){
        alert('密码至少需要8个字符');
        $('#regPassword').focus();
        return;
      }

      if(password !== password2){
        alert('两次输入的密码不一致');
        $('#regPassword2').focus();
        return;
      }

      button.disabled = true;
      button.textContent = '注册中...';
      if(hint){
        hint.textContent = '正在创建账号…';
        hint.className = 'code-hint';
      }

      const signUpOnce = () => window.qcSupabase.auth.signUp({ email, password });
      let { data, error } = await signUpOnce();

      const firstRaw = String(error?.message || '');
      const firstName = String(error?.name || '');
      const firstCode = String(error?.code || '');
      const firstStatus = Number(error?.status || 0);
      const firstLooksNetwork = Boolean(error) && (
        !firstCode && !firstStatus ||
        /failed to fetch|network|fetch failed|load failed|retryable/i.test(firstRaw+' '+firstName)
      );

      if(firstLooksNetwork){
        await new Promise(resolve => setTimeout(resolve, 1200));
        const retry = await signUpOnce();
        data = retry.data;
        error = retry.error;
      }

      button.disabled = false;
      button.textContent = '注册';

      if(error){
        const raw = String(error.message || '');
        const name = String(error.name || '');
        const code = String(error.code || '');
        const status = Number(error.status || 0);
        const diag = [name,code,status||''].filter(Boolean).join('/');

        let message = '注册暂时失败，请稍后重试';
        let publicCode = code || (status ? String(status) : '');

        const looksNetwork = (
          (!code && !status) ||
          /failed to fetch|network|fetch failed|load failed|retryable/i.test(raw+' '+name)
        );

        if(looksNetwork){
          message = '注册接口连接失败，请切换 Wi‑Fi/移动数据，或换 Safari/Chrome 后重试';
          publicCode = 'NETWORK_AUTH';
        }else if(/already registered|user already registered|user_already_exists/i.test(raw+' '+code)){
          message = '这个邮箱已经注册，可以直接登录';
        }else if(/rate|too many|over_email_send_rate_limit|over_request_rate_limit/i.test(raw+' '+code)){
          message = '注册请求过于频繁，请稍等1—2分钟后再试';
        }else if(/invalid email|email_address_invalid|email.*invalid/i.test(raw+' '+code)){
          message = '邮箱地址无效，请检查邮箱后重试';
        }else if(/weak password|weak_password|password.*weak|password.*leak|leaked/i.test(raw+' '+code)){
          message = '密码安全性不足，请换一个至少8位且不常见的密码';
        }else if(/signup.*disabled|signups not allowed|signup_disabled/i.test(raw+' '+code)){
          message = '当前注册暂时关闭，请联系管理员';
        }else if(/database error saving new user|unexpected_failure/i.test(raw+' '+code)){
          message = '账号资料初始化失败，请稍后重试';
        }else if(/password/i.test(raw)){
          message = '密码不符合要求，请使用至少8个字符';
        }

        const suffix = publicCode ? '（诊断：'+publicCode+'）' : '';
        console.error('注册失败', {name,errorCode:code,status,message:raw,diag,navigatorOnline:navigator.onLine});

        if(hint){
          hint.textContent = message + suffix;
          hint.className = 'code-hint error';
        }
        alert(message + suffix);
        return;
      }

      if(data.session){
        if(hint){
          hint.textContent = '注册成功，已赠送 1 天 Pro 体验，正在进入今日赛事…';
          hint.className = 'code-hint success';
        }
        location.href = 'index.html';
        return;
      }

      if(hint){
        hint.textContent = '账号已创建，但 Supabase 的邮箱确认开关仍处于开启状态。关闭后即可注册并直接登录。';
        hint.className = 'code-hint error';
      }
      alert('账号已创建，但邮箱确认功能仍然开启。请先在 Supabase 关闭 Confirm email。');
    };
  }

  const forgotForm = $('#forgotPasswordForm');
  if(forgotForm){
    forgotForm.onsubmit = async e => {
      e.preventDefault();
      if(!window.qcSupabase){
        alert('数据库连接失败，请刷新页面后重试');
        return;
      }

      const email = $('#forgotEmail').value.trim();
      const button = forgotForm.querySelector('button[type="submit"]');
      const hint = $('#forgotHint');

      button.disabled = true;
      button.textContent = '发送中...';
      if(hint){
        hint.textContent = '正在发送密码重置邮件…';
        hint.className = 'code-hint';
      }

      const resetUrl = new URL('reset-password.html', location.href);
      resetUrl.search = '';
      resetUrl.hash = '';

      const { error } = await window.qcSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl.href
      });

      button.disabled = false;
      button.textContent = '发送重置邮件';

      if(error){
        const raw = error.message || '';
        const message = /rate|limit|too many/i.test(raw)
          ? '请求过于频繁，请稍后再试。'
          : '暂时无法发送重置邮件，请稍后重试。';
        if(hint){
          hint.textContent = message;
          hint.className = 'code-hint error';
        }
        return;
      }

      if(hint){
        hint.textContent = '如果该邮箱已注册，我们已发送密码重置邮件，请检查邮箱。';
        hint.className = 'code-hint success';
      }
    };
  }

  const resetForm = $('#resetPasswordForm');
  if(resetForm){
    const hint = $('#resetPasswordHint');
    const button = resetForm.querySelector('button[type="submit"]');

    const refreshRecoveryState = async () => {
      const params = new URLSearchParams(location.search);
      const tokenHash = params.get('token_hash') || '';
      const recoveryType = params.get('type') || '';

      if(tokenHash && recoveryType === 'recovery'){
        const { error: verifyError } = await window.qcSupabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery'
        });

        if(verifyError){
          button.disabled = true;
          if(hint){
            hint.textContent = '修改密码链接无效或已过期，请重新申请。';
            hint.className = 'code-hint error';
          }
          return false;
        }

        history.replaceState({},'',location.pathname);
      }

      const { data, error } = await window.qcSupabase.auth.getSession();
      const session = data && data.session;
      const ready = !error && Boolean(session);
      button.disabled = !ready;
      if(hint){
        hint.textContent = ready
          ? '请直接设置新的登录密码。'
          : '修改密码链接无效或已过期，请重新申请。';
        hint.className = ready ? 'code-hint success' : 'code-hint error';
      }
      return ready;
    };

    await refreshRecoveryState();

    window.qcSupabase.auth.onAuthStateChange((event, session) => {
      if(event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN'){
        button.disabled = !session;
        if(hint && session){
          hint.textContent = '请直接设置新的登录密码。';
          hint.className = 'code-hint success';
        }
      }
    });

    resetForm.onsubmit = async e => {
      e.preventDefault();

      const ready = await refreshRecoveryState();
      if(!ready) return;

      const password = $('#resetPassword').value;
      const password2 = $('#resetPassword2').value;

      if(password.length < 8){
        alert('新密码至少需要8个字符');
        return;
      }
      if(password !== password2){
        alert('两次输入的新密码不一致');
        return;
      }

      button.disabled = true;
      button.textContent = '修改中...';

      const { error } = await window.qcSupabase.auth.updateUser({ password });

      if(error){
        button.disabled = false;
        button.textContent = '确认修改';
        if(hint){
          hint.textContent = '密码修改失败，请重新打开邮件中的重置链接后再试。';
          hint.className = 'code-hint error';
        }
        return;
      }

      await window.qcSupabase.auth.signOut();
      location.replace('login.html?reset=success');
    };
  }

}


async function setupAuthNav(){
  if(!window.qcSupabase) return;

  const loginLink = $('#navLogin');
  const registerLink = $('#navRegister');
  const profileLink = $('#navProfile');
  const logoutLink = $('#navLogout');

  if(!loginLink && !registerLink && !profileLink && !logoutLink) return;

  const { data } = await window.qcSupabase.auth.getSession();
  const session = data && data.session;

  if(session){
    if(loginLink) loginLink.style.display = 'none';
    if(registerLink) registerLink.style.display = 'none';
    if(profileLink) profileLink.style.display = 'block';
    if(logoutLink){
      logoutLink.style.display = 'block';
      logoutLink.textContent = '退出登录';
      logoutLink.onclick = async e => {
        e.preventDefault();
        await window.qcSupabase.auth.signOut();
        location.href = 'index.html';
      };
    }
  }else{
    if(loginLink) loginLink.style.display = 'block';
    if(registerLink) registerLink.style.display = 'block';
    if(profileLink) profileLink.style.display = 'block';
    if(logoutLink) logoutLink.style.display = 'none';
  }
}

async function setupProfile(){
  const root = $('#profileRoot');
  if(!root) return;

  if(!window.qcSupabase){
    alert('数据库连接失败，请刷新页面后重试');
    return;
  }

  const { data: userData, error: userError } = await window.qcSupabase.auth.getUser();
  const user = userData && userData.user;

  if(userError || !user){
    location.href = 'login.html';
    return;
  }

  const emailEl = $('#profileEmail');
  const nicknameEl = $('#profileNickname');
  const roleEl = $('#profileRole');
  const statusEl = $('#profileStatus');
  const nicknameInput = $('#nicknameInput');

  if(emailEl) emailEl.textContent = user.email || '—';

  const { data: profile, error: profileError } = await window.qcSupabase
    .from('profiles')
    .select('email,nickname,role,status')
    .eq('id', user.id)
    .single();

  if(profileError){
    console.error('读取用户资料失败', profileError);
  }

  const nickname = (profile && profile.nickname ? profile.nickname.trim() : '') || (user.email ? user.email.split('@')[0] : '用户');
  const role = profile && profile.role ? profile.role : 'basic';
  const status = profile && profile.status ? profile.status : 'active';

  if(nicknameEl) nicknameEl.textContent = nickname;
  if(nicknameInput) nicknameInput.value = nickname;
  if(roleEl) roleEl.textContent = role === 'admin' ? '管理员' : '正在读取会员状态…';
  if(statusEl){
    statusEl.textContent = status === 'active' ? '正常' : '已停用';
    statusEl.style.color = status === 'active' ? 'var(--green)' : 'var(--red)';
  }

  const { data: subscriptions, error: subscriptionError } = await window.qcSupabase
    .from('subscriptions')
    .select('plan,expires_at,status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1);

  if(subscriptionError){
    console.error('读取会员信息失败', subscriptionError);
  }

  const activeSubscription = subscriptions && subscriptions.length ? subscriptions[0] : null;
  if(roleEl) roleEl.textContent = role === 'admin' ? '管理员' : activeSubscription ? 'Pro会员' : '基础用户';
  renderMembership(activeSubscription, role);

  const redeemForm = $('#redeemForm');
  if(redeemForm){
    redeemForm.onsubmit = async e => {
      e.preventDefault();
      const codeInput = $('#redeemCode');
      const hint = $('#redeemHint');
      const button = redeemForm.querySelector('button');
      const code = codeInput.value.trim();

      if(!code){
        alert('请输入兑换码');
        codeInput.focus();
        return;
      }

      button.disabled = true;
      button.textContent = '兑换中...';
      if(hint){
        hint.textContent = '正在验证兑换码…';
        hint.className = 'code-hint';
      }

      const { data, error } = await window.qcSupabase.rpc('redeem_membership', {
        p_code: code
      });

      button.disabled = false;
      button.textContent = '兑换';

      if(error){
        let message = '兑换失败，请检查兑换码';
        if((error.message || '').includes('INVALID_CODE')) message = '兑换码不存在';
        if((error.message || '').includes('CODE_ALREADY_USED')) message = '这个兑换码已经使用过';
        if((error.message || '').includes('NOT_AUTHENTICATED')) message = '登录状态已失效，请重新登录';
        if(hint){
          hint.textContent = message;
          hint.className = 'code-hint error';
        }
        alert(message);
        return;
      }

      codeInput.value = '';
      if(hint){
        hint.textContent = '兑换成功，会员有效期已更新。';
        hint.className = 'code-hint success';
      }

      const expiry = data && data.expires_at ? data.expires_at : null;
      renderMembership(expiry ? {plan: data.plan || 'pro', expires_at: expiry, status: 'active'} : null, 'pro');

      if(roleEl) roleEl.textContent = 'Pro会员';
      alert('兑换成功');
    };
  }

  const nicknameForm = $('#nicknameForm');
  if(nicknameForm){
    nicknameForm.onsubmit = async e => {
      e.preventDefault();
      const input = $('#nicknameInput');
      const hint = $('#nicknameHint');
      const button = nicknameForm.querySelector('button');
      const value = input.value.trim();

      if(!value){
        alert('昵称不能为空');
        input.focus();
        return;
      }

      button.disabled = true;
      button.textContent = '保存中...';

      const { data: nicknameResult, error } = await window.qcSupabase.rpc('update_my_nickname', {
        p_nickname: value
      });

      button.disabled = false;
      button.textContent = '保存昵称';

      if(error){
        let message = '昵称保存失败，请稍后重试。';
        const raw = error.message || '';
        if(raw.includes('INVALID_NICKNAME')) message = '昵称长度需要在1到30个字符之间';
        if(raw.includes('NOT_AUTHENTICATED')) message = '登录状态已失效，请重新登录';
        if(hint){
          hint.textContent = message;
          hint.className = 'code-hint error';
        }
        alert(message);
        return;
      }

      if(nicknameEl) nicknameEl.textContent = value;
      if(hint){
        hint.textContent = '昵称已保存。';
        hint.className = 'code-hint success';
      }
    };
  }

  const passwordForm = $('#passwordForm');
  if(passwordForm){
    passwordForm.onsubmit = async e => {
      e.preventDefault();

      const current = $('#currentPassword').value;
      const next = $('#newPassword').value;
      const confirmNext = $('#confirmNewPassword').value;
      const button = passwordForm.querySelector('button');
      const hint = $('#passwordHint');

      if(next.length < 8){
        alert('新密码至少需要8个字符');
        return;
      }

      if(next !== confirmNext){
        alert('两次输入的新密码不一致');
        return;
      }

      button.disabled = true;
      button.textContent = '修改中...';

      const { error: reauthError } = await window.qcSupabase.auth.signInWithPassword({
        email: user.email,
        password: current
      });

      if(reauthError){
        button.disabled = false;
        button.textContent = '修改密码';
        if(hint){
          hint.textContent = '当前密码不正确。';
          hint.className = 'code-hint error';
        }
        return;
      }

      const { error } = await window.qcSupabase.auth.updateUser({ password: next });

      button.disabled = false;
      button.textContent = '修改密码';

      if(error){
        if(hint){
          hint.textContent = '密码修改失败，请稍后重试。';
          hint.className = 'code-hint error';
        }
        alert('密码修改失败：' + error.message);
        return;
      }

      passwordForm.reset();
      if(hint){
        hint.textContent = '密码修改成功。';
        hint.className = 'code-hint success';
      }
      alert('密码修改成功');
    };
  }

  const logoutBtn = $('#logoutBtn');
  if(logoutBtn){
    logoutBtn.onclick = async e => {
      e.preventDefault();
      await window.qcSupabase.auth.signOut();
      location.href = 'login.html';
    };
  }
}

function renderMembership(subscription, role){
  const planEl = $('#membershipPlan');
  const daysEl = $('#membershipDays');
  const expiryEl = $('#membershipExpiry');

  if(!planEl || !daysEl || !expiryEl) return;

  if(!subscription){
    planEl.textContent = role === 'admin' ? '管理员' : '基础用户';
    daysEl.textContent = role === 'admin' ? '拥有完整查看权限' : '未开通 Pro';
    expiryEl.textContent = role === 'admin' ? '有效期：管理员权限' : '有效期至：未开通';
    return;
  }

  const expiry = new Date(subscription.expires_at);
  const now = new Date();
  const remainingMs = Math.max(0, expiry.getTime() - now.getTime());
  const remainingDays = Math.ceil(remainingMs / 86400000);

  planEl.textContent = (subscription.plan || 'pro').toLowerCase() === 'pro' ? 'Pro会员' : subscription.plan;
  daysEl.textContent = '剩余 ' + remainingDays + ' 天';
  expiryEl.textContent = '有效期至：' + expiry.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}



async function qcAdminSession(root,nextPage){
  if(!window.qcSupabase){
    if(root) root.innerHTML='<div class="profile-card">数据库连接失败，请刷新页面后重试。</div>';
    return null;
  }

  const {data:userData,error:userError}=await window.qcSupabase.auth.getUser();
  const user=userData&&userData.user;
  if(userError||!user){
    location.href='login.html?next='+encodeURIComponent(nextPage||'admin.html');
    return null;
  }

  const {data:stats,error}=await window.qcSupabase.rpc('admin_dashboard_stats');
  if(error){
    const raw=String(error.message||'');
    if(root){
      root.innerHTML=
        '<div class="profile-card"><h2>管理员验证未通过</h2>'+
        '<p style="color:var(--muted);line-height:1.7">'+
        qcEscape(raw.includes('ADMIN_REQUIRED')?'当前账号没有管理员权限':'管理员权限校验失败')+
        '。</p><a class="small-btn" href="admin.html">返回后台</a></div>';
    }
    return null;
  }
  return {user,stats};
}

function qcAdminFmt(v){
  if(!v) return '—';
  return new Date(v).toLocaleString('zh-CN',{
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'
  });
}

async function setupAdmin(){
  const root=$('#adminRoot');
  if(!root) return;

  const session=await qcAdminSession(root,'admin.html');
  if(!session) return;

  const stats=session.stats||{};
  if($('#adminUsers')) $('#adminUsers').textContent=stats.users??0;
  if($('#adminProUsers')) $('#adminProUsers').textContent=stats.pro_users??0;
  if($('#adminUnusedCodes')) $('#adminUnusedCodes').textContent=stats.unused_codes??0;
  if($('#adminUsedCodes')) $('#adminUsedCodes').textContent=stats.used_codes??0;

  const [{data:overview},latestRunResult,activityResult]=await Promise.all([
    window.qcSupabase.rpc('admin_user_overview'),
    window.qcSupabase.from('jc_sync_runs')
      .select('status,finished_at,started_at,matches_received,snapshots_inserted')
      .order('started_at',{ascending:false})
      .limit(1),
    window.qcSupabase.rpc('admin_system_activity',{p_limit:1})
  ]);

  if(overview){
    if($('#adminTodayNew')) $('#adminTodayNew').textContent=overview.today_new??0;
    if($('#adminLogin24h')) $('#adminLogin24h').textContent=overview.login_24h??0;
  }

  const run=latestRunResult.data&&latestRunResult.data[0];
  if($('#adminCollectorSummary')){
    $('#adminCollectorSummary').textContent=run
      ? '历史保留 · 最近同步 '+qcAdminFmt(run.finished_at||run.started_at)
      : '历史保留 · 暂无同步记录';
  }

  const activity=activityResult.data&&activityResult.data[0];
  if($('#adminLogSummary')){
    $('#adminLogSummary').textContent=activity
      ? qcAdminFmt(activity.event_time)+' · '+String(activity.title||'系统活动')
      : '暂无系统活动';
  }
}

async function setupAdminUsers(){
  const root=$('#adminUsersRoot');
  if(!root) return;

  const session=await qcAdminSession(root,'admin-users.html');
  if(!session) return;

  const rows=$('#adminUserRows');
  const search=$('#adminUserSearch');
  let all=[];

  const updateOverview=async()=>{
    const {data:overview}=await window.qcSupabase.rpc('admin_user_overview');
    if(!overview) return;
    if($('#usersTotal')) $('#usersTotal').textContent=overview.total_users??0;
    if($('#usersPro')) $('#usersPro').textContent=overview.pro_users??0;
    if($('#usersToday')) $('#usersToday').textContent=overview.today_new??0;
    if($('#usersLogin24h')) $('#usersLogin24h').textContent=overview.login_24h??0;
  };

  const render=(items)=>{
    if(!rows) return;
    if(!items.length){
      rows.innerHTML='<tr><td colspan="7">没有匹配用户</td></tr>';
      return;
    }
    rows.innerHTML=items.map(item=>{
      const active=item.account_status==='active';
      const membership=item.membership||'基础用户';
      const expiry=membership==='Pro会员'
        ? qcAdminFmt(item.pro_expires_at)
        : membership==='管理员'?'管理员权限':'—';
      const status=active
        ? '<span class="admin-status ok">正常</span>'
        : '<span class="admin-status off">已停用</span>';
      const action=item.role==='admin'
        ? '<span class="admin-action-muted">—</span>'
        : '<button class="admin-user-action '+(active?'danger':'restore')+'" type="button" data-user-id="'+
          qcEscape(item.user_id||'')+'" data-email="'+qcEscape(item.email||'')+'" data-action="'+
          (active?'disable':'restore')+'">'+(active?'停用':'恢复')+'</button>';
      return '<tr>'+
        '<td><strong>'+qcEscape(item.email||'—')+'</strong></td>'+
        '<td>'+qcEscape(qcAdminFmt(item.created_at))+'</td>'+
        '<td>'+qcEscape(qcAdminFmt(item.last_sign_in_at))+'</td>'+
        '<td>'+qcEscape(membership)+'</td>'+
        '<td>'+qcEscape(expiry)+'</td>'+
        '<td>'+status+'</td>'+
        '<td>'+action+'</td>'+
      '</tr>';
    }).join('');

    $$('.admin-user-action',rows).forEach(btn=>{
      btn.onclick=async()=>{
        const action=btn.dataset.action;
        const email=btn.dataset.email||'该账号';
        const rpc=action==='disable'?'admin_disable_user':'admin_restore_user';
        const verb=action==='disable'?'停用':'恢复';
        if(!confirm('确认'+verb+'账号：'+email+'？')) return;

        btn.disabled=true;
        btn.textContent=verb+'中…';
        const {data,error}=await window.qcSupabase.rpc(rpc,{target_user:btn.dataset.userId});
        if(error||!data?.ok){
          const raw=String(error?.message||data?.error||'');
          let msg=verb+'失败';
          if(raw.includes('CANNOT_DISABLE_SELF')) msg='不能停用当前管理员账号';
          if(raw.includes('CANNOT_DISABLE_ADMIN')) msg='不能停用管理员账号';
          if(raw.includes('ADMIN_REQUIRED')) msg='当前账号没有管理员权限';
          alert(msg);
          btn.disabled=false;
          btn.textContent=verb;
          return;
        }

        await Promise.all([loadUsers(),updateOverview()]);
      };
    });
  };

  const applyFilter=()=>{
    const q=(search?.value||'').trim().toLowerCase();
    render(!q?all:all.filter(x=>String(x.email||'').toLowerCase().includes(q)));
  };

  const loadUsers=async()=>{
    const {data:users,error}=await window.qcSupabase.rpc('admin_users_list');
    if(error){
      if(rows) rows.innerHTML='<tr><td colspan="7">用户数据读取失败</td></tr>';
      return;
    }
    all=users||[];
    applyFilter();
  };

  if(search) search.oninput=applyFilter;
  await Promise.all([loadUsers(),updateOverview()]);
}

async function setupAdminCodes(){
  const root=$('#adminCodesRoot');
  if(!root) return;

  const session=await qcAdminSession(root,'admin-codes.html');
  if(!session) return;

  const loadCodes=async()=>{
    const [{data:stats},codesResult]=await Promise.all([
      window.qcSupabase.rpc('admin_dashboard_stats'),
      window.qcSupabase.rpc('admin_redeem_codes')
    ]);

    if(stats){
      if($('#codesUnused')) $('#codesUnused').textContent=stats.unused_codes??0;
      if($('#codesUsed')) $('#codesUsed').textContent=stats.used_codes??0;
    }

    const rows=$('#redeemCodeRows');
    if(!rows) return;
    if(codesResult.error){
      rows.innerHTML='<tr><td colspan="5">兑换码读取失败</td></tr>';
      return;
    }
    const codes=codesResult.data||[];
    if(!codes.length){
      rows.innerHTML='<tr><td colspan="5">暂无兑换码</td></tr>';
      return;
    }

    rows.innerHTML=codes.map(item=>{
      const statusText=item.status==='unused'?'未使用':item.status==='used'?'已使用':'已停用';
      return '<tr>'+
        '<td><strong>'+qcEscape(item.code||'—')+'</strong></td>'+
        '<td>'+qcEscape(item.duration_days)+'天</td>'+
        '<td>'+qcEscape(statusText)+'</td>'+
        '<td>'+qcEscape(item.used_by_email||'—')+'</td>'+
        '<td>'+qcEscape(qcAdminFmt(item.created_at))+'</td>'+
      '</tr>';
    }).join('');
  };

  await loadCodes();

  const form=$('#createCodeForm');
  if(form){
    form.onsubmit=async e=>{
      e.preventDefault();
      const days=Number($('#codeDays').value);
      const note=($('#codeNote').value||'').trim();
      const button=form.querySelector('button[type="submit"]');
      const hint=$('#adminHint');
      const box=$('#createdCodeBox');

      if(!Number.isInteger(days)||days<1||days>3650){
        alert('会员天数请输入 1–3650 之间的整数');
        return;
      }

      button.disabled=true;
      button.textContent='生成中…';
      if(hint){hint.textContent='正在生成兑换码…';hint.className='code-hint';}

      const {data,error}=await window.qcSupabase.rpc('create_redeem_code',{
        p_duration_days:days,p_note:note||null
      });

      button.disabled=false;
      button.textContent='生成兑换码';

      if(error){
        const raw=String(error.message||'');
        let msg='兑换码生成失败';
        if(raw.includes('ADMIN_REQUIRED')) msg='当前账号没有管理员权限';
        if(raw.includes('INVALID_DURATION')) msg='会员天数不正确';
        if(hint){hint.textContent=msg;hint.className='code-hint error';}
        alert(msg);
        return;
      }

      if($('#createdCode')) $('#createdCode').textContent=data.code;
      if(box) box.hidden=false;
      if(hint){hint.textContent='已生成 '+data.duration_days+' 天 Pro 会员兑换码。';hint.className='code-hint success';}
      $('#codeNote').value='';
      await loadCodes();
    };
  }

  const copyBtn=$('#copyCodeBtn');
  if(copyBtn){
    copyBtn.onclick=async()=>{
      const code=($('#createdCode')?.textContent||'').trim();
      if(!code||code==='—') return;
      try{
        await navigator.clipboard.writeText(code);
        copyBtn.textContent='已复制';
        setTimeout(()=>copyBtn.textContent='复制',1200);
      }catch{
        alert('复制失败，请手动复制');
      }
    };
  }
}

async function setupAdminData(){
  const root=$('#adminDataRoot');
  if(!root) return;

  const session=await qcAdminSession(root,'admin-data.html');
  if(!session) return;

  const [{count:matches},{count:snapshots},latestRunResult,collectorResult,runsResult]=await Promise.all([
    window.qcSupabase.from('jc_matches').select('*',{count:'exact',head:true}),
    window.qcSupabase.from('jc_market_snapshots').select('*',{count:'exact',head:true}),
    window.qcSupabase.from('jc_sync_runs')
      .select('status,started_at,finished_at,matches_received,matches_upserted,snapshots_inserted,error_message,source')
      .order('started_at',{ascending:false}).limit(1),
    window.qcSupabase.from('jc_collector_devices')
      .select('name,status,last_seen_at,last_success_at,last_error')
      .order('created_at',{ascending:false}).limit(1),
    window.qcSupabase.from('jc_sync_runs')
      .select('status,started_at,finished_at,matches_received,matches_upserted,snapshots_inserted,error_message,source')
      .order('started_at',{ascending:false}).limit(30)
  ]);

  if($('#dataMatchCount')) $('#dataMatchCount').textContent=matches??0;
  if($('#dataSnapshotCount')) $('#dataSnapshotCount').textContent=snapshots??0;

  const run=latestRunResult.data&&latestRunResult.data[0];
  if($('#dataLastSync')){
    $('#dataLastSync').textContent=run?qcAdminFmt(run.finished_at||run.started_at)+' · '+String(run.status||'—'):'尚无记录';
  }

  const collector=collectorResult.data&&collectorResult.data[0];
  if($('#dataCollectorStatus')){
    if(!collector) $('#dataCollectorStatus').textContent='尚未创建';
    else if(collector.last_success_at) $('#dataCollectorStatus').textContent='最近成功 '+qcAdminFmt(collector.last_success_at);
    else if(collector.last_seen_at) $('#dataCollectorStatus').textContent='最近连接 '+qcAdminFmt(collector.last_seen_at);
    else $('#dataCollectorStatus').textContent='已保留';
  }

  const rows=$('#dataRunRows');
  if(rows){
    const items=runsResult.data||[];
    rows.innerHTML=items.length?items.map(x=>{
      const detail=String(x.matches_received??0)+'场 / '+String(x.snapshots_inserted??0)+'条快照';
      return '<tr>'+
        '<td>'+qcEscape(qcAdminFmt(x.finished_at||x.started_at))+'</td>'+
        '<td>'+qcEscape(x.status||'—')+'</td>'+
        '<td>'+qcEscape(detail)+'</td>'+
        '<td>'+qcEscape(x.error_message||'—')+'</td>'+
      '</tr>';
    }).join(''):'<tr><td colspan="4">暂无历史同步记录</td></tr>';
  }

  const createCollectorBtn=$('#createCollectorBtn');
  if(createCollectorBtn){
    createCollectorBtn.onclick=async()=>{
      if(!confirm('确认创建一个新的 Windows 采集器凭证？旧凭证和历史数据不会删除。')) return;
      const hint=$('#jcSyncHint');
      createCollectorBtn.disabled=true;
      createCollectorBtn.textContent='创建中…';
      const {data,error}=await window.qcSupabase.rpc('create_collector_device',{p_name:'Windows Auto Collector'});
      createCollectorBtn.disabled=false;
      createCollectorBtn.textContent='创建新的采集器凭证';
      if(error||!data?.ok){
        const msg='采集器凭证创建失败';
        if(hint){hint.textContent=msg;hint.className='code-hint error';}
        alert(msg);
        return;
      }
      if($('#collectorToken')) $('#collectorToken').textContent=data.token;
      if($('#collectorTokenBox')) $('#collectorTokenBox').hidden=false;
      if(hint){hint.textContent='凭证已创建。只在需要重新启用本机采集器时使用。';hint.className='code-hint success';}
    };
  }

  const copyCollectorTokenBtn=$('#copyCollectorTokenBtn');
  if(copyCollectorTokenBtn){
    copyCollectorTokenBtn.onclick=async()=>{
      const token=($('#collectorToken')?.textContent||'').trim();
      if(!token||token==='—') return;
      try{
        await navigator.clipboard.writeText(token);
        copyCollectorTokenBtn.textContent='已复制';
        setTimeout(()=>copyCollectorTokenBtn.textContent='复制',1200);
      }catch{
        alert('复制失败，请手动复制');
      }
    };
  }
}

async function setupAdminLogs(){
  const root=$('#adminLogsRoot');
  if(!root) return;

  const session=await qcAdminSession(root,'admin-logs.html');
  if(!session) return;

  const {data:events,error}=await window.qcSupabase.rpc('admin_system_activity',{p_limit:150});
  const rows=$('#adminLogRows');
  if(error){
    if(rows) rows.innerHTML='<tr><td colspan="5">系统活动读取失败</td></tr>';
    return;
  }

  const items=events||[];
  const signupCount=items.filter(x=>x.event_type==='signup').length;
  const loginCount=items.filter(x=>x.event_type==='login').length;
  const collectorCount=items.filter(x=>x.event_type==='collector').length;
  if($('#logSignupCount')) $('#logSignupCount').textContent=signupCount;
  if($('#logLoginCount')) $('#logLoginCount').textContent=loginCount;
  if($('#logCollectorCount')) $('#logCollectorCount').textContent=collectorCount;

  const typeLabel={signup:'注册',login:'登录',collector:'采集'};
  const statusLabel={success:'成功',failed:'失败',partial:'部分成功',blocked:'被拦截',running:'进行中'};
  if(rows){
    rows.innerHTML=items.length?items.map(x=>
      '<tr>'+
        '<td>'+qcEscape(qcAdminFmt(x.event_time))+'</td>'+
        '<td>'+qcEscape(typeLabel[x.event_type]||x.event_type||'系统')+'</td>'+
        '<td>'+qcEscape(x.title||'—')+'</td>'+
        '<td>'+qcEscape(x.detail||'—')+'</td>'+
        '<td>'+qcEscape(statusLabel[x.status]||x.status||'—')+'</td>'+
      '</tr>'
    ).join(''):'<tr><td colspan="5">暂无系统活动</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  const safe=(name,fn)=>{try{const r=fn();if(r&&typeof r.catch==='function')r.catch(e=>console.error(name,e));}catch(e){console.error(name,e);}};
  safe('drawer',()=>setupDrawer());
  safe('legacy-index',()=>renderIndex());
  safe('jc-frontend',()=>loadJcFrontend());
  safe('jc-football',()=>loadJcFootball());
  safe('jc-detail',()=>setupJcMatchDetail());
  safe('legacy-match',()=>renderMatch());
  safe('auth',()=>setupDemoAuth());
  safe('auth-nav',()=>setupAuthNav());
  safe('profile',()=>setupProfile());
  safe('admin',()=>setupAdmin());
  safe('admin-users',()=>setupAdminUsers());
  safe('admin-codes',()=>setupAdminCodes());
  safe('admin-data',()=>setupAdminData());
  safe('admin-logs',()=>setupAdminLogs());
})
