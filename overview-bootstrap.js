// One-request homepage bootstrap for current schedule/prediction + previous-day review.
// Reads only static snapshot tables through qc_get_overview_bootstrap(date).
(function(){
  if(typeof window==='undefined' || !window.qcSupabase) return;

  const cache=new Map();

  function onOverview(){
    return location.pathname==='/' || /\/index\.html$/.test(location.pathname);
  }
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

  function scheduleResult(record){
    const base=Array.isArray(record?.payload?.rows)?record.payload.rows:[];
    if(!base.length) return null;
    const rows=base.map(row=>Object.assign({},row,{_jcScheduleSnapshot:true,_jcOverviewBootstrap:true}));
    return {data:rows,error:null,fromScheduleSnapshot:true,fromOverviewBootstrap:true};
  }

  function historyResult(record){
    if(!record) return {data:[],error:null,fromHistorySnapshot:true,historyFinal:false,fromOverviewBootstrap:true};
    const rows=typeof qcPrepareHistoryOverviewRows==='function'
      ? qcPrepareHistoryOverviewRows(record)
      : (Array.isArray(record?.payload?.rows)?record.payload.rows:[]);
    rows.forEach(row=>{ row._jcOverviewBootstrap=true; });
    return {
      data:rows,
      error:null,
      fromHistorySnapshot:true,
      historyFinal:Boolean(record?.is_final),
      finishedCount:Number(record?.finished_count||0),
      matchCount:Number(record?.match_count||0),
      historySource:record?.source||null,
      fromOverviewBootstrap:true
    };
  }

  function predictionResult(record){
    if(!record) return null;
    if(typeof qcCacheProOverviewSnapshot==='function'){
      const result=qcCacheProOverviewSnapshot(record);
      if(result){
        (result.data||[]).forEach(row=>{ row._jcOverviewBootstrap=true; });
        result.fromOverviewBootstrap=true;
      }
      return result;
    }
    const rows=Array.isArray(record?.payload?.rows)?record.payload.rows:[];
    if(!rows.length) return null;
    return {data:rows,error:null,fromPredictionSnapshot:true,fromOverviewBootstrap:true};
  }

  async function fetchBundle(ds,force=false){
    const key=String(ds||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;

    const now=Date.now();
    const cached=cache.get(key);
    if(!force && cached?.data && now-cached.savedAt<60000) return cached.data;
    if(!force && cached?.promise) return cached.promise;

    const promise=window.qcSupabase
      .rpc('qc_get_overview_bootstrap',{p_date:key})
      .then(result=>{
        if(result.error) throw result.error;
        const payload=result.data||null;
        cache.set(key,{data:payload,savedAt:Date.now()});
        return payload;
      })
      .catch(error=>{
        cache.delete(key);
        console.warn('首屏静态合并读取失败，回退原静态链路',error);
        return null;
      });

    cache.set(key,{promise,savedAt:now});
    return promise;
  }

  const oldOverview=typeof jcFetchOverviewDateRows==='function' ? jcFetchOverviewDateRows : null;
  if(oldOverview){
    window.jcFetchOverviewDateRows=async function(dateStr,force=false){
      const ds=String(dateStr||'');
      if(onOverview() && !force && ds>=today()){
        const bundle=await fetchBundle(ds,false);
        if(bundle){
          const pred=predictionResult(bundle.prediction);
          if(pred?.data?.length) return pred;
          const sched=scheduleResult(bundle.schedule);
          if(sched?.data?.length) return sched;
        }
      }
      return oldOverview(dateStr,force);
    };
  }

  // Archived public history is already published as immutable GitHub JSON.
  // Never run qc_get_overview_bootstrap just to fetch yesterday's finished
  // fixtures: that costly RPC races the static file and delays Safari renders.
  // qcFetchHistoryOverviewDate in app.js handles archive files and safe fallback.

  const oldPro=typeof qcFetchProOverviewDate==='function' ? qcFetchProOverviewDate : null;
  if(oldPro){
    window.qcFetchProOverviewDate=async function(dateStr){
      const ds=String(dateStr||'');
      if(onOverview()){
        const entry=cache.get(ds);
        // The day's public+Pro bootstrap may already be in flight. Share that
        // request instead of issuing a second protected-snapshot roundtrip.
        const bundle=entry?.data || (entry?.promise ? await entry.promise : null);
        if(bundle?.prediction){
          const pred=predictionResult(bundle.prediction);
          if(pred?.data?.length) return pred;
        }
        // The signed-in Pro bootstrap already checked this date's protected
        // snapshot. If it is absent, do not make a redundant SELECT for the
        // same missing record before the public schedule can paint.
        // Anonymous/expired bootstrap auth still falls back to oldPro.
        if(bundle?.is_pro===true && !bundle.prediction) return null;
      }
      return oldPro(dateStr);
    };
  }

  // An entitlement change or sign-out must invalidate both public and
  // protected in-memory bootstrap snapshots immediately.
  window.qcInvalidateOverviewBootstrap=()=>cache.clear();
  window.qcSupabase.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT') cache.clear();
  });

  window.qcFetchOverviewBootstrap=fetchBundle;
})();