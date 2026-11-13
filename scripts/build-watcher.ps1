# Build watcher: runs in the background on this PC (Windows Task Scheduler task "Drenerics build watcher").
# Claude (or anyone) asks for a build by writing one word into build-requests\request.txt:
#   full   update from GitHub, run the tests, build, sign, upload to Play internal testing
#   quick  update, build, sign, upload (no tests: only when the tests already passed for this version)
#   build  update, run the tests, build and sign (no upload)
#   check  only check that the Play key works (uploads nothing)
# The watcher runs it and writes the results into build-requests\:
#   status.txt  RUNNING, OK or FAILED, with the request and the times
#   last.log    everything the build printed (last-errors.log: its error stream)
#   watcher-alive.txt  updated every 15 seconds while the watcher runs
# Install or reinstall: install-build-watcher.bat. Remove: remove-build-watcher.bat.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$dir = Join-Path $root 'build-requests'
New-Item -ItemType Directory $dir -Force | Out-Null
$req = Join-Path $dir 'request.txt'
$log = Join-Path $dir 'last.log'
$errLog = Join-Path $dir 'last-errors.log'
$status = Join-Path $dir 'status.txt'
$alive = Join-Path $dir 'watcher-alive.txt'
$ps = (Get-Command powershell.exe).Source

function Stamp { Get-Date -Format 'yyyy-MM-dd HH:mm:ss' }

while ($true) {
  Set-Content $alive ("Watcher running. Last check: " + (Stamp))
  if (Test-Path $req) {
    $mode = ''
    try { $mode = ([string](Get-Content $req -Raw)).Trim().ToLower() } catch { }
    Remove-Item $req -Force -ErrorAction SilentlyContinue
    $start = Stamp
    $build = Join-Path $root 'scripts\build-android.ps1'
    $argList = $null
    switch ($mode) {
      'full'  { $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$build`" -Upload" }
      'quick' { $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$build`" -Upload -SkipTests" }
      'build' { $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$build`"" }
      'check' { $argList = "-NoProfile -ExecutionPolicy Bypass -Command `"node scripts\upload-play.mjs --check; exit `$LASTEXITCODE`"" }
    }
    if (-not $argList) {
      Set-Content $status "FAILED: unknown request '$mode' (use full, quick, build or check). At $start"
      continue
    }
    Set-Content $status "RUNNING: $mode, started $start"
    Remove-Item $log, $errLog -Force -ErrorAction SilentlyContinue
    $code = 1
    try {
      $p = Start-Process -FilePath $ps -ArgumentList $argList -WorkingDirectory $root -NoNewWindow -Wait -PassThru -RedirectStandardOutput $log -RedirectStandardError $errLog
      $code = $p.ExitCode
    } catch { Add-Content $errLog ("Watcher could not start the build: " + $_) }
    $text = ''
    if (Test-Path $log) { $text = Get-Content $log -Raw }
    $stopped = $text -match 'BUILD STOPPED|UPLOAD STOPPED'
    $result = if ($code -eq 0 -and -not $stopped) { 'OK' } else { 'FAILED' }
    $done = ''
    if ($text -match 'Done: build (\d+) is on the (\w+) track[^\r\n]*') { $done = ' ' + $matches[0] }
    Set-Content $status ("$result`: $mode, started $start, finished " + (Stamp) + ", exit code $code." + $done)
  }
  Start-Sleep -Seconds 15
}
