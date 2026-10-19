-- Six independent match analysts: hypothetical cutoff = min(now, kickoff-30m).
-- This query deliberately excludes outcomes, scoring tables, and main-model selections.
WITH matches AS (
 SELECT m.id,m.business_date::text AS business_day,m.match_num num,m.league_name league,
 m.home_team_name home,m.away_team_name away,m.kickoff_at,
 LEAST(now(),m.kickoff_at-interval '30 minutes') cutoff
 FROM public.jc_matches m WHERE m.business_date BETWEEN '2026-10-05' AND '2026-10-19'
), source AS (
 SELECT m.*,
 (SELECT jsonb_build_object('time',d.fetched_at,'payload',d.payload)
  FROM public.jc_match_details d WHERE d.jc_match_id=m.id AND d.detail_type='feature'
   AND d.fetched_at<=m.cutoff AND d.updated_at<=m.cutoff
  ORDER BY d.fetched_at DESC LIMIT 1) feature,
 (SELECT jsonb_object_agg(s.pool_code,jsonb_build_object('capturedAt',s.captured_at,'line',s.goal_line,'odds',s.outcomes))
  FROM (SELECT DISTINCT ON (a.pool_code) a.pool_code,a.captured_at,a.goal_line,a.outcomes
   FROM public.jc_market_snapshots a WHERE a.jc_match_id=m.id AND a.captured_at<=m.cutoff
   ORDER BY a.pool_code,a.captured_at DESC,a.id DESC)s) markets
 FROM matches m
)
SELECT id::text, business_day AS "day",num,league,home,away,kickoff_at,cutoff,
 feature->>'time' AS feature_time,
 jsonb_build_object(
 'homeGoalsFor',feature->'payload'->'value'->'goalAvg'->>'homeGoalAvgCnt',
 'homeGoalsAgainst',feature->'payload'->'value'->'lossGoalAvg'->>'homeLossGoalAvgCnt',
 'awayGoalsFor',feature->'payload'->'value'->'goalAvg'->>'awayGoalAvgCnt',
 'awayGoalsAgainst',feature->'payload'->'value'->'lossGoalAvg'->>'awayLossGoalAvgCnt',
 'samples',feature->'payload'->'value'->'goalAvg'->>'totalLegCnt'
 ) features,
 COALESCE(markets,'{}'::jsonb) markets
FROM source ORDER BY business_day,num;