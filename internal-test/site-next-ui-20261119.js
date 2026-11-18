(function(){
'use strict';
var data=window.QC_NEXT_UI_PREVIEW;
var root=document.getElementById('mainView');
if(!root||!data||!Array.isArray(data.days))return;
var days=data.days,all=days.flatMap(function(d){return d.rows.map(function(r){return Object.assign({businessDate:d.day,archived:d.archived},r);});});
var byId=new Map(all.map(function(r){return [r.id,r];}));
var focusDay=data.demoDate||'2026-11-19';
var activeDate=focusDay,reviewDate=(days.filter(function(d){return d.archived;}).slice(-1)[0]||days[0]).day;
var leagueFilter='全部',searchTerm='',detailTab='overview';
var pages={
 home:'site-next-ui-20261119.html',
 matches:'site-next-ui-20261119-matches.html',
 reviews:'site-next-ui-20261119-reviews.html',
 detail:'site-next-ui-20261119-detail.html'
};
var $=function(id){return document.getElementById(id);};
function enc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function dayLabel(day){if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return day||'';return Number(day.slice(5,7))+'月'+Number(day.slice(8))+'日';}
function nfmt(n){return Number(n||0).toLocaleString('zh-CN');}
function getDay(date){return days.find(function(d){return d.day===date;})||null;}
function feature(row){return row?'<span class="crest">'+logoHtml(row.homeLogo)+'</span>':'';}
function logoHtml(raw){
 var src=String(raw||'');
 if(src.startsWith('../assets/')&&/^\.\.\/assets\/[A-Za-z0-9/_\-.]+$/.test(src)||
    /^https:\/\/(images\.fotmob\.com|a\.espncdn\.com)\//.test(src)){
   return '<img src="'+enc(src)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">';
 }
 return '⚽';
}
function crest(src){return '<span class="crest">'+logoHtml(src)+'</span>';}
function score(r){return r.ft||'VS';}
function matchUrl(r){return pages.detail+'?id='+encodeURIComponent(r.id);}
function pageName(){
 var name=location.pathname.split('/').pop();
 return Object.keys(pages).find(function(k){return pages[k]===name;})||'home';
}
function link(href,label,extra){return '<a data-ui-link href="'+enc(href)+'" '+(extra||'')+'>'+label+'</a>';}
function navMark(page){
 document.querySelectorAll('[data-nav]').forEach(function(a){var yes=a.getAttribute('data-nav')===page;a.classList.toggle('active',yes);if(yes)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
}
function pageHead(path,title,subtitle,extra){
 return '<div class="path">'+link(pages.home,'球场档案')+' / '+enc(path)+'</div>'+
 '<div class="pagehead"><div><h1>'+enc(title)+'</h1>'+(subtitle?'<p>'+enc(subtitle)+'</p>':'')+'</div>'+
 (extra||'')+'</div>';
}
function panelHead(title,desc,more){
 return '<div class="panel-head"><div><h2>'+enc(title)+'</h2>'+(desc?'<p>'+enc(desc)+'</p>':'')+'</div>'+(more||'')+'</div>';
}
function quickRecord(r,kind){
 var label=kind==='review'?'半场 '+(r.ht||'—'):(r.ft?'已完赛':'查看赛事');
 return link(matchUrl(r),'<span class="row-meta"><strong>'+enc(r.league)+'</strong><small>'+enc(r.number)+'</small></span>'+
 '<span class="row-teams"><span>'+enc(r.home)+'</span><b>'+enc(score(r))+'</b><span>'+enc(r.away)+'</span></span>'+
 '<span class="row-end">'+(kind==='review'?enc(label):'<b>详情 ›</b>')+'</span>','class="row-match"');
}
function reviewRecord(r){
 return link(matchUrl(r),'<span class="league">'+enc(r.league)+'</span>'+
 '<span class="teams"><span>'+enc(r.home)+'</span><b>'+enc(score(r))+'</b><span>'+enc(r.away)+'</span></span>'+
 '<span class="half">'+(r.ht?'半 '+enc(r.ht):'查看 ›')+'</span>','class="review-link"');
}
function odds(r){
 var market=r&&r.markets&&r.markets.had&&r.markets.had.outcomes||null;
 if(!market)return null;
 if(!Number.isFinite(Number(market.h))||!Number.isFinite(Number(market.d))||!Number.isFinite(Number(market.a)))return null;
 return market;
}
function oddsSmall(r){
 var market=odds(r);
 if(!market)return '<div class="market-tiny"><span style="grid-column:span 3"><small>公开赛前数据</small><b>待更新</b></span></div>';
 return '<div class="market-tiny">'+['h','d','a'].map(function(k,i){
  return '<span><small>'+['主胜','平局','客胜'][i]+'</small><b>'+enc(market[k])+'</b></span>';
 }).join('')+'</div>';
}
function fixtureCard(r){
 return '<article class="fixture-card"><div class="fixture-top"><span>'+enc(r.league)+' · '+enc(r.number)+'</span><small>'+enc(dayLabel(r.date))+' '+enc(r.time)+'</small></div>'+
 '<div class="fixture-main"><div class="fixture-team">'+crest(r.homeLogo)+'<b>'+enc(r.home)+'</b></div>'+
 '<div class="fixture-score">'+enc(score(r))+'<small>'+(r.ft?'已完赛':'即将开始')+'</small></div>'+
 '<div class="fixture-team">'+crest(r.awayLogo)+'<b>'+enc(r.away)+'</b></div></div>'+
 oddsSmall(r)+'<div class="cardfoot"><small>'+enc(r.ft?'全场赛果已记录':'北京时间 · '+r.time)+'</small>'+
 link(matchUrl(r),'查看详情 ›')+'</div></article>';
}
function firstFocus(){var d=getDay(focusDay);return d&&d.rows.length?d.rows[0]:all.find(function(r){return !r.ft;});}
function renderHero(){
 var r=firstFocus();if(!r)return '';
 return '<section class="hero"><div class="hero-left"><div class="eyebrow">球场档案 · 今日赛场</div>'+
 '<h2>每一场比赛，<br><em>都有值得看的细节。</em></h2>'+
 '<p>从今日赛程到赛后比分，把赛事信息整理得更清晰。切换日期、查看比赛、回顾赛果，都在这里完成。</p>'+
 '<div class="hero-actions">'+link(pages.matches+'?date='+encodeURIComponent(focusDay),'查看今日赛程 <span>↗</span>','class="hero-button"')+
 link(pages.reviews,'回看近期赛果 ↗','class="hero-link"')+'</div></div>'+
 '<div class="hero-right">'+link(matchUrl(r),'<div class="feature-match"><div class="feature-top"><span>今日焦点 · '+enc(r.league)+'</span><b>'+enc(r.number)+'</b></div>'+
 '<div class="feature-score"><div class="feature-team">'+crest(r.homeLogo)+'<b>'+enc(r.home)+'</b></div>'+
 '<div class="feature-score-value">'+enc(score(r))+'</div>'+
 '<div class="feature-team">'+crest(r.awayLogo)+'<b>'+enc(r.away)+'</b></div></div>'+
 '<div class="feature-bottom"><span>'+enc(dayLabel(r.date))+' '+enc(r.time)+' · 北京时间</span><span>比赛详情 ›</span></div></div>')+'</div></section>';
}
function renderHome(){
 var today=getDay(focusDay),prev=getDay('2026-11-18'),lastFinished=days.filter(function(d){return d.archived;}).slice(-1)[0];
 var todayRows=today?today.rows:[],latestDone=lastFinished?lastFinished.rows.filter(function(r){return !!r.ft;}):[];
 var leagues=new Set(todayRows.map(function(x){return x.league;}));
 var prevDone=prev?prev.rows.filter(function(r){return r.ft;}):[];
 var reviewInfo=prevDone.length?'近期完赛比分':'赛果尚在更新';
 var yday=prevDone.length?prevDone:latestDone;
 return pageHead('今日速览','今日速览','把今天的比赛与近期赛果放在同一个清晰的视图中。')+
 renderHero()+
 '<div class="metrics"><div class="metric"><small>今日赛事</small><b>'+nfmt(todayRows.length)+'</b><i>今日赛程</i></div>'+
 '<div class="metric"><small>涉及赛事</small><b>'+nfmt(leagues.size)+'</b><i>独立赛事类别</i></div>'+
 '<div class="metric"><small>最近已完赛</small><b>'+nfmt(latestDone.length)+'</b><i>'+enc(dayLabel(lastFinished&&lastFinished.day))+'</i></div></div>'+
 '<div class="home-grid"><div class="column">'+
 '<section class="panel">'+panelHead('今日预测','先看完整赛程，点击比赛了解详情。',link(pages.matches+'?date='+focusDay,'全部赛事 ›'))+
 '<div class="stack-rows">'+(todayRows.length?todayRows.map(function(r){return quickRecord(r,'today');}).join(''):'<div class="empty">今日暂无比赛安排</div>')+'</div></section>'+
 '<section class="panel">'+panelHead('最近赛后回看',enc(dayLabel(lastFinished&&lastFinished.day))+' · 已完赛比分',link(pages.reviews,'完整回看 ›'))+
 '<div class="stack-rows">'+(latestDone.slice(0,5).map(function(r){return quickRecord(r,'review');}).join('')||'<div class="empty">暂无可回看的比赛</div>')+'</div></section>'+
 '</div><div class="column">'+
 '<section class="panel">'+panelHead('昨日回看',prev?'11月18日 · '+reviewInfo:'暂无相关比赛',link(pages.reviews,'历史赛果 ›'))+
 (prevDone.length?'<div class="review-rows">'+prevDone.slice(0,5).map(reviewRecord).join('')+'</div>':
 '<div class="empty">该日比赛的赛果仍待完整确认，可先查看最近已完成的比赛。</div>')+
 '<div class="review-foot">已确认的完赛结果将统一显示在赛后回看中。</div></section>'+
 '<section class="panel">'+panelHead('赛事分析','完整观点与赛前研究')+
 lockedContent('赛事分析在正式网站登录后查看。')+'</section>'+
 '</div></div>';
}
function lockedContent(message){
 return '<div style="padding:0 14px 15px"><div class="locked-card"><div class="lock-symbol" aria-hidden="true">🔒</div>'+
 '<h3>解锁完整赛事分析</h3><p>'+enc(message||'登录后可查看对应比赛的完整内容。')+'</p>'+
 '<a href="../index.html">前往球场档案 ›</a></div></div>';
}
function dateChips(active,onlyFinished){
 return '<div class="quick-date">'+days.filter(function(d){return !onlyFinished||d.archived;}).map(function(d){
  return '<button class="date-chip '+(d.day===active?'active':'')+'" data-date="'+enc(d.day)+'" type="button"><strong>'+enc(dayLabel(d.day))+'</strong><small>'+enc(d.archived?'赛后回看':d.rows.length+'场比赛')+'</small></button>';
 }).join('')+'</div>';
}
function leagueOptions(day){
 var options=['全部'].concat(Array.from(new Set((day&&day.rows||[]).map(function(r){return r.league;}))));
 if(!options.includes(leagueFilter))leagueFilter='全部';
 return options;
}
function filters(day){
 return '<div class="filterbar"><div class="filter-chips" id="leagueFilters">'+leagueOptions(day).map(function(o){
 return '<button type="button" class="filter-chip '+(leagueFilter===o?'active':'')+'" data-league="'+enc(o)+'">'+enc(o)+'</button>';
 }).join('')+'</div><input id="fixtureSearch" class="search" type="search" autocomplete="off" placeholder="搜索球队或赛事" aria-label="搜索球队或赛事" value="'+enc(searchTerm)+'"></div>';
}
function matchListHtml(){
 var d=getDay(activeDate),rows=d?d.rows:[];
 return rows.filter(function(r){
  return (leagueFilter==='全部'||r.league===leagueFilter) && (!searchTerm||(r.home+' '+r.away+' '+r.league+' '+r.number).toLowerCase().includes(searchTerm));
 }).map(fixtureCard).join('')||'<div class="empty">该日期没有符合条件的比赛。</div>';
}
function renderMatches(){
 var search=new URLSearchParams(location.search).get('date');
 if(search&&getDay(search))activeDate=search;
 var day=getDay(activeDate);
 return pageHead('全部赛程','比赛日程','选择日期或赛事，查看全场比分、官方公开数据和比赛详情。')+
 '<div id="matchDates">'+dateChips(activeDate,false)+'</div>'+
 '<div class="section-top"><h2 id="fixtureDayTitle">'+enc(dayLabel(activeDate))+' · 比赛安排</h2><span class="text-muted" id="fixtureTotal">'+nfmt(day?day.rows.length:0)+'场比赛</span></div>'+
 '<div id="matchFilters">'+filters(day)+'</div>'+
 '<div id="matchGrid" class="fixture-grid">'+matchListHtml()+'</div>'+
 '<div class="note"><b>说明：</b>已结束的比赛显示正式记录的比分；尚未完赛的比赛显示赛程和已公开的信息。实际赛况请以正式网站更新为准。</div>';
}
function statsFor(day){
 var rows=(day?day.rows:[]).filter(function(r){return !!r.ft;});
 var total=rows.reduce(function(a,r){var s=r.ft.split('-').map(Number);return a+s[0]+s[1];},0);
 var draws=rows.filter(function(r){var n=r.ft.split('-');return n[0]===n[1];}).length;
 return {rows:rows,total:total,draws:draws};
}
function renderReviews(){
 var date=new URLSearchParams(location.search).get('date');
 if(date&&getDay(date)&&getDay(date).archived)reviewDate=date;
 var day=getDay(reviewDate),st=statsFor(day);
 return pageHead('赛后回看','赛后回看','按比赛日整理已确认的赛果，半场和全场比分一目了然。')+
 '<section class="preview-banner"><div class="eyebrow">赛果档案 · 历史回顾</div>'+
 '<h2>回看比赛，<br>看清每一个结果。</h2><p>按日期查看比分记录，点击任意比赛进入完整赛事页面。</p></section>'+
 '<div class="section-top"><h2>选择比赛日</h2><span class="text-muted">按日期整理</span></div>'+
 '<div id="reviewDates">'+dateChips(reviewDate,true)+'</div>'+
 '<div class="review-stats"><div class="review-stat"><small>完赛场次</small><b id="resultCount">'+st.rows.length+'</b></div>'+
 '<div class="review-stat"><small>累计进球</small><b id="goalCount">'+st.total+'</b></div>'+
 '<div class="review-stat"><small>平局场次</small><b id="drawCount">'+st.draws+'</b></div></div>'+
 '<div class="section-top"><h2 id="reviewLabel">'+enc(dayLabel(reviewDate))+' · 全部赛果</h2></div>'+
 '<div id="reviewList" class="full-review">'+reviewListHtml(st.rows)+'</div>'+
 '<div class="note">所有比分均按比赛主队在前、客队在后展示。未确认完赛的比赛不会计入回看。</div>';
}
function reviewListHtml(rows){
 return rows.length?rows.map(function(r){
 var scoreLabel=r.ft||'—';
 return link(matchUrl(r),'<div class="review-match-meta"><strong>'+enc(r.league)+'</strong><small>'+enc(r.number)+'</small></div>'+
 '<div class="review-match-teams"><span>'+enc(r.home)+'</span><b>'+enc(scoreLabel)+'</b><span>'+enc(r.away)+'</span></div>'+
 '<div class="review-match-end">'+enc(r.time)+'<strong>半场 '+enc(r.ht||'—')+'</strong></div>','class="review-match"');
 }).join(''):'<div class="empty">暂无已确认的赛果。</div>';
}
function marketCard(title,labels,market){
 if(!market||!market.outcomes)return '';
 return '<div class="market-block"><h3>'+enc(title)+(market.line?' · '+enc(market.line):'')+'</h3><div class="market-items">'+
 labels.map(function(x){return '<div class="market-item"><small>'+enc(x[1])+'</small><b>'+enc(market.outcomes[x[0]]??'—')+'</b></div>';}).join('')+
 '</div></div>';
}
function detailMarkets(r){
 var m=r.markets||{};
 var blocks=marketCard('胜平负',[['h','主胜'],['d','平局'],['a','客胜']],m.had)+
 marketCard('让球胜平负',[['h','让胜'],['d','让平'],['a','让负']],m.hhad);
 if(m.ttg&&m.ttg.outcomes){
  var items=Object.entries(m.ttg.outcomes).filter(function(entry){return /^s\d$/.test(entry[0]);}).sort(function(a,b){return Number(a[0].slice(1))-Number(b[0].slice(1));});
  if(items.length)blocks+='<div class="market-block"><h3>总进球</h3><div class="more-market">'+items.map(function(x){return '<span>'+enc(x[0].slice(1))+'球 · '+enc(x[1])+'</span>';}).join('')+'</div></div>';
 }
 if(!blocks)blocks='<div class="empty">这场比赛的公开赛前数据尚未更新。</div>';
 return blocks+'<div class="note">以上为已有的公开赛前资料，仅供赛事信息查阅。具体数据以正式网站为准。</div>';
}
function overviewTab(r){
 return '<div class="info-grid"><div class="info-item"><small>比赛日期</small><b>'+enc(dayLabel(r.date))+'</b></div>'+
 '<div class="info-item"><small>开赛时间</small><b>'+enc(r.time)+'</b></div>'+
 '<div class="info-item"><small>赛事</small><b>'+enc(r.league)+'</b></div>'+
 '<div class="info-item"><small>比赛状态</small><b>'+enc(r.ft?'已结束':'未完赛')+'</b></div>'+
 '<div class="info-item"><small>半场比分</small><b>'+enc(r.ht||'—')+'</b></div>'+
 '<div class="info-item"><small>全场比分</small><b>'+enc(r.ft||'—')+'</b></div></div>'+
 '<div class="note"><b>赛况提示：</b>比赛记录按北京时间展示，完赛比分在确认后更新。</div>';
}
function detailTabHtml(r){
 if(detailTab==='markets')return detailMarkets(r);
 if(detailTab==='analysis')return lockedContent('赛事预测、详细解读及相关观点请在正式网站登录后查看。');
 return overviewTab(r);
}
function renderDetail(){
 var id=new URLSearchParams(location.search).get('id');
 var r=byId.get(id);
 if(!r)return pageHead('赛事详情','赛事未找到','请返回比赛列表重新选择。')+
 '<div class="panel"><div class="empty">没有找到对应的比赛记录。'+link(pages.matches,'返回全部赛程')+'</div></div>';
 var back=pages.matches+'?date='+encodeURIComponent(r.businessDate);
 var tabs=[['overview','比赛概览'],['markets','官方公开数据'],['analysis','赛事分析']];
 return '<div class="path">'+link(pages.home,'球场档案')+' / '+link(back,'全部赛程')+' / 赛事详情</div>'+
 '<div class="pagehead"><div><h1>赛事详情</h1><p>'+enc(r.league)+' · '+enc(r.number)+' · '+enc(dayLabel(r.date))+'</p></div>'+
 '<div class="page-actions">'+link(back,'← 返回赛程')+'</div></div>'+
 '<section class="detail-hero"><div class="detail-upper"><span>'+enc(r.league)+' · '+enc(r.number)+'</span><span>'+enc(r.ft?'比赛已结束':'比赛安排')+'</span></div>'+
 '<div class="detail-face"><div class="detail-person">'+crest(r.homeLogo)+'<b>'+enc(r.home)+'</b></div>'+
 '<div class="detail-center"><strong>'+enc(score(r))+'</strong><small>'+enc(r.ft?'全场比分':'比赛未结束')+'</small></div>'+
 '<div class="detail-person">'+crest(r.awayLogo)+'<b>'+enc(r.away)+'</b></div></div>'+
 '<div class="detail-caption">'+enc(dayLabel(r.date))+' '+enc(r.time)+' · 北京时间'+(r.ht?' · 半场 '+enc(r.ht):'')+'</div></section>'+
 '<div class="detail-layout"><div><section class="panel"><div class="tabs" id="detailTabs">'+tabs.map(function(tab){
  return '<button type="button" data-tab="'+tab[0]+'" class="tab '+(detailTab===tab[0]?'active':'')+'">'+tab[1]+'</button>';
 }).join('')+'</div><div id="detailTabBody" class="tab-content">'+detailTabHtml(r)+'</div></section></div>'+
 '<aside><section class="panel">'+panelHead('比赛信息','场次与时间安排')+
 '<div class="info-grid" style="grid-template-columns:repeat(2,1fr);padding:0 14px 16px">'+
 '<div class="info-item"><small>比赛编号</small><b>'+enc(r.number)+'</b></div>'+
 '<div class="info-item"><small>比赛时间</small><b>'+enc(r.time)+'</b></div></div></section>'+
 '<section class="panel">'+panelHead('查看完整内容','获取正式赛事信息')+
 '<div style="padding:0 14px 16px">'+link('../jc-match.html?id='+encodeURIComponent(r.id),'前往正式赛事页 ↗','class="hero-button" style="display:flex;justify-content:center;background:#e0eecf"')+'</div></section></aside></div>';
}
function render(){
 var page=pageName();
 navMark(page==='detail'?'matches':page);
 var html=page==='home'?renderHome():page==='matches'?renderMatches():page==='reviews'?renderReviews():renderDetail();
 root.innerHTML=html;
 var labels={home:'今日速览',matches:'比赛日程',reviews:'赛后回看',detail:'赛事详情'};
 document.title='球场档案｜'+labels[page];
 var headerDate=$('headerDate');if(headerDate)headerDate.textContent=dayLabel(focusDay);
}
function navigate(url){
 history.pushState(null,'',url.pathname+url.search);
 if(pageName()==='detail')detailTab='overview';
 if(pageName()==='matches')searchTerm='';
 render();window.scrollTo({top:0,behavior:'instant'});
}
document.addEventListener('click',function(e){
 var target=e.target.closest('a[data-ui-link]');
 if(target){
  var href=new URL(target.href),name=href.pathname.split('/').pop();
  if(href.origin===location.origin&&Object.values(pages).includes(name)){
   e.preventDefault();navigate(href);return;
  }
 }
 var date=e.target.closest('button[data-date]');
 if(date){
  var val=date.dataset.date;if(!getDay(val))return;
  if(pageName()==='matches'){
   activeDate=val;leagueFilter='全部';searchTerm='';
   var d=getDay(val);
   $('matchDates').innerHTML=dateChips(activeDate,false);
   $('fixtureDayTitle').textContent=dayLabel(val)+' · 比赛安排';
   $('fixtureTotal').textContent=nfmt(d.rows.length)+'场比赛';
   $('matchFilters').innerHTML=filters(d);
   $('matchGrid').innerHTML=matchListHtml();
  }else if(pageName()==='reviews'&&getDay(val).archived){
   reviewDate=val;var st=statsFor(getDay(val));
   $('reviewDates').innerHTML=dateChips(val,true);
   $('resultCount').textContent=st.rows.length;
   $('goalCount').textContent=st.total;
   $('drawCount').textContent=st.draws;
   $('reviewLabel').textContent=dayLabel(val)+' · 全部赛果';
   $('reviewList').innerHTML=reviewListHtml(st.rows);
  }
  return;
 }
 var f=e.target.closest('button[data-league]');
 if(f){leagueFilter=f.dataset.league;var d=getDay(activeDate);$('matchFilters').innerHTML=filters(d);$('matchGrid').innerHTML=matchListHtml();return;}
 var tab=e.target.closest('button[data-tab]');
 if(tab&&pageName()==='detail'){
  detailTab=tab.dataset.tab;
  document.querySelectorAll('#detailTabs .tab').forEach(function(b){b.classList.toggle('active',b.dataset.tab===detailTab);});
  var r=byId.get(new URLSearchParams(location.search).get('id'));
  if(r)$('detailTabBody').innerHTML=detailTabHtml(r);
 }
});
document.addEventListener('input',function(e){
 if(e.target.id==='fixtureSearch'){
  searchTerm=e.target.value.trim().toLowerCase();
  var list=$('matchGrid');if(list)list.innerHTML=matchListHtml();
 }
});
window.addEventListener('popstate',function(){detailTab='overview';render();});
render();
})();