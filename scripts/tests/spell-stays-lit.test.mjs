// The Spell button stays lit after a cast (0.6.107): found in play by Nick on 27 Nov 2026 (on a PC, the fireball
// had to be chosen again before every shot). The taps themselves are checked in the browser tests. Run:
//   node --test scripts/tests/spell-stays-lit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build/prototype-3d-v7.html'), 'utf8');
const up = game.slice(game.indexOf("canvas.addEventListener('pointerup', e => {\n  if (press"), game.indexOf('// Keep digging progress in step'));

test('a cast from the lit Spell button leaves it lit and starts its 5 seconds again', () => {
  assert.ok(up.includes('fireAt(pendingCast.x, pendingCast.y);'), 'the release casts');
  const after = up.slice(up.indexOf('fireAt(pendingCast.x, pendingCast.y);'), up.indexOf('pendingFriend = false;'));
  const castLine = after.split('\n').find(l => l.includes('fireballs.length > before'));
  assert.ok(castLine, 'the release checks whether a fireball was cast');
  assert.ok(!castLine.includes('armSpell(false)'), 'a cast does not turn the Spell button off');
  assert.ok(castLine.includes('spellArmedAt = performance.now()'), 'a cast restarts the 5 seconds');
});

test('the button still goes dark when tapped again or after 5 seconds with no cast', () => {
  assert.match(game, /getElementById\('bSpell'\)\.addEventListener\('pointerdown', e => \{[^\n]*if \(spellArmed\) armSpell\(false\)/);
  assert.match(game, /performance\.now\(\) - spellArmedAt > SPELL_ARM_MS[^\n]*armSpell\(false\)/);
});

test('the guide and What is new say so', () => {
  const guide = fs.readFileSync(path.join(root, 'www/how-to-play.html'), 'utf8');
  assert.ok(guide.includes('The Spell button stays lit after a fireball'));
  assert.ok(game.includes("{ v: '0.6.107', title: 'Keep casting fireballs'"));
});
