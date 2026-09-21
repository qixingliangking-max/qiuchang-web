const OFFICIAL_PAGE = 'https://m.sporttery.cn/mjc/jsq/zqspf/';
const INGEST_URL = 'https://oqtloldkfjxildoribkf.supabase.co/functions/v1/sporttery-ingest';
const ENDPOINTS = [
  'https://webapi.sporttery.cn/gateway/uniform/football/getMatchCalculatorV1.qry?channel=c&poolCode=had,hhad,crs,ttg,hafu',
  'https://webapi.sporttery.cn/gateway/jc/football/getMatchCalculatorV1.qry?channel=c&poolCode=had,hhad,crs,ttg,hafu'
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
      if(document.title && /Access Restricted/i.test(document.title)){
        return {ok:false,error:'ACCESS_RESTRICTED',title:document.title};
      }

      const headers = {
        'Accept':'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With':'XMLHttpRequest'
      };

      const attempts = [];
      for(const endpoint of endpoints){
        try{
          const res = await fetch(endpoint, {
            method:'GET',
            credentials:'include',
            cache:'no-store',
            headers
          });
          const text = await res.text();
          let payload = null;
          try{ payload = JSON.parse(text); }catch{}
          attempts.push({
            endpoint,
            status:res.status,
            contentType:res.headers.get('content-type'),
            prefix:text.slice(0,120)
          });
          if(res.ok && payload && payload.value && Array.isArray(payload.value.matchInfoList)){
            return {ok:true,endpoint,payload,attempts};
          }
        }catch(err){
          attempts.push({endpoint,error:String(err)});
        }
      }

      return {ok:false,error:'UPSTREAM_NO_VALID_JSON',attempts};
    },
    args:[ENDPOINTS]
  });

  return result && result.result ? result.result : {ok:false,error:'SCRIPT_NO_RESULT'};
}

async function pushToDatabase(token, fetched){
  const res = await fetch(INGEST_URL, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'X-Collector-Token':token,
      'X-Collector-Version':'0.1.0',
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

  let tabId = null;
  try{
    const tab = await chrome.tabs.create({url:OFFICIAL_PAGE,active:false});
    tabId = tab.id;
    await waitForTabComplete(tabId);
    await wait(1600);

    const fetched = await fetchInsideSporttery(tabId);
    if(!fetched.ok){
      const result = {
        ok:false,
        error:fetched.error || 'FETCH_FAILED',
        message:fetched.error === 'ACCESS_RESTRICTED'
          ? '当前网络打开竞彩网被限制，请关闭代理/VPN或换可正常访问竞彩网的网络后再试'
          : '竞彩网接口没有返回可用数据',
        detail:fetched
      };
      await saveResult(result);
      return result;
    }

    const ingested = await pushToDatabase(token, fetched);
    const result = {
      ok:true,
      message:'同步成功',
      matchesReceived:ingested.matchesReceived || 0,
      matchesUpserted:ingested.matchesUpserted || 0,
      snapshotsInserted:ingested.snapshotsInserted || 0,
      sourceUpdatedAt:ingested.sourceUpdatedAt || null
    };
    await saveResult(result);
    return result;
  }catch(err){
    const result = {ok:false,error:String(err.message || err),message:'同步失败'};
    await saveResult(result);
    return result;
  }finally{
    if(tabId){
      try{ await chrome.tabs.remove(tabId); }catch{}
    }
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
