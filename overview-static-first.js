// Static-first overview hotfix.
// Keeps the homepage on locked/static snapshots for first paint and avoids
// eager bulk preloading. Live score/status can still refresh after paint.

(function(){
  if(typeof window==='undefined') return;

  const originalPrime=window.qcPrimeProOverviewSnapshots;
  if(typeof originalPrime==='function'){
    window.qcPrimeProOverviewSnapshots=async function(){ return null; };
  }

  const originalFetchOverview=window.jcFetchOverviewDateRows;
  if(typeof originalFetchOverview==='function'){
    window.jcFetchOverviewDateRows=async function(dateStr,force=false){
      try{
        if(!force && window.qcSupabase && typeof window.qcCacheProOverviewSnapshot==='function'){
          const {data:sessionData}=await window.qcSupabase.auth.getSession();
          if(sessionData?.session){
            const {data,error}=await window.qcSupabase
              .from('jc_overview_prediction_snapshots')
              .select('business_date,payload,generated_at')
              .eq('business_date',dateStr)
              .limit(1);
            const record=!error && Array.isArray(data) ? data[0] : null;
            if(record){
              const snap=window.qcCacheProOverviewSnapshot(record);
              if(snap) return snap;
            }
          }
        }
      }catch(_){}
      return originalFetchOverview(dateStr,force);
    };
  }

  const originalFetchDate=window.jcFetchDateRows;
  if(typeof originalFetchDate==='function'){
    window.jcFetchDateRows=async function(dateStr,withSnapshots=false,force=false){
      try{
        if(!withSnapshots && window.qcProOverviewRowsCache){
          const cached=window.qcProOverviewRowsCache.get(String(dateStr||''));
          if(cached?.data?.length){
            return {data:cached.data,error:null,fromPredictionSnapshot:true,fromStaticFirst:true};
          }
        }
      }catch(_){}
      return originalFetchDate(dateStr,withSnapshots,force);
    };
  }

  const originalAttachSnapshots=window.jcAttachLatestSnapshots;
  if(typeof originalAttachSnapshots==='function'){
    window.jcAttachLatestSnapshots=async function(rows){
      if(!Array.isArray(rows) || !rows.length) return rows||[];
      try{
        const path=location.pathname||'/';
        const onOverview=path==='/' || /\/index\.html$/.test(path);
        if(onOverview){
          const needed=rows.filter(m=>m?._jcLatestSnapshotsLoaded || window.jcScoreInfo?.(m)?.finished);
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