const {chromium,webkit,devices}=require('playwright');
const BASE='https://qcda.cn/';
const configs=[
 {name:'desktop-Chrome',engine:chromium,opts:{viewport:{width:1440,height:900}}},
 {name:'iPhone-WebKit',engine:webkit,opts:devices['iPhone 13']},
 {name:'Android-Chrome',engine:chromium,opts:devices['Pixel 7']}
];
(async()=>{
const report=[];
for(const c of configs){
 const browser=await c.engine.launch();
 const context=await browser.newContext({...c.opts,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
 for(const spec of [
  {page:'home',url:'index.html',ready:'#jcLiveCards .qc-premium-gate',dateButton:'#jcPrevDate',date:'#jcDateLabel'},
  {page:'football',url:'football.html',ready:'#jcFootballCards .jc-football-card',dateButton:'#jcFootballPrevDate',date:'#jcFootballDateLabel'},
  {page:'league',url:'league.html',ready:'#leagueRecordRoot .qc-league-gate'},
  {page:'login',url:'login.html?v=20261024authstable4',ready:'#loginForm button[type="submit"]'},
  {page:'profile',url:'profile.html',ready:'body'}
 ]){
  const page=await context.newPage();
  const errors=[],requestErrors=[],slow=[],pending=new Map();
  page.on('pageerror',e=>errors.push(String(e).slice(0,200)));
  page.on('request',r=>pending.set(r,{at:Date.now(),path:new URL(r.url()).pathname}));
  page.on('requestfinished',r=>{const v=pending.get(r);if(v)slow.push({path:v.path,ms:Date.now()-v.at});pending.delete(r)});
  page.on('requestfailed',r=>{requestErrors.push({path:r.url().split('?')[0],err:r.failure()?.errorText});pending.delete(r)});
  const t0=Date.now();let http=null,readyMs=null,clickMs=null,dateResult=null,menuMs=null,interaction=null,gate=null;
  try {
   const r=await page.goto(BASE+spec.url,{waitUntil:'domcontentloaded',timeout:45000});
   http=r?.status();
   const domMs=Date.now()-t0;
   if(spec.page==='profile') {
    await page.waitForURL(/\/(?:profile|login)\.html/,{timeout:15000});
    interaction={redirect:page.url().split('?')[0],body:(await page.locator('body').innerText()).slice(0,100)};
   } else {
    await page.locator(spec.ready).first().waitFor({state:'visible',timeout:15000});
    readyMs=Date.now()-t0;
   }
   if(spec.dateButton){
     const t=Date.now(); await page.locator(spec.dateButton).click({timeout:10000});
     await page.waitForFunction(selector=>document.querySelector(selector)?.getAttribute('aria-busy')!=='true',spec.date,{timeout:15000});
     clickMs=Date.now()-t;dateResult=await page.locator(spec.date).innerText();
   }
   if(spec.page==='home'||spec.page==='football'){
    if(await page.locator('#menuBtn').isVisible()){
     const t=Date.now();await page.locator('#menuBtn').click();
     await page.locator('#drawerBackdrop.open').waitFor({state:'visible',timeout:5000});menuMs=Date.now()-t;
     await page.locator('#drawerBackdrop').click({position:{x:4,y:4},force:true}).catch(()=>{});
    }
   }
   if(spec.page==='league'){
    gate=(await page.locator('#leagueRecordRoot').innerText()).slice(0,200);
    const links=await page.locator('#leagueRecordRoot a[href*="login.html"]').count();
    interaction={guestGateLinks:links};
   }
   if(spec.page==='login'){
    const email=page.locator('#loginEmail');
    const button=page.locator('#loginForm button[type="submit"]');
    await email.fill('audit@example.invalid');
    await page.locator('#loginPassword').fill('nonprivatepassword');
    await button.click({timeout:5000});
    interaction={hint:(await page.locator('#loginHint').innerText()).slice(0,130),agreementValid:await page.locator('#loginAgreement').evaluate(el=>el.validity.valid)};
   }
   report.push({engine:c.name,page:spec.page,http,domMs,readyMs,clickMs,menuMs,dateResult,gate,interaction,
     errors,requestErrors:requestErrors.slice(0,5),slow:slow.sort((a,b)=>b.ms-a.ms).slice(0,5),bytesRequests:slow.length});
  }catch(e){report.push({engine:c.name,page:spec.page,http,fail:String(e).slice(0,500),readyMs:Date.now()-t0,errors,requestErrors:requestErrors.slice(0,5),slow:slow.sort((a,b)=>b.ms-a.ms).slice(0,5)})}
  await page.close();
 }
 await context.close();await browser.close();
}
console.log('QCDA_FULL_CLICK_AUDIT='+JSON.stringify(report));
console.log('QCDA_FAILURES='+report.filter(x=>x.fail).length);
})().catch(e=>{console.error(e.stack||String(e));process.exit(1)});
