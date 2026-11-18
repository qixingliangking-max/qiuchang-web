(function(){
'use strict';
const source=window.QC_NEXT_UI_PREVIEW,root=document.getElementById('mainView');
if(!source||!Array.isArray(source.days)||!root)return;
const days=source.days,records=days.flatMap(d=>d.rows.map(r=>Object.assign({saleDay:d.day},r)));
const index=new Map(records.map(r=>[String(r.id),r]));
const pages={home:'site-next-ui-20261119.html',matches:'site-next-ui-20261119-matches.html',profile:'site-next-ui-20261119-profile.html',detail:'site-next-ui-20261119-detail.html'};
const models=new Map(),reports=new Map();
let user=null,profile=null,subscription=null,checked=false,homeDay=source.demoDate||days[days.length-1].day,matchDay=homeDay,league='全部',term='',detailTab='picks';
const $=id=>document.getElementById(id);
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=x=>/^\d{4}-\d\d-\d\d$/.test(x||'')?(Number(x.slice(5,7))+'月'+Number(x.slice(8))+'日'):(x||'—');
const dayList=()=>days.map(d=>d.day);
const rows=d=>records.filter(r=>r.saleDay===d).sort((a,b)=>String(a.number).localeCompare(String(b.number),'zh-CN',{numeric:true}));
const route=()=>Object.keys(pages).find(k=>pages[k]===location.pathname.split('/').pop())||'home';
const anchor=(href,content,cls)=>'<a data-ui-link href="'+esc(href)+'"'+(cls?' class="'+cls+'"':'')+'>'+content+'</a>';
const matchHref=r=>pages.detail+'?id='+encodeURIComponent(r.id);
const model=r=>models.get(String(r.id));
const review=(r,key)=>r.ft&&r.review&&typeof r.review[key]==='boolean'?r.review[key]:null;
function mark(v){return v===true?'<i class="hit-mark yes" title="命中">✓</i>':v===false?'<i class="hit-mark no" title="未命中">×</i>':'';}
function pick(r,key){
 const m=model(r);if(!m)return '';
 if(key==='direction')return m.direction||'';
 if(key==='handicap')return m.handicap_direction||'';
 if(key==='single')return m.single_pick||'';
 if(key==='htft')return [m.htft_top1,m.htft_top2].filter(Boolean).join(' / ');
 if(key==='goals')return m.goal_range||'';
 if(key==='score')return Array.isArray(m.top_scores)?m.top_scores.join(' / '):'';
 return '';
}
function pickHtml(r,key){
 const choice=pick(r,key);
 return '<span class="prediction-choice">'+(choice?'<span>'+esc(choice.replace(/[｜|]/g,' / '))+'</span>':'<span class="placeholder">—</span>')+mark(review(r,key))+'</span>';
}
function crest(url){const u=String(url||'');
 if(!/^\.\.\/assets\/[A-Za-z0-9/_\-.]+$/.test(u)&&!/^https:\/\/(images\.fotmob\.com|a\.espncdn\.com)\//.test(u))return '<span class="crest">⚽</span>';
 return '<span class="crest"><img src="'+esc(u)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()"></span>';
}
function pair(r){return '<span class="pair"><span class="team">'+esc(r.home)+'</span><span class="center"><b>'+esc(r.ft||'VS')+'</b><small>'+
 (r.ht?'半 '+esc(r.ht):(r.ft?'已完赛':'未完赛'))+'</small></span><span class="team">'+esc(r.away)+'</span></span>';}
function pageHeader(title,subtitle,right){return '<div class="page-head"><div><h1>'+esc(title)+'</h1>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</div>'+(right||'')+'</div>';}
function sectHead(title,desc){return '<div class="panel-header"><div><i class="section-mark"></i><h2>'+title+'</h2>'+(desc?'<p>'+esc(desc)+'</p>':'')+'</div></div>';}
function sect(title,desc,content){return '<section class="panel">'+sectHead(title,desc)+content+'</section>';}
function resultTable(list){
 if(!list.length)return '<div class="blank">暂无已确认的赛事记录</div>';
 return '<div class="table-scroll"><table class="overview-table"><thead><tr><th>编号</th><th>时间</th><th>赛事</th><th>主队 比分 客队</th><th>胜平负／让球</th><th>总进球</th><th>半全场</th></tr></thead><tbody>'+
 list.map(r=>'<tr data-match="'+esc(r.id)+'" tabindex="0"><td class="no">'+esc(String(r.number).replace(/^周[一二三四五六日天]/,''))+'</td>'+
 '<td>'+esc(r.time||'—')+'</td><td><span class="league-tag">'+esc(r.league)+'</span></td>'+
 '<td>'+anchor(matchHref(r),pair(r))+'</td><td>'+pickHtml(r,'direction')+'</td>'+
 '<td>'+pickHtml(r,'goals')+'</td><td>'+pickHtml(r,'htft')+'</td></tr>').join('')+'</tbody></table></div>';
}
function dateArrows(){const pos=dayList().indexOf(homeDay);
 return '<div class="date-switch"><button data-step="-1" type="button" aria-label="前一天"'+(pos<=0?' disabled':'')+'>‹</button><strong>'+
 esc(dateText(homeDay))+'</strong><button type="button" data-step="1" aria-label="后一天"'+(pos===days.length-1?' disabled':'')+'>›</button>'+
 (homeDay!==source.demoDate?'<button type="button" class="date-today" data-today>回到今日</button>':'')+'</div>';
}
function renderHome(){
 const pos=dayList().indexOf(homeDay),previous=days[pos-1],previousRows=previous?rows(previous.day).filter(r=>r.ft):[];
 const past=days.filter(d=>d.day<homeDay&&d.rows.some(r=>r.ft)).slice(-1)[0];
 const view=previousRows.length?previousRows:past?rows(past.day).filter(r=>r.ft):[];
 const date=previousRows.length?previous.day:past?past.day:'';
 const note=previous&&!previousRows.length?'<div class="tip-line">前一日比赛尚未全部回收，以下显示最近已确认赛果。</div>':'';
 const today=rows(homeDay);
 return pageHeader('今日速览','赛前信息与赛后结果',dateArrows())+
 '<div id="review">'+sect('昨日回看',dateText(date)+' · '+view.length+'场完赛',note+resultTable(view))+'</div>'+
 sect(homeDay===source.demoDate?'今日预测':'当日预测',dateText(homeDay)+' · '+today.length+'场比赛',resultTable(today));
}
function dayPicker(){return '<div class="day-picker">'+days.map(d=>'<button type="button" class="'+(d.day===matchDay?'active':'')+'" data-day="'+d.day+'">'+dateText(d.day)+'</button>').join('')+'</div>';}
function filtered(){return rows(matchDay).filter(r=>(league==='全部'||r.league===league)&&(!term||(r.home+' '+r.away+' '+r.league+' '+r.number).toLowerCase().includes(term)));}
function filters(){let options=['全部',...new Set(rows(matchDay).map(r=>r.league))];if(!options.includes(league))league='全部';
 return '<div class="filters"><div class="leagues">'+options.map(v=>'<button type="button" data-league="'+esc(v)+'" class="'+(v===league?'active':'')+'">'+esc(v)+'</button>').join('')+
 '</div><input id="matchSearch" class="search-input" type="search" placeholder="搜索球队、赛事" aria-label="搜索球队" autocomplete="off" value="'+esc(term)+'"></div>';
}
function oddRows(r){
 const m=r.markets||{};function row(label,pool){const v=pool&&pool.outcomes||{};
 return '<div class="odds-row"><span class="play-tag">'+esc(label)+'</span>'+
 ['h','d','a'].map(k=>'<b>'+esc(v[k]??'—')+'</b>').join('')+'</div>';}
 return '<div class="odds-table"><div class="odds-row head"><span>玩法</span><span>主胜</span><span>平局</span><span>客胜</span></div>'+
 row('胜平负',m.had)+row('让球胜平负 '+(m.hhad&&m.hhad.line||''),m.hhad)+'</div>';
}
function matchCard(r){
 return '<article class="match-card"><div class="card-top"><span>'+esc(r.league)+' · <b>'+esc(r.number)+'</b></span><span>'+esc(dateText(r.date))+' '+esc(r.time)+'</span></div>'+
 anchor(matchHref(r),'<div class="card-match"><div class="card-team">'+crest(r.homeLogo)+'<b>'+esc(r.home)+'</b></div>'+
 '<div class="card-score">'+esc(r.ft||'VS')+'<small>'+(r.ht?'半场 '+esc(r.ht):r.ft?'已完赛':'未开赛')+'</small></div>'+
 '<div class="card-team">'+crest(r.awayLogo)+'<b>'+esc(r.away)+'</b></div></div>')+
 oddRows(r)+'<div class="card-actions"><span>'+(model(r)?'赛前判断已收录':'赛事信息')+'</span>'+
 anchor(matchHref(r),'全部玩法与赛事详情 ›')+'</div></article>';
}
function renderMatches(){
 const params=new URLSearchParams(location.search),d=params.get('date');if(d&&dayList().includes(d))matchDay=d;
 return pageHeader('竞彩足球','赛程、比分、竞彩全部玩法')+dayPicker()+
 '<div id="filterBox">'+filters()+'</div>'+
 '<div class="page-head" style="margin:0 0 10px"><p id="matchCount">'+dateText(matchDay)+' · '+filtered().length+'场比赛</p></div>'+
 '<div class="cards" id="cards">'+(filtered().length?filtered().map(matchCard).join(''):'<div class="panel blank">暂无比赛</div>')+'</div>';
}
function judgments(r){
 const fields=[['核心方向','direction'],['官方让球','handicap'],['单选倾向','single'],['半全场','htft'],['总进球','goals'],['参考比分','score']];
 return '<div class="judgment-grid">'+fields.map(item=>'<div class="judge-card"><small>'+item[0]+'</small><strong>'+
 (pick(r,item[1])?esc(pick(r,item[1])):'<span class="placeholder">—</span>')+mark(review(r,item[1]))+
 '</strong>'+(review(r,item[1])!==null?'<span class="mini-note">'+(review(r,item[1])?'命中':'未命中')+'</span>':'')+'</div>').join('')+'</div>';
}
function marketChips(pool,getLabel){if(!pool||!pool.outcomes)return '';
 return '<div class="score-market">'+Object.entries(pool.outcomes).sort((a,b)=>a[0].localeCompare(b[0])).map(item=>'<span>'+
 esc(getLabel(item[0]))+'　'+esc(item[1])+'</span>').join('')+'</div>';}
function allOdds(r){
 const d=r.markets||{};
 function market(title,p){const o=p&&p.outcomes||{};
 return '<section class="market-block"><h3>'+esc(title)+(p&&p.line?'　'+esc(p.line):'')+'</h3><div class="market-grid">'+
 [['h','主胜'],['d','平局'],['a','客胜']].map(it=>'<span><small>'+it[1]+'</small><b>'+esc(o[it[0]]??'—')+'</b></span>').join('')+'</div></section>';}
 let out=market('胜平负',d.had)+market('让球胜平负',d.hhad);
 if(d.ttg)out+='<section class="market-block"><h3>总进球</h3>'+marketChips(d.ttg,k=>/^s\d$/.test(k)?(k==='s7'?'7球及以上':k.slice(1)+'球'):k)+'</section>';
 if(d.hafu){const names={hh:'胜/胜',hd:'胜/平',ha:'胜/负',dh:'平/胜',dd:'平/平',da:'平/负',ah:'负/胜',ad:'负/平',aa:'负/负'};
 out+='<section class="market-block"><h3>半全场</h3>'+marketChips(d.hafu,k=>names[k]||k)+'</section>';}
 if(d.crs)out+='<section class="market-block"><h3>比分</h3>'+marketChips(d.crs,k=>{const m=k.match(/^s(\d\d)s(\d\d)$/);return m?(Number(m[1])+'-'+Number(m[2])):({ 's-1sh':'其他主胜','s-1sd':'其他平局','s-1sa':'其他客胜'}[k]||'其他比分');})+'</section>';
 return out;
}
function gameInfo(r){return '<div class="info-list">'+[['比赛编号',r.number],['赛事',r.league],['比赛日期',dateText(r.date)],['开赛时间',r.time],['半场比分',r.ht||'—'],['全场比分',r.ft||'—']].map(it=>
 '<div><span>'+esc(it[0])+'</span><b>'+esc(it[1])+'</b></div>').join('')+'</div>';}
function report(r){
 const data=reports.get(String(r.id));
 if(!data)return '<div class="blank">暂无可展示的赛事解读</div>';
 const names=[['赛事概览','summary'],['实力比较','strength_baseline'],['近期表现','recent_form'],['攻防特点','attack_defense'],['主客场','home_away'],['阵容情况','squad_integrity'],['历史交锋','h2h_analysis'],['市场变化','market_movement'],['比赛走势','match_path'],['综合观察','comprehensive_observation'],['风险提醒','risk_factors']];
 return names.filter(x=>data[x[1]]&&String(data[x[1]]).trim()).map(x=>'<section class="market-block"><h3>'+x[0]+'</h3><div class="detail-note" style="padding:12px">'+esc(data[x[1]])+'</div></section>').join('')||'<div class="blank">暂无可展示的赛事解读</div>';
}
function currentTab(r){return detailTab==='odds'?allOdds(r):detailTab==='facts'?gameInfo(r):detailTab==='report'?report(r):judgments(r);}
function renderDetail(){
 const r=index.get(new URLSearchParams(location.search).get('id'));if(!r)return pageHeader('赛事详情','')+'<div class="panel blank">没有找到这场比赛。'+anchor(pages.matches,'返回竞彩足球')+'</div>';
 const others=rows(r.saleDay);
 return '<div class="back">'+anchor(pages.matches+'?date='+encodeURIComponent(r.saleDay),'‹ 返回竞彩足球')+'</div>'+
 '<div class="detail-top"><div class="detail-meta"><span>'+esc(r.league)+' · '+esc(r.number)+'</span><span>'+esc(dateText(r.date))+' '+esc(r.time)+'</span></div>'+
 '<div class="detail-score"><div class="detail-team">'+crest(r.homeLogo)+'<b>'+esc(r.home)+'</b></div>'+
 '<div class="detail-center"><b>'+esc(r.ft||'VS')+'</b><small>'+(r.ht?'半场 '+esc(r.ht):r.ft?'已完赛':'未开赛')+'</small></div>'+
 '<div class="detail-team">'+crest(r.awayLogo)+'<b>'+esc(r.away)+'</b></div></div></div>'+
 '<div class="detail-columns"><div class="panel"><div class="tabline">'+[['picks','赛前判断'],['odds','全部玩法'],['facts','赛况数据'],['report','赛事解读']].map(t=>
 '<button data-tab="'+t[0]+'" type="button" class="'+(detailTab===t[0]?'active':'')+'">'+t[1]+'</button>').join('')+'</div>'+
 '<div class="tabbody" id="tabbody">'+currentTab(r)+'</div></div><div class="panel">'+sectHead('同期比赛',others.length+'场')+
 others.map(x=>anchor(matchHref(x),'<span>'+esc(x.home)+' - '+esc(x.away)+'</span><strong>'+esc(x.ft||'VS')+'</strong>','side-match'+(x.id===r.id?' active':''))).join('')+'</div></div>';
}
function row(label,value){return '<div class="profile-row"><span>'+label+'</span><strong>'+esc(value||'—')+'</strong></div>';}
function officialAction(title,desc,label){return '<div class="profile-action"><div><strong>'+title+'</strong><small>'+desc+'</small></div>'+anchor('../profile.html',label||'前往管理 ›')+'</div>';}
function profileCard(title,content){return '<div class="profile-card">'+sectHead(title,'')+'<div class="profile-content">'+content+'</div></div>';}
function expiryDate(x){if(!x)return '—';const d=new Date(x);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'});}
function renderProfile(){
 const role=profile&&profile.role==='admin'?'管理员':subscription?'Pro会员':user?'基础用户':'—';
 const name=profile&&profile.nickname||user&&user.email&&user.email.split('@')[0]||(checked?'访客':'正在读取…');
 const status=profile&&profile.status==='active'?'正常':profile&&profile.status?'已停用':user?'正在核验':'—';
 const exp=subscription?expiryDate(subscription.expires_at):profile&&profile.role==='admin'?'管理员权限':'—';
 const left=subscription?Math.max(0,Math.ceil((new Date(subscription.expires_at)-Date.now())/86400000)):null;
 const guest=!user?'<div class="tip-line">可以直接浏览页面；登录正式账户后可读取本人的账号资料与会员信息。'+anchor('../login.html','账号登录 ›')+'</div>':'';
 const identity=profileCard('基本信息',row('用户名',name)+row('邮箱',user&&user.email)+row('角色',role)+row('账号状态',status));
 const membership=profileCard('会员订阅','<div class="profile-membership"><strong>'+esc(role)+'</strong><small>'+
 (subscription?left+'天后到期':profile&&profile.role==='admin'?'拥有完整查看权限':'当前无有效会员订阅')+
 '</small></div>'+row('有效期至',exp)+'<details class="qr-wrap"><summary>联系客服开通或续费</summary>'+
 '<img src="../assets/contact-pro-qr.png" alt="官方客服二维码" loading="lazy"><p>扫码联系客服了解会员服务</p></details>'+
 officialAction('激活兑换码','兑换会员权益','前往兑换 ›'));
 const account=profileCard('账户管理',officialAction('修改昵称','更新账户显示名称','前往修改 ›')+
 officialAction('修改密码','管理账户安全','前往修改 ›'));
 const help=profileCard('账户服务',officialAction('联系客服','会员服务与账户帮助','了解更多 ›'));
 return pageHeader('个人中心','账户资料与会员服务')+guest+'<div class="profile-grid">'+
 '<div class="profile-top"><div class="profile-identity"><div class="avatar">档</div><div><small>我的球场档案</small><strong>'+esc(name)+'</strong></div></div>'+
 '<span class="membership-badge">'+esc(role)+'</span></div>'+identity+membership+account+help+'</div>';
}
function draw(){
 const p=route();document.querySelectorAll('[data-nav]').forEach(x=>{
 const active=x.dataset.nav===(p==='detail'?'matches':p);x.classList.toggle('active',active);
 if(active)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current');
 });
 root.innerHTML=p==='home'?renderHome():p==='matches'?renderMatches():p==='profile'?renderProfile():renderDetail();
 document.title='球场档案｜'+({home:'今日速览',matches:'竞彩足球',profile:'个人中心',detail:'赛事详情'})[p];
}
function go(url){
 history.pushState(null,'',url.pathname+url.search+url.hash);if(route()==='detail')detailTab='picks';
 if(route()==='matches'){const d=url.searchParams.get('date');if(d&&dayList().includes(d))matchDay=d;}
 draw();if(url.hash==='#review'){const n=$('review');if(n&&n.scrollIntoView)n.scrollIntoView({block:'start'});}else window.scrollTo({top:0,behavior:'auto'});
}
document.addEventListener('click',e=>{
 const a=e.target.closest('a[data-ui-link]');if(a){
 const url=new URL(a.href);if(url.origin===location.origin&&Object.values(pages).includes(url.pathname.split('/').pop())){e.preventDefault();go(url);return;}}
 const step=e.target.closest('[data-step]');if(step){const i=dayList().indexOf(homeDay)+Number(step.dataset.step);
 if(i>=0&&i<days.length){homeDay=days[i].day;history.replaceState(null,'',location.pathname+'?date='+homeDay);draw();}return;}
 if(e.target.closest('[data-today]')){homeDay=source.demoDate;history.replaceState(null,'',location.pathname);draw();return;}
 const date=e.target.closest('button[data-day]');if(date){matchDay=date.dataset.day;league='全部';term='';
 history.replaceState(null,'',location.pathname+'?date='+matchDay);draw();return;}
 const c=e.target.closest('button[data-league]');if(c){league=c.dataset.league;draw();return;}
 const t=e.target.closest('button[data-tab]');if(t){detailTab=t.dataset.tab;draw();return;}
 const tr=e.target.closest('tr[data-match]');if(tr&&!e.target.closest('a[href]')){const r=index.get(tr.dataset.match);if(r)go(new URL(matchHref(r),location.href));}
});
document.addEventListener('input',e=>{if(e.target.id==='matchSearch'){term=String(e.target.value||'').toLowerCase().trim();
 const target=$('cards');if(target)target.innerHTML=filtered().map(matchCard).join('')||'<div class="blank">没有符合条件的比赛</div>';
 const count=$('matchCount');if(count)count.textContent=dateText(matchDay)+' · '+filtered().length+'场比赛';}});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('tr[data-match]')){
 e.preventDefault();const r=index.get(e.target.dataset.match);if(r)go(new URL(matchHref(r),location.href));}});
window.addEventListener('popstate',()=>{detailTab='picks';const d=new URLSearchParams(location.search).get('date');
 if(route()==='home')homeDay=d&&dayList().includes(d)?d:source.demoDate;
 if(route()==='matches')matchDay=d&&dayList().includes(d)?d:source.demoDate;draw();});
async function loadReal(){
 const client=window.qcSupabase;if(!client||!client.auth)return;
 try{
 let session=null;try{session=await client.auth.getSession();}catch(_){}
 user=session&&session.data&&session.data.session&&session.data.session.user||null;checked=true;if(route()==='profile')draw();
 const ids=records.map(r=>r.id);
 const req=[
 client.from('jc_model_outputs').select('jc_match_id,stage,direction,handicap_direction,single_pick,htft_top1,htft_top2,goal_range,top_scores,is_locked,is_current').in('jc_match_id',ids).eq('is_locked',true).eq('is_current',true),
 client.from('jc_match_ai_analysis').select('jc_match_id,status,summary,strength_baseline,recent_form,attack_defense,home_away,squad_integrity,h2h_analysis,market_movement,match_path,comprehensive_observation,risk_factors').in('jc_match_id',ids).eq('status','ready')
 ];
 if(user){req.push(client.from('profiles').select('nickname,email,role,status').eq('id',user.id).maybeSingle());
 req.push(client.from('subscriptions').select('plan,expires_at,status').eq('user_id',user.id).eq('status','active').gt('expires_at',new Date().toISOString()).order('expires_at',{ascending:false}).limit(1));}
 const results=await Promise.allSettled(req);
 const m=results[0].status==='fulfilled'&&!results[0].value.error?results[0].value.data||[]:[];
 m.filter(r=>r.stage==='FINAL').forEach(r=>models.set(String(r.jc_match_id),r));
 const a=results[1].status==='fulfilled'&&!results[1].value.error?results[1].value.data||[]:[];
 a.forEach(r=>reports.set(String(r.jc_match_id),r));
 if(user){
 const p=results[2],s=results[3];
 if(p&&p.status==='fulfilled'&&!p.value.error)profile=p.value.data;
 if(s&&s.status==='fulfilled'&&!s.value.error)subscription=(s.value.data||[])[0]||null;
 }
 draw();
 }catch(_){checked=true;if(route()==='profile')draw();}
}
if(route()==='home'){const d=new URLSearchParams(location.search).get('date');if(d&&dayList().includes(d))homeDay=d;}
draw();loadReal();
})();