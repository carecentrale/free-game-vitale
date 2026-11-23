// 0.6.85: not starting inside the ground when joining a world, notes when players come and go, the player count and the map.
// The code is copied out of the game file at test time, so the tests run the real code, not a copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');

function between(a, b) {
  const s = game.indexOf(a), e = game.indexOf(b, s);
  if (s < 0 || e < 0) throw new Error('markers not found: ' + a);
  return game.slice(s, e);
}
const T = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, GEM: 4, WATER: 5, SAND: 6, SNOW: 7, CSTONE: 8, ROOF: 9, WOOD: 10, ROOFB: 11,
  PALE: 12, SANDST: 13, DARK: 14, SLATE: 15, WINDOW: 16, IRON: 17, COBBLE: 18, EARTH: 19 };

function helpers() {
  const code = between('// ---- Players together (0.6.85)', '// ---- end of players-together helpers');
  const ctx = vm.createContext({ T, SURF: 12, titles: ['Lord', 'Mistress', 'Sir', 'Dame'], names: ['Kestrel', 'Elowen', 'Brannoc', 'Aldric'], Map, Math, RegExp });
  return vm.runInContext(code + '; ({ safeName, presenceNotes, mapColor, mapSpot, MAP_COLORS })', ctx);
}

// A small world for placeSafely: ground (stone) up to height `ground` everywhere, plus extra blocks
function placeCtx(ground, extra = new Set()) {
  const H = 96;
  const get = (x, y, z) => (y <= ground || extra.has(x + ',' + y + ',' + z)) ? T.STONE : T.AIR;
  const solid = t => t !== T.AIR && t !== T.WATER;
  const HW = 0.3, FOOT = 0.05, HH = 1.7;
  const hits = (x, y, z) => {
    for (const dx of [-HW, HW]) for (const dz of [-HW, HW]) for (const dy of [FOOT, HH - FOOT]) if (solid(get(Math.floor(x + dx), Math.floor(y + dy), Math.floor(z + dz)))) return true;
    return false;
  };
  const ctx = vm.createContext({ H, get, solid, hits, Math, topSpawnPoint: () => [1000.5, ground + 3.01, 1000.5], px: 0, py: 0, pz: 0, vx: 1, vy: 1, vz: 1 });
  const s = game.indexOf('function placeSafely(fresh)');
  const e = game.indexOf('const spawnPoint = topSpawnPoint;', s);
  vm.runInContext(game.slice(s, e), ctx);
  return ctx;
}

test('0.6.85: a child who joins a world from the start screen begins at that world\'s start point, never where the new-game world had put them', () => {
  const c = placeCtx(30);
  Object.assign(c, { px: 5.5, py: 10, pz: 5.5 });   // deep inside the joined world's hill
  assert.equal(vm.runInContext('placeSafely(true)', c), 'start');
  assert.deepEqual([c.px, c.py, c.pz], [1000.5, 33.01, 1000.5]);
  assert.deepEqual([c.vx, c.vy, c.vz], [0, 0, 0]);
  // and the game really does it: the wizard joins with fresh = true, and every load of the land checks the place
  assert.match(game, /joinExisting\(wiz\.code, true\)/);
  assert.match(between('async function joinExisting', 'async function createWorld'), /placeSafely\(fresh\)/);
  assert.match(game, /loadShared\(data\.grid, worldId\); dirty = true; placeSafely\(false\);/);
});

test('0.6.85: reopening a shared world keeps the child where they were, or lifts them onto the land when blocks are in the way', () => {
  const c = placeCtx(20);
  Object.assign(c, { px: 5.5, py: 21.01, pz: 5.5 });   // standing on the ground: stays
  assert.equal(vm.runInContext('placeSafely(false)', c), 'ok');
  assert.equal(c.py, 21.01);
  Object.assign(c, { px: 5.5, py: 15, pz: 5.5 });      // inside the ground: up onto it, same place
  assert.equal(vm.runInContext('placeSafely(false)', c), 'up');
  assert.deepEqual([c.px, c.py, c.pz], [5.5, 21.01, 5.5]);
  assert.equal(c.hits(c.px, c.py, c.pz), false);
  // someone built a pillar right up to the sky here: the start point instead
  const sky = new Set(); for (let y = 0; y < 96; y++) sky.add('5,' + y + ',5');
  const d = placeCtx(20, sky);
  Object.assign(d, { px: 5.5, py: 15, pz: 5.5 });
  assert.equal(vm.runInContext('placeSafely(false)', d), 'start');
});

test('0.6.85: only names the game makes are shown for other players; anything else shows as "A player"', () => {
  const { safeName } = helpers();
  for (const n of ['Sir Kestrel 1', 'Dame Elowen 999', 'Lord Aldric 42', 'Mistress Brannoc 7']) assert.equal(safeName(n), n);
  for (const n of ['hello', 'Sir Kestrel', 'Sir Kestrel 0', 'Sir Kestrel 1000', 'Sir Bob 5', 'Sir Kestrel 5 call me', '<b>Sir Kestrel 5</b>', '', null, 5, undefined])
    assert.equal(safeName(n), 'A player', String(n));
  // the name tag over a player's head and the list of players use it too
  assert.match(game, /nameTag\(safeName\(meta\.name\)\)/);
  assert.match(game, /name: safeName\(m\.name\)/);
});

test('0.6.85: a note says who is here on arrival, who joins and who leaves', () => {
  const { presenceNotes } = helpers();
  const M = o => new Map(Object.entries(o));
  assert.deepEqual([...presenceNotes(M({}), M({}), true)], []);
  assert.deepEqual([...presenceNotes(M({}), M({ a: 'Sir Kestrel 1' }), true)], ['Sir Kestrel 1 is here']);
  assert.deepEqual([...presenceNotes(M({}), M({ a: 'A', b: 'B', c: 'C', d: 'D' }), true)], ['4 friends are here: A, B, C and more']);
  assert.deepEqual([...presenceNotes(M({ a: 'A' }), M({ a: 'A', b: 'Dame Elowen 3' }), false)], ['Dame Elowen 3 joined your world']);
  assert.deepEqual([...presenceNotes(M({ a: 'A', b: 'B' }), M({ b: 'B' }), false)], ['A left the world']);
  assert.deepEqual([...presenceNotes(M({ a: 'A' }), M({ a: 'A' }), false)], [], 'nothing changed: no note');
  // the notes box shows text only (never HTML), and at most 4 notes
  const add = between('function addNote(text)', 'const playersInWorld');
  assert.match(add, /d\.textContent = text/);
  assert.doesNotMatch(add, /innerHTML/);
  assert.match(add, /children\.length > 4/);
});

test('0.6.85: the player count shows at the top left in a shared world', () => {
  assert.match(game, /worldId \? ` &nbsp; Players \$\{playersInWorld\(\)\}` : ''/);
  assert.match(game, /const playersInWorld = \(\) => worldId \? 1 \+ others\.size : 1;/);
});

test('0.6.85: the map has a colour for every block, and players off the map are drawn on its edge', () => {
  const { mapColor, mapSpot, MAP_COLORS } = helpers();
  for (let t = 1; t <= 19; t++) assert.ok(MAP_COLORS[t], 'colour for block ' + t);
  for (const y of [0, 12, 50, 95]) for (const v of mapColor(T.GRASS, y)) assert.ok(v >= 0 && v <= 255);
  assert.ok(mapColor(T.GRASS, 40)[1] > mapColor(T.GRASS, 5)[1], 'higher land is lighter');
  assert.deepEqual({ ...mapSpot(100, 100, 100, 100, 48, 384) }, { sx: 192, sy: 192, edge: false });
  const far = mapSpot(1000, 100, 100, 100, 48, 384);
  assert.equal(far.edge, true); assert.equal(far.sx, 384); assert.equal(far.sy, 192);
  // M opens and closes it (not while typing a world code), the Map button too, and Escape closes it
  assert.match(game, /e\.code === 'KeyM' && !e\.repeat && !\(e\.target && e\.target\.tagName === 'INPUT'\)\) toggleMap\(\)/);
  assert.match(game, /getElementById\('mapBtn'\)\.addEventListener\('click', \(\) => toggleMap\(\)\)/);
  assert.match(game, /if \(mapOpen\) toggleMap\(false\);/);
  // the map reads only land already loaded: it never makes new land just to draw it
  assert.match(between('function drawMapLand', 'function drawMapDots'), /chunks\.has\(/);
});
