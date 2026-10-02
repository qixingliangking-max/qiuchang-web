# 意大利数据库｜中央联赛档案只读接入

更新时间：2026-10-02
用途：意大利专库读取中央联赛数据库中的意甲 / 意乙数据。
原则：只读，仅限 ITA_SA / ITA_SB。不得修改数据库、不得refresh/ingest、不得写回P1/P2/P3。

## 1. 只读角色

Project ID: oqtloldkfjxildoribkf
Read-only role: qc_italy_db_reader

所有SQL读取统一使用：

```sql
begin read only;
set local role qc_italy_db_reader;
set local statement_timeout='30s';

-- 只允许调用 Italy-only RPC

commit;
```

允许联赛：
- ITA_SA｜意甲｜2026/27
- ITA_SB｜意乙｜2026/27

其他 league_code 会直接报：
`league_not_allowed: only ITA_SA / ITA_SB`

## 2. 正式只读 RPC

球队定位：
```sql
select public.italy_find_teams('球队名',20);
```

P1：
```sql
select public.italy_get_league_team_p1('球队名','ITA_SA','2026/27');
```

P2：
```sql
select public.italy_get_league_team_p2('球队名','ITA_SA','2026/27');
```

P3：
```sql
select public.italy_get_league_team_p3('球队名','ITA_SA','2026/27');
```

意乙将 ITA_SA 改为 ITA_SB。

比赛明细：
```sql
select public.italy_get_matches('ITA_SA','2026/27','球队名',30);
```

比分频率：
```sql
select public.italy_get_score_frequency('球队名','ITA_SA','2026/27');
```

scope：
- season
- home
- away
- last5

## 3. P3最新权威源

若数据库P3返回 p3_not_ready 或版本落后，以Promotion静态JSON为准：

意甲：
https://qixingliangking-max.github.io/qiuchang-web/internal-test/p3-data/ITA_SA-2026-27.json

意乙：
https://qixingliangking-max.github.io/qiuchang-web/internal-test/p3-data/ITA_SB-2026-27.json

Promotion Manifest：
https://qixingliangking-max.github.io/qiuchang-web/internal-test/p3-data/P3_PROMOTION_MANIFEST.json

## 4. 强制限制

意大利专库不得：
- 直接SELECT中央库基础表
- 调用原始 get_league_team_p1/p2/p3
- 查询ITA_SA/ITA_SB以外联赛
- INSERT / UPDATE / DELETE
- refresh / ingest / finalize / validate
- 修改球队映射
- 修改原始比赛
- 修改P1/P2/P3
- 改schema / RLS / automation
- 写回任何自行补采集结果

如果中央库缺少某场比赛或当天临场信息：
由意大利专库自行外部补采集用于分析，不得写回中央库。

## 5. 验收

已实际验证：
- ITA_SA P1/P2/P3：可读
- ITA_SB P1/P2/P3：可读
- 比赛明细：可读
- 比分频率：可读
- 其他联赛：硬阻断
- 直接 league_matches SELECT：false
- 原始 P1 RPC：false
- refresh：false
- ingest：false
- read-only事务：on
- statement_timeout：30s
