# Changelog

Version numbers: `0.MINOR.0`. Each prototype file in `build/` matches one version.

## Website, 17 Nov 2026: How to play guide and release notes (no change to the game)
- New page `/how-to-play.html`: a guide to every function of the game in 18 parts (starting, controls, quick bar and bag, digging, building, gems, a full bag, powers, monsters, gear, magic, water, the world, teleport, saving, friends, settings, parental controls). Facts were taken from the game's code at 0.6.62
- New page `/release-notes.html`: what changed in each version, newest first. It is written by `scripts/site-pages.mjs` from the same list the game shows in Settings, so the two cannot differ
- The home page links to both
- Rule for every later version: the guide and the release notes are updated in the same release (CLAUDE.md, "How to change the game"); `scripts/tests/site-pages.test.mjs` fails otherwise
- The guide's last part is for grown-ups: the parental controls, how to open the parent area and what each control does (the parent's decision, 17 Nov 2026). Neither page links outside the site
- No change to what data is collected: the pages are plain pages with no scripts
- Checked: the fast tests; the pages were looked at in a browser in the cloud workspace. Not checked: the parent has not read the guide against the game; a phone or tablet

## 0.6.70: Delete my data, from Settings (SPEC-010), and the guide text for Google's Teacher Approved review (SPEC-009)
Built on the parent's word in the build chat (17 Nov 2026, late evening): both specs were still drafts. His answers: SPEC-010's five proposals accepted (three confirmations are enough with no parent signed in; shared worlds are kept; online data goes at once and from backups within 30 days; the button is in Settings; a date-only note of each deletion is kept); the code email is sent by the existing sign-in service, with no new email service.
- New in Settings, above Quit: **Delete my data**, for grown-ups. It lists what will be deleted and what will not, then asks three times on three screens: tap "I want to delete my data"; hold "Delete everything" for 3 seconds; type the word DELETE. Cancel is on every screen, and Esc or Back cancels too
- No parent signed in: after the third confirmation the saved games, the quiz friends reports (they are kept inside the saved games), the settings and anything else the game keeps on the device are removed. No email is asked for or sent
- A parent signed in: after the third confirmation a 6-digit code is emailed to the sign-in address. Nothing is deleted until the right code is typed within 15 minutes; five wrong codes cancel the request. Then the cloud save and the parent account are deleted, the parent is signed out and the device is cleared. The game never asks for or shows an email address here
- Afterwards the game says "Your data has been deleted" and opens as on a first visit
- New website page `/delete-my-data.html` for a parent who no longer has the game: sign in with an email code, the same three confirmations, the same emailed code. It deletes the cloud save and the parent account
- Online part: server function `supabase/functions/delete-my-data` (rules in `logic.mjs`) and migration `docs/migrations/0009_delete_my_data.sql` (two tables only the server can use: a request kept for at most 15 minutes, and a log with the date of each deletion and nothing else). **NOT APPLIED and NOT DEPLOYED yet: the workspace was not allowed to change the live database. Until they are, a signed-in parent gets "The server could not be reached. Nothing was deleted", and the website page cannot delete. The part for families with no parent signed in works without them**
- **Data, flagged for the parent's privacy review:** new: a deletion request (account, time, wrong tries) for up to 15 minutes; one email with a code to the parent's own sign-in address; the date of each deletion. A signed-in parent can now delete their own account. The privacy page's "How to delete your data" part was rewritten to say all this and is dated 18 November 2026: it needs the review before release
- Built differently from SPEC-010: no "the deletion is done" email (the existing sign-in service cannot send one; parent's choice of no new email service). The code email is the sign-in service's ordinary "your code" email, so its wording speaks of signing in until the template is changed in Supabase. "Parent links" do not exist in the database yet, so there are none to delete
- SPEC-009: the guide's part 19 has the new last paragraph about Google Play's rules for children's games, and the release note is added. Nothing else in SPEC-009 is built: the age groups, the store listing and the Data safety form are the parent's in Play Console, and the sign-in question is not settled (the parent's answer: children do not need Google sign-in, parents do)
- Guide: part 18 lists Delete my data; part 19 explains it and links to the website page
- Tests: `scripts/tests/delete-my-data.test.mjs` (the server rules, the two tables, the page, the guide and privacy texts) and four browser tests in `browser.test.mjs`
- Checked: the syntax check; the fast tests; the four new browser tests in the cloud workspace's Chrome on a smaller-view copy of the game (the sign-in and the server stood in for). Not checked: any real email, sign-in or deletion against the live database; the website page in a browser; the rest of the browser tests; a real phone or tablet
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
