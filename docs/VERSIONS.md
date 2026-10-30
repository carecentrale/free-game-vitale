# Versions and rollback

Every version that goes online has three records. Keep all three in step.

1. **Git tag** (for example `v0.6.0`): the exact code in the repository.
2. **Build file** (for example `build/prototype-3d-v6.html`): the playable file for that version.
3. **Vercel deployment ID** (for example `dpl_...`): the live copy at the game's web address.

## Version history

| Version | Git tag | Build file | Vercel deployment ID | What changed |
|---|---|---|---|---|
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
