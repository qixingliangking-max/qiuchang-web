-- SELECTION ONLY, NO MATCH RESULTS, NO SETTLEMENT, NO POST-KICKOFF MODEL STATE
-- The published 10/05-10/18 V1.0 direction and score_2 original freezes are
-- recovered separately from the immutable original Git blob, not this query.
WITH fx AS (
 SELECT m.id,m.business_date,m.match_num,m.league_name,m.home_team_name,m.away_team_name,
 m.kickoff_at, LEAST(now(),m.kickoff_at - INTERVAL '1 second') AS cutoff
 FROM public.jc_matches m
 WHERE m.business_date BETWEEN '2026-09-23' AND '2026-10-19'
)
SELECT fx.id::text AS id,fx.business_date::text AS business_day,fx.match_num,
fx.league_name,fx.home_team_name,fx.away_team_name,fx.kickoff_at,fx.cutoff,
CASE WHEN mo.id IS NOT NULL THEN jsonb_build_object(
  'id',mo.id::text,'stage',mo.stage,'modelVersion',mo.model_version,
  'createdAt',mo.created_at,'updatedAt',mo.updated_at,'lockedAt',mo.locked_at,
  'direction',mo.direction,'singlePick',mo.single_pick,
  'handicapDirection',mo.handicap_direction,'htft1',mo.htft_top1,
  'htft2',mo.htft_top2,'goalRange',mo.goal_range,'topScores',mo.top_scores
) ELSE NULL END AS prematch_model,
COALESCE(od.markets,'{}'::jsonb) AS markets
FROM fx
LEFT JOIN LATERAL (
 SELECT o.* FROM public.jc_model_outputs o
 WHERE o.jc_match_id=fx.id AND o.is_locked
   AND o.locked_at<fx.cutoff AND o.created_at<=fx.cutoff AND o.updated_at<=fx.cutoff
 ORDER BY o.locked_at DESC,o.created_at DESC LIMIT 1
) mo ON true
LEFT JOIN LATERAL (
 SELECT jsonb_object_agg(s.pool_code,jsonb_build_object(
    'capturedAt',s.captured_at,'line',s.goal_line,'odds',s.outcomes)) AS markets
 FROM (
    SELECT DISTINCT ON (x.pool_code) x.pool_code,x.goal_line,x.captured_at,x.outcomes
    FROM public.jc_market_snapshots x WHERE x.jc_match_id=fx.id AND x.captured_at<=fx.cutoff
    ORDER BY x.pool_code,x.captured_at DESC,x.id DESC
 ) s
) od ON true
ORDER BY fx.business_date,fx.match_num;