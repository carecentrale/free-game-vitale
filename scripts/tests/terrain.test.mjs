// Tests for the terrain generator in build/prototype-3d-v7.html.
// The generator code is copied out of the game file at test time, so the tests run the real code.
// Run from the repository root:  node --test scripts/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');

function pick(start, end) {
  const a = game.indexOf(start);
  if (a < 0) throw new Error('marker not found: ' + start);
  const b = game.indexOf(end, a);
  if (b < 0) throw new Error('end marker not found: ' + end);
  return game.slice(a, b);
}
const code = [
  pick('const W = 40', '\nconst T ='),
  pick('const T =', '\n'),
  pick('const grid =', '\n'),
  pick('const idx =', '\n'),
  pick('// ---- Terrain generation', '// ---- Saving:'),
].join('\n');
const ctx = vm.createContext({ Math, Uint8Array });
vm.runInContext(code + '\n;globalThis.gen_ = { gen, grid, W, H, D, T, idx };', ctx);
const { gen, grid, W, H, D, T, idx } = ctx.gen_;

// The height of each column (index of its top solid block), as a plain array
function surface(seed) {
  gen(seed);
  const tops = [];
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    let top = -1;
    for (let y = H - 1; y >= 0; y--) if (grid[idx(x, y, z)] !== T.AIR) { top = y; break; }
    tops.push(top);
  }
  return tops;
}

test('two different seeds give two different islands', () => {
  const a = surface(1), b = surface(2);
  assert.notDeepEqual(a, b);
});

test('the same seed always gives the same island', () => {
  const a = surface(4242), b = surface(4242);
  assert.deepEqual(a, b);
});

test('every column has ground, and the ground stays inside the grid', () => {
  for (const seed of [1, 777, 123456, 999999]) {
    for (const top of surface(seed)) {
      assert.ok(top >= 3, `column too low (seed ${seed}): ${top}`);
      assert.ok(top <= H - 6, `column too high for the caves (seed ${seed}): ${top}`);
    }
  }
});

test('the middle of the island is land, so the player can spawn there', () => {
  for (const seed of [1, 2, 777, 123456, 999999]) {
    gen(seed);
    let top = -1;
    for (let y = H - 1; y >= 0; y--) if (grid[idx(W >> 1, y, D >> 1)] !== T.AIR) { top = y; break; }
    assert.ok(top >= 8, `middle too low (seed ${seed}): ${top}`);
  }
});

test('the land slopes down toward the rim, so it reads as an island', () => {
  for (const seed of [1, 777, 123456]) {
    const tops = surface(seed);
    const at = (x, z) => tops[x * D + z];
    const middle = at(W >> 1, D >> 1);
    const rim = at(0, D >> 1);
    assert.ok(middle > rim, `rim is not lower than the middle (seed ${seed}): middle ${middle}, rim ${rim}`);
  }
});

test('the island has gems and caves, but is not solid stone or empty', () => {
  for (const seed of [1, 777]) {
    gen(seed);
    let gems = 0, air = 0;
    for (let i = 0; i < grid.length; i++) { if (grid[i] === T.GEM) gems++; if (grid[i] === T.AIR) air++; }
    assert.ok(gems > 0, 'no gems');
    assert.ok(air > grid.length / 2, 'the world should be mostly open air above the ground');
  }
});
