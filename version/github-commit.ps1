# GitHub Auto-Commit Script for Mobile Trade
param(
    [Parameter(Mandatory=$true)]
    [string]$CommitMessage
)

$token = $env:GITHUB_TOKEN
if (!$token) {
    # Try to read from .env file
    $envContent = Get-Content -Path "C:\MT\.env" -Raw
    if ($envContent -match 'GITHUB_TOKEN=(.+)') {
        $token = $Matches[1].Trim()
    }
}

if (!$token) {
    Write-Host "❌ GITHUB_TOKEN not found in .env or environment" -ForegroundColor Red
    exit 1
}

$repo = "shulhpro/mobile-trade"
$headers = @{
    "Authorization" = "token $token"
    "Accept" = "application/vnd.github.v3+json"
    "Content-Type" = "application/json"
}

Write-Host "🚀 Committing to GitHub: $CommitMessage" -ForegroundColor Cyan

# Files to commit
$files = @{
    "package.json" = "C:\MT\package.json"
    "server.js" = "C:\MT\server.js"
    ".gitignore" = "C:\MT\.gitignore"
    "public/index.html" = "C:\MT\public\index.html"
    "public/manifest.json" = "C:\MT\public\manifest.json"
    "public/sw.js" = "C:\MT\public\sw.js"
    "public/css/style.css" = "C:\MT\public\css\style.css"
    "public/js/app.js" = "C:\MT\public\js\app.js"
}

$committed = 0
$errors = 0

foreach ($file in $files.GetEnumerator()) {
    $githubPath = $file.Key
    $localPath = $file.Value
    
    try {
        # Get current file SHA (needed for update)
        $currentFile = $null
        try {
            $currentFile = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/contents/$githubPath" -Headers $headers -Method GET -ErrorAction SilentlyContinue
        } catch {
            # File doesn't exist yet
        }
        
        # Read local content
        $content = Get-Content -Path $localPath -Raw
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
        $base64 = [Convert]::ToBase64String($bytes)
        
        # Prepare request body
        $body = @{
            message = $CommitMessage
            content = $base64
        }
        
        # Add SHA if file exists (update vs create)
        if ($currentFile -and $currentFile.sha) {
            $body.sha = $currentFile.sha
        }
        
        $jsonBody = $body | ConvertTo-Json
        
        # Commit file
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/contents/$githubPath" -Headers $headers -Method PUT -Body $jsonBody
        Write-Host "  ✅ $githubPath" -ForegroundColor Green
        $committed++
        
        Start-Sleep -Milliseconds 300
    } catch {
        Write-Host "  ❌ $githubPath - $($_.Exception.Message)" -ForegroundColor Red
        $errors++
    }
}

Write-Host "`n📊 Committed: $committed files, Errors: $errors" -ForegroundColor Cyan
Write-Host "🔗 https://github.com/$repo" -ForegroundColor Blue

if ($errors -eq 0) {
    exit 0
} else {
    exit 1
}
