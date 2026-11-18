(function(){
'use strict';
var source=window.QC_NEXT_UI_PREVIEW;
var mount=document.getElementById('mainView');
if(!mount||!source||!Array.isArray(source.days))return;
var days=source.days;
var records=days.flatMap(function(d){return d.rows.map(function(r){return Object.assign({businessDate:d.day},r);});});
var recordIndex=new Map(records.map(function(r){return [String(r.id),r];}));
var pageUrls={home:'site-next-ui-20261119.html',matches:'site-next-ui-20261119-matches.html',profile:'site-next-ui-20261119-profile.html',detail:'site-next-ui-20261119-detail.html'};
var today=source.demoDate||days[days.length-1].day;
var pickedDay=today,league='全部',query='',detailTab='judgments';
var savedKey='qc_next_ui_favorites_v1',viewedKey='qc_next_ui_seen_v1';
var savedBackup=[],viewedBackup=[];
var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
var el=function(id){return document.getElementById(id);};
function dText(d){if(!/^\d{4}-\d\d-\d\d$/.test(d||''))return '—';return Number(d.slice(5,7))+'月'+Number(d.slice(8))+'日';}
function route(){var file=location.pathname.split('/').pop();return Object.keys(pageUrls).find(function(k){return pageUrls[k]===file;})||'home';}
function dayRows(day){var d=days.find(function(item){return item.day===day;});return d?d.rows.map(function(r){return recordIndex.get(String(r.id));}):[];}
function availableDays(){return days.map(function(d){return d.day;});}
function link(path,title,extra){return '<a href="'+esc(path)+'" data-ui-link '+(extra||'')+'>'+title+'</a>';}
function matchUrl(r){return pageUrls.detail+'?id='+encodeURIComponent(r.id);}
function sorted(rows){return rows.slice().sort(function(a,b){return String(a.number).localeCompare(String(b.number),'zh-CN',{numeric:true});});}
function isDone(r){return !!r.ft;}
function stateLabel(r,key){
 if(!r.ft)return '<span class="verdict pending">—</span>';
 var v=r.review&&r.review[key];
 if(v===true)return '<span class="verdict hit" aria-label="命中">✓</span>';
 if(v===false)return '<span class="verdict miss" aria-label="未命中">×</span>';
 return '<span class="verdict pending" aria-label="暂无判定">—</span>';
}
function choiceGroup(r){
 if(!r.ft)return '<span class="dash">—</span>';
 return '<div class="choice-pair"><span>方向 '+stateLabel(r,'direction')+'</span><span>让球 '+stateLabel(r,'handicap')+'</span></div>';
}
function matchName(r){
 return '<span class="teams"><strong>'+esc(r.home)+'</strong><span class="score-box"><b>'+esc(r.ft||'VS')+'</b>'+
 (r.ht?'<small>半 '+esc(r.ht)+'</small>':'')+'</span><strong>'+esc(r.away)+'</strong></span>';
}
function rowContent(r){
 return '<span class="match-no">'+esc(String(r.number).replace(/^周[一二三四五六日天]/,''))+'</span>'+
 '<span class="match-time">'+esc(r.time||'—')+'</span><span class="match-league">'+esc(r.league||'—')+'</span>'+
 matchName(r)+'<span class="cell-result">'+choiceGroup(r)+'</span>'+
 '<span class="cell-result">'+stateLabel(r,'goals')+'</span>'+
 '<span class="cell-result">'+stateLabel(r,'htft')+'</span>';
}
function rowTable(rows){
 if(!rows.length)return '<div class="empty">暂无可显示的比赛</div>';
 return '<div class="results-scroll"><div class="results-head"><span>编号</span><span>时间</span><span>赛事</span>'+
 '<span>主队 · 比分 · 客队</span><span>胜平负／让球</span><span>总进球</span><span>半全场</span></div>'+
 sorted(rows).map(function(r){return link(matchUrl(r),rowContent(r),'class="result-row"');}).join('')+'</div>';
}
function legend(){return '<div class="legend"><span><b class="verdict hit">✓</b> 命中</span><span><b class="verdict miss">×</b> 未命中</span><span><b class="verdict pending">—</b> 待确认</span></div>';}
function section(title,sub,content,anchor,extra){
 return '<section class="section"'+(anchor?' id="'+anchor+'"':'')+'><header class="section-header"><div><h2>'+title+'</h2>'+
 (sub?'<p>'+sub+'</p>':'')+'</div>'+(extra||'')+'</header>'+content+'</section>';
}
function renderHome(){
 var previous=days.find(function(d){return d.day==='2026-11-18';});
 var recent=days.filter(function(d){return d.rows.some(function(r){return !!r.ft;});}).sort(function(a,b){return a.day.localeCompare(b.day);}).slice(-1)[0];
 var prevRows=previous?dayRows(previous.day).filter(isDone):[];
 var reviewDay=prevRows.length?previous.day:(recent&&recent.day);
 var reviewRows=prevRows.length?prevRows:(reviewDay?dayRows(reviewDay).filter(isDone):[]);
 var reviewSub=reviewDay?dText(reviewDay)+' · '+reviewRows.length+'场已完赛'+(previous&&reviewDay!==previous.day?'（最近已确认赛果）':''):'暂无已确认赛果';
 var nowRows=dayRows(today);
 return '<div class="page-intro"><div><h1>今日速览</h1><p>'+esc(dText(today))+' · 赛事与结果一目了然</p></div>'+
 link(pageUrls.matches,'查看竞彩足球 ›','class="subtle-action"')+'</div>'+
 section('昨日回看',reviewSub,legend()+rowTable(reviewRows),'review')+
 section('今日预测',dText(today)+' · '+nowRows.length+'场比赛',
 (nowRows.some(function(r){return !r.ft;})?'<div class="brief-note">赛前选择尚未发布的项目以“—”显示，开赛后按已确认结果更新。</div>':'')+
 rowTable(nowRows),'today');
}
function dateNav(){
 return '<div class="date-strip">'+availableDays().map(function(day){
 return '<button type="button" class="date-pill'+(pickedDay===day?' active':'')+'" data-day="'+esc(day)+'">'+esc(dText(day))+
 '<small>'+dayRows(day).length+'场</small></button>';
 }).join('')+'</div>';
}
function matchFilterBar(){
 var items=['全部'].concat(Array.from(new Set(dayRows(pickedDay).map(function(r){return r.league;}))));
 if(!items.includes(league))league='全部';
 return '<div class="filters"><div class="filter-options">'+items.map(function(n){
 return '<button type="button" class="filter-pill'+(league===n?' active':'')+'" data-league="'+esc(n)+'">'+esc(n)+'</button>';
 }).join('')+'</div><input class="filter-input" id="filterInput" type="search" value="'+esc(query)+'" aria-label="搜索球队" placeholder="搜索球队或赛事"></div>';
}
function filteredMatches(){
 return dayRows(pickedDay).filter(function(r){
 return (league==='全部'||league===r.league)&&(!query||(r.home+' '+r.away+' '+r.league+' '+r.number).toLowerCase().includes(query));
 });
}
function savedList(key,fallback){
 try{var v=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(v)?v.filter(function(x){return typeof x==='string'&&recordIndex.has(x);}).slice(0,40):fallback;}catch(_){return fallback;}
}
function saveList(key,items){try{localStorage.setItem(key,JSON.stringify(items.slice(0,40)));}catch(_){}}
function favorites(){return savedList(savedKey,savedBackup);}
function views(){return savedList(viewedKey,viewedBackup);}
function toggleSaved(id){
 if(!recordIndex.has(id))return;
 var old=favorites();
 savedBackup=(old.includes(id)?old.filter(function(x){return x!==id;}):[id].concat(old)).slice(0,40);
 saveList(savedKey,savedBackup);
}
function noteViewed(id){
 if(!recordIndex.has(id))return;
 viewedBackup=[id].concat(views().filter(function(x){return x!==id;})).slice(0,20);
 saveList(viewedKey,viewedBackup);
}
function saveButton(r){
 var yes=favorites().includes(r.id);
 return '<button type="button" data-save="'+esc(r.id)+'" class="save'+(yes?' saved':'')+'" aria-pressed="'+(yes?'true':'false')+'">'+(yes?'★ 已关注':'☆ 关注')+'</button>';
}
function fixtureList(){
 var rows=filteredMatches();
 if(!rows.length)return '<div class="empty">没有符合条件的比赛</div>';
 return '<div class="fixtures">'+sorted(rows).map(function(r){
 return '<article class="fixture"><div class="fixture-body">'+link(matchUrl(r),'<div class="fixture-top"><span>'+esc(r.number)+' · '+esc(r.league)+'</span>'+
 '<span>'+esc(r.time||'—')+'</span></div><div class="fixture-teams">'+matchName(r)+'</div>','class="fixture-link"')+
 '<div class="fixture-bottom"><span>'+esc(r.ft?'比赛已结束':'赛前信息')+'</span>'+
 '<div>'+saveButton(r)+link(matchUrl(r),'详情 ›','class="detail-link"')+'</div></div></div></article>';
 }).join('')+'</div>';
}
function renderMatches(){
 var param=new URLSearchParams(location.search).get('date');if(param&&availableDays().includes(param))pickedDay=param;
 return '<div class="page-intro"><div><h1>竞彩足球</h1><p>查看赛程、比赛结果及详细信息</p></div></div>'+
 '<div id="days">'+dateNav()+'</div>'+
 '<div id="filters">'+matchFilterBar()+'</div>'+
 '<div class="list-heading"><h2 id="listTitle">'+esc(dText(pickedDay))+' · '+filteredMatches().length+'场比赛</h2></div>'+
 '<div id="fixtureList">'+fixtureList()+'</div>';
}
function resultTags(r){
 var fields=[['核心方向','direction'],['官方让球','handicap'],['单选判断','single'],['半全场','htft'],['总进球','goals'],['参考比分','score']];
 return '<div class="six-fields">'+fields.map(function(f){return '<div class="six-cell"><small>'+f[0]+'</small>'+stateLabel(r,f[1])+'</div>';}).join('')+'</div>';
}
function marketView(r){
 var markets=r.markets||{},html='';
 [['had','胜平负',[['h','主胜'],['d','平局'],['a','客胜']]],['hhad','让球胜平负',[['h','让胜'],['d','让平'],['a','让负']]]].forEach(function(m){
 var pool=markets[m[0]],out=pool&&pool.outcomes||null;
 if(!out)return;
 html+='<div class="market-row"><h3>'+m[1]+(pool.line?'（'+esc(pool.line)+'）':'')+'</h3><div class="market-options">'+
 m[2].map(function(option){var n=out[option[0]];return '<div><small>'+option[1]+'</small><b>'+esc(n===undefined?'—':n)+'</b></div>';}).join('')+'</div></div>';
 });
 if(markets.ttg&&markets.ttg.outcomes){
 var list=Object.entries(markets.ttg.outcomes).filter(function(x){return /^s\d$/.test(x[0]);}).sort(function(a,b){return Number(a[0].slice(1))-Number(b[0].slice(1));});
 if(list.length)html+='<div class="market-row"><h3>总进球</h3><div class="goal-options">'+list.map(function(x){return '<span>'+esc(x[0].slice(1))+'球 '+esc(x[1])+'</span>';}).join('')+'</div></div>';
 }
 return html||'<div class="empty">暂无相关公开数据</div>';
}
function detailBody(r){
 if(detailTab==='markets')return marketView(r);
 if(detailTab==='overview')return '<div class="info-list"><div><span>比赛日期</span><strong>'+esc(dText(r.date))+'</strong></div>'+
 '<div><span>开赛时间</span><strong>'+esc(r.time||'—')+'</strong></div>'+
 '<div><span>赛事</span><strong>'+esc(r.league)+'</strong></div>'+
 '<div><span>半场比分</span><strong>'+esc(r.ht||'—')+'</strong></div>'+
 '<div><span>全场比分</span><strong>'+esc(r.ft||'—')+'</strong></div></div>';
 return (!r.ft?'<p class="brief-note">赛前方向尚未公开的项目暂不显示选择；赛后结果确认后展示核对状态。</p>':'')+resultTags(r);
}
function renderDetail(){
 var id=new URLSearchParams(location.search).get('id'),r=recordIndex.get(id);
 if(!r)return '<div class="page-intro"><h1>赛事详情</h1></div><div class="empty">没有找到该场比赛。'+link(pageUrls.matches,'返回竞彩足球')+'</div>';
 noteViewed(id);
 var back=pageUrls.matches+'?date='+encodeURIComponent(r.businessDate);
 return '<div class="back-link">'+link(back,'‹ 返回竞彩足球')+'</div>'+
 '<section class="detail-head"><div class="detail-meta">'+esc(r.number)+' · '+esc(r.league)+' · '+esc(dText(r.date))+' '+esc(r.time||'')+'</div>'+
 '<div class="detail-score"><strong>'+esc(r.home)+'</strong><div><b>'+esc(r.ft||'VS')+'</b><small>'+esc(r.ht?'半场 '+r.ht:(r.ft?'全场比分':'尚未完赛'))+'</small></div><strong>'+esc(r.away)+'</strong></div>'+
 '<div class="detail-tools">'+saveButton(r)+'</div></section>'+
 '<section class="detail-panel"><div class="detail-tabs" id="detailTabs">'+
 [['judgments','赛前判断'],['overview','比赛信息'],['markets','竞彩玩法']].map(function(t){return '<button type="button" class="'+(detailTab===t[0]?'active':'')+'" data-tab="'+t[0]+'">'+t[1]+'</button>';}).join('')+
 '</div><div id="detailBody" class="detail-body">'+detailBody(r)+'</div></section>';
}
function profileList(ids){
 if(!ids.length)return '<div class="empty small">暂无记录</div>';
 return '<div class="profile-list">'+ids.map(function(id){var r=recordIndex.get(id);if(!r)return '';
 return '<div class="profile-item">'+link(matchUrl(r),'<small>'+esc(r.league)+' · '+esc(dText(r.date))+'</small>'+
 '<strong>'+esc(r.home)+' <b>'+esc(r.ft||'VS')+'</b> '+esc(r.away)+'</strong>')+saveButton(r)+'</div>';
 }).join('')+'</div>';
}
function renderProfile(){
 var fav=favorites(),last=views();
 return '<div class="page-intro"><div><h1>个人中心</h1><p>你关注的比赛和最近浏览的赛事</p></div></div>'+
 section('我的关注',fav.length+'场',profileList(fav),'favorites',link(pageUrls.matches,'查看竞彩足球 ›','class="subtle-action"'))+
 section('最近浏览',last.length+'场',profileList(last),'recent')+
 '<p class="quiet">关注记录保存在当前设备。</p>';
}
function activeNav(key){
 document.querySelectorAll('[data-nav]').forEach(function(n){
 var yes=n.dataset.nav===key;n.classList.toggle('active',yes);
 if(yes)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');
 });
}
function paint(){
 var p=route();activeNav(p==='detail'?'matches':p);
 mount.innerHTML=p==='home'?renderHome():p==='matches'?renderMatches():p==='profile'?renderProfile():renderDetail();
 var titles={home:'今日速览',matches:'竞彩足球',profile:'个人中心',detail:'赛事详情'};
 document.title='球场档案｜'+titles[p];
}
function move(target){
 history.pushState(null,'',target.pathname+target.search+target.hash);
 if(route()==='detail')detailTab='judgments';
 if(route()==='matches'&&target.search){var d=new URLSearchParams(target.search).get('date');if(d&&availableDays().includes(d))pickedDay=d;}
 paint();
 if(target.hash==='#review'){var node=el('review');if(node&&node.scrollIntoView)node.scrollIntoView({block:'start'});}else window.scrollTo({top:0,behavior:'auto'});
}
document.addEventListener('click',function(e){
 var save=e.target.closest('button[data-save]');
 if(save){toggleSaved(save.dataset.save);paint();return;}
 var nav=e.target.closest('a[data-ui-link]');
 if(nav){
  var url=new URL(nav.href);
  if(url.origin===location.origin&&Object.values(pageUrls).includes(url.pathname.split('/').pop())){
   e.preventDefault();move(url);return;
  }
 }
 var date=e.target.closest('button[data-day]');
 if(date){pickedDay=date.dataset.day;league='全部';query='';paint();return;}
 var filter=e.target.closest('button[data-league]');
 if(filter){league=filter.dataset.league;var list=el('fixtureList');if(list)list.innerHTML=fixtureList();
  document.querySelectorAll('[data-league]').forEach(function(b){b.classList.toggle('active',b.dataset.league===league);});return;
 }
 var tab=e.target.closest('button[data-tab]');
 if(tab&&route()==='detail'){detailTab=tab.dataset.tab;document.querySelectorAll('[data-tab]').forEach(function(b){b.classList.toggle('active',b.dataset.tab===detailTab);});
 var id=new URLSearchParams(location.search).get('id');var r=recordIndex.get(id);if(r)el('detailBody').innerHTML=detailBody(r);}
});
document.addEventListener('input',function(e){
 if(e.target.id==='filterInput'){query=String(e.target.value||'').toLowerCase().trim();var list=el('fixtureList');if(list)list.innerHTML=fixtureList();
 var title=el('listTitle');if(title)title.textContent=dText(pickedDay)+' · '+filteredMatches().length+'场比赛';}
});
window.addEventListener('popstate',function(){detailTab='judgments';paint();if(location.hash==='#review'){var node=el('review');if(node&&node.scrollIntoView)node.scrollIntoView({block:'start'});}});
paint();
if(location.hash==='#review'){var node=el('review');if(node&&node.scrollIntoView)node.scrollIntoView({block:'start'});}
})();