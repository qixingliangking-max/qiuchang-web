# 球场档案｜Windows 竞彩自动采集器 v0.3

这是**非浏览器扩展**方案。

当前正式链路：

Windows 后台任务
→ 中国竞彩网移动端赛程接口 `getConditionsV1`
→ 按日期读取 `getMatchDataPageListV1`
→ 按每个官方 `matchId` 低频读取 `getFixedBonusV1`
→ HAD / HHAD / CRS / TTG / HAFU
→ Supabase
→ 球场档案前台

这版不再依赖旧的计算器接口，因此能够把官方页面可见的未来赛程先完整拉入数据库，再逐场补五类官方玩法。

使用顺序：
1. START_HERE.cmd 保存采集器凭证。
2. TEST_ONCE.cmd 做一次全链路测试。
3. 成功后运行 INSTALL_AUTO_15MIN.cmd。
4. collector.log 查看本机日志。
