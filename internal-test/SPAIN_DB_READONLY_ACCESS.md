# 西班牙数据库｜中央联赛库只读入口

更新时间：2026-10-02
用途：西班牙专库读取中央联赛数据库中的西甲 / 西乙数据。
原则：只读，仅限 ESP_LL / ESP_L2。不得修改数据库、不得refresh/ingest、不得写回P1/P2/P3。

## 1. 只读角色

Project: qiuchang-web
Project ID: oqtloldkfjxildoribkf
Read-only role: qc_spain_db_reader

所有SQL读取都使用：

```sql
begin read only;
set local role qc_spain_db_reader;

-- 只允许调用下列 Spain-only RPC

commit;
```

角色限制：
- 只允许受限 Spain RPC
- 不授予任何联赛基础表 SELECT
- INSERT / UPDATE / DELETE：无权限
- DDL / CREATE：无权限
- refresh / ingest / finalize / validate：无权限
- default_transaction_read_only = on
- statement_timeout = 30s

允许联赛：
- ESP_LL｜西甲｜2026/27
- ESP_L2｜西乙｜2026/27

其他 league_code 会直接报：
`league_not_allowed: only ESP_LL / ESP_L2`

## 2. 正式只读 RPC

### 查球队
```sql
select public.spain_find_teams('皇家',20);
```

### P1
```sql
select public.spain_get_league_team_p1(
  '皇家社会',
  'ESP_LL',
  '2026/27'
);
```

### P2
```sql
select public.spain_get_league_team_p2(
  '皇家社会',
  'ESP_LL',
  '2026/27'
);
```

### P3
```sql
select public.spain_get_league_team_p3(
  '皇家社会',
  'ESP_LL',
  '2026/27'
);
```

注意：SAFE BUILD R2 后，西甲 / 西乙 P3 的最新权威源仍是 Promotion 静态快照。数据库RPC可作为结构读取入口；若返回 p3_not_ready 或版本落后，以静态Promotion为准。

西甲 P3：
https://qixingliangking-max.github.io/qiuchang-web/internal-test/p3-data/ESP_LL-2026-27.json

西乙 P3：
https://qixingliangking-max.github.io/qiuchang-web/internal-test/p3-data/ESP_L2-2026-27.json

Promotion Manifest：
https://qixingliangking-max.github.io/qiuchang-web/internal-test/p3-data/P3_PROMOTION_MANIFEST.json

### 比赛明细
```sql
select public.spain_get_matches(
  'ESP_LL',
  '2026/27',
  null,
  50
);
```

查某队：
```sql
select public.spain_get_matches(
  'ESP_L2',
  '2026/27',
  '加的斯',
  30
);
```

返回字段包括：
- match_date / kickoff_at
- home_team_name / away_team_name
- HT / FT
- status
- source / source_match_id

不返回 raw 原始响应。

### 比分频率排行
```sql
select public.spain_get_score_frequency(
  '皇家社会',
  'ESP_LL',
  '2026/27'
);
```

scope：
- season
- home
- away
- last5

返回：
- rank
- score_text
- occurrences
- sample_size
- share_pct
- last_seen_date

P1 内部也已经带同一组 score_frequency，可优先直接读取 P1。

## 3. 数据使用顺序

球队定位：
spain_find_teams

基础与比分分布：
spain_get_league_team_p1

xG / 射门 / 比赛路径：
spain_get_league_team_p2

阵容 / 球员 / 深度：
spain_get_league_team_p3
若数据库P3不是最新，则读取对应 Promotion 静态 JSON。

近期比赛或指定球队比赛：
spain_get_matches

单独读取主场/客场/赛季/近5比分TOP：
spain_get_score_frequency

## 4. 强制限制

西班牙专库不得：
- SELECT 中央库基础表
- 调用原始 get_league_team_p1 / p2 / p3
- 查询 ESP_LL / ESP_L2 以外联赛
- INSERT / UPDATE / DELETE
- refresh / ingest / finalize / validate
- 修改球队映射
- 修改P1/P2/P3
- 重新Promotion
- 改schema / RLS / automation

如果中央库没有某场比赛或某项外部信息：
由西班牙专库自行外部补采集用于分析，不得写回中央库。
发现中央库问题，只记录并反馈给“球场档案网站日常维护”项目处理。

## 5. 验收结果

已实际验证：
- qc_spain_db_reader 可 SET ROLE
- P1：可读
- P2：可读
- P3：可读
- 西甲比赛明细：可读
- 比分频率：可读
- ENG_PL：被 league_not_allowed 阻断
- league_matches 直接 SELECT：false
- league_team_score_frequency 直接 SELECT：false
- 原始 get_league_team_p1 EXECUTE：false
- refresh_league_p1_stats EXECUTE：false
- ingest_fotmob_league_matches_pending EXECUTE：false
- refresh_league_team_p3 EXECUTE：false
- ingest_fotmob_p3_match EXECUTE：false

另外，历史上残留的 maintenance PUBLIC EXECUTE 已收口到 service_role / owner，主模型只读角色也同步获得更严格保护。
