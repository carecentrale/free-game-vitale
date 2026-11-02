# Changelog

Version numbers: `0.MINOR.0`. Each prototype file in `build/` matches one version.

## 0.6.42: lakes, sand and a 4000 x 4000 land
- Water fills low places: lakes and the sea, with sand on the shore. You can wade in water (it does not stop you), and dig or build under it. Water cannot be dug
- The playable land is 4000 x 4000 blocks around the start point. Past its edge is solid stone
- Land is drawn in chunks around the player (about 272 blocks across) and loads a few chunks per frame, so the game does not freeze while you walk. Chunks far behind are removed
- Saved worlds keep their changes. Unchanged land is made again from the seed, so its shape is the same as before
- Test change: terrain tests now use places inside the 4000 x 4000 area
- Checked: script syntax, all tests (terrain and release checks). Chunk making measured in plain JavaScript (about 0.6 ms per chunk). Not checked in a browser by eye, on a tablet, or with saved games

## 0.6.41: saved games list fixed
- Saved games made since version 0.6.34 were hidden from the start menu by mistake. They are listed again. Nothing was deleted
- New test: saves with the newer world format are listed
- Checked: script syntax and all tests. Not checked in a browser with your saved games yet

## 0.6.40: taller mountains and deeper valleys
- The world is 96 blocks tall (was 64). Mountains rise higher, and valleys and canyons dip lower
- Canyons do not start within about 60 blocks of the start point, so the start stays easy to find
- Saved worlds from earlier heights keep their changes
- Checked: script syntax and all tests (terrain, browser, release checks). Not checked by eye or on a tablet
- Not built yet: a wider view (400 x 400) needs gradual loading in the background, which is the next step

## 0.6.39: sky, sun, clouds and mountains
- A sky with a gradient from deep blue to pale at the horizon, a sun glow, and soft clouds that drift and follow the player
- Terrain has rolling hills everywhere and mountain ranges with sharp ridges. The world is 64 blocks tall (was 24)
- Saved worlds from before this version keep their changes; the rest of each saved chunk is made as usual
- The area drawn around the player is unchanged (80 blocks across). A wider view needs a faster drawing method, not yet built
- Checked: script syntax, all tests including the browser tests, and the terrain tests. Redraw time measured in headless Chromium (about 60 ms). Not checked by eye or on a tablet

## 0.6.38: enemies start where the player is
- When a saved game is opened, the first enemies appear near the player. Before, they were placed before the saved spot was loaded, and could be removed at once
- Browser tests added (scripts/tests/browser.test.mjs): the game starts from a saved game with blocks and enemies and no errors; enemies stay on the ground while the player walks around
- Checked: script syntax, all tests including the browser tests (run in headless Chromium with local copies of the libraries). Not checked on a tablet or phone
- Note: the browser tests did not reproduce the enemy floating in the sky seen on 2 November; that bug is still open

## 0.6.37: fix blank screen after loading a saved game
- Version 0.6.34 accidentally deleted the game's movement settings, item list and bag. Loading a game then stopped partway, leaving a blank sky
- Restored those settings, unchanged from 0.6.33
- New test (scripts/tests/no-undefined.test.mjs) fails if the game uses any name that is never declared
- Tests now run with one command (npm test) on every push, through GitHub Actions, and before a push if the optional hook is switched on
- Checked: script syntax, all tests, and the undefined-name check. Not checked in a browser yet

## 0.6.36: errors shown on screen
- If the game hits an error, the message appears in a red box at the bottom of the screen, so it can be reported without a developer console
- Checked: script syntax (node --check) and tests. Not checked in a browser

## 0.6.35: world status for support
- The parent area (tap the top-left corner 5 times) shows the world status: seed, blocks drawn, player position and ground height
- A drawing error is saved to the error log, and the world-loaded event is logged once per start
- Checked: script syntax (node --check). Not checked in a browser

## 0.6.34: a 400,000 x 400,000 block world
- The world is 400,000 blocks wide. Land is made on demand from the seed, so you can walk anywhere in it
- Only the blocks players change are saved and shared. Old 40 x 40 saves and shared worlds are copied into the middle of the new world
- Only the blocks near the player are drawn, and blocks buried in the ground are skipped
- Enemies appear near the player and leave quietly when they are far away
- Checked: script syntax (node --check) and world tests (scripts/tests/terrain.test.mjs). Not checked in a browser or on a tablet (frame rate)

## 0.6.33: a new random island for every new game
- Every new game gets its own island. Hills, caves and gems are different each time
- The land slopes down toward the rim, so the island edge looks like land instead of a straight wall
- The world generator is checked by tests (scripts/tests/terrain.test.mjs). Not checked in a browser

## 0.6.32: saved games list layout fix
- The saved games cards at start are laid out at full width again. Their class names no longer clash with the quick bar's
- Checked: game script syntax (node --check). Not checked in a browser

## 0.6.31: clearer saved games list
- The start menu shows each saved game as a card: name, world code and last played time, with Play and Delete underneath
- Checked: game script syntax (node --check). Not checked in a browser

## 0.6.30: safety limit of 100 saved games on the device
- Up to 100 saved games on this device. This is a safety limit, not a plan limit. The start menu and the bag say when it is reached
- Checked: game script syntax (node --check). Not checked in a browser

## 0.6.29: one free cloud save; unlimited saves on the device
- Saved games on this device are unlimited (the 10-game limit from 0.6.27 is removed)
- The cloud save holds one game per parent account. Automatic saves never replace a different game; Save now asks before replacing it
- The signed-in status says the free cloud save holds one game
- Checked: game script syntax (node --check). Not checked in a browser

## 0.6.28: parents can delete the cloud save
- In the parent area, a signed-in parent can delete their cloud save. The game on this device is not changed
- The admin page has the same delete for the signed-in account (it cannot delete other accounts' saves)
- After a delete, automatic cloud saves stay off until Save now is pressed
- Database: migration 0006 (docs/migrations/0006_cloud_save_delete.sql), applied to the live database
- Checked: script syntax (node --check). Not checked in a browser

## 0.6.27: choose a saved game at start
- When you open the game, your saved games on this device are listed. Pick one to carry on, delete one, or start a new game
- Up to 10 saved games on this device. The old single save becomes the first one
- Starting a new game from the bag keeps your other saved games
- Checked: game script syntax (node --check). Not checked in a browser

## 0.6.26: dropped items disappear after 5 minutes
- Items dropped on the ground (when the bag is full) disappear 5 minutes after they were dropped
- The drop time is saved with the drop, so reloading the game does not restart the 5 minutes
- Checked: game script syntax (node --check). Not checked in a browser

## 0.6.25: stuck defeated creatures disappear after 5 minutes
- A defeated creature that is hovering or still falling now sinks and disappears 5 minutes after it was defeated, like one lying on the ground
- Checked: game script syntax (node --check). Not checked in a browser

## 0.6.24: enemy log records dug-out bodies
- When the ground under a defeated creature is dug out, the event is written to the enemy log (creature type, time, position, world, version; no names or player codes)
- Checked: game script syntax (node --check). Not checked in a browser

## 0.6.23: defeated creatures no longer hover
- A defeated creature that lies on a block is placed exactly on top of it. Before, it could rest a fraction above the block (the enemy's height is not whole numbers), which looked like floating
- Checked: game script syntax (node --check). Not checked: in a browser, the game was not run here

## 0.6.22: fallen creatures fall when ground is dug away
- A defeated creature left with nothing under it (for example after the ground is dug out from under it) falls to the ground

## 0.6.21: fallen creatures drop off the map
- A defeated creature that lands past the edge of the island falls off the map instead of hanging in the air

## 0.6.20: home page
- The game moved to its own address, /play/. The main address now shows a home page with a Play button
- Home page: www/index.html. Game: www/play/index.html
- Game links to files use absolute paths (/models/, /admin.html) so they work from /play/
- Release note: .github/workflows/release.yml still copies an old build to www/index.html. That would replace the home page. Fix before any store release

## 0.6.19: teleport works in the background
- The teleport cast now uses the clock, so it finishes on time even when the game tab is not in focus
- Limit: browsers slow background timers. After a long time in the background, the teleport can be up to about a minute late

## 0.6.18: teleport lands on top; enemy debug log
- Teleporting (and the fall reset) puts you on the highest land near the middle of the map, not at the bottom of a hole you dug
- Enemy debug log: enemies that leave the map are recorded with the world code, enemy type, time, and position rounded to 0.1. Players are not identified. The parent can see the log on the device (parent area) and on the admin page
- Shared log: active. Database migrations 0002 (tables and policies) and 0003 (remove public access to the cleanup function) were applied to the live database on 2026-11-02. Only the parent's account can read or delete entries
- Data change: this is new data collection and must be described in the privacy policy before public release

## 0.6.17: fixes for enemies off the map
- Enemies that fall off the island, leave the world, or stay in the air for more than 3 seconds are removed; new ones appear on the grass
- A defeated enemy that was in the air falls and lands on the block below it, instead of hanging there
- The teleport button counts down (m:ss) while it is casting

## 0.6.16: easier to close Settings
- Esc closes the Settings screen
- Tapping or clicking outside the Settings panel closes it; that tap does not also dig or build in the game
- The Close button is larger and easier to tap

## 0.6.15: teleport to the start
- Purple teleport button at the top right takes you back to the start point, three blocks above the ground so you land safely
- Teleporting is free. Casting takes 5 minutes; after it teleports you, it recharges for 1 hour
- The recharge time is kept on this device only (a timestamp in local storage); nothing is sent anywhere
- Not yet tested in a browser (see notes in the release record)

## 0.6.14: enemy fixes and corpses
- Enemies stay on the ground while walking. The bounce now stretches the body instead of lifting it off the blocks
- Enemies turn back at the edge of a ledge instead of walking off into the air
- Right-click (on a computer) builds with a block from the quick bar, even when another slot is selected
- Enemies with a 3D model that finished loading after they spawned can now be hit
- A defeated enemy lies on the ground for 5 minutes, then sinks into the ground and disappears
- Corpses are not saved, not shared in multiplayer worlds and not counted anywhere; no new data is collected

## 0.6.13: settings screen
- Settings button at the top right shows the game version and a list of what has changed
- The list is a copy kept inside the game; update it with each release

## 0.6.12: drops when the bag is full
- When the bag is full, digging no longer stops. The block is dropped on the ground as a small spinning cube
- Walk next to a dropped item to pick it up once there is room in the bag
- You can't build on a spot where something is on the ground until it is picked up
- Up to 40 items can lie on the ground at once
- Dropped items are saved on this device only; they are not shared in multiplayer worlds yet

## 0.6.11: cloud save for parents
- Parent area: sign in with Google or Facebook, then save the game to the cloud (automatic every 30 seconds) and load it on another device
- Kids can't reach the sign-in; it sits behind the parent corner tap
- Supabase table cloud_saves, private to each signed-in parent

## 0.6.10: parent area and player review
- Parent area: tap the top-left corner 5 times quickly to open a link to the parent stats page
- Parent stats page: new Players table (games started, enemies defeated, power-ups) with a per-player activity list; opens for one player with ?pid=

## 0.6.9: enemy movement
- Enemies bounce and sway while walking and breathe gently while standing

## 0.6.8: Bestiary monsters
- Imp and Spike Beast enemies now use real 3D models from the Quaternius Bestiary pack (optimized to about 0.8 MB and 0.4 MB)
- Models load when first needed; a placeholder block shows until they arrive
- Other enemies keep their original shapes

## 0.6.0: save and shared-world groundwork
- Character and world save on this device automatically (every 5 seconds and when the page closes)
- Reopening the game restores your name, bag, quick bar, power levels, position, and the world
- Bag has "Start a new game" (asks first, then erases saved progress on this device)
- Supabase project created for the upcoming two-player sync (not connected to the game yet)

## 0.5.1: phone layout
- On phones (narrow screens), the quick bar sits above the controls and fits the screen width

## 0.5.0: quick bar and bag
- Quick bar of 6 slots at the bottom; select with 1-6 or tap
- Recent panel on the right: tap an item to put it in the selected slot
- Bag (B key or button): all items, tap one to put it in the selected slot
- Pickaxe digs, sword fights, and blocks build, depending on the selected slot
- Pickaxe and sword are shown in the hands only when selected
- Slime defeats and digging add items to the bag

## 0.4.0: textured world and zoom
- Blocks have textures: grass, dirt, stone with cracks, and sparkling gems
- Character has a face, hair, shoes, belt, and shading
- Mouse wheel and two-finger pinch to zoom
- Head turns toward the mouse or finger; drag sideways to turn the world
- Slimes to fight: hold on one to attack it, then get Fighting XP and a gem
- Sword in the left hand, pickaxe in the right

## 0.3.0: limbs and progressive digging
- Character has head, body, arms, legs, and a pickaxe
- Digging is held, with a crack that grows as progress builds

## 0.2.0: 3D prototype
- Switched from Phaser (2D) to Three.js (3D)
- Walk around a block world, dig, and build
- Power meters for digging, building, and inventory
- On-screen controls on touch devices, with an on/off toggle

## 0.1.0: 2D prototype
- First playable prototype (Phaser, 2D)
- Kept for reference in `build/index.html`
