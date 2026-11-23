// The privacy page describes gameplay records (by category since 23 Nov 2026), and no record carries a name (0.6.87). docs/EVENTS.md itself is checked by events.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');
const privacy = fs.readFileSync(path.join(root, 'www', 'privacy.html'), 'utf8');
const kinds = [...new Set([...game.matchAll(/log(?:Event|Once)\('([a-z_]+)'/g)].map(m => m[1]))].sort();

// 23 Nov 2026 (Nick's decision): the privacy page describes gameplay records by category, not by listing every kind.
// docs/EVENTS.md lists every kind and points each to "Gameplay records" (checked by events.test.mjs).
test('the privacy page describes gameplay records by category: what they hold, and that they never hold a name', () => {
  const row = privacy.slice(privacy.indexOf('<td>Gameplay records</td>'), privacy.indexOf('</tr>', privacy.indexOf('<td>Gameplay records</td>')));
  assert.ok(row.length > 100, 'no Gameplay records row on the privacy page');
  for (const words of ['visit code', 'world code', 'game version', 'Never a name', 'For safety']) assert.ok(row.includes(words), 'the row should say: ' + words);
});

test('every gameplay record kind points to the Gameplay records row in docs/EVENTS.md', () => {
  const events = fs.readFileSync(path.join(root, 'docs', 'EVENTS.md'), 'utf8');
  for (const k of kinds) {
    const line = events.split('\n').find(l => l.startsWith('| `' + k + '` |'));
    assert.ok(line, k + ' is not in docs/EVENTS.md');
    assert.match(line, /"Gameplay records"/, k + ' should point to "Gameplay records"');
  }
});

test('tracking records never carry a name: the details are visit codes, counts and game words', () => {
  for (const m of game.matchAll(/log(?:Event|Once)\('[a-z_]+'([^;]*)/g)) assert.doesNotMatch(m[1], /playerName|\.name\b|safeName/, m[0]);
});
