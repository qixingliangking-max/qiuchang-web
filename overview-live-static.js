// Static-first public schedule reader.
// This file contains only public fixture, score/status and local crest paths.
// It never reads Pro snapshots or model/AI fields.
(function(){
  if(typeof window==='undefined') return;
  const memory=new Map();
  let manifestPromise=null;
  const manifestKey='qc-live-schedule-manifest-v1';
  const localKey=ds=>'qc-live-schedule-v1-'+ds;

  function readJson(key){
    try{ return JSON.parse(localStorage.getItem(key)||'null'); }catch(_){ return null; }
  }
  function writeJson(key,value){
    try{ localStorage.setItem(key,JSON.stringify(value)); }catch(_){}
  }
  function normalizeRows(payload,ds){
    const rows=Array.isArray(payload?.rows)?payload.rows:[];
    const count=Number(payload?.match_count||0);
    if(!rows.length || rows.length!==count || rows.some(m=>
      !m?.id || String(m.business_date||'')!==ds || !m.home_team_name || !m.away_team_name
    )) return null;
    const catalog=window.QC_TEAM_LOGO_CATALOG||{};
    return rows.map(row=>{
      const m={...row};
      const home=String(m.home_team_name||''),away=String(m.away_team_name||'');
      m._homeLogoUrl=catalog.by_team?.[home]||m._homeLogoUrl||'';
      m._awayLogoUrl=catalog.by_team?.[away]||m._awayLogoUrl||'';
      m._jcScheduleSnapshot=true;
      m._qcStaticLiveSchedule=true;
      m.jc_model_outputs=[];
      // Only publicly collected official odds are embedded in this static
      // schedule. Locked predictions and AI remain server-protected.
      const staticOdds=Array.isArray(m.jc_market_snapshots)
        ? m.jc_market_snapshots.filter(x=>x && ['had','hhad','crs','ttg','hafu'].includes(x.pool_code))
        : [];
      m.jc_market_snapshots=staticOdds;
      // If the public odds publisher has not run yet, the original safe
      // market hydration stays enabled as a backwards-compatible fallback.
      m._jcLatestSnapshotsLoaded=Boolean(m._jcMarketsComplete && staticOdds.length);
      m._jcModelsLoaded=false;
      m._jcModelsLoading=false;
      m._jcModelLoadFailed=false;
      return m;
    });
  }
  async function loadManifest(force=false){
    if(!force && manifestPromise) return manifestPromise;
    const cached=readJson(manifestKey);
    manifestPromise=fetch('data/overview/live-schedule-manifest.json',{cache:'no-cache'})
      .then(async res=>{
        if(!res.ok) throw new Error('live schedule manifest HTTP '+res.status);
        const value=await res.json();
        if(value?.version!==1 || !value?.dates || typeof value.dates!=='object')
          throw new Error('invalid live schedule manifest');
        writeJson(manifestKey,value);
        return value;
      })
      .catch(error=>{
        if(cached?.version===1 && cached?.dates) return cached;
        throw error;
      });
    return manifestPromise;
  }
  async function qcFetchLiveScheduleDate(dateStr,force=false){
    const ds=String(dateStr||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return null;
    const cached=memory.get(ds);
    if(!force && cached?.result) return cached.result;
    const local=readJson(localKey(ds));
    // Paint a previously validated static copy immediately. Check the manifest
    // and refresh its cache in the background so page entry never waits on network.
    if(!force && local?.payload){
      const localRows=normalizeRows(local.payload,ds);
      if(localRows){
        const localResult={data:localRows,error:null,fromScheduleSnapshot:true,
          fromLiveStaticSchedule:true,fromLocalCache:true};
        memory.set(ds,{version:local.version,result:localResult});
        loadManifest(true).then(async manifest=>{
          const entry=manifest.dates?.[ds];
          if(!entry || entry.version===local.version) return;
          const response=await fetch(entry.file+'?v='+encodeURIComponent(entry.version),{cache:'force-cache'});
          if(!response.ok) return;
          const payload=await response.json();
          if(payload?.business_date!==ds || Number(payload.match_count)!==Number(entry.match_count)) return;
          const rows=normalizeRows(payload,ds);
          if(!rows) return;
          writeJson(localKey(ds),{version:entry.version,payload});
          const result={data:rows,error:null,fromScheduleSnapshot:true,fromLiveStaticSchedule:true};
          memory.set(ds,{version:entry.version,result});
        }).catch(()=>{});
        return localResult;
      }
    }
    try{
      const manifest=await loadManifest(force);
      const entry=manifest.dates?.[ds];
      if(!entry || typeof entry.file!=='string' || !/^[\w./-]+\.json$/.test(entry.file)) {
        if(local?.version && local?.payload) {
          const rows=normalizeRows(local.payload,ds);
          if(rows) return {data:rows,error:null,fromScheduleSnapshot:true,fromLiveStaticSchedule:true,fromLocalCache:true};
        }
        return null;
      }
      if(!force && local?.version===entry.version && local?.payload){
        const rows=normalizeRows(local.payload,ds);
        if(rows){
          const result={data:rows,error:null,fromScheduleSnapshot:true,fromLiveStaticSchedule:true,fromLocalCache:true};
          memory.set(ds,{version:entry.version,result});
          // Refresh the static file quietly; the cached copy already painted.
          fetch(entry.file+'?v='+encodeURIComponent(entry.version),{cache:'force-cache'})
            .then(res=>res.ok?res.json():null)
            .then(payload=>{
              if(!payload || Number(payload.match_count)!==Number(entry.match_count)) return;
              writeJson(localKey(ds),{version:entry.version,payload});
            }).catch(()=>{});
          return result;
        }
      }
      const response=await fetch(entry.file+'?v='+encodeURIComponent(entry.version),{cache:'force-cache'});
      if(!response.ok) throw new Error('live schedule HTTP '+response.status);
      const payload=await response.json();
      if(payload?.business_date!==ds || Number(payload.match_count)!==Number(entry.match_count))
        throw new Error('live schedule integrity check failed');
      const rows=normalizeRows(payload,ds);
      if(!rows) throw new Error('live schedule row validation failed');
      writeJson(localKey(ds),{version:entry.version,payload});
      const result={data:rows,error:null,fromScheduleSnapshot:true,fromLiveStaticSchedule:true};
      memory.set(ds,{version:entry.version,result});
      return result;
    }catch(error){
      console.warn('静态赛程读取失败，回退兼容读取',ds,error);
      if(local?.payload){
        const rows=normalizeRows(local.payload,ds);
        if(rows) return {data:rows,error:null,fromScheduleSnapshot:true,fromLiveStaticSchedule:true,fromLocalCache:true};
      }
      return null;
    }
  }
  // Public fixture dates are visible as soon as intake publishes static JSON,
  // independently of whether the 12:00-next-10:00 business day has started.
  window.qcGetPublishedScheduleDates=async function(){
    try{
      const manifest=await loadManifest();
      return Object.keys(manifest?.dates||{}).filter(ds=>
        /^\d{4}-\d{2}-\d{2}$/.test(ds) &&
        manifest.dates[ds]?.match_count>0);
    }catch(error){
      console.warn('公开静态赛程日期索引暂不可用',error);
      return [];
    }
  };
  window.qcFetchLiveScheduleDate=qcFetchLiveScheduleDate;

})();