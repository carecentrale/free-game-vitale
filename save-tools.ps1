# Saves the current build tools to the branch "build-tools" of the game's GitHub repository, so these files have
# a history and can be rolled back. Run it after changing any file in this folder:
#   put  & "$PSScriptRoot\..\save-tools.ps1" -Message "what changed"  in build-requests\run.ps1 and send a "run" request,
#   or in PowerShell here:  .\save-tools.ps1 -Message "what changed"
# Saved: the files in this folder and tests\. Never saved: build-requests\, build-android-work\, releases\ (and no keys:
# they are in other folders). It uses the game folder's git but does not touch the game's files or the main branch.
param([string]$Message = '', [string]$Notes = '')
$ErrorActionPreference = 'Continue'
$tools = $PSScriptRoot
$root = Join-Path ([Environment]::GetFolderPath('Desktop')) 'adventurers-of-drenerics-game'
Set-Location $root
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'never'
$idx = Join-Path $env:TEMP ('drenerics-tools-index-' + $PID + '.tmp')
Remove-Item $idx -Force -ErrorAction SilentlyContinue
$files = @(Get-ChildItem $tools -File) + @(Get-ChildItem (Join-Path $tools 'tests') -File -ErrorAction SilentlyContinue)
$tree = ''
$env:GIT_INDEX_FILE = $idx
try {
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($tools.Length + 1).Replace('\', '/')
    $blob = ((& git hash-object -w --no-filters $f.FullName) -join '').Trim()
    if ($blob -notmatch '^[0-9a-f]{40}$') { "SAVE STOPPED: could not read $rel"; exit 1 }
    & git update-index --add --cacheinfo "100644,$blob,$rel"
    if ($LASTEXITCODE) { "SAVE STOPPED: could not add $rel"; exit 1 }
  }
  $tree = ((& git write-tree) -join '').Trim()
} finally {
  Remove-Item Env:\GIT_INDEX_FILE -ErrorAction SilentlyContinue
  Remove-Item $idx -Force -ErrorAction SilentlyContinue
}
if ($tree -notmatch '^[0-9a-f]{40}$') { 'SAVE STOPPED: could not make the list of files'; exit 1 }
"Files: $($files.Count)"
$parent = ''
& git fetch --quiet origin '+refs/heads/build-tools:refs/remotes/origin/build-tools' 2>$null
if ($LASTEXITCODE -eq 0) { $parent = ((& git rev-parse --verify --quiet 'refs/remotes/origin/build-tools') -join '').Trim() }
if ($parent) {
  $old = ((& git rev-parse "$parent^{tree}") -join '').Trim()
  if ($old -eq $tree) { 'Nothing has changed since the last save.'; exit 0 }
}
if (-not $Message) { $Message = 'Build tools saved ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
$a = @('-c', 'user.name=Claude', '-c', 'user.email=noreply@anthropic.com', 'commit-tree', $tree, '-m', $Message)
if ($Notes) { $a += @('-m', $Notes) }
if ($parent) { $a += @('-p', $parent) }
$commit = ((& git @a) -join '').Trim()
if ($commit -notmatch '^[0-9a-f]{40}$') { 'SAVE STOPPED: could not make the commit'; exit 1 }
cmd /c "git push origin ${commit}:refs/heads/build-tools 2>&1"
if ($LASTEXITCODE) { 'SAVE STOPPED: the push to GitHub did not work (see above).'; exit 1 }
"Saved to the branch build-tools: $($commit.Substring(0,7))  $Message"
