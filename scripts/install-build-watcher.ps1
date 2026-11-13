# Installs (or reinstalls) the build watcher as a Windows scheduled task for this user. No administrator rights needed.
# The task starts the watcher now and checks every 5 minutes that it is still running (it never starts a second copy).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$name = 'Drenerics build watcher'
$ps = (Get-Command powershell.exe).Source
$watcher = Join-Path $root 'scripts\build-watcher.ps1'
$action = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$watcher`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $name
Start-Sleep -Seconds 3
$t = Get-ScheduledTask -TaskName $name
Write-Host "Installed: '$name' for $user. State: $($t.State)." -ForegroundColor Green
Write-Host "It watches $root\build-requests for build requests."
