/* Lightweight admin operations: codes, collector, activity.
   Model data, predictions, account permissions and RPC contracts unchanged.
   Replaces a 210KB public app bundle only on the three admin operation pages. */
(function(){
  'use strict';
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const qcEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  async function qcAdminSession(root,nextPage){
  if(!window.qcSupabase){
    if(root) root.innerHTML='<div class="profile-card">数据库连接失败，请刷新页面后重试。</div>';
    return null;
  }

  // Admin pages already make an authoritative SECURITY DEFINER RPC below.
  // Use the locally cached auth session first instead of an extra getUser()
  // network round-trip; this materially improves WeChat/mobile admin loading.
  const {data:sessionData,error:sessionError}=await window.qcSupabase.auth.getSession();
  const session=sessionData?.session||null;
  const user=session?.user||null;
  if(sessionError||!user){
    location.href='login.html?v=20260926login3&next='+encodeURIComponent(nextPage||'admin.html');
    return null;
  }

  const {data:stats,error}=await window.qcSupabase.rpc('admin_dashboard_stats');
  if(error){
    const raw=String(error.message||'');
    if(root){
      root.innerHTML=
        '<div class="profile-card"><h2>管理员验证未通过</h2>'+
        '<p style="color:var(--muted);line-height:1.7">'+
        qcEscape(raw.includes('ADMIN_REQUIRED')?'当前账号没有管理员权限':'管理员权限校验失败')+
        '。</p><a class="small-btn" href="admin.html">返回后台</a></div>';
    }
    return null;
  }
  return {user,stats};
}

function qcAdminFmt(v){
  if(!v) return '—';
  return new Date(v).toLocaleString('zh-CN',{
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'
  });
}


  async function setupAdminCodes(){
  const root=$('#adminCodesRoot');
  if(!root) return;

  const form=$('#createCodeForm');
  const submitBtn=form?.querySelector('button[type="submit"]')||null;
  const hint=$('#adminHint');
  const box=$('#createdCodeBox');
  if(submitBtn){
    submitBtn.disabled=true;
    submitBtn.textContent='正在连接…';
  }

  const session=await qcAdminSession(root,'admin-codes.html');
  if(!session) return;

  const applyStats=(stats)=>{
    if(!stats) return;
    if($('#codesUnused')) $('#codesUnused').textContent=stats.unused_codes??0;
    if($('#codesUsed')) $('#codesUsed').textContent=stats.used_codes??0;
  };
  applyStats(session.stats);

  const loadCodes=async({refreshStats=false}={})=>{
    const rows=$('#redeemCodeRows');
    try{
      const tasks=[window.qcSupabase.rpc('admin_redeem_codes')];
      if(refreshStats) tasks.push(window.qcSupabase.rpc('admin_dashboard_stats'));
      const results=await Promise.all(tasks);
      const codesResult=results[0];
      const statsResult=results[1];
      if(statsResult?.data) applyStats(statsResult.data);

      if(!rows) return;
      if(codesResult.error){
        rows.innerHTML='<tr><td colspan="6">兑换码读取失败，可稍后刷新重试</td></tr>';
        return;
      }
      const codes=codesResult.data||[];
      if(!codes.length){
        rows.innerHTML='<tr><td colspan="6">暂无兑换码</td></tr>';
        return;
      }

      rows.innerHTML=codes.map(item=>{
        const statusText=item.status==='unused'?'未使用':item.status==='used'?'已使用':'已停用';
        return '<tr>'+
          '<td><strong>'+qcEscape(item.code||'—')+'</strong></td>'+
          '<td>'+qcEscape(item.duration_days)+'天</td>'+
          '<td>'+qcEscape(statusText)+'</td>'+
          '<td>'+qcEscape(item.used_by_email||'—')+'</td>'+
          '<td>'+qcEscape(qcAdminFmt(item.created_at))+'</td>'+
          '<td>'+qcEscape(qcAdminFmt(item.used_at))+'</td>'+
        '</tr>';
      }).join('');
    }catch(err){
      console.error('admin redeem codes load failed',err);
      if(rows) rows.innerHTML='<tr><td colspan="6">网络较慢，兑换码列表稍后自动刷新</td></tr>';
    }
  };

  // Bind the form before the heavier list refresh. Previously the page waited
  // for multiple RPCs before attaching onsubmit, so tapping early looked broken.
  if(form){
    form.onsubmit=async e=>{
      e.preventDefault();
      if(form.dataset.submitting==='1') return;

      const days=Number($('#codeDays').value);
      const note=($('#codeNote').value||'').trim();
      if(!Number.isInteger(days)||days<1||days>3650){
        alert('会员天数请输入 1–3650 之间的整数');
        return;
      }

      form.dataset.submitting='1';
      if(submitBtn){
        submitBtn.disabled=true;
        submitBtn.textContent='生成中…';
      }
      if(hint){hint.textContent='正在生成兑换码…';hint.className='code-hint';}

      try{
        const {data,error}=await window.qcSupabase.rpc('create_redeem_code',{
          p_duration_days:days,p_note:note||null
        });

        if(error){
          const raw=String(error.message||'');
          let msg='兑换码生成失败';
          if(raw.includes('ADMIN_REQUIRED')) msg='当前账号没有管理员权限';
          if(raw.includes('INVALID_DURATION')) msg='会员天数不正确';
          if(raw.includes('NOT_AUTHENTICATED')) msg='登录状态已失效，请重新登录';
          if(hint){hint.textContent=msg;hint.className='code-hint error';}
          return;
        }

        if(!data?.code) throw new Error('EMPTY_REDEEM_CODE_RESPONSE');
        if($('#createdCode')) $('#createdCode').textContent=data.code;
        if(box) box.hidden=false;
        if(hint){hint.textContent='已生成 '+data.duration_days+' 天 Pro 会员兑换码。';hint.className='code-hint success';}
        if($('#codeNote')) $('#codeNote').value='';

        // Do not make the successful action wait for the list/stat refresh.
        loadCodes({refreshStats:true}).catch(()=>{});
      }catch(err){
        console.error('create redeem code failed',err);
        if(hint){
          hint.textContent='网络响应异常，请先看“最近兑换码”是否已生成，再决定是否重试。';
          hint.className='code-hint error';
        }
        loadCodes({refreshStats:true}).catch(()=>{});
      }finally{
        form.dataset.submitting='0';
        if(submitBtn){
          submitBtn.disabled=false;
          submitBtn.textContent='生成兑换码';
        }
      }
    };
  }

  const copyBtn=$('#copyCodeBtn');
  if(copyBtn){
    copyBtn.onclick=async()=>{
      const code=($('#createdCode')?.textContent||'').trim();
      if(!code||code==='—') return;
      try{
        await navigator.clipboard.writeText(code);
        copyBtn.textContent='已复制';
        setTimeout(()=>copyBtn.textContent='复制',1200);
      }catch{
        alert('复制失败，请手动复制');
      }
    };
  }

  if(submitBtn){
    submitBtn.disabled=false;
    submitBtn.textContent='生成兑换码';
  }

  // Initial list load runs in the background and no longer blocks the button.
  loadCodes().catch(()=>{});
}
async function setupAdminData(){
  const root=$('#adminDataRoot');
  if(!root) return;

  const session=await qcAdminSession(root,'admin-data.html');
  if(!session) return;

  // The two exact aggregate counts are informational and should not hold
  // up collector status or the recent-run list on mobile connections.
  void Promise.resolve(window.qcSupabase.from('jc_matches')
    .select('*',{count:'exact',head:true})).then(({count,error})=>{
      if(!error && $('#dataMatchCount')) $('#dataMatchCount').textContent=count??0;
  }).catch(err=>console.warn('竞彩比赛数量读取失败',err));
  void Promise.resolve(window.qcSupabase.from('jc_market_snapshots')
    .select('*',{count:'exact',head:true})).then(({count,error})=>{
      if(!error && $('#dataSnapshotCount')) $('#dataSnapshotCount').textContent=count??0;
  }).catch(err=>console.warn('奖金快照数量读取失败',err));

  // One run-history request provides BOTH the latest status and the 30-row
  // history; the previous version fetched jc_sync_runs twice.
  const [collectorResult,runsResult]=await Promise.all([
    window.qcSupabase.from('jc_collector_devices')
      .select('name,status,last_seen_at,last_success_at,last_error')
      .order('created_at',{ascending:false}).limit(1),
    window.qcSupabase.from('jc_sync_runs')
      .select('status,started_at,finished_at,matches_received,matches_upserted,snapshots_inserted,error_message,source')
      .order('started_at',{ascending:false}).limit(30)
  ]);
  const latestRunResult={data:runsResult.data?.slice(0,1)||[]};

  const run=latestRunResult.data&&latestRunResult.data[0];
  if($('#dataLastSync')){
    $('#dataLastSync').textContent=run?qcAdminFmt(run.finished_at||run.started_at)+' · '+String(run.status||'—'):'尚无记录';
  }

  const collector=collectorResult.data&&collectorResult.data[0];
  if($('#dataCollectorStatus')){
    if(!collector) $('#dataCollectorStatus').textContent='尚未创建';
    else if(collector.last_success_at) $('#dataCollectorStatus').textContent='最近成功 '+qcAdminFmt(collector.last_success_at);
    else if(collector.last_seen_at) $('#dataCollectorStatus').textContent='最近连接 '+qcAdminFmt(collector.last_seen_at);
    else $('#dataCollectorStatus').textContent='已保留';
  }

  const rows=$('#dataRunRows');
  if(rows){
    const items=runsResult.data||[];
    rows.innerHTML=items.length?items.map(x=>{
      const detail=String(x.matches_received??0)+'场 / '+String(x.snapshots_inserted??0)+'条快照';
      return '<tr>'+
        '<td>'+qcEscape(qcAdminFmt(x.finished_at||x.started_at))+'</td>'+
        '<td>'+qcEscape(x.status||'—')+'</td>'+
        '<td>'+qcEscape(detail)+'</td>'+
        '<td>'+qcEscape(x.error_message||'—')+'</td>'+
      '</tr>';
    }).join(''):'<tr><td colspan="4">暂无历史同步记录</td></tr>';
  }

  const createCollectorBtn=$('#createCollectorBtn');
  if(createCollectorBtn){
    createCollectorBtn.onclick=async()=>{
      if(!confirm('确认创建一个新的 Windows 采集器凭证？旧凭证和历史数据不会删除。')) return;
      const hint=$('#jcSyncHint');
      createCollectorBtn.disabled=true;
      createCollectorBtn.textContent='创建中…';
      const {data,error}=await window.qcSupabase.rpc('create_collector_device',{p_name:'Windows Auto Collector'});
      createCollectorBtn.disabled=false;
      createCollectorBtn.textContent='创建新的采集器凭证';
      if(error||!data?.ok){
        const msg='采集器凭证创建失败';
        if(hint){hint.textContent=msg;hint.className='code-hint error';}
        alert(msg);
        return;
      }
      if($('#collectorToken')) $('#collectorToken').textContent=data.token;
      if($('#collectorTokenBox')) $('#collectorTokenBox').hidden=false;
      if(hint){hint.textContent='凭证已创建。只在需要重新启用本机采集器时使用。';hint.className='code-hint success';}
    };
  }

  const copyCollectorTokenBtn=$('#copyCollectorTokenBtn');
  if(copyCollectorTokenBtn){
    copyCollectorTokenBtn.onclick=async()=>{
      const token=($('#collectorToken')?.textContent||'').trim();
      if(!token||token==='—') return;
      try{
        await navigator.clipboard.writeText(token);
        copyCollectorTokenBtn.textContent='已复制';
        setTimeout(()=>copyCollectorTokenBtn.textContent='复制',1200);
      }catch{
        alert('复制失败，请手动复制');
      }
    };
  }
}

async function setupAdminLogs(){
  const root=$('#adminLogsRoot');
  if(!root)return;
  const session=await qcAdminSession(root,'admin-logs.html');
  if(!session)return;

  const rows=$('#adminLogRows');
  const meta=$('#adminLogMeta');
  const errorBox=$('#adminLogError');
  const more=$('#adminLogMore');
  const refresh=$('#adminLogRefresh');
  const typeRoot=$('#adminLogTypes');
  const dayRoot=$('#adminLogDays');
  const pageSize=50;
  let category='ops', days=7, events=[],hasMore=false, requestId=0;

  const formatBJ=value=>{
    const date=new Date(value||'');
    if(Number.isNaN(date.getTime()))return '—';
    return date.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false,
      year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  };
  const typeLabel={signup:'用户注册',login:'最近登录',activity:'每日活跃',
    collector:'竞彩采集',score:'比分同步',code:'会员兑换'};
  const statusLabel={success:'成功',failed:'失败',error:'异常',partial:'部分成功',
    blocked:'被拦截',running:'运行中',recorded:'已记录'};
  const dateNames={0:'全部历史',1:'近24小时',7:'近7天',30:'近30天'};

  function renderStats(){
    const set=(id,v)=>{const item=$('#'+id);if(item)item.textContent=String(v);};
    set('logLoadedCount',events.length);
    set('logSignupCount',events.filter(x=>x.event_type==='signup').length);
    set('logLoginCount',events.filter(x=>x.event_type==='login').length);
    set('logCollectorCount',events.filter(x=>x.event_type==='collector').length);
  }
  function renderRows(){
    if(!rows)return;
    rows.innerHTML=events.length?events.map(x=>
      '<tr>'+
        '<td>'+qcEscape(formatBJ(x.event_time))+'</td>'+
        '<td>'+qcEscape(typeLabel[x.event_type]||x.event_type||'其他')+'</td>'+
        '<td><strong>'+qcEscape(x.title||'—')+'</strong></td>'+
        '<td>'+qcEscape(x.detail||'—')+'</td>'+
        '<td>'+qcEscape(statusLabel[x.status]||x.status||'—')+'</td>'+
        '<td>'+qcEscape(x.source_label||'—')+'</td>'+
      '</tr>'
    ).join(''):'<tr><td colspan="6">该条件下暂无已记录事件。可切换「全部历史」或其他分类。</td></tr>';
    renderStats();
    if(more){more.hidden=!hasMore;more.disabled=false;more.textContent='加载更多记录';}
    if(meta)meta.textContent=dateNames[days]+' · 已显示'+events.length+'条'+(hasMore?' · 还有更多':'');
  }
  function showError(msg){
    if(errorBox){errorBox.textContent=msg;errorBox.hidden=false;}
  }
  function clearError(){
    if(errorBox){errorBox.textContent='';errorBox.hidden=true;}
  }
  async function load(reset=true){
    if(reset)events=[];
    const seq=++requestId;
    clearError();
    if(rows && reset)rows.innerHTML='<tr><td colspan="6">正在读取真实活动记录…</td></tr>';
    if(meta)meta.textContent='读取中…';
    if(more){more.disabled=true;more.hidden=true;}
    if(refresh)refresh.disabled=true;
    try{
      const {data,error}=await window.qcSupabase.rpc('admin_system_activity_v2',{
        p_type:category,p_days:days,p_limit:pageSize+1,p_offset:events.length
      });
      if(seq!==requestId)return;
      if(error)throw error;
      if(!Array.isArray(data))throw new Error('活动接口未返回记录列表');
      hasMore=data.length>pageSize;
      events=events.concat(data.slice(0,pageSize));
      renderRows();
    }catch(error){
      if(seq!==requestId)return;
      console.error('真实系统活动读取失败',error);
      const msg='活动记录读取失败：'+String(error?.message||'网络或权限异常').slice(0,170)+'。请刷新重试。';
      showError(msg);
      if(rows && !events.length)rows.innerHTML='<tr><td colspan="6">无法读取系统活动，详细错误显示在表格上方。</td></tr>';
      if(meta)meta.textContent='读取失败';
      if(more && events.length){more.disabled=false;more.hidden=false;more.textContent='重新加载';}
    }finally{
      if(seq===requestId && refresh)refresh.disabled=false;
    }
  }

  typeRoot?.querySelectorAll('button[data-type]').forEach(btn=>{
    btn.onclick=()=>{
      const next=btn.dataset.type||'ops';
      if(next===category)return;
      category=next;
      typeRoot.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn));
      load(true);
    };
  });
  dayRoot?.querySelectorAll('button[data-days]').forEach(btn=>{
    btn.onclick=()=>{
      const next=Number(btn.dataset.days);
      if(next===days)return;
      days=next;
      dayRoot.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn));
      load(true);
    };
  });
  if(more)more.onclick=()=>{if(!more.disabled)load(false);};
  if(refresh)refresh.onclick=()=>load(true);
  await load(true);
}

  function init(){
    const tasks=[
      ['兑换码管理',setupAdminCodes],
      ['数据采集中心',setupAdminData],
      ['系统活动',setupAdminLogs]
    ];
    for(const [name,fn] of tasks){
      try{Promise.resolve(fn()).catch(err=>console.error(name+'初始化失败',err));}
      catch(err){console.error(name+'初始化失败',err);}
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();