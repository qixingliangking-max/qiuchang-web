'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),test=require('node:test');
const base=path.join(__dirname,'..','internal-test');
const loader=fs.readFileSync(path.join(base,'curated-db-direct-20261022.js'),'utf8');
const page=fs.readFileSync(path.join(base,'curated-lab-20261019.js'),'utf8');
const html=fs.readFileSync(path.join(base,'curated-lab-20261019.html'),'utf8');
test('first paint waits for the current date live source instead of legacy static plans',()=>{
 assert.match(loader,/Object\.keys\(db\.selectedPlans\|\|\{\}\)\.forEach/);
 assert.match(loader,/window\.QC_CURATED_DB_READY=loadDay\(businessDay\(\)\)/);
 assert.doesNotMatch(loader,/window\.QC_CURATED_DB_READY=Promise\.resolve\(\)/);
 assert.match(loader,/day==='2026-10-30'\)return loadV23PreviewDay\(day\)/);
 assert.match(loader,/qc_v23_curated_public/);
});
test('the HTML forces both scripts to use new versioned cache references',()=>{
 assert.match(html,/curated-db-direct-20261022\.js\?v=20261030v23firstpaint1/);
 assert.match(html,/curated-lab-20261019\.js\?v=20261030v23firstpaint1/);
});
test('V2.3 results are labeled independent previews and never represented as historical settled plans',()=>{
 assert.match(page,/plan\.preview\)return personaPlan\(plan\.index\)\+' · V2\.3独立精选'/);
 assert.match(page,/preview:!!record\.preview/);
 assert.match(page,/pack&&pack\.preview/);
 assert.match(page,/尚未作为模拟账户正式出单/);
 const start=page.indexOf('function plansFor(day,type){');
 const end=page.indexOf('function planLegs(plan){',start);
 assert.ok(start>0&&end>start,'plan function found');
 const ctx={db:{selectedPlans:{
   '2026-10-30':{preview:true,entries:[{id:'v23-g',type:'direction',preview:true,legs:[
    {market:'had',row:{num:'006'},picks:[{key:'h',name:'胜'}]},
    {market:'had',row:{num:'009'},picks:[{key:'h',name:'胜'}]}]}],
    aiSelector:{entries:[{id:'v23-s',type:'htft',preview:true,legs:[
     {market:'hafu',row:{num:'005'},picks:[{key:'hh',name:'胜/胜'},{key:'dh',name:'平/胜'}]}]}]},
    analystSelector:{entries:[{id:'v23-l',type:'htft',preview:true,legs:[
     {market:'hafu',row:{num:'009'},picks:[{key:'hh',name:'胜/胜'},{key:'dh',name:'平/胜'}]}]}]}}
 }},blind:null,settled:null,state:{reveal:false},
 option:(row,market,key,label)=>({key,name:label,market,odds:2}),
 score:()=>null};
 vm.createContext(ctx);
 vm.runInContext(page.slice(start,end),ctx);
 const direction=ctx.plansFor('2026-10-30','direction');
 const htft=ctx.plansFor('2026-10-30','htft');
 assert.equal(direction.length,1);
 assert.equal(htft.length,2);
 assert.equal(direction[0].preview,true);
 assert.equal(htft[0].preview,true);
 assert.equal(direction[0].index,1);
 assert.equal(htft[0].index,2);
 assert.equal(htft[1].index,3);
});
