# Build machine tune-ups

Weekly check of the build laptop (LAPTOP-N8LD8GM1): build watcher, recent runs, Play key, git, disk, and ideas to make builds faster and steadier. Newest section first. Recommendations stay listed until marked done.

## 2026-11-22 (weekly tune-up, done from the cloud)

Since 20 Nov, chats do not use the laptop (CLAUDE.md, "Where the builder works"), so this tune-up only used GitHub. Not checked this week: watcher-alive.txt, watcher-errors.log, history.log, errors.log, test times, git state of the laptop folder in detail, disk sizes, `tidy` (none of these can be read or sent through GitHub).

**Health: not healthy: the laptop cannot update the game.**

- Watcher: alive. A `check` sent through GitHub at 20:36 laptop time was answered within a minute.
- Play key: `check` OK (20:37 laptop time), nothing uploaded.
- Builds through GitHub: one so far, `quick` at 18:29 laptop time on 22 Nov. **FAILED in 4 seconds: "The update from GitHub did not work", nothing built.** The laptop's game folder is still at 6357e78 (0.6.76, 20 Nov), 12 commits behind origin/main (5694922, 0.6.80). `git pull --ff-only` stops, most likely because of local changes or local commits left in the game folder from earlier laptop sessions. So 0.6.77 to 0.6.80 have not been built for Play.
- GitHub tests (CI) on main: all green this week (0.6.74 to 0.6.80).
- Git on GitHub: dev contains main and is 2 commits ahead (migrations work).

**Cause found (same evening, with Nicola at the laptop and his OK):** the game folder held an unfinished 0.6.77 draft from 20 Nov (5 changed files plus `scripts/tests/castle-life.test.mjs`), already replaced by the real 0.6.77 (f6a16f9). It also held `android-version-code.txt` = 18 (the real last Play build) while git still said 10. The Drive reports (`build-log.csv`) show two failures from this: 20 Nov 15:28 and 22 Nov 18:30. Runs since 20 Nov: 4, 2 OK (0.6.75 build 17 and 0.6.76 build 18, 1.3 to 1.4 min each), 2 FAILED. Free disk 75.0 to 73.3 GB; releases 66 MB (10 builds).

**Fixed:**
- On the laptop: the draft set aside with `git stash` (`stash@{0}`, recoverable), version code 18 kept, folder updated to 0.6.80 (5694922). A stale `.git/index.lock` (from a `git status` run before delete permission) moved out of the way.
- In git: `android-version-code.txt` set to 18 so git matches the laptop; `.icon-test-*/` ignored and the app-icon test now uses the system temp folder (it had left 3 such folders in the game folder); new CLAUDE.md section "The laptop's game folder stays clean" (the rule, and how to unblock an update safely).

**Needs Nicola:** nothing to unblock. Send `quick` (or `full`) for 0.6.80 when you want it on Play.

**Recommendations**
1. Post the cause with a failed result: when the update from GitHub fails, add one short, safe line to `build-status` (for example "local changes in: CHANGELOG.md" or "local commits not on GitHub: 2"), no log text. Cloud chats could then see why without the laptop. Needs Nicola's OK to change the watcher.
2. Let `status` through GitHub post a few safe numbers (watcher age, free disk, folder size of `releases\`, git ahead/behind/dirty). Weekly tune-ups could then run fully from the cloud, as the 20 Nov rule requires. Needs Nicola's OK to change the watcher.
3. **Done (22 Nov):** the weekly tune-up task now works from GitHub and the Drive reports only.
4. The build stops on any local change. It could set leftovers aside itself before updating (`git stash push -u` with a dated message, keeping `android-version-code.txt`), say so in the report, and carry on. Also keep git's own error lines in `latest-build.txt` (this week's report dropped the line that named the files). Saves a lost day each time a draft is left behind. Laptop tool change: needs Nicola's OK.

## 2026-11-17: the build tools left the game folder

Nicola's decision: tools that only help to build the game are not part of the game folder. Moved to `Desktop\Claude tools for access\drenerics-build\` and removed from git: the build watcher, `build-android.ps1`, `upload-play.mjs` and its test, `machine-status.ps1`, `install-build-watcher.ps1`, `remote-build.sh`, all the build `.bat` files, and the folders `build-requests\`, `build-android-work\` and `releases\`. Their last versions in git are in commit efd5f65. File names in the older sections below (`scripts/...`) are the old places.

- The scheduled task "Drenerics build watcher" now starts `drenerics-build\build-watcher.ps1`. The tools find the game at `Desktop\adventurers-of-drenerics-game`.
- Requests go to `drenerics-build\build-requests\request.txt`.
- `releases\` holds builds 4 to 10 and one unnamed build of 11 Nov that was loose on the Desktop (`app-release-2026-11-11.aab`). New rule in the build: keep the last 10 builds plus the last build of every month, remove the rest.
- Deleted from the game folder: `assets-downloads\` (the nature pack zip and its unpacked copy, 20 MB).
- Checked after the move: the PowerShell files parse; the watcher runs from the new place; `status` and `check` requests. **Not checked: a real build from the new place.** The first one is the test; if it fails, read `build-requests\last.log`.

## 2026-11-16

**Health: not fully healthy.** The watcher answers requests, but it is still the first version (11 Nov–13 Nov, commit c25e69c), not the one in `scripts/build-watcher.ps1`. That first version cannot restart itself, so the 13 Nov updates never took effect.

- Watcher: alive (last check 2026-11-15 20:36 laptop time). Effects of the old copy: no `history.log`, `history/`, `errors.log` or `flaky.log`; no Windows notifications; `push` and `tidy` are unknown requests; and it still waits for Gradle's background process (fixed in 8c6cddd but not running).
- Runs this week: no run history was kept (see above). From git and `releases/`: three Play builds (code 5 on 11 Nov, codes 6 and 7 on 13 Nov), all on internal testing; build 7 had 92 tests, 1 flaky. The last full run (13 Nov) finished its build at 17:47 but the watcher only reported OK at 20:46: about 3 hours lost waiting for Gradle's background process.
- Slow tests: no full log available this week (none kept); check again next week.
- Play key: `check` OK, "The key works", nothing uploaded.
- Git: on main, level with origin/main, no uncommitted changes, no leftover `.lock` or push bundle.
- Disk: releases/ 15 MB (3 .aab files), build-android-work/ 178 MB, node_modules/ 90 MB, build-requests/history/ not created yet. Drive: 79 GB free of 476 GB (84% used).
- Leftover windows: `tidy` not sent (the old watcher does not know it).

**Fixed:** `install-build-watcher.ps1` now stops a running watcher copy before reinstalling. Without this, reinstalling while the old copy runs would do nothing (the task ignores a second start).

**Update, 21:11 laptop time:** while this tune-up ran, another Claude session added `run`, `status` and `restart` requests (d261e08) and the current watcher started at 21:10:52. It closed 8 leftover .bat windows (`tidy`) and now keeps `history.log` and `history/`. Nothing needed from Nicola.

**From the new `status` report:** C: 78 GB free; uptime 4.9 days; Node 26.13, npm 11.20, Git 2.56, Java 21, Android SDK 36 and 37; no Gradle processes left; on mains power the laptop sleeps after 2 hours idle.

**Recommendations**
1. **Done (16 Nov, build-android.ps1):** Skip `npm ci` when nothing changed: it runs twice per build (game folder and `build-android-work`), plus `npx playwright install`. Keep a stamp of the `package-lock.json` hash and skip when it matches. Saves roughly 1–3 minutes per build. Nothing needed from Nicola.
2. **Done (5b8d7c4, the watcher keeps the PC awake while it runs):** Keep the laptop awake while a build runs: the watcher could ask Windows not to sleep during a run (SetThreadExecutionState), without changing the 2-hour sleep setting. Avoids a run being cut off or a request waiting until someone wakes the laptop. Nothing needed from Nicola.

## Builds from anywhere (added 17 Nov 2026; running on the laptop, no request sent through GitHub yet)

The build watcher is a program on the laptop, not Claude. Besides `build-requests\request.txt`, it now looks at GitHub about once a minute:

- **Ask:** `remote-build.sh quick` (the script is in the build tools folder and in the project doc `claude/remote-build-trigger-patch.md`, not in the repository) from any clone that can push (or `full`, `build`, `check`, `status`). This writes one line, a word and a time, to the branch `build-remote`. Each new line is run once. The first time the watcher sees the branch it only remembers what is there, so an old request never runs.
- **Result:** the watcher posts one short status (running, then OK or FAILED with test counts and the build number) to the branch `build-status`. Read it with `remote-build.sh result`. No logs are posted, because the repository is public; the full logs stay in `build-requests\` on the laptop.
- **Not allowed this way:** `run`, `push`, `restart`, `tidy`. Nothing sent through GitHub can run a script on the laptop other than the project's own build.
- **Needs:** the laptop on, the parent logged in, internet, and `github-sign-in.bat` done once (for posting the result; the build runs without it).
- **Turning it off:** delete the branch `build-remote` on GitHub; the watcher then finds nothing to run.
- **If nothing happens:** `build-requests\watcher-alive.txt` shows whether the watcher runs; `watcher-errors.log` shows problems with GitHub.

