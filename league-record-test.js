(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  const regionOf=c=>{
    const country=String(c.country_cn||'');
    if(['英格兰','西班牙','意大利','德国','法国','荷兰','葡萄牙'].includes(country)) return '欧洲';
    if(['芬兰','瑞典','挪威'].includes(country)) return '北欧';
    if(['日本','韩国'].includes(country)) return '亚洲';
    if(country==='美国') return '美洲';
    return '其他';
  };

  function cycleText(c){
    return c.season_cycle==='calendar_year'?'自然年赛季':'跨年赛季';
  }

  function fmtPct(v){
    return v==null?'—':Number(v).toFixed(1)+'%';
  }

  function fmtNum(v,d=2){
    return v==null?'—':Number(v).toFixed(d);
  }

  function latestStatsByCompetition(stats){
    const map=new Map();
    (stats||[]).forEach(s=>{
      const key=String(s.competition_id);
      const old=map.get(key);
      if(!old || String(s.season)>String(old.season)) map.set(key,s);
    });
    return map;
  }

  function cardHtml(c,stat){
    const ready=Boolean(stat&&Number(stat.matches_played)>0);
    return '<article class="qc-league-card" data-region="'+esc(regionOf(c))+'" data-comp-id="'+esc(c.id)+'">'+
      '<div class="qc-league-card-head">'+
        '<div class="qc-league-title"><strong>'+esc(c.name_cn)+'</strong><small>'+esc(c.country_cn)+' · '+(c.tier===1?'一级联赛':'二级联赛')+' · '+esc(cycleText(c))+'</small></div>'+
        '<span class="qc-league-status '+(ready?'ready':'wait')+'">'+(ready?'已有数据':'待采集')+'</span>'+
      '</div>'+
      '<div class="qc-league-core">'+
        '<div><small>已赛</small><b>'+(ready?esc(stat.matches_played):'—')+'</b></div>'+
        '<div><small>主胜</small><b>'+(ready?esc(fmtPct(stat.home_win_rate)):'—')+'</b></div>'+
        '<div><small>平局</small><b>'+(ready?esc(fmtPct(stat.draw_rate)):'—')+'</b></div>'+
        '<div><small>客胜</small><b>'+(ready?esc(fmtPct(stat.away_win_rate)):'—')+'</b></div>'+
        '<div><small>场均进球</small><b>'+(ready?esc(fmtNum(stat.avg_total_goals)):'—')+'</b></div>'+
      '</div>'+
      '<div class="qc-league-foot"><span>'+(ready?'赛季 '+esc(stat.season):'等待补齐本赛季全部比赛')+'</span><button type="button" data-league-id="'+esc(c.id)+'">'+(ready?'查看球队':'查看档案')+'</button></div>'+
      '<section class="qc-league-detail" data-inline-detail="'+esc(c.id)+'" hidden></section>'+
    '</article>';
  }

  function goalDistributionHtml(stat){
    if(!stat) return '';
    const total=Number(stat.matches_played||0);
    const items=[
      ['0球',stat.goals_0],['1球',stat.goals_1],['2球',stat.goals_2],['3球',stat.goals_3],
      ['4球',stat.goals_4],['5球',stat.goals_5],['6球',stat.goals_6],['7+球',stat.goals_7_plus]
    ];
    return '<div class="qc-league-goals">'+
      '<div class="qc-league-goals-title"><strong>总进球分布</strong><span>场次 / 占比</span></div>'+
      '<div class="qc-league-goals-grid">'+items.map(([label,count])=>{
        const n=Number(count||0);
        const pct=total?((n/total)*100).toFixed(1)+'%':'—';
        return '<div class="qc-league-goal-cell"><small>'+esc(label)+'</small><b>'+n+'场</b><em>'+pct+'</em></div>';
      }).join('')+'</div>'+
    '</div>';
  }

  function pctCount(n,d){
    return d?((Number(n||0)/Number(d))*100).toFixed(0)+'%':'—';
  }

  function splitBox(title,played,wins,draws,losses,gf,ga,extra=''){
    const p=Number(played||0);
    const avgFor=p?(Number(gf||0)/p).toFixed(2):'—';
    const avgAgainst=p?(Number(ga||0)/p).toFixed(2):'—';
    return '<div class="qc-team-split">'+
      '<strong>'+esc(title)+'</strong>'+
      '<div class="qc-team-split-line"><span>场次</span><b>'+p+'</b></div>'+
      '<div class="qc-team-split-line"><span>胜/平/负</span><b>'+Number(wins||0)+'/'+Number(draws||0)+'/'+Number(losses||0)+'</b></div>'+
      '<div class="qc-team-split-line"><span>场均进球</span><b>'+avgFor+'</b></div>'+
      '<div class="qc-team-split-line"><span>场均失球</span><b>'+avgAgainst+'</b></div>'+
      (extra||'')+
    '</div>';
  }

  function buildTeamScoreMap(matches){
    const out=new Map();
    const add=(team,gf,ga)=>{
      const name=String(team||'').trim();
      if(!name || gf==null || ga==null) return;
      const score=Number(gf)+'-'+Number(ga);
      if(!out.has(name)) out.set(name,new Map());
      const scores=out.get(name);
      scores.set(score,(scores.get(score)||0)+1);
    };
    (matches||[]).forEach(m=>{
      if(m.ft_home==null || m.ft_away==null) return;
      add(m.home_team_name,m.ft_home,m.ft_away);
      add(m.away_team_name,m.ft_away,m.ft_home);
    });
    return out;
  }

  function highFreqScoreHtml(team,played,scoreMap){
    const total=Number(played||0);
    const scores=scoreMap||new Map();
    const top=[...scores.entries()]
      .sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],'zh-CN',{numeric:true}))
      .slice(0,3);
    if(!top.length) return '';
    const title=total<10?'当前样本高频比分':'高频比分 TOP3';
    return '<div class="qc-team-score-frequency">'+
      '<div class="qc-team-score-title"><strong>'+title+'</strong><span>本队-对手｜'+total+'场样本</span></div>'+
      '<div class="qc-team-score-grid">'+top.map(([score,count],idx)=>{
        const pct=total?((Number(count)/total)*100).toFixed(1)+'%':'—';
        return '<div class="qc-team-score-item"><small>TOP'+(idx+1)+'</small><b>'+esc(score)+'</b><em>'+count+'次｜'+pct+'</em></div>';
      }).join('')+'</div>'+
    '</div>';
  }

  function teamDetailHtml(t,recentMap,scoreMap){
    const r5=recentMap.get('5')||null;
    const r10=recentMap.get('10')||null;
    const overallExtra=
      '<div class="qc-team-split-line"><span>零封</span><b>'+pctCount(t.clean_sheets,t.played)+'</b></div>'+
      '<div class="qc-team-split-line"><span>双方进球</span><b>'+pctCount(t.btts_matches,t.played)+'</b></div>';
    const recentBox=(label,r)=>{
      if(!r) return splitBox(label,0,0,0,0,0,0);
      const extra=
        '<div class="qc-team-split-line"><span>零封</span><b>'+pctCount(r.clean_sheets,r.played)+'</b></div>'+
        '<div class="qc-team-split-line"><span>双方进球</span><b>'+pctCount(r.btts_matches,r.played)+'</b></div>'+
        '<div class="qc-team-split-line"><span>3+球</span><b>'+pctCount(r.over_25_matches,r.played)+'</b></div>';
      return splitBox(label+(Number(r.played)<Number(r.window_size)?'（'+r.played+'场）':''),r.played,r.wins,r.draws,r.losses,r.goals_for,r.goals_against,extra);
    };
    return '<div class="qc-team-detail-title"><strong>'+esc(t.team_name)+'｜详细档案</strong><span>点击球队再次收起</span></div>'+
      '<div class="qc-team-detail-grid">'+
        splitBox('赛季总体',t.played,t.wins,t.draws,t.losses,t.goals_for,t.goals_against,overallExtra)+
        splitBox('主场',t.home_played,t.home_wins,t.home_draws,t.home_losses,t.home_goals_for,t.home_goals_against)+
        splitBox('客场',t.away_played,t.away_wins,t.away_draws,t.away_losses,t.away_goals_for,t.away_goals_against)+
        recentBox('近5场',r5)+
        recentBox('近10场',r10)+
      '</div>'+
      highFreqScoreHtml(t.team_name,t.played,scoreMap)+
      '<div class="qc-team-detail-foot"><span>赛季基线</span><span>主客场拆分</span><span>近期5/10场</span><span>高频比分</span></div>';
  }

  function teamHtml(t){
    const avgFor=t.played?Number(t.goals_for)/Number(t.played):null;
    const avgAgainst=t.played?Number(t.goals_against)/Number(t.played):null;
    return '<div class="qc-league-team-item" data-team-item="'+esc(t.team_name)+'">'+
      '<button type="button" class="qc-league-team-row" data-team-name="'+esc(t.team_name)+'">'+
        '<div>'+esc(t.team_name)+'</div>'+
        '<div><small>场次</small>'+esc(t.played)+'</div>'+
        '<div><small>胜</small>'+esc(t.wins)+'</div>'+
        '<div><small>平</small>'+esc(t.draws)+'</div>'+
        '<div><small>负</small>'+esc(t.losses)+'</div>'+
        '<div><small>进球</small>'+esc(avgFor==null?'—':avgFor.toFixed(2))+'</div>'+
        '<div><small>失球</small>'+esc(avgAgainst==null?'—':avgAgainst.toFixed(2))+'</div>'+
      '</button>'+
      '<div class="qc-team-detail" data-team-detail="'+esc(t.team_name)+'" hidden></div>'+
    '</div>';
  }

  async function getAccess(){
    const {data,error}=await window.qcSupabase.auth.getSession();
    if(error) throw error;
    const session=data?.session||null;
    if(!session) return {loggedIn:false,isPro:false};
    const pro=await window.qcSupabase.rpc('has_active_pro_access');
    return {loggedIn:true,isPro:pro.data===true};
  }

  async function showDetail(comp,stat){
    const card=$$('.qc-league-card').find(x=>String(x.dataset.compId||'')===String(comp.id));
    const box=card?.querySelector('[data-inline-detail]');
    if(!card||!box) return;

    const alreadyOpen=!box.hidden;
    $$('.qc-league-card.is-open').forEach(other=>{
      if(other!==card){
        other.classList.remove('is-open');
        const otherBox=other.querySelector('[data-inline-detail]');
        if(otherBox) otherBox.hidden=true;
      }
    });

    if(alreadyOpen){
      card.classList.remove('is-open');
      box.hidden=true;
      return;
    }

    card.classList.add('is-open');
    box.hidden=false;
    box.innerHTML='<div class="qc-league-detail-head"><strong>'+esc(comp.name_cn)+'｜球队赛季数据</strong><button class="qc-league-detail-close" type="button">收起</button></div><div class="qc-league-empty">正在读取球队数据…</div>';
    $('.qc-league-detail-close',box).onclick=()=>{
      card.classList.remove('is-open');
      box.hidden=true;
    };

    if(!stat){
      box.innerHTML='<div class="qc-league-detail-head"><strong>'+esc(comp.name_cn)+'｜球队赛季数据</strong><button class="qc-league-detail-close" type="button">收起</button></div><div class="qc-league-empty">这个联赛还没有补入赛季比赛数据。</div>';
      $('.qc-league-detail-close',box).onclick=()=>{
        card.classList.remove('is-open');
        box.hidden=true;
      };
      return;
    }

    const [teamRes,recentRes,matchRes]=await Promise.all([
      window.qcSupabase.from('league_team_stats')
        .select('team_name,played,wins,draws,losses,goals_for,goals_against,clean_sheets,btts_matches,home_played,home_wins,home_draws,home_losses,home_goals_for,home_goals_against,away_played,away_wins,away_draws,away_losses,away_goals_for,away_goals_against')
        .eq('competition_id',comp.id).eq('season',stat.season)
        .order('wins',{ascending:false}),
      window.qcSupabase.from('league_recent_stats')
        .select('team_name,window_size,played,wins,draws,losses,goals_for,goals_against,clean_sheets,btts_matches,over_25_matches')
        .eq('competition_id',comp.id).eq('season',stat.season)
        .in('window_size',[5,10]),
      window.qcSupabase.from('league_matches')
        .select('home_team_name,away_team_name,ft_home,ft_away')
        .eq('competition_id',comp.id).eq('season',stat.season)
        .eq('status','finished')
    ]);

    if(box.hidden || !card.classList.contains('is-open')) return;

    if(teamRes.error || recentRes.error || matchRes.error){
      box.innerHTML='<div class="qc-league-detail-head"><strong>'+esc(comp.name_cn)+'｜球队赛季数据</strong><button class="qc-league-detail-close" type="button">收起</button></div><div class="qc-league-empty">球队数据读取失败。</div>';
      $('.qc-league-detail-close',box).onclick=()=>{
        card.classList.remove('is-open');
        box.hidden=true;
      };
      return;
    }

    const data=teamRes.data||[];
    const recentByTeam=new Map();
    (recentRes.data||[]).forEach(r=>{
      const key=String(r.team_name);
      if(!recentByTeam.has(key)) recentByTeam.set(key,new Map());
      recentByTeam.get(key).set(String(r.window_size),r);
    });
    const scoresByTeam=buildTeamScoreMap(matchRes.data||[]);

    box.innerHTML='<div class="qc-league-detail-head"><strong>'+esc(comp.name_cn)+'｜'+esc(stat.season)+'球队数据</strong><button class="qc-league-detail-close" type="button">收起</button></div>'+
      goalDistributionHtml(stat)+
      (data.length?'<div class="qc-league-team-list">'+data.map(teamHtml).join('')+'</div>':'<div class="qc-league-empty">暂时还没有球队统计。</div>');
    $('.qc-league-detail-close',box).onclick=()=>{
      card.classList.remove('is-open');
      box.hidden=true;
    };

    $$('.qc-league-team-row',box).forEach(btn=>{
      btn.onclick=()=>{
        const teamName=String(btn.dataset.teamName||'');
        const item=btn.closest('.qc-league-team-item');
        const detail=item?.querySelector('.qc-team-detail');
        if(!item||!detail) return;
        const wasOpen=!detail.hidden;

        $$('.qc-league-team-item.is-open',box).forEach(other=>{
          if(other!==item){
            other.classList.remove('is-open');
            const otherDetail=other.querySelector('.qc-team-detail');
            if(otherDetail) otherDetail.hidden=true;
          }
        });

        if(wasOpen){
          item.classList.remove('is-open');
          detail.hidden=true;
          return;
        }

        const team=data.find(x=>String(x.team_name)===teamName);
        if(!team) return;
        item.classList.add('is-open');
        detail.hidden=false;
        detail.innerHTML=teamDetailHtml(team,recentByTeam.get(teamName)||new Map(),scoresByTeam.get(teamName)||new Map());
      };
    });
  }

  async function setup(){
    const root=$('#leagueRecordRoot');
    try{
      if(!window.qcSupabase) throw new Error('数据连接未就绪');
      const access=await getAccess();
      if(!access.loggedIn){
        root.innerHTML='<div class="qc-league-gate"><h2>请先登录</h2><p>联赛档案测试页暂时只用于内部核对。</p><a href="login.html?next='+encodeURIComponent(location.pathname)+'">立即登录</a></div>';
        return;
      }
      if(!access.isPro){
        root.innerHTML='<div class="qc-league-gate"><h2>测试页暂未开放</h2><p>当前账号没有联赛档案测试权限。</p></div>';
        return;
      }

      const [compRes,statRes]=await Promise.all([
        window.qcSupabase.from('league_competitions').select('id,code,name_cn,name_en,country_cn,tier,season_cycle,priority,is_active').eq('is_active',true).order('priority',{ascending:true}).order('name_cn',{ascending:true}),
        window.qcSupabase.from('league_season_stats').select('competition_id,season,matches_played,home_wins,draws,away_wins,total_goals,avg_total_goals,home_win_rate,draw_rate,away_win_rate,goals_0,goals_1,goals_2,goals_3,goals_4,goals_5,goals_6,goals_7_plus,btts_matches,clean_sheet_matches,computed_at')
      ]);
      if(compRes.error) throw compRes.error;
      if(statRes.error) throw statRes.error;

      const comps=compRes.data||[];
      const latest=latestStatsByCompetition(statRes.data||[]);
      const readyCount=comps.filter(c=>Number(latest.get(String(c.id))?.matches_played||0)>0).length;
      $('#leagueSummary').innerHTML=
        '<span>首批 '+comps.length+' 个联赛</span>'+
        '<span>已有数据 '+readyCount+' 个</span>'+
        '<span>待采集 '+(comps.length-readyCount)+' 个</span>'+
        '<span>联赛 + 球队 + 主客场 + 近期5/10场</span>';

      const regions=['全部','欧洲','北欧','亚洲','美洲'];
      root.innerHTML=
        '<div class="qc-league-toolbar">'+
          '<div class="qc-league-region-tabs">'+regions.map((x,i)=>'<button type="button" data-region="'+x+'" class="'+(i===0?'active':'')+'">'+x+'</button>').join('')+'</div>'+
          '<div class="qc-league-note">只显示已入库真实比赛；无数据时不生成统计结论。</div>'+
        '</div>'+
        '<div class="qc-league-grid">'+comps.map(c=>cardHtml(c,latest.get(String(c.id)))).join('')+'</div>';

      $$('.qc-league-region-tabs button',root).forEach(btn=>{
        btn.onclick=()=>{
          $$('.qc-league-region-tabs button',root).forEach(x=>x.classList.toggle('active',x===btn));
          const region=btn.dataset.region;
          $$('.qc-league-card',root).forEach(card=>{
            card.hidden=region!=='全部'&&card.dataset.region!==region;
          });
        };
      });

      $$('[data-league-id]',root).forEach(btn=>{
        btn.onclick=()=>{
          const comp=comps.find(c=>String(c.id)===String(btn.dataset.leagueId));
          if(comp) showDetail(comp,latest.get(String(comp.id))||null);
        };
      });
    }catch(err){
      console.error('联赛档案测试页读取失败',err);
      root.innerHTML='<div class="qc-league-gate"><h2>联赛档案读取失败</h2><p>'+esc(err?.message||'请稍后刷新')+'</p></div>';
    }
  }

  document.addEventListener('DOMContentLoaded',setup);
})();