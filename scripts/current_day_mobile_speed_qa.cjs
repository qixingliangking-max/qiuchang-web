'use strict';
// Read-only browser timing benchmark on CURRENT Beijing date, never stale fixture dates.
const {chromium,webkit,devices}=require('playwright');
const fs=require('node:fs');
const BASE='https://qcda.cn';
const beijingDate=()=>{
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
 return [parts.year,parts.month,parts.day].join('-');
};
const day=beijingDate();
const stages=[
 {name:'home',path:'/index.html?date='+day,content:()=>!!document.querySelector('#jcLiveCards .qc-premium-gate') || !!document.querySelector('#jcLiveCards .jc-overview-row')},
 {name:'football',path:'/football.html?date='+day,content:()=>!!document.querySelector('#jcFootballCards .jc-football-card') || !!document.querySelector('#jcFootballCards .qc-premium-gate')},
 {name:'login',path:'/login.html',content:()=>!!document.querySelector('#loginForm button[type="submit"]')}
];
const data={createdAt:new Date().toISOString(),businessDate:day,base:BASE,disclaimer:'Browser times measured from GitHub runner, not a real user mobile network.',results:[]};
async function runSpec(name,engine,device){
 const browser=await engine.launch({headless:true});
 try{
  const ctx=await browser.newContext({...device,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  for(const stage of stages){
   const page=await ctx.newPage(),failed=[],consoleErrors=[];
   page.on('pageerror',e=>consoleErrors.push(String(e).slice(0,160)));
   page.on('requestfailed',req=>failed.push({url:req.url().split('?')[0].slice(0,150),reason:req.failure()?.errorText}));
   const first=Date.now();
   let navigated=null,firstVisibleMs=null,success=false,performanceInfo=null,error=null;
   try{
    navigated=await page.goto(BASE+stage.path,{waitUntil:'domcontentloaded',timeout:25000});
    await page.waitForFunction(stage.content,null,{timeout:12000});
    firstVisibleMs=Date.now()-first;success=true;
    performanceInfo=await page.evaluate(()=>{
      const nav=performance.getEntriesByType('navigation')[0];
      const rs=performance.getEntriesByType('resource');
      return {
        ttfbMs:Math.round(nav?.responseStart||0),
        dclMs:Math.round(nav?.domContentLoadedEventEnd||0),
        requestCount:rs.length,
        supabaseRequests:rs.filter(r=>r.name.includes('.supabase.co')).length,
        jsRequests:rs.filter(r=>r.name.endsWith('.js')||r.name.includes('.js?')).length,
        appJSRequested:rs.some(r=>r.name.includes('/app.js')),
        loginFastRequested:rs.some(r=>r.name.includes('/login-fast.js')),
        transferredKB:Math.round(rs.reduce((n,r)=>n+(r.transferSize||0),0)/1024)
      };
    });
   }catch(e){error=String(e).slice(0,260)}
   data.results.push({name,stage:stage.name,http:navigated?.status()||null,firstVisibleMs,success,perf:performanceInfo,failed:failed.slice(0,8),pageErrors:consoleErrors.slice(0,5),error});
   console.log('QCDA_CURRENT_PERF_RESULT='+JSON.stringify(data.results.at(-1)));
   await page.close();
  }
  await ctx.close();
 }finally{await browser.close();}
}
(async()=>{
 await runSpec('android-chromium',chromium,devices['Pixel 7']);
 await runSpec('iphone-webkit',webkit,devices['iPhone 13']);
 fs.mkdirSync('.github/reports',{recursive:true});
 fs.writeFileSync('.github/reports/current-day-mobile-speed.json',JSON.stringify(data,null,2)+'\n');
 const failures=data.results.filter(x=>!x.success||x.http!==200||x.pageErrors.length);
 console.log('QCDA_CURRENT_PERF_SUMMARY='+JSON.stringify({date:day,results:data.results.map(x=>({device:x.name,page:x.stage,ms:x.firstVisibleMs,requests:x.perf?.requestCount,kb:x.perf?.transferredKB,success:x.success,http:x.http,jsErrors:x.pageErrors.length}))}));
 if(failures.length){console.error('QCDA_CURRENT_PERF_FAILURES='+JSON.stringify(failures));process.exitCode=1}
})().catch(e=>{console.error(e);process.exitCode=1});
