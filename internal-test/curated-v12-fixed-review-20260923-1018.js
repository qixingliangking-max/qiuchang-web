/* QCDA fixed no-optimization structural study: read-only, results masked by default. */
(()=>{"use strict";
const frozen=window.QC_CURATED_V12_FIXED_MASK,verified=window.QC_CURATED_V12_FIXED_RESULTS;
const $=id=>document.getElementById(id);
const names={direction:"方向·单×单",htft:"半全场·单×单",goals:"总进球·2×2",score2x3:"比分·3×3",score3x3:"比分·3×3×3",score2x2:"比分·2×2"};
const keys=Object.keys(names),days=Object.keys(frozen.days).sort().reverse(),s={day:days[0],type:"direction",reveal:false,budget:1000};
const esc=x=>String(x??"").replace(/[&<>"']/g,k=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[k]));
const money=n=>Number(n||0).toLocaleString("zh-CN",{minimumFractionDigits:2,maximumFractionDigits:2});
const dayName=x=>x.slice(5,7)+"月"+x.slice(8)+"日";
const selection=()=>frozen.days[s.day].entries.find(x=>x.type===s.type);
const settlement=()=>verified.dates[s.day].items.find(x=>x.type===s.type);
function combos(entry){let a=[{keys:[],labels:[],odds:1}];for(const l of entry.legs)a=a.flatMap(y=>l.picks.map(x=>({keys:y.keys.concat(x.key),labels:y.labels.concat(x.name),odds:y.odds*Number(l.row.mk[l.market].o[x.key])})));return a}
function calc(entry,result){
 const a=combos(entry),n=a.length,unit=Math.floor(Math.round(s.budget*100)/n),remaining=Math.round(s.budget*100)-unit*n;
 const real=result?.legs?.map(x=>x.outcomeKey);
 return a.map((x,i)=>{const amount=(unit+(i<remaining?1:0))/100,covered=real&&x.keys.every((v,j)=>v===real[j]);
 return {...x,amount,conditional:amount*x.odds,covered:result?.status==="unsettled"?null:covered}});
}
function legHTML(leg,index,settled){
 const m=leg.row.mk[leg.market],res=settled?.legs?.[index];
 let selections=leg.picks.map(p=>'<span class="pick">'+esc(p.name)+' <b>×'+money(m.o[p.key])+'</b></span>').join("");
 let outcome=s.reveal?(res?.ft?'<span>半场 '+esc(res.ht||"—")+' ｜ 全场 '+esc(res.ft)+'</span>':'<span>待结算</span>'):'<span>赛果遮挡</span>';
 return '<div class="leg"><div class="meta"><span class="num">'+esc(leg.row.num)+'</span>'+esc(leg.row.league||"")+
 '　<span class="muted">开赛前赔率</span></div><div class="teams">'+esc(leg.row.h)+' <small>vs</small> '+esc(leg.row.a)+'</div>'+
 '<div class="picks">'+selections+'</div><div class="foot">'+esc(leg.market.toUpperCase())+'　'+outcome+'</div></div>';
}
function card(){
 const e=selection(),r=settlement();
 if(!e){$("plan").innerHTML='<div class="empty">当天此结构不满足条件，已弃选；不补入赛后挑出的比赛。</div>';return}
 let lines=calc(e,r),min=Math.min(...lines.map(x=>x.odds)),max=Math.max(...lines.map(x=>x.odds));
 const status=s.reveal?(r.status==="unsettled"?"待结算":r.status==="covered"?"覆盖命中":"未覆盖"):"赛果遮挡";
 const pnl=s.reveal&&r.status!=="unsettled"?'<span class="net '+(r.net>=0?"pos":"neg")+'">净'+(r.net>=0?"+":"−")+money(Math.abs(r.net)/1000*s.budget)+'</span>':'<span class="status">'+status+'</span>';
 let tr=lines.map((o,i)=>'<tr><td>'+(i+1)+'</td><td>'+o.labels.map(esc).join(" × ")+'</td><td>'+money(o.odds)+'</td><td>'+money(o.amount)+'</td><td>'+money(o.conditional)+'</td>'+
 (s.reveal?'<td>'+(o.covered===null?"待结算":o.covered?"✓":"—")+'</td>':'')+'</tr>').join("");
 $("plan").innerHTML='<article class="card"><div class="cardtop"><div><strong>'+esc(e.label)+'</strong><small>历史赛前冻结｜按编号选场，不优化组合</small></div>'+pnl+'</div>'+
 '<div class="legs">'+e.legs.map((l,i)=>legHTML(l,i,r)).join('<div class="multiply">×</div>')+'</div>'+
 '<div class="bottom"><div><small>所选比分／球数</small><b>'+e.legs.reduce((z,l)=>z+l.picks.length,0)+'项</b></div><div><small>实际组合</small><b>'+e.lineCount+'种</b></div><div><small>组合赔率区间</small><b>'+money(min)+'—'+money(max)+'</b></div></div>'+
 '<details class="detail"><summary>查看'+e.lineCount+'种组合与平均分配</summary><div class="scroll"><table><thead><tr><th>#</th><th>组合</th><th>赔率</th><th>分配</th><th>命中条件返还</th>'+(s.reveal?'<th>结果</th>':'')+'</tr></thead><tbody>'+tr+'</tbody></table></div></details></article>';
}
function histories(){
 $("history").innerHTML=days.map(d=>{
 const e=frozen.days[d].entries.find(x=>x.type===s.type),r=verified.dates[d].items.find(x=>x.type===s.type);
 const right=!s.reveal?"遮挡":!e?"弃选":r.status==="unsettled"?"待结算":(r.net>=0?"+":"−")+money(Math.abs(r.net)/1000*s.budget);
 return '<button class="dayrow '+(d===s.day?"active":"")+'" data-day="'+d+'"><span>'+dayName(d)+'</span><span>'+(!e?"无合格方案":e.legs.map(x=>esc(x.row.num)).join(" × "))+'</span><b>'+right+'</b></button>';
 }).join("");
}
function summary(){
 if(!s.reveal){$("summary").innerHTML='<p class="muted">全部赛果及模拟返还已遮挡；点击上方按钮查看。</p>';return}
 const sum=verified.summary;
 $("summary").innerHTML='<div class="scroll"><table><thead><tr><th>结构</th><th>命中／已结</th><th>投入</th><th>模拟返还</th><th>净盈亏</th></tr></thead><tbody>'+
 keys.map(t=>{let q=sum[t],net=(q.gross-q.stake)*s.budget/1000;return '<tr><td>'+esc(names[t])+'</td><td>'+q.allCovered+'/'+q.settled+'</td><td>'+money(q.stake*s.budget/1000)+'</td><td>'+money(q.gross*s.budget/1000)+'</td><td class="'+(net>=0?"pos":"neg")+'">'+(net>=0?"+":"−")+money(Math.abs(net))+'</td></tr>'}).join("")+
 '</tbody></table></div><p class="muted">同日不同测试结构可能复用相同比赛；各类投入独立计算，不能把这份模拟表理解成真实投资记录。</p>';
}
function render(){
 $("chooseDay").value=s.day;$("period").textContent=dayName(s.day)+"｜"+names[s.type];$("source").textContent=frozen.days[s.day].eligiblePreKickoffModels+"场有效FINAL";
 $("reveal").textContent=s.reveal?"重新遮挡赛果":"揭晓回测赛果";$("reveal").setAttribute("aria-pressed",String(s.reveal));
 $("previous").disabled=days.indexOf(s.day)===days.length-1;$("next").disabled=days.indexOf(s.day)===0;
 $("budget").value=s.budget;
 document.querySelectorAll("#tabs [data-type]").forEach(b=>{let on=b.dataset.type===s.type;b.classList.toggle("active",on);b.setAttribute("aria-selected",String(on))});
 card();histories();summary();
}
function init(){
 if(!frozen||!verified||!frozen.days||!verified.dates||!verified.frozenBlobSha){$("plan").textContent="测试档案不完整";return}
 $("chooseDay").innerHTML=days.map(d=>'<option value="'+d+'">'+dayName(d)+'</option>').join("");
 $("chooseDay").addEventListener("change",e=>{s.day=e.target.value;render()});
 $("previous").addEventListener("click",()=>{const i=days.indexOf(s.day);if(i<days.length-1){s.day=days[i+1];render()}});
 $("next").addEventListener("click",()=>{const i=days.indexOf(s.day);if(i>0){s.day=days[i-1];render()}});
 $("tabs").addEventListener("click",e=>{const t=e.target.closest("[data-type]");if(t){s.type=t.dataset.type;render()}});
 $("reveal").addEventListener("click",()=>{s.reveal=!s.reveal;render()});
 $("budget").addEventListener("change",e=>{let n=+e.target.value;s.budget=Number.isFinite(n)?Math.min(100000,Math.max(10,Math.round(n*100)/100)):1000;render()});
 $("history").addEventListener("click",e=>{const item=e.target.closest("[data-day]");if(item){s.day=item.dataset.day;render();window.scrollTo({top:0,behavior:"smooth"})}});
 render();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();