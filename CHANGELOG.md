# Changelog

Version numbers: `0.MINOR.0`. Each prototype file in `build/` matches one version.

## Website, 27 Nov 2026: the privacy page table is readable again. No game version: the game is not changed
Found by Nick (27 Nov 2026, dreneric.com/privacy.html on a PC): in the table "Information the game collects" the first column was so narrow that words broke in the middle ("Typ / e of / info / rma / tion").
- Cause: the website lets long words break anywhere (for long links on phones), so the table thought every column could be one letter wide and gave all the room to the long "What it is" column.
- Now table cells only break between words, and the first column is at least about 9 letters wide. On phones (700 pixels or narrower) each row of the table becomes its own card: the type of information as its title, then the four other columns with their names above them.
- Second step, same day (Nick: "the rest is squished"): on screens wider than 900 pixels the table now uses the full width of the site (up to about 1090 pixels) instead of the narrow text column, and the "What it is" column gets about a third of it. Tablets and phones up to 900 pixels show the cards.
- The words on the privacy page are the same. No change to what the game records.
- Checked: fast tests, including a new test in `scripts/tests/site-look.test.mjs`; pictures of the page in the cloud test browser at 1400, 820 and 390 pixels wide (no side scrolling, whole words). Not checked: on Nick's own devices.

## 0.6.107: the Spell button stays lit after a fireball
Found in play by Nick (27 Nov 2026, website on a PC): the fireball had to be chosen again before every shot.
- Cause: since 0.6.74 the lit Spell button went dark after every cast, so each fireball needed a new tap on the button first.
- Now a cast leaves the button lit and starts its 5 seconds again. It goes dark when it is tapped again, or 5 seconds after the last cast. Casting from a quick bar slot, right-click and F are unchanged.
- No change to saves or to what the game records.
- Checked: syntax check; fast tests, including the new `scripts/tests/spell-stays-lit.test.mjs`; the existing Spell button browser test was changed to cast twice without a new tap on the button, but was not run (the cloud browser cannot load the game's CDN). Not checked: played by Nick.

## Admin page, 25 Nov 2026: Insights (SPEC-040, version 1). No game version: the game is not changed
Insights: charts of everything the game records, and of errors by game version.
- A new section in the admin page, opened with the Insights button at the top, for the owner's account only. Filters: last 7, 30 or 90 days, and game version. Activity: records per day, visits per day, the share of visits in shared worlds, one small chart for every kind of record (a new kind shows by itself), and for a tapped kind its chart per day and its 10 most frequent details. Errors: errors per day split by game version, and the 20 most frequent errors (grouped by message and place) with count, first and last day, versions and the latest stack trace. Every chart has its numbers in a table and a Download CSV button. The charts are drawn by the page (SVG); nothing is loaded from outside. The older cards are unchanged.
- Database: migration `0020_insights.sql`, two counting functions only the owner's account may run. They return counts only (no visit code, no world code), give a detail only when 3 different visits have it, and change nothing. NOT applied: it waits for Nick's yes; until then Insights says it is not available.
- Built differently: the small charts of the kinds share one table and CSV ("every kind per day"); a kind's own table and CSV show when it is tapped. A visit "in a shared world" is a visit with at least one record that carries a world code. Days are counted in UTC. No summary table: the functions count from the records directly, using the index on the record time.
- Checked: the two functions on a scratch database in the cloud workspace (the owner gets counts, everyone else is refused, no code comes back, a detail of fewer than 3 visits is left out); the page in the test browser with example numbers. Not checked: on the live database (not applied), so done-when line 2's comparison with a direct query and the 3 seconds for 90 days are open; a tablet; nothing was looked at by Nick.

## Backend, 25 Nov 2026: bird facts by themselves once a week (SPEC-037). No game version
- Migration `0021_bird_facts_weekly.sql`: every Monday the database calls the function `bird-facts` three times, ten minutes apart. The call's secret is made inside the database and kept in its vault: it is in no file and nobody sees it. The function `bird-facts` now asks the database whether the secret is right (no CRON_SECRET to set), and one call stops after 100 seconds.
- Nick's answer was "weekly" where the spec says once a day; the limit of new facts a day (50) is unchanged, so about 50 facts a week at most. "Write new facts now" in the admin page adds more on any day.
- Not applied yet and not deployed yet on 25 Nov: see docs/migrations/README.md.

## 0.6.106: the app's Google sign-in has its client ID
- The game now holds the public Web client ID of the Google sign-in (Google Cloud project adventures-of-drenerics, client "WebApp - Supbase"). It is not a secret; the client secret is not in the repository and a test fails if one ever appears.
- Set up in Google Cloud on 25 Nov 2026 (by the builder in Nick's browser, at his request): two Android clients for com.drenerics.adventurers, one for Play's app signing key and one for the upload key.
- Not working yet: Supabase's Google sign-in is switched off (needs the client ID and secret, entered by Nick), Google's consent screen is in Testing with no test users, and the app needs a new Android build.
- Checked: syntax, fast tests. Not checked: a real sign-in on a phone.

## 0.6.105: Google sign-in inside the Android app (Nick's request in chat, 25 Nov 2026)
- Why it did not work: the app is the web game inside an app shell. Google does not show its sign-in page inside an app's own web view, and the game there has no web address to come back to.
- Now: in the app, "Sign in with Google" in the parent area opens the phone's own Google account window over the game. Google hands back a signed token, the database checks it, and the grown-up is signed in without leaving the game. In a browser nothing changes. This opens the Playing together switch, cloud save and the owner's Teacher Mirelo preview in the app.
- The app gets one new add-on, `@capgo/capacitor-social-login`, with Google only. Facebook, Apple and Twitter are switched off in capacitor.config.json; that also keeps Facebook's advertising ID permission out of a children's app.
- New record `signin_app`: how a sign-in in the app went (ok, closed, refused, not set up). Never the account.
- NOT working until three things are done by Nick: (1) give the builder the Google "Web application" client ID that the database's Google sign-in uses (a public value; it is empty in the game now, and the app says sign-in is not set up); (2) in the same Google Cloud project, add an Android client for com.drenerics.adventurers with the SHA-1 of the upload key and one with the SHA-1 of Google Play's app signing key; (3) in Supabase, Google provider, make sure that Web client ID is in the list of client IDs.
- Checked: syntax and the rules by test. Not checked: anything on a phone. It cannot be tried without the three steps and a new Android build. Sign-in touches the parent account: nothing new is collected, and the privacy page already names Google for parent sign-in.

## 0.6.104: Teacher Mirelo's preview is a switch in the parent area, for the owner only (Nick's request in chat, 25 Nov 2026)
- The address switch `?teacher=1` is gone: nothing in the page address turns Teacher Mirelo on. In its place the parent area shows "Teacher Mirelo (preview)", On or Off, only to the game's owner signed in there with Google. It is kept on that device. Everyone else sees nothing of it.
- To try it: open the game in a browser, open the parent area, sign in with Google as the owner, turn the preview On, then tap Mirelo when he visits (or wait for his next visit).
- Checked: by test that the address no longer switches him on and that only the owner's account draws the switch; a whole talk in the test browser with the preview on. Not checked: the real Google sign-in (the test browser cannot sign in), a phone, and inside the Android app, where Google sign-in probably does not work, so the preview cannot be turned on there yet.

## 0.6.103: Teacher Mirelo's built-in talks, behind a test switch (first part of SPEC-027; Nick's answers in chat, 25 Nov 2026)
- With the test switch `?teacher=1` only: tapping Mirelo opens his teacher panel. First time he says the fixed AI greeting; then "Let's talk words", "Let's talk maths", "Goodbye". In a talk he gives one short lesson and a puzzle made by the game (maths from the child's Maths level; words: mixed-up letters and three words from the game's list at the Words level). Replies to tap: the three answers, "Can you show me?", "Why?", "Something easier", "Yes, harder!", "Another like that", and "I'm done for now" (always there). After two wrong tries he shows the answer. A talk ends after 12 replies. Right first answers move the learning level and count for his own "Learning with Mirelo" badges (at 5, 20, 50 and 100). No gems, nothing typed, nothing sent.
- 100 lessons written into the game by the builder (Nick: "write, let's say 100 lessons for now"): 60 for maths (two for each kind of question at each ten levels) and 40 for words (four at each ten levels), plus a "Why?" line for each kind. The PM's explanations file was not in Drive; these stand in for it and can be replaced.
- The cap is recorded (Nick: "a flag to say at what point we've hit that cap"): new record `teacher_lessons_cap` when a child has heard every lesson for a subject at their ten levels (they then come round again, oldest first), and `teacher_talk` for each talk. Both show in Insights by themselves.
- His voice is the device's own (browser speech); Settings gets "Mirelo's voice" while the switch is on. Every turn has the report flag.
- NOT built (so it stays behind the switch, and no child sees him or any word about him): the passes and the top-up (the game has no way to buy anything and no parent gate for buying), the live talks written by the AI service (they need the pass check), the daily limit, the parent's and the owner's switches, the admin card, the glowing book on his belt, a speaker on each reply, and the voice inside the Android app (it needs a plugin). Guide and release notes say nothing yet, because nothing is there for players.
- Checked: the lessons by test (count, 40 words at most, no sales talk, nothing personal); a whole talk in the test browser; a picture of the panel looked at. Not checked: the voice (the test browser has none), a phone, the lessons by a second reader; nothing was played by Nick.

## 0.6.102: The AI writer's failures are noted, and a failover is recorded (Nick's request in chat, 25 Nov 2026)
- Game: new record `fact_failover` when a bird's card has to use a fact that comes with the game: the bird kind, `empty` (no downloaded fact) or `flagged`, and `all-seen` when every built-in fact of that bird has been shown; at most once in 10 minutes. It shows in Insights by itself. Fits the "Gameplay records" row of the privacy page.
- Backend: the function `bird-facts` writes one row for every run to the new table `ai_runs` (migration 0022): worked or failed, how many facts, and when it failed the AI service's own short reason ("credit balance is too low", a cap, a key that does not work). The table is for every AI job, not only bird facts. Only the owner's account reads it; nothing about a player is in it.
- Admin page, Bird facts card: the last runs, and a red line at the top when the last run failed.
- Not done yet: migration 0022 is not applied (the Supabase confirmation question got no answer), so no run is noted yet. The function is deployed (version 4) and works without the table.
- Still only birds: the kinds are named in the facts table, the function and the game. Facts for other things (plants, land, animals to come) need their own hand-off; the run notes and Insights are already general.
- Checked: syntax, the rules by test. Not checked: a noted run on the live database; nothing was played by Nick.

## 0.6.101: Bird facts that come with the game (Nick's request in chat, 25 Nov 2026)
- The game now carries six fun facts for each of the eight birds (48 facts, each in the five reading versions with the same word limits). A bird's card uses them whenever the device has no downloaded fact for that kind: no internet yet, an empty pool, the server unable to write facts, or every downloaded fact of that kind flagged on the device. So the card no longer depends on the AI service. When the pool has facts for a kind, those are used, as before.
- The built-in facts were written with an AI system (this builder) and read through by it; no second, separate check ran on them, and Nick has not read them. They carry the same flag; a flag hides the fact on the device and reaches the owner's Reports, but it cannot take a built-in fact out of other devices (only a new version can).
- Changed from SPEC-037: done-when line 3 said a new device opened offline shows the picture and name only; it now shows a built-in fact. Guide, terms and privacy page say that the game carries facts of its own.
- Checked: word limits and calm wording counted by a test for all 240 sentences; the card with built-in and with downloaded facts in the test browser. Not checked: by a second AI or a person; on a phone; nothing was played by Nick.

## 0.6.100: The top buttons on a phone held upright, and the old failing browser tests
- Game: on a phone held upright (up to 440 px wide) the top row had grown (Map in 0.6.87, View) until the star and the teleport button lay over the button at the top left. Now the gems line and the top-left button sit under the row, and on the narrowest phones (up to 340 px) the row is packed a little tighter. Nothing changes on wider screens or with the phone on its side. No new rule, so no guide text.
- Tests brought up to date (the game was right, the tests were old): 18 places tapped the map's small picture instead of the game (the map came first on the page since 0.6.87), so taps never reached the game; goblins stood 3 blocks to the side, out of the sword's reach of 2 (0.6.76); the quiz report has hints and swaps (0.6.78); "Level up!" shows in the question, not in the top line (0.6.78); a merchant has 7 offers (0.6.81); the Map button sits between Powers and Settings (0.6.87); reading the owner's settings is not "something sent"; one hit can take off more than 1 at Fighting level 2; the goblin is an animated model (0.6.96).
- Tests made steady on a slow machine: waits in real time replaced by the game's own clock (guards' monsters sinking), five quick taps made from inside the page.
- Checked: each repaired test passes by itself in the test browser; pictures of the phone screen at 360 and 320 px wide looked at. Not checked: the whole long run in one go in this workspace (it takes about an hour here), a real phone, and nothing was played by Nick.

## 0.6.99: Living world (SPEC-026, version 2)
- Wind: grass, flowers, plants, bushes and tree tops lean gently, in waves that roll across the land, in every land. Done on the graphics card (in the plants' own materials); the top of a small plant moves a tenth of a block at most, a tree top a quarter. Trunks, mushrooms, stones, stumps, cactuses and snowmen stay still.
- Effects: bits in the block's colours when a block is dug (a smaller puff when one is placed, also for a block another child dug or placed nearby in a shared world), dust on landing from 3 blocks or more, a sparkle for a gem, and a leaf falling from a tree near the player every 5 seconds at most. 60 at most, in one draw, 1.5 seconds each at most. Nothing is saved, sent or recorded.
- Water: slow ripples and a gentle shimmer from a moving pattern on the one water material. Builder question 3: yes, it is one pattern on that material, with no extra draw calls. Still see-through.
- Ground variety: each grass, dirt, sand, snow and stone block is turned and shaded up to 5% lighter or darker, worked out from its place only. Done by turning the block itself (grass four ways about the up axis, the others any of 24 ways), so it costs no extra drawing.
- Parent area: "Calm motion: no swaying, falling leaves or effects", off to start, kept in the saved game. Guide: new part text and a grown-ups row. No new files; the game file grew by about 15 KB.
- Built differently: SPEC-025 (Better light) is not built (not approved), so there is no Graphics setting for this to follow; the speed counter is the one already in the game (?perf=1). A falling leaf starts at the lower edge of the tree top, not its tip, so that it reaches the ground within the 1.5 seconds an effect may last. No tracking record for the Calm motion switch: the spec says nothing new is logged (the Dragons switch has none either).
- Checked: syntax; the rules in the code; in the test browser: the effects (counts, 60 at most, gone in time), a leaf near a tree, which plant parts move, Calm motion, ground variety, and that the shaders draw without errors (pictures looked at: water with ripples, varied stone). Not checked: how the wind looks in motion, the speed on the test phone (done-when line 6), the oldest Android phone, a tablet; nothing was played by Nick.

## 0.6.98: Tap a bird for a fun fact written by AI (SPEC-037, version 5)
- Tap or click a bird within 25 blocks: a card opens at the side with the bird's picture (drawn from its own shape), its name and one fun fact, in the reading version for the game's Words level (five versions, 10 to 20 words). A flag button reports a fact (the report function of 0.6.91) and hides it on the device. The card closes with X, a tap elsewhere or after 12 seconds; the game does not pause; a press on a bird never digs, fights, builds or casts. Dragons cannot be tapped.
- The facts are written and checked on the server by the new backend function `bird-facts` (docs/functions/bird-facts): one request to Anthropic's API writes them, a second, separate request checks each one, and the word limits are counted in code. Only the bird kind, the place, the rules and facts already in the pool are sent. The game only downloads approved facts (all five versions, never one band) and keeps them on the device; facts seen stay on the device.
- Database: migration `0019_bird_facts.sql` (table bird_facts, three flags hold a fact, setting facts_per_day). NOT applied: it waits for Nick's yes. Admin page: new card "Bird facts (owner only)".
- New record kind `animal_fact` (approved 24 Nov 2026); new read of table `bird_facts`. Privacy page: new row "Bird facts" and Anthropic as a service provider for game content. Terms: new part "Text written by AI". Guide and release notes updated.
- The source of the function `delete-my-data` moved from supabase/functions/ to docs/functions/, next to the other functions.
- Not working until Nick has done three things: say yes to migration 0019; put his Anthropic API key in Supabase as the function's secret (ANTHROPIC_API_KEY) and let the function be deployed; choose how the once-a-day run is started. Until then a bird's card shows its picture and name only.
- Built differently: tapping another bird while a card is open shows that bird's card at once (the 2 seconds apply after a card has closed). The check asks six questions, not five ("the five versions say the same fact" is its own question). Facts in the pool for the repeat check are sent in their middle version only. The wording of the terms part is the builder's: the spec gave none.
- Checked: syntax; the function's rules with a stand-in for the AI (what is sent, limits, any failed check rejects); the card, tap, levels, flag and closing in the test browser on PC and phone sizes. Not checked: the function against the real AI and database (no key, migration not applied), done-when lines 1 and 4 (they need the live pool), the cost of 50 facts a day, the model name (claude-haiku-5-5 unless FACTS_MODEL is set), tapping a flying bird on the test phone, and nothing was played by Nick.

## 0.6.97: Birds for every part of the world (SPEC-034)
Built from the PM hand-off SPEC-034 version 2 (approved by Nick 24 Nov 2026, ready to build).
- **Eight kinds of bird, made in code** (no files): songbirds (grassland, forest, savanna, fewer in the taiga), parrots (rainforest), owls (forest and taiga), ducks (lakes in grassland, forest and taiga), penguins (tundra snow near water), gulls (any water that is not in the snow), geese (a V crossing the sky now and then) and hawks (very high over grassland, savanna and desert; the desert's only bird).
- **Where they are** comes from the seed, the biome and the shared clock, in squares of 56 blocks, so every device shows the same birds and nothing is sent or saved. A bird's place is checked against its kind's biomes, so none appears outside them. No birds in or by castles.
- **What they do:** songbirds hop and peck in a flock; parrots sit side by side on a tree top and fly to the next tree and back; an owl sits on a tree and turns to look at a child within 9 blocks; ducks paddle and dip their heads; penguins waddle and tip onto their bellies going downhill; gulls and the hawk glide in wide loops; geese cross in a V for about a minute in every four.
- **Moving away:** when a player comes within about 5 blocks of a flock (3 for an owl), or a dragon lands within 15, the group flies 20 to 40 blocks away (penguins waddle), to a place of its own kind and never within 12 blocks of a player. The direction is rounded to one of 16 so devices agree.
- **Flying** birds face the way they move (from their own path), lean into turns and tip up to climb. Penguins never fly.
- **Drawing:** one instanced mesh for the bodies of each kind and one for all wings: at most 40 birds within 80 blocks in at most 9 draws. A bird where a player has built is lifted on top of the blocks.
- Not solid, cannot be hit or caught, give nothing. No sounds. No record kind. Test switch `?birds=` and a kind, or `?birds=off`.
- **Built differently:** penguins do not dive or swim (they stay on the snow); gulls do not land on the sand; songbirds stay on the ground between flights (they do not perch in trees); the owl's eyes do not open (the whole owl turns to look). Beaks take a little of the body's colour (one draw for each kind).
- Guide (new heading Birds) and release notes. Tests: `birds.test.mjs` and 2 browser tests (8,100 squares for biomes, facing within 10 degrees, penguins never fly, 40 birds and the draws, moving away).
- Checked: syntax, fast tests, browser tests, and penguins and an owl seen in the game in the workspace's Chrome. **Not checked:** the other kinds by eye; the frame rate on the test phone; two devices; played by Nick.

## 0.6.96: Believable monsters, every monster an animated model (SPEC-035)
Built from the PM hand-off SPEC-035 version 3 (approved by Nick 24 Nov 2026, ready to build).
- **Every monster is a real animated model** (Quaternius; delivered by the PM, SHA-256 checked). The four kinds drawn in code get looks: Brute (four looks), Goblin (two), Hood Goblin (two), Spear Imp (two, one of them flying just above the ground). Which look a monster has comes from its own number, so every device shows the same. The Imp and Spike Beast keep their models and now move with clips from a clips-only file (their skeletons match it bone for bone).
- **Animations follow what it does**, blending over 0.2 seconds: standing, walking, flinching when its life drops, falling over when it is defeated (before, a body was laid on its side). The walk is played at the speed the monster really moves, so its feet do not slide. A Brute flexes once when the child comes within 5 blocks.
- **Facing:** a monster turns smoothly toward the way it will walk and starts walking once it faces it (within 15 degrees). Before, it snapped round.
- **Same fight:** health, toughness, weakness, gems, parts, the place a tap counts as a hit and each kind's height are unchanged. Monsters still never hurt the child; no attack clip is used.
- **Colours and held things:** a look's main colour is mixed half-way with its kind's colour (plain-colour models only), and a kind's sword, spear or staff is fixed to the hand of a look that has none.
- **Shared worlds:** no new message. The other devices play walk, stand, flinch and fall from what the leading device already sends (place and life).
- **Files:** 11 new files, 3.38 MB; with imp.glb and puglin.glb 4.54 MB of the 4.5 MB (4,718,592 bytes) allowed; none over 600 KB. Each is loaded the first time that look appears; a box shows meanwhile, as before.
- **Licences:** `docs/ASSETS.md` rows and licence copies for every monster file. "Big arm" is CC BY 3.0: its credit is in Settings (credits) and on the terms page.
- **Built differently:** the look comes from the monster's number, not from its spawn place (the number is what every device shares). The textured Big arm look is not tinted. The Spike Beast walks on two legs as before (its model has two). A monster hit while its file is still loading shows no flinch.
- Guide and release notes. Tests: `monsters.test.mjs` and one browser test (looks, facing within 15 degrees over 12 seconds of walking, walk speed, flinch, fall).
- Checked: syntax, fast tests, the new browser test, the older Imp and Spike Beast bones test, life bar and shared-defeat tests, and one picture of six looks beside the character in the workspace's Chrome. **Not checked:** every look by eye; the frame rate on the test phone; two devices; played by Nick. Five older fight tests (sword tap, fireball tap, sword reach, guards' bodies) fail the same way on 0.6.89.

## 0.6.95: Dragons land everywhere and eat fish (SPEC-036)
Built from the PM hand-off SPEC-036 version 2 (approved by Nick 24 Nov 2026, ready to build), straight after SPEC-033.
- **Resting:** a dragon glides down and rests for 10 to 40 seconds on the solid top of blocks with open sky and room around: castle towers, walls and roofs first, then bridges, then hill and mountain tops and open ground, in land already made near a player. It looks around, then takes off. No block is ever changed.
- **Fishing:** over water at least 2 blocks deep a dragon dives, skims the water for a second and a half (a splash), flies off with a small fish in its claws (made in code: silver, blue or orange), lands on a perch or the shore within 40 blocks and eats it. There are no fish in the water and nothing is saved about fish.
- **Taking turns:** trees, rests and fish take turns, one landing about every minute or two, so each happens about every 3 to 5 minutes. Trees next to castles may now be eaten (not inside one).
- **Landing distance:** never closer to any player than the owner's distance: 3 blocks to start, 3 to 30 in the admin card "Dragons (owner only)" (`dragon_gap`, added to migration 0018, still not applied). It replaces the 8-block rule for trees too. A player who walks within 2 blocks of a resting dragon makes it take off within about 3 seconds.
- **Stay high:** no dragon lands anywhere. **Shared worlds:** the picking device sends each landing (a place, a time, what for, how long) on the world's channel like a tree being eaten; the others draw the same thing.
- Record `dragon_landed` now says what for: tree, rest or fish. Test switch `?dragonland=castle`, `bridge`, `peak` or `fish`.
- **Built differently:** a tree is eaten about every 3 to 5 minutes (it was every 2 to 4), because the three kinds of landing share one turn. A resting dragon only looks around (no scratching or stretching clip). It takes off straight back to its path, not away from the player. A player who joins a shared world during a rest sees that dragon flying until its next landing. Babies do not get a share of the fish.
- Guide and release notes. Tests: one browser test (rest, fish catch, facing, the perch) and a fast test.
- Checked: syntax, fast tests, the dragon browser tests. **Not checked:** seen in the game; two devices; the frame rate on the test phone; played by Nick.

## 0.6.94: Dragons that fly like real dragons, every one different (SPEC-033)
Built from the PM hand-off SPEC-033 version 4 (approved by Nick 24 Nov 2026, ready to build).
- **Three animated dragon models** (Quaternius, CC0, delivered by the PM; SHA-256 checked against the hand-off): a small quick one, a long-tailed one and a big soaring one, plus families (a grown dragon with 1 or 2 babies close behind and beside it). The code-made dragon of 0.6.81 is gone. Files load only when a dragon of that kind is first near; until then it is not drawn. 798 KB in all, none over 600 KB.
- **Every dragon is made from the seed and its square:** kind (by the owner's weights: 45, 30, 15, 10 to start), size (80 to 125 percent), neck, tail and wing length (each up to 15 percent longer or shorter, by scaling bones), body and belly colours from eight friendly pairs, rare gold, silver or pearl (5 in 100 to start), its speed, wing beat, share of gliding and how loopy its path is.
- **Flying:** each path is a smooth wandering loop about 40 to 90 blocks across (some fly a figure-eight) with climbs and dives of up to 8 blocks. The dragon always faces the way it moves, worked out from its own path (the 0.6.81 dragons faced the right way only twice a lap). It leans into turns (at most 35 degrees), tips its nose up or down (at most 25), beats its wings to climb, take off and slow down, and glides with spread wings otherwise.
- **Landing to eat** (SPEC-022 timings unchanged): it glides in on a curve, slows, lifts its nose and beats its wings, sits on the ground facing the tree, eats (the model's own mouth clip), then takes off slowly at first. Babies land beside their parent.
- **Fixed:** the numbers a dragon was made from were the same for a square and the square opposite it across the middle of the world, which made twin dragons. Dragons now use their own numbering.
- **Owner:** new admin card "Dragons (owner only)": a name for each kind (for the owner only; no dragon name is shown to players), rarity 0 to 100, rare colours in 100. `docs/migrations/0018_dragons.sql` (five game settings and an owner-only names table; **not applied yet**: waits for Nick's yes; the game uses the starting weights until then).
- Test switches: `?dragon=drake`, `wyvern`, `great`, `family` or `rare`.
- Record: `dragon_landed` (kind and "tree", at most once a minute; approved 24 Nov 2026), in `docs/EVENTS.md`.
- **Built differently:** no markings (stripes or spots): the models have plain colour materials. No separate wing colour for the same reason. Wings are held down while sitting (no folding clip). The admin card has no small pictures of the kinds. No hover before landing.
- Guide (the Dragons lines), release notes, `docs/ASSETS.md`, licence copies.
- Tests: `dragons.test.mjs` (files, no names shown, settings) and 2 browser tests (facing within 10 degrees over two minutes for 12 dragons of each kind, lean and tip limits, weights over 2,600 squares, rare colours, no two alike near the start; the landing).
- Checked: syntax, fast tests, the browser tests, and the three models seen from the side in the workspace's Chrome (they face the way they move). **Not checked:** how they look in the game sky; the frame rate on the test phone; two devices; played by Nick.

## 0.6.93: Mirelo, the wandering mage (SPEC-028)
Built from the PM hand-off SPEC-028 version 2 (approved by Nick 23 Nov 2026, ready to build), fourth in Nick's build order.
- **The lesson:** at Fighting level 2 the "Magic unlocked!" panel no longer opens by itself. Mirelo walks in from out of sight with a "!" and his name. Tap him: *Show me* or *Not now*. He casts at a glowing target (not a block: it cannot be dug or picked up), the Spell button gets a pulsing ring, and when the child's fireball reaches the target the skill panel opens with "Fireball is yours!". A tap on the target sends the fireball to it; on a computer, point and press F.
- **Never stuck:** after the second *Not now*, or the owner's minutes of play from level 2 (5 to start), the fireball unlocks with "Magic unlocked!" as before, and Mirelo later says "I see you found your magic!". A child who already had the fireball keeps it and hears "I see you already know Fireball! Here is a secret:".
- **Tip visits:** about every 15 minutes of play he comes, stays about 3 minutes and walks along 2 to 4 blocks behind the child (faster to catch up, never teleporting; he waits at water, caves and steep climbs, and moves to the far side of the child from a monster). One tip per visit, in order the first time through, then at random. *Come back later* keeps him away for 24 hours of real time (kept in the saved game).
- **Owner settings:** new admin card "Mirelo (owner only)" with the five timings; `docs/migrations/0017_mirelo_settings.sql` (**not applied yet**: waits for Nick's yes; the game uses the starting values until then).
- **Settings:** new switch *Tips from Mirelo* (kept on the device). Off: no tip visits; the lesson still happens once.
- Fixed text only: every line is in the game's code; nothing is sent or logged; no line mentions buying anything (a test reads every line). Saved in the game save: lesson state, tips shown, the *Come back later* time.
- Shared worlds: the other players see Mirelo where he is with a child (as they see quiz friends); he does not come to a second child while he is with another.
- **Built differently:** Mirelo is not walking the world all the time. He walks in from about 15 blocks away when he comes and walks off when he leaves, so he is not seen in the distance between visits and does not follow roads. A monster during the lesson does not pause it: he steps behind the child and the target stays.
- Guide: new part 3 "Mirelo, the wandering mage", the Magic part and the Settings part. Release notes.
- Tests: `mirelo.test.mjs` (lines, no sales talk, nothing sent, timings, rules) and 2 browser tests (the lesson; fallback, tips, following, away, switch).
- Checked: syntax, fast tests, the 2 browser tests and the Vital, quiz friend and fireball browser tests. **Not checked:** the 2-frames cost on the test phone; two devices in one world; played by Nick.

## 0.6.92: Delete my data (SPEC-010)
Built from the PM hand-off SPEC-010 version 2 (approved by Nick 25 Nov 2026, ready to build), third in Nick's build order. First written as 0.6.70 on the branch `claude/0.6.70-delete-my-data` (18 Nov 2026, never on main); brought onto the current game.
- **Settings:** *Delete my data* above Quit, for grown-ups. A list of what is deleted and what is not, then three confirmations on three screens (tap; hold 3 seconds; type DELETE). Cancel on every screen; Esc and Back cancel.
- **No parent signed in:** the device is cleared after the third confirmation. No email is asked for or sent.
- **Parent signed in:** a 6-digit code goes to the sign-in address (15 minutes, five wrong codes cancel). Then the cloud save and the parent account are deleted by the server function `delete-my-data` (deployed 18 Nov 2026, now in `docs/functions/delete-my-data/`), the device is cleared and signed out.
- **New with SPEC-038:** the reports the device sent are deleted online too. Each report gets a random key that only the sending device keeps (`docs/migrations/0016_report_keys.sql`, **not applied yet**: waits for Nick's yes; until then reports are not deleted this way).
- **A grown-up's Playing together Off stays** after a deletion (a parental control, not a record of anyone), so a child cannot get round it by deleting.
- **Website:** new page `/delete-my-data.html` in the site's look: sign in with an email code, the same three confirmations and code. The privacy page's "How to delete your data" points to it.
- Guide (Settings part and For grown-ups), release notes, privacy page.
- **Built differently:** no "the deletion is done" email (the sign-in service cannot send one; a new email service would be a new company receiving the address). The code email is the ordinary sign-in code email until its wording is changed in Supabase. "Parent links" do not exist in the database.
- The only text boxes in the game are here (the word DELETE and the code); the events test now checks that there are no others and that nothing typed is recorded.
- Tests: 4 browser tests and `delete-my-data.test.mjs` (server rules, page, guide, privacy).
- Checked: syntax, all fast tests, the 4 browser tests. **Not checked:** a real email, sign-in or deletion; the website page's steps against the server; any phone; played by Nick.

## 0.6.91: Report anything that looks wrong (SPEC-038)
Built from the PM hand-off SPEC-038 version 3 (approved by Nick 24 Nov 2026, ready to build), second in Nick's build order of 25 Nov 2026.
- **Report in Settings:** in a shared world only, a red *Report something wrong* button near the top of Settings. Taps only, buttons at least 48 px: what it is about (*Something someone built*, *A player*, *Something else*), for a player their game-made name, then what is wrong (*Rude or mean*, *Scary*, *Not right*). Every report ends with "Thank you! A grown-up will look at it. If something upset you, tell a grown-up you trust."
- **What a report sends** (database function `report_add`): kind and category; a build's world code, place (the block in the middle of the screen), direction looked and how many blocks differ from the seed's land in the 32 by 32 box; a player's visit code; an AI line's number; this visit code. No name, picture or typing. At most 5 in 10 minutes (on the device and on the server); then "Thanks, we have your reports" and nothing is sent. A report with no internet waits and is tried again every 30 seconds during the visit.
- **Hide a player:** after reporting a player, "Hide this player?" Yes: their character, name tag, map dot and name in the log and Powers are hidden on this device until the child leaves the world. Their blocks stay.
- **AI lines:** the flag button and its rule (report, hide the line on this device, "Thank you! A grown-up will check it.") are in the game, ready for SPEC-037 and SPEC-027; no AI text exists yet.
- **Parent area:** "Reports sent from this game" (date, category, what about), kept on this device only.
- **Admin page:** new card "Reports (owner only)": open count, reports per day for 30 days, by kind and by category, then the list (newest first) with how many reports point at the same thing. Actions: mark done; *Put the land back* for a build (the games in that world rebuild the box from the seed as ordinary block changes, once, kept in the world record); *Stop multiplayer* for a player (1, 7 or 30 days, or until lifted) and *Lift*; keep period in months (12 to start). Removing AI lines comes with SPEC-037.
- **Stop multiplayer:** the game asks the server (`mp_stop_until`) before joining or sharing a world, once a minute in a shared world, and at once when the owner's page says so on the world's channel. Then it leaves like Playing together Off, with "Playing together is turned off for now.", and cannot join or share until it ends. The parent's switch is not changed.
- **Database:** `docs/migrations/0015_reports.sql` (reports, keep period, stop list, land restores). Applied to the live database on 25 Nov 2026 after Nick's yes; checked there: a game can add a report but cannot read reports, the stop list or the land list.
- **Records:** `report_sent`, `player_hidden`, `multiplayer_stopped` (approved 24 Nov 2026) and the database functions in `docs/EVENTS.md`. Privacy page: new rows "Reports" and "Playing together choice", keep period, deletion; Last updated 25 November 2026.
- Guide: new part "Reporting and hiding" (group "With others") and a Reports row for grown-ups. Release notes.
- Tests: 3 browser tests and a fast test of the database rules and the fields sent.
- Checked: syntax, all fast tests, the 7 SPEC-038 and SPEC-039 browser tests and nearby browser tests. **Not checked:** played by Nick; two devices in one world; the database rules on the live database (not applied); the owner card against real reports; any phone or the Android app.

## 0.6.90: Playing together, safely (SPEC-039)
Built from the PM hand-off SPEC-039 version 8 (approved by Nick 24 Nov 2026, ready to build), first in Nick's build order of 25 Nov 2026.
- **Parent switch:** a new part *Playing together: On / Off* in the parent area (On to start). Only a grown-up signed in with Google there can change it; Facebook alone does not unlock it, and without Google the buttons are greyed with "Connect your Google account to change this". Kept with the saved game (and its cloud save), and on this device for the next new game, so a new game cannot get round it.
- **Off:** within 5 seconds (at once when changed on the device) the game saves, leaves the world's live channel, clears the world code and keeps the land as a world on this device only. The Activity log says "A grown-up turned off playing together." The start wizard offers no joining (the Join button is greyed with the same words) and a new world stays on the device with no code. Reopening such a game opens it as it is (before, a game with no world code opened the start wizard).
- **Joining card:** the first time a shared world would start on this device (a new world, joining with a code, or reopening a shared game), a *Playing together* card with the five safety lines. OK appears after 4 seconds; Esc and the Android Back button do not skip it. Kept on the device only.
- **Loading screen:** one of five safety lines under "Loading...", the next one each time the game opens (kept on the device).
- **Reopening a shared game:** rejoins the same code at the saved place (0.6.87 rule, unchanged). New: with no internet the child plays on the device's copy with "Can't reach your shared world. Playing on your own until it's back.", the game tries again every 30 seconds (also loading the Supabase library again), then loads the others' changes and joins. Nothing is uploaded over the shared world while it waits.
- **Google only:** the Sign in with Facebook button is hidden in the parent area (kept in the code). The top button reads *Open parent portal*.
- **Terms of Use:** new opening for parents (children are not asked to agree to anything), new part "Playing together in shared worlds", Last updated 25 November 2026. The "Text written by AI" part waits for SPEC-037.
- **Guide and privacy page:** "parent portal" everywhere; new lines in part 17 and a Playing together row in part 20 (the teacher email code is marked "once the teacher sign-in opens"); no Facebook sign-in.
- **Records:** new kinds `together_switch` (on, off) and `safety_reminder` (shown, closed), approved by Nick 24 Nov 2026, in `docs/EVENTS.md` under "Gameplay records" (no change to the privacy page needed). `world_left` is also sent when Off makes the device leave.
- Tests: 4 browser tests (card, loading line, switch and Off, no internet) and a fast test in `players-together.test.mjs`; the test page counts the card as seen unless a test asks for it; old checks for "Open parent stats", Facebook and the terms date updated.
- Checked: syntax check, all fast tests, the SPEC-039 browser tests and the browser tests listed in `docs/VERSIONS.md`. **Not checked:** played by Nick; two real devices in one world; any phone or the Android app; a real Google sign-in (the tests stand in for it).

## 0.6.89: Game tips go in the Activity log
Reported by Nick in the build chat on 24 Nov 2026 ("the 'too far' message shows on the screen and not in the activity log"). He chose to move every short hint to the log and to build it now.
- Every short game message (`say()`: "Too far away! Get closer.", "+1 gem!", "Picked up ...", power ups, monster hits, and so on) now goes into the Activity log instead of the line across the top of the screen. It shows beside the speech bubble for at least 3 seconds (up to 3 lines), and stays in the log with its time. The top line (`#msg`) is gone.
- Hints do not raise the red unread count: that stays for friends joining or leaving. The same hint again within 15 seconds adds to the last line ("x3") instead of a new line. Hints said while the game is still starting wait and go into the log once it is ready.
- Nothing new is recorded or sent: the log is still kept in memory for this visit only.
- Guide and What is new updated. Tests: a static test in `players-together.test.mjs`, a browser check in the 0.6.87 log test; the dragon test and `site-shots.mjs` no longer read the old top line.
- Checked: syntax check, fast tests. **Not checked:** played by Nick, any phone or the Android app.

## 0.6.88: Share the game (SPEC-030), the Activity log (SPEC-031), a new website (SPEC-012 to SPEC-015) and a page for teachers (SPEC-032)
Built from the PM hand-offs marked ready to build on 23 Nov 2026, at Nick's request ("ok build all the specs please"). SPEC-029 (the store) was not built: its dependencies are not built yet.
- **SPEC-012 One look for the whole website:** one shared style file `www/site.css` (colours from the logo, 18 px text on a computer and 17 px on a phone, dark mode that follows the device, focus outlines, no motion when the device asks for less). The same top bar (logo, How to play, What is new, Contact, Play; a Menu button on a phone that works without a script) and footer on every page, written by `scripts/site-pages.mjs`. The release notes page is called "What is new" everywhere (address unchanged). Privacy and Terms keep their words.
- **SPEC-013 New home page:** the first screen with Play now, four boxes, "Learn while playing", parents and teachers in control, private worlds, teachers and schools "Coming soon", what grown-ups control, and the three newest versions from the game's own list. Seven pictures of the game, taken by the new `scripts/site-shots.mjs` from a test game. Left out until true: Mirelo's sentence (SPEC-028), the teachers' own questions label (teacher portal), the Google Play badge (until the game is public; `PLAY_PUBLIC` in `scripts/site-pages.mjs`).
- **SPEC-014 Guide:** four groups kept in one place in the guide's source; a list that stays in view on a computer and a "Jump to a part" box on a phone, both made from it; every part in its own box with "Back to top"; the grown-ups part marked; controls pictures for a phone and a computer with the buttons named.
- **SPEC-015:** tab icons from the app icon, a link preview picture from the logo and preview tags on the six pages, and a page-not-found page (`www/404.html`).
- **SPEC-031 Activity log:** the panel of who joined and left is headed "Activity log", its button says "Activity log", and the 0.6.87 title says "an activity log". Guide wording follows.
- **SPEC-030 Share the game:** a Share the game button in the parent area opens the device's own share window with fixed text and the home page address; this saved game gets the owner's share gems (500 to start) once. The parent stats page has the same button for a signed-in parent; a game signed in to that account in the parent area then gets the gems once. Owner card "Share reward (owner only)": on or off, number of gems. New gameplay record `share_reward`; new table `parent_shares` (migration 0013, **not applied yet**).
- **SPEC-032 For teachers and schools:** a page at `/teachers.html` (linked from the home page only) with a sign-up form checked by an emailed 6-digit code, the owner-only list in the admin page (count, table, CSV, delete, mailing address, test news email). The backend function `docs/functions/teacher-interest/index.ts` and migration 0014 are written but **not deployed or applied yet**: they wait for Nick's yes and the Gmail app password.
- Privacy page: new row "Share the game", new part "Teachers who ask to hear from us", Gmail added to the service providers (Nick reviews the words before release).
- Tests: new `scripts/tests/site-look.test.mjs` (24 tests), 2 browser tests for sharing; `site-pages.test.mjs` (Play badge rule), `quiz.test.mjs` and `vital.test.mjs` adjusted for the new table and the site's own address.
- Checked: see `docs/VERSIONS.md`. **Not checked:** played by Nick; any phone or the Android app (the Android share window needs the Capacitor Share plugin, not added yet: the app falls back to "Link copied"); the website path of sharing and the teacher form (they need migrations 0013 and 0014 and the backend function).
## 0.6.87: Playing together: no more starting in the ground, a world log, a player count and a map
Reported and asked for by Nicola in the build chat on 23 Nov 2026: "I spawned in the ground of the world", and asked for a little box saying when someone joins, a count of players at the top left, and a small map (M on a computer, or a tap) showing where the players are. He chose "Build them now" rather than a PM hand-off first, then asked for the notes to be "a chat log style at bottom corner with a bubble that highlights so there is a track of it and it can be reviewed".
- **Fix: starting inside the ground.** Cause: *Join a friend's world* in the start wizard loaded the friend's land but left the character at the spot picked for a brand-new random world, so it was usually inside the friend's hills. Now the joined world's start point is used (`joinExisting(code, true)`, `placeSafely`). When a saved game reopens its shared world, or the world is read again from the server every 30 seconds, the character stays where it is unless blocks are in the way; then it is lifted onto the land (or, if that is not possible, taken to the start point)
- **World log:** a speech bubble at the bottom left (above the stick when the on-screen controls are on). When a friend joins or leaves it lights up (yellow glow) with a red count of notes not read yet, and the newest note shows beside it for 5 seconds. A tap opens the log: every note of this visit with its time ("11:42 Sir Kestrel 4 joined your world"), newest at the bottom, at most 50. The bubble, the close button or Esc closes it. Kept in memory only: not saved and not sent. It is not a chat: only the game's own notes, with names checked (below)
- **Player count** at the top left in a shared world: *Players N*, the child included
- **Map:** M key or the new Map button (top bar). The land 48 blocks each way from the child, seen from above (only land already loaded: dark elsewhere), the child as a white dot, friends as yellow dots with their names, far friends on the edge. Tap the map, M or Esc closes it
- **Safer names:** other players' names (name tags, notes, map) are shown only if they are a name the game makes (a title, a name from the list, a number 1 to 999); anything else shows as "A player". Before, a changed copy of the game could have shown any text over its character's head
- **Tracking records (Nicola, 23 Nov 2026: "tracking data as a fundamental core feature for every feature ... for backtracking, accountability and traceability", "tracking is for safety reasons"):** new kinds in `game_events`: `world_entered`, `world_players`, `player_joined` and `player_left` (by the leading device only, with the other device's visit code), `world_left` (best effort when the page closes), `spawn_moved`, `map_opened` and `log_opened` (at most once a minute each, `logOnce`). Visit codes, world codes and counts only: never names or typed text. All kinds are listed in the new `docs/EVENTS.md`; the privacy page's "Gameplay records" row names every kind and gives safety as the reason (date 23 Nov 2026). New rule in `CLAUDE.md`: every feature records tracking events. New `scripts/tests/events.test.mjs` fails if a kind is missing from `docs/EVENTS.md` or the privacy page, or if a record carries a name
- The world's log itself is not saved or sent: it lives in memory on the device until the game closes
- Tests: new `scripts/tests/players-together.test.mjs` (6 tests), `scripts/tests/events.test.mjs` (3 tests) and one browser test ("0.6.87: the player count ..., the world's log bubble, and the map with M")
- Checked: see `docs/VERSIONS.md`. **Not checked:** played by the parent; two real devices in one shared world (the join notes and other players on the map); phones and the Android app
## 0.6.86: Real bridges, and no outline over cream and sandstone castles up close (bugs reported by Nick, 22 Nov 2026)
- **Castle walls flickered up close (bug).** Each castle also has a plain "far view" outline that is cut away inside the drawn land. The two wall colours added in 0.6.81 (cream Pale Stone and Sandstone) were missing from that cut, so for those castles the plain outline was drawn over the real blocks and the two fought for the same place on screen. Every outline material is cut now
- **Bridges too narrow (bug), and bridges like real ones.** Slanted bridges came out as a 1-block zigzag: the rails were placed step by step across the road and landed on the deck. Now each column is laid once, by its distance from the road's middle line, and where two roads' bridges meet the deck wins over a rail. Each bridge span gets a kind from its length, its road and the seed: **plank** footbridge on posts (lanes, short spans, 3 wide), **stone arch** bridge with a cobbled deck, stone parapets and arches between piers every 8 blocks (3 wide on lanes, 5 on main roads), **long** timber bridge for spans over 40 blocks with stone towers and a beam over the deck at each end and every 24 blocks (4 wide on lanes, 6 on main roads). Gaps of 1 or 2 blocks between bridge parts are joined into one span. Bridges come from the seed only: nothing new is saved or sent. In land a player changed, bridge blocks still only fill air or water (an old wooden bridge there stays as it was)
- Tests: 2 new tests in `scripts/tests/castles-roads.test.mjs` (bridge kinds and widths on 4 seeds, the deck a full band with room to walk and no rail on it; every outline material cut); the SPEC-023 bridge test accepts a cobbled deck
- Checked: syntax check and the fast tests in the cloud workspace. **Not checked:** the browser tests, anything on a phone, played by the parent

## 0.6.85: Guards tidy up after a fight
Fix for what Nicola showed in the build chat on 23 Nov 2026 (a screenshot of a road): "the guard who follow the merchants defeated a bunch of monsters. and they are just staying there." He said "push and go live".
- **Cause:** a monster the guards defeated was laid down like one the child defeats, and every body stays 5 minutes before it sinks. Guards fight all along the roads, so the roads filled up with bodies, even though the game says the guards "drove off" the monster.
- **Change:** a monster defeated by guards lies for 3 seconds (while a guard collects what it dropped), then sinks into the ground over 3 seconds. In a shared world every device does the same. Monsters the child defeats still stay 5 minutes, as before. No change to saves or the data the game collects.
- Tests: new browser test "0.6.85: a monster the guards defeat sinks away after a few seconds".
- Checked: syntax check and the fast tests in the cloud workspace. **Not checked:** the browser test (needs Chromium), on a phone, played by the parent.

## 0.6.84: Log off
Bug reported by Nicola in the build chat on 23 Nov 2026: once in a game you could not log off and change world; he asked for a Log off button next to Quit that goes back to the menu, and said "Push it online once developed".
- **Log off** button (orange) in the quit question, between *Save and quit* and *Keep playing*. It saves the game, stops the sound, sets this tab's choice to `menu` and reloads, so the game opens on the start menu (Load my game, Start a new game, All my saved games). Because the choice is not empty, *Load my game by itself* (0.6.83) does not reopen the same game. Esc, the Android Back button and *Quit the game* in Settings all open the same question. No change to saves, worlds or the data the game collects
- Tests: two new browser tests in `scripts/tests/browser.test.mjs` (Log off saves and shows the start menu; with Load my game by itself on, Log off still shows the menu)
- Checked: syntax check and the fast tests in the cloud workspace. **Not checked:** the browser tests (the cloud workspace cannot load the game's 3D library), played by the parent in a browser or the Android app

## 0.6.83: A castle loading screen and a quicker start
Asked for by Nicola in the build chat on 23 Nov 2026: a small loading screen "to help with the update", a castle "like the game's castle", shown "every time the game opens in case there are updates"; and a start menu with "start a new game or load a game with a checkbox that lets it auto load if checked". He approved the drawings and said "push it to the main".
- **Loading screen:** shown each time the game opens, before the game's code starts: an original block castle (castle stone, red and blue roof tiles, moat and bridge, flags) on an evening sky, the game's name, a filling bar and "Loading...". It goes away (fading) once the game has drawn its first picture and the first Google Play new-version check is done (Google Play answers within 5 seconds or is passed over), shown for at least 1.2 seconds. A new version found by that check is offered straight after. It lets taps through and removes itself after 20 seconds if the game's code never starts. Not shown when the game comes back from the background. Picture: `www/splash/castle.png` (23 KB), drawn by `scripts/splash-castle.py`
- **Start menu:** two big buttons, **Load my game** (the saved game played last, by save time) and **Start a new game**, and the tick box **Load my game by itself next time** (unticked at first). Every saved game is still there, folded under "All my saved games", with Play and Delete
- **Load my game by itself:** when on, the game opens the save played last with no menu. Also a switch in Settings (so the menu can be brought back). Kept on the device only (`kidsgame.autoLoad`); nothing is sent anywhere, no change to the data the game collects
- Tests: new `scripts/tests/start-screen.test.mjs` (11 tests) and two browser tests ("0.6.83 start menu", "0.6.83 with Load my game by itself on")
- Checked: syntax check and the fast tests in the cloud workspace. **Not checked:** on a phone, in the Android app, with a real Google Play update, played by the parent

## 0.6.82: Castles without flicker
Fix asked for by Nicola in the build chat on 23 Nov 2026 ("yeh lets fix this looks strange"), after he showed the castle flickering in the live game.
- **Cause:** block textures (16 by 16 pictures) were shrunk for distance with nearest-pixel picking and no mipmaps. A far-away block covers a pixel or two on screen, so which dot of the picture showed changed with the smallest camera movement: castle windows and stone lines blinked, and up close with a still camera the wall showed frozen pale smudges
- **Fix:** `makeTex` keeps sharp pixels up close (`magFilter` Nearest) and uses mipmaps far away (`minFilter` LinearMipmapLinear, `generateMipmaps`). Every block texture is listed (`blockTextures`) and gets anisotropy once the renderer exists (the device's maximum, at most 4), so walls seen at a slant stay clear. No change to the land, castles, saves or data
- Tests: new `scripts/tests/textures.test.mjs` (6 tests: sharp up close, mipmaps far away, power-of-two size, anisotropy after the renderer, no nearest minification anywhere)
- Checked: syntax check and the fast tests in the cloud workspace. **Not checked:** how it looks in a browser or on a phone (the cloud workspace cannot load the game's 3D library), frame rate on older phones, played by the parent

## 0.6.81: Grand castles, roads, guards, dragons and shared worlds (SPEC-020 v4, SPEC-021 v3, SPEC-022 v4, SPEC-023 v3, SPEC-024 v2)
Built from the PM's hand-offs approved by Nicola on 22 Nov 2026; Nicola said "go ahead 019-024 all good" in the build chat. SPEC-019 was already built in 0.6.80.
- **Castles (SPEC-020), land-maker 3.** Three styles (fortress, fairy-tale, palace) and mixes between them, picked from the seed (the land leans it: a moat, fortress; uneven land, fairy-tale on a stone rock; great castles, palace). Each castle picks its wall colour (grey, cream, sandstone), roof colour (red, blue, slate) and tower shapes (round, square, eight-sided). Every castle: a dark stone base course, framed windows on every floor of the walls, towers and keep, pointed roofs on the keep (hipped, or gables in sections with dormers) and every tower (fairy-tale spires with a needle tip), a gatehouse with two towers, an arch and a raised iron portcullis, battlements that stick out over the walls, four turrets on the keep's corners, gold balls and flags on the spires. Courtyards: a cobbled path, lawns with hedges and flower beds, a long pool or a fountain. Rooms furnished (great hall with long tables, benches, a fireplace and banners; bedrooms, library, kitchen, store room; chests in the treasure room; a table and chest in each tower top). Same place, size, floor, slope and moat as before. Six new blocks: Pale Stone, Sandstone, Dark Stone, Slate Roof, Window, Iron Bars. Merchants each sell one of them (10 for 3 gems; 6 windows or iron bars for 3 gems)
- **Old worlds, castle by castle:** the first time a world opens in 0.6.81, castles touching a chunk the player had changed keep the old look for good (in a world from before 0.6.76 no castle is built there); every other castle is new. Worlds from before 0.6.76 get castles (at the standard spacing of 500) and roads, but no caves. The list travels with the world (`maker: 3`, `oldCastles`, `roaded` in the world record)
- **Roads (SPEC-023):** every castle is joined (a relative neighbourhood graph of all castles in the playable land, 1 to 4 roads each, never a castle cut off); each road finds its way with a search that prefers gentle slopes and valleys and wanders a little, is smoothed into curves and levelled to at most 1 block up for 2 along. Main roads between busy castles: cobbled, 3 wide; lanes: packed earth, 2 wide. Wooden bridges with rails and posts over water and gaps deeper than 4. Two new blocks: Cobblestone and Packed Earth. In land a player changed, roads only fill air and water or replace grass, dirt, sand or snow, once. Signposts at each gate with one arrow and a castle picture per road (no words). Merchants ride the roads (2 carts on main roads, 1 on lanes)
- **Merchant guards (SPEC-021):** guards by the worth of the goods (steps 30, 40, 50, 58, most 4, set in the admin page; steps 5 and 6 at +8). Foot guards (the cart slows to 2.5 blocks a second), riders on original code-made horses and hover sleds, a lookout, a captain on a disc with a banner. They fight monsters within 8 blocks of the cart (never more than 12 from it), the cart waits, a guard collects what drops in about 2 seconds (the child cannot take it). They face the child and say a fixed line; tapping one opens the trades; sword and fireball pass through them
- **Dragons (SPEC-022):** 1 to 3 friendly dragons made in code fly 25 to 40 blocks over the land (higher over castles), from the seed and a shared clock. About every 3 minutes (2 to 4) one comes down beside a tree 15 to 60 blocks away, never within 8 blocks of a child or by a castle, eats it (a stump; leaves fly; the dig sound as munching), sits, and flies off. The first time: "Look! A dragon is eating a tree!". Trees grow back after 1 or 2 days (a young tree the next day), kept in the world record (`eaten`: place, day eaten, day back; dates only; at most 500). Parent area: **Dragons** On / Stay high / Off, kept with the saved game
- **Shared worlds (SPEC-024):** the first device in a shared world leads (by when it joined; one quiet for 4 seconds is passed over): it runs the monsters, the carts and guards, fights, drops and dragons' meals and sends them about 3 times a second (`ws`, `hit`, `defeat`, `drop`, `pick`, `taken`, `drops`, `snapreq`, `snap`, `eat`). Villagers and dragons' flights come from the shared clock. Any child can hit any monster; gems from a shared fight are split equally among the children who hit it in its last 30 seconds (the odd gem to the last hitter); a child more than 16 blocks away finds the share on the ground. Monster parts drop for whoever picks them up first; exactly one child gets a thing. Quiz friends and Vital are seen by everyone as characters (kind, place, turn); tapping another child's quiz friend gives this child its own question. A cart stops for any child and waits while any child trades. Alone, the game plays as before
- **Admin page:** new cards "Merchant prices (owner only)", "Merchant traffic (owner only)" and "Merchant guards (owner only)". Settings in `game_settings` (migration `docs/migrations/0012_merchant_settings.sql`, **applied to the live database on 22 Nov 2026** with Nicola's yes in chat): `carts_max`, `guard_max`, `guard_step1` to `4`, and one row per price (`mp_<thing>`, `ms_<thing>`, `mp_parts`: gems x 100 + amount). The game reads them when it opens and keeps the last values on the device (`kidsgame.ownerSettings`)
- **Fixes on the way:** blocks of kinds 5 to 11 (castle blocks) were not shared in shared worlds (the live channel accepted only kinds 0 to 4); now every kind is. Player positions are sent twice a second instead of five times (the free plan allows 20 presence messages a second for the whole project)
- **Privacy page:** rows for the shared world's game things, eaten trees and the Dragons choice; the world record row mentions the castle list, roads and the owner's merchant settings. Nothing about any child is collected or sent
- **Built differently from the specs:** (1) the world record keeps `gen` 1 or 2 and adds `maker: 3`, instead of a land-maker number 3, so a device still on an older version (the Play app is at 0.6.76) reads the same land and caves and does not turn the world back into land-maker 1; (2) merchant prices are one row per thing (the table holds whole numbers only), not one row `merchant_prices`; (3) cave mouths in land-maker 3 keep 5 blocks from roads (roads are not routed round caves: working out every cave on a road's way took seconds); in a world from 0.6.76 to 0.6.80, a cave mouth by a new road is gone in land nobody changed; (4) every merchant sells a 7th thing (one new castle block), which adds 3 gems to its worth for guards; (5) power points from a shared fight are split too (2 shared by the hitters, at least 1 each); (6) the guards' lines show after the merchant's greeting
- Tests: new `scripts/tests/castles-roads.test.mjs` (10 tests: styles, neighbours differ, details, new blocks, old worlds castle by castle, worlds before 0.6.76, connected roads on 3 seeds and 2 spacings, road slopes, bridges and curves, roads in old worlds never replace a child's blocks, eaten trees and regrowth); `caves-castles.test.mjs` updated (old worlds now get castles; the main building's height counts its roof); `quiz.test.mjs` and `vital.test.mjs` updated (the friend is sent as a character only, never its questions or tips); 6 new browser tests ("0.6.81", "SPEC-020", "SPEC-021" twice, "SPEC-022", "SPEC-024")
- Checked: syntax check; the fast tests; the 6 new browser tests and the start test in the cloud workspace (software drawing); chunk making in a great castle 1.09 to 1.25 times land-maker 2 (limit 1.5); a road's way about 50 ms to work out. **Not checked:** anything on a phone (frame rates, the 30 frames a second in a great courtyard, carts on screen at 30 frames: carts_max stays at 6 until measured), two or three real devices in a shared world (leader hand-over, dropped connection, picking up at the same time), the admin cards' Save with the owner's account, played by the parent

## 0.6.80: The game offers each new version (SPEC-019 version 3)
Built from the PM's SPEC-019 version 3, approved by Nicola in the build chat on 22 Nov 2026 ("ready to build it's approved").
- **Android app only.** When the game opens, and each time it comes back from the background, it asks Google Play whether there is a newer version (Google Play's in-app update, through the plugin `@capawesome/capacitor-app-update` 8.1, MIT)
- **Within the limit:** Google Play's own small window offers the update. The download runs while the child plays; then a green **Restart to get the new version** button appears at the top. Tapping it saves the game (and the cloud save if a parent is connected) and Google Play installs the new version and reopens the game. Opened again with the download waiting, the button reads **Restart now**. Closing Google's window: play the old version; the window comes back the next time the game opens
- **Past the limit:** the game saves, then Google Play's full-screen update page shows before play. Closing it shows "A new version is needed to keep playing." with Update and Quit; the old version cannot be played, and Google's page is never reopened by itself. A failed save shows "Could not save. Try again" and waits
- Never during a fight (5 seconds after the last hit), a quiz, Vital's tips, a menu or the parent area
- **Limit set in the admin page:** new card "Forced update (owner only)", 0 to 180 days (30 to start; 0 forces every new version at once), with the current value and the date it was last changed. Kept in `game_settings` as `force_update_days` (migration `docs/migrations/0011_force_update_days.sql`, same rules as `castle_gap`). The game reads it when it opens and keeps the last value on the device (`kidsgame.forceUpdateDays`); without the internet, or before the migration is applied: 30
- Settings shows "Up to date" or "New version ready" under the version number, or nothing when it cannot be checked (website, no internet, not installed from Google Play)
- No Play Store button or link in the game. No change to the release script
- **Data:** nothing about the player is collected or sent; only the setting is read. **Migration 0011 is not applied to the live database yet**
- Tests: new `scripts/tests/app-update.test.mjs` (19 tests: the game's update code run against a pretend Google Play) and one browser test ("SPEC-019")
- Checked: syntax check of the game and the admin page; the fast tests; the SPEC-019 browser test in the cloud workspace. Not checked: a real phone with two builds on the internal test track (done-when 1, 2, 5); the admin card's Save; that the app builds with the plugin (it is built on the laptop); played by the parent

## 0.6.79: Quiz badges easy to find
Nicola played 0.6.78 on 22 Nov 2026: Play again and the merchants work, but he could not find the badges. In 0.6.78 they were one small grey line of text near the bottom of the Powers panel.
- The Powers panel now opens with a **Quiz badges** section right under the player's name: five big stars, lit when earned and grey when not, each with its number of right answers (the milestones set in the admin page), and a line such as "7 right answers so far. Next badge at 25."
- Nothing else changes: same milestones, same counts, nothing new saved or sent
- Tests: the 0.6.78 browser test now checks the section is right under the name, needs no scrolling, has 40-pixel stars, and lights the right number of them
- Checked: syntax check, the fast tests, that browser test in the cloud workspace. Not checked: played by the parent
- **Admin page sign-in** (bug reported by Nicola on 22 Nov 2026): the sign-in email held only a link, no code, and the link opened the home page. Supabase's free plan sends its standard email, which can't be edited without a custom email server. The admin page now asks for the link to come back to the admin page, which signs in when it opens. The code box still works if an email ever carries a code. Commit 2f9ec6b, with a release check for it. Checked: syntax check of the admin page, the fast tests. Not checked: a real sign-in by the parent

## 0.6.78: Play again, quiz badges, merchants on the move
Two bugs reported by Nicola on 20 Nov 2026 after playing 0.6.77, and his answers to the question about gems. Not from a PM hand-off.
- **Quiz: no chance to play another.** Before, 1.3 seconds after a right answer the panel closed by itself and the friend left. Now the panel stays open, with no timer, and shows two big buttons: **Play again** (a new question from the same friend, at the child's level) and **Done** (the panel closes and the friend waves and leaves). Esc and the Android Back button mean Done. Gems as usual for every question (5, or 2 after a wrong try or a hint), with no limit (Nicola's choice). Each new question gets its own two "Another question" swaps. After a friend has had a right answer, the next friend comes after a minute of moving about even if the last question was left with "Not now"
- **Quiz badges** (Nicola's request): a badge at the 1st, 5th, 25th, 100th and 500th right answer, maths and words together. A new badge shows in the question panel ("New badge: 25 right answers!"); the Powers panel shows how many are earned and how many right answers to the next one. The count comes from the quiz report counts the saved game already keeps: nothing new is saved about the child or sent. A child who already has right answers has the badges for them straight away
- **Milestones set in the admin page** (Nicola's request): new card "Quiz badges (owner only)" with five numbers, each bigger than the one before, from 1 to 100000. They are kept in `game_settings` as `quiz_m1` to `quiz_m5` (migration `docs/migrations/0010_quiz_badges.sql`, same rules as `castle_gap`: everyone reads, only the owner's account changes, nothing about any player). The game reads them when it opens and keeps the last ones on the device (`kidsgame.quizBadges`); without the internet or before the migration is applied it uses 1, 5, 25, 100, 500
- **Merchants stayed at a castle.** A cart stopped whenever the child was within 7 blocks and stayed stopped until the child was 11 blocks away. Every road ends at a castle gate, so a child playing near a castle kept the carts parked there for good (both carts in Nicola's screenshot showed the gem bubble, which means stopped). Now a stopped cart waits at most 20 seconds of play without a trade, says "The merchant waves and rides on." and goes on along its road; it stops for the child again only after the child has been more than 11 blocks from it. A cart with its trades open never leaves
- **Data:** no change to what is collected about children. The milestones are owner settings read from the database like the castle spacing. Migration 0010 was applied to the live database on 20 Nov 2026 at the parent's go-ahead: five rows, read by everyone, changed only by the owner's account
- Tests: two new browser tests (Play again, Done, Esc, gems, badges and the Powers row; a merchant riding on and stopping again); the quiz browser tests now tap Done where they used to wait for the panel to close by itself
- Checked: syntax check of the game and the admin page; the fast tests; the quiz and merchant browser tests in the cloud workspace (Chromium, no phone). Not checked: played by the parent; saving from the admin card (the rows are in the live database and readable; a save from the owner's account was not tried)

## 0.6.77: Busy castles and travelling merchants
Asked for by Nicola on 20 Nov 2026 after testing the castles on the phone ("its empty and looks like its floating at a distance ... also add merchants who go between castles in a landspeeder"). Not from a PM hand-off.
- **Far view fix.** A castle's far outline was hidden as soon as its nearest edge came within the drawn land (about 120 blocks), while most of a big castle was still past it: the far part vanished, and the land under it is not drawn there, so the castle looked cut off and floating. The outline is now cut at the edge of the drawn land instead (clipping planes), so the real blocks show inside it and the outline past it, with no gap. Each outline also stands on a plain hill in the colour of the land around it, down below the lowest ground, so it never hangs in the air
- **Life in the castles.** Courtyards of castles and great castles get a well, market stalls with striped awnings, goods and a keeper, barrels, crates, hay and hand carts with pumpkins, placed by rule from the castle's plan on open floor away from the gate path, stairs and towers (6 things in a castle, up to 16 in a great castle). Banners hang beside the keep's door (also on tower houses) and lanterns stand inside the gate. 2 villagers (5 in a great castle) walk between the stalls. Villagers are original simple shapes in four skin tones, with hats or hoods. They are made when a castle comes near and dropped when it is far; a spot where a player has dug or built is left empty. They are not solid: the character walks through them
- **Travelling merchants.** Each castle trades with its nearest neighbour castle. A merchant on a hover cart (an original design: a wooden cart with a striped canopy, crates and glowing hover pods; called a "hover cart" in the game, not by the film name "landspeeder") rides the road between their gates, going round any castle on the way, floats about a block over land and water, and waits 15 seconds at each gate. It stops when the child is within 7 blocks and a gem bubble shows over it; a tap within 9 blocks opens the trades
- **Trading.** Gems only: no real money, nothing leads outside the game. Every merchant buys all monster parts (1 gem each) and one kind of block (8 dirt, 6 stone or 6 castle stone for 1 gem), and sells four things picked for it: at least one piece of gear (pickaxe 4 gems, wooden sword 5, leather armour 8, iron sword 15, iron helmet 15, gold sword 30) and castle blocks (10 castle stone for 3 gems, 6 roof tiles or 8 wood floor for 2). A trade that would overfill the bag, or that the child cannot pay for, is refused with a message. The game stands still while the trades are open; Bye! or Back closes them
- **Land unchanged.** No block of any world changes: the land-maker is untouched (the castle plan only keeps its lowest ground height, for the hill in the far view). Worlds made since 0.6.76 get the courtyards and merchants at once
- **Data:** nothing new is saved or sent. Merchants and villagers are worked out on each device; in a shared world each player sees their own carts. Trades change only the bag, which is saved as before. No change to the privacy page
- Tests: new `scripts/tests/castle-life.test.mjs` (courtyard places on open floor with room above, clear of the gate path, the same every time; roads from gate to gate that never pass through a castle, the same after the world is made again); new browser test for trading in `browser.test.mjs`
- Checked: syntax check; the fast tests in the cloud workspace. Not checked: the browser tests (not run here); not seen in a browser or on a phone yet; frame rate near a great castle on the test phone

## Website, 17 Nov 2026: How to play guide and release notes (no change to the game)
- New page `/how-to-play.html`: a guide to every function of the game in 18 parts (starting, controls, quick bar and bag, digging, building, gems, a full bag, powers, monsters, gear, magic, water, the world, teleport, saving, friends, settings, parental controls). Facts were taken from the game's code at 0.6.62
- New page `/release-notes.html`: what changed in each version, newest first. It is written by `scripts/site-pages.mjs` from the same list the game shows in Settings, so the two cannot differ
- The home page links to both
- Rule for every later version: the guide and the release notes are updated in the same release (CLAUDE.md, "How to change the game"); `scripts/tests/site-pages.test.mjs` fails otherwise
- The guide's last part is for grown-ups: the parental controls, how to open the parent area and what each control does (the parent's decision, 17 Nov 2026). Neither page links outside the site
- No change to what data is collected: the pages are plain pages with no scripts
- Checked: the fast tests; the pages were looked at in a browser in the cloud workspace. Not checked: the parent has not read the guide against the game; a phone or tablet

## 0.6.76: First-person view, caves and castles (SPEC-016 parts E, F and G)
Built from "SPEC-016: Play test changes of 20 November 2026", version 4, parts E, F and G. Nicola approved the spec on 20 Nov 2026 ("build spec 016 approved", then "Do it complete all the parts") and asked for the three parts in one version and one Play build.
- **E, two views.** A View button (an eye) at the top right, beside Settings, and the V key switch between the view from behind and the view through the character's eyes, at once. Through the eyes the body is hidden and the item in hand shows at the bottom right. Dragging up and down looks up and down in both views, stopping at 80 degrees. No bobbing or shake. Reach is still measured from the character
- **E, the camera indoors.** From behind, when a wall or roof is between the camera and the character, the camera comes in along the line to the head and stops before the first block, so it is never inside a block
- **E, the view is kept on the device only** (`kidsgame.view`): not in the saved game or the cloud save, never sent (owner's answer to question 9). The privacy page has a new row for it
- **E, frame rate on screen:** with ?perf=1 the frame rate shows at the bottom of the screen, so it can be read on a phone
- **F, caves.** Land-maker 2 carves winding tunnels and big rooms from three smooth noise fields worked out on a coarse grid, and plans cave mouths on a grid of 112-block squares: a sloped tunnel from a hillside (or a hole in flat ground) down to a big domed room 6 to 8 blocks across, with stone spikes, gems in the walls, sometimes a still pool and sometimes a hole in the roof. Every mouth can be walked into and out of. No mouth within 30 blocks of the start, no cave within 2 blocks of water, no monsters in caves. Cave water is filled when the cave is made and never hangs over air
- **F, light under ground.** With the head under a roof and 4 or more blocks below the top of the ground above, the sky and sun light fade to about half and turn blue over about a second; near a mouth, a roof hole or a window it stays bright. No light per block
- **G, castles.** Placed on a grid of cells X blocks wide (the castle spacing), one possible castle per cell, kept away from the cell edges. Three sizes: a tower house (24 x 24, 20 high), a castle (64 x 64, towers 32 high) and a great castle (250 x 160, 8 to 10 towers, a main building up to 80 high). Walls 3 thick with battlements and a wall walk reached by stairs from the courtyard, a gate 3 wide and 4 high facing the start with a gatehouse, round or square towers with spiral stairs, a top room and a pointed roof in red or blue, a keep with floors every 6 blocks, windows and a stair tower, and the treasure room with gem blocks on its top floor. Castles on flat sites have a moat and a bridge. Inside, the land is levelled (higher land cut, gaps filled with stone); around, a slope leads back to the land so the gate can always be walked to. Over water the slope becomes a sandy shore. No castle within 100 blocks of the start, none taller than 92, none in water
- **G, the tower house near the start:** one always stands 100 to 200 blocks from the start
- **G, new blocks:** castle stone, wood floor and roof tile (red or blue), drawn in code. They go into the bag when dug and can be built with. Castle stone is as hard as stone by hand
- **G, far view:** past the drawn land and up to 500 blocks, each castle shows as a simple outline of boxes and cones; it gives way to the real blocks as they come into view. The camera now draws out to 700 blocks
- **G, castle spacing X:** the owner sets it in the admin page (new card "Castle spacing (owner only)", 250 to 2000, starts at 500). The game reads it when it opens and keeps it on the device; a world still in the start questions is remade with it; every world records its own spacing, so a change affects only worlds started afterwards. Without the internet the last value read, or 500, is used
- **Old worlds:** a world records which land-maker made it. Worlds saved before 0.6.76 have no record and keep land-maker 1: their land does not change and they get no caves or castles. Shared worlds carry the record, so every device makes the same caves and castles
- **Data and database (flagged in the spec, decided by the owner on 20 Nov 2026):** new table `game_settings` (migration `docs/migrations/0009_game_settings.sql`): one row, `castle_gap`; everyone can read it, only the owner's account can change it, it holds nothing about any player. Applied to the live database on 20 Nov 2026 at 13:15, after the release (the approval prompt had been cancelled on the phone until then): one row, castle_gap = 500, read by everyone, changed only by the owner's account. The world record (land-maker version, castle spacing) travels with the saved game and the shared world, as the world already does. Privacy page: new rows "The view" and "World record"
- Built differently from the spec: (1) castles also stand on bumpier sites than "6 blocks" (up to 12, 18 or 26 blocks for the three sizes): with the 6-block rule and no water anywhere near, only about 5 castles fitted on the whole land and no great castles; the floor is set halfway, higher land is cut, lower land filled, and the slope around is widened so it stays one block per block. (2) A castle may stand where up to a quarter of its ground was lake shallows; they are filled with stone, so no castle is in water. (3) X is read when the game opens, not at the moment a world is started (a world still in the start questions is remade with it). (4) Great castles are rare: 0 to 2 per world at spacing 500, so the "outline of a great castle from 400 blocks" may need a walk. About 20 castles per world at spacing 500
- Builder questions: **17** (chunk time and drawn blocks): measured in the cloud workspace with Node, not on the test phone: making a chunk takes about 25 ms with land-maker 1, about 31 to 38 ms with land-maker 2 on open land and about 41 ms inside a great castle; on the highest mountain of a test world the game draws about 490,000 blocks at once (450,000 before). **18** (owner-only settings): the admin page already had one owner-only setting (enemy log keep days, table `debug_settings`); castle spacing is kept in the new table `game_settings`
- Checked in the cloud workspace: syntax; fast tests; new `scripts/tests/caves-castles.test.mjs` (10 tests: the land-maker record and old worlds, same caves and castles on two devices, every cave mouth near the start walked in and out, caves near the start and away from water and the start, spikes and gems, the tower house near the start and its treasure room, a castle and a great castle walked through gate, courtyard, every tower top, the wall top and the treasure room, spacing, height, cells, castles differ, no water, new blocks); browser tests "SPEC-016 E" and "SPEC-016 F and G". **Not checked:** the full browser test run (the parent's decision); the frame rate on a phone (the 30 frames a second lines in E, F and G); how caves and castles look (the cloud test browser draws one frame every few seconds, so no pictures were taken). Not played by the parent
- Guide: Starting a game (What you need to play), Controls (Look up and down, Change view, two views), The world (Caves, Castles). Home page: what you need to play

## 0.6.75: Quiz "Hint" and "Another question" (SPEC-016 part D)
Built from "SPEC-016: Play test changes of 20 November 2026", version 4, part D. Nicola approved the spec in the build chat on 20 Nov 2026 and, asked whether he wanted to read the privacy line before the push, answered "no need to show me build and push".
- Under the answers there are three small buttons: **Hint**, **Another question** and **Not now**, each at least 48 px tall
- **Another question** gives a new question of the same kind (maths stays maths, words stay words) at the child's own level, at most 2 times for one visit of a friend. The old question counts as neither right nor wrong and the level does not move
- **Hint** gives one piece of help at once. Words: each hint puts the next letter in its place, up to half of the letters (rounded down, at least one). Maths in pictures: the first hint is the help that comes after two wrong tries, the second takes one wrong answer away. Sums in figures: one hint, which takes one wrong answer away (a second would leave only the right answer)
- A right answer after a hint gives 2 gems and the level does not go up. A hint is not a wrong answer. A button with nothing left is greyed out
- Fix on the way: letters that a hint put in place now stay there after a wrong try
- **Data (flagged in the spec, decided by the parent on 20 Nov 2026, question 7):** the quiz report also counts hints used and questions swapped, for maths and for words. Kept with the saved game like the rest of the report; in the parent's cloud save only when a parent is signed in with cloud save on; nothing is sent when a hint or a swap happens. The parent area's report shows two new columns. **Privacy page:** the Quiz friends report row now names the two counts, and the page's date is 20 November 2026. The parent chose not to read the line before release
- Built differently from the spec: a right answer after a hint with no wrong try is counted under "Right first time" in the report (the hint shows in its own column). The stats page (/admin.html) is unchanged and does not show the two counts
- Checked in the cloud workspace: the syntax check and the fast tests. Tests added: quiz.test.mjs (limits, reward, nothing sent, the privacy line) and one browser test ("SPEC-016 D"). **Not checked:** the browser tests were not run (the parent's decision); a phone, tablet or computer. Not played by the parent
- Guide: Quiz friends ("Help and swaps") and For grown-ups

## 0.6.74: Play test changes, release 1 (SPEC-016 parts A, B, C and H)
Built from the PM document "SPEC-016: Play test changes of 20 November 2026", version 4. The document still said "Draft, waiting for approval"; Nicola approved it in the build chat on 20 Nov 2026 ("build spec 016 approved") and then asked for the push to main without the tests ("push to main no need to test").
- **A, the fireball flies where you tap.** A tap on the Spell button lights it up and says "Tap where the fireball should go." Nothing is cast yet. The next tap or click on a monster sends the fireball to that monster; on the ground or a block it lands there. A second tap on the button, or 5 seconds with no tap on the world, turns it off. While it is lit a tap on the world only casts (no digging, building or sword hit), a drag still turns the camera and leaves it lit, and a tap on a quiz friend or Vital opens them and turns it off. On a computer F casts toward the mouse pointer (before: straight ahead)
- **A, the Recent list never covers a button.** It shows only as many rows as fit between the buttons; when fewer than two fit, or the screen is narrower than 400 px, it is not on the screen. The bag now always shows the Recent list at its top. The hand and Spell buttons are also drawn above the list
- **B, a sword hits only from 2 blocks or closer** (before: 8). Measured from the character to the nearest side of the monster's body, so a bigger monster can be reached from a little further away. Further away the game says "Too far away! Get closer." Holding keeps hitting only inside that distance. Digging and building reach (7) and the fireball are unchanged
- **C, digging by hand.** Without the pickaxe in hand (an empty hand or any tool or weapon), holding on a block digs it: sand, snow, dirt and grass in 2 times the pickaxe's time, stone 4 times, gems 6 times. "Digging by hand is slow. The pickaxe is faster." is said once in a visit. Digging by hand wears out nothing (before, digging wore whatever was in hand). With a block in hand a tap still builds. Vital's digging tip is reworded
- **H, powers in a menu.** The top left shows one line: gems and the bag count. A new Powers button (a star, 44 px tall) beside Settings opens the Powers panel: the name, each power with its level and bar, then the world code, the version and the players in a shared world. It closes with Close, a tap outside, Esc or the Android Back button
- **Data:** no new data. Nothing is stored or sent by any of the four parts (the spec's sensitive-area table says No for A, B, C and H)
- Built differently from the spec: (1) the Recent list is also taken off the screen below 400 px wide, to make the spec's "360 px" line certain; (2) the F key does nothing while a panel is open; (3) the players in a shared world moved into the Powers panel with the world code, since the top left is now one line
- Checked in the cloud workspace: the syntax check; the fast tests (all pass); the game loads in the test browser with no errors. Seven new browser tests were written (scripts/tests/browser.test.mjs, names start "SPEC-016") and three older ones were reworded for the new rules. **Not checked:** the full browser test run (the parent's decision); the older browser tests that depend on sword reach or on needing the pickaxe may now be outdated; a real phone, tablet or computer. Not played by the parent
- Guide: Controls table (dig, fight, cast, see your powers), the quick bar and bag, Digging, Powers and levels, Monsters and fighting, Magic

## 0.6.73: Vital the elephant, your guide (SPEC-011 version 2)
Built from the PM document "SPEC-011: Vital the elephant, your guide, version 2". The document was still a draft with two open questions; Nicola answered both in the build chat on 18 Nov 2026 ("1. Correct 2. Yes") and asked for it to be built.
- A small grey elephant named **Vital** comes about 3 seconds after play starts, with a "!" bubble and his name over his head, waves his trunk and walks up. The message reads "Vital is here! Tap him to say hello."
- A tap on him or on his bubble opens one tip in large letters with a big **OK** and a smaller **No more tips**. The game stands still while it is open. He never opens it himself
- Twelve tips, in order, in touch wording on a tablet or phone and in keyboard and mouse wording on a computer. A tip counts as seen only after OK
- After OK he waves and leaves, and comes back with the next tip after 2 minutes of the child moving about. He comes at most 4 times in one visit
- After "No more tips" he says "OK! I will say hello another day." and stays away for the rest of that visit and the next two. On the third he asks "Hi again! Do you want tips?" with **Yes** and **Not now**. Yes brings the tips back where they stopped; Not now sends him away again the same way. With every tip seen he checks in the same way, and Yes gives one tip again, chosen at random
- No tap for 90 seconds: he leaves and the tip stays unseen. Esc, the Android Back button or a tap outside the panel: the tip stays unseen and he leaves 20 seconds later
- When Vital comes at the start of a visit, the first quiz friend comes 20 seconds after he has left, not at 3 seconds. When he is not due, the quiz friend comes at 3 seconds as before. Vital and a quiz friend are never on screen together
- He gives tips only: no questions, no gems. Like a quiz friend he cannot be hit, monsters ignore him, the block he stands on cannot be dug or built into, and he is seen only on the child's own screen
- Made in the game's code from simple shapes: no model, picture or photo file. The owner's photo of the toy stays in the private Drive folder
- Settings: a **Tips from Vital** switch, on at first
- **Data (flagged in the spec):** which tips were seen, the "No more tips" choice, the count of visits to stay away and the switch are kept on the device (`kidsgame.vital`). Not in the saved game, not in the cloud save, nothing sent or logged. **The privacy page does not mention this yet: it is the parent's decision whether it needs a line** (the page already says the Quiz friends switch is kept on the device)
- Built differently from the spec: (1) at the start of a visit Vital comes even if a monster is within 10 blocks, like the first quiz friend, because the game starts with monsters nearby and the spec also wants him within 5 seconds; later in the visit he waits for a calm moment as written; (2) "at most 4 tips in one visit" is counted as 4 comings, so a child who ignores him is not visited more than 4 times; (3) if "Do you want tips?" gets no answer, he asks again on the next visit rather than later in the same one
- Tips checked against the game: W A S D, Space, B for the bag, Drop in the bag, JUMP, the teleport button, "monsters never hurt you" (as the guide says). Not checked against play: the drag-to-look and swimming tips
- Tests added: scripts/tests/vital.test.mjs (the twelve tips, the numbers, what the device remembers, nothing sent, tap only, made in code, tips only); browser.test.mjs (three tests: a new player's first meeting and his return, "No more tips" across four visits, a phone and the Settings switch). In the other browser tests his tips are switched off
- Guide: new part 2, "Vital, your guide" (the later parts move up one number); the Settings part; the quiz friends part
- Checked: the syntax check; the fast tests; the three new browser tests and the quiz friend browser tests, in the cloud workspace's Chrome on a smaller-view copy of the game; screenshots of Vital and his panel on a phone-sized view. Not run: the other browser tests. Not checked: a real phone, tablet or PC

## 0.6.72: learning level, 100 Maths levels and 100 Words levels (SPEC-004 version 4)
Built from the PM document "SPEC-004: Learning level, version 4: 100 levels" (approved by Nicola, 18 Nov 2026).
- Quiz friends now follow a **Maths level** and a **Words level**, each from 1 to 100 and separate. The question shows the level ("Maths level 23"). A right first answer moves that level up, with "Level up!" and the new number
- A new player climbs 5 levels for each right first answer in a subject until the first wrong first answer there, then 1 at a time. Two wrong first answers in a row make the questions 3 levels easier; the number the child sees never goes down
- Maths by level, ten rows of ten levels: as before with pictures (1 to 10); within 20 and counting on in 2s, 5s, 10s; within 50, the bigger of two numbers, the missing number; within 100, double and half, times 2, 5, 10; times tables; dividing and the missing number in a times sum; multiply and divide mixed and sequences; a half, third or quarter and round numbers to 1,000; two-step sums and a two-digit number times a one-digit number; brackets, a fifth or a tenth, sequences that double or halve
- Words: 291 words in ten rows, 3 letters at levels 1 to 10 up to 8 letters at 91 to 100. One word in four comes from the row below. Words of 3 to 5 letters show a picture; words of 6 letters or more show none. The first letter is still put in place after two wrong tries, at every length
- The pictures are 124 Twemoji files shipped with the game (`www/quiz/pics/`), no longer the device's own emoji, so they look the same on every device. This also replaces the pictures of the 40 words that were in the game
- Parent area, new "Learning level" part: Auto or one of five bands of 20 levels (with rough ages as labels), a minus button, slider and plus button to set each level, and "Start levels again", which asks "Are you sure?" first. Nothing is typed. The game never asks an age, a birthday or a school year
- Rewards are unchanged at every level: 5 gems right first time, 2 after a wrong try
- **Data (flagged in the spec, the parent said yes on 18 Nov 2026):** the two levels (level in use, best level, fast start, runs of right and wrong answers) and the parent's band are kept in the saved game, key `levels`. They go into the parent's cloud save only when a parent is signed in with cloud save on, like the quiz report. No new database table or access rule, nothing logged, nothing sent when a level changes. The privacy page has a new "Learning level" row and the date 18 Nov 2026: **the parent reads it before release, and checks the Play Data safety form**
- Credits: "Pictures in word questions: Twemoji, copyright Twitter, Inc and other contributors, licensed under CC BY 4.0." in Settings (credits) and on the Terms page (dated 18 Nov 2026)
- Assets: Twemoji 17.0.3 (CC BY 4.0) and the ENABLE word list (public domain, tests only, `scripts/tests/data/enable1.txt`, never in `www/` or the app). Rows in `docs/ASSETS.md`, licence copies in `docs/licences/`. The PM was to place the files; the builder fetched them from the sources named in the spec, and the byte counts match the spec (217,299 and 1,743,363). The ENABLE README page could not be opened from the workspace, so `enable-word-list.txt` records the PM's check, not a copy of the page
- Where the words are: inside the game file (`QUIZ_WORD_ROWS`), not in a separate `www/quiz/words.json` as the PM suggested, so they work with no internet and without loading a file. The builder decides the form (spec)
- Built differently from the spec, or decided by the builder where it is silent: (1) the hint after two wrong tries for sums in figures (levels 11 and up) takes one wrong answer away, since dots cannot show big numbers; (2) "the bigger of two two-digit numbers" has two answer buttons, not three; (3) on a phone held upright the places for a 7 or 8 letter word are smaller than 48 px so that they fit in one row; the letter tiles to tap stay full size on two rows; (4) on the website a picture is loaded from the site when its question opens (in the Android app it is inside the app)
- Tests added: quiz.test.mjs (level rules, bands, parent setter, start again, saved-game reading, maths answers re-worked at every level from 11 to 100, number ranges, the word rows, ENABLE checks with the eleven named exceptions, the rude-word list, pictures present for 3 to 5 letters and none from 6, ENABLE not in `www/`, no age asked); browser.test.mjs (four tests: the child's flow, the parent area, a phone upright and sideways). The old test that dropped words for mild letter runs is gone (the parent's decision, 18 Nov 2026)
- Guide: the quiz friends part ("Your levels"), the grown-ups part ("Learning level" and a row in the controls table)
- Checked: the syntax check; the fast tests; the four new browser tests and the existing quiz friend browser tests, in the cloud workspace's Chrome on a smaller-view copy of the game; screenshots of the question and the parent area on a phone-sized view. Not run: the other browser tests. Not checked: an Android 9 phone or any real device; the cloud save carrying the levels to a second device (no sign-in in the workspace)

## 0.6.71: tap the "?" bubble, tap outside a window to close it, shorter Recent heading
Asked for by the parent in the build chat (18 Nov 2026). No PM document.
- A tap or click on the "?" bubble over a quiz friend opens its question. Before, only a tap on the friend's body counted, and the bubble sits above it
- A tap or click on the world outside the bag, Settings or the quit question closes it, the same as its Close button. That tap does nothing else (no digging, building or fighting). The guide already said "Tap outside the panel", but the game did not do it
- The parent area closes on a tap on the dark area around its box
- Left as they are: a quiz question still closes only with *Not now* or an answer, and the skill choice still needs a choice
- The Recent list's heading reads "Recent" (was "Recent (tap to add to quick bar)"). Tapping an item there still adds it to the quick bar
- The number 0.6.70 is left for "Delete my data", which is built but not pushed (see the project note)
- No change to what data is collected
- Tests added (browser.test.mjs): a tap on the bubble; a tap outside each window. Guide: the quiz friends part mentions the bubble
- Checked: the syntax check; the fast tests; the two new browser tests and the 14 existing bag, Settings, quit and quiz friend browser tests, in the cloud workspace's Chrome on a smaller-view copy of the game. Not run: the other browser tests. Not checked: a real phone or tablet

## Android app icon, 17 Nov 2026 (no change to the game; still 0.6.69)
Asked for by the parent while preparing the Play Store listing.
- The Android app has its own icon: a cartoon of the game's character on a pink and purple sunburst. Until now the app carried the plain icon that comes with the app wrapper
- The same picture is the store icon: `www/app-icon/icon-512.png` (512 x 512)
- The icon in every size Android needs is in `www/app-icon/android-res/`. A new step in `package.json` (`capacitor:sync:after`) copies it into the Android project every time the build syncs it, so the build tools on the laptop did not need changing
- The pictures are drawn by `scripts/app-icon.py` (an original drawing, not a capture from the game)
- No change to the game, to the website's pages or to what data is collected
- Test added: `scripts/tests/app-icon.test.mjs`
- Checked: the fast tests; the copy step was run on a throwaway Android project in the cloud workspace and the icon files landed in it. Not checked: the icon in a built app on a phone or tablet

## 0.6.69: the buttons at the top right no longer overlap
Asked for by the parent before the push (17 Nov 2026).
- Fixed: the "Controls: On/Off" button lay on top of the Settings button, on phones, tablets and computers. Its text had grown since the buttons were given fixed places
- The teleport button, Settings and Controls now sit in one row at the top right and make room for each other; the Bag button sits under them. On a phone the top-left button is kept narrow enough to leave them room
- Fixed on phones: the message line at the top (for example "A friend is here!") was written over the name, bag and world lines at the top left. It now sits just under them
- This is the fault the three "hand buttons, the Spell button and JUMP fit the screen and cover no other control" tests have reported since 0.6.62
- No change to what the buttons do, and no change to what data is collected. Nothing new for the guide
- Checked: the syntax check, the fast tests, and the layout tests (phone held both ways, tablet) in the cloud workspace's Chrome; screenshots were looked at. Not checked: a real phone or tablet

## 0.6.68: hold a quick bar slot to fill it
Asked for by the parent after playing build 11 (17 Nov 2026).
- Pressing and holding a quick bar slot for half a second, with a finger or the mouse, opens the bag with that slot chosen. One tap on an item then puts it in the slot. A short press only selects the slot, as before
- On touch screens, holding a hand button does the same for slots 1 and 2 (a tap still puts the item in the hand first)
- Holding does nothing while Settings, the quit question, a quiz question or another panel is open
- No change to what data is collected
- Tests added (browser.test.mjs): holding a slot, and holding a hand button on a tablet
- Checked: the syntax check, the fast tests, and the two new browser tests in the cloud workspace's Chrome (smaller-view copy of the game). Not checked: the other browser tests; a real phone or tablet (on a phone the quick bar is hidden until the top-left button is tapped)

## 0.6.67: quiz friends come sooner
Asked for by the parent after playing build 11 (17 Nov 2026). It changes SPEC-003's rule of 4 to 7 minutes between friends.
- The first friend of a visit comes 3 seconds after play starts, so one is there from the beginning. This one does not wait for monsters to be out of the way
- After a right answer, the next friend comes after 60 seconds in which the child is moving about. Standing still does not run the minute down
- After a friend leaves with no right answer ("Not now", 90 seconds, or walking away), the next one comes 4 to 7 minutes of play later, as before
- Still true: one friend at a time; apart from the first, none while a monster is within 10 blocks or a panel is open; the "Quiz friends" switch turns them off
- **For the parent and the PM: this raises how fast gems can be earned**, from 5 gems every 4 to 7 minutes to 5 gems about every minute and a half for a child who keeps answering right. Gems are planned as something paying families receive
- No change to what data is collected
- Tests: the browser tests for the first friend, the wait after a right answer and the wait after an unanswered friend are changed. The other browser tests now start with quiz friends switched off, so the friend at the start does not get in their way
- Checked: the syntax check, the fast tests, and the quiz friend browser tests in the cloud workspace's Chrome (smaller-view copy of the game). Not checked: the other browser tests; a real phone or tablet

## 0.6.66: tap to hit, and life bars only on hurt monsters
Two changes the parent asked for after playing build 11 (17 Nov 2026).
- With the sword in hand, a tap or click on a monster within reach now hits it once straight away. Before, only holding hit. Holding still keeps hitting at the usual pace. A swing takes 0.3 seconds, so faster taps do not hit again (the same as a sword on a hand button since 0.6.60)
- A monster's life bar now shows only once the monster has been hit. Monsters at full health show no bar
- Note: tapping quickly now hits faster than holding does (up to about three hits a second, against one hit a second or slower when held)
- No change to what data is collected
- Tests changed in `browser.test.mjs`: the sword-in-hand test (a tap hits once, a second tap at once does not, out of reach does not, holding keeps hitting) and the life bar test (hidden until the first hit)
- Checked: the syntax check, the fast tests, and these two browser tests plus the hand-button tap test in the cloud workspace's Chrome (smaller-view copy of the game). Not checked: the other browser tests; a real phone or tablet

## 0.6.65: word scrambles, and a quiz report for parents
Asked for by the parent directly on 17 Nov 2026 (not from a product manager hand-off). It changes two things SPEC-003 ruled out: spelling questions, and keeping something about the quiz.
- Quiz friends now ask a word scramble about half the time. A picture (an emoji from the device's own font, no file) shows what the word is; its letters are mixed up on tiles. The child taps the tiles in order to spell it; a tap on a placed letter takes it back. Tap only, nothing is typed
- 40 short everyday words of 3 to 5 letters, each with its own picture. A test checks every way of arranging each word's letters: none spells another word of the list, a second common word, or a rude word (two words were dropped by this check)
- Rewards as for maths: 5 gems first time, 2 after a wrong word. A wrong word takes nothing: the letters go back and "Try again" shows. After two wrong words the first letter is put in place and stays there
- No word or maths question repeats within the last 10
- **Quiz report (new data, the parent's decision of 17 Nov 2026):** the game counts, for maths and for words, how many questions were shown, how many were right first time and how many right after a retry, and keeps the dates of the first and the last question. Counts only: no question and no answer is kept
- The counts are kept with the saved game on the device, and shown in the parent area ("Quiz friends report"). They are sent nowhere by themselves. They are inside the cloud save when a parent has signed in and cloud save is on; the parent stats page then shows the same report to that signed-in parent, read from their own cloud save. No new database table and no change to the access rules
- The privacy policy page has a new row, "Quiz friends report", and a new date. **The parent should read it before this is released**, and decide whether turning on cloud save is enough of a yes for the report to be sent, or whether a separate tick is wanted
- Guide: part 17 explains word scrambles; the grown-ups part explains the report
- Tests: 6 more fast tests in `quiz.test.mjs` (word rules, the arrangement check, the counts) and 2 more browser tests (word scramble; the report counts, is saved, shows in the parent area, and nothing is sent)
- Checked: the syntax check, the fast tests, and the 13 quiz and life-bar browser tests in the cloud workspace's Chrome (smaller-view copy of the game). Not checked: the report on the parent stats page (it needs a real sign-in and a cloud save); how the picture clues look on a real phone or tablet (they come from the device's emoji font); the other browser tests; the parent has not played it

## 0.6.64: life bars for monsters
Asked for by the parent directly on 17 Nov 2026 (not from a product manager hand-off).
- Every monster has a small life bar over its head, showing how much of its health is left. It always faces the screen and follows the monster
- Green above 60% of full health, yellow from 60% down to 30%, red below that. The bar goes when the monster is defeated or leaves
- The message after a hit ("3 health left") is unchanged
- Drawn in code; no new files. No change to what data is collected
- The guide's part 9 (Monsters and fighting) explains the bar; the release notes page is rewritten
- Tests added: one browser test in `browser.test.mjs` (every monster has one bar above its head, it shrinks and changes colour with each hit, and it goes with the monster)
- Checked: the syntax check, the fast tests, and the new browser test in the cloud workspace's Chrome (against a copy of the game that draws a smaller area); a screenshot was looked at. Not checked: the other browser tests; a real phone or tablet; the parent has not played it

## 0.6.63: Quiz Friends (SPEC-003)
Built from the product manager's SPEC-003 "Quiz Friends", document version 1, approved by the parent on 17 Nov 2026. The document names 0.6.61 as its target; that number was already used, so this is 0.6.63.
- Now and then a friendly character (an owl, a turtle or a small robot, all original and made in the game's code) appears 7 to 11 blocks from the child with a "?" bubble over its head, waves, walks up and stops two blocks away. It never opens anything by itself
- A tap or click on the friend opens one question: large text with pictures, three big answer buttons and "Not now". The game stands still while the question is open. There is no timer and no countdown
- Questions are made at random by the game's code, which also works out the right answer (no internet, no AI): count pictures up to 10, add and take away within 10, which has the most, what comes next in a two-shape pattern. Three different answers, one right, the wrong ones 1 to 3 away, the right one in a random place, text of 8 words or fewer, and no question repeats within the last 10
- Right first time: stars and 5 gems, then the friend waves and leaves. Wrong: the button wobbles and "Try again" shows; nothing is lost. After two wrong tries a picture hint with dots appears. Right after a wrong try: 2 gems. Rewards are fixed
- "Not now" (also Esc and the Android Back button): the panel closes with no change; the friend waits 20 seconds more, then leaves. Tapping it again shows the same question
- One friend at a time. A new one comes 4 to 7 minutes of play after the last one left (the first one of a visit too), never while a monster is within 10 blocks or a panel is open. It leaves after 90 seconds with no answer or when the child is more than 40 blocks away, with no message
- Friends are not monsters: they cannot be hit or pushed, monsters ignore them, and the block a friend stands on cannot be dug or built into ("Your friend is standing there")
- In a shared world each player has their own friend, seen only on their own screen: a friend is never sent to other players
- Settings has a "Quiz friends" switch, on at first, kept on the device like the volume levels. Off removes the friend on screen and no new one comes
- No change to what data is collected. Nothing about questions or answers is stored, logged or sent; the last 10 questions are remembered only while the game is open. The only thing kept is the on/off switch (`kidsgame.quiz` on the device)
- Uses sounds already in the game (open, close, tap, gem). No new files and no outside assets
- Website: the guide has a new part 17, "Quiz friends", a line in Settings and a line for grown-ups; the release notes page is rewritten
- Built differently from the document, or where it is silent: the question "which is more" reads "Which has the most?" because there are three groups; the answer buttons for it show the number with that many pictures; a friend must be within 10 blocks for a tap to open the question ("Walk closer to your friend" otherwise); a short message says "A friend is here! Tap it to say hello." when one appears; a friend walks over any ground and stands on top of water
- Tests added: `scripts/tests/quiz.test.mjs` (14 fast tests of the question rules and the privacy rules) and 9 browser tests in `browser.test.mjs` (the seven "Done when" points, on a phone held both ways, a tablet and a PC)
- Checked: the syntax check, the fast tests, and the 9 new browser tests in the cloud workspace's Chrome (against a copy of the game that draws a smaller area, because that browser is slow). Not checked: the other browser tests; a real phone or tablet; real sound; the parent and his son have not played it

## 0.6.62: building works on phones and tablets, and a full bag can be emptied
Two problems reported from play on a phone.
- Fixed: on a touch screen you could not build. A tap on a block always tried to dig, and said "Select the pickaxe" when another item was in hand; only a right-click built, and a touch screen has none
- Now, with a block in hand, a tap (or left-click) on the side or top of a block builds there. A drag still turns the view and builds nothing. The pickaxe digs and the sword fights as before; right-click on a computer is unchanged
- New: a Drop button in the bag, next to each block and monster part. One tap puts one of them on the ground two blocks away, where it can be picked up again for 5 minutes (the same as blocks that fall when the bag is full). Before, building was the only way anything left the bag, so a full bag could not be emptied
- Gems, tools, weapons and spells cannot be dropped. Gems are left out on purpose, since paying families will receive gems
- The "bag is full" messages now say what to do: open the bag and tap Drop
- No change to what data is collected. Drops stay on the device, as before
- Tests added (browser.test.mjs): a finger tap and a click build with a block in hand, a drag does not, the pickaxe still digs; Drop takes one item out, puts it on the ground away from the character, and is not offered for gems or tools
- Checked: the syntax check and the fast tests. Not checked: the browser tests (the two new ones included); a real phone or tablet

## 0.6.61: first sounds and music (hand-off 002)
- 16 sound effects from four Kenney packs (CC0), chosen by file name only: nobody has listened to them in the game yet. One per action; "player hurt" has no sound because monsters never hurt the player
- Music: Grieg, "Morning Mood", Musopen Symphony Orchestra recording from Wikimedia Commons (public domain), shortened to 2 min 45 s with a fade in and out. Only one piece so far, so it repeats after a short pause. Hand-off 002 asks for at least two
- All files are MP3: effects 57 KB in total, music 1.3 MB
- Every file has a row in docs/ASSETS.md and a licence copy in docs/licences/. The Commons licence copy is a written record, not the saved page: the parent should save the page to replace it
- Credits now show in Settings and on the terms page (written by scripts/audio-credits.mjs)
- Checked: the fast tests, including the audio rules. Not checked: the browser tests; real sound on any device

## 0.6.60: hand buttons, tap to hit, and the sound engine (hand-offs 001 and 002)
Built from the product manager's hand-offs 001 (controls) and 002 (sound and music), document version 1 of each.
- Quit moved into Settings: "Quit the game" at the bottom, in red. The top-right Quit button is gone. Esc and Android Back work as before; Keep playing goes back to the game
- Settings: the list of changes is folded behind "What has changed", so Quit is easy to reach
- Touch screens: two round hand buttons above JUMP show quick bar slots 1 and 2, and a Spell button casts the fireball (it replaces FIRE). A hand button only puts its item in the hand; the item in hand has a bright ring; an empty one opens the bag with its slot chosen. Order from the top: Spell, Hand 2, Hand 1
- The game no longer changes the quick bar by itself: a learned fireball goes into an empty slot only, and on touch screens into no slot (the Spell button casts it; F still casts on computers)
- Tap or click a close monster with another item in hand: a sword on a hand button swings once (0.3 seconds per swing) and the item in hand stays. With no sword there: "Put a sword on a hand button". With the sword in hand, fighting is as in 0.6.59 (hold to hit)
- Sound engine and music player, with Sounds and Music sliders in Settings (six steps, first start 4 and 2, kept on the device only) and a "Music and sound credits" list. Nothing loads or plays before the first tap or key; all audio stops when the page is hidden or the game quits
- **No audio files yet: the game is silent until they are added.** Each file needs a row in docs/ASSETS.md and a saved licence page in docs/licences/; `node scripts/audio-credits.mjs` then writes www/audio/credits.json and the credits on the terms page
- No "player hurt" sound: monsters never hurt the player
- Terms page: new wording for music and sounds, dated 17 November 2026. **Needs the parent's review before the push**: it describes music and sounds that are not in the game yet, and it no longer says the models' licences forbid reselling or redistributing them
- Privacy page: no change. The two volume levels are device settings and are never sent; audio comes from our own site
- Tests added: 13 browser tests (Quit in Settings, layout on phone sideways, phone upright and tablet, hand buttons, Spell button, computer layout, three tap-a-monster tests, sound and music, broken audio files) and scripts/tests/audio.test.mjs (file rows, licences, credits, size limits, sound call sites, terms wording). The old Quit and FIRE button tests were updated
- Not tried on a phone or tablet yet. No real sound has been heard

## 0.6.59: quit the game
- New Quit button at the top right, under Settings. It asks "Quit the game?" first; Save and quit saves the game and closes it, Keep playing goes back
- Computers: Esc opens the same question. Esc still closes the bag or Settings first, and Esc on the question means keep playing
- Android app: the phone's Back button works the same way, and Save and quit closes the app (new Capacitor App plugin, @capacitor/app 8.1.2)
- In a web browser a page cannot close its own tab, so Save and quit goes to the home page instead
- No new data is collected
- Tests added (browser.test.mjs): Esc and the Quit button ask first, panels close before the question, Save and quit saves and leaves; in the Android app (stood in for in the test), Back asks first and Save and quit closes the app
- Not tried on a phone yet

## 0.6.58: moving monsters, new scenery
- The Imp and the Spike Beast move their legs, arms and head: they step and bend a knee when they walk, let their arms hang, look around when they stand, and lift their arms when they are about to be hit. The models have a skeleton but no ready-made animation, so the game moves the bones itself
- Fixed: all Imps shared one model (and all Spike Beasts another), so only the newest one could be seen and the others were invisible. Each one now has its own copy
- Goblins, Brutes, Spear Imps and Hood Goblins swing their arms and legs when they walk
- New scenery made in the game's code, with no downloads: cactuses in the desert, ice crystals and snowmen in the tundra, pumpkins in the grassland and forest. Decoration only, like the other scenery. Scenery that was already in a world stays where it was
- Tests added: each new kind grows only in its own biomes, the new shapes are built, every Imp and Spike Beast has its own model and moving bones, goblins have arms and legs to swing
- Not played by the parent yet

## 0.6.57: phone controls
- New: a thumb stick replaces the four arrow buttons on touch screens. Push it a little to walk slowly, all the way to walk at full speed. Letting go stops the character; a tiny push near the middle does nothing
- Phones, held either way: the phone layout now switches on for any touch screen whose short side is 500 points or less. Before, it only switched on when the screen was narrow, so a phone held sideways (about 780 x 360) got the large computer layout and buttons went off the screen
- Phones: smaller buttons that scale with the screen; the quick bar, the recent list and the power meters are hidden. A button at the top left shows the item in hand; tapping it shows them, and choosing a tool hides them again
- Computers and tablets: no change
- Tests added (browser.test.mjs): on a phone held sideways and upright, every control fits the screen and the bar and meters start hidden; the top-left button shows and hides them; the stick reads the finger, springs back, ignores tiny pushes, and a half push walks at half speed
- Not tested on a real phone yet

## 0.6.56: database lockdown and visit-only logging
- Shared worlds: the game now opens, creates and saves a world only through three database functions that need the world's code. Direct access to the worlds table is removed by migration 0007 (to be applied after this version is live, with the parent's approval)
- Privacy: the game no longer keeps a random code on the device. A new code is made on every visit and is never stored, so gameplay records cannot follow a player from one visit to the next. The old stored code is removed from the device
- Parent area: the "Player code" line is gone, and the stats link no longer carries a code
- Stats page: "Players" is now "Visits" (one opening of the game). Counts of visits, game starts and errors remain
- Privacy page: "Device code" replaced by "Visit code"; shared-world wording updated; date updated. Needs the parent's review
- Database (migration 0007, not applied yet): players table closed; logs stay add-only with length limits
- Not in this version: per-child stats for a linked, consenting parent (see docs/PARENT_LINK_DESIGN.md)
- Tests added: scripts/tests/privacy-lockdown.test.mjs; scripts/tests/access-rules.sql updated for the new rules

## 0.6.55: standing still
- Fixed: the character's head bobbed up and down while standing still. The squash meant for landing after a jump was applied on every frame of standing, so the character stayed squashed (about 81% of its height) by an amount that changed from frame to frame
- The squash now happens only on a real landing (falling faster than 2 blocks a second) and at the start of a jump. The character stands at its full height
- Fixed: the character stopped a little above the ground, so on some frames it counted as in the air (arms flicked up, and a jump press could be missed). It now rests exactly on the block below
- Tests added: through uneven frame times the character keeps its full height, stays on the ground and does not move; a jump still squashes it at take-off and on landing

## 0.6.54: steady picture (shake fix)
- Fixed: the ground shook slightly while moving. Since 0.6.34 the world starts 200,000 blocks from zero, and graphics cards cannot draw numbers that large exactly. Blocks and scenery are now drawn relative to their own chunk, so they are exact anywhere in the world
- Fixed: the camera, the head turn and other players eased by a fixed share per frame, so uneven frame times made the picture shake. They now ease by elapsed time, and the camera keeps a steady gap behind the character
- No change to saves, data, sign-in, ads or purchases
- Tests added: blocks and scenery are drawn with small numbers and in the right places; the camera gap stays steady with uneven frame times

## 0.6.53: biomes
- The world is split into biomes by climate: desert, savanna, rainforest, grassland, forest, taiga and tundra
- Biomes blend into each other across the world, with soft borders instead of hard lines
- Deserts have sand, tundra has a new snow block, and each biome has its own trees and plants (palm and pine trees added)
- Tests added: biome spread, gradual borders, same map for the same seed, desert sand and tundra snow

## 0.6.52: lighter scenery, performance readout
- Scenery is stored more compactly and is drawn only within 4 chunks of the player
- ?perf=1 in the page address logs frame rate, frame time, memory, draw calls and triangles to the console (local only)
- Test added: performance numbers are measured and recorded (PERF_RECORD in the test output)

## 0.6.51: water puts out fireballs
- A fireball that reaches water fizzles out in a puff of steam, with no blast and no damage
- Enemies still take the blast when a fireball hits them
- Test updated: a fireball aimed at water is put out by the water

## 0.6.50: trees, bushes and scenery on the grass
- Trees (pine, common, palm), bushes, grass tufts, flowers, mushrooms, stones and tree stumps now grow on the grass. They come from the free CC0 Low Poly Nature Pack by flo-bit, which is in build/models/nature and www/models/nature
- Scenery is decoration only: it does not block walking, jumping or digging
- Fireballs aimed at water now burst on the water instead of passing through it
- Fireball debug trace added: open the game with ?fireDebug=1 to log each shot to the browser console (nothing is sent anywhere)
- Tests added: scenery rules (clear start area, same every time, not under water, share of grass), scenery loads and appears in view, a fireball aimed at water bursts on it

## 0.6.49: fireball hits the block you click
- Fixed: a right-click fireball flew along the camera's line, so it landed on a different block than the one clicked. It now flies from the character straight at the exact point clicked
- Test added: a fireball aimed at a block flies toward the clicked point

## 0.6.48: fireball aims at what you click
- A fireball flies from the character toward the point you click or tap, instead of going off in the camera direction and bursting near you
- If you click an enemy, the fireball follows it and lasts long enough to reach it
- A fireball that hits makes a fire burst of sparks where it lands
- Clicking any part of an enemy's body counts as hitting it
- Test added: a fireball aimed at a screen point is fired and flies toward it

## 0.6.47: fireball controls
- Right-click on a computer casts a fireball when the fireball is the selected quick bar item. Otherwise right-click still places a block
- Tablets and phones get a FIRE button to the right of the quick bar. It shows with on-screen controls on, once you have learned the fireball
- The version now shows next to the world name on screen
- Tests added for right-click casting and the Fire button

## 0.6.46: climbing out of water, and automated tests for the rules
- Fixed: from the water you could not get out onto a shore. Now, holding jump while pressed against a shore next to water lifts the character over the edge
- For 4 seconds after leaving the water, holding jump against a step still lifts the character up it
- Automated tests now cover enemy kinds and weaknesses, damage, gear wear and breaking, gear drops, stacking parts, old saves with the starting gear, climbing out of water, and the shore terrain

## 0.6.45: durability, gear and enemy parts
- Pickaxes and weapons have durability. A pickaxe wears by one for each block it digs; a weapon wears by one for each hit. At zero the item breaks and is removed from the bag and the quick bar
- Each piece of gear is its own item with its own durability shown in the bag (for example "Sword 58/60")
- Enemies drop parts that stack in the bag: Goblin Ear, Goblin Skin, Imp Horn, Imp Tail, Brute Tooth, Brute Hide, Spear Imp Horn, Spear Shaft, Hood Cloth, Bone Charm, Spike Quill, Beast Hide. Parts are for selling, crafting or throwing away later
- Enemies sometimes drop gear: wooden, iron and gold swords, a pickaxe, leather armour and an iron helmet. Stronger enemies drop better gear
- Weapons do damage equal to the Fighting level plus the weapon's extra damage
- Armour is kept in the bag with durability. It does nothing yet because enemies do not hurt the player
- Saves from before this version keep the pickaxe and sword as starting gear
- Checked: script syntax and automated tests. Not played yet

## 0.6.44: enemy names, health and weaknesses
- Each enemy has its own name, power level, health and toughness. Defaults for now: Goblin (power 1, weak to fire), Imp (power 2, weak to holy light), Brute (power 4, tough, weak to fire), Spear Imp (power 3, weak to holy light), Hood Goblin (power 3, weak to fire), Spike Beast (power 3, very tough, no weakness)
- The sword hits for your Fighting level. Each hit takes health off; an enemy is defeated at zero health. Toughness takes damage off each hit
- Fireball burst hurts every enemy inside it. Enemies weak to fire take double damage
- Code: the old "slime" names are now enemy names (spawnEnemy, defeatEnemy, updateEnemies)
- Not yet: the admin editing of names and power levels (defaults are in the code). Holy light is not a spell yet, so holy weaknesses are not used
- Checked: script syntax and automated tests. Not played yet

## 0.6.43: swimming and the first magic skill
- Water: you swim. In water you move slower and sink slowly. Hold jump to swim up. You can still build into water and dig under it
- At Fighting level 2 you unlock magic. A panel asks you to choose a skill; the first is Fireball, which goes in the quick bar
- Fireball: tap the screen (or press F) to shoot. It defeats the monsters it hits. Magic levels up as you cast; at magic level 2 the ball is bigger and the burst is wider
- Skills you choose are saved with your game
- Checked: script syntax, all tests, and two new browser tests in headless Chromium: the skill panel appears at Fighting level 2 and F shoots a fireball; in a lake you sink slowly and holding jump swims up
- Not checked by eye or on a tablet yet: how swimming feels, the panel, and fireball aim by tap

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
