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


## 测试前端绝对隔离

任何 P3、实验、试验性功能、数据验证或测试工作，**不得修改当前正式网站前端**。

生产保护范围包括但不限于：
- `index.html`
- `football.html`
- `league.html`
- `profile.html`
- 登录/注册相关页面
- `app.js`
- `styles.css`
- `supabase-client.js`
- 正式联赛档案脚本
- 任何正式生产路由、共享前端依赖与缓存入口

规则：
1. 测试不得以“临时测试页”“加个入口”“复用正式页面”为理由修改上述生产文件。
2. 测试默认不得部署到当前 GitHub Pages 正式路径。
3. 可视化测试只能进入独立 staging / preview 环境或独立分支，验收前不得合并 main。
4. 测试不得影响 Auth、P1、P2、比分链、正式网站读取或生产缓存。
5. 任何测试一旦对生产网站造成可见影响，立即停止并回到最近稳定基线。
6. 测试环境只允许读取生产数据；需要写入、回填、refresh、聚合时必须使用隔离环境或经过本维护项目单独审批的受控批次。
7. 允许在正式网站域名下使用 `/internal-test/` 作为隐藏预览路径，但必须同时满足：不进入正式导航、不修改任何现有正式页面/共享业务脚本、不连接生产写接口、不触发任何计算/refresh/ingest；默认使用独立静态文件或只读轻量数据。

该规则优先级高于测试便利性和开发速度。
