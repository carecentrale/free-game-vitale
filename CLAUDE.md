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
- `www/index.html`: deployed copy of the game. Keep it identical to the current build file.
- `build/admin.html` and `www/admin.html`: parent stats page (email code sign-in).
- `build/prototype-3d-v5.html`, `v6.html`: older versions, kept for rollback.
- `build/models/`, `www/models/`: optimized GLB models (Quaternius Bestiary: imp.glb, puglin.glb).
- `docs/VERSIONS.md`: version, commit and deployment table, with rollback steps.
- `CHANGELOG.md`: user-facing changes per version.
- `.github/workflows/release.yml`: Play Store release (still points at v6; update before store release).

## Hosting and backend
- GitHub: `carecentrale/free-game-vitale`, main branch. Pushes to main auto-deploy to Vercel project `free-game-vitale`, output folder `www`.
- Live: https://free-game-vitale.vercel.app. Stats: https://free-game-vitale.vercel.app/admin.html
- Supabase project `rsrmuruskjtnxqmzvmnl`. Tables: worlds, players, game_events, game_errors, cloud_saves. Row-level security is on. Public write access to game tables is an open issue before public launch.
- Supabase client loads on demand from the jsDelivr CDN (version 2.45.4). Three.js 0.160.0 via importmap.

## How to change the game
1. Edit `build/prototype-3d-v7.html`. Check syntax: extract the module script and run `node --check`.
2. Bump `VERSION` in the script and the `<title>` tag.
3. Copy the build file to `www/index.html`.
4. Add a `CHANGELOG.md` entry and a `docs/VERSIONS.md` row (version, commit hash, deployment).
5. Commit with a clear message and push to `main`.
6. Never claim a feature works in a browser unless the parent has tested it. The sandbox cannot load the CDN, so only syntax checks run there. Say what was checked and what was not.

## Versioning and rollback
- Every release has a version number and a commit. Rollback = restore an older build file or check out an older commit, and record it as a new version.
- Tags cannot be pushed from the sandbox (403), so record commit hashes in VERSIONS.md.

## Assets and licences
- Quaternius assets (Bestiary, Universal packs) are under the Quaternius Asset License: free for commercial games, no credit required, cannot be resold or redistributed as assets.

## Style
- Explain changes in plain language. Keep answers short, with detail on request.
