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
