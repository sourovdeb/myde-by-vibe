$ErrorActionPreference = "Stop"

$exePath = "E:\tools\sourov-control-center\dist\Sourov Control Center.exe"
$exeName = "Sourov Control Center"

# Verify exe exists
if (-not (Test-Path $exePath)) {
    Write-Host "ERROR: .exe not found at $exePath"
    exit 1
}

# 1. Startup folder shortcut
$startupDir = [Environment]::GetFolderPath("Startup")
$startupLnk = Join-Path $startupDir "$exeName.lnk"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($startupLnk)
$Shortcut.TargetPath = $exePath
$Shortcut.WorkingDirectory = Split-Path $exePath
$Shortcut.WindowStyle = 1
$Shortcut.Description = "Sourov Control Center — PC Control Dashboard"
$Shortcut.Save()
Write-Host "Startup shortcut: $startupLnk"

# 2. Desktop shortcut
$desktopDir = [Environment]::GetFolderPath("Desktop")
$desktopLnk = Join-Path $desktopDir "$exeName.lnk"
$Shortcut2 = $WshShell.CreateShortcut($desktopLnk)
$Shortcut2.TargetPath = $exePath
$Shortcut2.WorkingDirectory = Split-Path $exePath
$Shortcut2.WindowStyle = 1
$Shortcut2.Description = "Sourov Control Center — PC Control Dashboard"
$Shortcut2.Save()
Write-Host "Desktop shortcut: $desktopLnk"

# 3. Pin to taskbar (via Explorer shell)
$taskbarPin = Join-Path $env:TEMP "pin-taskbar.vbs"
$pinScript = @"
Set Shell = CreateObject("Shell.Application")
Set Folder = Shell.Namespace("$(Split-Path $exePath)")
Set Item = Folder.ParseName("$(Split-Path $exePath -Leaf)")
Item.InvokeVerb("taskbarpin")
"@
$pinScript | Out-File -FilePath $taskbarPin -Encoding ASCII
& cscript //nologo $taskbarPin
Remove-Item $taskbarPin -Force -ErrorAction SilentlyContinue
Write-Host "Taskbar pin attempted"

# 4. Create VBS autostart (silent, no console flash)
$vbsPath = "E:\tools\sourov-control-center\control-center-autostart.vbs"
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """$exePath""", 1, False
"@
$vbsContent | Out-File -FilePath $vbsPath -Encoding ASCII
Write-Host "VBS autostart: $vbsPath"

Write-Host ""
Write-Host "=== Setup Complete ==="
Write-Host "App: $exePath"
Write-Host "Size: $((Get-Item $exePath).Length / 1MB) MB"
Write-Host "Startup: $startupLnk"
Write-Host "Desktop: $desktopLnk"
Write-Host "Taskbar: Pinned (if supported)"
