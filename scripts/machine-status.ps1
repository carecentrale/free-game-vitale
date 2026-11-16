# Writes a read-only report on this build PC to build-requests\machine.txt (and prints it): Windows, uptime, disk,
# power and sleep settings, tool versions, the build watcher task and the processes that matter for builds.
# Run by the build watcher's "status" request. Changes nothing.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$out = New-Object System.Collections.Generic.List[string]
function Line($s) { $out.Add([string]$s) }
function Section($s) { Line ''; Line "== $s" }
$os = Get-CimInstance Win32_OperatingSystem
Line ("Report time: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Line ("Computer: $env:COMPUTERNAME, user $env:USERNAME, " + $os.Caption + ' ' + $os.Version)
Line ("Up since: " + $os.LastBootUpTime + " (" + [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1) + " hours)")
Section 'Disk'
Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | ForEach-Object { Line ("{0}: {1:N1} GB free of {2:N1} GB" -f $_.Name, ($_.Free / 1GB), (($_.Used + $_.Free) / 1GB)) }
foreach ($f in 'releases', 'build-android-work', 'node_modules', 'build-requests') {
  $p = Join-Path $root $f
  if (Test-Path $p) { $mb = (Get-ChildItem $p -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB; Line ("{0}: {1:N0} MB" -f $f, $mb) }
}
Section 'Power and sleep (plugged in; 0 = never)'
foreach ($q in @(@('SUB_SLEEP', 'STANDBYIDLE', 'Sleep after (s)'), @('SUB_SLEEP', 'HIBERNATEIDLE', 'Hibernate after (s)'), @('SUB_VIDEO', 'VIDEOIDLE', 'Screen off after (s)'), @('SUB_BUTTONS', 'LIDACTION', 'Lid closed (0 = do nothing, 1 = sleep)'))) {
  $txt = (& powercfg /query SCHEME_CURRENT $q[0] $q[1] 2>$null | Out-String)
  if ($txt -match 'Current AC Power Setting Index:\s*0x([0-9a-fA-F]+)') { Line ($q[2] + ': ' + [Convert]::ToInt32($matches[1], 16)) } else { Line ($q[2] + ': unknown') }
}
$bat = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
if ($bat) { Line ("Battery: " + $bat.EstimatedChargeRemaining + "%, " + $(if ($bat.BatteryStatus -eq 2) { 'plugged in' } else { 'status ' + $bat.BatteryStatus })) }
Section 'Tools'
foreach ($c in @(@('node', '--version'), @('git', '--version'), @('npm', '--version'))) {
  $cmd = Get-Command $c[0] -ErrorAction SilentlyContinue
  if ($cmd) { Line ($c[0] + ': ' + ((& $c[0] $c[1] 2>$null | Select-Object -First 1)) + '  (' + $cmd.Source + ')') } else { Line ($c[0] + ': not found') }
}
$jdk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Claude tools for access\jdk-21\bin\java.exe'
Line ('Java 21 for builds: ' + $(if (Test-Path $jdk) { 'present' } else { 'MISSING' }))
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
Line ('Android SDK: ' + $(if (Test-Path $sdk) { (Get-ChildItem (Join-Path $sdk 'platforms') -ErrorAction SilentlyContinue | ForEach-Object Name) -join ', ' } else { 'MISSING' }))
Section 'Build watcher'
$t = Get-ScheduledTask -TaskName 'Drenerics build watcher' -ErrorAction SilentlyContinue
if ($t) { $i = $t | Get-ScheduledTaskInfo; Line ("Task: " + $t.State + ", last run " + $i.LastRunTime + ", result " + $i.LastTaskResult + ", next " + $i.NextRunTime) } else { Line 'Task: NOT INSTALLED' }
$procs = @(Get-CimInstance Win32_Process)
$w = $procs | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*build-watcher.ps1*' }
Line ("Watcher processes: " + @($w).Count + $(if ($w) { ' (started ' + (($w | ForEach-Object { $_.CreationDate }) -join ', ') + ')' } else { '' }))
$gradle = $procs | Where-Object { $_.Name -eq 'java.exe' -and $_.CommandLine -match 'GradleDaemon|kotlin-daemon|KotlinCompileDaemon' }
Line ("Gradle or Kotlin background processes: " + @($gradle).Count)
$waiting = $procs | Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -like "*$root*" -and $_.CommandLine -match '\.bat' }
Line ("Open .bat windows from the game folder: " + @($waiting).Count)
Section 'Git'
Push-Location $root
Line ((& git status -sb 2>$null | Select-Object -First 1))
Line ((& git log --oneline -1 2>$null))
Pop-Location
$text = $out -join "`r`n"
Set-Content (Join-Path $root 'build-requests\machine.txt') $text
$text
