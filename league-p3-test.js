(()=>{
  const teams=['江原FC','仁川联','光州FC','全北现代','大田韩亚市民','安养FC','富川FC','济州SK','浦项制铁','蔚山HD','金泉尚武','首尔FC'];
  const $=s=>document.querySelector(s);
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
  const absenceMap={STARTER:'首发缺阵',ROTATION_BENCH:'轮换替补缺阵',NON_ROTATION:'非轮换球员'};
  const textLevel=v=>levelText[v]||v||'—';
  const textStatus=v=>statusMap[v]||v||'—';
  const textFit=v=>fitMap[v]||v||'—';
  const textAbsence=v=>absenceMap[v]||v||'—';
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
          small('深度数据覆盖',n(s.depth_data_coverage_pct,1)+'%')+
          small('阵型来源',s.formation_source||'—')+
          small('阵型覆盖率',n(s.formation_coverage_pct,1)+'%')+
          small('Performance模型',s.performance_model_version||'—')+
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
            x.player_name+'｜'+
            (x.adjusted_quality==null?'暂无可靠质量分':n(x.adjusted_quality,1))+
            '｜'+textFit(x.fit_type)+' '+n(x.fit_weight,2)
          ).join('；')||'—';
          const shifts=(d.emergency_shift_options||[]).slice(0,4).map(x=>
            x.player_name+'｜'+posName(x.origin_position)+' → '+posName(d.position_code)+
            '｜'+textFit(x.fit_type)+' '+n(x.fit_weight,2)
          ).join('；')||'—';
          const scenarios=(d.absence_scenarios||[]).map(x=>{
            const r=x.expected_replacement;
            return x.absent_player_name+' → '+(r?.player_name||'暂无可靠替代')+
              '｜原始替代差 '+(x.raw_replacement_gap==null?'暂无':n(x.raw_replacement_gap,1))+
              '｜模型损失 '+(x.replacement_loss==null?'暂无':n(x.replacement_loss,1));
          }).join('；')||'—';
          return '<div class="p3-depth-card"><h4>'+esc(posName(d.position_code))+'｜首发槽位 '+esc(d.required_slots)+'</h4>'+
            '<div class="p3-depth-line"><span>主力组</span><b>'+esc(primary)+'</b></div>'+
            '<div class="p3-depth-line"><span>普通替补链</span><b>'+esc(backups)+'</b></div>'+
            '<div class="p3-depth-line"><span>应急换位方案</span><b>'+esc(shifts)+'</b></div>'+
            '<div class="p3-depth-line"><span>逐槽缺阵场景</span><b>'+esc(scenarios)+'</b></div>'+
            '<div class="p3-depth-line"><span>主力组质量</span><b>'+n(d.starter_quality,1)+'</b></div>'+
            '<div class="p3-depth-line"><span>普通替补质量</span><b>'+statusText(d.replacement_quality==null?'暂无':n(d.replacement_quality,1))+'</b></div>'+
            '<div class="p3-depth-line"><span>原始替代差</span><b>'+(d.raw_replacement_gap==null?'暂无':n(d.raw_replacement_gap,1))+'</b></div>'+
            '<div class="p3-depth-line"><span>模型损失</span><b>'+(d.replacement_loss==null?'暂无':n(d.replacement_loss,1))+'</b></div>'+
            '<div class="p3-depth-line"><span>位置覆盖率</span><b>'+n(d.position_coverage,1)+'%</b></div>'+
            '<div class="p3-depth-line"><span>多位置覆盖率</span><b>'+n(d.multi_position_coverage,1)+'%</b></div>'+
            '<div class="p3-depth-line"><span>位置深度评分</span><b>'+(d.position_depth_score==null?'数据不足':n(d.position_depth_score,1))+'</b></div>'+
            '<div class="p3-depth-line"><span>数据状态 / 置信度</span><b>'+esc(textStatus(d.data_status)+' / '+textLevel(d.confidence))+'</b></div>'+
          '</div>';
        }).join('')+'</div>'+
      '</section>'+

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>替补强度｜分线</strong><span>只统计普通替补池中有真实替代意义的已验证球员</span></div>'+
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

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>P3-E｜缺阵影响模拟</strong><span>P3负责计算损失，T0负责当天缺阵 / 伤疑 / 停赛信息</span></div>'+
        '<div class="p3-impact-controls"><select id="impactPlayer">'+topBase.map(p=>
          '<option value="'+esc(p.player_name)+'">'+esc(p.player_name)+'｜I '+n(p.importance_score,1)+'</option>'
        ).join('')+'</select><button id="impactBtn">模拟缺阵</button></div>'+
        '<div id="impactResult" class="p3-impact-result">选择球员后点击“模拟缺阵”。</div>'+
        '<div class="p3-note">缺失替代能力不会按0处理；如替代球员无实际比赛证据，Replacement Gap / 调整后强度会保持N/A。</div>'+
      '</section>'+

      '<section class="p3-section">'+
        '<div class="p3-head"><strong>模型压缩因子</strong><span>供T0/T1直接读取</span></div>'+
        '<div class="p3-factor">'+
          small('首发连续性',n(f.LINEUP_CONTINUITY,3))+
          small('近5场首发连续性',n(f.RECENT5_LINEUP_CONTINUITY,3))+
          small('近10场首发连续性',n(f.RECENT10_LINEUP_CONTINUITY,3))+
          small('阵型稳定度',n(f.FORMATION_STABILITY,3))+
          small('首发阵容强度',n(f.STARTING_XI_STRENGTH,1))+
          small('替补席强度',n(f.BENCH_STRENGTH,1))+
          small('阵容深度',n(f.SQUAD_DEPTH,1))+
          small('攻击线核心强度',n(f.ATTACK_CORE_STRENGTH,1))+
          small('中场核心强度',n(f.MIDFIELD_CORE_STRENGTH,1))+
          small('防线核心强度',n(f.DEFENSE_CORE_STRENGTH,1))+
          small('替代差',f.REPLACEMENT_GAP==null?'赛前动态计算':n(f.REPLACEMENT_GAP,3))+
          small('可用性影响',f.AVAILABILITY_IMPACT==null?'赛前动态计算':n(f.AVAILABILITY_IMPACT,3))+
        '</div>'+
      '</section>';

    $('#impactBtn').onclick=loadImpact;
  }

  async function loadTeam(){
    const team=select.value;
    root.className='p3-loading';root.textContent='正在读取 '+team+' P3 V5…';
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
      small('缺阵类型',textAbsence(data.absence_type))+
      small('重要度',n(data.player?.importance_score,1))+
      small('表现分',n(data.player?.performance_score,1))+
      small('角色质量',n(data.player?.role_quality,1))+
      small('位置 / 槽位',posName(data.position_code)+' / '+(data.required_slots??'—'))+
      small('替补顺位',data.replacement_rank==null?'首发':('#'+data.replacement_rank))+
      small('预计替代者',repl?.player_name||'暂无可靠替代')+
      small('替代者质量',repl?.adjusted_quality==null?'暂无':n(repl.adjusted_quality,1))+
      small('原始替代差',data.raw_replacement_gap==null?'暂无':n(data.raw_replacement_gap,1))+
      small('模型损失',data.replacement_loss==null?'暂无':n(data.replacement_loss,1))+
      small('潜在影响',textLevel(data.potential_impact||data.impact_level))+
      small('置信度',textLevel(data.confidence||data.impact_confidence))+
      small('首发XI',n(data.starting_xi_strength_before,1)+' → '+n(data.starting_xi_strength_after,1))+
      small('替补席强度',n(data.bench_strength_before,1)+' → '+n(data.bench_strength_after,1))+
      small('位置深度',n(data.position_depth_before,1)+' → '+n(data.position_depth_after,1))+
      small('阵容深度',n(data.squad_depth_before,1)+' → '+n(data.squad_depth_after,1))+
      small('攻击线变化',n(data.attack_delta,1))+
      small('中场变化',n(data.midfield_delta,1))+
      small('防线变化',n(data.defense_delta,1))+
      small('综合缺阵影响',n(data.overall_absence_impact,1))+
      small('调整后首发强度',n(adj.STARTING_XI_STRENGTH_ADJUSTED,1))+
      small('攻击线可用度',n(adj.ATTACK_CORE_AVAILABILITY,3))+
      small('中场可用度',n(adj.MIDFIELD_CORE_AVAILABILITY,3))+
      small('防线可用度',n(adj.DEFENSE_CORE_AVAILABILITY,3))+
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