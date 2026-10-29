'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const publisher=fs.readFileSync(path.join(root,'scripts/cache_static_team_logos.py'),'utf8');
const catalog=fs.readFileSync(path.join(root,'assets/team-logos/catalog.js'),'utf8');
const start=app.indexOf('const qcTeamLogoCache=new Map();');
const end=app.indexOf('function jcLogoImgHtml(',start);
assert.ok(start>0&&end>start,'logo resolver code found');

function run(rows,staticTeam={}){
 let rpc=0;
 const ctx=vm.createContext({
  window:{
   QC_TEAM_LOGO_CATALOG:{by_team:staticTeam,by_source:{}},
   qcSupabase:{rpc(){rpc++;return Promise.resolve({data:[{input_name:'未知',logo_url:'https://images.fotmob.com/image_resources/logo/teamlogo/9841.png'}],error:null});}}
  },console:{warn(){}},Map,Promise,String,Set,Array,encodeURIComponent
 });
 vm.runInContext(app.slice(start,end),ctx);
 return vm.runInContext('jcAttachTeamLogos(rows)',Object.assign(ctx,{rows})).then(result=>({rows:result,rpc}));
}

test('published complete current schedule uses static URLs and zero RPCs',async()=>{
 const rows=[{home_team_name:'雷克斯汉姆',away_team_name:'尼斯',
 _homeLogoUrl:'assets/team-logos/fotmob-9841.png',
 _awayLogoUrl:'assets/team-logos/fotmob-9831.png',
 _qcStaticLiveSchedule:true}];
 const out=await run(rows,{'雷克斯汉姆':'assets/team-logos/fotmob-9841.png','尼斯':'assets/team-logos/fotmob-9831.png'});
 assert.equal(out.rpc,0);
 assert.equal(out.rows[0]._homeLogoUrl,'assets/team-logos/fotmob-9841.png');
});
test('frozen FINAL never sends team-logo resolver RPC even for legacy empty logo',async()=>{
 const rows=[{home_team_name:'历史球队',away_team_name:'旧队',
 _homeLogoUrl:'',_awayLogoUrl:'',_jcFrozenOverview:true}];
 const r=await run(rows);
 assert.equal(r.rpc,0);
});
test('truly unpublished new fixtures still retain resolver fallback',async()=>{
 const rows=[{home_team_name:'未知',away_team_name:'尼斯',_homeLogoUrl:'',
 _awayLogoUrl:'assets/team-logos/fotmob-9831.png'}];
 const out=await run(rows,{'尼斯':'assets/team-logos/fotmob-9831.png'});
 assert.equal(out.rpc,1);
});
test('published football cards omit extra deferred DOM crest patch',()=>{
 assert.match(app,/const embeddedLogosReady=rows\.every/);
 assert.match(app,/const logosReady=embeddedLogosReady\s*\?\s*Promise\.resolve\(\)/);
 assert.match(app,/m\._qcStaticLiveSchedule \|\| m\._jcFrozenOverview/);
});
test('canonical source for previously missing Wrexham uses verified FotMob team id',()=>{
 assert.match(publisher,/"雷克斯汉姆": "https:\/\/images\.fotmob\.com\/image_resources\/logo\/teamlogo\/9841\.png"/);
 assert.match(publisher,/complete_prekick_crests\(row, by_team, now\)/);
 assert.match(publisher,/assert_prekick_crests_complete\(rows, by_team, now, ds\)/);
 assert.match(publisher,/audit_published_live_crests\(\)/);
 assert.match(catalog,/window\.QC_TEAM_LOGO_CATALOG=/);
});
test('static crest generation never touches private model fields',()=>{
 assert.doesNotMatch(publisher,/service_role|auth\.admin|insert into|jc_model_outputs/);
 assert.match(publisher,/PUBLIC data only/);
});
