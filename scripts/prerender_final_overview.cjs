'use strict';
// Build-time rendering of completed PUBLIC history, with no auth or database writes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const yesterday = new Date(Date.parse(today + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
const manifest = JSON.parse(read('data/overview/manifest.json'));
const source = (manifest.dates || {})[yesterday];
const file = path.join(root, 'index.html');
const current = fs.readFileSync(file, 'utf8');
const start = current.indexOf('      <div id="jcYesterdayCards"');
const end = current.indexOf('\n    </section>', start);
if (start < 0 || end < 0 || !current.includes('id="jcYesterdayMeta"')) {
  throw Error('Homepage structure changed; refusing unsafe patch');
}
let markup = null, count = 0;
if (source) {
  const archive = JSON.parse(read(source));
  const rows = archive.rows || [];
  if (archive.business_date !== yesterday) throw Error('Archive date mismatch');
  if (archive.is_final === true) {
    count = Number(archive.match_count);
    if (!count || rows.length !== count || Number(archive.finished_count) !== count ||
        new Set(rows.map(r => String(r.id))).size !== count) {
      throw Error('FINAL history count/ID mismatch');
    }
    const score = /^\d{1,2}[:-]\d{1,2}$/;
    if (rows.some(r => {
      const raw = r.raw || {};
      return !score.test(String(raw.sectionsNo999 || '')) ||
        !score.test(String(raw.sectionsNo1 || '')) ||
        !/(已结束|完赛|已完成|finished|final)/i.test(String(r.match_status || '') + String(raw.matchStatusName || '')) ||
        false;
    })) throw Error('Unsettled/incomplete public history');
    // PUBLIC first paint is intentionally scoreboard only. NEVER pre-render
    // locked choices, model predictions or analysis into GitHub Pages HTML.
    const esc = value => String(value ?? '').replace(/[&<>"']/g,
      c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const safeRows = rows.map(r => {
      const id = String(r.id || '');
      if(!/^[0-9a-f-]{36}$/i.test(id)) throw Error('Invalid public fixture ID');
      const ft = String(r.raw.sectionsNo999).replace(':','-');
      const ht = String(r.raw.sectionsNo1).replace(':','-');
      const href = 'jc-match.html?id=' + id;
      const time = String(r.match_time || '').slice(0,5);
      return '<tr class="jc-overview-row" data-match-id="'+id+'" data-href="'+href+'">'+
        '<td class="jc-num"><b>'+esc(String(r.match_num||'').slice(-3))+'</b></td>'+
        '<td class="jc-time"><time>'+esc(time)+'</time></td>'+
        '<td><span class="jc-overview-league">'+esc(r.league_short_name||r.league_name||'')+'</span></td>'+
        '<td><a class="jc-review-match" href="'+href+'">'+
          '<span>'+esc(r.home_team_name)+'</span>'+
          '<span class="jc-score-stack"><strong class="jc-score-full">'+esc(ft)+'</strong>'+
          '<span class="jc-score-half">半 '+esc(ht)+'</span></span>'+
          '<span>'+esc(r.away_team_name)+'</span></a></td>'+
        '<td class="jc-overview-market">🔒 会员专属</td></tr>';
    }).join('');
    markup = '<div class="jc-review-table-wrap"><table class="jc-review-table jc-overview-table">'+
      '<thead><tr><th>编号</th><th>时间</th><th>赛事</th><th>主队 比分 客队</th>'+
      '<th>分析</th></tr></thead><tbody>'+safeRows+'</tbody></table></div>';
    if ((markup.match(/class="jc-overview-row"/g) || []).length !== count ||
        /<script|onerror=|onload=/i.test(markup)) throw Error('Unsafe pre-rendered HTML');
  }
}
if (!markup && !current.includes('data-qc-final-date=')) {
  console.log('No completed previous day; keeping existing incremental history');
  process.exit(0);
}
// A static archive for a former day must not appear after Beijing midnight.
const guard = [
  '<script>(function(){',
  'var c=document.getElementById("jcYesterdayCards");if(!c)return;',
  'var p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(function(x){return [x.type,x.value];}));',
  'var d=new Date(Date.UTC(+p.year,+p.month-1,+p.day-1)).toISOString().slice(0,10);',
  'var q=new URLSearchParams(location.search).get("date");if(c.getAttribute("data-qc-final-date")!==d||(q&&/^\d{4}-\d{2}-\d{2}$/.test(q)&&q!==p.year+"-"+p.month+"-"+p.day)){c.textContent="正在加载中…";c.removeAttribute("data-qc-final-date");',
  'var m=document.getElementById("jcYesterdayMeta");if(m)m.textContent="正在加载中…";}',
  '})();</script>'
].join('');
const block = markup
  ? '<div id="jcYesterdayCards" data-qc-final-date="' + yesterday +
    '" data-qc-final-count="' + count + '">' + markup + '</div>\n      ' + guard
  : '<div id="jcYesterdayCards"><div class="jc-review-empty">昨日完整赛果尚在核验，全部完赛后将自动更新</div></div>';
let result = current.slice(0, start) + '      ' + block + current.slice(end);
result = result.replace(
  /(<span class="section-meta" id="jcYesterdayMeta">)[^<]*(<\/span>)/,
  '$1' + (markup ? yesterday.slice(5) + ' · ' + count + '场' : '等待完整赛果') + '$2'
);
if (result !== current) {
  fs.writeFileSync(file, result, 'utf8');
  console.log('Public homepage archive:', markup ? yesterday + ' ' + count + ' finalized' : 'expired');
} else console.log('Public homepage archive unchanged');
