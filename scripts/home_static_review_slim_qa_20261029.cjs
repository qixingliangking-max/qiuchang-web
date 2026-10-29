'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const begin=app.indexOf('  const candidatePreviousDate=qcAddDays(candidateDate,-1);');
const end=app.indexOf('  // A detail link already has its PUBLIC fixture identity',begin);
assert.ok(begin>0 && end>begin,'embedded history guard is present');
const snippet=app.slice(begin,end);

async function simulate({requested='2026-10-29',today='2026-10-29',embedDate='2026-10-28',count=17,rendered=17}={}){
 let archiveRequests=0;
 const rootElement={
  dataset:{qcFinalDate:embedDate,qcFinalCount:String(count)},
  querySelectorAll(){return Array.from({length:rendered},()=>({}));}
 };
 const ctx={
  candidateDate:requested,today,reviewCards:rootElement,Promise,Number,
  qcAddDays(ds,delta){
   const d=new Date(ds+'T12:00:00+08:00');d.setUTCDate(d.getUTCDate()+delta);
   return d.toISOString().slice(0,10);
  },
  qcFetchHistoryOverviewDate(){archiveRequests++;
   return Promise.resolve({data:[{id:'archive'}],historyFinal:true});}
 };
 const result=await vm.runInNewContext('(async()=>{'+snippet+
  'return {bakedYesterdayReady,previous:await candidatePreviousPromise};})()',ctx);
 return {archiveRequests,baked:result.bakedYesterdayReady,previous:result.previous};
}

test('embedded 17/17 complete FINAL keeps existing HTML and sends no archive request',async()=>{
 const result=await simulate();
 assert.equal(result.archiveRequests,0);
 assert.equal(result.baked,true);
 assert.equal(result.previous.embeddedInHtml,true);
 assert.equal(result.previous.matchCount,17);
});

test('outdated embedded HTML (day rollover) falls back to real history request',async()=>{
 const result=await simulate({today:'2026-10-30',requested:'2026-10-30'});
 assert.equal(result.archiveRequests,1);
 assert.equal(result.baked,false);
});

test('partial embedded HTML never masquerades as complete archive',async()=>{
 const result=await simulate({rendered:16});
 assert.equal(result.archiveRequests,1);
 assert.equal(result.baked,false);
});

test('selected historical date does not reuse the baked review',async()=>{
 const result=await simulate({requested:'2026-10-28'});
 assert.equal(result.archiveRequests,1);
 assert.equal(result.baked,false);
});

test('initial render and Pro upgrade preserve HTML before any background history update',()=>{
 assert.match(app,/const previousReadyPromise=\(bakedYesterdayReady && initialDate===today/);
 assert.match(app,/let previousHistoryFinal=Boolean\(previousResult\?\.historyFinal\) \|\| bakedYesterdayReady/);
 assert.match(app,/if\(reviewCards && !previousLoading && !preserveEmbeddedReview\)/);
 assert.match(app,/result\?\.embeddedInHtml\) return/);
 assert.match(app,/if\(!\(bakedYesterdayReady && ds===today && prevDate===candidatePreviousDate\)\)/);
 assert.doesNotMatch(app,/^\s*qcLoadFrozenOverviewManifest\(\);/m);
 assert.match(app,/if\(access\.verificationPending\)\{/);
 assert.match(app,/return Boolean\(access\?\.loggedIn && access\?\.isPro\)/);
});

test('homepage removes only three redundant script tags, retains safe real data readers',()=>{
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(scripts.length,9);
 for(const removed of ['data.js','overview-static-first.js','overview-schedule-snapshot.js']){
  assert.ok(!scripts.some(src=>src===removed||src.startsWith(removed+'?')),removed);
 }
 for(const required of ['assets/vendor/supabase-js','supabase-client.js','home-auth-prime.js',
  'assets/team-logos/catalog.js','overview-live-static.js','app.js','overview-bootstrap.js',
  'overview-public-rescue.js']){
  assert.ok(scripts.some(src=>src.includes(required)),required);
 }
 assert.match(html,/data-qc-final-date="2026-10-28" data-qc-final-count="17"/);
 assert.match(html,/app\.js\?v=20261029leaguegate1/);
 assert.doesNotMatch(html,/src="[^"]*admin-home\.js/);
});
