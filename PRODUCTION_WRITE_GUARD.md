# 球场档案生产库写入护栏

## 唯一允许写入的项目

**仅“球场档案网站日常维护”项目允许对以下生产资源执行修改：**

- Supabase Project: `oqtloldkfjxildoribkf`
- GitHub Repo: `qixingliangking-max/qiuchang-web`
- Edge Functions / Cron / 数据库DDL / 数据修复 / P1-P2-P3 refresh / ingest / 配置开关

## 其他项目的权限

其他 ChatGPT 项目、主模型工作室、联赛数据库工作室及任何分析对话：

- 只允许通过正式只读 RPC 读取 P1 / P2 / P3。
- 禁止直接写表。
- 禁止执行 INSERT / UPDATE / DELETE。
- 禁止执行 migration / DDL。
- 禁止调用 refresh / ingest / backfill 等维护函数。
- 禁止部署或修改 Edge Function。
- 禁止修改 cron、automation config、p3_enabled。
- 禁止把测试任务直接跑在生产库。

如需任何修改，必须回到 **“球场档案网站日常维护”** 项目执行，并同步记录到 MASTER_HANDOFF / CHANGELOG。

## P3额外隔离

P3不得影响已经稳定运行的：
- 网站前台
- Auth
- 比分链
- P1
- P2

P3重聚合必须采用独立、分段、限流、可中止的执行方式；不得再以高成本全量同步事务占用生产共享数据面。

最后更新：2026-10-01
