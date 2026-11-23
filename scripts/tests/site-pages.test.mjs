// Website pages that must keep up with the game:
//   www/release-notes.html  is written by scripts/site-pages.mjs from the game's own list of changes, and must be up to date
//   www/how-to-play.html    the guide: it must carry the game's current version, so no version ships without a look at the guide
// Run from the repository root:  node --test scripts/tests/site-pages.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameHistory, gameVersion, releaseNotesPage, GAME_FILE, NOTES_FILE, PLAY_PUBLIC } from '../site-pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const game = read(GAME_FILE);
const VERSION = gameVersion(game);
const guide = read('www/how-to-play.html');

test('the game history is read from the game file, newest first, and starts with the current version', () => {
  const list = gameHistory(game);
  assert.equal(list[0].v, VERSION);
  assert.ok(list.length > 50);
});

test('the release notes page is up to date (run: node scripts/site-pages.mjs)', () => {
  assert.equal(read(NOTES_FILE), releaseNotesPage(gameHistory(game)), 'www/release-notes.html does not match the game history: run node scripts/site-pages.mjs');
});

test('the release notes page shows the newest version and escapes its text', () => {
  const page = releaseNotesPage([{ v: '9.9.9', title: 'A <b> & "test"', items: ['One <i>item</i>'] }]);
  assert.match(page, /<span class="ver">9\.9\.9<\/span> A &lt;b&gt; &amp; &quot;test&quot;/);
  assert.match(page, /<li>One &lt;i&gt;item&lt;\/i&gt;<\/li>/);
  assert.ok(!page.includes('<i>item'));
});

test('a history entry with no items is refused', () => {
  assert.throws(() => gameHistory("const GAME_HISTORY = [\n  { v: '1.0.0', title: 'x', items: [] }\n];"));
});

test('the guide carries the current game version (update www/how-to-play.html with every version)', () => {
  assert.equal(guide.match(/<meta name="guide-version" content="([^"]+)">/)?.[1], VERSION, 'Read the guide, add what this version changed, then set guide-version');
  assert.equal(guide.match(/<span id="guideVersion">([^<]+)<\/span>/)?.[1], VERSION);
});

test('every part in the guide\'s list exists on the page', () => {
  const links = [...guide.matchAll(/<li><a href="#([a-z]+)">/g)].map(m => m[1]);
  assert.ok(links.length >= 15);
  for (const id of links) assert.ok(guide.includes(`<h2 id="${id}">`), 'missing part: ' + id);
});

test('the guide explains the parental controls: how to open the parent area and what is in it', () => {
  const part = guide.slice(guide.indexOf('<h2 id="grownups">'));
  for (const word of ['Parent area', '5 times', 'Open parent stats', 'Sign in with Google', 'Sign in with Facebook', 'Save now', 'Load saved game from the cloud', 'Delete cloud save', 'Sign out']) {
    assert.ok(part.includes(word), 'the parental controls part does not mention: ' + word);
  }
});

test('every button the guide names in the parent area is in the game', () => {
  for (const label of ['Open parent stats', 'Sign in with Google', 'Sign in with Facebook', 'Save now', 'Load saved game from the cloud', 'Delete cloud save', 'Sign out']) {
    assert.ok(game.includes('>' + label + '<'), 'the game has no button: ' + label);
  }
});

test('the home page, the guide and the release notes link to each other', () => {
  const home = read('www/index.html');
  assert.ok(home.includes('href="/how-to-play.html"') && home.includes('href="/release-notes.html"'));
  assert.ok(guide.includes('href="/release-notes.html"') && guide.includes('href="/play/"'));
  assert.ok(read(NOTES_FILE).includes('href="/how-to-play.html"'));
});

test('the new pages lead nowhere outside the site', () => {
  for (const p of ['www/how-to-play.html', NOTES_FILE]) {
    const out = [...read(p).matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]).filter(u => !u.startsWith('/') && !u.startsWith('#'));
    assert.deepEqual(out, [], p + ' has outside links');
  }
});

test('the home page shows the Google Play badge only once the game is public on Google Play (SPEC-013)', () => {
  const home = read('www/index.html');
  assert.ok(home.includes('href="/play/"'), 'the Play now button is gone');
  // PLAY_PUBLIC in scripts/site-pages.mjs is set to true on the day the game is public on Google Play
  if (PLAY_PUBLIC) assert.ok(home.includes('href="https://play.google.com/store/apps/details?id=com.drenerics.adventurers"'), 'no Play Store link with the app id');
  else assert.ok(!home.includes('play.google.com') && !/coming soon[^<]*google play|google play[^<]*coming soon/i.test(home), 'the badge shows, or says coming soon, before the game is public');
});
