/* 球场档案 V1.1 专项回测，只读两份GitHub归档。默认不展示历史比赛结果。 */
(()=>{'use strict';
const freeze=window.QC_CURATED_V11_BLIND,results=window.QC_CURATED_V11_COMBO_RESULTS;
const types=[['direction','① 方向'],['htft','② 半全场'],['goals','③ 总进球'],['score','④ 比分2串1'],['scoreThreeLegExperiment','⑤ 比分3串1']];
const dates=Object.keys(freeze.days).sort().reverse(),state={day:dates[0],type:'direction',revealed:false,budget:1000};
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v]));
const money=v=>Number(v).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
function dateLabel(s){return s.slice(5).replace('-','月')+'日'}
function getEntry(d,t){return freeze.days[d]?.entries?.find(x=>x.type===t)}
function getResult(d,t){return results.days[d]?.items?.find(x=>x.type===t)}
function options(e){
 let o=[{names:[],keys:[],odds:1}];
 for(const l of e.legs)o=o.flatMap(c=>l.picks.map(p=>({names:c.names.concat(p.name),keys:c.keys.concat(p.key),odds:c.odds*Number(l.row.mk[l.market].o[p.key])})));
 return o;
}
function details(e,res){
 const all=options(e),cents=Math.round(state.budget*100),unit=Math.floor(cents/all.length),rem=cents-unit*all.length;
 const actual=res?.known?.map(x=>x.actual)||[];
 return '<details class="details"><summary>查看'+all.length+'种组合赔率及模拟分配 <span>⌄</span></summary>'+
 '<div class="scroll"><table><thead><tr><th>#</th><th>组合</th><th>赔率</th><th>等额份额</th><th>条件返还</th>'+(state.revealed?'<th>结果</th>':'')+'</tr></thead><tbody>'+
 all.map((o,i)=>{let stake=(unit+(i<rem?1:0))/100;
 const hit=res?.status!=='unsettled'&&o.keys.every((k,j)=>k===actual[j]);
 return '<tr><td>'+(i+1)+'</td><td>'+o.names.map(esc).join(' × ')+'</td><td>'+money(o.odds)+'</td><td>'+money(stake)+'</td><td>'+money(stake*o.odds)+'</td>'+
 (state.revealed?'<td>'+(res?.status==='unsettled'?'待结算':hit?'✓':'—')+'</td>':'')+'</tr>'}).join('')+
 '</tbody></table></div></details>';
}
function leg(l,i,res){
 const meta=l.row.mk[l.market],actual=res?.known?.[i];
 const m=l.picks.map(p=>'<span class="chip">'+esc(p.name)+' <b>×'+money(meta.o[p.key])+'</b></span>').join('');
 const badge=state.revealed?(actual?.actual===null||!actual?'待结算':actual.selected.includes(actual.actual)?'单场覆盖':'单场未覆盖'):'赛果遮挡';
 return '<div class="leg"><div class="leg-small"><span class="num">'+esc(l.row.num)+'</span><span>'+esc(l.row.league||'')+'</span><span>采集 '+esc(String(meta.captured||'').slice(0,10))+'</span></div>'+
 '<div class="fixture">'+esc(l.row.h)+' <small>vs</small> '+esc(l.row.a)+'</div><div class="chips">'+m+'</div>'+
 '<div class="leg-foot">'+esc(l.market.toUpperCase())+' · '+badge+(state.revealed&&actual?.ft?' · HT '+esc(actual.ht||'—')+' / FT '+esc(actual.ft):'')+'</div></div>';
}
function current(){
 const e=getEntry(state.day,state.type),r=getResult(state.day,state.type);
 $('dayTitle').textContent=dateLabel(state.day)+'｜'+types.find(x=>x[0]===state.type)[1];
 $('dayMeta').textContent=freeze.days[state.day].eligibleMatches+'场合格赛前记录';
 if(!e){$('cards').innerHTML='<div class="empty">本日该类没有通过V1.1组合Gate的方案；保留弃选，不强制配场。</div>';return}
 const comb=options(e),n=comb.length,min=Math.min(...comb.map(x=>x.odds)),max=Math.max(...comb.map(x=>x.odds));
 const label=state.revealed?(r.status==='unsettled'?'待结算':r.status==='covered'?(r.net<0?'覆盖但净亏':'双场覆盖'):'未覆盖'):'赛果遮挡';
 const risk=min<n?'含低于盈亏平衡的命中分支':'最低组合赔率超过等额盈亏平衡';
 const status=state.revealed&&r.status!=='unsettled'?'<span class="net '+(r.net>=0?'plus':'minus')+'">净'+(r.net>=0?'+':'−')+money(Math.abs(r.net))+'点</span>':'<span class="status">'+label+'</span>';
 $('cards').innerHTML='<article class="plan"><header class="plan-head"><div><strong>'+esc(types.find(x=>x[0]===e.type)[1])+' · '+esc(e.structure)+'</strong><small>历史赛前冻结筛选 · 不等于当时已发布</small></div>'+status+'</header>'+
 '<div class="legs cols-'+e.legs.length+'">'+e.legs.map((l,i)=>leg(l,i,r)).join('<div class="join">×</div>')+'</div>'+
 '<div class="resultbar"><div><small>全部组合</small><b>'+n+'种</b></div><div><small>组合赔率范围</small><b>'+money(min)+'—'+money(max)+'</b></div><div><small>单个分支盈亏平衡赔率</small><b>'+n+'.00</b></div></div>'+
 '<p class="risk">'+esc(risk)+'；赔率较高不自动等于具有正期望。</p>'+details(e,r)+'</article>';
}
function history(){
 $('history').innerHTML=dates.map(d=>{
 const e=getEntry(d,state.type),r=getResult(d,state.type);
 return '<button type="button" class="historyrow '+(d===state.day?'active':'')+'" data-day="'+esc(d)+'"><span>'+dateLabel(d)+'</span>'+
 '<span class="historyname">'+(e?e.legs.map(l=>esc(l.row.num)).join(' × ')+' <small>'+esc(e.structure)+'</small>':'弃选')+'</span>'+
 '<span class="historyresult">'+(!state.revealed?'遮挡':!e?'—':r.status==='unsettled'?'待结算':(r.net>=0?'+':'−')+money(Math.abs(r.net)))+'</span></button>';
 }).join('');
}
function reports(){
 if(!state.revealed){$('aggregate').innerHTML='<p class="muted">逐日收益及各类覆盖率已遮挡。点击上方「揭晓回测」后显示。</p>';return}
 const t=results.summary;
 let html='<div class="scroll"><table><thead><tr><th>模块</th><th>单场覆盖</th><th>整组覆盖</th><th>已结算</th><th>净盈亏（每组1000点）</th></tr></thead><tbody>';
 html+=types.map(([k,label])=>{const r=t[k];return '<tr><td>'+esc(label)+'</td><td>'+r.legPct+'%</td><td>'+r.winPct+'%</td><td>'+r.settled+'/'+r.n+'</td><td class="'+(r.net>=0?'plus':'minus')+'">'+(r.net>=0?'+':'−')+money(Math.abs(r.net))+'</td></tr>'}).join('');
 html+='</tbody></table></div><details class="details"><summary>查看全部22个业务日的模拟净盈亏</summary><div class="scroll"><table><thead><tr><th>日期</th>'+types.map(t=>'<th>'+esc(t[1])+'</th>').join('')+'</tr></thead><tbody>';
 html+=dates.slice().reverse().map(day=>'<tr><td>'+dateLabel(day)+'</td>'+types.map(([key])=>{const o=getResult(day,key);return '<td class="'+(o?.net>=0?'plus':'minus')+'">'+(!o?'弃选':o.net===null?'待结算':(o.net>=0?'+':'−')+money(Math.abs(o.net)))+'</td>'}).join('')+'</tr>').join('');
 html+='</tbody></table></div></details>';
 $('aggregate').innerHTML=html;
}
function render(){
 $('daySelect').value=state.day;
 $('prevDay').disabled=dates.indexOf(state.day)===dates.length-1;
 $('nextDay').disabled=dates.indexOf(state.day)===0;
 $('revealer').textContent=state.revealed?'重新遮挡赛果':'揭晓回测赛果';
 $('budget').value=state.budget;
 $('tabs').querySelectorAll('[data-type]').forEach(b=>{b.classList.toggle('active',b.dataset.type===state.type);b.setAttribute('aria-selected',String(b.dataset.type===state.type))});
 current();history();reports();
}
function init(){
 if(!freeze?.days||!results?.days||results.freezeBlobSha===undefined){$('cards').textContent='数据档案未加载';return}
 $('daySelect').innerHTML=dates.map(d=>'<option value="'+esc(d)+'">'+dateLabel(d)+'</option>').join('');
 $('daySelect').addEventListener('change',e=>{state.day=e.target.value;render()});
 $('prevDay').addEventListener('click',()=>{let i=dates.indexOf(state.day);if(i<dates.length-1){state.day=dates[i+1];render()}});
 $('nextDay').addEventListener('click',()=>{let i=dates.indexOf(state.day);if(i>0){state.day=dates[i-1];render()}});
 $('tabs').addEventListener('click',e=>{const n=e.target.closest('[data-type]');if(n){state.type=n.dataset.type;render()}});
 $('revealer').addEventListener('click',()=>{state.revealed=!state.revealed;render()});
 $('budget').addEventListener('change',e=>{const v=+e.target.value;state.budget=Number.isFinite(v)?Math.max(10,Math.min(100000,Math.round(v*100)/100)):100;render()});
 $('history').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(b){state.day=b.dataset.day;render();window.scrollTo({top:0,behavior:'auto'})}});
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();