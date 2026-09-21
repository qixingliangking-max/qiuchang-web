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

function qcDateLabel(dateStr){
  const d=new Date(dateStr+'T12:00:00+08:00');
  const month=d.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric'});
  const day=d.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',day:'numeric'});
  const weekday=d.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',weekday:'short'});
  return month+'月'+day+'日 '+weekday;
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

function jcMatchStatusLabel(m,today){
  const rawStatus=String(m?.raw?.matchStatusName || m?.match_status || '').trim();
  const ft=String(m?.raw?.sectionsNo999 || '').trim();
  if(ft) return '已结束';
  if(/完成|结束|finished/i.test(rawStatus)) return '已结束';
  if(/进行|live/i.test(rawStatus)) return '进行中';
  if(m.match_date>today) return '未开赛';
  if(/Selling|销售|开售|未开赛|2|3/.test(rawStatus)) return '未开赛';
  return rawStatus || '未开赛';
}

function jcScoreInfo(m){
  const ft=String(m?.raw?.sectionsNo999 || '').trim().replace(':','-');
  const ht=String(m?.raw?.sectionsNo1 || '').trim().replace(':','-');
  return {ft:ft || '',ht:ht || ''};
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
  const leagues=[...new Set(rows.map(m=>m.league_name || m.league_short_name || '其他'))];
  const all=[{key:'全部',label:'全部'},...leagues.map(x=>({key:x,label:x}))];
  box.innerHTML=all.map(item=>'<button type="button" class="'+(activeLeague===item.key?'active':'')+'" data-league="'+qcEscape(item.key)+'">'+qcEscape(item.label)+'</button>').join('');
  $$('button',box).forEach(btn=>{
    btn.onclick=()=>onChange(btn.dataset.league || '全部');
  });
}

function jcRenderFutureGrid(rows,today){
  if(!rows.length) return '<div class="profile-card">这一天暂时没有符合筛选条件的比赛。</div>';
  return '<div class="jc-future-grid">'+rows.map(m=>{
    const pools=jcLatestPools(m.jc_market_snapshots || []);
    const league=qcEscape(m.league_name || m.league_short_name || '—');
    const num=qcEscape(m.match_num || '竞彩');
    const home=qcEscape(m.home_team_name || '—');
    const away=qcEscape(m.away_team_name || '—');
    const rel=jcRelativeDayLabel(m.match_date,today);
    const time=(m.match_time || '').slice(0,5);
    const status=jcMatchStatusLabel(m,today);
    return '<a class="jc-fixture-card" href="jc-match.html?id='+encodeURIComponent(m.id)+'">'+
      '<div class="jc-card-top"><span><em>'+league+'</em> <b>'+num+'</b></span><time>'+(rel?rel+' ':'')+qcEscape(m.match_date.slice(5)+' '+time)+'</time></div>'+
      '<div class="jc-card-teams"><div class="jc-team home-team">'+home+'</div><span class="jc-vs">VS</span><div class="jc-team away-team">'+away+'</div></div>'+
      '<div class="jc-status-strip">◷ '+qcEscape(status)+'</div>'+
      jcRenderOddsMini(pools)+
      '<div class="jc-model-pending"><b>玩法：</b><span>待生成</span></div>'+
    '</a>';
  }).join('')+'</div>';
}

function jcTodayDetailHtml(m,today){
  if(!m) return '<div class="jc-today-empty">今天暂无比赛。</div>';
  const pools=jcLatestPools(m.jc_market_snapshots || []);
  const score=jcScoreInfo(m);
  const status=jcMatchStatusLabel(m,today);
  const league=qcEscape(m.league_name || m.league_short_name || '—');
  const num=qcEscape(m.match_num || '竞彩');
  const home=qcEscape(m.home_team_name || '—');
  const away=qcEscape(m.away_team_name || '—');
  const time=qcEscape((m.match_time || '').slice(0,5));
  const scoreCenter=score.ft
    ? '<div class="jc-big-score"><small>'+(score.ht?'半 '+qcEscape(score.ht):'')+'</small><strong>'+qcEscape(score.ft)+'</strong><span>'+qcEscape(status)+'</span></div>'
    : '<div class="jc-big-score"><strong>VS</strong><span>'+qcEscape(status)+'</span></div>';
  return '<div class="jc-today-detail">'+
    '<div class="jc-today-detail-head"><span>'+num+' · '+league+' · '+qcEscape(m.match_date)+' '+time+'</span></div>'+
    '<div class="jc-today-matchup"><div><b>'+home+'</b></div>'+scoreCenter+'<div class="right"><b>'+away+'</b></div></div>'+
    '<h3>官方竞彩</h3>'+jcRenderOddsMini(pools)+
    '<div class="jc-today-more">'+
      ['ttg','hafu','crs'].map(code=>{
        const p=pools[code];
        return '<div><b>'+jcPoolLabel(code)+'</b><span>'+(p?qcEscape(jcOutcomeSummary(p,code)):'暂未返回')+'</span></div>';
      }).join('')+
    '</div>'+
  '</div>';
}

function jcRenderTodayLayout(rows,today){
  if(!rows.length) return '<div class="profile-card">今天暂时没有采集到竞彩足球赛程。</div>';
  const first=rows[0];
  const list=rows.map((m,i)=>{
    const score=jcScoreInfo(m);
    const status=jcMatchStatusLabel(m,today);
    return '<button type="button" class="jc-today-list-item '+(i===0?'active':'')+'" data-id="'+qcEscape(m.id)+'">'+
      '<div class="jc-today-list-top"><span>'+qcEscape(m.match_num || '竞彩')+' · '+qcEscape(m.league_name || m.league_short_name || '—')+'</span><time>'+qcEscape((m.match_time || '').slice(0,5))+'</time></div>'+
      '<div class="jc-today-list-teams"><b>'+qcEscape(m.home_team_name || '—')+'</b><strong>'+(score.ft?qcEscape(score.ft):'VS')+'</strong><b>'+qcEscape(m.away_team_name || '—')+'</b></div>'+
      '<small>'+qcEscape(status)+'</small>'+
    '</button>';
  }).join('');
  return '<div class="jc-today-layout"><div class="jc-today-list">'+list+'</div><div id="jcTodayDetailPane">'+jcTodayDetailHtml(first,today)+'</div></div>';
}

async function loadJcFrontend(){
  const cards=$('#jcLiveCards');
  if(!cards || !window.qcSupabase) return;

  const {data,error}=await window.qcSupabase
    .from('jc_matches')
    .select('id,match_num,business_date,league_name,league_short_name,home_team_name,away_team_name,match_date,match_time,kickoff_at,match_status,raw,jc_market_snapshots(pool_code,goal_line,outcomes,captured_at,official_update_time)')
    .order('match_date',{ascending:true})
    .order('match_time',{ascending:true})
    .limit(200);

  if(error){
    console.error('读取竞彩前台数据失败',error);
    cards.innerHTML='<div class="profile-card">竞彩数据暂时读取失败，请稍后刷新。</div>';
    if($('#jcLiveMeta')) $('#jcLiveMeta').textContent='读取失败';
    return;
  }

  const allRows=(data||[]).filter(m=>m.match_date);
  const availableDates=[...new Set(allRows.map(m=>m.match_date))].sort();
  const today=qcBeijingToday();
  const paramDate=new URLSearchParams(location.search).get('date');
  let selectedDate=paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)?paramDate:today;
  let activeLeague='全部';

  if(!availableDates.includes(selectedDate) && availableDates.length){
    const future=availableDates.find(d=>d>=today);
    selectedDate=future || availableDates[availableDates.length-1];
  }

  const label=$('#jcDateLabel');
  const prev=$('#jcPrevDate');
  const next=$('#jcNextDate');
  const todayBtn=$('#jcTodayBtn');
  const pop=$('#jcDatePopover');

  function setUrlDate(ds){
    const u=new URL(location.href);
    u.searchParams.set('date',ds);
    history.replaceState({},'',u);
  }

  function bindTodaySelection(rows){
    $$('.jc-today-list-item').forEach(btn=>{
      btn.onclick=()=>{
        $$('.jc-today-list-item').forEach(x=>x.classList.toggle('active',x===btn));
        const m=rows.find(x=>x.id===btn.dataset.id);
        const pane=$('#jcTodayDetailPane');
        if(pane) pane.innerHTML=jcTodayDetailHtml(m,today);
      };
    });
  }

  function render(){
    const dateRows=allRows.filter(m=>m.match_date===selectedDate);
    const filtered=activeLeague==='全部'
      ? dateRows
      : dateRows.filter(m=>(m.league_name || m.league_short_name || '其他')===activeLeague);

    if(label) label.textContent=qcDateLabel(selectedDate);
    if($('#jcLiveMeta')) $('#jcLiveMeta').textContent=(selectedDate===today?'今日 · ':'')+(dateRows.length?dateRows.length+'场':'暂无比赛');
    if($('#jcDateCount')) $('#jcDateCount').textContent='共 '+filtered.length+' 场';
    if($('#jcSectionTitleText')) $('#jcSectionTitleText').textContent=selectedDate===today?'今日赛事':'全部赛程';
    setUrlDate(selectedDate);

    jcRenderLeagueFilters(dateRows,activeLeague,(league)=>{
      activeLeague=league;
      render();
    });

    if(selectedDate===today){
      cards.innerHTML=jcRenderTodayLayout(filtered,today);
      bindTodaySelection(filtered);
    }else{
      cards.innerHTML=jcRenderFutureGrid(filtered,today);
    }

    qcRenderDateCalendar(selectedDate,availableDates,(ds)=>{
      selectedDate=ds;
      activeLeague='全部';
      render();
    });
  }

  if(prev) prev.onclick=()=>{selectedDate=qcAddDays(selectedDate,-1);activeLeague='全部';render();};
  if(next) next.onclick=()=>{selectedDate=qcAddDays(selectedDate,1);activeLeague='全部';render();};
  if(todayBtn) todayBtn.onclick=()=>{selectedDate=today;activeLeague='全部';render();};
  if(label) label.onclick=()=>{
    qcRenderDateCalendar(selectedDate,availableDates,(ds)=>{
      selectedDate=ds;
      activeLeague='全部';
      render();
    });
    if(pop) pop.hidden=!pop.hidden;
  };

  document.addEventListener('click',e=>{
    if(!pop || pop.hidden) return;
    if(e.target===label || pop.contains(e.target)) return;
    pop.hidden=true;
  });

  render();
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
    .select('id,match_num,business_date,league_name,league_short_name,home_team_name,away_team_name,match_date,match_time,kickoff_at,match_status,jc_market_snapshots(pool_code,goal_line,outcomes,captured_at,official_update_time)')
    .eq('id',id)
    .single();

  if(error || !m){
    root.innerHTML='<div class="profile-card">这场比赛暂时无法读取。</div>';
    return;
  }

  const pools=jcLatestPools(m.jc_market_snapshots || []);
  const order=['had','hhad','crs','ttg','hafu'];

  root.innerHTML=
    '<div class="detail-head">'+
      '<div class="match-top"><span>'+qcEscape(m.match_num || '竞彩')+' · '+qcEscape(m.league_name || m.league_short_name || '—')+'</span><span>'+qcEscape(jcDateTime(m) || '时间待定')+'</span></div>'+
      '<div class="detail-title" style="margin-top:18px">'+
        '<div class="team-badge"><span class="badge-circle">主</span>'+qcEscape(m.home_team_name || '—')+'</div>'+
        '<div class="center-score"><strong>VS</strong><small>'+qcEscape(m.match_status || '赛前')+'</small></div>'+
        '<div class="team-badge right">'+qcEscape(m.away_team_name || '—')+'<span class="badge-circle">客</span></div>'+
      '</div>'+
    '</div>'+
    '<div class="panel"><h2>官方竞彩玩法</h2>'+
      '<div class="jc-detail-grid">'+order.map(code=>{
        const p=pools[code];
        return '<section class="jc-detail-market">'+
          '<div class="jc-detail-market-head"><strong>'+jcPoolLabel(code)+'</strong>'+(p?.goal_line?'<span>让球 '+qcEscape(p.goal_line)+'</span>':'')+'</div>'+
          '<div class="jc-detail-outcomes">'+(p?qcEscape(jcOutcomeSummary(p,code)):'该玩法暂未返回')+'</div>'+
          (p?.official_update_time?'<small>官方更新时间：'+qcEscape(p.official_update_time)+'</small>':'')+
        '</section>';
      }).join('')+'</div>'+
      '<div class="jc-source-line">数据来源：中国体育彩票竞彩足球移动端官方链路</div>'+
    '</div>';
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
function setupDemoAuth(){
  const login = $('#loginForm');

  if(login){
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

      const { data, error } = await window.qcSupabase.auth.signInWithPassword({
        email,
        password
      });

      button.disabled = false;
      button.textContent = '登录';

      if(error){
        let message = '登录失败，请稍后重试';
        const raw = error.message || '';
        if(raw.includes('Invalid login credentials')) message = '邮箱或密码错误';
        if(raw.includes('Email not confirmed')) message = '邮箱尚未完成验证';
        alert(message);
        return;
      }

      if(data.user){
        const next = new URLSearchParams(location.search).get('next');
        const safeNext = next && /^[a-zA-Z0-9._?=&-]+$/.test(next) ? next : 'profile.html';
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

      const { data, error } = await window.qcSupabase.auth.signUp({
        email,
        password
      });

      button.disabled = false;
      button.textContent = '注册';

      if(error){
        let message = '注册失败，请检查邮箱和密码后重试';
        const raw = error.message || '';
        if(raw.includes('already registered') || raw.includes('User already registered')) message = '这个邮箱已经注册，可以直接登录';
        if(raw.includes('Password')) message = '密码不符合要求，请使用至少8个字符';
        if(hint){
          hint.textContent = message;
          hint.className = 'code-hint error';
        }
        alert(message);
        return;
      }

      if(data.session){
        if(hint){
          hint.textContent = '注册成功，正在进入个人中心…';
          hint.className = 'code-hint success';
        }
        location.href = 'profile.html';
        return;
      }

      if(hint){
        hint.textContent = '账号已创建，但 Supabase 的邮箱确认开关仍处于开启状态。关闭后即可注册并直接登录。';
        hint.className = 'code-hint error';
      }
      alert('账号已创建，但邮箱确认功能仍然开启。请先在 Supabase 关闭 Confirm email。');
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
  if(roleEl) roleEl.textContent = role === 'admin' ? '管理员' : role === 'pro' ? 'Pro会员' : '基础用户';
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
    planEl.textContent = role === 'pro' ? 'Pro会员' : '基础用户';
    daysEl.textContent = role === 'pro' ? '会员状态待刷新' : '未开通 Pro';
    expiryEl.textContent = '有效期至：未开通';
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


async function setupAdmin(){
  const root = $('#adminRoot');
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

  const { data: initialStats, error: adminCheckError } = await window.qcSupabase.rpc('admin_dashboard_stats');

  if(adminCheckError){
    const params = new URLSearchParams(location.search);
    const alreadyReauthed = params.get('reauth') === '1';

    if(!alreadyReauthed){
      await window.qcSupabase.auth.signOut();
      location.replace('login.html?next=admin.html?reauth=1');
      return;
    }

    const raw = adminCheckError.message || '';
    const message = raw.includes('ADMIN_REQUIRED')
      ? '当前会话没有识别到管理员权限'
      : '管理员权限校验失败';
    const currentEmail = user && user.email ? user.email : '未识别';

    root.innerHTML =
      '<div class="profile-card"><h2>管理员验证未通过</h2>' +
      '<p style="color:var(--muted);line-height:1.7">' + message + '。</p>' +
      '<div class="kv"><span>当前登录邮箱</span><strong>' + currentEmail + '</strong></div>' +
      '<p style="color:var(--muted);line-height:1.7">请把这一页截图发给我，我可以继续精确定位。</p>' +
      '<a class="small-btn" href="login.html?next=admin.html?reauth=1" style="display:inline-flex;align-items:center">重新登录管理员账号</a></div>';
    return;
  }

  const loadAdminData = async () => {
    const { data: stats, error: statsError } = initialStats
      ? { data: initialStats, error: null }
      : await window.qcSupabase.rpc('admin_dashboard_stats');

    if(!statsError && stats){
      $('#adminUsers').textContent = stats.users ?? 0;
      $('#adminProUsers').textContent = stats.pro_users ?? 0;
      $('#adminUnusedCodes').textContent = stats.unused_codes ?? 0;
      $('#adminUsedCodes').textContent = stats.used_codes ?? 0;
    }

    const [{ count: jcMatches }, { count: jcSnapshots }, latestRunResult, collectorResult, jcRecentResult] = await Promise.all([
      window.qcSupabase.from('jc_matches').select('*', { count: 'exact', head: true }),
      window.qcSupabase.from('jc_market_snapshots').select('*', { count: 'exact', head: true }),
      window.qcSupabase.from('jc_sync_runs')
        .select('status,finished_at,matches_received,matches_upserted,snapshots_inserted,error_message')
        .order('started_at', { ascending: false })
        .limit(1),
      window.qcSupabase.from('jc_collector_devices')
        .select('name,status,last_seen_at,last_success_at,last_error')
        .eq('status','active')
        .order('created_at', { ascending:false })
        .limit(1),
      window.qcSupabase.from('jc_matches')
        .select('id,match_num,match_date,match_time,league_name,league_short_name,home_team_name,away_team_name,jc_market_snapshots(pool_code,captured_at)')
        .order('match_date',{ascending:true})
        .order('match_time',{ascending:true})
        .limit(30)
    ]);

    if($('#jcMatchCount')) $('#jcMatchCount').textContent = jcMatches ?? 0;
    if($('#jcSnapshotCount')) $('#jcSnapshotCount').textContent = jcSnapshots ?? 0;

    const latestRun = latestRunResult.data && latestRunResult.data[0];
    if($('#jcLastSync')){
      if(!latestRun){
        $('#jcLastSync').textContent = '尚未同步';
      }else{
        const time = latestRun.finished_at ? new Date(latestRun.finished_at).toLocaleString('zh-CN') : '进行中';
        const labelMap = {success:'成功',partial:'部分成功',failed:'失败',blocked:'被上游拦截',running:'进行中'};
        $('#jcLastSync').textContent = `${time} · ${labelMap[latestRun.status] || latestRun.status}`;
      }
    }

    const collector = collectorResult.data && collectorResult.data[0];
    if($('#collectorStatus')){
      if(!collector){
        $('#collectorStatus').textContent = '尚未创建';
      }else if(collector.last_success_at){
        $('#collectorStatus').textContent = '正常 · 最近成功 ' + new Date(collector.last_success_at).toLocaleString('zh-CN');
      }else if(collector.last_seen_at){
        $('#collectorStatus').textContent = '已连接 · 等待首次成功同步';
      }else{
        $('#collectorStatus').textContent = '凭证已创建 · 等待自动采集器连接';
      }
    }

    const jcAdminRows = $('#jcAdminMatchRows');
    if(jcAdminRows){
      const items = jcRecentResult.data || [];
      if(!items.length){
        jcAdminRows.innerHTML = '<tr><td colspan="5">暂无竞彩比赛</td></tr>';
      }else{
        jcAdminRows.innerHTML = items.map(m=>{
          const pools = jcLatestPools(m.jc_market_snapshots || []);
          const poolNames = ['had','hhad','crs','ttg','hafu'].filter(k=>pools[k]).map(jcPoolLabel).join(' / ');
          return '<tr>'+
            '<td><strong>'+qcEscape(m.match_num || '—')+'</strong></td>'+
            '<td>'+qcEscape(jcDateTime(m) || '—')+'</td>'+
            '<td>'+qcEscape(m.league_short_name || m.league_name || '—')+'</td>'+
            '<td>'+qcEscape(m.home_team_name || '—')+' vs '+qcEscape(m.away_team_name || '—')+'</td>'+
            '<td>'+qcEscape(poolNames || '暂无')+'</td>'+
          '</tr>';
        }).join('');
      }
    }

    const { data: codes, error: codesError } = await window.qcSupabase.rpc('admin_redeem_codes');
    const rows = $('#redeemCodeRows');

    if(codesError){
      rows.innerHTML = '<tr><td colspan="5">兑换码读取失败</td></tr>';
      return;
    }

    if(!codes || !codes.length){
      rows.innerHTML = '<tr><td colspan="5">暂无兑换码</td></tr>';
      return;
    }

    rows.innerHTML = codes.map(item => {
      const statusText = item.status === 'unused' ? '未使用' : item.status === 'used' ? '已使用' : '已停用';
      const usedBy = item.used_by_email || '—';
      const createdAt = item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '—';
      return `<tr>
        <td><strong>${item.code}</strong></td>
        <td>${item.duration_days}天</td>
        <td>${statusText}</td>
        <td>${usedBy}</td>
        <td>${createdAt}</td>
      </tr>`;
    }).join('');
  };

  await loadAdminData();

  const createCollectorBtn = $('#createCollectorBtn');
  if(createCollectorBtn){
    createCollectorBtn.onclick = async () => {
      const hint = $('#jcSyncHint');
      createCollectorBtn.disabled = true;
      createCollectorBtn.textContent = '创建中...';

      try{
        const { data, error } = await window.qcSupabase.rpc('create_collector_device', {
          p_name:'Windows Auto Collector'
        });

        if(error || !data || !data.ok){
          throw new Error(error?.message || data?.error || 'CREATE_FAILED');
        }

        $('#collectorToken').textContent = data.token;
        $('#collectorTokenBox').hidden = false;
        if(hint){
          hint.textContent = '凭证已创建。把它保存到 Windows 自动采集器里，只需要配置一次。';
          hint.className = 'code-hint success';
        }
        await loadAdminData();
      }catch(err){
        let message = '采集器凭证创建失败';
        const raw = err?.message || '';
        if(raw.includes('NOT_AUTHENTICATED')) message = '登录状态已失效，请重新登录';
        if(raw.includes('ADMIN_REQUIRED')) message = '当前账号没有管理员权限';
        if(hint){
          hint.textContent = message + (raw ? '：' + raw : '');
          hint.className = 'code-hint error';
        }
        alert(message);
      }finally{
        createCollectorBtn.disabled = false;
        createCollectorBtn.textContent = '创建本机采集器凭证';
      }
    };
  }

  const copyCollectorTokenBtn = $('#copyCollectorTokenBtn');
  if(copyCollectorTokenBtn){
    copyCollectorTokenBtn.onclick = async () => {
      const token = ($('#collectorToken')?.textContent || '').trim();
      if(!token || token === '—') return;
      try{
        await navigator.clipboard.writeText(token);
        copyCollectorTokenBtn.textContent = '已复制';
        setTimeout(() => copyCollectorTokenBtn.textContent = '复制', 1200);
      }catch{
        alert('复制失败，请手动复制');
      }
    };
  }

  const form = $('#createCodeForm');
  if(form){
    form.onsubmit = async e => {
      e.preventDefault();

      const days = Number($('#codeDays').value);
      const note = $('#codeNote').value.trim();
      const button = form.querySelector('button[type="submit"]');
      const hint = $('#adminHint');
      const box = $('#createdCodeBox');

      if(!Number.isInteger(days) || days < 1 || days > 3650){
        alert('会员天数请输入 1–3650 之间的整数');
        return;
      }

      button.disabled = true;
      button.textContent = '生成中...';
      hint.textContent = '正在生成兑换码…';
      hint.className = 'code-hint';

      const { data, error } = await window.qcSupabase.rpc('create_redeem_code', {
        p_duration_days: days,
        p_note: note || null
      });

      button.disabled = false;
      button.textContent = '生成兑换码';

      if(error){
        let message = '兑换码生成失败';
        if((error.message || '').includes('ADMIN_REQUIRED')) message = '当前账号没有管理员权限';
        if((error.message || '').includes('INVALID_DURATION')) message = '会员天数不正确';
        hint.textContent = message;
        hint.className = 'code-hint error';
        alert(message);
        return;
      }

      $('#createdCode').textContent = data.code;
      box.hidden = false;
      hint.textContent = `已生成 ${data.duration_days} 天 Pro 会员兑换码。`;
      hint.className = 'code-hint success';
      $('#codeNote').value = '';

      await loadAdminData();
    };
  }

  const copyBtn = $('#copyCodeBtn');
  if(copyBtn){
    copyBtn.onclick = async () => {
      const code = $('#createdCode').textContent.trim();
      if(!code || code === '—') return;

      try{
        await navigator.clipboard.writeText(code);
        copyBtn.textContent = '已复制';
        setTimeout(() => copyBtn.textContent = '复制', 1200);
      }catch{
        alert('复制失败，请长按兑换码复制');
      }
    };
  }
}

document.addEventListener('DOMContentLoaded',()=>{setupDrawer();renderIndex();loadJcFrontend();setupJcMatchDetail();renderMatch();setupDemoAuth();setupAuthNav();setupProfile();setupAdmin();})
