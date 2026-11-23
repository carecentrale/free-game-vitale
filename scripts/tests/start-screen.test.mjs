// The castle loading screen and "Load my game by itself" (0.6.83).
// The save-slot code is copied out of the game file and run here, so the tests run the real code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const game = read('build/prototype-3d-v7.html');
const SLOT_CODE = game.slice(game.indexOf('const SAVE_KEY'), game.indexOf('// Open the game the menu picked'));

class FakeStorage {
  constructor(seed = {}) { this.map = new Map(Object.entries(seed)); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  key(i) { return [...this.map.keys()][i] ?? null; }
  get length() { return this.map.size; }
}
function load(local = {}, session = {}) {
  const localStorage = new FakeStorage(local), sessionStorage = new FakeStorage(session);
  const ctx = vm.createContext({ localStorage, sessionStorage, JSON, Number, String, Map, Object });
  const api = vm.runInContext(SLOT_CODE + ';({ autoLoadOn, setAutoLoad, lastSlot, startSlot })', ctx);
  return { api, localStorage, sessionStorage };
}
const save = at => JSON.stringify({ v: 1, at, name: 'Test', world: { v: 2, seed: 1, edits: [] } });
const twoSaves = { 'kidsgame.slot.0': save(5000), 'kidsgame.slot.3': save(9000), 'kidsgame.slot.7': save(1000) };

test('the switch is off at first and is kept on the device', () => {
  const { api, localStorage } = load();
  assert.equal(api.autoLoadOn(), false);
  api.setAutoLoad(true);
  assert.equal(localStorage.getItem('kidsgame.autoLoad'), '1');
  assert.equal(api.autoLoadOn(), true);
  api.setAutoLoad(false);
  assert.equal(localStorage.getItem('kidsgame.autoLoad'), null);
});

test('lastSlot is the save played last, not the lowest number', () => {
  assert.equal(load(twoSaves).api.lastSlot(), 3);
  assert.equal(load().api.lastSlot(), null);
});

test('switch off and nothing picked: no game opens (the start menu shows)', () => {
  assert.equal(load(twoSaves).api.startSlot(), null);
});

test('switch on and nothing picked: the save played last opens, and is remembered for the tab', () => {
  const { api, sessionStorage } = load({ ...twoSaves, 'kidsgame.autoLoad': '1' });
  assert.equal(api.startSlot(), 3);
  assert.equal(sessionStorage.getItem('kidsgame.choice'), '3');
});

test('a game picked in this tab wins, and "new" is never replaced by the switch', () => {
  assert.equal(load({ ...twoSaves, 'kidsgame.autoLoad': '1' }, { 'kidsgame.choice': '7' }).api.startSlot(), 7);
  assert.equal(load({ ...twoSaves, 'kidsgame.autoLoad': '1' }, { 'kidsgame.choice': 'new' }).api.startSlot(), null);
});

test('switch on with no saved games: nothing opens (the new-player questions show)', () => {
  assert.equal(load({ 'kidsgame.autoLoad': '1' }).api.startSlot(), null);
});

test('the loading screen is the first thing on the page, lets taps through and can never stay for good', () => {
  const body = game.slice(game.indexOf('<body>'));
  assert.ok(body.indexOf('<div id="splash"') < 400, 'the loading screen should be right after <body>');
  assert.match(game, /#splash\{[^}]*pointer-events:none/);
  assert.match(game, /setTimeout\(function\(\)\{var e=document\.getElementById\('splash'\);if\(e\)e\.remove\(\);\},20000\)/);
  assert.match(game, /src="\.\.\/splash\/castle\.png"/);
});

test('the loading screen waits for the first picture and the first new-version check', () => {
  const tail = game.slice(game.indexOf('const SPLASH_MIN_MS'));
  assert.match(tail, /updFirstCheck\.catch/);
  assert.match(tail, /requestAnimationFrame/);
  assert.match(tail, /hideSplash\(\); updTick\(\);/);
});

test('the castle picture is a PNG with a see-through background, small enough to load at once', () => {
  const png = fs.readFileSync(path.join(root, 'www', 'splash', 'castle.png'));
  assert.equal(png.slice(1, 4).toString(), 'PNG');
  assert.equal(png[25], 6, 'colour type 6: RGBA');
  assert.ok(png.length < 100 * 1024, 'under 100 KB, got ' + png.length);
});

test('the start menu and Settings offer the same choice', () => {
  assert.match(game, /id="autoLoadBox"/);
  assert.match(game, /Load my game by itself next time/);
  assert.match(game, /id="autoLoadSwitch"/);
  assert.match(game, /id="slotLoad" data-play=/);
});

test('the game page on the site is the build file', () => {
  assert.equal(read('www/play/index.html'), game);
});
