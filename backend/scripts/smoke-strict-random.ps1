$ErrorActionPreference = 'Continue'
$base = "http://localhost:3001/v1"
$u = "strict_t$(Get-Random -Maximum 99999)"
$reg = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body (@{ username = $u; email = "$u@example.com"; password = "Mogu12345" } | ConvertTo-Json)
$token = $reg.data.session.accessToken
Write-Host "token len $($token.Length)"
$h = @{ Authorization = "Bearer $token" }

function RunRandom($lat, $lng, $label, $mode = "STRICT") {
  $body = @{ source = "RANDOM_FLOW"; location = @{ latitude = $lat; longitude = $lng }; runtimeOverrides = @{ radiusKm = 3; locationMode = $mode } } | ConvertTo-Json -Depth 5
  $sw = [Diagnostics.Stopwatch]::StartNew()
  try {
    $res = Invoke-RestMethod -Method Post -Uri "$base/dish-randomizations" -Headers $h -ContentType "application/json" -Body $body
  } catch {
    Write-Host "ERR $label : $($_.Exception.Message) $($_.ErrorDetails.Message)"
    return
  }
  $sw.Stop()
  $d = $res.data
  Write-Host "=== $label / $mode ($($sw.ElapsedMilliseconds)ms) ==="
  Write-Host "dish: $($d.dish.name) | status=$($d.status) | fail=$($d.failReasonCode) | algo=$($d.algorithmVersion)"
  Write-Host ("nearby: " + ($d.nearby | ConvertTo-Json -Compress -Depth 4))
  Write-Host ("warmup: " + ($d.warmup | ConvertTo-Json -Compress -Depth 3))
  Write-Host ("explain: " + (($d.explanation | ConvertTo-Json -Compress -Depth 4) -replace '^(.{700}).*', '$1...'))
}

RunRandom 21.0285 105.8542 "HaNoi-HoGuom"
RunRandom 21.0285 105.8542 "HaNoi-HoGuom-2nd(cached cell)"
RunRandom 10.7769 106.7009 "HCM-Q1"
RunRandom 15.0 112.0 "OffshoreSea"
RunRandom 15.0 112.0 "OffshoreSea" "PREFER"
