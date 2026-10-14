// Minimal dashboard-only script; actual admin authorization is enforced by
// SECURITY DEFINER RPC functions, not by this browser-side session check.
(function(){
  'use strict';
  const root=document.getElementById('adminRoot');
  if(!root)return;
  const el=id=>document.getElementById(id);
  const txt=(id,v)=>{const node=el(id);if(node)node.textContent=String(v??'—');};
  const dateText=value=>{
    if(!value)return '—';
    const d=new Date(value);
    return Number.isNaN(d.getTime())?'—':d.toLocaleString('zh-CN',{
      year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'
    });
  };
  const onError=(id,msg)=>txt(id,msg);
  async function init(){
    const db=window.qcSupabase;
    if(!db){
      root.insertAdjacentHTML('afterbegin','<p class="admin-note">账号服务未能加载，请检查网络后刷新。</p>');
      onError('adminCollectorSummary','连接未就绪');
      onError('adminLogSummary','连接未就绪');
      return;
    }
    let session;
    try{
      const result=await db.auth.getSession();
      session=result.data?.session;
      if(result.error)throw result.error;
    }catch(error){
      console.warn('管理员会话初始化失败',error);
      root.insertAdjacentHTML('afterbegin','<p class="admin-note">账号服务响应较慢，请稍后刷新。</p>');
      return;
    }
    if(!session?.user){
      location.href='login.html?v=20260926login3&next='+encodeURIComponent('admin.html');
      return;
    }
    let stats;
    try{
      const result=await db.rpc('admin_dashboard_stats');
      if(result.error)throw result.error;
      stats=result.data;
    }catch(error){
      console.warn('管理员权限校验失败',error);
      root.insertAdjacentHTML('afterbegin','<p class="admin-note">后台权限验证失败，请确认管理员账号登录状态。</p>');
      return;
    }
    txt('adminUsers',stats?.users??0);
    txt('adminProUsers',stats?.pro_users??0);
    txt('adminUnusedCodes',stats?.unused_codes??0);
    txt('adminUsedCodes',stats?.used_codes??0);

    // Each small module updates independently. A slow activity endpoint must
    // not keep today's user or collector information in a loading state.
    const tasks=[
      (async()=>{
        const {data,error}=await db.rpc('admin_user_overview');
        if(error)throw error;
        txt('adminTodayNew',data?.today_new??0);
        txt('adminLogin24h',data?.active_24h??data?.login_24h??0);
      })().catch(err=>{
        console.warn('后台用户概览读取失败',err);
        onError('adminTodayNew','—');onError('adminLogin24h','—');
      }),
      (async()=>{
        const {data,error}=await db.from('jc_sync_runs')
          .select('status,finished_at,started_at,matches_received,snapshots_inserted')
          .order('started_at',{ascending:false}).limit(1);
        if(error)throw error;
        const run=data?.[0];
        txt('adminCollectorSummary',run
          ? '历史保留 · 最近同步 '+dateText(run.finished_at||run.started_at)
          : '历史保留 · 暂无同步记录');
      })().catch(err=>{
        console.warn('后台采集状态读取失败',err);
        onError('adminCollectorSummary','采集状态暂时无法读取');
      }),
      (async()=>{
        const {data,error}=await db.rpc('admin_system_activity',{p_limit:1});
        if(error)throw error;
        const event=data?.[0];
        txt('adminLogSummary',event
          ? dateText(event.event_time)+' · '+String(event.title||'系统活动')
          : '暂无系统活动');
      })().catch(err=>{
        console.warn('后台活动概览读取失败',err);
        onError('adminLogSummary','系统活动暂时无法读取');
      })
    ];
    await Promise.allSettled(tasks);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
