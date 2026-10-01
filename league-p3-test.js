(()=>{
  const teams=['江原FC','仁川联','光州FC','全北现代','大田韩亚市民','安养FC','富川FC','济州SK','浦项制铁','蔚山HD','金泉尚武','首尔FC'];
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const n=(v,d=1)=>v==null?'—':Number(v).toFixed(d);
  const posLabel={
    GK:'GK',LB_LWB:'LB/LWB',CB:'CB',RB_RWB:'RB/RWB',
    DM:'DM',CM:'CM',AM:'AM',W:'W',ST:'ST'
  };
  const root=$('#p3Root'),select=$('#teamSelect');
  let currentData=null;

  function kpi(label,value){return '<div class="p3-kpi"><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>'}
  function small(label,value){return '<div class="p3-small"><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>'}
  function statusText(v){return v==null?'N/A':String(v)}
  function posName(v){return posLabel[v]||v||'—'}

  function render(data){
    currentData=data;
    const s=data.C_lineup_structure||{};
    const base=Array.isArray(data.A_player_base)?data.A_player_base:[];
    const perf=Array.isArray(data.B_player_performance)?data.B_player_performance:[];
    const depth=Array.isArray(data.D_squad_depth)?data.D_squad_depth:[];
    const f=data.model_factors||{};
    const perfMap=new Map(perf.map(p=>[String(p.player_id),p]));
    const topBase=base.slice(0,18);
    const topPerf=perf.filter(p=>p.performance_score!=null).slice(0,18);
    const formations=Array.isArray(s.formation_samples)?s.formation_samples:[];

    root.className='';
    root.innerHTML=
      '<div class="p3-grid">'+
        kpi('比赛样本',s.squad_matches+'场')+
        kpi('首发连续性',n(s.avg_starter_continuity,1)+'%')+
        kpi('主阵型',s.most_used_formation||'—')+
        kpi('阵型稳定度',n(s.formation_stability_pct,1)+'%')+
      '</div>'+

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>P3-C｜Lineup Structure</strong><span>阵容结构与阵型样本</span></div>'+
        '<div class="p3-summary">'+
          small('不同首发球员',s.unique_starters)+
          small('核心首发',s.core_starters)+
          small('近5连续性',n(s.last5_lineup_continuity,1)+'%')+
          small('近10连续性',n(s.last10_lineup_continuity,1)+'%')+
          small('平均每场调整',n(s.avg_changes_per_match,2)+'人')+
          small('首发XI强度',n(s.starting_xi_strength,1))+
          small('替补强度',n(s.bench_strength,1))+
          small('阵容深度',n(s.squad_depth,1))+
          small('深度数据覆盖',n(s.depth_data_coverage_pct,1)+'%')+
          small('版本',s.p3_version||data.version||'—')+
        '</div>'+
        '<div class="p3-depth">'+formations.map(x=>
          '<div class="p3-depth-card"><h4>'+esc(x.formation)+'</h4>'+
            '<div class="p3-depth-line"><span>使用场次</span><b>'+esc(x.matches)+'</b></div>'+
            '<div class="p3-depth-line"><span>占比</span><b>'+n(x.share_pct,1)+'%</b></div>'+
          '</div>'
        ).join('')+'</div>'+
      '</section>'+

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>P3-A｜Player Base / Importance</strong><span>重要度＝使用与体系依赖，不代表能力</span></div>'+
        '<div class="p3-table-wrap"><table class="p3-table"><thead><tr>'+
          '<th>球员</th><th>主位置</th><th>副位置</th><th>首发</th><th>分钟</th><th>近5使用</th><th>近10使用</th><th>位置稳定</th><th>Importance</th>'+
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
        '<div class="p3-head"><strong>P3-B｜Player Performance</strong><span>按位置模型计算真实表现，与Importance分离</span></div>'+
        '<div class="p3-table-wrap"><table class="p3-table"><thead><tr>'+
          '<th>球员</th><th>位置</th><th>G</th><th>A</th><th>xG</th><th>xA</th><th>射门</th><th>防守动作</th><th>评分</th><th>Performance</th><th>置信度</th>'+
        '</tr></thead><tbody>'+
        topPerf.map(p=>'<tr>'+
          '<td>'+esc(p.player_name)+'</td>'+
          '<td>'+esc(posName(p.primary_position))+'</td>'+
          '<td>'+esc(p.goals)+'</td><td>'+esc(p.assists)+'</td>'+
          '<td>'+n(p.xg,2)+'</td><td>'+n(p.xa,2)+'</td>'+
          '<td>'+esc(p.shots)+'</td><td>'+esc(p.defensive_actions)+'</td>'+
          '<td>'+n(p.avg_rating,2)+'</td>'+
          '<td><b>'+n(p.performance_score,1)+'</b></td>'+
          '<td>'+esc(p.performance_confidence||'—')+'</td>'+
        '</tr>').join('')+
        '</tbody></table></div>'+
      '</section>'+

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>P3-D｜Squad Depth</strong><span>required_slots / 主力组 / 替代链 / 多位置折扣</span></div>'+
        '<div class="p3-depth">'+depth.map(d=>{
          const primary=(d.primary_unit||[]).map(x=>
            x.player_name+'｜I '+n(x.importance_score,1)+' / P '+n(x.performance_score,1)
          ).join('；')||'—';
          const backups=(d.replacement_chain||[]).slice(0,4).map(x=>
            x.player_name+'｜'+
            (x.adjusted_quality==null?'N/A':n(x.adjusted_quality,1))+
            '｜'+(x.fit_type||'—')+' '+n(x.fit_weight,2)
          ).join('；')||'—';
          const scenarios=(d.absence_scenarios||[]).map(x=>{
            const r=x.expected_replacement;
            return x.absent_player_name+' → '+(r?.player_name||'N/A')+
              '｜Gap '+(x.replacement_gap==null?'N/A':n(x.replacement_gap,1));
          }).join('；')||'—';
          return '<div class="p3-depth-card"><h4>'+esc(posName(d.position_code))+'｜首发槽位 '+esc(d.required_slots)+'</h4>'+
            '<div class="p3-depth-line"><span>主力组</span><b>'+esc(primary)+'</b></div>'+
            '<div class="p3-depth-line"><span>替代链</span><b>'+esc(backups)+'</b></div>'+
            '<div class="p3-depth-line"><span>逐槽缺阵场景</span><b>'+esc(scenarios)+'</b></div>'+
            '<div class="p3-depth-line"><span>Starter Quality</span><b>'+n(d.starter_quality,1)+'</b></div>'+
            '<div class="p3-depth-line"><span>Replacement Quality</span><b>'+statusText(d.replacement_quality==null?'N/A':n(d.replacement_quality,1))+'</b></div>'+
            '<div class="p3-depth-line"><span>Position Coverage</span><b>'+n(d.position_coverage,1)+'%</b></div>'+
            '<div class="p3-depth-line"><span>Multi-position</span><b>'+n(d.multi_position_coverage,1)+'%</b></div>'+
            '<div class="p3-depth-line"><span>Depth Score</span><b>'+(d.position_depth_score==null?'DATA_INCOMPLETE':n(d.position_depth_score,1))+'</b></div>'+
            '<div class="p3-depth-line"><span>状态 / 置信度</span><b>'+esc((d.data_status||'—')+' / '+(d.confidence||'—'))+'</b></div>'+
          '</div>';
        }).join('')+'</div>'+
      '</section>'+

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>Bench Strength｜分线</strong><span>只统计有真实替代意义的已验证球员</span></div>'+
        '<div class="p3-summary">'+
          small('Bench Overall',n(s.bench_strength,1))+
          small('Defensive Bench',n(s.defensive_bench_strength,1))+
          small('Midfield Bench',n(s.midfield_bench_strength,1))+
          small('Attacking Bench',n(s.attacking_bench_strength,1))+
          small('Defense Core',n(s.defense_core_strength,1))+
          small('Midfield Core',n(s.midfield_core_strength,1))+
          small('Attack Core',n(s.attack_core_strength,1))+
        '</div>'+
      '</section>'+

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>P3-E｜Availability Impact Engine</strong><span>P3算损失，T0负责今天谁OUT/DOUBTFUL/SUSPENDED</span></div>'+
        '<div class="p3-impact-controls"><select id="impactPlayer">'+topBase.map(p=>
          '<option value="'+esc(p.player_name)+'">'+esc(p.player_name)+'｜I '+n(p.importance_score,1)+'</option>'
        ).join('')+'</select><button id="impactBtn">模拟缺阵</button></div>'+
        '<div id="impactResult" class="p3-impact-result">选择球员后点击“模拟缺阵”。</div>'+
        '<div class="p3-note">缺失替代能力不会按0处理；如替代球员无实际比赛证据，Replacement Gap / 调整后强度会保持N/A。</div>'+
      '</section>'+

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>模型压缩因子</strong><span>供T0/T1直接读取</span></div>'+
        '<div class="p3-factor">'+
          small('LINEUP_CONTINUITY',n(f.LINEUP_CONTINUITY,3))+
          small('RECENT5_CONTINUITY',n(f.RECENT5_LINEUP_CONTINUITY,3))+
          small('RECENT10_CONTINUITY',n(f.RECENT10_LINEUP_CONTINUITY,3))+
          small('FORMATION_STABILITY',n(f.FORMATION_STABILITY,3))+
          small('STARTING_XI_STRENGTH',n(f.STARTING_XI_STRENGTH,1))+
          small('BENCH_STRENGTH',n(f.BENCH_STRENGTH,1))+
          small('SQUAD_DEPTH',n(f.SQUAD_DEPTH,1))+
          small('ATTACK_CORE_STRENGTH',n(f.ATTACK_CORE_STRENGTH,1))+
          small('MIDFIELD_CORE_STRENGTH',n(f.MIDFIELD_CORE_STRENGTH,1))+
          small('DEFENSE_CORE_STRENGTH',n(f.DEFENSE_CORE_STRENGTH,1))+
          small('REPLACEMENT_GAP',f.REPLACEMENT_GAP==null?'动态':n(f.REPLACEMENT_GAP,3))+
          small('AVAILABILITY_IMPACT',f.AVAILABILITY_IMPACT==null?'动态':n(f.AVAILABILITY_IMPACT,3))+
        '</div>'+
      '</section>';

    $('#impactBtn').onclick=loadImpact;
  }

  async function loadTeam(){
    const team=select.value;
    root.className='p3-loading';root.textContent='正在读取 '+team+' P3 V3…';
    const {data,error}=await window.qcSupabase.rpc('get_league_team_p3',{
      p_team_query:team,p_league_code:'KOR_K1',p_season:'2026'
    });
    if(error||!data?.ok){
      root.textContent='P3读取失败：'+(error?.message||data?.status||'unknown');
      return;
    }
    render(data);
  }

  async function loadImpact(){
    const player=$('#impactPlayer')?.value;
    if(!player) return;
    const box=$('#impactResult');box.textContent='正在计算缺阵影响…';
    const {data,error}=await window.qcSupabase.rpc('get_league_team_p3_absence_impact',{
      p_team_query:select.value,p_league_code:'KOR_K1',p_season:'2026',p_player_query:player
    });
    if(error||!data?.ok){
      box.textContent='计算失败：'+(error?.message||data?.status||'unknown');
      return;
    }
    const repl=data.expected_replacement;
    const adj=data.model_factors_adjusted||{};
    box.innerHTML='<div class="p3-impact-box">'+
      small('缺阵球员',data.player?.player_name||'—')+
      small('Importance',n(data.player?.importance_score,1))+
      small('Performance',n(data.player?.performance_score,1))+
      small('位置 / 槽位',posName(data.position_code)+' / '+(data.required_slots??'—'))+
      small('Expected Replacement',repl?.player_name||'N/A')+
      small('Replacement Quality',repl?.adjusted_quality==null?'N/A':n(repl.adjusted_quality,1))+
      small('Replacement Gap',data.replacement_gap==null?'N/A':n(data.replacement_gap,1))+
      small('影响级别',String(data.impact_level||'—')+' / '+String(data.impact_confidence||'—'))+
      small('首发XI',n(data.starting_xi_strength_before,1)+' → '+n(data.starting_xi_strength_after,1))+
      small('Position Depth',n(data.position_depth_before,1)+' → '+n(data.position_depth_after,1))+
      small('Squad Depth',n(data.squad_depth_before,1)+' → '+n(data.squad_depth_after,1))+
      small('Attack Δ',n(data.attack_delta,1))+
      small('Midfield Δ',n(data.midfield_delta,1))+
      small('Defense Δ',n(data.defense_delta,1))+
      small('Overall Impact',n(data.overall_absence_impact,1))+
      small('XI Adjusted',n(adj.STARTING_XI_STRENGTH_ADJUSTED,1))+
      small('Attack Availability',n(adj.ATTACK_CORE_AVAILABILITY,3))+
      small('Mid Availability',n(adj.MIDFIELD_CORE_AVAILABILITY,3))+
      small('Defense Availability',n(adj.DEFENSE_CORE_AVAILABILITY,3))+
      '</div>';
  }

  async function init(){
    if(!window.qcSupabase){root.textContent='数据连接未就绪';return}
    const {data}=await window.qcSupabase.auth.getSession();
    if(!data?.session){root.textContent='请先登录后查看P3测试页。';return}
    const pro=await window.qcSupabase.rpc('has_active_pro_access');
    if(pro.data!==true){root.textContent='当前账号没有P3测试权限。';return}
    select.innerHTML=teams.map(t=>'<option value="'+t+'">'+t+'</option>').join('');
    select.value='江原FC';
    select.onchange=loadTeam;
    await loadTeam();
  }

  document.addEventListener('DOMContentLoaded',init);
})();