const $ = s => document.querySelector(s);

function attemptSummary(detail){
  if(!detail) return '';

  const rows = [];
  for(const a of detail.directAttempts || []){
    rows.push('直连 ' + (a.label || '') + '：' +
      (a.status ? 'HTTP ' + a.status + ' ' + (a.contentType || '') : (a.error || '失败')));
  }

  for(const p of detail.pageAttempts || []){
    const pageName = (p.page && p.page.url) ? new URL(p.page.url).hostname : '官方页';
    if(p.error === 'ACCESS_RESTRICTED'){
      rows.push(pageName + '：Access Restricted');
      continue;
    }
    for(const a of p.attempts || []){
      rows.push(pageName + ' ' + (a.label || '') + '：' +
        (a.status ? 'HTTP ' + a.status + ' ' + (a.contentType || '') : (a.error || '失败')));
    }
  }

  return rows.slice(0,6).join('\n');
}

async function refresh(){
  const data = await chrome.storage.local.get(['collectorToken','autoSync','lastResult','lastSyncAt']);
  $('#tokenInput').value = data.collectorToken || '';
  $('#autoSync').checked = data.autoSync !== false;

  if(!data.lastResult){
    $('#statusText').textContent = '尚未同步';
    $('#statusDetail').textContent = '';
    return;
  }

  const r = data.lastResult;
  if(r.ok){
    $('#statusText').textContent = r.scheduleOnly ? '赛程同步成功' : '同步成功';
    $('#statusDetail').textContent =
      '读取 ' + (r.matchesReceived || 0) + ' 场 · 写入 ' + (r.matchesUpserted || 0) +
      ' 场 · 新增 ' + (r.snapshotsInserted || 0) + ' 条快照' +
      (r.scheduleOnly ? '\n赛程已入库；奖金玩法数据继续接入中。' : '') +
      (r.method ? '\n方式：' + r.method : '') +
      (data.lastSyncAt ? '\n' + new Date(data.lastSyncAt).toLocaleString('zh-CN') : '');
  }else{
    $('#statusText').textContent = r.message || '同步失败';
    const summary = attemptSummary(r.detail);
    $('#statusDetail').textContent = (r.error || '') + (summary ? '\n' + summary : '');
  }
}

$('#saveTokenBtn').onclick = async () => {
  const token = $('#tokenInput').value.trim();
  if(!token.startsWith('qc_col_')){
    alert('采集器凭证格式不正确');
    return;
  }
  await chrome.storage.local.set({collectorToken:token});
  alert('凭证已保存');
};

$('#syncBtn').onclick = async () => {
  const btn = $('#syncBtn');
  btn.disabled = true;
  btn.textContent = '同步中…';
  $('#statusText').textContent = '正在检测本机网络并读取竞彩网…';
  $('#statusDetail').textContent = '';
  try{
    const result = await chrome.runtime.sendMessage({type:'RUN_SYNC'});
    await refresh();
    if(result && result.ok) alert('同步成功');
  }catch(err){
    $('#statusText').textContent = '扩展运行失败';
    $('#statusDetail').textContent = String(err);
  }finally{
    btn.disabled = false;
    btn.textContent = '立即同步';
  }
};

$('#openBtn').onclick = () => {
  chrome.tabs.create({url:'https://www.sporttery.cn/jc/zqszsc/index.html'});
};

$('#autoSync').onchange = async e => {
  await chrome.runtime.sendMessage({type:'SET_AUTO_SYNC',enabled:e.target.checked});
};

refresh();
