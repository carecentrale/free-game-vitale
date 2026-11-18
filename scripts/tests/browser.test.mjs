// Opens the real game in Chromium and checks it while playing. Outside libraries (three.js, Supabase)
// are served from local copies, so this runs offline.
// Needs Chromium: set CHROME_PATH to a browser binary, or run `npx playwright install chromium`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const CENTER = 200000;
const CHROME_PATH = process.env.CHROME_PATH || '';

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* not installed */ }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.css': 'text/css' };
const THREE_DIR = path.join(root, 'node_modules', 'three');
// Replaces the Supabase library: every call returns a harmless empty result
const SUPABASE_STUB = `
const h = { get: (t, p) => p === 'then' ? (r) => r({ data: { session: null, user: null }, error: null }) : P, apply: () => P };
const P = new Proxy(function () {}, h);
export const createClient = () => P;
`;

function serveWww() {
  const dir = path.join(root, 'www');
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
      if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// A saved game standing in the middle of the world, so the game starts without the wizard
function savedGame() {
  return JSON.stringify({
    v: 1, at: Date.now(), name: 'Test Hero', profile: { sex: 'boy', race: 'human' }, worldId: null,
    inv: { dirt: 2, stone: 0, gem: 1, pick: 1, sword: 1 }, qb: ['pick', 'sword', null, null, null, null],
    recent: ['pick', 'sword'], sel: 0,
    pw: { dig: { lvl: 1, xp: 0 }, build: { lvl: 1, xp: 0 }, inv: { lvl: 1, xp: 0 }, fight: { lvl: 1, xp: 0 } },
    pos: [CENTER + 0.5, 30, CENTER + 0.5], yaw: 0,
    world: { v: 2, seed: 4242, edits: [] }, drops: [],
  });
}

// The saved game above, with Fighting level 2 and a world id so the game starts without the wizard
function fightLevel2Game() {
  const g = JSON.parse(savedGame());
  g.pw.fight = { lvl: 2, xp: 0 };
  g.worldId = 'TESTWORLD';
  g.profile = { sex: 'boy', race: 'human', name: 'Test Hero' };
  return JSON.stringify(g);
}

// The basic saved game, already in a world, so the game starts without the wizard (and without the level-2 skill choice)
function phoneGame() {
  const g = JSON.parse(savedGame());
  g.worldId = 'TESTWORLD';
  g.profile = { sex: 'boy', race: 'human', name: 'Test Hero' };
  return JSON.stringify(g);
}

// A character inside a lake (columns 199960, 200040 in seed 4242: sand at height 3, water from 4 to 8)
function swimGame() {
  const g = JSON.parse(savedGame());
  g.pos = [199960 + 0.5, 6, 200040 + 0.5];
  g.world = { v: 2, seed: 4242, edits: [] };
  g.worldId = 'TESTWORLD';
  g.profile = { sex: 'boy', race: 'human', name: 'Test Hero' };
  return JSON.stringify(g);
}

// A character in the water next to a shore (columns 200053..200059 in seed 4242: water, then land rising to 11)
function shoreGame() {
  const g = JSON.parse(savedGame());
  g.pos = [200055 + 0.5, 8, 199970 + 0.5];
  g.world = { v: 2, seed: 4242, edits: [] };
  g.worldId = 'TESTWORLD';
  g.profile = { sex: 'boy', race: 'human', name: 'Test Hero' };
  return JSON.stringify(g);
}

// The shore save at Fighting level 2, so magic is unlocked
function shoreGameLevel2() {
  const g = JSON.parse(shoreGame());
  g.pw.fight = { lvl: 2, xp: 0 };
  return JSON.stringify(g);
}

// Sets up the page: local three.js, a stub for Supabase, no other internet, and the saved game
async function setupPage(page, base, opts = {}) {
  // Registered first: Playwright checks the most recent rule first, so the rules below win
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\//, route => {
    const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.160.0/', '');
    const local = path.join(THREE_DIR, rel);
    if (!fs.existsSync(local)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(local) });
  });
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: SUPABASE_STUB }));
  // opts.audioList: stands in for www/audio/credits.json, so the sound tests have files to ask for
  if (opts.audioList) await page.route(/\/audio\/credits\.json$/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.audioList) }));
  const saves = opts.saves || [savedGame()];
  const choice = opts.choice === undefined ? '0' : opts.choice;
  await page.addInitScript(({ saves, choice }) => {
    if (!sessionStorage.getItem('seeded')) {
      saves.forEach((j, i) => localStorage.setItem('kidsgame.slot.' + i, j));
      if (choice !== null) sessionStorage.setItem('kidsgame.choice', choice);
      sessionStorage.setItem('seeded', '1');
    }
  }, { saves, choice });
  if (opts.init) await page.addInitScript(opts.init);   // runs before the game, e.g. to stand in for the Android app
  await page.goto(base + '/play/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.gameProbe === 'function', null, { timeout: 60000 });
}

const skip = !chromium ? 'playwright is not installed: run npm install'
  : (!CHROME_PATH && !process.env.CI && !fs.existsSync('/opt/pw-browsers') ? 'Chromium not configured: set CHROME_PATH' : false);

async function withGame(fn, opts) {
  const server = await serveWww();
  const base = `http://127.0.0.1:${server.address().port}`;
  // Software drawing (SwiftShader): the test browser draws frames the same way on every machine, also on the
  // build laptop with its screen off or locked, where the graphics chip may stop drawing (0.6.59)
  const browser = await chromium.launch({ ...(CHROME_PATH ? { executablePath: CHROME_PATH } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const requests = [];   // every address the page asks for (used by the sound tests)
  try {
    // opts.device: a phone-like page, for example { viewport: { width: 780, height: 360 }, hasTouch: true, isMobile: true }
    const page = await browser.newPage(opts && opts.device ? opts.device : { viewport: { width: 800, height: 600 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('request', r => requests.push(r.url()));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await setupPage(page, base, opts);
    await fn(page, errors, requests);
  } finally {
    await browser.close();
    server.close();
  }
}

test('the game starts from a saved game with blocks, enemies and no errors', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    let state = null;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      state = await page.evaluate(() => window.gameProbe());
      if (state.enemies > 0 && state.drawn > 0) break;
    }
    const banner = await page.evaluate(() => (document.getElementById('errBanner') || {}).textContent || '');
    assert.equal(banner, '', 'on-screen error banner: ' + banner);
    assert.deepEqual(errors, [], 'errors in the browser:\n' + errors.join('\n'));
    assert.ok(state.drawn > 0, 'no blocks were drawn: ' + JSON.stringify(state));
    assert.ok(state.enemies > 0, 'no enemies after a few seconds: ' + JSON.stringify(state));
  }));

test('enemies stay on the ground while the player roams', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    // Walk in a loop for about 20 seconds, turning now and then; check the enemies as we go
    const moves = ['KeyW', 'KeyW', 'KeyD', 'KeyW', 'KeyA', 'KeyW', 'KeyS', 'KeyD'];
    const bad = [];
    for (let step = 0; step < 40; step++) {
      const key = moves[step % moves.length];
      await page.keyboard.down(key);
      for (let k = 0; k < 2; k++) {
        await page.waitForTimeout(250);
        const st = await page.evaluate(() => window.gameProbe());
        for (const e of st.list) if (e.airT > 1.5) bad.push({ step, player: [st.px, st.py, st.pz].map(v => Math.round(v)), ...e });
      }
      await page.keyboard.up(key);
    }
    assert.deepEqual(errors, [], 'errors in the browser:\n' + errors.join('\n'));
    assert.deepEqual(bad.slice(0, 5), [], 'enemies hung in the air while the player roamed (first 5):\n' + JSON.stringify(bad.slice(0, 5)));
  }));

test('with saved games and none chosen, the start menu lists them (it does not show the new-player wizard)', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => document.querySelectorAll('#slots .savecard').length > 0, null, { timeout: 20000 });
    const names = await page.$$eval('#slots .savecard .sv-name', els => els.map(e => e.textContent.trim()));
    assert.equal(names.length, 2, 'the menu should list both saved games, got: ' + JSON.stringify(names));
    assert.deepEqual(errors, [], 'errors in the browser:\n' + errors.join('\n'));
  }, {
    saves: [savedGame(), JSON.stringify({ ...JSON.parse(savedGame()), name: 'Second Hero', world: { v: 2, seed: 99, edits: [] } })],
    choice: null,
  }));

// A saved game at Fighting level 2 (magic unlocks): the skill choice appears, and F fires a fireball
test('at Fighting level 2 the skill choice appears, and F shoots a fireball', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    await page.click('#skillPanel [data-skill="fireball"]');
    const chosen = await page.evaluate(() => window.gameProbe());
    assert.deepEqual(chosen.skills, ['fireball']);
    assert.equal(chosen.skillPanel, false);
    await page.keyboard.press('KeyF');
    const shot = await page.evaluate(() => window.gameProbe());
    assert.ok(shot.fireballs + shot.blasts >= 1, 'no fireball was shot: ' + JSON.stringify(shot));
    await page.waitForTimeout(1500);
    assert.deepEqual(errors, [], 'errors while playing: ' + errors.join(' | '));
  }, { saves: [fightLevel2Game()] }));

// Swimming: in water the character sinks slowly, and holding jump makes it rise
test('in water the character sinks slowly, and holding jump swims up', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => { const p = window.gameProbe(); return Math.abs(p.px - (199960 + 0.5)) < 0.01; }, null, { timeout: 60000 });
    const y0 = await page.evaluate(() => window.gameProbe().py);
    await page.waitForTimeout(300);
    const y1 = await page.evaluate(() => window.gameProbe().py);
    assert.ok(y1 < y0 && y0 - y1 < 0.8, `sinking should be slow: ${y0} -> ${y1}`);
    await page.keyboard.down('Space');
    await page.waitForTimeout(600);
    await page.keyboard.up('Space');
    const y2 = await page.evaluate(() => window.gameProbe().py);
    assert.ok(y2 > y1 + 0.8, `holding jump should swim up: ${y1} -> ${y2}`);
    assert.deepEqual(errors, [], 'errors while swimming: ' + errors.join(' | '));
  }, { saves: [swimGame()] }));

// Climbing out: from the water, holding right and jump takes the character up onto the shore
test('from the water, holding right and jump climbs out onto the shore', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => Math.abs(window.gameProbe().px - (200055 + 0.5)) < 0.01, null, { timeout: 60000 });
    // Hold right and jump, and play the game's frames directly (1/60 s each, up to 6 s of game time).
    // Playing in real time failed on slow test machines: they drew only about 15-20 frames a minute, not enough game time to climb out.
    await page.evaluate(() => {
      const g = window.gameTest;
      g.setYaw(0);
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      for (let i = 0; i < 360 && window.gameProbe().px <= 200058; i++) g.stepFrames([1 / 60]);
      dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
      dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    });
    const p = await page.evaluate(() => window.gameProbe());
    assert.ok(p.px > 200058, `the character did not get out of the water: x ${p.px}, y ${p.py}`);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [shoreGame()] }));

// ---- Game rules: enemies, damage, gear, durability, drops, parts and old saves ----
// These call the game's own rules through window.gameTest (a read-only hook, see the game file).

test('every enemy kind has a name, power, health, toughness, weaknesses and parts that exist', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const kinds = await page.evaluate(() => Object.entries(window.gameTest.ENEMY_KINDS).map(([id, k]) => ({
      id, name: k.name, power: k.power, health: k.health, toughness: k.toughness, weak: k.weak,
      partsOk: k.parts.every(p => !!window.gameTest.ITEMS[p]),
    })));
    assert.equal(kinds.length, 6, 'expected six enemy kinds');
    for (const k of kinds) {
      assert.ok(typeof k.name === 'string' && k.name.length > 0, `${k.id} needs a name`);
      assert.ok(Number.isInteger(k.power) && k.power >= 1, `${k.id} needs a whole power level`);
      assert.ok(k.health > 0, `${k.id} needs health`);
      assert.ok(k.toughness >= 0, `${k.id} toughness cannot be negative`);
      assert.ok(Array.isArray(k.weak), `${k.id} needs a weaknesses list`);
      assert.ok(k.partsOk, `${k.id} drops a part that is not in ITEMS`);
    }
    assert.deepEqual(kinds.find(k => k.id === 'goblin').weak, ['fire'], 'goblins are weak to fire');
    assert.deepEqual(kinds.find(k => k.id === 'imp').weak, ['holy'], 'imps are weak to holy light');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [savedGame()] }));

test('fire does double damage to a goblin, and toughness takes off damage', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const d = window.gameTest.damageTo;
      return {
        fireGoblin: d({ kind: 'goblin' }, 4, 'fire'),
        swordGoblin: d({ kind: 'goblin' }, 4, 'sword'),
        fireImp: d({ kind: 'imp' }, 4, 'fire'),
        bruteTough: d({ kind: 'brute' }, 5, 'sword'),
        bruteWeak: d({ kind: 'brute' }, 1, 'sword'),
      };
    });
    assert.equal(r.fireGoblin, 8, 'fire against a goblin: double');
    assert.equal(r.swordGoblin, 4, 'a sword against a goblin: normal');
    assert.equal(r.fireImp, 4, 'an imp is not weak to fire');
    assert.equal(r.bruteTough, 3, 'a brute has toughness 2');
    assert.equal(r.bruteWeak, 1, 'damage never drops below 1');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [savedGame()] }));

test('a hit takes health off an enemy, and the enemy is still there while health is left', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const hp = await page.evaluate(() => {
      const en = { kind: 'goblin', hp: 10 };
      window.gameTest.hurtEnemy(en, 3);
      return en.hp;
    });
    assert.equal(hp, 7);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [savedGame()] }));

test('a weapon hits harder with more damage and the Fighting level', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const g = window.gameTest;
      const plain = g.weaponDamage(g.gear.find(x => x.t === 'sword').uid);
      const gold = g.addGear('gold_sword');
      return { plain, gold: g.weaponDamage(gold.uid), fight: g.pw.fight.lvl };
    });
    assert.equal(r.plain, r.fight + 0, 'a plain sword adds nothing to the Fighting level');
    assert.equal(r.gold, r.fight + 5, 'a gold sword adds 5 to the Fighting level');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [savedGame()] }));

test('gear wears with each use, and a piece that reaches zero breaks and leaves the bag and quick bar', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const g = window.gameTest;
      const sword = g.gear.find(x => x.t === 'sword');
      const uid = sword.uid;
      g.wear(uid, 1);
      const afterOne = g.gearOf(uid).dur;
      const label = g.labelOf(uid);
      g.gearOf(uid).dur = 1;
      g.wear(uid, 1);
      return { afterOne, label, broke: g.gearOf(uid) === null, inQuickBar: g.qb.includes(uid), inRecent: g.recent.includes(uid) };
    });
    assert.equal(r.afterOne, 59, 'a sword starts at 60 uses');
    assert.match(r.label, /Sword 59\/60/, 'the bag shows the durability');
    assert.ok(r.broke, 'the sword breaks at zero');
    assert.equal(r.inQuickBar, false, 'a broken sword leaves the quick bar');
    assert.equal(r.inRecent, false, 'a broken sword leaves the recent list');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [savedGame()] }));

test('a new piece of gear starts with full durability and goes to the front of the recent list', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const g = window.gameTest;
      const item = g.addGear('iron_sword');
      return { dur: item.dur, max: g.GEAR.iron_sword.dur, found: !!g.gearOf(item.uid), first: g.recent[0] === item.uid, label: g.labelOf(item.uid) };
    });
    assert.equal(r.dur, r.max);
    assert.ok(r.found, 'the new gear is in the bag');
    assert.ok(r.first, 'the new gear is the most recent');
    assert.equal(r.label, 'Iron Sword 90/90');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [savedGame()] }));

test('stronger monsters drop better gear, and weak ones never drop the best gear', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const g = window.gameTest;
      const weak = new Set(), strong = new Set();
      for (let i = 0; i < 400; i++) { weak.add(g.gearFor(1)); strong.add(g.gearFor(4)); }
      const power = Object.fromEntries(Object.keys(g.GEAR).map(t => [t, g.GEAR[t].power || 1]));
      return { weak: [...weak], strong: [...strong], power };
    });
    for (const t of r.weak) assert.ok(r.power[t] <= 1, `a power 1 monster dropped ${t}`);
    assert.ok(r.strong.includes('gold_sword'), 'a power 4 monster can drop a gold sword');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [savedGame()] }));

test('creature parts stack in the bag and show how many there are', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const g = window.gameTest;
      g.addItem('goblin_ear', 1);
      g.addItem('goblin_ear', 2);
      return { count: g.inv.goblin_ear, label: g.labelOf('goblin_ear') };
    });
    assert.equal(r.count, 3);
    assert.equal(r.label, 'Goblin Ear x3');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [savedGame()] }));

test('an old save with the pickaxe and sword ids still loads them as gear', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const g = window.gameTest;
      return { q0: g.qb[0], q1: g.qb[1], pick: g.defOf(g.qb[0]) && g.tplOf(g.qb[0]), sword: g.tplOf(g.qb[1]) };
    });
    assert.equal(r.q0, 'g1', 'the old pickaxe slot becomes gear g1');
    assert.equal(r.q1, 'g2', 'the old sword slot becomes gear g2');
    assert.equal(r.pick, 'pick');
    assert.equal(r.sword, 'sword');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [savedGame()] }));

test('next to water the jump climbs, but on dry land away from water it does not', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const r = await page.evaluate(() => ({
      nearLake: window.gameTest.waterNear(200055.5, 8, 199970.5),
      dryLand: window.gameTest.waterNear(200000.5, 30, 200000.5),
    }));
    assert.equal(r.nearLake, true, 'the shore is next to water');
    assert.equal(r.dryLand, false, 'dry land has no water to climb from');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [shoreGame()] }));


// Fireball controls: right-click on PC, and the Fire button on tablets and phones
test('with the fireball selected, right-click casts a fireball', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    await page.click('#skillPanel [data-skill="fireball"]');
    await page.keyboard.press('Digit3');   // the fireball went into the first empty quick bar slot (slot 3)
    const before = await page.evaluate(() => { const p = window.gameProbe(); return p.fireballs + p.blasts; });
    await page.mouse.click(400, 300, { button: 'right' });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => { const p = window.gameProbe(); return p.fireballs + p.blasts; });
    assert.ok(after > before, `right-click did not cast a fireball: ${before} -> ${after}`);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [fightLevel2Game()] }));

test('the Spell button is hidden until on-screen controls are on, then tapping it casts a fireball; there is no FIRE button', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    await page.click('#skillPanel [data-skill="fireball"]');
    assert.equal(await page.evaluate(() => !!document.getElementById('bFire')), false, 'the FIRE button should be gone');
    const hidden = await page.evaluate(() => getComputedStyle(document.getElementById('bSpell')).display);
    assert.equal(hidden, 'none', 'the Spell button should be hidden while on-screen controls are off');
    await page.click('#toggle');
    // The game shows or hides the Spell button on its next frame, which can take a while on a slow machine: wait for it
    const shown = await page.waitForFunction(() => getComputedStyle(document.getElementById('bSpell')).display !== 'none', null, { timeout: 30000 }).then(() => true, () => false);
    assert.ok(shown, 'the Spell button should show once on-screen controls are on');
    const before = await page.evaluate(() => { const p = window.gameProbe(); return p.fireballs + p.blasts; });
    await page.evaluate(() => document.getElementById('bSpell').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
    const after = await page.waitForFunction(b => { const p = window.gameProbe(); return p.fireballs + p.blasts > b && p.fireballs + p.blasts; }, before, { timeout: 30000 })
      .then(h => h.jsonValue(), () => before);
    assert.ok(after > before, `the Spell button did not cast: ${before} -> ${after}`);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [fightLevel2Game()] }));

// A shot at a screen point is fired from the character toward that point, and it lasts long enough to reach a target
test('a fireball aimed at a screen point is fired and flies toward it', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    await page.click('#skillPanel [data-skill="fireball"]');
    await page.waitForFunction(() => window.gameTest.skills.includes('fireball'), null, { timeout: 60000 });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const g = window.gameTest;
      const before = g.fireballs.length;
      g.fireAt(innerWidth / 2, innerHeight / 2);
      const f = g.fireballs[g.fireballs.length - 1];
      return { added: g.fireballs.length - before, speed: f ? Math.hypot(f.vx, f.vy, f.vz) : 0, life: f ? f.life : 0 };
    });
    assert.equal(r.added, 1, 'fireAt should fire one fireball');
    assert.ok(Math.abs(r.speed - 16) < 0.01 || r.speed > 15, 'the fireball should fly at its speed: ' + r.speed);
    assert.ok(r.life >= 1.6, 'the fireball should last at least its normal time');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [fightLevel2Game()] }));

// A fireball aimed at a block is fired from the character toward the exact point clicked, so it lands on that block
test('a fireball aimed at a block flies from the character to the point that was clicked', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    await page.click('#skillPanel [data-skill="fireball"]');
    await page.waitForFunction(() => window.gameTest.skills.includes('fireball'), null, { timeout: 60000 });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const g = window.gameTest, p = window.gameProbe();
      // Find a screen point, from low to the centre, that is over a block
      let sx = 0, sy = 0, a = null;
      for (const fy of [0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5]) {
        for (const fx of [0.5, 0.45, 0.55, 0.4, 0.6]) {
          const c = g.aimAt(innerWidth * fx, innerHeight * fy);
          if (c && c.point) { sx = innerWidth * fx; sy = innerHeight * fy; a = c; break; }
        }
        if (a) break;
      }
      if (!a) return { hit: false };
      const before = g.fireballs.length;
      g.fireAt(sx, sy);
      const f = g.fireballs[g.fireballs.length - 1];
      const want = { x: a.point.x - p.px, y: a.point.y - (p.py + 1.6 * 0.7), z: a.point.z - p.pz };
      const wl = Math.hypot(want.x, want.y, want.z), fl = Math.hypot(f.vx, f.vy, f.vz);
      const dot = (want.x * f.vx + want.y * f.vy + want.z * f.vz) / (wl * fl);
      return { hit: true, added: g.fireballs.length - before, dot };
    });
    assert.ok(r.hit, 'the screen point should hit a block or the ground');
    assert.equal(r.added, 1, 'one fireball should be fired');
    assert.ok(r.dot > 0.999, 'the fireball should fly straight at the clicked point, alignment ' + r.dot);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [fightLevel2Game()] }));

// A fireball aimed at water flies to the water's surface and bursts there, instead of passing through to the ground
test('a fireball aimed at water bursts on the water', { skip, timeout: 480000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    await page.click('#skillPanel [data-skill="fireball"]');
    await page.waitForFunction(() => window.gameTest.skills.includes('fireball'), null, { timeout: 60000 });
    await page.waitForTimeout(800);
    await page.waitForFunction(() => window.gameTest.pendingNear(2) === 0, null, { timeout: 60000 });   // the chunks right around the player exist (far chunks and scenery are not needed for this check)
    await page.evaluate(() => window.gameTest.settleCamera());   // put the camera behind the player now, instead of waiting for it to ease there
    // A short shot: the closest water with a clear line (a few blocks away), so the fireball does not have far to fly
    const fired = await page.evaluate(() => window.gameTest.fireAtNearestWater(8));
    assert.ok(fired, 'no water with a clear line within 8 blocks of the start');
    await page.waitForFunction(() => window.gameTest.lastShot && window.gameTest.lastShot.burst, null, { timeout: 60000 });
    const b = await page.evaluate(() => { const s = window.gameTest.lastShot; return { cell: window.gameTest.cellAt(...s.burst), by: s.burstBy, water: window.gameTest.T.WATER }; });
    assert.equal(b.cell, b.water, 'the fireball should burst on water, not pass through it (burst cell type ' + b.cell + ', by ' + b.by + ')');
    assert.equal(b.by, 'water', 'water should put the fireball out (fizzle), not blast it: ' + b.by);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [shoreGameLevel2()] }));

// Scenery models load and are placed on the grass in the chunks around the player
test('trees and other scenery load and appear on the grass around the player', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest.decorReady(), null, { timeout: 90000 });
    await page.waitForFunction(() => window.gameTest.decorCount() > 0 && window.gameTest.pendingChunks() === 0, null, { timeout: 120000 });
    const r = await page.evaluate(() => ({ count: window.gameTest.decorCount(), kinds: window.gameTest.decorKinds(), clear: window.gameTest.DECOR_CLEAR }));
    assert.ok(r.count > 0, 'no scenery was placed: ' + JSON.stringify(r));
    assert.ok(r.kinds.includes('common') && r.kinds.includes('grass'), 'scenery kinds: ' + r.kinds.join(','));
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }));

// Scenery made in code (0.6.58): every shape of every kind is built, with no model files
test('cactuses, ice crystals, snowmen and pumpkins are built in the game', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest.decorReady(), null, { timeout: 90000 });
    const made = await page.evaluate(() => window.gameTest.decorMade());
    assert.deepEqual(made.map(m => m.kind).sort(), ['cactus', 'crystal', 'pumpkin', 'snowman']);
    for (const m of made) {
      assert.equal(m.shapes, m.want, m.kind + ' should have ' + m.want + ' shapes, has ' + m.shapes);
      assert.ok(m.points > 0, m.kind + ' has an empty shape');
    }
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }));

// Monster models (0.6.58): every Imp and Spike Beast shows its own model, and the bones move when it walks
test('each Imp and Spike Beast has its own model, and its legs, arms and head move', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    for (const kind of ['imp', 'spike']) {
      await page.waitForFunction(k => { const t = window.gameTest; while (t.enemies.filter(e => e.kind === k).length < 2) { if (!t.spawnKind(k)) return false; } return true; }, kind, { timeout: 60000 });
      await page.waitForFunction(k => window.gameTest.rigged(k).length >= 2, kind, { timeout: 120000 });
      const r = await page.evaluate(k => {
        const t = window.gameTest, list = t.rigged(k);
        return {
          skinned: list.map(e => e.skinned),
          ownBones: list[0].bones[0] !== list[1].bones[0],
          names: Object.keys(list[0].rig).sort(),
          stand: t.poseAngles(list[0].rig, false, 0, 0, 0),
          stepA: t.poseAngles(list[0].rig, true, Math.PI / 2, 0, 0),
          stepB: t.poseAngles(list[0].rig, true, -Math.PI / 2, 0, 0),
          look: t.poseAngles(list[0].rig, false, 0, 2, 0),
          other: t.poseAngles(list[1].rig, false, 0, 0, 0),
        };
      }, kind);
      assert.ok(r.skinned.every(n => n > 0), kind + ': every one should show its model: ' + JSON.stringify(r.skinned));
      assert.ok(r.ownBones, kind + ': two of them share one skeleton');
      assert.deepEqual(r.names, ['Head', 'calf_l', 'calf_r', 'thigh_l', 'thigh_r', 'upperarm_l', 'upperarm_r'], kind + ' bones');
      assert.ok(r.stand.thigh_l === 0 && r.stand.thigh_r === 0, kind + ': legs should be still when standing');
      assert.ok(r.stand.upperarm_l > 1 && r.stand.upperarm_r > 1, kind + ': arms should hang down when standing');
      assert.ok(r.stepA.thigh_l > 0.3 && r.stepA.thigh_r > 0.3, kind + ': both legs should swing when walking: ' + JSON.stringify(r.stepA));
      assert.ok(r.stepA.calf_r > 0.3 && r.stepA.calf_l === 0, kind + ': one knee bends on one step');
      assert.ok(r.stepB.calf_l > 0.3 && r.stepB.calf_r === 0, kind + ': the other knee bends on the next step');
      assert.ok(r.look.Head > 0.1, kind + ': the head should look around when standing');
      assert.ok(r.other.upperarm_l > 1, kind + ': the second one moves too');
    }
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }));

// The monsters made in code swing their arms and legs
test('a goblin has arms and legs that the game can swing', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => { const t = window.gameTest; return t.enemies.some(e => e.kind === 'goblin') || (t.spawnKind('goblin'), false); }, null, { timeout: 60000 });
    const limbs = await page.evaluate(() => { const l = window.gameTest.enemies.find(e => e.kind === 'goblin').group.userData.limbs; return { arms: l.arms.length, legs: l.legs.length }; });
    assert.deepEqual(limbs, { arms: 2, legs: 2 });
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }));

// Performance is measured while the world is drawn: the numbers are printed so they can be recorded in docs/PERFORMANCE.md
test('performance is measured: frame rate, memory, draw calls, triangles', { skip, timeout: 400000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    await page.click('#skillPanel [data-skill="fireball"]');
    await page.waitForFunction(() => window.gameTest.skills.includes('fireball'), null, { timeout: 60000 });
    await page.waitForFunction(() => window.gameTest.decorReady() && window.gameTest.pendingChunks() === 0, null, { timeout: 300000 });
    await page.evaluate(() => window.gameTest.settleCamera());
    await page.waitForTimeout(4000);
    const p = await page.evaluate(() => window.gameTest.perf());
    console.log('PERF_RECORD ' + JSON.stringify(p));
    assert.ok(p.fps > 0 && p.frameMs > 0, 'frame rate should be measured: ' + JSON.stringify(p));
    assert.ok(p.heapMB > 0 && p.calls > 0 && p.tris > 0 && p.chunks > 0, 'metrics should be filled in: ' + JSON.stringify(p));
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [fightLevel2Game()] }));

// Clicking an enemy sends the fireball to it: it follows the enemy and hurts it, and does not burst on the character
test('a shot at any part of an enemy is linked to that enemy, so it flies to it', { skip, timeout: 150000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    await page.click('#skillPanel [data-skill="fireball"]');
    await page.waitForFunction(() => window.gameTest.skills.includes('fireball'), null, { timeout: 60000 });
    // Turn the camera (set directly) until an enemy is in front of it and on the screen
    let target = null;
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
      if (target) break;
      target = await page.evaluate(y => {
        window.gameTest.setYaw(y);
        const g = window.gameTest, pr = window.gameProbe();
        const c = g.enemies.map((en, i) => ({ i, d: Math.hypot(en.x - pr.px, en.y - pr.py, en.z - pr.pz), s: g.screenOf(en) }))
          .filter(o => o.s[2] && o.s[0] > 40 && o.s[0] < innerWidth - 40 && o.s[1] > 40 && o.s[1] < innerHeight - 160 && o.d < 40)
          .sort((a, b) => a.d - b.d)[0];
        return c ? { i: c.i, x: c.s[0], y: c.s[1] + 12 } : null;
      }, yaw);
      await page.waitForTimeout(800);   // the camera moves smoothly: let it settle, then look again
      if (!target) target = await page.evaluate(() => { const g = window.gameTest, pr = window.gameProbe(); const c = g.enemies.map((en, i) => ({ i, d: Math.hypot(en.x - pr.px, en.y - pr.py, en.z - pr.pz), s: g.screenOf(en) })).filter(o => o.s[2] && o.s[0] > 40 && o.s[0] < innerWidth - 40 && o.s[1] > 40 && o.s[1] < innerHeight - 160 && o.d < 40).sort((a, b) => a.d - b.d)[0]; return c ? { i: c.i, x: c.s[0], y: c.s[1] + 12 } : null; });
    }
    assert.ok(target, 'no enemy could be brought into view');
    // Fire at a point on the enemy's body, the same way a right-click or tap does
    const r = await page.evaluate(([x, y]) => {
      const g = window.gameTest;
      const hit = g.enemyAt(x, y);
      const before = g.fireballs.length;
      g.fireAt(x, y);
      const f = g.fireballs[g.fireballs.length - 1];
      return { hit: !!hit, added: g.fireballs.length - before, linked: !!(f && f.homing) };
    }, [target.x, target.y]);
    assert.ok(r.hit, 'the click on the enemy body should find the enemy');
    assert.equal(r.added, 1, 'one fireball should be fired');
    assert.ok(r.linked, 'the fireball should be linked to the enemy it was fired at');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [fightLevel2Game()] }));

// The extra jump: in the air, just after leaving the water, one more tap of jump lifts the character again
test('after leaving the water, a tap of jump in the air gives one extra jump', { skip, timeout: 150000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => Math.abs(window.gameProbe().px - (200055 + 0.5)) < 0.01, null, { timeout: 60000 });
    // Plays the game's frames directly (1/60 s each), like the shore test. In real time it failed on slow or busy test machines
    // (the build laptop with its screen off): a 150 ms tap of jump could fall between two frames, so the game never saw it.
    const r = await page.evaluate(() => {
      const g = window.gameTest;
      const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code }));
      g.setYaw(0);
      // Hold right and jump to climb, then let go of jump once the character is up over the step
      key('keydown', 'KeyD'); key('keydown', 'Space');
      for (let i = 0; i < 360; i++) { const p = window.gameProbe(); if (p.px > 200057.6 && p.py > 10.5) break; g.stepFrames([1 / 60]); }
      key('keyup', 'Space'); key('keyup', 'KeyD');
      g.stepFrames([1 / 60]);   // one frame with jump let go, so the next press is a new press
      const before = window.gameProbe();
      // Tap jump in the air: the extra jump
      key('keydown', 'Space');
      let peak = -99;
      for (let i = 0; i < 9; i++) { g.stepFrames([1 / 60]); peak = Math.max(peak, window.gameProbe().vy); }
      key('keyup', 'Space');
      return { before, peak };
    });
    assert.ok(r.before.px > 200057.6 && r.before.py > 10.5, 'the character should have climbed up over the step: ' + JSON.stringify(r.before));
    assert.ok(!r.before.onGround, 'the character should be in the air after letting go of jump: ' + JSON.stringify(r.before));
    assert.ok(r.peak > 2, `the extra jump did not lift the character: peak upward speed ${r.peak}`);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [shoreGame()] }));

// 0.6.54, shake fix part 1. The world starts 200,000 blocks from zero. A graphics card keeps about 7 digits, so numbers that big
// are drawn in coarse steps and the ground shakes as the camera moves. Blocks and scenery must reach the graphics card as small
// numbers (counted from their chunk's corner), and must still stand exactly where the world says they are.
test('blocks and scenery are drawn with small numbers, in the right places (no shake far from zero)', { skip, timeout: 400000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest.decorReady() && window.gameTest.pendingChunks() === 0 && window.gameProbe().drawn > 0, null, { timeout: 300000 });
    const biggest = await page.evaluate(() => window.gameTest.maxDrawnCoord());
    assert.ok(biggest > 0 && biggest < 200, `a block or scenery piece is drawn with a large position number (${biggest}); it should be counted from its chunk's corner`);
    const blocks = await page.evaluate(() => window.gameTest.drawnBlocks());
    assert.ok(blocks.n > 0, 'no blocks were drawn');
    assert.equal(blocks.bad, 0, `${blocks.bad} of ${blocks.n} drawn blocks stand where the world has no block`);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }));

// 0.6.54, shake fix part 2. The camera eases behind the character. With uneven frame times the gap between them must stay the same,
// otherwise the character and the world appear to shake. The frame times below mix fast, normal and slow frames.
test('the camera keeps a steady gap behind a walking character when frame times are uneven', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const dts = [];
    let s = 7;
    for (let i = 0; i < 600; i++) { s = (s * 16807) % 2147483647; const r = s / 2147483647; dts.push(r < 0.5 ? 1 / 60 : r < 0.7 ? 1 / 120 : r < 0.9 ? 2 / 60 : 0.05); }
    const { gaps, rate } = await page.evaluate(d => ({ gaps: window.gameTest.camFollowGaps(5, d), rate: window.gameTest.camRate }), dts);
    const want = 5 / rate;
    const worst = Math.max(...gaps.map(g => Math.abs(g - want)));
    assert.ok(gaps.length > 100 && worst < 1e-6, `the gap should stay at ${want.toFixed(4)} blocks; it strayed by ${worst}`);
    // At a steady 60 frames a second the camera feels as it did before: it closes about 12% of the gap each frame
    assert.ok(Math.abs(rate - (-Math.log(0.88) * 60)) < 1e-9, 'camera follow rate changed: ' + rate);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }));

// The saved game in the middle of the world, with a world id so the game starts running at once (no wizard, no skill choice)
function standingGame() {
  const g = JSON.parse(savedGame());
  g.worldId = 'TESTWORLD';
  g.profile = { sex: 'boy', race: 'human', name: 'Test Hero' };
  return JSON.stringify(g);
}

// 0.6.55. The landing squash is for landings only. Standing on the ground used to count as landing on every frame,
// so the character stayed squashed by an amount that changed with the frame time, and its head bobbed while standing still.
test('the character keeps its full height while standing still, and a jump still squashes it', { skip, timeout: 150000 }, () =>
  withGame(async (page, errors) => {
    // Frames are played straight away through the test hook, so the check does not depend on how fast this machine draws
    const step = dts => page.evaluate(d => window.gameTest.stepFrames(d), dts);
    // Let the character drop from its starting height and settle on the ground
    let settled = false;
    for (let i = 0; i < 40 && !settled; i++) { const f = (await step(Array(60).fill(1 / 60))).pop(); settled = f.g && f.s === 1; }
    assert.ok(settled, 'the character did not come to rest on the ground');
    // Stand still through fast, normal and slow frames
    const dts = [];
    let s = 11;
    for (let i = 0; i < 400; i++) { s = (s * 16807) % 2147483647; const r = s / 2147483647; dts.push(r < 0.5 ? 1 / 60 : r < 0.7 ? 1 / 120 : r < 0.9 ? 2 / 60 : 0.05); }
    const still = await step(dts);
    const squashed = still.filter(f => f.s !== 1);
    assert.equal(squashed.length, 0, `standing still, the character was squashed on ${squashed.length} of ${still.length} frames (height scale as low as ${Math.min(...still.map(f => f.s))})`);
    assert.ok(still.every(f => f.g), 'standing still, the character was counted as in the air on some frames');
    assert.ok(Math.max(...still.map(f => f.y)) - Math.min(...still.map(f => f.y)) < 1e-9, 'standing still, the character moved up or down');
    // A jump still squashes the character at take-off, and landing from it squashes it again
    await page.keyboard.down('Space');
    const jump = await step(Array(90).fill(1 / 60));
    await page.keyboard.up('Space');
    assert.ok(jump[0].s < 0.95, 'the start of a jump did not squash the character');
    const landed = jump.findIndex((f, i) => i > 5 && f.g);
    assert.ok(landed > 5 && jump[landed].s < 0.95, 'landing from a jump did not squash the character');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [standingGame()] }));


// ---- Phone controls (0.6.57) ----
// A Samsung S22 is about 780 x 360 points held sideways, and 360 x 780 held upright
const PHONE_WIDE = { viewport: { width: 780, height: 360 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };
const PHONE_TALL = { viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };
const PHONE_CONTROLS = ['stick', 'bJ', 'bH1', 'bH2', 'hudBtn', 'toggle', 'bagBtn', 'settingsBtn', 'teleBtn'];

// Every listed control that is shown must sit fully inside the screen
async function offScreenControls(page) {
  return page.evaluate(ids => ids.map(id => {
    const el = document.getElementById(id);
    if (!el || getComputedStyle(el).display === 'none') return null;
    const r = el.getBoundingClientRect();
    const inside = r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
    return inside ? null : `${id}: ${[r.left, r.top, r.right, r.bottom].map(Math.round).join(',')} on ${innerWidth}x${innerHeight}`;
  }).filter(Boolean), PHONE_CONTROLS);
}

for (const [label, device] of [['held sideways', PHONE_WIDE], ['held upright', PHONE_TALL]]) {
  test(`on a phone ${label}, the controls fit the screen and the quick bar and power meters start hidden`, { skip, timeout: 120000 }, () =>
    withGame(async (page, errors) => {
      await page.waitForTimeout(1500);
      const st = await page.evaluate(() => ({
        phone: document.body.classList.contains('phone'),
        qb: getComputedStyle(document.getElementById('qb')).display,
        recent: getComputedStyle(document.getElementById('recent')).display,
        bars: (() => { const b = document.querySelector('#hud .bars'); return b ? getComputedStyle(b).display : 'missing'; })(),
        hudBtn: getComputedStyle(document.getElementById('hudBtn')).display,
        arrows: ['bF', 'bL', 'bR', 'bB'].filter(id => document.getElementById(id)).length,
      }));
      assert.ok(st.phone, 'the phone layout should be on');
      assert.equal(st.arrows, 0, 'the old arrow buttons should be gone');
      assert.equal(st.qb, 'none', 'the quick bar should start hidden on a phone');
      assert.equal(st.recent, 'none', 'the recent list should start hidden on a phone');
      assert.equal(st.bars, 'none', 'the power meters should start hidden on a phone');
      assert.notEqual(st.hudBtn, 'none', 'the button to show them should be visible');
      assert.deepEqual(await offScreenControls(page), [], 'controls outside the screen');
      assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
    }, { device, saves: [phoneGame()] }));
}

test('on a phone, the top-left button shows the quick bar and meters, and choosing a tool hides them again', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForTimeout(1500);
    // Taps are sent straight to the elements: the test browser can draw slowly, which makes simulated taps time out
    await page.evaluate(() => document.getElementById('hudBtn').click());
    const open = await page.evaluate(() => ({
      qb: getComputedStyle(document.getElementById('qb')).display,
      bars: getComputedStyle(document.querySelector('#hud .bars')).display,
      panel: window.gameTest.panelOpen,
    }));
    assert.ok(open.panel && open.qb !== 'none' && open.bars !== 'none', 'tapping the button should show the quick bar and meters: ' + JSON.stringify(open));
    // The open quick bar must also fit the screen
    const qbBox = await page.evaluate(() => { const r = document.getElementById('qb').getBoundingClientRect(); return [r.left, r.right, r.bottom, innerWidth, innerHeight]; });
    assert.ok(qbBox[0] >= 0 && qbBox[1] <= qbBox[3] + 0.5 && qbBox[2] <= qbBox[4] + 0.5, 'the open quick bar goes off the screen: ' + qbBox.map(Math.round).join(','));
    await page.evaluate(() => document.querySelector('#qb [data-slot="1"]').click());
    const after = await page.evaluate(() => ({ panel: window.gameTest.panelOpen, qb: getComputedStyle(document.getElementById('qb')).display, btn: document.getElementById('hudBtn').textContent }));
    assert.equal(after.panel, false, 'choosing a tool should close the bar');
    assert.equal(after.qb, 'none', 'the quick bar should be hidden again');
    assert.match(after.btn, /Sword/, 'the button should show the chosen tool: ' + after.btn);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PHONE_WIDE, saves: [phoneGame()] }));

test('the thumb stick moves with the finger, springs back when let go, and a small push walks slower', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameProbe().drawn > 0, null, { timeout: 60000 });
    await page.waitForTimeout(1000);
    // A finger on the stick: pointer events at screen points, measured from the stick's middle
    const finger = (type, fx, fy) => page.evaluate(([type, fx, fy]) => {
      const el = document.getElementById('stick'), r = el.getBoundingClientRect(), half = r.width / 2;
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true,
        clientX: r.left + half + fx * half, clientY: r.top + half + fy * half }));
      return window.gameTest.stick;
    }, [type, fx, fy]);
    await finger('pointerdown', 0, 0);
    const held = await finger('pointermove', 1.5, 0);
    assert.ok(held.x > 0.95 && Math.abs(held.z) < 0.05, 'pushed all the way right, the stick should read about x=1: ' + JSON.stringify(held));
    const half = await finger('pointermove', 0, -0.5);
    assert.ok(Math.abs(half.z + 0.5) < 0.02 && half.x === 0, 'pushed halfway up, the stick should read about z=-0.5: ' + JSON.stringify(half));
    const centre = await finger('pointermove', 0, 0.05);
    assert.deepEqual(centre, { x: 0, z: 0 }, 'a tiny push near the middle should do nothing');
    await finger('pointerup', 0, 0.05);
    const released = await page.evaluate(() => window.gameTest.stick);
    assert.deepEqual(released, { x: 0, z: 0 }, 'letting go should stop the character');
    // Walking speed with a half and a full push (speed, not distance, so a wall in the way does not matter)
    const speed = await page.evaluate(() => {
      const g = window.gameTest, at = v => { g.setStick(0, -v); g.stepFrames([1 / 60]); const sp = g.walkSpeed; g.setStick(0, 0); return sp; };
      return { half: at(0.5), full: at(1), keysOff: (g.stepFrames([1 / 60]), g.walkSpeed) };
    });
    assert.ok(speed.full > 2, 'a full push should walk: ' + JSON.stringify(speed));
    assert.ok(Math.abs(speed.half / speed.full - 0.5) < 0.05, 'a half push should walk at about half speed: ' + JSON.stringify(speed));
    assert.equal(speed.keysOff, 0, 'with the stick let go the character should stop');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PHONE_WIDE, saves: [phoneGame()] }));

// The saved game with a world id and a full profile, so the game starts straight away (no wizard)
function readyGame() {
  const g = JSON.parse(savedGame());
  g.worldId = 'TESTWORLD';
  g.profile = { sex: 'boy', race: 'human', name: 'Test Hero' };
  return JSON.stringify(g);
}

// Quit (0.6.59): Esc asks first, closes open panels before asking, and Save and quit saves the game and leaves for the home page.
// Buttons are pressed with click events: real mouse clicks can stall while the slow test machine draws the world
test('Esc asks before quitting, and Save and quit saves the game and goes to the home page', { skip, timeout: 150000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!window.gameTest, null, { timeout: 60000 });
    const st = () => page.evaluate(() => ({ quit: window.gameTest.quitOpen, bag: window.gameTest.bagOpen, shown: getComputedStyle(document.getElementById('quit')).display }));
    await page.keyboard.press('KeyB');
    await page.keyboard.press('Escape');
    assert.deepEqual(await st(), { quit: false, bag: false, shown: 'none' }, 'Esc closes the bag first, without asking to quit');
    await page.keyboard.press('Escape');
    assert.deepEqual(await st(), { quit: true, bag: false, shown: 'block' }, 'Esc with nothing open asks whether to quit');
    await page.dispatchEvent('#quitNo', 'click');
    assert.equal((await st()).quit, false, 'Keep playing closes the question');
    await page.dispatchEvent('#settingsBtn', 'click');
    await page.dispatchEvent('#settingsQuit', 'click');
    assert.equal((await st()).quit, true, 'Quit the game in Settings asks too');
    await page.keyboard.press('Escape');
    assert.equal((await st()).quit, false, 'Esc on the question means keep playing');
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('kidsgame.slot.0')).at);
    await page.keyboard.press('Escape');
    await Promise.all([page.waitForURL(u => new URL(u).pathname === '/', { timeout: 30000 }), page.dispatchEvent('#quitYes', 'click')]);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('kidsgame.slot.0')).at);
    assert.ok(after > before, 'the game was saved before leaving');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

// Quit in the Android app (0.6.59): Back asks first, and Save and quit closes the app (the app is stood in for here)
test('in the Android app, the Back button asks first and Save and quit closes the app', { skip, timeout: 150000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!window.gameTest, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => typeof window.__back), 'function', 'the game listens to the Back button');
    await page.evaluate(() => window.__back());
    assert.equal(await page.evaluate(() => window.gameTest.quitOpen), true, 'Back asks whether to quit');
    await page.evaluate(() => window.__back());
    assert.equal(await page.evaluate(() => window.gameTest.quitOpen), false, 'Back again means keep playing');
    await page.evaluate(() => window.__back());
    await page.dispatchEvent('#quitYes', 'click');
    assert.equal(await page.evaluate(() => window.__exited), true, 'Save and quit closes the app');
    assert.equal(new URL(page.url()).pathname, '/play/', 'the app closes instead of going to the home page');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()], init: () => {
    window.__exited = false;
    window.Capacitor = { isNativePlatform: () => true, Plugins: { App: {
      exitApp: () => { window.__exited = true; },
      addListener: (name, fn) => { if (name === 'backButton') window.__back = fn; return Promise.resolve({ remove() {} }); },
    } } };
  } }));

// ---- Hand-off 001 (0.6.60): Quit in Settings, hand buttons and Spell button, tap a close monster ----
const TABLET = { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };
// The game is running (no wizard or panel) and the character stands on the ground
const playing = page => page.waitForFunction(() => window.gameTest && !window.gameTest.paused && window.gameProbe().onGround, null, { timeout: 90000 });
// A finger or mouse press on one control
const pressOn = (page, sel) => page.evaluate(s => document.querySelector(s).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 7 })), sel);
// A saved game in which the fireball is already learned (no skill choice at the start)
function spellGame() {
  const g = JSON.parse(phoneGame());
  g.pw.fight = { lvl: 2, xp: 0 };
  g.skills = ['fireball'];
  return JSON.stringify(g);
}

test('Quit is in Settings: there is no Quit button at the top, and "Quit the game" asks the same question', { skip, timeout: 150000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const st = () => page.evaluate(() => ({ quit: window.gameTest.quitOpen, settings: window.gameTest.settingsOpen }));
    assert.equal(await page.evaluate(() => !!document.getElementById('quitBtn')), false, 'the top-right Quit button should be gone');
    await page.dispatchEvent('#settingsBtn', 'click');
    assert.equal(await page.evaluate(() => { const b = document.getElementById('settingsQuit'); return !!b && b.textContent; }), 'Quit the game');
    await page.dispatchEvent('#settingsQuit', 'click');
    assert.deepEqual(await st(), { quit: true, settings: false }, 'Quit the game closes Settings and asks the question');
    await page.dispatchEvent('#quitNo', 'click');
    assert.deepEqual(await st(), { quit: false, settings: false }, 'Keep playing goes back to the game, not to Settings');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

for (const [label, device] of [['a phone held sideways', PHONE_WIDE], ['a phone held upright', PHONE_TALL], ['a tablet', TABLET]]) {
  test(`on ${label}, the hand buttons, the Spell button and JUMP fit the screen and cover no other control`, { skip, timeout: 150000 }, () =>
    withGame(async (page, errors) => {
      await playing(page);
      await page.waitForFunction(() => getComputedStyle(document.getElementById('bSpell')).display !== 'none', null, { timeout: 60000 });
      const r = await page.evaluate(ids => {
        const rects = ids.map(id => { const el = document.getElementById(id); return el && getComputedStyle(el).display !== 'none' ? [id, el.getBoundingClientRect()] : null; })
          .filter(x => x && x[1].width > 0);
        const off = rects.filter(([, b]) => !(b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5)).map(([id]) => id);
        const over = [];
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i][1], b = rects[j][1];
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) over.push(rects[i][0] + '+' + rects[j][0]);
        }
        const small = rects.filter(([id, b]) => ['bH1', 'bH2', 'bSpell'].includes(id) && (b.width < 44 || b.height < 44)).map(([id]) => id);
        return { shown: rects.map(([id]) => id), off, over, small };
      }, ['stick', 'bJ', 'bH1', 'bH2', 'bSpell', 'hudBtn', 'toggle', 'bagBtn', 'settingsBtn', 'teleBtn']);
      for (const id of ['bJ', 'bH1', 'bH2', 'bSpell']) assert.ok(r.shown.includes(id), id + ' should be shown');
      assert.deepEqual(r.off, [], 'controls outside the screen');
      assert.deepEqual(r.over, [], 'controls on top of each other');
      assert.deepEqual(r.small, [], 'buttons smaller than 44 points');
      assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
    }, { device, saves: [spellGame()] }));
}

test('the hand buttons show quick bar slots 1 and 2, only change the item in hand, and an empty one opens the bag', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const st = () => page.evaluate(() => {
      const g = window.gameTest;
      const b = id => { const el = document.getElementById(id); return { empty: el.classList.contains('empty'), on: el.classList.contains('on'), icon: !!el.querySelector('.sw'), count: (el.querySelector('.ct') || {}).textContent || '' }; };
      return { sel: g.sel, qb: g.qb.slice(), tpl: g.qb.map(id => g.tplOf(id)), dur: g.gear.map(x => x.uid + ':' + x.dur).join(','), bag: g.bagOpen, h1: b('bH1'), h2: b('bH2'), fight: !!g.fight };
    });
    // A new game: the pickaxe on Hand 1 (in the hand), the sword on Hand 2
    const a = await st();
    assert.deepEqual(a.tpl.slice(0, 2), ['pick', 'sword']);
    assert.ok(a.h1.icon && a.h2.icon && !a.h1.empty && !a.h2.empty, 'both hand buttons show a picture');
    assert.ok(a.h1.on && !a.h2.on, 'the ring is on the item in hand (the pickaxe)');
    // Tapping Hand 2 puts the sword in the hand, and nothing else: no swing, nothing wears, the bar is unchanged
    await pressOn(page, '#bH2');
    const b = await st();
    assert.equal(b.sel, 1, 'the sword is in the hand');
    assert.ok(b.h2.on && !b.h1.on, 'the ring moved to Hand 2');
    assert.equal(b.dur, a.dur, 'nothing wears');
    assert.deepEqual(b.qb, a.qb, 'the quick bar is unchanged');
    assert.equal(b.fight, false, 'no swing happens');
    // The ring follows the item in hand when it is changed through the quick bar
    await page.keyboard.press('Digit1');
    assert.ok((await st()).h1.on, 'the ring follows the quick bar');
    // Putting an item in quick bar slot 1 changes Hand 1, and nothing else
    await page.evaluate(() => { window.gameTest.addItem('stone', 3); window.gameTest.toQuick('stone'); });
    const c = await st();
    assert.equal(c.qb[0], 'stone');
    assert.equal(c.h1.count, '3', 'a stack shows how many there are');
    assert.equal(c.qb[1], a.qb[1], 'slot 2 is unchanged');
    // The sword on Hand 2 breaks: the button is empty, and nothing is put there
    await page.evaluate(() => window.gameTest.wear(window.gameTest.qb[1], 999));
    const d = await st();
    assert.equal(d.qb[1], null);
    assert.ok(d.h2.empty, 'Hand 2 is empty after the sword breaks');
    assert.deepEqual([d.qb[0], ...d.qb.slice(2)], [c.qb[0], ...c.qb.slice(2)], 'no item was moved');
    // An empty hand button opens the bag with that slot chosen
    await pressOn(page, '#bH2');
    const e = await st();
    assert.ok(e.bag, 'the bag opens');
    assert.equal(e.sel, 1, 'slot 2 is chosen');
    // With a panel open the buttons do nothing
    await pressOn(page, '#bH1');
    assert.equal((await st()).sel, 1, 'a hand button does nothing while the bag is open');
    await page.keyboard.press('KeyB');
    // A stack that runs out leaves the button empty
    await page.evaluate(() => { window.gameTest.inv.stone = 0; window.gameTest.addItem('dirt', 0); });
    assert.ok((await st()).h1.empty, 'Hand 1 is empty when its stack reaches zero');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PHONE_WIDE, saves: [phoneGame()] }));

test('on a touch screen the fireball needs no quick bar slot: the Spell button casts it, and it does nothing while a panel is open', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('bSpell')).display), 'none', 'the Spell button is hidden before the fireball is learned');
    const before = await page.evaluate(() => window.gameTest.qb.slice());
    await pressOn(page, '#bH2');
    assert.equal(await page.evaluate(() => window.gameTest.sel), 0, 'a hand button does nothing while the skill choice is open');
    await page.dispatchEvent('#skillPanel [data-skill="fireball"]', 'click');
    await page.waitForFunction(() => window.gameTest.skills.includes('fireball') && !window.gameTest.paused, null, { timeout: 60000 });
    assert.deepEqual(await page.evaluate(() => window.gameTest.qb.slice()), before, 'the quick bar is not changed by learning the fireball');
    await page.waitForFunction(() => getComputedStyle(document.getElementById('bSpell')).display !== 'none', null, { timeout: 60000 });
    const cast = await page.evaluate(() => {
      const g = window.gameTest, n = g.fireballs.length;
      const tap = () => document.getElementById('bSpell').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 7 }));
      tap();
      const one = g.fireballs.length - n;
      tap();   // straight away again: the power is still recharging
      return { one, two: g.fireballs.length - n, sel: g.sel };
    });
    assert.equal(cast.one, 1, 'one tap casts one fireball');
    assert.equal(cast.two, 1, 'no second fireball while the power recharges');
    assert.equal(cast.sel, 0, 'the item in hand is unchanged');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PHONE_WIDE, saves: [fightLevel2Game()] }));

test('on a computer there are no hand buttons, and a learned fireball goes into an empty quick bar slot only', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    const shown = await page.evaluate(() => ['bH1', 'bH2', 'bSpell'].filter(id => document.getElementById(id).getBoundingClientRect().width > 0));
    assert.deepEqual(shown, [], 'hand and spell buttons are not shown on a computer');
    // Fill the bar, then learn the fireball: no slot is taken over, and F still casts
    const before = await page.evaluate(() => { const g = window.gameTest; g.addItem('dirt', 1); for (let i = 2; i < 6; i++) g.qb[i] = 'dirt'; return g.qb.slice(); });
    await page.click('#skillPanel [data-skill="fireball"]');
    await page.waitForFunction(() => window.gameTest.skills.includes('fireball'), null, { timeout: 60000 });
    assert.deepEqual(await page.evaluate(() => window.gameTest.qb.slice()), before, 'a full quick bar is left alone');
    const n = await page.evaluate(() => window.gameTest.fireballs.length);
    await page.keyboard.press('KeyF');
    assert.equal(await page.evaluate(() => window.gameTest.fireballs.length), n + 1, 'F casts the fireball');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [fightLevel2Game()] }));

// Puts a goblin on the ground just in front of the character and presses on it (a tap: press and release, or a held press).
// Returns what the game looked like before and after.
function tapMonster(page, opts = {}) {
  return page.evaluate(o => {
    const g = window.gameTest;
    g.setYaw(0);
    g.settleCamera();
    for (const old of g.enemies.splice(0)) if (old.group.parent) old.group.parent.remove(old.group);   // start with no other monster in the way
    let en = null, pt = null;
    for (const [dx, dz] of [[0, -2], [1, -2], [-1, -2], [0, -3], [2, -2], [-2, -2]]) {
      if (!g.enemyNear('goblin', dx + (o.shift || 0), dz)) continue;
      en = g.enemies[g.enemies.length - 1];
      const [sx, sy] = g.screenOf(en);
      for (const oy of [0, -10, 10, -20, 20, -30]) for (const ox of [0, -8, 8]) {
        const a = pt ? null : g.aimAt(sx + ox, sy + oy);
        if (a && a.enemy === en) pt = [sx + ox, sy + oy];
      }
      if (pt) break;
      g.enemies.splice(g.enemies.indexOf(en), 1);   // not under the pointer from here: take it away and try the next spot
      if (en.group.parent) en.group.parent.remove(en.group);
      en = null;
    }
    if (!en) return { error: 'no goblin could be put under the pointer' };
    const snap = () => ({ hp: en.hp, sel: g.sel, dur: Object.fromEntries(g.gear.map(x => [g.tplOf(x.uid), x.dur])), fireballs: g.fireballs.length,
      dirt: g.inv.dirt || 0, digging: !!g.digging, fight: !!g.fight, msg: g.msg, alive: g.enemies.includes(en) });
    const c = document.querySelector('canvas');
    const ev = t => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: pt[0], clientY: pt[1], pointerId: 5, button: 0, pointerType: o.touch ? 'touch' : 'mouse' }));
    const before = snap();
    ev('pointerdown');
    const held = snap();
    if (o.hold) g.stepFrames(Array(o.hold).fill(0.05));
    const heldLong = snap();
    ev('pointerup');
    if (o.again) { ev('pointerdown'); ev('pointerup'); }
    return { before, held, heldLong, after: snap(), log: g.sfxLog.slice(-6) };
  }, opts);
}

test('a tap on a close monster swings the sword from a hand button once, and the item in hand stays in hand', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    // Pickaxe in hand, sword on Hand 2: one hit, the sword wears by one, the pickaxe stays in hand, no block is dug.
    // A second tap straight away does not hit again (a swing takes a moment).
    const a = await tapMonster(page, { again: true });
    assert.equal(a.error, undefined, a.error);
    assert.equal(a.after.hp, a.before.hp - 1, 'one sword hit');
    assert.equal(a.after.dur.sword, a.before.dur.sword - 1, 'the sword wears by one');
    assert.equal(a.after.dur.pick, a.before.dur.pick, 'the pickaxe does not wear');
    assert.equal(a.after.sel, 0, 'the pickaxe is still the item in hand');
    assert.equal(a.held.digging, false, 'no block is dug');
    assert.ok(a.log.includes('swing') && a.log.includes('hit'), 'the swing and the hit ask for their sounds: ' + a.log.join(','));
    await page.waitForTimeout(600);
    await page.evaluate(() => window.gameTest.stepFrames(Array(10).fill(0.05)));
    // The same with a finger
    const b = await tapMonster(page, { touch: true, shift: 3 });
    assert.equal(b.error, undefined, b.error);
    assert.equal(b.after.hp, b.before.hp - 1, 'a touch hits once too');
    await page.evaluate(() => window.gameTest.stepFrames(Array(10).fill(0.05)));
    // A block in hand: the sword swings, and no block is placed
    await page.evaluate(() => { const g = window.gameTest; g.selectSlot(2); g.toQuick('dirt'); });
    const c = await tapMonster(page, { shift: -3 });
    assert.equal(c.error, undefined, c.error);
    assert.equal(c.after.hp, c.before.hp - 1, 'the sword swings with a block in hand');
    assert.equal(c.after.dirt, c.before.dirt, 'no block is placed');
    assert.equal(c.after.sel, 2, 'the block is still in hand');
    await page.evaluate(() => window.gameTest.stepFrames(Array(10).fill(0.05)));
    // No sword in the hand or on a hand button: no hit, and the message shows
    await page.evaluate(() => { const g = window.gameTest; g.wear(g.qb[1], 999); g.selectSlot(0); });
    const d = await tapMonster(page, {});
    assert.equal(d.error, undefined, d.error);
    assert.equal(d.after.hp, d.before.hp, 'no hit without a sword');
    assert.equal(d.after.msg, 'Put a sword on a hand button');
    assert.equal(d.held.digging, false, 'the monster wins the tap: no block is dug');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

// Building by tap (0.6.62). A touch screen has no right-click, so a tap with a block in hand must build.
// Before 0.6.62 a tap on a block always tried to dig and said "Select the pickaxe", so phones and tablets could not build.
// Finds a spot on the screen that lands on a close block with a free cell in front of it, then presses and lifts there.
function tapBlock(page, opts = {}) {
  return page.evaluate(o => {
    const g = window.gameTest;
    g.setYaw(0);
    g.settleCamera();
    for (const old of g.enemies.splice(0)) if (old.group.parent) old.group.parent.remove(old.group);   // no monster in the way
    const [px, py, pz] = g.pos;
    let pt = null, a = null;
    for (let y = Math.round(innerHeight * 0.9); y > innerHeight * 0.3 && !pt; y -= 12) for (let x = Math.round(innerWidth * 0.25); x < innerWidth * 0.75 && !pt; x += 12) {
      if (document.elementFromPoint(x, y) !== document.querySelector('canvas')) continue;   // a button is on top here
      const c = g.aimAt(x, y);
      if (!c || c.enemy || c.dist > g.reach || !g.isSolid(g.blockAt(...c.dig)) || g.isSolid(g.blockAt(...c.place))) continue;
      if (Math.abs(c.place[0] + 0.5 - px) < 1.2 && Math.abs(c.place[2] + 0.5 - pz) < 1.2 && c.place[1] + 1 > py && c.place[1] < py + 2.2) continue;   // too close to the character
      pt = [x, y]; a = c;
    }
    if (!pt) return { error: 'no close block was found under the screen' };
    const c = document.querySelector('canvas');
    const ev = (t, dx = 0) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: pt[0] + dx, clientY: pt[1], pointerId: 7, button: 0, pointerType: o.touch ? 'touch' : 'mouse' }));
    const snap = () => ({ dirt: g.inv.dirt || 0, built: g.isSolid(g.blockAt(...a.place)), dug: !g.isSolid(g.blockAt(...a.dig)), digging: !!g.digging, msg: g.msg, sel: g.sel });
    const before = snap();
    ev('pointerdown');
    const held = snap();
    if (o.drag) ev('pointermove', o.drag);
    ev('pointerup');
    return { before, held, after: snap() };
  }, opts);
}

test('with a block in hand, a tap on a block builds there (finger and mouse); a drag does not build; the pickaxe still digs', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    await page.evaluate(() => { const g = window.gameTest; g.addItem('dirt', 5); g.selectSlot(2); g.toQuick('dirt'); });
    // A finger tap builds one block and uses one from the bag
    const a = await tapBlock(page, { touch: true });
    assert.equal(a.error, undefined, a.error);
    assert.equal(a.before.built, false, 'the cell is free before the tap');
    assert.equal(a.held.digging, false, 'a block in hand does not dig');
    assert.equal(a.after.built, true, 'the tap builds the block');
    assert.equal(a.after.dirt, a.before.dirt - 1, 'one block leaves the bag');
    assert.equal(a.after.dug, false, 'the block that was tapped is still there');
    assert.equal(a.after.sel, 2, 'the block stays in hand');
    // A mouse click builds too
    const b = await tapBlock(page, {});
    assert.equal(b.error, undefined, b.error);
    assert.equal(b.after.built, true, 'a click builds the block');
    assert.equal(b.after.dirt, b.before.dirt - 1);
    // A drag turns the view and does not build
    const c = await tapBlock(page, { touch: true, drag: 40 });
    assert.equal(c.error, undefined, c.error);
    assert.equal(c.after.built, false, 'a drag does not build');
    assert.equal(c.after.dirt, c.before.dirt);
    // With the pickaxe in hand a press on a block digs as before, and builds nothing
    await page.evaluate(() => window.gameTest.selectSlot(0));
    const d = await tapBlock(page, { touch: true });
    assert.equal(d.error, undefined, d.error);
    assert.equal(d.held.digging, true, 'the pickaxe starts digging');
    assert.equal(d.after.built, false, 'the pickaxe does not build');
    assert.equal(d.after.dirt, d.before.dirt);
    // With the sword in hand a press on a block says to take the pickaxe, as before
    await page.evaluate(() => window.gameTest.selectSlot(1));
    const e = await tapBlock(page, { touch: true });
    assert.equal(e.error, undefined, e.error);
    assert.equal(e.after.built, false);
    assert.match(e.after.msg, /pickaxe/);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

// Drop from the bag (0.6.62): a full bag could never be emptied except by building, so a child was stuck.
test('the bag has a Drop button for blocks and monster parts: one goes on the ground nearby and is not picked straight back up; gems and tools cannot be dropped', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const r = await page.evaluate(() => {
      const g = window.gameTest;
      g.addItem('dirt', 3); g.addItem('goblin_ear', 1);
      document.getElementById('bagBtn').click();
      const btns = () => [...document.querySelectorAll('#bag [data-drop]')].map(b => b.dataset.drop).sort();
      const shown = btns();
      const before = { dirt: g.inv.dirt, total: g.invTotal(), drops: g.drops.length, qb: [...g.qb] };
      document.querySelector('#bag [data-drop="dirt"]').click();
      const after = { dirt: g.inv.dirt, total: g.invTotal(), drops: g.drops, qb: [...g.qb], msg: g.msg, bagOpen: g.bagOpen };
      g.stepFrames(Array(20).fill(0.05));   // standing still: the drop is far enough away not to come straight back
      const later = { dirt: g.inv.dirt, drops: g.drops.length };
      document.querySelector('#bag [data-drop="goblin_ear"]').click();
      const [px, py, pz] = g.pos;
      return { shown, before, after, later, ear: g.inv.goblin_ear, shownAfter: btns(), gemDrop: g.dropFromBag('gem'), pickDrop: g.dropFromBag(g.qb[0]), gem: g.inv.gem,
        dist: after.drops.map(d => Math.hypot(d[0] + 0.5 - px, d[2] + 0.5 - pz)) };
    });
    assert.deepEqual(r.shown, ['dirt', 'goblin_ear'], 'Drop shows for blocks and parts only (no gem, pickaxe or sword)');
    assert.equal(r.after.dirt, r.before.dirt - 1, 'one dirt leaves the bag');
    assert.equal(r.after.total, r.before.total - 1, 'the bag has one more free place');
    assert.equal(r.after.drops.length, r.before.drops + 1, 'one item is on the ground');
    assert.equal(r.after.drops[r.after.drops.length - 1][3], 'dirt');
    assert.ok(r.dist.every(d => d >= 1.2), 'the drop is not under the character: ' + r.dist.join(','));
    assert.deepEqual(r.after.qb, r.before.qb, 'the quick bar is not changed');
    assert.equal(r.after.bagOpen, true, 'the bag stays open');
    assert.match(r.after.msg, /Dropped Dirt/);
    assert.equal(r.later.dirt, r.after.dirt, 'the drop is not picked straight back up');
    assert.equal(r.ear, 0, 'the last monster part can be dropped');
    assert.deepEqual(r.shownAfter, ['dirt'], 'no Drop button for an item that has run out');
    assert.equal(r.gemDrop, false, 'gems cannot be dropped');
    assert.equal(r.pickDrop, false, 'the pickaxe cannot be dropped');
    assert.equal(r.gem, 1, 'the gem is still in the bag');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

test('with the sword in hand a monster is hit as before: a quick tap does not hit, holding does', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    await page.keyboard.press('Digit2');
    const a = await tapMonster(page, {});
    assert.equal(a.error, undefined, a.error);
    assert.equal(a.held.fight, true, 'the press starts the fight');
    assert.equal(a.after.hp, a.before.hp, 'a quick tap does not hit (as in 0.6.59)');
    assert.equal(a.after.dur.sword, a.before.dur.sword, 'a quick tap does not wear the sword');
    const b = await tapMonster(page, { hold: 60, shift: 3 });
    assert.equal(b.error, undefined, b.error);
    assert.ok(b.heldLong.hp < b.before.hp || !b.heldLong.alive, 'holding hits the monster');
    assert.ok(b.heldLong.dur.sword < b.before.dur.sword, 'holding wears the sword');
    assert.equal(b.after.sel, 1, 'the sword stays in hand');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

test('with the fireball in hand, a tap on a close monster casts a fireball and does not swing the sword', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    await page.click('#skillPanel [data-skill="fireball"]');
    await playing(page);
    await page.keyboard.press('Digit3');   // the fireball went into the first empty quick bar slot (slot 3)
    const a = await tapMonster(page, {});
    assert.equal(a.error, undefined, a.error);
    assert.equal(a.after.fireballs, a.before.fireballs + 1, 'one fireball is cast');
    assert.equal(a.after.dur.sword, a.before.dur.sword, 'the sword does not swing');
    assert.equal(a.held.fight, false, 'no sword fight starts');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [fightLevel2Game()] }));

// ---- Hand-off 002 (0.6.60): sound and music. The audio files are stood in for: a pretend player records every call. ----
const SOUNDS = ['dig', 'place', 'gem', 'jump', 'land', 'swing', 'hit', 'defeat', 'hurt', 'fireball', 'fizzle', 'teleport', 'splash', 'break', 'tap', 'open', 'close'];
const FAKE_AUDIO = { files: [
  ...SOUNDS.map(k => ({ file: 'sfx/' + k + '.mp3', use: k, credit: 'Test sound ' + k + '. Made by Tester. Source: example.org. Licence: CC0.' })),
  { file: 'music/one.mp3', use: 'music', credit: 'Test piece one, by A Composer. Performed by Tester. Source: example.org. Licence: Public domain.' },
  { file: 'music/two.mp3', use: 'music', credit: 'Test piece two, by A Composer. Performed by Tester. Source: example.org. Licence: CC BY 4.0. Shortened for the Game.' },
] };
// Stands in for the browser's audio player (runs in the page before the game). `first` keeps the address the player was made with.
const fakeAudio = () => {
  window.__audio = [];
  window.Audio = class {
    constructor(src) { this.src = src; this.first = src; this.volume = 1; this.paused = true; this.plays = 0; this.l = {}; window.__audio.push(this); }
    addEventListener(n, f) { (this.l[n] = this.l[n] || []).push(f); }
    play() { this.paused = false; this.plays++; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { this.src = ''; }
    load() {}
    finish() { (this.l.ended || []).forEach(f => f()); }
  };
};
// The same, but every file fails to play
const brokenAudio = () => {
  window.__audio = [];
  window.Audio = class {
    constructor(src) { this.src = src; this.first = src; this.volume = 1; this.paused = true; this.l = {}; window.__audio.push(this); }
    addEventListener(n, f) { (this.l[n] = this.l[n] || []).push(f); }
    play() { setTimeout(() => (this.l.error || []).forEach(f => f()), 0); return Promise.reject(new Error('cannot play')); }
    pause() { this.paused = true; }
    removeAttribute() { this.src = ''; }
    load() {}
  };
};

test('sound and music: silent before the first input, each action plays its sound once, the sliders set the volume and are remembered', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors, requests) => {
    await playing(page);
    const audioAsked = () => requests.filter(u => new URL(u).pathname.startsWith('/audio/'));
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => window.__audio.length), 0, 'nothing plays before the first input');
    assert.deepEqual(audioAsked(), [], 'no audio file is asked for before the first input');
    assert.deepEqual(await page.evaluate(() => window.gameTest.vol), { sfx: 4, music: 2 }, 'a first start has Sounds at 4 and Music at 2');
    await page.keyboard.press('KeyB');   // the first input (it opens the bag)
    await page.waitForFunction(() => window.gameTest.audioState().music, null, { timeout: 30000 });
    const m = await page.evaluate(() => { const g = window.gameTest; return { ...g.audioState().music, want: g.VOL[2] * g.MUSIC_QUIETER, effects: g.VOL[2], origin: location.origin }; });
    assert.ok(m.src.startsWith(m.origin + '/audio/music/'), 'the music comes from our own site: ' + m.src);
    assert.ok(Math.abs(m.volume - m.want) < 1e-9 && m.want < m.effects, 'at equal slider levels the music is quieter than the effects');
    // Each action asks for its sound once
    const played = await page.evaluate(async () => {
      const g = window.gameTest, out = {};
      const count = name => window.__audio.filter(a => a.first.endsWith('/audio/sfx/' + name + '.mp3')).length;
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const once = async (name, fn) => { const b = count(name); fn(); out[name] = count(name) - b; await wait(90); };
      const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code }));
      const [x, y, z] = g.pos.map(Math.floor);
      await once('close', () => key('keydown', 'KeyB'));
      await once('open', () => key('keydown', 'KeyB'));
      key('keydown', 'KeyB');
      await wait(90);
      await once('jump', () => { key('keydown', 'Space'); g.stepFrames([1 / 60]); key('keyup', 'Space'); });
      await once('land', () => g.stepFrames(Array(120).fill(1 / 60)));
      await once('gem', () => g.addItem('gem'));
      await once('tap', () => document.querySelector('#qb [data-slot="2"]').click());
      await once('place', () => g.placeCell(x + 2, y + 3, z, 'dirt'));
      await once('hit', () => { g.enemyNear('brute', 3, 0); g.hurtEnemy(g.enemies[g.enemies.length - 1], 1); });
      await once('defeat', () => g.hurtEnemy(g.enemies[g.enemies.length - 1], 999));
      await once('break', () => g.wear(g.qb[1], 999));
      await once('dig', () => g.digCell(x, y - 1, z));
      return out;
    });
    assert.deepEqual(played, { close: 1, open: 1, jump: 1, land: 1, gem: 1, tap: 1, place: 1, hit: 1, defeat: 1, break: 1, dig: 1 });
    // The Sounds slider: one sample sound per change, louder at 5 than at 1, nothing at off
    const v = await page.evaluate(async () => {
      const g = window.gameTest, wait = ms => new Promise(r => setTimeout(r, ms));
      const sfxCount = () => window.__audio.filter(a => a.first.includes('/audio/sfx/')).length;
      const last = () => window.__audio[window.__audio.length - 1];
      const out = {};
      await wait(90);
      let n = sfxCount(); g.setVol('sfx', 1); out.sample1 = sfxCount() - n; out.vol1 = last().volume; await wait(90);
      n = sfxCount(); g.setVol('sfx', 5); out.sample5 = sfxCount() - n; out.vol5 = last().volume; await wait(90);
      n = sfxCount(); g.setVol('sfx', 5); out.same = sfxCount() - n; await wait(90);
      n = sfxCount(); g.setVol('sfx', 0); g.sfx('dig'); g.addItem('gem'); out.off = sfxCount() - n;
      return out;
    });
    assert.deepEqual([v.sample1, v.sample5, v.same, v.off], [1, 1, 0, 0], 'one sample sound per change, none when nothing changes, nothing at off');
    assert.ok(v.vol5 > v.vol1 && v.vol1 > 0, 'step 5 is louder than step 1');
    // The Music slider: off stops the music and asks for no file; back on starts a piece; another piece follows, never the same twice in a row
    const mu = await page.evaluate(async () => {
      const g = window.gameTest, wait = ms => new Promise(r => setTimeout(r, ms));
      const pieces = () => window.__audio.filter(a => a.first.includes('/audio/music/'));
      const out = {};
      const first = pieces().pop();
      g.setVol('music', 0);
      out.stopped = first.paused && !g.audioState().music;
      const n = pieces().length;
      await wait(600);
      out.askedWhileOff = pieces().length - n;
      g.setVol('music', 3);
      const second = pieces().pop();
      out.started = pieces().length - n; out.vol3 = second.volume; out.want3 = g.VOL[3] * g.MUSIC_QUIETER;
      g.setVol('music', 5); out.vol5 = second.volume; out.want5 = g.VOL[5] * g.MUSIC_QUIETER;
      second.finish();
      await wait(5000);
      const third = pieces().pop();
      out.second = second.first; out.third = third === second ? null : third.first;
      return out;
    });
    assert.ok(mu.stopped, 'Music at off stops the music');
    assert.equal(mu.askedWhileOff, 0, 'no music file is asked for while Music is off');
    assert.equal(mu.started, 1, 'Music back on starts one piece');
    assert.ok(Math.abs(mu.vol3 - mu.want3) < 1e-9 && Math.abs(mu.vol5 - mu.want5) < 1e-9, 'the Music slider sets the volume of the playing piece');
    assert.ok(mu.third && mu.third !== mu.second, 'after a piece ends another piece starts, not the same one: ' + mu.second + ' then ' + mu.third);
    // Hiding the page pauses everything; showing it resumes the music
    const hid = await page.evaluate(() => {
      const g = window.gameTest, hide = h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); };
      g.setVol('sfx', 3);
      const cur = window.__audio.filter(a => a.first.includes('/audio/music/')).pop();
      hide(true);
      const n = window.__audio.length;
      g.sfx('dig');
      const out = { paused: cur.paused, silent: window.__audio.length === n };
      hide(false);
      out.resumed = !cur.paused;
      return out;
    });
    assert.deepEqual(hid, { paused: true, silent: true, resumed: true }, 'hidden: all audio pauses; shown again: the music resumes');
    // The sliders in Settings: six steps, big enough for a thumb, a tap on the track sets the level, and the credits are listed
    await page.dispatchEvent('#settingsBtn', 'click');
    const ui = await page.evaluate(() => {
      const g = window.gameTest, el = document.querySelector('#settings .vol[data-vol="sfx"]'), mus = document.querySelector('#settings .vol[data-vol="music"]');
      const r = el.getBoundingClientRect();
      const tap = step => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 9, clientX: r.left + r.width * (step + 0.5) / 6, clientY: r.top + r.height / 2 }));
      tap(2);
      const two = g.vol.sfx, lit = [...el.children].map(c => c.classList.contains('on') ? 1 : 0).join('');
      tap(0);
      return { steps: el.children.length, musicSteps: mus ? mus.children.length : 0, height: r.height, two, lit, zero: g.vol.sfx, offLit: el.children[0].classList.contains('on'),
        credits: document.getElementById('creditList').textContent, quit: !!document.getElementById('settingsQuit') };
    });
    assert.deepEqual([ui.steps, ui.musicSteps], [6, 6], 'each slider has six steps');
    assert.ok(ui.height >= 44, 'the slider track is at least 44 points high');
    assert.equal(ui.two, 2, 'a tap on the track sets the level');
    assert.equal(ui.lit, '011000', 'the steps up to the level are lit');
    assert.ok(ui.zero === 0 && ui.offLit, 'all the way left is off, with the crossed-out speaker lit');
    assert.ok(ui.credits.includes('Test piece two, by A Composer') && ui.credits.includes('Test sound dig'), 'Settings lists the credits');
    assert.ok(ui.quit, 'Settings still has the Quit button');
    // Every audio address is on our own site
    const own = await page.evaluate(() => window.__audio.filter(a => !a.first.startsWith(location.origin + '/audio/')).map(a => a.first));
    assert.deepEqual(own, [], 'audio from another site');
    assert.ok(audioAsked().length > 0 && audioAsked().every(u => new URL(u).hostname === '127.0.0.1'), 'audio requests go to our own address');
    // Both levels survive closing and opening the game
    await page.evaluate(() => { window.gameTest.setVol('sfx', 2); window.gameTest.setVol('music', 4); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await playing(page);
    assert.deepEqual(await page.evaluate(() => window.gameTest.vol), { sfx: 2, music: 4 }, 'both levels are remembered');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()], init: fakeAudio, audioList: FAKE_AUDIO }));

test('a missing or broken audio file causes no error, and the game plays on', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    await page.keyboard.press('KeyB');
    await page.waitForFunction(() => window.gameTest.audioState().listed, null, { timeout: 30000 });
    const r = await page.evaluate(async () => {
      const g = window.gameTest;
      g.addItem('gem'); g.sfx('dig'); g.sfx('tap'); g.setVol('music', 5);
      await new Promise(res => setTimeout(res, 800));
      g.stepFrames(Array(30).fill(1 / 60));
      const box = document.getElementById('errBanner');
      return { tried: window.__audio.length, live: g.audioState().live, box: !!(box && box.textContent.trim()), version: window.gameProbe().version };
    });
    assert.ok(r.tried >= 3, 'the game tried to play the files');
    assert.equal(r.live, 0, 'broken effects are dropped');
    assert.equal(r.box, false, 'no error box is shown');
    assert.ok(r.version, 'the game is still running');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()], init: brokenAudio, audioList: FAKE_AUDIO }));

// ---- Quiz Friends (0.6.63, SPEC-003) ----
// Time is played with stepFrames (no waiting): 20 frames of 0.05 s are one second of play.
// Brings a friend next to the character: no monsters, a new friend, and enough play time for it to walk up
const friendArrives = (page, kind) => page.evaluate(k => {
  const g = window.gameTest;
  g.clearEnemies();
  g.removeFriend();
  if (!g.callFriend(k)) return { error: 'no friend could be placed' };
  const start = g.friend, [px, , pz] = g.pos;
  for (let s = 0; s < 8; s++) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); }
  return { start: Math.hypot(start.x - px, start.z - pz), end: Math.hypot(g.friend.x - g.pos[0], g.friend.z - g.pos[2]), friend: g.friend, open: g.quizOpen };
}, kind);
// A press and release on the friend, as a finger or the mouse; o.drag moves sideways in between
const pressFriend = (page, o = {}) => page.evaluate(o => {
  const g = window.gameTest;
  g.settleCamera();
  const [x, y, front] = g.friendScreen();
  if (!front) return { error: 'the friend is behind the camera' };
  const c = document.querySelector('canvas');
  const ev = (t, dx = 0) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x + dx, clientY: y, pointerId: 9, button: 0, pointerType: o.touch ? 'touch' : 'mouse' }));
  ev('pointerdown');
  const held = { digging: !!g.digging, fight: !!g.fight };
  if (o.drag) ev('pointermove', o.drag);
  ev('pointerup');
  return { held, open: g.quizOpen, fireballs: g.fireballs.length, msg: g.msg };
}, o);
const panelState = page => page.evaluate(() => {
  const p = document.getElementById('quizPanel');
  if (!p) return null;
  const hint = p.querySelector('.qhint');
  return { text: p.querySelector('.qtext').textContent, answers: p.querySelectorAll('.qa').length, notNow: p.querySelector('.qnot').textContent,
    msg: p.querySelector('.qmsg').textContent, hint: getComputedStyle(hint).display !== 'none' && hint.innerHTML.length > 0,
    typing: p.querySelectorAll('input,textarea,select,[contenteditable]').length, wobble: p.querySelectorAll('.qa.wob').length };
});
const clickAnswer = (page, i) => page.evaluate(i => document.querySelector(`#quizPanel .qa[data-a="${i}"]`).click(), i);
const gems = page => page.evaluate(() => window.gameTest.inv.gem);

test('a quiz friend appears within 7 minutes of play when no monster is close, with a "?" over its head, waves, and stops two blocks away', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const r = await page.evaluate(() => {
      const g = window.gameTest, first = g.friendWait;
      let secs = 0;
      while (!g.friend && secs < 430) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); secs++; }
      const f = g.friend, [px, , pz] = g.pos;
      return { first, secs, f, dist: f ? Math.hypot(f.x - px, f.z - pz) : null, msg: g.msg, second: g.callFriend(), open: g.quizOpen };
    });
    assert.ok(r.first >= 235 && r.first <= 420, 'the first wait is 4 to 7 minutes: ' + r.first);
    assert.ok(r.f, 'no friend appeared in 7 minutes of play');
    assert.ok(r.secs >= 235 && r.secs <= 421, 'it appeared after ' + r.secs + ' seconds');
    assert.ok(['owl', 'turtle', 'robot'].includes(r.f.kind));
    assert.ok(r.f.inScene && r.f.bubble, 'the friend and its "?" bubble are shown');
    assert.ok(r.dist >= 6 && r.dist <= 11.5, 'it appears near the child: ' + r.dist);
    assert.equal(r.second, false, 'only one friend at a time');
    assert.equal(r.open, false);
    // It waves: the arm moves from one moment to the next
    const w1 = r.f.wave;
    await page.waitForTimeout(350);
    const w2 = await page.evaluate(() => { const g = window.gameTest; g.stepFrames([0.016]); return g.friend.wave; });
    assert.notEqual(w1, w2, 'the friend does not wave');
    // It walks up, stops two blocks away, and stays there without opening anything
    const s = await page.evaluate(() => {
      const g = window.gameTest;
      for (let i = 0; i < 20; i++) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); }
      const f = g.friend, [px, , pz] = g.pos;
      return { state: f.state, dist: Math.hypot(f.x - px, f.z - pz), open: g.quizOpen, paused: g.paused };
    });
    assert.equal(s.state, 'wait');
    assert.ok(Math.abs(s.dist - 2) < 0.06, 'it stops two blocks away: ' + s.dist);
    assert.equal(s.open, false, 'the friend opened the question by itself');
    assert.equal(s.paused, false);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

test('the friend never opens the question itself; a tap on it opens one question with three answers and "Not now", which changes nothing', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    for (const [kind, touch] of [['owl', false], ['turtle', true], ['robot', false]]) {
      const a = await friendArrives(page, kind);
      assert.equal(a.error, undefined, a.error);
      assert.equal(a.friend.kind, kind);
      assert.equal(a.open, false, 'the question opened by itself');
      const before = await gems(page);
      // A drag across the friend turns the view and opens nothing
      const d = await pressFriend(page, { drag: 40, touch });
      assert.equal(d.error, undefined, d.error);
      assert.equal(d.open, false, 'a drag opened the question');
      // A tap opens it. The press does not dig, fight or cast
      const t = await pressFriend(page, { touch });
      assert.deepEqual(t.held, { digging: false, fight: false });
      assert.equal(t.open, true, kind + ': a tap did not open the question');
      assert.equal(t.fireballs, 0);
      const p = await panelState(page);
      assert.ok(p.text.length > 5, 'the question has text');
      assert.equal(p.answers, 3);
      assert.equal(p.notNow, 'Not now');
      assert.equal(p.typing, 0, 'there is a place to type');
      assert.equal(p.hint, false);
      assert.equal(await page.evaluate(() => window.gameTest.paused), true, 'the game stands still while the question is open');
      const key = await page.evaluate(() => window.gameTest.quizQuestion.key);
      // Not now: closed, nothing lost, the friend still waits
      await page.evaluate(() => document.querySelector('#quizPanel .qnot').click());
      assert.equal(await panelState(page), null);
      assert.equal(await gems(page), before);
      assert.equal(await page.evaluate(() => window.gameTest.paused), false);
      assert.equal(await page.evaluate(() => window.gameTest.friend.state), 'wait');
      // A second tap shows the same question; Esc closes it like "Not now"
      const t2 = await pressFriend(page, { touch });
      assert.equal(t2.open, true);
      assert.equal(await page.evaluate(() => window.gameTest.quizQuestion.key), key, 'a new question was made');
      await page.keyboard.press('Escape');
      assert.equal(await panelState(page), null, 'Esc did not close the question');
      assert.equal(await page.evaluate(() => window.gameTest.quitOpen), false, 'Esc also asked about quitting');
      assert.equal(await gems(page), before);
    }
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [spellGame()] }));

test('a right first answer gives 5 gems, a right answer after a wrong try gives 2, a wrong answer takes nothing, and a picture hint shows after two wrong tries', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const open = async () => {
      const a = await friendArrives(page);
      assert.equal(a.error, undefined, a.error);
      const t = await pressFriend(page);
      assert.equal(t.open, true);
      return page.evaluate(() => window.gameTest.quizQuestion.right);
    };
    const closed = () => page.waitForFunction(() => !window.gameTest.quizOpen, null, { timeout: 10000 });
    // Right first time: stars, 5 gems, then the friend leaves
    let start = await gems(page), right = await open();
    // (read in the same step as the tap: the panel closes by itself a moment later)
    const won = await page.evaluate(i => {
      const btn = document.querySelector(`#quizPanel .qa[data-a="${i}"]`);
      btn.click();
      const out = { gems: window.gameTest.inv.gem, msg: document.querySelector('#quizPanel .qmsg').textContent, stars: document.querySelectorAll('#quizPanel .qstars svg').length };
      btn.click();   // a second tap on the right answer gives nothing more
      return out;
    }, right);
    assert.equal(won.gems, start + 5);
    assert.match(won.msg, /\+5 gems/);
    assert.ok(won.stars > 5, 'no stars');
    let p;
    await closed();
    assert.equal(await gems(page), start + 5);
    const left = await page.evaluate(() => {
      const g = window.gameTest, state = g.friend.state;
      for (let i = 0; i < 6; i++) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); }
      return { state, gone: g.friend === null, wait: g.friendWait };
    });
    assert.equal(left.state, 'leave');
    assert.equal(left.gone, true, 'the friend did not leave');
    assert.ok(left.wait >= 235 && left.wait <= 420, 'the next friend comes 4 to 7 minutes later: ' + left.wait);
    // Two wrong tries: nothing lost, "Try again", the button wobbles, then the hint. The right answer then gives 2
    start = await gems(page); right = await open();
    const wrong = [0, 1, 2].filter(i => i !== right);
    await clickAnswer(page, wrong[0]);
    p = await panelState(page);
    assert.equal(await gems(page), start, 'a wrong answer changed the gems');
    assert.equal(p.msg, 'Try again');
    assert.equal(p.wobble, 1);
    assert.equal(p.hint, false, 'the hint showed after one wrong try');
    await clickAnswer(page, wrong[1]);
    p = await panelState(page);
    assert.equal(p.hint, true, 'no picture hint after two wrong tries');
    assert.equal(await gems(page), start);
    await clickAnswer(page, right);
    assert.equal(await gems(page), start + 2);
    await closed();
    // One wrong try, then right: 2 gems. One wrong try, then "Not now": nothing changes
    start = await gems(page); right = await open();
    await clickAnswer(page, (right + 1) % 3);
    await clickAnswer(page, right);
    assert.equal(await gems(page), start + 2);
    await closed();
    start = await gems(page); right = await open();
    await clickAnswer(page, (right + 2) % 3);
    await page.evaluate(() => document.querySelector('#quizPanel .qnot').click());
    assert.equal(await gems(page), start);
    // Nothing about the questions is kept on the device
    const kept = await page.evaluate(() => { window.gameTest.stepFrames([0.05]); return Object.keys(localStorage).map(k => k + '=' + localStorage.getItem(k)).join('\n'); });
    assert.ok(!/quiz|friend|How many|What is|comes next|the most/i.test(kept), 'something about the quiz is stored on the device');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

test('in 20 questions in a row from friends, each has three answers with one right, and none repeats within 10', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const keys = [];
    for (let i = 0; i < 20; i++) {
      const q = await page.evaluate(() => {
        const g = window.gameTest;
        g.clearEnemies(); g.removeFriend(); g.callFriend();
        g.openQuiz();
        const q = g.quizQuestion, n = document.querySelectorAll('#quizPanel .qa').length;
        g.quizNotNow();
        return { key: q.key, right: q.right, n, labels: q.answers.map(a => (a.label || '') + '/' + (a.n ? '' : a.shape || '')) };
      });
      assert.equal(q.n, 3);
      assert.equal(new Set(q.labels).size, 3, 'answers are not all different: ' + q.labels);
      assert.ok(q.right >= 0 && q.right < 3);
      assert.ok(!keys.slice(-10).includes(q.key), 'question ' + (i + 1) + ' repeats within 10: ' + q.key);
      keys.push(q.key);
    }
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

test('with "Quiz friends" off in Settings no friend appears in 15 minutes of play; the switch is remembered, and on again a friend comes', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    assert.equal(await page.evaluate(() => window.gameTest.quizOn), true, 'quiz friends are on at first');
    const a = await friendArrives(page);
    assert.equal(a.error, undefined, a.error);
    await page.dispatchEvent('#settingsBtn', 'click');
    assert.equal(await page.evaluate(() => document.getElementById('quizSwitch').textContent), 'On');
    const size = await page.evaluate(() => { const b = document.getElementById('quizSwitch').getBoundingClientRect(); return Math.min(b.width, b.height); });
    assert.ok(size >= 48, 'the switch is too small to tap: ' + size);
    await page.dispatchEvent('#quizSwitch', 'click');
    assert.equal(await page.evaluate(() => document.getElementById('quizSwitch').textContent), 'Off');
    assert.deepEqual(await page.evaluate(() => ({ on: window.gameTest.quizOn, friend: window.gameTest.friend, kept: localStorage.getItem('kidsgame.quiz') })), { on: false, friend: null, kept: '0' });
    await page.dispatchEvent('#settingsClose', 'click');
    const none = await page.evaluate(() => {
      const g = window.gameTest;
      g.setFriendWait(0);
      let seen = false;
      for (let s = 0; s < 900 && !seen; s++) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); seen = !!g.friend; }
      return seen;
    });
    assert.equal(none, false, 'a friend appeared with the switch off');
    // Still off after closing and opening the game
    await page.reload({ waitUntil: 'domcontentloaded' });
    await playing(page);
    assert.equal(await page.evaluate(() => window.gameTest.quizOn), false, 'the switch was not remembered');
    await page.dispatchEvent('#settingsBtn', 'click');
    await page.dispatchEvent('#quizSwitch', 'click');
    await page.dispatchEvent('#settingsClose', 'click');
    const back = await page.evaluate(() => {
      const g = window.gameTest;
      let secs = 0;
      while (!g.friend && secs < 430) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); secs++; }
      return { on: g.quizOn, friend: !!g.friend, kept: localStorage.getItem('kidsgame.quiz') };
    });
    assert.deepEqual(back, { on: true, friend: true, kept: '1' });
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

test('no friend appears while a monster is within 10 blocks or a panel is open; it leaves after 90 seconds or 40 blocks, and cannot be dug under or built into', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    // A monster 4 blocks away: no friend, however long the wait is over
    const m = await page.evaluate(() => {
      const g = window.gameTest;
      g.clearEnemies(); g.removeFriend(); g.setFriendWait(0);
      let seen = false, placed = true;
      for (let s = 0; s < 20 && !seen; s++) { g.clearEnemies(); placed = g.enemyNear('goblin', 3, 3) && placed; g.stepFrames(Array(20).fill(0.05)); seen = !!g.friend; }
      return { seen, placed };
    });
    assert.equal(m.placed, true);
    assert.equal(m.seen, false, 'a friend appeared with a monster close');
    // The bag is open: no friend. Bag closed and no monster: it comes
    await page.keyboard.press('KeyB');
    const b = await page.evaluate(() => {
      const g = window.gameTest;
      let seen = false;
      for (let s = 0; s < 20 && !seen; s++) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); seen = !!g.friend; }
      return { seen, bag: g.bagOpen };
    });
    assert.deepEqual(b, { seen: false, bag: true }, 'a friend appeared with the bag open');
    await page.keyboard.press('KeyB');
    const c = await page.evaluate(() => {
      const g = window.gameTest;
      for (let s = 0; s < 5 && !g.friend; s++) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); }
      return !!g.friend;
    });
    assert.equal(c, true, 'no friend came once the bag was closed and no monster was close');
    // It cannot be dug under or built into, and it is not a monster
    const a = await friendArrives(page);
    assert.equal(a.error, undefined, a.error);
    const d = await page.evaluate(() => {
      const g = window.gameTest, f = g.friend;
      const x = Math.floor(f.x), z = Math.floor(f.z), y = Math.round(f.y) - 1;
      const under = g.isSolid(g.blockAt(x, y, z));
      g.inv.dirt = 5;
      const dug = g.digCell(x, y, z);
      g.placeCell(x, y + 1, z, 'dirt');
      return { under, dug, still: g.isSolid(g.blockAt(x, y, z)), built: g.isSolid(g.blockAt(x, y + 1, z)), dirt: g.inv.dirt, monsters: g.enemies.length, on: g.friendOn(x, y, z) };
    });
    assert.deepEqual(d, { under: true, dug: false, still: true, built: false, dirt: 5, monsters: 0, on: true });
    // 90 seconds with no answer: it leaves, with no "you missed it" message
    const stay = await page.evaluate(() => {
      const g = window.gameTest, msgs = new Set();
      let left = -1;
      for (let s = 8; s < 100 && left < 0; s++) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); msgs.add(g.msg); if (!g.friend || g.friend.state === 'leave') left = s + 1; }
      for (let s = 0; s < 6; s++) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); msgs.add(g.msg); }
      return { left, gone: g.friend === null, msgs: [...msgs].join(' | '), open: g.quizOpen };
    });
    assert.ok(stay.left >= 89 && stay.left <= 92, 'it left after ' + stay.left + ' seconds');
    assert.equal(stay.gone, true);
    assert.ok(!/miss|late|gone|left/i.test(stay.msgs), 'a message about a missed friend: ' + stay.msgs);
    // More than 40 blocks away: it leaves
    const a2 = await friendArrives(page);
    assert.equal(a2.error, undefined, a2.error);
    const far = await page.evaluate(() => {
      const g = window.gameTest;
      g.walkAway(38);
      g.stepFrames([0.05]);
      const near = g.friend && g.friend.state;
      g.walkAway(5);
      g.stepFrames([0.05]);
      return { near, state: g.friend && g.friend.state };
    });
    assert.deepEqual(far, { near: 'wait', state: 'leave' });
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

const PC = { viewport: { width: 1280, height: 720 } };
for (const [label, device] of [['a phone held sideways', PHONE_WIDE], ['a phone held upright', PHONE_TALL], ['a tablet', TABLET], ['a PC', PC]]) {
  test(`on ${label}, the question panel fits the screen and its buttons are big enough to tap`, { skip, timeout: 240000 }, () =>
    withGame(async (page, errors) => {
      await playing(page);
      for (const kind of ['count', 'add', 'take', 'more', 'next']) {
        for (let n = 0; n < 4; n++) {
          const r = await page.evaluate(kind => {
            const g = window.gameTest;
            g.clearEnemies(); g.removeFriend(); g.callFriend();
            g.askKind(kind);
            g.openQuiz();
            const measure = () => {
              const inView = el => { const b = el.getBoundingClientRect(); return b.left >= -0.5 && b.top >= -0.5 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5; };
              const p = document.getElementById('quizPanel'), box = p.querySelector('.qbox');
              const btns = [...p.querySelectorAll('.qa')], not = p.querySelector('.qnot');
              return { box: inView(box), text: parseFloat(getComputedStyle(p.querySelector('.qtext')).fontSize), textIn: inView(p.querySelector('.qtext')),
                btnIn: btns.every(inView) && inView(not), small: btns.filter(b => b.getBoundingClientRect().height < 60 || b.getBoundingClientRect().width < 60).length,
                notH: not.getBoundingClientRect().height, scroll: box.scrollHeight - box.clientHeight, wide: box.scrollWidth - box.clientWidth };
            };
            const first = measure();
            const q = g.quizQuestion;
            for (const i of [0, 1, 2].filter(i => i !== q.right)) g.answerQuiz(i);   // two wrong tries: the hint shows
            const hinted = measure();
            const hint = getComputedStyle(document.querySelector('#quizPanel .qhint')).display !== 'none';
            g.quizNotNow();
            return { first, hinted, hint, key: q.key };
          }, kind);
          const where = label + ', ' + r.key;
          assert.equal(r.first.box, true, 'the panel is off the screen: ' + where);
          assert.equal(r.first.textIn && r.first.btnIn, true, 'the question or a button is off the screen: ' + where);
          assert.equal(r.first.scroll <= 1 && r.first.wide <= 1, true, 'the panel needs scrolling: ' + where);
          assert.ok(r.first.text >= 22, 'the question text is small: ' + r.first.text);
          assert.equal(r.first.small, 0, 'an answer button is smaller than 60 points: ' + where);
          assert.ok(r.first.notH >= 48, '"Not now" is smaller than 48 points');
          assert.equal(r.hint, true);
          assert.equal(r.hinted.box, true, 'with the hint, the panel is off the screen: ' + where);
          assert.equal(r.hinted.btnIn && r.hinted.scroll <= 1, true, 'with the hint, a button is off the screen: ' + where);
          assert.equal(r.hinted.small, 0);
        }
      }
      assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
    }, { device, saves: [readyGame()] }));
}
