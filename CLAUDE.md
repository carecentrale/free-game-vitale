# Adventurers of Drenerics: context for Claude

## What this is
A 3D block-world game for kids and families (dig, build, gems, power levels, enemies, shared worlds). Browser game built with Three.js; runs on tablets, phones and PCs. Owner: the parent (yammay@gmail.com). Planned public release with possible ads and paid version later.

## Child safety and privacy (non-negotiable)
- No adult, sexual or revealing content, including characters.
- No likenesses of real people or copyrighted characters. Original designs only.
- No free-typed names or chat between players. Names are random, changed from a preset list.
- No personal data from children. Logs must not identify a child.
- Accounts, purchases and sign-in belong to a parent. Children must not reach sign-in or the stats page.
- Ads (if added) only through child-safe networks, no personalized ads. Purchases need a parental gate.
- Any change to data collection, ads, purchases or consent must be flagged for the parent before release.

## Repository layout
- `build/prototype-3d-v7.html`: current game source (single file, module script with Three.js and Supabase).
- `www/play/index.html`: deployed copy of the game (at /play/). Keep it identical to the current build file.
- `www/index.html`: home page at the main address. Not the game. Edit it separately.
- `build/admin.html` and `www/admin.html`: parent stats page (email code sign-in).
- `build/prototype-3d-v5.html`, `v6.html`: older versions, kept for rollback.
- `build/models/`, `www/models/`: optimized GLB models (Quaternius Bestiary: imp.glb, puglin.glb).
- `docs/VERSIONS.md`: version, commit and deployment table, with rollback steps.
- `CHANGELOG.md`: user-facing changes per version.
- `build-android.bat`, `build-android-upload.bat`, `scripts/build-android.ps1`, `scripts/upload-play.mjs`: Android build and Play Store upload, run on the parent's PC.
- `.github/workflows/release.yml`: old GitHub release workflow. Do not use it (see "Play Store releases").

## Hosting and backend
- GitHub: `carecentrale/free-game-vitale`, main branch. Pushes to main auto-deploy to Vercel project `free-game-vitale`, output folder `www`.
- Live: https://free-game-vitale.vercel.app. Stats: https://free-game-vitale.vercel.app/admin.html
- Supabase project `rsrmuruskjtnxqmzvmnl`. Tables: worlds, players, game_events, game_errors, cloud_saves. Row-level security is on. Public write access to game tables is an open issue before public launch.
- Supabase client loads on demand from the jsDelivr CDN (version 2.45.4). Three.js 0.160.0 via importmap.

## How to change the game
1. Edit `build/prototype-3d-v7.html`. Check syntax: extract the module script and run `node --check`.
   While working, `npm run test:quick` runs the fast checks only, and `npm run test:quick -- "word|word"` adds the browser tests whose names match.
   Then run `npm test`. Every version must pass all tests before it is pushed. CI runs them on every push too (.github/workflows/tests.yml).
2. Bump `VERSION` in the script and the `<title>` tag.
3. Copy the build file to `www/play/index.html`.
4. Add a `CHANGELOG.md` entry and a `docs/VERSIONS.md` row (version, commit hash, deployment).
5. Commit with a clear message. Keep commits local on the parent's computer. Push to `main` (which deploys to Vercel) at most once a day, and only when the parent agrees. Several versions can go out in one push.
6. Every new feature or rule change gets an automated test in `scripts/tests/` in the same release (browser rules go in `browser.test.mjs` and use `window.gameTest`; world rules go in `terrain.test.mjs`). Add the test before the feature is committed, and run it.
7. Never claim a feature works in a browser unless the parent has tested it. The sandbox cannot load the CDN, so only syntax checks run there. Say what was checked and what was not.

## Play Store releases (parent's decision, 13 Nov 2026)
- Do not use git or GitHub to build or push the app to the Play Store. Do not run or trigger `.github/workflows/release.yml`.
- Build, sign and upload locally on the parent's PC (Android Studio's Java and SDK): `build-android-upload.bat`, or `build-android.bat` to build without uploading. Details in `docs/RELEASE.md`, "Uploading from this PC".
- Improve this by adding to the project's own local tools, not by adding cloud steps.

## This PC is the build machine (parent's decision, 13 Nov 2026)
The parent wants Claude to do the build and release work on this PC (Windows laptop, Claude desktop app linked to the chat). How:
- Game folder: `Desktop\adventurers-of-drenerics-game` (this repository, main branch). Keys and tools stay outside it in `Desktop\Claude tools for access\` (upload key, `play-service-account.json`, `jdk-21`). Never copy or print the keys.
- Ask for folder access to both folders, and for deletion in the game folder (git needs it to update files).
- Git for Windows is installed (13 Nov 2026, for Claude to use; line endings as-is, pull fast-forward only). The build files update the game first (`git pull --ff-only`) unless given `-NoUpdate`. `update-game.bat` updates without building. Commits can also be made in the Cowork Linux workspace (`device_bash`); if a git command there fails, move any `.lock` file it left under `.git` out of the way before retrying.
- Building runs in Windows only (Android Studio's Java and SDK, PowerShell); the cloud and Cowork workspaces cannot build the app.
- **Build watcher (the normal way to build):** a scheduled task, "Drenerics build watcher" (`scripts/build-watcher.ps1`, installed with `install-build-watcher.bat`, removed with `remove-build-watcher.bat`), runs in the background while the parent is logged in, also with the screen locked. To build, write one word into `build-requests/request.txt` from `device_bash`: `full` (update, tests, build, upload), `quick` (no tests: only when they already passed for this version), `build` (no upload), `check` (Play key only), `push` (push main to GitHub from Windows; needs `github-sign-in.bat` done once) or `tidy` (close finished `.bat` windows). Builds run the tests with `scripts/run-tests.mjs`: every test once, then a single rerun of up to 3 failed browser tests; a test that passes only on the rerun is logged as FLAKY (`build-requests/flaky.log`) and should be made steadier. Then read `build-requests/status.txt` (RUNNING, then OK or FAILED with test counts and build number) and `build-requests/last.log`. Every run is logged: `history.log` (one line per run), `history/` (full logs of the last 30 runs), `errors.log` (every failure with the end of its log), `watcher-errors.log` (problems in the watcher). Finished builds, pushes and failures also show a Windows notification on the laptop. The watcher restarts itself when `scripts/build-watcher.ps1` changes. `watcher-alive.txt` shows the watcher's last check (every 15 seconds); if it is older than a few minutes, the task restarts it within 5 minutes, or run `install-build-watcher.bat` again. A full run with tests takes 15 to 30 minutes: check back, don't watch.
- Always leave the laptop tidy: builds go through the watcher, which opens no windows. If a `.bat` was run by double-click (computer use or the parent), send `tidy` afterwards to close its finished window.
- Fallback if the watcher is not running: computer use with File Explorer (click-only access) to double-click `build-android-upload.bat` or `build-android-upload-quick.bat`, then follow `releases\` and `android-version-code.txt` from `device_bash`.
- Pushing to GitHub: the Cowork workspace has no GitHub sign-in. Bundle the new commits (`git bundle create .git/claude-push.bundle origin/main..main`), stage the bundle to the cloud workspace, fetch it there and push, then delete the bundle.
- `check-play-key.bat` checks the Play key without uploading. The Cowork workspace has no route to Google, so the check and the upload only work from Windows.

## Versioning and rollback
- Every release has a version number and a commit. Rollback = restore an older build file or check out an older commit, and record it as a new version.
- Tags cannot be pushed from the sandbox (403), so record commit hashes in VERSIONS.md.

## Assets and licences
- Quaternius assets (Bestiary, Universal packs) are under the Quaternius Asset License: free for commercial games, no credit required, cannot be resold or redistributed as assets.

## Style
- Explain changes in plain language. Keep answers short, with detail on request.
