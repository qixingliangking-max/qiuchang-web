(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const n=(v,d=1)=>v==null?'—':Number(v).toFixed(d);
  const posLabel={
    GK:'门将',LB_LWB:'左后卫/左翼卫',CB:'中后卫',RB_RWB:'右后卫/右翼卫',
    DM:'后腰',CM:'中前卫',AM:'前腰',W:'边锋',ST:'中锋'
  };
  const levelText={HIGH:'高',MEDIUM:'中',LOW:'低',UNTESTED:'未验证'};
  const statusMap={
    VALID:'有效',PARTIAL:'部分有效',DATA_INCOMPLETE:'数据不足',
    NO_BACKUP:'无可验证替补',P3_VALID:'P3有效'
  };
  const fitMap={PRIMARY:'主位置',SECONDARY:'副位置',EMERGENCY:'应急客串'};
  const textLevel=v=>levelText[v]||v||'—';
  const textStatus=v=>statusMap[v]||v||'—';
  const textFit=v=>fitMap[v]||v||'—';
  const posName=v=>posLabel[v]||v||'—';
  const statusText=v=>v==null?'N/A':String(v);

  const manifest={
    KOR_K1:{season:'2026',url:'internal-test/p3-data/KOR_K1-2026.json',version:'P3_V5_KOR_STABLE',label:'韩职P3 V5稳定版',quality:'STABLE'},
    UEFA_UNL:{season:'2026/27',url:'internal-test/p3-data/UEFA_UNL-2026-27.json',version:'P3_V5_UNL_PILOT',label:'欧国联P3 V5试点',quality:'LIMITED'},
    USA_MLS:{season:'2026',url:'internal-test/p3-data/USA_MLS-2026.json',version:'P3_V5_USA_MLS_PILOT',label:'美职P3 V5试点',quality:'PILOT_FULL'},
    BRA_SA:{season:'2026',url:'internal-test/p3-data/BRA_SA-2026.json?v=20261006bra1',version:'P3_V5_BRA_SA_PILOT',label:'巴甲P3 V5试点',quality:'PILOT_FULL'},
    NOR_ES:{season:'2026',url:'internal-test/p3-data/NOR_ES-2026.json',version:'P3_V5_NOR_ES_PILOT',label:'挪超P3 V5试点',quality:'PILOT_FULL'},
    JPN_J1:{season:'2026/27',url:'internal-test/p3-data/JPN_J1-2026-27.json?v=20261002offline1',version:'P3_V5_JPN_J1_PILOT',label:'日职P3 V5试点',quality:'LIMITED'},
    SWE_AS:{season:'2026',url:'internal-test/p3-data/SWE_AS-2026.json?v=20261002swe1',version:'P3_V5_SWE_AS_PILOT',label:'瑞典超P3 V5试点',quality:'PILOT_FULL'},
    FIN_VL:{season:'2026',url:'internal-test/p3-data/FIN_VL-2026.json?v=20261002fin1',version:'P3_V5_FIN_VL_PILOT',label:'芬超P3 V5试点',quality:'PILOT_FULL'},
    UEFA_UCL:{season:'2026/27',url:'internal-test/p3-data/UEFA_UCL-2026-27.json?v=20261002bulk1',version:'P3_V5_UEFA_UCL_PILOT',label:'欧冠P3 V5试点',quality:'LIMITED'},
    UEFA_UEL:{season:'2026/27',url:'internal-test/p3-data/UEFA_UEL-2026-27.json?v=20261002bulk1',version:'P3_V5_UEFA_UEL_PILOT',label:'欧联P3 V5试点',quality:'LIMITED'},
    GER_BL:{season:'2026/27',url:'internal-test/p3-data/GER_BL-2026-27.json?v=20261002bulk1',version:'P3_V5_GER_BL_PILOT',label:'德甲P3 V5试点',quality:'LIMITED'},
    ITA_SA:{season:'2026/27',url:'internal-test/p3-data/ITA_SA-2026-27.json?v=20261002bulk1',version:'P3_V5_ITA_SA_PILOT',label:'意甲P3 V5试点',quality:'LIMITED'},
    FRA_L1:{season:'2026/27',url:'internal-test/p3-data/FRA_L1-2026-27.json?v=20261002bulk1',version:'P3_V5_FRA_L1_PILOT',label:'法甲P3 V5试点',quality:'LIMITED'},
    ENG_PL:{season:'2026/27',url:'internal-test/p3-data/ENG_PL-2026-27.json?v=20261002bulk1',version:'P3_V5_ENG_PL_PILOT',label:'英超P3 V5试点',quality:'LIMITED'},
    NED_ED:{season:'2026/27',url:'internal-test/p3-data/NED_ED-2026-27.json?v=20261002bulk1',version:'P3_V5_NED_ED_PILOT',label:'荷甲P3 V5试点',quality:'LIMITED'},
    POR_PL:{season:'2026/27',url:'internal-test/p3-data/POR_PL-2026-27.json?v=20261002bulk1',version:'P3_V5_POR_PL_PILOT',label:'葡超P3 V5试点',quality:'LIMITED'},
    ESP_LL:{season:'2026/27',url:'internal-test/p3-data/ESP_LL-2026-27.json?v=20261002bulk1',version:'P3_V5_ESP_LL_PILOT',label:'西甲P3 V5试点',quality:'LIMITED'},
    GER_B2:{season:'2026/27',url:'internal-test/p3-data/GER_B2-2026-27.json?v=20261002bulk1',version:'P3_V5_GER_B2_PILOT',label:'德乙P3 V5试点',quality:'LIMITED'},
    ITA_SB:{season:'2026/27',url:'internal-test/p3-data/ITA_SB-2026-27.json?v=20261002bulk1',version:'P3_V5_ITA_SB_PILOT',label:'意乙P3 V5试点',quality:'LIMITED'},
    FRA_L2:{season:'2026/27',url:'internal-test/p3-data/FRA_L2-2026-27.json?v=20261002bulk1',version:'P3_V5_FRA_L2_PILOT',label:'法乙P3 V5试点',quality:'LIMITED'},
    ENG_CH:{season:'2026/27',url:'internal-test/p3-data/ENG_CH-2026-27.json?v=20261002bulk1',version:'P3_V5_ENG_CH_PILOT',label:'英冠P3 V5试点',quality:'LIMITED'},
    ESP_L2:{season:'2026/27',url:'internal-test/p3-data/ESP_L2-2026-27.json?v=20261002bulk1',version:'P3_V5_ESP_L2_PILOT',label:'西乙P3 V5试点',quality:'LIMITED'},
    NED_EE:{season:'2026/27',url:'internal-test/p3-data/NED_EE-2026-27.json?v=20261002bulk1',version:'P3_V5_NED_EE_PILOT',label:'荷乙P3 V5试点',quality:'LIMITED'}
  };
  const cache=new Map();

  function meta(code,season){
    const m=manifest[String(code||'')];
    if(!m) return null;
    if(season && String(m.season)!==String(season)) return null;
    return m;
  }
  function status(code,season){
    if(meta(code,season)) return 'P3_VALID';
    return '待建设';
  }
  function subtitle(code,season){
    const m=meta(code,season);
    if(m) return '阵容结构与球员影响｜点击展开';
    return '当前联赛尚未完成P3';
  }
  function hostHtml(comp,teamName,season){
    return '<div class="p3-legacy-host" data-p3-host data-league-code="'+esc(comp?.code||'')+
      '" data-season="'+esc(season||'')+'" data-team-name="'+esc(teamName||'')+'">'+
      '<div class="p3-loading">展开后读取阵容数据。</div>'+
    '</div>';
  }
  async function fetchLeague(code,season){
    const m=meta(code,season); if(!m) return null;
    const key=code+'|'+season;
    if(cache.has(key)) return cache.get(key);
    const p=fetch(m.url,{cache:'no-cache'}).then(r=>{
      if(!r.ok) throw new Error('P3 snapshot HTTP '+r.status);
      return r.json();
    }).catch(err=>{cache.delete(key);throw err});
    cache.set(key,p); return p;
  }

  function kpi(label,value){return '<div class="p3-kpi"><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>'}
  function small(label,value){return '<div class="p3-small"><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>'}
  function render(data,ctx){
    const s=data.C_lineup_structure||{};
    const base=Array.isArray(data.A_player_base)?data.A_player_base:[];
    const perf=Array.isArray(data.B_player_performance)?data.B_player_performance:[];
    const depth=Array.isArray(data.D_squad_depth)?data.D_squad_depth:[];
    const topBase=base.slice(0,18);
    const topPerf=perf.filter(p=>p.performance_score!=null).slice(0,18);
    const formations=Array.isArray(s.formation_samples)?s.formation_samples:[];

    return '<div class="p3-legacy-wrap">'+
      '<div class="p3-legacy-titlebar"><div><strong>P3｜球员与阵容贡献模块</strong><span>'+esc(data.identity?.team_name||'')+'｜'+esc(data.identity?.season||'')+'</span></div></div>'+
      '<div class="p3-grid">'+
        kpi('比赛样本',(s.squad_matches??0)+'场')+
        kpi('首发连续性',n(s.avg_starter_continuity,1)+'%')+
        kpi('主阵型',s.most_used_formation||'—')+
        kpi('阵型稳定度',n(s.formation_stability_pct,1)+'%')+
      '</div>'+

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>P3-C｜阵容结构</strong><span>首发连续性与阵型样本</span></div>'+
        '<div class="p3-summary">'+
          small('不同首发球员',s.unique_starters)+
          small('核心首发',s.core_starters)+
          small('近5连续性',n(s.last5_lineup_continuity,1)+'%')+
          small('近10连续性',n(s.last10_lineup_continuity,1)+'%')+
          small('平均每场调整',n(s.avg_changes_per_match,2)+'人')+
          small('首发XI强度',n(s.starting_xi_strength,1))+
          small('替补强度',n(s.bench_strength,1))+
          small('阵容深度',n(s.squad_depth,1))+
        '</div>'+
        '<div class="p3-depth">'+formations.map(x=>
          '<div class="p3-depth-card"><h4>'+esc(x.formation)+'</h4>'+
            '<div class="p3-depth-line"><span>使用场次</span><b>'+esc(x.matches)+'</b></div>'+
            '<div class="p3-depth-line"><span>占比</span><b>'+n(x.share_pct,1)+'%</b></div>'+
          '</div>'
        ).join('')+'</div>'+
      '</section>'+

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>P3-A｜球员基础 / 重要度</strong><span>重要度＝使用与体系依赖，不代表能力</span></div>'+
        '<div class="p3-table-wrap"><table class="p3-table"><thead><tr>'+
          '<th>球员</th><th>主位置</th><th>副位置</th><th>首发</th><th>分钟</th><th>近5使用</th><th>近10使用</th><th>位置稳定</th><th>重要度</th>'+
        '</tr></thead><tbody>'+
        topBase.map(p=>'<tr>'+
          '<td>'+esc(p.player_name)+'</td>'+
          '<td>'+esc(posName(p.primary_position))+'</td>'+
          '<td>'+esc((p.secondary_positions||[]).map(posName).join('/')||'—')+'</td>'+
          '<td>'+esc(p.starts)+'</td><td>'+esc(p.minutes)+'</td>'+
          '<td>'+n(p.recent5_usage_pct,1)+'%</td>'+
          '<td>'+n(p.recent10_usage_pct,1)+'%</td>'+
          '<td>'+n(p.tactical_usage_stability_pct,1)+'%</td>'+
          '<td><b>'+n(p.importance_score,1)+'</b></td>'+
        '</tr>').join('')+
        '</tbody></table></div>'+
      '</section>'+

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>P3-B｜球员表现</strong><span>按位置模型计算真实表现，与重要度分离</span></div>'+
        '<div class="p3-table-wrap"><table class="p3-table"><thead><tr>'+
          '<th>球员</th><th>位置</th><th>进球</th><th>助攻</th><th>xG</th><th>xA</th><th>射门</th><th>防守动作</th><th>平均评分</th><th>表现分</th><th>角色质量</th><th>置信度</th>'+
        '</tr></thead><tbody>'+
        topPerf.map(p=>'<tr>'+
          '<td>'+esc(p.player_name)+'</td>'+
          '<td>'+esc(posName(p.primary_position))+'</td>'+
          '<td>'+esc(p.goals)+'</td><td>'+esc(p.assists)+'</td>'+
          '<td>'+n(p.xg,2)+'</td><td>'+n(p.xa,2)+'</td>'+
          '<td>'+esc(p.shots)+'</td><td>'+esc(p.defensive_actions)+'</td>'+
          '<td>'+n(p.avg_rating,2)+'</td>'+
          '<td><b>'+n(p.performance_score,1)+'</b></td>'+
          '<td><b>'+n(p.role_quality,1)+'</b></td>'+
          '<td>'+esc(textLevel(p.performance_confidence))+'</td>'+
        '</tr>').join('')+
        '</tbody></table></div>'+
      '</section>'+

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>P3-D｜阵容深度</strong><span>首发槽位 / 普通替补链 / 应急换位方案</span></div>'+
        '<div class="p3-depth">'+depth.map(d=>{
          const primary=(d.primary_unit||[]).map(x=>
            x.player_name+'｜重要度 '+n(x.importance_score,1)+' / 表现 '+n(x.performance_score,1)
          ).join('；')||'—';
          const backups=(d.replacement_chain||[]).slice(0,4).map(x=>
            x.player_name+'｜'+(x.adjusted_quality==null?'暂无可靠质量分':n(x.adjusted_quality,1))+
            '｜'+textFit(x.fit_type)+' '+n(x.fit_weight,2)
          ).join('；')||'—';
          const shifts=(d.emergency_shift_options||[]).slice(0,4).map(x=>
            x.player_name+'｜'+posName(x.origin_position)+' → '+posName(d.position_code)+
            '｜'+textFit(x.fit_type)+' '+n(x.fit_weight,2)
          ).join('；')||'—';
          const scenarios=(d.absence_scenarios||[]).map(x=>{
            const r=x.expected_replacement;
            return x.absent_player_name+' → '+(r?.player_name||'暂无可靠替代')+
              '｜替代质量差 '+(x.raw_replacement_gap==null?'暂无':n(x.raw_replacement_gap,1))+
              '｜模型损失 '+(x.replacement_loss==null?'暂无':n(x.replacement_loss,1));
          }).join('；')||'—';
          return '<div class="p3-depth-card"><h4>'+esc(posName(d.position_code))+'｜首发槽位 '+esc(d.required_slots)+'</h4>'+
            '<div class="p3-depth-summary">'+
              '<div class="p3-depth-line"><span>主力组质量</span><b>'+n(d.starter_quality,1)+'</b></div>'+
              '<div class="p3-depth-line"><span>首选替代质量</span><b>'+statusText(d.replacement_quality==null?'暂无':n(d.replacement_quality,1))+'</b></div>'+
              '<div class="p3-depth-line"><span>替代质量差（替代−主力）</span><b>'+(d.raw_replacement_gap==null?'暂无':n(d.raw_replacement_gap,1))+'</b></div>'+
              '<div class="p3-depth-line"><span>模型损失</span><b>'+(d.replacement_loss==null?'暂无':n(d.replacement_loss,1))+'</b></div>'+
              '<div class="p3-depth-line"><span>位置覆盖率</span><b>'+n(d.position_coverage,1)+'%</b></div>'+
              '<div class="p3-depth-line"><span>状态 / 置信度</span><b>'+esc(textStatus(d.data_status)+' / '+textLevel(d.confidence))+'</b></div>'+
            '</div>'+
            '<details class="p3-depth-more">'+
              '<summary><span>查看替补链 / 缺阵场景</span><i>›</i></summary>'+
              '<div class="p3-depth-more-body">'+
                '<div class="p3-depth-line"><span>主力组</span><b>'+esc(primary)+'</b></div>'+
                '<div class="p3-depth-line"><span>普通替补链</span><b>'+esc(backups)+'</b></div>'+
                '<div class="p3-depth-line"><span>逐槽缺阵场景</span><b>'+esc(scenarios)+'</b></div>'+
                '<div class="p3-depth-line"><span>应急换位方案</span><b>'+esc(shifts)+'</b></div>'+
                '<div class="p3-depth-line"><span>多位置覆盖率</span><b>'+n(d.multi_position_coverage,1)+'%</b></div>'+
                '<div class="p3-depth-line"><span>位置深度评分</span><b>'+(d.position_depth_score==null?'数据不足':n(d.position_depth_score,1))+'</b></div>'+
              '</div>'+
            '</details>'+
          '</div>';
        }).join('')+'</div>'+
      '</section>'+

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>替补强度｜分线</strong><span>球队整体替补基线｜与P3-D单位置替代链分开计算</span></div>'+
        '<div class="p3-summary">'+
          small('整体替补强度',n(s.bench_strength,1))+
          small('防线替补强度',n(s.defensive_bench_strength,1))+
          small('中场替补强度',n(s.midfield_bench_strength,1))+
          small('攻击线替补强度',n(s.attacking_bench_strength,1))+
          small('防线核心强度',n(s.defense_core_strength,1))+
          small('中场核心强度',n(s.midfield_core_strength,1))+
          small('攻击线核心强度',n(s.attack_core_strength,1))+
        '</div>'+
      '</section>'+

    '</div>';
  }

  async function load(host){
    if(!host||host.dataset.loaded==='1'||host.dataset.loading==='1') return;
    const code=host.dataset.leagueCode||'', season=host.dataset.season||'', team=host.dataset.teamName||'';
    const m=meta(code,season);
    if(!m){
      host.dataset.loaded='1';
      host.innerHTML='<div class="p3-loading">当前暂无可展示的阵容数据。</div>';
      return;
    }
    host.dataset.loading='1';
    host.innerHTML='<div class="p3-loading">正在读取阵容数据…</div>';
    try{
      const league=await fetchLeague(code,season);
      const p3=league?.teams?.[team]||null;
      host.innerHTML=p3?.ok?render(p3,{quality:m.quality,generated_at:league?.generated_at}):'<div class="p3-loading">当前暂无可展示的阵容数据。</div>';
      host.dataset.loaded='1';
    }catch(err){
      console.error('P3 snapshot load failed',code,team,err);
      host.innerHTML='<div class="p3-loading">阵容数据加载失败，请刷新重试。</div>';
    }finally{
      delete host.dataset.loading;
    }
  }

  window.QCP3={status,subtitle,hostHtml,load};
})();