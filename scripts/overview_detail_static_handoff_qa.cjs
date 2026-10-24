const {chromium,webkit,devices}=require('playwright');
(async()=>{
 const scenarios=[
  {name:'desktop-Chrome',engine:chromium,device:{viewport:{width:1360,height:850}}},
  {name:'iPhone-WebKit',engine:webkit,device:devices['iPhone 13']},
  {name:'Android-Chrome',engine:chromium,device:devices['Pixel 7']}
 ];
 const reports=[];
 for(const item of scenarios){
  const browser=await item.engine.launch();
  try{
   for(const mode of ['row','link']){
    const context=await browser.newContext({...item.device,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const first=await page.goto('https://qcda.cn/index.html',{waitUntil:'domcontentloaded',timeout:45000});
    if(first?.status()!==200)throw Error('Homepage HTTP failed');
    const locator=page.locator('#jcYesterdayCards .jc-overview-row[data-match-id]').first();
    await locator.waitFor({state:'visible',timeout:30000});
    const fixtureId=await locator.getAttribute('data-match-id');
    const expectedHref=await locator.getAttribute('data-href');
    if(!fixtureId||!expectedHref?.includes('jc-match.html?id='))throw Error('Missing real fixture for '+item.name);
    // Clock begins at actual user click (not Playwright's wait-to-click).
    await page.evaluate(()=>{
      document.addEventListener('click',event=>{
        if(event.target?.closest?.('#jcYesterdayCards .jc-overview-row')){
          sessionStorage.setItem('qcda-test-overview-click-at',String(Date.now()));
        }
      },true);
    });
    if(mode==='row'){
      await locator.locator('td.jc-num').click();
    }else{
      await locator.locator('a.jc-review-match').click();
    }
    await page.waitForURL(url=>url.pathname.endsWith('jc-match.html'),{waitUntil:'domcontentloaded',timeout:12000});
    const handoff=await page.evaluate(()=>{
      const data=JSON.parse(sessionStorage.getItem('qc-football-detail-nav-v1')||'null');
      return {savedAt:data?.savedAt,matchId:data?.match?.id,date:data?.businessDate,dayCount:data?.day?.length,
        hasProtectedModel:JSON.stringify(data||{}).includes('"jc_model_outputs"') ||
          JSON.stringify(data||{}).includes('"jc_match_ai_analysis"'),
        tapAt:Number(sessionStorage.getItem('qcda-test-overview-click-at')||0)};
    });
    if(handoff.matchId!==fixtureId || handoff.hasProtectedModel || !handoff.tapAt)
      throw Error('Static handoff failed '+JSON.stringify({engine:item.name,mode,fixtureId,handoff}));
    await page.locator('#jcMatchDetailRoot .detail-head').waitFor({state:'visible',timeout:30000});
    await page.locator('#jcMainPanel').waitFor({state:'visible',timeout:30000});
    await page.waitForFunction(()=>!document.querySelector('#jcMainPanel .jc-match-spinner'),
      null,{timeout:30000});
    const output=await page.evaluate(()=>({
      endToEndClickMs:Date.now()-Number(sessionStorage.getItem('qcda-test-overview-click-at')||0),
      activeDetail:document.querySelector('#jcMatchDetailRoot .detail-head')?.textContent?.slice(0,125),
      guestGate:document.querySelector('#jcMainPanel')?.textContent?.includes('登录'),
      placeholderGone:!document.querySelector('[data-qc-public-first-paint="1"]'),
      navItems:document.querySelectorAll('.jc-detail-match-item').length
    }));
    if(!output.guestGate || !output.placeholderGone || output.navItems<1 || errors.length)
      throw Error('Detail handoff/access regression '+JSON.stringify({item:item.name,mode,output,errors}));
    reports.push({engine:item.name,mode,...output,handoffMatch:handoff.matchId,dayCount:handoff.dayCount,errors});
    await context.close();
   }
  }finally{await browser.close()}
 }
 console.log('QCDA_STATIC_DETAIL_HANDOFF_QA='+JSON.stringify(reports));
 if(reports.length!==6)throw Error('6 mandatory QA cases not completed');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
