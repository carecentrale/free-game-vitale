// Tests for the saved-games logic in build/prototype-3d-v7.html.
// The code is copied out of the game file at test time, so the tests run the real code, not a copy.
// Run from the repository root:  node --test scripts/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');

// The save-slot block: from the SAVE_KEY constant up to the line that opens the saved-game choice.
function extractSlotCode() {
  const start = game.indexOf('const SAVE_KEY');
  const end = game.indexOf('// Open the game the menu picked');
  if (start < 0 || end < 0 || end <= start) throw new Error('save-slot code markers not found in the game file');
  return game.slice(start, end);
}
const SLOT_CODE = extractSlotCode();

// A stand-in for localStorage / sessionStorage with the same methods the game uses
class FakeStorage {
  constructor(seed = {}) { this.map = new Map(Object.entries(seed)); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  key(i) { return [...this.map.keys()][i] ?? null; }
  get length() { return this.map.size; }
}

// Runs the save-slot code in a fresh context. Storage is seeded before the code runs,
// so the legacy-save migration at the top of the block is exercised too.
function load(seedLocal = {}, seedSession = {}) {
  const localStorage = new FakeStorage(seedLocal);
  const sessionStorage = new FakeStorage(seedSession);
  const ctx = vm.createContext({ localStorage, sessionStorage, JSON, Number, String, Map, Object });
  const api = vm.runInContext(
    SLOT_CODE + `
;({ SLOT_MAX, slotKey, readSlot, listSlots, freeSlot, getChoice, setChoice, SAVE_KEY })`,
    ctx
  );
  return { api, localStorage, sessionStorage };
}

const save = (world, extra = {}) => JSON.stringify({ v: 1, world, name: 'Test', ...extra });

test('the safety cap is 100 saved games', () => {
  const { api } = load();
  assert.equal(api.SLOT_MAX, 100);
});

test('the old single save moves into slot 0 and the old key is removed', () => {
  const legacy = save('AAAA');
  const { api, localStorage } = load({ [api_legacyKey()]: legacy });
  assert.equal(localStorage.getItem('kidsgame.slot.0'), legacy);
  assert.equal(localStorage.getItem(api.SAVE_KEY), null);
});

test('the old save is not overwritten when slot 0 already exists', () => {
  const kept = save('KEEP');
  const { localStorage } = load({
    'kidsgame.save.v1': save('OLD'),
    'kidsgame.slot.0': kept,
  });
  assert.equal(localStorage.getItem('kidsgame.slot.0'), kept);
});

test('listSlots returns only real saves, sorted by number, and ignores other keys', () => {
  const { api } = load({
    'kidsgame.slot.5': save('FIVE'),
    'kidsgame.slot.0': save('ZERO'),
    'kidsgame.slot.1': 'not json {',        // corrupt: not listed
    'kidsgame.slot.2': JSON.stringify({ v: 1 }), // no world: not listed
    'kidsgame.pid': 'abc123',              // another game key: ignored
    'kidsgame.choice': '0',
  });
  // Array.from copies the list out of the test sandbox so it compares as a normal array
  const nums = Array.from(api.listSlots(), s => s.n);
  assert.deepEqual(nums, [0, 5]);
  assert.equal(api.listSlots()[1].d.world, 'FIVE');
});

test('freeSlot returns the first unused number', () => {
  const { api } = load({
    'kidsgame.slot.0': save('A'),
    'kidsgame.slot.1': save('B'),
    'kidsgame.slot.3': save('C'),
  });
  assert.equal(api.freeSlot(), 2);
});

test('freeSlot returns 0 when there are no saves', () => {
  const { api } = load();
  assert.equal(api.freeSlot(), 0);
});

test('freeSlot returns null once the cap of 100 saves is reached', () => {
  const seed = {};
  for (let n = 0; n < 100; n++) seed['kidsgame.slot.' + n] = save('W' + n);
  const { api } = load(seed);
  assert.equal(api.listSlots().length, 100);
  assert.equal(api.freeSlot(), null);
});

test('freeSlot still finds a gap while under the cap', () => {
  const seed = {};
  for (let n = 0; n < 100; n++) if (n !== 42) seed['kidsgame.slot.' + n] = save('W' + n);
  const { api } = load(seed);
  assert.equal(api.freeSlot(), 42);
});

test('the chosen game is remembered for the tab, and can be cleared', () => {
  const { api } = load();
  assert.equal(api.getChoice(), null);
  api.setChoice(3);
  assert.equal(api.getChoice(), '3');
  api.setChoice('new');
  assert.equal(api.getChoice(), 'new');
  api.setChoice(null);
  assert.equal(api.getChoice(), null);
});

// The legacy key name, read from the game file so the test does not hard-code it twice
function api_legacyKey() {
  const m = game.match(/const SAVE_KEY = '([^']+)'/);
  if (!m) throw new Error('SAVE_KEY not found');
  return m[1];
}

test('saves made since 0.6.34 (world as an object) are listed', () => {
  const newFormat = JSON.stringify({ v: 1, name: 'New', world: { v: 2, seed: 7, edits: [] } });
  const { api } = load({ 'kidsgame.slot.2': newFormat });
  const list = Array.from(api.listSlots(), s => s.n);
  assert.deepEqual(list, [2]);
});

