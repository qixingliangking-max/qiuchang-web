import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const cfg=new URL('../config/qcda-six-fields-report-v1.3.json',import.meta.url);
export const STANDARD=JSON.parse(fs.readFileSync(cfg,'utf8'));
const fields=STANDARD.fields;
const picks=new Set(['胜','平','负']);
const trim=x=>String(x??'').trim();

function readField(raw,key){
  const names=fields.find(f=>f.key===key)?.aliases||[];
  const has=names.filter(k=>Object.hasOwn(raw,k)&&raw[k]!=null&&trim(raw[k])!=='');
  if(!has.length)return undefined;
  if(new Set(has.map(k=>JSON.stringify(raw[k]))).size>1)throw Error('冲突字段：'+has.join('、'));
  return raw[has[0]];
}
function parseText(str){
  const names=[...new Set([...fields.flatMap(f=>f.aliases).filter(x=>!x.includes('_') && x!=='direction' && x!=='htft'),'M7','M8'])].sort((a,b)=>b.length-a.length);
  const rx=new RegExp('(?:[①②③④⑤⑥⑦⑧]\\s*)?('+names.join('|')+')\\s*[：:]','g');
  const ms=[...str.matchAll(rx)],out={};
  for(let i=0;i<ms.length;i++){
    const name=ms[i][1],end=ms[i+1]?.index??str.length;
    const value=str.slice(ms[i].index+ms[i][0].length,end).replace(/[①②③④⑤⑥⑦⑧]\s*$/,'').trim();
    if(out[name]!==undefined&&out[name]!==value)throw Error('重复字段：'+name);
    out[name]=value;
  }
  return out;
}
function choices(v){
  if(Array.isArray(v))return v.map(trim).filter(Boolean);
  return trim(v).split(/[、，,；;｜|]/).map(trim).filter(Boolean);
}
function getDirection(v){
  const t=trim(v).replace(/\s+/g,'').replace(/（[^）]*）/g,'');
  if(['主队不败','主不败','胜平'].includes(t))return ['胜','平'];
  if(['客队不败','客不败','负平'].includes(t))return ['负','平'];
  if(['胜负','分胜负'].includes(t))return ['胜','负'];
  const x=t.replace(/[／｜|、，]/g,'/').split('/').filter(Boolean)
    .map(x=>({'主胜':'胜','客胜':'负','平局':'平'})[x]||x);
  return x.length&&x.length<=2&&x.every(x=>picks.has(x))&&new Set(x).size===x.length?x:null;
}
function getSingle(v){
  const s=trim(v).replace(/^TEST\s*/i,'');
  const t=s.match(/^(主队胜|客队胜|主胜|客胜|平局|胜|平|负)/)?.[0];
  return {pick:({'主队胜':'胜','客队胜':'负','主胜':'胜','客胜':'负','平局':'平'})[t]||t,
    probability:s.match(/(\d+(?:\.\d+)?)\s*%/)?.[1]||null};
}
function getGoals(v){
  const tokens=choices(v).flatMap(x=>x.split(/\s+/).filter(Boolean));
  const nums=tokens.map(x=>x.replace(/球$/,''));
  if(!nums.length||nums.some(x=>!/^\d+$/.test(x)))return null;
  return nums.map(x=>x+'球');
}
function getScores(v){
  const tokens=choices(v).flatMap(x=>x.split(/\s+/).filter(Boolean));
  const x=tokens.map(s=>{
    if(/^\d{1,2}[-:]\d{1,2}$/.test(s))return s.replace(':','-');
    if(/^\d\d$/.test(s))return s[0]+'-'+s[1];
    return null;
  });
  return x.length===3&&x.every(Boolean)&&new Set(x).size===3?x:null;
}
function getHTFT(v){
  const x=choices(v);
  return x.length>=1&&x.length<=2&&x.every(s=>/^[胜平负]\/[胜平负]$/.test(s))?x:null;
}
export function convertSixFields(input){
  let raw=input||{},v={};
  try{
    if(typeof raw==='string')raw=parseText(raw);
    for(const f of fields)v[f.key]=readField(raw,f.key);
  }catch(e){return {status:'blocked',errors:[e.message],fields:null};}
  const errors=[];
  const direction=getDirection(v.direction);
  if(!direction)errors.push('缺少核心方向');
  const single=getSingle(v.single);
  if(!picks.has(single.pick))errors.push('缺少TEST单选');
  if(direction&&picks.has(single.pick)&&!direction.includes(single.pick))errors.push('双选与TEST单选冲突');
  const ordered=direction&&direction.includes(single.pick)
    ?[single.pick,...direction.filter(x=>x!==single.pick)]:direction;
  // TEST probability is independent of home/draw/away model probabilities.
  let probability=single.probability;
  if(!probability){
    const s=trim(raw.single_prob??raw.raw_input?.single_prob).replace(/%$/,'');
    if(/^\d+(?:\.\d+)?$/.test(s))probability=s;
  }
  if(!probability)errors.push('缺少TEST单选概率');
  else if(Number(probability)<0||Number(probability)>100)errors.push('TEST概率超出范围');
  let handicap=trim(v.handicap);
  // The official +/- goal is sometimes a separate locked raw_input field.
  // Reattach it for public display only; never recompute or reorder picks.
  const handicapLine=trim(raw.handicap_line??raw.raw_input?.handicap_line);
  if(handicapLine && !/[（(][+-]?\d+(?:\.\d+)?[)）]/.test(handicap)){
    if(/^[+-]\d+(?:\.\d+)?$/.test(handicapLine))handicap+='（'+handicapLine+'）';
    else errors.push('官方让球数值无法确认');
  }
  if(!handicap)errors.push('缺少官方让球');
  const htft=getHTFT(v.htft);
  if(!htft)errors.push('缺少半全场');
  const goals=getGoals(v.goals);
  if(!goals)errors.push('缺少离散总进球');
  const scores=getScores(v.scores);
  if(!scores)errors.push('缺少三个比分参考');
  const result={
    '核心方向':ordered?.join(' / ')||null,
    '单选倾向':picks.has(single.pick)?single.pick+(probability?'｜'+probability+'%':''):null,
    '官方让球':handicap||null,
    '半全场':htft?.join('、')||null,
    '总进球':goals?.join('、')||null,
    '比分参考':scores?.join('、')||null
  };
  return {status:errors.length?'blocked':'ready',errors,fields:result,sourcePreserved:true};
}
export function makeReportPlan(match,six,evidence=[]){
  const errors=[...(six.errors||[])];
  if(!evidence.length)errors.push('尚无可核实的赛前事实依据');
  return {status:errors.length?'awaiting_verification':'ready_for_writing',
    match:{business_date:match.business_date,match_num:match.match_num,
      home:match.home_team_name,away:match.away_team_name},
    fields:six.fields,reportTitle:STANDARD.report.title,
    chapters:STANDARD.report.chapters.map(c=>({title:c.title,paragraphFields:c.fields,paragraphs:[]})),
    errors};
}
export function validateReport(report,six,evidence=[]){
  const errors=[];
  if(six.status!=='ready')errors.push('六项预测尚未完成');
  if(!evidence.length)errors.push('未附可信赛前事实证据');
  if(!Array.isArray(report?.chapters)||report.chapters.length!==4)errors.push('必须四章');
  const chapters=report?.chapters||[];
  STANDARD.report.chapters.forEach((c,i)=>{
    const got=chapters[i];
    if(got?.title!==c.title||!Array.isArray(got?.paragraphs)||
      got.paragraphs.length!==c.paragraphs||got.paragraphs.some(p=>!trim(p)))
      errors.push('第'+(i+1)+'章不符合四章七段母版');
  });
  const text=chapters.flatMap(c=>c.paragraphs||[]).join('\n');
  for(const word of STANDARD.report.reportProhibitedWords){
    if(text.includes(word))errors.push('对外禁词：'+word);
  }
  return {status:errors.length?'blocked':'ready_for_review',errors,
    paragraphs:chapters.reduce((n,c)=>n+(c.paragraphs?.length||0),0)};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const content=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):fs.readFileSync(0,'utf8');
  const source=JSON.parse(content),rows=Array.isArray(source)?source:[source];
  const results=rows.map(match=>{
    const six=convertSixFields(match.raw??match.model??match);
    return {match_num:match.match_num||null,...six,
      reportPlan:makeReportPlan(match,six,match.verifiedEvidence||[])};
  });
  process.stdout.write(JSON.stringify(Array.isArray(source)?results:results[0],null,2)+'\n');
  if(results.some(x=>x.status!=='ready'))process.exitCode=2;
}
