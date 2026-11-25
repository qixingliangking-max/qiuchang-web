import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyFixtureStatus, reconcilePriorFixtures, canSkipP3Build, dedupeAuditedFixtureAliases} from './p3-fixture-safety.mjs';

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

test('previous unpromoted input must be retried even if no new IDs were discovered',()=>{
  assert.equal(canSkipP3Build({previousCount:124,addedCount:0,discardedFutureCount:0,currentCount:124,publishedCount:110,publishedSha:'old'}),false);
});
test('no-op is allowed only if input and last successfully promoted fixture baseline agree',()=>{
  assert.equal(canSkipP3Build({previousCount:124,addedCount:0,discardedFutureCount:0,currentCount:124,publishedCount:124,publishedSha:'verified'}),true);
  assert.equal(canSkipP3Build({previousCount:124,addedCount:0,discardedFutureCount:0,currentCount:124,publishedCount:124,publishedSha:''}),false);
});
test('removing a previously mislabeled future fixture always rebuilds',()=>{
  assert.equal(canSkipP3Build({previousCount:120,addedCount:0,discardedFutureCount:1,currentCount:119,publishedCount:120,publishedSha:'verified'}),false);
});

test('verified historical Vicenza match keeps its canonical P3 source ID over a verified duplicate alias',()=>{
  const old=[{source_match_id:'5967044',home_team:'维琴察',away_team:'卡坦扎罗',kickoff_at:'2026-08-21T18:30:00Z'}];
  const current=[{source_match_id:'1000024295',home_team:'维琴察',away_team:'卡坦扎罗',kickoff_at:'2026-08-21T18:30:00.000Z'}];
  const result=dedupeAuditedFixtureAliases(current,old,new Set(['5967044']));
  assert.equal(result.unique.length,0);
  assert.deepEqual(result.excludedDuplicateAliases,[{source_match_id:'1000024295',canonical_source_match_id:'5967044'}]);
});
test('unknown or different kickoff match is never automatically dropped',()=>{
  const old=[{source_match_id:'5967044',home_team:'维琴察',away_team:'卡坦扎罗',kickoff_at:'2026-08-21T18:30:00Z'}];
  const current=[{source_match_id:'1000024295',home_team:'维琴察',away_team:'卡坦扎罗',kickoff_at:'2026-08-22T18:30:00Z'}];
  assert.equal(dedupeAuditedFixtureAliases(current,old,new Set(['5967044'])).unique.length,1);
  assert.equal(dedupeAuditedFixtureAliases(current,old,new Set()).unique.length,1);
});
test('newly finished Vicenza matches do not get discarded as previous duplicates',()=>{
  const current=[{source_match_id:'1000024310',home_team:'维琴察',away_team:'凯勒雷斯',kickoff_at:'2026-11-24T19:00:00Z'}];
  assert.equal(dedupeAuditedFixtureAliases(current,[],new Set()).unique.length,1);
});
