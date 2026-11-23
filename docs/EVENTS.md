# Tracking events

Every feature records what happens in it, for safety: backtracking, accountability and traceability, in case something happens (Nicola's rule, 23 Nov 2026).
Records go to the table `game_events` through `logEvent(kind, detail)` (or `logOnce` for things a child can do again and
again). Each row has: the kind, the game version, the visit code (`player_id`: random, made each time the game opens,
not saved on the device), the world code, a short detail (at most 200 characters) and the time.

Rules:
- Never a name, typed text, or anything that identifies a child. Visit codes, world codes, counts and game words only.
- A new kind is added to this table and to the privacy page (`www/privacy.html`, "Gameplay records") in the same release.
  `scripts/tests/events.test.mjs` fails if a kind in the game is missing here.
- The parent's stats page counts every kind by itself ("What people did").

| Kind | When | Detail | Since |
|---|---|---|---|
| `session_start` | The game opens | game version | early |
| `world_loaded` | The world is ready at start | `new`, `save` or `old save`, and the seed | early |
| `game_started` | The start wizard is finished | `new` (new world) or `join` (a friend's world) | early |
| `world_joined` | A saved game reopens its shared world | `resume` | early |
| `power_up` | A power goes up a level | power and level | early |
| `enemy_defeated` | A monster is defeated | monster kind | early |
| `world_entered` | This device is connected to its shared world's live channel | none | 0.6.86 |
| `world_players` | First list of players after connecting | `players N` (this child included) | 0.6.86 |
| `player_joined` | Another device came into the world (recorded by the leading device only) | its visit code, `players N` | 0.6.86 |
| `player_left` | Another device left the world (leading device only) | its visit code, `players N` | 0.6.86 |
| `world_left` | This device leaves a shared world (closing the game, Log off). Best effort: a closing page may not send it | `players N` | 0.6.86 |
| `spawn_moved` | The character had to be moved so it was not inside the ground | `start` or `up`, and `join` or `reload` | 0.6.86 |
| `map_opened` | The map is opened (at most once a minute) | `players N` | 0.6.86 |
| `log_opened` | The world's log is opened (at most once a minute) | `notes N` | 0.6.86 |
