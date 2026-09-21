@echo off
chcp 65001 >nul
title 球场档案 - 配置竞彩自动采集器
echo.
echo 请粘贴后台生成的 qc_col_... 采集器凭证。
echo 凭证只保存在你这台电脑当前文件夹，不会写入 GitHub。
echo.
set /p TOKEN=采集器凭证：
if "%TOKEN%"=="" (
  echo 未输入凭证。
  pause
  exit /b 1
)
echo %TOKEN%> "%~dp0collector-config.txt"
echo.
echo 已保存。下一步双击 test_once.bat 进行一次自动抓取测试。
pause
