# Kids Game Project

A bright, animated mobile game for kids, designed for tablets and the web, and published to the Google Play Store.

## Folder layout

- `docs/GAME_BRIEF.md`: the game idea, characters, and level notes (updated each session)
- `docs/ACCOUNTS_CHECKLIST.md`: every account needed, and what it is for
- `docs/PLAY_STORE_CHECKLIST.md`: steps and requirements for publishing
- `src/`: game code (Phaser)
- `assets/art/`: sprites, backgrounds, animation frames
- `assets/audio/`: music and sound effects
- `build/`: exported web and Android builds (not edited by hand)

## Tech stack (planned)

- Three.js for the 3D game (runs in any browser). Replaces the earlier Phaser (2D) plan.
- `build/index.html` is the old 2D prototype; `build/prototype-3d.html` is the current 3D prototype.
- Capacitor to wrap the web game as an Android app (.aab for Play Store)
- GitHub for code, Netlify or Cloudflare Pages for the free web version

## Ground rules for a kids' app

- No personal data collection, no third-party analytics, no ad SDKs
- No chat or user-to-user contact
- No purchases without a parental gate
- No pay-to-win mechanics or loot boxes
