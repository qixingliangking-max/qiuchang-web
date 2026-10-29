// Read-only production browser latency audit. No credentials or DB writes.
const {chromium,webkit,devices}=require('playwright');
const fs=require('fs');
const BASE='https://qcda.cn';
const audit={testedAt:new Date().toISOString(),base:BASE,mode:'Guest; GitHub runner to live site; fresh browser contexts; browser-based user interactions',results:[],routes:[]};
const limit=10000;
const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function trackStep(out,name,action,verify){
  const before=Date.now();
  try{
    await action();
    if(verify) await verify();
    const ms=Date.now()-before;
    // Performance is a requirement, not a best-effort notice. Budgets are
    // deliberately generous for an external GitHub runner and cold browsers.
    const budgetMs=name==='first-content-visible'?3000:
      name.startsWith('date-')?3000:
      name.startsWith('detail-tab-')?1500:
      name==='same-day-match-switch'?2500:5000;
    out.steps.push(ms<=budgetMs?{name,ms,ok:true,budgetMs}:
      {name,ms,ok:false,budgetMs,error:'Performance budget exceeded'});
  }catch(e){
    out.steps.push({name,ms:Date.now()-before,ok:false,error:String(e).slice(0,240)});
  }
}
async function nonempty(page,selector){
  await page.locator(selector).first().waitFor({state:'visible',timeout:limit});
}
async function waitFor(page,predicate,arg){
  await page.waitForFunction(predicate,arg,{timeout:limit});
}
async function checkPanel(page){
  await waitFor(page,()=>{const p=document.querySelector('#jcMainPanel');return p && p.textContent?.trim() && !p.querySelector('.jc-match-spinner')&&!/正在加载中/.test(p.textContent)},null);
}
async function clickTab(page,out,tab){
  const selector='button[data-main-tab="'+tab+'"]';
  await trackStep(out,'detail-tab-'+tab,()=>page.locator(selector).click(),async()=>{
    await waitFor(page,tab=>{
      const button=document.querySelector('button[data-main-tab="'+tab+'"]');
      const panel=document.querySelector('#jcMainPanel');
      return button?.classList.contains('active') && panel &&
        panel.textContent?.trim() && !panel.querySelector('.jc-match-spinner');
    },tab);
  });
}
async function auditEngine(engine){
 const browser=await engine.type.launch({headless:true});
 try{
   for(const surface of ['overview','football']){
     const ctx=await browser.newContext({...engine.device,locale:'zh-CN'});
     const page=await ctx.newPage(),out={engine:engine.name,surface,steps:[],exceptions:[],failedRequests:[],resourceCount:0,apiRequests:0,imageRequests:0,missingLogos:0};
     const firstTime=Date.now();
     page.on('pageerror',e=>out.exceptions.push(String(e).slice(0,250)));
     page.on('requestfailed',r=>out.failedRequests.push({url:r.url().split('?')[0].slice(0,125),why:r.failure()?.errorText?.slice(0,100)}));
     page.on('request',r=>{out.resourceCount++;if(r.url().includes('supabase.co/rest/'))out.apiRequests++;if(r.resourceType()==='image')out.imageRequests++});
     const target=surface==='overview' ? '/index.html?date='+today : '/football.html?date='+today;
     try{
       const nav=await page.goto(BASE+target,{waitUntil:'domcontentloaded',timeout:30000});
       out.http=nav?.status();
       out.domContentLoadedMs=Date.now()-firstTime;
       await trackStep(out,'first-content-visible',async()=>{
         if(surface==='overview'){
           await nonempty(page,'#jcLiveCards .qc-premium-gate');
           await nonempty(page,'#jcYesterdayCards');
         }else{
           await waitFor(page,()=>document.querySelectorAll('#jcFootballCards .jc-football-card').length>0,null);
         }
       });
       out.firstContentMs=Date.now()-firstTime;
       out.firstRowCount=await page.locator(surface==='overview'?'#jcYesterdayCards .jc-overview-row':'#jcFootballCards .jc-football-card').count();
       const perf=await page.evaluate(()=>{
         const n=performance.getEntriesByType('navigation')[0];
         const es=performance.getEntriesByType('resource');
         return {ttfbMs:Math.round(n?.responseStart||0),dclMs:Math.round(n?.domContentLoadedEventEnd||0),jsTransfer:(es.filter(e=>e.name.includes('/app.js')).map(e=>({durationMs:Math.round(e.duration),transferSize:e.transferSize}))),staticResources:es.filter(e=>e.name.includes('/data/overview/')).length};
       });
       out.performance=perf;
       if(surface==='overview'){
         await trackStep(out,'date-today-to-yesterday',()=>page.locator('#jcPrevDate').click(),
           async()=>waitFor(page,day=>new URL(location.href).searchParams.get('date')===day,yesterday));
         out.reviewCountAfterPrevious=await page.locator('#jcYesterdayCards .jc-overview-row').count();
         await trackStep(out,'date-yesterday-to-today',()=>page.locator('#jcNextDate').click(),
           async()=>waitFor(page,day=>new URL(location.href).searchParams.get('date')===day,today));
         await trackStep(out,'click-match-from-overview',async()=>{
            await page.locator('#jcYesterdayCards .jc-review-match').first().click();
         },async()=>{await nonempty(page,'#jcMatchDetailRoot .detail-head');await checkPanel(page);});
       }else{
         await trackStep(out,'date-today-to-yesterday',()=>page.locator('#jcFootballPrevDate').click(),
           async()=>waitFor(page,day=>new URL(location.href).searchParams.get('date')===day,yesterday));
         out.rowsAfterPrevious=await page.locator('#jcFootballCards .jc-football-card').count();
         await trackStep(out,'date-yesterday-to-today',()=>page.locator('#jcFootballNextDate').click(),
           async()=>waitFor(page,day=>new URL(location.href).searchParams.get('date')===day,today));
         out.dateHasOpeningMessage=(await page.locator('#jcFootballDateLabel').innerText()).includes('打开中');
         await trackStep(out,'click-match-from-football',()=>page.locator('#jcFootballCards a.jc-card-link').first().click(),async()=>{await nonempty(page,'#jcMatchDetailRoot .detail-head');await checkPanel(page);});
       }
       if(page.url().includes('/jc-match.html')){
         await clickTab(page,out,'odds');
         await clickTab(page,out,'facts');
         await clickTab(page,out,'ai');
         const switcher=page.locator('.jc-detail-match-item').filter({visible:true});
         const n=await switcher.count();
         out.detailMatchSwitcherCount=n;
         if(n>=2){
           await trackStep(out,'same-day-match-switch',async()=>{
             const current=new URL(page.url()).searchParams.get('id');
             const next=page.locator('.jc-detail-match-item').filter({visible:true}).filter({hasNot:page.locator('.active')});
             const ids=await page.locator('.jc-detail-match-item').evaluateAll(els=>els.map(e=>({href:e.getAttribute('href'),active:e.classList.contains('active')})));
             const item=ids.find(x=>!x.active && x.href && !x.href.includes('id='+current));
             if(!item) throw Error('No other match in navigation');
             await page.locator('.jc-detail-match-item[href="'+item.href+'"]').first().click();
           },async()=>{await nonempty(page,'#jcMatchDetailRoot .detail-head');await checkPanel(page);});
         }
       }
       out.missingLogos=await page.locator('img.jc-team-logo, img.jc-detail-team-logo').evaluateAll(imgs=>imgs.filter(i=>i.complete && i.naturalWidth===0).length);
     }catch(error){out.fatal=String(error).slice(0,320)}
     audit.results.push(out);
     console.log('QCDA_SITE_PERF_RESULT='+JSON.stringify(out));
     await ctx.close();
   }
 }finally{await browser.close();}
}
// A complete guest-route sweep runs on the same production hostname.
// No credentials are used; admin/model record pages are checked for public
// first paint and proper guest handling, never for privileged internals.
async function auditRoutes(engine){
 const browser=await engine.type.launch({headless:true});
 const checks=[
  ['/index.html','#jcLiveCards'],
  ['/football.html','#jcFootballCards'],
  ['/league.html','#leagueRecordRoot'],
  ['/login.html','#loginForm'],
  ['/register.html','#registerForm'],
  ['/forgot-password.html','#forgotPasswordForm'],
  ['/profile.html','#profileRoot'],
  ['/admin.html','#adminRoot'],
  ['/model-record-test.html','#modelRecordRoot'],
  ['/internal-test/curated-lab-20261019.html','body'],
  ['/jc-match.html?id=a6a30f57-c061-425e-bcb4-428c34c4e7de','#jcMatchDetailRoot'],
  ['/privacy.html','body'],
  ['/terms.html','body']
 ];
 try{
  for(const [route,selector] of checks){
   const ctx=await browser.newContext({...engine.device,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
   const page=await ctx.newPage();
   const errors=[];let requests=0,api=0;
   page.on('pageerror',error=>errors.push(String(error).slice(0,160)));
   page.on('request',request=>{
    requests++;
    if(request.url().includes('.supabase.co/rest/'))api++;
   });
   const t0=Date.now(),row={device:engine.name,route,selector};
   try{
    const response=await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:20000});
    row.domMs=Date.now()-t0;
    row.status=response?.status();
    row.finalPath=new URL(page.url()).pathname;
    // Admin/profile guests may be redirected to /login.html asynchronously.
    const waitSelector=page.url().includes('/login.html')?'#loginForm':selector;
    await page.locator(waitSelector).first().waitFor({state:'visible',timeout:7000});
    row.firstVisibleMs=Date.now()-t0;
    row.ok=row.status===200;
    // Structural page checks are strict, loading time is monitored separately.
    if(row.firstVisibleMs>5000)row.performanceWarning='first useful element >5s';
   }catch(error){
    row.ok=false;row.error=String(error).slice(0,250);
   }
   row.requests=requests;row.api=api;row.jsErrors=errors.slice(0,3);
   audit.routes.push(row);
   console.log('QCDA_ROUTE_PERF='+JSON.stringify(row));
   await ctx.close();
  }
 }finally{await browser.close();}
}

(async()=>{
 for(const e of [
  {name:'desktop-chrome',type:chromium,device:{viewport:{width:1360,height:900}}},
  {name:'android-chromium',type:chromium,device:devices['Pixel 7']},
  {name:'iphone-webkit',type:webkit,device:devices['iPhone 13']}
 ]) {
   await auditEngine(e);
   await auditRoutes(e);
 }
 fs.mkdirSync('.github/reports',{recursive:true});
 fs.writeFileSync('.github/reports/production-perf-20261019.json',JSON.stringify(audit,null,2)+'\n');
 console.log('QCDA_PERF_SUMMARY='+JSON.stringify({at:audit.testedAt,results:audit.results.map(x=>({device:x.engine,surface:x.surface,dom:x.domContentLoadedMs,first:x.firstContentMs,steps:x.steps,errors:x.exceptions.length,failed:x.failedRequests.length,api:x.apiRequests,static:x.performance?.staticResources}))}));
 console.log('QCDA_ROUTE_SUMMARY='+JSON.stringify({
   count:audit.routes.length,failed:audit.routes.filter(r=>!r.ok),
   slow:audit.routes.filter(r=>r.performanceWarning)
 }));
 const failures=audit.results.filter(x=>x.fatal || x.steps.some(s=>!s.ok));
 if(audit.routes.some(r=>!r.ok || r.performanceWarning || r.jsErrors.length))
   process.exitCode=1;
 if(failures.length){
   console.error('QCDA_PERF_FAILURES '+JSON.stringify(failures.map(x=>({
     device:x.engine,surface:x.surface,fatal:x.fatal,failedSteps:x.steps.filter(s=>!s.ok)
   }))));
   process.exitCode=1;
 }
})().catch(e=>{console.error(e);process.exitCode=1});
