# Tracking records: everything the game sends off the device

Nick's rule (23 Nov 2026): every feature records tracking events, for safety (backtracking, accountability, traceability). Records hold visit codes, world codes, counts and game words only, never a name typed by anyone and never anything typed. Each new kind of record is listed here in the same release. The privacy page (`www/privacy.html`) describes records by category (Nick's decision, 23 Nov 2026): a new kind that fits an existing row (for example a new gameplay record) needs no change to the page; a new kind of information, a new place it goes, or a new company that receives it gets new wording on the page in the same release, after Nick's yes.

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
| `world_left` | This device leaves a shared world: closing the game or Log off (0.6.87), or a grown-up turning playing together off (0.6.90). Best effort: a closing page may not send it | `players N` | "Gameplay records" |
| `share_reward` | A grown-up tapped Share the game in the parent area, or a share made on the parent stats page reached this saved game, and the share gems were added (once per saved game, 0.6.88) | `game` or `account`, and the number of gems | "Gameplay records" |
| `spawn_moved` | The character had to be moved so it was not inside the ground (0.6.87) | `start` or `up`, and `join` or `reload` | "Gameplay records" |
| `map_opened` | The map is opened; at most once a minute (`logOnce`, 0.6.87) | `players N` | "Gameplay records" |
| `log_opened` | The world's log is opened; at most once a minute (`logOnce`, 0.6.87) | `notes N` | "Gameplay records" |
| `together_switch` | A grown-up signed in with Google changes Playing together in the parent area (0.6.90, SPEC-039; approved by Nick 24 Nov 2026) | `on` or `off` | "Gameplay records" |
| `safety_reminder` | The Playing together card is shown, the first time a shared world would start on this device, and when OK is tapped (0.6.90, SPEC-039; approved by Nick 24 Nov 2026) | `shown` or `closed` | "Gameplay records" |
| `report_sent` | A child sends a report (0.6.91, SPEC-038; approved by Nick 24 Nov 2026) | Kind and category only (for example `build rude`) | "Gameplay records" |
| `player_hidden` | A child hides a player after reporting them, on this device until leaving the world (0.6.91, SPEC-038; approved by Nick 24 Nov 2026) | `hidden N` (a count only) | "Gameplay records" |
| `multiplayer_stopped` | This visit finds that the owner stopped multiplayer for it (0.6.91, SPEC-038; approved by Nick 24 Nov 2026) | Days left, or `until lifted` | "Gameplay records" |

Since 23 Nov 2026 the "Gameplay records" row on the privacy page describes these records by category (with examples), says the world code is kept with each record, and gives safety as the reason. It no longer lists every kind by name. The world's log itself (the join and leave notes) is not sent: it stays in memory on the device.


## 2. Error reports: table `game_errors`
| Record | When | Fields | Privacy page row |
|---|---|---|---|
| `game_errors` | A JavaScript error, a failed promise, a failed shared-world connection, or a caught error in the wizard, the shared world, drawing, castle life or dragons | Game version, visit code, message (500 characters), where it happened (80 characters), and the **stack trace** (2000 characters: the game's own code lines) | "Error reports" |

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
| `report_add` | A child sends a report (0.6.91, SPEC-038). Kept up to the owner's period (12 months to start), then deleted automatically; only the owner's account reads it | Kind, category; for an AI line its number; for a build the world code, place, direction looked and blocks changed nearby; for a player their visit code; this visit code; the time. Nothing typed, no name, no picture | "Reports (since 0.6.91)" |
| `report_delete_mine` | Delete my data on a device (0.6.92, SPEC-010): deletes the reports that device sent | The keys the server gave that device for its reports. Nothing else | "Reports (since 0.6.91)" |
| `reports_purge` | Called by `report_add` and the owner's page: deletes reports older than the keep period. Sends nothing about the player | None | "Reports (since 0.6.91)" |
| `mp_stop_until` | Before joining or sharing a world, and once a minute in a shared world (0.6.91, SPEC-038): has the owner stopped multiplayer for this visit? | This visit code (read only) | "Reports (since 0.6.91)" |
| `world_restores_get` | When a shared world is opened, and when the owner's page says so (0.6.91, SPEC-038): the owner's "put the land back" steps for this world | World code (read only) | "Shared world" |

## 5. Cloud save: table `cloud_saves` (parent signed in only)
| Record | When | Fields | Privacy page row |
|---|---|---|---|
| `cloud_saves` | Every 30 seconds and when the page closes, while a parent is signed in with cloud save on; read on load; deleted on request | The parent account's id, the saved game, the time | "Parent sign-in and cloud save" |

## 5b. Share the game: table `parent_shares` (parent signed in only, 0.6.88, SPEC-030)
| Record | When | Fields | Privacy page row |
|---|---|---|---|
| `parent_shares` | Written by the parent stats page when a signed-in parent taps Share the game; read by a game signed in to the same account in the parent area, to give the share gems once | The parent account's id and the date. Nothing about who the link went to, or whether it was sent or opened | "Share the game" |

## 6. Owner settings read when the game opens: table `game_settings` (read only, nothing sent about the player)
| Record | Fields read | Privacy page row |
|---|---|---|
| `game_settings` | Castle spacing, quiz settings, merchant prices, guards and carts, forced-update days | "World record" |

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

Sent by the owner's admin page only, never by a game (0.6.91, SPEC-038). A game that receives one asks the server before doing anything:
| Record | When | Fields | Privacy page row |
|---|---|---|---|
| `mpstop` | The owner stopped multiplayer for a visit code in that world | `code`: the visit code | "Reports (since 0.6.91)" |
| `restore` | The owner put the land back in a 32 by 32 box of that world | None | "Shared world" |

## 8. Shared world presence (not stored on our servers)
Each device in a shared world sends this about its own player twice a second to the other devices in that world, keyed by the visit code.

| Field | What it is | Privacy page row |
|---|---|---|
| `name` | The character's name, from the preset list | "Your character in a shared world" |
| `race` | The character's look (human, elf or dwarf) | "Your character in a shared world" |
| `sex` | The character's clothes choice from the start questions | "Your character in a shared world" |
| `x` | Position | "Your character in a shared world" |
| `y` | Position | "Your character in a shared world" |
| `z` | Position | "Your character in a shared world" |
| `yaw` | Which way the character faces | "Your character in a shared world" |
| `since` | When this device joined the world (the first one leads) | "Your character in a shared world" |
| `n` | A counter, so a device that goes quiet is noticed | "Your character in a shared world" |
| `f` | The child's quiz friend or Vital as a character: kind, place, turn (nothing it says) | "Your character in a shared world" |
| `tk` | The merchant cart the player is trading with | "Your character in a shared world" |
| `dr` | The dragons choice of this device | "Your character in a shared world" |

## 9. Other requests that leave the device
| Record | What | Privacy page row |
|---|---|---|
| `google_play_update_check` | Android app only (0.6.80): when the game opens and comes back, it asks Google Play whether a newer version is on the store. Google says its in-app update library collects no data | "Google Play" (service providers) |
| `credits.json` | The list of sound files, from our own site | Not needed: our own website, nothing about the player |

## Kept on the device only (never sent)
Not tracking records, listed so nothing is missed: the saved games, the view (behind or through the eyes, on the page as "The view"), "Load my game by itself" (0.6.83, not on the page), tips seen, sound and music levels.
