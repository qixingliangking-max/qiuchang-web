(function(){
'use strict';
var data=window.QC_NEXT_UI_PREVIEW;
var root=document.getElementById('mainView');
if(!root||!data||!Array.isArray(data.days))return;
var days=data.days,all=days.flatMap(function(d){return d.rows.map(function(r){return Object.assign({businessDate:d.day,archived:d.archived},r);});});
var byId=new Map(all.map(function(r){return [r.id,r];}));
var focusDay=data.demoDate||'2026-11-19';
var activeDate=focusDay,reviewDate=(days.filter(function(d){return d.archived;}).slice(-1)[0]||days[0]).day;
var leagueFilter='全部',searchTerm='',detailTab='predictions';
var pages={
 home:'site-next-ui-20261119.html',
 matches:'site-next-ui-20261119-matches.html',
 profile:'site-next-ui-20261119-profile.html',
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

function resultFlag(r,key){
 if(!r.ft) return '<span class="qc-grade qc-grade-pending">待赛后</span>';
 var state=r.review&&r.review[key];
 if(state===true)return '<span class="qc-grade qc-grade-hit"><b>✓</b> 命中</span>';
 if(state===false)return '<span class="qc-grade qc-grade-miss"><b>×</b> 未命中</span>';
 return '<span class="qc-grade qc-grade-none">—</span>';
}
function comparisonGrid(r,extended){
 var fields=extended?
 [['direction','核心方向'],['handicap','官方让球'],['single','单选倾向'],['htft','半全场'],['goals','总进球'],['score','参考比分']]:
 [['direction','胜平负／让球'],['goals','总进球'],['htft','半全场']];
 return '<div class="qc-check-grid'+(extended?' qc-check-six':'')+'">'+fields.map(function(v){
  return '<div class="qc-check-item"><span class="qc-check-name">'+enc(v[1])+'</span>'+resultFlag(r,v[0])+'</div>';
 }).join('')+'</div>';
}
function reviewLegend(){
 return '<div class="qc-review-legend" aria-label="结果标记说明"><span class="qc-grade qc-grade-hit"><b>✓</b> 命中</span>'+
 '<span class="qc-grade qc-grade-miss"><b>×</b> 未命中</span><span class="qc-grade qc-grade-none">— 暂无判定</span></div>';
}
function overviewLine(r){
 var label=r.ft?'已完赛':'待完赛',no=String(r.number||'').replace(/^周[一二三四五六日天]/,'');
 return '<article class="qc-match-line">'+link(matchUrl(r),'<div class="qc-match-line-head"><span class="qc-match-number">'+enc(no)+'</span>'+
 '<time>'+enc(r.time)+'</time><span>'+enc(r.league)+'</span><span class="qc-match-status'+(r.ft?' finished':'')+'">'+label+'</span><span class="qc-match-arrow">详情 ›</span></div>'+
 '<div class="qc-match-line-versus"><strong>'+enc(r.home)+'</strong><span class="qc-match-ft">'+enc(score(r))+
 '<small>'+(r.ht?'半场 '+enc(r.ht):(r.ft?'全场比分':'赛前'))+'</small></span><strong>'+enc(r.away)+'</strong></div>')+
 comparisonGrid(r,false)+'</article>';
}
function overviewRows(rows){
 return rows.length?'<div class="qc-match-list">'+rows.map(overviewLine).join('')+'</div>':
 '<div class="empty">这一天暂无可显示的赛事。</div>';
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
 var no=String(r.number||'').replace(/^周[一二三四五六日天]/,'');
 return '<article class="fixture-card qc-fixture-card"><div class="fixture-top"><span><b>'+enc(no)+'</b> · '+enc(r.league)+'</span>'+
 '<small>'+enc(dayLabel(r.date))+' '+enc(r.time)+'</small></div>'+
 link(matchUrl(r),'<div class="fixture-main"><div class="fixture-team">'+crest(r.homeLogo)+'<b>'+enc(r.home)+'</b></div>'+
 '<div class="fixture-score">'+enc(score(r))+'<small>'+(r.ft?'半场 '+enc(r.ht||'—'):'尚未完赛')+'</small></div>'+
 '<div class="fixture-team">'+crest(r.awayLogo)+'<b>'+enc(r.away)+'</b></div></div>')+
 comparisonGrid(r,false)+
 '<div class="cardfoot"><small>'+(r.ft?'赛果已确认':'赛前信息')+'</small><div class="qc-fixture-actions">'+favoriteButton(r)+link(matchUrl(r),'查看详情 ›')+'</div></div></article>';
}
function firstFocus(){var d=getDay(focusDay);return d&&d.rows.length?d.rows[0]:all.find(function(r){return !r.ft;});}
function renderHero(){
 var r=firstFocus();if(!r)return '';
 return '<section class="hero"><div class="hero-left"><div class="eyebrow">球场档案 · 今日赛场</div>'+
 '<h2>每一场比赛，<br><em>都有值得看的细节。</em></h2>'+
 '<p>从今日赛程到赛后比分，把赛事信息整理得更清晰。切换日期、查看比赛、回顾赛果，都在这里完成。</p>'+
 '<div class="hero-actions">'+link(pages.matches+'?date='+encodeURIComponent(focusDay),'查看今日赛程 <span>↗</span>','class="hero-button"')+
 link((pages.home+'#review'),'回看近期赛果 ↗','class="hero-link"')+'</div></div>'+
 '<div class="hero-right">'+link(matchUrl(r),'<div class="feature-match"><div class="feature-top"><span>今日焦点 · '+enc(r.league)+'</span><b>'+enc(r.number)+'</b></div>'+
 '<div class="feature-score"><div class="feature-team">'+crest(r.homeLogo)+'<b>'+enc(r.home)+'</b></div>'+
 '<div class="feature-score-value">'+enc(score(r))+'</div>'+
 '<div class="feature-team">'+crest(r.awayLogo)+'<b>'+enc(r.away)+'</b></div></div>'+
 '<div class="feature-bottom"><span>'+enc(dayLabel(r.date))+' '+enc(r.time)+' · 北京时间</span><span>比赛详情 ›</span></div></div>')+'</div></section>';
}
function renderHome(){
 var today=getDay(focusDay),yesterday=getDay('2026-11-18'),last=days.filter(function(d){return d.archived;}).slice(-1)[0];
 var todayRows=today?today.rows:[],yesterdayRows=yesterday?yesterday.rows:[],complete=yesterdayRows.filter(function(r){return !!r.ft;});
 var recent=last?last.rows.filter(function(r){return !!r.ft;}):[];
 return pageHead('今日速览','今日速览','')+
 '<div class="qc-today-summary"><div><small>今日赛程</small><strong>'+enc(dayLabel(focusDay))+'</strong></div>'+
 '<div><small>比赛场次</small><strong>'+nfmt(todayRows.length)+'场</strong></div>'+
 '<div><small>最近完赛</small><strong>'+nfmt(recent.length)+'场</strong></div></div>'+
 '<section class="qc-timeline-panel" id="review"><div class="qc-timeline-head"><div><span class="qc-section-index">01</span><h2>昨日回看</h2>'+
 '<small>'+enc(dayLabel(yesterday&&yesterday.day))+' · '+(complete.length?'已完赛 '+complete.length+' 场':'赛果更新中')+'</small></div>'+
 '<span class="qc-section-aside">比赛结果</span></div>'+
 (complete.length?reviewLegend():'')+overviewRows(yesterdayRows)+'</section>'+
 '<section class="qc-timeline-panel"><div class="qc-timeline-head"><div><span class="qc-section-index">02</span><h2>今日预测</h2>'+
 '<small>'+enc(dayLabel(focusDay))+' · '+nfmt(todayRows.length)+'场比赛</small></div>'+
 link(pages.matches+'?date='+focusDay,'查看全部 ›')+'</div>'+overviewRows(todayRows)+'</section>'+
 '<section class="qc-timeline-panel"><div class="qc-timeline-head"><div><span class="qc-section-index">03</span><h2>近期赛果</h2>'+
 '<small>'+enc(dayLabel(last&&last.day))+' · 已确认比分</small></div>'+
 '<span class="qc-section-aside">往期回看</span></div>'+
 reviewLegend()+overviewRows(recent)+'</section>';
}
function lockedContent(message){
 return '<div class="qc-article-preview"><h3>赛事分析</h3><p>'+enc(message||'暂无详细文字分析。')+'</p>'+
 '<div class="qc-article-actions">'+link(pages.matches,'查看竞彩足球 ›')+'</div></div>';
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
 return pageHead('竞彩足球','竞彩足球','按日期查看赛程与比赛信息。')+
 '<div id="matchDates">'+dateChips(activeDate,false)+'</div>'+
 '<div class="section-top"><h2 id="fixtureDayTitle">'+enc(dayLabel(activeDate))+' · 比赛安排</h2><span class="text-muted" id="fixtureTotal">'+nfmt(day?day.rows.length:0)+'场比赛</span></div>'+
 '<div id="matchFilters">'+filters(day)+'</div>'+
 '<div id="matchGrid" class="fixture-grid">'+matchListHtml()+'</div>'+
 '';
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
 return pageHead('赛后回看','赛后回看','查看已完赛比赛的赛前选择与实际结果。')+
 '<div id="reviewDates">'+dateChips(reviewDate,true)+'</div>'+
 '<div class="qc-review-meta"><span><b id="resultCount">'+st.rows.length+'</b>场已完赛</span>'+
 '<span><b id="goalCount">'+st.total+'</b>个总进球</span>'+
 '<span><b id="drawCount">'+st.draws+'</b>场平局</span></div>'+
 '<section class="qc-timeline-panel"><div class="qc-timeline-head"><div><span class="qc-section-index">↗</span>'+
 '<h2 id="reviewLabel">'+enc(dayLabel(reviewDate))+' · 全部赛果</h2></div></div>'+
 reviewLegend()+'<div id="reviewList" class="full-review">'+reviewListHtml(st.rows)+'</div></section>';
}
function reviewListHtml(rows){
 return overviewRows(rows);
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
 return blocks+'';
}
function overviewTab(r){
 return '<div class="info-grid"><div class="info-item"><small>比赛日期</small><b>'+enc(dayLabel(r.date))+'</b></div>'+
 '<div class="info-item"><small>开赛时间</small><b>'+enc(r.time)+'</b></div>'+
 '<div class="info-item"><small>赛事</small><b>'+enc(r.league)+'</b></div>'+
 '<div class="info-item"><small>比赛状态</small><b>'+enc(r.ft?'已结束':'未完赛')+'</b></div>'+
 '<div class="info-item"><small>半场比分</small><b>'+enc(r.ht||'—')+'</b></div>'+
 '<div class="info-item"><small>全场比分</small><b>'+enc(r.ft||'—')+'</b></div></div>'+
 '';
}

function detailTabHtml(r){
 if(detailTab==='markets')return detailMarkets(r);
 if(detailTab==='predictions')return '<h3 class="qc-detail-section-title">赛前判断与赛后结果</h3>'+
 '<p class="qc-detail-intro">'+(r.ft?'以下是赛后各项核对结果。':'比赛结束后显示赛后结果。')+'</p>'+
 comparisonGrid(r,true)+(!r.ft?'<div class="qc-tip">赛果确认后更新。</div>':'');
 if(detailTab==='analysis')return lockedContent(r.ft?'完赛比分和结果已收录，文字解读暂未更新。':'本场赛前资料可在其他栏目查看。');
 return overviewTab(r);
}
function renderDetail(){
 var id=new URLSearchParams(location.search).get('id');
 var r=byId.get(id);
 if(r)visit(r.id);
 if(!r)return pageHead('赛事详情','赛事未找到','请选择想查看的比赛。')+
 '<div class="panel"><div class="empty">没有找到对应的比赛记录。'+link(pages.matches,'返回全部赛程')+'</div></div>';
 var back=pages.matches+'?date='+encodeURIComponent(r.businessDate);
 var tabs=[['predictions','赛前判断'],['overview','比赛概览'],['markets','竞彩玩法'],['analysis','赛事分析']];
 return '<div class="path">'+link(pages.home,'球场档案')+' / '+link(back,'全部赛程')+' / 赛事详情</div>'+
 '<div class="pagehead"><div><h1>赛事详情</h1><p>'+enc(r.league)+' · '+enc(r.number)+' · '+enc(dayLabel(r.date))+'</p></div>'+
 '<div class="page-actions">'+favoriteButton(r)+link(back,'← 返回赛程')+'</div></div>'+
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
 '<section class="panel">'+panelHead('关注赛事','我的关注')+
 '<div style="padding:0 14px 16px">'+favoriteButton(r)+'</div></section></aside></div>';
}

var savedKey='qc_next_ui_favorites_v1',seenKey='qc_next_ui_seen_v1',fallbackSaved=[],fallbackSeen=[];
function safeList(key,fallback){
 try{
  var a=JSON.parse(localStorage.getItem(key)||'null');
  return Array.isArray(a)?a.filter(function(id){return typeof id==='string'&&byId.has(id);}).slice(0,35):fallback;
 }catch(_){return fallback;}
}
function storeList(key,a){try{localStorage.setItem(key,JSON.stringify(a.slice(0,35)));}catch(_){}}
function favorites(){return safeList(savedKey,fallbackSaved);}
function recentViews(){return safeList(seenKey,fallbackSeen);}
function visit(id){
 if(!byId.has(id))return;
 fallbackSeen=[id].concat(recentViews().filter(function(x){return x!==id;})).slice(0,20);
 storeList(seenKey,fallbackSeen);
}
function toggleFavorite(id){
 if(!byId.has(id))return;
 var old=favorites();
 fallbackSaved=(old.includes(id)?old.filter(function(x){return x!==id;}):[id].concat(old)).slice(0,35);
 storeList(savedKey,fallbackSaved);
}
function favoriteButton(r){
 var on=favorites().includes(r.id);
 return '<button type="button" class="qc-favorite'+(on?' active':'')+'" data-favorite="'+enc(r.id)+'" aria-pressed="'+(on?'true':'false')+'">'+(on?'★ 已关注':'☆ 关注比赛')+'</button>';
}
function profileMatch(r){
 return '<div class="qc-profile-match"><div><small>'+enc(r.league)+' · '+enc(dayLabel(r.date))+' '+enc(r.time)+'</small>'+
 '<strong>'+enc(r.home)+' <em>'+enc(score(r))+'</em> '+enc(r.away)+'</strong></div>'+
 '<div class="qc-profile-match-actions">'+link(matchUrl(r),'详情 ›')+favoriteButton(r)+'</div></div>';
}
function renderProfile(){
 var saved=favorites().map(function(id){return byId.get(id);}).filter(Boolean);
 var seen=recentViews().map(function(id){return byId.get(id);}).filter(Boolean);
 return pageHead('个人中心','个人中心','你关注的赛事和最近看过的比赛。')+
 '<div class="qc-profile-hero"><div class="qc-profile-avatar">档</div><div><small>我的球场档案</small><strong>我的赛事</strong><p>收藏喜欢的比赛，随时回看。</p></div></div>'+
 '<div class="qc-profile-stats"><div><small>关注比赛</small><b>'+saved.length+'</b></div><div><small>最近浏览</small><b>'+seen.length+'</b></div><div><small>已完赛关注</small><b>'+saved.filter(function(x){return !!x.ft;}).length+'</b></div></div>'+
 '<section class="qc-timeline-panel"><div class="qc-timeline-head"><div><span class="qc-section-index">★</span><h2>我的关注</h2>'+
 '<small>'+saved.length+'场</small></div>'+link(pages.matches,'发现比赛 ›')+'</div>'+
 (saved.length?'<div class="qc-profile-list">'+saved.map(profileMatch).join('')+'</div>':
 '<div class="qc-profile-empty"><strong>还没有关注的比赛</strong><p>浏览竞彩足球，点击☆就能收藏比赛。</p>'+
 link(pages.matches,'前往竞彩足球 ›','class="qc-profile-cta"')+'</div>')+'</section>'+
 '<section class="qc-timeline-panel"><div class="qc-timeline-head"><div><span class="qc-section-index">◷</span>'+
 '<h2>最近浏览</h2></div></div>'+
 (seen.length?'<div class="qc-profile-list">'+seen.slice(0,8).map(profileMatch).join('')+'</div>':
 '<div class="qc-profile-empty"><strong>暂无浏览记录</strong><p>打开赛事详情后会显示在这里。</p></div>')+'</section>'+
 '<div class="qc-profile-note">关注记录仅保存在当前设备，不会同步至正式网站账户。</div>';
}

function render(){
 var page=pageName();
 navMark(page==='detail'?'matches':page);
 var html=page==='home'?renderHome():page==='matches'?renderMatches():page==='profile'?renderProfile():renderDetail();
 root.innerHTML=html;
 var labels={home:'今日速览',matches:'竞彩足球',profile:'个人中心',detail:'赛事详情'};
 document.title='球场档案｜'+labels[page];
 var headerDate=$('headerDate');if(headerDate)headerDate.textContent=dayLabel(focusDay);
}
function navigate(url){
 history.pushState(null,'',url.pathname+url.search+url.hash);
 if(pageName()==='detail')detailTab='predictions';
 if(pageName()==='matches')searchTerm='';
 render();if(url.hash==='#review'){var x=document.getElementById('review');if(x&&x.scrollIntoView)x.scrollIntoView({block:'start'});}else window.scrollTo({top:0,behavior:'auto'});
}
document.addEventListener('click',function(e){
 var button=e.target.closest('button[data-favorite]');
 if(button){toggleFavorite(button.dataset.favorite);render();return;}
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
window.addEventListener('popstate',function(){detailTab='predictions';render();});
render();
})();