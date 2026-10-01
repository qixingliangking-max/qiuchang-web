# 主模型｜中央联赛数据库只读入口

更新时间：2026-10-02
用途：足球主模型 / 主库读取中央联赛数据库。
原则：只读。不得修改数据库、不得refresh/ingest、不得写回P1/P2/P3。

## 1. Supabase 只读入口

Project: qiuchang-web
Project ID: oqtloldkfjxildoribkf

允许：
- SELECT
- 调用下列只读 RPC

禁止：
- INSERT / UPDATE / DELETE
- DDL / migration
- refresh_* / ingest_* / finalize_* / validate_* 等维护函数
- deploy Edge Function
- 修改 automation / RLS / schema
- 写回任何 P1 / P2 / P3 表

正式只读 RPC：
- public.find_league_teams(p_team_query, p_limit)
- public.get_league_team_p1(p_team_query, p_league_code, p_season)
- public.get_league_team_p2(p_team_query, p_league_code, p_season)
- public.get_league_team_p2_core(p_team_query, p_league_code, p_season)
- public.get_league_team_p3(p_team_query, p_league_code, p_season)
- public.get_league_team_p3_absence_impact(p_team_query, p_league_code, p_season, p_player_query)

## 2. P1 可直接读取的数据

get_league_team_p1 已返回：
- 联赛赛季总览
- 球队赛季数据
- 主场 / 客场数据
- last5 / last10
- 0–7+ 总进球分布
- 最近比赛
- 比分高频排行

比分排行字段：
score_frequency:
- season
- home
- away
- last5

每个排行项：
- rank
- score_text
- occurrences
- sample_size
- share_pct
- last_seen_date

因此：
- 主场比分TOP：score_frequency.home
- 客场比分TOP：score_frequency.away
- 全季比分TOP：score_frequency.season
- 近5比分TOP：score_frequency.last5

## 3. P2

优先调用：
public.get_league_team_p2(team, league_code, season)

可读取 season / home / away / last5 / last10，包括：
- xG / xGA
- G-xG
- GA-xGA
- 射门 / 射正
- 射正率 / 转化率
- 上下半场进球
- HT状态
- First Goal
- Lead / Trail
- coverage / validation metadata

## 4. P3 最新权威源

注意：生产 Supabase 的 get_league_team_p3 仅对已写入生产P3聚合层的联赛完整。
SAFE BUILD R2 后新增联赛的最新 P3 权威源是 Promotion 静态快照。

Promotion Manifest:
https://qixingliangking-max.github.io/qiuchang-web/internal-test/p3-data/P3_PROMOTION_MANIFEST.json

按 Manifest 中 published_path 读取对应联赛静态 JSON。
示例：
https://qixingliangking-max.github.io/qiuchang-web/internal-test/p3-data/UEFA_UNL-2026-27.json

读取规则：
1. 若 get_league_team_p3 返回 P3_VALID，可读其结构。
2. 若返回 p3_not_ready，则必须读取 Promotion Manifest + 对应 promoted static JSON。
3. P3 quality_tier 必须一起读取；P3_VALID 不等于 FULL。
4. LIMITED / LOW_SAMPLE 只能限权使用，不得当作完整样本。

P3可读：
- player base
- role/performance
- formation / XI continuity
- depth / replacement
- absence impact base
- model factors
- quality/sample context
- 以及 promoted JSON 内全部已发布字段

## 5. 数据源优先级

P1/P2：
Supabase正式RPC / 正式表

P3：
Promotion Manifest + promoted static JSON 为当前权威；生产RPC可作为已覆盖联赛的读取入口。

## 6. 强制只读

主模型只能读取中央库，不拥有维护权限。
任何发现的数据问题只记录并回传给“球场档案网站日常维护”项目处理。
主模型不得自行修库、补数、refresh、ingest、改RPC、改schema或重新Promotion。
