@echo off
chcp 65001 >nul
title 球场档案 - 安装15分钟自动任务
set SCRIPT=%~dp0collector.ps1
schtasks /Create /F /SC MINUTE /MO 15 /TN "QiuChang Sporttery Collector" /TR "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%SCRIPT%\" -Once"
if errorlevel 1 (
  echo.
  echo 自动任务创建失败。请右键本文件，选择“以管理员身份运行”后再试。
  pause
  exit /b 1
)
echo.
echo 自动任务已创建：每15分钟抓取一次竞彩足球官方数据。
echo 现在先执行一次测试...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Once
pause
