// Branch-only isolated responsive audit of 4 admin subpages.
// NO real login, privileged API calls, code generation, form submissions or production mutations.
const {chromium,webkit,devices}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const root=process.cwd();
const mime={'.css':'text/css','.html':'text/html','.js':'application/javascript','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);res.end('Not found');return;}
    res.setHeader('content-type',(mime[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');
    res.writeHead(200);res.end(data);
  });
});
const routes=[
{name:'users',url:'admin-users.html',required:['usersTotal','usersPro','usersToday','usersLogin24h','adminDailyRows','adminDailyDetailRows','adminUserSearch','adminUserRows']},
{name:'codes',url:'admin-codes.html',required:['codesUnused','codesUsed','createCodeForm','codeDays','codeNote','createdCodeBox','copyCodeBtn','redeemCodeRows']},
{name:'data',url:'admin-data.html',required:['dataMatchCount','dataSnapshotCount','dataLastSync','dataCollectorStatus','createCollectorBtn','collectorTokenBox','dataRunRows']},
{name:'logs',url:'admin-logs.html',required:['adminLogRefresh','logLoadedCount','logSignupCount','logLoginCount','logCollectorCount','adminLogTypes','adminLogDays','adminLogRows','adminLogMore']}
];
const devicesToRun=[
{name:'320px',browser:chromium,context:{viewport:{width:320,height:640},deviceScaleFactor:2,isMobile:true,hasTouch:true}},
{name:'375px',browser:webkit,context:{viewport:{width:375,height:667},deviceScaleFactor:2,isMobile:true,hasTouch:true}},
{name:'iphone-13',browser:webkit,context:devices['iPhone 13']},
{name:'pixel-7',browser:chromium,context:devices['Pixel 7']},
{name:'tablet-768',browser:chromium,context:{viewport:{width:768,height:1024}}},
{name:'desktop-1280',browser:chromium,context:{viewport:{width:1280,height:800}}}
];
const output=[];
(async()=>{
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin='http://127.0.0.1:'+server.address().port;
for(const dev of devicesToRun){
 const browser=await dev.browser.launch({headless:true});
 const context=await browser.newContext({...dev.context,locale:'zh-CN'});
 // Stub every script to avoid privileged backend APIs and auth/session access during layout tests.
 await context.route('**/*.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 for(const item of routes){
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const result={device:dev.name,page:item.name,htmlStatus:null,errors};
  try{
   const response=await page.goto(origin+'/'+item.url,{waitUntil:'load',timeout:20000});
   result.htmlStatus=response.status();
   result.layout=await page.evaluate(required=>{
    const body=document.body,head=document.querySelector('.qc-admin-header'),content=document.querySelector('main.content');
    const intro=document.querySelector('.qc-admin-intro'),h1=intro?.querySelector('h1');
    const returnLink=document.querySelector('.qc-admin-return');
    const viewWidth=window.innerWidth;
    const headBox=head?.getBoundingClientRect(),contentBox=content?.getBoundingClientRect();
    const primaryButtons=[...document.querySelectorAll('main button')].filter(b=>!b.hidden).length;
    const allIds=[...document.querySelectorAll('[id]')].map(e=>e.id);
    const tabs=[...document.querySelectorAll('[data-days]')].length;
    const tables=[...document.querySelectorAll('.admin-table-wrap')].map(w=>{
      const a=w.getBoundingClientRect(),child=w.querySelector('table');
      return {outer:Math.round(a.width),table:Math.round(child?.getBoundingClientRect().width||0),overflowX:getComputedStyle(w).overflowX};
    });
    const cards=[...document.querySelectorAll('main .profile-card')].length;
    const metrics=[...document.querySelectorAll('main .metric')].length;
    const cssLoaded=[...document.styleSheets].some(s=>s.href?.includes('admin-subpages.css'));
    return {
     width:viewWidth,docWidth:document.documentElement.scrollWidth,bodyWidth:body.scrollWidth,
     height:headBox?.height,headerBrandSize:parseFloat(getComputedStyle(document.querySelector('.qc-admin-header .brand')).fontSize),
     introTitle:h1?.textContent?.trim(),introWhite:getComputedStyle(intro).backgroundColor,
     introTop:Math.round(intro?.getBoundingClientRect().y||0),
     returnButtonText:returnLink?.textContent?.trim(),returnButtonBackground:getComputedStyle(returnLink).backgroundColor,
     hasBrand:!!document.querySelector('.qc-admin-header .brand'),hasCss:cssLoaded,
     contentsWidth:Math.round(contentBox?.width||0),introCount:document.querySelectorAll('main .qc-admin-intro').length,
     cards,metrics,buttons:primaryButtons,tabs,
     missingIds:required.filter(i=>!allIds.includes(i)),
     tables,scriptTags:[...document.querySelectorAll('script[src]')].map(x=>x.getAttribute('src'))
    };
   },item.required);
   const l=result.layout;
   result.pass=result.htmlStatus===200&&l.hasCss&&l.introCount===1&&
    l.height>=54&&l.height<=64&&l.headerBrandSize<=21&&
    l.returnButtonText==='← 返回后台'&&l.missingIds.length===0&&
    l.docWidth<=l.width+1&&l.bodyWidth<=l.width+1&&
    l.tables.every(t=>t.outer<=l.contentsWidth+1&&['auto','scroll'].includes(t.overflowX))&&
    errors.length===0;
  }catch(err){result.pass=false;result.error=String(err).slice(0,350)}
  output.push(result);console.log('QCDA_ADMIN_SUBPAGE_QA='+JSON.stringify(result));
  await page.close();
 }
 await context.close();await browser.close();
}
fs.mkdirSync('.github/reports',{recursive:true});
fs.writeFileSync('.github/reports/production-perf-20261019.json',JSON.stringify({mode:'staging local static-only, auth/js stubbed, no privileged requests',output},null,2)+'\n');
const failures=output.filter(x=>!x.pass);
console.log('QCDA_ADMIN_SUBPAGE_SUMMARY='+JSON.stringify({total:output.length,passed:output.length-failures.length,failures:failures.map(x=>({device:x.device,page:x.page,error:x.error||x.layout}))}));
if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1}).finally(()=>server.close());
