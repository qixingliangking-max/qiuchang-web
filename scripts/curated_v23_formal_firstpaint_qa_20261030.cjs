'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),test=require('node:test');
const root=path.join(__dirname,'..','internal-test');
const loader=fs.readFileSync(path.join(root,'curated-db-direct-20261022.js'),'utf8');
const app=fs.readFileSync(path.join(root,'curated-lab-20261019.js'),'utf8');
const html=fs.readFileSync(path.join(root,'curated-lab-20261019.html'),'utf8');
test('first paint waits for live data without showing embedded legacy cards',()=>{
 assert.match(loader,/window\.QC_CURATED_DB_READY=loadDay\(initialDay\)/);
 assert.match(loader,/var initialDay=businessDay\(\)/);
 assert.match(html,/<body class="curated-booting">/);
 assert.match(html,/body\.curated-booting #plans/);
 assert.match(app,/document\.body\.classList\.remove\('curated-booting'\)/);
});
test('all 12 formal submitted groups are allowed and public management text is absent',()=>{
 assert.match(loader,/day==='2026-10-30'\)return loadV23PreviewDay\(day\)/);
 assert.match(loader,/var raw=await rpc\('qc_v2_public'/);
 assert.match(loader,/p\.settlement_status!=='void'/);
 assert.match(loader,/o\.source==='LOCKED_FINAL'/);
 assert.match(loader,/plans\.length!==4/);
 assert.match(loader,/categories!=='direction,goals,htft,score'/);
 assert.match(app,/QCDA_V23_CURATED_FORMAL/);
 for(const forbidden of ['V2.3正式精选','三组正式方案','旧版方案已作废','锁板赛事','12场独立评估']){
   assert.equal(app.includes(forbidden),false,forbidden+' must not be visible to site visitors');
 }
 assert.match(html,/curated-db-direct-20261022\.js\?v=20261030fourmarket1/);
 assert.match(html,/curated-lab-20261019\.js\?v=20261030fourmarket1/);
 for(const label of ['胜平负','半全场','总进球','比分'])
   assert.match(html,new RegExp('<strong>'+label+'</strong><span>精选方案</span>'));
});
test('each of four tabs contains one card from every analyst',()=>{
 const a=app.indexOf('function plansFor(day,type){'),b=app.indexOf('function planLegs(plan){',a);
 assert.ok(a>0&&b>a);
 const types=['direction','htft','goals','score'];
 const mk=(analyst,type)=>({id:analyst+'-'+type,type,legs:[{market:type==='direction'?'had':type==='htft'?'hafu':type==='goals'?'ttg':'crs',row:{num:'周五005'},picks:[{name:'胜',key:'h'}]}]});
 const data={rule:'QCDA_V23_CURATED_FORMAL',
 entries:types.map(type=>mk('guheng',type)),
 aiSelector:{entries:types.map(type=>mk('shence',type))},
 analystSelector:{entries:types.map(type=>mk('luye',type))}};
 const context={db:{selectedPlans:{'2026-10-30':data}},state:{reveal:false},
  blind:null,settled:null,score:()=>null,option:(row,m,k,name)=>({key:k,name,market:m,odds:2})};
 vm.createContext(context);vm.runInContext(app.slice(a,b),context);
 for(const type of types){
  const shown=context.plansFor('2026-10-30',type);
  assert.equal(shown.length,3,type);
  assert.deepEqual(Array.from(shown,x=>x.index),[1,2,3],type);
 }
});
