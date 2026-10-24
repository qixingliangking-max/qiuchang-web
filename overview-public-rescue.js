// Public-only homepage fallback. Never touches member data or private snapshots.
// Protects slow/blocked Android WebViews from permanent HTML loading placeholders.
(function(){
  'use strict';
  if(typeof window==='undefined' || typeof document==='undefined') return;
  function escapeText(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[ch]||'&#39;';
    });
  }
  function todayInBeijing(){
    try{
      var parts=new Intl.DateTimeFormat('en-US',{
        timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'
      }).formatToParts(new Date());
      var obj={};
      parts.forEach(function(p){obj[p.type]=p.value;});
      if(obj.year && obj.month && obj.day) return obj.year+'-'+obj.month+'-'+obj.day;
    }catch(_){}
    return new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  }
  function addDays(ds,n){
    var day=new Date(ds+'T12:00:00+08:00');
    day.setUTCDate(day.getUTCDate()+n);
    return day.toISOString().slice(0,10);
  }
  function pending(el){
    return el && /正在加载中|^\s*$/.test(String(el.textContent||'').trim());
  }
  async function staticJSON(url){
    var res=await fetch(url,{cache:'no-cache'});
    if(!res.ok) throw Error('HTTP '+res.status);
    return res.json();
  }
  function validRows(payload,ds,final){
    if(!payload || payload.business_date!==ds ||
       !Array.isArray(payload.rows) || !payload.rows.length ||
       Number(payload.match_count)!==payload.rows.length ||
       (final && (payload.is_final!==true ||
         Number(payload.finished_count)!==payload.rows.length))) return null;
    var ids=new Set();
    for(var i=0;i<payload.rows.length;i++){
      var r=payload.rows[i];
      if(!r.id || !r.home_team_name || !r.away_team_name ||
         String(r.business_date)!==ds || ids.has(r.id)) return null;
      ids.add(r.id);
    }
    return payload.rows;
  }
  function table(rows,ds,isYesterday){
    var sorted=rows.slice().sort(function(a,b){
      return String(a.match_num||'').localeCompare(String(b.match_num||''),'zh-CN',{numeric:true});
    });
    var tbody=sorted.map(function(m){
      var num=escapeText(String(m.match_num||'').replace(/^周[一二三四五六日天]/,''));
      var time=escapeText(String(m.match_time||'').slice(0,5));
      var league=escapeText(m.league_short_name||m.league_name||'—');
      var score=String(m.raw && m.raw.sectionsNo999||'').replace(':','-');
      var ht=String(m.raw && m.raw.sectionsNo1||'').replace(':','-');
      var finished=isYesterday && /^(?:\d+-\d+)$/.test(score);
      var middle=finished?escapeText(score):'VS';
      var note=finished?(ht?'半 '+escapeText(ht):'完赛'):'待生成';
      var href='jc-match.html?id='+encodeURIComponent(m.id);
      return '<tr class="jc-overview-row" data-match-id="'+escapeText(m.id)+'">'+
        '<td class="jc-num"><b>'+num+'</b></td>'+
        '<td class="jc-time"><time>'+time+'</time></td>'+
        '<td><span class="jc-overview-league">'+league+'</span></td>'+
        '<td><a class="jc-review-match" href="'+href+'"><span>'+escapeText(m.home_team_name)+
        '</span><span class="jc-score-stack"><strong class="jc-score-full'+(finished?'':' vs')+'">'+middle+
        '</strong><span class="jc-score-half">'+note+'</span></span><span>'+
        escapeText(m.away_team_name)+'</span></a></td>'+
        '<td class="jc-overview-market">—</td><td class="jc-overview-goals">—</td>'+
        '<td class="jc-overview-htft">—</td></tr>';
    }).join('');
    return '<div class="jc-review-table-wrap"><table class="jc-review-table jc-overview-table">'+
      '<thead><tr><th>编号</th><th>时间</th><th>赛事</th><th>主队 比分 客队</th>'+
      '<th>胜平负/让球</th><th>总进球</th><th>半全场</th></tr></thead><tbody>'+
      tbody+'</tbody></table></div>';
  }
  function show(el,rows,ds,mode,meta){
    if(!pending(el)) return;
    // Completed public archives may use the site's normal hit-circle renderer
    // when app.js loaded; if it did not, show only public scores and fixtures.
    var html=null;
    if(mode==='yesterday' && typeof window.jcRenderYesterdayReview==='function'){
      try{ html=window.jcRenderYesterdayReview(rows,ds); }catch(_){}
    }
    el.innerHTML=html||table(rows,ds,mode==='yesterday');
    if(meta) meta.textContent=(mode==='yesterday'?ds.slice(5)+' · ':'')+rows.length+'场';
    el.dataset.qcPublicRescue='1';
  }
  async function rescueLive(ds){
    var el=document.getElementById('jcLiveCards');
    if(!pending(el)) return;
    try{
      var result=typeof window.qcFetchLiveScheduleDate==='function'
        ? await window.qcFetchLiveScheduleDate(ds) : null;
      var rows=result && Array.isArray(result.data)?result.data:null;
      if(!rows){
        var manifest=await staticJSON('data/overview/live-schedule-manifest.json');
        var entry=manifest && manifest.dates && manifest.dates[ds];
        if(!entry || !/^data\/overview\/live\/[\w.-]+\.json$/.test(entry.file)) return;
        rows=validRows(await staticJSON(entry.file),ds,false);
      }
      if(rows && rows.length) show(el,rows,ds,'today',document.getElementById('jcPredictionMeta'));
    }catch(error){ console.warn('公开赛程静态兜底暂不可用',error); }
  }
  async function rescueHistory(ds){
    var el=document.getElementById('jcYesterdayCards');
    if(!pending(el)) return;
    try{
      var manifest=await staticJSON('data/overview/manifest.json');
      var file=manifest && manifest.dates && manifest.dates[ds];
      if(!file || !/^data\/overview\/[\w.-]+\.json$/.test(file)) return;
      var rows=validRows(await staticJSON(file),ds,true);
      if(rows) show(el,rows,ds,'yesterday',document.getElementById('jcYesterdayMeta'));
    }catch(error){ console.warn('昨日历史静态兜底暂不可用',error); }
  }
  function start(){
    var cards=document.getElementById('jcLiveCards');
    if(!cards) return;
    var today=todayInBeijing();
    var params=new URLSearchParams(location.search);
    var ds=/^\d{4}-\d{2}-\d{2}$/.test(params.get('date')||'')
      ? params.get('date') : today;
    var label=document.getElementById('jcDateLabel');
    if(label && /读取日期/.test(label.textContent||'')){
      try{ label.textContent=new Intl.DateTimeFormat('zh-CN',{
        timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'
      }).format(new Date(ds+'T12:00:00+08:00')); }
      catch(_){ label.textContent=ds; }
    }
    // Give normal initialization first chance; rescue only placeholders.
    setTimeout(function(){
      // Never paint public fixture rows into 今日预测 while auth is
      // unresolved. The official app.js alone owns this permission-gated
      // panel; a 700ms public rescue caused a 30-row flash on iOS Safari.
      // Yesterday's completed public review retains its own safe fallback.
      var review=document.getElementById('jcYesterdayCards');
      if(pending(review)) rescueHistory(addDays(ds,-1));
    },700);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
