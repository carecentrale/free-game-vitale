# Tracking records: everything the game sends off the device

Nick's rule (23 Nov 2026): every feature records tracking events, for safety (backtracking, accountability, traceability). Records hold visit codes, world codes, counts and game words only, never a name typed by anyone and never anything typed. Each new kind of record is listed here **and** on the privacy page (`www/privacy.html`) in the same release.

`scripts/tests/events.test.mjs` reads the game file and fails when the game sends a record (an event kind, a database table, a database function, a shared-world message or a presence field) that is not in this file in backticks. For every row it also checks that the privacy-page row named in the last column exists on `www/privacy.html`. A row whose last column starts with **Not yet** is a known gap waiting for Nick's decision: the test lists it as "todo" and does not fail.

First listed: 23 Nov 2026, game 0.6.86, from the code (not from what the privacy page says).

## 1. Gameplay records: table `game_events`
Sent every 10 seconds and when the page closes. Each row: the event kind, game version, visit code (random each visit, never stored on the device), world code (4 letters), a short detail (at most 200 characters, game words and numbers only), and the time.

| Event kind | When | Detail | Privacy page row |
|---|---|---|---|
| `session_start` | The game opens | Game version | "Gameplay records" (named since 0.6.87) |
| `world_loaded` | A world is ready to play | How it was opened (new, saved, shared) and the world's seed number | "Gameplay records" (named since 0.6.87) |
| `world_joined` | A shared world is opened again from a saved game | "resume" | "Gameplay records" (named since 0.6.87) |
| `game_started` | The start questions are finished | Start mode chosen | "Gameplay records" |
| `power_up` | A power goes up a level | Power name and level | "Gameplay records" |
| `enemy_defeated` | A monster is defeated (alone or in a shared world) | Monster kind | "Gameplay records" |
| `world_entered` | This device is connected to its shared world's live channel (0.6.87) | None | "Gameplay records" |
| `world_players` | First list of players after connecting (0.6.87) | `players N`, this child included | "Gameplay records" |
| `player_joined` | Another device came into the world; recorded by the leading device only, so it is not counted twice (0.6.87) | Its visit code, `players N` | "Gameplay records" |
| `player_left` | Another device left the world; leading device only (0.6.87) | Its visit code, `players N` | "Gameplay records" |
| `world_left` | This device leaves a shared world: closing the game or Log off (0.6.87). Best effort: a closing page may not send it | `players N` | "Gameplay records" |
| `spawn_moved` | The character had to be moved so it was not inside the ground (0.6.87) | `start` or `up`, and `join` or `reload` | "Gameplay records" |
| `map_opened` | The map is opened; at most once a minute (`logOnce`, 0.6.87) | `players N` | "Gameplay records" |
| `log_opened` | The world's log is opened; at most once a minute (`logOnce`, 0.6.87) | `notes N` | "Gameplay records" |

Since 0.6.87 the "Gameplay records" row on the privacy page names every kind above, says the world code is kept with each record, and gives safety as the reason. The world's log itself (the join and leave notes) is not sent: it stays in memory on the device.


## 2. Error reports: table `game_errors`
| Record | When | Fields | Privacy page row |
|---|---|---|---|
| `game_errors` | A JavaScript error, a failed promise, a failed shared-world connection, or a caught error in the wizard, the shared world, drawing, castle life or dragons | Game version, visit code, message (500 characters), where it happened (80 characters), and the **stack trace** (2000 characters: the game's own code lines) | "Error reports" (the page does not mention the stack trace or the version: Not yet for those two fields) |

## 3. Enemy debug log: table `debug_log`
Sent every 10 seconds. World code, game version, kind, position rounded to 0.1, and a short reason with the monster kind. No visit code. Kept 30 days (owner can change it).

| Kind | When | Privacy page row |
|---|---|---|
| `enemy_off_map` | A monster leaves the map | "Enemy debug log" |
| `corpse_void` | A defeated monster's body falls into the void | "Enemy debug log" |
| `corpse_unsupported` | The ground under a resting body is dug out | "Enemy debug log" |

## 4. Worlds: database functions
| Record | When | Fields | Privacy page row |
|---|---|---|---|
| `world_create` | A new shared world is made | World code, the world's blocks | "Shared world" |
| `world_save` | A shared world's changes are saved | World code, the world's blocks, a save stamp | "Shared world" |
| `world_get` | A shared world is opened by its code | World code (read only) | "Shared world" |

## 5. Cloud save: table `cloud_saves` (parent signed in only)
| Record | When | Fields | Privacy page row |
|---|---|---|---|
| `cloud_saves` | Every 30 seconds and when the page closes, while a parent is signed in with cloud save on; read on load; deleted on request | The parent account's id, the saved game, the time | "Parent sign-in and cloud save" |

## 6. Owner settings read when the game opens: table `game_settings` (read only, nothing sent about the player)
| Record | Fields read | Privacy page row |
|---|---|---|
| `game_settings` | Castle spacing, quiz settings, merchant prices, guards and carts, forced-update days | "World record" (the page does not name the quiz settings or the forced-update days: Not yet for those two) |

## 7. Shared world live messages (not stored on our servers)
Sent over the shared world's live connection to the other devices in that world only. Each carries the sender's visit code.

| Message | What it carries | Privacy page row |
|---|---|---|
| `block` | A block placed or dug: position and block type | "Shared world" |
| `ws` | The leading device's world state: monsters, carts and guards, their places and life, a clock | "Shared world: game things (since 0.6.81)" |
| `hit` | A hit on a monster: monster id and damage | "Shared world: game things (since 0.6.81)" |
| `defeat` | A monster defeated: id, place, how the reward is shared | "Shared world: game things (since 0.6.81)" |
| `drop` | A thing dropped on the ground: place and id | "Shared world: game things (since 0.6.81)" |
| `drops` | All things on the ground | "Shared world: game things (since 0.6.81)" |
| `pick` | Asking to pick a thing up | "Shared world: game things (since 0.6.81)" |
| `taken` | Who picked a thing up (visit code) | "Shared world: game things (since 0.6.81)" |
| `snap` | Things on the ground and the eaten trees, for a device that just joined | "Shared world: game things (since 0.6.81)" |
| `snapreq` | Asking for a `snap` | "Shared world: game things (since 0.6.81)" |
| `eat` | A dragon eats a tree | "Shared world: game things (since 0.6.81)" |

## 8. Shared world presence (not stored on our servers)
Each device in a shared world sends this about its own player twice a second to the other devices in that world, keyed by the visit code.

| Field | What it is | Privacy page row |
|---|---|---|
| `name` | The character's name, from the preset list | Not yet: the page does not say the player's own character is sent to the other players |
| `race` | The character's look (human, elf or dwarf) | Not yet (as above) |
| `sex` | The character's clothes choice from the start questions | Not yet (as above) |
| `x` | Position | Not yet (as above) |
| `y` | Position | Not yet (as above) |
| `z` | Position | Not yet (as above) |
| `yaw` | Which way the character faces | Not yet (as above) |
| `since` | When this device joined the world (the first one leads) | Not yet (as above) |
| `n` | A counter, so a device that goes quiet is noticed | Not yet (as above) |
| `f` | The child's quiz friend or Vital as a character: kind, place, turn (nothing it says) | Not yet (as above) |
| `tk` | The merchant cart the player is trading with | Not yet (as above) |
| `dr` | The dragons choice of this device | Not yet (as above) |

## 9. Other requests that leave the device
| Record | What | Privacy page row |
|---|---|---|
| `google_play_update_check` | Android app only (0.6.80): when the game opens and comes back, it asks Google Play whether a newer version is on the store. Google says its in-app update library collects no data | Not yet: Google is listed only as a sign-in provider |
| `credits.json` | The list of sound files, from our own site | Not needed: our own website, nothing about the player |

## Kept on the device only (never sent)
Not tracking records, listed so nothing is missed: the saved games, the view (behind or through the eyes, on the page as "The view"), "Load my game by itself" (0.6.83, not on the page), tips seen, sound and music levels.
