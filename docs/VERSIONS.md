# Versions and rollback

Every version that goes online has three records. Keep all three in step.

1. **Git tag** (for example `v0.6.0`): the exact code in the repository.
2. **Build file** (for example `build/prototype-3d-v6.html`): the playable file for that version.
3. **Vercel deployment ID** (for example `dpl_...`): the live copy at the game's web address.

## Version history

| Version | Git tag | Build file | Vercel deployment ID | What changed |
|---|---|---|---|---|
| 0.6.32 | (commit to follow, not tagged) | build/prototype-3d-v7.html; www/play/index.html | (check Vercel) | Fixed saved games list layout at start |
| 0.6.31 | (commit 06208eb, not tagged) | build/prototype-3d-v7.html; www/play/index.html | (check Vercel) | Clearer saved games list at start |
| 0.6.30 | (commit 507a269, not tagged) | build/prototype-3d-v7.html; www/play/index.html | (check Vercel) | Safety limit of 100 saved games on the device |
| 0.6.29 | (commit fab8828, not tagged) | build/prototype-3d-v7.html; www/play/index.html | (check Vercel) | One free cloud save per parent; device saves unlimited; cloud save never replaces a different game silently |
| 0.6.28 | (commit 79a6a4d, not tagged) | build/prototype-3d-v7.html; build/admin.html; www/play/index.html; www/admin.html; docs/migrations/0006 (applied) | (check Vercel) | Parents can delete their cloud save (game and admin page) |
| 0.6.27 | (commit 1d38ca3, not tagged) | build/prototype-3d-v7.html; www/play/index.html | (check Vercel) | Choose a saved game at start (up to 10 on this device) |
| 0.6.26 | (commit 653a91d, not tagged) | build/prototype-3d-v7.html; www/play/index.html | (check Vercel) | Dropped items disappear after 5 minutes |
| 0.6.25 | (commit 86f1d93, not tagged) | build/prototype-3d-v7.html; www/play/index.html | (check Vercel) | Defeated creatures that are hovering or falling also disappear after 5 minutes |
| 0.6.24 | (commit aad8297, not tagged) | build/prototype-3d-v7.html; www/play/index.html | (check Vercel) | Enemy log records when ground under a defeated creature is dug out |
| 0.6.23 | (commit 31b1aa8, not tagged) | build/prototype-3d-v7.html; www/play/index.html | (check Vercel) | Defeated creatures are placed exactly on the block under them, so they no longer hover |
| 0.6.22 | (commit 10482ab, not tagged) | build/prototype-3d-v7.html; www/play/index.html | (check Vercel) | Defeated creatures fall again if the ground under them is dug away |
| 0.6.21 | (commit 38cbdc4, not tagged) | build/prototype-3d-v7.html; www/play/index.html | (check Vercel) | Defeated creatures past the island edge fall off the map |
| 0.6.20 | (commit 5ae6f67, not tagged) | build/prototype-3d-v7.html; www/play/index.html; www/index.html (home page) | dpl_8FN2baprdpr1VvpWciJfnDVgdey7 (INITIALIZING when recorded; check it reaches READY) | Home page at the main address; game moved to /play/ |
| 0.6.19 | (commit 14999bc, not tagged) | build/prototype-3d-v7.html; www/index.html | dpl_59qPiE9UVZ2f7wkPDo5UrdVosicm (QUEUED when recorded; check it reaches READY) | Teleport cast finishes in the background; parent link design draft (docs/PARENT_LINK_DESIGN.md, not built) |
| 0.6.18 | (commit 2f7d667, not tagged) | build/prototype-3d-v7.html; build/admin.html; docs/migrations/0002_debug_log.sql (NOT applied) | dpl_36Lg9eArA4bTjTc5ALf6T4inAycZ (QUEUED when recorded; check it reaches READY) | Teleport lands on top of the land; enemy debug log (device and admin); shared log active after migrations 0002 and 0003 |
| 0.6.17 | (commits a84247d and 232d772, not tagged) | build/prototype-3d-v7.html | dpl_J18UC2NG4gW1UDsVEP5CAh7wkfaF (BUILDING when recorded; check it reaches READY) | Remove enemies that fall off the map; corpses in mid-air land; teleport countdown |
| 0.6.16 | (commits 0655738 and 3603094, not tagged) | build/prototype-3d-v7.html | dpl_GW57NZuNzHeF9ncK6j3h5mpBuoyL (READY) | Esc, tap-outside and larger Close button for Settings |
| 0.6.15 | (commits de668f7 and e221bbe, not tagged) | build/prototype-3d-v7.html | dpl_J9DsBiRUgXKUU9b4V3rJ2Uj8zWhH (READY) | Purple teleport button to the start: free, 5 minute cast, 1 hour recharge |
| 0.6.14 | (commits d3d28ff, f163e2a and 0fa694c, not tagged) | build/prototype-3d-v7.html | dpl_HnZTwavyV2XVXXkvgu6BB2GCyjm9 (from commit 0fa694c) | Enemies stay on the ground and stop at ledges; defeated enemies lie for 5 minutes, then sink; right-click builds from the quick bar |
| 0.6.13 | (commit d9c1a61, not tagged) | build/prototype-3d-v7.html | dpl_5K64mxYD2AzwDVLKsBWRACrTbUGy (from Vercel; commit 78b4374 not seen on main) | Settings screen with game version and changes |
| 0.6.12 | (commit 89e12c2, not tagged) | build/prototype-3d-v7.html | (not deployed; waiting for parent approval to push to main) | Drop dug blocks on the ground when the bag is full |
| 0.6.2 | v0.6.2 (see git log) | build/prototype-3d-v7.html | (auto-deployed from main) | Goblin, Imp and Brute enemies; item pictures; v0.6.1 wizard and shared worlds |
| 0.6.0 | v0.6.0 (commit 974f3a0) | build/prototype-3d-v6.html | dpl_6fc7qgR5zH5qFEvxKnMkhWd9UMx9 | Save character and world on device |
| 0.5.1 | v0.5.1 (commit 4b84698) | build/prototype-3d-v5.html | dpl_DLMCRL9hFipanKWewQKy1Mi94usF | Phone layout for quick bar |

Older versions (0.4.0, 0.5.0) are kept in git tags and in `build/`.

## Rules

- Never delete a git tag, a build file, or a row in this table.
- Each new version gets a new tag, a new build file, and a new row.
- The Vercel project keeps old deployments. Do not delete them.

## How to roll back the website to an earlier version

Ask for the version (for example "roll back to 0.5.1"). The steps are:

1. Find its deployment ID in the table above.
2. Point the game's web address back to that deployment (Vercel alias assignment).
3. Open the web address and check that the old version loads.
4. Note the rollback in the table as a new row, so the history stays complete.

## How to roll back the code

1. Check out the commit (or tag, once tags are on GitHub): `git checkout 4b84698` (look only), or create a fix branch from it.
2. Commit the restored code as a new version rather than rewriting history.
