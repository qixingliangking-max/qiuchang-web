// Lightweight pre-lock schedule snapshots for homepage.
// Collected data stays dynamic in Supabase, while the homepage reads a small
// auto-regenerated snapshot until the locked prediction snapshot takes over.
(function(){
  if(typeof window==='undefined' || !window.qcSupabase) return;

  const cache=new Map();

  function today(){
    return typeof qcBeijingToday==='function'
      ? qcBeijingToday()
      : new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }

  function onOverview(){
    return location.pathname==='/' || /\/index\.html$/.test(location.pathname);
  }

  async function fetchScheduleSnapshot(ds,force){
    if(!ds) return null;
    const now=Date.now();
    const cached=cache.get(ds);
    if(!force && cached && now-cached.savedAt<60000) return cached.rows;

    try{
      const result=await window.qcSupabase
        .from('jc_overview_schedule_snapshots')
        .select('business_date,payload,generated_at')
        .eq('business_date',ds)
        .limit(1);

      if(result.error) return null;
      const record=Array.isArray(result.data)?result.data[0]:null;
      const baseRows=Array.isArray(record?.payload?.rows)?record.payload.rows:[];
      if(!baseRows.length) return null;

      const rows=baseRows.map(function(row){
        const m=Object.assign({},row);
        m._jcScheduleSnapshot=true;
        return m;
      });
      cache.set(ds,{rows:rows,savedAt:Date.now()});
      return rows;
    }catch(_){
      return null;
    }
  }

  const oldOverview=typeof jcFetchOverviewDateRows==='function' ? jcFetchOverviewDateRows : null;
  if(oldOverview){
    window.jcFetchOverviewDateRows=async function(dateStr,force){
      const ds=String(dateStr||'');
      if(onOverview() && ds>=today()){
        const rows=await fetchScheduleSnapshot(ds,Boolean(force));
        if(rows) return {data:rows,error:null,fromScheduleSnapshot:true};
      }
      return oldOverview(dateStr,force);
    };
  }

  const oldDate=typeof jcFetchDateRows==='function' ? jcFetchDateRows : null;
  if(oldDate){
    window.jcFetchDateRows=async function(dateStr,withSnapshots,force){
      const ds=String(dateStr||'');
      if(onOverview() && !withSnapshots && ds>=today()){
        const rows=await fetchScheduleSnapshot(ds,Boolean(force));
        if(rows) return {data:rows,error:null,fromScheduleSnapshot:true};
      }
      return oldDate(dateStr,withSnapshots,force);
    };
  }
})();