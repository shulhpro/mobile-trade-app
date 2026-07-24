# Restore script for Mobile Trade app
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupName
)

$backupPath = "C:\MT\version\$BackupName"

if (!(Test-Path $backupPath)) {
    Write-Host "Backup not found: $BackupName" -ForegroundColor Red
    Write-Host "Available backups:" -ForegroundColor Yellow
    Get-ChildItem -Path "C:\MT\version" -Filter "*.zip" | Select-Object Name, LastWriteTime | Format-Table -AutoSize
    return
}

# Create current backup before restore
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$currentBackup = "C:\MT\version\backup_${timestamp}_before_restore.zip"
$exclude = @('node_modules', 'version', '*.zip', 'uploads')
$files = Get-ChildItem -Path "C:\MT" -Exclude $exclude | Where-Object { $_.Name -notin $exclude }
Compress-Archive -Path $files.FullName -DestinationPath $currentBackup -Force

Write-Host "Current state backed up to: $currentBackup" -ForegroundColor Green

# Extract backup
Expand-Archive -Path $backupPath -DestinationPath "C:\MT" -Force

Write-Host "Restored from: $BackupName" -ForegroundColor Green
