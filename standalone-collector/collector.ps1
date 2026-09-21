param([switch]$Once)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Version = "windows-standalone-0.3"
$ConfigPath = Join-Path $PSScriptRoot "collector-config.txt"
$LogPath = Join-Path $PSScriptRoot "collector.log"
$IngestUrl = "https://oqtloldkfjxildoribkf.supabase.co/functions/v1/sporttery-ingest"
$HeartbeatUrl = "https://oqtloldkfjxildoribkf.supabase.co/functions/v1/sporttery-collector-heartbeat"

$ConditionsUrl = "https://webapi.sporttery.cn/gateway/uniform/fb/getConditionsV1.qry?method=concern"
$ListBase = "https://webapi.sporttery.cn/gateway/uniform/fb/getMatchDataPageListV1.qry"
$FixedBase = "https://webapi.sporttery.cn/gateway/uniform/football/getFixedBonusV1.qry"
$Referer = "https://m.sporttery.cn/mjc/zqsj/?tab=concern"

function Log([string]$m) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m"
  Add-Content -Path $LogPath -Value $line -Encoding UTF8
  Write-Host $line
}

function Token {
  if(-not (Test-Path $ConfigPath)) { throw "collector-config.txt missing. Run START_HERE.cmd first." }
  $t=(Get-Content $ConfigPath -Raw).Trim()
  if(-not $t.StartsWith("qc_col_")) { throw "Collector credential format invalid." }
  return $t
}

function Heartbeat($t,$ok,$msg,$src,$status) {
  try {
    $body=@{
      ok=[bool]$ok
      message=[string]$msg
      source=[string]$src
      http_status=[int]$status
      version=$Version
    } | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri $HeartbeatUrl -Method Post -Headers @{"X-Collector-Token"=$t} -ContentType "application/json" -Body $body -TimeoutSec 15 | Out-Null
  } catch {}
}

function FetchJson([string]$url) {
  $tmp=Join-Path $env:TEMP ("qc_"+[guid]::NewGuid().ToString("N")+".json")
  try {
    $args=@(
      "-L","--silent","--show-error",
      "--max-time","25","--connect-timeout","10",
      "--output",$tmp,
      "--write-out","%{http_code}",
      "-H","User-Agent: Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/134 Mobile Safari/537.36",
      "-H","Accept: application/json,text/plain,*/*",
      "-H","Accept-Language: zh-CN,zh;q=0.9",
      "-H","Referer: $Referer",
      $url
    )

    $out=(& curl.exe @args 2>&1 | Out-String).Trim()
    $exit=$LASTEXITCODE
    $status=0
    if($out -match '(\d{3})$'){ $status=[int]$matches[1] }

    $text=""
    if(Test-Path $tmp){ $text=Get-Content $tmp -Raw -Encoding UTF8 }

    $j=$null
    try { $j=$text | ConvertFrom-Json } catch {}

    $apiOk=$false
    if($j){
      $code = if($null -ne $j.errorCode){ [string]$j.errorCode } else { "0" }
      $apiOk = ($code -eq "0")
    }

    return @{
      ok=($exit -eq 0 -and $status -eq 200 -and $j -and $apiOk)
      status=$status
      json=$j
      text=$text
      source=$url
      error=if($status -eq 567){"WAF_567"}elseif($status -eq 403){"HTTP_403"}elseif($status -eq 429){"HTTP_429"}elseif($exit -ne 0){"CURL_$exit"}elseif(-not $j){"NO_VALID_JSON"}elseif(-not $apiOk){"API_ERROR"}else{""}
    }
  }
  finally {
    if(Test-Path $tmp){ Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
  }
}

function DateRange([datetime]$start,[datetime]$end) {
  $d=$start.Date
  while($d -le $end.Date){
    $d
    $d=$d.AddDays(1)
  }
}

function Latest($rows) {
  if($null -eq $rows) { return $null }
  $arr=@($rows)
  if($arr.Count -eq 0) { return $null }
  return $arr[$arr.Count-1]
}

function CopyMatch($m) {
  $x=$m | Select-Object *
  return $x
}

function AddMarket($obj,[string]$name,$market) {
  if($null -ne $market){
    $obj | Add-Member -NotePropertyName $name -NotePropertyValue $market -Force
  }
}

function FetchAllSchedule {
  Log "Reading Sporttery available schedule range..."
  $cond=FetchJson $ConditionsUrl
  if(-not $cond.ok){ throw "Conditions failed: HTTP $($cond.status) / $($cond.error)" }

  $value=$cond.json.value
  $startText=[string]$value.startDate
  $endText=[string]$value.endDate
  if(-not $startText -or -not $endText){ throw "Conditions response has no startDate/endDate" }

  $start=[datetime]::ParseExact($startText,"yyyy-MM-dd",$null)
  $end=[datetime]::ParseExact($endText,"yyyy-MM-dd",$null)
  Log "Official available range: $startText -> $endText"

  $byId=@{}
  foreach($d in (DateRange $start $end)){
    $ds=$d.ToString("yyyy-MM-dd")
    $url=$ListBase+"?method=concern&matchDate="+$ds+"&pageSize=200&pageNo=1&isFix=0&isForceSort=1"
    Log "Schedule: $ds"
    $f=FetchJson $url
    if(-not $f.ok){
      if($f.status -in 403,429,567){ throw "STOP_HTTP_$($f.status)" }
      Log "Schedule skipped: HTTP $($f.status) / $($f.error)"
      continue
    }

    foreach($g in @($f.json.value.matchInfoList)){
      foreach($m in @($g.subMatchList)){
        if($null -ne $m.matchId){
          $byId[[string]$m.matchId]=$m
        }
      }
    }
    Start-Sleep -Milliseconds 350
  }

  Log "Schedule rows found: $($byId.Count)"
  return @{
    start=$startText
    end=$endText
    matches=@($byId.Values)
  }
}

function EnrichMarkets($matches) {
  $out=New-Object System.Collections.ArrayList
  $i=0
  foreach($m in @($matches)){
    $i++
    $x=CopyMatch $m
    $mid=[string]$m.matchId
    if(-not $mid){
      [void]$out.Add($x)
      continue
    }

    $url=$FixedBase+"?clientCode=3001&matchId="+[uri]::EscapeDataString($mid)
    Log "Markets $i/$(@($matches).Count): $($m.matchNumStr) $($m.homeTeamAbbName) vs $($m.awayTeamAbbName)"
    $f=FetchJson $url

    if($f.ok){
      $oh=$f.json.value.oddsHistory
      if($oh){
        AddMarket $x "had" (Latest $oh.hadList)
        AddMarket $x "hhad" (Latest $oh.hhadList)
        AddMarket $x "crs" (Latest $oh.crsList)
        AddMarket $x "ttg" (Latest $oh.ttgList)
        AddMarket $x "hafu" (Latest $oh.hafuList)
      }
    }else{
      if($f.status -in 403,429,567){ throw "STOP_HTTP_$($f.status)" }
      Log "Market detail unavailable for $mid: HTTP $($f.status) / $($f.error)"
    }

    [void]$out.Add($x)
    Start-Sleep -Milliseconds 1500
  }
  return @($out)
}

function BuildPayload($matches) {
  $groups=@{}
  foreach($m in @($matches)){
    $d=[string]$m.businessDate
    if(-not $d){ $d=[string]$m.matchDate }
    if(-not $d){ $d=(Get-Date).ToString("yyyy-MM-dd") }
    if(-not $groups.ContainsKey($d)){ $groups[$d]=New-Object System.Collections.ArrayList }
    [void]$groups[$d].Add($m)
  }

  $dayGroups=New-Object System.Collections.ArrayList
  foreach($d in ($groups.Keys | Sort-Object)){
    [void]$dayGroups.Add([ordered]@{
      businessDate=$d
      subMatchList=@($groups[$d])
    })
  }

  return [ordered]@{
    success=$true
    value=[ordered]@{
      lastUpdateTime=(Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
      matchInfoList=@($dayGroups)
    }
  }
}

function PushPayload($t,$payload) {
  $json=$payload | ConvertTo-Json -Depth 40 -Compress
  return Invoke-RestMethod -Uri $IngestUrl -Method Post -Headers @{
    "X-Collector-Token"=$t
    "X-Collector-Version"=$Version
    "X-Source-Endpoint"=$ListBase
  } -ContentType "application/json" -Body $json -TimeoutSec 60
}

function RunOne {
  $t=Token
  Log "Starting Sporttery schedule + market collection..."
  try{
    $schedule=FetchAllSchedule
    if(@($schedule.matches).Count -eq 0){
      throw "NO_SCHEDULE_MATCHES"
    }

    $enriched=EnrichMarkets $schedule.matches
    $payload=BuildPayload $enriched
    $r=PushPayload $t $payload
    if(-not $r.ok){ throw "Ingest failed: $($r.error)" }

    Log "SUCCESS: schedule $(@($schedule.matches).Count), received $($r.matchesReceived), upserted $($r.matchesUpserted), snapshots $($r.snapshotsInserted)"
    Heartbeat $t $true "schedule+markets sync success" $ListBase 200
  }
  catch{
    $msg=$_.Exception.Message
    Log "FAILED: $msg"
    $status=if($msg -match '567'){567}elseif($msg -match '429'){429}elseif($msg -match '403'){403}else{0}
    Heartbeat $t $false $msg $ListBase $status
  }
}

try {
  if($Once){ RunOne; exit }
  while($true){ RunOne; Start-Sleep -Seconds 900 }
}
catch {
  Log "PROGRAM ERROR: $($_.Exception.Message)"
  exit 1
}
