# Art and Audio Assets

Source: Quaternius (https://quaternius.com/), free low-poly 3D game assets.

## License check (do this before the Play Store release)

- A third-party summary (GameFromScratch) describes Quaternius assets as **CC0** (public domain, free for commercial use, no attribution required).
- The official License page could not be read from this session. Open https://quaternius.com/ → License and confirm it still says CC0. Save a screenshot or copy of that page in `docs/` for the Play Store review file.
- Keep a list of which packs were used (below). Do not add any pack without checking its page on the site.

## Packs chosen for the game

| Pack (site page) | Used for | Status |
|---|---|---|
| Universal Base Characters (`universalbasecharacters.html`) | Player character body, rigged | To download |
| Universal Animation Library (`universalanimationlibrary.html`) | Walk, run, jump, dig, and attack animations for the player | To download |
| Cute Animated Monsters Pack (`cutemonsters.html`) | Replaces the slimes with animated monsters that wander and get hit | To download |
| Modular Weapons Pack (`medievalweapons.html`) | Sword and pickaxe models for the hands | To download |
| Cube World Kit (`cubeworldkit.html`) | Block look for dirt, stone, grass, and gems (matches the Minecraft feel) | To download |
| Stylized Nature MegaKit (`stylizednaturemegakit.html`) | Trees, flowers, and bushes on the surface (later version) | Later |

Other packs to look at later: Survival Pack (first-aid items for health), Ultimate Furniture (houses in instances), Animated Fish (for a water area).

## Where the files go

Download the zip files from the pack pages and put the extracted models in:
- `assets/models/characters/` (player and monsters)
- `assets/models/items/` (sword, pickaxe)
- `assets/models/blocks/` (block textures, if used)
- `assets/models/nature/` (trees and flowers, later)

Keep the original zip files out of git (add them to `.gitignore`), but keep the extracted `.glb` files in the repository so the game can load them.

## Next steps for the asset work

1. Download the five packs above and add the extracted files to the folders listed.
2. Replace the block-drawn character with the rigged Universal Base Character, and play its animations.
3. Replace the slimes with an animated monster from Cute Animated Monsters.
4. Replace the box-drawn sword and pickaxe with the Modular Weapons models.
5. Test on the tablet, and check the file size (large models slow down the browser version).

## Audio files (music and sound effects)

Rules from hand-off 002 (17 Nov 2026). A file may be used only if its own page says public domain, CC0 or CC BY. Not allowed: NC, ND, SA, anything from YouTube, a streaming service or a CD, and anything whose licence page cannot be read.

For every audio file:
1. Put the file in `www/audio/sfx/` (effects, at most 40 KB each, 600 KB in total) or `www/audio/music/` (music, 2 to 3 minutes, at most 1.5 MB each, 6 MB in total).
2. Save a copy of its licence page in `docs/licences/` and name that copy in the last column.
3. Add a row to the table below. "Use" is `music`, or the sound it plays: dig, place, gem, jump, land, swing, hit, defeat, hurt, fireball, fizzle, teleport, splash, break, tap, open, close. Write `-` for an effect's composer. "Shortened" is yes or no.
4. Run `node scripts/audio-credits.mjs`. It writes `www/audio/credits.json` (the game reads it) and the credits on `www/terms.html`.

The tests fail if a file has no row, a row has no file, a licence is not allowed, a licence copy is missing, or the credits are out of date.

| File | Use | Piece or sound | Composer | Performer or maker | Source address | Licence | Licence link | Shortened | Date checked | Licence copy |
|---|---|---|---|---|---|---|---|---|---|---|
| sfx/dig.mp3 | dig | Dig a block sound (impactMining_000, Impact Sounds pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-impact-sounds-License.txt |
| sfx/place.mp3 | place | Place a block sound (impactPlank_medium_000, Impact Sounds pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-impact-sounds-License.txt |
| sfx/gem.mp3 | gem | Pick up a gem sound (confirmation_002, Interface Sounds pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/interface-sounds | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-interface-sounds-License.txt |
| sfx/jump.mp3 | jump | Jump sound (maximize_003, Interface Sounds pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/interface-sounds | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-interface-sounds-License.txt |
| sfx/land.mp3 | land | Land sound (footstep_grass_000, Impact Sounds pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-impact-sounds-License.txt |
| sfx/swing.mp3 | swing | Sword swing sound (knifeSlice, RPG Audio pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/rpg-audio | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-rpg-audio-License.txt |
| sfx/hit.mp3 | hit | Sword hit sound (impactSoft_medium_000, Impact Sounds pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-impact-sounds-License.txt |
| sfx/defeat.mp3 | defeat | Enemy defeated sound (impactSoft_heavy_001, Impact Sounds pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-impact-sounds-License.txt |
| sfx/fireball.mp3 | fireball | Fireball sound (cloth3, RPG Audio pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/rpg-audio | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-rpg-audio-License.txt |
| sfx/fizzle.mp3 | fizzle | Fireball fizzle sound (scratch_001, Interface Sounds pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/interface-sounds | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-interface-sounds-License.txt |
| sfx/teleport.mp3 | teleport | Teleport sound (bong_001, Interface Sounds pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/interface-sounds | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-interface-sounds-License.txt |
| sfx/splash.mp3 | splash | Splash sound (drop_002, Interface Sounds pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/interface-sounds | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-interface-sounds-License.txt |
| sfx/break.mp3 | break | Gear breaking sound (impactMetal_medium_001, Impact Sounds pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-impact-sounds-License.txt |
| sfx/tap.mp3 | tap | Button tap sound (click1, UI Audio pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/ui-audio | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-ui-audio-License.txt |
| sfx/open.mp3 | open | Panel open sound (open_001, Interface Sounds pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/interface-sounds | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-interface-sounds-License.txt |
| sfx/close.mp3 | close | Panel close sound (close_001, Interface Sounds pack) | - | Kenney (kenney.nl) | https://kenney.nl/assets/interface-sounds | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | no | 17 Nov 2026 | kenney-interface-sounds-License.txt |
| music/morning-mood.mp3 | music | "Morning Mood" from Peer Gynt Suite No. 1, Op. 46 | Edvard Grieg | Musopen Symphony Orchestra (Czech National Symphony Orchestra), Musopen Kickstarter project | https://commons.wikimedia.org/wiki/File:Musopen_-_Morning.ogg | Public domain (released by Musopen) | https://commons.wikimedia.org/wiki/File:Musopen_-_Morning.ogg | yes | 17 Nov 2026 | musopen-morning-commons.txt |

## Quiz words and pictures (0.6.72, SPEC-004)

Chosen and licence-checked by the product manager (SPEC-004 version 4, 18 Nov 2026); the owner said yes to both on 18 Nov 2026. `scripts/tests/quiz.test.mjs` fails if a word of 3 to 5 letters has no picture file, if `www/quiz/pics/` holds a file no word uses, or if the ENABLE list is found in `www/`.

| Files | Use | What it is | Maker | Source address | Licence | Licence link | Shipped in the game | Date checked | Licence copy |
|---|---|---|---|---|---|---|---|---|---|
| www/quiz/pics/*.svg (124 files, 217,299 bytes) | Picture clues for word questions of 3 to 5 letters | Twemoji 17.0.3, folder assets/svg, files unchanged. The file for each word is named in `QUIZ_WORD_ROWS` in the game file | Twitter, Inc and other contributors (jdecked/twemoji) | https://github.com/jdecked/twemoji | CC BY 4.0 | https://creativecommons.org/licenses/by/4.0/ | yes, with the credit in Settings and on www/terms.html | 18 Nov 2026 | twemoji-LICENSE-GRAPHICS.txt |
| scripts/tests/data/enable1.txt (1,743,363 bytes, 172,823 words) | The word check in the tests: every quiz word must be in it, and share its letters with no other word in it | ENABLE word list (enable1.txt) | Alan Beale and others | https://github.com/dolph/dictionary (copy used); licence statement: https://sources.debian.org/src/scowl/6-2/r/enable/README | Public domain | https://sources.debian.org/src/scowl/6-2/r/enable/README | no: tests only, never copied into www/ or the app | 18 Nov 2026 | enable-word-list.txt |
