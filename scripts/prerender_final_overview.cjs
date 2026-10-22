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
        !Array.isArray(r.jc_model_outputs) || !r.jc_model_outputs.length;
    })) throw Error('Unsettled/incomplete public history');
    // Use exactly the existing public hit/score renderer, not a new scoring model.
    const ctx = {window: {QC_TEAM_LOGO_CATALOG: {}}, document: {addEventListener() {}},
      location: {}, localStorage: {}, sessionStorage: {}, console: {log() {}, warn() {}, error() {}}};
    vm.createContext(ctx);
    vm.runInContext(read('app.js'), ctx, {filename: 'app.js', timeout: 5000});
    markup = ctx.jcRenderYesterdayReview(rows, today);
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
  'if(c.getAttribute("data-qc-final-date")!==d){c.textContent="正在加载中…";c.removeAttribute("data-qc-final-date");',
  'var m=document.getElementById("jcYesterdayMeta");if(m)m.textContent="正在加载中…";}',
  '})();</script>'
].join('');
const block = markup
  ? '<div id="jcYesterdayCards" data-qc-final-date="' + yesterday +
    '" data-qc-final-count="' + count + '">' + markup + '</div>\n      ' + guard
  : '<div id="jcYesterdayCards"><div class="jc-review-empty">正在加载中…</div></div>';
let result = current.slice(0, start) + '      ' + block + current.slice(end);
result = result.replace(
  /(<span class="section-meta" id="jcYesterdayMeta">)[^<]*(<\/span>)/,
  '$1' + (markup ? yesterday.slice(5) + ' · ' + count + '场' : '正在加载中…') + '$2'
);
if (result !== current) {
  fs.writeFileSync(file, result, 'utf8');
  console.log('Public homepage archive:', markup ? yesterday + ' ' + count + ' finalized' : 'expired');
} else console.log('Public homepage archive unchanged');
