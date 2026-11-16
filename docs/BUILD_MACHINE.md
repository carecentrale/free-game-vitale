# Build machine tune-ups

Weekly check of the build laptop (LAPTOP-N8LD8GM1): build watcher, recent runs, Play key, git, disk, and ideas to make builds faster and steadier. Newest section first. Recommendations stay listed until marked done.

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
1. Skip `npm ci` when nothing changed: it runs twice per build (game folder and `build-android-work`), plus `npx playwright install`. Keep a stamp of the `package-lock.json` hash and skip when it matches. Saves roughly 1–3 minutes per build. Nothing needed from Nicola.
2. Keep the laptop awake while a build runs: the watcher could ask Windows not to sleep during a run (SetThreadExecutionState), without changing the 2-hour sleep setting. Avoids a run being cut off or a request waiting until someone wakes the laptop. Nothing needed from Nicola.
