const $ = s => document.querySelector(s);

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
    $('#statusText').textContent = '同步成功';
    $('#statusDetail').textContent =
      '读取 ' + (r.matchesReceived || 0) + ' 场 · 写入 ' + (r.matchesUpserted || 0) +
      ' 场 · 新增 ' + (r.snapshotsInserted || 0) + ' 条快照' +
      (data.lastSyncAt ? ' · ' + new Date(data.lastSyncAt).toLocaleString('zh-CN') : '');
  }else{
    $('#statusText').textContent = r.message || '同步失败';
    $('#statusDetail').textContent = r.error || '';
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
  $('#statusText').textContent = '正在打开竞彩网并读取数据…';
  $('#statusDetail').textContent = '';
  const result = await chrome.runtime.sendMessage({type:'RUN_SYNC'});
  btn.disabled = false;
  btn.textContent = '立即同步';
  await refresh();
  if(result && result.ok){
    alert('同步成功');
  }
};

$('#openBtn').onclick = () => {
  chrome.tabs.create({url:'https://www.sporttery.cn/'});
};

$('#autoSync').onchange = async e => {
  await chrome.runtime.sendMessage({type:'SET_AUTO_SYNC',enabled:e.target.checked});
};

refresh();
