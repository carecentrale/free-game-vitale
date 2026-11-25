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
- `www/how-to-play.html`: the How to play guide, written by hand. `www/release-notes.html`: the release notes page, written by `scripts/site-pages.mjs` from `GAME_HISTORY` in the game file (never edit it by hand).
- Website look (0.6.88, SPEC-012 to SPEC-015): every website page uses `www/site.css` (no page keeps its own styles). The top bar, the footer and the tab icon and link preview tags sit between `<!-- site-head -->`, `<!-- site-header -->` and `<!-- site-footer -->` marks and are written by `scripts/site-pages.mjs` (run it after any change). The release notes page is called "What is new" everywhere; its address stays `/release-notes.html`. `www/404.html` is the page-not-found page (Vercel shows it by itself). `www/teachers.html` (SPEC-032) is linked only from the home page until the teacher area opens. `scripts/tests/site-look.test.mjs` checks all of this.
- The guide's groups (SPEC-014) are in the `<!-- guide-groups ... -->` comment in `www/how-to-play.html`, one line per group. Every part goes in exactly one group: a new part is added to the group its spec names, in the same release. `scripts/site-pages.mjs` makes the side list and the phone's "Jump to a part" box from it and numbers the parts. When a group passes 15 parts, the PM proposes a split to Nick.
- Pictures of the game on the website (home page `www/home/`, guide controls `www/guide/`): taken by `CHROME_PATH=/usr/bin/google-chrome node scripts/site-shots.mjs` (`controls` for the two controls pictures only). When a release changes a button shown in the controls pictures, retake them in that release. Nick looks at the home page pictures before they go live.
- The home page (SPEC-013) says only what is true of the game on the day it ships: a card or label for a feature waits until the feature is in the game. The Google Play badge shows only when `PLAY_PUBLIC` in `scripts/site-pages.mjs` is true (the day the game is public on Google Play). No ads, prices or purchases on the home page.
- `build/admin.html` and `www/admin.html`: parent stats page (email code sign-in).
- `build/prototype-3d-v5.html`, `v6.html`: older versions, kept for rollback.
- `build/models/`, `www/models/`: optimized GLB models (Quaternius Bestiary: imp.glb, puglin.glb).
- `www/app-icon/`: the app icon. `icon-512.png` is the Play Store icon; `android-res/` holds the Android sizes, copied into the Android project by the `capacitor:sync:after` step in `package.json` on every `npx cap sync android`. Drawn by `scripts/app-icon.py` (needs Python with Pillow); after changing the drawing, run `python scripts/app-icon.py www/app-icon`. `scripts/tests/app-icon.test.mjs` checks the files.
- `docs/VERSIONS.md`: version, commit and deployment table, with rollback steps.
- `CHANGELOG.md`: user-facing changes per version.
- The Android build and Play Store upload tools are not in this repository (parent's decision, 17 Nov 2026). They live on the build PC in `Desktop\Claude tools for access\drenerics-build\` (see "This PC is the build machine").
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
   Website, in the same release (parent's rule, 17 Nov 2026): add the version to `GAME_HISTORY` in words a player understands, run `node scripts/site-pages.mjs` (it rewrites `www/release-notes.html`), and add every new feature or changed rule to `www/how-to-play.html`: what it is and how to use it, in the part where a player would look for it. Then set the guide's two version marks (`guide-version` and `guideVersion`) to the new version. `scripts/tests/site-pages.test.mjs` fails until both pages are done. The guide's last part explains the parental controls (how to open the parent area and what each control does): keep it matching the game. Neither page links outside the site.
5. Commit with a clear message. Keep commits local on the parent's computer. Push to `main` (which deploys to Vercel) at most once a day, and only when the parent agrees. Several versions can go out in one push.
   After every push to `main`, confirm the website yourself, never by asking the parent to open the game: Vercel `list_deployments` (project `prj_lVLyLGhWHNAiZRZ1dcsqghpFpAAQ`, team `team_nwtlUjf0r36svOy434IMUrcF`, target `production`) must show the pushed commit with state `READY`. If it is `ERROR` or missing after a few minutes, read its build log and report it. Write the result in the `docs/VERSIONS.md` row (parent's request, 23 Nov 2026).
6. Every new feature records tracking events: see "Tracking records" below. Use `logEvent(kind, detail)`, or `logOnce` for things a child can repeat. List each new kind in `docs/EVENTS.md` in the same release, pointing to the privacy-page row that covers it. The page describes records by category: a kind that fits an existing row needs no change to the page; a new kind of information, a new place it goes or a new company that receives it needs new wording there and a new "Last updated" date. `scripts/tests/events.test.mjs` and `scripts/tests/tracking-privacy.test.mjs` fail otherwise.
7. Every new feature or rule change gets an automated test in `scripts/tests/` in the same release (browser rules go in `browser.test.mjs` and use `window.gameTest`; world rules go in `terrain.test.mjs`). Add the test before the feature is committed, and run it.
8. Never claim a feature works in a browser unless the parent has tested it. The sandbox cannot load the CDN, so only syntax checks run there. Say what was checked and what was not.

## Play Store releases (parent's decision, 13 Nov 2026)
- Do not use git or GitHub to build or push the app to the Play Store. Do not run or trigger `.github/workflows/release.yml`.
- Build, sign and upload locally on the parent's PC (Android Studio's Java and SDK): `build-android-upload.bat`, or `build-android.bat` to build without uploading (both in the build tools folder, see below). Details in `docs/RELEASE.md`, "Uploading from this PC".
- Improve this by adding to the project's own local tools, not by adding cloud steps.

## Where the builder works (parent's decision, 20 Nov 2026)
The laptop is used for building only. Chats never ask for the laptop's folders and never use `device_bash`, computer use or the laptop's file tools.
- Code work happens in the chat's cloud workspace: clone `carecentrale/free-game-vitale` from GitHub, branch from `origin/dev`, make the change, run the syntax check and the fast tests there, commit, and push the branch (never `main`).
- A release is `dev` brought into `main` on GitHub, with the parent's agreement (at most one push to `main` a day).
- Builds go through GitHub only: `remote-build.sh quick` (or `full`, `build`, `check`, `status`) and `remote-build.sh result`, from the cloud clone, after the push to `main` has gone through (see `claude/remote-build-trigger-patch.md` in the project docs).
- Anything that can only be done on the laptop (changing the build tools, `run`, `push`, `restart`, `tidy`, reading laptop logs): stop and ask the parent. Do not request folder access.
- The section "This PC is the build machine" below describes how the laptop builds. It no longer tells chats to work there.

## This PC is the build machine (parent's decision, 13 Nov 2026)
The parent wants Claude to do the build and release work on this PC (Windows laptop, Claude desktop app linked to the chat). How:
- Game folder: `Desktop\adventurers-of-drenerics-game` (this repository, main branch). Keys and tools stay outside it in `Desktop\Claude tools for access\` (upload key, `play-service-account.json`, `jdk-21`). Never copy or print the keys.
- **Build tools folder (parent's decision, 17 Nov 2026):** everything that builds or uploads the app but is not the game lives in `Desktop\Claude tools for access\drenerics-build\`, not in the game folder and not in git: `build-watcher.ps1`, `build-android.ps1`, `upload-play.mjs` (its test is in `tests\`), `machine-status.ps1`, `remote-build.sh`, the `.bat` files, and the folders `build-requests\`, `build-android-work\` and `releases\`. `README.txt` there lists them. From `device_bash` it is `$HOME/mnt/Claude tools for access/drenerics-build/`. The tools find the game at `Desktop\adventurers-of-drenerics-game`. `releases\` keeps the last 10 builds plus the last build of every month; the build removes older ones itself. These files have no version history any more: change them with care and note the change in `docs/BUILD_MACHINE.md`.
- Ask for folder access to both folders, and for deletion in the game folder (git needs it to update files).
- Git for Windows is installed (13 Nov 2026, for Claude to use; line endings as-is, pull fast-forward only). The build files update the game first (`git pull --ff-only`) unless given `-NoUpdate`. `update-game.bat` updates without building. Commits can also be made in the Cowork Linux workspace (`device_bash`); if a git command there fails, move any `.lock` file it left under `.git` out of the way before retrying.
- Building runs in Windows only (Android Studio's Java and SDK, PowerShell); the cloud and Cowork workspaces cannot build the app.
- **Build watcher (the normal way to build):** every file and folder named in this point is in the build tools folder, except `scripts/run-tests.mjs`. A scheduled task, "Drenerics build watcher" (`build-watcher.ps1`, installed with `install-build-watcher.bat`, removed with `remove-build-watcher.bat`), runs in the background while the parent is logged in, also with the screen locked. To build, write one word into `build-requests/request.txt` from `device_bash`: `full` (update, tests, build, upload), `quick` (no tests: only when they already passed for this version), `build` (no upload), `check` (Play key only), `push` (push main to GitHub from Windows; needs `github-sign-in.bat` done once) `tidy` (close finished `.bat` windows), `run` (run `build-requests/run.ps1`, a PowerShell script Claude writes for one job; it is deleted afterwards and kept with its log in `history/`), `status` (read-only report in `build-requests/machine.txt`: disk, uptime, power and sleep settings, tools, watcher, Gradle processes, git) or `restart` (the watcher stops; its scheduled task starts the current version within 5 minutes). `run` gives full control of the laptop without its screen: use it for maintenance, never to change Windows system or security settings, read the keys, or delete releases. Builds run the tests with `scripts/run-tests.mjs`: every test once, then a single rerun of up to 3 failed browser tests; a test that passes only on the rerun is logged as FLAKY (`build-requests/flaky.log`) and should be made steadier. Then read `build-requests/status.txt` (RUNNING, then OK or FAILED with test counts and build number) and `build-requests/last.log`. Every run is logged: `history.log` (one line per run), `history/` (full logs of the last 30 runs), `errors.log` (every failure with the end of its log), `watcher-errors.log` (problems in the watcher). Finished builds, pushes and failures also show a Windows notification on the laptop. The watcher restarts itself when `build-watcher.ps1` changes. While it runs, the watcher keeps Windows awake (the screen can still turn off; the laptop's own setting sleeps after 2 hours on mains power); create `build-requests/allow-sleep.txt` to let it sleep again. `watcher-alive.txt` shows the watcher's last check (every 15 seconds) and whether it is keeping the PC awake; if it is older than a few minutes, the task restarts it within 5 minutes, or run `install-build-watcher.bat` again. A full run with tests takes 15 to 30 minutes: check back, don't watch.
- **Builds from anywhere (17 Nov 2026):** the watcher also looks at GitHub about once a minute, so a build can be asked for from any chat, with no link to the laptop. In any clone that can push: `remote-build.sh quick` (or `full`, `build`, `check`, `status`), then `remote-build.sh result` to read what the laptop posted. The script is not in this repository: it is in the build tools folder and in the project doc `claude/remote-build-trigger-patch.md`. The request is one line on the branch `build-remote`; the result is one short status on the branch `build-status` (no logs: the repository is public). `run`, `push`, `restart` and `tidy` cannot be asked for this way. Push the game's commits to main first: the build updates from GitHub. The laptop must be on with the parent logged in; posting the result needs `github-sign-in.bat` done once there. Running on the laptop since 17 Nov 2026, but no request has been sent through GitHub yet: if no result appears after a few minutes, read `build-requests/watcher-errors.log` there.
- Always leave the laptop tidy: builds go through the watcher, which opens no windows. If a `.bat` was run by double-click (computer use or the parent), send `tidy` afterwards to close its finished window.
- Fallback if the watcher is not running: computer use with File Explorer (click-only access) to double-click `build-android-upload.bat` or `build-android-upload-quick.bat`, (in the build tools folder), then follow `releases\` there and the game folder's `android-version-code.txt` from `device_bash`.
- Pushing to GitHub: the Cowork workspace has no GitHub sign-in. Bundle the new commits (`git bundle create .git/claude-push.bundle origin/main..main`), stage the bundle to the cloud workspace, fetch it there and push, then delete the bundle.
- `check-play-key.bat` checks the Play key without uploading. The Cowork workspace has no route to Google, so the check and the upload only work from Windows.

## Reading build results (22 Nov 2026)
- The watcher stops a run that passes its time limit (full and build 75 minutes, quick 30) and reports it as FAILED; during a run the `build-status` line is refreshed about every 5 minutes. The Drive reports folder also holds `health.txt`, written about every 5 minutes: if its "Written" time is older than 15 minutes, the laptop is off, asleep, logged out or the watcher stopped (25 Nov 2026, see `docs/BUILD_MACHINE.md`).
- After a build request, read the result in this order, all without the laptop: `remote-build.sh result` (one line on the branch `build-status`), then the Google Drive folder "Adventurers of Drenerics - Build machine reports" (written by the laptop after every run): `latest-build.txt` (result, version, build number, the last log lines, cleaned) and `build-log.csv` (one row per run).
- Never read the laptop's own log files from a chat. If the Drive report does not say why a build failed, ask the parent to paste the end of `build-requests\last.log`.
- Do not move or rename the Build machine reports folder in Drive: the laptop writes to it by its place in Google Drive on the laptop. Moving it needs the watcher changed at the same time (laptop work).

## The land-maker (0.6.76, SPEC-016)
- Every world records which land-maker made it (`gen` in the world, with its castle spacing `castleGap`). Worlds with no record are land-maker 1 (before 0.6.76: no big caves, no castles); new worlds are land-maker 2 (caves and castles).
- Never change what an existing land-maker makes: that would change the land of every world made with it, saved games and shared worlds included. A change to the land, caves or castles is a new land-maker (`GEN_NOW = 3`, with the old code kept for worlds of 2).
- Castle spacing X is set by the owner in the admin page and kept in the table `game_settings` (migration `docs/migrations/0009_game_settings.sql`): everyone reads, only the owner's account updates.
- `scripts/tests/caves-castles.test.mjs` walks every cave and castle it checks (walking, one-block jumps, drops of 3 at most): keep it passing when changing caves or castles.

## Land-maker 3: castles, roads and dragons' trees (0.6.81, SPEC-020, SPEC-022, SPEC-023)
- `gen` keeps meaning the land and caves (1: none, 2: caves). Castles and roads of the new kind are `maker: 3` in the world record (not `gen: 3`, so a device on an older version still reads the same land and never writes the world back as land-maker 1). `GEN_NOW` stays 2.
- The first time a world opens in 0.6.81 or later, `upgradeWorld` lists the castles touching changed chunks (`oldCastles`: they keep the old look; in a `gen` 1 world they are not built) and lays roads into changed chunks once (`roaded`), only into air, water, grass, dirt, sand or snow. Never change what land-maker 3 makes for a castle, road or tree: make a new `maker` number instead.
- Roads: `castleNetwork` (all castles in the playable land, relative neighbourhood graph, at most 4 roads each, always joined) and `roadPlan` (search, smoothing, levelling, bridges). Cave mouths keep 5 blocks from roads. `scripts/tests/castles-roads.test.mjs` checks them.
- Eaten trees (`eatenTrees`, world record `eaten`): place, day eaten, day back (dates only), at most 500.

## Shared worlds (0.6.81, SPEC-024)
- The first device in a world (presence `since`) leads; one silent for 4 seconds is passed over. Only the leader moves monsters and carts, decides fights, drops and dragons' meals; it sends `ws` about 3 times a second. Followers send `hit` and `pick` to it. Never send text, a typed name or anything about a child.
- Supabase free plan limits (checked 22 Nov 2026, supabase.com/docs/guides/realtime/limits): 200 concurrent connections, 100 messages a second and 20 presence messages a second for the whole project. Presence is sent twice a second per device: keep it that way or lower.

## Tracking records (Nick's rule, 23 Nov 2026)
- Every feature records tracking events for safety (backtracking, accountability, traceability). Records hold visit codes, world codes, counts and game words only: never a name or anything typed.
- Everything the game sends off the device (event kinds, tables, database functions, shared-world messages, presence fields, other requests) is listed in `docs/EVENTS.md`, with the privacy-page row that explains it. A new kind goes into `docs/EVENTS.md` in the same release, after Nick's yes (it changes what is collected).
- The privacy page describes records by category, not by name (Nick's decision, 23 Nov 2026). A new kind that fits an existing row (for example a new gameplay record) needs no change to the page. A new kind of information, a new place it goes, or a new company that receives it needs new wording on `www/privacy.html` in the same release, and a new "Last updated" date.
- `scripts/tests/events.test.mjs` fails when the game sends something not listed there, or a listed privacy-page row is missing. Rows marked "Not yet" are known gaps waiting for Nick's decision (shown as todo).

## Database changes (22 Nov 2026)
- Every change to the database's structure or access rules is a file in `docs/migrations/` (next free number), committed before or with the change, and added to the table in `docs/migrations/README.md` when it is applied to the live database. Never change the live database with SQL that is not in a file there.
- After applying one, check that the live list (Supabase `list_migrations`) still matches the README. `scripts/tests/migrations.test.mjs` checks that every file is listed.
- These files hold the structure only. The data is not backed up by them, and no player data may ever be committed (the repository is public). The Supabase project is on the free plan, which has no automatic backups.

## Versioning and rollback
- Every release has a version number and a commit. Rollback = restore an older build file or check out an older commit, and record it as a new version.
- Tags cannot be pushed from the sandbox (403), so record commit hashes in VERSIONS.md.

## Assets and licences
- Quaternius assets (Bestiary, Universal packs) are under the Quaternius Asset License: free for commercial games, no credit required, cannot be resold or redistributed as assets.

## Built 25 Nov 2026 (0.6.90 to 0.6.99): what a later change must keep
- Backend functions: their source is in `docs/functions/<name>/` (`teacher-interest`, `delete-my-data`, `bird-facts`), with the rules in a `logic.mjs` the tests can run. Secrets are named there, never written. `bird-facts` (SPEC-037) calls Anthropic's API with the secret `ANTHROPIC_API_KEY`: it may send only the bird kind, the place, the rules and pool facts.
- Anything written by AI shows the flag of SPEC-038 beside it (`aiFlagHtml(id)`), and the game only downloads AI text that the server approved: the game itself never calls an AI.
- Reports, Delete my data, Playing together, Mirelo, dragons, monsters, birds, bird facts and the living world each have a test file in `scripts/tests/` and a marked block in the game file (`// ---- Name (version, SPEC-NNN)`): the tests cut the block out by those marks, so keep the marks.
- `game_settings_key_check` lists every allowed setting key: a new migration that adds a key must repeat all the earlier ones (see 0019).
- Insights (SPEC-040) in the admin page shows every record kind by itself: never name a record kind in its code, and never return a visit code or world code from its database functions.
- Living world (SPEC-026): ground blocks are turned and shaded from their place only (`groundLook`); never use the seed or chance there. Effects go through `fxAdd` (60 at most, one draw). Wind and ripples are in the materials' shaders and follow `windOn` (the parent's Calm motion).
- The test browser draws only a few frames a second: a browser test must wait for the game's own clock (poll), not for wall time.

## Project instructions are tracked (23 Nov 2026)
- The claude.ai project instructions are kept in `docs/PROJECT_INSTRUCTIONS.md`, because claude.ai keeps no history of them. When they change, update that file in the same chat with a dated line under "Changes". If the project instructions and that file differ, tell the parent.

## Style
- Explain changes in plain language. Keep answers short, with detail on request.

## Requirements come from the product manager's hand-offs
Requirements come from the Google Drive folder "Adventurers of Drenerics - PM requirements". When Nicola says "build hand-off NNN", read that document in full before changing anything, build exactly what it says, run its acceptance tests, and report anything you built differently and why. Do not build from a hand-off whose status is not "Ready to build". Anything marked "needs parent decision" waits for Nicola's yes.

## Sound and music (0.6.60)
- Audio files live in `www/audio/sfx/` and `www/audio/music/`. The game learns which files exist from `www/audio/credits.json`, so a file that is not listed is never asked for.
- Every file needs a row in the audio table in `docs/ASSETS.md` and a saved licence page in `docs/licences/`. Then run `node scripts/audio-credits.mjs`: it writes `www/audio/credits.json` and the credits on `www/terms.html`. `scripts/tests/audio.test.mjs` fails if any of this is missing.
- Allowed licences: public domain, CC0, CC BY. Never NC, ND or SA.

## Folders on the build machine
- One game folder: `Desktop\adventurers-of-drenerics-game`. Never create another project folder, clone or copy on the parent's computer.
- Scratch work (test clones, downloads, temporary files) stays in the cloud workspace or the session's scratch folder.
- If a clone or copy fails halfway, remove what it left straight away, or tell the parent exactly what was left and where.
- Chats do not use the computer (see "Where the builder works"). Only if the parent asks for laptop work in that chat: first step of any session that needs the computer: check which computer and Windows account the chat is linked to. The build machine is the computer the Claude app calls `laptop-n8ld8gm1`, Windows account `15144` (its Desktop is `C:\Users\15144\Desktop`). Nick's account is also signed in on another computer, `nicks-laptop`, which is not the build machine (25 Nov 2026: a chat linked to it lost time trying to reach the build folders). If the device name or account does not match, stop and say so. Do not guess paths.
- Anything new that is part of the game goes inside the game folder. Tools that only help to build or release it go in `Desktop\Claude tools for access\drenerics-build\`, never in the game folder. Either way, write it down here.
- No downloads are kept in the game folder: once a download has been unpacked into `assets/`, delete it.

## Branches (added 18 Nov 2026, parent's decision)
- One project, one history. Never start a second history for the game (no `git init`, no new orphan branch, no fresh copy of the game in a new folder).
- `main` holds released versions only. `dev` holds work in progress, and is where new work lands and is tested.
- `dev` is usually ahead of `main`. A hotfix made on `main` must be merged back into `dev` straight away.
- Every branch is made from `origin/main` or `origin/dev`, never from an empty start.
- A release is `dev` merged or fast-forwarded into `main`, after the tests pass.
- Before any push, check that the branch contains the branch it is merging into (`git merge-base --is-ancestor origin/main HEAD` or `origin/dev`). If the check fails, do not push; report it to the parent.
- Never force-push, and never delete `main` or `dev`. Pushes are fast-forward only.
- The parent should protect `main` on GitHub (Settings, Branches): block force pushes and deletion.
