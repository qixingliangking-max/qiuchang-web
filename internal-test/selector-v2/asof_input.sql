-- QCDA V2.0 — read-only point-in-time candidate extract.
-- Only returns data that existed before a hypothetical post-FINAL decision cutoff.
-- NO settlement, match result, or completed scores. Historical replay != actual publication.
WITH source_matches AS (
 SELECT m.id,m.business_date,m.match_num,m.league_short_name,m.home_team_name,m.away_team_name,m.kickoff_at,
        o.locked_at,o.updated_at AS output_updated_at,o.direction,o.handicap_direction,
        o.single_pick,o.htft_top1,o.htft_top2,o.goal_range,o.top_scores,
        GREATEST(o.locked_at,o.updated_at) AS decision_cutoff
 FROM public.jc_matches m
 JOIN public.jc_model_outputs o ON o.jc_match_id=m.id AND o.is_current=TRUE
      AND o.is_locked=TRUE AND o.stage='FINAL'
 WHERE m.business_date BETWEEN '2026-09-23' AND '2026-10-18'
   AND o.locked_at IS NOT NULL AND o.locked_at<m.kickoff_at
   AND o.updated_at<m.kickoff_at
)
SELECT b.id AS fixture_id,b.business_date,b.match_num,b.league_short_name,
       b.home_team_name,b.away_team_name,b.kickoff_at,b.decision_cutoff,
       b.locked_at,b.output_updated_at,b.direction,b.handicap_direction,b.single_pick,
       b.htft_top1,b.htft_top2,b.goal_range,b.top_scores,
       df.fetched_at AS feature_fetched_at,
       df.payload->'value'->'goalAvg'->>'homeGoalAvgCnt' AS home_goals_for,
       df.payload->'value'->'goalAvg'->>'awayGoalAvgCnt' AS away_goals_for,
       df.payload->'value'->'lossGoalAvg'->>'homeLossGoalAvgCnt' AS home_goals_against,
       df.payload->'value'->'lossGoalAvg'->>'awayLossGoalAvgCnt' AS away_goals_against,
       df.payload->'value'->'goalAvg'->>'totalLegCnt' AS sample_size,
       COALESCE(mk.markets,'{}'::jsonb) AS markets
FROM source_matches b
LEFT JOIN LATERAL (
 SELECT d.fetched_at,d.payload FROM public.jc_match_details d
 WHERE d.jc_match_id=b.id AND d.detail_type='feature'
   AND d.fetched_at<=b.decision_cutoff AND d.updated_at<=b.decision_cutoff
 ORDER BY d.fetched_at DESC LIMIT 1
) df ON TRUE
LEFT JOIN LATERAL (
 SELECT jsonb_object_agg(s.pool_code,jsonb_build_object('odds',s.outcomes,'line',s.goal_line,
                                                      'capturedAt',s.captured_at)) AS markets
 FROM (
   SELECT DISTINCT ON (j.pool_code) j.pool_code,j.outcomes,j.goal_line,j.captured_at
   FROM public.jc_market_snapshots j
   WHERE j.jc_match_id=b.id AND j.captured_at<=b.decision_cutoff
   ORDER BY j.pool_code,j.captured_at DESC,j.id DESC
 ) s
) mk ON TRUE
ORDER BY b.business_date,b.match_num;
