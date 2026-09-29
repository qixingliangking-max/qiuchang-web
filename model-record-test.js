(()=>{
  const METRICS=[
    ['direction','模型方向'],
    ['single','单选倾向'],
    ['handicap','让球保护'],
    ['htft','半全场'],
    ['goals','总进球'],
    ['top','TOP3']
  ];

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function normalizeScore(value){
    const s=String(value||'').trim().replace(':','-');
    const m=s.match(/^(\d+)\s*-\s*(\d+)$/);
    return m ? m[1]+'-'+m[2] : '';
  }

  function shortResult(score){
    const p=normalizeScore(score).split('-').map(Number);
    if(p.length!==2 || p.some(x=>!Number.isFinite(x))) return '';
    return p[0]>p[1]?'胜':p[0]<p[1]?'负':'平';
  }

  function handicapResult(score,line){
    const p=normalizeScore(score).split('-').map(Number);
    const n=Number(line);
    if(p.length!==2 || p.some(x=>!Number.isFinite(x)) || !Number.isFinite(n)) return '';
    const adjusted=p[0]+n;
    return adjusted>p[1]?'让胜':adjusted<p[1]?'让负':'让平';
  }

  function normalizePick(text,m){
    const raw=String(text||'').replace(/[｜|]\s*[ABC](?:[+-])?\s*$/i,'').replace(/\s+/g,'').trim();
    if(!raw) return '';
    const home=String(m.home_team_name||'').replace(/\s+/g,'');
    const away=String(m.away_team_name||'').replace(/\s+/g,'');
    const homeShort=home.replace(/亚运男足|亚运女足|U23|亚足/g,'');
    const awayShort=away.replace(/亚运男足|亚运女足|U23|亚足/g,'');
    const has=(name,short)=>Boolean((name&&raw.includes(name))||(short&&short!==name&&raw.includes(short)));
    const hh=has(home,homeShort), ah=has(away,awayShort);
    if(raw===home || raw===homeShort) return '胜';
    if(raw===away || raw===awayShort) return '负';
    if(/分胜负|主胜.*客胜|客胜.*主胜/.test(raw)) return '胜 / 负';
    if(/主队?不败/.test(raw)||(hh&&/不败/.test(raw))) return '胜 / 平';
    if(/客队?不败/.test(raw)||(ah&&/不败/.test(raw))) return '平 / 负';
    if(/^主胜$/.test(raw)||(hh&&/胜/.test(raw))) return '胜';
    if(/^客胜$/.test(raw)||(ah&&/胜/.test(raw))) return '负';
    if(/^平局?$/.test(raw)) return '平';
    if(/^让[胜平负]$/.test(raw)) return raw;
    return String(text||'').trim();
  }

  function resultChoices(value){
    return String(value||'').split('/').map(x=>x.trim()).filter(Boolean);
  }

  function handicapChoices(value){
    const s=String(value||'').replace(/\s+/g,'');
    if(!s || /暂无|待生成/.test(s)) return [];
    const body=s.replace(/^[+-]?\d+(?:\.\d+)?[：:｜|]?/,'');
    return body.replace(/[＋+｜|]/g,'/').split('/').map(x=>x.trim()).filter(x=>/^让[胜平负]$/.test(x));
  }

  function goalChoices(value){
    const s=String(value||'').trim();
    const range=s.match(/(\d+)\s*[—–-]\s*(\d+)\s*球?/);
    if(range){
      const a=Number(range[1]),b=Number(range[2]),out=[];
      if(Number.isFinite(a)&&Number.isFinite(b)&&b>=a&&b-a<=7){
        for(let i=a;i<=b;i++) out.push(i+'球');
        return out;
      }
    }
    return [...new Set(
      (s.match(/[0-7](?:\+)?球/g)||s.split(/[、,，｜|/\s]+/))
        .map(x=>String(x).trim())
        .filter(Boolean)
        .map(x=>/球$/.test(x)?x:x+'球')
    )];
  }

  function topChoices(value){
    if(Array.isArray(value)) return value.map(x=>String(x).trim()).filter(Boolean);
    if(typeof value==='string'){
      try{
        const j=JSON.parse(value);
        if(Array.isArray(j)) return j.map(String);
      }catch(_){}
      return value.split(/[、,，｜|/\s]+/).map(x=>x.trim()).filter(Boolean);
    }
    return [];
  }

  function latestPoolMap(markets){
    const map=new Map();
    markets.forEach(x=>{
      const key=String(x.jc_match_id);
      if(!map.has(key)) map.set(key,{});
      map.get(key)[x.pool_code]=x;
    });
    return map;
  }

  function gradeRow(m,model,pools){
    const ft=normalizeScore(m.raw?.sectionsNo999);
    const ht=normalizeScore(m.raw?.sectionsNo1);
    if(!ft) return {finished:false,ft:'',ht:'',grade:{}};

    const ordinary=shortResult(ft);
    const hhad=pools?.hhad||null;
    const hhadActual=hhad?.goal_line!=null?handicapResult(ft,hhad.goal_line):'';
    const reviewOverride=String(model.raw_input?.review_direction_result||'').trim();
    const directionActual=reviewOverride || (pools?.had ? ordinary : (hhadActual||ordinary));
    const directionChoices=resultChoices(normalizePick(model.direction,m));
    const direction=directionChoices.length?directionChoices.includes(directionActual):null;

    const singlePick=normalizePick(model.single_pick,m);
    let singleActual=ordinary;
    if(/^让[胜平负]$/.test(singlePick)) singleActual=hhadActual;
    const single=/^(胜|平|负|让胜|让平|让负)$/.test(singlePick) && singleActual
      ? singlePick===singleActual
      : null;

    const hchoices=handicapChoices(model.handicap_direction);
    const handicap=hchoices.length && hhadActual ? hchoices.includes(hhadActual) : null;

    const htftActual=ht ? shortResult(ht)+'/'+ordinary : '';
    const htftChoices=[model.htft_top1,model.htft_top2].filter(Boolean).map(String);
    const htft=htftActual && htftChoices.length ? htftChoices.includes(htftActual) : null;

    const parts=ft.split('-').map(Number);
    const total=parts[0]+parts[1];
    const goalLabel=total>=7?'7+球':total+'球';
    const gchoices=goalChoices(model.goal_range);
    const goals=gchoices.length
      ? gchoices.some(x=>x===goalLabel || (x.startsWith('7')&&total>=7))
      : null;

    const tops=topChoices(model.top_scores);
    const top=tops.length ? tops.includes(ft) : null;

    return {
      finished:true,ft,ht,ordinary,hhadActual,directionActual,singlePick,goalLabel,htftActual,
      grade:{direction,single,handicap,htft,goals,top}
    };
  }

  function metricStat(rows,key){
    let hit=0,total=0;
    rows.forEach(r=>{
      const v=r.result?.grade?.[key];
      if(v===true||v===false){total++;if(v)hit++;}
    });
    return {hit,total,rate:total?hit/total:null};
  }

  function fmtRate(stat){
    return stat.rate==null?'—':Math.round(stat.rate*1000)/10+'%';
  }

  function stateHtml(v){
    if(v===true) return '<span class="qc-record-state hit">命中</span>';
    if(v===false) return '<span class="qc-record-state miss">未中</span>';
    return '<span class="qc-record-state pending">待核</span>';
  }

  function displayPick(row,key){
    const m=row.match,model=row.model,result=row.result;
    if(key==='direction') return normalizePick(model.direction,m)||'—';
    if(key==='single'){
      const p=normalizePick(model.single_pick,m)||'—';
      const prob=model.raw_input?.single_prob;
      return prob!=null?p+' '+prob+'%':p;
    }
    if(key==='handicap') return String(model.handicap_direction||'暂无').replace(/\s+/g,' ');
    if(key==='htft') return [model.htft_top1,model.htft_top2].filter(Boolean).join('｜')||'—';
    if(key==='goals') return goalChoices(model.goal_range).join('｜')||'—';
    if(key==='top') return topChoices(model.top_scores).join('｜')||'—';
    return '—';
  }

  function dateMinus(ds,days){
    const d=new Date(ds+'T12:00:00+08:00');
    d.setUTCDate(d.getUTCDate()-days);
    return d.toISOString().slice(0,10);
  }

  function currentRangeRows(all,range,maxDate){
    if(range==='all') return all;
    const days=range==='7'?6:29;
    const min=dateMinus(maxDate,days);
    return all.filter(x=>x.match.business_date>=min && x.match.business_date<=maxDate);
  }

  function renderMetricCards(rows){
    return '<div class="qc-record-metrics">'+METRICS.map(([key,label])=>{
      const s=metricStat(rows,key);
      return '<div class="qc-record-metric"><small>'+esc(label)+'</small><strong>'+esc(fmtRate(s))+'</strong><em>'+s.hit+'/'+s.total+' 场</em></div>';
    }).join('')+'</div>';
  }

  function dayStatsHtml(rows){
    return METRICS.map(([key,label])=>{
      const s=metricStat(rows,key);
      if(!s.total) return '';
      return '<span>'+esc(label.replace('倾向','').replace('保护',''))+' '+s.hit+'/'+s.total+'</span>';
    }).join('');
  }

  function matchRowHtml(row){
    const m=row.match,r=row.result;
    const num=String(m.match_num||'—').replace(/^周[一二三四五六日天]/,'');
    const score=r.finished?r.ft:'VS';
    const sub=r.finished?(r.ht?'半 '+r.ht:'已完赛'):'待结算';
    return '<div class="qc-record-match">'+
      '<div class="qc-record-cell qc-record-num">'+esc(num)+'</div>'+
      '<div class="qc-record-cell"><div class="qc-record-score"><strong>'+esc(score)+'</strong><small>'+esc(sub)+'</small></div></div>'+
      '<div class="qc-record-cell qc-record-teams"><b>'+esc(m.home_team_name)+' vs '+esc(m.away_team_name)+'</b><span>'+esc(m.league_short_name||m.league_name||'')+'</span></div>'+
      METRICS.map(([key,label])=>
        '<div class="qc-record-cell"><div class="qc-record-pick"><small>'+esc(label)+'</small><b title="'+esc(displayPick(row,key))+'">'+esc(displayPick(row,key))+'</b>'+stateHtml(r.grade?.[key])+'</div></div>'
      ).join('')+
    '</div>';
  }

  function renderDays(rows){
    const grouped=new Map();
    rows.forEach(row=>{
      const ds=row.match.business_date;
      if(!grouped.has(ds)) grouped.set(ds,[]);
      grouped.get(ds).push(row);
    });
    const dates=[...grouped.keys()].sort().reverse();
    if(!dates.length) return '<div class="qc-record-empty">当前范围暂无记录。</div>';
    return dates.map(ds=>{
      const dayRows=grouped.get(ds).sort((a,b)=>String(a.match.match_num||'').localeCompare(String(b.match.match_num||''),'zh-CN',{numeric:true}));
      const finished=dayRows.filter(x=>x.result.finished).length;
      return '<section class="qc-record-day">'+
        '<div class="qc-record-day-head"><div class="qc-record-day-title"><strong>'+esc(ds.slice(5).replace('-','/'))+'</strong><span>锁板 '+dayRows.length+' 场 · 已结算 '+finished+' 场</span></div>'+
        '<div class="qc-record-day-stats">'+dayStatsHtml(dayRows)+'</div></div>'+
        '<div>'+dayRows.map(matchRowHtml).join('')+'</div>'+
      '</section>';
    }).join('');
  }

  async function chunkIn(table,select,col,values,extra){
    const out=[];
    for(let i=0;i<values.length;i+=70){
      let q=window.qcSupabase.from(table).select(select).in(col,values.slice(i,i+70));
      if(extra) q=extra(q);
      const {data,error}=await q;
      if(error) throw error;
      out.push(...(data||[]));
    }
    return out;
  }

  async function getAccess(){
    const {data,error}=await window.qcSupabase.auth.getSession();
    if(error) throw error;
    const session=data?.session||null;
    if(!session) return {loggedIn:false,isPro:false};
    const pro=await window.qcSupabase.rpc('has_active_pro_access');
    return {loggedIn:true,isPro:pro.data===true};
  }

  async function loadRows(){
    const {data:models,error:modelError}=await window.qcSupabase
      .from('jc_model_outputs')
      .select('id,jc_match_id,model_version,stage,direction,handicap_direction,single_pick,htft_top1,htft_top2,goal_range,top_scores,raw_input,is_current,is_locked,locked_at')
      .eq('is_locked',true)
      .eq('is_current',true)
      .order('locked_at',{ascending:true});
    if(modelError) throw modelError;

    const ids=[...new Set((models||[]).map(x=>x.jc_match_id).filter(Boolean))];
    if(!ids.length) return [];

    const matches=await chunkIn(
      'jc_matches',
      'id,match_num,business_date,league_name,league_short_name,home_team_name,away_team_name,match_date,match_time,kickoff_at,match_status,raw',
      'id',ids
    );

    const markets=await chunkIn(
      'jc_prekick_latest_market_snapshots',
      'jc_match_id,pool_code,goal_line,outcomes,captured_at,official_update_time',
      'jc_match_id',ids,
      q=>q.in('pool_code',['had','hhad'])
    );

    const matchMap=new Map(matches.map(x=>[String(x.id),x]));
    const poolMap=latestPoolMap(markets);
    return (models||[]).map(model=>{
      const match=matchMap.get(String(model.jc_match_id));
      if(!match) return null;
      const pools=poolMap.get(String(match.id))||{};
      return {match,model,pools,result:gradeRow(match,model,pools)};
    }).filter(Boolean).sort((a,b)=>{
      const d=String(a.match.business_date).localeCompare(String(b.match.business_date));
      if(d!==0) return d;
      return String(a.match.match_num||'').localeCompare(String(b.match.match_num||''),'zh-CN',{numeric:true});
    });
  }

  function bindDrawer(){
    const btn=$('#menuBtn'),backdrop=$('#drawerBackdrop');
    if(!btn||!backdrop) return;
    btn.onclick=()=>backdrop.classList.add('open');
    backdrop.onclick=e=>{if(e.target===backdrop)backdrop.classList.remove('open');};
  }

  function renderPage(allRows,range){
    const root=$('#modelRecordRoot');
    if(!allRows.length){root.innerHTML='<div class="qc-record-empty">暂无锁板记录。</div>';return;}
    const minDate=allRows[0].match.business_date;
    const maxDate=allRows[allRows.length-1].match.business_date;
    const rows=currentRangeRows(allRows,range,maxDate);
    const finished=rows.filter(x=>x.result.finished).length;

    $('#recordSummaryLine').innerHTML=
      '<span>上线记录 '+esc(minDate.slice(5).replace('-','/'))+'–'+esc(maxDate.slice(5).replace('-','/'))+'</span>'+
      '<span>当前范围锁板 '+rows.length+' 场</span>'+
      '<span>已结算 '+finished+' 场</span>'+
      '<span>未结算 '+(rows.length-finished)+' 场</span>';

    root.innerHTML=
      '<div class="qc-record-controls">'+
        '<div class="qc-record-range-tabs">'+
          '<button type="button" data-range="7" class="'+(range==='7'?'active':'')+'">近7天</button>'+
          '<button type="button" data-range="30" class="'+(range==='30'?'active':'')+'">近30天</button>'+
          '<button type="button" data-range="all" class="'+(range==='all'?'active':'')+'">上线以来</button>'+
        '</div>'+
        '<div class="qc-record-note">未完赛不计分母；缺少让球线或半场比分时，对应项目不计分母。</div>'+
      '</div>'+
      renderMetricCards(rows)+
      '<div class="qc-record-section-title">逐场记录</div>'+
      '<div class="qc-record-legend"><span>'+stateHtml(true)+' 命中</span><span>'+stateHtml(false)+' 未中</span><span>'+stateHtml(null)+' 未完赛或无法核验</span></div>'+
      '<div style="margin-top:10px">'+renderDays(rows)+'</div>';

    $$('.qc-record-range-tabs button',root).forEach(btn=>{
      btn.onclick=()=>renderPage(allRows,btn.dataset.range||'all');
    });
  }

  async function setup(){
    bindDrawer();
    const root=$('#modelRecordRoot');
    try{
      if(!window.qcSupabase){
        root.innerHTML='<div class="qc-record-gate"><h2>数据连接未就绪</h2><p>请稍后刷新页面。</p></div>';
        return;
      }
      const access=await getAccess();
      if(!access.loggedIn){
        root.innerHTML='<div class="qc-record-gate"><h2>请先登录</h2><p>这个测试页暂时只用于内部核对，不对未登录用户开放。</p><a href="login.html?next='+encodeURIComponent(location.pathname)+'">立即登录</a></div>';
        return;
      }
      if(!access.isPro){
        root.innerHTML='<div class="qc-record-gate"><h2>测试页暂未开放</h2><p>当前账号没有测试页读取权限。</p></div>';
        return;
      }
      const rows=await loadRows();
      renderPage(rows,'all');
    }catch(err){
      console.error('模型档案测试页读取失败',err);
      root.innerHTML='<div class="qc-record-gate"><h2>模型档案读取失败</h2><p>'+esc(err?.message||'请稍后刷新页面')+'</p></div>';
    }
  }

  document.addEventListener('DOMContentLoaded',setup);
})();