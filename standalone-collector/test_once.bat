@echo off
chcp 65001 >nul
title 球场档案 - 竞彩自动采集测试
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0collector.ps1" -Once
echo.
echo 测试结束。结果同时保存在 collector.log。
pause
