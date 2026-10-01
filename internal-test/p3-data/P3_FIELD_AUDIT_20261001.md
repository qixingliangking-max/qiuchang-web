# P3 V5 四库字段一致性审计｜2026-10-01

基准：**KOR_K1 / P3_V5_KOR_STABLE**

## 总结
- 四库 Schema：**完全一致**
- 必需块：**0 缺失**
- required_slots=11：**全部通过**
- 普通替补链 OTHER_STARTER：**0**
- Performance 空值规则违规：**0**
- 有出场分钟但 primary_position 为空：**0**
- VALID/PARTIAL 深度行关键指标缺失：**0**

| 联赛 | 球队 | 样本 | 使用模式 | 质量层级 | Schema | 硬Gate | Depth有效率 |
|---|---:|---|---|---|---|---|---:|
| KOR_K1 | 12 | 30-30场 | FULL | STABLE | PASS | PASS | 83.9% |
| USA_MLS | 30 | 26-28场 | FULL | PILOT_FULL | PASS | PASS | 75.6% |
| NOR_ES | 16 | 21-21场 | FULL | PILOT_FULL | PASS | PASS | 73.9% |
| UEFA_UNL | 54 | 1-2场 | LIMITED | LIMITED | PASS | PASS | 0% |

## 真正需要清账的警告
- KOR_K1：仁川联 midfield_bench_strength 为空。
- USA_MLS：皇家盐湖城 midfield_bench_strength 为空；休斯敦迪纳摩 attacking_bench_strength 为空。
- NOR_ES：汉坎 attacking_bench_strength 为空；特罗姆瑟 midfield_bench_strength 为空。
- UEFA_UNL：54队全部 LOW_SAMPLE/LIMITED，平均 1.9 场；392个D位置全部LOW，深度/替代差/Model Loss目前不成熟。**结构可用，但不能与FULL质量等价。**

## 允许为空，不算缺陷
- 0分钟球员：Performance=UNTESTED，performance_score为空。
- 动态模型因子：REPLACEMENT_GAP / AVAILABILITY_IMPACT。
- save_pct：门将位置特有。
- second_formation：可选。
- DATA_INCOMPLETE / NO_BACKUP 深度行的替代质量/损失字段。

## 后续锁定
1. 韩国V5作为唯一Schema Contract。
2. 新P3 JSON先跑Schema+Hard Gate，失败不能进入P3_VALID结构层。
3. LOW_SAMPLE/LIMITED必须显式标识质量层级。
4. P3-E只允许单球员按需1次RPC，缓存+限频，禁止批量。
