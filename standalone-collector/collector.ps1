param(
  [switch]$Once
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Version = "windows-standalone-0.3"
$ConfigPath = Join-Path $PSScriptRoot "collector-config.txt"
$LogPath = Join-Path $PSScriptRoot "collector.log"
$IngestUrl = "https://oqtloldkfjxildoribkf.supabase.co/functions/v1/sporttery-ingest"
$HeartbeatUrl = "https://oqtloldkfjxildoribkf.supabase.co/functions/v1/sporttery-collector-heartbeat"

$ScheduleUrl = "https://webapi.sporttery.cn/gateway/uniform/fb/getMatchDataPageListV1.qry?method=concern&isFix=0&pageSize=200&pageNo=1&isForceSort=1"

$OddsEndpoints = @(
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

function Fetch-Upstream([string]$Url, [string]$Referer) {
  $tmp = Join-Path $env:TEMP ("qc_sporttery_" + [guid]::NewGuid().ToString("N") + ".json")
  try {
    $args = @(
      "-L",
      "--silent",
      "--show-error",
      "--max-time", "25",
      "--connect-timeout", "10",
      "--output", $tmp,
      "--write-out", "%{http_code}",
      "-H", "User-Agent: Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/134 Mobile Safari/537.36",
      "-H", "Accept: application/json,text/plain,*/*",
      "-H", "Accept-Language: zh-CN,zh;q=0.9",
      "-H", ("Referer: " + $Referer),
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
      error = if($status -eq 567){"WAF_567"}elseif($status -eq 403){"HTTP_403"}elseif($status -eq 429){"HTTP_429"}elseif(-not $hasMatches){"NO_VALID_JSON"}else{""}
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
  } -ContentType "application/json" -Body $Fetched.text -TimeoutSec 45

  if(-not $response.ok) {
    throw "数据库接收失败：$($response.error)"
  }

  return $response
}

function Run-One {
  $token = Read-Token
  Write-Log "开始自动读取竞彩足球官方数据（赛程 + 五类玩法）"

  $scheduleOk = $false
  $oddsOk = $false
  $lastStatus = 0
  $lastSource = ""
  $lastError = ""

  Write-Log "步骤1/2：读取官方未来赛程"
  $schedule = Fetch-Upstream $ScheduleUrl "https://m.sporttery.cn/mjc/zqsj/?tab=concern"
  $lastStatus = [int]$schedule.status
  $lastSource = [string]$schedule.source
  $lastError = [string]$schedule.error

  if($schedule.ok) {
    try {
      $sr = Push-ToDatabase $token $schedule
      $scheduleOk = $true
      Write-Log "赛程入库成功：读取 $($sr.matchesReceived) 场，写入 $($sr.matchesUpserted) 场"
    } catch {
      $lastError = $_.Exception.Message
      Write-Log "赛程入库失败：$lastError"
    }
  } else {
    Write-Log "赛程接口失败：HTTP $($schedule.status) / $($schedule.error)"
  }

  Write-Log "步骤2/2：读取当前五类玩法"
  foreach($url in $OddsEndpoints) {
    $f = Fetch-Upstream $url "https://m.sporttery.cn/mjc/jsq/zqspf/"
    $lastStatus = [int]$f.status
    $lastSource = [string]$f.source
    $lastError = [string]$f.error

    if($f.ok) {
      try {
        $or = Push-ToDatabase $token $f
        $oddsOk = $true
        Write-Log "玩法入库成功：读取 $($or.matchesReceived) 场，写入 $($or.matchesUpserted) 场，新增快照 $($or.snapshotsInserted) 条"
      } catch {
        $lastError = $_.Exception.Message
        Write-Log "玩法入库失败：$lastError"
      }
      break
    }

    Write-Log "玩法接口失败：HTTP $($f.status) / $($f.error)"
  }

  if($scheduleOk -or $oddsOk) {
    $msg = "同步完成：赛程=" + ($(if($scheduleOk){"成功"}else{"失败"})) + "，玩法=" + ($(if($oddsOk){"成功"}else{"失败"}))
    Write-Log $msg
    Send-Heartbeat $token $true $msg $lastSource $lastStatus
    return $true
  }

  $error = if($lastError){$lastError}else{"FETCH_FAILED"}
  Write-Log "本轮失败：$error"
  Send-Heartbeat $token $false $error $lastSource $lastStatus
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
