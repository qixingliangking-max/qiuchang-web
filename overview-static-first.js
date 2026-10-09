// Static-first overview guard.
// Homepage rule: locked/static snapshots paint first; only score/status may refresh
// after paint. Neighbor dates are loaded only after an explicit user action.

(function(){
  if(typeof window==='undefined') return;

  let dateIntent='';
  let intentTimer=0;

  function today(){
    return typeof qcBeijingToday==='function'
      ? qcBeijingToday()
      : new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }

  function addDays(ds,delta){
    if(typeof qcAddDays==='function') return qcAddDays(ds,delta);
    const d=new Date(ds+'T12:00:00+08:00');
    d.setUTCDate(d.getUTCDate()+delta);
    return d.toISOString().slice(0,10);
  }

  function selectedDate(){
    const p=new URLSearchParams(location.search).get('date');
    return /^\d{4}-\d{2}-\d{2}$/.test(p||'') ? p : today();
  }

  function setIntent(ds){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(ds||'')) return;
    dateIntent=ds;
    clearTimeout(intentTimer);
    intentTimer=setTimeout(()=>{ dateIntent=''; },6000);
  }

  function allowOverviewDate(ds){
    const cur=selectedDate();
    return ds===cur || ds===addDays(cur,-1) || ds===dateIntent || (dateIntent && ds===addDays(dateIntent,-1));
  }

  function allowHistoryDate(ds){
    const cur=selectedDate();
    return ds===addDays(cur,-1) || (dateIntent && ds===addDays(dateIntent,-1));
  }

  document.addEventListener('click',e=>{
    const el=e.target?.closest?.('button,[data-date]');
    if(!el) return;
    if(el.matches?.('.jc-cal-cell.has-data[data-date]')){
      setIntent(el.dataset.date||'');
      return;
    }
    const cur=selectedDate();
    if(el.id==='jcPrevDate') setIntent(addDays(cur,-1));
    else if(el.id==='jcNextDate') setIntent(addDays(cur,1));
    else if(el.id==='jcTodayBtn') setIntent(today());
  },true);

  if(typeof qcPrimeProOverviewSnapshots==='function'){
    window.qcPrimeProOverviewSnapshots=async function(){ return null; };
  }
  if(typeof qcPrimeFrozenOverviewDates==='function'){
    window.qcPrimeFrozenOverviewDates=async function(){ return null; };
  }

  const originalFetchFrozen=typeof qcFetchFrozenOverviewDate==='function' ? qcFetchFrozenOverviewDate : null;
  if(originalFetchFrozen){
    window.qcFetchFrozenOverviewDate=async function(dateStr){
      if(!allowOverviewDate(String(dateStr||''))) return null;
      return originalFetchFrozen(dateStr);
    };
  }

  const originalFetchHistory=typeof qcFetchHistoryOverviewDate==='function' ? qcFetchHistoryOverviewDate : null;
  if(originalFetchHistory){
    window.qcFetchHistoryOverviewDate=async function(dateStr,force=false){
      if(!allowHistoryDate(String(dateStr||''))){
        return {data:[],error:null,fromHistorySnapshot:true,historyFinal:false,fromStaticFirstSkipped:true};
      }
      return originalFetchHistory(dateStr,force);
    };
  }

  const originalFetchPro=typeof qcFetchProOverviewDate==='function' ? qcFetchProOverviewDate : null;
  if(originalFetchPro){
    window.qcFetchProOverviewDate=async function(dateStr){
      const ds=String(dateStr||'');
      if(!allowOverviewDate(ds)) return null;

      // When the user flips to a completed historical date, the main block must
      // render from the finalized history snapshot too — exactly like “昨日回看”.
      // Do not show the old pre-match locked snapshot with VS/未开赛 once the
      // historical snapshot is final.
      if(ds < today() && originalFetchHistory){
        try{
          const history=await originalFetchHistory(ds,false);
          if(history?.historyFinal && Array.isArray(history?.data) && history.data.length){
            return history;
          }
        }catch(_){}
      }

      return originalFetchPro(dateStr);
    };
  }

  const originalFetchOverview=typeof jcFetchOverviewDateRows==='function' ? jcFetchOverviewDateRows : null;
  if(originalFetchOverview){
    window.jcFetchOverviewDateRows=async function(dateStr,force=false){
      const ds=String(dateStr||'');
      if(!allowOverviewDate(ds)){
        return {data:[],error:null,fromStaticFirstSkipped:true};
      }
      try{
        if(!force && window.qcSupabase && typeof qcCacheProOverviewSnapshot==='function'){
          const {data:sessionData}=await window.qcSupabase.auth.getSession();
          if(sessionData?.session){
            const {data,error}=await window.qcSupabase
              .from('jc_overview_prediction_snapshots')
              .select('business_date,payload,generated_at')
              .eq('business_date',ds)
              .limit(1);
            const record=!error && Array.isArray(data) ? data[0] : null;
            if(record){
              const snap=qcCacheProOverviewSnapshot(record);
              if(snap) return snap;
            }
          }
        }
      }catch(_){}
      return originalFetchOverview(dateStr,force);
    };
  }

  const originalFetchDate=typeof jcFetchDateRows==='function' ? jcFetchDateRows : null;
  if(originalFetchDate){
    window.jcFetchDateRows=async function(dateStr,withSnapshots=false,force=false){
      const ds=String(dateStr||'');
      try{
        if(!withSnapshots && !force && typeof qcProOverviewRowsCache!=='undefined'){
          const cached=qcProOverviewRowsCache.get(ds);
          if(cached?.data?.length){
            return {data:cached.data,error:null,fromPredictionSnapshot:true,fromStaticFirst:true};
          }
        }
      }catch(_){}
      if((location.pathname==='/' || /\/index\.html$/.test(location.pathname)) && !allowOverviewDate(ds)){
        return {data:[],error:null,fromStaticFirstSkipped:true};
      }
      return originalFetchDate(dateStr,withSnapshots,force);
    };
  }

  const originalAttachSnapshots=typeof jcAttachLatestSnapshots==='function' ? jcAttachLatestSnapshots : null;
  if(originalAttachSnapshots){
    window.jcAttachLatestSnapshots=async function(rows){
      if(!Array.isArray(rows) || !rows.length) return rows||[];
      try{
        const onOverview=location.pathname==='/' || /\/index\.html$/.test(location.pathname);
        if(onOverview){
          const needed=rows.filter(m=>m?._jcLatestSnapshotsLoaded || (typeof jcScoreInfo==='function' && jcScoreInfo(m)?.finished));
          if(needed.length!==rows.length){
            if(needed.length) await originalAttachSnapshots(needed);
            return rows;
          }
        }
      }catch(_){}
      return originalAttachSnapshots(rows);
    };
  }
})();