param(
    [int]$Port = 3000
)

$backendDir = Resolve-Path (Join-Path $PSScriptRoot "..\\backend")
$targetUrl = "http://localhost:$Port/"

if ($Port -eq 3000) {
    try {
        $existingServer = Invoke-WebRequest -Uri $targetUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($existingServer.StatusCode -ge 200) {
            Write-Host "Backend ja esta rodando em http://localhost:3000"
            Write-Host "Abra http://localhost:3000/mock01"
            exit 0
        }
    }
    catch {
    }
}

Push-Location $backendDir
try {
    npm run dev -- --port $Port
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
