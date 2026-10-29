'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const entry=fs.readFileSync(path.join(root,'league-entry.js'),'utf8');
const archive=fs.readFileSync(path.join(root,'league-archive-snapshot-v2.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'league.html'),'utf8');

function boot({session=null,isPro=false,lateSession=false,latePro=false}={}){
  let resolveSession,resolvePro,authCb;
  const requested=[],counters={session:0,rpc:0};
  const timerFns=[];
  const elements={};
  for(const id of ['leagueRecordRoot','menuBtn','drawerBackdrop',
   'navLogin','navProfile','navLogout','desktopLogin','desktopAccount','desktopLogout']){
    elements['#'+id]={hidden:false,style:{},innerHTML:'',classList:{add(){},remove(){}}};
  }
  const leagueLinks=[{hidden:false,style:{}},{hidden:false,style:{}}];
  const document={
    getElementById(id){return elements['#'+id]||null;},
    querySelector(sel){return elements[sel]||null;},
    querySelectorAll(sel){return sel==='[data-qc-member-nav="league"]'?leagueLinks:[];},
    body:{appendChild(el){
      requested.push(el.src);
      Promise.resolve().then(()=>el.onload());
    }},
    createElement(){return {src:'',onload:null,onerror:null};}
  };
  const sdk={
    auth:{
      onAuthStateChange(cb){authCb=cb;return {data:{subscription:{unsubscribe(){}}}};},
      getSession(){counters.session++;
        if(lateSession)return new Promise(resolve=>{resolveSession=resolve;});
        return Promise.resolve({data:{session},error:null});
      },
      signOut(){authCb('SIGNED_OUT',null);return Promise.resolve({error:null});}
    },
    rpc(name){
      assert.equal(name,'has_active_pro_access');counters.rpc++;
      if(latePro)return new Promise(resolve=>{resolvePro=resolve;});
      return Promise.resolve({data:isPro,error:null});
    }
  };
  const ctx={document,window:{qcSupabase:sdk},location:{href:'https://qcda.cn/league.html'},
    Promise,URLSearchParams,encodeURIComponent,
    setTimeout(fn){timerFns.push(fn);return timerFns.length;},
    clearTimeout(){},console:{warn(){}}};
  vm.runInNewContext(entry,ctx,{timeout:2000});
  return {ctx,root:elements['#leagueRecordRoot'],links:leagueLinks,
    requested,counters,timerFns,
    releaseSession:val=>resolveSession?.({data:{session:val},error:null}),
    releasePro:val=>resolvePro?.({data:val,error:null}),
    signOut:()=>authCb('SIGNED_OUT',null),
    async settle(){for(let i=0;i<18;i++) await Promise.resolve();}
  };
}
test('guest gets instant login gate and NEVER loads archive, P2 or P3',async()=>{
 const h=boot();await h.settle();
 assert.match(h.root.innerHTML,/请先登录/);
 assert.equal(h.counters.session,1);assert.equal(h.counters.rpc,0);
 assert.equal(h.requested.length,0);
 assert.ok(h.links.every(x=>x.hidden));
 assert.equal(h.ctx.window.qcLeagueVerifiedAccess(),false);
});
test('ordinary signed-in user sees Pro rights explanation, no archive scripts',async()=>{
 const h=boot({session:{user:{id:'ordinary'}},isPro:false});await h.settle();
 assert.match(h.root.innerHTML,/Pro会员专享/);
 assert.equal(h.counters.rpc,1);assert.equal(h.requested.length,0);
 assert.ok(h.links.every(x=>!x.hidden));
});
test('server-verified Pro alone loads P3 helpers and archive in sequence',async()=>{
 const h=boot({session:{user:{id:'pro'}},isPro:true});await h.settle();
 assert.equal(h.counters.rpc,1);
 assert.equal(h.requested.length,2);
 assert.match(h.requested[0],/^league-p3-public\.js/);
 assert.match(h.requested[1],/^league-archive-snapshot-v2\.js/);
 assert.equal(h.ctx.window.qcLeagueVerifiedAccess(),true);
 assert.ok(h.links.every(x=>!x.hidden));
});
test('slow session shows login guidance without blocking eventual member reveal',async()=>{
 const h=boot({lateSession:true,isPro:false});await h.settle();
 for(const fn of h.timerFns)fn();
 assert.match(h.root.innerHTML,/请先登录/);
 assert.equal(h.requested.length,0);
 h.releaseSession({user:{id:'late-basic'}});await h.settle();
 assert.match(h.root.innerHTML,/Pro会员专享/);
 assert.ok(h.links.every(x=>!x.hidden));
});
test('sign out while Pro RPC is in-flight cancels protected script loading',async()=>{
 const h=boot({session:{user:{id:'pro'}},latePro:true});
 await h.settle();assert.equal(h.counters.rpc,1);
 h.signOut();h.releasePro(true);await h.settle();
 assert.equal(h.requested.length,0);
 assert.match(h.root.innerHTML,/请先登录/);
 assert.equal(h.ctx.window.qcLeagueVerifiedAccess(),false);
});
test('league HTML only includes lightweight auth dependencies',()=>{
 const scripts=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(x=>x[1]);
 assert.ok(scripts.some(x=>x.includes('league-entry.js')));
 for(const forbidden of ['app.js','data.js','catalog.js','league-p3-public.js','league-archive-snapshot-v2.js']){
   assert.ok(!scripts.some(x=>x.startsWith(forbidden)||x.includes('/'+forbidden)),forbidden);
 }
 assert.match(html,/正在确认登录状态/);
 assert.match(archive,/document\.readyState==='loading'/);
 assert.match(archive,/qcLeagueVerifiedAccess/);
 assert.match(archive,/if\(managed && !window\.qcLeagueVerifiedAccess/);
});
test('all customer-facing links default hidden; shared session reveals them',()=>{
 for(const file of ['index.html','football.html','jc-match.html','profile.html','league.html']){
   const source=fs.readFileSync(path.join(root,file),'utf8');
   const links=[...source.matchAll(/<a[^>]*href="league\.html"[^>]*>联赛档案<\/a>/g)];
   assert.ok(links.length>0,file);
   assert.match(source,/id="qcMemberNavGuestGuard"/,file);
   assert.match(source,/a\[data-qc-member-nav="league"\]\[hidden\]\{display:none!important\}/,file);
   assert.ok(links.every(x=>x[0].includes('data-qc-member-nav="league"')&&
     x[0].includes('hidden')&&x[0].includes('display:none')),file);
 }
 assert.ok(app.includes("const leagueLinks=[...document.querySelectorAll('[data-qc-member-nav=\"league\"]')]"));
 assert.match(app,/link\.hidden=!loggedIn/);
});
