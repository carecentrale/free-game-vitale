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
  const saves = opts.saves || [savedGame()];
  const choice = opts.choice === undefined ? '0' : opts.choice;
  await page.addInitScript(({ saves, choice }) => {
    if (!sessionStorage.getItem('seeded')) {
      saves.forEach((j, i) => localStorage.setItem('kidsgame.slot.' + i, j));
      if (choice !== null) sessionStorage.setItem('kidsgame.choice', choice);
      sessionStorage.setItem('seeded', '1');
    }
  }, { saves, choice });
  await page.goto(base + '/play/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.gameProbe === 'function', null, { timeout: 60000 });
}

const skip = !chromium ? 'playwright is not installed: run npm install'
  : (!CHROME_PATH && !process.env.CI && !fs.existsSync('/opt/pw-browsers') ? 'Chromium not configured: set CHROME_PATH' : false);

async function withGame(fn, opts) {
  const server = await serveWww();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(CHROME_PATH ? { executablePath: CHROME_PATH } : {});
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await setupPage(page, base, opts);
    await fn(page, errors);
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
    // Hold right and jump until the character is past the shore, or 60 s have passed.
    // (A fixed wait is not enough: the game moves as fast as the browser draws frames.)
    await page.keyboard.down('KeyD');
    await page.keyboard.down('Space');
    await page.waitForFunction(() => window.gameProbe().px > 200058, null, { timeout: 60000, polling: 100 }).catch(() => {});
    await page.keyboard.up('KeyD');
    await page.keyboard.up('Space');
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

test('the Fire button is hidden until on-screen controls are on, then tapping it casts a fireball', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    await page.click('#skillPanel [data-skill="fireball"]');
    const hidden = await page.evaluate(() => getComputedStyle(document.getElementById('bFire')).display);
    assert.equal(hidden, 'none', 'the Fire button should be hidden while on-screen controls are off');
    await page.click('#toggle');
    const shown = await page.evaluate(() => getComputedStyle(document.getElementById('bFire')).display);
    assert.notEqual(shown, 'none', 'the Fire button should show once on-screen controls are on');
    const before = await page.evaluate(() => { const p = window.gameProbe(); return p.fireballs + p.blasts; });
    await page.evaluate(() => document.getElementById('bFire').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => { const p = window.gameProbe(); return p.fireballs + p.blasts; });
    assert.ok(after > before, `the Fire button did not cast: ${before} -> ${after}`);
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

// Scenery made in code (0.6.54): every shape of every kind is built, with no model files
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

// Monster models (0.6.54): every Imp and Spike Beast shows its own model, and the bones move when it walks
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
    // Walk out of the water onto the shore with right only (no jump), until the character is in the air above the water edge
    // Hold right and jump to climb, then let go of jump once the character is up over the step
    await page.keyboard.down('KeyD');
    await page.keyboard.down('Space');
    await page.waitForFunction(() => { const p = window.gameProbe(); return p.px > 200057.6 && p.py > 10.5; }, null, { timeout: 60000, polling: 50 });
    await page.keyboard.up('Space');
    await page.keyboard.up('KeyD');
    const before = await page.evaluate(() => window.gameProbe());
    assert.ok(!before.onGround, 'the character should be in the air after letting go of jump: ' + JSON.stringify(before));
    // Tap jump again in the air: the extra jump (held briefly, so the game sees the press)
    await page.keyboard.down('Space');
    await page.waitForTimeout(150);
    await page.keyboard.up('Space');
    const peak = await page.evaluate(() => new Promise(res => {
      let best = -99; const t0 = performance.now();
      const f = () => { const p = window.gameProbe(); best = Math.max(best, p.vy); if (performance.now() - t0 < 300) requestAnimationFrame(f); else res(best); };
      requestAnimationFrame(f);
    }));
    assert.ok(peak > 2, `the extra jump did not lift the character: peak upward speed ${peak}`);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [shoreGame()] }));
