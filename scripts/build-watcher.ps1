# Build watcher: runs in the background on this PC (Windows Task Scheduler task "Drenerics build watcher").
# Claude (or anyone) asks for work by writing one word into build-requests\request.txt:
#   full   update from GitHub, run the tests, build, sign, upload to Play internal testing
#   quick  update, build, sign, upload (no tests: only when the tests already passed for this version)
#   build  update, run the tests, build and sign (no upload)
#   check  only check that the Play key works (uploads nothing)
#   push   push this folder's main branch to GitHub (needs github-sign-in.bat once)
#   tidy   close finished "Press any key" windows left by the project's .bat files
#   run    run build-requests\run.ps1 (a PowerShell script Claude writes for one job, e.g. a maintenance step), then
#          delete it. Its output goes to last.log, and the script is kept with the log in history\.
#   status write build-requests\machine.txt: Windows, uptime, free disk, power and sleep settings, tool versions,
#          the build watcher task and its processes (read-only)
#   restart  stop this watcher; the scheduled task starts it again within 5 minutes (picks up a new version)
# Results in build-requests\:
#   status.txt          RUNNING, OK or FAILED, with the request and the times
#   last.log            everything the last run printed; last-errors.log: its error stream
#   history.log         one line per run, kept forever; history\  the full log of the last 30 runs
#   errors.log          every failure, with the end of its log
#   watcher-alive.txt   updated every 15 seconds; watcher-errors.log: problems in the watcher itself
# Every finished build, push or failure also shows a Windows notification on this PC.
# Builds run hidden: no windows open. Before each request the watcher closes finished .bat windows from this folder.
# When this file changes, the watcher stops itself and the scheduled task starts the new version within 5 minutes.
# Install or reinstall: install-build-watcher.bat. Remove: remove-build-watcher.bat.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$dir = Join-Path $root 'build-requests'
$histDir = Join-Path $dir 'history'
New-Item -ItemType Directory $histDir -Force | Out-Null
$req = Join-Path $dir 'request.txt'
$log = Join-Path $dir 'last.log'
$errLog = Join-Path $dir 'last-errors.log'
$status = Join-Path $dir 'status.txt'
$alive = Join-Path $dir 'watcher-alive.txt'
$history = Join-Path $dir 'history.log'
$errors = Join-Path $dir 'errors.log'
$watcherErrors = Join-Path $dir 'watcher-errors.log'
$ps = (Get-Command powershell.exe).Source
$myFile = $PSCommandPath
$myStamp = (Get-Item $myFile).LastWriteTimeUtc

function Stamp { Get-Date -Format 'yyyy-MM-dd HH:mm:ss' }

# Keeps Windows awake while the watcher runs, so the build PC stays reachable (the screen can still turn off).
# This is what media players do; it changes no Windows setting, and ends when the watcher stops.
# To let the PC sleep again, create build-requests\allow-sleep.txt (the watcher checks every 15 seconds).
$awakeOk = $true
try { Add-Type -Namespace Drenerics -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);' -ErrorAction Stop }
catch { $awakeOk = $false }
function StayAwake {
  if (-not $awakeOk) { return }
  # ES_CONTINUOUS (0x80000000) + ES_SYSTEM_REQUIRED (0x1), or ES_CONTINUOUS alone to allow sleep again
  $flags = if (Test-Path (Join-Path $dir 'allow-sleep.txt')) { [uint32]2147483648 } else { [uint32]2147483649 }
  try { [Drenerics.Power]::SetThreadExecutionState($flags) | Out-Null } catch { }
}

# A Windows notification on this PC. Never stops the watcher if notifications are not available.
function Notify($title, $text) {
  try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $t = $xml.GetElementsByTagName('text')
    $t.Item(0).AppendChild($xml.CreateTextNode($title)) | Out-Null
    $t.Item(1).AppendChild($xml.CreateTextNode($text)) | Out-Null
    $app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show([Windows.UI.Notifications.ToastNotification]::new($xml))
  } catch { Add-Content $watcherErrors ((Stamp) + " notification failed: " + $_) }
}

# Closes finished windows of this folder's .bat files (a cmd window with no running program left, waiting at "Press any key").
# A window that is still running something (a build, a test) is never closed.
function Tidy {
  $closed = 0
  $procs = @(Get-CimInstance Win32_Process)
  foreach ($p in $procs) {
    if ($p.Name -ne 'cmd.exe' -or -not $p.CommandLine) { continue }
    if ($p.CommandLine -notlike "*$root*" -or $p.CommandLine -notmatch '\.bat') { continue }
    $busy = $procs | Where-Object { $_.ParentProcessId -eq $p.ProcessId -and $_.Name -ne 'conhost.exe' }
    if ($busy) { continue }
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; $closed++ } catch { }
  }
  return $closed
}

# Keeps the full logs of the last 30 runs
function Archive($mode, $result) {
  $name = (Get-Date -Format 'yyyyMMdd-HHmmss') + "-$mode-$result.log"
  $out = Join-Path $histDir $name
  if (Test-Path $log) { Copy-Item $log $out -Force }
  if ((Test-Path $errLog) -and (Get-Item $errLog).Length -gt 0) { Add-Content $out "`r`n---- error stream ----"; Get-Content $errLog | Add-Content $out }
  Get-ChildItem $histDir -Filter *.log | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force -ErrorAction SilentlyContinue
  return $name
}

while ($true) {
  try {
    if ((Get-Item $myFile).LastWriteTimeUtc -ne $myStamp) {
      Set-Content $alive ("Watcher stopped to update itself at " + (Stamp) + ". The scheduled task starts the new version within 5 minutes.")
      Add-Content $history ((Stamp) + "  watcher restarting for an update")
      exit 0
    }
    StayAwake
    $awakeNote = if (-not $awakeOk) { ' (could not keep the PC awake)' } elseif (Test-Path (Join-Path $dir 'allow-sleep.txt')) { ' (sleep allowed)' } else { ' (keeping the PC awake)' }
    Set-Content $alive ("Watcher running. Last check: " + (Stamp) + $awakeNote)
    if (Test-Path $req) {
      $mode = ''
      try { $mode = ([string](Get-Content $req -Raw)).Trim().ToLower() } catch { }
      Remove-Item $req -Force -ErrorAction SilentlyContinue
      $start = Stamp
      $tidied = Tidy
      $build = Join-Path $root 'scripts\build-android.ps1'
      $runScript = Join-Path $dir 'run.ps1'
      $statusScript = Join-Path $root 'scripts\machine-status.ps1'
      $argList = $null
      $handled = $false   # set inside the switch when the request is already dealt with (a continue there would only leave the switch)
      switch ($mode) {
        'full'  { $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$build`" -Upload" }
        'quick' { $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$build`" -Upload -SkipTests" }
        'build' { $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$build`"" }
        'check' { $argList = "-NoProfile -ExecutionPolicy Bypass -Command `"node scripts\upload-play.mjs --check; exit `$LASTEXITCODE`"" }
        'push'  { $argList = "-NoProfile -ExecutionPolicy Bypass -Command `"`$env:GCM_INTERACTIVE='never'; `$env:GIT_TERMINAL_PROMPT='0'; cmd /c 'git push origin main 2>&1'; exit `$LASTEXITCODE`"" }
        'run'   {
          if (Test-Path $runScript) { $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$runScript`"" }
          else { Set-Content $status "FAILED: run, but there is no build-requests\run.ps1. At $start"; Add-Content $history "$start  run  FAILED  no run.ps1"; $handled = $true }
        }
        'status' { $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$statusScript`"" }
        'restart' {
          Set-Content $status "OK: restart requested at $start. The scheduled task starts the watcher again within 5 minutes."
          Add-Content $history "$start  restart  OK"
          Set-Content $alive ("Watcher stopped on request at " + (Stamp) + ". The scheduled task starts it again within 5 minutes.")
          exit 0
        }
        'tidy'  {
          Set-Content $status "OK: tidy, $tidied finished window(s) closed, at $start."
          Add-Content $history "$start  tidy  OK  ($tidied window(s) closed)"
          $handled = $true
        }
      }
      if ($handled) { continue }
      if (-not $argList) {
        Set-Content $status "FAILED: unknown request '$mode' (use full, quick, build, check, push, tidy, run, status or restart). At $start"
        Add-Content $history "$start  '$mode'  FAILED  unknown request"
        continue
      }
      Set-Content $status "RUNNING: $mode, started $start"
      Remove-Item $log, $errLog -Force -ErrorAction SilentlyContinue
      $code = 1
      try {
        # Waits for the run itself only: Start-Process -Wait would also wait for any background process the build left running
        $p = Start-Process -FilePath $ps -ArgumentList $argList -WorkingDirectory $root -NoNewWindow -PassThru -RedirectStandardOutput $log -RedirectStandardError $errLog
        $null = $p.Handle   # keeps the exit code readable after the process ends
        $p.WaitForExit()
        $code = $p.ExitCode
      } catch { Add-Content $errLog ("Watcher could not start the run: " + $_) }
      $text = ''
      if (Test-Path $log) { $text = [string](Get-Content $log -Raw) }
      $stopped = $text -match 'BUILD STOPPED|UPLOAD STOPPED'
      $result = if ($code -eq 0 -and -not $stopped) { 'OK' } else { 'FAILED' }
      $detail = ''
      if ($text -match 'Done: build (\d+) is on the (\w+) track[^\r\n]*') { $detail = $matches[0] }
      elseif ($text -match '(BUILD|UPLOAD) STOPPED:[^\r\n]*') { $detail = $matches[0] }
      $tests = ''
      if ($text -match 'Tests: ([^\r\n]*)') { $tests = 'Tests: ' + $matches[1] }
      elseif ($text -match '# pass (\d+)') { $tests = "tests passed: $($matches[1])" }
      $flaky = @([regex]::Matches($text, 'FLAKY \(failed, then passed on the rerun\): ([^\r\n]*)') | ForEach-Object { $_.Groups[1].Value })
      if ($flaky.Count) { Add-Content (Join-Path $dir 'flaky.log') ($flaky | ForEach-Object { "$start  $mode  $_" }) }
      $end = Stamp
      $saved = Archive $mode $result
      if ($mode -eq 'run' -and (Test-Path $runScript)) {
        $kept = Join-Path $histDir $saved
        Add-Content $kept "`r`n---- the script that was run (run.ps1) ----"
        Get-Content $runScript | Add-Content $kept
        Remove-Item $runScript -Force -ErrorAction SilentlyContinue
      }
      Set-Content $status ("$result`: $mode, started $start, finished $end, exit code $code. $tests $detail Full log: history\$saved").Trim()
      Add-Content $history ("$start  $mode  $result  exit $code  $tests  $detail").TrimEnd()
      if ($result -eq 'FAILED') {
        Add-Content $errors ("==== $end  $mode FAILED (exit $code)  log: history\$saved")
        if ($text) { ($text -split "`r?`n" | Select-Object -Last 30) | Add-Content $errors }
        if ((Test-Path $errLog) -and (Get-Item $errLog).Length -gt 0) { Add-Content $errors '-- error stream (end) --'; Get-Content $errLog | Select-Object -Last 15 | Add-Content $errors }
        Notify "Drenerics: $mode FAILED" ($(if ($detail) { $detail } else { "Exit code $code. See build-requests\errors.log" }))
      } elseif ($mode -notin @('check', 'run', 'status')) {
        Notify "Drenerics: $mode OK" ($(if ($detail) { $detail } else { "Finished at $end" }))
      }
    }
  } catch {
    Add-Content $watcherErrors ((Stamp) + "  " + $_)
  }
  Start-Sleep -Seconds 15
}
