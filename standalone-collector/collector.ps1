param(
  [switch]$Once
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Version = "windows-standalone-0.1"
$ConfigPath = Join-Path $PSScriptRoot "collector-config.txt"
$LogPath = Join-Path $PSScriptRoot "collector.log"
$IngestUrl = "https://oqtloldkfjxildoribkf.supabase.co/functions/v1/sporttery-ingest"
$HeartbeatUrl = "https://oqtloldkfjxildoribkf.supabase.co/functions/v1/sporttery-collector-heartbeat"

$Endpoints = @(
  "https://webapi.sporttery.cn/gateway/jc/football/getMatchCalculatorV1.qry?channel=c&poolCode=had,hhad,crs,ttg,hafu",
  "https://webapi.sporttery.cn/gateway/uniform/football/getMatchCalculatorV1.qry?channel=c&poolCode=had,hhad,crs,ttg,hafu"
)

function Write-Log([string]$Message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Add-Content -Path $LogPath -Value $line -Encoding UTF8
  Write-Host $line
}

function Read-Token {
  if(-not (Test-Path $ConfigPath)) {
    throw "collector-config.txt 不存在，请先运行 setup.bat"
  }
  $token = (Get-Content $ConfigPath -Raw).Trim()
  if(-not $token.StartsWith("qc_col_")) {
    throw "采集器凭证格式不正确，请重新运行 setup.bat"
  }
  return $token
}

function Send-Heartbeat(
  [string]$Token,
  [bool]$Ok,
  [string]$Message,
  [string]$Source,
  [int]$HttpStatus
) {
  try {
    $body = @{
      ok = $Ok
      message = $Message
      source = $Source
      http_status = $HttpStatus
      version = $Version
    } | ConvertTo-Json -Compress

    Invoke-RestMethod -Uri $HeartbeatUrl -Method Post -Headers @{
      "X-Collector-Token" = $Token
    } -ContentType "application/json" -Body $body -TimeoutSec 15 | Out-Null
  } catch {
    Write-Log "状态上报失败：$($_.Exception.Message)"
  }
}

function Fetch-Upstream([string]$Url) {
  $tmp = Join-Path $env:TEMP ("qc_sporttery_" + [guid]::NewGuid().ToString("N") + ".json")
  try {
    $args = @(
      "-L",
      "--silent",
      "--show-error",
      "--max-time", "20",
      "--connect-timeout", "10",
      "--output", $tmp,
      "--write-out", "%{http_code}",
      "-H", "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "-H", "Accept: application/json, text/javascript, */*; q=0.01",
      "-H", "Accept-Language: zh-CN,zh;q=0.9",
      "-H", "Referer: https://m.sporttery.cn/mjc/jsq/zqspf/",
      "-H", "Origin: https://m.sporttery.cn",
      "-H", "X-Requested-With: XMLHttpRequest",
      $Url
    )

    $statusText = (& curl.exe @args 2>&1 | Out-String).Trim()
    $curlExit = $LASTEXITCODE
    $status = 0
    if($statusText -match '(\d{3})$') { $status = [int]$matches[1] }

    $text = ""
    if(Test-Path $tmp) {
      $text = Get-Content $tmp -Raw -Encoding UTF8
    }

    if($curlExit -ne 0) {
      return @{ ok=$false; status=$status; text=$text; error="curl exit $curlExit"; source=$Url }
    }

    $json = $null
    try { $json = $text | ConvertFrom-Json } catch {}

    $hasMatches = $false
    if($json -and $json.value -and $json.value.matchInfoList) {
      $hasMatches = $true
    }

    return @{
      ok = ($status -eq 200 -and $hasMatches)
      status = $status
      text = $text
      source = $Url
      error = if($status -eq 567){"WAF_567"}elseif(-not $hasMatches){"NO_VALID_JSON"}else{""}
    }
  }
  finally {
    if(Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
  }
}

function Push-ToDatabase([string]$Token, [hashtable]$Fetched) {
  $response = Invoke-RestMethod -Uri $IngestUrl -Method Post -Headers @{
    "X-Collector-Token" = $Token
    "X-Collector-Version" = $Version
    "X-Source-Endpoint" = $Fetched.source
  } -ContentType "application/json" -Body $Fetched.text -TimeoutSec 30

  if(-not $response.ok) {
    throw "数据库接收失败：$($response.error)"
  }

  return $response
}

function Run-One {
  $token = Read-Token
  Write-Log "开始自动读取竞彩足球官方数据"

  $last = $null
  foreach($url in $Endpoints) {
    Write-Log "请求：$url"
    $f = Fetch-Upstream $url
    $last = $f

    if($f.ok) {
      Write-Log "上游读取成功，HTTP $($f.status)"
      try {
        $result = Push-ToDatabase $token $f
        Write-Log "入库成功：读取 $($result.matchesReceived) 场，写入 $($result.matchesUpserted) 场，新增快照 $($result.snapshotsInserted) 条"
        Send-Heartbeat $token $true "同步成功" $url $f.status
        return $true
      } catch {
        $msg = $_.Exception.Message
        Write-Log $msg
        Send-Heartbeat $token $false $msg $url $f.status
        return $false
      }
    }

    Write-Log "上游未成功：HTTP $($f.status) / $($f.error)"
  }

  $status = if($last){[int]$last.status}else{0}
  $source = if($last){[string]$last.source}else{""}
  $error = if($last){[string]$last.error}else{"FETCH_FAILED"}
  Send-Heartbeat $token $false $error $source $status
  Write-Log "本轮失败：$error"
  return $false
}

try {
  if($Once) {
    Run-One | Out-Null
    exit
  }

  Write-Log "球场档案竞彩自动采集器已启动，每15分钟执行一次。关闭此窗口会停止。"
  while($true) {
    Run-One | Out-Null
    Start-Sleep -Seconds 900
  }
}
catch {
  Write-Log "程序错误：$($_.Exception.Message)"
  exit 1
}
