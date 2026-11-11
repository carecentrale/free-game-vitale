# Builds the signed Android app (.aab) for Google Play on this PC. No GitHub needed.
# Run it by double-clicking build-android.bat in the project folder.
#
# What it does:
#   1. Checks that Node.js 22+, Java (from Android Studio) and the Android SDK are installed.
#   2. Runs all the tests (skip with -SkipTests). Stops if any test fails.
#   3. Builds the app in a separate work folder (build-android-work), so the project files are not changed.
#   4. Signs it with the upload key in "Claude tools for access\drenerics-upload-key".
#   5. Saves it as releases\drenerics-<version>-code<N>.aab and raises the build number in android-version-code.txt.
#
# Then upload the .aab in Play Console: Test and release > Testing > Internal testing > Create new release.

param([switch]$SkipTests)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Say($msg) { Write-Host ''; Write-Host "== $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host ''; Write-Host "BUILD STOPPED: $msg" -ForegroundColor Red; exit 1 }

# ---- 1. Tools ----
Say 'Checking the tools'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail 'Node.js is not installed. Install Node.js 22 (LTS) from https://nodejs.org, then run this again.' }
$nodeMajor = [int]((& node -v).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 22) { Fail "Node.js 22 or newer is needed (this PC has $(& node -v)). Install it from https://nodejs.org." }

if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
  foreach ($j in @("$env:ProgramFiles\Android\Android Studio\jbr", "$env:LOCALAPPDATA\Programs\Android Studio\jbr")) {
    if (Test-Path "$j\bin\java.exe") { $env:JAVA_HOME = $j; break }
  }
}
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) { Fail 'Java was not found. Install Android Studio from https://developer.android.com/studio and open it once.' }
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
if (-not (Test-Path "$env:ANDROID_HOME\platform-tools")) { Fail "The Android SDK was not found at $env:ANDROID_HOME. Open Android Studio once and let it finish its setup (it installs the SDK)." }
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
Write-Host "Node $(& node -v), Java at $env:JAVA_HOME, Android SDK at $env:ANDROID_HOME"

# ---- Upload key ----
$keyDir = Join-Path $HOME 'Desktop\Claude tools for access\drenerics-upload-key'
$keystore = Join-Path $keyDir 'upload.keystore'
$pwFile = Join-Path $keyDir 'keystore-passwords.txt'
if (-not (Test-Path $keystore) -or -not (Test-Path $pwFile)) { Fail "The upload key was not found in $keyDir." }
$kv = @{}
Get-Content $pwFile | ForEach-Object { if ($_ -match '^([A-Z_]+)=(.*)$') { $kv[$matches[1]] = $matches[2] } }
$env:KEYSTORE_PASSWORD = $kv['KEYSTORE_PASSWORD']; $env:KEY_ALIAS = $kv['KEY_ALIAS']; $env:KEY_PASSWORD = $kv['KEY_PASSWORD']
if (-not $env:KEYSTORE_PASSWORD) { Fail 'keystore-passwords.txt has no KEYSTORE_PASSWORD line.' }

# ---- Version ----
$game = Get-Content 'build\prototype-3d-v7.html' -Raw
if ($game -notmatch "const VERSION = '([0-9]+\.[0-9]+\.[0-9]+)'") { Fail 'Could not read the game version from build\prototype-3d-v7.html.' }
$version = $matches[1]
$codeFile = 'android-version-code.txt'
$lastCode = [int]((Get-Content $codeFile -ErrorAction SilentlyContinue | Select-Object -First 1) -as [int])
$code = $lastCode + 1
$name = "drenerics-$version-code$code"
Write-Host "Version $version, build number $code"

# ---- 2. Tests ----
if (-not $SkipTests) {
  Say 'Running all the tests (this can take 15-30 minutes)'
  & npm ci --no-audit --no-fund; if ($LASTEXITCODE) { Fail 'npm ci failed.' }
  & npx playwright install chromium; if ($LASTEXITCODE) { Fail 'Could not install the test browser (Chromium).' }
  $env:CI = '1'
  & npm test; if ($LASTEXITCODE) { Fail 'Some tests failed. Nothing was built. Send the test output to Claude.' }
  Remove-Item Env:CI
} else { Write-Host 'Tests skipped (-SkipTests).' -ForegroundColor Yellow }

# ---- 3. Work folder ----
Say 'Preparing the Android project'
$work = Join-Path $root 'build-android-work'
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory $work | Out-Null
Copy-Item package.json, package-lock.json, capacitor.config.json $work
Copy-Item www (Join-Path $work 'www') -Recurse
Copy-Item 'build\prototype-3d-v7.html' (Join-Path $work 'www\index.html') -Force   # the app opens the game directly
Push-Location $work
try {
  & npm ci --no-audit --no-fund; if ($LASTEXITCODE) { Fail 'npm ci failed in the work folder.' }
  & npx cap add android; if ($LASTEXITCODE) { Fail 'Could not create the Android project (npx cap add android).' }
  & npx cap sync android; if ($LASTEXITCODE) { Fail 'npx cap sync android failed.' }

  $vars = Get-Content 'android\variables.gradle' -Raw
  Write-Host (($vars -split "`n" | Where-Object { $_ -match 'SdkVersion' }) -join "`n")

  $g = 'android\app\build.gradle'
  $gradle = Get-Content $g -Raw
  $gradle = $gradle -replace 'versionCode 1\b', "versionCode $code"
  $gradle = $gradle -replace 'versionName "1\.0"', "versionName `"$version`""
  # Google Play Billing Library 8 or newer (Google refuses a bare billing permission)
  if ($gradle -notmatch 'com.android.billingclient:billing') {
    $gradle = $gradle -replace '(?m)^dependencies \{', "dependencies {`n    implementation `"com.android.billingclient:billing:8.2.1`""
  }
  # Signing with the upload key (passwords are read from the environment, never written to a file)
  $ks = $keystore.Replace('\', '/')
  $signing = "    signingConfigs {`n        release {`n            storeFile file('$ks')`n            storePassword System.getenv('KEYSTORE_PASSWORD')`n            keyAlias System.getenv('KEY_ALIAS')`n            keyPassword System.getenv('KEY_PASSWORD')`n        }`n    }`n    buildTypes {"
  $gradle = $gradle -replace '(?m)^    buildTypes \{', $signing
  $gradle = [regex]::new('minifyEnabled false').Replace($gradle, "minifyEnabled false`n            signingConfig signingConfigs.release", 1)
  [IO.File]::WriteAllText((Resolve-Path $g), $gradle)   # UTF-8 without a byte-order mark, which Gradle reads safely
  if ((Get-Content $g -Raw) -notmatch "versionCode $code") { Fail 'Could not set the build number in build.gradle.' }

  # ---- 4. Build and sign ----
  Say 'Building and signing the app (a few minutes the first time)'
  Push-Location android
  & .\gradlew.bat bundleRelease
  $ok = ($LASTEXITCODE -eq 0)
  Pop-Location
  if (-not $ok) { Fail 'The Android build failed. Send the output above to Claude.' }
} finally { Pop-Location }

# ---- 5. Save ----
$aab = Join-Path $work 'android\app\build\outputs\bundle\release\app-release.aab'
if (-not (Test-Path $aab)) { Fail 'The build finished but no .aab file was found.' }
New-Item -ItemType Directory 'releases' -Force | Out-Null
$out = Join-Path $root "releases\$name.aab"
Copy-Item $aab $out -Force
Set-Content $codeFile $code
Say 'DONE'
Write-Host "App file: $out" -ForegroundColor Green
Write-Host "Version $version, build number $code. Upload it in Play Console: Testing > Internal testing > Create new release."
Write-Host "The build number in android-version-code.txt went up to $code. Commit it with the version."
