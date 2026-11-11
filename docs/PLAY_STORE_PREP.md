# Google Play: store listing and release prep

Status: draft. Items marked **DECIDE** need the parent's decision before the store form is filled in.
Nothing here has been submitted to Google Play.

## App identity
- App name: Adventurers of Drenerics (24 of 30 characters)
- Package name: com.drenerics.adventurers (set in capacitor.config.json; cannot change after the first upload)
- Default language: English (United States)
- Current version: 0.6.55 (version code comes from the CI run number)

## Store listing (draft)
- Short description (80 characters max): "Dig, build, collect gems and fight monsters in a block world."
- Full description (4000 characters max), draft:
  Adventurers of Drenerics is a block-building adventure for families. Dig into hills and mountains, build with blocks, collect gems, level up your powers and battle friendly-sized monsters. Explore different biomes from deserts to snowy tundra, and share your world with friends using a code.
  No chat, no public player lists and no ads in this version.
- Category: Games > Adventure (or Casual) — DECIDE
- Contact email for the listing: DECIDE (the parent's contact email)
- Privacy policy URL: REQUIRED. Not written yet. Draft and then get a professional review.

## Assets still to make
- App icon, 512 x 512 PNG
- Feature graphic, 1024 x 500 PNG
- Phone screenshots (at least 2), from the game on a phone-sized screen
- Optional: tablet screenshots

## Child-audience rules (Families policy)
The game is for children, so Google's Families rules apply. Before filling in the form:
- Target audience: children (DECIDE the age groups)
- No ads, or only child-safe ad networks with no personalized ads (DECIDE: the current build has no ads)
- No purchases until a parental gate exists (DECIDE: the current build has no purchases)
- Accounts and sign-in belong to a parent only; children cannot sign in
- The admin/stats page is parent-only

## Data safety form (draft, to check against the code)
What the game stores today, from the code and the database tables (worlds, players, game_events, game_errors, cloud_saves):
- Saved game on the device: local only, not sent anywhere
- Shared worlds: the world data is stored on the server, found by a code
- Cloud save code: stored on the server
- Gameplay logs and errors: stored on the server; must not identify a child
- Parent sign-in email: parent only; used for the stats page

Open before the form can be answered: the public write access to the database must be locked down (open issue); the exact list of fields in game_events and players must be confirmed; the privacy policy must match the answers.

## Content rating
Likely: no violence beyond cartoon monster fights, no sexual content, no gambling. Complete the questionnaire in the Play Console when the app is created.

## Before the first upload
1. Privacy policy drafted, reviewed and published at a public web address.
2. Database write access locked down.
3. Data safety answers match the privacy policy.
4. Release workflow (.github/workflows/release.yml) copies build/prototype-3d-v7.html and the package name matches.
5. Play Console: app created with the package name above; signing secrets and the APP_ID variable set in GitHub.
6. Tag a version (v0.6.53 or later) only when you decide to upload. Pushing a v-tag starts the upload to the internal test track.
