'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const output=path.join(root,'football.html');
function beijingBusinessDay(){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const ds=p.year+'-'+p.month+'-'+p.day;
 if(Number(p.hour)>=10)return ds;
 const d=new Date(ds+'T04:00:00Z');d.setUTCDate(d.getUTCDate()-1);
 return d.toISOString().slice(0,10);
}
const ds=process.env.QC_PRERENDER_FOOTBALL_DATE||beijingBusinessDay();
if(!/^\d{4}-\d{2}-\d{2}$/.test(ds))throw Error('Invalid business day');
const manifest=JSON.parse(read('data/overview/live-schedule-manifest.json'));
const entry=manifest.dates?.[ds];
let rows=[],version='';
if(entry){
 if(entry.file!=='data/overview/live/'+ds+'.json')throw Error('Unexpected schedule path');
 const p=JSON.parse(read(entry.file));rows=p.rows;
 if(!Array.isArray(rows)||p.business_date!==ds||rows.length!==Number(p.match_count)||
    rows.length!==Number(entry.match_count)||
    rows.some(r=>!r.id||r.business_date!==ds||!r.home_team_name||!r.away_team_name)||
    new Set(rows.map(r=>String(r.id))).size!==rows.length)throw Error('Invalid schedule identities');
 version=String(entry.version||'');
 for(const row of rows){
  if('jc_model_outputs' in row||'jc_match_ai_analysis' in row||
     'qc_model_outputs' in row||'qc_pro_predictions' in row)
    throw Error('Private member model found in public schedule');
  for(const side of ['home','away']){
   const logo=String(row['_'+side+'LogoUrl']||'');
   if(!/^assets\/team-logos\/[a-z0-9-]+\.(png|jpg|webp)$/i.test(logo)||
      !fs.existsSync(path.join(root,logo)))throw Error('Missing local crest: '+row.match_num+' '+side);
  }
 }
}
const catalog=JSON.parse(read('assets/team-logos/catalog.js').replace(/^window\.QC_TEAM_LOGO_CATALOG=/,'').replace(/;\s*$/,''));
const ctx={window:{QC_TEAM_LOGO_CATALOG:catalog},document:{addEventListener(){}},location:{},localStorage:{},sessionStorage:{},console:{log(){},warn(){},error(){}}};
vm.createContext(ctx);vm.runInContext(read('app.js'),ctx,{filename:'app.js',timeout:5000});
ctx.rows=rows.map(r=>({...r,_qcStaticLiveSchedule:true,_jcScheduleSnapshot:true,jc_model_outputs:[],jc_match_ai_analysis:null}));
ctx.today=ds;
const visible=vm.runInContext('rows.filter(m=>m.match_date&&qcJcIsVisibleMatch(m))',ctx);
ctx.visible=visible;
const count=visible.length;
const markup=count?vm.runInContext('jcRenderFootballCards(visible,today,{loggedIn:false,isPro:false})',ctx)
 :'<div class="profile-card">今日公开赛程尚未发布，发布后将自动显示。</div>';
if(count&&(markup.match(/class="jc-football-card jc-football-card-lite/g)||[]).length!==count)throw Error('Missing pre-rendered card');
if(count&&(markup.match(/class="jc-team-logo"/g)||[]).length!==count*2)throw Error('Missing pre-rendered crest');
if(/<script|<\/script|javascript:/i.test(markup))throw Error('Unsafe public HTML');
const start='<!-- QC_FOOTBALL_PUBLIC_START -->',end='<!-- QC_FOOTBALL_PUBLIC_END -->';
const box='<div id="jcFootballCards" data-qc-static-date="'+ds+'" data-qc-static-count="'+count+'" data-qc-static-version="'+version+'">'+markup+'</div>';
const guard=[
 '<script>',
 '(function(){',
 ' var c=document.getElementById("jcFootballCards");if(!c)return;',
 ' var date=c.getAttribute("data-qc-static-date");',
 ' var q=new URLSearchParams(location.search).get("date");',
 ' var p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).map(function(x){return [x.type,x.value]}));',
 ' var current=p.year+"-"+p.month+"-"+p.day;',
 ' if(Number(p.hour)<10){var d=new Date(current+"T04:00:00Z");d.setUTCDate(d.getUTCDate()-1);current=d.toISOString().slice(0,10);}',
 ' var selected=q&&/^\\d{4}-\\d{2}-\\d{2}$/.test(q)?q:current;',
 ' if(selected!==date){',
 '  c.innerHTML="<div class=\\"profile-card\\">正在读取所选日期的公开赛程…</div>";',
 '  c.removeAttribute("data-qc-static-date");',
 '  var label=document.getElementById("jcFootballDateLabel");if(label)label.textContent=selected.slice(5);',
 '  var count=document.getElementById("jcFootballFixtureCount");if(count)count.textContent="正在切换…";',
 ' }',
 '})();',
 '</script>'
].join('\n');
const replacement=start+'\n      '+box+'\n      '+guard+'\n      '+end;
let src=read('football.html');
const a=src.indexOf(start),b=src.indexOf(end);
if(a>=0&&b>a)src=src.slice(0,a)+replacement+src.slice(b+end.length);
else{
 const loading='<div id="jcFootballCards"><div class="profile-card">正在加载中…</div></div>';
 if(!src.includes(loading))throw Error('Unexpected football first paint HTML');
 src=src.replace(loading,replacement);
}
const weekday=new Date(ds+'T12:00:00+08:00').toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',weekday:'short'});
src=src.replace(/(<button id="jcFootballDateLabel"[^>]*>)[^<]*(<\/button>)/,(_,a,b)=>a+ds.slice(5)+' '+weekday+b);
src=src.replace(/(<span id="jcFootballFixtureCount"[^>]*>)[^<]*(<\/span>)/,(_,a,b)=>a+'共'+count+'场'+b);
if(!src.includes('data-qc-static-date="'+ds+'"')||!src.includes('data-qc-static-count="'+count+'"'))throw Error('Incomplete HTML');
const old=read('football.html');
if(src!==old){fs.writeFileSync(output,src,'utf8');console.log('PASS prerender football public HTML',ds,count,version);}
else console.log('PASS football unchanged',ds,count);
