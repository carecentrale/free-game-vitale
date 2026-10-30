# Automated tests

These tests open the game in a headless browser and check it the way a player would.
They run offline: the game's CDN libraries (Three.js) are served from `tests/node_modules`, and
other internet requests (such as Supabase) are blocked.

## Run

    cd tests
    npm install
    npm test

The tests use the deployed copy in `www/`. Exit code 0 means every check passed.

## What is checked (version 0.6.13)

- The game starts and shows the start wizard, with no uncaught errors
- Settings button opens the panel, shows the game version and the 0.6.12 changes, and closes
- With a full bag, digging drops the block on the ground and the drop is saved
- Standing on a drop with room in the bag picks it up

## What is not checked

- Multiplayer, shared worlds, and Supabase (blocked offline)
- Cloud sign-in, the parent area, and the stats page
- Phones and touch controls
- Enemies, building, and the quick bar

## Limits of the test browser

The test browser draws the game very slowly (about 1-3 frames per second). The game moves
time forward a little with each frame, so a dig takes 30-60 seconds of real time. Tests wait
for the saved game to change, which is why the suite takes about 2-3 minutes.
