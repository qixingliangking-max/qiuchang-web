# 球场档案·竞彩采集器

Chrome / Edge 扩展。它会用本机浏览器网络打开中国竞彩网官方页面，读取竞彩足球官方 JSON，然后发送到球场档案 Supabase。

## 安装
1. 解压整个 collector-extension 文件夹。
2. Chrome 打开 chrome://extensions/（Edge 打开 edge://extensions/）。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”，选择 collector-extension 文件夹。
5. 在球场档案后台点击“创建本机采集器凭证”，复制 qc_col_...。
6. 点击浏览器工具栏里的“球场档案·竞彩采集器”，粘贴凭证并保存。
7. 点击“立即同步”。

默认每15分钟自动同步一次。电脑或浏览器关闭时不会采集。

如果显示 Access Restricted，请先在普通浏览器打开 https://www.sporttery.cn/ 检查当前网络是否能正常访问；关闭代理/VPN或切换可正常访问竞彩网的网络后再试。
