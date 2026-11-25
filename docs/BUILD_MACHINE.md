# Build machine tune-ups

Weekly check of the build laptop (LAPTOP-N8LD8GM1): build watcher, recent runs, Play key, git, disk, and ideas to make builds faster and steadier. Newest section first. Recommendations stay listed until marked done.

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

## Time limits and health report (25 Nov 2026, Nick's request: "fix it so it doesn't hang")
What happened: a `full` run asked for at 12:19 took until 15:15 (52 browser tests failed on the laptop, each after about two minutes) and said nothing in between, so from outside it looked hung.
Changed in `build-watcher.ps1` (build tools folder; the file before the change is kept as `build-requests\build-watcher-before-20261125.ps1.txt`):
- **Time limits.** A run that takes longer than its limit is stopped with everything it started and reported as FAILED ("BUILD STOPPED: the full run took longer than 75 minutes..."). Minutes: full 75, build 75, quick 30, run 60, check 5, status 5, push 5.
- **Progress.** During a run asked for through GitHub, the status on the branch `build-status` is refreshed about every 5 minutes ("RUNNING: full, started ..., 20 min so far (limit 75 min)"). `watcher-alive.txt` keeps being updated during a run.
- **Health.** About every 5 minutes, idle or busy, the watcher writes `health.txt` into the Drive folder "Adventurers of Drenerics - Build machine reports": the time, what it is doing, and the last line of `history.log`. If "Written" is older than 15 minutes, the laptop is off, asleep, logged out, or the watcher stopped.
- Checked: the new watcher started by itself, answered a `status` request through GitHub (15:42). Not checked: a run actually reaching its limit and being stopped.
- Still open: why 52 browser tests fail on the laptop but pass elsewhere. Until that is found, `full` cannot succeed there; `quick` builds work.

