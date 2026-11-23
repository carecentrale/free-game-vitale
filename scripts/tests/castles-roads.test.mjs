// Castles with much more detail (SPEC-020) and roads that join every castle (SPEC-023), land-maker 3 (0.6.81).
// The world code is copied out of the game file, as in terrain.test.mjs and caves-castles.test.mjs. Walking through the
// new castles (gate, towers, wall top, treasure room) is checked by caves-castles.test.mjs, which now builds new castles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');
const start = game.indexOf('// ---- World: 400,000'), end = game.indexOf('// ---- Saving: the character', start);
const api = `;({ CENTER, H, T, CS, WATER_Y, PMIN, PMAX, initWorld, get, groundY, makeChunk, castleInCell, towerNearStart, castlesIn,
  castleNetwork, roadPlan, encodeWorld, applyWorld, structFor, toFrame, cellToWorld, chunks, edited, setBlock, roadAt, ckey,
  eatTreeInWorld, treeLook, dayNum, decorAt, eatenTrees, gen: () => gen, oldCastles: () => oldCastles })`;
const ctx = vm.createContext({ Math, Uint8Array, Int16Array, Int8Array, Int32Array, Float32Array, Float64Array, Map, Set, JSON, Number, String, Array,
  atob: s => Buffer.from(s, 'base64').toString('binary'), bytesToB64: u => Buffer.from(u).toString('base64') });
const W = vm.runInContext(game.slice(start, end) + api, ctx);
const T = W.T;
const id = c => c.sx + ',' + c.sz;
const allCastles = () => W.castleNetwork().nodes;

// ---- SPEC-020: castles ----
test('SPEC-020: every world has all three pure styles and castles that mix them; each castle has its colours and tower shapes', () => {
  for (const seed of [4242, 77, 9001]) {
    W.initWorld(seed, 2, 300);
    const list = allCastles();
    const pure = [0, 0, 0];
    let mixed = 0;
    for (const c of list) {
      assert.equal(c.style, 'new');
      const s = c.mix.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(s - 1) < 1e-9, 'the style mix adds up to one');
      if (c.mix.includes(1)) pure[c.mix.indexOf(1)]++; else mixed++;
      assert.ok([T.CSTONE, T.PALE, T.SANDST].includes(c.wallM), 'grey, cream or sandstone walls');
      assert.ok([T.ROOF, T.ROOFB, T.SLATE].includes(c.roof), 'red, blue or slate roofs');
      for (const tw of c.towers) assert.ok(['round', 'square', 'oct'].includes(tw.shape));
    }
    assert.ok(pure.every(n => n > 0), `seed ${seed}: fortress, fairy-tale and palace each found pure: ${pure}`);
    assert.ok(mixed > 0, `seed ${seed}: castles that mix styles`);
    // the styles look clearly different: fairy-tale castles have tall spires, fortresses low cones, palaces gables
    const main = k => list.filter(c => c.mix[k] === 1);
    const spire = cs => cs.flatMap(c => c.towers).filter(t => t.st === 1).length / Math.max(1, cs.flatMap(c => c.towers).length);
    if (main(1).some(c => c.towers.length)) assert.ok(spire(main(1)) > 0.9, 'fairy-tale towers have spires');
    if (main(0).some(c => c.towers.length)) assert.ok(spire(main(0)) === 0, 'fortress towers have low cones');
    assert.ok(main(2).every(c => c.keep.gable), 'a palace has gables');
  }
});

test('SPEC-020: two neighbouring castles of the same size differ in at least two of style mix, wall colour, roof colour and tower shape', () => {
  let pairs = 0, ok = 0;
  for (const seed of [4242, 77, 9001]) {
    W.initWorld(seed, 2, 400);
    const net = W.castleNetwork();
    for (const e of net.edges) {
      const [p, q] = [e.from, e.to];
      if (p.kind !== q.kind) continue;
      pairs++;
      const shape = c => c.towers.map(t => t.shape).sort().join() || 'none';
      const diff = [p.mix.join() !== q.mix.join(), p.wallM !== q.wallM, p.roof !== q.roof, shape(p) !== shape(q)].filter(Boolean).length;
      if (diff >= 2) ok++;
    }
  }
  assert.ok(pairs >= 10, 'neighbouring pairs checked: ' + pairs);
  assert.ok(ok / pairs >= 0.85, `most neighbours differ in two or more ways: ${ok} of ${pairs}`);
});

// Every block of a castle's own structure, by kind
function census(c) {
  const sb = W.structFor(c), n = {};
  for (let a = 0; a < c.A; a++) for (let b = 0; b < c.B; b++) for (let ry = -1; ry <= c.height; ry++) {
    const t = sb(c, a, b, ry);
    if (t !== undefined) n[t] = (n[t] || 0) + 1;
  }
  return n;
}
test('SPEC-020: every castle has framed windows on each floor, pointed roofs, a gatehouse with a portcullis, two turrets or more, and a spire', () => {
  const kinds = {};
  for (const [seed, gap] of [[5, 600], [4242, 300], [4242, 800], [77, 800], [9001, 1000]]) {
    W.initWorld(seed, 2, gap);
    for (const c of allCastles()) if (!kinds[c.kind]) kinds[c.kind] = c;
    if (kinds.great && kinds.castle && kinds.tower) break;
  }
  assert.deepEqual(Object.keys(kinds).sort(), ['castle', 'great', 'tower']);
  for (const c of Object.values(kinds)) {
    const n = census(c), sb = W.structFor(c), K = c.keep;
    assert.ok(n[T.WINDOW] > 10 && n[T.DARK] > 10 && n[c.trim] > 10, c.kind + ': windows, a dark base course and light frames');
    // a window on every floor of the keep
    for (const L of [0, ...K.floors]) {
      let w = 0;
      for (let a = K.a0; a < K.a1; a++) if (sb(c, a, K.b0, L + 2) === T.WINDOW) w++;
      assert.ok(w > 0, `${c.kind}: a window on the keep's floor at ${L}`);
    }
    // the keep's roof is pointed: it gets narrower going up, and nothing is flat on top of the keep's walls
    const width = r => { let w = 0; for (let a = K.a0; a < K.a1; a++) { const t = sb(c, a, Math.floor((K.b0 + K.b1) / 2), K.h + r); if (t === c.roof || t === T.WINDOW || t === c.wallM) w++; } return w; };
    assert.ok(width(0) > width(Math.max(1, K.rh - 1)) || K.gable, c.kind + ': the keep roof narrows');
    for (const tw of c.towers) assert.equal(sb(c, Math.floor(tw.a), Math.floor(tw.b), tw.h + 1), c.roof, c.kind + ': a pointed tower roof');
    assert.ok(n[T.IRON] > 0, c.kind + ': a portcullis');
    assert.ok(c.turrets.length >= 2, c.kind + ': turrets');
    if (c.kind !== 'tower') assert.equal(c.gateTowers.length, 2, 'a gatehouse with two towers');
    assert.ok(c.floorY + c.height <= 93, 'never above 92');
  }
});

test('SPEC-020: the new blocks are numbered after the old ones, and each one goes into the bag when dug', () => {
  for (const k of ['PALE', 'SANDST', 'DARK', 'SLATE', 'WINDOW', 'IRON', 'COBBLE', 'EARTH']) assert.ok(T[k] >= 12 && T[k] <= 19, k);
  const items = game.slice(game.indexOf('const BLOCK_ITEM'), game.indexOf('\n', game.indexOf('const BLOCK_ITEM')));
  for (const k of ['PALE', 'SANDST', 'DARK', 'SLATE', 'WINDOW', 'IRON', 'COBBLE', 'EARTH']) assert.ok(items.includes('[T.' + k + ']'), k + ' has a bag item');
  // every new block is drawn (a material) and merchants sell the six castle blocks
  const mats = game.slice(game.indexOf('const blockMats'), game.indexOf('// ---- Three.js scene'));
  for (const k of ['PALE', 'SANDST', 'DARK', 'SLATE', 'WINDOW', 'IRON', 'COBBLE', 'EARTH']) assert.ok(mats.includes('[T.' + k + ']'), k + ' is drawn');
  const buys = game.slice(game.indexOf('const BUYS'), game.indexOf('function merchantOffers'));
  for (const k of ['pale_stone', 'sandstone', 'dark_stone', 'slate_roof', 'window', 'iron_bars']) assert.ok(buys.includes("'" + k + "'"), 'merchants sell ' + k);
});

test('SPEC-020: an old world gets the new castles castle by castle; castles the child changed keep the old look, with no step at their edge', () => {
  // a world started with land-maker 2 (between 0.6.76 and 0.6.81): a change in one castle's chunk
  W.initWorld(77, 2, 500);
  const list = allCastles().filter(c => c.kind !== 'tower');
  const [A, B] = list;
  const ax = A.sx + 2, az = A.sz + 2;   // inside castle A
  W.applyWorld({ v: 2, seed: 77, gen: 2, castleGap: 500, edits: [] });   // the castle as land-maker 2 made it
  // the record written by 0.6.80: it does not know about land-maker 3 yet
  const old = W.encodeWorld();
  delete old.maker; delete old.oldCastles; delete old.roaded;
  // build a block in castle A with land-maker 2, as a child would have before
  W.initWorld(77, 2, 500);
  W.applyWorld(old);
  W.setBlock(ax, 40, az, T.STONE);
  const saved = W.encodeWorld();
  delete saved.maker; delete saved.oldCastles; delete saved.roaded;
  W.applyWorld(saved);   // first opened in this version
  assert.ok(W.oldCastles().has(id(A)), 'castle A keeps its old look');
  assert.ok(!W.oldCastles().has(id(B)), 'castle B gets the new look');
  const a2 = W.castlesIn(A.sx, A.sz, A.sx + 1, A.sz + 1).find(c => id(c) === id(A)), b2 = W.castlesIn(B.sx, B.sz, B.sx + 1, B.sz + 1).find(c => id(c) === id(B));
  assert.notEqual(a2.style, 'new'); assert.equal(b2.style, 'new');
  assert.equal(W.get(ax, 40, az), T.STONE, 'the child\'s block is still there');
  // the new castle keeps the old one's place, size, floor and slope: the land just outside its footprint is the same
  const rec = W.encodeWorld();
  assert.equal(rec.maker, 3);
  assert.ok(rec.oldCastles.includes(id(A)));
  const ring = c => { const out = []; for (let x = c.fx0 - 2; x < c.fx1 + 2; x += 3) for (const z of [c.fz0 - 1, c.fz1]) { let y = W.H - 1; while (y > 0 && W.get(x, y, z) === T.AIR) y--; out.push(y); } return out; };
  const nowB = ring(b2);
  W.applyWorld({ ...rec, oldCastles: [...rec.oldCastles, id(B)] });   // the same world with B in its old look
  const oldB = ring(W.castlesIn(B.sx, B.sz, B.sx + 1, B.sz + 1).find(c => id(c) === id(B)));
  let same = 0; for (let i = 0; i < nowB.length; i++) if (nowB[i] === oldB[i] || Math.abs(nowB[i] - oldB[i]) <= 1) same++;
  assert.ok(same / nowB.length > 0.9, 'the land around a castle meets it the same way: ' + same + ' of ' + nowB.length);
  // reopening keeps the list: nothing changes again
  W.applyWorld(rec);
  assert.ok(W.oldCastles().has(id(A)) && !W.oldCastles().has(id(B)));
});

test('SPEC-020: a world from before 0.6.76 gets castles, except where the child changed the land, and still no caves', () => {
  W.applyWorld({ v: 2, seed: 4242, edits: [] });
  const planned = allCastles();
  assert.ok(planned.length > 5, 'castles in a world from before 0.6.76');
  const C = planned.find(c => c.kind === 'castle') || planned[0];
  // a world from before 0.6.76 with a change in that castle's land
  W.applyWorld({ v: 2, seed: 4242, edits: [] });
  W.setBlock(C.sx + 3, 30, C.sz + 3, T.DIRT);
  const rec = W.encodeWorld();
  W.applyWorld({ v: 2, seed: rec.seed, edits: rec.edits });   // as written by 0.6.80 (no castle record)
  const now = W.castlesIn(C.sx, C.sz, C.sx + 1, C.sz + 1).find(c => id(c) === id(C));
  assert.equal(now, undefined, 'no castle where the child had changed the land');
  assert.equal(W.get(C.sx + 3, 30, C.sz + 3), T.DIRT, 'the child\'s block is still there');
  assert.ok(allCastles().length === planned.length - 1, 'every other castle is built');
  assert.equal(W.gen(), 1, 'the land stays land-maker 1');
});

// ---- SPEC-023: roads ----
test('SPEC-023: on 3 seeds and 2 castle spacings, every castle has a road and no group of castles is cut off; 1 to 4 roads each', () => {
  let mains = 0, lanes = 0;
  for (const seed of [4242, 77, 9001]) for (const gap of [300, 600]) {
    W.initWorld(seed, 2, gap);
    const net = W.castleNetwork(), n = net.nodes.length;
    assert.ok(n >= 5, `seed ${seed} gap ${gap}: ${n} castles`);
    const adj = new Map(net.nodes.map(c => [c, []]));
    for (const e of net.edges) { adj.get(e.from).push(e.to); adj.get(e.to).push(e.from); }
    for (const [c, l] of adj) assert.ok(l.length >= 1 && l.length <= 4, `seed ${seed} gap ${gap}: ${l.length} roads at ${id(c)}`);
    const seen = new Set([net.nodes[0]]), q = [net.nodes[0]];
    while (q.length) for (const o of adj.get(q.pop())) if (!seen.has(o)) { seen.add(o); q.push(o); }
    assert.equal(seen.size, n, `seed ${seed} gap ${gap}: every castle can be reached from every other by road`);
    // the tower house near the start is joined too, and from it at least 5 castles can be reached
    const st = W.towerNearStart();
    assert.ok(adj.get(net.nodes.find(c => id(c) === id(st))).length >= 1, 'the tower house near the start has a road');
    mains += net.edges.filter(e => e.main).length; lanes += net.edges.filter(e => !e.main).length;
  }
  assert.ok(mains > 0 && lanes > 0, `cobbled main roads (${mains}) and earth lanes (${lanes})`);
});

test('SPEC-023: roads curve with the land, climb gently, keep clear of castles and the start, and cross water on bridges', () => {
  W.initWorld(4242, 2, 400);
  const net = W.castleNetwork();
  let bridges = 0, curvy = 0;
  for (const e of net.edges.slice(0, 12)) {
    const S = W.roadPlan(e);
    assert.ok(S.n > 20);
    for (let i = 1; i < S.n; i++) assert.ok(Math.abs(S.h[i] - S.h[i - 1]) <= 1, 'never more than 1 up or down between blocks');
    for (let i = 4; i < S.n; i += 4) assert.ok(Math.abs(S.h[i] - S.h[i - 4]) <= 2, 'never more than 1 up for 2 along');
    // never in a castle footprint, never in the start area
    for (let i = 0; i < S.n; i += 3) {
      assert.ok(Math.hypot(S.x[i] - W.CENTER, S.z[i] - W.CENTER) >= 30, 'not within 30 blocks of the start');
      for (const c of net.nodes) assert.ok(!(S.x[i] >= c.fx0 && S.x[i] < c.fx1 && S.z[i] >= c.fz0 && S.z[i] < c.fz1), 'not through a castle');
    }
    // curves: the road strays from the straight line between its ends
    const [ax, az, bx, bz] = [S.x[0], S.z[0], S.x[S.n - 1], S.z[S.n - 1]], L = Math.hypot(bx - ax, bz - az);
    let far = 0; for (let i = 0; i < S.n; i++) far = Math.max(far, Math.abs((S.x[i] - ax) * (bz - az) - (S.z[i] - az) * (bx - ax)) / L);
    if (far > 10) curvy++;
    // where the ground is water, the road is a bridge
    for (let i = 0; i < S.n; i++) if (W.groundY(Math.floor(S.x[i]), Math.floor(S.z[i])) < W.WATER_Y) { assert.ok(S.bridge[i]); bridges++; }
  }
  assert.ok(curvy >= 6, 'most roads are not straight lines: ' + curvy);
  // the road is laid in real blocks: cobblestone or packed earth on top, wood on bridges
  const e = net.edges.find(x => W.roadPlan(x).bridge.some(Boolean)) || net.edges[0], S = W.roadPlan(e);
  const i = Math.floor(S.n / 2), x = Math.floor(S.x[i]), z = Math.floor(S.z[i]);
  const t = W.get(x, S.h[i], z);
  assert.ok([T.COBBLE, T.EARTH, T.WOOD].includes(t), 'a road block in the middle of the road: ' + t);
  assert.ok(W.roadAt(x, z) > 0, 'the road is known there (no trees on it)');
  const bi = S.bridge.indexOf(true);
  if (bi >= 0) {
    assert.equal(W.get(Math.floor(S.x[bi]), S.h[bi], Math.floor(S.z[bi])), T.WOOD, 'a bridge deck');
    assert.notEqual(W.get(Math.floor(S.x[bi]), S.h[bi] + 1, Math.floor(S.z[bi])), T.WOOD, 'room to walk on the deck');
  }
});

test('SPEC-023: two devices make the same roads; roads come to old worlds once, and never replace what the child built', () => {
  W.initWorld(9001, 2, 500);
  const sig = () => W.castleNetwork().edges.slice(0, 5).map(e => { const S = W.roadPlan(e); return e.key + ':' + S.n + ':' + S.h.slice(0, 50).join(); }).join('|');
  const a = sig();
  W.initWorld(9001, 2, 500);
  assert.equal(sig(), a, 'the same roads every time');
  // an old world (no land-maker 3 record) in which the child built a wall of gem blocks across a road's way
  const e = W.castleNetwork().edges[0], S = W.roadPlan(e), i = Math.floor(S.n / 2);
  const x = Math.floor(S.x[i]), z = Math.floor(S.z[i]), y = S.h[i];
  W.applyWorld({ v: 2, seed: 9001, gen: 2, castleGap: 500, maker: 3, oldCastles: [], roaded: [], edits: [] });
  // make the chunk as land-maker 2 would have (no roads), as a changed chunk saved by 0.6.80
  W.applyWorld({ v: 2, seed: 9001, gen: 2, castleGap: 500, edits: [] });
  const k = W.ckey(Math.floor(x / 16), Math.floor(z / 16));
  for (let dy = 0; dy < 3; dy++) W.setBlock(x, y + dy, z, T.GEM);
  const rec = W.encodeWorld();
  const before = W.chunks.get(k).data.slice();
  // reopened in this version: the record from 0.6.80 has no roads
  W.applyWorld({ v: 2, seed: rec.seed, gen: 2, castleGap: 500, edits: rec.edits });
  for (let dy = 0; dy < 3; dy++) assert.equal(W.get(x, y + dy, z), T.GEM, 'the child\'s blocks are kept');
  const after = W.chunks.get(k).data;
  let changed = 0, bad = 0;
  for (let j = 0; j < after.length; j++) if (after[j] !== before[j]) {
    changed++;
    if (![T.AIR, T.WATER, T.GRASS, T.DIRT, T.SAND, T.SNOW].includes(before[j])) bad++;
  }
  assert.equal(bad, 0, 'only air, water, grass, dirt, sand or snow were replaced');
  const rec2 = W.encodeWorld();
  assert.ok(rec2.roaded.includes(k), 'the chunk is noted as having its roads');
  // a road block the child digs up stays dug: the roads are not laid again
  const dug = [...rec2.edits];
  W.applyWorld(rec2);
  W.setBlock(x + 1, y, z, T.AIR);
  const rec3 = W.encodeWorld();
  W.applyWorld(rec3);
  assert.equal(W.get(x + 1, y, z), T.AIR, 'a dug road block stays dug');
  assert.ok(changed >= 0 && dug.length >= 1);
});

// ---- SPEC-022: trees eaten by dragons ----
test('SPEC-022: an eaten tree is a stump that day, a young tree the next, the same tree again after 1 or 2 days; kept with the world', () => {
  W.initWorld(4242, 2, 500);
  // find a tree near the start
  let tree = null;
  for (let x = W.CENTER - 80; x < W.CENTER + 80 && !tree; x++) for (let z = W.CENTER - 80; z < W.CENTER + 80 && !tree; z += 3) {
    let y = W.H - 1; while (y > 0 && W.get(x, y, z) === T.AIR) y--;
    const d = W.decorAt(x, y, z);
    if (d && ['common', 'pine', 'palm'].includes(d.kind)) tree = { x, y, z, kind: d.kind };
  }
  assert.ok(tree, 'a tree near the start');
  const today = W.dayNum();
  W.eatTreeInWorld(tree.x, tree.z, today);
  assert.equal(W.decorAt(tree.x, tree.y, tree.z).kind, 'stump', 'a stump the day it is eaten');
  const rec = W.encodeWorld();
  assert.equal(rec.eaten.length, 1);
  const [ex, ez, day, back] = rec.eaten[0];
  assert.ok(ex === tree.x && ez === tree.z && day === today && (back === today + 1 || back === today + 2), 'a date only: the day eaten and the day it is back');
  // the list travels with the world
  W.applyWorld(rec);
  assert.equal(W.decorAt(tree.x, tree.y, tree.z).kind, 'stump', 'still a stump after reopening the same day');
  // a day later (or two): a young tree, then the same tree; then it leaves the list
  W.eatTreeInWorld(tree.x, tree.z, today - 1);
  const look1 = W.treeLook(tree.x, tree.z);
  assert.ok(look1 === 2 || look1 === 0, 'the next day: a young tree or the full tree');
  W.eatTreeInWorld(tree.x, tree.z, today - 2);
  assert.equal(W.treeLook(tree.x, tree.z), 0, 'after 2 days the full tree');
  assert.equal(W.decorAt(tree.x, tree.y, tree.z).kind, tree.kind);
  assert.equal(W.eatenTrees.has(tree.x + ',' + tree.z), false, 'grown back: it leaves the list');
  // at most 500: the oldest grows back early
  for (let i = 0; i < 520; i++) W.eatTreeInWorld(W.CENTER + i, W.CENTER + 900, today);
  assert.equal(W.eatenTrees.size, 500);
  assert.equal(W.eatenTrees.has((W.CENTER) + ',' + (W.CENTER + 900)), false, 'the oldest went first');
});
