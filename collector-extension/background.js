const OFFICIAL_PAGES = [
  'https://m.sporttery.cn/mjc/jsq/zqspf/',
  'https://www.sporttery.cn/jc/zqszsc/'
];
const INGEST_URL = 'https://oqtloldkfjxildoribkf.supabase.co/functions/v1/sporttery-ingest';
const ENDPOINTS = [
  {
    label:'uniform',
    url:'https://webapi.sporttery.cn/gateway/uniform/football/getMatchCalculatorV1.qry?channel=c&poolCode=had,hhad,crs,ttg,hafu'
  },
  {
    label:'jc',
    url:'https://webapi.sporttery.cn/gateway/jc/football/getMatchCalculatorV1.qry?channel=c&poolCode=had,hhad,crs,ttg,hafu'
  }
];

function wait(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

async function getStored(){
  return await chrome.storage.local.get(['collectorToken','autoSync','lastResult','lastSyncAt']);
}

async function saveResult(result){
  await chrome.storage.local.set({
    lastResult: result,
    lastSyncAt: new Date().toISOString()
  });
}

function parsePayload(text){
  try{
    const payload = JSON.parse(text);
    if(payload && payload.value && Array.isArray(payload.value.matchInfoList)){
      return payload;
    }
  }catch{}
  return null;
}

async function fetchDirect(){
  const attempts = [];
  for(const item of ENDPOINTS){
    try{
      const res = await fetch(item.url, {
        method:'GET',
        cache:'no-store',
        credentials:'include',
        headers:{
          'Accept':'application/json, text/javascript, */*; q=0.01',
          'Accept-Language':'zh-CN,zh;q=0.9',
          'X-Requested-With':'XMLHttpRequest'
        }
      });
      const text = await res.text();
      const payload = parsePayload(text);
      attempts.push({
        label:item.label,
        endpoint:item.url,
        status:res.status,
        contentType:res.headers.get('content-type') || '',
        prefix:text.slice(0,120)
      });
      if(res.ok && payload){
        return {ok:true,method:'extension-direct',endpoint:item.url,payload,attempts};
      }
    }catch(err){
      attempts.push({
        label:item.label,
        endpoint:item.url,
        error:String(err)
      });
    }
  }
  return {ok:false,error:'DIRECT_NO_VALID_JSON',attempts};
}

async function waitForTabComplete(tabId, timeoutMs=25000){
  const started = Date.now();
  while(Date.now() - started < timeoutMs){
    const tab = await chrome.tabs.get(tabId);
    if(tab.status === 'complete') return tab;
    await wait(500);
  }
  throw new Error('OFFICIAL_PAGE_TIMEOUT');
}

async function fetchInsideSporttery(tabId){
  const [result] = await chrome.scripting.executeScript({
    target:{tabId},
    world:'MAIN',
    func: async (endpoints) => {
      const page = {
        url:location.href,
        title:document.title || ''
      };
      if(/Access Restricted/i.test(page.title)){
        return {ok:false,error:'ACCESS_RESTRICTED',page,attempts:[]};
      }

      const attempts = [];
      for(const item of endpoints){
        try{
          const res = await fetch(item.url, {
            method:'GET',
            credentials:'include',
            cache:'no-store',
            headers:{
              'Accept':'application/json, text/javascript, */*; q=0.01',
              'X-Requested-With':'XMLHttpRequest'
            }
          });
          const text = await res.text();
          let payload = null;
          try{ payload = JSON.parse(text); }catch{}
          attempts.push({
            label:item.label,
            endpoint:item.url,
            status:res.status,
            contentType:res.headers.get('content-type') || '',
            prefix:text.slice(0,120)
          });
          if(res.ok && payload && payload.value && Array.isArray(payload.value.matchInfoList)){
            return {ok:true,method:'official-page',endpoint:item.url,payload,page,attempts};
          }
        }catch(err){
          attempts.push({
            label:item.label,
            endpoint:item.url,
            error:String(err)
          });
        }
      }
      return {ok:false,error:'PAGE_NO_VALID_JSON',page,attempts};
    },
    args:[ENDPOINTS]
  });

  return result && result.result ? result.result : {ok:false,error:'SCRIPT_NO_RESULT',attempts:[]};
}

async function fetchViaOfficialPages(){
  const pageAttempts = [];
  for(const pageUrl of OFFICIAL_PAGES){
    let tabId = null;
    try{
      const tab = await chrome.tabs.create({url:pageUrl,active:false});
      tabId = tab.id;
      await waitForTabComplete(tabId);
      await wait(1800);

      const result = await fetchInsideSporttery(tabId);
      pageAttempts.push({
        pageUrl,
        page:result.page || null,
        error:result.error || null,
        attempts:result.attempts || []
      });
      if(result.ok){
        return {...result,pageAttempts};
      }
    }catch(err){
      pageAttempts.push({
        pageUrl,
        error:String(err),
        attempts:[]
      });
    }finally{
      if(tabId){
        try{ await chrome.tabs.remove(tabId); }catch{}
      }
    }
  }
  return {ok:false,error:'UPSTREAM_NO_VALID_JSON',pageAttempts};
}

async function pushToDatabase(token, fetched){
  const res = await fetch(INGEST_URL, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'X-Collector-Token':token,
      'X-Collector-Version':'0.1.1',
      'X-Source-Endpoint':fetched.endpoint || ''
    },
    body:JSON.stringify(fetched.payload)
  });
  const text = await res.text();
  let data = null;
  try{ data = JSON.parse(text); }catch{
    data = {ok:false,error:'INGEST_INVALID_RESPONSE',detail:text.slice(0,200)};
  }
  if(!res.ok || !data.ok){
    throw new Error(data.error || ('INGEST_HTTP_' + res.status));
  }
  return data;
}

async function runSync(){
  const stored = await getStored();
  const token = (stored.collectorToken || '').trim();
  if(!token){
    const result = {ok:false,error:'NO_TOKEN',message:'请先在扩展里保存采集器凭证'};
    await saveResult(result);
    return result;
  }

  try{
    const direct = await fetchDirect();
    let fetched = direct;

    if(!direct.ok){
      const pageResult = await fetchViaOfficialPages();
      if(pageResult.ok){
        fetched = pageResult;
      }else{
        const hasRestricted = (pageResult.pageAttempts || []).some(x =>
          x.error === 'ACCESS_RESTRICTED' || /Access Restricted/i.test(x.page?.title || '')
        );
        const result = {
          ok:false,
          error:hasRestricted ? 'ACCESS_RESTRICTED' : 'UPSTREAM_NO_VALID_JSON',
          message:hasRestricted
            ? '当前网络访问竞彩网被限制'
            : '竞彩网接口没有返回可用 JSON',
          detail:{
            directAttempts:direct.attempts || [],
            pageAttempts:pageResult.pageAttempts || []
          }
        };
        await saveResult(result);
        return result;
      }
    }

    const ingested = await pushToDatabase(token, fetched);
    const result = {
      ok:true,
      message:'同步成功',
      method:fetched.method || 'unknown',
      matchesReceived:ingested.matchesReceived || 0,
      matchesUpserted:ingested.matchesUpserted || 0,
      snapshotsInserted:ingested.snapshotsInserted || 0,
      sourceUpdatedAt:ingested.sourceUpdatedAt || null
    };
    await saveResult(result);
    return result;
  }catch(err){
    const result = {
      ok:false,
      error:String(err.message || err),
      message:'同步失败'
    };
    await saveResult(result);
    return result;
  }
}

async function ensureAlarm(){
  const stored = await getStored();
  if(stored.autoSync === false){
    await chrome.alarms.clear('sportteryAutoSync');
    return;
  }
  const alarm = await chrome.alarms.get('sportteryAutoSync');
  if(!alarm){
    chrome.alarms.create('sportteryAutoSync',{delayInMinutes:2,periodInMinutes:15});
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(['autoSync']);
  if(typeof stored.autoSync === 'undefined'){
    await chrome.storage.local.set({autoSync:true});
  }
  await ensureAlarm();
});

chrome.runtime.onStartup.addListener(ensureAlarm);

chrome.alarms.onAlarm.addListener(async alarm => {
  if(alarm.name === 'sportteryAutoSync'){
    const stored = await getStored();
    if(stored.autoSync !== false && stored.collectorToken){
      await runSync();
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if(message && message.type === 'RUN_SYNC'){
    runSync().then(sendResponse);
    return true;
  }
  if(message && message.type === 'SET_AUTO_SYNC'){
    chrome.storage.local.set({autoSync:Boolean(message.enabled)}).then(async () => {
      await ensureAlarm();
      sendResponse({ok:true});
    });
    return true;
  }
});
