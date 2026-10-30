'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),test=require('node:test');
const root=path.join(__dirname,'..','internal-test');
const loader=fs.readFileSync(path.join(root,'curated-db-direct-20261022.js'),'utf8');
const app=fs.readFileSync(path.join(root,'curated-lab-20261019.js'),'utf8');
const html=fs.readFileSync(path.join(root,'curated-lab-20261019.html'),'utf8');
test('first paint waits for live data and preserves the boot overlay',()=>{
 assert.match(loader,/window\.QC_CURATED_DB_READY=loadDay\(initialDay\)/);
 assert.match(loader,/var initialDay=businessDay\(\)/);
 assert.doesNotMatch(loader,/QC_CURATED_DB_READY=Promise\.resolve\(\)/);
 assert.match(loader,/Object\.keys\(db\.selectedPlans\|\|\{\}\)\.forEach/);
 assert.match(html,/<body class="curated-booting">/);
 assert.match(html,/body\.curated-booting #plans/);
 assert.match(app,/document\.body\.classList\.remove\('curated-booting'\)/);
});
test('30 Oct uses only formally submitted V2.3 source-model plans',()=>{
 assert.match(loader,/day==='2026-10-30'\)return loadV23PreviewDay\(day\)/);
 assert.match(loader,/var raw=await rpc\('qc_v2_public'/);
 assert.match(loader,/p\.settlement_status!=='void'/);
 assert.match(loader,/o\.source==='LOCKED_FINAL'/);
 assert.match(loader,/plans\.length!==1/);
 assert.match(loader,/rule:'QCDA_V23_CURATED_FORMAL',preview:false/);
 assert.match(app,/QCDA_V23_CURATED_FORMAL/);
 assert.match(app,/V2\.3正式精选/);
 assert.match(app,/三组正式方案/);
 assert.match(html,/curated-db-direct-20261022\.js\?v=20261030v23formal2/);
 assert.match(html,/curated-lab-20261019\.js\?v=20261030v23formal2/);
});
test('three analysts retain independent identity and correct category placement',()=>{
 const a=app.indexOf('function plansFor(day,type){'),b=app.indexOf('function planLegs(plan){',a);
 assert.ok(a>0&&b>a);
 const mk=(name,type)=>({id:name,type,legs:[{market:type==='direction'?'had':'hafu',row:{num:'周五005'},picks:[{name:'胜',key:'h'}]}]});
 const context={db:{selectedPlans:{
 '2026-10-30':{rule:'QCDA_V23_CURATED_FORMAL',entries:[mk('guheng','direction')],
 aiSelector:{entries:[mk('shence','htft')]},analystSelector:{entries:[mk('luye','htft')]}}
 }},state:{reveal:false},blind:null,settled:null,score:()=>null,option:(row,m,k,name)=>({key:k,name,market:m,odds:2})};
 vm.createContext(context);vm.runInContext(app.slice(a,b),context);
 const d=context.plansFor('2026-10-30','direction'),h=context.plansFor('2026-10-30','htft');
 assert.equal(d.length,1);assert.equal(h.length,2);
 assert.equal(d[0].index,1);assert.equal(h[0].index,2);assert.equal(h[1].index,3);
});
