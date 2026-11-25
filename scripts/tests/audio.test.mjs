// Sound and music rules (hand-off 002, game 0.6.60). These read the files; they do not need a browser.
// Every audio file must have a row in docs/ASSETS.md, a saved licence page, an allowed licence and a credit,
// and must stay inside the size limits. Run from the repository root:  node --test scripts/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioRows, creditsJson, termsBlock, creditText, COLUMNS, START, END } from '../audio-credits.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const game = read('build/prototype-3d-v7.html');
const terms = read('www/terms.html');
const rows = audioRows(read('docs/ASSETS.md'));
const audioDir = path.join(root, 'www', 'audio');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const files = walk(audioDir).map(f => path.relative(audioDir, f).split(path.sep).join('/')).filter(f => f !== 'credits.json');
const SOUND_KEYS = JSON.parse(game.match(/const SOUND_KEYS = (\[[^\]]+\]);/)[1].replaceAll("'", '"'));

test('every audio file in the build has a row in docs/ASSETS.md, and every row has its file', () => {
  assert.deepEqual([...files].sort(), rows.map(r => r.file).sort());
});

test('every audio row is complete, has an allowed licence and a saved copy of its licence page', () => {
  for (const r of rows) {
    for (const k of COLUMNS) assert.ok(r[k], `${r.file}: "${k}" is empty`);
    assert.match(r.licence, /^(Public domain|CC0|CC BY)\b/i, `${r.file}: licence "${r.licence}" is not public domain, CC0 or CC BY`);
    assert.ok(!/\b(NC|ND|SA)\b/.test(r.licence), `${r.file}: NC, ND and SA licences are not allowed`);
    assert.match(r.source, /^https:\/\//, `${r.file}: the source must be a web address`);
    assert.match(r.licenceLink, /^https:\/\//, `${r.file}: the licence link must be a web address`);
    assert.ok(r.use === 'music' || SOUND_KEYS.includes(r.use), `${r.file}: use "${r.use}" is not "music" or a sound the game knows`);
    assert.ok(fs.existsSync(path.join(root, 'docs', 'licences', r.licenceCopy)), `${r.file}: docs/licences/${r.licenceCopy} is missing`);
  }
  const uses = rows.filter(r => r.use !== 'music').map(r => r.use);
  assert.equal(new Set(uses).size, uses.length, 'two files are listed for the same sound');
});

test('the credits in Settings and on the terms page are built from the audio table and are up to date', () => {
  assert.equal(read('www/audio/credits.json'), creditsJson(rows), 'www/audio/credits.json is out of date: run node scripts/audio-credits.mjs');
  const a = terms.indexOf('  ' + START), b = terms.indexOf(END);
  assert.ok(a >= 0 && b > a, 'www/terms.html has no audio-credits block');
  assert.equal(terms.slice(a, b + END.length), termsBlock(rows), 'the credits on www/terms.html are out of date: run node scripts/audio-credits.mjs');
  for (const r of rows) assert.ok(read('www/audio/credits.json').includes(JSON.stringify(creditText(r))), r.file + ' has no credit');
});

test('audio files stay inside the size limits', () => {
  const size = f => fs.statSync(path.join(audioDir, f)).size;
  const music = rows.filter(r => r.use === 'music').map(r => r.file), effects = rows.filter(r => r.use !== 'music').map(r => r.file);
  for (const f of music) assert.ok(size(f) <= 1.5 * 1024 * 1024, `${f} is over 1.5 MB`);
  for (const f of effects) assert.ok(size(f) <= 40 * 1024, `${f} is over 40 KB`);
  assert.ok(music.reduce((n, f) => n + size(f), 0) <= 6 * 1024 * 1024, 'the music is over 6 MB in total');
  assert.ok(effects.reduce((n, f) => n + size(f), 0) <= 600 * 1024, 'the effects are over 600 KB in total');
});

test('each sound has a place in the game that asks for it, and the game asks only for sounds it knows', () => {
  // "hurt" has no place yet: monsters never hurt the player
  for (const k of SOUND_KEYS.filter(k => k !== 'hurt')) assert.ok(new RegExp(`sfx\\([^)]*'${k}'`).test(game), `nothing in the game plays "${k}"`);
  for (const m of game.matchAll(/sfx\('([a-z]+)'\)/g)) assert.ok(SOUND_KEYS.includes(m[1]), `the game asks for an unknown sound "${m[1]}"`);
});

test('all audio comes from our own site, and none of it is in the first load', () => {
  assert.match(game, /const AUDIO_BASE = new URL\('\.\.\/audio\/', location\.href\)\.href;/);
  const made = [...game.matchAll(/new Audio\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(made.length >= 2 && made.every(a => a.startsWith('AUDIO_BASE + ')), 'an audio player is made with an address that is not under www/audio/: ' + made.join(' | '));
  assert.ok(!/<audio|rel="preload"[^>]*audio/i.test(game), 'the page loads audio at the start');
  assert.match(game, /if \(!audioStarted \|\| audioQuit \|\| document\.hidden \|\| !vol\.sfx \|\| !audioList\) return;/, 'effects must wait for the first input');
  assert.match(game, /localStorage\.setItem\('kidsgame\.audio'/, 'the volume levels are kept on the device');
});

test('the terms page has the music and sounds wording and its new date', () => {
  assert.ok(terms.includes('Some models, artwork, music and sounds were made by others and are used under their own licences.'));
  assert.ok(terms.includes('Music and sounds. The music in the Game is classical music whose compositions are in the public domain.'));
  assert.ok(terms.includes('The sound effects are by Kenney (kenney.nl) and are released under Creative Commons CC0.'));
  assert.ok(terms.includes('Last updated: 25 November 2026'));   // 0.6.72: the Twemoji credit was added; 0.6.90: terms for parents (SPEC-039)
});
