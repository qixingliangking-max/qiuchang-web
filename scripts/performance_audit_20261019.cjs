// Branch-only isolated visual regression. No registration submissions, credentials or database mutations.
const {chromium,webkit,devices}=require('playwright');
const http=require('http');
const fs=require('fs');
const path=require('path');
const root=process.cwd();
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.json':'application/json','.svg':'image/svg+xml'};
const serve=http.createServer((req,res)=>{
 const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+p);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('forbidden')}
 fs.readFile(file,(e,buf)=>{
   if(e){res.writeHead(404);return res.end('not found')}
   res.setHeader('Content-Type',(types[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');
   res.writeHead(200);res.end(buf);
 });
});
const results=[];
(async()=>{
 await new Promise(ok=>serve.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+serve.address().port;
 const runs=[
  {label:'android-pixel7',type:chromium,device:devices['Pixel 7']},
  {label:'iphone13',type:webkit,device:devices['iPhone 13']},
  {label:'mobile-320',type:chromium,device:{viewport:{width:320,height:640},deviceScaleFactor:2,isMobile:true,hasTouch:true}},
  {label:'mobile-375',type:webkit,device:{viewport:{width:375,height:667},deviceScaleFactor:2,isMobile:true,hasTouch:true}},
  {label:'tablet-768',type:chromium,device:{viewport:{width:768,height:1024}}},
  {label:'desktop-1280',type:chromium,device:{viewport:{width:1280,height:800}}}
 ];
 for(const run of runs){
   const browser=await run.type.launch({headless:true});
   const context=await browser.newContext({...run.device,locale:'zh-CN'});
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   const response=await page.goto(base+'/register.html',{waitUntil:'domcontentloaded',timeout:20000});
   const probe=await page.evaluate(()=>{
     const form=document.querySelector('#registerForm');
     const card=document.querySelector('.auth-card');
     const inputNodes=[...document.querySelectorAll('#registerForm .field input')];
     const fields=inputNodes.map(i=>({id:i.id,height:Math.round(i.getBoundingClientRect().height),required:i.required,autocomplete:i.autocomplete}));
     const b=card.getBoundingClientRect();
     const primary=document.querySelector('#registerForm button[type="submit"]');
     const links=[...form.querySelectorAll('a')].map(a=>({text:a.textContent.trim(),href:a.getAttribute('href')}));
     return {
       viewport:innerWidth,innerHeight,
       bodyWidth:document.body.scrollWidth,docWidth:document.documentElement.scrollWidth,
       card:{x:Math.round(b.x),width:Math.round(b.width),bottom:Math.round(b.bottom)},
       fields,checkboxRequired:form.querySelector('input[type="checkbox"]')?.required,
       submitText:primary?.textContent.trim(),
       legalLinks:links.filter(a=>/terms|privacy/.test(a.href)),loginLink:links.find(a=>/login.html/.test(a.href)),
       stylesheet:[...document.styleSheets].map(s=>s.href?.split('/').at(-1)).filter(Boolean),
       cardBorderRadius:getComputedStyle(card).borderRadius,
       mainH1:form.querySelector('h1')?.innerText,
       hinted:form.querySelector('#registerHint')!=null,
       scripted:!!(document.querySelector('#registerForm')?.onsubmit)
     };
   });
   // Focus/input interactions should stay in their own box, never submit.
   await page.locator('#regEmail').fill('sample@example.com');
   await page.locator('#regPassword').fill('abcdefgh123');
   await page.locator('#regPassword2').fill('abcdefgh123');
   const form=await page.locator('#registerForm').evaluate(el=>({validBeforeAgreement:el.checkValidity()}));
   await page.locator('#registerForm input[type="checkbox"]').check();
   const validity=await page.locator('#registerForm').evaluate(el=>({validAfterAgreement:el.checkValidity()}));
   const outcome={engine:run.label,http:response.status(),...probe,...form,...validity,errors};
   const safe=outcome.http===200&&outcome.docWidth<=outcome.viewport+1&&
    outcome.card.x>=0&&outcome.card.x+outcome.card.width<=outcome.viewport+1&&
    outcome.fields.length===3&&outcome.checkboxRequired&&
    !outcome.validBeforeAgreement&&outcome.validAfterAgreement&&
    outcome.loginLink?.href==='login.html'&&outcome.legalLinks.length===2&&
    outcome.scripted&&outcome.errors.length===0;
   outcome.pass=!!safe;
   results.push(outcome);
   console.log('QCDA_REGISTER_LAYOUT_TEST='+JSON.stringify(outcome));
   await context.close();await browser.close();
 }
 fs.mkdirSync('.github/reports',{recursive:true});
 fs.writeFileSync('.github/reports/production-perf-20261019.json',JSON.stringify({mode:'isolated staging branch local layout tests only',results},null,2)+'\n');
 console.log('QCDA_REGISTER_LAYOUT_SUMMARY='+JSON.stringify(results.map(r=>({device:r.engine,http:r.http,viewport:r.viewport,docWidth:r.docWidth,card:r.card,pass:r.pass,errors:r.errors}))));
 if(results.some(x=>!x.pass))process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1}).finally(()=>serve.close());
