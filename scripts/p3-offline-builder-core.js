(function(){
  "use strict";

  function num(v){ return v==null || v==="" ? null : Number(v); }
  function zero(v){ var x=num(v); return x==null ? 0 : x; }
  function roundN(v,d){
    if(d==null) d=1;
    if(v==null || !Number.isFinite(Number(v))) return null;
    var x=Number(v), p=Math.pow(10,d);
    return Math.sign(x)*(Math.floor(Math.abs(x)*p+0.5000000001)/p);
  }
  function sum(arr){ return arr.reduce(function(s,x){ return s+zero(x); },0); }
  function avg(arr){
    var a=arr.filter(function(v){ return v!=null && Number.isFinite(Number(v)); }).map(Number);
    return a.length ? a.reduce(function(s,x){ return s+x; },0)/a.length : null;
  }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function lexical(a,b){ return String(a==null?"":a).localeCompare(String(b==null?"":b),"en"); }
  function descNullable(a,b,key){
    var av=a[key], bv=b[key];
    if(av==null && bv==null) return 0;
    if(av==null) return 1;
    if(bv==null) return -1;
    return Number(bv)-Number(av);
  }
  function statNum(raw,key){
    var groups=(raw && raw.stats) || [];
    for(var i=0;i<groups.length;i++){
      var stats=(groups[i] && groups[i].stats) || {};
      var vals=Object.values(stats);
      for(var j=0;j<vals.length;j++){
        var v=vals[j];
        if(v && v.key===key) return num(v.stat && v.stat.value);
      }
    }
    return null;
  }
  function actualPosition(usual,x,y,formation){
    usual=Number(usual); x=num(x); y=num(y);
    var back=parseInt(String(formation||"").split("-")[0],10);
    if(usual===0) return "GK";
    if(usual===1){
      if((y==null?0:y)>=0.50){
        if(x!=null && x<=0.30) return "RB_RWB";
        if(x!=null && x>=0.70) return "LB_LWB";
        if(y!=null && y<=0.56) return "DM";
        return "CM";
      }
      if(back===3) return "CB";
      if(back===5){
        if(x!=null && x<=0.20) return "RB_RWB";
        if(x!=null && x>=0.80) return "LB_LWB";
        return "CB";
      }
      if(x!=null && x<=0.28) return "RB_RWB";
      if(x!=null && x>=0.72) return "LB_LWB";
      return "CB";
    }
    if(usual===2){
      if(back===3 && (y==null?0:y)>=0.50 && (y==null?0:y)<=0.72){
        if(x!=null && x<=0.24) return "RB_RWB";
        if(x!=null && x>=0.76) return "LB_LWB";
      }
      if(x!=null && (x<=0.24 || x>=0.76)) return "W";
      if(y!=null && y<=0.52) return "DM";
      if(y!=null && y<=0.68) return "CM";
      return "AM";
    }
    if(usual===3){
      if(x!=null && (x<=0.25 || x>=0.75)) return "W";
      return "ST";
    }
    return null;
  }
  function confidenceWeight(c){
    if(c==="HIGH") return 1.00;
    if(c==="MEDIUM") return 0.82;
    if(c==="LOW") return 0.58;
    return null;
  }
  function roleQuality(perf,conf,importance){
    if(perf==null) return null;
    var w=confidenceWeight(conf);
    if(w==null) w=0.50;
    return roundN(clamp(0.80*(50+w*(perf-50))+0.20*(importance==null?50:importance),0,100),1);
  }
  function percentRankMap(items,valueKey,groupKey){
    var groups=new Map(), out=new Map();
    items.forEach(function(p){
      if(p[valueKey]==null) return;
      var g=p[groupKey];
      if(!groups.has(g)) groups.set(g,[]);
      groups.get(g).push(p);
    });
    groups.forEach(function(arr){
      var vals=arr.map(function(p){ return Number(p[valueKey]); }).sort(function(a,b){ return a-b; });
      var den=Math.max(vals.length-1,1);
      arr.forEach(function(p){
        var v=Number(p[valueKey]), idx=-1;
        for(var i=0;i<vals.length;i++){ if(Math.abs(vals[i]-v)<1e-12){ idx=i; break; } }
        out.set(p._key, vals.length===1 ? 0 : idx/den);
      });
    });
    return out;
  }
  function modeInt(vals){
    var m=new Map();
    vals.forEach(function(v){ m.set(v,(m.get(v)||0)+1); });
    var a=Array.from(m.entries()).sort(function(x,y){ return y[1]-x[1] || x[0]-y[0]; });
    return a.length ? a[0][0] : 0;
  }

  function buildPlayers(rawByTeam, teamNames){
    var allPlayers=[], teamData={};

    teamNames.forEach(function(team){
      var raw=rawByTeam[team];
      var lineups=raw.lineups.slice().sort(function(a,b){
        var ad=String(a.kickoff_at||a.match_date), bd=String(b.kickoff_at||b.match_date);
        return ad.localeCompare(bd) || String(a.match_id).localeCompare(String(b.match_id));
      });
      var formByMatch=new Map(lineups.map(function(l){ return [String(l.match_id),l.formation]; }));
      var rows=raw.players.map(function(r){
        var copy=Object.assign({},r);
        copy.actual_position=r.is_starter ? actualPosition(r.usual_position_id,r.lineup_x,r.lineup_y,formByMatch.get(String(r.match_id))) : null;
        return copy;
      });
      var byPlayer=new Map();
      rows.forEach(function(r){
        var k=String(r.player_id);
        if(!byPlayer.has(k)) byPlayer.set(k,[]);
        byPlayer.get(k).push(r);
      });

      var players=[];
      byPlayer.forEach(function(prs,playerId){
        var pg=new Map();
        prs.forEach(function(r){
          if(r.position_group==="OTHER") return;
          var g=r.position_group||"OTHER";
          if(!pg.has(g)) pg.set(g,{starter:0,all:0});
          var o=pg.get(g); o.all++; if(r.is_starter) o.starter++;
        });
        var pgSorted=Array.from(pg.entries()).sort(function(a,b){
          return b[1].starter-a[1].starter || b[1].all-a[1].all || lexical(a[0],b[0]);
        });
        var position_group=pgSorted.length ? pgSorted[0][0] : "OTHER";
        var matches=lineups.length;
        var appearances=prs.filter(function(r){ return zero(r.minutes)>0; }).length;
        var starts=prs.filter(function(r){ return !!r.is_starter; }).length;
        var minutes=sum(prs.map(function(r){ return r.minutes; }));
        var goals=sum(prs.map(function(r){ return r.goals; }));
        var assists=sum(prs.map(function(r){ return r.assists; }));
        var xg=sum(prs.map(function(r){ return r.xg; }));
        var xa=sum(prs.map(function(r){ return r.xa; }));
        var shots=sum(prs.map(function(r){ return r.shots; }));
        var shots_on_target=sum(prs.map(function(r){ return r.shots_on_target; }));
        var chances_created=sum(prs.map(function(r){ return r.chances_created; }));
        var defensive_actions=sum(prs.map(function(r){ return r.defensive_actions; }));
        var tackles=sum(prs.map(function(r){ return r.tackles; }));
        var interceptions=sum(prs.map(function(r){ return r.interceptions; }));
        var clearances=sum(prs.map(function(r){ return r.clearances; }));
        var aerials_won=sum(prs.map(function(r){ return r.aerials_won; }));
        var saves=sum(prs.map(function(r){ return r.saves; }));
        var goals_prevented=sum(prs.map(function(r){ return r.goals_prevented; }));
        var ratings=prs.map(function(r){ return num(r.rating); }).filter(function(v){ return v!=null; });
        var avg_rating=ratings.length ? avg(ratings) : null;
        var squad_listings=prs.length;
        var bench_listings=prs.filter(function(r){ return !!r.is_sub; }).length;
        var duels_won=sum(prs.map(function(r){ return statNum(r.raw_stats,"duel_won"); }));
        var duels_lost=sum(prs.map(function(r){ return statNum(r.raw_stats,"duel_lost"); }));
        var recoveries=sum(prs.map(function(r){ return statNum(r.raw_stats,"recoveries"); }));
        var passes_into_final_third=sum(prs.map(function(r){ return statNum(r.raw_stats,"passes_into_final_third"); }));
        var touches_opp_box=sum(prs.map(function(r){ return statNum(r.raw_stats,"touches_opp_box"); }));
        var goals_conceded=sum(prs.map(function(r){ return statNum(r.raw_stats,"goals_conceded"); }));
        var save_pct=(saves+goals_conceded)>0 ? roundN(100*saves/(saves+goals_conceded),1) : null;
        var start_rate_pct=matches ? roundN(100*starts/matches,2) : null;
        var minute_share_pct=matches ? roundN(100*minutes/(matches*90),2) : null;
        function per90(v){ return minutes ? roundN(90*v/minutes,3) : null; }

        var posCounts=new Map();
        prs.filter(function(r){ return r.is_starter && r.actual_position; }).forEach(function(r){
          posCounts.set(r.actual_position,(posCounts.get(r.actual_position)||0)+1);
        });
        var posSorted=Array.from(posCounts.entries()).sort(function(a,b){ return b[1]-a[1] || lexical(a[0],b[0]); });
        var positionStarts=posSorted.reduce(function(s,x){ return s+x[1]; },0);
        var primary_position=posSorted.length ? posSorted[0][0] : null;
        if(!primary_position && ["GK","CB","ST"].includes(position_group)) primary_position=position_group;
        var secondary_positions=posSorted.slice(1).filter(function(x){
          return x[1]>=Math.max(2,Math.ceil(positionStarts*0.10));
        }).map(function(x){ return x[0]; });
        var actual_position_counts={};
        Array.from(posCounts.entries()).sort(function(a,b){ return lexical(a[0],b[0]); }).forEach(function(x){ actual_position_counts[x[0]]=x[1]; });
        var tactical_usage_stability_pct=positionStarts ? roundN(100*posSorted[0][1]/positionStarts,1) : null;

        var latest=lineups.slice().sort(function(a,b){
          var ad=String(a.kickoff_at||a.match_date), bd=String(b.kickoff_at||b.match_date);
          return bd.localeCompare(ad) || String(b.match_id).localeCompare(String(a.match_id));
        });
        var rowByMatch=new Map(prs.map(function(r){ return [String(r.match_id),r]; }));
        function recentUsage(cnt){
          var sel=latest.slice(0,Math.min(cnt,latest.length));
          var mins=sum(sel.map(function(l){ var r=rowByMatch.get(String(l.match_id)); return r?r.minutes:0; }));
          return sel.length ? roundN(100*mins/(90*sel.length),1) : null;
        }
        var recent5_usage_pct=recentUsage(5);
        var recent10_usage_pct=recentUsage(10);
        var importance_score_v3=roundN(clamp(
          0.35*zero(minute_share_pct)+
          0.25*zero(start_rate_pct)+
          0.15*zero(recent5_usage_pct)+
          0.15*zero(recent10_usage_pct)+
          0.10*zero(tactical_usage_stability_pct),0,100
        ),1);

        var p={
          _key:team+"|"+playerId,
          team_name:team,player_id:Number(playerId),player_name:prs[0].player_name,
          position_group:position_group,appearances:appearances,starts:starts,minutes:minutes,
          start_rate_pct:start_rate_pct,minute_share_pct:minute_share_pct,
          goals:goals,assists:assists,xg:roundN(xg,3),xa:roundN(xa,3),
          shots:shots,shots_on_target:shots_on_target,chances_created:chances_created,
          defensive_actions:defensive_actions,tackles:tackles,interceptions:interceptions,
          clearances:clearances,aerials_won:aerials_won,saves:saves,
          goals_prevented:roundN(goals_prevented,3),avg_rating:avg_rating==null?null:roundN(avg_rating,2),
          goals_per90:per90(goals),assists_per90:per90(assists),xg_per90:per90(xg),
          xa_per90:per90(xa),shots_per90:per90(shots),defensive_actions_per90:per90(defensive_actions),
          squad_listings:squad_listings,bench_listings:bench_listings,
          primary_position:primary_position,secondary_positions:secondary_positions,
          actual_position_counts:actual_position_counts,recent5_usage_pct:recent5_usage_pct,
          recent10_usage_pct:recent10_usage_pct,tactical_usage_stability_pct:tactical_usage_stability_pct,
          importance_score_v3:importance_score_v3,duels_won:duels_won,duels_lost:duels_lost,
          recoveries:recoveries,passes_into_final_third:passes_into_final_third,
          touches_opp_box:touches_opp_box,goals_conceded:goals_conceded,save_pct:save_pct
        };
        players.push(p); allPlayers.push(p);
      });
      teamData[team]={lineups:lineups,rows:rows,players:players};
    });

    return {allPlayers:allPlayers,teamData:teamData};
  }

  function scorePlayers(allPlayers){
    allPlayers.forEach(function(p){
      var m=p.minutes, v=null;
      if(m>0){
        var q=function(x){ return 90*zero(x)/m; };
        var r=zero(p.avg_rating==null?6:p.avg_rating)-6;
        switch(p.primary_position||""){
          case "GK": v=0.35*q(p.saves)+2.0*q(p.goals_prevented)+0.80*r; break;
          case "CB": v=0.18*q(p.defensive_actions)+0.45*q(p.tackles)+0.60*q(p.interceptions)+0.12*q(p.clearances)+0.30*q(p.aerials_won)+0.25*q(p.duels_won)+0.80*r; break;
          case "LB_LWB": case "RB_RWB": v=0.14*q(p.defensive_actions)+0.40*q(p.tackles)+0.40*q(p.interceptions)+0.28*q(p.duels_won)+0.55*q(p.chances_created)+1.60*zero(p.xa_per90)+0.35*zero(p.xg_per90)+0.35*q(p.passes_into_final_third)+0.80*r; break;
          case "DM": v=0.18*q(p.defensive_actions)+0.45*q(p.tackles)+0.55*q(p.interceptions)+0.20*q(p.duels_won)+0.30*q(p.passes_into_final_third)+0.45*q(p.chances_created)+1.20*zero(p.xa_per90)+0.80*r; break;
          case "CM": v=0.10*q(p.defensive_actions)+0.25*q(p.tackles)+0.30*q(p.interceptions)+0.45*q(p.passes_into_final_third)+0.65*q(p.chances_created)+1.60*zero(p.xa_per90)+0.60*zero(p.xg_per90)+0.80*r; break;
          case "AM": case "W": v=2.00*zero(p.goals_per90)+1.50*zero(p.assists_per90)+2.00*zero(p.xg_per90)+2.00*zero(p.xa_per90)+0.25*zero(p.shots_per90)+0.65*q(p.chances_created)+0.20*q(p.touches_opp_box)+0.80*r; break;
          case "ST": v=2.50*zero(p.goals_per90)+1.20*zero(p.assists_per90)+2.50*zero(p.xg_per90)+1.20*zero(p.xa_per90)+0.35*zero(p.shots_per90)+0.25*q(p.touches_opp_box)+0.80*r; break;
          default: v=0.50*r+0.20*zero(p.defensive_actions_per90)+0.50*zero(p.xg_per90)+0.50*zero(p.xa_per90);
        }
      }
      p.performance_raw_legacy=v;
      var map={GK:"GK",CB:"CB",FB_WB:"FB_ANY",DM_CM:"MID_ANY",AM_W:"ATT_MID_ANY",ST:"ST"};
      p._legacy_group=p.primary_position || map[p.position_group] || "OTHER";
    });
    var ranks=percentRankMap(allPlayers,"performance_raw_legacy","_legacy_group");
    allPlayers.forEach(function(p){
      p.performance_score_legacy=p.minutes>0 ? roundN(50+Math.min(1,p.minutes/900)*((100*(ranks.get(p._key)||0))-50),1) : null;
    });

    allPlayers.forEach(function(p){
      var m=p.minutes, v=null;
      if(m>0){
        var q=function(x){ return 90*zero(x)/m; };
        var r=zero(p.avg_rating==null?6:p.avg_rating)-6;
        switch(p.primary_position||""){
          case "GK": v=0.035*zero(p.save_pct)+2.40*q(p.goals_prevented)+0.90*r; break;
          case "CB": v=0.12*q(p.defensive_actions)+0.32*q(p.tackles)+0.48*q(p.interceptions)+0.09*q(p.clearances)+0.20*q(p.aerials_won)+0.15*q(p.duels_won)-0.08*q(p.duels_lost)+0.14*q(p.recoveries)+0.08*q(p.passes_into_final_third)+0.90*r; break;
          case "LB_LWB": case "RB_RWB": v=0.10*q(p.defensive_actions)+0.30*q(p.tackles)+0.28*q(p.interceptions)+0.16*q(p.duels_won)-0.07*q(p.duels_lost)+0.13*q(p.recoveries)+0.25*q(p.passes_into_final_third)+0.50*q(p.chances_created)+1.35*zero(p.xa_per90)+0.30*zero(p.xg_per90)+0.85*r; break;
          case "DM": v=0.14*q(p.defensive_actions)+0.35*q(p.tackles)+0.42*q(p.interceptions)+0.15*q(p.duels_won)-0.07*q(p.duels_lost)+0.18*q(p.recoveries)+0.30*q(p.passes_into_final_third)+0.34*q(p.chances_created)+1.10*zero(p.xa_per90)+0.25*zero(p.xg_per90)+0.90*r; break;
          case "CM": v=0.08*q(p.defensive_actions)+0.18*q(p.tackles)+0.20*q(p.interceptions)+0.10*q(p.duels_won)-0.05*q(p.duels_lost)+0.16*q(p.recoveries)+0.42*q(p.passes_into_final_third)+0.52*q(p.chances_created)+1.35*zero(p.xa_per90)+0.45*zero(p.xg_per90)+0.90*r; break;
          case "AM": case "W": v=1.75*zero(p.goals_per90)+1.35*zero(p.assists_per90)+1.90*zero(p.xg_per90)+1.90*zero(p.xa_per90)+0.20*zero(p.shots_per90)+0.60*q(p.chances_created)+0.18*q(p.touches_opp_box)+0.12*q(p.passes_into_final_third)+0.85*r; break;
          case "ST": v=2.20*zero(p.goals_per90)+1.00*zero(p.assists_per90)+2.30*zero(p.xg_per90)+1.00*zero(p.xa_per90)+0.30*zero(p.shots_per90)+0.23*q(p.touches_opp_box)+0.35*q(p.chances_created)+0.85*r; break;
          default: v=0.65*r+0.15*zero(p.defensive_actions_per90)+0.40*zero(p.xg_per90)+0.40*zero(p.xa_per90);
        }
      }
      p.performance_raw_v4=v;
      p._v4_group=p.primary_position || "OTHER";
    });
    ranks=percentRankMap(allPlayers,"performance_raw_v4","_v4_group");
    allPlayers.forEach(function(p){
      if(p.minutes<=0){
        p.performance_score=null;
        p.performance_confidence="UNTESTED";
        p.role_quality_score=null;
        return;
      }
      var sw=Math.min(1,Math.sqrt(p.minutes/900));
      var target=30+60*(ranks.get(p._key)||0);
      p.performance_score=roundN(clamp(50+sw*(target-50),20,90),1);
      p.performance_confidence=p.minutes>=900 ? "HIGH" : p.minutes>=450 ? "MEDIUM" : "LOW";
      p.role_quality_score=roleQuality(p.performance_score,p.performance_confidence,p.importance_score_v3);
    });
  }

  function buildTeamStructure(team, td, cfg){
    var POS=["GK","LB_LWB","CB","RB_RWB","DM","CM","AM","W","ST"];
    var ord={GK:0,LB_LWB:1,CB:2,RB_RWB:3,DM:4,CM:5,AM:6,W:7,ST:8};
    var lineups=td.lineups, players=td.players, rows=td.rows, matches=lineups.length;
    var tr=[];
    for(var i=1;i<matches;i++){
      var cur=(lineups[i].starter_player_ids||[]).map(String);
      var prev=new Set((lineups[i-1].starter_player_ids||[]).map(String));
      var inter=cur.filter(function(x){ return prev.has(x); }).length;
      tr.push({seq:i+1,pct:100*inter/11});
    }
    var fm=new Map();
    lineups.forEach(function(l){ if(l.formation) fm.set(l.formation,(fm.get(l.formation)||0)+1); });
    var forms=Array.from(fm.entries()).sort(function(a,b){ return b[1]-a[1] || lexical(a[0],b[0]); });
    var formTotal=sum(forms.map(function(x){ return x[1]; }));
    var main=forms.length?forms[0][0]:null;
    var summary={
      season:cfg.season,team_name:team,p3_version:cfg.version,
      squad_depth:null,
      core_starters:players.filter(function(p){ return p.starts>=Math.ceil(0.60*matches); }).length,
      squad_matches:matches,bench_strength:null,unique_players:players.length,
      unique_starters:new Set(rows.filter(function(r){ return r.is_starter; }).map(function(r){ return String(r.player_id); })).size,
      formation_source:"FotMob原始比赛详情｜首发阵型",
      second_formation:forms.length>1?forms[1][0]:null,
      formation_samples:forms.map(function(x){ return {formation:x[0],matches:x[1],share_pct:roundN(100*x[1]/formTotal,1)}; }),
      most_used_formation:main,
      attack_core_strength:null,starting_xi_strength:null,
      avg_changes_per_match:tr.length?roundN(avg(tr.map(function(x){ return 11-(x.pct/100*11); })),2):null,
      defense_core_strength:null,
      avg_starter_continuity:tr.length?roundN(avg(tr.map(function(x){ return x.pct; })),1):null,
      formation_coverage_pct:roundN(100*lineups.filter(function(l){ return l.formation!=null; }).length/Math.max(matches,1),1),
      midfield_core_strength:null,depth_data_coverage_pct:null,
      formation_stability_pct:formTotal?roundN(100*forms[0][1]/formTotal,1):null,
      last5_lineup_continuity:roundN(avg(tr.filter(function(x){ return x.seq>matches-4; }).map(function(x){ return x.pct; })),1),
      midfield_bench_strength:null,attacking_bench_strength:null,defensive_bench_strength:null,
      last10_lineup_continuity:roundN(avg(tr.filter(function(x){ return x.seq>matches-9; }).map(function(x){ return x.pct; })),1),
      performance_model_version:"P3球员表现模型V4"
    };

    var byMatch=new Map();
    rows.filter(function(r){ return r.is_starter; }).forEach(function(r){
      var k=String(r.match_id); if(!byMatch.has(k)) byMatch.set(k,[]); byMatch.get(k).push(r);
    });
    var mainMatches=lineups.filter(function(l){ return l.formation===main; });
    var slots=[];
    POS.forEach(function(pos){
      var all=lineups.map(function(l){ return (byMatch.get(String(l.match_id))||[]).filter(function(r){ return r.actual_position===pos; }).length; });
      var mm=mainMatches.map(function(l){ return (byMatch.get(String(l.match_id))||[]).filter(function(r){ return r.actual_position===pos; }).length; });
      var req=modeInt(mm);
      if(req>0) slots.push({position_code:pos,required_slots:req,avg_slots:roundN(avg(all),2)});
    });

    var depth=[];
    slots.forEach(function(s){
      var cand=players.filter(function(p){
        return p.primary_position===s.position_code ||
          p.secondary_positions.includes(s.position_code) ||
          Object.prototype.hasOwnProperty.call(p.actual_position_counts,s.position_code);
      }).map(function(p){
        var x=Object.assign({},p);
        x.position_starts=Number(p.actual_position_counts[s.position_code]||0);
        x.fit_weight=p.primary_position===s.position_code ? 1.00 :
          p.secondary_positions.includes(s.position_code) ? 0.90 : 0.75;
        return x;
      });
      cand.sort(function(a,b){
        return b.position_starts-a.position_starts ||
          b.starts-a.starts || b.minutes-a.minutes ||
          descNullable(a,b,"importance_score_v3") || lexical(a.player_name,b.player_name);
      });
      cand.forEach(function(p,i){ p.primary_rank=i+1; });
      var prim=cand.filter(function(p){ return p.primary_rank<=s.required_slots; });
      var repl=cand.filter(function(p){ return p.primary_rank>s.required_slots; });
      repl.sort(function(a,b){
        return (a.performance_score==null?1:0)-(b.performance_score==null?1:0) ||
          b.position_starts-a.position_starts || b.fit_weight-a.fit_weight ||
          b.starts-a.starts || b.minutes-a.minutes || b.bench_listings-a.bench_listings ||
          descNullable(a,b,"importance_score_v3") || lexical(a.player_name,b.player_name);
      });
      repl.forEach(function(p,i){ p.replacement_rank=i+1; });

      depth.push({
        position_code:s.position_code,required_slots:s.required_slots,avg_slots:s.avg_slots,
        primary_unit:prim.map(function(p){
          return {player_id:p.player_id,player_name:p.player_name,importance_score:p.importance_score_v3,
            performance_score:p.performance_score,performance_confidence:p.performance_confidence,
            position_starts:p.position_starts,fit_weight:p.fit_weight,role_quality:p.role_quality_score};
        }),
        replacement_chain:repl.map(function(p){
          return {player_id:p.player_id,player_name:p.player_name,importance_score:p.importance_score_v3,
            performance_score:p.performance_score,
            adjusted_quality:p.performance_score==null?null:roundN(p.performance_score*p.fit_weight,1),
            performance_confidence:p.performance_confidence,position_starts:p.position_starts,
            fit_weight:p.fit_weight,fit_type:p.fit_weight===1.00?"PRIMARY":p.fit_weight===0.90?"SECONDARY":"EMERGENCY",
            role_quality:p.role_quality_score,
            adjusted_role_quality:p.role_quality_score==null?null:roundN(p.role_quality_score*p.fit_weight,1),
            replacement_rank:p.replacement_rank};
        }),
        emergency_shift_options:[],absence_scenarios:[],
        starter_quality:null,replacement_quality:null,replacement_gap:null,raw_replacement_gap:null,
        replacement_loss:null,starter_role_quality:null,replacement_role_quality:null,
        position_coverage:null,multi_position_coverage:null,position_depth_score:null,
        data_status:null,confidence:null
      });
    });

    var globalPrimary=new Set();
    depth.forEach(function(d){ d.primary_unit.forEach(function(x){ globalPrimary.add(String(x.player_id)); }); });
    var origins=new Map();
    depth.forEach(function(d){
      d.primary_unit.forEach(function(x){
        var k=String(x.player_id); if(!origins.has(k)) origins.set(k,[]); origins.get(k).push(d);
      });
    });

    depth.forEach(function(d){
      var bench=[],emergency=[],rr=0,er=0;
      d.replacement_chain.forEach(function(rc){
        if(globalPrimary.has(String(rc.player_id))){
          er++;
          var os=(origins.get(String(rc.player_id))||[]).slice().sort(function(a,b){
            return (a.position_code===d.position_code?0:1)-(b.position_code===d.position_code?0:1) ||
              b.required_slots-a.required_slots || (ord[a.position_code]||99)-(ord[b.position_code]||99);
          });
          emergency.push(Object.assign({},rc,{availability_role:"OTHER_STARTER",origin_position:os.length?os[0].position_code:null,emergency_shift_rank:er}));
        }else{
          rr++;
          bench.push(Object.assign({},rc,{availability_role:"BENCH",replacement_rank:rr}));
        }
      });
      d.replacement_chain=bench;
      d.emergency_shift_options=emergency;
      var starterQuality=roundN(avg(d.primary_unit.map(function(x){ return x.role_quality; })),1);
      var firstN=bench.slice(0,Math.max(d.required_slots,1)).filter(function(x){
        return x.adjusted_role_quality!=null && ["HIGH","MEDIUM"].includes(x.performance_confidence);
      });
      var replacementQuality=firstN.length?roundN(avg(firstN.map(function(x){ return x.adjusted_role_quality; })),1):null;
      var known=bench.filter(function(x){ return x.adjusted_role_quality!=null && ["HIGH","MEDIUM"].includes(x.performance_confidence); }).length;
      var backupCount=bench.length;
      var posCoverage=Math.min(100,roundN(100*(d.primary_unit.length+backupCount)/(2*Math.max(d.required_slots,1)),1));
      var multiCoverage=Math.min(100,roundN(100*bench.filter(function(x){ return Number(x.fit_weight)<1; }).length/Math.max(d.required_slots,1),1));
      var gap=(replacementQuality==null||starterQuality==null)?null:roundN(replacementQuality-starterQuality,1);
      var loss=gap==null?null:roundN(Math.max(0,-gap),1);
      var depthScore=(starterQuality==null||replacementQuality==null)?null:
        roundN(0.45*starterQuality+0.30*replacementQuality+0.15*posCoverage+0.10*multiCoverage,1);
      var firstBench=bench.length?bench[0]:null;

      d.absence_scenarios=d.primary_unit.map(function(pu){
        var g=null,l=null;
        if(firstBench && firstBench.adjusted_role_quality!=null &&
           ["HIGH","MEDIUM"].includes(firstBench.performance_confidence) && pu.role_quality!=null){
          g=roundN(firstBench.adjusted_role_quality-pu.role_quality,1);
          l=roundN(Math.max(0,-g),1);
        }
        return {
          absent_player_id:pu.player_id,absent_player_name:pu.player_name,
          player_importance:pu.importance_score,player_performance:pu.performance_score,
          player_role_quality:pu.role_quality,
          expected_replacement:firstBench ? {
            player_id:firstBench.player_id,player_name:firstBench.player_name,
            performance_score:firstBench.performance_score,role_quality:firstBench.role_quality,
            adjusted_quality:firstBench.adjusted_role_quality,fit_weight:firstBench.fit_weight,
            fit_type:firstBench.fit_type,confidence:firstBench.performance_confidence,
            replacement_rank:1,availability_role:"BENCH"
          } : null,
          raw_replacement_gap:g,replacement_gap:g,replacement_loss:l
        };
      });

      d.starter_quality=starterQuality;
      d.replacement_quality=replacementQuality;
      d.starter_role_quality=starterQuality;
      d.replacement_role_quality=replacementQuality;
      d.raw_replacement_gap=gap; d.replacement_gap=gap; d.replacement_loss=loss;
      d.position_coverage=posCoverage; d.multi_position_coverage=multiCoverage;
      d.position_depth_score=depthScore;
      d.data_status=starterQuality==null?"DATA_INCOMPLETE":
        backupCount===0?"NO_BACKUP":
        replacementQuality==null?"DATA_INCOMPLETE":
        known<Math.max(d.required_slots,1)?"PARTIAL":"VALID";
      d.confidence=replacementQuality==null?"LOW":
        known>=Math.max(d.required_slots,1)?"HIGH":"MEDIUM";
    });

    function weighted(field,predicate){
      if(!predicate) predicate=function(){ return true; };
      var a=depth.filter(function(d){ return predicate(d) && d[field]!=null; });
      var den=sum(a.map(function(d){ return d.required_slots; }));
      return den?roundN(sum(a.map(function(d){ return d[field]*d.required_slots; }))/den,1):null;
    }
    summary.starting_xi_strength=weighted("starter_quality");
    summary.bench_strength=weighted("replacement_quality");
    summary.squad_depth=weighted("position_depth_score");
    var totalSlots=sum(depth.map(function(d){ return d.required_slots; }));
    var validSlots=sum(depth.filter(function(d){ return d.position_depth_score!=null; }).map(function(d){ return d.required_slots; }));
    summary.depth_data_coverage_pct=totalSlots?roundN(100*validSlots/totalSlots,1):null;
    summary.defensive_bench_strength=weighted("replacement_quality",function(d){ return ["GK","LB_LWB","CB","RB_RWB"].includes(d.position_code); });
    summary.midfield_bench_strength=weighted("replacement_quality",function(d){ return ["DM","CM","AM"].includes(d.position_code); });
    summary.attacking_bench_strength=weighted("replacement_quality",function(d){ return ["W","ST"].includes(d.position_code); });
    summary.attack_core_strength=weighted("starter_quality",function(d){ return ["W","ST"].includes(d.position_code); });
    summary.midfield_core_strength=weighted("starter_quality",function(d){ return ["DM","CM","AM"].includes(d.position_code); });
    summary.defense_core_strength=weighted("starter_quality",function(d){ return ["GK","LB_LWB","CB","RB_RWB"].includes(d.position_code); });

    td.summary=summary;
    td.depth=depth;
  }

  function finalTeam(team,td,cfg){
    var ord={GK:0,LB_LWB:1,CB:2,RB_RWB:3,DM:4,CM:5,AM:6,W:7,ST:8};
    var A=td.players.slice().sort(function(a,b){
      return descNullable(a,b,"importance_score_v3") || b.starts-a.starts || b.minutes-a.minutes;
    }).map(function(p){
      return {player_id:p.player_id,player_name:p.player_name,primary_position:p.primary_position,
        secondary_positions:p.secondary_positions,actual_position_counts:p.actual_position_counts,
        appearances:p.appearances,starts:p.starts,minutes:p.minutes,squad_listings:p.squad_listings,
        bench_listings:p.bench_listings,start_rate_pct:p.start_rate_pct,minute_share_pct:p.minute_share_pct,
        recent5_usage_pct:p.recent5_usage_pct,recent10_usage_pct:p.recent10_usage_pct,
        tactical_usage_stability_pct:p.tactical_usage_stability_pct,importance_score:p.importance_score_v3};
    });
    var B=td.players.slice().sort(function(a,b){
      return descNullable(a,b,"performance_score") || b.minutes-a.minutes;
    }).map(function(p){
      return {player_id:p.player_id,player_name:p.player_name,primary_position:p.primary_position,
        performance_score:p.performance_score,performance_score_legacy:p.performance_score_legacy,
        role_quality:p.role_quality_score,performance_confidence:p.performance_confidence,
        avg_rating:p.avg_rating,goals:p.goals,assists:p.assists,xg:p.xg,xa:p.xa,
        shots:p.shots,shots_on_target:p.shots_on_target,chances_created:p.chances_created,
        defensive_actions:p.defensive_actions,tackles:p.tackles,interceptions:p.interceptions,
        clearances:p.clearances,aerials_won:p.aerials_won,duels_won:p.duels_won,
        duels_lost:p.duels_lost,recoveries:p.recoveries,
        passes_into_final_third:p.passes_into_final_third,touches_opp_box:p.touches_opp_box,
        saves:p.saves,goals_conceded:p.goals_conceded,save_pct:p.save_pct,
        per90:{goals:p.goals_per90,assists:p.assists_per90,xg:p.xg_per90,xa:p.xa_per90,
          shots:p.shots_per90,defensive_actions:p.defensive_actions_per90}};
    });
    var D=td.depth.slice().sort(function(a,b){ return (ord[a.position_code]||99)-(ord[b.position_code]||99); });
    var sm=td.summary;
    var sampleLevel=sm.squad_matches>=10?"NORMAL":sm.squad_matches>=5?"CAUTIOUS":"LOW_SAMPLE";
    var usageMode=sm.squad_matches>=10?"FULL":sm.squad_matches>=5?"REDUCED_WEIGHT":"LIMITED";
    return {
      ok:true,status:"P3_VALID",version:sm.p3_version,
      identity:{team_name:team,league_code:cfg.league_code,season:cfg.season,competition_id:cfg.competition_id},
      A_player_base:A,D_squad_depth:D,
      model_factors:{
        LINEUP_CONTINUITY:roundN(zero(sm.avg_starter_continuity)/100,3),
        RECENT5_LINEUP_CONTINUITY:roundN(zero(sm.last5_lineup_continuity)/100,3),
        RECENT10_LINEUP_CONTINUITY:roundN(zero(sm.last10_lineup_continuity)/100,3),
        FORMATION_STABILITY:roundN(zero(sm.formation_stability_pct)/100,3),
        STARTING_XI_STRENGTH:sm.starting_xi_strength,BENCH_STRENGTH:sm.bench_strength,
        SQUAD_DEPTH:sm.squad_depth,ATTACK_CORE_STRENGTH:sm.attack_core_strength,
        MIDFIELD_CORE_STRENGTH:sm.midfield_core_strength,DEFENSE_CORE_STRENGTH:sm.defense_core_strength,
        REPLACEMENT_GAP:null,AVAILABILITY_IMPACT:null
      },
      sample_context:{
        team_matches:sm.squad_matches,sample_level:sampleLevel,usage_mode:usageMode,
        recommended_use:sm.squad_matches>=10?"标准P3读取":
          sm.squad_matches>=5?"阵容与球员因子降权使用":
          "优先使用阵型与首发连续性；球员表现和阵容深度低权重，缺失即跳过"
      },
      C_lineup_structure:sm,B_player_performance:B,
      E_availability_impact:{
        mode:"impact_engine_only",availability_source:"day_model",
        day_status_fields:["OUT","DOUBTFUL","SUSPENDED"],
        note:"P3 stores importance, ability and replacement structure; T0 supplies current availability."
      }
    };
  }

  globalThis.buildP3Snapshot=function(rawByTeam,cfg){
    var teamNames=Object.keys(rawByTeam).sort(lexical);
    var built=buildPlayers(rawByTeam,teamNames);
    scorePlayers(built.allPlayers);
    teamNames.forEach(function(team){ buildTeamStructure(team,built.teamData[team],cfg); });
    var teams={};
    teamNames.forEach(function(team){ teams[team]=finalTeam(team,built.teamData[team],cfg); });
    return {
      snapshot:{league_code:cfg.league_code,season:cfg.season,generated_at:cfg.generated_at,teams:teams},
      meta:{teams:teamNames.length,aggregate_players:built.allPlayers.length}
    };
  };
})();