// Pure fixture guards shared by the scheduled collector and regression tests.
// An upstream "finished" flag never overrides a future kickoff.
export function classifyFixtureStatus(fixture, nowMs=Date.now()) {
  if (fixture?.status?.finished !== true) return 'not_finished';
  const kickoffMs=Date.parse(fixture?.status?.utcTime || '');
  if (!Number.isFinite(kickoffMs)) return 'invalid_finished_time';
  return kickoffMs>nowMs-30*60*1000 ? 'premature_finished' : 'verified_finished';
}

export function reconcilePriorFixtures(previousMatches, currentMatches, verifiedRetainedIds, nowMs=Date.now()) {
  const currentIds=new Set(currentMatches.map(m=>String(m.source_match_id)));
  const retained=[],futureRemoved=[],unverifiedRemoved=[];
  for (const previous of previousMatches) {
    const id=String(previous.source_match_id);
    if (currentIds.has(id)) continue;
    const time=Date.parse(previous.kickoff_at || '');
    if (!Number.isFinite(time)) { unverifiedRemoved.push(id); continue; }
    if (time>nowMs-30*60*1000) { futureRemoved.push(id); continue; }
    if (verifiedRetainedIds.has(id)) { retained.push(previous); currentIds.add(id); continue; }
    unverifiedRemoved.push(id);
  }
  return {retained,futureRemoved,unverifiedRemoved};
}

/**
 * Input files may advance before a gated build succeeds. Never treat the
 * mere existence of an input file as proof that its P3 snapshot was published.
 */
export function canSkipP3Build({previousCount,addedCount,discardedFutureCount,currentCount,publishedCount,publishedSha}) {
  return previousCount>0 && addedCount===0 && discardedFutureCount===0
    && currentCount===publishedCount && Boolean(publishedSha);
}

/**
 * Some league indexes duplicate a verified match with a new source ID.
 * Only collapse the alias when its teams AND exact kickoff agree with
 * an explicitly verified previous fixture. Never fuzzy-match by team alone.
 */
export function dedupeAuditedFixtureAliases(currentMatches, previousMatches, verifiedRetainedIds) {
  const historical=new Map();
  for(const previous of previousMatches){
    if(!verifiedRetainedIds.has(String(previous.source_match_id))) continue;
    const at=Date.parse(previous.kickoff_at||'');
    if(!Number.isFinite(at)) continue;
    historical.set([previous.home_team,previous.away_team,at].join('|'),String(previous.source_match_id));
  }
  const excludedDuplicateAliases=[];
  const unique=[];
  for(const current of currentMatches){
    const at=Date.parse(current.kickoff_at||'');
    const canonical=Number.isFinite(at)
      ? historical.get([current.home_team,current.away_team,at].join('|'))
      : null;
    if(canonical && canonical!==String(current.source_match_id)){
      excludedDuplicateAliases.push({source_match_id:String(current.source_match_id),canonical_source_match_id:canonical});
    } else unique.push(current);
  }
  return {unique,excludedDuplicateAliases};
}
