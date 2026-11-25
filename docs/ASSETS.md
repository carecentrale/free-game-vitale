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

## 3D models for SPEC-033 (added with the feature)


| File | Use | What it is | Maker | Source address | Licence | Licence link | Changed | Date checked | Licence copy |
|---|---|---|---|---|---|---|---|---|---|
| www/models/dragons/dragon-meadow-drake.glb | Meadow Drake and all baby dragons | "Dragon (Ultimate Monsters)", clips: Death, Fast_Flying, Flying_Idle, Headbutt, HitReact, No, Punch, Yes | Quaternius | https://poly.pizza/m/3rUm1cN3yp (file https://static.poly.pizza/ae5b8510-1fa5-4d53-b943-a4f3b88fb629.glb) | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | yes: resampled animation keys, removed duplicate data and unused empty nodes (glTF-Transform 4: resample, dedup, prune); meshes, skeleton and clips unchanged | 24 Nov 2026 | polypizza-quaternius-cc0-models-SPEC-033.txt |
| www/models/dragons/dragon-great-sky.glb | Great Sky Dragon | "Dragon Evolved (Ultimate Monsters)", clips: Death, Fast_Flying, Flying_Idle, Headbutt, HitReact, No, Punch, Yes | Quaternius | https://poly.pizza/m/LlwD0QNUPj (file https://static.poly.pizza/90ed3740-d8c4-4910-88ce-ac2ed426022d.glb) | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | yes: resampled animation keys, removed duplicate data and unused empty nodes (glTF-Transform 4: resample, dedup, prune); meshes, skeleton and clips unchanged | 24 Nov 2026 | polypizza-quaternius-cc0-models-SPEC-033.txt |
| www/models/dragons/dragon-long-tail-wyvern.glb | Long-tail Wyvern | "Dragon (older Quaternius animated pack)", clips: Dragon_Attack, Dragon_Attack2, Dragon_Death, Dragon_Flying, Dragon_Hit | Quaternius | https://poly.pizza/m/VBvzjFIYws (file https://static.poly.pizza/9714f533-5d2d-4cfd-b8f1-c8dfff64a672.glb) | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | yes: resampled animation keys, removed duplicate data and unused empty nodes (glTF-Transform 4: resample, dedup, prune); meshes, skeleton and clips unchanged | 24 Nov 2026 | polypizza-quaternius-cc0-models-SPEC-033.txt |

## 3D models for SPEC-035 (added with the feature)


| File | Use | What it is | Maker | Source address | Licence | Licence link | Changed | Date checked | Licence copy |
|---|---|---|---|---|---|---|---|---|---|
| www/models/monsters/brute-yeti.glb | Brute, look 1 | "Yeti", clips: Death, Duck, HitReact, Idle, Jump, Jump_Idle, Jump_Land, No, Punch, Run, Walk, Wave, Weapon, Yes | Quaternius | https://poly.pizza/m/ceRHrn8HHE (file https://static.poly.pizza/40a831b3-686a-4af8-b189-a13b38a3c26a.glb) | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | yes: resampled animation keys, removed duplicate data and unused empty nodes (glTF-Transform 4: resample, dedup, prune); meshes, skeleton and clips unchanged | 24 Nov 2026 | polypizza-quaternius-cc0-models-SPEC-035.txt |
| www/models/monsters/brute-orc.glb | Brute, look 2 | "Orc", clips: Death, Duck, HitReact, Idle, Jump, Jump_Idle, Jump_Land, No, Punch, Run, Walk, Wave, Weapon, Yes | Quaternius | https://poly.pizza/m/5vO2YJsPEf (file https://static.poly.pizza/52a479b3-a635-4a23-92cb-6697eaa5eed5.glb) | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | yes: resampled animation keys, removed duplicate data and unused empty nodes (glTF-Transform 4: resample, dedup, prune); meshes, skeleton and clips unchanged | 24 Nov 2026 | polypizza-quaternius-cc0-models-SPEC-035.txt |
| www/models/monsters/brute-blue-demon.glb | Brute, look 3 | "Blue Demon", clips: Death, Duck, HitReact, Idle, Jump, Jump_Idle, Jump_Land, No, Punch, Run, Run2, Walk, Wave, Weapon, Yes | Quaternius | https://poly.pizza/m/S7jYW6Amye (file https://static.poly.pizza/6fbb8914-bd11-45e1-a906-51ace2ca5d2d.glb) | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | yes: resampled animation keys, removed duplicate data and unused empty nodes (glTF-Transform 4: resample, dedup, prune); meshes, skeleton and clips unchanged | 24 Nov 2026 | polypizza-quaternius-cc0-models-SPEC-035.txt |
| www/models/monsters/brute-big-arm.glb | Brute, look 4 | "Big arm", clips: Death, HitReact, Idle, Jump, Jump_Idle, Jump_Land, No, Punch, Run, Run_Arms, Run_Attack, Walk, Wave, Yes | Quaternius | https://poly.pizza/m/KaVJET0WHx (file https://static.poly.pizza/02774147-cf49-4915-a70f-81ac5a8d625b.glb) | CC BY 3.0 | https://creativecommons.org/licenses/by/3.0/ | yes: resampled animation keys, removed duplicate data and unused empty nodes (glTF-Transform 4: resample, dedup, prune); meshes, skeleton and clips unchanged; its one texture re-saved as WebP at quality 90 (EXT_texture_webp, as imp.glb) to bring it from 640,560 bytes under the 600 KB limit | 24 Nov 2026 | polypizza-quaternius-big-arm-cc-by-3.0.txt |
| www/models/monsters/goblin-orc-enemy.glb | Goblin, look 1 | "Orc Enemy", clips: Bite_Front, Dance, Death, HitRecieve, Idle, Jump, No, Walk, Yes | Quaternius | https://poly.pizza/m/Q3z8ZX4kUy (file https://static.poly.pizza/3076c5f7-9bdf-4c27-8083-f280ee6cd64b.glb) | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | yes: resampled animation keys, removed duplicate data and unused empty nodes (glTF-Transform 4: resample, dedup, prune); meshes, skeleton and clips unchanged | 24 Nov 2026 | polypizza-quaternius-cc0-models-SPEC-035.txt |
| www/models/monsters/goblin-tribal.glb | Goblin, look 2 | "Tribal", clips: Death, Fast_Flying, Flying_Idle, Headbutt, HitReact, No, Punch, Yes | Quaternius | https://poly.pizza/m/t91lDHaqRW (file https://static.poly.pizza/1b4759ca-2c00-4718-90f6-2f84bc8e44f9.glb) | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | yes: resampled animation keys, removed duplicate data and unused empty nodes (glTF-Transform 4: resample, dedup, prune); meshes, skeleton and clips unchanged | 24 Nov 2026 | polypizza-quaternius-cc0-models-SPEC-035.txt |
| www/models/monsters/hood-goblin-ninja.glb | Hood Goblin, look 1 | "Ninja", clips: Bite_Front, Dance, Death, HitRecieve, Idle, Jump, No, Walk, Yes | Quaternius | https://poly.pizza/m/mCNoqcqpvC (file https://static.poly.pizza/42162a27-0aaa-40be-b50e-919776021a11.glb) | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | yes: resampled animation keys, removed duplicate data and unused empty nodes (glTF-Transform 4: resample, dedup, prune); meshes, skeleton and clips unchanged | 24 Nov 2026 | polypizza-quaternius-cc0-models-SPEC-035.txt |
| www/models/monsters/hood-goblin-ninja-2.glb | Hood Goblin, look 2 | "Ninja (second model)", clips: Death, Duck, HitReact, Idle, Jump, Jump_Idle, Jump_Land, No, Punch, Run, Walk, Wave, Weapon, Yes | Quaternius | https://poly.pizza/m/xGYmeDpfTu (file https://static.poly.pizza/2ed11876-720e-457a-8a69-4a14ba7234dc.glb) | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | yes: resampled animation keys, removed duplicate data and unused empty nodes (glTF-Transform 4: resample, dedup, prune); meshes, skeleton and clips unchanged | 24 Nov 2026 | polypizza-quaternius-cc0-models-SPEC-035.txt |
| www/models/monsters/spear-imp-demon-2.glb | Spear Imp, look 1 | "Demon (with trident)", clips: Death, Duck, HitReact, Idle, Jump, Jump_Idle, Jump_Land, No, Punch, Run, Walk, Wave, Weapon, Yes | Quaternius | https://poly.pizza/m/LnfIziKv4o (file https://static.poly.pizza/46b52ba4-5d2a-4fc8-85cc-3e980f199141.glb) | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | yes: resampled animation keys, removed duplicate data and unused empty nodes (glTF-Transform 4: resample, dedup, prune); meshes, skeleton and clips unchanged | 24 Nov 2026 | polypizza-quaternius-cc0-models-SPEC-035.txt |
| www/models/monsters/spear-imp-demon.glb | Spear Imp, look 2 (shown hovering low) | "Demon (flying set)", clips: Death, Fast_Flying, Flying_Idle, Headbutt, HitReact, No, Punch, Yes | Quaternius | https://poly.pizza/m/Mo2ky6vkf8 (file https://static.poly.pizza/c2e39eb4-4b8e-4d31-b014-d637bf4e15c6.glb) | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | yes: resampled animation keys, removed duplicate data and unused empty nodes (glTF-Transform 4: resample, dedup, prune); meshes, skeleton and clips unchanged | 24 Nov 2026 | polypizza-quaternius-cc0-models-SPEC-035.txt |
| www/models/monsters/imp-spike-beast-moves.glb | Animation clips for the Imp (imp.glb) and the Spike Beast (puglin.glb) | Clips Death01, Hit_Chest, Idle_Loop, Jog_Fwd_Loop, Punch_Cross, Sword_Attack, Walk_Loop from "Universal Animation Library" (Standard), skeleton only | Quaternius | https://quaternius.com/packs/universalanimationlibrary.html (copy: UAL1_Standard.glb, see the licence copy) | CC0 1.0 | https://creativecommons.org/publicdomain/zero/1.0/ | yes: kept 7 clips, removed meshes, textures and unused tracks | 24 Nov 2026 | quaternius-universal-animation-library.txt |

Credit needed (CC BY 3.0) in Settings credits and on www/terms.html, next to the Twemoji credit:
"Big arm" by Quaternius (https://poly.pizza/m/KaVJET0WHx), CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Changed: texture re-saved as WebP.
