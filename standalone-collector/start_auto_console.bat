@echo off
chcp 65001 >nul
title 球场档案 - 竞彩自动采集
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0collector.ps1"
pause
