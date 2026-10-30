'use strict';
const assert=require('node:assert/strict');
const {chromium,devices}=require('playwright');
const target='https://qcda.cn/internal-test/curated-lab-20261019.html?qa=v23-today-20261030';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const [deviceName,profile] of [['desktop',{viewport:{width:1280,height:860}}],['iPhone 13',devices['iPhone 13']]]){
   const context=await browser.newContext({...profile,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',err=>errors.push(String(err)));
   const r=await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(r.status(),200,deviceName+' HTTP status');
   await page.waitForFunction(()=>!document.body.classList.contains('curated-booting')
     &&document.querySelector('#dateLabel')?.textContent.includes('10月30日')
     &&document.querySelectorAll('#plans .plan').length>0,{timeout:30000});
   await page.locator('#tabs button[data-type="direction"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('#plans .plan').length===1,{timeout:10000});
   const direction=await page.locator('#plans').innerText();
   assert.match(direction,/顾衡方案/);
   assert.match(direction,/周五006/);
   assert.match(direction,/周五009/);
   assert.doesNotMatch(direction,/周五001/);
   await page.locator('#plans .inspect').first().click();
   await page.locator('#overlay:not([hidden]) .dialog').waitFor({timeout:6000});
   assert.equal(await page.locator('#dialogBody .detail-leg').count(),2);
   await page.locator('#closeDialog').click();
   assert.equal(await page.locator('#overlay').getAttribute('hidden'),'');
   await page.locator('#tabs button[data-type="htft"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('#plans .plan').length===2,{timeout:12000});
   const htft=await page.locator('#plans').innerText();
   assert.match(htft,/沈策方案/);
   assert.match(htft,/陆野方案/);
   assert.match(htft,/周五005/);
   assert.match(htft,/周五009/);
   await page.locator('#plans .plan').first().locator('.inspect').click();
   await page.locator('#overlay:not([hidden]) .dialog').waitFor({timeout:6000});
   assert.equal(await page.locator('#dialogBody .detail-leg').count(),2);
   assert.equal(await page.locator('.alloc tbody tr').count(),4);
   await page.locator('#closeDialog').click();
   assert.equal(errors.length,0,deviceName+' page errors: '+errors.join(' ; '));
   console.log('V23_LIVE_MODAL_PASS',deviceName,{directionCards:1,htftCards:2,dialogLegs:2,htftCombos:4,errors:errors.length});
   await context.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err.stack||String(err));process.exitCode=1});
