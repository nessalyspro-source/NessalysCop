$lines = Get-Content scripts/app.js
for ($i=1120; $i -lt 1180; $i++) {
    Write-Host "$($i+1): $($lines[$i])"
}
