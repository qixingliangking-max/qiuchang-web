param([switch]$Once)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Version = "windows-standalone-0.5"
$ConfigPath = Join-Path $PSScriptRoot "collector-config.txt"
$LogPath = Join-Path $PSScriptRoot "collector.log"
$IngestUrl = "https://oqtloldkfjxildoribkf.supabase.co/functions/v1/sporttery-ingest"
$HeartbeatUrl = "https://oqtloldkfjxildoribkf.supabase.co/functions/v1/sporttery-collector-heartbeat"

$ConditionsUrl = "https://webapi.sporttery.cn/gateway/uniform/fb/getConditionsV1.qry?method=concern"
$ListBase = "https://webapi.sporttery.cn/gateway/uniform/fb/getMatchDataPageListV1.qry"
$FixedBase = "https://webapi.sporttery.cn/gateway/uniform/football/getFixedBonusV1.qry"
$H2HBase = "https://webapi.sporttery.cn/gateway/uniform/football/getResultHistoryV1.qry"
$FeatureBase = "https://webapi.sporttery.cn/gateway/uniform/football/getMatchFeatureV1.qry"
$TablesBase = "https://webapi.sporttery.cn/gateway/uniform/football/getMatchTablesV2.qry"
$PlayerBase = "https://webapi.sporttery.cn/gateway/uniform/football/getMatchPlayerV1.qry"
$InjuryBase = "https://webapi.sporttery.cn/gateway/uniform/football/getInjurySuspensionV1.qry"
$LiveBase = "https://webapi.sporttery.cn/gateway/uniform/fb/getMatchDataPageListV1.qry"
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

function FetchJson([string]$url,[string]$referer=$Referer) {
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
      "-H","Origin: https://www.sporttery.cn",
      "-H","Referer: $referer",
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

function AddDetail($obj,[string]$name,[string]$source,$fetch) {
  if($fetch.ok -and $null -ne $fetch.json){
    if($null -eq $obj.details){
      $obj | Add-Member -NotePropertyName "details" -NotePropertyValue ([ordered]@{}) -Force
    }
    $obj.details[$name]=[ordered]@{
      source=$source
      payload=$fetch.json
    }
  }
}

function FetchLiveMap {
  $map=@{}
  $url=$LiveBase+"?method=live&pageSize=200&pageNo=1&isFix=0&isForceSort=1"
  Log "Reading live-score page data..."
  $f=FetchJson $url
  if(-not $f.ok){
    Log "Live-score data unavailable: HTTP $($f.status) / $($f.error)"
    return $map
  }
  foreach($g in @($f.json.value.matchInfoList)){
    foreach($m in @($g.subMatchList)){
      if($null -ne $m.matchId){ $map[[string]$m.matchId]=$m }
    }
  }
  Log "Live-score rows found: $($map.Count)"
  return $map
}

function EnrichMarketsAndDetails($matches) {
  $out=New-Object System.Collections.ArrayList
  $i=0
  $today=(Get-Date).ToString("yyyy-MM-dd")
  $liveMap=FetchLiveMap
  $staticWindow = $Once -or (((Get-Date).Hour % 6) -eq 0 -and (Get-Date).Minute -lt 15)

  foreach($m in @($matches)){
    $i++
    $x=CopyMatch $m
    $mid=[string]$m.matchId
    if(-not $mid){
      [void]$out.Add($x)
      continue
    }

    $detailReferer="https://www.sporttery.cn/jc/zqdz/index.html?showType=2&mid="+[uri]::EscapeDataString($mid)
    $businessDate=[string]$m.businessDate
    if(-not $businessDate){ $businessDate=[string]$m.matchDate }
    $isToday = ($businessDate -eq $today)

    # 固定奖金：每轮都抓。这里保留完整 oddsHistory，不再只保留最新一条。
    $url=$FixedBase+"?clientCode=3001&matchId="+[uri]::EscapeDataString($mid)
    Log "Fixed bonus $i/$(@($matches).Count): $($m.matchNumStr) $($m.homeTeamAbbName) vs $($m.awayTeamAbbName)"
    $f=FetchJson $url $detailReferer

    if($f.ok){
      $oh=$f.json.value.oddsHistory
      if($oh){
        AddMarket $x "had" (Latest $oh.hadList)
        AddMarket $x "hhad" (Latest $oh.hhadList)
        AddMarket $x "crs" (Latest $oh.crsList)
        AddMarket $x "ttg" (Latest $oh.ttgList)
        AddMarket $x "hafu" (Latest $oh.hafuList)
        $x | Add-Member -NotePropertyName "marketHistory" -NotePropertyValue ([ordered]@{
          had=@($oh.hadList)
          hhad=@($oh.hhadList)
          crs=@($oh.crsList)
          ttg=@($oh.ttgList)
          hafu=@($oh.hafuList)
        }) -Force
      }
      AddDetail $x "fixed_bonus" $url $f
    }else{
      if($f.status -in 403,429,567){ throw "STOP_HTTP_$($f.status)" }
      Log "Fixed bonus unavailable for $mid: HTTP $($f.status) / $($f.error)"
    }

    # 比分直播：一次抓全场，再按 matchId 回填，不需要每场网页手点。
    if($liveMap.ContainsKey($mid)){
      if($null -eq $x.details){
        $x | Add-Member -NotePropertyName "details" -NotePropertyValue ([ordered]@{}) -Force
      }
      $x.details["live"]=[ordered]@{
        source=$LiveBase+"?method=live"
        payload=[ordered]@{success=$true;value=$liveMap[$mid]}
      }
    }

    # 赛事前瞻数据变化慢，只抓竞彩日当天，并且计划任务每6小时抓一轮；手动 -Once 时强制抓。
    if($isToday -and $staticWindow){
      $detailCalls=@(
        @{name="feature"; url=$FeatureBase+"?sportteryMatchId="+[uri]::EscapeDataString($mid)+"&termLimits=10"},
        @{name="h2h"; url=$H2HBase+"?sportteryMatchId="+[uri]::EscapeDataString($mid)+"&termLimits=10&tournamentFlag=0&homeAwayFlag=0"},
        @{name="standings"; url=$TablesBase+"?gmMatchId="+[uri]::EscapeDataString($mid)},
        @{name="players"; url=$PlayerBase+"?sportteryMatchId="+[uri]::EscapeDataString($mid)+"&termLimits=3"},
        @{name="injuries"; url=$InjuryBase+"?sportteryMatchId="+[uri]::EscapeDataString($mid)}
      )

      foreach($dc in $detailCalls){
        Log "Detail $($dc.name): $($m.matchNumStr)"
        $df=FetchJson ([string]$dc.url) $detailReferer
        if($df.ok){
          AddDetail $x ([string]$dc.name) ([string]$dc.url) $df
        }else{
          if($df.status -in 403,429,567){ throw "STOP_HTTP_$($df.status)" }
          Log "Detail $($dc.name) unavailable for $mid: HTTP $($df.status) / $($df.error)"
        }
        Start-Sleep -Milliseconds 550
      }
    }

    [void]$out.Add($x)
    Start-Sleep -Milliseconds 900
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
  Log "Starting Sporttery schedule + fixed-bonus history + preview/live collection..."
  try{
    $schedule=FetchAllSchedule
    if(@($schedule.matches).Count -eq 0){
      throw "NO_SCHEDULE_MATCHES"
    }

    $enriched=EnrichMarketsAndDetails $schedule.matches
    $payload=BuildPayload $enriched
    $r=PushPayload $t $payload
    if(-not $r.ok){ throw "Ingest failed: $($r.error)" }

    Log "SUCCESS: schedule $(@($schedule.matches).Count), received $($r.matchesReceived), upserted $($r.matchesUpserted), snapshots $($r.snapshotsInserted), details $($r.detailRowsUpserted)"
    Heartbeat $t $true "schedule+bonus-history+preview+live sync success" $ListBase 200
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
