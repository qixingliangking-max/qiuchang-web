@echo off
chcp 65001 >nul
schtasks /Delete /F /TN "QiuChang Sporttery Collector"
echo 已尝试删除自动采集任务。
pause
