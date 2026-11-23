// Every kind of tracking record the game makes is listed in docs/EVENTS.md and is described on the privacy page (0.6.87).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');
const events = fs.readFileSync(path.join(root, 'docs', 'EVENTS.md'), 'utf8');
const privacy = fs.readFileSync(path.join(root, 'www', 'privacy.html'), 'utf8');
const kinds = [...new Set([...game.matchAll(/log(?:Event|Once)\('([a-z_]+)'/g)].map(m => m[1]))].sort();

test('every kind of tracking record in the game is listed in docs/EVENTS.md', () => {
  assert.ok(kinds.length >= 14, 'kinds found: ' + kinds.join(', '));
  for (const k of kinds) assert.match(events, new RegExp('\\| `' + k + '` \\|'), k + ' is not in docs/EVENTS.md');
});

test('the privacy page names every kind of tracking record (Gameplay records row)', () => {
  const row = privacy.slice(privacy.indexOf('<td>Gameplay records</td>'), privacy.indexOf('</tr>', privacy.indexOf('<td>Gameplay records</td>')));
  for (const k of kinds) assert.ok(row.includes('<code>' + k + '</code>'), k + ' is not on the privacy page');
});

test('tracking records never carry a name: the details are visit codes, counts and game words', () => {
  for (const m of game.matchAll(/log(?:Event|Once)\('[a-z_]+'([^;]*)/g)) assert.doesNotMatch(m[1], /playerName|\.name\b|safeName/, m[0]);
});
