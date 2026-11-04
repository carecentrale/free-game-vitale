// Tests for the world in build/prototype-3d-v7.html: terrain from a seed, edits, saves and old-world import.
// The world code is copied out of the game file at test time, so the tests run the real code.
// Run from the repository root:  node --test scripts/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');

const start = game.indexOf('// ---- World: 400,000');
const end = game.indexOf('// ---- Saving: the character', start);
if (start < 0 || end < 0) throw new Error('world code markers not found in the game file');

// `dirty` now lives inside the world code (0.6.42), so nothing needs to be added in front of it
const prefix = '';
const api = `
;({ WORLD, CENTER, H, T, chunks, edited, initWorld, get, setBlock, groundY, encodeWorld, applyWorld, applyOld, loadShared, getSeed: () => seed, isDirty: () => dirty, clearDirty: () => { dirty = false; } })`;
const ctx = vm.createContext({
  Math, Uint8Array, Map, Set, JSON, Number, String,
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  bytesToB64: u8 => Buffer.from(u8).toString('base64'),
});
const W = vm.runInContext(prefix + game.slice(start, end) + api, ctx);

const at = (x, z) => { for (let y = W.H - 1; y >= 0; y--) if (W.get(x, y, z) !== W.T.AIR) return y; return -1; };

test('the world is 400,000 blocks wide, with the start in the middle', () => {
  assert.equal(W.WORLD, 400000);
  assert.equal(W.CENTER, 200000);
});

test('the same seed always makes the same ground', () => {
  W.initWorld(4242);
  const a = [], b = [];
  for (let i = 0; i < 40; i++) a.push(at(W.CENTER + i * 3, W.CENTER + i * 2));
  W.initWorld(4242);
  for (let i = 0; i < 40; i++) b.push(at(W.CENTER + i * 3, W.CENTER + i * 2));
  assert.deepEqual(a, b);
});

test('a different seed makes different ground', () => {
  W.initWorld(1);
  const a = [];
  for (let i = 0; i < 60; i++) a.push(at(W.CENTER + i, W.CENTER + i));
  W.initWorld(99991);
  const b = [];
  for (let i = 0; i < 60; i++) b.push(at(W.CENTER + i, W.CENTER + i));
  assert.notDeepEqual(a, b);
});

test('the ground stays within the expected height range', () => {
  W.initWorld(777);
  for (let i = 0; i < 300; i++) {
    const g = W.groundY(W.CENTER + i * 7, W.CENTER - i * 5);
    assert.ok(g >= 3 && g <= W.H - 6, `ground out of range: ${g}`);
  }
});

test('the middle of the world is land, so the player can spawn there', () => {
  for (const s of [1, 2, 777]) {
    W.initWorld(s);
    assert.ok(at(W.CENTER, W.CENTER) >= 8, `no land in the middle (seed ${s})`);
  }
});

test('past the world edge is solid stone, and above the top is open air', () => {
  W.initWorld(1);
  assert.equal(W.get(-1, 5, 10), W.T.STONE);
  assert.equal(W.get(W.WORLD, 5, 10), W.T.STONE);
  assert.equal(W.get(W.CENTER, W.H, W.CENTER), W.T.AIR);
});

test('far from the start only a few chunks are made, so the world stays cheap', () => {
  W.initWorld(3);
  for (let i = 0; i < 50; i++) W.get(W.CENTER + i * 997, 5, W.CENTER - i * 811);
  assert.ok(W.chunks.size <= 50, `too many chunks: ${W.chunks.size}`);
});

test('a changed block is saved and comes back the same after loading', () => {
  W.initWorld(55);
  const x = W.CENTER + 3, z = W.CENTER + 4;
  W.setBlock(x, 9, z, W.T.GEM);
  assert.equal(W.isDirty(), true);
  W.clearDirty();
  const saved = JSON.parse(JSON.stringify(W.encodeWorld()));
  assert.equal(saved.v, 2);
  assert.equal(saved.seed, 55);
  W.initWorld(999);
  assert.equal(W.get(x, 9, z) === W.T.GEM, false, 'a new seed should not have the change');
  W.applyWorld(saved);
  assert.equal(W.getSeed(), 55);
  assert.equal(W.get(x, 9, z), W.T.GEM);
});

test('only changed chunks are saved, not the whole world', () => {
  W.initWorld(8);
  W.setBlock(W.CENTER + 1, 4, W.CENTER + 1, W.T.DIRT);
  W.get(W.CENTER + 200, 4, W.CENTER + 200);   // generated but not changed
  assert.equal(W.encodeWorld().edits.length, 1);
});

test('an old 40 x 40 save is copied into the middle of the new world', () => {
  const H = W.H, n = 40;
  const bytes = new Uint8Array(n * H * n);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i % 3 === 0) ? W.T.DIRT : W.T.AIR;
  const b64 = Buffer.from(bytes).toString('base64');
  assert.equal(W.applyOld(b64, 12), true);
  const x = 5, y = 7, z = 9;
  assert.equal(W.get(W.CENTER + x, y, W.CENTER + z), bytes[(y * n + z) * n + x]);
});

test('a wrong-size old save is refused', () => {
  assert.equal(W.applyOld(Buffer.from([1, 2, 3]).toString('base64'), 12), false);
});

test('a shared world in the new format loads; text that is neither format is refused', () => {
  W.initWorld(21);
  W.setBlock(W.CENTER, 6, W.CENTER, W.T.STONE);
  const text = JSON.stringify(W.encodeWorld());
  W.initWorld(1);
  assert.equal(W.loadShared(text, 'ABCD'), true);
  assert.equal(W.getSeed(), 21);
  assert.equal(W.loadShared('not a world', 'ABCD'), false);
});

test('a change saved in a shorter world (before the world got taller) is kept', () => {
  const CS = 16, shortH = 64;
  const data = new Uint8Array(CS * shortH * CS);
  const lx = 1, y = 5, lz = 2;
  data[(y * CS + lz) * CS + lx] = W.T.DIRT;
  const cx = W.CENTER / CS + 10, cz = W.CENTER / CS + 12;   // inside the playable area, near the start
  const save = { v: 2, seed: 31, edits: [[cx, cz, Buffer.from(data).toString('base64')]] };
  W.applyWorld(save);
  assert.equal(W.get(cx * CS + lx, y, cz * CS + lz), W.T.DIRT);
  assert.equal(W.get(cx * CS + lx, W.H - 1, cz * CS + lz) === W.T.DIRT, false);
});

test('water fills the low ground, and sand lines the water\'s edge', () => {
  W.initWorld(4242);
  assert.equal(W.get(200052, 8, 199970), W.T.WATER, 'low ground next to the shore is water');
  assert.equal(W.get(200057, 8, 199970), W.T.SAND, 'the shore block at the water\'s edge is sand');
});

// ---- Scenery (trees, bushes, flowers...) on grass. The rule is pure, so it is tested here.
const DECOR_CLEAR_TEST = 6;
const ctx2 = vm.createContext({
  Math, Uint8Array, Map, Set, JSON, Number, String,
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  bytesToB64: u8 => Buffer.from(u8).toString('base64'),
});
const W2 = vm.runInContext(prefix + game.slice(start, end) + `
;({ decorAt, DECOR_KINDS, DECOR_CLEAR, CENTER, WATER_Y, initWorld, groundY, get, T, CS, H, BIOMES, biomeIndexAt })`, ctx2);

test('every scenery kind has model files, and each biome\'s shares add up to less than half its surface', () => {
  for (const d of W2.DECOR_KINDS) assert.ok(d.files.length > 0, d.kind + ' has no model files');
  for (const b of W2.BIOMES) {
    const total = Object.values(b.shares).reduce((s, v) => s + v, 0);
    assert.ok(total > 0 && total < 0.5, b.name + ' shares add up to ' + total);
    for (const kind of Object.keys(b.shares)) assert.ok(W2.DECOR_KINDS.some(d => d.kind === kind), b.name + ' uses unknown scenery ' + kind);
  }
});

// ---- Biomes: climate regions that blend into each other
test('the world has several biomes, not one', () => {
  W2.initWorld(4242);
  const seen = new Set();
  for (let x = -1000; x <= 1000; x += 25) for (let z = -1000; z <= 1000; z += 25) seen.add(W2.BIOMES[W2.biomeIndexAt(W2.CENTER + x, W2.CENTER + z)].name);
  assert.ok(seen.size >= 5, 'only ' + seen.size + ' biomes found: ' + [...seen].join(', '));
});

test('biomes blend: neighbouring columns mostly match, and some borders mix', () => {
  W2.initWorld(4242);
  let pairs = 0, changes = 0;
  for (let x = -300; x < 300; x += 2) for (let z = -300; z < 300; z += 2) {
    const a = W2.biomeIndexAt(W2.CENTER + x, W2.CENTER + z);
    const b = W2.biomeIndexAt(W2.CENTER + x + 2, W2.CENTER + z);
    pairs++;
    if (a !== b) changes++;
  }
  const share = changes / pairs;
  assert.ok(changes > 0, 'no border between biomes was found');
  assert.ok(share < 0.2, 'biomes change too often (' + share.toFixed(3) + ') — they look sporadic');
});

test('the same seed makes the same biomes', () => {
  W2.initWorld(4242);
  const a = [], b = [];
  for (let i = 0; i < 300; i++) a.push(W2.biomeIndexAt(W2.CENTER + i * 13, W2.CENTER - i * 7));
  W2.initWorld(4242);
  for (let i = 0; i < 300; i++) b.push(W2.biomeIndexAt(W2.CENTER + i * 13, W2.CENTER - i * 7));
  assert.deepEqual(a, b);
});

function findBiome(name) {
  for (let x = -1000; x <= 1000; x += 25) for (let z = -1000; z <= 1000; z += 25) {
    const X = W2.CENTER + x, Z = W2.CENTER + z;
    if (W2.BIOMES[W2.biomeIndexAt(X, Z)].name === name && W2.groundY(X, Z) >= W2.WATER_Y) return { x: X, z: Z, top: W2.groundY(X, Z) };
  }
  return null;
}

test('desert ground is sand and tundra ground is snow', () => {
  W2.initWorld(4242);
  const d = findBiome('desert'), t = findBiome('tundra');
  assert.ok(d, 'no desert found near the start');
  assert.ok(t, 'no tundra found near the start');
  assert.equal(W2.get(d.x, d.top, d.z), W2.T.SAND, 'desert surface is sand');
  assert.equal(W2.get(t.x, t.top, t.z), W2.T.SNOW, 'tundra surface is snow');
});

test('no scenery within the clear area around the start point', () => {
  W2.initWorld(4242);
  for (let dx = -DECOR_CLEAR_TEST; dx <= DECOR_CLEAR_TEST; dx++) for (let dz = -DECOR_CLEAR_TEST; dz <= DECOR_CLEAR_TEST; dz++) {
    if (Math.hypot(dx, dz) >= DECOR_CLEAR_TEST) continue;
    const x = W2.CENTER + dx, z = W2.CENTER + dz;
    const top = W2.groundY(x, z);
    assert.equal(W2.decorAt(x, top, z), null, `scenery too close to the start at ${x},${z}`);
  }
});

test('scenery is the same every time for the same place and seed', () => {
  W2.initWorld(4242);
  const pts = [];
  for (let i = 0; i < 200; i++) pts.push([W2.CENTER + 20 + i * 3, W2.CENTER + 15 + i * 2]);
  const a = pts.map(([x, z]) => JSON.stringify(W2.decorAt(x, W2.groundY(x, z), z)));
  W2.initWorld(4242);
  const b = pts.map(([x, z]) => JSON.stringify(W2.decorAt(x, W2.groundY(x, z), z)));
  assert.deepEqual(a, b);
});

test('scenery never sits under water, and only some grass gets it', () => {
  W2.initWorld(4242);
  let grass = 0, decorated = 0;
  for (let x = W2.CENTER + 40; x < W2.CENTER + 200; x++) for (let z = W2.CENTER + 40; z < W2.CENTER + 140; z++) {
    const top = W2.groundY(x, z);
    if (top < W2.WATER_Y) {
      assert.equal(W2.decorAt(x, top, z), null, 'scenery under water at ' + x + ',' + z);
      continue;
    }
    grass++;
    if (W2.decorAt(x, top, z)) decorated++;
  }
  const share = decorated / grass;
  assert.ok(share > 0.02 && share < 0.25, 'share of grass with scenery is ' + share.toFixed(3));
});
