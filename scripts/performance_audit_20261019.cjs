// Read-only production browser latency audit. No credentials or DB writes.
const {chromium,webkit,devices}=require('playwright');
const fs=require('fs');
const BASE='https://qcda.cn';
const audit={testedAt:new Date().toISOString(),base:BASE,mode:'Guest; GitHub runner to live site; fresh browser contexts; browser-based user interactions',results:[]};
const limit=18000;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function trackStep(out,name,action,verify){
  const before=Date.now();
  try{
    await action();
    if(verify) await verify();
    out.steps.push({name,ms:Date.now()-before,ok:true});
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
     const target=surface==='overview' ? '/index.html?date=2026-10-19' : '/football.html?date=2026-10-19';
     try{
       const nav=await page.goto(BASE+target,{waitUntil:'domcontentloaded',timeout:30000});
       out.http=nav?.status();
       out.domContentLoadedMs=Date.now()-firstTime;
       await trackStep(out,'first-content-visible',async()=>{
         if(surface==='overview'){
           await nonempty(page,'#jcYesterdayCards .jc-overview-row');
           await waitFor(page,()=>/10-18.*[0-9]+场/.test(document.querySelector('#jcYesterdayMeta')?.textContent||''),null);
         }else{
           await waitFor(page,()=>document.querySelectorAll('#jcFootballCards .jc-football-card').length===8,null);
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
         const firstDate='2026-10-18';
         await trackStep(out,'date-19-to-18',()=>page.locator('#jcPrevDate').click(),async()=>waitFor(page,()=>/10月18日/.test(document.querySelector('#jcDateLabel')?.textContent||''),null));
         out.reviewCountAfterPrevious=await page.locator('#jcYesterdayCards .jc-overview-row').count();
         await trackStep(out,'date-18-to-19',()=>page.locator('#jcNextDate').click(),async()=>waitFor(page,()=>/10月19日/.test(document.querySelector('#jcDateLabel')?.textContent||''),null));
         await trackStep(out,'click-match-from-overview',async()=>{
            await page.locator('#jcYesterdayCards .jc-review-match').first().click();
         },async()=>{await nonempty(page,'#jcMatchDetailRoot .detail-head');await checkPanel(page);});
       }else{
         await trackStep(out,'date-19-to-18',()=>page.locator('#jcFootballPrevDate').click(),async()=>waitFor(page,()=>/10.18/.test(document.querySelector('#jcFootballDateLabel')?.textContent||'') && document.querySelectorAll('#jcFootballCards .jc-football-card').length>=21,null));
         out.rowsAfterPrevious=await page.locator('#jcFootballCards .jc-football-card').count();
         await trackStep(out,'date-18-to-19',()=>page.locator('#jcFootballNextDate').click(),async()=>waitFor(page,()=>/10.19/.test(document.querySelector('#jcFootballDateLabel')?.textContent||'') && document.querySelectorAll('#jcFootballCards .jc-football-card').length===8,null));
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
(async()=>{
 for(const e of [
  {name:'android-chromium',type:chromium,device:devices['Pixel 7']},
  {name:'iphone-webkit',type:webkit,device:devices['iPhone 13']}
 ])await auditEngine(e);
 fs.mkdirSync('.github/reports',{recursive:true});
 fs.writeFileSync('.github/reports/production-perf-20261019.json',JSON.stringify(audit,null,2)+'\n');
 console.log('QCDA_PERF_SUMMARY='+JSON.stringify({at:audit.testedAt,results:audit.results.map(x=>({device:x.engine,surface:x.surface,dom:x.domContentLoadedMs,first:x.firstContentMs,steps:x.steps,errors:x.exceptions.length,failed:x.failedRequests.length,api:x.apiRequests,static:x.performance?.staticResources}))}));
 const failures=audit.results.filter(x=>x.fatal || x.steps.some(s=>!s.ok));
 if(failures.length)console.warn('QCDA_PERF_WARNINGS '+JSON.stringify(failures.map(x=>({device:x.engine,surface:x.surface,fatal:x.fatal,failedSteps:x.steps.filter(s=>!s.ok)}))));
})().catch(e=>{console.error(e);process.exitCode=1});
