# Changelog

Version numbers: `0.MINOR.0`. Each prototype file in `build/` matches one version.

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
