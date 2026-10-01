#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

await import('./p3-offline-builder-core.js');
if (typeof globalThis.buildP3Snapshot !== 'function') {
  throw new Error('buildP3Snapshot is not available');
}

const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error('Usage: node scripts/p3-offline-collect-and-build.mjs <input.json> [...]');
  process.exit(2);
}

const CONTRACT = 'internal-test/p3-data/P3_SCHEMA_CONTRACT_V5.json';
const CONCURRENCY = 6;
const MAX_RETRIES = 3;

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function statNum(playerStats, key) {
  const groups = Array.isArray(playerStats?.stats) ? playerStats.stats : [];
  for (const grp of groups) {
    const stats = grp?.stats || {};
    for (const v of Object.values(stats)) {
      if (v?.key === key) return num(v?.stat?.value);
    }
  }
  return null;
}
function subMinute(player, type) {
  const events = player?.performance?.substitutionEvents || [];
  const vals = events
    .filter(e => e?.type === type)
    .map(e => num(e?.time))
    .filter(v => v !== null);
  return vals.length ? Math.min(...vals) : null;
}
function positionGroup(usual, x, y, isStarter) {
  usual = Number(usual);
  x = num(x);
  y = num(y);
  if (usual === 0) return 'GK';
  if (usual === 1) {
    if (isStarter && x !== null && (x <= 0.26 || x >= 0.74)) return 'FB_WB';
    return 'CB';
  }
  if (usual === 2) {
    if (isStarter && ((x !== null && (x <= 0.24 || x >= 0.76)) || (y !== null && y >= 0.70))) return 'AM_W';
    return 'DM_CM';
  }
  if (usual === 3) {
    if (isStarter && x !== null && (x <= 0.22 || x >= 0.78)) return 'AM_W';
    return 'ST';
  }
  return 'OTHER';
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function fetchDetail(sourceMatchId) {
  const url = 'https://www.fotmob.com/api/data/matchDetails?matchId=' + encodeURIComponent(String(sourceMatchId).replaceAll(' ', ''));
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'accept': 'application/json,text/plain,*/*',
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129 Safari/537.36',
          'referer': 'https://www.fotmob.com/'
        }
      });
      if (!res.ok) throw new Error('HTTP_' + res.status);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) await sleep(700 * attempt);
    }
  }
  throw lastErr || new Error('fetch_failed');
}
function normalizePlayer(p, ps, meta, isStarter, isSub) {
  const x = num(p?.verticalLayout?.x);
  const y = num(p?.verticalLayout?.y);
  const usual = num(p?.usualPlayingPositionId);
  const minutesStat = statNum(ps, 'minutes_played');
  const outMinute = subMinute(p, 'subOut');
  const inMinute = subMinute(p, 'subIn');
  let minutes;
  if (minutesStat !== null) {
    minutes = Math.trunc(minutesStat);
  } else if (isStarter) {
    minutes = Math.min(90, outMinute === null ? 90 : outMinute);
  } else if (isSub && inMinute !== null) {
    minutes = Math.max(0, 90 - inMinute);
  } else {
    minutes = 0;
  }

  const intOrNull = key => {
    const v = statNum(ps, key);
    return v === null ? null : Math.trunc(v);
  };

  return {
    match_id: meta.match_id,
    team_name: meta.team_name,
    opponent_name: meta.opponent_name,
    is_home: meta.is_home,
    player_id: Number(p.id),
    player_name: p.name ?? null,
    usual_position_id: usual,
    tactical_position_id: num(p?.positionId),
    lineup_x: x,
    lineup_y: y,
    position_group: positionGroup(usual, x, y, isStarter),
    is_starter: isStarter,
    is_sub: isSub,
    minutes,
    goals: intOrNull('goals') ?? 0,
    assists: intOrNull('assists') ?? 0,
    xg: statNum(ps, 'expected_goals'),
    xa: statNum(ps, 'expected_assists'),
    shots: intOrNull('total_shots'),
    shots_on_target: intOrNull('ShotsOnTarget'),
    chances_created: intOrNull('chances_created'),
    defensive_actions: intOrNull('defensive_actions'),
    tackles: intOrNull('matchstats.headers.tackles'),
    interceptions: intOrNull('interceptions'),
    clearances: intOrNull('clearances'),
    aerials_won: intOrNull('aerials_won'),
    saves: intOrNull('saves'),
    goals_prevented: statNum(ps, 'goals_prevented'),
    rating: statNum(ps, 'rating_title'),
    raw_stats: ps || {}
  };
}
function parseTeam(teamObj, playerStats, match, teamName, opponentName, isHome) {
  const starters = Array.isArray(teamObj?.starters) ? teamObj.starters : [];
  const subs = Array.isArray(teamObj?.subs) ? teamObj.subs : [];
  const lineup = {
    match_id: match.match_id,
    team_name: teamName,
    opponent_name: opponentName,
    is_home: isHome,
    formation: teamObj?.formation || null,
    starter_player_ids: starters.map(p => Number(p.id)),
    starter_names: starters.map(p => p.name ?? null),
    bench_player_ids: subs.map(p => Number(p.id)),
    match_date: match.match_date ?? null,
    kickoff_at: match.kickoff_at ?? null
  };
  const meta = { match_id: match.match_id, team_name: teamName, opponent_name: opponentName, is_home: isHome };
  const players = [];
  for (const p of starters) {
    if (p?.id == null) continue;
    players.push(normalizePlayer(p, playerStats?.[String(p.id)] || {}, meta, true, false));
  }
  for (const p of subs) {
    if (p?.id == null) continue;
    players.push(normalizePlayer(p, playerStats?.[String(p.id)] || {}, meta, false, true));
  }
  return { lineup, players };
}
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runner()));
  return results;
}
function qualityTier(snapshot) {
  const teams = Object.values(snapshot.teams || {});
  const depth = teams.map(t => Number(t?.C_lineup_structure?.depth_data_coverage_pct)).filter(Number.isFinite);
  const avgDepth = depth.length ? Math.round(depth.reduce((a,b)=>a+b,0)/depth.length*10)/10 : null;
  const full = teams.every(t => t?.sample_context?.usage_mode === 'FULL');
  return { quality_tier: full && (avgDepth ?? 0) >= 70 ? 'PILOT_FULL' : 'LIMITED', avg_team_depth_coverage_pct: avgDepth };
}
function parseGateOutput(text) {
  try { return JSON.parse(text); } catch { return { ok:false, errors:[{type:'GATE_OUTPUT_PARSE',raw:String(text).slice(0,1000)}], warnings:[] }; }
}

for (const inputPath of inputs) {
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const league = input.league_code;
  const season = input.season;
  const rawByTeam = {};
  const failures = [];
  let finishedCount = 0, lineupCount = 0;

  console.log('[P3] collect', league, season, 'matches=', input.matches.length);
  const results = await mapLimit(input.matches, CONCURRENCY, async (match, idx) => {
    try {
      const data = await fetchDetail(match.source_match_id);
      if (data?.general?.finished !== true) return { status:'not_finished', match };
      const homeObj = data?.content?.lineup?.homeTeam;
      const awayObj = data?.content?.lineup?.awayTeam;
      if (!homeObj || !awayObj) return { status:'lineup_missing', match };
      const ps = data?.content?.playerStats || {};
      const home = parseTeam(homeObj, ps, match, match.home_team, match.away_team, true);
      const away = parseTeam(awayObj, ps, match, match.away_team, match.home_team, false);
      if ((idx + 1) % 25 === 0) console.log('[P3]', league, 'fetched', idx + 1, '/', input.matches.length);
      return { status:'ok', home, away };
    } catch (err) {
      return { status:'error', match, error:String(err?.message || err) };
    }
  });

  for (const item of results) {
    if (item.status === 'ok') {
      finishedCount++;
      lineupCount++;
      for (const side of [item.home, item.away]) {
        const team = side.lineup.team_name;
        if (!rawByTeam[team]) rawByTeam[team] = { lineups:[], players:[] };
        rawByTeam[team].lineups.push(side.lineup);
        rawByTeam[team].players.push(...side.players);
      }
    } else {
      failures.push({ status:item.status, source_match_id:item.match?.source_match_id, error:item.error || null });
    }
  }

  for (const t of Object.values(rawByTeam)) {
    t.lineups.sort((a,b)=>String(a.kickoff_at||a.match_date).localeCompare(String(b.kickoff_at||b.match_date)) || String(a.match_id).localeCompare(String(b.match_id)));
    t.players.sort((a,b)=>String(a.match_id).localeCompare(String(b.match_id)) || Number(a.player_id)-Number(b.player_id));
  }

  const version = 'P3_V5_' + league + '_PILOT';
  const built = globalThis.buildP3Snapshot(rawByTeam, {
    league_code: league,
    season,
    competition_id: input.competition_id,
    version,
    generated_at: new Date().toISOString()
  });

  const outBase = path.join('internal-test','p3-candidates', league + '-' + season.replaceAll('/','-'));
  fs.mkdirSync(path.dirname(outBase), { recursive:true });
  const candidatePath = outBase + '.json';
  const gatePath = outBase + '-gate.json';
  fs.writeFileSync(candidatePath, JSON.stringify(built.snapshot,null,2));

  const gateRun = spawnSync(process.execPath, ['scripts/p3-promotion-gate.mjs', candidatePath, CONTRACT], { encoding:'utf8' });
  const strict = parseGateOutput(gateRun.stdout || gateRun.stderr || '');
  const collectionCoverage = input.matches.length ? Math.round(1000*lineupCount/input.matches.length)/10 : 0;
  const collectionHardPass = failures.filter(x => x.status === 'error' || x.status === 'not_finished').length === 0 && collectionCoverage >= 95;
  const q = qualityTier(built.snapshot);
  const finalPass = !!strict.ok && collectionHardPass;
  const report = {
    league_code: league,
    season,
    build_mode: 'P3_SAFE_BUILD_R2_GITHUB_ACTIONS',
    source: 'FotMob matchDetails',
    input_matches: input.matches.length,
    collected_matches: lineupCount,
    collection_coverage_pct: collectionCoverage,
    collection_failures: failures,
    teams: Object.keys(built.snapshot.teams || {}).length,
    aggregate_players: built.meta.aggregate_players,
    schema_contract: strict.contract || null,
    strict_gate_ok: !!strict.ok,
    strict_errors: strict.errors || [],
    strict_warnings: strict.warnings || [],
    gate_status: finalPass ? 'PASS' : 'FAIL',
    quality_tier: q.quality_tier,
    avg_team_depth_coverage_pct: q.avg_team_depth_coverage_pct
  };
  fs.writeFileSync(gatePath, JSON.stringify(report,null,2));
  console.log('[P3]', league, JSON.stringify({
    gate_status:report.gate_status,
    coverage:report.collection_coverage_pct,
    teams:report.teams,
    players:report.aggregate_players,
    quality:report.quality_tier,
    strict_errors:report.strict_errors.length,
    collection_failures:report.collection_failures.length
  }));
}
