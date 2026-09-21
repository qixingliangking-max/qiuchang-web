const $=s=>document.querySelector(s);

function diagText(r){
  if(!r) return '';
  if(r.ok){
    return '识别 '+(r.parsedMatches||0)+' 场 · 写入 '+(r.matchesUpserted||0)+' 场 · 快照 '+(r.snapshotsInserted||0)+' 条\n来源：'+(r.source||'—');
  }
  let extra='';
  const frames=r.diagnostics || [];
  if(frames.length){
    const f=frames[0];
    const d=f.diagnostics || {};
    extra='\n页面：'+(d.title||'—')+'\n表格 '+(d.tableCount??'—')+' · 行 '+(d.trCount??'—')+' · iframe '+(d.iframeCount??'—');
    if(d.bodyPrefix) extra+='\n文字：'+d.bodyPrefix.slice(0,180);
  }
  return (r.error||'失败')+extra;
}

async function refresh(){
  const data=await chrome.storage.local.get(['collectorToken','autoSync','lastResult','last500Result','lastSyncAt','last500SyncAt']);
  $('#tokenInput').value=data.collectorToken || '';
  $('#autoSync').checked=data.autoSync!==false;
  const r=data.last500Result || data.lastResult;
  if(!r){
    $('#statusText').textContent='尚未测试';
    $('#statusDetail').textContent='';
    return;
  }
  $('#statusText').textContent=r.ok ? (r.message || '成功') : (r.message || '失败');
  $('#statusDetail').textContent=diagText(r);
}

$('#saveTokenBtn').onclick=async()=>{
  const token=$('#tokenInput').value.trim();
  if(!token.startsWith('qc_col_')){ alert('采集器凭证格式不正确'); return; }
  await chrome.storage.local.set({collectorToken:token});
  alert('凭证已保存');
};

async function run(button,type,label){
  button.disabled=true;
  const old=button.textContent;
  button.textContent='测试中…';
  $('#statusText').textContent='正在打开 '+label+'…';
  $('#statusDetail').textContent='';
  try{
    const result=await chrome.runtime.sendMessage({type});
    $('#statusText').textContent=result?.ok ? (result.message || '成功') : (result?.message || '失败');
    $('#statusDetail').textContent=diagText(result);
    if(result?.ok) alert(label+'测试成功');
  }catch(err){
    $('#statusText').textContent='扩展运行失败';
    $('#statusDetail').textContent=String(err);
  }finally{
    button.disabled=false;
    button.textContent=old;
  }
}

$('#syncBtn').onclick=()=>run($('#syncBtn'),'RUN_SYNC','官方竞彩页');
$('#sync500Btn').onclick=()=>run($('#sync500Btn'),'RUN_500_SYNC','500.com');

$('#autoSync').onchange=async e=>{
  await chrome.runtime.sendMessage({type:'SET_AUTO_SYNC',enabled:e.target.checked});
};

refresh();