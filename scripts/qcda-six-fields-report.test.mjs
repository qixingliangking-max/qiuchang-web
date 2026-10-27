import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {convertSixFields,makeReportPlan,validateReport,STANDARD} from './qcda-six-fields-report.mjs';

const model27={
  '模型方向':'主队不败','官方让球保护':'让胜／让负（-1）',
  'TEST单选':'胜｜67.5%','半全场':'胜/胜、平/胜',
  '总进球':'3、2、4','TOP3比分':'2-1、3-1、2-0'
};
test('10/27 real locked data -> six public fields, original order retained',()=>{
  const r=convertSixFields(model27);
  assert.equal(r.status,'ready');
  assert.deepEqual(Object.keys(r.fields),STANDARD.fields.map(f=>f.label));
  assert.equal(r.fields['核心方向'],'胜 / 平');
  assert.equal(r.fields['单选倾向'],'胜｜67.5%');
  assert.equal(r.fields['官方让球'],'让胜／让负（-1）');
  assert.equal(r.fields['半全场'],'胜/胜、平/胜');
  assert.equal(r.fields['总进球'],'3球、2球、4球');
  assert.equal(r.fields['比分参考'],'2-1、3-1、2-0');
});
test('10/27 real DB locked guest/sample: single wins the double order',()=>{
  const r=convertSixFields({direction:'负 / 平',single_pick:'负',
    raw_input:{single_prob:'39.2',handicap_line:'+1'},handicap_direction:'让胜 / 让负',
    htft:'负/负、平/负',goal_range:'3球｜2球',
    top_scores:['1-2','1-1','1-3']});
  assert.equal(r.status,'ready');
  assert.equal(r.fields['核心方向'],'负 / 平');
  assert.equal(r.fields['单选倾向'],'负｜39.2%');
  assert.equal(r.fields['官方让球'],'让胜 / 让负（+1）');
});
test('single=平 on a 主队不败 input -> 平 / 胜, no changes to scores',()=>{
  const r=convertSixFields({...model27,'TEST单选':'平｜28.0%'});
  assert.equal(r.status,'ready');
  assert.equal(r.fields['核心方向'],'平 / 胜');
  assert.equal(r.fields['比分参考'],'2-1、3-1、2-0');
});
test('recognizes original numbered 8-item message and does not confuse its order',()=>{
  const raw='① 模型方向：主队不败 ② 官方让球保护：让胜／让负（-1） ③ TEST单选：胜｜67.5% ④ 半全场：胜/胜、平/胜 ⑤ 总进球：3、2、4 ⑥ TOP3比分：2-1、3-1、2-0 ⑦ M7：主+1.5 ⑧ M8：小3.5';
  const r=convertSixFields(raw);
  assert.equal(r.status,'ready',JSON.stringify(r.errors));
  assert.equal(r.fields['核心方向'],'胜 / 平');
  assert.equal(r.fields['比分参考'],'2-1、3-1、2-0');
  assert.equal(Object.keys(r.fields).length,6);
});
test('blocks contradictory double/single rather than silently rearranging',()=>{
  const r=convertSixFields({...model27,'TEST单选':'负｜49.1%'});
  assert.equal(r.status,'blocked');
  assert.match(r.errors.join(','),/冲突/);
});
test('does not invent independent single probability from the 1X2 model',()=>{
  const r=convertSixFields({...model27,'TEST单选':'胜',home_prob:67.5});
  assert.equal(r.status,'blocked');
  assert.match(r.errors.join(','),/TEST单选概率/);
});
test('all 17 true 2026-10-28 fixtures block unfinished data and report',()=>{
  const roster=JSON.parse(fs.readFileSync(new URL('./fixtures/20261028-roster-validation.json',import.meta.url),'utf8'));
  assert.equal(roster.fixtures.length,17);
  for(const m of roster.fixtures){
    const six=convertSixFields(m.model||m);
    assert.equal(six.status,'blocked',m.match_num);
    const plan=makeReportPlan(m,six,[]);
    assert.equal(plan.status,'awaiting_verification',m.match_num);
    assert.equal(plan.chapters.length,4);
  }
});
test('four chapters / seven paragraphs and forbidden phrases enforced',()=>{
  const six=convertSixFields(model27);
  const chapters=STANDARD.report.chapters.map(c=>({title:c.title,
    paragraphs:c.fields.map(()=> '双方近期比赛特点与人员条件是本场分析的重点。')}));
  const evidence=[{kind:'official',url:'https://example.org/test-only',seen_before_kickoff:true}];
  assert.equal(validateReport({chapters},six,evidence).status,'ready_for_review');
  chapters[1].paragraphs[0]='中央数据库采集后确认模型方向。';
  const failed=validateReport({chapters},six,evidence);
  assert.equal(failed.status,'blocked');
  assert.match(failed.errors.join(','),/中央数据库/);
});
