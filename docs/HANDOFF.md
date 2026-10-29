# Handoff: Kids Game Project

Use this file to pick up the project in Cowork (or any new conversation). Read it first, then `GAME_BRIEF.md`.

## Where things stand (version 0.4.0)

- Working 3D prototype: `build/prototype-3d-v4.html` (open in a browser; Three.js).
- Earlier versions are kept for reference: `build/index.html` (2D, v0.1), `build/prototype-3d.html` (v0.2), `build/prototype-3d-v3.html` (v0.3).
- Git repository is ready locally with tag `v0.4.0`. Not yet pushed to GitHub (see "Open items").

## What the game does now

- Open world made from blocks, generated randomly each time. Grass, dirt, stone, gems, and caves.
- Walk, jump, and turn the world (press and drag sideways). The head turns toward the mouse or finger.
- Zoom with the mouse wheel or a two-finger pinch.
- Hold a block to dig it. A crack shows the progress. Tap empty space to build.
- Hold a slime to fight it with a sword. Slimes never hurt the player.
- Four powers, each with a progress meter: Digging, Building, Inventory (bag fills over time), Fighting.
- Gems are the in-game currency, earned by digging and defeating slimes. They can never be bought.
- Each player gets a default name from a preset list, e.g. "Lord Kestrel 417". Names can be changed in Settings with gems (Settings not built yet).
- On-screen buttons show by default on touch devices and are off on PCs. The "Controls" button toggles them.

## Decisions already made (from the parent and son)

- Target: Android (Google Play) and the web. Tablet-friendly. No iOS for now.
- Audience: age 7. Minecraft and Roblox style: mining, building, exploring.
- Character creation: skin tone, hair, and outfit choices. No race labels.
- Names: no free typing. Preset titles and names with a random number.
- Multiplayer: no chat, no typed names. Shared worlds ("instances") are planned, not built.
- Monetization: none. No ads, no purchases, no loot boxes.
- Simple first version: upgrades come only from levelling up. No hidden-gem points, ability slots, or morphs yet.
- Fighting uses a sword. Digging uses a pickaxe. Building uses blocks.
- Each character level holds 3 power levels, for now (to be confirmed).

## Open questions to ask the family

1. Confirm that "work out" for Inventory means "build up" (carrying a full bag for a long time).
2. Confirm "3 power levels per character level".
3. Choose the default name list (about 20 names) for the signup screen.
4. Choose the first level's theme (a home world with one cave is the plan).
5. Settings screen: what can be changed, and what it costs in gems?

## Next steps (in order)

1. Push the repository to GitHub (`carecentrale/free-game-vitale`). The session needs write access (see "Open items").
2. Play the prototype on a tablet with your son. Note what's fun, confusing, or broken.
3. Add a name picker screen with the preset list and a Settings screen.
4. Add instances (extra worlds that friends can join) and a basic safe multiplayer model.
5. Wrap the web game for Android with Capacitor and make an `.aab` file.
6. Create the Google Play Console account, complete the Families policy questions, and set up the 12-tester closed test.
7. Write the privacy policy page and host it on GitHub Pages.

## Open items

- **GitHub push is blocked.** The session can read `carecentrale/free-game-vitale` but gets HTTP 403 when pushing. The GitHub connection needs write access. Check claude.ai Settings → Connectors. Local commits are safe in `/root/kids-game`.
- The remote repository already has one commit (`Initial commit`, README "# free-game-vitale"). It's merged into the local history, with the project README kept in place of the one-line title.

## How to resume in Cowork

1. Put this folder (or the zip) in Cowork and ask Claude to read `docs/HANDOFF.md` and `docs/GAME_BRIEF.md`.
2. Check `CHANGELOG.md` for the latest version and what changed.
3. Keep the version numbers going: a new feature means a new prototype file, a `CHANGELOG.md` entry, and a git tag.
4. Keep the brief updated with every decision, and never commit signing keys or passwords (`.gitignore` already blocks key files).
