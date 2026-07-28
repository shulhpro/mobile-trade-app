# Full Deploy Script: Backup + GitHub Commit + VibeCode Deploy
param(
    [Parameter(Mandatory=$false)]
    [string]$CommitMessage = "Update from $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

Write-Host "🚀 Starting full deployment pipeline..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Create local backup
Write-Host "📦 Step 1: Creating local backup..." -ForegroundColor Yellow
& "C:\MT\version\backup.ps1" -ChangeDescription "auto_deploy"

# Step 2: Commit to GitHub
Write-Host "`n📤 Step 2: Committing to GitHub..." -ForegroundColor Yellow
& "C:\MT\version\github-commit.ps1" -CommitMessage $CommitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n⚠️  GitHub commit failed, but continuing with deploy..." -ForegroundColor Yellow
}

# Step 3: Deploy to VibeCode
Write-Host "`n🌐 Step 3: Deploying to VibeCode..." -ForegroundColor Yellow

$apiKey = "vibe_api_B5LhuhAlxAfjnWVLTCD6RU0UsDWl6IvV_05fc97"

# Create deploy ZIP
$deployZip = "C:\MT\deploy.zip"
$exclude = @('node_modules', 'version', '.env', '*.zip', 'uploads')
$files = Get-ChildItem -Path "C:\MT" -Exclude $exclude | Where-Object { $_.Name -notin $exclude }
Compress-Archive -Path $files.FullName -DestinationPath $deployZip -Force

# Upload to server
$zipBytes = [System.IO.File]::ReadAllBytes($deployZip)
$base64Zip = [Convert]::ToBase64String($zipBytes)

$body = @{
    path = "/opt/app/deploy.zip"
    content = $base64Zip
    encoding = "base64"
} | ConvertTo-Json -Depth 1

$response = Invoke-RestMethod -Uri "https://vibecode.bitrix24.tech/v1/infra/servers/85e6ec09-1ddd-4145-b396-1bf5fb7b1d21/upload" -Method POST -Headers @{
    "X-Api-Key" = $apiKey
    "Content-Type" = "application/json"
} -Body $body -TimeoutSec 120

if ($response.success) {
    Write-Host "  ✅ ZIP uploaded" -ForegroundColor Green
    
    # Unzip and restart
    $execBody = @{
        command = "cd /opt/app && unzip -o deploy.zip -d /opt/app/ && rm deploy.zip && killall -9 node 2>/dev/null; sleep 2; nohup node server.js > /tmp/app.log 2>&1 &"
    } | ConvertTo-Json
    
    $execResponse = Invoke-RestMethod -Uri "https://vibecode.bitrix24.tech/v1/infra/servers/85e6ec09-1ddd-4145-b396-1bf5fb7b1d21/exec" -Headers @{
        "X-Api-Key" = $apiKey
        "Content-Type" = "application/json"
    } -Method POST -Body $execBody -TimeoutSec 30
    
    Write-Host "  ✅ Server restarted" -ForegroundColor Green
} else {
    Write-Host "  ❌ Deploy failed" -ForegroundColor Red
}

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "🔗 GitHub: https://github.com/shulhpro/mobile-trade" -ForegroundColor Blue
Write-Host "🌐 App: https://app-116f18205548.vibecode.bitrix24.tech" -ForegroundColor Blue
