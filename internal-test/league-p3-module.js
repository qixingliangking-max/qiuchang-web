(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const manifest={
    KOR_K1:{season:'2026',url:'p3-data/KOR_K1-2026.json',version:'P3_V5_KOR_STABLE',label:'韩职稳定版'},
    UEFA_UNL:{season:'2026/27',url:'p3-data/UEFA_UNL-2026-27.json',version:'P3_V5_UNL_PILOT',label:'欧国联试点'},
    USA_MLS:{season:'2026',url:'p3-data/USA_MLS-2026.json',version:'P3_V5_USA_MLS_PILOT',label:'美职试点'},
    NOR_ES:{season:'2026',url:'p3-data/NOR_ES-2026.json',version:'P3_V5_NOR_ES_PILOT',label:'挪超试点'}
  };
  const cache=new Map();
  const posLabel={
    GK:'门将',LB_LWB:'左后卫/翼卫',CB:'中卫',RB_RWB:'右后卫/翼卫',
    DM:'后腰',CM:'中场',AM:'前腰',W:'边锋',ST:'中锋'
  };
  const num=(v,d=1)=>v==null||v===''?'—':Number(v).toFixed(d);
  const pct=(v,d=1)=>v==null||v===''?'—':Number(v).toFixed(d)+'%';
  const score=v=>v==null||v===''?'—':Number(v).toFixed(1);
  const listNames=(arr,max=3)=>(Array.isArray(arr)?arr:[]).slice(0,max).map(x=>x?.player_name).filter(Boolean).join('、')||'—';
  const confClass=v=>String(v||'').toLowerCase();

  function meta(code,season){
    const m=manifest[String(code||'')];
    if(!m) return null;
    if(season && String(m.season)!==String(season)) return null;
    return m;
  }

  function status(code,season){
    if(meta(code,season)) return 'P3_VALID';
    if(String(code)==='JPN_J1' && String(season)==='2026/27') return 'RAW_ONLY';
    return '待建设';
  }

  function subtitle(code,season){
    const m=meta(code,season);
    if(m) return m.label+'｜点击后加载P3静态快照';
    if(String(code)==='JPN_J1') return '80场原始P3已回填｜待V5聚合验收';
    return '当前联赛尚未完成P3';
  }

  function hostHtml(comp,teamName,season){
    return '<div class="qc-p3-data-host" data-p3-host '+
      'data-league-code="'+esc(comp?.code||'')+'" '+
      'data-season="'+esc(season||'')+'" '+
      'data-team-name="'+esc(teamName||'')+'">'+
      '<div class="qc-p3-loading">展开后按需读取P3测试快照。</div>'+
    '</div>';
  }

  async function fetchLeague(code,season){
    const m=meta(code,season);
    if(!m) return null;
    const key=code+'|'+season;
    if(cache.has(key)) return cache.get(key);
    const p=fetch(m.url,{cache:'force-cache'})
      .then(r=>{
        if(!r.ok) throw new Error('P3静态快照 HTTP '+r.status);
        return r.json();
      })
      .catch(err=>{cache.delete(key);throw err});
    cache.set(key,p);
    return p;
  }

  function metric(label,value){
    return '<div class="qc-p3-metric"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>';
  }

  function section(title,sub,body){
    return '<section class="qc-p3-section">'+
      '<div class="qc-p3-section-head"><div><strong>'+esc(title)+'</strong>'+(sub?'<span>'+esc(sub)+'</span>':'')+'</div></div>'+
      body+
    '</section>';
  }

  function lineupHtml(p3){
    const s=p3.C_lineup_structure||{};
    const ctx=p3.sample_context||{};
    const body=
      '<div class="qc-p3-summary-grid">'+
        metric('样本',Number(s.squad_matches||ctx.team_matches||0)+'场')+
        metric('球员数',s.unique_players??'—')+
        metric('核心首发',s.core_starters??'—')+
        metric('主阵型',s.most_used_formation||'N/A')+
        metric('阵型稳定',pct(s.formation_stability_pct))+
        metric('赛季首发连续',pct(s.avg_starter_continuity))+
        metric('近5连续',pct(s.last5_lineup_continuity))+
        metric('近10连续',pct(s.last10_lineup_continuity))+
        metric('场均调整',num(s.avg_changes_per_match,1))+
        metric('XI强度',score(s.starting_xi_strength))+
        metric('替补强度',score(s.bench_strength))+
        metric('阵容深度',score(s.squad_depth))+
      '</div>'+
      '<div class="qc-p3-note">样本级别：<b>'+esc(ctx.sample_level||'—')+'</b> · 使用模式：<b>'+esc(ctx.usage_mode||'—')+'</b> · '+esc(ctx.recommended_use||'')+'</div>';
    return section('C｜阵容结构','Formation使用FotMob原始阵型，不做默认补造',body);
  }

  function importanceHtml(p3){
    const rows=(p3.A_player_base||[]).slice(0,12);
    if(!rows.length) return section('A｜球员基础＋重要度','Importance与能力分离','<div class="qc-p3-empty">暂无球员重要度数据</div>');
    const body='<div class="qc-p3-player-list">'+rows.map((p,i)=>
      '<div class="qc-p3-player-card">'+
        '<div class="qc-p3-player-top"><div><em>TOP'+(i+1)+'</em><strong>'+esc(p.player_name)+'</strong><span>'+esc(p.primary_position||'—')+'</span></div><b>'+score(p.importance_score)+'</b></div>'+
        '<div class="qc-p3-player-meta">'+
          '<span>出场 '+Number(p.appearances||0)+'</span>'+
          '<span>首发 '+Number(p.starts||0)+'</span>'+
          '<span>分钟 '+Number(p.minutes||0)+'</span>'+
          '<span>近5 '+pct(p.recent5_usage_pct,0)+'</span>'+
          '<span>近10 '+pct(p.recent10_usage_pct,0)+'</span>'+
          '<span>位置稳定 '+pct(p.tactical_usage_stability_pct,0)+'</span>'+
        '</div>'+
      '</div>'
    ).join('')+'</div>';
    return section('A｜球员基础＋重要度','分钟35%＋首发25%＋近5 15%＋近10 15%＋位置稳定10%',body);
  }

  function performanceHtml(p3){
    const rows=(p3.B_player_performance||[]).slice(0,12);
    if(!rows.length) return section('B｜球员表现','按位置独立模型＋样本置信度','<div class="qc-p3-empty">暂无球员表现数据</div>');
    const body='<div class="qc-p3-performance-list">'+rows.map(p=>
      '<div class="qc-p3-performance-card">'+
        '<div class="qc-p3-performance-head"><div><strong>'+esc(p.player_name)+'</strong><span>'+esc(p.primary_position||'—')+'</span></div>'+
          '<span class="qc-p3-conf '+confClass(p.performance_confidence)+'">'+esc(p.performance_confidence||'N/A')+'</span></div>'+
        '<div class="qc-p3-performance-grid">'+
          metric('Performance',score(p.performance_score))+
          metric('Role Quality',score(p.role_quality))+
          metric('评分',num(p.avg_rating,2))+
          metric('进球/助攻',Number(p.goals||0)+' / '+Number(p.assists||0))+
          metric('xG/xA',num(p.xg,2)+' / '+num(p.xa,2))+
          metric('射门/射正',Number(p.shots||0)+' / '+Number(p.shots_on_target||0))+
        '</div>'+
      '</div>'
    ).join('')+'</div>';
    return section('B｜球员表现','Performance与Importance分离；0分钟球员保留UNTESTED',body);
  }

  function depthHtml(p3){
    const rows=p3.D_squad_depth||[];
    if(!rows.length) return section('D｜阵容深度＋替代链','required_slots总和应=11','<div class="qc-p3-empty">暂无阵容深度数据</div>');
    const body='<div class="qc-p3-depth-list">'+rows.map(d=>
      '<div class="qc-p3-depth-card">'+
        '<div class="qc-p3-depth-head"><div><strong>'+esc(posLabel[d.position_code]||d.position_code)+'</strong><span>槽位 '+Number(d.required_slots||0)+'</span></div>'+
          '<span class="qc-p3-conf '+confClass(d.confidence)+'">'+esc(d.confidence||'N/A')+'</span></div>'+
        '<div class="qc-p3-depth-line"><span>主力组</span><b>'+esc(listNames(d.primary_unit,4))+'</b></div>'+
        '<div class="qc-p3-depth-line"><span>普通替代</span><b>'+esc(listNames(d.replacement_chain,4))+'</b></div>'+
        '<div class="qc-p3-depth-line"><span>应急换位</span><b>'+esc(listNames(d.emergency_shift_options,3))+'</b></div>'+
        '<div class="qc-p3-depth-metrics">'+
          metric('主力RQ',score(d.starter_role_quality))+
          metric('替代RQ',score(d.replacement_role_quality))+
          metric('Raw Gap',d.raw_replacement_gap==null?'—':Number(d.raw_replacement_gap).toFixed(1))+
          metric('Model Loss',score(d.replacement_loss))+
          metric('Depth',score(d.position_depth_score))+
          metric('状态',d.data_status||'—')+
        '</div>'+
      '</div>'
    ).join('')+'</div>';
    return section('D｜阵容深度＋替代链','普通Replacement Pool不允许OTHER_STARTER；跨位主力只进Emergency',body);
  }

  function availabilityHtml(p3){
    const e=p3.E_availability_impact||{};
    const f=p3.model_factors||{};
    const body=
      '<div class="qc-p3-summary-grid">'+
        metric('XI强度',score(f.STARTING_XI_STRENGTH))+
        metric('Bench',score(f.BENCH_STRENGTH))+
        metric('Squad Depth',score(f.SQUAD_DEPTH))+
        metric('进攻核心',score(f.ATTACK_CORE_STRENGTH))+
        metric('中场核心',score(f.MIDFIELD_CORE_STRENGTH))+
        metric('防线核心',score(f.DEFENSE_CORE_STRENGTH))+
      '</div>'+
      '<div class="qc-p3-note"><b>E｜缺阵影响引擎</b>：'+esc(e.note||'P3保存重要度、能力与替代结构；当天可用性由T0提供。')+
      '<br>当前测试页只展示已计算好的P3结构，不执行现场缺阵重算。</div>';
    return section('E｜缺阵影响','OUT / DOUBTFUL / SUSPENDED由当天T0输入，P3只计算损失',body);
  }

  function render(p3){
    if(!p3?.ok){
      return '<div class="qc-p3-empty">P3暂不可用：'+esc(p3?.status||'not_ready')+'</div>';
    }
    return '<div class="qc-p3-real-wrap">'+
      '<div class="qc-p3-real-head">'+
        '<div><strong>P3｜阵容结构＋球员影响</strong><span>'+esc(p3.identity?.team_name||'')+' · '+esc(p3.identity?.season||'')+'</span></div>'+
        '<div><span class="qc-p3-version">'+esc(p3.version||'P3_V5')+'</span><span class="qc-p3-valid">P3_VALID</span></div>'+
      '</div>'+
      lineupHtml(p3)+
      importanceHtml(p3)+
      performanceHtml(p3)+
      depthHtml(p3)+
      availabilityHtml(p3)+
    '</div>';
  }

  async function load(host){
    if(!host || host.dataset.loaded==='1' || host.dataset.loading==='1') return;
    const code=host.dataset.leagueCode||'';
    const season=host.dataset.season||'';
    const team=host.dataset.teamName||'';
    const m=meta(code,season);
    if(!m){
      host.dataset.loaded='1';
      host.innerHTML=String(code)==='JPN_J1'
        ?'<div class="qc-p3-empty"><b>JPN_J1｜RAW_ONLY</b><br>80场原始P3已回填，但V5聚合与阻断项验收尚未完成，因此暂不展示成正式P3。</div>'
        :'<div class="qc-p3-empty">该联赛当前尚未完成P3 V5。</div>';
      return;
    }
    host.dataset.loading='1';
    host.innerHTML='<div class="qc-p3-loading">正在读取 '+esc(m.label)+' 静态快照…</div>';
    try{
      const league=await fetchLeague(code,season);
      const p3=league?.teams?.[team]||null;
      host.innerHTML=render(p3);
      host.dataset.loaded='1';
    }catch(err){
      console.error('P3测试快照加载失败',code,team,err);
      host.innerHTML='<div class="qc-p3-empty">P3测试快照加载失败，请刷新后重试。</div>';
    }finally{
      delete host.dataset.loading;
    }
  }

  window.QCP3={status,subtitle,hostHtml,load};
})();