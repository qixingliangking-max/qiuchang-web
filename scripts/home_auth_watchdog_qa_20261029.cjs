'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const anchor='/* Fail-closed homepage auth watchdog:';
const start=html.indexOf(anchor);
const end=html.indexOf('</script>',start);
assert.ok(start>0 && end>start,'HTML watchdog must be independent of deferred scripts');
const source=html.slice(start,end);

function run({token=false,handoff=false,sdk=false}={}){
 const tasks=[],links=[],button={onclick:null};
 const cards={
  dataset:{},innerHTML:'<div role="status">正在确认登录状态…</div>',
  get textContent(){return this.innerHTML.replace(/<[^>]+>/g,'');},
  querySelector(q){return q==='#qcRetryMemberStatus'?button:null;}
 };
 const meta={textContent:'正在确认登录状态…'};
 const win={qcSupabase:sdk?{}:undefined,setTimeout(fn,ms){tasks.push({fn,ms});return tasks.length;}};
 const loc={pathname:'/index.html',search:'',hash:'',reloaded:false,reload(){this.reloaded=true;}};
 const env={
  window:win,document:{getElementById(id){return id==='jcLiveCards'?cards:id==='jcPredictionMeta'?meta:null;}},
  location:loc,Date,encodeURIComponent,
  localStorage:{getItem(key){if(key==='qc-auto-login')return '1';if(key.startsWith('sb-'))return token?'fake-test-cache':null;return null;}},
  sessionStorage:{getItem(key){return key==='qc-auth-handoff'&&handoff?String(Date.now()):null;}}
 };
 vm.runInNewContext(source,env);
 const deadline=tasks.find(t=>t.ms===3000);
 assert.ok(deadline,'the independent watchdog must always be scheduled');
 return {cards,meta,win,button,loc,fire:()=>deadline.fn()};
}

test('genuine guest immediately sees login gate; watchdog does not override it',()=>{
 const x=run();
 assert.match(x.cards.innerHTML,/登录后查看今日预测/);
 assert.doesNotMatch(x.cards.innerHTML,/正在确认登录状态/);
 x.fire();
 assert.equal(x.win.qcHomeAuthWatchdogTriggered,undefined);
});

test('saved iPhone session gets immediate recoverable status, not indefinite spinner',()=>{
 const x=run({token:true});
 assert.match(x.cards.innerHTML,/正在恢复会员会话/);
 x.fire();
 assert.match(x.cards.innerHTML,/会员状态尚未确认/);
 assert.match(x.cards.innerHTML,/重新验证/);
 assert.match(x.cards.innerHTML,/前往登录/);
 assert.equal(x.win.qcHomeAuthWatchdogTriggered,true);
 assert.equal(x.win.qcHomeAuthWatchdogReason,'sdk_not_ready');
});

test('login handoff also recovers from deferred SDK never loading',()=>{
 const x=run({handoff:true});
 assert.match(x.cards.innerHTML,/正在恢复会员会话/);
 x.fire();
 assert.equal(x.win.qcHomeAuthWatchdogTriggered,true);
 assert.equal(x.meta.textContent,'会员状态尚未确认');
});

test('SDK present but early auth primer missing reports accurate client stage',()=>{
 const x=run({token:true,sdk:true});
 x.fire();
 assert.equal(x.win.qcHomeAuthWatchdogReason,'prime_not_started');
});

test('an already verified membership is never replaced by fallback',()=>{
 const x=run({token:true,sdk:true});
 x.cards.innerHTML='<div>会员已验证，正在载入今日赛事…</div>';
 x.fire();
 assert.equal(x.win.qcHomeAuthWatchdogTriggered,undefined);
});

test('regular app renderer owns the container and is never overwritten',()=>{
 const x=run({token:true});
 x.cards.dataset.qcAuthPaintReady='1';
 x.fire();
 assert.equal(x.win.qcHomeAuthWatchdogTriggered,undefined);
});

test('fallback retry uses in-place app recovery when available',()=>{
 const x=run({token:true});
 let calls=0;
 x.cards.__qcRetryMemberAccess=()=>{calls++};
 x.fire();x.button.onclick();
 assert.equal(calls,1);
 assert.equal(x.loc.reloaded,false);
});

test('fallback retry is never inert before app initializes',()=>{
 const x=run({token:true});
 x.fire();x.button.onclick();
 assert.equal(x.loc.reloaded,true);
});

test('12 live pages share exactly the same versioned app cache URL',()=>{
 const pages=['index.html','football.html','league.html','jc-match.html',
  'profile.html','register.html','forgot-password.html','reset-password.html',
  'verify.html','match.html','model-record-test.html','league-archive-preview.html'];
 for(const name of pages){
  const page=fs.readFileSync(path.join(root,name),'utf8');
  assert.match(page,/app\.js\?v=20261029authwatchdog4/,name);
  assert.doesNotMatch(page,/app\.js\?v=20261029homeslim3/,name);
 }
});

test('safety: fail-closed guest/watchdog contains no protected model or report data',()=>{
 assert.doesNotMatch(source,/jc_model_outputs|qc_get_overview_bootstrap|jc_ai_analysis/);
 assert.match(app,/return Boolean\(access\?\.loggedIn && access\?\.isPro\)/);
 assert.match(app,/has_active_pro_access/);
 assert.match(app,/正在恢复会员会话\|会员状态尚未确认/);
});
