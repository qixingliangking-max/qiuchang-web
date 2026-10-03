# 主模型｜中央联赛数据库只读入口

更新时间：2026-10-02
用途：足球主模型 / 主库读取中央联赛数据库。
原则：只读。不得修改数据库、不得refresh/ingest、不得写回P1/P2/P3。

## 1. Supabase 只读入口

Project: qiuchang-web
Project ID: oqtloldkfjxildoribkf
Read-only role: qc_main_model_reader

主库使用现有 Supabase 连接时，所有查询必须在同一 SQL 调用内使用：

```sql
begin read only;
set local role qc_main_model_reader;
-- 这里只允许 SELECT / 只读 RPC
commit;
```

该角色已经：
- 20张联赛数据表全部授予 SELECT
- 20张表全部配置 qc_main_model_reader 专用 SELECT RLS policy
- INSERT / UPDATE / DELETE = 0权限
- public schema CREATE = false
- CREATEDB / CREATEROLE / REPLICATION / BYPASSRLS = false
- default_transaction_read_only = on
- statement_timeout = 30s

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
3. p3_not_ready 只表示“生产Supabase P3聚合层未就绪”，不等于“该联赛没有P3数据”。
4. 对 SAFE BUILD R2 / Promotion 联赛，禁止在看到 p3_not_ready 后停止；必须继续读取静态Promotion。
5. P3 quality_tier 必须一起读取；P3_VALID 不等于 FULL。
6. LIMITED / LOW_SAMPLE 只能限权使用，不得当作完整样本。

### 荷兰联赛已验收案例｜2026-10-03

NED_EE｜2026/27：
- 主模型角色 qc_main_model_reader 对 get_league_team_p3 有 EXECUTE 权限。
- 生产RPC对荷乙球队返回 ok=false / status=p3_not_ready。
- 这不是权限错误，也不是球队无P3。
- Promotion Manifest 显示 NED_EE 已发布，quality_tier=LIMITED，teams=20，gate_status=PASS。
- 当前静态权威文件：
  https://qixingliangking-max.github.io/qiuchang-web/internal-test/p3-data/NED_EE-2026-27.json
- 2026-10-03 当天011—016共12支荷乙球队均存在于该静态快照：
  奥斯、马斯特里赫特、维特斯、布雷达、瓦尔韦克、埃门、FC埃因霍温、格拉夫夏普、邓伯什、多德勒支、阿尔梅勒城、福伦丹。

NED_ED｜2026/27 同理：
- 生产RPC可能返回 p3_not_ready。
- Promotion Manifest 中 NED_ED 已发布，teams=18，quality_tier=LIMITED，gate_status=PASS。
- 静态权威文件：
  https://qixingliangking-max.github.io/qiuchang-web/internal-test/p3-data/NED_ED-2026-27.json

因此主模型遇到荷兰P3时的固定流程必须是：
数据库RPC → 若P3_VALID则读取 → 若p3_not_ready则立即切Promotion JSON → 再按quality_tier限权使用。

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

已验收：
- P1 RPC：可读
- P2 RPC：可读
- P3 RPC：可读
- league_team_score_frequency：season / home / away / last5 均可读
- 主场TOP：scope='home'
- 客场TOP：scope='away'
- 角色写权限：INSERT=false / UPDATE=false / DELETE=false

主模型每次访问必须先进入 `begin read only` 并 `set local role qc_main_model_reader`。
任何发现的数据问题只记录并回传给“球场档案网站日常维护”项目处理。
主模型不得自行修库、补数、refresh、ingest、改RPC、改schema或重新Promotion。
