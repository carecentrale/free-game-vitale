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
