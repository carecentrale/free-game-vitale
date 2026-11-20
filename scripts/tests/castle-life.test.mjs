// Castle life and travelling merchants (0.6.77): the plan of each courtyard (stalls, well, barrels...) and the merchants'
// roads between castles come from the castle plans and the seed alone. The world code is copied out of the game file, as in
// caves-castles.test.mjs. None of this changes the land: the land checks in that file still hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');
const start = game.indexOf('// ---- World: 400,000'), end = game.indexOf('// ---- Saving: the character', start);
const api = `;({ CENTER, T, initWorld, get, castlesIn, courtyardSpots, merchantRoads, roadLength, roadPoint, cellToWorld, gateStop })`;
const ctx = vm.createContext({ Math, Uint8Array, Int16Array, Float32Array, Map, Set, JSON, Number, String, Array,
  atob: s => Buffer.from(s, 'base64').toString('binary'), bytesToB64: u => Buffer.from(u).toString('base64') });
const W = vm.runInContext(game.slice(start, end) + api, ctx);
const T = W.T, solid = t => t !== T.AIR && t !== T.WATER;
const all = () => W.castlesIn(W.CENTER - 2000, W.CENTER - 2000, W.CENTER + 2000, W.CENTER + 2000);
const plain = v => JSON.parse(JSON.stringify(v));   // values made inside the copied world code, as plain values

test('every castle courtyard gets a well and stalls on open floor, with room to stand, clear of the path from the gate to the keep', () => {
  for (const s of [4242, 77, 1234]) {
    W.initWorld(s);
    const cs = all().filter(c => c.kind !== 'tower');
    assert.ok(cs.length >= 3, 'seed ' + s + ' has castles with courtyards');
    for (const c of cs.slice(0, 5)) {
      const spots = W.courtyardSpots(c);
      assert.ok(spots.length >= 4, 'a castle has at least a well and three more things');
      assert.equal(spots[0].kind, 'well');
      const mid = c.A / 2;
      for (const o of spots) {
        assert.ok(!(o.b < c.keep.b0 && Math.abs(o.a + 0.5 - mid) <= 6), 'nothing stands in the gate path');
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
          const [x, z] = W.cellToWorld(c, o.a + i, o.b + j), X = Math.floor(x), Z = Math.floor(z);
          assert.ok(solid(W.get(X, c.floorY - 1, Z)), 'floor under it');
          for (let d = 0; d < 4; d++) assert.equal(W.get(X, c.floorY + d, Z), T.AIR, 'open air above it');
        }
      }
      assert.deepEqual(plain(W.courtyardSpots(c)), plain(spots), 'the same plan every time');
    }
    for (const c of all().filter(c => c.kind === 'tower')) assert.equal(W.courtyardSpots(c).length, 0, 'a tower house has no courtyard');
  }
});

test('the castle frame: cellToWorld lands inside the castle, and its gate is open at the walking level', () => {
  W.initWorld(4242);
  for (const c of all().slice(0, 8)) {
    for (const [a, b] of [[0, 0], [3, 7], [c.A - 1, c.B - 1]]) {
      const [x, z] = W.cellToWorld(c, a, b);
      assert.ok(x >= c.sx && x < c.sx + c.W && z >= c.sz && z < c.sz + c.D);
    }
    if (c.kind === 'tower') continue;
    const [gx, gz] = W.cellToWorld(c, c.A / 2 - 0.5, 0);
    assert.equal(W.get(Math.floor(gx), c.floorY, Math.floor(gz)), T.AIR, 'the gate is open');
  }
});

test('merchants ride roads between neighbouring castles: from gate to gate, never through a castle, the same on every device', () => {
  for (const s of [4242, 77]) {
    W.initWorld(s);
    const cs = all();
    const roads = W.merchantRoads(W.CENTER, W.CENTER, 1500);
    assert.ok(roads.length >= 5, 'seed ' + s + ': there are roads');
    for (const r of roads) {
      const L = W.roadLength(r);
      assert.ok(L > 50 && L < 2500, 'a road is a sensible length');
      assert.deepEqual(plain(r.pts[0]), plain(W.gateStop(r.from)));
      assert.deepEqual(plain(r.pts[r.pts.length - 1]), plain(W.gateStop(r.to)));
      for (const c of [r.from, r.to]) { const [x, z] = W.gateStop(c); assert.ok(x < c.fx0 || x >= c.fx1 || z < c.fz0 || z >= c.fz1, 'the cart stops outside the castle and its slope'); }
      for (let d = 0; d <= L; d += 0.5) {
        const p = W.roadPoint(r, d);
        for (const c of cs) assert.ok(!(p.x > c.sx && p.x < c.sx + c.W && p.z > c.sz && p.z < c.sz + c.D), 'the road does not pass through a castle');
      }
    }
    W.initWorld(s);
    const again = W.merchantRoads(W.CENTER, W.CENTER, 1500).map(r => r.key + JSON.stringify(r.pts));
    assert.deepEqual(again, roads.map(r => r.key + JSON.stringify(r.pts)), 'the same roads after the world is made again');
  }
});
