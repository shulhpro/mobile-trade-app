# Auto-backup script for Mobile Trade app
param(
    [Parameter(Mandatory=$true)]
    [string]$ChangeDescription
)

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$zipName = "backup_${timestamp}_$ChangeDescription.zip"
$zipPath = "C:\MT\version\$zipName"

# Create version directory if not exists
if (!(Test-Path "C:\MT\version")) {
    New-Item -ItemType Directory -Path "C:\MT\version" -Force | Out-Null
}

# Exclude unnecessary folders
$exclude = @('node_modules', 'version', '*.zip', 'uploads')
$files = Get-ChildItem -Path "C:\MT" -Exclude $exclude | Where-Object { $_.Name -notin $exclude }

# Create zip
Compress-Archive -Path $files.FullName -DestinationPath $zipPath -Force

Write-Host "Backup created: $zipName" -ForegroundColor Green
Write-Host "Size: $([math]::Round((Get-Item $zipPath).Length / 1KB, 2)) KB"

# List last 5 backups
Write-Host "`nLast 5 backups:" -ForegroundColor Cyan
Get-ChildItem -Path "C:\MT\version" -Filter "*.zip" | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -First 5 |
    Select-Object Name, @{N='SizeKB';E={[math]::Round($_.Length/1KB,2)}}, LastWriteTime |
    Format-Table -AutoSize
