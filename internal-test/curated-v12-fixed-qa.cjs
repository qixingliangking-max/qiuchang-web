const {chromium,devices}=require('playwright');
const path=require('path');
const url='file://'+path.resolve('internal-test/curated-v12-fixed-review-20260923-1018.html');
const main='file://'+path.resolve('internal-test/curated-lab-20261019.html');
const types={direction:1,htft:1,goals:4,score2x3:9,score3x3:27,score2x2:4};
async function test(browser,label,viewport){
  const ctx=await browser.newContext({...viewport,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url);await page.waitForSelector('#history button');
  const data=await page.evaluate(()=>{
    const a=window.QC_CURATED_V12_FIXED_MASK,b=window.QC_CURATED_V12_FIXED_RESULTS;
    return {days:Object.keys(a.days).length,groups:Object.values(a.days).reduce((s,x)=>s+x.entries.length,0),shasMatch:!!b.frozenBlobSha,zeroLeaks:Object.values(a.days).every(z=>z.entries.every(e=>e.legs.every(l=>l.row.ft===null&&l.row.ht===null)))}
  });
  if(data.days!==22||data.groups!==122||!data.zeroLeaks||!data.shasMatch)throw Error(label+' data '+JSON.stringify(data));
  if((await page.locator('#history').innerText()).includes('8,812.50'))throw Error(label+' masked results leaked');
  for(const [key,number] of Object.entries(types)){
    await page.locator('#tabs button[data-type="'+key+'"]').click();
    await page.locator('#plan details summary').click();
    if(await page.locator('#plan details tbody tr').count()!==number)throw Error(label+' bad lines '+key);
    const vals=await page.locator('#plan details tbody tr td:nth-child(4)').allTextContents();
    const sum=vals.reduce((v,x)=>v+Number(x.replaceAll(',','')),0);
    if(Math.abs(sum-1000)>.011)throw Error(label+' bad budget '+key+': '+sum);
  }
  await page.locator('#reveal').click();
  const txt=await page.locator('#summary').innerText();
  for(const amount of ['5,303.80','21,000.00','7,243.75','7,749.66','8,624.09','8,812.50'])if(!txt.includes(amount))throw Error(label+' missing '+amount);
  await page.locator('#chooseDay').selectOption('2026-09-23');
  if(!(await page.locator('#plan').innerText()).includes('弃选'))throw Error(label+' missing abstention');
  await page.locator('#reveal').click();
  if((await page.locator('#summary').innerText()).includes('8,812.50'))throw Error(label+' remask failed');
  const widths=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  if(widths.scroll>widths.client+2)throw Error(label+' horizontal overflow '+JSON.stringify(widths));
  if(errors.length)throw Error(label+' runtime errors '+JSON.stringify(errors));
  console.log('CHECK '+label+' PASS '+JSON.stringify(widths));
  await ctx.close();
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    await test(browser,'mobile320',{viewport:{width:320,height:700},isMobile:true,hasTouch:true});
    await test(browser,'pixel7',devices['Pixel 7']);
    await test(browser,'desktop',{viewport:{width:1280,height:900}});
    const ctx=await browser.newContext(),page=await ctx.newPage();await page.goto(main);
    if(await page.locator('a[href="curated-v12-fixed-review-20260923-1018.html"]').count()!==1)throw Error('main link missing');
    console.log('CURATED_V12_FIXED_QA_PASS');
    await ctx.close();
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
