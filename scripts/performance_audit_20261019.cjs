// Isolated BRANCH-ONLY read-only browser audit. No forms submitted, no credentials and no production code changes.
const {chromium,webkit,devices}=require('playwright');
const fs=require('fs');
const BASE='https://qcda.cn';
const targets=[
  {name:'league',path:'/league.html',selector:'#leagueRecordRoot'},
  {name:'profile-guest',path:'/profile.html',selector:'#profileRoot, #loginForm'},
  {name:'login',path:'/login.html',selector:'#loginForm'},
  {name:'register',path:'/register.html',selector:'#registerForm'},
  {name:'overview-reference',path:'/index.html',selector:'#jcYesterdayCards'},
  {name:'football-reference',path:'/football.html',selector:'#jcFootballCards'}
];
const results=[];
const now=()=>Date.now();
async function measure(browser,engine,target,repeat){
  const context=await browser.newContext({...engine.device,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  const page=await context.newPage();
  const row={engine:engine.name,target:target.name,repeat,entry:target.path,http:null,domMs:null,firstVisibleMs:null,readyMs:null,
    finalUrl:null,gate:null,resourceCount:0,apiRequests:0,imageRequests:0,failedRequests:[],jsErrors:[],readyError:null};
  const start=now();
  page.on('pageerror',e=>row.jsErrors.push(String(e).slice(0,250)));
  page.on('request',r=>{row.resourceCount++;if(r.url().includes('supabase.co/'))row.apiRequests++;if(r.resourceType()==='image')row.imageRequests++});
  page.on('requestfailed',r=>{const why=r.failure()?.errorText||''; if(!/ERR_ABORTED|cancelled/i.test(why)) row.failedRequests.push({path:r.url().split('?')[0],error:why})});
  try{
    const response=await page.goto(BASE+target.path,{waitUntil:'domcontentloaded',timeout:35000});
    row.http=response?.status();
    row.domMs=now()-start;
    await page.locator(target.selector).first().waitFor({state:'visible',timeout:16000});
    row.firstVisibleMs=now()-start;
    try{
      if(target.name==='league'){
        await page.waitForFunction(()=>{
          const r=document.querySelector('#leagueRecordRoot');
          return r && (r.innerText||'').trim().length>12 && !/正在验证会员权限并读取联赛目录/.test(r.innerText||'');
        },null,{timeout:18000});
      }else if(target.name==='profile-guest'){
        await page.waitForFunction(()=>{
          if(document.querySelector('#loginForm'))return true;
          const e=document.querySelector('#profileEmail');
          const n=document.querySelector('#profileNickname');
          const t=(document.querySelector('#profileRoot')?.innerText||'');
          return (e && !/加载中/.test(e.innerText||'') && n && !/加载中/.test(n.innerText||''))||
            /请先登录|登录后|尚未登录|未登录/.test(t);
        },null,{timeout:18000});
      }else if(target.name==='overview-reference'){
        await page.waitForFunction(()=>!!document.querySelector('#jcYesterdayCards .jc-overview-row'),null,{timeout:18000});
      }else if(target.name==='football-reference'){
        await page.waitForFunction(()=>!!document.querySelector('#jcFootballCards .jc-football-card'),null,{timeout:18000});
      }else{
        await page.waitForFunction(t=>{
          const e=document.querySelector(t);
          return e&&e.querySelectorAll('input').length>=2;
        },target.selector,{timeout:16000});
      }
      row.readyMs=now()-start;
    }catch(e){row.readyError=String(e).slice(0,280)}
    await page.waitForTimeout(250);
    row.finalUrl=new URL(page.url()).pathname;
    row.gate=await page.evaluate(name=>{
      if(name==='league'){
        const t=document.querySelector('#leagueRecordRoot')?.innerText||'';
        return {loading:/正在验证会员权限并读取联赛目录/.test(t),login:/登录/.test(t),pro:/Pro|会员/.test(t),length:t.length};
      }
      if(name==='profile-guest'){
        return {redirectedToLogin:!!document.querySelector('#loginForm'),profileVisible:!!document.querySelector('#profileRoot'),profileLoading:/加载中/.test(document.querySelector('#profileEmail')?.innerText||'')};
      }
      if(name==='login')return {form:!!document.querySelector('#loginForm'),fields:document.querySelectorAll('#loginForm input').length};
      if(name==='register')return {form:!!document.querySelector('#registerForm'),fields:document.querySelectorAll('#registerForm input').length};
      return {cards:document.querySelectorAll(name==='overview-reference'?'#jcYesterdayCards .jc-overview-row':'#jcFootballCards .jc-football-card').length};
    },target.name);
    row.performance=await page.evaluate(()=>{
      const n=performance.getEntriesByType('navigation').at(-1);
      const e=performance.getEntriesByType('resource');
      return {ttfbMs:Math.round(n?.responseStart||0),dclMs:Math.round(n?.domContentLoadedEventEnd||0),
        appJsCount:e.filter(x=>/\/app\.js(?:\?|$)/.test(x.name)).length,appJsDurationMs:e.filter(x=>/\/app\.js(?:\?|$)/.test(x.name)).map(x=>Math.round(x.duration))};
    });
  }catch(e){row.readyError=row.readyError||String(e).slice(0,340);}
  await context.close();
  console.log('QCDA_SECONDARY_PAGE_TEST='+JSON.stringify(row));
  return row;
}
(async()=>{
  const engines=[
    {name:'android-chromium',type:chromium,device:devices['Pixel 7']},
    {name:'iphone-webkit',type:webkit,device:devices['iPhone 13']}
  ];
  for(const engine of engines){
    const browser=await engine.type.launch({headless:true});
    try{
      for(let repeat=1;repeat<=2;repeat++)
        for(const target of targets){
          // The reference pages use one cold sample; all requested surfaces use two.
          if(repeat===2&&target.name.endsWith('-reference'))continue;
          results.push(await measure(browser,engine,target,repeat));
        }
    }finally{await browser.close()}
  }
  fs.mkdirSync('.github/reports',{recursive:true});
  fs.writeFileSync('.github/reports/production-perf-20261019.json',JSON.stringify({
    at:new Date().toISOString(),mode:'Public-guest read only; separate cold contexts; no authentication or mutations',results
  },null,2)+'\n');
  const summary=results.map(r=>({engine:r.engine,page:r.target,repeat:r.repeat,http:r.http,dom:r.domMs,first:r.firstVisibleMs,
    ready:r.readyMs,gate:r.gate,js:r.jsErrors.length,failed:r.failedRequests.length,error:r.readyError}));
  console.log('QCDA_SECONDARY_SUMMARY='+JSON.stringify(summary));
  const problems=results.filter(r=>r.http!==200||r.jsErrors.length||r.failedRequests.length||r.readyError);
  console.log('QCDA_SECONDARY_WARNINGS='+JSON.stringify(problems.map(r=>({engine:r.engine,page:r.target,repeat:r.repeat,http:r.http,error:r.readyError,js:r.jsErrors,failed:r.failedRequests.slice(0,3)}))));
  if(results.some(r=>r.http!==200))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});