(()=>{
  const teams=['江原FC','仁川联','光州FC','全北现代','大田韩亚市民','安养FC','富川FC','济州SK','浦项制铁','蔚山HD','金泉尚武','首尔FC'];
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const n=(v,d=1)=>v==null?'—':Number(v).toFixed(d);
  const posLabel={GK:'GK',CB:'CB',FB_WB:'FB/WB',DM_CM:'DM/CM',AM_W:'AM/W',ST:'ST'};
  const root=$('#p3Root'),select=$('#teamSelect');

  function kpi(label,value){return '<div class="p3-kpi"><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>'}
  function small(label,value){return '<div class="p3-small"><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>'}

  function render(data){
    const s=data.C_lineup_structure||{};
    const players=Array.isArray(data.A_player_base)?data.A_player_base:[];
    const depth=Array.isArray(data.D_squad_depth)?data.D_squad_depth:[];
    const f=data.model_factors||{};
    const top=players.slice(0,18);

    root.className='';
    root.innerHTML=
      '<div class="p3-grid">'+
        kpi('比赛样本',s.squad_matches+'场')+
        kpi('首发连续性',n(s.avg_starter_continuity,1)+'%')+
        kpi('主阵型',s.most_used_formation||'—')+
        kpi('阵型稳定度',n(s.formation_stability_pct,1)+'%')+
      '</div>'+
      '<section class="p3-section">'+
        '<div class="p3-head"><strong>P3-C｜Lineup Structure</strong><span>阵容稳定度</span></div>'+
        '<div class="p3-summary">'+
          small('不同首发球员',s.unique_starters)+
          small('核心首发',s.core_starters)+
          small('近5连续性',n(s.last5_lineup_continuity,1)+'%')+
          small('近10连续性',n(s.last10_lineup_continuity,1)+'%')+
          small('平均每场调整',n(s.avg_changes_per_match,2)+'人')+
          small('第一阵型',s.most_used_formation||'—')+
          small('第二阵型',s.second_formation||'—')+
          small('首发XI强度',n(s.starting_xi_strength,1))+
          small('替补强度',n(s.bench_strength,1))+
          small('阵容深度',n(s.squad_depth,1))+
        '</div>'+
      '</section>'+
      '<section class="p3-section">'+
        '<div class="p3-head"><strong>P3-A / B｜Player Base + Performance</strong><span>按重要度排序｜前18名</span></div>'+
        '<div class="p3-table-wrap"><table class="p3-table"><thead><tr>'+
          '<th>球员</th><th>位置</th><th>首发</th><th>分钟</th><th>G</th><th>A</th><th>xG</th><th>xA</th><th>评分</th><th>重要度</th>'+
        '</tr></thead><tbody>'+
        top.map(p=>'<tr><td>'+esc(p.player_name)+'</td><td>'+esc(posLabel[p.position_group]||p.position_group)+'</td>'+
          '<td>'+p.starts+'</td><td>'+p.minutes+'</td><td>'+p.goals+'</td><td>'+p.assists+'</td>'+
          '<td>'+n(p.xg,2)+'</td><td>'+n(p.xa,2)+'</td><td>'+n(p.avg_rating,2)+'</td>'+
          '<td><b>'+n(p.importance?.score,1)+'</b></td></tr>').join('')+
        '</tbody></table></div>'+
      '</section>'+
      '<section class="p3-section">'+
        '<div class="p3-head"><strong>P3-D｜Squad Depth</strong><span>首发槽位 / 主力组 / 替补池</span></div>'+
        '<div class="p3-depth">'+depth.map(d=>{
          const primary=(d.primary_unit||[]).map(x=>x.player_name+' · '+n(x.importance,1)).join('｜')||'—';
          const backups=(d.replacement_pool||[]).slice(0,3).map(x=>
            x.player_name+' · '+(x.importance==null?'未验证':n(x.importance,1))+
            (x.evidence==='UNTESTED'?'（0分钟）':'')
          ).join('｜')||'—';
          const gap=d.replacement_gap==null?'未验证':n(d.replacement_gap,1);
          const score=d.depth_score==null?'未验证':n(d.depth_score,1);
          return '<div class="p3-depth-card"><h4>'+esc(posLabel[d.position_group]||d.position_group)+'｜首发槽位 '+esc(d.starter_slots??'—')+'</h4>'+
            '<div class="p3-depth-line"><span>主力组</span><b>'+esc(primary)+'</b></div>'+
            '<div class="p3-depth-line"><span>替补池</span><b>'+esc(backups)+'</b></div>'+
            '<div class="p3-depth-line"><span>主力组强度</span><b>'+n(d.primary_unit_strength,1)+'</b></div>'+
            '<div class="p3-depth-line"><span>替补层强度</span><b>'+(d.replacement_pool_strength==null?'未验证':n(d.replacement_pool_strength,1))+'</b></div>'+
            '<div class="p3-depth-line"><span>Replacement Gap</span><b>'+gap+'</b></div>'+
            '<div class="p3-depth-line"><span>Depth Score</span><b>'+score+'</b></div>'+
            '<div class="p3-depth-line"><span>替补证据</span><b>'+esc(d.replacement_confidence||'—')+'</b></div>'+
          '</div>';
        }).join('')+'</div>'+
      '</section>'+
      '<section class="p3-section">'+
        '<div class="p3-head"><strong>P3-E｜Availability Impact Engine</strong><span>当天伤停由赛前模型输入</span></div>'+
        '<div class="p3-impact-controls"><select id="impactPlayer">'+players.slice(0,20).map(p=>'<option value="'+esc(p.player_name)+'">'+esc(p.player_name)+'｜'+n(p.importance?.score,1)+'</option>').join('')+'</select>'+
        '<button id="impactBtn">模拟缺阵</button></div><div id="impactResult" class="p3-impact-result">选择球员后点击“模拟缺阵”。</div>'+
        '<div class="p3-note">P3不保存当天OUT/DOUBTFUL/SUSPENDED状态，只计算该球员若缺席时的替代能力与损失。</div>'+
      '</section>'+
      '<section class="p3-section">'+
        '<div class="p3-head"><strong>模型压缩因子</strong><span>供赛前量化直接读取</span></div>'+
        '<div class="p3-factor">'+
          small('LINEUP_CONTINUITY',n(f.LINEUP_CONTINUITY,3))+
          small('FORMATION_STABILITY',n(f.FORMATION_STABILITY,3))+
          small('SQUAD_DEPTH',n(f.SQUAD_DEPTH,3))+
          small('STARTING_XI_STRENGTH',n(f.STARTING_XI_STRENGTH,1))+
          small('BENCH_STRENGTH',n(f.BENCH_STRENGTH,1))+
        '</div>'+
      '</section>';

    $('#impactBtn').onclick=loadImpact;
  }

  async function loadTeam(){
    const team=select.value;
    root.className='p3-loading';root.textContent='正在读取 '+team+' P3…';
    const {data,error}=await window.qcSupabase.rpc('get_league_team_p3',{
      p_team_query:team,p_league_code:'KOR_K1',p_season:'2026'
    });
    if(error||!data?.ok){root.textContent='P3读取失败：'+(error?.message||data?.status||'unknown');return}
    render(data);
  }

  async function loadImpact(){
    const player=$('#impactPlayer')?.value;
    if(!player) return;
    const box=$('#impactResult');box.textContent='正在计算缺阵影响…';
    const {data,error}=await window.qcSupabase.rpc('get_league_team_p3_absence_impact',{
      p_team_query:select.value,p_league_code:'KOR_K1',p_season:'2026',p_player_query:player
    });
    if(error||!data?.ok){box.textContent='计算失败：'+(error?.message||data?.status||'unknown');return}
    box.innerHTML='<div class="p3-impact-box">'+
      small('缺阵球员',data.player.player_name)+
      small('重要度',n(data.player.importance,1))+
      small('替代球员',data.replacement?.player_name||'无明确替代')+
      small('Replacement Gap',n(data.replacement_gap,1))+
      small('影响级别',data.impact_level)+
      small('位置',posLabel[data.player.position_group]||data.player.position_group)+
      small('首发',data.player.starts)+
      small('分钟',data.player.minutes)+
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