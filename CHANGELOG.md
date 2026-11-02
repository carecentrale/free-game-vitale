# Changelog

Version numbers: `0.MINOR.0`. Each prototype file in `build/` matches one version.

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
