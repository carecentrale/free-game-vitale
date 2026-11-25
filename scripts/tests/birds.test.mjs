// Birds for every part of the world (0.6.97, SPEC-034): the rules in the code. Where the birds live and how they fly
// is checked in the browser tests. Run:  node --test scripts/tests/birds.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');
const code = game.slice(game.indexOf('// ---- Birds for every part of the world (0.6.97'), game.indexOf('// Green leaves that fly off the tree'));
const plain = code.replace(/\/\/.*$/gm, '');

test('eight kinds, made in code, each with its parts of the world', () => {
  for (const k of ['songbird', 'parrot', 'owl', 'duck', 'penguin', 'gull', 'geese', 'hawk']) assert.match(code, new RegExp('\\b' + k + ': +\\{ n: \\['));
  assert.match(code, /BIRD_HOME = \{ songbird: \['grassland', 'forest', 'savanna', 'taiga'\], parrot: \['rainforest'\], owl: \['forest', 'taiga'\], duck: BIRD_DUCK_LAND, penguin: \['tundra'\]/);
  assert.match(code, /desert: \[\['hawk', 0\.3\]\]/, 'in the desert the hawk is the only bird');
  assert.ok(!/loadModel|\.glb|\.png|https?:|<img/i.test(plain), 'a bird uses a file');
  assert.match(code, /BIRD_CELL = 56, BIRD_SEE = 80, BIRD_MOST = 40/);
});

test('nothing about birds is saved, sent or recorded, and birds cannot be hit, caught or collected', () => {
  for (const word of ['logEvent', 'logOnce', 'saveGame', 'localStorage', 'sendSync', 'channel', 'fetch(', 'sb.', 'addItem', 'gain(', 'hurtEnemy', 'userData.enemy', 'setBlock', 'writeBlock'])
    assert.ok(!plain.includes(word), 'the bird code uses ' + word);
});

test('moving away: 5 blocks (owls 3), from a landing dragon within 15, to a place 20 to 40 blocks off and never onto a player; the test switch', () => {
  assert.match(code, /songbird: +\{[^}]*flee: 5/); assert.match(code, /owl: +\{[^}]*flee: 3/); assert.match(code, /hawk: +\{[^}]*flee: 0/); assert.match(code, /geese: +\{[^}]*flee: 0/);
  assert.match(code, /Math\.hypot\(E\.lx - home\.hx, E\.lz - home\.hz\) < 15/);
  assert.match(code, /for \(const dist of \[30, 24, 38\]\)/);
  assert.match(code, /birds=\(songbird\|parrot\|owl\|duck\|penguin\|gull\|geese\|hawk\|off\)/);
  assert.ok(fs.readFileSync(path.join(root, 'www', 'how-to-play.html'), 'utf8').includes('Every part of the world has its own birds!'));
});
