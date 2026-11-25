import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyFixtureStatus, reconcilePriorFixtures} from './p3-fixture-safety.mjs';

const now=Date.parse('2026-11-25T01:00:00Z');
const fixture=(id,kickoff,finished=true)=>({id,status:{finished,utcTime:kickoff}});
const prev=(id,kickoff)=>({source_match_id:String(id),match_id:'fotmob:'+id,kickoff_at:kickoff,home_team:'A',away_team:'B'});
test('past finished fixtures remain eligible',()=>{
  assert.equal(classifyFixtureStatus(fixture('5967145','2026-11-08T15:00:00Z'),now),'verified_finished');
});
test('future match incorrectly marked finished is excluded, not assumed to have a lineup',()=>{
  assert.equal(classifyFixtureStatus(fixture('1000024295','2027-02-13T15:00:00Z'),now),'premature_finished');
  assert.equal(classifyFixtureStatus(fixture('5868088','2026-12-09T18:00:00Z'),now),'premature_finished');
});
test('unparseable finished kickoff is blocked',()=>{
  assert.equal(classifyFixtureStatus(fixture('bad',null),now),'invalid_finished_time');
});
test('previous future fixture can be removed without falsely reporting historical regression',()=>{
  const r=reconcilePriorFixtures([prev('5868088','2026-12-09T18:00:00Z')],[],new Set(),now);
  assert.deepEqual(r.futureRemoved,['5868088']);assert.equal(r.unverifiedRemoved.length,0);
});
test('11 verified historical matches absent from source index are retained',()=>{
  const ids=['5967044','5967051','5967063','5967074','5967088','5967095','5967100','5967113','5967125','5967135','5967145'];
  const before=ids.map(id=>prev(id,'2026-11-08T15:00:00Z'));
  const r=reconcilePriorFixtures(before,[],new Set(ids),now);
  assert.equal(r.retained.length,11);assert.equal(r.unverifiedRemoved.length,0);
});
test('unknown old finished fixture disappears: still hard block',()=>{
  const r=reconcilePriorFixtures([prev('unaudited','2026-11-08T15:00:00Z')],[],new Set(),now);
  assert.deepEqual(r.unverifiedRemoved,['unaudited']);assert.equal(r.retained.length,0);
});
test('existing matched historical match is never duplicated by retention',()=>{
  const old=[prev('5967044','2026-10-03T15:00:00Z')];
  const r=reconcilePriorFixtures(old,old,new Set(['5967044']),now);
  assert.equal(r.retained.length,0);assert.equal(r.futureRemoved.length,0);
});
