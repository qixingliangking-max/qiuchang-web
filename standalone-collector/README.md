# 球场档案｜Windows 竞彩自动采集器

这是**非浏览器扩展**方案。

工作方式：

Windows 后台任务 → 中国竞彩网移动端官方 API → Supabase → 球场档案网站

使用：
1. 双击 setup.bat，粘贴后台已有的 qc_col_... 采集器凭证。
2. 双击 test_once.bat，只测试一次。
3. 如果 test_once 成功，再双击 install_auto_15min.bat，安装每15分钟自动采集。
4. 日志在 collector.log。
5. uninstall_auto.bat 可以删除自动任务。

官方来源：
- 页面：https://m.sporttery.cn/mjc/jsq/zqspf/
- API：getMatchCalculatorV1.qry
- 玩法：HAD / HHAD / CRS / TTG / HAFU

说明：
- 该程序不会把凭证上传到 GitHub，凭证只写到你本机 collector-config.txt。
- 如果日志显示 HTTP 567，说明当前网络出口仍被竞彩网 WAF 拦截。
- 如果 HTTP 200 且入库成功，此后可完全后台自动运行，不需要打开浏览器或扩展。
