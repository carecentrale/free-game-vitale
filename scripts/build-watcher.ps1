# Build watcher: runs in the background on this PC (Windows Task Scheduler task "Drenerics build watcher").
# Claude (or anyone) asks for work by writing one word into build-requests\request.txt:
#   full   update from GitHub, run the tests, build, sign, upload to Play internal testing
#   quick  update, build, sign, upload (no tests: only when the tests already passed for this version)
#   build  update, run the tests, build and sign (no upload)
#   check  only check that the Play key works (uploads nothing)
#   push   push this folder's main branch to GitHub (needs github-sign-in.bat once)
#   tidy   close finished "Press any key" windows left by the project's .bat files
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
    Set-Content $alive ("Watcher running. Last check: " + (Stamp))
    if (Test-Path $req) {
      $mode = ''
      try { $mode = ([string](Get-Content $req -Raw)).Trim().ToLower() } catch { }
      Remove-Item $req -Force -ErrorAction SilentlyContinue
      $start = Stamp
      $tidied = Tidy
      $build = Join-Path $root 'scripts\build-android.ps1'
      $argList = $null
      switch ($mode) {
        'full'  { $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$build`" -Upload" }
        'quick' { $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$build`" -Upload -SkipTests" }
        'build' { $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$build`"" }
        'check' { $argList = "-NoProfile -ExecutionPolicy Bypass -Command `"node scripts\upload-play.mjs --check; exit `$LASTEXITCODE`"" }
        'push'  { $argList = "-NoProfile -ExecutionPolicy Bypass -Command `"`$env:GCM_INTERACTIVE='never'; `$env:GIT_TERMINAL_PROMPT='0'; git push origin main 2>&1; exit `$LASTEXITCODE`"" }
        'tidy'  {
          Set-Content $status "OK: tidy, $tidied finished window(s) closed, at $start."
          Add-Content $history "$start  tidy  OK  ($tidied window(s) closed)"
          continue
        }
      }
      if (-not $argList) {
        Set-Content $status "FAILED: unknown request '$mode' (use full, quick, build, check, push or tidy). At $start"
        Add-Content $history "$start  '$mode'  FAILED  unknown request"
        continue
      }
      Set-Content $status "RUNNING: $mode, started $start"
      Remove-Item $log, $errLog -Force -ErrorAction SilentlyContinue
      $code = 1
      try {
        $p = Start-Process -FilePath $ps -ArgumentList $argList -WorkingDirectory $root -NoNewWindow -Wait -PassThru -RedirectStandardOutput $log -RedirectStandardError $errLog
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
      Set-Content $status ("$result`: $mode, started $start, finished $end, exit code $code. $tests $detail Full log: history\$saved").Trim()
      Add-Content $history ("$start  $mode  $result  exit $code  $tests  $detail").TrimEnd()
      if ($result -eq 'FAILED') {
        Add-Content $errors ("==== $end  $mode FAILED (exit $code)  log: history\$saved")
        if ($text) { ($text -split "`r?`n" | Select-Object -Last 30) | Add-Content $errors }
        if ((Test-Path $errLog) -and (Get-Item $errLog).Length -gt 0) { Add-Content $errors '-- error stream (end) --'; Get-Content $errLog | Select-Object -Last 15 | Add-Content $errors }
        Notify "Drenerics: $mode FAILED" ($(if ($detail) { $detail } else { "Exit code $code. See build-requests\errors.log" }))
      } elseif ($mode -ne 'check') {
        Notify "Drenerics: $mode OK" ($(if ($detail) { $detail } else { "Finished at $end" }))
      }
    }
  } catch {
    Add-Content $watcherErrors ((Stamp) + "  " + $_)
  }
  Start-Sleep -Seconds 15
}
