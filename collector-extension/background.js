const OFFICIAL_PAGE = 'https://www.sporttery.cn/jc/jsq/zqspf/';
const SPORTTERY_SCHEDULE_PAGE = 'https://www.sporttery.cn/jc/zqszsc/index.html';
const FALLBACK_500_PAGE = 'https://trade.500.com/jczq/?playid=269&g=2';
const INGEST_URL = 'https://oqtloldkfjxildoribkf.supabase.co/functions/v1/sporttery-ingest';

function wait(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

async function getStored(){
  return await chrome.storage.local.get(['collectorToken','autoSync','lastResult','lastSyncAt','last500Result']);
}

async function saveResult(key,result){
  const update = {};
  update[key] = result;
  update[key === 'lastResult' ? 'lastSyncAt' : 'last500SyncAt'] = new Date().toISOString();
  await chrome.storage.local.set(update);
}

async function waitForTabComplete(tabId, timeoutMs=30000){
  const started = Date.now();
  while(Date.now() - started < timeoutMs){
    const tab = await chrome.tabs.get(tabId);
    if(tab.status === 'complete') return tab;
    await wait(500);
  }
  throw new Error('PAGE_TIMEOUT');
}

function normalizeDate(raw){
  if(!raw) return '';
  const s = String(raw).trim().replace(/\//g,'-');
  if(/^20\d{2}-\d{1,2}-\d{1,2}$/.test(s)){
    const [y,m,d]=s.split('-');
    return y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0');
  }
  if(/^\d{1,2}-\d{1,2}$/.test(s)){
    const now = new Date();
    const [m,d]=s.split('-');
    return now.getFullYear()+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0');
  }
  return '';
}

async function scrapeRows(tabId, mode){
  const results = await chrome.scripting.executeScript({
    target:{tabId,allFrames:true},
    world:'MAIN',
    func:(mode)=>{
      const clean = v => (v || '').replace(/\s+/g,' ').trim();
      const rows=[];
      const diagnostics={
        url:location.href,
        title:document.title || '',
        tableCount:document.querySelectorAll('table').length,
        trCount:document.querySelectorAll('tr').length,
        iframeCount:document.querySelectorAll('iframe').length,
        bodyPrefix:clean(document.body?.innerText || '').slice(0,700)
      };

      for(const tr of Array.from(document.querySelectorAll('tr'))){
        const cells=Array.from(tr.querySelectorAll('td,th')).map(x=>clean(x.innerText)).filter(Boolean);
        if(!cells.length) continue;
        const joined=cells.join(' | ');
        const numMatch=joined.match(/周[一二三四五六日][0-9]{3}/);
        if(!numMatch) continue;
        const matchNum=numMatch[0];

        let date='', time='';
        let dt=joined.match(/(20\d{2}[-\/]\d{1,2}[-\/]\d{1,2})\s+(\d{1,2}:\d{2})/);
        if(dt){ date=dt[1]; time=dt[2]; }
        if(!date){
          dt=joined.match(/(\d{1,2}[-\/]\d{1,2})\s+(\d{1,2}:\d{2})/);
          if(dt){ date=dt[1]; time=dt[2]; }
        }

        const explicitVs=cells.find(x=>/\s(?:VS|vs|Vs)\s/.test(x));
        let home='',away='';
        if(explicitVs){
          const parts=explicitVs.split(/\s+(?:VS|vs|Vs)\s+/);
          if(parts.length>=2){ home=clean(parts[0]); away=clean(parts.slice(1).join(' ')); }
        }

        const teamTexts=Array.from(tr.querySelectorAll('[class*="team"],[class*="Team"]'))
          .map(x=>clean(x.innerText)).filter(Boolean)
          .filter((v,i,a)=>a.indexOf(v)===i)
          .filter(v=>!v.includes(matchNum) && v.length<=30);
        if((!home || !away) && teamTexts.length>=2){
          home=teamTexts[0];
          away=teamTexts[1];
        }

        if(!home || !away){
          const candidates=cells.filter(v=>{
            if(v.includes(matchNum)) return false;
            if(/20\d{2}[-\/]\d{1,2}[-\/]\d{1,2}/.test(v)) return false;
            if(/^\d{1,2}[-\/]\d{1,2}\s+\d{1,2}:\d{2}$/.test(v)) return false;
            if(/^\d{1,2}:\d{2}$/.test(v)) return false;
            if(/^(未|已|停售|开售|待售|销售|析|欧|亚|大|小)/.test(v)) return false;
            if(/^[+\-]?\d+(\.\d+)?(?:\s+[+\-]?\d+(\.\d+)?)*$/.test(v)) return false;
            if(v.length<2 || v.length>24) return false;
            return true;
          });
          const unique=candidates.filter((v,i,a)=>a.indexOf(v)===i);
          if(unique.length>=3){
            home=home || unique[unique.length-2];
            away=away || unique[unique.length-1];
          }else if(unique.length>=2){
            home=home || unique[0];
            away=away || unique[1];
          }
        }

        let league='';
        const leagueEl=tr.querySelector('[class*="league"],[class*="match_name"],[class*="matchName"]');
        if(leagueEl) league=clean(leagueEl.innerText);
        if(!league){
          const idx=cells.findIndex(v=>v.includes(matchNum));
          if(idx>=0 && cells[idx+1] && cells[idx+1]!==home && cells[idx+1]!==away) league=cells[idx+1];
        }

        rows.push({
          matchNum,league,home,away,date,time,cells,mode,
          rowText:joined.slice(0,1000)
        });
      }

      return {diagnostics,rows};
    },
    args:[mode]
  });

  const frames=results.map(x=>x.result).filter(Boolean);
  const allRows=frames.flatMap(x=>x.rows || []);
  const seen=new Set();
  const rows=[];
  for(const r of allRows){
    const key=[r.matchNum,r.date,r.home,r.away].join('|');
    if(!seen.has(key)){
      seen.add(key);
      rows.push(r);
    }
  }
  return {rows,frames};
}

function buildPayload(scraped,source){
  const groups=new Map();
  for(const r of scraped.rows){
    if(!r.matchNum || !r.home || !r.away) continue;
    const date=normalizeDate(r.date) || new Date().toISOString().slice(0,10);
    if(!groups.has(date)) groups.set(date,[]);
    groups.get(date).push({
      matchId:source+'-'+date.replaceAll('-','')+'-'+r.matchNum,
      matchNumStr:r.matchNum,
      leagueAllName:r.league || null,
      leagueAbbName:r.league || null,
      homeTeamAbbName:r.home,
      awayTeamAbbName:r.away,
      matchDate:date,
      matchTime:(r.time || '00:00') + (r.time && r.time.length===5 ? ':00' : ''),
      matchStatus:'scheduled',
      sellStatus:{},
      source,
      rawCells:r.cells,
      rawRowText:r.rowText
    });
  }
  return {
    success:true,
    value:{
      lastUpdateTime:new Date().toISOString(),
      matchInfoList:[...groups.entries()].map(([businessDate,subMatchList])=>({businessDate,subMatchList}))
    }
  };
}

async function pushToDatabase(token,payload,sourceUrl){
  const res=await fetch(INGEST_URL,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'X-Collector-Token':token,
      'X-Collector-Version':'0.1.3',
      'X-Source-Endpoint':sourceUrl
    },
    body:JSON.stringify(payload)
  });
  const text=await res.text();
  let data=null;
  try{ data=JSON.parse(text); }catch{ data={ok:false,error:'INGEST_INVALID_RESPONSE',detail:text.slice(0,200)}; }
  if(!res.ok || !data.ok) throw new Error(data.error || ('INGEST_HTTP_'+res.status));
  return data;
}

async function collectPage(pageUrl,mode,storageKey){
  const stored=await getStored();
  const token=(stored.collectorToken || '').trim();
  if(!token){
    const result={ok:false,error:'NO_TOKEN',message:'请先保存采集器凭证'};
    await saveResult(storageKey,result);
    return result;
  }

  let tabId=null;
  try{
    const tab=await chrome.tabs.create({url:pageUrl,active:false});
    tabId=tab.id;
    await waitForTabComplete(tabId);
    await wait(2500);

    const scraped=await scrapeRows(tabId,mode);
    const usable=scraped.rows.filter(r=>r.matchNum && r.home && r.away);

    if(!usable.length){
      const result={
        ok:false,
        error:'NO_MATCH_ROWS',
        message:'页面可以打开，但暂时没有识别到竞彩比赛行',
        pageUrl,
        detectedRows:scraped.rows.length,
        diagnostics:scraped.frames.slice(0,4)
      };
      await saveResult(storageKey,result);
      return result;
    }

    const source=mode==='500' ? '500_trade_dom' : 'sporttery_dom';
    const payload=buildPayload({rows:usable},source);
    const ingested=await pushToDatabase(token,payload,pageUrl);
    const result={
      ok:true,
      source,
      message:'赛程同步成功',
      detectedRows:scraped.rows.length,
      parsedMatches:usable.length,
      matchesReceived:ingested.matchesReceived || 0,
      matchesUpserted:ingested.matchesUpserted || 0,
      snapshotsInserted:ingested.snapshotsInserted || 0
    };
    await saveResult(storageKey,result);
    return result;
  }catch(err){
    const result={ok:false,error:String(err.message || err),message:'采集失败'};
    await saveResult(storageKey,result);
    return result;
  }finally{
    if(tabId){ try{ await chrome.tabs.remove(tabId); }catch{} }
  }
}

async function runOfficial(){
  let result=await collectPage(OFFICIAL_PAGE,'sporttery','lastResult');
  if(!result.ok && result.error==='NO_MATCH_ROWS'){
    result=await collectPage(SPORTTERY_SCHEDULE_PAGE,'sporttery','lastResult');
  }
  return result;
}

async function run500(){
  return await collectPage(FALLBACK_500_PAGE,'500','last500Result');
}

async function ensureAlarm(){
  const stored=await getStored();
  if(stored.autoSync===false){
    await chrome.alarms.clear('sportteryAutoSync');
    return;
  }
  const alarm=await chrome.alarms.get('sportteryAutoSync');
  if(!alarm) chrome.alarms.create('sportteryAutoSync',{delayInMinutes:2,periodInMinutes:15});
}

chrome.runtime.onInstalled.addListener(async()=>{
  const stored=await chrome.storage.local.get(['autoSync']);
  if(typeof stored.autoSync==='undefined') await chrome.storage.local.set({autoSync:true});
  await ensureAlarm();
});
chrome.runtime.onStartup.addListener(ensureAlarm);
chrome.alarms.onAlarm.addListener(async alarm=>{
  if(alarm.name==='sportteryAutoSync'){
    const stored=await getStored();
    if(stored.autoSync!==false && stored.collectorToken) await runOfficial();
  }
});
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
  if(message?.type==='RUN_SYNC'){ runOfficial().then(sendResponse); return true; }
  if(message?.type==='RUN_500_SYNC'){ run500().then(sendResponse); return true; }
  if(message?.type==='SET_AUTO_SYNC'){
    chrome.storage.local.set({autoSync:Boolean(message.enabled)}).then(async()=>{ await ensureAlarm(); sendResponse({ok:true}); });
    return true;
  }
});