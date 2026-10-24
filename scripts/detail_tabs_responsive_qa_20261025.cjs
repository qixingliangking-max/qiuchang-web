'use strict';
const {chromium,webkit,devices}=require('playwright');
const match='06ce3c9d-a44a-413c-b96a-a3b28091ed21';
const cases=[
  {name:'desktop-Chrome',engine:chromium,options:{viewport:{width:1360,height:850}}},
  {name:'iPhone-WebKit',engine:webkit,options:devices['iPhone 13']},
  {name:'Android-Chrome',engine:chromium,options:devices['Pixel 7']}
];
(async()=>{
 const results=[];
 for(const spec of cases){
  const b=await spec.engine.launch();
  try{
   // The session check intentionally never resolves. Public 赛况/赔率
   // must remain clickable, while protected AI must NOT be shown.
   const ctx=await b.newContext({...spec.options,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
   await ctx.addInitScript((match)=>{
     // Complete, publicly settled fixture handoff: no match-row RPC is needed
     // to render the header or bind tabs during a stalled auth recovery.
     const fixture={
       id:match,match_num:'周五001',business_date:'2026-10-23',
       league_short_name:'澳超',home_team_name:'布里斯班狮',
       away_team_name:'珀斯光荣',match_date:'2026-10-23',
       match_time:'17:00',kickoff_at:'2026-10-23T09:00:00+00:00',
       match_status:'已结束',
       raw:{sectionsNo999:'2:1',sectionsNo1:'2:0',matchStatusName:'已结束'}
     };
     sessionStorage.setItem('qc-football-detail-nav-v1',JSON.stringify({
       savedAt:Date.now(),businessDate:fixture.business_date,match:fixture,
       day:[Object.fromEntries(Object.entries(fixture).filter(([k])=>k!=='raw'))]
     }));
     Object.defineProperty(window,'qcSupabase',{
       configurable:true,
       get(){return window.__qaClient;},
       set(client){
         window.__qaClient=client;
         client.auth.getSession=()=>new Promise(()=>{});
         window.__qaSlowAuthInstalled=true;
       }
     });
   },match);
   const page=await ctx.newPage();
   const jsErrors=[];
   page.on('pageerror',e=>jsErrors.push(e.message));
   const url='https://qcda.cn/jc-match.html?id='+match;
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   if(response.status()!==200)throw Error('HTTP '+response.status());
   await page.locator('#jcMatchDetailRoot .jc-main-tabs').waitFor({state:'visible',timeout:22000});
   const auth=await page.evaluate(()=>window.__qaSlowAuthInstalled===true);
   if(!auth)throw Error('Did not patch intentionally delayed auth check');
   await page.locator('[data-main-tab="facts"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-main-tab="facts"]')?.classList.contains('active'),null,{timeout:2500});
   const factsStarted=await page.locator('#jcMainPanel').innerText();
   await page.waitForFunction(()=>!!document.querySelector('#jcMainPanel .jc-facts-subtabs'),null,{timeout:2500});
   await page.locator('[data-main-tab="odds"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-main-tab="odds"]')?.classList.contains('active'),null,{timeout:2500});
   const oddsFeedback=await page.locator('#jcMainPanel').innerText();
   if(!oddsFeedback.includes('赔率记录读取中'))throw Error('No immediate loading feedback for odds');
   await page.locator('[data-main-tab="ai"]').click();
   const aiPending=await page.locator('#jcMainPanel').innerText();
   if(!aiPending.includes('正在验证访问权限')||
      /模型方向|TOP3比分/.test(aiPending))
     throw Error('Protected AI displayed without verified session');
   const first={browser:spec.name,unresolvedAuth:true,factsPanelReady:true,oddsPanelReady:true,
     factsClickedWhileAuthHung:!!factsStarted,oddsPendingWhileAuthHung:true,oddsFeedback:oddsFeedback.slice(0,45),
     aiUnverified:aiPending.slice(0,100),jsErrors};
   if(jsErrors.length)throw Error('JS errors '+JSON.stringify(jsErrors));
   results.push(first);
   await ctx.close();
   // Standard guest should settle to logged-out gate with tabs still working.
   const ctx2=await b.newContext({...spec.options,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
   const p2=await ctx2.newPage(),errors=[];
   p2.on('pageerror',e=>errors.push(e.message));
   await p2.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await p2.locator('#jcMainPanel').getByText('登录',{exact:false}).first().waitFor({timeout:22000});
   await p2.locator('[data-main-tab="facts"]').click();
   await p2.waitForFunction(()=>!!document.querySelector('#jcMainPanel .jc-facts-subtabs'),null,{timeout:20000});
   await p2.locator('[data-main-tab="ai"]').click();
   const text=await p2.locator('#jcMainPanel').innerText();
   if(!text.includes('登录')||errors.length)throw Error('Guest gate regression '+spec.name+' '+JSON.stringify(errors));
   results.push({browser:spec.name,normalGuest:true,aiProtected:true,factsAllowed:true,jsErrors:errors});
   await ctx2.close();
  }finally{await b.close();}
 }
 console.log('QCDA_DETAIL_TABS_QA='+JSON.stringify(results));
 if(results.length!==6)throw Error('6 test cases required');
})().catch(e=>{console.error(e.stack||String(e));process.exit(1)});
