// Caves and castles (0.6.76, SPEC-016 parts F and G): the world code is copied out of the game file, as in terrain.test.mjs,
// and checked here. The walking checks follow the game's own rules: a child walks, jumps up one block at a time, and drops
// at most 3 blocks; water can be waded through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');
const start = game.indexOf('// ---- World: 400,000'), end = game.indexOf('// ---- Saving: the character', start);
const api = `;({ CENTER, H, T, CS, WATER_Y, initWorld, get, groundY, makeChunk, mouthInCell, castleInCell, towerNearStart, castlesIn, MOUTH_CLEAR,
  encodeWorld, applyWorld, structBlock, toFrame, chunks, gen: () => gen, gap: () => castleGap, setNext: g => { castleGapNext = g; } })`;
const ctx = vm.createContext({ Math, Uint8Array, Int16Array, Float32Array, Map, Set, JSON, Number, String, Array,
  atob: s => Buffer.from(s, 'base64').toString('binary'), bytesToB64: u => Buffer.from(u).toString('base64') });
const W = vm.runInContext(game.slice(start, end) + api, ctx);
const T = W.T, solid = t => t !== T.AIR && t !== T.WATER, open = t => !solid(t);
const stand = (x, y, z) => open(W.get(x, y, z)) && open(W.get(x, y + 1, z)) && solid(W.get(x, y - 1, z));
function standAt(x, z, y) { for (let d = 0; d < 6; d++) for (const yy of [y - d, y + d]) if (stand(x, yy, z)) return [x, yy, z]; return null; }
// Every place reachable from `from` inside the box [x0, x1) x [z0, z1)
function reach(from, box) {
  const key = (x, y, z) => x + ',' + y + ',' + z, seen = new Set([key(...from)]), q = [from], out = [];
  while (q.length) {
    const [x, y, z] = q.pop(); out.push([x, y, z]);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < box[0] || nx >= box[1] || nz < box[2] || nz >= box[3]) continue;
      let ny = null;
      if (open(W.get(nx, y, nz)) && open(W.get(nx, y + 1, nz))) {
        for (let d = 0; d <= 3; d++) { if (!open(W.get(nx, y - d, nz)) || !open(W.get(nx, y - d + 1, nz))) break; if (solid(W.get(nx, y - d - 1, nz))) { ny = y - d; break; } }
      } else if (solid(W.get(nx, y, nz)) && open(W.get(nx, y + 1, nz)) && open(W.get(nx, y + 2, nz)) && open(W.get(x, y + 2, z))) ny = y + 1;
      if (ny === null) continue;
      const k = key(nx, ny, nz);
      if (!seen.has(k)) { seen.add(k); q.push([nx, ny, nz]); }
    }
  }
  return { cells: out, has: (x, y, z) => seen.has(key(x, y, z)) };
}
const mouthsNearStart = () => { const out = []; for (let gx = -2; gx <= 1; gx++) for (let gz = -2; gz <= 1; gz++) { const m = W.mouthInCell(gx, gz); if (m) out.push(m); } return out; };

// ---- The land-maker record ----
test('a new world records land-maker 2, its castle spacing and land-maker 3; a world from before 0.6.76 keeps its land and no caves, and gets castles (SPEC-020)', () => {
  W.setNext(800);
  W.initWorld(4242);
  const w = W.encodeWorld();
  assert.equal(w.gen, 2, 'gen stays 2, so an older version of the game reads the same land and caves');
  assert.equal(w.castleGap, 800, 'the spacing read last is recorded in a new world');
  assert.equal(w.maker, 3);
  assert.equal(w.oldCastles.length, 0, 'a new world has no castle of the old look');
  W.setNext(500);
  // an old save (no record): land-maker 1 land (no new caves), but castles now (owner, 22 Nov 2026), at the standard spacing
  W.applyWorld({ v: 2, seed: 4242, edits: [] });
  assert.equal(W.gen(), 1);
  const w1 = W.encodeWorld();
  assert.equal(w1.gen, undefined, 'still read as land-maker 1 by an older version');
  assert.equal(w1.maker, 3); assert.equal(w1.castleGap, 500);
  const caves = mouthsNearStart().length, castles = W.castlesIn(W.CENTER - 600, W.CENTER - 600, W.CENTER + 600, W.CENTER + 600).length;
  assert.equal(caves, 0, 'no cave mouths are planned in an old world');
  assert.ok(castles > 0, 'castles in an old world now');
  const sum = () => { let n = 0; for (let x = W.CENTER - 120; x < W.CENTER + 120; x += 5) for (let z = W.CENTER - 120; z < W.CENTER + 120; z += 5) for (let y = 0; y < 40; y++) n = (n * 31 + W.get(x, y, z)) >>> 0; return n; };
  const before = sum();
  W.applyWorld({ v: 2, seed: 4242, edits: [] });
  assert.equal(sum(), before, 'the same old world loaded again gives the same land');
  // a world recorded with land-maker 2 and spacing 1000 keeps them when loaded again (a shared world on another device)
  W.applyWorld({ v: 2, seed: 4242, gen: 2, castleGap: 1000, edits: [] });
  assert.equal(W.gen(), 2); assert.equal(W.gap(), 1000);
  W.applyWorld({ v: 2, seed: 4242, gen: 2, castleGap: 99999, edits: [] });
  assert.equal(W.gap(), 500, 'a spacing outside 250 to 2000 is not used');
});

test('two devices in the same world make the same caves and the same castles', () => {
  const snap = () => {
    const out = [];
    for (const m of mouthsNearStart()) out.push([m.x, m.z, m.room.y]);
    const st = W.towerNearStart(); out.push([st.sx, st.sz, st.floorY]);
    let n = 0; for (let x = st.sx - 5; x < st.sx + 30; x++) for (let z = st.sz - 5; z < st.sz + 30; z++) for (let y = 0; y < 50; y++) n = (n * 31 + W.get(x, y, z)) >>> 0;
    out.push(n);
    return JSON.stringify(out);
  };
  W.applyWorld({ v: 2, seed: 77, gen: 2, castleGap: 500, edits: [] });
  const a = snap();
  W.initWorld(1234); W.makeChunk(12500, 12500);   // another world in between
  W.applyWorld({ v: 2, seed: 77, gen: 2, castleGap: 500, edits: [] });
  assert.equal(snap(), a);
});

// ---- Caves (part F) ----
test('SPEC-016 F: every cave mouth near the start can be walked into, down to its big room, and back out', () => {
  let n = 0;
  for (const seed of [4242, 77]) {
    W.initWorld(seed, 2, 500);
    for (const m of mouthsNearStart()) {
      const s = m.steps[0], a = standAt(s[0], s[1], s[2]), r = standAt(Math.floor(m.room.x), Math.floor(m.room.z), m.room.y);
      assert.ok(a && r, 'standing places at the mouth and in the room');
      const box = [m.minX - 4, m.maxX + 4, m.minZ - 4, m.maxZ + 4].map(Math.floor);
      assert.ok(reach(a, box).has(...r), `seed ${seed}: the room of the mouth at ${m.x},${m.z} can be walked to`);
      assert.ok(reach(r, box).has(...a), `seed ${seed}: the way out of the room at ${m.x},${m.z} can be walked`);
      assert.ok(m.room.h >= 3 && m.room.r >= 6, 'the room is big');
      n++;
    }
  }
  assert.ok(n >= 8, 'enough caves were checked: ' + n);
});

test('SPEC-016 F: cave mouths are close enough to find, none within 30 blocks of the start, none by water', () => {
  for (const seed of [4242, 77, 9]) {
    W.initWorld(seed, 2, 500);
    const ms = mouthsNearStart();
    const near = Math.min(...ms.map(m => Math.hypot(m.x - W.CENTER, m.z - W.CENTER)));
    assert.ok(near <= 450, `seed ${seed}: a cave mouth within about 90 seconds' walk of the start (${Math.round(near)} blocks)`);
    for (const m of ms) {
      for (const [x, z] of [[m.x, m.z], ...m.steps.map(s => [s[0], s[1]]), [Math.round(m.room.x), Math.round(m.room.z)]]) {
        assert.ok(Math.hypot(x - W.CENTER, z - W.CENTER) >= W.MOUTH_CLEAR, 'no cave within 30 blocks of the start');
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) assert.ok(W.groundY(x + dx, z + dz) >= W.WATER_Y, 'no cave within 2 blocks of water');
      }
    }
  }
});

test('SPEC-016 F: big rooms have stone spikes and gems in their walls; cave water sits on a floor', () => {
  W.initWorld(4242, 2, 500);
  let spikes = 0, gems = 0, floating = 0;
  for (const m of mouthsNearStart()) {
    const R = m.room;
    for (let x = Math.floor(R.x - R.r - 1); x <= R.x + R.r + 1; x++) for (let z = Math.floor(R.z - R.r - 1); z <= R.z + R.r + 1; z++) for (let y = R.y; y <= R.y + R.h + 2; y++) {
      const t = W.get(x, y, z);
      if (t === T.GEM && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => W.get(x + dx, y, z + dz) === T.AIR)) gems++;
      if (t === T.STONE && W.get(x, y - 1, z) === T.AIR && W.get(x, y + 1, z) === T.STONE && Math.hypot(x + .5 - R.x, z + .5 - R.z) < R.r - 1) spikes++;
      if (t === T.WATER && W.get(x, y - 1, z) === T.AIR) floating++;
    }
  }
  assert.ok(spikes > 0, 'stone spikes hang from the roofs');
  assert.ok(gems > 0, 'gems show in the walls');
  assert.equal(floating, 0, 'no water hangs over air');
});

// ---- Castles (part G) ----
// Every place a child should reach in a castle, from in front of its gate
function checkCastle(c) {
  const box = [c.fx0 - 6, c.fx1 + 6, c.fz0 - 6, c.fz1 + 6];
  let gate = null;
  for (let x = c.fx0 - 3; x < c.fx1 + 3 && !gate; x++) for (let z = c.fz0 - 3; z < c.fz1 + 3 && !gate; z++) {
    const [a, b] = W.toFrame(c, x, z);
    if (b === -c.margin - 2 && Math.abs(a + 0.5 - c.A / 2) < 1) gate = standAt(x, z, Math.max(W.groundY(x, z), W.WATER_Y - 1) + 1);
  }
  assert.ok(gate, 'a place to stand in front of the gate');
  const R = reach(gate, box);
  const res = { court: c.kind === 'tower', wall: c.kind === 'tower', towers: c.towers.map(() => false), treasure: false, gem: false };
  for (const [x, y, z] of R.cells) {
    if (x < c.sx || x >= c.sx + c.W || z < c.sz || z >= c.sz + c.D) continue;
    const [a, b] = W.toFrame(c, x, z), ry = y - c.floorY, K = c.keep;
    if (ry === 0 && b > 6 && b < K.b0 - 2) res.court = true;
    if (c.kind !== 'tower' && ry === c.wallH && Math.min(a, c.A - 1 - a, b, c.B - 1 - b) < 3) res.wall = true;
    c.towers.forEach((tw, i) => { if (ry === tw.top && Math.hypot(a + 0.5 - tw.a, b + 0.5 - tw.b) < tw.R) res.towers[i] = true; });
    if (ry === K.top && a >= K.a0 + 2 && a < K.a1 - 2 && b >= K.b0 + 2 && b < K.b1 - 2) {
      res.treasure = true;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => W.get(x + dx, y, z + dz) === T.GEM)) res.gem = true;
    }
  }
  return res;
}
const allReached = r => r.court && r.wall && r.towers.every(Boolean) && r.treasure && r.gem;

test('SPEC-016 G: a tower house always stands 100 to 200 blocks from the start, and the treasure room is reached by stairs', () => {
  for (const seed of [4242, 77, 9, 2024]) {
    W.initWorld(seed, 2, 500);
    const st = W.towerNearStart();
    assert.ok(st, 'seed ' + seed + ': a tower house near the start');
    const d = Math.hypot(st.sx + 12 - W.CENTER, st.sz + 12 - W.CENTER);
    assert.ok(d >= 100 && d <= 200, `seed ${seed}: ${Math.round(d)} blocks from the start`);
    const r = checkCastle(st);
    assert.ok(allReached(r), `seed ${seed}: ` + JSON.stringify(r));
  }
});

test('SPEC-016 G: in a castle the child walks through the gate, up every tower, along the wall top and to the treasure room', () => {
  let n = 0;
  for (const seed of [4242, 2024]) {
    W.initWorld(seed, 2, 500);
    for (let gx = -2; gx <= 1 && n < 3; gx++) for (let gz = -2; gz <= 1 && n < 3; gz++) {
      const c = W.castleInCell(gx, gz);
      if (!c || c.kind !== 'castle') continue;
      const r = checkCastle(c);
      assert.ok(allReached(r), `seed ${seed} cell ${gx},${gz}: ` + JSON.stringify(r));
      n++;
    }
  }
  assert.ok(n >= 1, 'a castle was checked');
});

test('SPEC-016 G: a great castle can be walked through: every tower, the wall top and the treasure room high in the main building', () => {
  W.initWorld(5, 2, 600);
  let c = null;
  for (let gx = -3; gx <= 2 && !c; gx++) for (let gz = -3; gz <= 2 && !c; gz++) { const k = W.castleInCell(gx, gz); if (k && k.kind === 'great') c = k; }
  assert.ok(c, 'a great castle in this world');
  assert.ok(c.towers.length >= 8, 'many towers: ' + c.towers.length);
  // 0.6.81 (SPEC-020): the main building has a pointed roof now; with it, it stands at least 60 high
  assert.ok(c.keep.h + (c.keep.rh || 0) >= 60, 'a tall main building: ' + c.keep.h + ' + roof ' + c.keep.rh);
  const r = checkCastle(c);
  assert.ok(allReached(r), JSON.stringify(r));
});

test('SPEC-016 G: castle spacing X, no castle near the start, none too tall, no two touching, and they differ', () => {
  for (const X of [500, 1000]) {
    W.initWorld(4242, 2, X);
    const list = [];
    const n = Math.ceil(2000 / X);
    for (let gx = -n; gx < n; gx++) for (let gz = -n; gz < n; gz++) { const c = W.castleInCell(gx, gz); if (c) list.push({ c, gx, gz }); }
    assert.ok(list.length >= (X === 500 ? 10 : 3), `spacing ${X}: ${list.length} castles`);
    for (const { c, gx, gz } of list) {
      // inside its own cell of X blocks, away from the edges
      assert.ok(c.fx0 >= W.CENTER + gx * X && c.fx1 <= W.CENTER + (gx + 1) * X && c.fz0 >= W.CENTER + gz * X && c.fz1 <= W.CENTER + (gz + 1) * X, 'a castle stays in its cell');
      const nx = Math.max(c.sx, Math.min(W.CENTER, c.sx + c.W)), nz = Math.max(c.sz, Math.min(W.CENTER, c.sz + c.D));
      assert.ok(Math.hypot(nx - W.CENTER, nz - W.CENTER) >= 100, 'no castle within 100 blocks of the start');
      assert.ok(c.floorY + c.height <= 93, 'the highest point stays at 92 or below');
    }
    const looks = new Set(list.map(({ c }) => [c.kind, c.round, c.roof, c.towers.length, c.keep.a0, c.front].join()));
    assert.ok(looks.size >= Math.min(list.length, 5), 'castles look different from each other');
  }
  // a world started before the spacing changed keeps its castles where they were
  W.applyWorld({ v: 2, seed: 4242, gen: 2, castleGap: 500, edits: [] });
  const a = W.castlesIn(W.CENTER - 1000, W.CENTER - 1000, W.CENTER + 1000, W.CENTER + 1000).map(c => c.sx + ',' + c.sz).sort().join(' ');
  W.setNext(1000);
  W.applyWorld({ v: 2, seed: 4242, gen: 2, castleGap: 500, edits: [] });
  assert.equal(W.castlesIn(W.CENTER - 1000, W.CENTER - 1000, W.CENTER + 1000, W.CENTER + 1000).map(c => c.sx + ',' + c.sz).sort().join(' '), a);
  W.setNext(500);
});

test('SPEC-016 G: castles stand on level ground, never in water, and are made of the new blocks', () => {
  W.initWorld(2024, 2, 500);
  const st = W.towerNearStart();
  let water = 0, kinds = new Set();
  for (let x = st.sx; x < st.sx + st.W; x++) for (let z = st.sz; z < st.sz + st.D; z++) {
    if (W.get(x, st.floorY - 1, z) === T.AIR) assert.fail('a hole in the floor at ' + x + ',' + z);
    for (let y = st.floorY - 1; y < st.floorY + st.height; y++) { const t = W.get(x, y, z); if (t === T.WATER) water++; kinds.add(t); }
  }
  assert.equal(water, 0, 'no water inside a castle');
  for (const t of [T.CSTONE, T.WOOD, T.GEM]) assert.ok(kinds.has(t), 'castle stone, wood floors and treasure gems: missing ' + t);
  // a tower house has a flat roof; towers on bigger castles have pointed roofs of tile
  W.initWorld(4242, 2, 500);
  let c = null; for (let gx = -2; gx <= 1 && !c; gx++) for (let gz = -2; gz <= 1 && !c; gz++) { const k = W.castleInCell(gx, gz); if (k && k.kind === 'castle') c = k; }
  const tw = c.towers[0];
  assert.ok([T.ROOF, T.ROOFB].includes(W.structBlock(c, Math.floor(tw.a), Math.floor(tw.b), tw.h + 1)), 'a pointed roof of tiles on a tower');
});
