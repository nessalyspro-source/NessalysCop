$lines = Get-Content scripts/app.js
for ($i=520; $i -le 560; $i++) {
    Write-Host ($lines[$i])
}
